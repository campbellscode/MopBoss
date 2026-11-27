using System.Net;
using System.Net.Http.Json;
using System.Text;
using MopBoss.Server.Quotes;
using MopBoss.Server.Tests.Support;

namespace MopBoss.Server.Tests;

public class ApiSecurityTests : IDisposable
{
    private readonly QuoteApiFactory _factory = new();
    private readonly HttpClient _client;

    public ApiSecurityTests() => _client = _factory.CreateClient();

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private Task<HttpResponseMessage> Post(HttpContent content, Action<HttpRequestMessage>? tweak = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/quote") { Content = content };
        request.Headers.Add(QuotesController.IdempotencyHeader, Guid.NewGuid().ToString());
        tweak?.Invoke(request);
        return _client.SendAsync(request);
    }

    [Fact]
    public async Task Rejects_unknown_json_properties()
    {
        var json = """{"service":"Deep Cleaning","property":"House","bedrooms":2,"bathrooms":1,"squareFeet":"Not sure","frequency":"Weekly","contact":{"name":"Dana","phone":"5135550100"},"status":"Completed"}""";
        var response = await Post(new StringContent(json, Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, _factory.Query(db => db.QuoteRequests.Count()));
    }

    [Fact]
    public async Task Rejects_oversized_bodies()
    {
        var huge = new string('x', QuotesController.MaxBodyBytes + 1024);
        var response = await Post(JsonContent.Create(Payloads.Valid(notes: huge)));
        // Under Kestrel this is 413 (RequestSizeLimit / MaxRequestBodySize). The in-process
        // TestServer does not apply body-size limits, so here the length validation answers 400.
        Assert.Contains(response.StatusCode, new[] { HttpStatusCode.RequestEntityTooLarge, HttpStatusCode.BadRequest });
        Assert.Equal(0, _factory.Query(db => db.QuoteRequests.Count()));
    }

    [Fact]
    public async Task Sends_security_headers_and_no_server_banner()
    {
        var response = await Post(JsonContent.Create(Payloads.Valid()));
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
        Assert.Equal("no-referrer", response.Headers.GetValues("Referrer-Policy").Single());
        Assert.Contains("default-src 'none'", response.Headers.GetValues("Content-Security-Policy").Single());
        Assert.False(response.Headers.Contains("Server"));
    }

    [Fact]
    public async Task Ignores_spoofed_forwarded_for_headers_when_no_proxy_is_trusted()
    {
        for (var i = 0; i <= RateLimits.QuotePermitLimit; i++)
        {
            var response = await Post(
                JsonContent.Create(Payloads.Valid(name: $"Person {i}")),
                r => r.Headers.Add("X-Forwarded-For", $"203.0.113.{i}"));
            if (i < RateLimits.QuotePermitLimit) Assert.True(response.IsSuccessStatusCode);
            else
            {
                Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
                Assert.True(response.Headers.Contains("Retry-After"));
            }
        }
    }

    [Fact]
    public async Task Health_endpoints_report_status_only()
    {
        var live = await _client.GetAsync("/health/live");
        var ready = await _client.GetAsync("/health/ready");
        Assert.Equal(HttpStatusCode.OK, live.StatusCode);
        Assert.Equal("Healthy", await live.Content.ReadAsStringAsync());
        Assert.Equal("Healthy", await ready.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Does_not_expose_openapi_outside_development()
    {
        var response = await _client.GetAsync("/openapi/v1.json");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Offers_no_endpoint_to_read_or_change_quotes()
    {
        Assert.Equal(HttpStatusCode.MethodNotAllowed, (await _client.GetAsync("/api/quote")).StatusCode);
        var put = await _client.PutAsync("/api/quote", JsonContent.Create(new { status = "Completed" }));
        Assert.Equal(HttpStatusCode.MethodNotAllowed, put.StatusCode);
    }
}
