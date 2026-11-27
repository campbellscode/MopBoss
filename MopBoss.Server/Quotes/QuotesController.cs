using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MopBoss.Server.Data;

namespace MopBoss.Server.Quotes;

public static class RateLimits
{
    /// <summary>Per client IP: a few quote requests per 10 minutes is plenty for a person.</summary>
    public const string QuotePolicy = "quote";
    public const int QuotePermitLimit = 5;
    public static readonly TimeSpan QuoteWindow = TimeSpan.FromMinutes(10);
}

[ApiController]
[Route("api/quote")]
public class QuotesController(
    MopBossDbContext db,
    IQuoteNotifier notifier,
    TimeProvider clock,
    ILogger<QuotesController> logger) : ControllerBase
{
    public record QuoteAccepted(string Reference);

    /// <summary>
    /// Stores a quote request, then emails Linda. The request is saved first, so a
    /// mail outage never loses it; failures are recorded on the row for follow-up.
    /// </summary>
    [HttpPost]
    [EnableRateLimiting(RateLimits.QuotePolicy)]
    [ProducesResponseType<QuoteAccepted>(StatusCodes.Status202Accepted)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create(
        [FromBody] QuoteRequestDto dto, CancellationToken cancellationToken)
    {
        // Honeypot: look successful so bots learn nothing, but store and send nothing.
        if (dto.IsLikelyBot)
        {
            logger.LogInformation("Dropped a quote request that filled the honeypot field.");
            return StatusCode(StatusCodes.Status202Accepted, new QuoteAccepted("received"));
        }

        var request = new QuoteRequest
        {
            Id = Guid.NewGuid(),
            ReceivedAt = clock.GetUtcNow(),
            Service = dto.Service.Trim(),
            Property = dto.Property.Trim(),
            Bedrooms = dto.Bedrooms,
            Bathrooms = dto.Bathrooms,
            SquareFeet = dto.SquareFeet.Trim(),
            Frequency = dto.Frequency.Trim(),
            Name = dto.Contact.Name.Trim(),
            Phone = Clean(dto.Contact.Phone),
            Email = Clean(dto.Contact.Email),
            Zip = Clean(dto.Contact.Zip),
            Notes = Clean(dto.Notes),
        };

        db.QuoteRequests.Add(request);
        await db.SaveChangesAsync(cancellationToken);

        try
        {
            await notifier.NotifyAsync(request, cancellationToken);
            request.NotifiedAt = clock.GetUtcNow();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Quote request {Id} was stored but the email to Linda failed.", request.Id);
            request.NotificationError = ex.Message.Length > 1000 ? ex.Message[..1000] : ex.Message;
        }
        await db.SaveChangesAsync(CancellationToken.None);

        return StatusCode(
            StatusCodes.Status202Accepted, new QuoteAccepted(request.Id.ToString("N")[..8]));
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
