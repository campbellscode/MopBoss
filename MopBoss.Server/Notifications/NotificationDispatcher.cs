using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MopBoss.Server.Configuration;
using MopBoss.Server.Data;

namespace MopBoss.Server.Notifications;

/// <summary>
/// Delivers due outbox rows. Safe to run in several processes at once: a row is claimed
/// by writing a lease guarded by an optimistic concurrency token, so only one worker
/// can own it. If a process dies mid-send, the lease expires and another attempt runs.
///
/// SMTP has no exactly-once delivery. If the relay accepts a message and the process
/// stops before recording Sent, the message is sent again after the lease expires.
/// Both copies carry the same Message-ID so mail clients can collapse them.
/// </summary>
public class NotificationDispatcher(
    MopBossDbContext db,
    IQuoteNotifier notifier,
    IOptions<NotificationOptions> options,
    TimeProvider clock,
    ILogger<NotificationDispatcher> logger)
{
    /// <summary>Processes one batch of due notifications. Returns how many were attempted.</summary>
    public async Task<int> DispatchDueAsync(CancellationToken cancellationToken)
    {
        var settings = options.Value;
        var now = clock.GetUtcNow();

        var due = await db.NotificationOutbox
            .Where(n => n.Status == NotificationStatus.Pending
                && n.NextAttemptAtUtc <= now
                && (n.LockedUntilUtc == null || n.LockedUntilUtc < now))
            .OrderBy(n => n.NextAttemptAtUtc)
            .Take(settings.BatchSize)
            .ToListAsync(cancellationToken);

        var attempted = 0;
        foreach (var row in due)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (!await TryClaimAsync(row, now, settings, cancellationToken)) continue;
            attempted++;
            await DeliverAsync(row, settings, cancellationToken);
        }
        return attempted;
    }

    private async Task<bool> TryClaimAsync(
        NotificationOutbox row, DateTimeOffset now, NotificationOptions settings, CancellationToken ct)
    {
        row.LockToken = Guid.NewGuid();
        row.LockedUntilUtc = now.AddSeconds(settings.LeaseSeconds);
        row.UpdatedAtUtc = now;
        row.ConcurrencyStamp = Guid.NewGuid();
        try
        {
            await db.SaveChangesAsync(ct);
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            db.Entry(row).State = EntityState.Detached; // another worker claimed it first
            return false;
        }
    }

    private async Task DeliverAsync(NotificationOutbox row, NotificationOptions settings, CancellationToken ct)
    {
        var quote = await db.QuoteRequests.AsNoTracking().FirstOrDefaultAsync(q => q.Id == row.QuoteRequestId, ct);
        if (quote is null)
        {
            await FinishAsync(row, NotificationStatus.Failed, "QuoteMissing");
            logger.LogError("Notification {NotificationId} has no quote request; marked Failed.", row.Id);
            return;
        }

        try
        {
            await notifier.NotifyAsync(quote, row.MessageId, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // Shutting down. Release the lease so the next start retries promptly; the
            // attempt is not counted because its outcome is unknown.
            row.LockToken = null;
            row.LockedUntilUtc = null;
            row.ConcurrencyStamp = Guid.NewGuid();
            row.UpdatedAtUtc = clock.GetUtcNow();
            await SaveQuietlyAsync(row);
            throw;
        }
        catch (Exception ex)
        {
            row.Attempts++;
            var summary = RetryPolicy.SafeSummary(ex);
            if (RetryPolicy.IsPermanent(ex) || row.Attempts >= settings.MaxAttempts)
            {
                await FinishAsync(row, NotificationStatus.Failed, summary);
                logger.LogError(
                    "Notification for quote {Reference} FAILED permanently after {Attempts} attempt(s): {Error}. " +
                    "Linda has not been emailed; follow the recovery procedure.",
                    quote.Reference, row.Attempts, summary);
            }
            else
            {
                var delay = RetryPolicy.NextDelay(row.Attempts, settings, Random.Shared.NextDouble());
                row.NextAttemptAtUtc = clock.GetUtcNow() + delay;
                await FinishAsync(row, NotificationStatus.Pending, summary);
                logger.LogWarning(
                    "Notification for quote {Reference} failed (attempt {Attempts} of {Max}): {Error}. Retrying in {Delay}.",
                    quote.Reference, row.Attempts, settings.MaxAttempts, summary, delay);
            }
            return;
        }

        row.Attempts++;
        row.SentAtUtc = clock.GetUtcNow();
        await FinishAsync(row, NotificationStatus.Sent, null);
        logger.LogInformation("Notification for quote {Reference} sent (attempt {Attempts}).", quote.Reference, row.Attempts);
    }

    private async Task FinishAsync(NotificationOutbox row, NotificationStatus status, string? error)
    {
        row.Status = status;
        row.LastError = error;
        row.LockToken = null;
        row.LockedUntilUtc = null;
        row.UpdatedAtUtc = clock.GetUtcNow();
        row.ConcurrencyStamp = Guid.NewGuid();
        // Recording the outcome must not be skipped because shutdown began after the send.
        await db.SaveChangesAsync(CancellationToken.None);
    }

    private async Task SaveQuietlyAsync(NotificationOutbox row)
    {
        try { await db.SaveChangesAsync(CancellationToken.None); }
        catch (Exception ex) { logger.LogWarning(ex, "Could not release lease for notification {NotificationId}.", row.Id); }
    }
}

/// <summary>Background loop that runs the dispatcher until the host stops.</summary>
public class NotificationWorker(
    IServiceScopeFactory scopes, IOptions<NotificationOptions> options, ILogger<NotificationWorker> logger)
    : BackgroundService
{
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
                    attempted = await scope.ServiceProvider.GetRequiredService<NotificationDispatcher>()
                        .DispatchDueAsync(stoppingToken);
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
}
