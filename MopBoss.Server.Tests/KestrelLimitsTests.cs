using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using MopBoss.Server.Quotes;
using MopBoss.Server.Tests.Support;

namespace MopBoss.Server.Tests;

/// <summary>
/// Body-size limits through a real Kestrel server on a loopback port (the in-process
/// TestServer does not enforce them). Oversized requests get 413 and store nothing.
/// </summary>
public class KestrelLimitsTests : IDisposable
{
    private readonly QuoteApiFactory _factory = new();
    private readonly HttpClient _client;

    public KestrelLimitsTests()
    {
        _factory.UseKestrel(0);
        _factory.StartServer();
        _client = _factory.CreateClient();
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private Task<HttpResponseMessage> Post(HttpContent content)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/quote") { Content = content };
        request.Headers.Add(QuotesController.IdempotencyHeader, Guid.NewGuid().ToString());
        return _client.SendAsync(request);
    }

    [Fact]
    public void Runs_on_real_kestrel_with_the_configured_global_limit()
    {
        var server = _factory.Services.GetRequiredService<IServer>();
        Assert.StartsWith("KestrelServer", server.GetType().Name); // not the in-process TestServer
        Assert.True(_client.BaseAddress!.IsLoopback);
        var kestrel = _factory.Services.GetRequiredService<IOptions<KestrelServerOptions>>().Value;
        Assert.Equal(Program.MaxRequestBodyBytes, kestrel.Limits.MaxRequestBodySize);
    }

    [Fact]
    public async Task Accepts_a_normal_request()
    {
        var response = await Post(JsonContent.Create(Payloads.Valid()));
        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
    }

    [Fact]
    public async Task Answers_413_for_a_declared_oversized_body_and_stores_nothing()
    {
        var huge = new string('x', QuotesController.MaxBodyBytes + 1024);
        var response = await Post(JsonContent.Create(Payloads.Valid(notes: huge)));
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
        Assert.Equal(0, _factory.Query(db => db.QuoteRequests.Count()));
    }

    [Fact]
    public async Task Answers_413_for_a_chunked_body_that_grows_past_the_limit()
    {
        var json = Encoding.UTF8.GetBytes(
            System.Text.Json.JsonSerializer.Serialize(Payloads.Valid(notes: new string('x', (int)Program.MaxRequestBodyBytes * 2)),
                new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web)));
        var response = await Post(new UnknownLengthContent(json));
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
        Assert.Equal(0, _factory.Query(db => db.QuoteRequests.Count()));
    }

    /// <summary>Sent with Transfer-Encoding: chunked, so Kestrel only finds out while reading.</summary>
    private sealed class UnknownLengthContent : HttpContent
    {
        private readonly byte[] _body;

        public UnknownLengthContent(byte[] body)
        {
            _body = body;
            Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");
        }

        protected override Task SerializeToStreamAsync(Stream stream, TransportContext? context) =>
            stream.WriteAsync(_body).AsTask();

        protected override bool TryComputeLength(out long length)
        {
            length = 0;
            return false;
        }
    }
}
