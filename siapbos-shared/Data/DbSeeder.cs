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
                    + (CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'siap' AND table_name = 'trbatal_transfer_spj') THEN 0 ELSE 1 END);";
            var flag = Convert.ToInt32(await cmd.ExecuteScalarAsync());
            if (flag > 0)
            {
                needsRecreate = true;
            }
            else if (!await db.AppRoles.AnyAsync(r => r.RoleCode == SiapBosRoles.AdminTdi) ||
                     !await db.AppUsers.AnyAsync(u => u.Username == "ADMIN-TDI") ||
                     !await db.AppOtoritasMenus.AnyAsync() ||
                     !await db.BatalTransferSpjs.AnyAsync() ||
                     await db.BkuTransactions.AnyAsync(b => b.KodeTrx == "JG" || b.KodeTrx == "LL" || b.KodeTrx == "ST") ||
                     await db.AppMenus.AnyAsync(m =>
                         m.Link == "bap-kas-bos" ||
                         m.Link == "bap-kas" ||
                         m.Link == "cetak-setor" ||
                         m.Link == "cetak-setoran" ||
                         m.Link == "setor-sisa-belanja" ||
                         m.Link == "input-bku-koreksi-tahun-lalu"))
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
        var modAdmn = new AppModule { KodeAplikasi = "ADMN", Nama = "Administrator", Link = "administrator", Deskripsi = "Batas Pengajuan Belanja, Help Desk Pembayaran BOSP/BOP, VA PLN & Migrasi RKAS", Icon = "bi-sliders2-vertical", SortOrder = 4, IsActive = true };
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

        // BKU BOSP Negeri (BOS) - Bersih dari 6 menu tereliminasi Bagian II
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
        var bosBatalTf        = new AppMenu { KodeAplikasi = "BOS", Nama = "Batal Transfer BKU BOSP",              Link = "batal-transfer-spj",         Icon = "bi-x-octagon",           RequiresSekolah = true,  SortOrder = 11 };
        var bosApproveBatal   = new AppMenu { KodeAplikasi = "BOS", Nama = "Persetujuan Batal Transfer BKU BOSP",  Link = "persetujuan-batal-tf-spj",   Icon = "bi-shield-check",        RequiresSekolah = true,  SortOrder = 12 };
        var bosTutup          = new AppMenu { KodeAplikasi = "BOS", Nama = "Tutup BKU",                            Link = "tutup-bku",                  Icon = "bi-lock-fill",           RequiresSekolah = true,  SortOrder = 13 };
        var bosBatalTutup     = new AppMenu { KodeAplikasi = "BOS", Nama = "Batal Tutup BKU",                      Link = "batal-tutup-bku",            Icon = "bi-unlock-fill",         RequiresSekolah = true,  SortOrder = 14 };
        var bosMutasi12       = new AppMenu { KodeAplikasi = "BOS", Nama = "Mutasi 12 Transaksi BOSP",             Link = "bos-mutasi-12",              Icon = "bi-clock-history",       RequiresSekolah = true,  SortOrder = 15 };
        var bosMutasiAll      = new AppMenu { KodeAplikasi = "BOS", Nama = "Mutasi Semua Transaksi BOSP",          Link = "bos-mutasi-semua",           Icon = "bi-bank",                RequiresSekolah = true,  SortOrder = 16 };
        var bosLaporan        = new AppMenu { KodeAplikasi = "BOS", Nama = "Laporan BKU BOSP",                     Link = "laporan-BKU",                Icon = "bi-file-earmark-pdf",    RequiresSekolah = true,  SortOrder = 17 };
        var bosMonitoring     = new AppMenu { KodeAplikasi = "BOS", Nama = "Laporan Monitoring Dinas (BOSP)",      Link = "laporan-monitoring-dinas",   Icon = "bi-bar-chart-line",      RequiresSekolah = false, SortOrder = 18 };

        var bosMenus = new List<AppMenu>
        {
            bosDashboard, bosDropSekolah, bosDropDinas, bosInput, bosPengajuan, bosApproveTu,
            bosApprovePa, bosToken, bosBayar, bosPajak, bosBatalTf, bosApproveBatal,
            bosTutup, bosBatalTutup, bosMutasi12, bosMutasiAll, bosLaporan, bosMonitoring
        };

        // BKU BOP Negeri (BOP) - Bersih dari 5 menu tereliminasi Bagian II
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
        var bopBatalTf        = new AppMenu { KodeAplikasi = "BOP", Nama = "Batal Transfer BKU BOP",              Link = "batal-transfer-spj",           Icon = "bi-x-octagon",           RequiresSekolah = true,  SortOrder = 12 };
        var bopApproveBatal   = new AppMenu { KodeAplikasi = "BOP", Nama = "Persetujuan Batal Transfer BKU BOP",  Link = "persetujuan-batal-tf-spj",     Icon = "bi-shield-check",        RequiresSekolah = true,  SortOrder = 13 };
        var bopTutup          = new AppMenu { KodeAplikasi = "BOP", Nama = "Tutup BKU",                           Link = "tutup-bku",                    Icon = "bi-lock-fill",           RequiresSekolah = true,  SortOrder = 14 };
        var bopBatalTutup     = new AppMenu { KodeAplikasi = "BOP", Nama = "Batal Tutup BKU",                     Link = "batal-tutup-bku",              Icon = "bi-unlock-fill",         RequiresSekolah = true,  SortOrder = 15 };
        var bopMutasi12       = new AppMenu { KodeAplikasi = "BOP", Nama = "Mutasi 12 Transaksi",                 Link = "mutasi-transfer-12-transaksi", Icon = "bi-clock-history",       RequiresSekolah = true,  SortOrder = 16 };
        var bopMutasiAll      = new AppMenu { KodeAplikasi = "BOP", Nama = "Mutasi Semua Transaksi BOP",          Link = "bop-mutasi-semua",             Icon = "bi-bank",                RequiresSekolah = true,  SortOrder = 17 };
        var bopLaporan        = new AppMenu { KodeAplikasi = "BOP", Nama = "Laporan BKU BOP",                     Link = "laporan-BKU",                  Icon = "bi-file-earmark-pdf",    RequiresSekolah = true,  SortOrder = 18 };
        var bopMonitoring     = new AppMenu { KodeAplikasi = "BOP", Nama = "Laporan Monitoring Sudin (BOP)",      Link = "laporan-monitoring-sudin",     Icon = "bi-bar-chart-line",      RequiresSekolah = false, SortOrder = 19 };

        var bopMenus = new List<AppMenu>
        {
            bopDashboard, bopNpdDraft, bopNpdAjukan, bopNpdApprove, bopInput, bopPengajuan,
            bopApproveTu, bopApprovePa, bopToken, bopBayar, bopPajak, bopBatalTf,
            bopApproveBatal, bopTutup, bopBatalTutup, bopMutasi12, bopMutasiAll, bopLaporan, bopMonitoring
        };

        // Administrator (ADMN)
        var admnBatas    = new AppMenu { KodeAplikasi = "ADMN", Nama = "Batas Pengajuan Belanja",         Link = "batas-pengajuan-belanja-list-opd", Icon = "bi-calendar-range",         RequiresSekolah = false, SortOrder = 1 };
        var admnHelpBos  = new AppMenu { KodeAplikasi = "ADMN", Nama = "Help Desk Pembayaran BKU BOSP",   Link = "help-pembayaran-bos",              Icon = "bi-life-preserver",         RequiresSekolah = true,  SortOrder = 2 };
        var admnHelpBop  = new AppMenu { KodeAplikasi = "ADMN", Nama = "Help Desk Pembayaran BKU BOP",    Link = "help-pembayaran-bop",              Icon = "bi-headset",                RequiresSekolah = true,  SortOrder = 3 };
        var admnHelpPln  = new AppMenu { KodeAplikasi = "ADMN", Nama = "Help Desk Virtual Account PLN",   Link = "help-va-pln",                      Icon = "bi-lightning-charge",       RequiresSekolah = true,  SortOrder = 4 };
        var admnMigrasi  = new AppMenu { KodeAplikasi = "ADMN", Nama = "Migrasi RKAS",                    Link = "konversi-data",                    Icon = "bi-file-earmark-spreadsheet", RequiresSekolah = true, SortOrder = 5 };
        var admnDrop     = new AppMenu { KodeAplikasi = "ADMN", Nama = "Dropping Dana BOS & BOP",         Link = "dropping-dana",                    Icon = "bi-send-check",             RequiresSekolah = false, SortOrder = 6 };
        var admnKonfRek  = new AppMenu { KodeAplikasi = "ADMN", Nama = "Konfirmasi Saldo Rekening",       Link = "konfirmasi-rekening",              Icon = "bi-bank2",                  RequiresSekolah = true,  SortOrder = 7 };

        var admnMenus = new List<AppMenu>
        {
            admnBatas, admnHelpBos, admnHelpBop, admnHelpPln, admnMigrasi, admnDrop, admnKonfRek
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

        // 4.2 Bendahara Sekolah / Pemegang Kas (PK-NEGERI): 12 BOSP + 13 BOP + Help Desk
        GrantModuleMenus(rolePk, modBos, [
            bosDashboard, bosDropSekolah, bosInput, bosPengajuan, bosBayar, bosPajak,
            bosBatalTf, bosTutup, bosBatalTutup, bosMutasi12, bosMutasiAll, bosLaporan
        ]);
        GrantModuleMenus(rolePk, modBop, [
            bopDashboard, bopNpdDraft, bopNpdAjukan, bopInput, bopPengajuan, bopBayar,
            bopPajak, bopBatalTf, bopTutup, bopBatalTutup, bopMutasi12, bopMutasiAll, bopLaporan
        ]);
        GrantModuleMenus(rolePk, modHelp, helpMenus);

        // 4.3 Kepala Tata Usaha (TU-NEGERI): Persetujuan Pembayaran TU + Persetujuan Batal Transfer + Help Desk
        GrantModuleMenus(roleTu, modBos, [bosApproveTu, bosApproveBatal]);
        GrantModuleMenus(roleTu, modBop, [bopApproveTu, bopApproveBatal]);
        GrantModuleMenus(roleTu, modHelp, helpMenus);

        // 4.4 Pengguna Anggaran / Kepala Sekolah (PA-NEGERI): Token, Persetujuan PA, NPD, Batal TF, Mutasi & Laporan + Help Desk
        GrantModuleMenus(rolePa, modBos, [bosToken, bosApprovePa, bosApproveBatal, bosMutasi12, bosMutasiAll, bosLaporan]);
        GrantModuleMenus(rolePa, modBop, [bopToken, bopNpdApprove, bopApprovePa, bopApproveBatal, bopMutasi12, bopMutasiAll, bopLaporan]);
        GrantModuleMenus(rolePa, modHelp, helpMenus);

        // 4.5 Suku Dinas Pendidikan Wilayah (SUDIN): BOP/APBD + Help Desk Pembayaran BKU BOP & VA PLN + Help Desk
        GrantModuleMenus(roleSudin, modBop, [bopNpdApprove, bopApproveBatal, bopMonitoring, bopLaporan, bopMutasi12, bopMutasiAll]);
        GrantModuleMenus(roleSudin, modAdmn, [admnHelpBop, admnHelpPln]);
        GrantModuleMenus(roleSudin, modHelp, helpMenus);

        // 4.6 Dinas Pendidikan Provinsi DKI Jakarta (ADMIN-DINAS): BOSP/APBN + Help Desk Pembayaran BKU BOSP & VA PLN + Help Desk
        GrantModuleMenus(roleDinas, modBos, [bosDropDinas, bosApproveBatal, bosMonitoring, bosLaporan, bosMutasi12, bosMutasiAll]);
        GrantModuleMenus(roleDinas, modAdmn, [admnHelpBos, admnHelpPln]);
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
            SaldoBos = 450000000m,
            NoRekBop = "1110007654321",
            NamaRekBop = "BOP SMAN 1 JAKARTA",
            SaldoAwalBop = 0m,
            SaldoBop = 320000000m,
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
            SaldoBos = 275000000m,
            NoRekBop = "1110005556667",
            NamaRekBop = "BOP SMPN 115 JAKARTA",
            SaldoAwalBop = 0m,
            SaldoBop = 190000000m,
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
            SaldoBos = 180000000m,
            NoRekBop = "1110009998882",
            NamaRekBop = "BOP SDN MENTENG 01 PAGI",
            SaldoAwalBop = 0m,
            SaldoBop = 140000000m,
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
        db.MasterPeriodes.AddRange(
            new MasterPeriode { TahunAnggaran = 2025, SumberDana = "BOS", KodePeriode = "01", NamaPeriode = "Tahap 1 (Januari - Juni 2025)", BulanMulai = 1, BulanSelesai = 6, BatasPengajuanBelanja = new DateTime(2025, 6, 25, 23, 59, 0, DateTimeKind.Utc), IsActive = true },
            new MasterPeriode { TahunAnggaran = 2025, SumberDana = "BOS", KodePeriode = "02", NamaPeriode = "Tahap 2 (Juli - Desember 2025)", BulanMulai = 7, BulanSelesai = 12, BatasPengajuanBelanja = new DateTime(2025, 12, 20, 23, 59, 0, DateTimeKind.Utc), IsActive = true },
            new MasterPeriode { TahunAnggaran = 2025, SumberDana = "BOP", KodePeriode = "TW1", NamaPeriode = "Triwulan I (Januari - Maret 2025)", BulanMulai = 1, BulanSelesai = 3, BatasPengajuanBelanja = new DateTime(2025, 3, 25, 23, 59, 0, DateTimeKind.Utc), IsActive = true },
            new MasterPeriode { TahunAnggaran = 2025, SumberDana = "BOP", KodePeriode = "TW2", NamaPeriode = "Triwulan II (April - Juni 2025)", BulanMulai = 4, BulanSelesai = 6, BatasPengajuanBelanja = new DateTime(2025, 6, 25, 23, 59, 0, DateTimeKind.Utc), IsActive = true },
            new MasterPeriode { TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01", NamaPeriode = "Tahap 1 (Januari - Juni 2026)", BulanMulai = 1, BulanSelesai = 6, BatasPengajuanBelanja = new DateTime(2026, 6, 25, 23, 59, 0, DateTimeKind.Utc), IsActive = true },
            new MasterPeriode { TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "02", NamaPeriode = "Tahap 2 (Juli - Desember 2026)", BulanMulai = 7, BulanSelesai = 12, BatasPengajuanBelanja = new DateTime(2026, 12, 20, 23, 59, 0, DateTimeKind.Utc), IsActive = true },
            new MasterPeriode { TahunAnggaran = 2026, SumberDana = "BOP", KodePeriode = "TW1", NamaPeriode = "Triwulan I (Januari - Maret 2026)", BulanMulai = 1, BulanSelesai = 3, BatasPengajuanBelanja = new DateTime(2026, 3, 25, 23, 59, 0, DateTimeKind.Utc), IsActive = true },
            new MasterPeriode { TahunAnggaran = 2026, SumberDana = "BOP", KodePeriode = "TW2", NamaPeriode = "Triwulan II (April - Juni 2026)", BulanMulai = 4, BulanSelesai = 6, BatasPengajuanBelanja = new DateTime(2026, 6, 25, 23, 59, 0, DateTimeKind.Utc), IsActive = true }
        );

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
            TotalPagu = 25000000m, TotalRealisasi = 16650000m
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
            TotalPagu = 36000000m, TotalRealisasi = 9000000m
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
            TotalPagu = 15000000m, TotalRealisasi = 8500000m
        };
        var rkasSmpPln = new RkasItem
        {
            SekolahId = smpn115.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01",
            KodeSnp = "06", NamaSnp = "Pengembangan Standar Pengelolaan",
            KodeKegiatan = "06.07.01", NamaKegiatan = "Pembayaran Langganan Daya dan Jasa",
            KodeAkun = "5.1.02.02.01.0061", NamaAkun = "Belanja Tagihan Listrik (PLN)",
            KodeKomponen = "SMP-PLN-002", NamaKomponen = "Tagihan Listrik & Internet SMPN 115",
            Spesifikasi = "Daya 66 kVA", Satuan = "Bulan", Volume = 6, HargaSatuan = 5500000m,
            TotalPagu = 33000000m, TotalRealisasi = 5500000m
        };
        var rkasSmpBopHonor = new RkasItem
        {
            SekolahId = smpn115.Id, TahunAnggaran = 2026, SumberDana = "BOP", KodePeriode = "TW1",
            KodeSnp = "04", NamaSnp = "Pengembangan Pendidik dan Tenaga Kependidikan",
            KodeKegiatan = "04.06.01", NamaKegiatan = "Pengembangan Kompetensi Guru SMPN 115",
            KodeAkun = "5.1.02.02.01.0003", NamaAkun = "Honorarium Narasumber / Tenaga Ahli Kegiatan Sekolah",
            KodeKomponen = "SMP-BOP-001", NamaKomponen = "Honorarium Narasumber Pelatihan Literasi",
            Spesifikasi = "Tarif DKI", Satuan = "OJ", Volume = 20, HargaSatuan = 800000m,
            TotalPagu = 16000000m, TotalRealisasi = 6400000m
        };
        var rkasSdnBuku = new RkasItem
        {
            SekolahId = sdnMenteng01.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01",
            KodeSnp = "02", NamaSnp = "Pengembangan Standar Isi",
            KodeKegiatan = "02.02.01", NamaKegiatan = "Pengembangan Perpustakaan SDN Menteng 01",
            KodeAkun = "5.1.02.01.01.0024", NamaAkun = "Belanja Buku Bacaan & Referensi Perpustakaan",
            KodeKomponen = "SDN-BUKU-001", NamaKomponen = "Paket Buku Pengayaan & Modul Kurikulum Merdeka",
            Spesifikasi = "Paket SD Lengkap", Satuan = "Paket", Volume = 20, HargaSatuan = 1200000m,
            TotalPagu = 24000000m, TotalRealisasi = 6000000m
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
            TotalPagu = 12000000m, TotalRealisasi = 5000000m
        };

        db.RkasItems.AddRange(
            rkasAtk, rkasAc, rkasPln, rkasKonsumsi, rkasLaptop, rkasBopHonor, rkasBopPln,
            rkasSmpAtk, rkasSmpPln, rkasSmpBopHonor,
            rkasSdnBuku, rkasSdnKonsumsi, rkasSdnBopKebersihan);
        await db.SaveChangesAsync();

        // 7. Seed BKU Transactions for SMAN 1 Jakarta (BOS & BOP)
        // BKU 1 (JO): Dropping BOS Tahap 1 = Rp 466.650.000 masuk, lalu dibelanjakan BKU 2 Rp 16.650.000 => Saldo BOS saat ini Rp 450.000.000!
        var bkuJoBos = new BkuTransaction
        {
            SekolahId = sman1.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01", Bulan = 1,
            NomorBku = "BKU-BOS-2026-0001", NomorBukti = "SP2D/KEMENDIKBUD/BOS/2026/0112",
            TanggalTransaksi = new DateTime(2026, 1, 18, 9, 0, 0, DateTimeKind.Utc),
            KodeTrx = KodeTrxBku.Dropping, JenisPembayaran = JenisPembayaranBku.NonTransfer,
            Uraian = "Penerimaan Penyaluran (Dropping) Dana BOSP Tahap 1 Tahun 2026",
            NilaiBrutoMasuk = 466650000m, NilaiBrutoKeluar = 0m, TotalPotonganPajak = 0m, NilaiNettoTransfer = 0m,
            NamaRekanan = "KAS NEGARA / KPPN JAKARTA II", NamaBankRekanan = "Bank DKI", NoRekRekanan = sman1.NoRekBos,
            StatusBku = StatusBkuFlow.LunasTransfer, StatusTransferBank = "00",
            NoJurnalBank = "JRN-DKI-20260118001", TanggalTransferBank = new DateTime(2026, 1, 18, 9, 5, 0, DateTimeKind.Utc),
            CreatedBy = "SYSTEM-DROPPING", CreatedAt = new DateTime(2026, 1, 18, 9, 0, 0, DateTimeKind.Utc)
        };
        db.BkuTransactions.Add(bkuJoBos);
        await db.SaveChangesAsync();

        // BKU 2 (JJ - Lunas Transfer CMS & Lunas Pajak NTPN)
        var bkuLunas = new BkuTransaction
        {
            SekolahId = sman1.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01", Bulan = 2,
            NomorBku = "BKU-BOS-2026-0002", NomorBukti = "INV/EORD/2026/00451",
            TanggalTransaksi = new DateTime(2026, 2, 10, 10, 30, 0, DateTimeKind.Utc),
            KodeTrx = KodeTrxBku.BelanjaSpj, JenisPembayaran = JenisPembayaranBku.EOrder,
            Uraian = "Pengadaan Kertas HVS A4, Tinta Printer & ATK Kantor Semester Genap via e-Order",
            NilaiBrutoMasuk = 0m, NilaiBrutoKeluar = 16650000m, TotalPotonganPajak = 1875000m, NilaiNettoTransfer = 14775000m,
            NamaRekanan = "CV. GRAHA PUSTAKA NUSANTARA", KodeBankRekanan = "111", NamaBankRekanan = "Bank DKI",
            NoRekRekanan = "1110099887766", NamaPemilikRekRekanan = "CV. GRAHA PUSTAKA NUSANTARA",
            NpwpRekanan = "01.345.678.9-022.000", NamaWpRekanan = "CV. GRAHA PUSTAKA NUSANTARA",
            NoVaAtauPesanan = "EORD-DKI-2026-00451",
            FileLampiranName = "Invoice_ATK_CV_GrahaPustaka.pdf", FileLampiranPath = "/uploader/api/v1/minio/preview/sample-invoice-atk.pdf",
            StatusBku = StatusBkuFlow.LunasTransfer,
            CatatanVerifikasi = "Dokumen lengkap sesuai kontrak e-Order dan faktur pajak tervalidasi.",
            SubmittedAt = new DateTime(2026, 2, 10, 11, 0, 0, DateTimeKind.Utc),
            ApprovedByTuAt = new DateTime(2026, 2, 10, 13, 0, 0, DateTimeKind.Utc),
            ApprovedByPaAt = new DateTime(2026, 2, 10, 14, 0, 0, DateTimeKind.Utc),
            TokenOtpPa = "482910", TokenCreatedByNrk = sman1.NrkKepalaSekolah,
            TokenExpiredAt = new DateTime(2026, 2, 10, 15, 0, 0, DateTimeKind.Utc),
            NoJurnalBank = "JRN-DKI-20260210088", TanggalTransferBank = new DateTime(2026, 2, 10, 14, 15, 0, DateTimeKind.Utc),
            StatusTransferBank = "00", CreatedBy = "bendahara.sman1"
        };
        bkuLunas.DetailItems.Add(new BkuDetailItem
        {
            RkasItemId = rkasAtk.Id, KodeKegiatan = rkasAtk.KodeKegiatan, NamaKegiatan = rkasAtk.NamaKegiatan,
            KodeAkun = rkasAtk.KodeAkun, NamaAkun = rkasAtk.NamaAkun,
            KodeKomponen = rkasAtk.KodeKomponen, NamaKomponen = rkasAtk.NamaKomponen, Spesifikasi = rkasAtk.Spesifikasi,
            Volume = 6.66m, Satuan = rkasAtk.Satuan, HargaSatuan = 2500000m, Jumlah = 16650000m
        });
        bkuLunas.TaxItems.Add(new BkuTaxItem
        {
            KodeTrxPajak = "P5", NamaPajak = "PPN (Pajak Pertambahan Nilai 11%)", KodeMap = "411211", KodeJenisSetoran = "920",
            MasaPajak = "02", TahunPajak = 2026, DasarPengenaanPajak = 15000000m, TarifPersen = 11m, NilaiPajak = 1650000m,
            KodeBilling = "820260210482910", BillingCreatedAt = new DateTime(2026, 2, 10, 14, 20, 0, DateTimeKind.Utc),
            BillingExpiredAt = new DateTime(2026, 3, 12, 14, 20, 0, DateTimeKind.Utc),
            Ntpn = "A7B92026DKI00124", Ntb = "000129384712", TanggalLunasPajak = new DateTime(2026, 2, 10, 14, 25, 0, DateTimeKind.Utc),
            StatusPajak = StatusPajakFlow.LunasNtpn
        });
        bkuLunas.TaxItems.Add(new BkuTaxItem
        {
            KodeTrxPajak = "P2", NamaPajak = "PPh Pasal 22 (Pembelian Barang > Rp 2 Juta)", KodeMap = "411122", KodeJenisSetoran = "920",
            MasaPajak = "02", TahunPajak = 2026, DasarPengenaanPajak = 15000000m, TarifPersen = 1.5m, NilaiPajak = 225000m,
            KodeBilling = "820260210482911", BillingCreatedAt = new DateTime(2026, 2, 10, 14, 21, 0, DateTimeKind.Utc),
            BillingExpiredAt = new DateTime(2026, 3, 12, 14, 21, 0, DateTimeKind.Utc),
            Ntpn = "C4D12026DKI00125", Ntb = "000129384713", TanggalLunasPajak = new DateTime(2026, 2, 10, 14, 26, 0, DateTimeKind.Utc),
            StatusPajak = StatusPajakFlow.LunasNtpn
        });

        // BKU 3 (JJ - Disetujui PA => Siap Demo Permohonan Token & Transfer Bank DKI + Bayar Pajak!)
        var bkuSiapBayar = new BkuTransaction
        {
            SekolahId = sman1.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01", Bulan = 3,
            NomorBku = "BKU-BOS-2026-0003", NomorBukti = "KW/TEKNIK/2026/019",
            TanggalTransaksi = new DateTime(2026, 3, 5, 11, 0, 0, DateTimeKind.Utc),
            KodeTrx = KodeTrxBku.BelanjaSpj, JenisPembayaran = JenisPembayaranBku.Transfer,
            Uraian = "Jasa Servis, Cuci & Isi Freon 20 Unit AC Ruang Kelas SMAN 1",
            NilaiBrutoMasuk = 0m, NilaiBrutoKeluar = 7000000m, TotalPotonganPajak = 140000m, NilaiNettoTransfer = 6860000m,
            NamaRekanan = "PT. SEJUK PRIMA TEKNIK", KodeBankRekanan = "014", NamaBankRekanan = "Bank BCA",
            NoRekRekanan = "5400881234", NamaPemilikRekRekanan = "PT. SEJUK PRIMA TEKNIK",
            NpwpRekanan = "02.555.666.7-033.000", NamaWpRekanan = "PT. SEJUK PRIMA TEKNIK",
            FileLampiranName = "BA_Servis_AC_20Unit.pdf", FileLampiranPath = "/uploader/api/v1/minio/preview/sample-invoice-ac.pdf",
            StatusBku = StatusBkuFlow.DisetujuiPa,
            CatatanVerifikasi = "Disetujui PA. Silakan lanjutkan Permohonan Token Bank DKI & Transfer SPJ.",
            SubmittedAt = new DateTime(2026, 3, 5, 12, 0, 0, DateTimeKind.Utc),
            ApprovedByTuAt = new DateTime(2026, 3, 5, 13, 30, 0, DateTimeKind.Utc),
            ApprovedByPaAt = new DateTime(2026, 3, 5, 15, 0, 0, DateTimeKind.Utc),
            CreatedBy = "bendahara.sman1"
        };
        bkuSiapBayar.DetailItems.Add(new BkuDetailItem
        {
            RkasItemId = rkasAc.Id, KodeKegiatan = rkasAc.KodeKegiatan, NamaKegiatan = rkasAc.NamaKegiatan,
            KodeAkun = rkasAc.KodeAkun, NamaAkun = rkasAc.NamaAkun,
            KodeKomponen = rkasAc.KodeKomponen, NamaKomponen = rkasAc.NamaKomponen, Spesifikasi = rkasAc.Spesifikasi,
            Volume = 20, Satuan = rkasAc.Satuan, HargaSatuan = 350000m, Jumlah = 7000000m
        });
        bkuSiapBayar.TaxItems.Add(new BkuTaxItem
        {
            KodeTrxPajak = "P3", NamaPajak = "PPh Pasal 23 (Jasa Pemeliharaan/Sewa/Katering)", KodeMap = "411124", KodeJenisSetoran = "100",
            MasaPajak = "03", TahunPajak = 2026, DasarPengenaanPajak = 7000000m, TarifPersen = 2m, NilaiPajak = 140000m,
            StatusPajak = StatusPajakFlow.BelumBilling
        });

        // BKU 4 (JJ - Diajukan ke TU => Siap Demo Approval TU -> Approval PA!)
        var bkuMenungguTu = new BkuTransaction
        {
            SekolahId = sman1.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01", Bulan = 3,
            NomorBku = "BKU-BOS-2026-0004", NomorBukti = "PLN/VA/2026/03",
            TanggalTransaksi = new DateTime(2026, 3, 12, 9, 15, 0, DateTimeKind.Utc),
            KodeTrx = KodeTrxBku.BelanjaSpj, JenisPembayaran = JenisPembayaranBku.VaPln,
            Uraian = "Pembayaran Tagihan Rekening Listrik PLN Bulan Maret 2026 (VA PLN)",
            NilaiBrutoMasuk = 0m, NilaiBrutoKeluar = 9250000m, TotalPotonganPajak = 0m, NilaiNettoTransfer = 9250000m,
            NamaRekanan = "PT PLN (PERSERO) UID JAKARTA RAYA", KodeBankRekanan = "111", NamaBankRekanan = "Bank DKI Virtual Account",
            NoRekRekanan = "8801154300221109", NamaPemilikRekRekanan = "PLN UID JAYA - SMAN 1 JAKARTA",
            NpwpRekanan = "01.001.629.3-051.000", NamaWpRekanan = "PT PLN (PERSERO)",
            NoVaAtauPesanan = "541100229988",
            FileLampiranName = "Tagihan_PLN_Maret_2026.pdf", FileLampiranPath = "/uploader/api/v1/minio/preview/sample-invoice-pln.pdf",
            StatusBku = StatusBkuFlow.DiajukanTu,
            SubmittedAt = new DateTime(2026, 3, 12, 9, 30, 0, DateTimeKind.Utc),
            CreatedBy = "bendahara.sman1"
        };
        bkuMenungguTu.DetailItems.Add(new BkuDetailItem
        {
            RkasItemId = rkasPln.Id, KodeKegiatan = rkasPln.KodeKegiatan, NamaKegiatan = rkasPln.NamaKegiatan,
            KodeAkun = rkasPln.KodeAkun, NamaAkun = rkasPln.NamaAkun,
            KodeKomponen = rkasPln.KodeKomponen, NamaKomponen = rkasPln.NamaKomponen, Spesifikasi = rkasPln.Spesifikasi,
            Volume = 1, Satuan = "Bulan", HargaSatuan = 9250000m, Jumlah = 9250000m
        });

        // BKU 5 (JJ - Draft => Siap Demo Edit & Pengajuan PK)
        var bkuDraft = new BkuTransaction
        {
            SekolahId = sman1.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01", Bulan = 3,
            NomorBku = "BKU-BOS-2026-0005", NomorBukti = "INV/KONS/2026/077",
            TanggalTransaksi = new DateTime(2026, 3, 18, 10, 0, 0, DateTimeKind.Utc),
            KodeTrx = KodeTrxBku.BelanjaSpj, JenisPembayaran = JenisPembayaranBku.Transfer,
            Uraian = "Konsumsi Pelatihan Olimpiade Sains Nasional (OSN) Siswa SMAN 1",
            NilaiBrutoMasuk = 0m, NilaiBrutoKeluar = 4500000m, TotalPotonganPajak = 90000m, NilaiNettoTransfer = 4410000m,
            NamaRekanan = "CV. RASA NUSANTARA CATERING", KodeBankRekanan = "111", NamaBankRekanan = "Bank DKI",
            NoRekRekanan = "1110044556677", NamaPemilikRekRekanan = "CV. RASA NUSANTARA CATERING",
            NpwpRekanan = "03.777.888.9-012.000", NamaWpRekanan = "CV. RASA NUSANTARA CATERING",
            StatusBku = StatusBkuFlow.Draft,
            CreatedBy = "bendahara.sman1"
        };
        bkuDraft.DetailItems.Add(new BkuDetailItem
        {
            RkasItemId = rkasKonsumsi.Id, KodeKegiatan = rkasKonsumsi.KodeKegiatan, NamaKegiatan = rkasKonsumsi.NamaKegiatan,
            KodeAkun = rkasKonsumsi.KodeAkun, NamaAkun = rkasKonsumsi.NamaAkun,
            KodeKomponen = rkasKonsumsi.KodeKomponen, NamaKomponen = rkasKonsumsi.NamaKomponen, Spesifikasi = rkasKonsumsi.Spesifikasi,
            Volume = 100, Satuan = "Box", HargaSatuan = 45000m, Jumlah = 4500000m
        });
        bkuDraft.TaxItems.Add(new BkuTaxItem
        {
            KodeTrxPajak = "P3", NamaPajak = "PPh Pasal 23 (Jasa Pemeliharaan/Sewa/Katering)", KodeMap = "411124", KodeJenisSetoran = "100",
            MasaPajak = "03", TahunPajak = 2026, DasarPengenaanPajak = 4500000m, TarifPersen = 2m, NilaiPajak = 90000m,
            StatusPajak = StatusPajakFlow.BelumBilling
        });

        // BKU BOP (JO + JJ Lunas untuk SMAN 1)
        var bkuJoBop = new BkuTransaction
        {
            SekolahId = sman1.Id, TahunAnggaran = 2026, SumberDana = "BOP", KodePeriode = "TW1", Bulan = 1,
            NomorBku = "BKU-BOP-2026-0001", NomorBukti = "SP2D/BPKD-DKI/BOP/2026/0054",
            TanggalTransaksi = new DateTime(2026, 1, 22, 9, 0, 0, DateTimeKind.Utc),
            KodeTrx = KodeTrxBku.Dropping, JenisPembayaran = JenisPembayaranBku.NonTransfer,
            Uraian = "Pencairan Dropping Dana BOP Triwulan I Tahun 2026 (via SIPKD)",
            NilaiBrutoMasuk = 329000000m, NilaiBrutoKeluar = 0m, TotalPotonganPajak = 0m, NilaiNettoTransfer = 0m,
            NamaRekanan = "BPKD PROVINSI DKI JAKARTA", NamaBankRekanan = "Bank DKI", NoRekRekanan = sman1.NoRekBop,
            StatusBku = StatusBkuFlow.LunasTransfer, StatusTransferBank = "00",
            NoJurnalBank = "JRN-BOP-20260122001", TanggalTransferBank = new DateTime(2026, 1, 22, 9, 5, 0, DateTimeKind.Utc),
            CreatedBy = "SYSTEM-SIPKD"
        };

        var bkuBopHonor = new BkuTransaction
        {
            SekolahId = sman1.Id, TahunAnggaran = 2026, SumberDana = "BOP", KodePeriode = "TW1", Bulan = 2,
            NomorBku = "BKU-BOP-2026-0002", NomorBukti = "KW/BOP/2026/0011",
            TanggalTransaksi = new DateTime(2026, 2, 18, 13, 0, 0, DateTimeKind.Utc),
            KodeTrx = KodeTrxBku.BelanjaSpj, JenisPembayaran = JenisPembayaranBku.Transfer,
            Uraian = "Honorarium Narasumber Workshop Implementasi Kurikulum Merdeka",
            NilaiBrutoMasuk = 0m, NilaiBrutoKeluar = 9000000m, TotalPotonganPajak = 450000m, NilaiNettoTransfer = 8550000m,
            NamaRekanan = "DR. BUDI PRASETYO, M.PD", KodeBankRekanan = "111", NamaBankRekanan = "Bank DKI",
            NoRekRekanan = "1110077788899", NamaPemilikRekRekanan = "BUDI PRASETYO",
            NpwpRekanan = "44.112.233.4-001.000", NamaWpRekanan = "BUDI PRASETYO",
            StatusBku = StatusBkuFlow.LunasTransfer,
            ApprovedByTuAt = new DateTime(2026, 2, 18, 14, 0, 0, DateTimeKind.Utc),
            ApprovedByPaAt = new DateTime(2026, 2, 18, 15, 0, 0, DateTimeKind.Utc),
            NoJurnalBank = "JRN-BOP-20260218012", TanggalTransferBank = new DateTime(2026, 2, 18, 15, 30, 0, DateTimeKind.Utc),
            StatusTransferBank = "00", CreatedBy = "bendahara.sman1"
        };
        bkuBopHonor.DetailItems.Add(new BkuDetailItem
        {
            RkasItemId = rkasBopHonor.Id, KodeKegiatan = rkasBopHonor.KodeKegiatan, NamaKegiatan = rkasBopHonor.NamaKegiatan,
            KodeAkun = rkasBopHonor.KodeAkun, NamaAkun = rkasBopHonor.NamaAkun,
            KodeKomponen = rkasBopHonor.KodeKomponen, NamaKomponen = rkasBopHonor.NamaKomponen, Spesifikasi = rkasBopHonor.Spesifikasi,
            Volume = 10, Satuan = "OJ", HargaSatuan = 900000m, Jumlah = 9000000m
        });
        bkuBopHonor.TaxItems.Add(new BkuTaxItem
        {
            KodeTrxPajak = "P1", NamaPajak = "PPh Pasal 21 (Honorarium/Jasa Pribadi)", KodeMap = "411121", KodeJenisSetoran = "100",
            MasaPajak = "02", TahunPajak = 2026, DasarPengenaanPajak = 9000000m, TarifPersen = 5m, NilaiPajak = 450000m,
            KodeBilling = "820260218991122", BillingCreatedAt = new DateTime(2026, 2, 18, 15, 35, 0, DateTimeKind.Utc),
            BillingExpiredAt = new DateTime(2026, 3, 20, 15, 35, 0, DateTimeKind.Utc),
            Ntpn = "B9E42026DKI00771", Ntb = "000991122334", TanggalLunasPajak = new DateTime(2026, 2, 18, 15, 40, 0, DateTimeKind.Utc),
            StatusPajak = StatusPajakFlow.LunasNtpn
        });

        // BKU 6 (SMAN 1 - Lunas Transfer #2 agar selalu ada kandidat Batal Transfer SPJ selain BKU-0002)
        var bkuSmanLunas2 = new BkuTransaction
        {
            SekolahId = sman1.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01", Bulan = 2,
            NomorBku = "BKU-BOS-2026-0006", NomorBukti = "INV/BOOK/2026/088",
            TanggalTransaksi = new DateTime(2026, 2, 20, 11, 0, 0, DateTimeKind.Utc),
            KodeTrx = KodeTrxBku.BelanjaSpj, JenisPembayaran = JenisPembayaranBku.Transfer,
            Uraian = "Pengadaan Buku Referensi Olimpiade Sains Perpustakaan SMAN 1",
            NilaiBrutoMasuk = 0m, NilaiBrutoKeluar = 6200000m, TotalPotonganPajak = 93000m, NilaiNettoTransfer = 6107000m,
            NamaRekanan = "PT. ERLANGGA MAKMUR", KodeBankRekanan = "111", NamaBankRekanan = "Bank DKI",
            NoRekRekanan = "1110099887766", NamaPemilikRekRekanan = "PT. ERLANGGA MAKMUR",
            NpwpRekanan = "01.345.678.9-022.000", NamaWpRekanan = "PT. ERLANGGA MAKMUR",
            FileLampiranName = "Invoice_Buku_Olimpiade.pdf", FileLampiranPath = "/uploader/api/v1/minio/preview/sample-invoice-atk.pdf",
            StatusBku = StatusBkuFlow.LunasTransfer,
            SubmittedAt = new DateTime(2026, 2, 20, 11, 30, 0, DateTimeKind.Utc),
            ApprovedByTuAt = new DateTime(2026, 2, 20, 12, 30, 0, DateTimeKind.Utc),
            ApprovedByPaAt = new DateTime(2026, 2, 20, 13, 30, 0, DateTimeKind.Utc),
            NoJurnalBank = "JRN-DKI-20260220099", TanggalTransferBank = new DateTime(2026, 2, 20, 14, 0, 0, DateTimeKind.Utc),
            StatusTransferBank = "00", CreatedBy = "bendahara.sman1"
        };
        bkuSmanLunas2.DetailItems.Add(new BkuDetailItem
        {
            RkasItemId = rkasAtk.Id, KodeKegiatan = "02.02.01", NamaKegiatan = "Pengembangan Perpustakaan Sekolah",
            KodeAkun = rkasAtk.KodeAkun, NamaAkun = rkasAtk.NamaAkun,
            KodeKomponen = "KMP-BUKU-01", NamaKomponen = "Buku Referensi Olimpiade Sains", Spesifikasi = "Cetakan Baru",
            Volume = 20, Satuan = "Paket", HargaSatuan = 310000m, Jumlah = 6200000m
        });
        bkuSmanLunas2.TaxItems.Add(new BkuTaxItem
        {
            KodeTrxPajak = "P2", NamaPajak = "PPh Pasal 22 (Pembelian Barang > Rp 2 Juta)", KodeMap = "411122", KodeJenisSetoran = "920",
            MasaPajak = "02", TahunPajak = 2026, DasarPengenaanPajak = 6200000m, TarifPersen = 1.5m, NilaiPajak = 93000m,
            KodeBilling = "820260220112233", BillingCreatedAt = new DateTime(2026, 2, 20, 14, 5, 0, DateTimeKind.Utc),
            Ntpn = "D5F22026DKI00199", Ntb = "000129389900", TanggalLunasPajak = new DateTime(2026, 2, 20, 14, 10, 0, DateTimeKind.Utc),
            StatusPajak = StatusPajakFlow.LunasNtpn
        });

        // BKU SMPN 115 JAKARTA (BOS JO + JJ Lunas + JJ Draft, BOP JO + JJ Lunas)
        var bkuSmpJoBos = new BkuTransaction
        {
            SekolahId = smpn115.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01", Bulan = 1,
            NomorBku = "BKU-BOS-2026-0101", NomorBukti = "SP2D/KEMENDIKBUD/BOS/2026/0215",
            TanggalTransaksi = new DateTime(2026, 1, 20, 9, 0, 0, DateTimeKind.Utc),
            KodeTrx = KodeTrxBku.Dropping, JenisPembayaran = JenisPembayaranBku.NonTransfer,
            Uraian = "Penerimaan Dropping Dana BOSP Tahap 1 SMPN 115 Jakarta",
            NilaiBrutoMasuk = 289000000m, NamaRekanan = "KAS NEGARA / KPPN JAKARTA II",
            NamaBankRekanan = "Bank DKI", NoRekRekanan = smpn115.NoRekBos,
            StatusBku = StatusBkuFlow.LunasTransfer, StatusTransferBank = "00",
            NoJurnalBank = "JRN-SMP-20260120001", TanggalTransferBank = new DateTime(2026, 1, 20, 9, 5, 0, DateTimeKind.Utc),
            CreatedBy = "SYSTEM-DROPPING"
        };
        var bkuSmpBosLunas = new BkuTransaction
        {
            SekolahId = smpn115.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01", Bulan = 2,
            NomorBku = "BKU-BOS-2026-0102", NomorBukti = "INV/SMP115/2026/014",
            TanggalTransaksi = new DateTime(2026, 2, 14, 10, 0, 0, DateTimeKind.Utc),
            KodeTrx = KodeTrxBku.BelanjaSpj, JenisPembayaran = JenisPembayaranBku.Transfer,
            Uraian = "Pengadaan ATK & Cetak Naskah PTS Genap SMPN 115 Jakarta",
            NilaiBrutoKeluar = 8500000m, TotalPotonganPajak = 935000m, NilaiNettoTransfer = 7565000m,
            NamaRekanan = "CV. GRAHA PUSTAKA NUSANTARA", KodeBankRekanan = "111", NamaBankRekanan = "Bank DKI",
            NoRekRekanan = "1110099887766", NpwpRekanan = "01.345.678.9-022.000",
            StatusBku = StatusBkuFlow.LunasTransfer, NoJurnalBank = "JRN-SMP-20260214002", StatusTransferBank = "00",
            TanggalTransferBank = new DateTime(2026, 2, 14, 14, 0, 0, DateTimeKind.Utc),
            ApprovedByTuAt = new DateTime(2026, 2, 14, 11, 0, 0, DateTimeKind.Utc),
            ApprovedByPaAt = new DateTime(2026, 2, 14, 12, 0, 0, DateTimeKind.Utc),
            CreatedBy = "bendahara.smpn115"
        };
        bkuSmpBosLunas.DetailItems.Add(new BkuDetailItem
        {
            RkasItemId = rkasSmpAtk.Id, KodeKegiatan = rkasSmpAtk.KodeKegiatan, NamaKegiatan = rkasSmpAtk.NamaKegiatan,
            KodeAkun = rkasSmpAtk.KodeAkun, NamaAkun = rkasSmpAtk.NamaAkun, KodeKomponen = rkasSmpAtk.KodeKomponen,
            NamaKomponen = rkasSmpAtk.NamaKomponen, Spesifikasi = rkasSmpAtk.Spesifikasi, Volume = 5, Satuan = "Paket", HargaSatuan = 1700000m, Jumlah = 8500000m
        });
        bkuSmpBosLunas.TaxItems.Add(new BkuTaxItem
        {
            KodeTrxPajak = "P5", NamaPajak = "PPN (Pajak Pertambahan Nilai 11%)", KodeMap = "411211", KodeJenisSetoran = "920",
            MasaPajak = "02", TahunPajak = 2026, DasarPengenaanPajak = 8500000m, TarifPersen = 11m, NilaiPajak = 935000m,
            KodeBilling = "820260214556677", Ntpn = "S1B22026DKI00311", Ntb = "000129387711",
            TanggalLunasPajak = new DateTime(2026, 2, 14, 14, 15, 0, DateTimeKind.Utc), StatusPajak = StatusPajakFlow.LunasNtpn
        });
        var bkuSmpBosDraft = new BkuTransaction
        {
            SekolahId = smpn115.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01", Bulan = 3,
            NomorBku = "BKU-BOS-2026-0103", NomorBukti = "PLN/SMP115/2026/03",
            TanggalTransaksi = new DateTime(2026, 3, 12, 10, 0, 0, DateTimeKind.Utc),
            KodeTrx = KodeTrxBku.BelanjaSpj, JenisPembayaran = JenisPembayaranBku.VaPln,
            Uraian = "Tagihan Listrik Bulanan PLN SMPN 115 Jakarta",
            NilaiBrutoKeluar = 5500000m, TotalPotonganPajak = 0m, NilaiNettoTransfer = 5500000m,
            NamaRekanan = "PT PLN (PERSERO) UID JAYA", KodeBankRekanan = "111", NamaBankRekanan = "Bank DKI Virtual Account",
            NoRekRekanan = "8801154300998811", NoVaAtauPesanan = "541100998811",
            StatusBku = StatusBkuFlow.Draft, CreatedBy = "bendahara.smpn115"
        };
        bkuSmpBosDraft.DetailItems.Add(new BkuDetailItem
        {
            RkasItemId = rkasSmpPln.Id, KodeKegiatan = rkasSmpPln.KodeKegiatan, NamaKegiatan = rkasSmpPln.NamaKegiatan,
            KodeAkun = rkasSmpPln.KodeAkun, NamaAkun = rkasSmpPln.NamaAkun, KodeKomponen = rkasSmpPln.KodeKomponen,
            NamaKomponen = rkasSmpPln.NamaKomponen, Spesifikasi = rkasSmpPln.Spesifikasi, Volume = 1, Satuan = "Bulan", HargaSatuan = 5500000m, Jumlah = 5500000m
        });

        var bkuSmpJoBop = new BkuTransaction
        {
            SekolahId = smpn115.Id, TahunAnggaran = 2026, SumberDana = "BOP", KodePeriode = "TW1", Bulan = 1,
            NomorBku = "BKU-BOP-2026-0101", NomorBukti = "SP2D/BPKD-DKI/BOP/2026/0220",
            TanggalTransaksi = new DateTime(2026, 1, 25, 9, 0, 0, DateTimeKind.Utc),
            KodeTrx = KodeTrxBku.Dropping, JenisPembayaran = JenisPembayaranBku.NonTransfer,
            Uraian = "Pencairan Dropping Dana BOP Triwulan I SMPN 115 Jakarta",
            NilaiBrutoMasuk = 196400000m, NamaRekanan = "BPKD PROVINSI DKI JAKARTA", NamaBankRekanan = "Bank DKI", NoRekRekanan = smpn115.NoRekBop,
            StatusBku = StatusBkuFlow.LunasTransfer, StatusTransferBank = "00",
            NoJurnalBank = "JRN-SMPBOP-20260125", TanggalTransferBank = new DateTime(2026, 1, 25, 9, 5, 0, DateTimeKind.Utc),
            CreatedBy = "SYSTEM-SIPKD"
        };
        var bkuSmpBopLunas = new BkuTransaction
        {
            SekolahId = smpn115.Id, TahunAnggaran = 2026, SumberDana = "BOP", KodePeriode = "TW1", Bulan = 2,
            NomorBku = "BKU-BOP-2026-0102", NomorBukti = "KW/SMP-BOP/2026/005",
            TanggalTransaksi = new DateTime(2026, 2, 22, 13, 0, 0, DateTimeKind.Utc),
            KodeTrx = KodeTrxBku.BelanjaSpj, JenisPembayaran = JenisPembayaranBku.Transfer,
            Uraian = "Honorarium Narasumber Pelatihan Literasi Guru SMPN 115",
            NilaiBrutoKeluar = 6400000m, TotalPotonganPajak = 320000m, NilaiNettoTransfer = 6080000m,
            NamaRekanan = "DRS. H. SYAMSUDDIN, M.PD", KodeBankRekanan = "111", NamaBankRekanan = "Bank DKI",
            NoRekRekanan = "1110033445566", NpwpRekanan = "55.221.334.5-015.000",
            StatusBku = StatusBkuFlow.LunasTransfer, NoJurnalBank = "JRN-SMPBOP-20260222", StatusTransferBank = "00",
            TanggalTransferBank = new DateTime(2026, 2, 22, 14, 0, 0, DateTimeKind.Utc),
            ApprovedByTuAt = new DateTime(2026, 2, 22, 11, 0, 0, DateTimeKind.Utc),
            ApprovedByPaAt = new DateTime(2026, 2, 22, 12, 0, 0, DateTimeKind.Utc),
            CreatedBy = "bendahara.smpn115"
        };
        bkuSmpBopLunas.DetailItems.Add(new BkuDetailItem
        {
            RkasItemId = rkasSmpBopHonor.Id, KodeKegiatan = rkasSmpBopHonor.KodeKegiatan, NamaKegiatan = rkasSmpBopHonor.NamaKegiatan,
            KodeAkun = rkasSmpBopHonor.KodeAkun, NamaAkun = rkasSmpBopHonor.NamaAkun, KodeKomponen = rkasSmpBopHonor.KodeKomponen,
            NamaKomponen = rkasSmpBopHonor.NamaKomponen, Spesifikasi = rkasSmpBopHonor.Spesifikasi, Volume = 8, Satuan = "OJ", HargaSatuan = 800000m, Jumlah = 6400000m
        });
        bkuSmpBopLunas.TaxItems.Add(new BkuTaxItem
        {
            KodeTrxPajak = "P1", NamaPajak = "PPh Pasal 21 (Honorarium/Jasa Pribadi)", KodeMap = "411121", KodeJenisSetoran = "100",
            MasaPajak = "02", TahunPajak = 2026, DasarPengenaanPajak = 6400000m, TarifPersen = 5m, NilaiPajak = 320000m,
            StatusPajak = StatusPajakFlow.BelumBilling
        });

        // BKU SDN MENTENG 01 PAGI (BOS JO + JJ Lunas + JJ Diajukan TU, BOP JO + JJ Lunas)
        var bkuSdnJoBos = new BkuTransaction
        {
            SekolahId = sdnMenteng01.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01", Bulan = 1,
            NomorBku = "BKU-BOS-2026-0201", NomorBukti = "SP2D/KEMENDIKBUD/BOS/2026/0301",
            TanggalTransaksi = new DateTime(2026, 1, 21, 9, 0, 0, DateTimeKind.Utc),
            KodeTrx = KodeTrxBku.Dropping, JenisPembayaran = JenisPembayaranBku.NonTransfer,
            Uraian = "Penerimaan Dropping Dana BOSP Tahap 1 SDN Menteng 01 Pagi",
            NilaiBrutoMasuk = 186000000m, NamaRekanan = "KAS NEGARA / KPPN JAKARTA I",
            NamaBankRekanan = "Bank DKI", NoRekRekanan = sdnMenteng01.NoRekBos,
            StatusBku = StatusBkuFlow.LunasTransfer, StatusTransferBank = "00",
            NoJurnalBank = "JRN-SDN-20260121001", TanggalTransferBank = new DateTime(2026, 1, 21, 9, 5, 0, DateTimeKind.Utc),
            CreatedBy = "SYSTEM-DROPPING"
        };
        var bkuSdnBosLunas = new BkuTransaction
        {
            SekolahId = sdnMenteng01.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01", Bulan = 2,
            NomorBku = "BKU-BOS-2026-0202", NomorBukti = "INV/SDN01/2026/009",
            TanggalTransaksi = new DateTime(2026, 2, 16, 10, 0, 0, DateTimeKind.Utc),
            KodeTrx = KodeTrxBku.BelanjaSpj, JenisPembayaran = JenisPembayaranBku.Transfer,
            Uraian = "Pengadaan Buku Pengayaan & Modul Kurikulum Merdeka SDN Menteng 01",
            NilaiBrutoKeluar = 6000000m, TotalPotonganPajak = 90000m, NilaiNettoTransfer = 5910000m,
            NamaRekanan = "PT. BALAI PUSTAKA JAKARTA", KodeBankRekanan = "111", NamaBankRekanan = "Bank DKI",
            NoRekRekanan = "1110088990011", NpwpRekanan = "01.345.678.9-022.000",
            StatusBku = StatusBkuFlow.LunasTransfer, NoJurnalBank = "JRN-SDN-20260216002", StatusTransferBank = "00",
            TanggalTransferBank = new DateTime(2026, 2, 16, 13, 30, 0, DateTimeKind.Utc),
            ApprovedByTuAt = new DateTime(2026, 2, 16, 11, 0, 0, DateTimeKind.Utc),
            ApprovedByPaAt = new DateTime(2026, 2, 16, 12, 0, 0, DateTimeKind.Utc),
            CreatedBy = "bendahara.sdnmenteng01"
        };
        bkuSdnBosLunas.DetailItems.Add(new BkuDetailItem
        {
            RkasItemId = rkasSdnBuku.Id, KodeKegiatan = rkasSdnBuku.KodeKegiatan, NamaKegiatan = rkasSdnBuku.NamaKegiatan,
            KodeAkun = rkasSdnBuku.KodeAkun, NamaAkun = rkasSdnBuku.NamaAkun, KodeKomponen = rkasSdnBuku.KodeKomponen,
            NamaKomponen = rkasSdnBuku.NamaKomponen, Spesifikasi = rkasSdnBuku.Spesifikasi, Volume = 5, Satuan = "Paket", HargaSatuan = 1200000m, Jumlah = 6000000m
        });
        bkuSdnBosLunas.TaxItems.Add(new BkuTaxItem
        {
            KodeTrxPajak = "P2", NamaPajak = "PPh Pasal 22 (Pembelian Barang > Rp 2 Juta)", KodeMap = "411122", KodeJenisSetoran = "920",
            MasaPajak = "02", TahunPajak = 2026, DasarPengenaanPajak = 6000000m, TarifPersen = 1.5m, NilaiPajak = 90000m,
            StatusPajak = StatusPajakFlow.LunasNtpn, KodeBilling = "820260216778899", Ntpn = "SDN12026DKI00412", Ntb = "000129381122",
            TanggalLunasPajak = new DateTime(2026, 2, 16, 14, 0, 0, DateTimeKind.Utc)
        });
        var bkuSdnBosMenungguTu = new BkuTransaction
        {
            SekolahId = sdnMenteng01.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01", Bulan = 3,
            NomorBku = "BKU-BOS-2026-0203", NomorBukti = "INV/SDN01/2026/022",
            TanggalTransaksi = new DateTime(2026, 3, 14, 9, 0, 0, DateTimeKind.Utc),
            KodeTrx = KodeTrxBku.BelanjaSpj, JenisPembayaran = JenisPembayaranBku.Transfer,
            Uraian = "Konsumsi Rapat Komite Sekolah & Parenting SDN Menteng 01",
            NilaiBrutoKeluar = 3200000m, TotalPotonganPajak = 64000m, NilaiNettoTransfer = 3136000m,
            NamaRekanan = "CV. RASA NUSANTARA CATERING", KodeBankRekanan = "111", NamaBankRekanan = "Bank DKI",
            NoRekRekanan = "1110044556677", NpwpRekanan = "03.777.888.9-012.000",
            StatusBku = StatusBkuFlow.DiajukanTu, SubmittedAt = new DateTime(2026, 3, 14, 10, 0, 0, DateTimeKind.Utc),
            CreatedBy = "bendahara.sdnmenteng01"
        };
        bkuSdnBosMenungguTu.DetailItems.Add(new BkuDetailItem
        {
            RkasItemId = rkasSdnKonsumsi.Id, KodeKegiatan = rkasSdnKonsumsi.KodeKegiatan, NamaKegiatan = rkasSdnKonsumsi.NamaKegiatan,
            KodeAkun = rkasSdnKonsumsi.KodeAkun, NamaAkun = rkasSdnKonsumsi.NamaAkun, KodeKomponen = rkasSdnKonsumsi.KodeKomponen,
            NamaKomponen = rkasSdnKonsumsi.NamaKomponen, Spesifikasi = rkasSdnKonsumsi.Spesifikasi, Volume = 80, Satuan = "Box", HargaSatuan = 40000m, Jumlah = 3200000m
        });

        var bkuSdnJoBop = new BkuTransaction
        {
            SekolahId = sdnMenteng01.Id, TahunAnggaran = 2026, SumberDana = "BOP", KodePeriode = "TW1", Bulan = 1,
            NomorBku = "BKU-BOP-2026-0201", NomorBukti = "SP2D/BPKD-DKI/BOP/2026/0308",
            TanggalTransaksi = new DateTime(2026, 1, 24, 9, 0, 0, DateTimeKind.Utc),
            KodeTrx = KodeTrxBku.Dropping, JenisPembayaran = JenisPembayaranBku.NonTransfer,
            Uraian = "Pencairan Dropping Dana BOP Triwulan I SDN Menteng 01",
            NilaiBrutoMasuk = 145000000m, NamaRekanan = "BPKD PROVINSI DKI JAKARTA", NamaBankRekanan = "Bank DKI", NoRekRekanan = sdnMenteng01.NoRekBop,
            StatusBku = StatusBkuFlow.LunasTransfer, StatusTransferBank = "00",
            NoJurnalBank = "JRN-SDNBOP-20260124", TanggalTransferBank = new DateTime(2026, 1, 24, 9, 5, 0, DateTimeKind.Utc),
            CreatedBy = "SYSTEM-SIPKD"
        };
        var bkuSdnBopLunas = new BkuTransaction
        {
            SekolahId = sdnMenteng01.Id, TahunAnggaran = 2026, SumberDana = "BOP", KodePeriode = "TW1", Bulan = 2,
            NomorBku = "BKU-BOP-2026-0202", NomorBukti = "KW/SDN-BOP/2026/003",
            TanggalTransaksi = new DateTime(2026, 2, 19, 10, 0, 0, DateTimeKind.Utc),
            KodeTrx = KodeTrxBku.BelanjaSpj, JenisPembayaran = JenisPembayaranBku.Transfer,
            Uraian = "Pengadaan Paket Sanitasi & Kebersihan Lingkungan SDN Menteng 01",
            NilaiBrutoKeluar = 5000000m, TotalPotonganPajak = 550000m, NilaiNettoTransfer = 4450000m,
            NamaRekanan = "PT. BERSIH SEHAT MANDIRI", KodeBankRekanan = "111", NamaBankRekanan = "Bank DKI",
            NoRekRekanan = "1110055667788", NpwpRekanan = "01.345.678.9-022.000",
            StatusBku = StatusBkuFlow.LunasTransfer, NoJurnalBank = "JRN-SDNBOP-20260219", StatusTransferBank = "00",
            TanggalTransferBank = new DateTime(2026, 2, 19, 13, 0, 0, DateTimeKind.Utc),
            ApprovedByTuAt = new DateTime(2026, 2, 19, 11, 0, 0, DateTimeKind.Utc),
            ApprovedByPaAt = new DateTime(2026, 2, 19, 12, 0, 0, DateTimeKind.Utc),
            CreatedBy = "bendahara.sdnmenteng01"
        };
        bkuSdnBopLunas.DetailItems.Add(new BkuDetailItem
        {
            RkasItemId = rkasSdnBopKebersihan.Id, KodeKegiatan = rkasSdnBopKebersihan.KodeKegiatan, NamaKegiatan = rkasSdnBopKebersihan.NamaKegiatan,
            KodeAkun = rkasSdnBopKebersihan.KodeAkun, NamaAkun = rkasSdnBopKebersihan.NamaAkun, KodeKomponen = rkasSdnBopKebersihan.KodeKomponen,
            NamaKomponen = rkasSdnBopKebersihan.NamaKomponen, Spesifikasi = rkasSdnBopKebersihan.Spesifikasi, Volume = 5, Satuan = "Paket", HargaSatuan = 1000000m, Jumlah = 5000000m
        });

        db.BkuTransactions.AddRange(
            bkuLunas, bkuSiapBayar, bkuMenungguTu, bkuDraft, bkuJoBop, bkuBopHonor, bkuSmanLunas2,
            bkuSmpJoBos, bkuSmpBosLunas, bkuSmpBosDraft, bkuSmpJoBop, bkuSmpBopLunas,
            bkuSdnJoBos, bkuSdnBosLunas, bkuSdnBosMenungguTu, bkuSdnJoBop, bkuSdnBopLunas);
        await db.SaveChangesAsync();

        // 8. Dropping Dana (SMAN 1, SMPN 115, SDN Menteng 01 - BOS & BOP)
        db.DroppingDanas.AddRange(
            new DroppingDana
            {
                SekolahId = sman1.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01",
                NamaPeriode = "Tahap 1 (Januari - Juni 2026)", NomorSp2d = "SP2D/KEMENDIKBUD/BOS/2026/0112",
                TanggalDropping = new DateTime(2026, 1, 18, 8, 0, 0, DateTimeKind.Utc), NilaiDropping = 466650000m,
                Keterangan = "Penyaluran Dana BOSP Tahap 1 SMAN 1 Jakarta", IsConfirmedToBku = true,
                TanggalKonfirmasi = new DateTime(2026, 1, 18, 9, 0, 0, DateTimeKind.Utc), BkuTransactionId = bkuJoBos.Id
            },
            new DroppingDana
            {
                SekolahId = sman1.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "02",
                NamaPeriode = "Tahap 2 (Juli - Desember 2026)", NomorSp2d = "SP2D/KEMENDIKBUD/BOS/2026/0890",
                TanggalDropping = new DateTime(2026, 7, 10, 8, 0, 0, DateTimeKind.Utc), NilaiDropping = 300000000m,
                Keterangan = "Penyaluran Dana BOSP Tahap 2 SMAN 1 Jakarta (Menunggu Konfirmasi Bendahara)", IsConfirmedToBku = false
            },
            new DroppingDana
            {
                SekolahId = sman1.Id, TahunAnggaran = 2026, SumberDana = "BOP", KodePeriode = "TW1",
                NamaPeriode = "Triwulan I (Januari - Maret 2026)", NomorSp2d = "SP2D/BPKD-DKI/BOP/2026/0054",
                TanggalDropping = new DateTime(2026, 1, 22, 8, 0, 0, DateTimeKind.Utc), NilaiDropping = 329000000m,
                Keterangan = "Pencairan Dana BOP Triwulan I SMAN 1 Jakarta", IsConfirmedToBku = true,
                TanggalKonfirmasi = new DateTime(2026, 1, 22, 9, 0, 0, DateTimeKind.Utc), BkuTransactionId = bkuJoBop.Id
            },
            new DroppingDana
            {
                SekolahId = smpn115.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01",
                NamaPeriode = "Tahap 1 (Januari - Juni 2026)", NomorSp2d = "SP2D/KEMENDIKBUD/BOS/2026/0215",
                TanggalDropping = new DateTime(2026, 1, 20, 8, 0, 0, DateTimeKind.Utc), NilaiDropping = 289000000m,
                Keterangan = "Penyaluran Dana BOSP Tahap 1 SMPN 115 Jakarta", IsConfirmedToBku = true,
                TanggalKonfirmasi = new DateTime(2026, 1, 20, 9, 0, 0, DateTimeKind.Utc), BkuTransactionId = bkuSmpJoBos.Id
            },
            new DroppingDana
            {
                SekolahId = smpn115.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "02",
                NamaPeriode = "Tahap 2 (Juli - Desember 2026)", NomorSp2d = "SP2D/KEMENDIKBUD/BOS/2026/0915",
                TanggalDropping = new DateTime(2026, 7, 12, 8, 0, 0, DateTimeKind.Utc), NilaiDropping = 185000000m,
                Keterangan = "Penyaluran Dana BOSP Tahap 2 SMPN 115 Jakarta", IsConfirmedToBku = false
            },
            new DroppingDana
            {
                SekolahId = smpn115.Id, TahunAnggaran = 2026, SumberDana = "BOP", KodePeriode = "TW1",
                NamaPeriode = "Triwulan I (Januari - Maret 2026)", NomorSp2d = "SP2D/BPKD-DKI/BOP/2026/0220",
                TanggalDropping = new DateTime(2026, 1, 25, 8, 0, 0, DateTimeKind.Utc), NilaiDropping = 196400000m,
                Keterangan = "Pencairan Dana BOP Triwulan I SMPN 115 Jakarta", IsConfirmedToBku = true,
                TanggalKonfirmasi = new DateTime(2026, 1, 25, 9, 0, 0, DateTimeKind.Utc), BkuTransactionId = bkuSmpJoBop.Id
            },
            new DroppingDana
            {
                SekolahId = sdnMenteng01.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01",
                NamaPeriode = "Tahap 1 (Januari - Juni 2026)", NomorSp2d = "SP2D/KEMENDIKBUD/BOS/2026/0301",
                TanggalDropping = new DateTime(2026, 1, 21, 8, 0, 0, DateTimeKind.Utc), NilaiDropping = 186000000m,
                Keterangan = "Penyaluran Dana BOSP Tahap 1 SDN Menteng 01 Pagi", IsConfirmedToBku = true,
                TanggalKonfirmasi = new DateTime(2026, 1, 21, 9, 0, 0, DateTimeKind.Utc), BkuTransactionId = bkuSdnJoBos.Id
            },
            new DroppingDana
            {
                SekolahId = sdnMenteng01.Id, TahunAnggaran = 2026, SumberDana = "BOP", KodePeriode = "TW1",
                NamaPeriode = "Triwulan I (Januari - Maret 2026)", NomorSp2d = "SP2D/BPKD-DKI/BOP/2026/0308",
                TanggalDropping = new DateTime(2026, 1, 24, 8, 0, 0, DateTimeKind.Utc), NilaiDropping = 145000000m,
                Keterangan = "Pencairan Dana BOP Triwulan I SDN Menteng 01 Pagi", IsConfirmedToBku = true,
                TanggalKonfirmasi = new DateTime(2026, 1, 24, 9, 0, 0, DateTimeKind.Utc), BkuTransactionId = bkuSdnJoBop.Id
            }
        );

        // 9. NPD BOP Workflow Seed (SMAN 1, SMPN 115, SDN Menteng 01)
        db.NpdBops.AddRange(
            new NpdBop
            {
                SekolahId = sman1.Id, TahunAnggaran = 2026, KodePeriode = "TW1", NomorNpd = "NPD/SMAN1/BOP/2026/001",
                TanggalNpd = new DateTime(2026, 1, 15, 9, 0, 0, DateTimeKind.Utc),
                Uraian = "Pengajuan Pencairan Dana BOP Triwulan I SMAN 1 Jakarta", NilaiPengajuan = 329000000m,
                StatusNpd = 4, NomorSipkd = "SIPKD/NPD-BOP/2026/00112", TanggalKirimSipkd = new DateTime(2026, 1, 20, 14, 0, 0, DateTimeKind.Utc),
                Catatan = "Sudah cair dan masuk SP2D BOP TW I"
            },
            new NpdBop
            {
                SekolahId = sman1.Id, TahunAnggaran = 2026, KodePeriode = "TW2", NomorNpd = "NPD/SMAN1/BOP/2026/002",
                TanggalNpd = new DateTime(2026, 4, 2, 10, 0, 0, DateTimeKind.Utc),
                Uraian = "Pengajuan Pencairan Dana BOP Triwulan II SMAN 1 Jakarta", NilaiPengajuan = 285000000m,
                StatusNpd = 2, // Disetujui PA => Siap didemokan Approval Sudin & Kirim SIPKD!
                Catatan = "Disetujui Kepala Sekolah, menunggu persetujuan Sudin Wilayah I Jakarta Pusat"
            },
            new NpdBop
            {
                SekolahId = smpn115.Id, TahunAnggaran = 2026, KodePeriode = "TW1", NomorNpd = "NPD/SMPN115/BOP/2026/001",
                TanggalNpd = new DateTime(2026, 1, 17, 9, 0, 0, DateTimeKind.Utc),
                Uraian = "Pengajuan Pencairan Dana BOP Triwulan I SMPN 115 Jakarta", NilaiPengajuan = 196400000m,
                StatusNpd = 4, NomorSipkd = "SIPKD/NPD-BOP/2026/00220", TanggalKirimSipkd = new DateTime(2026, 1, 22, 14, 0, 0, DateTimeKind.Utc),
                Catatan = "Sudah cair dan masuk SP2D BOP TW I"
            },
            new NpdBop
            {
                SekolahId = smpn115.Id, TahunAnggaran = 2026, KodePeriode = "TW2", NomorNpd = "NPD/SMPN115/BOP/2026/002",
                TanggalNpd = new DateTime(2026, 4, 4, 10, 0, 0, DateTimeKind.Utc),
                Uraian = "Pengajuan Pencairan Dana BOP Triwulan II SMPN 115 Jakarta", NilaiPengajuan = 165000000m,
                StatusNpd = 1,
                Catatan = "Diajukan Bendahara SMPN 115 Jakarta, menunggu persetujuan PA"
            },
            new NpdBop
            {
                SekolahId = sdnMenteng01.Id, TahunAnggaran = 2026, KodePeriode = "TW1", NomorNpd = "NPD/SDN01/BOP/2026/001",
                TanggalNpd = new DateTime(2026, 1, 18, 9, 0, 0, DateTimeKind.Utc),
                Uraian = "Pengajuan Pencairan Dana BOP Triwulan I SDN Menteng 01 Pagi", NilaiPengajuan = 145000000m,
                StatusNpd = 4, NomorSipkd = "SIPKD/NPD-BOP/2026/00308", TanggalKirimSipkd = new DateTime(2026, 1, 23, 14, 0, 0, DateTimeKind.Utc),
                Catatan = "Sudah cair dan masuk SP2D BOP TW I"
            }
        );

        // 10. Bank Mutations (Rekening Koran Bank DKI - SMAN 1, SMPN 115, SDN Menteng 01)
        db.BankMutations.AddRange(
            new BankMutation
            {
                SekolahId = sman1.Id, SumberDana = "BOS", NomorRekening = sman1.NoRekBos,
                TanggalTransaksi = new DateTime(2026, 1, 18, 9, 5, 0, DateTimeKind.Utc),
                NomorReferensi = "JRN-DKI-20260118001", Uraian = "CR DROPPING DANA BOSP TAHAP 1 TA 2026",
                TipeMutasi = "K", Nominal = 466650000m, SaldoAkhir = 466650000m, KodeTrx = "JO", BkuTransactionId = bkuJoBos.Id
            },
            new BankMutation
            {
                SekolahId = sman1.Id, SumberDana = "BOS", NomorRekening = sman1.NoRekBos,
                TanggalTransaksi = new DateTime(2026, 2, 10, 14, 15, 0, DateTimeKind.Utc),
                NomorReferensi = "JRN-DKI-20260210088", Uraian = "DB CMS SPJ CV. GRAHA PUSTAKA NUSANTARA (E-ORDER ATK)",
                TipeMutasi = "D", Nominal = 14775000m, SaldoAkhir = 451875000m, KodeTrx = "JJ", BkuTransactionId = bkuLunas.Id
            },
            new BankMutation
            {
                SekolahId = sman1.Id, SumberDana = "BOS", NomorRekening = sman1.NoRekBos,
                TanggalTransaksi = new DateTime(2026, 2, 10, 14, 25, 0, DateTimeKind.Utc),
                NomorReferensi = "NTB-000129384712", Uraian = "DB MPN PAJAK PPN BILLING 820260210482910 (NTPN A7B92026DKI00124)",
                TipeMutasi = "D", Nominal = 1650000m, SaldoAkhir = 450225000m, KodeTrx = "P5", BkuTransactionId = bkuLunas.Id
            },
            new BankMutation
            {
                SekolahId = sman1.Id, SumberDana = "BOS", NomorRekening = sman1.NoRekBos,
                TanggalTransaksi = new DateTime(2026, 2, 10, 14, 26, 0, DateTimeKind.Utc),
                NomorReferensi = "NTB-000129384713", Uraian = "DB MPN PAJAK PPH 22 BILLING 820260210482911 (NTPN C4D12026DKI00125)",
                TipeMutasi = "D", Nominal = 225000m, SaldoAkhir = 450000000m, KodeTrx = "P2", BkuTransactionId = bkuLunas.Id
            },
            new BankMutation
            {
                SekolahId = sman1.Id, SumberDana = "BOS", NomorRekening = sman1.NoRekBos,
                TanggalTransaksi = new DateTime(2026, 2, 20, 14, 0, 0, DateTimeKind.Utc),
                NomorReferensi = "JRN-DKI-20260220099", Uraian = "DB CMS SPJ PT. ERLANGGA MAKMUR (BUKU OLIMPIADE)",
                TipeMutasi = "D", Nominal = 6107000m, SaldoAkhir = 443893000m, KodeTrx = "JJ", BkuTransactionId = bkuSmanLunas2.Id
            },
            new BankMutation
            {
                SekolahId = sman1.Id, SumberDana = "BOS", NomorRekening = sman1.NoRekBos,
                TanggalTransaksi = new DateTime(2026, 2, 20, 14, 10, 0, DateTimeKind.Utc),
                NomorReferensi = "NTB-000129389900", Uraian = "DB MPN PAJAK PPH 22 BILLING 820260220112233 (NTPN D5F22026DKI00199)",
                TipeMutasi = "D", Nominal = 93000m, SaldoAkhir = 443800000m, KodeTrx = "P2", BkuTransactionId = bkuSmanLunas2.Id
            },
            new BankMutation
            {
                SekolahId = sman1.Id, SumberDana = "BOP", NomorRekening = sman1.NoRekBop,
                TanggalTransaksi = new DateTime(2026, 1, 22, 9, 5, 0, DateTimeKind.Utc),
                NomorReferensi = "JRN-BOP-20260122001", Uraian = "CR DROPPING DANA BOP TRIWULAN I TA 2026",
                TipeMutasi = "K", Nominal = 329000000m, SaldoAkhir = 329000000m, KodeTrx = "JO", BkuTransactionId = bkuJoBop.Id
            },
            new BankMutation
            {
                SekolahId = sman1.Id, SumberDana = "BOP", NomorRekening = sman1.NoRekBop,
                TanggalTransaksi = new DateTime(2026, 2, 18, 15, 30, 0, DateTimeKind.Utc),
                NomorReferensi = "JRN-BOP-20260218012", Uraian = "DB CMS HONORARIUM NARASUMBER DR. BUDI PRASETYO",
                TipeMutasi = "D", Nominal = 8550000m, SaldoAkhir = 320450000m, KodeTrx = "JJ", BkuTransactionId = bkuBopHonor.Id
            },
            new BankMutation
            {
                SekolahId = sman1.Id, SumberDana = "BOP", NomorRekening = sman1.NoRekBop,
                TanggalTransaksi = new DateTime(2026, 2, 18, 15, 40, 0, DateTimeKind.Utc),
                NomorReferensi = "NTB-000991122334", Uraian = "DB MPN PAJAK PPH 21 BILLING 820260218991122 (NTPN B9E42026DKI00771)",
                TipeMutasi = "D", Nominal = 450000m, SaldoAkhir = 320000000m, KodeTrx = "P1", BkuTransactionId = bkuBopHonor.Id
            },
            // SMPN 115 Jakarta
            new BankMutation
            {
                SekolahId = smpn115.Id, SumberDana = "BOS", NomorRekening = smpn115.NoRekBos,
                TanggalTransaksi = new DateTime(2026, 1, 20, 9, 5, 0, DateTimeKind.Utc),
                NomorReferensi = "JRN-SMP-20260120001", Uraian = "CR DROPPING DANA BOSP TAHAP 1 SMPN 115 JAKARTA",
                TipeMutasi = "K", Nominal = 289000000m, SaldoAkhir = 289000000m, KodeTrx = "JO", BkuTransactionId = bkuSmpJoBos.Id
            },
            new BankMutation
            {
                SekolahId = smpn115.Id, SumberDana = "BOS", NomorRekening = smpn115.NoRekBos,
                TanggalTransaksi = new DateTime(2026, 2, 14, 14, 0, 0, DateTimeKind.Utc),
                NomorReferensi = "JRN-SMP-20260214002", Uraian = "DB CMS SPJ CV. GRAHA PUSTAKA NUSANTARA (ATK SMPN 115)",
                TipeMutasi = "D", Nominal = 7565000m, SaldoAkhir = 281435000m, KodeTrx = "JJ", BkuTransactionId = bkuSmpBosLunas.Id
            },
            new BankMutation
            {
                SekolahId = smpn115.Id, SumberDana = "BOS", NomorRekening = smpn115.NoRekBos,
                TanggalTransaksi = new DateTime(2026, 2, 14, 14, 15, 0, DateTimeKind.Utc),
                NomorReferensi = "NTB-000129387711", Uraian = "DB MPN PAJAK PPN BILLING 820260214556677 (NTPN S1B22026DKI00311)",
                TipeMutasi = "D", Nominal = 935000m, SaldoAkhir = 280500000m, KodeTrx = "P5", BkuTransactionId = bkuSmpBosLunas.Id
            },
            new BankMutation
            {
                SekolahId = smpn115.Id, SumberDana = "BOP", NomorRekening = smpn115.NoRekBop,
                TanggalTransaksi = new DateTime(2026, 1, 25, 9, 5, 0, DateTimeKind.Utc),
                NomorReferensi = "JRN-SMPBOP-20260125", Uraian = "CR DROPPING DANA BOP TW I SMPN 115 JAKARTA",
                TipeMutasi = "K", Nominal = 196400000m, SaldoAkhir = 196400000m, KodeTrx = "JO", BkuTransactionId = bkuSmpJoBop.Id
            },
            new BankMutation
            {
                SekolahId = smpn115.Id, SumberDana = "BOP", NomorRekening = smpn115.NoRekBop,
                TanggalTransaksi = new DateTime(2026, 2, 22, 14, 0, 0, DateTimeKind.Utc),
                NomorReferensi = "JRN-SMPBOP-20260222", Uraian = "DB CMS HONORARIUM LITERASI DRS. H. SYAMSUDDIN",
                TipeMutasi = "D", Nominal = 6080000m, SaldoAkhir = 190320000m, KodeTrx = "JJ", BkuTransactionId = bkuSmpBopLunas.Id
            },
            // SDN Menteng 01 Pagi
            new BankMutation
            {
                SekolahId = sdnMenteng01.Id, SumberDana = "BOS", NomorRekening = sdnMenteng01.NoRekBos,
                TanggalTransaksi = new DateTime(2026, 1, 21, 9, 5, 0, DateTimeKind.Utc),
                NomorReferensi = "JRN-SDN-20260121001", Uraian = "CR DROPPING DANA BOSP TAHAP 1 SDN MENTENG 01 PAGI",
                TipeMutasi = "K", Nominal = 186000000m, SaldoAkhir = 186000000m, KodeTrx = "JO", BkuTransactionId = bkuSdnJoBos.Id
            },
            new BankMutation
            {
                SekolahId = sdnMenteng01.Id, SumberDana = "BOS", NomorRekening = sdnMenteng01.NoRekBos,
                TanggalTransaksi = new DateTime(2026, 2, 16, 13, 30, 0, DateTimeKind.Utc),
                NomorReferensi = "JRN-SDN-20260216002", Uraian = "DB CMS SPJ PT. BALAI PUSTAKA JAKARTA (BUKU KURIKULUM)",
                TipeMutasi = "D", Nominal = 5910000m, SaldoAkhir = 180090000m, KodeTrx = "JJ", BkuTransactionId = bkuSdnBosLunas.Id
            },
            new BankMutation
            {
                SekolahId = sdnMenteng01.Id, SumberDana = "BOS", NomorRekening = sdnMenteng01.NoRekBos,
                TanggalTransaksi = new DateTime(2026, 2, 16, 14, 0, 0, DateTimeKind.Utc),
                NomorReferensi = "NTB-000129381122", Uraian = "DB MPN PAJAK PPH 22 BILLING 820260216778899 (NTPN SDN12026DKI00412)",
                TipeMutasi = "D", Nominal = 90000m, SaldoAkhir = 180000000m, KodeTrx = "P2", BkuTransactionId = bkuSdnBosLunas.Id
            },
            new BankMutation
            {
                SekolahId = sdnMenteng01.Id, SumberDana = "BOP", NomorRekening = sdnMenteng01.NoRekBop,
                TanggalTransaksi = new DateTime(2026, 1, 24, 9, 5, 0, DateTimeKind.Utc),
                NomorReferensi = "JRN-SDNBOP-20260124", Uraian = "CR DROPPING DANA BOP TW I SDN MENTENG 01 PAGI",
                TipeMutasi = "K", Nominal = 145000000m, SaldoAkhir = 145000000m, KodeTrx = "JO", BkuTransactionId = bkuSdnJoBop.Id
            },
            new BankMutation
            {
                SekolahId = sdnMenteng01.Id, SumberDana = "BOP", NomorRekening = sdnMenteng01.NoRekBop,
                TanggalTransaksi = new DateTime(2026, 2, 19, 13, 0, 0, DateTimeKind.Utc),
                NomorReferensi = "JRN-SDNBOP-20260219", Uraian = "DB CMS SPJ PT. BERSIH SEHAT MANDIRI (SANITASI)",
                TipeMutasi = "D", Nominal = 4450000m, SaldoAkhir = 140550000m, KodeTrx = "JJ", BkuTransactionId = bkuSdnBopLunas.Id
            }
        );

        // 10b. BAP Kas & Tutup BKU Seed (agar Tutup BKU & Batal Tutup BKU langsung terisi untuk semua sekolah)
        db.BapKasReports.AddRange(
            new BapKasReport
            {
                SekolahId = sman1.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01",
                NomorBap = "BAP-KAS/BOS/SMAN1/2026/01", TanggalBap = new DateTime(2026, 1, 31, 10, 0, 0, DateTimeKind.Utc),
                SaldoBku = 466650000m, SaldoRekeningKoran = 466650000m, SaldoKasTunai = 0m, SelisihKas = 0m,
                KeteranganSelisih = "Saldo BKU Januari 2026 sesuai dengan Rekening Koran Bank DKI.",
                StatusBap = 2, IsTutupBuku = true,
                ApprovedPaAt = new DateTime(2026, 1, 31, 12, 0, 0, DateTimeKind.Utc),
                ApprovedDinasAt = new DateTime(2026, 1, 31, 15, 0, 0, DateTimeKind.Utc)
            },
            new BapKasReport
            {
                SekolahId = sman1.Id, TahunAnggaran = 2026, SumberDana = "BOP", KodePeriode = "TW1",
                NomorBap = "BAP-KAS/BOP/SMAN1/2026/TW1", TanggalBap = new DateTime(2026, 3, 31, 10, 0, 0, DateTimeKind.Utc),
                SaldoBku = 320000000m, SaldoRekeningKoran = 320000000m, SaldoKasTunai = 0m, SelisihKas = 0m,
                KeteranganSelisih = "Rekonsiliasi BKU BOP Triwulan I SMAN 1 Jakarta nihil selisih.",
                StatusBap = 1, IsTutupBuku = false,
                ApprovedPaAt = new DateTime(2026, 3, 31, 12, 0, 0, DateTimeKind.Utc)
            },
            new BapKasReport
            {
                SekolahId = smpn115.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01",
                NomorBap = "BAP-KAS/BOS/SMPN115/2026/01", TanggalBap = new DateTime(2026, 1, 31, 10, 0, 0, DateTimeKind.Utc),
                SaldoBku = 289000000m, SaldoRekeningKoran = 289000000m, SaldoKasTunai = 0m, SelisihKas = 0m,
                KeteranganSelisih = "Tutup BKU Januari 2026 SMPN 115 Jakarta.",
                StatusBap = 2, IsTutupBuku = true,
                ApprovedPaAt = new DateTime(2026, 1, 31, 11, 30, 0, DateTimeKind.Utc),
                ApprovedDinasAt = new DateTime(2026, 1, 31, 14, 0, 0, DateTimeKind.Utc)
            },
            new BapKasReport
            {
                SekolahId = sdnMenteng01.Id, TahunAnggaran = 2026, SumberDana = "BOS", KodePeriode = "01",
                NomorBap = "BAP-KAS/BOS/SDN01/2026/01", TanggalBap = new DateTime(2026, 1, 31, 10, 0, 0, DateTimeKind.Utc),
                SaldoBku = 186000000m, SaldoRekeningKoran = 186000000m, SaldoKasTunai = 0m, SelisihKas = 0m,
                KeteranganSelisih = "Tutup BKU Januari 2026 SDN Menteng 01 Pagi.",
                StatusBap = 2, IsTutupBuku = true,
                ApprovedPaAt = new DateTime(2026, 1, 31, 11, 45, 0, DateTimeKind.Utc),
                ApprovedDinasAt = new DateTime(2026, 1, 31, 14, 30, 0, DateTimeKind.Utc)
            }
        );

        // 10c. Batal Transfer SPJ Seed (BOS & BOP across Draft PK, Diajukan TU, Disetujui PA)
        db.BatalTransferSpjs.AddRange(
            new BatalTransferSpj
            {
                BkuTransactionId = bkuSmanLunas2.Id,
                SekolahId = sman1.Id,
                TahunAnggaran = 2026,
                SumberDana = "BOS",
                JenisPeriode = "TW",
                KodePeriode = "01",
                NomorBeritaAcara = "BA-BATAL/BOS/SMAN1/2026/001",
                TanggalPembatalan = new DateTime(2026, 2, 24, 9, 0, 0, DateTimeKind.Utc),
                NomorBkuMohon = bkuSmanLunas2.NomorBku,
                NilaiSpjBatal = bkuSmanLunas2.NilaiBrutoKeluar,
                NrkPengkoreksi = sman1.NrkBendahara,
                NamaPengkoreksi = sman1.NamaBendahara,
                FileBeritaAcaraName = "BA_Pembatalan_SPJ_Buku_Olimpiade.pdf",
                FileBeritaAcaraPath = "/uploader/api/v1/minio/preview/ba-batal-bos-001.pdf",
                UraianBeritaAcara = "Pembatalan SPJ karena terdapat kesalahan nomor rekening vendor penerbit pada batch transfer awal.",
                PajakTidakDikoreksi = true,
                StatusBatal = StatusBatalTransferFlow.DisetujuiPaMenungguSudin,
                CatatanVerifikasi = "Telah diverifikasi TU & PA, menunggu persetujuan final Sudin.",
                SubmittedByPk = "bendahara.sman1",
                SubmittedByPkAt = new DateTime(2026, 2, 24, 10, 0, 0, DateTimeKind.Utc),
                ApprovedByTu = "tu.sman1",
                ApprovedByTuAt = new DateTime(2026, 2, 24, 11, 30, 0, DateTimeKind.Utc),
                ApprovedByPa = "kepsek.sman1",
                ApprovedByPaAt = new DateTime(2026, 2, 24, 13, 0, 0, DateTimeKind.Utc),
                CreatedBy = "bendahara.sman1"
            },
            new BatalTransferSpj
            {
                BkuTransactionId = bkuBopHonor.Id,
                SekolahId = sman1.Id,
                TahunAnggaran = 2026,
                SumberDana = "BOP",
                JenisPeriode = "TW",
                KodePeriode = "TW1",
                NomorBeritaAcara = "BA-BATAL/BOP/SMAN1/2026/001",
                TanggalPembatalan = new DateTime(2026, 2, 25, 10, 0, 0, DateTimeKind.Utc),
                NomorBkuMohon = bkuBopHonor.NomorBku,
                NilaiSpjBatal = bkuBopHonor.NilaiBrutoKeluar,
                NrkPengkoreksi = sman1.NrkBendahara,
                NamaPengkoreksi = sman1.NamaBendahara,
                FileBeritaAcaraName = "BA_Batal_Transfer_BOP_Honor.pdf",
                FileBeritaAcaraPath = "/uploader/api/v1/minio/preview/ba-batal-bop-001.pdf",
                UraianBeritaAcara = "Koreksi rincian jam mengajar narasumber IHT Kurikulum Merdeka TW I.",
                PajakTidakDikoreksi = true,
                StatusBatal = StatusBatalTransferFlow.DiajukanTu,
                CatatanVerifikasi = "Diajukan Bendahara ke Verifikator TU.",
                SubmittedByPk = "bendahara.sman1",
                SubmittedByPkAt = new DateTime(2026, 2, 25, 11, 0, 0, DateTimeKind.Utc),
                CreatedBy = "bendahara.sman1"
            },
            new BatalTransferSpj
            {
                BkuTransactionId = bkuSmpBosLunas.Id,
                SekolahId = smpn115.Id,
                TahunAnggaran = 2026,
                SumberDana = "BOS",
                JenisPeriode = "TW",
                KodePeriode = "01",
                NomorBeritaAcara = "BA-BATAL/BOS/SMPN115/2026/001",
                TanggalPembatalan = new DateTime(2026, 2, 26, 9, 30, 0, DateTimeKind.Utc),
                NomorBkuMohon = bkuSmpBosLunas.NomorBku,
                NilaiSpjBatal = bkuSmpBosLunas.NilaiBrutoKeluar,
                NrkPengkoreksi = smpn115.NrkBendahara,
                NamaPengkoreksi = smpn115.NamaBendahara,
                FileBeritaAcaraName = "BA_Batal_SMPN115_001.pdf",
                FileBeritaAcaraPath = "/uploader/api/v1/minio/preview/ba-batal-smp115.pdf",
                UraianBeritaAcara = "Draft berita acara pembatalan transfer cetak naskah PTS karena retur sebagian.",
                PajakTidakDikoreksi = true,
                StatusBatal = StatusBatalTransferFlow.DraftPk,
                CreatedBy = "bendahara.smpn115"
            },
            new BatalTransferSpj
            {
                BkuTransactionId = bkuSdnBosLunas.Id,
                SekolahId = sdnMenteng01.Id,
                TahunAnggaran = 2026,
                SumberDana = "BOS",
                JenisPeriode = "TW",
                KodePeriode = "01",
                NomorBeritaAcara = "BA-BATAL/BOS/SDN01/2026/001",
                TanggalPembatalan = new DateTime(2026, 2, 27, 9, 30, 0, DateTimeKind.Utc),
                NomorBkuMohon = bkuSdnBosLunas.NomorBku,
                NilaiSpjBatal = bkuSdnBosLunas.NilaiBrutoKeluar,
                NrkPengkoreksi = sdnMenteng01.NrkBendahara,
                NamaPengkoreksi = sdnMenteng01.NamaBendahara,
                FileBeritaAcaraName = "BA_Batal_SDN01_001.pdf",
                FileBeritaAcaraPath = "/uploader/api/v1/minio/preview/ba-batal-sdn01.pdf",
                UraianBeritaAcara = "Penyesuaian jumlah eksemplar buku pengayaan SDN Menteng 01 Pagi.",
                PajakTidakDikoreksi = true,
                StatusBatal = StatusBatalTransferFlow.DiajukanTu,
                SubmittedByPk = "bendahara.sdnmenteng01",
                SubmittedByPkAt = new DateTime(2026, 2, 27, 10, 0, 0, DateTimeKind.Utc),
                CreatedBy = "bendahara.sdnmenteng01"
            }
        );

        // 11. Integration Audit Logs & Helpdesk
        db.IntegrationAuditLogs.AddRange(
            new IntegrationAuditLog
            {
                SystemName = "BANK_DKI", EndpointCalled = "/api/spj-transfer/transfer", CallerService = "siapbos-api",
                RequestPayload = "{\"bkuId\":2,\"rekeningTujuan\":\"1110099887766\",\"nominal\":14775000}",
                ResponsePayload = "{\"bit39\":\"00\",\"noJurnalBank\":\"JRN-DKI-20260210088\"}", StatusCode = "00", IsSuccess = true,
                Timestamp = new DateTime(2026, 2, 10, 14, 15, 0, DateTimeKind.Utc)
            },
            new IntegrationAuditLog
            {
                SystemName = "DJP_MPN", EndpointCalled = "/api/spj-transfer-pajak/payment", CallerService = "siapbos-api",
                RequestPayload = "{\"kodeBilling\":\"820260210482910\",\"nominal\":1650000}",
                ResponsePayload = "{\"ntpn\":\"A7B92026DKI00124\",\"ntb\":\"000129384712\",\"status\":\"LUNAS\"}", StatusCode = "00", IsSuccess = true,
                Timestamp = new DateTime(2026, 2, 10, 14, 25, 0, DateTimeKind.Utc)
            },
            new IntegrationAuditLog
            {
                SystemName = "SIPKD", EndpointCalled = "/api/sipkd/npd/save", CallerService = "siapbop-api",
                RequestPayload = "{\"nomorNpd\":\"NPD/SMAN1/BOP/2026/001\",\"nilai\":329000000}",
                ResponsePayload = "{\"responseCode\":\"00\",\"nomorSipkd\":\"SIPKD/NPD-BOP/2026/00112\"}", StatusCode = "00", IsSuccess = true,
                Timestamp = new DateTime(2026, 1, 20, 14, 0, 0, DateTimeKind.Utc)
            }
        );

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

        var drop2026 = await db.DroppingDanas.Where(d => d.TahunAnggaran == 2026).AsNoTracking().ToListAsync();
        foreach (var d in drop2026)
        {
            d.Id = 0;
            d.TahunAnggaran = 2025;
            d.NomorSp2d = d.NomorSp2d.Replace("2026", "2025");
            d.TanggalDropping = d.TanggalDropping.AddYears(-1);
            if (d.TanggalKonfirmasi.HasValue) d.TanggalKonfirmasi = d.TanggalKonfirmasi.Value.AddYears(-1);
            db.DroppingDanas.Add(d);
        }

        var npd2026 = await db.NpdBops.Where(n => n.TahunAnggaran == 2026).AsNoTracking().ToListAsync();
        foreach (var n in npd2026)
        {
            n.Id = 0;
            n.TahunAnggaran = 2025;
            n.NomorNpd = n.NomorNpd.Replace("2026", "2025");
            n.TanggalNpd = n.TanggalNpd.AddYears(-1);
            if (n.NomorSipkd != null) n.NomorSipkd = n.NomorSipkd.Replace("2026", "2025");
            db.NpdBops.Add(n);
        }

        var bku2026 = await db.BkuTransactions
            .Include(b => b.DetailItems)
            .Include(b => b.TaxItems)
            .Where(b => b.TahunAnggaran == 2026)
            .AsNoTracking()
            .ToListAsync();

        var bkuCloneMap = new Dictionary<int, BkuTransaction>();
        foreach (var b in bku2026)
        {
            var oldId = b.Id;
            b.Id = 0;
            b.TahunAnggaran = 2025;
            b.NomorBku = b.NomorBku.Replace("2026", "2025");
            b.NomorBukti = b.NomorBukti.Replace("2026", "2025");
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

        var batal2026 = await db.BatalTransferSpjs.Where(bt => bt.TahunAnggaran == 2026).AsNoTracking().ToListAsync();
        foreach (var bt in batal2026)
        {
            var targetBkuId = bkuCloneMap.TryGetValue(bt.BkuTransactionId, out var cloned) ? cloned.Id : bt.BkuTransactionId;
            bt.Id = 0;
            bt.BkuTransactionId = targetBkuId;
            bt.TahunAnggaran = 2025;
            bt.NomorBeritaAcara = bt.NomorBeritaAcara.Replace("2026", "2025");
            bt.NomorBkuMohon = bt.NomorBkuMohon.Replace("2026", "2025");
            bt.TanggalPembatalan = bt.TanggalPembatalan.AddYears(-1);
            if (bt.SubmittedByPkAt.HasValue) bt.SubmittedByPkAt = bt.SubmittedByPkAt.Value.AddYears(-1);
            if (bt.ApprovedByTuAt.HasValue) bt.ApprovedByTuAt = bt.ApprovedByTuAt.Value.AddYears(-1);
            if (bt.ApprovedByPaAt.HasValue) bt.ApprovedByPaAt = bt.ApprovedByPaAt.Value.AddYears(-1);
            if (bt.ApprovedBySudinAt.HasValue) bt.ApprovedBySudinAt = bt.ApprovedBySudinAt.Value.AddYears(-1);
            db.BatalTransferSpjs.Add(bt);
        }

        await db.SaveChangesAsync();
    }
}
