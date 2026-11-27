using System.Security.Authentication;
using MailKit;
using MailKit.Net.Smtp;
using MimeKit;
using MopBoss.Server.Configuration;

namespace MopBoss.Server.Notifications;

/// <summary>Bounded exponential backoff and failure classification for notification delivery.</summary>
public static class RetryPolicy
{
    /// <summary>
    /// Delay before the next attempt after <paramref name="attempts"/> failures:
    /// base × 2^(attempts−1), capped at the maximum, with ±20% jitter so several
    /// stuck messages do not retry in lockstep.
    /// </summary>
    public static TimeSpan NextDelay(int attempts, NotificationOptions options, double jitter01)
    {
        var exponent = Math.Min(Math.Max(attempts - 1, 0), 20);
        var seconds = Math.Min(options.BaseDelaySeconds * Math.Pow(2, exponent), options.MaxDelaySeconds);
        var factor = 0.8 + 0.4 * Math.Clamp(jitter01, 0, 1);
        return TimeSpan.FromSeconds(Math.Min(seconds * factor, options.MaxDelaySeconds));
    }

    /// <summary>
    /// Errors that a retry cannot fix. SMTP says so in the reply code: 5xx is permanent
    /// (for example 550 mailbox unavailable, 553 bad address, 554 transaction failed),
    /// 4xx is temporary (421 service unavailable, 450 mailbox busy or greylisted, 451
    /// local error, 452 insufficient storage), whatever command it answered. A malformed
    /// address can never succeed either. Everything else (timeouts, connection, TLS and
    /// authentication problems) is retried until attempts run out.
    /// </summary>
    public static bool IsPermanent(Exception ex) => ex switch
    {
        SmtpCommandException smtp => (int)smtp.StatusCode is >= 500 and < 600,
        ParseException => true,
        _ => false,
    };

    /// <summary>
    /// A short, safe description for the database and logs: exception type plus SMTP
    /// codes only. Exception messages are excluded because they can echo email addresses.
    /// </summary>
    public static string SafeSummary(Exception ex) => ex switch
    {
        SmtpCommandException smtp => $"SmtpCommand:{smtp.ErrorCode}:{(int)smtp.StatusCode}",
        SmtpProtocolException => "SmtpProtocol",
        AuthenticationException or MailKit.Security.AuthenticationException => "Authentication",
        ServiceNotConnectedException => "NotConnected",
        TimeoutException or OperationCanceledException => "Timeout",
        System.Net.Sockets.SocketException socket => $"Socket:{socket.SocketErrorCode}",
        IOException => "IO",
        _ => ex.GetType().Name,
    };
}
