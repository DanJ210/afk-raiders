using Microsoft.EntityFrameworkCore;

namespace AfkRaiders.Api.Data;

public sealed class AfkRaidersDbContext(DbContextOptions<AfkRaidersDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> AppUsers => Set<AppUser>();
    public DbSet<RaiderSave> RaiderSaves => Set<RaiderSave>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>(builder =>
        {
            builder.ToTable("app_user");
            builder.HasKey(user => user.Id);
            builder.HasIndex(user => new { user.AuthProvider, user.AuthSubject }).IsUnique();

            builder.Property(user => user.Id).HasColumnName("id");
            builder.Property(user => user.AuthProvider).HasColumnName("auth_provider").HasMaxLength(64).IsRequired();
            builder.Property(user => user.AuthSubject).HasColumnName("auth_subject").HasMaxLength(256).IsRequired();
            builder.Property(user => user.DisplayName).HasColumnName("display_name").HasMaxLength(80);
            builder.Property(user => user.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("sysdatetimeoffset()");
            builder.Property(user => user.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("sysdatetimeoffset()");
        });

        modelBuilder.Entity<RaiderSave>(builder =>
        {
            builder.ToTable("raider_save", table =>
                table.HasCheckConstraint("CK_raider_save_state_is_json", "ISJSON([state]) = 1"));
            builder.HasKey(save => save.UserId);
            builder.HasIndex(save => save.SaveVersion);
            builder.HasIndex(save => save.LastTickAt);
            builder.HasIndex(save => save.Seed);

            builder.Property(save => save.UserId).HasColumnName("user_id");
            builder.Property(save => save.SaveVersion).HasColumnName("save_version");
            builder.Property(save => save.Revision).HasColumnName("revision").HasDefaultValue(1L);
            builder.Property(save => save.Seed).HasColumnName("seed");
            builder.Property(save => save.LastTickAt).HasColumnName("last_tick_at");
            builder.Property(save => save.StateJson).HasColumnName("state").HasColumnType("nvarchar(max)").IsRequired();
            builder.Property(save => save.Checksum).HasColumnName("checksum").HasMaxLength(128).IsRequired();
            builder.Property(save => save.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("sysdatetimeoffset()");
            builder.Property(save => save.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("sysdatetimeoffset()");

            builder
                .HasOne(save => save.User)
                .WithOne(user => user.RaiderSave)
                .HasForeignKey<RaiderSave>(save => save.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}