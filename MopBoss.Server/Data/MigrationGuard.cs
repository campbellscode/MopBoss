using System.Data.Common;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore.Diagnostics;
using MopBoss.Server.Configuration;

namespace MopBoss.Server.Data;

/// <summary>
/// Stops `dotnet ef` from connecting to anything but the one database the operator named.
/// The operator must state the target (MOPBOSS_MIGRATION_TARGET) and, for Production, type
/// the database name again (MOPBOSS_MIGRATION_AUTHORIZE_PRODUCTION=MB-Prod).
///
/// These checks catch mistakes such as a pasted connection string pointing at the wrong
/// database or an `--connection` override. They do not replace database permissions: the
/// migration identity for MB-Dev must have no rights on MB-Prod, and the reverse.
/// Messages never include connection strings.
/// </summary>
public static class MigrationGuard
{
    public const string TargetVariable = "MOPBOSS_MIGRATION_TARGET";
    public const string ProductionAuthorizationVariable = "MOPBOSS_MIGRATION_AUTHORIZE_PRODUCTION";
    public const string TestDatabasePrefix = "MopBossTest_";

    private const string NothingChanged = " Nothing was changed.";

    /// <summary>Checks a connection string before any connection is opened.</summary>
    public static List<string> Validate(string? target, string? productionAuthorization, string connectionString)
    {
        SqlConnectionStringBuilder builder;
        try
        {
            builder = new SqlConnectionStringBuilder(connectionString);
        }
        catch (Exception)
        {
            return ["The migration connection string is not a valid SQL Server connection string." + NothingChanged];
        }

        var errors = ValidateDatabaseName(target, builder.InitialCatalog);
        if (errors.Count == 0 && target == "Production")
        {
            if (productionAuthorization != StartupValidation.ProductionDatabase)
                errors.Add($"Migrating {StartupValidation.ProductionDatabase} requires {ProductionAuthorizationVariable}=" +
                           $"{StartupValidation.ProductionDatabase} in this shell." + NothingChanged);
            if (builder.Encrypt == SqlConnectionEncryptOption.Optional)
                errors.Add("Production migration connections must be encrypted (Encrypt=True or Strict)." + NothingChanged);
            if (builder.TrustServerCertificate)
                errors.Add("Production migration connections must validate the server certificate." + NothingChanged);
        }
        return errors;
    }

    /// <summary>
    /// Checks a database name against the declared target. Also used after a connection
    /// opens, with the name the server reports.
    /// </summary>
    public static List<string> ValidateDatabaseName(string? target, string? database)
    {
        if (string.IsNullOrWhiteSpace(target))
            return [$"Set {TargetVariable} to Development, Production or Test before connecting." + NothingChanged];
        if (target is not ("Development" or "Production" or "Test"))
            return [$"{TargetVariable} must be Development, Production or Test." + NothingChanged];
        var expected = target switch
        {
            "Development" => StartupValidation.DevelopmentDatabase,
            "Production" => StartupValidation.ProductionDatabase,
            _ => null,
        };

        if (string.IsNullOrWhiteSpace(database))
            return ["The migration connection string must name its database." + NothingChanged];
        if (expected is not null && !string.Equals(database, expected, StringComparison.OrdinalIgnoreCase))
            return [$"{TargetVariable}={target} must use {expected}, but the connection targets '{database}'." + NothingChanged];
        if (expected is null && !database.StartsWith(TestDatabasePrefix, StringComparison.OrdinalIgnoreCase))
            return [$"{TargetVariable}=Test may only use {TestDatabasePrefix}* databases." + NothingChanged];
        return [];
    }

    internal static void ThrowIfAny(List<string> errors)
    {
        if (errors.Count > 0) throw new InvalidOperationException(string.Join(Environment.NewLine, errors));
    }
}

/// <summary>
/// Re-checks the target on every connection the design-time context opens: before opening
/// (covers `dotnet ef ... --connection`, which replaces the factory's connection string) and
/// after opening (the database the server says it is in).
/// </summary>
public sealed class MigrationTargetInterceptor(string? target, string? productionAuthorization) : DbConnectionInterceptor
{
    public override InterceptionResult ConnectionOpening(
        DbConnection connection, ConnectionEventData eventData, InterceptionResult result)
    {
        MigrationGuard.ThrowIfAny(MigrationGuard.Validate(target, productionAuthorization, connection.ConnectionString));
        return result;
    }

    public override ValueTask<InterceptionResult> ConnectionOpeningAsync(
        DbConnection connection, ConnectionEventData eventData, InterceptionResult result,
        CancellationToken cancellationToken = default)
        => ValueTask.FromResult(ConnectionOpening(connection, eventData, result));

    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        var errors = MigrationGuard.ValidateDatabaseName(target, connection.Database);
        if (errors.Count == 0) return;
        connection.Close();
        MigrationGuard.ThrowIfAny(errors);
    }

    public override Task ConnectionOpenedAsync(
        DbConnection connection, ConnectionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        ConnectionOpened(connection, eventData);
        return Task.CompletedTask;
    }
}
