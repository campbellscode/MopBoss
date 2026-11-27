using System.Diagnostics;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using MopBoss.Server.Data;

namespace MopBoss.Server.Tests;

/// <summary>Migration tooling refuses to touch any database but the one the operator named.</summary>
public class MigrationGuardTests
{
    private const string Dev = "Server=db.example;Database=MB-Dev;Encrypt=True";
    private const string Prod = "Server=db.example;Database=MB-Prod;Encrypt=True";

    [Theory]
    [InlineData(null, null, Dev, "MOPBOSS_MIGRATION_TARGET")]
    [InlineData("Staging", null, Dev, "must be Development, Production or Test")]
    [InlineData("Development", null, Prod, "must use MB-Dev")]
    [InlineData("Production", null, Dev, "must use MB-Prod")]
    [InlineData("Production", null, Prod, "MOPBOSS_MIGRATION_AUTHORIZE_PRODUCTION")]
    [InlineData("Production", "mb-prod", Prod, "MOPBOSS_MIGRATION_AUTHORIZE_PRODUCTION")]
    [InlineData("Production", "MB-Prod", "Server=db.example;Database=MB-Prod;Encrypt=False", "encrypted")]
    [InlineData("Production", "MB-Prod", Prod + ";TrustServerCertificate=True", "certificate")]
    [InlineData("Test", null, Dev, "MopBossTest_")]
    [InlineData("Test", null, Prod, "MopBossTest_")]
    [InlineData("Development", null, "Server=db.example;Encrypt=True", "must name its database")]
    [InlineData("Development", null, "not a connection string", "not a valid")]
    public void Refuses_mismatched_or_unauthorised_targets(string? target, string? auth, string cs, string expected)
    {
        var errors = MigrationGuard.Validate(target, auth, cs);
        Assert.Contains(errors, e => e.Contains(expected) && e.Contains("Nothing was changed"));
        Assert.DoesNotContain(errors, e => e.Contains("db.example")); // no connection details
    }

    [Theory]
    [InlineData("Development", null, Dev)]
    [InlineData("Production", "MB-Prod", Prod)]
    [InlineData("Test", null, "Server=localhost;Database=MopBossTest_abc;Encrypt=False")]
    public void Accepts_the_named_target(string target, string? auth, string cs) =>
        Assert.Empty(MigrationGuard.Validate(target, auth, cs));

    [Fact]
    public void Script_generation_needs_no_database_and_no_target()
    {
        using var db = DesignTimeDbContextFactory.Create(null, null, null);
        var script = db.Database.GetService<IMigrator>().GenerateScript(options: MigrationsSqlGenerationOptions.Idempotent);
        Assert.Contains("__EFMigrationsHistory", script);
    }

    [Fact]
    public void Factory_refuses_a_connection_without_a_matching_target()
    {
        var ex = Assert.Throws<InvalidOperationException>(() => DesignTimeDbContextFactory.Create(Prod, "Development", null));
        Assert.Contains("must use MB-Dev", ex.Message);
        Assert.Throws<InvalidOperationException>(() => DesignTimeDbContextFactory.Create(Dev, null, null));
    }

    [Fact]
    public void Interceptor_rechecks_the_database_the_server_reports()
    {
        var interceptor = new MigrationTargetInterceptor("Test", null);
        using var connection = new SqlConnection("Server=localhost;Database=MB-Dev");
        var ex = Assert.Throws<InvalidOperationException>(() => interceptor.ConnectionOpened(connection, null!));
        Assert.Contains("MopBossTest_", ex.Message);
    }

    // The sqlcmd runner refuses before connecting. -DryRun never connects.
    [Theory]
    [InlineData("-Target Production -Server s -Database MB-Prod", 2, "-ConfirmProduction")]
    [InlineData("-Target Production -Server s -Database MB-Prod -ConfirmProduction mb-prod", 2, "-ConfirmProduction")]
    [InlineData("-Target Production -Server s -Database MB-Prod -ConfirmProduction MB-Prod -TrustServerCertificate", 2, "certificate")]
    [InlineData("-Target Development -Server s -Database MB-Prod", 2, "only migrate MB-Dev")]
    [InlineData("-Target Test -Server s -Database MB-Dev", 2, "MopBossTest_")]
    [InlineData("-Target Test -Server s -Database MopBossTest_x';DROP", 2, "unexpected characters")]
    [InlineData("-Target Production -Server s -Database MB-Prod -ConfirmProduction MB-Prod", 0, "-b -I -N")]
    [InlineData("-Target Development -Server s -Database MB-Dev", 0, "ExpectedDatabase=MB-Dev MigrationTarget=Development")]
    public void Runner_checks_target_before_connecting(string args, int exitCode, string expectedOutput)
    {
        var (code, output) = RunRunner(args + " -DryRun");
        Assert.Equal(exitCode, code);
        Assert.Contains(expectedOutput, output);
    }

    internal static (int ExitCode, string Output) RunRunner(string args, IDictionary<string, string>? environment = null)
    {
        var script = SqlServerTests.FindRepoFile("database/Invoke-MopBossMigration.ps1");
        var info = new ProcessStartInfo("pwsh", $"-NoProfile -NonInteractive -File \"{script}\" {args}")
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        foreach (var (key, value) in environment ?? new Dictionary<string, string>()) info.Environment[key] = value;
        using var process = Process.Start(info)!;
        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();
        Assert.True(process.WaitForExit(120_000), "runner timed out");
        return (process.ExitCode, stdout.Result + stderr.Result);
    }
}
