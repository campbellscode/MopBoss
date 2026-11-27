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
/// Degraded when Linda may be missing requests: a notification failed permanently in the
/// last 7 days, or one has been due for more than 30 minutes without being sent.
/// Counts only; no references or customer details leave the server.
/// </summary>
public class NotificationBacklogHealthCheck(MopBossDbContext db, TimeProvider clock) : IHealthCheck
{
    public static readonly TimeSpan StuckAfter = TimeSpan.FromMinutes(30);
    public static readonly TimeSpan FailedWindow = TimeSpan.FromDays(7);

    /// <summary>Set by an operator (database/operations.sql, query E) once Linda has the request another way.</summary>
    public const string HandledManually = "HandledManually";

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var failedSince = now - FailedWindow;
        var stuckBefore = now - StuckAfter;
        var failed = await db.NotificationOutbox.CountAsync(
            n => n.Status == NotificationStatus.Failed && n.UpdatedAtUtc >= failedSince
                && n.LastError != HandledManually, cancellationToken);
        var stuck = await db.NotificationOutbox.CountAsync(
            n => n.Status == NotificationStatus.Pending && n.NextAttemptAtUtc < stuckBefore, cancellationToken);

        return failed == 0 && stuck == 0
            ? HealthCheckResult.Healthy()
            : HealthCheckResult.Degraded($"{failed} failed and {stuck} overdue notification(s).");
    }
}
