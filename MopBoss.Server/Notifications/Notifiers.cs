using System.Net;
using System.Text;
using MailKit;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using MimeKit;
using MopBoss.Server.Configuration;
using MopBoss.Server.Data;

namespace MopBoss.Server.Notifications;

/// <summary>What a notifier actually did. Only Delivered means an SMTP server accepted an email.</summary>
public enum DeliveryResult
{
    Delivered,

    /// <summary>Deliberately not emailed (logging notifier outside Production).</summary>
    Suppressed,
}

/// <summary>Tells Linda that a new quote request arrived.</summary>
public interface IQuoteNotifier
{
    /// <param name="messageId">Stable per notification, so a resend carries the same Message-ID.</param>
    Task<DeliveryResult> NotifyAsync(QuoteRequest request, string messageId, CancellationToken cancellationToken);
}

/// <summary>
/// Used when SMTP is not configured outside Production. It sends nothing and says so:
/// the outbox row becomes Suppressed, never Sent, so a log-only run cannot be mistaken
/// for real delivery. Production refuses to start without SMTP.
/// </summary>
public class LoggingQuoteNotifier(ILogger<LoggingQuoteNotifier> logger) : IQuoteNotifier
{
    public Task<DeliveryResult> NotifyAsync(QuoteRequest request, string messageId, CancellationToken cancellationToken)
    {
        logger.LogWarning(
            "NOT EMAILED: SMTP is not configured, so quote {Reference} was only logged (status Suppressed).",
            request.Reference);
        return Task.FromResult(DeliveryResult.Suppressed);
    }
}

/// <summary>Emails Linda a plain-text summary of each request over SMTP (MailKit).</summary>
public class SmtpQuoteNotifier(IOptions<SmtpOptions> options, IHostEnvironment environment) : IQuoteNotifier
{
    public async Task<DeliveryResult> NotifyAsync(QuoteRequest request, string messageId, CancellationToken cancellationToken)
    {
        var smtp = options.Value;
        var message = BuildMessage(request, smtp, environment.IsProduction(), messageId);

        using var client = new SmtpClient { Timeout = smtp.TimeoutSeconds * 1000 };
        var security = smtp.Security switch
        {
            SmtpSecurity.SslOnConnect => SecureSocketOptions.SslOnConnect,
            SmtpSecurity.None => SecureSocketOptions.None,
            _ => SecureSocketOptions.StartTls,
        };
        await client.ConnectAsync(smtp.Host!, smtp.Port, security, cancellationToken);
        if (!string.IsNullOrEmpty(smtp.Username))
            await client.AuthenticateAsync(smtp.Username, smtp.Password ?? "", cancellationToken);
        await client.SendAsync(new SendRequest(message), cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
        return DeliveryResult.Delivered;
    }

    /// <summary>
    /// Plain text only, so nothing a customer types can become HTML. Header values are
    /// flattened to one line and addresses go through MailKit's parser.
    /// </summary>
    public static MimeMessage BuildMessage(
        QuoteRequest r, SmtpOptions smtp, bool isProduction, string messageId)
    {
        var message = new MimeMessage { MessageId = messageId };
        message.From.Add(MailboxAddress.Parse(smtp.From!));

        // Outside Production a non-local relay may only reach the configured test inbox.
        var recipient = !isProduction && !string.IsNullOrWhiteSpace(smtp.DevelopmentRecipientOverride)
            ? smtp.DevelopmentRecipientOverride
            : smtp.To!;
        message.To.Add(MailboxAddress.Parse(recipient));

        // Reply-To the customer only in Production. In test mail, replying would reach a
        // real or test customer from a test inbox, so it is omitted and the body says why.
        if (isProduction && !string.IsNullOrWhiteSpace(r.Email) && MailboxAddress.TryParse(r.Email, out var replyTo))
            message.ReplyTo.Add(replyTo);

        var name = OneLine(r.Name);
        var prefix = isProduction ? "" : "[TEST] ";
        message.Subject = $"{prefix}New quote request {r.Reference}: {OneLine(r.Service)} for {name}";

        var body = new StringBuilder();
        if (!isProduction)
            body.AppendLine("TEST MESSAGE (not Production). Do not contact this customer from this email;")
                .AppendLine("Reply-To has been removed on purpose.")
                .AppendLine();
        body.AppendLine($"New quote request from the Mop Boss website ({r.CreatedAtUtc:yyyy-MM-dd HH:mm} UTC).")
            .AppendLine($"Reference: {r.Reference}")
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
            .AppendLine(string.IsNullOrWhiteSpace(r.Notes) ? "-" : r.Notes);

        message.Body = new TextPart("plain") { Text = body.ToString() };
        return message;
    }

    private static string OneLine(string value) =>
        string.Join(' ', value.Split(['\r', '\n', '\t'], StringSplitOptions.RemoveEmptyEntries)).Trim();
}
