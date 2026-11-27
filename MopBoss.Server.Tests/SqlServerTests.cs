using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using MopBoss.Server.Configuration;
using MopBoss.Server.Data;
using MopBoss.Server.Notifications;
using MopBoss.Server.Quotes;
using MopBoss.Server.Tests.Support;

namespace MopBoss.Server.Tests;

/// <summary>
/// Behaviour that only a real SQL Server shows: migrations, constraints, unique indexes
/// under concurrency, transactions, and the worker end to end. Requires Docker.
/// </summary>
[Collection(SqlServerCollection.Name)]
[Trait("Category", "SqlServer")]
public class SqlServerTests(SqlServerFixture sql)
{
    private static QuoteSubmissionService Service(MopBossDbContext db) =>
        new(db, TimeProvider.System, NullLogger<QuoteSubmissionService>.Instance);

    [Fact]
    public async Task Migrations_upgrade_a_phase_2_database_without_losing_requests()
    {
        var cs = sql.NewDatabase();
        await using (var db = SqlServerFixture.Context(cs))
        {
            await db.Database.GetService<IMigrator>().MigrateAsync("20261127153823_InitialQuoteRequests");
            // Two Phase 2 rows: one was emailed, one failed to email.
            await db.Database.ExecuteSqlRawAsync(@"
INSERT INTO QuoteRequests (Id, ReceivedAt, Service, Property, Bedrooms, Bathrooms, SquareFeet, Frequency, Name, Phone, NotifiedAt, NotificationError)
VALUES ('11111111-1111-1111-1111-111111111111', '2026-11-20T10:00:00+00:00', 'Deep Cleaning', 'House', 2, 1, 'Not sure', 'Weekly', 'Ann', '5135550100', '2026-11-20T10:00:05+00:00', NULL),
       ('22222222-2222-2222-2222-222222222222', '2026-11-21T10:00:00+00:00', 'Deep Cleaning', 'House', 2, 1, 'Not sure', 'Weekly', 'Bo', '5135550101', NULL, 'SMTP down');");

            await db.Database.MigrateAsync();
        }

        await using var check = SqlServerFixture.Context(cs);
        Assert.Empty(await check.Database.GetPendingMigrationsAsync());
        var quotes = await check.QuoteRequests.Include(q => q.Notification).OrderBy(q => q.Name).ToListAsync();
        Assert.Equal(2, quotes.Count);
        Assert.All(quotes, q =>
        {
            Assert.Equal(QuoteStatus.New, q.Status);
            Assert.Matches("^MB-L[0-9]{8}$", q.Reference);
            Assert.NotNull(q.Notification);
        });
        Assert.Equal(new DateTimeOffset(2026, 11, 20, 10, 0, 0, TimeSpan.Zero), quotes[0].CreatedAtUtc);
        Assert.Equal(NotificationStatus.Sent, quotes[0].Notification!.Status);
        // The Phase 2 request that never reached Linda is now queued for delivery.
        Assert.Equal(NotificationStatus.Pending, quotes[1].Notification!.Status);
        Assert.Equal("Legacy", quotes[1].Notification!.LastError);
    }

    [Fact]
    public async Task Legacy_references_cannot_collide_even_when_ids_share_a_prefix()
    {
        var cs = sql.NewDatabase();
        await using (var db = SqlServerFixture.Context(cs))
        {
            await db.Database.GetService<IMigrator>().MigrateAsync("20261127153823_InitialQuoteRequests");
            // Under the old scheme ("MB-" + first 9 hex digits) these two collided and the
            // unique index failed half-way through the migration.
            await db.Database.ExecuteSqlRawAsync(@"
INSERT INTO QuoteRequests (Id, ReceivedAt, Service, Property, Bedrooms, Bathrooms, SquareFeet, Frequency, Name, Phone)
VALUES ('ABCDEF12-3000-0000-0000-000000000001', '2026-11-01T10:00:00+00:00', 'Deep Cleaning', 'House', 2, 1, 'Not sure', 'Weekly', 'Ann', '5135550100'),
       ('ABCDEF12-3999-0000-0000-000000000002', '2026-11-02T10:00:00+00:00', 'Deep Cleaning', 'House', 2, 1, 'Not sure', 'Weekly', 'Bo', '5135550101');");

            await db.Database.MigrateAsync();
        }

        await using var check = SqlServerFixture.Context(cs);
        var references = await check.QuoteRequests.OrderBy(q => q.CreatedAtUtc).Select(q => q.Reference).ToListAsync();
        Assert.Equal(["MB-L00000001", "MB-L00000002"], references);
    }

    [Fact]
    public async Task The_migration_refuses_legacy_rows_that_break_the_new_constraints_and_changes_nothing()
    {
        var cs = sql.NewDatabase();
        await using var db = SqlServerFixture.Context(cs);
        await db.Database.GetService<IMigrator>().MigrateAsync("20261127153823_InitialQuoteRequests");
        await db.Database.ExecuteSqlRawAsync(@"
INSERT INTO QuoteRequests (Id, ReceivedAt, Service, Property, Bedrooms, Bathrooms, SquareFeet, Frequency, Name, Phone, Email)
VALUES (NEWID(), '2026-11-01T10:00:00+00:00', 'Deep Cleaning', 'House', 2, 1, 'Not sure', 'Weekly', 'No Contact', NULL, NULL);");

        var ex = await Assert.ThrowsAsync<SqlException>(() => db.Database.MigrateAsync());

        Assert.Contains("preflight failed", ex.Message);
        Assert.Contains("1 row(s) without phone or email", ex.Message);
        Assert.Equal(["20261127153823_InitialQuoteRequests"], await db.Database.GetAppliedMigrationsAsync());
        // Still the Phase 2 shape: nothing was half-applied.
        Assert.Equal(1, await db.Database.SqlQueryRaw<int>(
            "SELECT COUNT(*) AS [Value] FROM sys.columns WHERE object_id = OBJECT_ID('QuoteRequests') AND name = 'ReceivedAt'").SingleAsync());
    }

    [Fact]
    public async Task The_committed_idempotent_script_creates_the_schema_and_is_safe_to_rerun()
    {
        // database/MopBoss.migrations.idempotent.sql is what an operator reviews and runs.
        var script = await File.ReadAllTextAsync(FindRepoFile("database/MopBoss.migrations.idempotent.sql"));
        var batches = System.Text.RegularExpressions.Regex.Split(script, @"^\s*GO\s*$",
                System.Text.RegularExpressions.RegexOptions.Multiline)
            .Where(b => !string.IsNullOrWhiteSpace(b)).ToList();
        var cs = await sql.NewEmptyDatabaseAsync();

        for (var run = 0; run < 2; run++)
        {
            await using var conn = new SqlConnection(cs);
            await conn.OpenAsync();
            foreach (var batch in batches)
            {
                await using var cmd = new SqlCommand(batch, conn);
                await cmd.ExecuteNonQueryAsync();
            }
        }

        await using var db = SqlServerFixture.Context(cs);
        Assert.Empty(await db.Database.GetPendingMigrationsAsync()); // script and migrations agree
        await Service(db).SubmitAsync(Payloads.Dto(), Guid.NewGuid(), CancellationToken.None);
        Assert.Equal(1, await db.NotificationOutbox.CountAsync());
    }

    private static string FindRepoFile(string relative)
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, relative);
            if (File.Exists(candidate)) return candidate;
        }
        throw new FileNotFoundException(relative);
    }

