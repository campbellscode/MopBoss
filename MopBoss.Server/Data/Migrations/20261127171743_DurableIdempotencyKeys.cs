using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MopBoss.Server.Data.Migrations
{
    /// <inheritdoc />
    /// <summary>Moves idempotency keys into their own table so every accepted key is durable (review finding H3).</summary>
    public partial class DurableIdempotencyKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. The new table, then copy every key already stored on QuoteRequests, so
            //    retries with those keys keep returning the same reference.
            migrationBuilder.CreateTable(
                name: "IdempotencyKeys",
                columns: table => new
                {
                    Key = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QuoteRequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PayloadHash = table.Column<string>(type: "char(64)", unicode: false, fixedLength: true, maxLength: 64, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IdempotencyKeys", x => x.Key);
                    table.ForeignKey(
                        name: "FK_IdempotencyKeys_QuoteRequests_QuoteRequestId",
                        column: x => x.QuoteRequestId,
                        principalTable: "QuoteRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });
            migrationBuilder.Sql(Deferred(
                "INSERT INTO [IdempotencyKeys] ([Key], [QuoteRequestId], [PayloadHash], [CreatedAtUtc]) " +
                "SELECT [IdempotencyKey], [Id], [PayloadHash], [CreatedAtUtc] FROM [QuoteRequests] " +
                "WHERE [IdempotencyKey] IS NOT NULL;"));
            migrationBuilder.CreateIndex(
                name: "IX_IdempotencyKeys_QuoteRequestId",
                table: "IdempotencyKeys",
                column: "QuoteRequestId");

            // 2. Only then retire the old single-key column.
            migrationBuilder.DropIndex(name: "IX_QuoteRequests_IdempotencyKey", table: "QuoteRequests");
            migrationBuilder.DropColumn(name: "IdempotencyKey", table: "QuoteRequests");
        }

        /// <summary>
        /// Restores the single-key column, keeping each quote's earliest key. Keys recorded
        /// for de-duplicated requests are lost. Review before use.
        /// </summary>
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "IdempotencyKey", table: "QuoteRequests", type: "uniqueidentifier", nullable: true);
            migrationBuilder.Sql(Deferred(@"
UPDATE q SET q.[IdempotencyKey] = k.[Key]
FROM [QuoteRequests] q
CROSS APPLY (SELECT TOP 1 [Key] FROM [IdempotencyKeys] WHERE [QuoteRequestId] = q.[Id] ORDER BY [CreatedAtUtc], [Key]) k;"));
            migrationBuilder.CreateIndex(
                name: "IX_QuoteRequests_IdempotencyKey", table: "QuoteRequests", column: "IdempotencyKey",
                unique: true, filter: "[IdempotencyKey] IS NOT NULL");
            migrationBuilder.DropTable(name: "IdempotencyKeys");
        }

        /// <summary>Wraps custom SQL in EXEC so the idempotent script compiles (see the previous migration).</summary>
        private static string Deferred(string sql) => $"EXEC(N'{sql.Replace("'", "''")}');";
    }
}
