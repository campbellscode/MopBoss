using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using MopBoss.Server.Data;

namespace MopBoss.Server.Quotes;

public enum SubmissionOutcome
{
    /// <summary>Stored now, with its notification queued in the same transaction.</summary>
    Created,

    /// <summary>The same Idempotency-Key was already used for this same request.</summary>
    Replayed,

    /// <summary>An identical request arrived moments ago under a different key.</summary>
    Duplicate,

    /// <summary>The Idempotency-Key was already used for a different request.</summary>
    KeyConflict,
}

public record SubmissionResult(SubmissionOutcome Outcome, string? Reference);

/// <summary>
/// Stores quote requests exactly once. The quote and its notification outbox row are
/// saved in one transaction, so a stored request always has its email queued.
/// </summary>
public class QuoteSubmissionService(
    MopBossDbContext db, TimeProvider clock, ILogger<QuoteSubmissionService> logger)
{
    /// <summary>An identical request within this window is treated as an accidental resubmit.</summary>
    public static readonly TimeSpan DuplicateWindow = TimeSpan.FromMinutes(10);

    private const int MaxReferenceAttempts = 5;

    public async Task<SubmissionResult> SubmitAsync(
        QuoteRequestDto dto, Guid idempotencyKey, CancellationToken cancellationToken)
    {
        var hash = dto.ComputeHash();

        var replay = await FindByKeyAsync(idempotencyKey, hash, cancellationToken);
        if (replay is not null) return replay;

        var now = clock.GetUtcNow();
        var since = now - DuplicateWindow;
        var recent = await db.QuoteRequests.AsNoTracking()
            .Where(q => q.PayloadHash == hash && q.CreatedAtUtc >= since)
            .OrderByDescending(q => q.CreatedAtUtc)
            .Select(q => q.Reference)
            .FirstOrDefaultAsync(cancellationToken);
        if (recent is not null)
        {
            logger.LogInformation("Identical request within {Minutes} minutes; returning {Reference}.",
                DuplicateWindow.TotalMinutes, recent);
            return new SubmissionResult(SubmissionOutcome.Duplicate, recent);
        }

        for (var attempt = 1; ; attempt++)
        {
            var quote = Build(dto, idempotencyKey, hash, now);
            db.QuoteRequests.Add(quote);
            db.NotificationOutbox.Add(new NotificationOutbox
            {
                Id = Guid.NewGuid(),
                QuoteRequestId = quote.Id,
                Status = NotificationStatus.Pending,
                NextAttemptAtUtc = now,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });

            try
            {
                await db.SaveChangesAsync(cancellationToken); // one transaction: quote + outbox
                logger.LogInformation("Stored quote {Reference}; notification queued.", quote.Reference);
                return new SubmissionResult(SubmissionOutcome.Created, quote.Reference);
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex, "IdempotencyKey"))
            {
                // A concurrent request with the same key won the race; answer as a replay.
                db.ChangeTracker.Clear();
                return await FindByKeyAsync(idempotencyKey, hash, cancellationToken)
                    ?? throw new InvalidOperationException("Idempotency conflict without a stored request.", ex);
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex, "Reference") && attempt < MaxReferenceAttempts)
            {
                db.ChangeTracker.Clear(); // astronomically rare: draw a new reference
            }
        }
    }

    private async Task<SubmissionResult?> FindByKeyAsync(Guid key, string hash, CancellationToken ct)
    {
        var existing = await db.QuoteRequests.AsNoTracking()
            .Where(q => q.IdempotencyKey == key)
            .Select(q => new { q.Reference, q.PayloadHash })
            .FirstOrDefaultAsync(ct);
        if (existing is null) return null;
        return existing.PayloadHash == hash
            ? new SubmissionResult(SubmissionOutcome.Replayed, existing.Reference)
            : new SubmissionResult(SubmissionOutcome.KeyConflict, null);
    }

    private static QuoteRequest Build(QuoteRequestDto dto, Guid key, string hash, DateTimeOffset now) => new()
    {
        Id = Guid.NewGuid(),
        Reference = QuoteReference.Create(),
        Status = QuoteStatus.New,
        CreatedAtUtc = now,
        UpdatedAtUtc = now,
        IdempotencyKey = key,
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

    /// <summary>SQL Server unique index violations (2601, 2627) on the named column's index.</summary>
    private static bool IsUniqueViolation(DbUpdateException ex, string column) =>
        ex.InnerException is SqlException { Number: 2601 or 2627 } sql
        && sql.Message.Contains($"IX_QuoteRequests_{column}", StringComparison.Ordinal);
}
