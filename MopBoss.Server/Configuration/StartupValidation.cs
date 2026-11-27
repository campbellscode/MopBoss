using System.Net;
using Microsoft.Data.SqlClient;

namespace MopBoss.Server.Configuration;

/// <summary>
/// Refuses to start with configuration that could touch the wrong database, email
/// the wrong people, or run without encryption in production. Messages never include
/// connection strings, passwords or addresses.
/// </summary>
public static class StartupValidation
{
    public const string DevelopmentDatabase = "MB-Dev";
    public const string ProductionDatabase = "MB-Prod";
    public const string ConnectionStringName = "MopBoss";

    public record DatabaseTarget(string Environment, string Database);

    /// <summary>The only database each environment may use. Other environments may use neither.</summary>
    public static string? ExpectedDatabase(string environment) => environment switch
    {
        "Development" => DevelopmentDatabase,
        "Production" => ProductionDatabase,
        _ => null,
    };

    /// <param name="otherConnectionNames">
    /// Names (never values) of any other ConnectionStrings entries, used only to point out a
    /// likely misnamed key such as Visual Studio's default "DefaultConnection". They are never used.
    /// </param>
    public static (DatabaseTarget? Target, List<string> Errors) ValidateDatabase(
        string environment, string? connectionString, IEnumerable<string>? otherConnectionNames = null)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            var others = (otherConnectionNames ?? [])
                .Where(n => !string.Equals(n, ConnectionStringName, StringComparison.OrdinalIgnoreCase))
                .Order(StringComparer.OrdinalIgnoreCase)
                .Select(n => $"ConnectionStrings:{n}")
                .ToList();
            var hint = others.Count == 0
                ? ""
                : $" Found {string.Join(", ", others)} instead; this API reads only " +
                  $"ConnectionStrings:{ConnectionStringName}, so rename that key if it is the right one.";
            errors.Add(
                $"ConnectionStrings:{ConnectionStringName} is not set for the {environment} environment. " +
                "There is deliberately no fallback. Use user secrets in Development and an " +
                "environment variable or secret manager in Production." + hint);
            return (null, errors);
        }

        SqlConnectionStringBuilder builder;
        try
        {
            builder = new SqlConnectionStringBuilder(connectionString);
        }
        catch (Exception)
        {
            errors.Add($"ConnectionStrings:{ConnectionStringName} is not a valid SQL Server connection string.");
            return (null, errors);
        }

        var database = builder.InitialCatalog;
        if (string.IsNullOrWhiteSpace(database))
        {
            errors.Add($"ConnectionStrings:{ConnectionStringName} must name its database (Initial Catalog / Database).");
            return (null, errors);
        }

        var expected = ExpectedDatabase(environment);
        if (expected is not null && !string.Equals(database, expected, StringComparison.OrdinalIgnoreCase))
            errors.Add($"The {environment} environment must use {expected}, but the connection string targets '{database}'.");
        if (expected is null
            && (string.Equals(database, DevelopmentDatabase, StringComparison.OrdinalIgnoreCase)
                || string.Equals(database, ProductionDatabase, StringComparison.OrdinalIgnoreCase)))
            errors.Add($"The {environment} environment may not use {DevelopmentDatabase} or {ProductionDatabase}.");

        if (environment == "Production")
        {
            if (builder.Encrypt == SqlConnectionEncryptOption.Optional)
                errors.Add("Production database connections must be encrypted (Encrypt=True or Strict).");
            if (builder.TrustServerCertificate)
                errors.Add("Production database connections must validate the server certificate (TrustServerCertificate=False).");
        }

        return (errors.Count == 0 ? new DatabaseTarget(environment, database) : null, errors);
    }

    public static List<string> ValidateSmtp(string environment, SmtpOptions smtp)
    {
        var errors = new List<string>();
        var isProduction = environment == "Production";

        if (!smtp.IsConfigured)
        {
            if (isProduction)
                errors.Add("Production requires Smtp:Host, Smtp:From and Smtp:To so Linda is notified.");
            return errors; // Outside Production an unconfigured notifier only logs.
        }

        if (!TryAddress(smtp.From) || !TryAddress(smtp.To))
            errors.Add("Smtp:From and Smtp:To must be valid email addresses.");
        if (smtp.Port is <= 0 or > 65535)
            errors.Add("Smtp:Port must be between 1 and 65535.");
        if (smtp.TimeoutSeconds is < 5 or > 300)
            errors.Add("Smtp:TimeoutSeconds must be between 5 and 300.");

        // A test inbox must never be Linda's real address (or the sender).
        if (!string.IsNullOrWhiteSpace(smtp.DevelopmentRecipientOverride)
            && (SameAddress(smtp.DevelopmentRecipientOverride, smtp.To) || SameAddress(smtp.DevelopmentRecipientOverride, smtp.From)))
            errors.Add("Smtp:DevelopmentRecipientOverride must be a separate test inbox, not Smtp:To or Smtp:From.");

        if (isProduction)
        {
            if (smtp.Security == SmtpSecurity.None)
                errors.Add("Production SMTP must use StartTls or SslOnConnect.");
            if (!string.IsNullOrWhiteSpace(smtp.DevelopmentRecipientOverride))
                errors.Add("Smtp:DevelopmentRecipientOverride must be empty in Production.");
        }
        else if (!IsLoopback(smtp.Host!))
        {
            // A real relay outside Production must never reach Linda or customers.
            if (string.IsNullOrWhiteSpace(smtp.DevelopmentRecipientOverride))
                errors.Add(
                    $"In {environment}, a non-local SMTP host requires Smtp:DevelopmentRecipientOverride " +
                    "(a test inbox). Otherwise use a local capture service such as smtp4dev or Mailpit.");
            else if (!TryAddress(smtp.DevelopmentRecipientOverride))
                errors.Add("Smtp:DevelopmentRecipientOverride must be a valid email address.");
        }

        return errors;
    }

    public static List<string> ValidateNotifications(string environment, NotificationOptions n, SmtpOptions smtp)
    {
        var errors = new List<string>();
        // There is no separate worker process: switching it off in Production would leave
        // every request unemailed.
        if (environment == "Production" && !n.WorkerEnabled)
            errors.Add("Notifications:WorkerEnabled must be true in Production (no independent worker exists).");
        if (n.MaxAttempts is < 1 or > 50) errors.Add("Notifications:MaxAttempts must be between 1 and 50.");
        if (n.FailureReminderMinutes is < 5 or > 1440) errors.Add("Notifications:FailureReminderMinutes must be between 5 and 1440.");
        if (n.BatchSize is < 1 or > 100) errors.Add("Notifications:BatchSize must be between 1 and 100.");
        if (n.PollIntervalSeconds < 1) errors.Add("Notifications:PollIntervalSeconds must be at least 1.");
        if (n.BaseDelaySeconds < 1 || n.MaxDelaySeconds < n.BaseDelaySeconds)
            errors.Add("Notifications:BaseDelaySeconds must be at least 1 and no more than MaxDelaySeconds.");
        // One send is connect + authenticate + send + disconnect, each bounded by the SMTP
        // timeout; the hard delivery deadline (3/4 of the lease) must leave room for that.
        if (n.LeaseSeconds * 0.75 < smtp.TimeoutSeconds * 2)
            errors.Add("Notifications:LeaseSeconds must be at least 2.7 × Smtp:TimeoutSeconds, so a delivery ends well before its lease.");
        return errors;
    }

    public static List<string> ValidateReverseProxy(ReverseProxyOptions proxy)
    {
        var errors = new List<string>();
        foreach (var ip in proxy.KnownProxies)
            if (!IPAddress.TryParse(ip, out _))
                errors.Add($"ReverseProxy:KnownProxies contains an invalid IP address.");
        foreach (var net in proxy.KnownNetworks)
            if (!System.Net.IPNetwork.TryParse(net, out _))
                errors.Add($"ReverseProxy:KnownNetworks contains an invalid CIDR network.");
        return errors;
    }

    public static List<string> ValidateSiteOrigins(string environment, string[] origins)
    {
        var errors = new List<string>();
        if (environment == "Production" && origins.Length == 0)
            errors.Add("Production requires Site:AllowedOrigins (the website's https origin).");
        foreach (var origin in origins)
        {
            if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) || uri.AbsolutePath != "/")
                errors.Add("Site:AllowedOrigins entries must be bare origins such as https://www.example.com.");
            else if (environment == "Production" && uri.Scheme != Uri.UriSchemeHttps)
                errors.Add("Production Site:AllowedOrigins must use https.");
        }
        return errors;
    }

    private static bool SameAddress(string? a, string? b) =>
        MimeKit.MailboxAddress.TryParse(a ?? "", out var x) && MimeKit.MailboxAddress.TryParse(b ?? "", out var y)
        && string.Equals(x.Address, y.Address, StringComparison.OrdinalIgnoreCase);

    private static bool TryAddress(string? value) =>
        !string.IsNullOrWhiteSpace(value) && MimeKit.MailboxAddress.TryParse(value, out _);

    private static bool IsLoopback(string host) =>
        host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
        || (IPAddress.TryParse(host, out var ip) && IPAddress.IsLoopback(ip));
}
