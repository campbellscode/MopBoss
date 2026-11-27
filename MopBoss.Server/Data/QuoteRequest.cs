namespace MopBoss.Server.Data;

/// <summary>A quote request submitted through the website, stored before Linda is emailed.</summary>
public class QuoteRequest
{
    public Guid Id { get; set; }

    /// <summary>When the server received the request (UTC).</summary>
    public DateTimeOffset ReceivedAt { get; set; }

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

    /// <summary>Set once the notification email to Linda was sent.</summary>
    public DateTimeOffset? NotifiedAt { get; set; }

    /// <summary>Last notification error, so unsent requests can be found and followed up.</summary>
    public string? NotificationError { get; set; }
}
