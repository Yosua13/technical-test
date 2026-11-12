using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SiapBos.Shared.Constants;
using SiapBos.Shared.Entities;

namespace SiapBos.Shared.Data;

public static class DbSeeder
{
    public static async Task EnsureDatabaseAndSeedAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SiapBosDbContext>();

        var connStr = db.Database.GetConnectionString() ?? string.Empty;
        if (connStr.Contains("10.15.36.51", StringComparison.OrdinalIgnoreCase) ||
            connStr.Contains("siapbosdev", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("PROTEKSI KEAMANAN: Dilarang menjalankan EnsureCreated/Seed pada database referensi siapbosdev (10.15.36.51).");
        }

        await db.Database.EnsureCreatedAsync();

        // Pastikan hanya skema auth, oauth, dan siap yang digunakan (tanpa public dan rkas)
        // serta struktur tabel RBAC relasional & daftar menu bersih tanpa 11 menu tereliminasi
        bool needsRecreate = false;
        try
        {
            var conn = db.Database.GetDbConnection();
            if (conn.State != System.Data.ConnectionState.Open)
                await conn.OpenAsync();

            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT
                    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN ('public', 'rkas') AND table_type = 'BASE TABLE') * 100
                    + (CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'oauth' AND table_name = 'access_token') THEN 0 ELSE 10 END)
                    + (CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'siap' AND table_name = 'traplikasi') THEN 0 ELSE 1 END)
                    + (CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'trsiappenggunaotoritas') THEN 0 ELSE 1 END)
                    + (CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'trsiapotoritasaplikasi') THEN 0 ELSE 1 END)
                    + (CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'trsiapotoritasmenu') THEN 0 ELSE 1 END)
                    + (CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'trsiappenggunasekolah') THEN 0 ELSE 1 END)
                    + (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'IsLocked') THEN 0 ELSE 1 END)
                    + (CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'siap' AND table_name = 'trkoreksi_bku') THEN 1 ELSE 0 END)
                    + (CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'siap' AND table_name = 'trbatal_transfer_spj') THEN 1 ELSE 0 END)
                    + (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'siap' AND table_name = 'tmbkubos_bop' AND column_name = 'ParentBkuId') THEN 0 ELSE 1 END)
                    + (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'siap' AND table_name = 'tmbkubos_bop' AND column_name = 'IsVirtualAccount') THEN 0 ELSE 1 END)
                    + (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'siap' AND table_name = 'tmbkubos_bop' AND column_name = 'StanVa') THEN 0 ELSE 1 END)
                    + (CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'siap' AND table_name = 'tm_migrasi_pask') THEN 0 ELSE 1 END)
                    + (CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'siap' AND table_name = 'tm_migrasi_pask_rinci') THEN 0 ELSE 1 END)
                    + (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'siap' AND table_name = 'tijo_dropping' AND column_name = 'StatusDropping') THEN 0 ELSE 1 END)
                    + (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'siap' AND table_name = 'trnpd_bop' AND column_name = 'MigrasiPaskId') THEN 0 ELSE 1 END);";
            var flag = Convert.ToInt32(await cmd.ExecuteScalarAsync());
            if (flag > 0)
            {
                needsRecreate = true;
            }
            else if (!await db.AppRoles.AnyAsync(r => r.RoleCode == SiapBosRoles.AdminTdi) ||
                     !await db.AppUsers.AnyAsync(u => u.Username == "ADMIN-TDI") ||
                     !await db.AppOtoritasMenus.AnyAsync() ||
                     !await db.AppOtoritasMenus.AnyAsync(om => om.Role!.RoleCode == SiapBosRoles.TuNegeri && om.Menu!.Link == "persetujuan-npd") ||
                     !await db.MigrasiPasks.AnyAsync(p => p.SekolahId == 1 && p.TahunAnggaran == 2026 && p.KodePeriode == "TW4" && p.SumberDana == "BOS") ||
                     await db.BkuTransactions.AnyAsync(b => b.FileLampiranPath != null && b.FileLampiranPath.Contains("/minio/")) ||
                     await db.BkuTransactions.AnyAsync(b => b.KodeTrx == "JG" || b.KodeTrx == "LL" || b.KodeTrx == "ST") ||
                     await db.AppMenus.AnyAsync(m =>
                         m.Link == "bap-kas-bos" ||
                         m.Link == "bap-kas" ||
                         m.Link == "cetak-setor" ||
                         m.Link == "cetak-setoran" ||
                         m.Link == "setor-sisa-belanja" ||
                         m.Link == "input-bku-koreksi-tahun-lalu" ||
                         m.Link == "batal-transfer-spj" ||
                         m.Link == "persetujuan-batal-tf-spj" ||
                         m.Link == "batal-tutup-bku"))
            {
                needsRecreate = true;
            }
        }
        catch
        {
            needsRecreate = true;
        }

        if (needsRecreate)
        {
            await db.Database.EnsureDeletedAsync();
            await db.Database.EnsureCreatedAsync();
            await db.Database.ExecuteSqlRawAsync("DROP SCHEMA IF EXISTS rkas CASCADE;");
        }

        if (await db.Sekolahs.AnyAsync())
        {
            await EnsureMasterPeriodesCompleteAsync(db);
            await RemoveObsoleteHelpDeskMenusAsync(db);
            await EnsureAdminGrantedModuleMenusAsync(db);
            return;
        }

        // 1. Master Roles / Otoritas (Schema: auth.roles) — murni by data DB (tanpa data dummy frontend)
        var roleAdminTdi = new AppRole { RoleCode = SiapBosRoles.AdminTdi, ShortCode = "ADM", RoleName = "Super Administrator / Tim Tenaga Ahli (ADMIN-TDI)", Deskripsi = "Pemeliharaan sistem tingkat lanjut, konfigurasi master aplikasi, dan cross-inspection seluruh jenjang sekolah DKI Jakarta", Level = "TA", IsActive = true };
        var rolePk = new AppRole { RoleCode = SiapBosRoles.PkNegeri, ShortCode = "PK", RoleName = "Bendahara Sekolah / Pemegang Kas (PK)", Deskripsi = "Operator teknis keuangan sekolah (single-school boundary): input transaksi, pengajuan pembayaran, eksekusi CMS/pajak & laporan BKU", Level = "SEKOLAH", IsActive = true };
        var roleTu = new AppRole { RoleCode = SiapBosRoles.TuNegeri, ShortCode = "TU", RoleName = "Kepala Tata Usaha / Verifikator Level-1 (TU)", Deskripsi = "Verifikator tingkat 1 berkas SPJ belanja dan persetujuan usulan batal transfer BOSP/BOP", Level = "SEKOLAH", IsActive = true };
        var rolePa = new AppRole { RoleCode = SiapBosRoles.PaNegeri, ShortCode = "PA", RoleName = "Pengguna Anggaran / Kepala Sekolah (PA)", Deskripsi = "Otorisator puncak tingkat sekolah: permohonan token, persetujuan akhir BKU/NPD/batal transfer & laporan BKU", Level = "SEKOLAH", IsActive = true };
        var roleSudin = new AppRole { RoleCode = SiapBosRoles.Sudin, ShortCode = "SDN", RoleName = "Suku Dinas Pendidikan Wilayah (SUDIN)", Deskripsi = "Pembina & otorisator dana BOP/APBD tingkat wilayah kota: persetujuan NPD, batal transfer BOP, monitoring & help desk BOP/VA PLN", Level = "SUDIN", IsActive = true };
        var roleDinas = new AppRole { RoleCode = SiapBosRoles.AdminDinas, ShortCode = "DNS", RoleName = "Dinas Pendidikan Provinsi DKI Jakarta (ADMIN-DINAS)", Deskripsi = "Otorisator tingkat provinsi untuk BOSP Reguler/APBN: konfirmasi dropping dana, monitoring Dinas & help desk BOSP/VA PLN", Level = "DINAS", IsActive = true };

        db.AppRoles.AddRange(roleAdminTdi, rolePk, roleTu, rolePa, roleSudin, roleDinas);

        // 2. 5 Menu Utama / Aplikasi (Schema: siap.traplikasi)
        var modUm = new AppModule { KodeAplikasi = "UM", Nama = "User Management", Link = "user-management", Deskripsi = "Kelola Pengguna, Otoritas, Aplikasi, Menu, Periode, Master Sekolah & Pajak", Icon = "bi-people-fill", SortOrder = 1, IsActive = true };
        var modBos = new AppModule { KodeAplikasi = "BOS", Nama = "BKU BOSP Negeri", Link = "bos-negeri", Deskripsi = "Penatausahaan Dana BOSP Negeri (Dropping, Input BKU, Approval, Token, CMS, Pajak & Laporan)", Icon = "bi-journal-bookmark-fill", SortOrder = 2, IsActive = true };
        var modBop = new AppModule { KodeAplikasi = "BOP", Nama = "BKU BOP Negeri", Link = "bku-bop", Deskripsi = "Penatausahaan Dana BOP Negeri (Permohonan NPD, Input BKU, Approval, Token, CMS, Pajak & Laporan)", Icon = "bi-bank2", SortOrder = 3, IsActive = true };
        var modAdmn = new AppModule { KodeAplikasi = "ADMN", Nama = "Administrator", Link = "administrator", Deskripsi = "Batas Pengajuan Belanja, Migrasi RKAS & Dropping Dana BOS & BOP", Icon = "bi-sliders2-vertical", SortOrder = 4, IsActive = true };
        var modHelp = new AppModule { KodeAplikasi = "HELP", Nama = "Help Desk", Link = "helpdesk", Deskripsi = "User Manual, Tiket Help Desk & Video Tutorial Penggunaan SIAP", Icon = "bi-headset", SortOrder = 5, IsActive = true };

        db.AppModules.AddRange(modUm, modBos, modBop, modAdmn, modHelp);

        // 3. Sub-Menu per Aplikasi (Schema: siap.trmenu) — HANYA menu aktif sesuai RBAC Bagian I (11 menu Bagian II DIELIMINASI)
        // User Management (7 Sub-Menu)
        var umMenus = new List<AppMenu>
        {
            new() { KodeAplikasi = "UM", Nama = "Pengguna",       Link = "pengguna",       Icon = "bi-person-badge", RequiresSekolah = false, SortOrder = 1 },
            new() { KodeAplikasi = "UM", Nama = "Otoritas",       Link = "otoritas",       Icon = "bi-shield-lock",  RequiresSekolah = false, SortOrder = 2 },
            new() { KodeAplikasi = "UM", Nama = "Aplikasi",       Link = "aplikasi",       Icon = "bi-grid-1x2",     RequiresSekolah = false, SortOrder = 3 },
            new() { KodeAplikasi = "UM", Nama = "Menu",           Link = "menu",           Icon = "bi-list-nested",  RequiresSekolah = false, SortOrder = 4 },
            new() { KodeAplikasi = "UM", Nama = "Periode",        Link = "periode",        Icon = "bi-calendar3",    RequiresSekolah = false, SortOrder = 5 },
            new() { KodeAplikasi = "UM", Nama = "Master Sekolah", Link = "master-sekolah", Icon = "bi-building",     RequiresSekolah = true,  SortOrder = 6 },
            new() { KodeAplikasi = "UM", Nama = "Pajak",          Link = "pajak",          Icon = "bi-percent",      RequiresSekolah = false, SortOrder = 7 }
        };

        // BKU BOSP Negeri (BOS) - Tanpa Batal Transfer & Batal Tutup BKU
        var bosDashboard      = new AppMenu { KodeAplikasi = "BOS", Nama = "Dashboard BKU BOSP",                   Link = "dashboard",                  Icon = "bi-speedometer2",        RequiresSekolah = true,  SortOrder = 1 };
        var bosDropSekolah    = new AppMenu { KodeAplikasi = "BOS", Nama = "Dropping Dana BOSP",                   Link = "konfirmasi-drop-dana",       Icon = "bi-box-arrow-in-down",   RequiresSekolah = true,  SortOrder = 2 };
        var bosDropDinas      = new AppMenu { KodeAplikasi = "BOS", Nama = "Konfirmasi Dropping Dana",             Link = "dinas-konfirmasi-drop-dana", Icon = "bi-check2-circle",       RequiresSekolah = false, SortOrder = 3 };
        var bosInput          = new AppMenu { KodeAplikasi = "BOS", Nama = "Input BKU BOSP",                       Link = "input-bku",                  Icon = "bi-journal-plus",        RequiresSekolah = true,  SortOrder = 4 };
        var bosPengajuan      = new AppMenu { KodeAplikasi = "BOS", Nama = "Pengajuan Pembayaran BKU BOSP",        Link = "pengajuan-bku",              Icon = "bi-send-check",          RequiresSekolah = true,  SortOrder = 5 };
        var bosApproveTu      = new AppMenu { KodeAplikasi = "BOS", Nama = "Persetujuan Pembayaran BKU BOSP (TU)", Link = "persetujuan-bku-tu",         Icon = "bi-check2-square",       RequiresSekolah = true,  SortOrder = 6 };
        var bosApprovePa      = new AppMenu { KodeAplikasi = "BOS", Nama = "Persetujuan Pembayaran BKU BOSP (PA)", Link = "persetujuan-bku-pa",         Icon = "bi-award",               RequiresSekolah = true,  SortOrder = 7 };
        var bosToken          = new AppMenu { KodeAplikasi = "BOS", Nama = "Permohonan Token",                     Link = "permohonan-token",           Icon = "bi-key-fill",            RequiresSekolah = true,  SortOrder = 8 };
        var bosBayar          = new AppMenu { KodeAplikasi = "BOS", Nama = "Pembayaran BKU BOSP",                  Link = "pembayaran-bku",             Icon = "bi-credit-card-2-front", RequiresSekolah = true,  SortOrder = 9 };
        var bosPajak          = new AppMenu { KodeAplikasi = "BOS", Nama = "Pembayaran Pajak BKU BOSP",            Link = "pembayaran-pajak-bku",       Icon = "bi-receipt-cutoff",      RequiresSekolah = true,  SortOrder = 10 };
        var bosTutup          = new AppMenu { KodeAplikasi = "BOS", Nama = "Tutup BKU",                            Link = "tutup-bku",                  Icon = "bi-lock-fill",           RequiresSekolah = true,  SortOrder = 11 };
        var bosMutasi12       = new AppMenu { KodeAplikasi = "BOS", Nama = "Mutasi 12 Transaksi BOSP",             Link = "bos-mutasi-12",              Icon = "bi-clock-history",       RequiresSekolah = true,  SortOrder = 12 };
        var bosMutasiAll      = new AppMenu { KodeAplikasi = "BOS", Nama = "Mutasi Semua Transaksi BOSP",          Link = "bos-mutasi-semua",           Icon = "bi-bank",                RequiresSekolah = true,  SortOrder = 13 };
        var bosLaporan        = new AppMenu { KodeAplikasi = "BOS", Nama = "Laporan BKU BOSP",                     Link = "laporan-BKU",                Icon = "bi-file-earmark-pdf",    RequiresSekolah = true,  SortOrder = 14 };
        var bosMonitoring     = new AppMenu { KodeAplikasi = "BOS", Nama = "Laporan Monitoring Dinas (BOSP)",      Link = "laporan-monitoring-dinas",   Icon = "bi-bar-chart-line",      RequiresSekolah = false, SortOrder = 15 };

        var bosMenus = new List<AppMenu>
        {
            bosDashboard, bosDropSekolah, bosDropDinas, bosInput, bosPengajuan, bosApproveTu,
            bosApprovePa, bosToken, bosBayar, bosPajak,
            bosTutup, bosMutasi12, bosMutasiAll, bosLaporan, bosMonitoring
        };

        // BKU BOP Negeri (BOP) - Tanpa Batal Transfer & Batal Tutup BKU
        var bopDashboard      = new AppMenu { KodeAplikasi = "BOP", Nama = "Dashboard BKU BOP",                   Link = "dashboard",                    Icon = "bi-speedometer2",        RequiresSekolah = true,  SortOrder = 1 };
        var bopNpdDraft       = new AppMenu { KodeAplikasi = "BOP", Nama = "Permohonan NPD",                      Link = "konfirmasi-drop-dana-bop",     Icon = "bi-file-earmark-text",   RequiresSekolah = true,  SortOrder = 2 };
        var bopNpdAjukan      = new AppMenu { KodeAplikasi = "BOP", Nama = "Pengajuan Permohonan NPD",            Link = "pengajuan-npd",                Icon = "bi-send-plus",           RequiresSekolah = true,  SortOrder = 3 };
        var bopNpdApprove     = new AppMenu { KodeAplikasi = "BOP", Nama = "Persetujuan NPD",                     Link = "persetujuan-npd",              Icon = "bi-check2-all",          RequiresSekolah = true,  SortOrder = 4 };
        var bopInput          = new AppMenu { KodeAplikasi = "BOP", Nama = "Input BKU BOP",                       Link = "input-bku",                    Icon = "bi-journal-plus",        RequiresSekolah = true,  SortOrder = 5 };
        var bopPengajuan      = new AppMenu { KodeAplikasi = "BOP", Nama = "Pengajuan Pembayaran BKU BOP",        Link = "pengajuan-pembayaran-bku",     Icon = "bi-send-check",          RequiresSekolah = true,  SortOrder = 6 };
        var bopApproveTu      = new AppMenu { KodeAplikasi = "BOP", Nama = "Persetujuan Pembayaran BKU BOP (TU)", Link = "persetujuan-bku-tu",           Icon = "bi-check2-square",       RequiresSekolah = true,  SortOrder = 7 };
        var bopApprovePa      = new AppMenu { KodeAplikasi = "BOP", Nama = "Persetujuan Pembayaran BKU BOP (PA)", Link = "persetujuan-bku-pa",           Icon = "bi-award",               RequiresSekolah = true,  SortOrder = 8 };
        var bopToken          = new AppMenu { KodeAplikasi = "BOP", Nama = "Permohonan Token",                    Link = "permohonan-token",             Icon = "bi-key-fill",            RequiresSekolah = true,  SortOrder = 9 };
        var bopBayar          = new AppMenu { KodeAplikasi = "BOP", Nama = "Pembayaran BKU BOP",                  Link = "pembayaran-bku",               Icon = "bi-credit-card-2-front", RequiresSekolah = true,  SortOrder = 10 };
        var bopPajak          = new AppMenu { KodeAplikasi = "BOP", Nama = "Pembayaran Pajak",                    Link = "pembayaran-pajak-bop",         Icon = "bi-receipt-cutoff",      RequiresSekolah = true,  SortOrder = 11 };
        var bopTutup          = new AppMenu { KodeAplikasi = "BOP", Nama = "Tutup BKU",                           Link = "tutup-bku",                    Icon = "bi-lock-fill",           RequiresSekolah = true,  SortOrder = 12 };
        var bopMutasi12       = new AppMenu { KodeAplikasi = "BOP", Nama = "Mutasi 12 Transaksi",                 Link = "mutasi-transfer-12-transaksi", Icon = "bi-clock-history",       RequiresSekolah = true,  SortOrder = 13 };
        var bopMutasiAll      = new AppMenu { KodeAplikasi = "BOP", Nama = "Mutasi Semua Transaksi BOP",          Link = "bop-mutasi-semua",             Icon = "bi-bank",                RequiresSekolah = true,  SortOrder = 14 };
        var bopLaporan        = new AppMenu { KodeAplikasi = "BOP", Nama = "Laporan BKU BOP",                     Link = "laporan-BKU",                  Icon = "bi-file-earmark-pdf",    RequiresSekolah = true,  SortOrder = 15 };
        var bopMonitoring     = new AppMenu { KodeAplikasi = "BOP", Nama = "Laporan Monitoring Sudin (BOP)",      Link = "laporan-monitoring-sudin",     Icon = "bi-bar-chart-line",      RequiresSekolah = false, SortOrder = 16 };

        var bopMenus = new List<AppMenu>
        {
            bopDashboard, bopNpdDraft, bopNpdAjukan, bopNpdApprove, bopInput, bopPengajuan,
            bopApproveTu, bopApprovePa, bopToken, bopBayar, bopPajak,
            bopTutup, bopMutasi12, bopMutasiAll, bopLaporan, bopMonitoring
        };

        // Administrator (ADMN)
        var admnBatas    = new AppMenu { KodeAplikasi = "ADMN", Nama = "Batas Pengajuan Belanja",         Link = "batas-pengajuan-belanja-list-opd", Icon = "bi-calendar-range",         RequiresSekolah = false, SortOrder = 1 };
        var admnMigrasi  = new AppMenu { KodeAplikasi = "ADMN", Nama = "Migrasi RKAS",                    Link = "konversi-data",                    Icon = "bi-file-earmark-spreadsheet", RequiresSekolah = true, SortOrder = 2 };
        var admnDrop     = new AppMenu { KodeAplikasi = "ADMN", Nama = "Dropping Dana BOS & BOP",         Link = "dropping-dana",                    Icon = "bi-send-check",             RequiresSekolah = false, SortOrder = 3 };

        var admnMenus = new List<AppMenu>
        {
            admnBatas, admnMigrasi, admnDrop
        };

        // Help Desk (HELP) - Terbuka untuk seluruh role sesuai Bagian I No. 7
        var helpMenus = new List<AppMenu>
        {
            new() { KodeAplikasi = "HELP", Nama = "User Manual",     Link = "user-manual",    Icon = "bi-book-half",       RequiresSekolah = false, SortOrder = 1 },
            new() { KodeAplikasi = "HELP", Nama = "Tiket Help Desk", Link = "tiket-helpdesk", Icon = "bi-ticket-detailed", RequiresSekolah = false, SortOrder = 2 },
            new() { KodeAplikasi = "HELP", Nama = "Video Tutorial",  Link = "video-tutorial", Icon = "bi-play-btn",        RequiresSekolah = false, SortOrder = 3 }
        };

        var allMenus = new List<AppMenu>();
        allMenus.AddRange(umMenus);
        allMenus.AddRange(bosMenus);
        allMenus.AddRange(bopMenus);
        allMenus.AddRange(admnMenus);
        allMenus.AddRange(helpMenus);
        db.AppMenus.AddRange(allMenus);
        await db.SaveChangesAsync();

        // 4. Relasi Otoritas <-> Aplikasi & Otoritas <-> Menu (Schema: auth.trsiapotoritasaplikasi & auth.trsiapotoritasmenu)
        void GrantModuleMenus(AppRole role, AppModule mod, IEnumerable<AppMenu> grantedMenus)
        {
            db.AppOtoritasAplikasis.Add(new AppOtoritasAplikasi { RoleId = role.Id, ModuleId = mod.Id, CreatedBy = "SEED" });
            foreach (var mn in grantedMenus)
            {
                db.AppOtoritasMenus.Add(new AppOtoritasMenu { RoleId = role.Id, MenuId = mn.Id, CreatedBy = "SEED" });
            }
        }

        // 4.1 ADMIN-TDI (ADM): Semua 5 Modul & seluruh sub-menu aktif
        GrantModuleMenus(roleAdminTdi, modUm, umMenus);
        GrantModuleMenus(roleAdminTdi, modBos, bosMenus);
        GrantModuleMenus(roleAdminTdi, modBop, bopMenus);
        GrantModuleMenus(roleAdminTdi, modAdmn, admnMenus);
        GrantModuleMenus(roleAdminTdi, modHelp, helpMenus);

        // 4.2 Bendahara Sekolah / Pemegang Kas (PK-NEGERI): 10 BOSP + 11 BOP + Help Desk
        GrantModuleMenus(rolePk, modBos, [
            bosDashboard, bosDropSekolah, bosInput, bosPengajuan, bosBayar, bosPajak,
            bosTutup, bosMutasi12, bosMutasiAll, bosLaporan
        ]);
        GrantModuleMenus(rolePk, modBop, [
            bopDashboard, bopNpdDraft, bopNpdAjukan, bopInput, bopPengajuan, bopBayar,
            bopPajak, bopTutup, bopMutasi12, bopMutasiAll, bopLaporan
        ]);
        GrantModuleMenus(rolePk, modHelp, helpMenus);

        // 4.3 Kepala Tata Usaha (TU-NEGERI): Persetujuan TU (Dropping BOSP, NPD BOP & BKU) + Help Desk
        GrantModuleMenus(roleTu, modBos, [bosDropSekolah, bosApproveTu]);
        GrantModuleMenus(roleTu, modBop, [bopNpdDraft, bopNpdApprove, bopApproveTu]);
        GrantModuleMenus(roleTu, modHelp, helpMenus);

        // 4.4 Pengguna Anggaran / Kepala Sekolah (PA-NEGERI): Token, Persetujuan PA (Dropping, NPD & BKU), Mutasi & Laporan + Help Desk
        GrantModuleMenus(rolePa, modBos, [bosDropSekolah, bosToken, bosApprovePa, bosMutasi12, bosMutasiAll, bosLaporan]);
        GrantModuleMenus(rolePa, modBop, [bopToken, bopNpdApprove, bopApprovePa, bopMutasi12, bopMutasiAll, bopLaporan]);
        GrantModuleMenus(rolePa, modHelp, helpMenus);

        // 4.5 Suku Dinas Pendidikan Wilayah (SUDIN): BOP/APBD + Help Desk
        GrantModuleMenus(roleSudin, modBop, [bopNpdApprove, bopMonitoring, bopLaporan, bopMutasi12, bopMutasiAll]);
        GrantModuleMenus(roleSudin, modHelp, helpMenus);

        // 4.6 Dinas Pendidikan Provinsi DKI Jakarta (ADMIN-DINAS): BOSP/APBN + Help Desk
        GrantModuleMenus(roleDinas, modBos, [bosDropDinas, bosMonitoring, bosLaporan, bosMutasi12, bosMutasiAll]);
        GrantModuleMenus(roleDinas, modHelp, helpMenus);

        // 5. Master Sekolah
        var sman1 = new Sekolah
        {
            Npsn = "20100101",
            NamaSekolah = "SMAN 1 JAKARTA",
            Jenjang = "SMA",
            StatusSekolah = "NEGERI",
            WilayahSudin = "JP",
            NamaSudin = "Suku Dinas Pendidikan Wilayah I Jakarta Pusat",
            Alamat = "Jl. Budi Utomo No.7, Pasar Baru, Sawah Besar, Jakarta Pusat",
            NoRekBos = "1110001234567",
            NamaRekBos = "BOS SMAN 1 JAKARTA",
            SaldoAwalBos = 0m,
            SaldoBos = 0m,
            NoRekBop = "1110007654321",
            NamaRekBop = "BOP SMAN 1 JAKARTA",
            SaldoAwalBop = 0m,
            SaldoBop = 0m,
            NpwpSekolah = "00.123.456.7-011.000",
            NamaKepalaSekolah = "Drs. Hendra Wijaya, M.Pd",
            NipKepalaSekolah = "197205121998021001",
            NrkKepalaSekolah = "198201",
            NamaKasubagTu = "Siti Rahmawati, S.E.",
            NipKasubagTu = "198003152005012004",
            NrkKasubagTu = "198502",
            NamaBendahara = "Ahmad Fauzi, S.Ak.",
            NipBendahara = "198811202014031002",
            NrkBendahara = "199003",
            IsRekeningConfirmed = true,
            TanggalKonfirmasiRekening = new DateTime(2026, 1, 5, 8, 0, 0, DateTimeKind.Utc)
        };

        var smpn115 = new Sekolah
        {
            Npsn = "20100202",
            NamaSekolah = "SMPN 115 JAKARTA",
            Jenjang = "SMP",
            StatusSekolah = "NEGERI",
            WilayahSudin = "JS",
            NamaSudin = "Suku Dinas Pendidikan Wilayah II Jakarta Selatan",
            Alamat = "Jl. KH. Abdullah Syafei, Tebet Timur, Jakarta Selatan",
            NoRekBos = "1110002223334",
            NamaRekBos = "BOS SMPN 115 JAKARTA",
            SaldoAwalBos = 0m,
            SaldoBos = 0m,
            NoRekBop = "1110005556667",
            NamaRekBop = "BOP SMPN 115 JAKARTA",
            SaldoAwalBop = 0m,
            SaldoBop = 0m,
            NpwpSekolah = "00.987.654.3-015.000",
            NamaKepalaSekolah = "Dra. Lestari Kusuma, M.M.",
            NipKepalaSekolah = "197409101999032002",
            NrkKepalaSekolah = "197804",
            NamaKasubagTu = "Budi Santoso, S.Sos.",
            NipKasubagTu = "198301122009021001",
            NrkKasubagTu = "198605",
            NamaBendahara = "Dewi Anggraini, S.E.",
            NipBendahara = "199104182015042003",
            NrkBendahara = "199206",
            IsRekeningConfirmed = true,
            TanggalKonfirmasiRekening = new DateTime(2026, 1, 6, 9, 0, 0, DateTimeKind.Utc)
        };

        var sdnMenteng01 = new Sekolah
        {
            Npsn = "20100303",
            NamaSekolah = "SDN MENTENG 01 PAGI",
            Jenjang = "SD",
            StatusSekolah = "NEGERI",
            WilayahSudin = "JP",
            NamaSudin = "Suku Dinas Pendidikan Wilayah I Jakarta Pusat",
            Alamat = "Jl. Besuki No.4, Menteng, Jakarta Pusat",
            NoRekBos = "1110008889991",
            NamaRekBos = "BOS SDN MENTENG 01 PAGI",
            SaldoAwalBos = 0m,
            SaldoBos = 0m,
            NoRekBop = "1110009998882",
            NamaRekBop = "BOP SDN MENTENG 01 PAGI",
            SaldoAwalBop = 0m,
            SaldoBop = 0m,
            NpwpSekolah = "00.456.789.1-071.000",
            NamaKepalaSekolah = "Sri Wahyuni, S.Pd., M.Pd.",
            NipKepalaSekolah = "197602222000122001",
            NrkKepalaSekolah = "197907",
            NamaKasubagTu = "Rudi Hartono, S.Kom.",
            NipKasubagTu = "198407052010011005",
            NrkKasubagTu = "198708",
            NamaBendahara = "Nadia Putri, A.Md.",
            NipBendahara = "199305122019032007",
            NrkBendahara = "199309",
            IsRekeningConfirmed = true,
            TanggalKonfirmasiRekening = new DateTime(2026, 1, 7, 9, 0, 0, DateTimeKind.Utc)
        };

        db.Sekolahs.AddRange(sman1, smpn115, sdnMenteng01);
        await db.SaveChangesAsync();

        // 6. Users (Schema: auth.users) & Relasi Otoritas/Sekolah/Wilayah
        var defaultPasswordHash = BCrypt.Net.BCrypt.HashPassword("password123");
        var adminTdiPasswordHash = BCrypt.Net.BCrypt.HashPassword("MonaS123!");

        var uAdminTdi = new AppUser { Username = "ADMIN-TDI", PasswordHash = adminTdiPasswordHash, NamaLengkap = "TDI ADMIN", Nrk = "ADMIN-TDI", Nip = "198501012010011001", Nik = "3171010101850001", Email = "admin.tdi@jakarta.go.id", NoHp = "081210000000", RoleCode = SiapBosRoles.AdminTdi, Jabatan = "Super Administrator / Tim Tenaga Ahli", WilayahSudin = "ALL", SekolahId = null };
        var uDinas    = new AppUser { Username = "admin.dinas", PasswordHash = defaultPasswordHash, NamaLengkap = "Yusuf Pratama, M.Kom.", Nrk = "100001", Nip = "198001012005011001", Nik = "3171010101800001", Email = "admin.dinas@disdik.jakarta.go.id", NoHp = "081210000001", RoleCode = SiapBosRoles.AdminDinas, Jabatan = "Administrator Dinas Pendidikan Provinsi DKI Jakarta", WilayahSudin = "ALL", SekolahId = null };
        var uSudinJp  = new AppUser { Username = "sudin.jp", PasswordHash = defaultPasswordHash, NamaLengkap = "Drs. Bambang Sutrisno, M.Si.", Nrk = "100002", Nip = "197504151999031002", Nik = "3171021504750002", Email = "sudin.jp@disdik.jakarta.go.id", NoHp = "081210000002", RoleCode = SiapBosRoles.Sudin, Jabatan = "Suku Dinas Pendidikan Wil. I Jakarta Pusat", WilayahSudin = "JP", SekolahId = null };
        var uPaSman1  = new AppUser { Username = "kepsek.sman1", PasswordHash = defaultPasswordHash, NamaLengkap = sman1.NamaKepalaSekolah, Nrk = sman1.NrkKepalaSekolah, Nip = sman1.NipKepalaSekolah, Nik = "3171031205720003", Email = "pa.sman1@jakarta.sch.id", NoHp = "081210000003", RoleCode = SiapBosRoles.PaNegeri, Jabatan = "Kepala Sekolah / Pengguna Anggaran (PA)", WilayahSudin = "JP", SekolahId = sman1.Id };
        var uTuSman1  = new AppUser { Username = "tu.sman1", PasswordHash = defaultPasswordHash, NamaLengkap = sman1.NamaKasubagTu, Nrk = sman1.NrkKasubagTu, Nip = sman1.NipKasubagTu, Nik = "3171041503800004", Email = "tu.sman1@jakarta.sch.id", NoHp = "081210000004", RoleCode = SiapBosRoles.TuNegeri, Jabatan = "Kepala Tata Usaha (Verifikator Level-1)", WilayahSudin = "JP", SekolahId = sman1.Id };
        var uPkSman1  = new AppUser { Username = "bendahara.sman1", PasswordHash = defaultPasswordHash, NamaLengkap = sman1.NamaBendahara, Nrk = sman1.NrkBendahara, Nip = sman1.NipBendahara, Nik = "3171052011880005", Email = "pk.sman1@jakarta.sch.id", NoHp = "081210000005", RoleCode = SiapBosRoles.PkNegeri, Jabatan = "Bendahara Sekolah / Pemegang Kas (PK)", WilayahSudin = "JP", SekolahId = sman1.Id };
        var uPkSmp115 = new AppUser { Username = "bendahara.smpn115", PasswordHash = defaultPasswordHash, NamaLengkap = smpn115.NamaBendahara, Nrk = smpn115.NrkBendahara, Nip = smpn115.NipBendahara, Nik = "3174011804910006", Email = "pk.smpn115@jakarta.sch.id", NoHp = "081210000006", RoleCode = SiapBosRoles.PkNegeri, Jabatan = "Bendahara Sekolah / Pemegang Kas (PK)", WilayahSudin = "JS", SekolahId = smpn115.Id };
        var uTuSmp115 = new AppUser { Username = "tu.smpn115", PasswordHash = defaultPasswordHash, NamaLengkap = smpn115.NamaKasubagTu, Nrk = smpn115.NrkKasubagTu, Nip = smpn115.NipKasubagTu, Nik = "3174011201830007", Email = "tu.smpn115@jakarta.sch.id", NoHp = "081210000007", RoleCode = SiapBosRoles.TuNegeri, Jabatan = "Kepala Tata Usaha (Verifikator Level-1)", WilayahSudin = "JS", SekolahId = smpn115.Id };
        var uPaSmp115 = new AppUser { Username = "kepsek.smpn115", PasswordHash = defaultPasswordHash, NamaLengkap = smpn115.NamaKepalaSekolah, Nrk = smpn115.NrkKepalaSekolah, Nip = smpn115.NipKepalaSekolah, Nik = "3174011009740008", Email = "pa.smpn115@jakarta.sch.id", NoHp = "081210000008", RoleCode = SiapBosRoles.PaNegeri, Jabatan = "Kepala Sekolah / Pengguna Anggaran (PA)", WilayahSudin = "JS", SekolahId = smpn115.Id };
        var uPkSdn01  = new AppUser { Username = "bendahara.sdnmenteng01", PasswordHash = defaultPasswordHash, NamaLengkap = sdnMenteng01.NamaBendahara, Nrk = sdnMenteng01.NrkBendahara, Nip = sdnMenteng01.NipBendahara, Nik = "3171021205930009", Email = "pk.sdnmenteng01@jakarta.sch.id", NoHp = "081210000009", RoleCode = SiapBosRoles.PkNegeri, Jabatan = "Bendahara Sekolah / Pemegang Kas (PK)", WilayahSudin = "JP", SekolahId = sdnMenteng01.Id };
        var uTuSdn01  = new AppUser { Username = "tu.sdnmenteng01", PasswordHash = defaultPasswordHash, NamaLengkap = sdnMenteng01.NamaKasubagTu, Nrk = sdnMenteng01.NrkKasubagTu, Nip = sdnMenteng01.NipKasubagTu, Nik = "3171020507840010", Email = "tu.sdnmenteng01@jakarta.sch.id", NoHp = "081210000010", RoleCode = SiapBosRoles.TuNegeri, Jabatan = "Kepala Tata Usaha (Verifikator Level-1)", WilayahSudin = "JP", SekolahId = sdnMenteng01.Id };
        var uPaSdn01  = new AppUser { Username = "kepsek.sdnmenteng01", PasswordHash = defaultPasswordHash, NamaLengkap = sdnMenteng01.NamaKepalaSekolah, Nrk = sdnMenteng01.NrkKepalaSekolah, Nip = sdnMenteng01.NipKepalaSekolah, Nik = "3171022202760011", Email = "pa.sdnmenteng01@jakarta.sch.id", NoHp = "081210000011", RoleCode = SiapBosRoles.PaNegeri, Jabatan = "Kepala Sekolah / Pengguna Anggaran (PA)", WilayahSudin = "JP", SekolahId = sdnMenteng01.Id };

        db.AppUsers.AddRange(uAdminTdi, uDinas, uSudinJp, uPaSman1, uTuSman1, uPkSman1, uPkSmp115, uTuSmp115, uPaSmp115, uPkSdn01, uTuSdn01, uPaSdn01);
        await db.SaveChangesAsync();

        db.AppUserOtoritas.AddRange(
            new AppUserOtoritas { UserId = uAdminTdi.Id, RoleId = roleAdminTdi.Id, CreatedBy = "SEED" },
            new AppUserOtoritas { UserId = uDinas.Id, RoleId = roleDinas.Id, CreatedBy = "SEED" },
            new AppUserOtoritas { UserId = uSudinJp.Id, RoleId = roleSudin.Id, CreatedBy = "SEED" },
            new AppUserOtoritas { UserId = uPaSman1.Id, RoleId = rolePa.Id, CreatedBy = "SEED" },
            new AppUserOtoritas { UserId = uTuSman1.Id, RoleId = roleTu.Id, CreatedBy = "SEED" },
            new AppUserOtoritas { UserId = uPkSman1.Id, RoleId = rolePk.Id, CreatedBy = "SEED" },
            new AppUserOtoritas { UserId = uPkSmp115.Id, RoleId = rolePk.Id, CreatedBy = "SEED" },
            new AppUserOtoritas { UserId = uTuSmp115.Id, RoleId = roleTu.Id, CreatedBy = "SEED" },
            new AppUserOtoritas { UserId = uPaSmp115.Id, RoleId = rolePa.Id, CreatedBy = "SEED" },
            new AppUserOtoritas { UserId = uPkSdn01.Id, RoleId = rolePk.Id, CreatedBy = "SEED" },
            new AppUserOtoritas { UserId = uTuSdn01.Id, RoleId = roleTu.Id, CreatedBy = "SEED" },
            new AppUserOtoritas { UserId = uPaSdn01.Id, RoleId = rolePa.Id, CreatedBy = "SEED" }
        );

        db.AppUserSekolahs.AddRange(
            new AppUserSekolah { UserId = uPaSman1.Id, SekolahId = sman1.Id, IsActive = true, CreatedBy = "SEED" },
            new AppUserSekolah { UserId = uTuSman1.Id, SekolahId = sman1.Id, IsActive = true, CreatedBy = "SEED" },
            new AppUserSekolah { UserId = uPkSman1.Id, SekolahId = sman1.Id, IsActive = true, CreatedBy = "SEED" },
            new AppUserSekolah { UserId = uPkSmp115.Id, SekolahId = smpn115.Id, IsActive = true, CreatedBy = "SEED" },
            new AppUserSekolah { UserId = uTuSmp115.Id, SekolahId = smpn115.Id, IsActive = true, CreatedBy = "SEED" },
            new AppUserSekolah { UserId = uPaSmp115.Id, SekolahId = smpn115.Id, IsActive = true, CreatedBy = "SEED" },
            new AppUserSekolah { UserId = uPkSdn01.Id, SekolahId = sdnMenteng01.Id, IsActive = true, CreatedBy = "SEED" },
            new AppUserSekolah { UserId = uTuSdn01.Id, SekolahId = sdnMenteng01.Id, IsActive = true, CreatedBy = "SEED" },
            new AppUserSekolah { UserId = uPaSdn01.Id, SekolahId = sdnMenteng01.Id, IsActive = true, CreatedBy = "SEED" }
        );

        db.AppUserWilayahs.AddRange(
            new AppUserWilayah { UserId = uAdminTdi.Id, KodeWilayah = "ALL", NamaWilayah = "Semua Wilayah Provinsi DKI Jakarta", IsActive = true },
            new AppUserWilayah { UserId = uDinas.Id, KodeWilayah = "ALL", NamaWilayah = "Semua Wilayah Provinsi DKI Jakarta", IsActive = true },
            new AppUserWilayah { UserId = uSudinJp.Id, KodeWilayah = "JP", NamaWilayah = "Jakarta Pusat", IsActive = true }
        );

        // 7. Master Periode (2025 & 2026) & Tax & BAS (Schema: siap)
        db.MasterPeriodes.AddRange(BuildDefaultMasterPeriodes());

        db.TaxMasters.AddRange(
            new TaxMaster { KodeTrxPajak = "P1", NamaPajak = "PPh Pasal 21 (Honorarium/Jasa Pribadi)", KodeMap = "411121", KodeJenisSetoran = "100", TarifPersen = 5.00m, Keterangan = "Pemotongan PPh 21 atas honorarium narasumber/tenaga ahli" },
            new TaxMaster { KodeTrxPajak = "P2", NamaPajak = "PPh Pasal 22 (Pembelian Barang > Rp 2 Juta)", KodeMap = "411122", KodeJenisSetoran = "920", TarifPersen = 1.50m, Keterangan = "Pemungutan PPh 22 Bendahara Pemerintah" },
            new TaxMaster { KodeTrxPajak = "P3", NamaPajak = "PPh Pasal 23 (Jasa Pemeliharaan/Sewa/Katering)", KodeMap = "411124", KodeJenisSetoran = "100", TarifPersen = 2.00m, Keterangan = "Pemotongan PPh 23 atas jasa teknik/manajemen/katering" },
            new TaxMaster { KodeTrxPajak = "P4", NamaPajak = "PPh Pasal 4 Ayat (2) (Final Sewa/Konstruksi)", KodeMap = "411128", KodeJenisSetoran = "403", TarifPersen = 10.00m, Keterangan = "Pajak penghasilan bersifat final" },
            new TaxMaster { KodeTrxPajak = "P5", NamaPajak = "PPN (Pajak Pertambahan Nilai 11%)", KodeMap = "411211", KodeJenisSetoran = "920", TarifPersen = 11.00m, Keterangan = "Pemungutan PPN oleh Instansi Pemerintah" }
        );

        db.BasAccounts.AddRange(
            new BasAccount { KodeAkun = "5.1.02.01.01.0024", NamaAkun = "Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor", Kelompok = "Belanja Barang dan Jasa", IsBos = true, IsBop = true },
            new BasAccount { KodeAkun = "5.1.02.01.01.0052", NamaAkun = "Belanja Makanan dan Minuman Rapat/Kegiatan", Kelompok = "Belanja Barang dan Jasa", IsBos = true, IsBop = true },
            new BasAccount { KodeAkun = "5.1.02.02.01.0061", NamaAkun = "Belanja Tagihan Listrik (PLN)", Kelompok = "Belanja Jasa Langganan", IsBos = true, IsBop = true },
            new BasAccount { KodeAkun = "5.1.02.03.02.0121", NamaAkun = "Belanja Pemeliharaan Alat Pendingin (AC)", Kelompok = "Belanja Pemeliharaan", IsBos = true, IsBop = true },
            new BasAccount { KodeAkun = "5.1.02.02.01.0003", NamaAkun = "Honorarium Narasumber / Tenaga Ahli Kegiatan Sekolah", Kelompok = "Belanja Jasa Profesi", IsBos = true, IsBop = true },
            new BasAccount { KodeAkun = "5.2.02.10.01.0002", NamaAkun = "Belanja Modal Peralatan Personal Komputer / Laptop", Kelompok = "Belanja Modal Peralatan & Mesin", IsBos = true, IsBop = true }
        );

        // 6. RKAS Items (BOS & BOP SMAN 1 Jakarta + SMPN 115 Jakarta)
        var rkasAtk = new RkasItem
        {
            SekolahId = sman1.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01",
            KodeSnp = "06", NamaSnp = "Pengembangan Standar Pengelolaan",
            KodeKegiatan = "06.05.01", NamaKegiatan = "Pengelolaan Administrasi & Operasional Sekolah",
            KodeAkun = "5.1.02.01.01.0024", NamaAkun = "Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor",
            KodeKomponen = "KMP-ATK-001", NamaKomponen = "Paket Kertas HVS A4, Tinta Printer & ATK Kantor",
            Spesifikasi = "HVS 80gr + Tinta Original + Map Sekolah", Satuan = "Paket", Volume = 10, HargaSatuan = 2500000m,
            TotalPagu = 25000000m, TotalRealisasi = 0m
        };
        var rkasAc = new RkasItem
        {
            SekolahId = sman1.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01",
            KodeSnp = "05", NamaSnp = "Pengembangan Sarana dan Prasarana Sekolah",
            KodeKegiatan = "05.08.01", NamaKegiatan = "Pemeliharaan Sarana dan Prasarana Ruang Kelas",
            KodeAkun = "5.1.02.03.02.0121", NamaAkun = "Belanja Pemeliharaan Alat Pendingin (AC)",
            KodeKomponen = "KMP-AC-002", NamaKomponen = "Jasa Servis, Cuci & Isi Freon AC Ruang Kelas",
            Spesifikasi = "30 Unit AC Split 2 PK", Satuan = "Unit", Volume = 30, HargaSatuan = 350000m,
            TotalPagu = 10500000m, TotalRealisasi = 0m
        };
        var rkasPln = new RkasItem
        {
            SekolahId = sman1.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01",
            KodeSnp = "06", NamaSnp = "Pengembangan Standar Pengelolaan",
            KodeKegiatan = "06.07.01", NamaKegiatan = "Pembayaran Langganan Daya dan Jasa",
            KodeAkun = "5.1.02.02.01.0061", NamaAkun = "Belanja Tagihan Listrik (PLN)",
            KodeKomponen = "KMP-PLN-003", NamaKomponen = "Rekening Listrik Bulanan PLN SMAN 1 Jakarta",
            Spesifikasi = "Daya 105 kVA", Satuan = "Bulan", Volume = 6, HargaSatuan = 9500000m,
            TotalPagu = 57000000m, TotalRealisasi = 0m
        };
        var rkasKonsumsi = new RkasItem
        {
            SekolahId = sman1.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01",
            KodeSnp = "03", NamaSnp = "Pengembangan Standar Proses",
            KodeKegiatan = "03.03.12", NamaKegiatan = "Penyelenggaraan Ekstrakurikuler & Lomba Siswa",
            KodeAkun = "5.1.02.01.01.0052", NamaAkun = "Belanja Makanan dan Minuman Rapat/Kegiatan",
            KodeKomponen = "KMP-KONS-004", NamaKomponen = "Paket Konsumsi Pelatihan Olimpiade & Eskul",
            Spesifikasi = "Nasi Box + Snack", Satuan = "Box", Volume = 300, HargaSatuan = 45000m,
            TotalPagu = 13500000m, TotalRealisasi = 0m
        };
        var rkasLaptop = new RkasItem
        {
            SekolahId = sman1.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01",
            KodeSnp = "05", NamaSnp = "Pengembangan Sarana dan Prasarana Sekolah",
            KodeKegiatan = "05.02.03", NamaKegiatan = "Pengadaan Peralatan TIK Laboratorium Komputer",
            KodeAkun = "5.2.02.10.01.0002", NamaAkun = "Belanja Modal Peralatan Personal Komputer / Laptop",
            KodeKomponen = "KMP-TIK-005", NamaKomponen = "Laptop Laboratorium Siswa TKJ/IPA",
            Spesifikasi = "Core i5 / 16GB / 512GB SSD", Satuan = "Unit", Volume = 12, HargaSatuan = 11500000m,
            TotalPagu = 138000000m, TotalRealisasi = 0m
        };

        var rkasBopHonor = new RkasItem
        {
            SekolahId = sman1.Id, TahunAnggaran = 2026, SumberDana = "BOP", KodePeriode = "TW1",
            KodeSnp = "04", NamaSnp = "Pengembangan Pendidik dan Tenaga Kependidikan",
            KodeKegiatan = "04.06.01", NamaKegiatan = "Peningkatan Kompetensi Guru & Kurikulum Merdeka",
            KodeAkun = "5.1.02.02.01.0003", NamaAkun = "Honorarium Narasumber / Tenaga Ahli Kegiatan Sekolah",
            KodeKomponen = "BOP-HON-001", NamaKomponen = "Honorarium Narasumber Workshop Kurikulum",
            Spesifikasi = "Tarif Narasumber Provinsi DKI", Satuan = "OJ", Volume = 40, HargaSatuan = 900000m,
            TotalPagu = 36000000m, TotalRealisasi = 0m
        };
        var rkasBopPln = new RkasItem
        {
            SekolahId = sman1.Id, TahunAnggaran = 2026, SumberDana = "BOP", KodePeriode = "TW1",
            KodeSnp = "06", NamaSnp = "Pengembangan Standar Pengelolaan",
            KodeKegiatan = "06.07.02", NamaKegiatan = "Dukungan Operasional Utilitas Sekolah",
            KodeAkun = "5.1.02.02.01.0061", NamaAkun = "Belanja Tagihan Listrik (PLN)",
            KodeKomponen = "BOP-PLN-002", NamaKomponen = "Tagihan Listrik Tambahan Gedung Baru",
            Spesifikasi = "VA PLN Gedung B", Satuan = "Bulan", Volume = 3, HargaSatuan = 6500000m,
            TotalPagu = 19500000m, TotalRealisasi = 0m
        };

        var rkasSmpAtk = new RkasItem
        {
            SekolahId = smpn115.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01",
            KodeSnp = "06", NamaSnp = "Pengembangan Standar Pengelolaan",
            KodeKegiatan = "06.05.01", NamaKegiatan = "Operasional Perkantoran Sekolah",
            KodeAkun = "5.1.02.01.01.0024", NamaAkun = "Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor",
            KodeKomponen = "SMP-ATK-001", NamaKomponen = "ATK Ujian Tengah Semester",
            Spesifikasi = "Kertas HVS & Amplop Soal", Satuan = "Paket", Volume = 10, HargaSatuan = 1500000m,
            TotalPagu = 15000000m, TotalRealisasi = 0m
        };
        var rkasSmpPln = new RkasItem
        {
            SekolahId = smpn115.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01",
            KodeSnp = "06", NamaSnp = "Pengembangan Standar Pengelolaan",
            KodeKegiatan = "06.07.01", NamaKegiatan = "Pembayaran Langganan Daya dan Jasa",
            KodeAkun = "5.1.02.02.01.0061", NamaAkun = "Belanja Tagihan Listrik (PLN)",
            KodeKomponen = "SMP-PLN-002", NamaKomponen = "Tagihan Listrik & Internet SMPN 115",
            Spesifikasi = "Daya 66 kVA", Satuan = "Bulan", Volume = 6, HargaSatuan = 5500000m,
            TotalPagu = 33000000m, TotalRealisasi = 0m
        };
        var rkasSmpBopHonor = new RkasItem
        {
            SekolahId = smpn115.Id, TahunAnggaran = 2026, SumberDana = "BOP", KodePeriode = "TW1",
            KodeSnp = "04", NamaSnp = "Pengembangan Pendidik dan Tenaga Kependidikan",
            KodeKegiatan = "04.06.01", NamaKegiatan = "Pengembangan Kompetensi Guru SMPN 115",
            KodeAkun = "5.1.02.02.01.0003", NamaAkun = "Honorarium Narasumber / Tenaga Ahli Kegiatan Sekolah",
            KodeKomponen = "SMP-BOP-001", NamaKomponen = "Honorarium Narasumber Pelatihan Literasi",
            Spesifikasi = "Tarif DKI", Satuan = "OJ", Volume = 20, HargaSatuan = 800000m,
            TotalPagu = 16000000m, TotalRealisasi = 0m
        };
        var rkasSdnBuku = new RkasItem
        {
            SekolahId = sdnMenteng01.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01",
            KodeSnp = "02", NamaSnp = "Pengembangan Standar Isi",
            KodeKegiatan = "02.02.01", NamaKegiatan = "Pengembangan Perpustakaan SDN Menteng 01",
            KodeAkun = "5.1.02.01.01.0024", NamaAkun = "Belanja Buku Bacaan & Referensi Perpustakaan",
            KodeKomponen = "SDN-BUKU-001", NamaKomponen = "Paket Buku Pengayaan & Modul Kurikulum Merdeka",
            Spesifikasi = "Paket SD Lengkap", Satuan = "Paket", Volume = 20, HargaSatuan = 1200000m,
            TotalPagu = 24000000m, TotalRealisasi = 0m
        };
        var rkasSdnKonsumsi = new RkasItem
        {
            SekolahId = sdnMenteng01.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01",
            KodeSnp = "03", NamaSnp = "Pengembangan Standar Proses",
            KodeKegiatan = "03.03.05", NamaKegiatan = "Pelaksanaan Kegiatan Pembelajaran & Ekstrakurikuler",
            KodeAkun = "5.1.02.01.01.0052", NamaAkun = "Belanja Makanan dan Minuman Kegiatan Sekolah",
            KodeKomponen = "SDN-KONS-002", NamaKomponen = "Konsumsi Rapat Komite & Parenting SD",
            Spesifikasi = "Snack + Makan Siang", Satuan = "Box", Volume = 200, HargaSatuan = 40000m,
            TotalPagu = 8000000m, TotalRealisasi = 0m
        };
        var rkasSdnBopKebersihan = new RkasItem
        {
            SekolahId = sdnMenteng01.Id, TahunAnggaran = 2026, SumberDana = "BOP", KodePeriode = "TW1",
            KodeSnp = "06", NamaSnp = "Pengembangan Standar Pengelolaan",
            KodeKegiatan = "06.05.08", NamaKegiatan = "Kebersihan & Sanitasi Lingkungan Sekolah",
            KodeAkun = "5.1.02.01.01.0024", NamaAkun = "Belanja Alat Kebersihan dan Bahan Pembersih",
            KodeKomponen = "SDN-BOP-001", NamaKomponen = "Paket Sanitasi & Kebersihan SDN Menteng 01",
            Spesifikasi = "Disinfektan + Alat Kebersihan", Satuan = "Paket", Volume = 12, HargaSatuan = 1000000m,
            TotalPagu = 12000000m, TotalRealisasi = 0m
        };

        db.RkasItems.AddRange(
            rkasAtk, rkasAc, rkasPln, rkasKonsumsi, rkasLaptop, rkasBopHonor, rkasBopPln,
            rkasSmpAtk, rkasSmpPln, rkasSmpBopHonor,
            rkasSdnBuku, rkasSdnKonsumsi, rkasSdnBopKebersihan);
        await db.SaveChangesAsync();

        // 7. BKU/SPJ, Pajak BKU dibiarkan kosong agar user dapat simulasi bersih dari awal

        // 8. Master Hasil Migrasi ADM (PASK Dropping Dana BOS & NPD BOP per Sekolah & Triwulan)
        MigrasiPask BuildPask(
            Sekolah sk, int tahun, string sumberDana, string kodePeriode, string namaPeriode,
            string kodeSubgiat, string namaSubgiat, string namaPask, decimal totalDana,
            (string kodeKeg, string namaKeg, string kodeRek, string namaRek, decimal anggaran, decimal akb, decimal sblm, decimal npd)[] lines)
        {
            return new MigrasiPask
            {
                BatchKode = $"MIG-{tahun}-INIT",
                SekolahId = sk.Id,
                TahunAnggaran = tahun,
                SumberDana = sumberDana,
                KodePeriode = kodePeriode,
                NamaPeriode = namaPeriode,
                KodeSubgiat = kodeSubgiat,
                NamaSubgiat = namaSubgiat,
                NamaPask = namaPask,
                Program = "PROGRAM PENGELOLAAN PENDIDIKAN",
                NomorDpaSkpd = $"001/DPA/{tahun}",
                SumberDanaLabel = sumberDana == "BOS" ? "BOSP-REGULER" : $"BOP-{sk.Jenjang}N ALOKASI DASAR",
                TotalDana = totalDana,
                ImportedBy = "ADMIN-TDI",
                ImportedAt = new DateTime(tahun, 1, 10, 8, 0, 0, DateTimeKind.Utc),
                FileName = $"Migrasi_PASK_{tahun}_Awal.xlsx",
                Rincians = lines.Select(l => new MigrasiPaskRinci
                {
                    KodeKegiatan = l.kodeKeg,
                    NamaKegiatan = l.namaKeg,
                    KodeRekening = l.kodeRek,
                    NamaRekening = l.namaRek,
                    Anggaran = l.anggaran,
                    AkbPerPeriode = l.akb,
                    NilaiSebelum = l.sblm,
                    NilaiNpd = l.npd
                }).ToList()
            };
        }

        var paskSmanBosTw1 = BuildPask(sman1, 2026, "BOS", "TW1", "Triwulan ke-01",
            "1.01.02.2.01.0016", "Pengelolaan Pendidikan Sekolah Menengah Atas",
            "Dana Bantuan Operasional Satuan Pendidikan (BOSP) SMAN 1 Jakarta TW 1", 466650000m,
            [
                ("02.02", "02.02. Pengembangan Perpustakaan dan Pojok Baca", "5.1.02.01.01.0024", "Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor", 320000000m, 160000000m, 0m, 160000000m),
                ("06.05", "06.05. Pelaksanaan administrasi kegiatan sekolah", "5.1.02.02.01.0061", "Belanja Jasa Paket/Pengiriman & Listrik Internet", 613300000m, 306650000m, 0m, 306650000m)
            ]);
        var paskSmanBosTw2 = BuildPask(sman1, 2026, "BOS", "TW2", "Triwulan ke-02",
            "1.01.02.2.01.0016", "Pengelolaan Pendidikan Sekolah Menengah Atas",
            "Dana Bantuan Operasional Satuan Pendidikan (BOSP) SMAN 1 Jakarta TW 2", 300000000m,
            [
                ("03.03", "03.03. Pelaksanaan Kegiatan Pembelajaran dan Ekstrakurikuler", "5.1.02.01.01.0052", "Belanja Makanan dan Minuman Rapat/Kegiatan", 400000000m, 150000000m, 150000000m, 150000000m),
                ("06.05", "06.05. Pelaksanaan administrasi kegiatan sekolah", "5.1.02.02.01.0061", "Belanja Langganan Daya dan Jasa", 400000000m, 150000000m, 150000000m, 150000000m)
            ]);
        var paskSmanBosTw3 = BuildPask(sman1, 2026, "BOS", "TW3", "Triwulan ke-03",
            "1.01.02.2.01.0016", "Pengelolaan Pendidikan Sekolah Menengah Atas",
            "Dana Bantuan Operasional Satuan Pendidikan (BOSP) SMAN 1 Jakarta TW 3", 250000000m,
            [
                ("05.08", "05.08. Pemeliharaan Sarana dan Prasarana Sekolah", "5.1.02.03.02.0117", "Belanja Pemeliharaan Alat Pendingin & Ruang Kelas", 350000000m, 125000000m, 125000000m, 125000000m),
                ("06.07", "06.07. Pembiayaan langganan daya dan jasa", "5.1.02.02.01.0061", "Belanja Tagihan Listrik, Air, dan Internet", 350000000m, 125000000m, 125000000m, 125000000m)
            ]);

        var paskSmanBopTw1 = BuildPask(sman1, 2026, "BOP", "TW1", "Triwulan ke-01",
            "1.01.02.2.01.0047", "Penyediaan Biaya Operasional Pendidikan SMA Negeri",
            "Penyediaan Biaya Operasional Pendidikan SMA Negeri (BOP-SMAN) Alokasi Dasar TW 1", 329000000m,
            [
                ("06.05", "06.05. Pelaksanaan administrasi kegiatan sekolah", "5.1.02.01.01.0012", "Belanja Bahan-Bahan Lainnya", 600000000m, 150000000m, 0m, 150000000m),
                ("06.07", "06.07. Pembiayaan langganan daya dan jasa", "5.1.02.02.01.0061", "Belanja Tagihan Listrik & Air", 716000000m, 179000000m, 0m, 179000000m)
            ]);
        var paskSmanBopTw2 = BuildPask(sman1, 2026, "BOP", "TW2", "Triwulan ke-02",
            "1.01.02.2.01.0047", "Penyediaan Biaya Operasional Pendidikan SMA Negeri",
            "Penyediaan Biaya Operasional Pendidikan SMA Negeri (BOP-SMAN) Alokasi Dasar TW 2", 285000000m,
            [
                ("06.05", "06.05. Pelaksanaan administrasi kegiatan sekolah", "5.2.02.05.02.0004", "Belanja Modal Alat Pendingin", 450000000m, 135000000m, 150000000m, 135000000m),
                ("06.07", "06.07. Pembiayaan langganan daya dan jasa", "5.1.02.01.01.0012", "Belanja Bahan-Bahan Lainnya", 600000000m, 150000000m, 150000000m, 150000000m)
            ]);
        var paskSmanBopTw3 = BuildPask(sman1, 2026, "BOP", "TW3", "Triwulan ke-03",
            "1.01.02.2.01.0047", "Penyediaan Biaya Operasional Pendidikan SMA Negeri",
            "Penyediaan Biaya Operasional Pendidikan SMA Negeri (BOP-SMAN) Alokasi Dasar TW 3", 175000000m,
            [
                ("06.05", "06.05. Pelaksanaan administrasi kegiatan sekolah", "5.1.02.01.01.0012", "Belanja Bahan-Bahan Lainnya", 350000000m, 95000000m, 95000000m, 95000000m),
                ("06.07", "06.07. Pembiayaan langganan daya dan jasa", "5.1.02.02.01.0061", "Belanja Tagihan Listrik, Air, dan Internet", 320000000m, 80000000m, 80000000m, 80000000m)
            ]);
        var paskSmanBosTw4 = BuildPask(sman1, 2026, "BOS", "TW4", "Triwulan ke-04",
            "1.01.02.2.01.0016", "Pengelolaan Pendidikan Sekolah Menengah Atas",
            "Dana Bantuan Operasional Satuan Pendidikan (BOSP) SMAN 1 Jakarta TW 4", 150000000m,
            [
                ("02.02", "02.02. Pengembangan Perpustakaan dan Pojok Baca", "5.1.02.01.01.0024", "Belanja Alat Tulis Kantor & Bahan Pustaka", 180000000m, 60000000m, 35000000m, 60000000m),
                ("05.08", "05.08. Pemeliharaan Sarana dan Prasarana Sekolah", "5.1.02.03.02.0117", "Belanja Pemeliharaan Ruang Belajar", 250000000m, 90000000m, 55000000m, 90000000m)
            ]);
        var paskSmanBopTw4 = BuildPask(sman1, 2026, "BOP", "TW4", "Triwulan ke-04",
            "1.01.02.2.01.0047", "Penyediaan Biaya Operasional Pendidikan SMA Negeri",
            "Penyediaan Biaya Operasional Pendidikan SMA Negeri (BOP-SMAN) Alokasi Dasar TW 4", 110000000m,
            [
                ("06.05", "06.05. Pelaksanaan administrasi kegiatan sekolah", "5.2.02.05.02.0004", "Belanja Modal Alat Pendingin", 120000000m, 45000000m, 30000000m, 45000000m),
                ("06.07", "06.07. Pembiayaan langganan daya dan jasa", "5.1.02.01.01.0012", "Belanja Bahan-Bahan Lainnya", 240000000m, 65000000m, 40000000m, 65000000m)
            ]);

        var paskSmpBosTw1 = BuildPask(smpn115, 2026, "BOS", "TW1", "Triwulan ke-01",
            "1.01.02.2.01.0014", "Pengelolaan Pendidikan Sekolah Menengah Pertama",
            "Dana BOSP SMPN 115 Jakarta TW 1", 289000000m,
            [("02.02", "02.02. Pengembangan Perpustakaan", "5.1.02.01.01.0024", "Belanja ATK & Buku", 580000000m, 289000000m, 0m, 289000000m)]);
        var paskSmpBosTw2 = BuildPask(smpn115, 2026, "BOS", "TW2", "Triwulan ke-02",
            "1.01.02.2.01.0014", "Pengelolaan Pendidikan Sekolah Menengah Pertama",
            "Dana BOSP SMPN 115 Jakarta TW 2", 185000000m,
            [("03.03", "03.03. Pembelajaran & Ekstrakurikuler", "5.1.02.01.01.0052", "Belanja Bahan Kegiatan", 370000000m, 185000000m, 185000000m, 185000000m)]);
        var paskSmpBopTw1 = BuildPask(smpn115, 2026, "BOP", "TW1", "Triwulan ke-01",
            "1.01.02.2.01.0046", "Penyediaan Biaya Operasional Pendidikan SMP Negeri",
            "Penyediaan BOP SMP Negeri (BOP-SMPN) Alokasi Dasar TW 1", 196400000m,
            [("06.05", "06.05. Administrasi Kegiatan Sekolah", "5.1.02.01.01.0012", "Belanja Bahan Operasional", 392800000m, 196400000m, 0m, 196400000m)]);
        var paskSmpBopTw2 = BuildPask(smpn115, 2026, "BOP", "TW2", "Triwulan ke-02",
            "1.01.02.2.01.0046", "Penyediaan Biaya Operasional Pendidikan SMP Negeri",
            "Penyediaan BOP SMP Negeri (BOP-SMPN) Alokasi Dasar TW 2", 165000000m,
            [("06.07", "06.07. Langganan Daya & Jasa", "5.1.02.02.01.0061", "Belanja Daya & Jasa", 330000000m, 165000000m, 165000000m, 165000000m)]);
        var paskSmpBosTw3 = BuildPask(smpn115, 2026, "BOS", "TW3", "Triwulan ke-03",
            "1.01.02.2.01.0014", "Pengelolaan Pendidikan Sekolah Menengah Pertama",
            "Dana BOSP SMPN 115 Jakarta TW 3", 95000000m,
            [("03.03", "03.03. Pembelajaran & Ekstrakurikuler", "5.1.02.01.01.0052", "Belanja Bahan Pembelajaran Siswa", 190000000m, 95000000m, 45000000m, 95000000m)]);
        var paskSmpBopTw3 = BuildPask(smpn115, 2026, "BOP", "TW3", "Triwulan ke-03",
            "1.01.02.2.01.0046", "Penyediaan Biaya Operasional Pendidikan SMP Negeri",
            "Penyediaan BOP SMP Negeri (BOP-SMPN) Alokasi Dasar TW 3", 80000000m,
            [("06.05", "06.05. Administrasi Kegiatan Sekolah", "5.1.02.01.01.0012", "Belanja Bahan Operasional Sekolah", 160000000m, 80000000m, 40000000m, 80000000m)]);
        var paskSdnBosTw1 = BuildPask(sdnMenteng01, 2026, "BOS", "TW1", "Triwulan ke-01",
            "1.01.02.2.01.0012", "Pengelolaan Pendidikan Sekolah Dasar",
            "Dana BOSP SDN Menteng 01 Pagi TW 1", 186000000m,
            [("02.02", "02.02. Pengembangan Perpustakaan", "5.1.02.01.01.0024", "Belanja ATK & Buku", 372000000m, 186000000m, 0m, 186000000m)]);
        var paskSdnBopTw1 = BuildPask(sdnMenteng01, 2026, "BOP", "TW1", "Triwulan ke-01",
            "1.01.02.2.01.0045", "Penyediaan Biaya Operasional Pendidikan SD Negeri",
            "Penyediaan BOP SD Negeri (BOP-SDN) Alokasi Dasar TW 1", 145000000m,
            [("06.05", "06.05. Administrasi Kegiatan Sekolah", "5.1.02.01.01.0012", "Belanja Bahan Operasional", 290000000m, 145000000m, 0m, 145000000m)]);
        var paskSdnBosTw2 = BuildPask(sdnMenteng01, 2026, "BOS", "TW2", "Triwulan ke-02",
            "1.01.02.2.01.0012", "Pengelolaan Pendidikan Sekolah Dasar",
            "Dana BOSP SDN Menteng 01 Pagi TW 2", 75000000m,
            [("02.02", "02.02. Pengembangan Perpustakaan", "5.1.02.01.01.0024", "Belanja Bahan Pustaka & ATK", 150000000m, 75000000m, 35000000m, 75000000m)]);
        var paskSdnBopTw2 = BuildPask(sdnMenteng01, 2026, "BOP", "TW2", "Triwulan ke-02",
            "1.01.02.2.01.0045", "Penyediaan Biaya Operasional Pendidikan SD Negeri",
            "Penyediaan BOP SD Negeri (BOP-SDN) Alokasi Dasar TW 2", 70000000m,
            [("06.07", "06.07. Pembiayaan Langganan Daya & Jasa", "5.1.02.02.01.0061", "Belanja Tagihan Listrik, Air & Internet", 140000000m, 70000000m, 30000000m, 70000000m)]);

        db.MigrasiPasks.AddRange(
            paskSmanBosTw1, paskSmanBosTw2, paskSmanBosTw3, paskSmanBosTw4,
            paskSmanBopTw1, paskSmanBopTw2, paskSmanBopTw3, paskSmanBopTw4,
            paskSmpBosTw1, paskSmpBosTw2, paskSmpBosTw3,
            paskSmpBopTw1, paskSmpBopTw2, paskSmpBopTw3,
            paskSdnBosTw1, paskSdnBosTw2, paskSdnBopTw1, paskSdnBopTw2);
        await db.SaveChangesAsync();

        // 8b-11. Dropping Dana, NPD BOP, Mutasi Rekening, BAP Kas & Audit Logs dibiarkan kosong untuk simulasi awal

        db.HelpdeskTickets.Add(new HelpdeskTicket
        {
            SekolahId = sman1.Id, NamaPelapor = sman1.NamaBendahara, RolePelapor = SiapBosRoles.PkNegeri,
            Judul = "Konfirmasi Penyaluran BOSP Tahap 2", Kategori = "Dropping Dana",
            Deskripsi = "Mohon verifikasi SP2D Dropping BOSP Tahap 2 agar muncul di menu Konfirmasi Dana sekolah.",
            Status = "RESOLVED", TanggapanAdmin = "SP2D Tahap 2 senilai Rp 300.000.000 telah dirilis oleh Dinas dan siap dikonfirmasi di menu Konfirmasi Dana.",
            ResolvedAt = DateTime.UtcNow.AddDays(-1)
        });

        // 12. Seed OAuth Schema (oauth.access_token & oauth.history_access_token)
        var initialTokenId = Guid.NewGuid().ToString("N");
        db.OAuthAccessTokens.Add(new OAuthAccessToken
        {
            TokenId = initialTokenId,
            UserName = "ADMIN-TDI",
            ClientId = "siapbos-webapp",
            RoleCode = SiapBosRoles.AdminTdi,
            TahunAnggaran = 2025,
            IpAddress = "127.0.0.1",
            LoginAt = DateTime.UtcNow
        });
        db.OAuthTokenHistories.Add(new OAuthTokenHistory
        {
            AccessId = initialTokenId,
            UserName = "ADMIN-TDI",
            ClientId = "siapbos-webapp",
            IpAddress = "127.0.0.1",
            LoginAt = DateTime.UtcNow,
            IsLogout = false
        });

        await db.SaveChangesAsync();

        // 13. Duplikasi Data Transaksi untuk Tahun Anggaran 2025 agar Login TA 2025 maupun TA 2026 memiliki data lengkap
        var rkas2026 = await db.RkasItems.Where(r => r.TahunAnggaran == 2026).AsNoTracking().ToListAsync();
        foreach (var r in rkas2026)
        {
            r.Id = 0;
            r.TahunAnggaran = 2025;
            db.RkasItems.Add(r);
        }

        var pask2026 = await db.MigrasiPasks
            .Include(m => m.Rincians)
            .Where(m => m.TahunAnggaran == 2026)
            .AsNoTracking()
            .ToListAsync();
        var paskOldMap = new Dictionary<int, MigrasiPask>();
        foreach (var p in pask2026)
        {
            var oldPaskId = p.Id;
            p.Id = 0;
            p.TahunAnggaran = 2025;
            p.BatchKode = p.BatchKode.Replace("2026", "2025");
            p.NomorDpaSkpd = p.NomorDpaSkpd.Replace("2026", "2025");
            p.NamaPask = p.NamaPask.Replace("2026", "2025");
            p.ImportedAt = p.ImportedAt.AddYears(-1);
            foreach (var r in p.Rincians)
            {
                r.Id = 0;
                r.MigrasiPaskId = 0;
            }
            db.MigrasiPasks.Add(p);
            paskOldMap[oldPaskId] = p;
        }
        await db.SaveChangesAsync();

        var drop2026 = await db.DroppingDanas.Where(d => d.TahunAnggaran == 2026).AsNoTracking().ToListAsync();
        foreach (var d in drop2026)
        {
            d.Id = 0;
            d.TahunAnggaran = 2025;
            d.NomorSp2d = d.NomorSp2d.Replace("2026", "2025");
            d.NomorDpaSkpd = d.NomorDpaSkpd.Replace("2026", "2025");
            d.TanggalDropping = d.TanggalDropping.AddYears(-1);
            if (d.TanggalKonfirmasi.HasValue) d.TanggalKonfirmasi = d.TanggalKonfirmasi.Value.AddYears(-1);
            if (d.MigrasiPaskId.HasValue && paskOldMap.TryGetValue(d.MigrasiPaskId.Value, out var clonedPask))
                d.MigrasiPaskId = clonedPask.Id;
            db.DroppingDanas.Add(d);
        }

        var npd2026 = await db.NpdBops.Where(n => n.TahunAnggaran == 2026).AsNoTracking().ToListAsync();
        foreach (var n in npd2026)
        {
            n.Id = 0;
            n.TahunAnggaran = 2025;
            n.NomorNpd = n.NomorNpd.Replace("2026", "2025");
            n.NomorDpaSkpd = n.NomorDpaSkpd.Replace("2026", "2025");
            n.TanggalNpd = n.TanggalNpd.AddYears(-1);
            if (n.NomorSipkd != null) n.NomorSipkd = n.NomorSipkd.Replace("2026", "2025");
            if (n.MigrasiPaskId.HasValue && paskOldMap.TryGetValue(n.MigrasiPaskId.Value, out var clonedPask))
                n.MigrasiPaskId = clonedPask.Id;
            db.NpdBops.Add(n);
        }

        var bku2026 = await db.BkuTransactions
            .Include(b => b.DetailItems)
            .Include(b => b.TaxItems)
            .Where(b => b.TahunAnggaran == 2026)
            .OrderBy(b => b.Id)
            .AsNoTracking()
            .ToListAsync();

        var bkuCloneMap = new Dictionary<int, BkuTransaction>();
        var parentOldIdMap = new Dictionary<BkuTransaction, int>();
        foreach (var b in bku2026)
        {
            var oldId = b.Id;
            if (b.ParentBkuId.HasValue)
            {
                parentOldIdMap[b] = b.ParentBkuId.Value;
            }
            b.Id = 0;
            b.TahunAnggaran = 2025;
            b.ParentBkuId = null;
            b.NomorBku = b.NomorBku.Replace("2026", "2025");
            b.NomorBukti = b.NomorBukti.Replace("2026", "2025");
            if (!string.IsNullOrEmpty(b.ParentNomorBku)) b.ParentNomorBku = b.ParentNomorBku.Replace("2026", "2025");
            if (!string.IsNullOrEmpty(b.NomorArsip)) b.NomorArsip = b.NomorArsip.Replace("2026", "2025");
            b.TanggalTransaksi = b.TanggalTransaksi.AddYears(-1);
            foreach (var det in b.DetailItems)
            {
                det.Id = 0;
                det.BkuTransactionId = 0;
                det.RkasItemId = null;
            }
            foreach (var tx in b.TaxItems)
            {
                tx.Id = 0;
                tx.BkuTransactionId = 0;
                tx.TahunPajak = 2025;
            }
            db.BkuTransactions.Add(b);
            bkuCloneMap[oldId] = b;
        }

        var bap2026 = await db.BapKasReports.Where(b => b.TahunAnggaran == 2026).AsNoTracking().ToListAsync();
        foreach (var bap in bap2026)
        {
            bap.Id = 0;
            bap.TahunAnggaran = 2025;
            bap.NomorBap = bap.NomorBap.Replace("2026", "2025");
            bap.TanggalBap = bap.TanggalBap.AddYears(-1);
            db.BapKasReports.Add(bap);
        }

        var mut2026 = await db.BankMutations.Where(m => m.TanggalTransaksi.Year == 2026).AsNoTracking().ToListAsync();
        foreach (var m in mut2026)
        {
            m.Id = 0;
            m.TanggalTransaksi = m.TanggalTransaksi.AddYears(-1);
            m.NomorReferensi = m.NomorReferensi.Replace("2026", "2025");
            m.Uraian = m.Uraian.Replace("2026", "2025");
            m.BkuTransactionId = null;
            db.BankMutations.Add(m);
        }

        await db.SaveChangesAsync();

        foreach (var kv in parentOldIdMap)
        {
            if (bkuCloneMap.TryGetValue(kv.Value, out var clonedParent))
            {
                kv.Key.ParentBkuId = clonedParent.Id;
                kv.Key.ParentNomorBku = clonedParent.NomorBku;
            }
        }
        await db.SaveChangesAsync();
    }

    public static List<MasterPeriode> BuildDefaultMasterPeriodes(params int[] extraYears)
    {
        var years = new HashSet<int> { 2025, 2026 };
        foreach (var y in extraYears)
        {
            if (y >= 2020 && y <= 2100) years.Add(y);
        }

        var list = new List<MasterPeriode>();
        foreach (var tahun in years.OrderBy(y => y))
        {
            list.Add(new MasterPeriode { TahunAnggaran = tahun, SumberDana = "BOS", KodePeriode = "01", NamaPeriode = $"Tahap 1 (Januari - Juni {tahun})", BulanMulai = 1, BulanSelesai = 6, BatasPengajuanBelanja = new DateTime(tahun, 6, 25, 23, 59, 0, DateTimeKind.Utc), IsActive = true });
            list.Add(new MasterPeriode { TahunAnggaran = tahun, SumberDana = "BOS", KodePeriode = "02", NamaPeriode = $"Tahap 2 (Juli - Desember {tahun})", BulanMulai = 7, BulanSelesai = 12, BatasPengajuanBelanja = new DateTime(tahun, 12, 20, 23, 59, 0, DateTimeKind.Utc), IsActive = true });
            list.Add(new MasterPeriode { TahunAnggaran = tahun, SumberDana = "BOP", KodePeriode = "TW1", NamaPeriode = $"Triwulan I (Januari - Maret {tahun})", BulanMulai = 1, BulanSelesai = 3, BatasPengajuanBelanja = new DateTime(tahun, 3, 25, 23, 59, 0, DateTimeKind.Utc), IsActive = true });
            list.Add(new MasterPeriode { TahunAnggaran = tahun, SumberDana = "BOP", KodePeriode = "TW2", NamaPeriode = $"Triwulan II (April - Juni {tahun})", BulanMulai = 4, BulanSelesai = 6, BatasPengajuanBelanja = new DateTime(tahun, 6, 25, 23, 59, 0, DateTimeKind.Utc), IsActive = true });
            list.Add(new MasterPeriode { TahunAnggaran = tahun, SumberDana = "BOP", KodePeriode = "TW3", NamaPeriode = $"Triwulan III (Juli - September {tahun})", BulanMulai = 7, BulanSelesai = 9, BatasPengajuanBelanja = new DateTime(tahun, 9, 25, 23, 59, 0, DateTimeKind.Utc), IsActive = true });
            list.Add(new MasterPeriode { TahunAnggaran = tahun, SumberDana = "BOP", KodePeriode = "TW4", NamaPeriode = $"Triwulan IV (Oktober - Desember {tahun})", BulanMulai = 10, BulanSelesai = 12, BatasPengajuanBelanja = new DateTime(tahun, 12, 20, 23, 59, 0, DateTimeKind.Utc), IsActive = true });
        }
        return list;
    }

    public static async Task EnsureMasterPeriodesCompleteAsync(SiapBosDbContext db, params int[] extraYears)
    {
        var existingKeys = (await db.MasterPeriodes
            .Select(p => new { p.TahunAnggaran, p.SumberDana, p.KodePeriode })
            .ToListAsync())
            .Select(p => $"{p.TahunAnggaran}|{p.SumberDana}|{p.KodePeriode}")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var missing = BuildDefaultMasterPeriodes(extraYears)
            .Where(p => !existingKeys.Contains($"{p.TahunAnggaran}|{p.SumberDana}|{p.KodePeriode}"))
            .ToList();

        if (missing.Count > 0)
        {
            db.MasterPeriodes.AddRange(missing);
            await db.SaveChangesAsync();
        }
    }

    private static async Task RemoveObsoleteHelpDeskMenusAsync(SiapBosDbContext db)
    {
        var obsoleteLinks = new[] { "help-pembayaran-bos", "help-pembayaran-bop", "help-va-pln", "konfirmasi-rekening" };
        var obsoleteMenus = await db.AppMenus
            .Where(m => m.KodeAplikasi == "ADMN" && obsoleteLinks.Contains(m.Link))
            .ToListAsync();

        var modAdmn = await db.AppModules.FirstOrDefaultAsync(m => m.KodeAplikasi == "ADMN");
        if (modAdmn != null)
        {
            modAdmn.Deskripsi = "Batas Pengajuan Belanja, Migrasi RKAS & Dropping Dana BOS & BOP";
        }

        if (obsoleteMenus.Count == 0 && modAdmn == null)
            return;

        if (obsoleteMenus.Count > 0)
        {
            var obsoleteIds = obsoleteMenus.Select(m => m.Id).ToList();
            var obsoleteRoleMappings = await db.AppOtoritasMenus
                .Where(om => obsoleteIds.Contains(om.MenuId))
                .ToListAsync();

            if (obsoleteRoleMappings.Count > 0)
                db.AppOtoritasMenus.RemoveRange(obsoleteRoleMappings);

            db.AppMenus.RemoveRange(obsoleteMenus);
            await db.SaveChangesAsync();
        }

        // Rapikan urutan sub-menu Administrator & hapus akses modul ADMN yang kini kosong
        var remainingAdmnMenus = await db.AppMenus
            .Where(m => m.KodeAplikasi == "ADMN")
            .OrderBy(m => m.SortOrder)
            .ThenBy(m => m.Id)
            .ToListAsync();

        for (int i = 0; i < remainingAdmnMenus.Count; i++)
        {
            remainingAdmnMenus[i].SortOrder = i + 1;
        }

        if (modAdmn != null)
        {
            var remainingAdmnMenuIds = remainingAdmnMenus.Select(m => m.Id).ToHashSet();
            var rolesWithAdmnModule = await db.AppOtoritasAplikasis
                .Where(oa => oa.ModuleId == modAdmn.Id)
                .ToListAsync();

            var activeAdmnRoleIds = await db.AppOtoritasMenus
                .Where(om => remainingAdmnMenuIds.Contains(om.MenuId))
                .Select(om => om.RoleId)
                .Distinct()
                .ToListAsync();

            var activeSet = activeAdmnRoleIds.ToHashSet();
            var emptyModuleGrants = rolesWithAdmnModule.Where(oa => !activeSet.Contains(oa.RoleId)).ToList();
            if (emptyModuleGrants.Count > 0)
                db.AppOtoritasAplikasis.RemoveRange(emptyModuleGrants);
        }

        await db.SaveChangesAsync();
    }

    private static async Task EnsureAdminGrantedModuleMenusAsync(SiapBosDbContext db)
    {
        var adminRole = await db.AppRoles.FirstOrDefaultAsync(r => r.RoleCode == SiapBosRoles.AdminTdi);
        if (adminRole == null) return;

        var grantedCodes = await db.AppOtoritasAplikasis
            .Include(oa => oa.Module)
            .Where(oa => oa.RoleId == adminRole.Id && oa.Module != null)
            .Select(oa => oa.Module!.KodeAplikasi)
            .Distinct()
            .ToListAsync();

        if (grantedCodes.Count == 0) return;

        var codesWithMenus = await db.AppOtoritasMenus
            .Include(om => om.Menu)
            .Where(om => om.RoleId == adminRole.Id && om.Menu != null)
            .Select(om => om.Menu!.KodeAplikasi)
            .Distinct()
            .ToListAsync();

        var missingMenuCodes = grantedCodes
            .Where(code => !codesWithMenus.Contains(code))
            .ToList();

        if (missingMenuCodes.Count == 0) return;

        var menusToRestore = await db.AppMenus
            .Where(mn => mn.IsActive && missingMenuCodes.Contains(mn.KodeAplikasi))
            .Select(mn => mn.Id)
            .ToListAsync();

        foreach (var menuId in menusToRestore)
        {
            db.AppOtoritasMenus.Add(new AppOtoritasMenu
            {
                RoleId = adminRole.Id,
                MenuId = menuId,
                CreatedBy = "SEED-RESTORE"
            });
        }

        if (menusToRestore.Count > 0)
            await db.SaveChangesAsync();
    }
}
