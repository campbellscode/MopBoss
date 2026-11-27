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
