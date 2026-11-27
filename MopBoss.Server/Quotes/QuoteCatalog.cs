using System.Text.Json;

namespace MopBoss.Server.Quotes;

/// <summary>
/// The quote-form choices the website offers, read from the same
/// mopboss.client/src/content/quote-options.json the website uses (embedded at build).
/// Anything outside these lists is rejected.
/// </summary>
public sealed class QuoteCatalog
{
    public required IReadOnlySet<string> Services { get; init; }
    public required IReadOnlySet<string> Properties { get; init; }
    public required IReadOnlySet<string> Sizes { get; init; }
    public required IReadOnlySet<string> Frequencies { get; init; }
    public required (int Min, int Max) Bedrooms { get; init; }
    public required (int Min, int Max) Bathrooms { get; init; }

    public static QuoteCatalog Default { get; } = LoadEmbedded();

    private static QuoteCatalog LoadEmbedded()
    {
        using var stream = typeof(QuoteCatalog).Assembly.GetManifestResourceStream("quote-options.json")
            ?? throw new InvalidOperationException("Embedded quote-options.json is missing.");
        using var doc = JsonDocument.Parse(stream);
        var root = doc.RootElement;
        IReadOnlySet<string> Set(string name) =>
            root.GetProperty(name).EnumerateArray().Select(e => e.GetString()!).ToHashSet(StringComparer.Ordinal);
        (int, int) Range(string name) =>
            (root.GetProperty(name).GetProperty("min").GetInt32(), root.GetProperty(name).GetProperty("max").GetInt32());

        return new QuoteCatalog
        {
            Services = Set("services"),
            Properties = Set("properties"),
            Sizes = Set("sizes"),
            Frequencies = Set("frequencies"),
            Bedrooms = Range("bedrooms"),
            Bathrooms = Range("bathrooms"),
        };
    }
}
