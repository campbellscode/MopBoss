using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using MopBoss.Server.Configuration;
using MopBoss.Server.Data;
using MopBoss.Server.Notifications;
using MopBoss.Server.Tests.Support;

namespace MopBoss.Server.Tests;

/// <summary>M1, M5 and the "log-only is not delivery" requirement.</summary>
public class FailureVisibilityTests
{
    private readonly string _dbName = Guid.NewGuid().ToString();
    private readonly MutableClock _clock = new(new DateTimeOffset(2026, 11, 28, 9, 0, 0, TimeSpan.Zero));

    private MopBossDbContext Db() =>
        new(new DbContextOptionsBuilder<MopBossDbContext>().UseInMemoryDatabase(_dbName).Options);

    private async Task<Guid> SeedAsync(string reference, NotificationStatus status = NotificationStatus.Pending)
    {
        await using var db = Db();
        var quote = Payloads.Quote(reference);
        var row = new NotificationOutbox
        {
            Id = Guid.NewGuid(),
            QuoteRequestId = quote.Id,
            Status = status,
            NextAttemptAtUtc = _clock.Now,
            CreatedAtUtc = _clock.Now,
            UpdatedAtUtc = _clock.Now,
        };
        db.QuoteRequests.Add(quote);
        db.NotificationOutbox.Add(row);
        await db.SaveChangesAsync();
        return row.Id;
    }

    [Fact]
    public async Task A_log_only_run_is_recorded_as_suppressed_never_as_sent()
    {
        var id = await SeedAsync("MB-LOG001");
        await using (var db = Db())
            await new NotificationDispatcher(db, new LoggingQuoteNotifier(NullLogger<LoggingQuoteNotifier>.Instance),
                Options.Create(new NotificationOptions()), _clock, NullLogger<NotificationDispatcher>.Instance)
                .DispatchDueAsync(CancellationToken.None);

        await using var check = Db();
        var row = await check.NotificationOutbox.SingleAsync(n => n.Id == id);
        Assert.Equal(NotificationStatus.Suppressed, row.Status);
        Assert.Null(row.SentAtUtc);
        Assert.Equal("NotSent:LoggingNotifier", row.LastError);
    }

    [Fact]
    public async Task Unresolved_failures_are_listed_by_reference_until_handled_and_repeat_on_schedule()
    {
        await SeedAsync("MB-FAIL01", NotificationStatus.Failed);
        await SeedAsync("MB-DONE01", NotificationStatus.HandledManually);
        var log = new ListLogger<NotificationWorker>();
        var settings = new NotificationOptions { FailureReminderMinutes = 60 };
        var worker = new NotificationWorker(
            new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>(),
            Options.Create(settings), _clock, log);

        await using var db = Db();
        Assert.True(await worker.RemindAboutFailuresAsync(db, settings, CancellationToken.None));
        var message = Assert.Single(log.Errors);
        Assert.Contains("MB-FAIL01", message);
        Assert.DoesNotContain("MB-DONE01", message);
        Assert.DoesNotContain("Dana", message); // references only, no customer details

        Assert.False(await worker.RemindAboutFailuresAsync(db, settings, CancellationToken.None)); // not due yet
        _clock.Advance(TimeSpan.FromMinutes(61));
        Assert.True(await worker.RemindAboutFailuresAsync(db, settings, CancellationToken.None)); // repeats
    }

    [Theory]
    [InlineData("linda@example.test")]
    [InlineData("LINDA@example.test")]
    [InlineData("quotes@example.test")]
    public void A_development_override_cannot_be_lindas_address_or_the_sender(string overrideTo)
    {
        var smtp = new SmtpOptions
        {
            Host = "smtp.example.test",
            From = "quotes@example.test",
            To = "linda@example.test",
            DevelopmentRecipientOverride = overrideTo,
        };
        Assert.Contains(StartupValidation.ValidateSmtp("Development", smtp), e => e.Contains("separate test inbox"));
    }
}