    [Fact]
    public async Task Stores_the_quote_and_its_notification_in_one_transaction()
    {
        var cs = await sql.NewMigratedDatabaseAsync();
        await using (var db = SqlServerFixture.Context(cs))
        {
            // Bypass API validation: the database check constraint rejects 12 bedrooms.
            await Assert.ThrowsAsync<DbUpdateException>(
                () => Service(db).SubmitAsync(Payloads.Dto(bedrooms: 12), Guid.NewGuid(), CancellationToken.None));
        }

        await using var check = SqlServerFixture.Context(cs);
        Assert.Equal(0, await check.QuoteRequests.CountAsync());
        Assert.Equal(0, await check.NotificationOutbox.CountAsync()); // no orphaned outbox row
    }

    [Fact]
    public async Task Concurrent_requests_with_one_key_store_one_quote()
    {
        var cs = await sql.NewMigratedDatabaseAsync();
        var key = Guid.NewGuid();

        var results = await Task.WhenAll(Enumerable.Range(0, 8).Select(async _ =>
        {
            await using var db = SqlServerFixture.Context(cs);
            return await Service(db).SubmitAsync(Payloads.Dto(), key, CancellationToken.None);
        }));

        Assert.Single(results.Select(r => r.Reference).Distinct());
        Assert.Single(results, r => r.Outcome == SubmissionOutcome.Created);
        await using var check = SqlServerFixture.Context(cs);
        Assert.Equal(1, await check.QuoteRequests.CountAsync());
        Assert.Equal(1, await check.NotificationOutbox.CountAsync());
    }

