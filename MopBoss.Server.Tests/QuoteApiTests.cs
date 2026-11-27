using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MopBoss.Server.Data;
using MopBoss.Server.Quotes;

namespace MopBoss.Server.Tests;

/// <summary>Records notifications instead of sending email; can be told to fail.</summary>
public class FakeNotifier : IQuoteNotifier
{
    public List<QuoteRequest> Sent { get; } = [];
    public bool Fail { get; set; }

    public Task NotifyAsync(QuoteRequest request, CancellationToken cancellationToken)
    {
        if (Fail) throw new InvalidOperationException("SMTP is down");
        Sent.Add(request);
        return Task.CompletedTask;
    }
}

/// <summary>The API with an in-memory database and a fake notifier. One per test, so rate limits reset.</summary>
public sealed class QuoteApiFactory : WebApplicationFactory<Program>
{
    private readonly string _dbName = Guid.NewGuid().ToString();
    public FakeNotifier Notifier { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("Site:AllowedOrigins:0", "https://mopboss.test");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<MopBossDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<MopBossDbContext>>();
            services.AddDbContext<MopBossDbContext>(o => o.UseInMemoryDatabase(_dbName));
            services.RemoveAll<IQuoteNotifier>();
            services.AddSingleton<IQuoteNotifier>(Notifier);
        });
    }

    public List<QuoteRequest> Stored()
    {
        using var scope = Services.CreateScope();
        return scope.ServiceProvider.GetRequiredService<MopBossDbContext>().QuoteRequests.ToList();
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

    /// <summary>The same shape the website's submit adapter sends.</summary>
    private static object Payload(
        string name = "Dana Smith",
        string? phone = "(513) 555-0100",
        string? email = null,
        string? zip = "45202",
        string website = "") => new
    {
        service = "Deep Cleaning",
        property = "House",
        bedrooms = 2,
        bathrooms = 1,
        squareFeet = "1,000 to 2,000",
        frequency = "Weekly",
        contact = new { name, phone, email, zip },
        notes = "Two cats.",
        website,
        submittedAt = "2026-11-27T12:00:00.000Z",
    };

    [Fact]
    public async Task Stores_the_request_and_notifies_Linda()
    {
        var response = await _client.PostAsJsonAsync("/api/quote", Payload());

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var stored = Assert.Single(_factory.Stored());
        Assert.Equal("Dana Smith", stored.Name);
        Assert.Equal("Deep Cleaning", stored.Service);
        Assert.Equal("Two cats.", stored.Notes);
        Assert.NotNull(stored.NotifiedAt);
        Assert.Null(stored.NotificationError);
        Assert.Single(_factory.Notifier.Sent);
    }

    [Fact]
    public async Task Rejects_a_request_without_a_phone_or_email()
    {
        var response = await _client.PostAsJsonAsync("/api/quote", Payload(phone: null, email: null));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("phone number or an email", await response.Content.ReadAsStringAsync());
        Assert.Empty(_factory.Stored());
        Assert.Empty(_factory.Notifier.Sent);
    }

    [Theory]
    [InlineData("", "(513) 555-0100", null, null)]
    [InlineData("Dana", null, "dana@", null)]
    [InlineData("Dana", "555-0100", null, null)]
    [InlineData("Dana", "(513) 555-0100", null, "4520")]
    public async Task Applies_the_same_field_rules_as_the_website(
        string name, string? phone, string? email, string? zip)
    {
        var response = await _client.PostAsJsonAsync("/api/quote", Payload(name, phone, email, zip));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(_factory.Stored());
    }

    [Fact]
    public async Task Silently_drops_honeypot_submissions()
    {
        var response = await _client.PostAsJsonAsync("/api/quote", Payload(website: "spam.example"));

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Empty(_factory.Stored());
        Assert.Empty(_factory.Notifier.Sent);
    }

    [Fact]
    public async Task Keeps_the_request_when_the_email_fails()
    {
        _factory.Notifier.Fail = true;

        var response = await _client.PostAsJsonAsync("/api/quote", Payload());

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var stored = Assert.Single(_factory.Stored());
        Assert.Null(stored.NotifiedAt);
        Assert.Equal("SMTP is down", stored.NotificationError);
    }

    [Fact]
    public async Task Limits_each_client_to_five_requests_per_window()
    {
        for (var i = 0; i < RateLimits.QuotePermitLimit; i++)
            Assert.Equal(
                HttpStatusCode.Accepted,
                (await _client.PostAsJsonAsync("/api/quote", Payload())).StatusCode);

        var blocked = await _client.PostAsJsonAsync("/api/quote", Payload());

        Assert.Equal(HttpStatusCode.TooManyRequests, blocked.StatusCode);
        Assert.Equal(RateLimits.QuotePermitLimit, _factory.Stored().Count);
    }

    [Theory]
    [InlineData("https://mopboss.test", true)]
    [InlineData("https://elsewhere.test", false)]
    public async Task Allows_browser_calls_only_from_the_site(string origin, bool allowed)
    {
        using var preflight = new HttpRequestMessage(HttpMethod.Options, "/api/quote");
        preflight.Headers.Add("Origin", origin);
        preflight.Headers.Add("Access-Control-Request-Method", "POST");
        preflight.Headers.Add("Access-Control-Request-Headers", "content-type");

        var response = await _client.SendAsync(preflight);

        Assert.Equal(allowed, response.Headers.Contains("Access-Control-Allow-Origin"));
    }
}
