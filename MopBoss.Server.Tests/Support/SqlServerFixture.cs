using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using MopBoss.Server.Data;
using Testcontainers.MsSql;

namespace MopBoss.Server.Tests.Support;

/// <summary>
/// A throwaway SQL Server 2022 container (Docker required), started once per test run.
/// Every test gets its own freshly created MopBossTest_* database. Nothing here can reach
/// MB-Dev or MB-Prod: the server is the container, and database names are guarded.
/// </summary>
public sealed class SqlServerFixture : IAsyncLifetime
{
    private readonly MsSqlContainer _container =
        new MsSqlBuilder("mcr.microsoft.com/mssql/server:2022-latest").Build();

    public Task InitializeAsync() => _container.StartAsync();

    public Task DisposeAsync() => _container.DisposeAsync().AsTask();

    /// <summary>Connection string for a new, empty, uniquely named test database.</summary>
    public string NewDatabase()
    {
        var builder = new SqlConnectionStringBuilder(_container.GetConnectionString())
        {
            InitialCatalog = $"MopBossTest_{Guid.NewGuid():N}",
            Encrypt = SqlConnectionEncryptOption.Optional,
        };
        Guard(builder);
        return builder.ConnectionString;
    }

    /// <summary>Connection string for a new test database with all migrations applied.</summary>
    public async Task<string> NewMigratedDatabaseAsync()
    {
        var connectionString = NewDatabase();
        await using var db = Context(connectionString);
        await db.Database.MigrateAsync();
        return connectionString;
    }

    public static MopBossDbContext Context(string connectionString)
    {
        Guard(new SqlConnectionStringBuilder(connectionString));
        return new MopBossDbContext(
            new DbContextOptionsBuilder<MopBossDbContext>().UseSqlServer(connectionString).Options);
    }

    /// <summary>Refuses anything that is not a disposable test database.</summary>
    private static void Guard(SqlConnectionStringBuilder builder)
    {
        var name = builder.InitialCatalog;
        if (!name.StartsWith("MopBossTest_", StringComparison.Ordinal)
            || name.Equals("MB-Dev", StringComparison.OrdinalIgnoreCase)
            || name.Equals("MB-Prod", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Tests may only use disposable MopBossTest_* databases.");
    }
}

[CollectionDefinition(Name)]
public class SqlServerCollection : ICollectionFixture<SqlServerFixture>
{
    public const string Name = "SQL Server";
}
