using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MopBoss.Server.Data.Migrations
{
    /// <summary>
    /// Adds the quote lifecycle (reference, status, UTC timestamps, idempotency) and the
    /// notification outbox. Hand-edited so it is safe on a database that already holds
    /// quote requests: existing rows get a legacy reference, status New, and an outbox row
    /// that carries over whether Linda was already emailed. Rows that were never emailed
    /// become Pending, so the worker sends them.
    /// </summary>
    public partial class QuoteLifecycleAndNotificationOutbox : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Timestamps: the existing receive time becomes the creation time.
            migrationBuilder.DropIndex(name: "IX_QuoteRequests_ReceivedAt", table: "QuoteRequests");
            migrationBuilder.RenameColumn(name: "ReceivedAt", table: "QuoteRequests", newName: "CreatedAtUtc");
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAtUtc",
                table: "QuoteRequests",
                type: "datetimeoffset",
                nullable: false,
                defaultValueSql: "SYSUTCDATETIME()");
            migrationBuilder.Sql(Deferred("UPDATE [QuoteRequests] SET [UpdatedAtUtc] = [CreatedAtUtc];"));

            // 2. Lifecycle and idempotency columns, with values for any existing rows.
            migrationBuilder.AddColumn<Guid>(
                name: "IdempotencyKey", table: "QuoteRequests", type: "uniqueidentifier", nullable: true);
            migrationBuilder.AddColumn<string>(
                name: "PayloadHash", table: "QuoteRequests", type: "char(64)", unicode: false,
                fixedLength: true, maxLength: 64, nullable: false, defaultValue: "");
            migrationBuilder.AddColumn<string>(
                name: "Status", table: "QuoteRequests", type: "varchar(20)", unicode: false,
                maxLength: 20, nullable: false, defaultValue: "New");
            migrationBuilder.AddColumn<string>(
                name: "Reference", table: "QuoteRequests", type: "varchar(12)", unicode: false,
                maxLength: 12, nullable: true);
            // Legacy rows: "MB-" plus nine hex digits of the existing Id (unique in practice).
            migrationBuilder.Sql(Deferred(
                "UPDATE [QuoteRequests] SET [Reference] = 'MB-' + UPPER(LEFT(REPLACE(CONVERT(char(36), [Id]), '-', ''), 9)) " +
                "WHERE [Reference] IS NULL;"));
            migrationBuilder.AlterColumn<string>(
                name: "Reference", table: "QuoteRequests", type: "varchar(12)", unicode: false,
                maxLength: 12, nullable: false, oldClrType: typeof(string), oldType: "varchar(12)",
                oldUnicode: false, oldMaxLength: 12, oldNullable: true);

            // 3. The outbox table.
            migrationBuilder.CreateTable(
                name: "NotificationOutbox",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QuoteRequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Kind = table.Column<string>(type: "varchar(40)", unicode: false, maxLength: 40, nullable: false),
                    Status = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    NextAttemptAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LockedUntilUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LockToken = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SentAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LastError = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ConcurrencyStamp = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationOutbox", x => x.Id);
                    table.CheckConstraint("CK_NotificationOutbox_Attempts", "[Attempts] >= 0");
                    table.CheckConstraint("CK_NotificationOutbox_Status", "[Status] IN ('Pending','Sent','Failed')");
                    table.ForeignKey(
                        name: "FK_NotificationOutbox_QuoteRequests_QuoteRequestId",
                        column: x => x.QuoteRequestId,
                        principalTable: "QuoteRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            // 4. Carry over notification state before dropping the old columns.
            //    Already emailed -> Sent. Never emailed (old synchronous send failed) -> Pending.
            migrationBuilder.Sql(Deferred(@"
INSERT INTO [NotificationOutbox]
    ([Id], [QuoteRequestId], [Kind], [Status], [Attempts], [NextAttemptAtUtc], [SentAtUtc],
     [LastError], [CreatedAtUtc], [UpdatedAtUtc], [ConcurrencyStamp])
SELECT NEWID(), q.[Id], 'QuoteReceived',
       CASE WHEN q.[NotifiedAt] IS NULL THEN 'Pending' ELSE 'Sent' END,
       CASE WHEN q.[NotifiedAt] IS NULL THEN 0 ELSE 1 END,
       SYSUTCDATETIME(), q.[NotifiedAt],
       CASE WHEN q.[NotifiedAt] IS NULL AND q.[NotificationError] IS NOT NULL THEN 'Legacy' ELSE NULL END,
       q.[CreatedAtUtc], SYSUTCDATETIME(), NEWID()
FROM [QuoteRequests] q;"));
            migrationBuilder.DropColumn(name: "NotificationError", table: "QuoteRequests");
            migrationBuilder.DropColumn(name: "NotifiedAt", table: "QuoteRequests");

            // 5. Indexes and constraints.
            migrationBuilder.CreateIndex(
                name: "IX_QuoteRequests_CreatedAtUtc", table: "QuoteRequests", column: "CreatedAtUtc");
            migrationBuilder.CreateIndex(
                name: "IX_QuoteRequests_IdempotencyKey", table: "QuoteRequests", column: "IdempotencyKey",
                unique: true, filter: "[IdempotencyKey] IS NOT NULL");
            migrationBuilder.CreateIndex(
                name: "IX_QuoteRequests_PayloadHash_CreatedAtUtc", table: "QuoteRequests",
                columns: new[] { "PayloadHash", "CreatedAtUtc" });
            migrationBuilder.CreateIndex(
                name: "IX_QuoteRequests_Reference", table: "QuoteRequests", column: "Reference", unique: true);
            migrationBuilder.CreateIndex(
                name: "IX_QuoteRequests_Status_CreatedAtUtc", table: "QuoteRequests",
                columns: new[] { "Status", "CreatedAtUtc" });
            migrationBuilder.AddCheckConstraint(
                name: "CK_QuoteRequests_Bathrooms", table: "QuoteRequests", sql: "[Bathrooms] BETWEEN 1 AND 9");
            migrationBuilder.AddCheckConstraint(
                name: "CK_QuoteRequests_Bedrooms", table: "QuoteRequests", sql: "[Bedrooms] BETWEEN 0 AND 9");
            migrationBuilder.AddCheckConstraint(
                name: "CK_QuoteRequests_ContactRoute", table: "QuoteRequests",
                sql: "[Phone] IS NOT NULL OR [Email] IS NOT NULL");
            migrationBuilder.AddCheckConstraint(
                name: "CK_QuoteRequests_Status", table: "QuoteRequests",
                sql: "[Status] IN ('New','Contacted','Quoted','Scheduled','Completed','Cancelled')");
            migrationBuilder.CreateIndex(
                name: "IX_NotificationOutbox_QuoteRequestId", table: "NotificationOutbox",
                column: "QuoteRequestId", unique: true);
            migrationBuilder.CreateIndex(
                name: "IX_NotificationOutbox_Status_NextAttemptAtUtc", table: "NotificationOutbox",
                columns: new[] { "Status", "NextAttemptAtUtc" });
        }

        /// <summary>
        /// Wraps custom SQL in EXEC so SQL Server resolves column names only when it runs.
        /// The idempotent script keeps all statements in one script, and without this, SQL
        /// that touches columns created, renamed or dropped elsewhere fails to compile, even
        /// inside an IF that would skip it.
        /// </summary>
        private static string Deferred(string sql) => $"EXEC(N'{sql.Replace("'", "''")}');";

        /// <summary>
        /// Restores the Phase 2 schema. Notification history collapses back into NotifiedAt;
        /// lifecycle status, references and idempotency keys are discarded. Review before use.
        /// </summary>
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "NotifiedAt", table: "QuoteRequests", type: "datetimeoffset", nullable: true);
            migrationBuilder.AddColumn<string>(
                name: "NotificationError", table: "QuoteRequests", type: "nvarchar(1000)",
                maxLength: 1000, nullable: true);
            migrationBuilder.Sql(Deferred(@"
UPDATE q SET q.[NotifiedAt] = n.[SentAtUtc], q.[NotificationError] = n.[LastError]
FROM [QuoteRequests] q JOIN [NotificationOutbox] n ON n.[QuoteRequestId] = q.[Id];"));

            migrationBuilder.DropTable(name: "NotificationOutbox");

            migrationBuilder.DropIndex(name: "IX_QuoteRequests_CreatedAtUtc", table: "QuoteRequests");
            migrationBuilder.DropIndex(name: "IX_QuoteRequests_IdempotencyKey", table: "QuoteRequests");
            migrationBuilder.DropIndex(name: "IX_QuoteRequests_PayloadHash_CreatedAtUtc", table: "QuoteRequests");
            migrationBuilder.DropIndex(name: "IX_QuoteRequests_Reference", table: "QuoteRequests");
            migrationBuilder.DropIndex(name: "IX_QuoteRequests_Status_CreatedAtUtc", table: "QuoteRequests");
            migrationBuilder.DropCheckConstraint(name: "CK_QuoteRequests_Bathrooms", table: "QuoteRequests");
            migrationBuilder.DropCheckConstraint(name: "CK_QuoteRequests_Bedrooms", table: "QuoteRequests");
            migrationBuilder.DropCheckConstraint(name: "CK_QuoteRequests_ContactRoute", table: "QuoteRequests");
            migrationBuilder.DropCheckConstraint(name: "CK_QuoteRequests_Status", table: "QuoteRequests");

            migrationBuilder.DropColumn(name: "IdempotencyKey", table: "QuoteRequests");
            migrationBuilder.DropColumn(name: "PayloadHash", table: "QuoteRequests");
            migrationBuilder.DropColumn(name: "Reference", table: "QuoteRequests");
            migrationBuilder.DropColumn(name: "Status", table: "QuoteRequests");
            migrationBuilder.DropColumn(name: "UpdatedAtUtc", table: "QuoteRequests");
            migrationBuilder.RenameColumn(name: "CreatedAtUtc", table: "QuoteRequests", newName: "ReceivedAt");
            migrationBuilder.CreateIndex(
                name: "IX_QuoteRequests_ReceivedAt", table: "QuoteRequests", column: "ReceivedAt");
        }
    }
}
