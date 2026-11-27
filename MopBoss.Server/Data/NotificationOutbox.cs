namespace MopBoss.Server.Data;

public enum NotificationStatus
{
    /// <summary>Waiting to be sent, or waiting for its next retry.</summary>
    Pending,

    /// <summary>The SMTP server accepted the message.</summary>
    Sent,

    /// <summary>Gave up: permanent error or attempts exhausted. Needs an operator (see PRODUCTION_READINESS.md).</summary>
    Failed,
}

/// <summary>
/// Transactional outbox row: written in the same transaction as its quote request and
/// delivered later by <c>NotificationWorker</c>, with bounded retries.
/// </summary>
public class NotificationOutbox
{
    public const string QuoteReceivedKind = "QuoteReceived";

    public Guid Id { get; set; }
    public Guid QuoteRequestId { get; set; }
    public QuoteRequest? QuoteRequest { get; set; }

    public string Kind { get; set; } = QuoteReceivedKind;
    public NotificationStatus Status { get; set; } = NotificationStatus.Pending;

    /// <summary>Delivery attempts made so far.</summary>
    public int Attempts { get; set; }

    /// <summary>Earliest time the next attempt may run (UTC).</summary>
    public DateTimeOffset NextAttemptAtUtc { get; set; }

    /// <summary>While set and in the future, one worker owns this row.</summary>
    public DateTimeOffset? LockedUntilUtc { get; set; }

    /// <summary>Claim token of the worker that owns the lease.</summary>
    public Guid? LockToken { get; set; }

    public DateTimeOffset? SentAtUtc { get; set; }

    /// <summary>Exception type and SMTP status code only. Never message text, which can contain addresses.</summary>
    public string? LastError { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }

    /// <summary>Optimistic concurrency token: two workers cannot both claim or update the row.</summary>
    public Guid ConcurrencyStamp { get; set; } = Guid.NewGuid();

    /// <summary>Stable Message-ID, so any resend of this notification carries the same header.</summary>
    public string MessageId => $"<quote-{QuoteRequestId:N}@notifications.mopboss>";
}
