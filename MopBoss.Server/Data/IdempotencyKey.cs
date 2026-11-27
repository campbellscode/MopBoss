namespace MopBoss.Server.Data;

/// <summary>
/// Every Idempotency-Key the API has accepted, and the quote it answered with. Keys for
/// requests recognised as duplicates are recorded too, so a retry with any accepted key
/// always gets the same reference, even after the de-duplication window has passed.
/// </summary>
public class IdempotencyKey
{
    public Guid Key { get; set; }
    public Guid QuoteRequestId { get; set; }
    public QuoteRequest? QuoteRequest { get; set; }

    /// <summary>Hash of the request sent with this key; a different request with the same key is refused.</summary>
    public required string PayloadHash { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
}
