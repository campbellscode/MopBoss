using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Hosting.Internal;
using Microsoft.Extensions.Options;
using MopBoss.Server.Configuration;
using MopBoss.Server.Notifications;
using MopBoss.Server.Tests.Support;

namespace MopBoss.Server.Tests;

public class NotificationEmailTests
{
    private static readonly SmtpOptions Smtp = new()
    {
        Host = "smtp.example.test",
        From = "Mop Boss website <quotes@example.test>",
        To = "linda@example.test",
        DevelopmentRecipientOverride = "test-inbox@example.test",
    };

    private const string MessageId = "<quote-1@notifications.mopboss>";

    [Fact]
    public void Production_addresses_Linda_with_the_reference_and_lets_her_reply_to_the_client()
    {
        var message = SmtpQuoteNotifier.BuildMessage(Payloads.Quote("MB-7K3Q9X"), Smtp, isProduction: true, MessageId);

        Assert.Equal("linda@example.test", message.To.Mailboxes.Single().Address);
        Assert.Equal("dana@example.com", message.ReplyTo.Mailboxes.Single().Address);
        Assert.Equal("New quote request MB-7K3Q9X: Deep Cleaning for Dana Smith", message.Subject);
        Assert.Equal("quote-1@notifications.mopboss", message.MessageId);
        Assert.Contains("Reference: MB-7K3Q9X", message.TextBody);
        Assert.Contains("Size:      2 bed, 1 bath, 1,000 to 2,000", message.TextBody);
        Assert.Null(message.HtmlBody); // plain text only: nothing typed can become HTML
    }

    [Fact]
    public void Outside_production_only_the_test_inbox_is_addressed_and_the_subject_is_marked()
    {
        var message = SmtpQuoteNotifier.BuildMessage(Payloads.Quote(), Smtp, isProduction: false, MessageId);

        Assert.Equal("test-inbox@example.test", message.To.Mailboxes.Single().Address);
        Assert.StartsWith("[TEST] ", message.Subject);
        // Replying from a test inbox must not reach the customer.
        Assert.Empty(message.ReplyTo);
        Assert.StartsWith("TEST MESSAGE (not Production)", message.TextBody);
    }

    [Fact]
    public void Keeps_names_with_line_breaks_on_one_subject_line()
    {
        var quote = Payloads.Quote();
        quote.Name = "Dana\r\nBcc: someone@evil.test";

        var message = SmtpQuoteNotifier.BuildMessage(quote, Smtp, isProduction: true, MessageId);

        var subject = message.Subject ?? "";
        Assert.DoesNotContain('\n', subject);
        Assert.DoesNotContain('\r', subject);
        Assert.Empty(message.Bcc);
    }

    [Fact]
    public async Task Delivers_through_a_real_smtp_conversation()
    {
        await using var server = new FakeSmtpServer();
        var options = new SmtpOptions
        {
            Host = "127.0.0.1",
            Port = server.Port,
            Security = SmtpSecurity.None,
            From = "quotes@example.test",
            To = "linda@example.test",
            TimeoutSeconds = 10,
        };
        var notifier = new SmtpQuoteNotifier(Options.Create(options), new HostingEnvironment { EnvironmentName = Environments.Development });

        await notifier.NotifyAsync(Payloads.Quote("MB-SMTP01"), MessageId, CancellationToken.None);

        var received = Assert.Single(server.Messages);
        Assert.Equal("[TEST] New quote request MB-SMTP01: Deep Cleaning for Dana Smith", received.Subject);
        Assert.Contains("Reference: MB-SMTP01", received.TextBody);
    }

    [Fact]
    public async Task Surfaces_a_permanent_rejection_from_the_relay()
    {
        await using var server = new FakeSmtpServer { RejectRecipients = true };
        var options = new SmtpOptions
        {
            Host = "127.0.0.1",
            Port = server.Port,
            Security = SmtpSecurity.None,
            From = "quotes@example.test",
            To = "linda@example.test",
            TimeoutSeconds = 10,
        };
        var notifier = new SmtpQuoteNotifier(Options.Create(options), new HostingEnvironment { EnvironmentName = Environments.Development });

        var ex = await Assert.ThrowsAnyAsync<Exception>(
            () => notifier.NotifyAsync(Payloads.Quote(), MessageId, CancellationToken.None));

        Assert.True(RetryPolicy.IsPermanent(ex));
        Assert.Empty(server.Messages);
    }
}
