using MopBoss.Server.Data;
using MopBoss.Server.Quotes;

namespace MopBoss.Server.Tests;

public class NotificationEmailTests
{
    private static readonly SmtpOptions Smtp = new()
    {
        Host = "smtp.example.test",
        From = "Mop Boss website <quotes@example.test>",
        To = "linda@example.test",
    };

    private static QuoteRequest Request(string name = "Dana Smith", string? email = "dana@example.com") => new()
    {
        Id = Guid.Parse("2f1c6a3e-0000-4000-8000-000000000001"),
        ReceivedAt = new DateTimeOffset(2026, 11, 27, 12, 0, 0, TimeSpan.Zero),
        Service = "Deep Cleaning",
        Property = "House",
        Bedrooms = 2,
        Bathrooms = 1,
        SquareFeet = "1,000 to 2,000",
        Frequency = "Weekly",
        Name = name,
        Phone = "(513) 555-0100",
        Email = email,
    };

    [Fact]
    public void Addresses_Linda_and_lets_her_reply_to_the_client()
    {
        var message = SmtpQuoteNotifier.BuildMessage(Request(), Smtp);

        Assert.Equal("linda@example.test", message.To.Mailboxes.Single().Address);
        Assert.Equal("dana@example.com", message.ReplyTo.Mailboxes.Single().Address);
        Assert.Equal("New quote request: Deep Cleaning for Dana Smith", message.Subject);
        Assert.Contains("Size:      2 bed, 1 bath, 1,000 to 2,000", message.TextBody);
        Assert.Contains("Reference: 2f1c6a3e-0000-4000-8000-000000000001", message.TextBody);
    }

    [Fact]
    public void Keeps_names_with_line_breaks_on_one_subject_line()
    {
        var message = SmtpQuoteNotifier.BuildMessage(Request(name: "Dana\r\nBcc: someone@evil.test"), Smtp);

        var subject = message.Subject ?? "";
        Assert.DoesNotContain('\n', subject);
        Assert.DoesNotContain('\r', subject);
        Assert.Empty(message.Bcc);
    }

    [Fact]
    public void Skips_reply_to_when_the_client_gave_no_usable_email()
    {
        var message = SmtpQuoteNotifier.BuildMessage(Request(email: null), Smtp);

        Assert.Empty(message.ReplyTo);
    }
}
