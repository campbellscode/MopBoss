using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using MopBoss.Server.Data;
using MopBoss.Server.Health;
using MopBoss.Server.Tests.Support;

namespace MopBoss.Server.Tests;

public class HealthCheckTests
{
    private readonly MutableClock _clock = new(new DateTimeOffset(2026, 11, 27, 12, 0, 0, TimeSpan.Zero));
    private readonly MopBossDbContext _db = new(
        new DbContextOptionsBuilder<MopBossDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private async Task<HealthStatus> CheckAsync() =>
        (await new NotificationBacklogHealthCheck(_db, _clock).CheckHealthAsync(new HealthCheckContext(), CancellationToken.None)).Status;

    private void Add(NotificationStatus status, DateTimeOffset nextAttempt, string? lastError = null)
    {
        var quote = Payloads.Quote($"MB-{Guid.NewGuid():N}"[..9]);
        _db.QuoteRequests.Add(quote);
        _db.NotificationOutbox.Add(new NotificationOutbox
        {
            Id = Guid.NewGuid(),
            QuoteRequestId = quote.Id,
            Status = status,
            NextAttemptAtUtc = nextAttempt,
            CreatedAtUtc = _clock.Now,
            UpdatedAtUtc = _clock.Now,
            LastError = lastError,
        });
        _db.SaveChanges();
    }

    [Fact]
    public async Task Healthy_when_everything_was_sent_or_is_on_schedule()
    {
        Add(NotificationStatus.Sent, _clock.Now);
        Add(NotificationStatus.Pending, _clock.Now.AddMinutes(-5));
        Assert.Equal(HealthStatus.Healthy, await CheckAsync());
    }

    [Fact]
    public async Task Degraded_when_a_notification_failed_or_is_overdue()
    {
        Add(NotificationStatus.Failed, _clock.Now, "Timeout");
        Assert.Equal(HealthStatus.Degraded, await CheckAsync());
    }

    [Fact]
    public async Task Degraded_when_a_pending_notification_is_stuck()
    {
        Add(NotificationStatus.Pending, _clock.Now.AddHours(-1));
        Assert.Equal(HealthStatus.Degraded, await CheckAsync());
    }

    [Fact]
    public async Task A_failure_marked_as_handled_manually_no_longer_degrades_health()
    {
        Add(NotificationStatus.Failed, _clock.Now, NotificationBacklogHealthCheck.HandledManually);
        Assert.Equal(HealthStatus.Healthy, await CheckAsync());
    }
}