    [Fact]
    public async Task Concurrent_identical_requests_with_different_keys_store_one_quote()
    {
        var cs = await sql.NewMigratedDatabaseAsync();
        var keys = Enumerable.Range(0, 8).Select(_ => Guid.NewGuid()).ToList();

        var results = await Task.WhenAll(keys.Select(async key =>
        {
            await using var db = SqlServerFixture.Context(cs);
            return await Service(db).SubmitAsync(Payloads.Dto(), key, CancellationToken.None);
        }));

        Assert.Single(results.Select(r => r.Reference).Distinct());
        Assert.Single(results, r => r.Outcome == SubmissionOutcome.Created);
        Assert.Equal(7, results.Count(r => r.Outcome == SubmissionOutcome.Duplicate));
        await using var check = SqlServerFixture.Context(cs);
        Assert.Equal(1, await check.QuoteRequests.CountAsync());
        Assert.Equal(1, await check.NotificationOutbox.CountAsync());
        Assert.Equal(8, await check.IdempotencyKeys.CountAsync()); // every accepted key is durable
    }

    [Fact]
    public async Task Keys_accepted_as_duplicates_keep_their_answer_after_the_window()
    {
        var cs = await sql.NewMigratedDatabaseAsync();
        var clock = new MutableClock(DateTimeOffset.UtcNow);
        QuoteSubmissionService At(MopBossDbContext db) => new(db, clock, NullLogger<QuoteSubmissionService>.Instance);
        var (firstKey, duplicateKey) = (Guid.NewGuid(), Guid.NewGuid());

        await using var db = SqlServerFixture.Context(cs);
        var first = await At(db).SubmitAsync(Payloads.Dto(), firstKey, CancellationToken.None);
        var duplicate = await At(db).SubmitAsync(Payloads.Dto(), duplicateKey, CancellationToken.None);
        Assert.Equal(SubmissionOutcome.Duplicate, duplicate.Outcome);
        Assert.Equal(first.Reference, duplicate.Reference);

        clock.Advance(QuoteSubmissionService.DuplicateWindow + TimeSpan.FromMinutes(1));

        // Retrying the duplicate's key after the window still returns the same quote...
        var retry = await At(db).SubmitAsync(Payloads.Dto(), duplicateKey, CancellationToken.None);
        Assert.Equal(SubmissionOutcome.Replayed, retry.Outcome);
        Assert.Equal(first.Reference, retry.Reference);

        // ...a previously accepted key cannot be reused for different details...
        var conflict = await At(db).SubmitAsync(Payloads.Dto(name: "Someone Else"), duplicateKey, CancellationToken.None);
        Assert.Equal(SubmissionOutcome.KeyConflict, conflict.Outcome);

        // ...and a fresh identical request after the window is a new inquiry.
        var again = await At(db).SubmitAsync(Payloads.Dto(), Guid.NewGuid(), CancellationToken.None);
        Assert.Equal(SubmissionOutcome.Created, again.Outcome);
        Assert.NotEqual(first.Reference, again.Reference);
        Assert.Equal(2, await db.QuoteRequests.CountAsync());
    }

