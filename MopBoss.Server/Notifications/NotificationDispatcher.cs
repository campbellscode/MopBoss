using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MopBoss.Server.Configuration;
using MopBoss.Server.Data;

namespace MopBoss.Server.Notifications;

/// <summary>
/// Delivers due outbox rows. Safe to run in several processes at once.
///
/// Claiming: rows are claimed one at a time, each with a lease taken from the clock at
/// the moment of the claim, and guarded by an optimistic concurrency token so only one
/// worker can own a row. (An earlier version read the clock once per batch, so after a
/// slow send the next row could be claimed with a lease that had already expired and a
/// second worker would send it again.)
///
/// Delivery: every send runs under a hard deadline that ends well before the lease
/// (<see cref="DeliveryBudget"/>), so a live delivery cannot outlive its lease. A send
/// cut off by the deadline is recorded as a transient failure and retried.
///
/// What remains is SMTP's at-least-once behaviour, which no queue can remove: if the
/// relay accepts a message and the process dies (or the deadline fires) before the
/// outcome is recorded, the message is sent again later. Both copies carry the same
/// Message-ID so mail clients can collapse them.
/// </summary>
public class NotificationDispatcher(
    MopBossDbContext db,
    IQuoteNotifier notifier,
    IOptions<NotificationOptions> options,
    TimeProvider clock,
    ILogger<NotificationDispatcher> logger)
{
    private const int MaxClaimContention = 5;

    /// <summary>How long one delivery may take: three quarters of the lease.</summary>
    public static TimeSpan DeliveryBudget(NotificationOptions settings) =>
        TimeSpan.FromSeconds(settings.LeaseSeconds * 0.75);

    /// <summary>Processes up to one batch of due notifications. Returns how many were attempted.</summary>
    public async Task<int> DispatchDueAsync(CancellationToken cancellationToken)
    {
        var settings = options.Value;
        var attempted = 0;
        while (attempted < settings.BatchSize)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var row = await ClaimNextAsync(settings, cancellationToken);
            if (row is null) break;
            attempted++;
            await DeliverAsync(row, settings, cancellationToken);
            db.ChangeTracker.Clear();
        }
        return attempted;
    }

    /// <summary>Claims the next due row with a lease starting now. Null when nothing is due.</summary>
    private async Task<NotificationOutbox?> ClaimNextAsync(NotificationOptions settings, CancellationToken ct)
    {
        for (var contention = 0; contention < MaxClaimContention; contention++)
        {
            var now = clock.GetUtcNow();
            var row = await db.NotificationOutbox
                .Where(n => n.Status == NotificationStatus.Pending
                    && n.NextAttemptAtUtc <= now
                    && (n.LockedUntilUtc == null || n.LockedUntilUtc < now))
                .OrderBy(n => n.NextAttemptAtUtc)
                .FirstOrDefaultAsync(ct);
            if (row is null) return null;

            var token = Guid.NewGuid();
            row.LockToken = token;
            row.LockedUntilUtc = now.AddSeconds(settings.LeaseSeconds);
            row.UpdatedAtUtc = now;
            row.ConcurrencyStamp = Guid.NewGuid();
            try
            {
                await db.SaveChangesAsync(ct);
                return row;
            }
            catch (DbUpdateConcurrencyException)
            {
                // Either another worker won, or our own write committed and a connection
                // retry re-sent it. Reload to find out which.
                db.ChangeTracker.Clear();
                var current = await db.NotificationOutbox.AsNoTracking().FirstOrDefaultAsync(n => n.Id == row.Id, ct);
                if (current?.LockToken == token)
                {
                    db.Attach(current);
                    return current;
                }
            }
        }
        return null;
    }

    private async Task DeliverAsync(NotificationOutbox row, NotificationOptions settings, CancellationToken stopping)
    {
        var quote = await db.QuoteRequests.AsNoTracking().FirstOrDefaultAsync(q => q.Id == row.QuoteRequestId, stopping);
        if (quote is null)
        {
            await FinishAsync(row, NotificationStatus.Failed, "QuoteMissing");
            logger.LogError("Notification {NotificationId} has no quote request; marked Failed.", row.Id);
            return;
        }

        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(stopping);
        deadline.CancelAfter(DeliveryBudget(settings));
        DeliveryResult result;
        try
        {
            result = await notifier.NotifyAsync(quote, row.MessageId, deadline.Token);
        }
        catch (OperationCanceledException) when (stopping.IsCancellationRequested)
        {
            // Shutting down. Release the lease so the next start retries promptly; the
            // attempt is not counted because its outcome is unknown.
            row.LockToken = null;
            row.LockedUntilUtc = null;
            row.ConcurrencyStamp = Guid.NewGuid();
            row.UpdatedAtUtc = clock.GetUtcNow();
            await SaveOutcomeAsync(row, quote.Reference);
            throw;
        }
        catch (Exception ex)
        {
            var summary = deadline.IsCancellationRequested ? "DeliveryDeadline" : RetryPolicy.SafeSummary(ex);
            await RecordFailureAsync(row, quote.Reference, summary, permanent: RetryPolicy.IsPermanent(ex), settings);
            return;
        }

        row.Attempts++;
        if (result == DeliveryResult.Suppressed)
        {
            // Logged only, never sent: recorded as such so nobody mistakes it for delivery.
            await FinishAsync(row, NotificationStatus.Suppressed, "NotSent:LoggingNotifier");
            return;
        }
        row.SentAtUtc = clock.GetUtcNow();
        if (await FinishAsync(row, NotificationStatus.Sent, null))
            logger.LogInformation("Notification for quote {Reference} sent (attempt {Attempts}).", quote.Reference, row.Attempts);
    }

    private async Task RecordFailureAsync(
        NotificationOutbox row, string reference, string summary, bool permanent, NotificationOptions settings)
    {
        row.Attempts++;
        if (permanent || row.Attempts >= settings.MaxAttempts)
        {
            if (await FinishAsync(row, NotificationStatus.Failed, summary))
                logger.LogError(
                    "Notification for quote {Reference} FAILED permanently after {Attempts} attempt(s): {Error}. " +
                    "Linda has not been emailed; follow the recovery procedure.",
                    reference, row.Attempts, summary);
            return;
        }

        var delay = RetryPolicy.NextDelay(row.Attempts, settings, Random.Shared.NextDouble());
        row.NextAttemptAtUtc = clock.GetUtcNow() + delay;
        if (await FinishAsync(row, NotificationStatus.Pending, summary))
            logger.LogWarning(
                "Notification for quote {Reference} failed (attempt {Attempts} of {Max}): {Error}. Retrying in {Delay}.",
                reference, row.Attempts, settings.MaxAttempts, summary, delay);
    }

    /// <summary>Records the outcome and releases the lease. False if the lease had been lost.</summary>
    private Task<bool> FinishAsync(NotificationOutbox row, NotificationStatus status, string? error)
    {
        row.Status = status;
        row.LastError = error;
        row.LockToken = null;
        row.LockedUntilUtc = null;
        row.UpdatedAtUtc = clock.GetUtcNow();
        row.ConcurrencyStamp = Guid.NewGuid();
        return SaveOutcomeAsync(row, null);
    }

    private async Task<bool> SaveOutcomeAsync(NotificationOutbox row, string? reference)
    {
        try
        {
            // Recording the outcome must not be skipped because shutdown began after the send.
            await db.SaveChangesAsync(CancellationToken.None);
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            // Should not happen (the delivery budget ends before the lease), but never crash:
            // the row is now owned by another worker, which will record its own outcome.
            logger.LogWarning("Lease on notification {NotificationId} was lost before its outcome was recorded.", row.Id);
            db.ChangeTracker.Clear();
            return false;
        }
    }
}

