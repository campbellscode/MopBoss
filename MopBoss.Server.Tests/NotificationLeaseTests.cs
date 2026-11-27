using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using MopBoss.Server.Configuration;
using MopBoss.Server.Data;
using MopBoss.Server.Notifications;
using MopBoss.Server.Tests.Support;

namespace MopBoss.Server.Tests;

/// <summary>
/// H1: leases must be taken at claim time and must outlast the delivery they protect.
/// These failures would be bugs, separate from the accepted SMTP at-least-once case
/// (a relay accepting a message just before the process dies).
/// </summary>
public class NotificationLeaseTests
{
    private readonly string _dbName = Guid.NewGuid().ToString();
    private readonly MutableClock _clock = new(new DateTimeOffset(2026, 11, 28, 9, 0, 0, TimeSpan.Zero));
    private readonly NotificationOptions _options = new() { LeaseSeconds = 120, BatchSize = 10 };

    private MopBossDbContext Db() =>
        new(new DbContextOptionsBuilder<MopBossDbContext>().UseInMemoryDatabase(_dbName).Options);

    private NotificationDispatcher Dispatcher(MopBossDbContext db, IQuoteNotifier notifier) =>
        new(db, notifier, Options.Create(_options), _clock, NullLogger<NotificationDispatcher>.Instance);

    private async Task SeedAsync(params string[] references)
    {
        await using var db = Db();
        foreach (var reference in references)
        {
            var quote = Payloads.Quote(reference);
            db.QuoteRequests.Add(quote);
            db.NotificationOutbox.Add(new NotificationOutbox
            {
                Id = Guid.NewGuid(),
                QuoteRequestId = quote.Id,
                NextAttemptAtUtc = _clock.Now,
                CreatedAtUtc = _clock.Now,
                UpdatedAtUtc = _clock.Now,
            });
        }
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task A_slow_batch_never_hands_a_live_delivery_to_a_competing_worker()
    {
        await SeedAsync("MB-SLOW01", "MB-SLOW02");
        var sends = new List<string>();
        var competitorRan = false;
        var workerA = new ScriptedNotifier(async (quote, _) =>
        {
            sends.Add(quote.Reference);
            if (quote.Reference == "MB-SLOW01")
            {
                _clock.Advance(TimeSpan.FromSeconds(100)); // slow relay: most of the lease
            }
            else if (!competitorRan)
            {
                // While A is mid-send on the second row, worker B polls the queue.
                competitorRan = true;
                await using var db = Db();
                var workerB = new ScriptedNotifier((q, _) => { sends.Add(q.Reference); return Task.CompletedTask; });
                await Dispatcher(db, workerB).DispatchDueAsync(CancellationToken.None);
            }
        });

        await using (var db = Db())
            await Dispatcher(db, workerA).DispatchDueAsync(CancellationToken.None);

        Assert.True(competitorRan);
        Assert.Equal(["MB-SLOW01", "MB-SLOW02"], sends); // each sent exactly once
        await using var check = Db();
        Assert.All(await check.NotificationOutbox.ToListAsync(), n => Assert.Equal(NotificationStatus.Sent, n.Status));
    }

    [Fact]
    public async Task Each_claim_takes_its_lease_from_the_clock_at_claim_time()
    {
        await SeedAsync("MB-LEASE1", "MB-LEASE2");
        DateTimeOffset? secondLease = null;
        DateTimeOffset? secondClaimTime = null;
        var notifier = new ScriptedNotifier(async (quote, _) =>
        {
            if (quote.Reference == "MB-LEASE1") { _clock.Advance(TimeSpan.FromSeconds(90)); return; }
            secondClaimTime = _clock.Now;
            await using var db = Db();
            secondLease = (await db.NotificationOutbox.AsNoTracking()
                .SingleAsync(n => n.QuoteRequest!.Reference == "MB-LEASE2")).LockedUntilUtc;
        });

        await using (var db = Db())
            await Dispatcher(db, notifier).DispatchDueAsync(CancellationToken.None);

        Assert.Equal(secondClaimTime!.Value.AddSeconds(_options.LeaseSeconds), secondLease);
    }

    [Fact]
    public async Task A_delivery_that_would_outlive_its_lease_is_cut_off_and_retried()
    {
        await SeedAsync("MB-HANG01");
        var notifier = new ScriptedNotifier(async (_, ct) => await Task.Delay(Timeout.Infinite, ct));
        var shortLease = new NotificationOptions { LeaseSeconds = 2, BatchSize = 1 };

        await using (var db = Db())
            await new NotificationDispatcher(db, notifier, Options.Create(shortLease),
                _clock, NullLogger<NotificationDispatcher>.Instance).DispatchDueAsync(CancellationToken.None);

        await using var check = Db();
        var row = await check.NotificationOutbox.SingleAsync();
        Assert.Equal(NotificationStatus.Pending, row.Status); // retried later, not stuck
        Assert.Equal(1, row.Attempts);
        Assert.Equal("DeliveryDeadline", row.LastError);
        Assert.Null(row.LockedUntilUtc);
    }

    [Fact]
    public void The_delivery_budget_always_ends_before_the_lease()
    {
        var budget = NotificationDispatcher.DeliveryBudget(new NotificationOptions { LeaseSeconds = 120 });
        Assert.True(budget < TimeSpan.FromSeconds(120));
        Assert.True(budget >= TimeSpan.FromSeconds(60));
    }

    private sealed class ScriptedNotifier(Func<QuoteRequest, CancellationToken, Task> send) : IQuoteNotifier
    {
        public async Task<DeliveryResult> NotifyAsync(QuoteRequest request, string messageId, CancellationToken ct)
        {
            await send(request, ct);
            return DeliveryResult.Delivered;
        }
    }
}