    [Fact]
    public async Task Concurrent_different_requests_with_one_key_store_exactly_one()
    {
        var cs = await sql.NewMigratedDatabaseAsync();
        var key = Guid.NewGuid();

        var results = await Task.WhenAll(Enumerable.Range(0, 6).Select(async i =>
        {
            await using var db = SqlServerFixture.Context(cs);
            return await Service(db).SubmitAsync(Payloads.Dto(name: $"Customer {i}"), key, CancellationToken.None);
        }));

        Assert.Single(results, r => r.Outcome == SubmissionOutcome.Created);
        Assert.All(results.Where(r => r.Outcome != SubmissionOutcome.Created),
            r => Assert.Equal(SubmissionOutcome.KeyConflict, r.Outcome));
        await using var check = SqlServerFixture.Context(cs);
        Assert.Equal(1, await check.QuoteRequests.CountAsync());
        Assert.Equal(1, await check.IdempotencyKeys.CountAsync());
    }

    [Fact]
    public async Task Distinct_inquiries_are_not_blocked_by_each_other()
    {
        var cs = await sql.NewMigratedDatabaseAsync();
        var results = await Task.WhenAll(Enumerable.Range(0, 8).Select(async i =>
        {
            await using var db = SqlServerFixture.Context(cs);
            return await Service(db).SubmitAsync(Payloads.Dto(name: $"Customer {i}"), Guid.NewGuid(), CancellationToken.None);
        }));
        Assert.All(results, r => Assert.Equal(SubmissionOutcome.Created, r.Outcome));
        Assert.Equal(8, results.Select(r => r.Reference).Distinct().Count());
    }

    [Fact]
    public async Task The_database_enforces_unique_references_and_valid_statuses()
    {
        var cs = await sql.NewMigratedDatabaseAsync();
        await using var db = SqlServerFixture.Context(cs);
        db.QuoteRequests.Add(Payloads.Quote("MB-SAME01"));
        await db.SaveChangesAsync();

        db.QuoteRequests.Add(Payloads.Quote("MB-SAME01"));
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        db.ChangeTracker.Clear();

        var ex = await Assert.ThrowsAsync<SqlException>(() => db.Database.ExecuteSqlRawAsync(
            "UPDATE QuoteRequests SET Status = 'Archived'"));
        Assert.Contains("CK_QuoteRequests_Status", ex.Message);
    }

    [Fact]
    public async Task Two_workers_never_send_the_same_notification_twice()
    {
        var cs = await sql.NewMigratedDatabaseAsync();
        await using (var db = SqlServerFixture.Context(cs))
            await Service(db).SubmitAsync(Payloads.Dto(), Guid.NewGuid(), CancellationToken.None);

        var notifier = new FakeNotifier { During = _ => Task.Delay(300) };
        var options = Options.Create(new NotificationOptions());
        await Task.WhenAll(Enumerable.Range(0, 2).Select(async _ =>
        {
            await using var db = SqlServerFixture.Context(cs);
            await new NotificationDispatcher(db, notifier, options, TimeProvider.System,
                NullLogger<NotificationDispatcher>.Instance).DispatchDueAsync(CancellationToken.None);
        }));

        Assert.Equal(1, notifier.Calls);
        await using var check = SqlServerFixture.Context(cs);
        Assert.Equal(NotificationStatus.Sent, (await check.NotificationOutbox.SingleAsync()).Status);
    }

