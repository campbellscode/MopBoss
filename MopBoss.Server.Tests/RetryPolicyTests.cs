using MailKit.Net.Smtp;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Hosting.Internal;
using Microsoft.Extensions.Options;
using MimeKit;
using MopBoss.Server.Configuration;
using MopBoss.Server.Notifications;
using MopBoss.Server.Tests.Support;

namespace MopBoss.Server.Tests;

/// <summary>M8: SMTP 4xx replies are temporary, 5xx permanent, whichever command they answer.</summary>
public class RetryPolicyTests
{
    [Theory]
    [InlineData(SmtpErrorCode.RecipientNotAccepted, 450, false)] // mailbox busy / greylisted
    [InlineData(SmtpErrorCode.RecipientNotAccepted, 451, false)]
    [InlineData(SmtpErrorCode.RecipientNotAccepted, 452, false)] // insufficient storage
    [InlineData(SmtpErrorCode.SenderNotAccepted, 451, false)]
    [InlineData(SmtpErrorCode.MessageNotAccepted, 421, false)] // service not available
    [InlineData(SmtpErrorCode.RecipientNotAccepted, 550, true)]
    [InlineData(SmtpErrorCode.RecipientNotAccepted, 553, true)]
    [InlineData(SmtpErrorCode.SenderNotAccepted, 550, true)]
    [InlineData(SmtpErrorCode.MessageNotAccepted, 554, true)]
    [InlineData(SmtpErrorCode.MessageNotAccepted, 552, true)]
    public void Classifies_smtp_replies_by_their_code(SmtpErrorCode error, int status, bool permanent)
    {
        var ex = new SmtpCommandException(error, (SmtpStatusCode)status, "reply");
        Assert.Equal(permanent, RetryPolicy.IsPermanent(ex));
    }

    [Fact]
    public void Treats_transport_problems_as_temporary_and_bad_addresses_as_permanent()
    {
        Assert.False(RetryPolicy.IsPermanent(new TimeoutException()));
        Assert.False(RetryPolicy.IsPermanent(new IOException()));
        Assert.False(RetryPolicy.IsPermanent(new SmtpProtocolException("dropped")));
        Assert.False(RetryPolicy.IsPermanent(new MailKit.Security.AuthenticationException()));
        Assert.True(RetryPolicy.IsPermanent(new ParseException("bad address", 0, 0)));
    }

    [Fact]
    public async Task A_greylisting_relay_is_retried_rather_than_given_up_on()
    {
        await using var server = new FakeSmtpServer { RecipientReply = "450 4.2.1 Mailbox busy, try later" };
        var options = new SmtpOptions
        {
            Host = "127.0.0.1",
            Port = server.Port,
            Security = SmtpSecurity.None,
            From = "quotes@example.test",
            To = "linda@example.test",
            TimeoutSeconds = 10,
        };
        var notifier = new SmtpQuoteNotifier(Options.Create(options),
            new HostingEnvironment { EnvironmentName = Environments.Development });

        var ex = await Assert.ThrowsAnyAsync<Exception>(
            () => notifier.NotifyAsync(Payloads.Quote(), "<quote-1@notifications.mopboss>", CancellationToken.None));

        Assert.False(RetryPolicy.IsPermanent(ex));
        Assert.Equal("SmtpCommand:RecipientNotAccepted:450", RetryPolicy.SafeSummary(ex));
    }
}
