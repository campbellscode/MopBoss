namespace MopBoss.Server.Configuration;

/// <summary>
/// SMTP settings for Linda's notification email. Works with any provider's SMTP relay.
/// Secrets (Password) come from user secrets locally and environment variables
/// (Smtp__Password) in production, never from appsettings files.
/// </summary>
public class SmtpOptions
{
    public const string Section = "Smtp";

    public string? Host { get; set; }
    public int Port { get; set; } = 587;
    public string? Username { get; set; }
    public string? Password { get; set; }

    /// <summary>StartTls (default), SslOnConnect, or None. Production refuses None.</summary>
    public SmtpSecurity Security { get; set; } = SmtpSecurity.StartTls;

    public int TimeoutSeconds { get; set; } = 30;

    /// <summary>Sender, e.g. "Mop Boss website &lt;quotes@yourdomain&gt;".</summary>
    public string? From { get; set; }

    /// <summary>Linda's approved notification address. Used as-is only in Production.</summary>
    public string? To { get; set; }

    /// <summary>
    /// Outside Production, every notification goes here instead of <see cref="To"/>
    /// when the SMTP host is not a local capture service. Must be empty in Production.
    /// </summary>
    public string? DevelopmentRecipientOverride { get; set; }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Host)
        && !string.IsNullOrWhiteSpace(From)
        && !string.IsNullOrWhiteSpace(To);
}

public enum SmtpSecurity
{
    StartTls,
    SslOnConnect,
    None,
}

/// <summary>Notification outbox worker settings. Defaults suit a single small site.</summary>
public class NotificationOptions
{
    public const string Section = "Notifications";

    /// <summary>Run the background worker in this process.</summary>
    public bool WorkerEnabled { get; set; } = true;

    public int PollIntervalSeconds { get; set; } = 10;
    public int BatchSize { get; set; } = 10;

    /// <summary>Total delivery attempts before a notification is marked Failed.</summary>
    public int MaxAttempts { get; set; } = 8;

    public int BaseDelaySeconds { get; set; } = 30;
    public int MaxDelaySeconds { get; set; } = 3600;

    /// <summary>How long a worker owns a claimed notification. Must exceed the SMTP timeout.</summary>
    public int LeaseSeconds { get; set; } = 120;

    /// <summary>How often to repeat the error log listing unresolved failed notifications.</summary>
    public int FailureReminderMinutes { get; set; } = 60;
}

/// <summary>
/// Reverse proxies whose X-Forwarded-For / X-Forwarded-Proto headers are trusted.
/// When none are configured, forwarded headers are ignored entirely.
/// </summary>
public class ReverseProxyOptions
{
    public const string Section = "ReverseProxy";

    /// <summary>Exact proxy IP addresses, e.g. "10.0.0.4".</summary>
    public string[] KnownProxies { get; set; } = [];

    /// <summary>Proxy networks in CIDR form, e.g. "10.0.0.0/24".</summary>
    public string[] KnownNetworks { get; set; } = [];

    public bool IsConfigured => KnownProxies.Length > 0 || KnownNetworks.Length > 0;
}
