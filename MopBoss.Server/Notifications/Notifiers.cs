using System.Text;
using MailKit;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using MopBoss.Server.Data;

namespace MopBoss.Server.Quotes;

/// <summary>Tells Linda that a new quote request arrived.</summary>
public interface IQuoteNotifier
{
    Task NotifyAsync(QuoteRequest request, CancellationToken cancellationToken);
}

/// <summary>
/// SMTP settings for the notification email. Works with any provider's SMTP relay
/// (Postmark, Resend, SendGrid, Microsoft 365, Google Workspace).
/// Keep the password out of appsettings: use user secrets locally and an
/// environment variable (Smtp__Password) in production.
/// </summary>
public class SmtpOptions
{
    public const string Section = "Smtp";

    public string? Host { get; set; }
    public int Port { get; set; } = 587;
    public string? Username { get; set; }
    public string? Password { get; set; }

    /// <summary>Sender address, e.g. "Mop Boss website &lt;quotes@yourdomain&gt;".</summary>
    public string? From { get; set; }

    /// <summary>Where requests go: Linda's inbox.</summary>
    public string? To { get; set; }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Host)
        && !string.IsNullOrWhiteSpace(From)
        && !string.IsNullOrWhiteSpace(To);
}

/// <summary>Used when SMTP is not configured (local development): logs instead of sending.</summary>
public class LoggingQuoteNotifier(ILogger<LoggingQuoteNotifier> logger) : IQuoteNotifier
{
    public Task NotifyAsync(QuoteRequest request, CancellationToken cancellationToken)
    {
        logger.LogWarning(
            "SMTP is not configured; quote request {Id} was stored but no email was sent.",
            request.Id);
        return Task.CompletedTask;
    }
}

/// <summary>Emails Linda a plain-text summary of each request over SMTP (MailKit).</summary>
public class SmtpQuoteNotifier(IOptions<SmtpOptions> options) : IQuoteNotifier
{
    public async Task NotifyAsync(QuoteRequest request, CancellationToken cancellationToken)
    {
        var smtp = options.Value;
        if (!smtp.IsConfigured)
            throw new InvalidOperationException("SMTP settings are incomplete.");
        var message = BuildMessage(request, smtp);

        using var client = new SmtpClient();
        await client.ConnectAsync(
            smtp.Host!, smtp.Port, SecureSocketOptions.StartTlsWhenAvailable, cancellationToken);
        if (!string.IsNullOrEmpty(smtp.Username))
            await client.AuthenticateAsync(smtp.Username, smtp.Password ?? "", cancellationToken);
        await client.SendAsync(new SendRequest(message), cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }

    public static MimeMessage BuildMessage(QuoteRequest r, SmtpOptions smtp)
    {
        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(smtp.From!));
        message.To.Add(MailboxAddress.Parse(smtp.To!));
        if (!string.IsNullOrWhiteSpace(r.Email) && MailboxAddress.TryParse(r.Email, out var replyTo))
            message.ReplyTo.Add(replyTo);

        // Single line only: text typed into a form must never add header lines.
        var name = OneLine(r.Name);
        message.Subject = $"New quote request: {OneLine(r.Service)} for {name}";

        var body = new StringBuilder()
            .AppendLine($"New quote request from the Mop Boss website ({r.ReceivedAt:yyyy-MM-dd HH:mm} UTC).")
            .AppendLine()
            .AppendLine($"Service:   {r.Service}")
            .AppendLine($"Property:  {r.Property}")
            .AppendLine($"Size:      {r.Bedrooms} bed, {r.Bathrooms} bath, {r.SquareFeet}")
            .AppendLine($"Frequency: {r.Frequency}")
            .AppendLine()
            .AppendLine($"Name:      {name}")
            .AppendLine($"Phone:     {r.Phone ?? "-"}")
            .AppendLine($"Email:     {r.Email ?? "-"}")
            .AppendLine($"ZIP:       {r.Zip ?? "-"}")
            .AppendLine()
            .AppendLine("Notes:")
            .AppendLine(string.IsNullOrWhiteSpace(r.Notes) ? "-" : r.Notes)
            .AppendLine()
            .AppendLine($"Reference: {r.Id}");

        message.Body = new TextPart("plain") { Text = body.ToString() };
        return message;
    }

    private static string OneLine(string value) =>
        string.Join(' ', value.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries)).Trim();
}
