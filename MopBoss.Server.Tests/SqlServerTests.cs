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
            Assert.Matches("^MB-[0-9A-F]{9}$", q.Reference);
            Assert.NotNull(q.Notification);
        });
        Assert.Equal(new DateTimeOffset(2026, 11, 20, 10, 0, 0, TimeSpan.Zero), quotes[0].CreatedAtUtc);
        Assert.Equal(NotificationStatus.Sent, quotes[0].Notification!.Status);
        // The Phase 2 request that never reached Linda is now queued for delivery.
        Assert.Equal(NotificationStatus.Pending, quotes[1].Notification!.Status);
        Assert.Equal("Legacy", quotes[1].Notification!.LastError);
    }

    [Fact]
    public async Task The_committed_idempotent_script_creates_the_schema_and_is_safe_to_rerun()
    {
        // database/MopBoss.migrations.idempotent.sql is what an operator reviews and runs.
        var script = await File.ReadAllTextAsync(FindRepoFile("database/MopBoss.migrations.idempotent.sql"));
        var batches = System.Text.RegularExpressions.Regex.Split(script, @"^\s*GO\s*$",
                System.Text.RegularExpressions.RegexOptions.Multiline)
            .Where(b => !string.IsNullOrWhiteSpace(b)).ToList();
        var cs = sql.NewDatabase();
        await using (var create = SqlServerFixture.Context(cs))
            await create.Database.EnsureCreatedAsync(); // empty database shell only
        await using (var reset = SqlServerFixture.Context(cs))
        {
            await reset.Database.ExecuteSqlRawAsync("DROP TABLE IF EXISTS NotificationOutbox; DROP TABLE IF EXISTS QuoteRequests;");
        }

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
