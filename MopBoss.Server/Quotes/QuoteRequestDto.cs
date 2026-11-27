using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using MopBoss.Server.Data;

namespace MopBoss.Server.Quotes;

/// <summary>
/// The JSON body the website sends. Mirrors QuoteRequestPayload in
/// mopboss.client/src/lib/quote/submit.ts. Unknown properties are rejected.
/// </summary>
public partial class QuoteRequestDto : IValidatableObject
{
    [Required, StringLength(QuoteLimits.Choice)] public string Service { get; set; } = "";
    [Required, StringLength(QuoteLimits.Choice)] public string Property { get; set; } = "";
    public int Bedrooms { get; set; }
    public int Bathrooms { get; set; }
    [Required, StringLength(QuoteLimits.Choice)] public string SquareFeet { get; set; } = "";
    [Required, StringLength(QuoteLimits.Choice)] public string Frequency { get; set; } = "";
    [Required] public ContactDto Contact { get; set; } = new();
    [StringLength(QuoteLimits.Notes)] public string? Notes { get; set; }

    /// <summary>Honeypot. People never see this field; anything in it means a bot.</summary>
    [StringLength(200)] public string? Website { get; set; }

    /// <summary>Client clock, informational only. The server records its own time.</summary>
    public DateTimeOffset? SubmittedAt { get; set; }

    public bool IsLikelyBot => !string.IsNullOrWhiteSpace(Website);

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        var catalog = QuoteCatalog.Default;
        if (!catalog.Services.Contains(Service))
            yield return new ValidationResult("Choose one of the listed services.", ["service"]);
        if (!catalog.Properties.Contains(Property))
            yield return new ValidationResult("Choose one of the listed property types.", ["property"]);
        if (!catalog.Sizes.Contains(SquareFeet))
            yield return new ValidationResult("Choose one of the listed sizes.", ["squareFeet"]);
        if (!catalog.Frequencies.Contains(Frequency))
            yield return new ValidationResult("Choose one of the listed frequencies.", ["frequency"]);
        if (Bedrooms < catalog.Bedrooms.Min || Bedrooms > catalog.Bedrooms.Max)
            yield return new ValidationResult("Bedrooms is out of range.", ["bedrooms"]);
        if (Bathrooms < catalog.Bathrooms.Min || Bathrooms > catalog.Bathrooms.Max)
            yield return new ValidationResult("Bathrooms is out of range.", ["bathrooms"]);

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
        if (HasControlCharacters(c.Name) || HasControlCharacters(c.Phone) || HasControlCharacters(c.Email)
            || HasControlCharacters(c.Zip))
            yield return new ValidationResult("Contact details cannot contain line breaks or control characters.", ["contact"]);
    }

    /// <summary>
    /// SHA-256 over the normalised request (honeypot and client clock excluded). Equal
    /// hashes mean "the same request", used for idempotent replays and resubmit detection.
    /// </summary>
    public string ComputeHash()
    {
        static string N(string? v) => (v ?? "").Trim().ToUpperInvariant();
        var canonical = string.Join('\u001f',
            N(Service), N(Property), Bedrooms, Bathrooms, N(SquareFeet), N(Frequency),
            N(Contact.Name), new string((Contact.Phone ?? "").Where(char.IsDigit).ToArray()),
            N(Contact.Email), N(Contact.Zip), (Notes ?? "").Trim());
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical)));
    }

    private static bool HasControlCharacters(string? value) => value is not null && value.Any(char.IsControl);

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
