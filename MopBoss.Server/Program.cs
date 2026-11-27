using System.Threading.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MopBoss.Server.Data;
using MopBoss.Server.Quotes;

namespace MopBoss.Server
{
    public class Program
    {
        public const string SiteCorsPolicy = "site";

        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            builder.Services.AddControllers();
            // Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
            builder.Services.AddOpenApi();
            builder.Services.AddProblemDetails();
            builder.Services.AddSingleton(TimeProvider.System);

            // Quote requests are stored in SQL Server. Migrations are applied manually.
            builder.Services.AddDbContext<MopBossDbContext>(options =>
                options.UseSqlServer(builder.Configuration.GetConnectionString("MopBoss")));

            // Email Linda over SMTP when configured; otherwise only log (local development).
            var smtpSection = builder.Configuration.GetSection(SmtpOptions.Section);
            builder.Services.Configure<SmtpOptions>(smtpSection);
            if (smtpSection.Get<SmtpOptions>()?.IsConfigured == true)
                builder.Services.AddScoped<IQuoteNotifier, SmtpQuoteNotifier>();
            else
                builder.Services.AddScoped<IQuoteNotifier, LoggingQuoteNotifier>();

            // Only the website may call the API from a browser.
            var allowedOrigins = builder.Configuration.GetSection("Site:AllowedOrigins").Get<string[]>() ?? [];
            builder.Services.AddCors(options => options.AddPolicy(SiteCorsPolicy, policy => policy
                .WithOrigins(allowedOrigins)
                .WithMethods("POST")
                .WithHeaders("Content-Type")));

            // Per-IP limit on quote submissions. Behind a reverse proxy, configure
            // forwarded headers so RemoteIpAddress is the visitor, not the proxy.
            builder.Services.AddRateLimiter(options =>
            {
                options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
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

            var app = builder.Build();

            if (app.Environment.IsDevelopment())
            {
                app.MapOpenApi();
            }

            app.UseHttpsRedirection();

            app.UseCors(SiteCorsPolicy);
            app.UseRateLimiter();

            app.UseAuthorization();

            app.MapControllers();

            app.Run();
        }
    }
}
