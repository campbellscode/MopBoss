using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using MopBoss.Server.Data;

namespace MopBoss.Server.Quotes;

/// <summary>
/// The JSON body the website sends. Mirrors QuoteRequestPayload in
/// mopboss.client/src/lib/quote/submit.ts.
/// </summary>
public partial class QuoteRequestDto : IValidatableObject
{
    [Required, StringLength(QuoteLimits.Choice)] public string Service { get; set; } = "";
    [Required, StringLength(QuoteLimits.Choice)] public string Property { get; set; } = "";
    [Range(0, 9)] public int Bedrooms { get; set; }
    [Range(1, 9)] public int Bathrooms { get; set; }
    [Required, StringLength(QuoteLimits.Choice)] public string SquareFeet { get; set; } = "";
    [Required, StringLength(QuoteLimits.Choice)] public string Frequency { get; set; } = "";
    [Required] public ContactDto Contact { get; set; } = new();
    [StringLength(QuoteLimits.Notes)] public string? Notes { get; set; }

    /// <summary>Honeypot. People never see this field; anything in it means a bot.</summary>
    public string? Website { get; set; }

    /// <summary>Client clock, informational only. The server records its own time.</summary>
    public DateTimeOffset? SubmittedAt { get; set; }

    public bool IsLikelyBot => !string.IsNullOrWhiteSpace(Website);

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        var c = Contact;
        if (string.IsNullOrWhiteSpace(c.Name))
            yield return new ValidationResult("A name is required.", ["contact.name"]);
        if (string.IsNullOrWhiteSpace(c.Phone) && string.IsNullOrWhiteSpace(c.Email))
            yield return new ValidationResult(
                "A phone number or an email is required.", ["contact.phone", "contact.email"]);
        if (!string.IsNullOrWhiteSpace(c.Email) && !EmailPattern().IsMatch(c.Email.Trim()))
            yield return new ValidationResult("The email address looks incomplete.", ["contact.email"]);
        if (!string.IsNullOrWhiteSpace(c.Phone) && c.Phone.Count(char.IsDigit) < 10)
            yield return new ValidationResult("The phone number needs at least 10 digits.", ["contact.phone"]);
        if (!string.IsNullOrWhiteSpace(c.Zip) && !ZipPattern().IsMatch(c.Zip.Trim()))
            yield return new ValidationResult("ZIP codes are 5 digits.", ["contact.zip"]);
    }

    // Same rules as the client (src/lib/quote/machine.ts).
    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$")]
    private static partial Regex EmailPattern();

    [GeneratedRegex(@"^\d{5}(-\d{4})?$")]
    private static partial Regex ZipPattern();
}

public class ContactDto
{
    [StringLength(QuoteLimits.Name)] public string Name { get; set; } = "";
    [StringLength(QuoteLimits.Phone)] public string? Phone { get; set; }
    [StringLength(QuoteLimits.Email)] public string? Email { get; set; }
    [StringLength(QuoteLimits.Zip)] public string? Zip { get; set; }
}
