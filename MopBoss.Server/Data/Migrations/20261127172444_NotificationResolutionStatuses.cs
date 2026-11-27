using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MopBoss.Server.Data.Migrations
{
    /// <inheritdoc />
    /// <summary>Explicit HandledManually and Suppressed notification statuses (review findings M1, M5, M6).</summary>
    public partial class NotificationResolutionStatuses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_NotificationOutbox_Status",
                table: "NotificationOutbox");

            migrationBuilder.AddCheckConstraint(
                name: "CK_NotificationOutbox_Status",
                table: "NotificationOutbox",
                sql: "[Status] IN ('Pending','Sent','Failed','HandledManually','Suppressed')");

            // Rows an operator marked handled with the old LastError convention become explicit.
            migrationBuilder.Sql(Deferred(
                "UPDATE [NotificationOutbox] SET [Status] = 'HandledManually' " +
                "WHERE [Status] = 'Failed' AND [LastError] = 'HandledManually';"));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Map the new statuses back onto the old ones before narrowing the constraint.
            migrationBuilder.Sql(Deferred(
                "UPDATE [NotificationOutbox] SET [Status] = 'Failed', [LastError] = 'HandledManually' " +
                "WHERE [Status] = 'HandledManually'; " +
                "UPDATE [NotificationOutbox] SET [Status] = 'Sent' WHERE [Status] = 'Suppressed';"));
            migrationBuilder.DropCheckConstraint(
                name: "CK_NotificationOutbox_Status",
                table: "NotificationOutbox");

            migrationBuilder.AddCheckConstraint(
                name: "CK_NotificationOutbox_Status",
                table: "NotificationOutbox",
                sql: "[Status] IN ('Pending','Sent','Failed')");
        }

        /// <summary>Wraps custom SQL in EXEC so the idempotent script compiles.</summary>
        private static string Deferred(string sql) => $"EXEC(N'{sql.Replace("'", "''")}');";
    }
}
