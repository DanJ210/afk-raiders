using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AfkRaiders.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "app_user",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    auth_provider = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    auth_subject = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    display_name = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false, defaultValueSql: "sysdatetimeoffset()"),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false, defaultValueSql: "sysdatetimeoffset()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_app_user", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "raider_save",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    save_version = table.Column<int>(type: "int", nullable: false),
                    revision = table.Column<long>(type: "bigint", nullable: false, defaultValue: 1L),
                    seed = table.Column<int>(type: "int", nullable: false),
                    last_tick_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    state = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    checksum = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false, defaultValueSql: "sysdatetimeoffset()"),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false, defaultValueSql: "sysdatetimeoffset()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_raider_save", x => x.user_id);
                    table.CheckConstraint("CK_raider_save_state_is_json", "ISJSON([state]) = 1");
                    table.ForeignKey(
                        name: "FK_raider_save_app_user_user_id",
                        column: x => x.user_id,
                        principalTable: "app_user",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_app_user_auth_provider_auth_subject",
                table: "app_user",
                columns: new[] { "auth_provider", "auth_subject" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_raider_save_last_tick_at",
                table: "raider_save",
                column: "last_tick_at");

            migrationBuilder.CreateIndex(
                name: "IX_raider_save_save_version",
                table: "raider_save",
                column: "save_version");

            migrationBuilder.CreateIndex(
                name: "IX_raider_save_seed",
                table: "raider_save",
                column: "seed");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "raider_save");

            migrationBuilder.DropTable(
                name: "app_user");
        }
    }
}
