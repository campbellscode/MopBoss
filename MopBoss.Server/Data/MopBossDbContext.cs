using Microsoft.EntityFrameworkCore;

namespace MopBoss.Server.Data;

public class MopBossDbContext(DbContextOptions<MopBossDbContext> options) : DbContext(options)
{
    public DbSet<QuoteRequest> QuoteRequests => Set<QuoteRequest>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<QuoteRequest>(e =>
        {
            e.ToTable("QuoteRequests");
            e.HasKey(q => q.Id);
            e.Property(q => q.Service).HasMaxLength(QuoteLimits.Choice);
            e.Property(q => q.Property).HasMaxLength(QuoteLimits.Choice);
            e.Property(q => q.SquareFeet).HasMaxLength(QuoteLimits.Choice);
            e.Property(q => q.Frequency).HasMaxLength(QuoteLimits.Choice);
            e.Property(q => q.Name).HasMaxLength(QuoteLimits.Name);
            e.Property(q => q.Phone).HasMaxLength(QuoteLimits.Phone);
            e.Property(q => q.Email).HasMaxLength(QuoteLimits.Email);
            e.Property(q => q.Zip).HasMaxLength(QuoteLimits.Zip);
            e.Property(q => q.Notes).HasMaxLength(QuoteLimits.Notes);
            e.Property(q => q.NotificationError).HasMaxLength(1000);
            e.HasIndex(q => q.ReceivedAt);
        });
    }
}

/// <summary>Column and input length limits, shared by validation and the schema.</summary>
public static class QuoteLimits
{
    public const int Choice = 100;
    public const int Name = 120;
    public const int Phone = 40;
    public const int Email = 254;
    public const int Zip = 10;
    public const int Notes = 2000;
}
