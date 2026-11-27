using MailKit.Net.Smtp;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using MopBoss.Server.Configuration;
using MopBoss.Server.Data;
using MopBoss.Server.Notifications;
using MopBoss.Server.Tests.Support;

namespace MopBoss.Server.Tests;

/// <summary>Outbox delivery rules: retries, backoff, exhaustion, leases and shutdown.</summary>
public class NotificationDispatcherTests
{
    private readonly string _dbName = Guid.NewGuid().ToString();
    private readonly MutableClock _clock = new(new DateTimeOffset(2026, 11, 27, 12, 0, 0, TimeSpan.Zero));
    private readonly FakeNotifier _notifier = new();
    private readonly NotificationOptions _options = new() { MaxAttempts = 3, BaseDelaySeconds = 30, MaxDelaySeconds = 3600 };

    private MopBossDbContext Db() =>
        new(new DbContextOptionsBuilder<MopBossDbContext>().UseInMemoryDatabase(_dbName).Options);

    private NotificationDispatcher Dispatcher(MopBossDbContext db) =>
        new(db, _notifier, Options.Create(_options), _clock, NullLogger<NotificationDispatcher>.Instance);

    private async Task<Guid> SeedAsync(Action<NotificationOutbox>? tweak = null)
    {
        await using var db = Db();
        var quote = Payloads.Quote();
        var row = new NotificationOutbox
        {
            Id = Guid.NewGuid(),
            QuoteRequestId = quote.Id,
            NextAttemptAtUtc = _clock.Now,
            CreatedAtUtc = _clock.Now,
            UpdatedAtUtc = _clock.Now,
        };
        tweak?.Invoke(row);
        db.QuoteRequests.Add(quote);
        db.NotificationOutbox.Add(row);
        await db.SaveChangesAsync();
        return row.Id;
    }

    private async Task<NotificationOutbox> Row(Guid id)
    {
        await using var db = Db();
        return await db.NotificationOutbox.SingleAsync(n => n.Id == id);
    }

    private async Task<int> RunOnceAsync(CancellationToken ct = default)
    {
        await using var db = Db();
        return await Dispatcher(db).DispatchDueAsync(ct);
    }

    [Fact]
    public async Task Sends_a_due_notification_and_records_success()
    {
        var id = await SeedAsync();

        Assert.Equal(1, await RunOnceAsync());

        var row = await Row(id);
        Assert.Equal(NotificationStatus.Sent, row.Status);
        Assert.Equal(1, row.Attempts);
        Assert.Equal(_clock.Now, row.SentAtUtc);
        Assert.Null(row.LockedUntilUtc);
        Assert.Equal(("MB-TEST01", row.MessageId), Assert.Single(_notifier.Sent));
    }

    [Fact]
    public async Task Retries_a_transient_failure_with_backoff_and_a_safe_error_summary()
    {
        var id = await SeedAsync();
        _notifier.Failures.Enqueue(new IOException("connection reset talking to linda@example.com"));

        await RunOnceAsync();

        var row = await Row(id);
        Assert.Equal(NotificationStatus.Pending, row.Status);
        Assert.Equal(1, row.Attempts);
        Assert.Equal("IO", row.LastError); // never the message text, which held an address
        var delay = row.NextAttemptAtUtc - _clock.Now;
        Assert.InRange(delay.TotalSeconds, 24, 36); // 30s ± 20% jitter

        Assert.Equal(0, await RunOnceAsync()); // not due yet
        _clock.Advance(TimeSpan.FromSeconds(40));
        Assert.Equal(1, await RunOnceAsync());
        Assert.Equal(NotificationStatus.Sent, (await Row(id)).Status);
    }

    [Fact]
    public async Task Gives_up_after_the_maximum_attempts()
    {
        var id = await SeedAsync();
        for (var i = 0; i < _options.MaxAttempts; i++) _notifier.Failures.Enqueue(new TimeoutException());

        for (var i = 0; i < _options.MaxAttempts; i++)
        {
            await RunOnceAsync();
            _clock.Advance(TimeSpan.FromHours(2));
        }

        var row = await Row(id);
        Assert.Equal(NotificationStatus.Failed, row.Status);
        Assert.Equal(_options.MaxAttempts, row.Attempts);
        Assert.Equal("Timeout", row.LastError);
        Assert.Equal(0, await RunOnceAsync()); // terminal: never picked up again
    }

    [Fact]
    public async Task Fails_immediately_when_the_relay_rejects_the_recipient()
    {
        var id = await SeedAsync();
        _notifier.Failures.Enqueue(new SmtpCommandException(
            SmtpErrorCode.RecipientNotAccepted, SmtpStatusCode.MailboxUnavailable, "550 no such user linda@example.com"));

        await RunOnceAsync();

        var row = await Row(id);
        Assert.Equal(NotificationStatus.Failed, row.Status);
        Assert.Equal(1, row.Attempts);
        Assert.Equal("SmtpCommand:RecipientNotAccepted:550", row.LastError);
    }

    [Fact]
    public async Task Skips_rows_leased_by_another_worker_until_the_lease_expires()
    {
        var id = await SeedAsync(r => { r.LockToken = Guid.NewGuid(); r.LockedUntilUtc = _clock.Now.AddMinutes(1); });

        Assert.Equal(0, await RunOnceAsync());

        // The other worker crashed: once its lease lapses the row is recovered.
        _clock.Advance(TimeSpan.FromMinutes(2));
        Assert.Equal(1, await RunOnceAsync());
        Assert.Equal(NotificationStatus.Sent, (await Row(id)).Status);
    }

    [Fact]
    public async Task Releases_the_lease_without_counting_an_attempt_on_shutdown()
    {
        var id = await SeedAsync();
        using var shutdown = new CancellationTokenSource();
        _notifier.During = async ct => { await shutdown.CancelAsync(); ct.ThrowIfCancellationRequested(); };

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => RunOnceAsync(shutdown.Token));

        var row = await Row(id);
        Assert.Equal(NotificationStatus.Pending, row.Status);
        Assert.Equal(0, row.Attempts);
        Assert.Null(row.LockedUntilUtc);
    }

    [Theory]
    [InlineData(1, 30)]
    [InlineData(2, 60)]
    [InlineData(3, 120)]
    [InlineData(8, 3600)] // capped
    public void Backs_off_exponentially_up_to_the_cap(int attempts, int expectedSeconds)
    {
        var options = new NotificationOptions { BaseDelaySeconds = 30, MaxDelaySeconds = 3600 };
        Assert.Equal(expectedSeconds, RetryPolicy.NextDelay(attempts, options, 0.5).TotalSeconds, 3);
        Assert.True(RetryPolicy.NextDelay(attempts, options, 1).TotalSeconds <= 3600);
    }
}
