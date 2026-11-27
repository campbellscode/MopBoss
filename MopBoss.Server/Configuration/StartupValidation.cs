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

    public static (DatabaseTarget? Target, List<string> Errors) ValidateDatabase(
        string environment, string? connectionString)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            errors.Add(
                $"ConnectionStrings:{ConnectionStringName} is not set for the {environment} environment. " +
                "There is deliberately no fallback. Use user secrets in Development and an " +
                "environment variable or secret manager in Production.");
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

    public static List<string> ValidateNotifications(NotificationOptions n, SmtpOptions smtp)
    {
        var errors = new List<string>();
        if (n.MaxAttempts is < 1 or > 50) errors.Add("Notifications:MaxAttempts must be between 1 and 50.");
        if (n.BatchSize is < 1 or > 100) errors.Add("Notifications:BatchSize must be between 1 and 100.");
        if (n.PollIntervalSeconds < 1) errors.Add("Notifications:PollIntervalSeconds must be at least 1.");
        if (n.BaseDelaySeconds < 1 || n.MaxDelaySeconds < n.BaseDelaySeconds)
            errors.Add("Notifications:BaseDelaySeconds must be at least 1 and no more than MaxDelaySeconds.");
        if (n.LeaseSeconds <= smtp.TimeoutSeconds * 2)
            errors.Add("Notifications:LeaseSeconds must be more than twice Smtp:TimeoutSeconds, so a slow send cannot be claimed twice.");
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

    private static bool TryAddress(string? value) =>
        !string.IsNullOrWhiteSpace(value) && MimeKit.MailboxAddress.TryParse(value, out _);

    private static bool IsLoopback(string host) =>
        host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
        || (IPAddress.TryParse(host, out var ip) && IPAddress.IsLoopback(ip));
}
