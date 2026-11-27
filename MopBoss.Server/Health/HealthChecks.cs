using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using MopBoss.Server.Data;

namespace MopBoss.Server.Health;

/// <summary>Ready only when the database answers. Reports no connection details.</summary>
public class DatabaseHealthCheck(MopBossDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken)
    {
        try
        {
            return await db.Database.CanConnectAsync(cancellationToken)
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy("Database unavailable.");
        }
        catch (Exception)
        {
            return HealthCheckResult.Unhealthy("Database unavailable.");
        }
    }
}

/// <summary>
/// Unhealthy unless the database has exactly the migrations this build expects: none
/// pending (database behind the code) and none unknown (database ahead of the code, e.g.
/// an older build deployed against a newer schema). Never applies migrations. Needs only
/// SELECT on __EFMigrationsHistory, which the runtime identity is granted. Reports no
/// migration names.
/// </summary>
public class SchemaHealthCheck(MopBossDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken)
    {
        if (!db.Database.IsRelational()) return HealthCheckResult.Healthy();
        try
        {
            var expected = db.Database.GetMigrations().ToHashSet();
            var applied = (await db.Database.GetAppliedMigrationsAsync(cancellationToken)).ToHashSet();
            var pending = expected.Except(applied).Count();
            var unknown = applied.Except(expected).Count();
            return pending == 0 && unknown == 0
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy($"Schema mismatch: {pending} pending, {unknown} unknown migration(s).");
        }
        catch (Exception)
        {
            return HealthCheckResult.Unhealthy("Schema state unavailable.");
        }
    }
}

/// <summary>
/// Degraded while Linda may be missing requests: any notification that Failed and has not
/// been requeued or marked HandledManually (however old), or one due for more than 30
/// minutes without being sent. Counts only; no references or customer details.
/// </summary>
public class NotificationBacklogHealthCheck(MopBossDbContext db, TimeProvider clock) : IHealthCheck
{
    public static readonly TimeSpan StuckAfter = TimeSpan.FromMinutes(30);

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken)
    {
        var stuckBefore = clock.GetUtcNow() - StuckAfter;
        var failed = await db.NotificationOutbox.CountAsync(n => n.Status == NotificationStatus.Failed, cancellationToken);
        var stuck = await db.NotificationOutbox.CountAsync(
            n => n.Status == NotificationStatus.Pending && n.NextAttemptAtUtc < stuckBefore, cancellationToken);

        return failed == 0 && stuck == 0
            ? HealthCheckResult.Healthy()
            : HealthCheckResult.Degraded($"{failed} unresolved failed and {stuck} overdue notification(s).");
    }
}
