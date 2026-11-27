using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MopBoss.Server.Data;
using MopBoss.Server.Notifications;
using MopBoss.Server.Quotes;
using MopBoss.Server.Tests.Support;

namespace MopBoss.Server.Tests;

/// <summary>
/// The API pipeline over EF Core in-memory with the worker switched off. In-memory does
/// not enforce unique indexes, check constraints or transactions; those behaviours are
/// covered against real SQL Server in SqlServerTests.
/// </summary>
public sealed class QuoteApiFactory : WebApplicationFactory<Program>
{
    private readonly string _dbName = Guid.NewGuid().ToString();
    public FakeNotifier Notifier { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:MopBoss", "Server=unused.invalid;Database=MopBossTest_InMemory");
        builder.UseSetting("Site:AllowedOrigins:0", "https://mopboss.test");
        builder.UseSetting("Notifications:WorkerEnabled", "false");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<MopBossDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<MopBossDbContext>>();
            services.AddDbContext<MopBossDbContext>(o => o.UseInMemoryDatabase(_dbName));
            services.RemoveAll<IQuoteNotifier>();
            services.AddSingleton<IQuoteNotifier>(Notifier);
        });
    }

    public T Query<T>(Func<MopBossDbContext, T> query)
    {
        using var scope = Services.CreateScope();
        return query(scope.ServiceProvider.GetRequiredService<MopBossDbContext>());
    }
}

public class QuoteApiTests : IDisposable
{
    private readonly QuoteApiFactory _factory = new();
    private readonly HttpClient _client;

    public QuoteApiTests() => _client = _factory.CreateClient();

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private Task<HttpResponseMessage> Post(object payload, Guid? key = null, bool withKey = true)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/quote") { Content = JsonContent.Create(payload) };
        if (withKey) request.Headers.Add(QuotesController.IdempotencyHeader, (key ?? Guid.NewGuid()).ToString());
        return _client.SendAsync(request);
    }

    private static async Task<string> ReferenceOf(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<QuotesController.QuoteAccepted>())!.Reference;

    [Fact]
    public async Task Stores_the_request_and_queues_the_email_without_sending_it_inline()
    {
        var response = await Post(Payloads.Valid());

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var reference = await ReferenceOf(response);
        Assert.Matches(@"^MB-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$", reference);

        var stored = _factory.Query(db => db.QuoteRequests.Single());
        Assert.Equal(reference, stored.Reference);
        Assert.Equal(QuoteStatus.New, stored.Status);
        Assert.Equal(stored.CreatedAtUtc, stored.UpdatedAtUtc);
        Assert.Equal(TimeSpan.Zero, stored.CreatedAtUtc.Offset);

        var outbox = _factory.Query(db => db.NotificationOutbox.Single());
        Assert.Equal(stored.Id, outbox.QuoteRequestId);
        Assert.Equal(NotificationStatus.Pending, outbox.Status);
        Assert.Equal(0, outbox.Attempts);
        Assert.Equal(0, _factory.Notifier.Calls); // delivery is the worker's job
    }

    [Fact]
    public async Task Requires_an_idempotency_key()
    {
        var missing = await Post(Payloads.Valid(), withKey: false);
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        Assert.Contains("Idempotency-Key", await missing.Content.ReadAsStringAsync());
        Assert.Equal(0, _factory.Query(db => db.QuoteRequests.Count()));
    }

    [Fact]
    public async Task Replays_a_retry_with_the_same_key_instead_of_storing_it_twice()
    {
        var key = Guid.NewGuid();
        var first = await Post(Payloads.Valid(), key);
        var retry = await Post(Payloads.Valid(), key);

        Assert.Equal(HttpStatusCode.Accepted, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        Assert.Equal(await ReferenceOf(first), await ReferenceOf(retry));
        Assert.Equal(1, _factory.Query(db => db.QuoteRequests.Count()));
        Assert.Equal(1, _factory.Query(db => db.NotificationOutbox.Count()));
    }

    [Fact]
    public async Task Refuses_a_key_reused_for_a_different_request()
    {
        var key = Guid.NewGuid();
        await Post(Payloads.Valid(), key);
        var conflict = await Post(Payloads.Valid(name: "Somebody Else"), key);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, conflict.StatusCode);
        Assert.Equal(1, _factory.Query(db => db.QuoteRequests.Count()));
    }

    [Fact]
    public async Task Treats_an_identical_request_moments_later_as_the_same_request()
    {
        var first = await Post(Payloads.Valid());
        var resubmit = await Post(Payloads.Valid()); // new key, same details

        Assert.Equal(HttpStatusCode.OK, resubmit.StatusCode);
        Assert.Equal(await ReferenceOf(first), await ReferenceOf(resubmit));
        Assert.Equal(1, _factory.Query(db => db.QuoteRequests.Count()));
    }

    [Fact]
    public async Task Rejects_a_request_without_a_phone_or_email()
    {
        var response = await Post(Payloads.Valid(phone: null, email: null));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("phone number or an email", await response.Content.ReadAsStringAsync());
        Assert.Equal(0, _factory.Query(db => db.QuoteRequests.Count()));
    }

    [Theory]
    [InlineData("", "(513) 555-0100", null, null)]
    [InlineData("Dana", null, "dana@", null)]
    [InlineData("Dana", "555-0100", null, null)]
    [InlineData("Dana", "(513) 555-0100", null, "4520")]
    [InlineData("Dana\r\nBcc: x@evil.test", "(513) 555-0100", null, null)]
    public async Task Applies_the_same_field_rules_as_the_website(
        string name, string? phone, string? email, string? zip)
    {
        var response = await Post(Payloads.Valid(name, phone, email, zip));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, _factory.Query(db => db.QuoteRequests.Count()));
    }

    [Fact]
    public async Task Rejects_choices_the_website_does_not_offer()
    {
        var response = await Post(Payloads.Valid(service: "Window Washing"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("listed services", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Silently_drops_honeypot_submissions()
    {
        var response = await Post(Payloads.Valid(website: "spam.example"));

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Equal(0, _factory.Query(db => db.QuoteRequests.Count()));
        Assert.Equal(0, _factory.Query(db => db.NotificationOutbox.Count()));
    }

    [Fact]
    public async Task Limits_each_client_to_five_requests_per_window()
    {
        for (var i = 0; i < RateLimits.QuotePermitLimit; i++)
            Assert.True((await Post(Payloads.Valid(name: $"Person {i}"))).IsSuccessStatusCode);

        var blocked = await Post(Payloads.Valid(name: "One Too Many"));

        Assert.Equal(HttpStatusCode.TooManyRequests, blocked.StatusCode);
        Assert.Equal(RateLimits.QuotePermitLimit, _factory.Query(db => db.QuoteRequests.Count()));
    }

    [Theory]
    [InlineData("https://mopboss.test", true)]
    [InlineData("https://elsewhere.test", false)]
    public async Task Allows_browser_calls_only_from_the_site(string origin, bool allowed)
    {
        using var preflight = new HttpRequestMessage(HttpMethod.Options, "/api/quote");
        preflight.Headers.Add("Origin", origin);
        preflight.Headers.Add("Access-Control-Request-Method", "POST");
        preflight.Headers.Add("Access-Control-Request-Headers", "content-type,idempotency-key");

        var response = await _client.SendAsync(preflight);

        Assert.Equal(allowed, response.Headers.Contains("Access-Control-Allow-Origin"));
    }
}
