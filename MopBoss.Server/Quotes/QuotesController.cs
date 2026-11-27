using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace MopBoss.Server.Quotes;

public static class RateLimits
{
    /// <summary>Per client IP: a few quote requests per 10 minutes is plenty for a person.</summary>
    public const string QuotePolicy = "quote";
    public const int QuotePermitLimit = 5;
    public static readonly TimeSpan QuoteWindow = TimeSpan.FromMinutes(10);
}

/// <summary>
/// The only public write endpoint. There are deliberately no endpoints for reading
/// requests or changing their status: those are operator tasks (see PRODUCTION_READINESS.md).
/// </summary>
[ApiController]
[Route("api/quote")]
public class QuotesController(QuoteSubmissionService submissions, ILogger<QuotesController> logger)
    : ControllerBase
{
    public const string IdempotencyHeader = "Idempotency-Key";

    /// <summary>Largest accepted request body. A full request is well under 4 KB.</summary>
    public const int MaxBodyBytes = 16 * 1024;

    public record QuoteAccepted(string Reference);

    /// <summary>
    /// Stores a quote request and queues Linda's email. 202 means stored, not emailed:
    /// delivery happens in the background with retries. Repeating a request with the same
    /// Idempotency-Key is safe and returns the same reference.
    /// </summary>
    [HttpPost]
    [EnableRateLimiting(RateLimits.QuotePolicy)]
    [RequestSizeLimit(MaxBodyBytes)]
    [ProducesResponseType<QuoteAccepted>(StatusCodes.Status202Accepted)]
    [ProducesResponseType<QuoteAccepted>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Create(
        [FromBody] QuoteRequestDto dto,
        [FromHeader(Name = IdempotencyHeader)] string? idempotencyKey,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(idempotencyKey, out var key) || key == Guid.Empty)
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Missing Idempotency-Key",
                detail: "Send a new UUID in the Idempotency-Key header for each request, and reuse it when retrying.");

        // Honeypot: look successful so bots learn nothing, but store and send nothing.
        if (dto.IsLikelyBot)
        {
            logger.LogInformation("Dropped a quote request that filled the honeypot field.");
            return StatusCode(StatusCodes.Status202Accepted, new QuoteAccepted(QuoteReference.Create()));
        }

        var result = await submissions.SubmitAsync(dto, key, cancellationToken);
        return result.Outcome switch
        {
            SubmissionOutcome.Created => StatusCode(StatusCodes.Status202Accepted, new QuoteAccepted(result.Reference!)),
            SubmissionOutcome.Replayed or SubmissionOutcome.Duplicate => Ok(new QuoteAccepted(result.Reference!)),
            _ => Problem(
                statusCode: StatusCodes.Status422UnprocessableEntity,
                title: "Idempotency-Key reused",
                detail: "This Idempotency-Key was already used for a different request."),
        };
    }
}
