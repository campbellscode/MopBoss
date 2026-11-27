using Microsoft.EntityFrameworkCore;

namespace MopBoss.Server.Data;

public class MopBossDbContext(DbContextOptions<MopBossDbContext> options) : DbContext(options)
{
    public DbSet<QuoteRequest> QuoteRequests => Set<QuoteRequest>();
    public DbSet<NotificationOutbox> NotificationOutbox => Set<NotificationOutbox>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<QuoteRequest>(e =>
        {
            e.ToTable("QuoteRequests", t =>
            {
                t.HasCheckConstraint("CK_QuoteRequests_Status",
                    "[Status] IN ('New','Contacted','Quoted','Scheduled','Completed','Cancelled')");
                t.HasCheckConstraint("CK_QuoteRequests_Bedrooms", "[Bedrooms] BETWEEN 0 AND 9");
                t.HasCheckConstraint("CK_QuoteRequests_Bathrooms", "[Bathrooms] BETWEEN 1 AND 9");
                t.HasCheckConstraint("CK_QuoteRequests_ContactRoute", "[Phone] IS NOT NULL OR [Email] IS NOT NULL");
            });
            e.HasKey(q => q.Id);
            e.Property(q => q.Reference).HasMaxLength(QuoteLimits.Reference).IsUnicode(false);
            e.HasIndex(q => q.Reference).IsUnique();
            e.Property(q => q.Status).HasConversion<string>().HasMaxLength(20).IsUnicode(false);
            e.HasIndex(q => q.IdempotencyKey).IsUnique().HasFilter("[IdempotencyKey] IS NOT NULL");
            e.Property(q => q.PayloadHash).HasMaxLength(64).IsUnicode(false).IsFixedLength();
            e.HasIndex(q => new { q.PayloadHash, q.CreatedAtUtc });
            e.Property(q => q.Service).HasMaxLength(QuoteLimits.Choice);
            e.Property(q => q.Property).HasMaxLength(QuoteLimits.Choice);
            e.Property(q => q.SquareFeet).HasMaxLength(QuoteLimits.Choice);
            e.Property(q => q.Frequency).HasMaxLength(QuoteLimits.Choice);
            e.Property(q => q.Name).HasMaxLength(QuoteLimits.Name);
            e.Property(q => q.Phone).HasMaxLength(QuoteLimits.Phone);
            e.Property(q => q.Email).HasMaxLength(QuoteLimits.Email);
            e.Property(q => q.Zip).HasMaxLength(QuoteLimits.Zip);
            e.Property(q => q.Notes).HasMaxLength(QuoteLimits.Notes);
            e.HasIndex(q => q.CreatedAtUtc);
            e.HasIndex(q => new { q.Status, q.CreatedAtUtc });
        });

        modelBuilder.Entity<NotificationOutbox>(e =>
        {
            e.ToTable("NotificationOutbox", t =>
            {
                t.HasCheckConstraint("CK_NotificationOutbox_Status", "[Status] IN ('Pending','Sent','Failed')");
                t.HasCheckConstraint("CK_NotificationOutbox_Attempts", "[Attempts] >= 0");
            });
            e.HasKey(n => n.Id);
            e.Property(n => n.Kind).HasMaxLength(40).IsUnicode(false);
            e.Property(n => n.Status).HasConversion<string>().HasMaxLength(20).IsUnicode(false);
            e.Property(n => n.LastError).HasMaxLength(200);
            e.Property(n => n.ConcurrencyStamp).IsConcurrencyToken();
            e.Ignore(n => n.MessageId);
            e.HasOne(n => n.QuoteRequest).WithOne(q => q.Notification)
                .HasForeignKey<NotificationOutbox>(n => n.QuoteRequestId)
                .OnDelete(DeleteBehavior.Restrict);
            // One-to-one: the unique index on QuoteRequestId means a request can never have
            // two queued notifications, which guards against duplicate sends being queued.
            // The worker's query: due Pending rows.
            e.HasIndex(n => new { n.Status, n.NextAttemptAtUtc });
        });
    }
}

/// <summary>Column and input length limits, shared by validation and the schema.</summary>
public static class QuoteLimits
{
    public const int Reference = 12;
    public const int Choice = 100;
    public const int Name = 120;
    public const int Phone = 40;
    public const int Email = 254;
    public const int Zip = 10;
    public const int Notes = 2000;
}