    [Fact]
    public async Task A_slow_batch_on_sql_server_never_lets_a_second_worker_resend_a_live_delivery()
    {
        var cs = await sql.NewMigratedDatabaseAsync();
        var clock = new MutableClock(DateTimeOffset.UtcNow);
        await using (var db = SqlServerFixture.Context(cs))
        {
            var service = new QuoteSubmissionService(db, clock, NullLogger<QuoteSubmissionService>.Instance);
            await service.SubmitAsync(Payloads.Dto(name: "First Customer"), Guid.NewGuid(), CancellationToken.None);
            await service.SubmitAsync(Payloads.Dto(name: "Second Customer"), Guid.NewGuid(), CancellationToken.None);
        }
        var options = Options.Create(new NotificationOptions { LeaseSeconds = 120 });
        var workerB = new FakeNotifier();
        var workerA = new FakeNotifier();
        var competitorRan = false;
        workerA.During = async _ =>
        {
            if (workerA.Calls == 1) { clock.Advance(TimeSpan.FromSeconds(100)); return; } // slow first send
            if (competitorRan) return;
            competitorRan = true;
            await using var db = SqlServerFixture.Context(cs);
            await new NotificationDispatcher(db, workerB, options, clock,
                NullLogger<NotificationDispatcher>.Instance).DispatchDueAsync(CancellationToken.None);
        };

        await using (var db = SqlServerFixture.Context(cs))
            await new NotificationDispatcher(db, workerA, options, clock,
                NullLogger<NotificationDispatcher>.Instance).DispatchDueAsync(CancellationToken.None);

        Assert.True(competitorRan);
        Assert.Equal(2, workerA.Calls);
        Assert.Equal(0, workerB.Calls);
        await using var check = SqlServerFixture.Context(cs);
        Assert.All(await check.NotificationOutbox.ToListAsync(), n => Assert.Equal(NotificationStatus.Sent, n.Status));
    }

    [Fact]
    public async Task End_to_end_the_api_stores_the_request_and_the_worker_emails_it_after_a_retry()
    {
        var cs = await sql.NewMigratedDatabaseAsync();
        await using var smtp = new FakeSmtpServer { RefuseNextConnections = 1 }; // first attempt fails
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
        {
            b.UseEnvironment("Testing");
            b.UseSetting("ConnectionStrings:MopBoss", cs);
            b.UseSetting("Smtp:Host", "127.0.0.1");
            b.UseSetting("Smtp:Port", smtp.Port.ToString());
            b.UseSetting("Smtp:Security", "None");
            b.UseSetting("Smtp:From", "quotes@example.test");
            b.UseSetting("Smtp:To", "linda@example.test");
            b.UseSetting("Smtp:TimeoutSeconds", "10");
            b.UseSetting("Notifications:PollIntervalSeconds", "1");
            b.UseSetting("Notifications:BaseDelaySeconds", "1");
            b.UseSetting("Notifications:MaxDelaySeconds", "2");
        });
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/quote") { Content = JsonContent.Create(Payloads.Valid()) };
        request.Headers.Add(QuotesController.IdempotencyHeader, Guid.NewGuid().ToString());

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var reference = (await response.Content.ReadFromJsonAsync<QuotesController.QuoteAccepted>())!.Reference;

        var deadline = DateTime.UtcNow.AddSeconds(30);
        NotificationOutbox? row = null;
        while (DateTime.UtcNow < deadline)
        {
            await using var db = SqlServerFixture.Context(cs);
            row = await db.NotificationOutbox.AsNoTracking().SingleAsync();
            if (row.Status == NotificationStatus.Sent) break;
            await Task.Delay(250);
        }

        Assert.Equal(NotificationStatus.Sent, row!.Status);
        Assert.Equal(2, row.Attempts);
        var email = Assert.Single(smtp.Messages);
        Assert.Contains(reference, email.Subject);
    }
}