/// <summary>
/// Background loop that runs the dispatcher until the host stops. It also repeats an
/// Error log (at start-up and every <see cref="NotificationOptions.FailureReminderMinutes"/>)
/// listing the references of unresolved Failed notifications, so a request Linda never
/// received cannot be forgotten after one log line scrolls away.
/// </summary>
public class NotificationWorker(
    IServiceScopeFactory scopes, IOptions<NotificationOptions> options, TimeProvider clock,
    ILogger<NotificationWorker> logger)
    : BackgroundService
{
    private const int ReminderListLimit = 20;
    private DateTimeOffset _nextReminder = DateTimeOffset.MinValue;
    private DateTimeOffset _nextSchemaWarning = DateTimeOffset.MinValue;
    private bool _schemaReady;
    private bool _schemaWarned;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var settings = options.Value;
        var idle = TimeSpan.FromSeconds(settings.PollIntervalSeconds);
        var errorDelay = idle;
        logger.LogInformation("Notification worker started (poll every {Seconds}s).", settings.PollIntervalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                int attempted;
                using (var scope = scopes.CreateScope())
                {
                    if (!await SchemaReadyAsync(scope.ServiceProvider.GetRequiredService<MopBossDbContext>(),
                            settings, stoppingToken))
                    {
                        await Task.Delay(idle, stoppingToken);
                        continue;
                    }
                    attempted = await scope.ServiceProvider.GetRequiredService<NotificationDispatcher>()
                        .DispatchDueAsync(stoppingToken);
                    await RemindAboutFailuresAsync(scope.ServiceProvider.GetRequiredService<MopBossDbContext>(),
                        settings, stoppingToken);
                }
                errorDelay = idle;
                if (attempted == 0) await Task.Delay(idle, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                // Database unavailable or similar: keep the process alive and back off.
                logger.LogError(ex, "Notification worker cycle failed; retrying in {Delay}.", errorDelay);
                try { await Task.Delay(errorDelay, stoppingToken); }
                catch (OperationCanceledException) { break; }
                errorDelay = TimeSpan.FromSeconds(Math.Min(errorDelay.TotalSeconds * 2, 300));
            }
        }
        logger.LogInformation("Notification worker stopped.");
    }

    /// <summary>
    /// False while the database still has pending migrations (they are applied manually, never
    /// here). Processing waits, with one clear warning per reminder interval instead of a
    /// SQL exception every cycle; /health/ready reports the mismatch. Once ready, not checked again.
    /// </summary>
    internal async Task<bool> SchemaReadyAsync(MopBossDbContext db, NotificationOptions settings, CancellationToken ct)
    {
        if (_schemaReady) return true;
        if (!db.Database.IsRelational()) return _schemaReady = true;

        var pending = (await db.Database.GetPendingMigrationsAsync(ct)).Count();
        if (pending == 0)
        {
            if (_schemaWarned) logger.LogInformation("Database migrations are applied; notification processing has started.");
            return _schemaReady = true;
        }

        var now = clock.GetUtcNow();
        if (now >= _nextSchemaWarning)
        {
            logger.LogWarning(
                "Notification processing is waiting: the database has {Pending} pending migration(s), so quote " +
                "requests cannot be stored or emailed yet. Apply the reviewed migrations " +
                "(PRODUCTION_READINESS.md, section 6); they are never applied automatically.", pending);
            _nextSchemaWarning = now.AddMinutes(settings.FailureReminderMinutes);
            _schemaWarned = true;
        }
        return false;
    }

    /// <summary>Logs unresolved failures when the reminder is due. Returns true if it logged.</summary>
    internal async Task<bool> RemindAboutFailuresAsync(MopBossDbContext db, NotificationOptions settings, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        if (now < _nextReminder) return false;
        _nextReminder = now.AddMinutes(settings.FailureReminderMinutes);

        var failed = await db.NotificationOutbox.AsNoTracking()
            .Where(n => n.Status == NotificationStatus.Failed)
            .OrderBy(n => n.CreatedAtUtc)
            .Select(n => n.QuoteRequest!.Reference)
            .Take(ReminderListLimit + 1)
            .ToListAsync(ct);
        if (failed.Count == 0) return false;

        logger.LogError(
            "ACTION NEEDED: {Count} quote request(s) were never emailed to Linda: {References}. " +
            "Follow PRODUCTION_READINESS.md, Operational recovery (database/operations-recovery.sql).",
            failed.Count > ReminderListLimit ? $"{ReminderListLimit}+" : failed.Count.ToString(),
            string.Join(", ", failed.Take(ReminderListLimit)));
        return true;
    }
}
