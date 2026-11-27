using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using MopBoss.Server.Data;

namespace MopBoss.Server.Quotes;

public enum SubmissionOutcome
{
    /// <summary>Stored now, with its notification queued in the same transaction.</summary>
    Created,

    /// <summary>This Idempotency-Key was accepted before for this same request.</summary>
    Replayed,

    /// <summary>An identical request arrived within the de-duplication window under a new key.</summary>
    Duplicate,

    /// <summary>The Idempotency-Key was already accepted for a different request.</summary>
    KeyConflict,
}

public record SubmissionResult(SubmissionOutcome Outcome, string? Reference);

/// <summary>
/// Stores quote requests exactly once.
///
/// Same key: a key, once accepted, always maps to the same quote. The same request with
/// that key is a replay (same reference); a different request with it is a conflict.
/// This holds forever, including for keys answered as duplicates.
///
/// Different keys: an identical request (same details) within <see cref="DuplicateWindow"/>
/// returns the existing quote, and its key is recorded against that quote. After the
/// window, an identical request is a new inquiry: customers may book the same clean again.
///
/// Concurrency (SQL Server): the duplicate check and the insert run in one transaction
/// that holds an application lock named after the request hash, so identical requests
/// are serialised and distinct inquiries never wait for each other. Same-key races on
/// different requests are settled by the IdempotencyKeys primary key. The quote, its
/// outbox row and its key are committed together.
/// </summary>
public class QuoteSubmissionService(
    MopBossDbContext db, TimeProvider clock, ILogger<QuoteSubmissionService> logger)
{
    /// <summary>An identical request within this window is treated as an accidental resubmit.</summary>
    public static readonly TimeSpan DuplicateWindow = TimeSpan.FromMinutes(10);

    private const int MaxReferenceAttempts = 5;
    private const int LockTimeoutMs = 15_000;

    public async Task<SubmissionResult> SubmitAsync(
        QuoteRequestDto dto, Guid idempotencyKey, CancellationToken cancellationToken)
    {
        var hash = dto.ComputeHash();
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                return db.Database.IsRelational()
                    ? await db.Database.CreateExecutionStrategy().ExecuteAsync(
                        () => SubmitInTransactionAsync(dto, idempotencyKey, hash, cancellationToken))
                    : await SubmitCoreAsync(dto, idempotencyKey, hash, cancellationToken);
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex, "PK_IdempotencyKeys"))
            {
                // The same key raced in with a different request and won; answer from the winner.
                db.ChangeTracker.Clear();
                return await FindByKeyAsync(idempotencyKey, hash, cancellationToken)
                    ?? throw new InvalidOperationException("Key conflict without a stored key.", ex);
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex, "IX_QuoteRequests_Reference")
                && attempt < MaxReferenceAttempts)
            {
                db.ChangeTracker.Clear(); // astronomically rare: draw a new reference
            }
        }
    }

    private async Task<SubmissionResult> SubmitInTransactionAsync(
        QuoteRequestDto dto, Guid key, string hash, CancellationToken ct)
    {
        db.ChangeTracker.Clear(); // a retried execution starts clean
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
        await AcquireRequestLockAsync(hash, ct);
        var result = await SubmitCoreAsync(dto, key, hash, ct);
        await tx.CommitAsync(ct);
        return result;
    }

    /// <summary>The decision and the writes. In a transaction holding the request lock on SQL Server.</summary>
    private async Task<SubmissionResult> SubmitCoreAsync(QuoteRequestDto dto, Guid key, string hash, CancellationToken ct)
    {
        var replay = await FindByKeyAsync(key, hash, ct);
        if (replay is not null) return replay;

        var now = clock.GetUtcNow();
        var since = now - DuplicateWindow;
        var recent = await db.QuoteRequests.AsNoTracking()
            .Where(q => q.PayloadHash == hash && q.CreatedAtUtc >= since)
            .OrderByDescending(q => q.CreatedAtUtc)
            .Select(q => new { q.Id, q.Reference })
            .FirstOrDefaultAsync(ct);
        if (recent is not null)
        {
            // Record the new key against the existing quote so retries with it are stable.
            db.IdempotencyKeys.Add(new IdempotencyKey
            {
                Key = key,
                QuoteRequestId = recent.Id,
                PayloadHash = hash,
                CreatedAtUtc = now,
            });
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Identical request within {Minutes} minutes; returning {Reference}.",
                DuplicateWindow.TotalMinutes, recent.Reference);
            return new SubmissionResult(SubmissionOutcome.Duplicate, recent.Reference);
        }

        var quote = Build(dto, hash, now);
        db.QuoteRequests.Add(quote);
        db.IdempotencyKeys.Add(new IdempotencyKey
        {
            Key = key,
            QuoteRequestId = quote.Id,
            PayloadHash = hash,
            CreatedAtUtc = now,
        });
        db.NotificationOutbox.Add(new NotificationOutbox
        {
            Id = Guid.NewGuid(),
            QuoteRequestId = quote.Id,
            Status = NotificationStatus.Pending,
            NextAttemptAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Stored quote {Reference}; notification queued.", quote.Reference);
        return new SubmissionResult(SubmissionOutcome.Created, quote.Reference);
    }

    /// <summary>
    /// Serialises requests with the same details for the rest of the transaction. Uses
    /// sp_getapplock, which any database user may call; it touches no tables.
    /// </summary>
    private async Task AcquireRequestLockAsync(string hash, CancellationToken ct)
    {
        var result = new SqlParameter("@result", SqlDbType.Int) { Direction = ParameterDirection.Output };
        await db.Database.ExecuteSqlRawAsync(
            "EXEC @result = sp_getapplock @Resource = @resource, @LockMode = 'Exclusive', " +
            "@LockOwner = 'Transaction', @LockTimeout = @timeout",
            [result, new SqlParameter("@resource", $"mopboss:quote:{hash}"), new SqlParameter("@timeout", LockTimeoutMs)],
            ct);
        if (result.Value is int code && code < 0)
            throw new TimeoutException($"Could not lock the request for de-duplication (sp_getapplock {code}).");
    }

    private async Task<SubmissionResult?> FindByKeyAsync(Guid key, string hash, CancellationToken ct)
    {
        var existing = await db.IdempotencyKeys.AsNoTracking()
            .Where(k => k.Key == key)
            .Select(k => new { k.PayloadHash, k.QuoteRequest!.Reference })
            .FirstOrDefaultAsync(ct);
        if (existing is null) return null;
        return existing.PayloadHash == hash
            ? new SubmissionResult(SubmissionOutcome.Replayed, existing.Reference)
            : new SubmissionResult(SubmissionOutcome.KeyConflict, null);
    }

    private static QuoteRequest Build(QuoteRequestDto dto, string hash, DateTimeOffset now) => new()
    {
        Id = Guid.NewGuid(),
        Reference = QuoteReference.Create(),
        Status = QuoteStatus.New,
        CreatedAtUtc = now,
        UpdatedAtUtc = now,
        PayloadHash = hash,
        Service = dto.Service,
        Property = dto.Property,
        Bedrooms = dto.Bedrooms,
        Bathrooms = dto.Bathrooms,
        SquareFeet = dto.SquareFeet,
        Frequency = dto.Frequency,
        Name = dto.Contact.Name.Trim(),
        Phone = Clean(dto.Contact.Phone),
        Email = Clean(dto.Contact.Email),
        Zip = Clean(dto.Contact.Zip),
        Notes = Clean(dto.Notes),
    };

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>SQL Server unique-key violations (2601, 2627) on the named key or index.</summary>
    private static bool IsUniqueViolation(DbUpdateException ex, string keyOrIndex) =>
        ex.InnerException is SqlException { Number: 2601 or 2627 } sql
        && sql.Message.Contains(keyOrIndex, StringComparison.Ordinal);
}
