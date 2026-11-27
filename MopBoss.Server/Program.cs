using System.Net;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using MopBoss.Server.Configuration;
using MopBoss.Server.Data;
using MopBoss.Server.Health;
using MopBoss.Server.Notifications;
using MopBoss.Server.Quotes;

namespace MopBoss.Server
{
    public class Program
    {
        public const string SiteCorsPolicy = "site";

        /// <summary>Largest request body the API accepts on any endpoint.</summary>
        public const long MaxRequestBodyBytes = 64 * 1024;

        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);
            var env = builder.Environment.EnvironmentName;
            var config = builder.Configuration;

            // ---------- Configuration checks: refuse to start rather than misbehave ----------
            var smtp = config.GetSection(SmtpOptions.Section).Get<SmtpOptions>() ?? new SmtpOptions();
            var notifications = config.GetSection(NotificationOptions.Section).Get<NotificationOptions>() ?? new NotificationOptions();
            var proxy = config.GetSection(ReverseProxyOptions.Section).Get<ReverseProxyOptions>() ?? new ReverseProxyOptions();
            var origins = config.GetSection("Site:AllowedOrigins").Get<string[]>() ?? [];
            var connectionString = config.GetConnectionString(StartupValidation.ConnectionStringName);

            var (dbTarget, errors) = StartupValidation.ValidateDatabase(env, connectionString);
            errors.AddRange(StartupValidation.ValidateSmtp(env, smtp));
            errors.AddRange(StartupValidation.ValidateNotifications(env, notifications, smtp));
            errors.AddRange(StartupValidation.ValidateReverseProxy(proxy));
            errors.AddRange(StartupValidation.ValidateSiteOrigins(env, origins));
            if (errors.Count > 0)
                throw new InvalidOperationException(
                    "MopBoss.Server configuration is invalid:" + Environment.NewLine + " - " +
                    string.Join(Environment.NewLine + " - ", errors));

            // ---------- Services ----------
            builder.WebHost.ConfigureKestrel(k =>
            {
                k.Limits.MaxRequestBodySize = MaxRequestBodyBytes;
                k.AddServerHeader = false;
            });

            builder.Services.AddControllers().AddJsonOptions(o =>
                o.JsonSerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow);
            // Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
            builder.Services.AddOpenApi();
            builder.Services.AddProblemDetails();
            builder.Services.AddSingleton(TimeProvider.System);

            // Quote requests live in SQL Server. Migrations are applied manually, never at startup.
            builder.Services.AddDbContext<MopBossDbContext>(options =>
                options.UseSqlServer(connectionString, sql => sql.EnableRetryOnFailure(3)));
            builder.Services.AddScoped<QuoteSubmissionService>();

            // Notifications: queued in the outbox with each request, delivered in the background.
            builder.Services.Configure<SmtpOptions>(config.GetSection(SmtpOptions.Section));
            builder.Services.Configure<NotificationOptions>(config.GetSection(NotificationOptions.Section));
            if (smtp.IsConfigured)
                builder.Services.AddScoped<IQuoteNotifier, SmtpQuoteNotifier>();
            else
                builder.Services.AddScoped<IQuoteNotifier, LoggingQuoteNotifier>(); // never in Production (validated)
            builder.Services.AddScoped<NotificationDispatcher>();
            if (notifications.WorkerEnabled)
                builder.Services.AddHostedService<NotificationWorker>();

            builder.Services.AddHealthChecks()
                .AddCheck<DatabaseHealthCheck>("database", tags: ["ready"])
                .AddCheck<SchemaHealthCheck>("schema", tags: ["ready"])
                .AddCheck<NotificationBacklogHealthCheck>("notifications", tags: ["ready"]);

            // Browsers may call the API only from the website. CORS is not access control:
            // anyone can still POST directly, which is what the rate limit and validation are for.
            builder.Services.AddCors(options => options.AddPolicy(SiteCorsPolicy, policy => policy
                .WithOrigins(origins)
                .WithMethods("POST")
                .WithHeaders("Content-Type", QuotesController.IdempotencyHeader)));

            // Forwarded headers are honoured only from proxies listed in configuration, so a
            // visitor cannot fake their IP to dodge the rate limit.
            builder.Services.Configure<ForwardedHeadersOptions>(options =>
            {
                options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
                options.ForwardLimit = 1;
                options.KnownProxies.Clear();
                options.KnownIPNetworks.Clear();
                foreach (var ip in proxy.KnownProxies) options.KnownProxies.Add(IPAddress.Parse(ip));
                foreach (var net in proxy.KnownNetworks) options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(net));
            });

            builder.Services.AddRateLimiter(options =>
            {
                options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
                options.OnRejected = (context, _) =>
                {
                    context.HttpContext.Response.Headers.RetryAfter =
                        ((int)RateLimits.QuoteWindow.TotalSeconds).ToString();
                    return ValueTask.CompletedTask;
                };
                options.AddPolicy(RateLimits.QuotePolicy, context =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                        _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = RateLimits.QuotePermitLimit,
                            Window = RateLimits.QuoteWindow,
                            QueueLimit = 0,
                        }));
            });

            if (builder.Environment.IsProduction())
                builder.Services.AddHsts(o => { o.MaxAge = TimeSpan.FromDays(365); o.IncludeSubDomains = true; });

            // ---------- Pipeline ----------
            var app = builder.Build();

            app.Logger.LogInformation(
                "Environment {Environment} uses database {Database}. Email: {Email}. Forwarded headers: {Proxy}.",
                dbTarget!.Environment, dbTarget.Database,
                smtp.IsConfigured ? "SMTP" : "not configured (logged only)",
                proxy.IsConfigured ? "trusted from configured proxies" : "ignored");
            if (app.Environment.IsProduction() && !proxy.IsConfigured)
                app.Logger.LogWarning(
                    "No trusted reverse proxy is configured. If the API runs behind a proxy, every visitor " +
                    "shares one rate-limit bucket; set ReverseProxy:KnownProxies or KnownNetworks.");

            if (proxy.IsConfigured) app.UseForwardedHeaders();

            app.UseExceptionHandler(); // ProblemDetails, no stack traces
            app.UseStatusCodePages();
            if (app.Environment.IsProduction()) app.UseHsts();

            app.Use(async (context, next) =>
            {
                var headers = context.Response.Headers;
                headers.XContentTypeOptions = "nosniff";
                headers["Referrer-Policy"] = "no-referrer";
                headers.XFrameOptions = "DENY";
                headers.ContentSecurityPolicy = "default-src 'none'; frame-ancestors 'none'";
                headers.CacheControl = "no-store";
                await next();
            });

            if (app.Environment.IsDevelopment())
            {
                app.MapOpenApi();
            }

            app.UseHttpsRedirection();

            app.UseCors(SiteCorsPolicy);
            app.UseRateLimiter();

            app.UseAuthorization();

            app.MapControllers();

            // Liveness: the process answers. Readiness: database reachable and email not stuck.
            // Both return only Healthy / Degraded / Unhealthy, never details.
            app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
            app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = c => c.Tags.Contains("ready") });

            app.Run();
        }
    }
}
