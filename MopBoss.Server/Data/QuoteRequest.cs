namespace MopBoss.Server.Data;

/// <summary>Where a quote request is in Linda's process. Changed by Linda's team, never by the public API.</summary>
public enum QuoteStatus
{
    New,
    Contacted,
    Quoted,
    Scheduled,
    Completed,
    Cancelled,
}

/// <summary>A quote request submitted through the website.</summary>
public class QuoteRequest
{
    public Guid Id { get; set; }

    /// <summary>Short customer-facing reference, e.g. MB-7K3Q9X. Unique.</summary>
    public required string Reference { get; set; }

    public QuoteStatus Status { get; set; } = QuoteStatus.New;

    /// <summary>When the server stored the request (UTC).</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }

    /// <summary>Last change to this row (UTC).</summary>
    public DateTimeOffset UpdatedAtUtc { get; set; }

    /// <summary>SHA-256 of the normalised request, to recognise replays and accidental resubmits.</summary>
    public required string PayloadHash { get; set; }

    public required string Service { get; set; }
    public required string Property { get; set; }
    public int Bedrooms { get; set; }
    public int Bathrooms { get; set; }
    public required string SquareFeet { get; set; }
    public required string Frequency { get; set; }

    public required string Name { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Zip { get; set; }
    public string? Notes { get; set; }

    public NotificationOutbox? Notification { get; set; }

    public List<IdempotencyKey> IdempotencyKeys { get; set; } = [];
}
