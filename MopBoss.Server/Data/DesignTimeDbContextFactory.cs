using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MopBoss.Server.Data;

/// <summary>
/// Used by `dotnet ef` only. It never starts the web app, so tooling does not need runtime
/// secrets or SMTP settings.
///
/// - Generating migrations or SQL scripts needs no database: a placeholder is used and
///   nothing connects.
/// - Applying migrations reads MOPBOSS_MIGRATIONS_CONNECTION, which should be the
///   migration identity (schema rights), not the app's runtime identity. Set it only in
///   the shell that runs the migration; never commit it.
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<MopBossDbContext>
{
    public const string EnvironmentVariable = "MOPBOSS_MIGRATIONS_CONNECTION";
    private const string Placeholder = "Server=design-time.invalid;Database=MopBossDesignTime;Encrypt=True";

    public MopBossDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable(EnvironmentVariable);
        var options = new DbContextOptionsBuilder<MopBossDbContext>()
            .UseSqlServer(string.IsNullOrWhiteSpace(connectionString) ? Placeholder : connectionString)
            .Options;
        return new MopBossDbContext(options);
    }
}
