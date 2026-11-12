using Microsoft.EntityFrameworkCore;
using SiapBos.Shared.Entities;

namespace SiapBos.Shared.Data;

public class SiapBosDbContext : DbContext
{
    public SiapBosDbContext(DbContextOptions<SiapBosDbContext> options) : base(options)
    {
    }

    public DbSet<Sekolah> Sekolahs => Set<Sekolah>();
    public DbSet<AppUser> AppUsers => Set<AppUser>();
    public DbSet<AppRole> AppRoles => Set<AppRole>();
    public DbSet<AppUserOtoritas> AppUserOtoritas => Set<AppUserOtoritas>();
    public DbSet<AppOtoritasAplikasi> AppOtoritasAplikasis => Set<AppOtoritasAplikasi>();
    public DbSet<AppOtoritasMenu> AppOtoritasMenus => Set<AppOtoritasMenu>();
    public DbSet<AppUserSekolah> AppUserSekolahs => Set<AppUserSekolah>();
    public DbSet<AppUserWilayah> AppUserWilayahs => Set<AppUserWilayah>();
    public DbSet<AppModule> AppModules => Set<AppModule>();
    public DbSet<AppMenu> AppMenus => Set<AppMenu>();
    public DbSet<MasterPeriode> MasterPeriodes => Set<MasterPeriode>();
    public DbSet<BasAccount> BasAccounts => Set<BasAccount>();
    public DbSet<TaxMaster> TaxMasters => Set<TaxMaster>();

    public DbSet<RkasItem> RkasItems => Set<RkasItem>();
    public DbSet<MigrasiPask> MigrasiPasks => Set<MigrasiPask>();
    public DbSet<MigrasiPaskRinci> MigrasiPaskRincis => Set<MigrasiPaskRinci>();
    public DbSet<DroppingDana> DroppingDanas => Set<DroppingDana>();
    public DbSet<NpdBop> NpdBops => Set<NpdBop>();

    public DbSet<BkuTransaction> BkuTransactions => Set<BkuTransaction>();
    public DbSet<BkuDetailItem> BkuDetailItems => Set<BkuDetailItem>();
    public DbSet<BkuTaxItem> BkuTaxItems => Set<BkuTaxItem>();

    public DbSet<BankMutation> BankMutations => Set<BankMutation>();
    public DbSet<BapKasReport> BapKasReports => Set<BapKasReport>();
    public DbSet<SetoranSts> SetoranStses => Set<SetoranSts>();
    public DbSet<IntegrationAuditLog> IntegrationAuditLogs => Set<IntegrationAuditLog>();
    public DbSet<HelpdeskTicket> HelpdeskTickets => Set<HelpdeskTicket>();
    public DbSet<OAuthAccessToken> OAuthAccessTokens => Set<OAuthAccessToken>();
    public DbSet<OAuthTokenHistory> OAuthTokenHistories => Set<OAuthTokenHistory>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.HasDefaultSchema("siap");

        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.HasIndex(e => e.Username).IsUnique();
            entity.HasOne(e => e.Sekolah)
                  .WithMany()
                  .HasForeignKey(e => e.SekolahId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Sekolah>(entity =>
        {
            entity.HasIndex(e => e.Npsn).IsUnique();
        });

        modelBuilder.Entity<AppRole>(entity =>
        {
            entity.HasIndex(e => e.RoleCode).IsUnique();
        });

        modelBuilder.Entity<AppUserOtoritas>(entity =>
        {
            entity.HasIndex(e => new { e.UserId, e.RoleId }).IsUnique();
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Role).WithMany().HasForeignKey(e => e.RoleId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AppOtoritasAplikasi>(entity =>
        {
            entity.HasIndex(e => new { e.RoleId, e.ModuleId }).IsUnique();
            entity.HasOne(e => e.Role).WithMany().HasForeignKey(e => e.RoleId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Module).WithMany().HasForeignKey(e => e.ModuleId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AppOtoritasMenu>(entity =>
        {
            entity.HasIndex(e => new { e.RoleId, e.MenuId }).IsUnique();
            entity.HasOne(e => e.Role).WithMany().HasForeignKey(e => e.RoleId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Menu).WithMany().HasForeignKey(e => e.MenuId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AppUserSekolah>(entity =>
        {
            entity.HasIndex(e => new { e.UserId, e.SekolahId }).IsUnique();
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Sekolah).WithMany().HasForeignKey(e => e.SekolahId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AppUserWilayah>(entity =>
        {
            entity.HasIndex(e => new { e.UserId, e.KodeWilayah }).IsUnique();
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AppModule>(entity =>
        {
            entity.HasIndex(e => e.KodeAplikasi).IsUnique();
        });

        modelBuilder.Entity<TaxMaster>(entity =>
        {
            entity.HasIndex(e => e.KodeTrxPajak).IsUnique();
        });

        modelBuilder.Entity<BkuTransaction>(entity =>
        {
            entity.HasIndex(e => e.NomorBku);
            entity.HasOne(e => e.Sekolah)
                  .WithMany()
                  .HasForeignKey(e => e.SekolahId)
                  .OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(e => e.DetailItems)
                  .WithOne(d => d.BkuTransaction)
                  .HasForeignKey(d => d.BkuTransactionId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(e => e.TaxItems)
                  .WithOne(t => t.BkuTransaction)
                  .HasForeignKey(t => t.BkuTransactionId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BkuDetailItem>(entity =>
        {
            entity.HasOne(d => d.RkasItem)
                  .WithMany()
                  .HasForeignKey(d => d.RkasItemId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<RkasItem>(entity =>
        {
            entity.HasOne(r => r.Sekolah)
                  .WithMany()
                  .HasForeignKey(r => r.SekolahId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<MigrasiPask>(entity =>
        {
            entity.HasOne(m => m.Sekolah)
                  .WithMany()
                  .HasForeignKey(m => m.SekolahId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(m => m.Rincians)
                  .WithOne(r => r.MigrasiPask)
                  .HasForeignKey(r => r.MigrasiPaskId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DroppingDana>(entity =>
        {
            entity.HasOne(d => d.Sekolah)
                  .WithMany()
                  .HasForeignKey(d => d.SekolahId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(d => d.MigrasiPask)
                  .WithMany()
                  .HasForeignKey(d => d.MigrasiPaskId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<NpdBop>(entity =>
        {
            entity.HasOne(n => n.Sekolah)
                  .WithMany()
                  .HasForeignKey(n => n.SekolahId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(n => n.MigrasiPask)
                  .WithMany()
                  .HasForeignKey(n => n.MigrasiPaskId)
                  .OnDelete(DeleteBehavior.SetNull);
        });
    }
}
