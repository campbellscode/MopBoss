using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MopBoss.Server.Data;

/// <summary>
/// Used by `dotnet ef` only. It never starts the web app, so tooling does not need runtime
/// secrets or SMTP settings.
///
/// - Generating migrations or SQL scripts needs no database: a placeholder is used, nothing
///   connects, and no target needs to be set.
/// - Connecting (migrations list, database update, with or without --connection) requires
///   MOPBOSS_MIGRATION_TARGET and passes <see cref="MigrationGuard"/> on every connection.
/// - MOPBOSS_MIGRATIONS_CONNECTION should be the migration identity (schema rights), not the
///   app's runtime identity. Set it only in the shell that runs the migration; never commit it.
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<MopBossDbContext>
{
    public const string EnvironmentVariable = "MOPBOSS_MIGRATIONS_CONNECTION";
    private const string Placeholder = "Server=design-time.invalid;Database=MopBossDesignTime;Encrypt=True";

    public MopBossDbContext CreateDbContext(string[] args) => Create(
        Environment.GetEnvironmentVariable(EnvironmentVariable),
        Environment.GetEnvironmentVariable(MigrationGuard.TargetVariable),
        Environment.GetEnvironmentVariable(MigrationGuard.ProductionAuthorizationVariable));

    public static MopBossDbContext Create(string? connectionString, string? target, string? productionAuthorization)
    {
        var hasConnection = !string.IsNullOrWhiteSpace(connectionString);
        if (hasConnection)
            MigrationGuard.ThrowIfAny(MigrationGuard.Validate(target, productionAuthorization, connectionString!));

        var options = new DbContextOptionsBuilder<MopBossDbContext>()
            .UseSqlServer(hasConnection ? connectionString : Placeholder)
            .AddInterceptors(new MigrationTargetInterceptor(target, productionAuthorization))
            .Options;
        return new MopBossDbContext(options);
    }
}
