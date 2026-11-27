using MopBoss.Server.Data;
using MopBoss.Server.Notifications;

namespace MopBoss.Server.Tests.Support;

/// <summary>Records notifications instead of sending email; can fail on demand.</summary>
public class FakeNotifier : IQuoteNotifier
{
    private readonly object _gate = new();
    public List<(string Reference, string MessageId)> Sent { get; } = [];

    /// <summary>Thrown by the next calls, in order; when empty, sends succeed.</summary>
    public Queue<Exception> Failures { get; } = new();

    /// <summary>Optional pause inside the send, to observe concurrency or cancellation.</summary>
    public Func<CancellationToken, Task>? During { get; set; }

    public int Calls { get; private set; }

    public async Task<DeliveryResult> NotifyAsync(QuoteRequest request, string messageId, CancellationToken cancellationToken)
    {
        Exception? failure = null;
        lock (_gate)
        {
            Calls++;
            if (Failures.Count > 0) failure = Failures.Dequeue();
        }
        if (During is not null) await During(cancellationToken);
        if (failure is not null) throw failure;
        lock (_gate) Sent.Add((request.Reference, messageId));
        return DeliveryResult.Delivered;
    }
}

/// <summary>A clock tests can move.</summary>
public class MutableClock(DateTimeOffset start) : TimeProvider
{
    public DateTimeOffset Now { get; set; } = start;
    public override DateTimeOffset GetUtcNow() => Now;
    public void Advance(TimeSpan by) => Now += by;
}

public static class Payloads
{
    /// <summary>The same shape the website's submit adapter sends.</summary>
    public static object Valid(
        string name = "Dana Smith",
        string? phone = "(513) 555-0100",
        string? email = null,
        string? zip = "45202",
        string website = "",
        string service = "Deep Cleaning",
        string notes = "Two cats.") => new
        {
            service,
            property = "House",
            bedrooms = 2,
            bathrooms = 1,
            squareFeet = "1,000 to 2,000",
            frequency = "Weekly",
            contact = new { name, phone, email, zip },
            notes,
            website,
            submittedAt = "2026-11-27T12:00:00.000Z",
        };

    public static Quotes.QuoteRequestDto Dto(string name = "Dana Smith", int bedrooms = 2) => new()
    {
        Service = "Deep Cleaning",
        Property = "House",
        Bedrooms = bedrooms,
        Bathrooms = 1,
        SquareFeet = "1,000 to 2,000",
        Frequency = "Weekly",
        Contact = new Quotes.ContactDto { Name = name, Phone = "(513) 555-0100" },
    };

    public static QuoteRequest Quote(string reference = "MB-TEST01") => new()
    {
        Id = Guid.NewGuid(),
        Reference = reference,
        CreatedAtUtc = new DateTimeOffset(2026, 11, 27, 12, 0, 0, TimeSpan.Zero),
        UpdatedAtUtc = new DateTimeOffset(2026, 11, 27, 12, 0, 0, TimeSpan.Zero),
        PayloadHash = new string('0', 64),
        Service = "Deep Cleaning",
        Property = "House",
        Bedrooms = 2,
        Bathrooms = 1,
        SquareFeet = "1,000 to 2,000",
        Frequency = "Weekly",
        Name = "Dana Smith",
        Phone = "(513) 555-0100",
        Email = "dana@example.com",
    };
}
