using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using MopBoss.Server.Configuration;

namespace MopBoss.Server.Tests;

public class StartupValidationTests
{
    private const string Server = "Server=tcp:sql.example.test,1433;User ID=app;Password=x;";

    [Theory]
    [InlineData("Development", "MB-Dev", true)]
    [InlineData("Development", "MB-Prod", false)]
    [InlineData("Production", "MB-Prod", true)]
    [InlineData("Production", "MB-Dev", false)]
    [InlineData("Testing", "MB-Dev", false)]
    [InlineData("Testing", "MB-Prod", false)]
    [InlineData("Staging", "MB-Prod", false)]
    [InlineData("Testing", "MopBossTest_123", true)]
    public void Each_environment_may_only_target_its_own_database(string environment, string database, bool ok)
    {
        var cs = $"{Server}Database={database};Encrypt=True;TrustServerCertificate=False";
        var (target, errors) = StartupValidation.ValidateDatabase(environment, cs);
        Assert.Equal(ok, errors.Count == 0);
        Assert.Equal(ok, target is not null);
    }

    [Theory]
    [InlineData("Development")]
    [InlineData("Production")]
    public void A_missing_connection_string_never_falls_back(string environment)
    {
        var (_, errors) = StartupValidation.ValidateDatabase(environment, "");
        Assert.Contains(errors, e => e.Contains("no fallback"));
        Assert.DoesNotContain(errors, e => e.Contains("Found"));
    }

    [Fact]
    public void A_missing_connection_string_names_other_keys_but_never_uses_them()
    {
        var (target, errors) = StartupValidation.ValidateDatabase(
            "Development", null, ["DefaultConnection", "Legacy"]);
        Assert.Null(target); // still no fallback
        var error = Assert.Single(errors);
        Assert.Contains("Found ConnectionStrings:DefaultConnection, ConnectionStrings:Legacy instead", error);
        Assert.Contains("rename that key", error);
    }

    [Theory]
    [InlineData("Encrypt=False;TrustServerCertificate=False", "encrypted")]
    [InlineData("Encrypt=True;TrustServerCertificate=True", "certificate")]
    public void Production_requires_an_encrypted_verified_connection(string options, string expected)
    {
        var (_, errors) = StartupValidation.ValidateDatabase("Production", $"{Server}Database=MB-Prod;{options}");
        Assert.Contains(errors, e => e.Contains(expected));
    }

    [Fact]
    public void Error_messages_never_contain_the_connection_string()
    {
        var (_, errors) = StartupValidation.ValidateDatabase("Development", $"{Server}Database=MB-Prod;Password=TopSecret1");
        Assert.All(errors, e => Assert.DoesNotContain("TopSecret1", e));
        Assert.All(errors, e => Assert.DoesNotContain("sql.example.test", e));
    }

    private static SmtpOptions Smtp(string host, string? overrideTo = null, SmtpSecurity security = SmtpSecurity.StartTls) => new()
    {
        Host = host,
        From = "quotes@example.test",
        To = "linda@example.test",
        DevelopmentRecipientOverride = overrideTo,
        Security = security,
    };

    [Fact]
    public void Production_must_have_smtp_and_tls()
    {
        Assert.NotEmpty(StartupValidation.ValidateSmtp("Production", new SmtpOptions()));
        Assert.NotEmpty(StartupValidation.ValidateSmtp("Production", Smtp("smtp.example.test", security: SmtpSecurity.None)));
        Assert.NotEmpty(StartupValidation.ValidateSmtp("Production", Smtp("smtp.example.test", overrideTo: "t@example.test")));
        Assert.Empty(StartupValidation.ValidateSmtp("Production", Smtp("smtp.example.test")));
    }

    [Fact]
    public void Outside_production_a_real_relay_needs_a_test_inbox()
    {
        Assert.Empty(StartupValidation.ValidateSmtp("Development", new SmtpOptions())); // logs only
        Assert.Empty(StartupValidation.ValidateSmtp("Development", Smtp("localhost"))); // capture service
        Assert.Empty(StartupValidation.ValidateSmtp("Development", Smtp("127.0.0.1")));
        Assert.NotEmpty(StartupValidation.ValidateSmtp("Development", Smtp("smtp.example.test")));
        Assert.Empty(StartupValidation.ValidateSmtp("Development", Smtp("smtp.example.test", "inbox@example.test")));
    }

    [Fact]
    public void The_outbox_lease_must_outlast_a_slow_send()
    {
        var errors = StartupValidation.ValidateNotifications(
            "Development", new NotificationOptions { LeaseSeconds = 50 }, new SmtpOptions { TimeoutSeconds = 30 });
        Assert.Contains(errors, e => e.Contains("LeaseSeconds"));
    }

    [Fact]
    public void Production_cannot_switch_the_notification_worker_off()
    {
        var off = new NotificationOptions { WorkerEnabled = false };
        Assert.Contains(StartupValidation.ValidateNotifications("Production", off, new SmtpOptions()),
            e => e.Contains("WorkerEnabled"));
        Assert.DoesNotContain(StartupValidation.ValidateNotifications("Development", off, new SmtpOptions()),
            e => e.Contains("WorkerEnabled"));
    }

    [Fact]
    public void Proxies_and_origins_are_checked()
    {
        Assert.NotEmpty(StartupValidation.ValidateReverseProxy(new ReverseProxyOptions { KnownProxies = ["not-an-ip"] }));
        Assert.Empty(StartupValidation.ValidateReverseProxy(new ReverseProxyOptions { KnownNetworks = ["10.0.0.0/24"] }));
        Assert.NotEmpty(StartupValidation.ValidateSiteOrigins("Production", []));
        Assert.NotEmpty(StartupValidation.ValidateSiteOrigins("Production", ["http://www.example.test"]));
        Assert.NotEmpty(StartupValidation.ValidateSiteOrigins("Production", ["https://www.example.test/path"]));
        Assert.Empty(StartupValidation.ValidateSiteOrigins("Production", ["https://www.example.test"]));
    }

    [Fact]
    public void The_api_refuses_to_start_when_development_points_at_production()
    {
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
        {
            b.UseEnvironment("Development");
            b.UseSetting("ConnectionStrings:MopBoss", "Server=sql.example.test;Database=MB-Prod;Encrypt=True");
        });

        var ex = Assert.ThrowsAny<Exception>(() => factory.CreateClient());
        Assert.Contains("must use MB-Dev", ex.ToString());
    }
}
