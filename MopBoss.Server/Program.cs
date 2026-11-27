using System.Threading.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MopBoss.Server.Configuration;
using MopBoss.Server.Data;
using MopBoss.Server.Notifications;
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

            // Quote requests live in SQL Server. Migrations are applied manually, never at startup.
            builder.Services.AddDbContext<MopBossDbContext>(options =>
                options.UseSqlServer(builder.Configuration.GetConnectionString("MopBoss")));
            builder.Services.AddScoped<QuoteSubmissionService>();

            // Notifications: queued in the outbox with each request, delivered in the background.
            var smtpSection = builder.Configuration.GetSection(SmtpOptions.Section);
            builder.Services.Configure<SmtpOptions>(smtpSection);
            builder.Services.Configure<NotificationOptions>(builder.Configuration.GetSection(NotificationOptions.Section));
            if (smtpSection.Get<SmtpOptions>()?.IsConfigured == true)
                builder.Services.AddScoped<IQuoteNotifier, SmtpQuoteNotifier>();
            else
                builder.Services.AddScoped<IQuoteNotifier, LoggingQuoteNotifier>();
            builder.Services.AddScoped<NotificationDispatcher>();
            if (builder.Configuration.GetSection(NotificationOptions.Section).Get<NotificationOptions>()?.WorkerEnabled ?? true)
                builder.Services.AddHostedService<NotificationWorker>();

            // Only the website may call the API from a browser.
            var allowedOrigins = builder.Configuration.GetSection("Site:AllowedOrigins").Get<string[]>() ?? [];
            builder.Services.AddCors(options => options.AddPolicy(SiteCorsPolicy, policy => policy
                .WithOrigins(allowedOrigins)
                .WithMethods("POST")
                .WithHeaders("Content-Type", QuotesController.IdempotencyHeader)));

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
