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
                    + (CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'siap' AND table_name = 'traplikasi') THEN 0 ELSE 1 END);";
            var flag = Convert.ToInt32(await cmd.ExecuteScalarAsync());
            if (flag > 0)
            {
                needsRecreate = true;
            }
            else if (!await db.AppUsers.AnyAsync(u => u.Username == "ADMIN-TDI") ||
                     !await db.AppModules.AnyAsync(m => m.KodeAplikasi == "HELP"))
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

        const string allRoles = "ADMIN-DINAS,ADM_TA,SUDIN,PA-NEGERI,TU-NEGERI,PK-NEGERI";

        // 1. Master Roles (Schema: auth.roles)
        var roles = new List<AppRole>
        {
            new() { RoleCode = SiapBosRoles.AdminDinas, RoleName = "Administrator Dinas Pendidikan", Deskripsi = "Mengelola Dropping Dana, RKAS, User Management & Monitoring Provinsi DKI Jakarta", Level = "DINAS" },
            new() { RoleCode = "ADM_TA", RoleName = "ADMIN-TA (Tim Tenaga Ahli / TDI)", Deskripsi = "Otoritas penuh untuk tim TA / ADMIN-TDI pada seluruh 5 menu utama SIAP BOS", Level = "DINAS" },
            new() { RoleCode = SiapBosRoles.Sudin, RoleName = "Suku Dinas Pendidikan Wilayah", Deskripsi = "Menyetujui NPD BOP, Pembayaran Sudin, Setoran STS, Koreksi BKU & Monitoring Wilayah", Level = "SUDIN" },
            new() { RoleCode = SiapBosRoles.PaNegeri, RoleName = "Pengguna Anggaran (Kepala Sekolah)", Deskripsi = "Menyetujui Belanja SPJ, Menyetujui NPD, Permohonan Token CMS Bank DKI & BAP Kas", Level = "SEKOLAH" },
            new() { RoleCode = SiapBosRoles.TuNegeri, RoleName = "Verifikator Belanja (Kasubag TU)", Deskripsi = "Memverifikasi kelengkapan dokumen SPJ, Invoice, Pajak & Rincian Akun Belanja", Level = "SEKOLAH" },
            new() { RoleCode = SiapBosRoles.PkNegeri, RoleName = "Pemegang Kas (Bendahara Sekolah)", Deskripsi = "Input BKU, Konfirmasi Dana, Pengajuan Bayar, Transfer CMS, Bayar Pajak & Tutup Buku", Level = "SEKOLAH" }
        };
        db.AppRoles.AddRange(roles);

        // 2. 5 Menu Utama (Schema: siap.traplikasi) sesuai referensi siapbosdev & landingpage
        var modules = new List<AppModule>
        {
            new() { KodeAplikasi = "UM",   Nama = "User Management", Link = "user-management", Deskripsi = "Kelola Pengguna, Otoritas, Aplikasi, Menu, Periode, Master Sekolah & Pajak", Icon = "bi-people-fill", AllowedRolesCsv = allRoles, SortOrder = 1 },
            new() { KodeAplikasi = "BOS",  Nama = "BKU BOSP Negeri", Link = "bos-negeri",      Deskripsi = "Penatausahaan Dana BOSP Negeri (Dropping, Input BKU, Approval, Token, CMS, Pajak & Laporan)", Icon = "bi-journal-bookmark-fill", AllowedRolesCsv = allRoles, SortOrder = 2 },
            new() { KodeAplikasi = "BOP",  Nama = "BKU BOP Negeri",  Link = "bku-bop",         Deskripsi = "Penatausahaan Dana BOP Negeri (Permohonan NPD, Input BKU, Koreksi, BAP Kas & Laporan)", Icon = "bi-bank2", AllowedRolesCsv = allRoles, SortOrder = 3 },
            new() { KodeAplikasi = "ADMN", Nama = "Administrator",   Link = "administrator",   Deskripsi = "Batas Pengajuan Belanja, Help Desk Pembayaran BOSP/BOP, VA PLN & Migrasi RKAS", Icon = "bi-sliders2-vertical", AllowedRolesCsv = "ADMIN-DINAS,ADM_TA,SUDIN", SortOrder = 4 },
            new() { KodeAplikasi = "HELP", Nama = "Help Desk",       Link = "helpdesk",        Deskripsi = "User Manual, Tiket Bantuan Help Desk & Video Tutorial Penggunaan SIAP", Icon = "bi-headset", AllowedRolesCsv = allRoles, SortOrder = 5 }
        };
        db.AppModules.AddRange(modules);

        // Sub-menu untuk masing-masing dari 5 Menu Utama (Schema: siap.trmenu) sesuai siapbosdev
        var menus = new List<AppMenu>
        {
            // 1. User Management (UM) - 7 Sub Menu sesuai siapbosdev
            new() { KodeAplikasi = "UM", Nama = "Pengguna",       Link = "pengguna",       Icon = "bi-person-badge",      AllowedRolesCsv = allRoles, SortOrder = 1 },
            new() { KodeAplikasi = "UM", Nama = "Otoritas",       Link = "otoritas",       Icon = "bi-shield-lock",       AllowedRolesCsv = allRoles, SortOrder = 2 },
            new() { KodeAplikasi = "UM", Nama = "Aplikasi",       Link = "aplikasi",       Icon = "bi-grid-1x2",          AllowedRolesCsv = allRoles, SortOrder = 3 },
            new() { KodeAplikasi = "UM", Nama = "Menu",           Link = "menu",           Icon = "bi-list-nested",       AllowedRolesCsv = allRoles, SortOrder = 4 },
            new() { KodeAplikasi = "UM", Nama = "Periode",        Link = "periode",        Icon = "bi-calendar3",         AllowedRolesCsv = allRoles, SortOrder = 5 },
            new() { KodeAplikasi = "UM", Nama = "Master Sekolah", Link = "master-sekolah", Icon = "bi-building",          AllowedRolesCsv = allRoles, SortOrder = 6 },
            new() { KodeAplikasi = "UM", Nama = "Pajak",          Link = "pajak",          Icon = "bi-percent",           AllowedRolesCsv = allRoles, SortOrder = 7 },

            // 2. BKU BOSP Negeri (BOS) - Sesuai siapbosdev
            new() { KodeAplikasi = "BOS", Nama = "Dashboard BKU BOSP",                             Link = "dashboard",                          Icon = "bi-speedometer2",          AllowedRolesCsv = allRoles, SortOrder = 1 },
            new() { KodeAplikasi = "BOS", Nama = "Dropping Dana BOSP",                             Link = "konfirmasi-drop-dana",               Icon = "bi-box-arrow-in-down",     AllowedRolesCsv = allRoles, SortOrder = 2 },
            new() { KodeAplikasi = "BOS", Nama = "Konfirmasi Dropping Dana",                       Link = "dinas-konfirmasi-drop-dana",         Icon = "bi-check2-circle",         AllowedRolesCsv = allRoles, SortOrder = 3 },
            new() { KodeAplikasi = "BOS", Nama = "Input BKU BOSP",                                 Link = "input-bku",                          Icon = "bi-journal-plus",          AllowedRolesCsv = allRoles, SortOrder = 4 },
            new() { KodeAplikasi = "BOS", Nama = "Pengajuan Pembayaran BKU BOSP",                  Link = "pengajuan-bku",                      Icon = "bi-send-check",            AllowedRolesCsv = allRoles, SortOrder = 5 },
            new() { KodeAplikasi = "BOS", Nama = "Persetujuan Pembayaran BKU BOSP (TU)",           Link = "persetujuan-bku-tu",                 Icon = "bi-check2-square",         AllowedRolesCsv = allRoles, SortOrder = 6 },
            new() { KodeAplikasi = "BOS", Nama = "Persetujuan Pembayaran BKU BOSP (PA)",           Link = "persetujuan-bku-pa",                 Icon = "bi-award",                 AllowedRolesCsv = allRoles, SortOrder = 7 },
            new() { KodeAplikasi = "BOS", Nama = "Permohonan Token",                               Link = "permohonan-token",                   Icon = "bi-key-fill",              AllowedRolesCsv = allRoles, SortOrder = 8 },
            new() { KodeAplikasi = "BOS", Nama = "Pembayaran BKU BOSP",                            Link = "pembayaran-bku",                     Icon = "bi-credit-card-2-front",   AllowedRolesCsv = allRoles, SortOrder = 9 },
            new() { KodeAplikasi = "BOS", Nama = "Pembayaran Pajak BKU BOSP",                      Link = "pembayaran-pajak-bku",               Icon = "bi-receipt-cutoff",        AllowedRolesCsv = allRoles, SortOrder = 10 },
            new() { KodeAplikasi = "BOS", Nama = "Batal Transfer BKU BOSP",                        Link = "batal-transfer-spj",                 Icon = "bi-x-octagon",             AllowedRolesCsv = allRoles, SortOrder = 11 },
            new() { KodeAplikasi = "BOS", Nama = "Setor Pendapatan Lain-Lain BOSP",                Link = "setor-pendapatan-lain2-bos",         Icon = "bi-arrow-return-left",     AllowedRolesCsv = allRoles, SortOrder = 12 },
            new() { KodeAplikasi = "BOS", Nama = "Cetak Setor",                                    Link = "cetak-setoran",                      Icon = "bi-printer",               AllowedRolesCsv = allRoles, SortOrder = 13 },
            new() { KodeAplikasi = "BOS", Nama = "Persetujuan Setoran",                            Link = "persetujuan-setoran",                Icon = "bi-patch-check",           AllowedRolesCsv = allRoles, SortOrder = 14 },
            new() { KodeAplikasi = "BOS", Nama = "BAP KAS BOSP",                                   Link = "bap-kas-bos",                        Icon = "bi-clipboard-data",        AllowedRolesCsv = allRoles, SortOrder = 15 },
            new() { KodeAplikasi = "BOS", Nama = "Tutup BKU",                                      Link = "tutup-bku",                          Icon = "bi-lock-fill",             AllowedRolesCsv = allRoles, SortOrder = 16 },
            new() { KodeAplikasi = "BOS", Nama = "Batal Tutup BKU",                                Link = "batal-tutup-bku",                    Icon = "bi-unlock-fill",           AllowedRolesCsv = allRoles, SortOrder = 17 },
            new() { KodeAplikasi = "BOS", Nama = "Mutasi 12 Transaksi BOSP",                       Link = "bos-mutasi-12",                      Icon = "bi-clock-history",         AllowedRolesCsv = allRoles, SortOrder = 18 },
            new() { KodeAplikasi = "BOS", Nama = "Mutasi Semua Transaksi BOSP",                    Link = "bos-mutasi-semua",                   Icon = "bi-bank",                  AllowedRolesCsv = allRoles, SortOrder = 19 },
            new() { KodeAplikasi = "BOS", Nama = "Laporan BKU BOSP",                               Link = "laporan-BKU",                        Icon = "bi-file-earmark-pdf",      AllowedRolesCsv = allRoles, SortOrder = 20 },
            new() { KodeAplikasi = "BOS", Nama = "List BKU BOSP",                                  Link = "list-bku-bosp",                      Icon = "bi-table",                 AllowedRolesCsv = allRoles, SortOrder = 21 },
            new() { KodeAplikasi = "BOS", Nama = "Laporan Monitoring Dinas",                       Link = "laporan-monitoring-dinas",           Icon = "bi-bar-chart-line",        AllowedRolesCsv = allRoles, SortOrder = 22 },
            new() { KodeAplikasi = "BOS", Nama = "Pengajuan dan Persetujuan Pendapatan Lain-Lain", Link = "pengajuan-pendapatan-lain-lain",     Icon = "bi-file-earmark-plus",     AllowedRolesCsv = allRoles, SortOrder = 23 },
            new() { KodeAplikasi = "BOS", Nama = "Pembayaran Pindah Buku BOSP",                    Link = "pembayaran-pendapatan-lain-lain",    Icon = "bi-arrow-left-right",      AllowedRolesCsv = allRoles, SortOrder = 24 },
            new() { KodeAplikasi = "BOS", Nama = "Persetujuan Koreksi Periode Sebelum BOSP",       Link = "persetujuan-koreksi-dinas-bos",      Icon = "bi-check-all",             AllowedRolesCsv = allRoles, SortOrder = 25 },
            new() { KodeAplikasi = "BOS", Nama = "Koreksi Periode Sebelum BOSP",                   Link = "input-bku-koreksi",                  Icon = "bi-pencil-square",         AllowedRolesCsv = allRoles, SortOrder = 26 },
            new() { KodeAplikasi = "BOS", Nama = "Koreksi Tahun Lalu",                             Link = "input-bku-koreksi-tahun-lalu",       Icon = "bi-journal-arrow-up",      AllowedRolesCsv = allRoles, SortOrder = 27 },

            // 3. BKU BOP Negeri (BOP) - Sesuai siapbosdev
            new() { KodeAplikasi = "BOP", Nama = "Dashboard BKU BOP",                              Link = "dashboard",                          Icon = "bi-speedometer2",          AllowedRolesCsv = allRoles, SortOrder = 1 },
            new() { KodeAplikasi = "BOP", Nama = "Permohonan NPD",                                 Link = "konfirmasi-drop-dana-bop",           Icon = "bi-file-earmark-text",     AllowedRolesCsv = allRoles, SortOrder = 2 },
            new() { KodeAplikasi = "BOP", Nama = "Pengajuan Permohonan NPD",                       Link = "pengajuan-npd",                      Icon = "bi-send-plus",             AllowedRolesCsv = allRoles, SortOrder = 3 },
            new() { KodeAplikasi = "BOP", Nama = "Persetujuan NPD",                                Link = "persetujuan-npd",                    Icon = "bi-check2-all",            AllowedRolesCsv = allRoles, SortOrder = 4 },
            new() { KodeAplikasi = "BOP", Nama = "Input BKU BOP",                                  Link = "input-bku",                          Icon = "bi-journal-plus",          AllowedRolesCsv = allRoles, SortOrder = 5 },
            new() { KodeAplikasi = "BOP", Nama = "Pengajuan Pembayaran BKU BOP",                   Link = "pengajuan-pembayaran-bku",           Icon = "bi-send-check",            AllowedRolesCsv = allRoles, SortOrder = 6 },
            new() { KodeAplikasi = "BOP", Nama = "Persetujuan Pembayaran BKU BOP",                 Link = "persetujuan-bku",                    Icon = "bi-check2-square",         AllowedRolesCsv = allRoles, SortOrder = 7 },
            new() { KodeAplikasi = "BOP", Nama = "Permohonan Token",                               Link = "permohonan-token",                   Icon = "bi-key-fill",              AllowedRolesCsv = allRoles, SortOrder = 8 },
            new() { KodeAplikasi = "BOP", Nama = "Pembayaran BKU BOP",                             Link = "pembayaran-bku",                     Icon = "bi-credit-card-2-front",   AllowedRolesCsv = allRoles, SortOrder = 9 },
            new() { KodeAplikasi = "BOP", Nama = "Pembayaran Pajak",                               Link = "pembayaran-pajak-bop",               Icon = "bi-receipt-cutoff",        AllowedRolesCsv = allRoles, SortOrder = 10 },
            new() { KodeAplikasi = "BOP", Nama = "Batal Transfer BKU BOP",                         Link = "batal-transfer-spj",                 Icon = "bi-x-octagon",             AllowedRolesCsv = allRoles, SortOrder = 11 },
            new() { KodeAplikasi = "BOP", Nama = "Persetujuan Batal Transfer BKU BOP",             Link = "persetujuan-batal-tf-spj",           Icon = "bi-shield-check",          AllowedRolesCsv = allRoles, SortOrder = 12 },
            new() { KodeAplikasi = "BOP", Nama = "Cetak Setoran BOP",                              Link = "cetak-setoran",                      Icon = "bi-printer",               AllowedRolesCsv = allRoles, SortOrder = 13 },
            new() { KodeAplikasi = "BOP", Nama = "Persetujuan Setoran BOP",                        Link = "persetujuan-setoran",                Icon = "bi-patch-check",           AllowedRolesCsv = allRoles, SortOrder = 14 },
            new() { KodeAplikasi = "BOP", Nama = "BAP KAS BOP",                                    Link = "bap-kas",                            Icon = "bi-clipboard-data",        AllowedRolesCsv = allRoles, SortOrder = 15 },
            new() { KodeAplikasi = "BOP", Nama = "Batal Tutup BKU",                                Link = "batal-tutup-bku",                    Icon = "bi-unlock-fill",           AllowedRolesCsv = allRoles, SortOrder = 16 },
            new() { KodeAplikasi = "BOP", Nama = "Tutup BKU",                                      Link = "tutup-bku",                          Icon = "bi-lock-fill",             AllowedRolesCsv = allRoles, SortOrder = 17 },
            new() { KodeAplikasi = "BOP", Nama = "Mutasi 12 Transaksi",                            Link = "mutasi-transfer-12-transaksi",       Icon = "bi-clock-history",         AllowedRolesCsv = allRoles, SortOrder = 18 },
            new() { KodeAplikasi = "BOP", Nama = "Laporan BKU BOP",                                Link = "laporan-BKU",                        Icon = "bi-file-earmark-pdf",      AllowedRolesCsv = allRoles, SortOrder = 19 },
            new() { KodeAplikasi = "BOP", Nama = "BAP Kas Approval (Sudin)",                       Link = "bap-kas-approval-sudin",             Icon = "bi-clipboard-check",       AllowedRolesCsv = allRoles, SortOrder = 20 },
            new() { KodeAplikasi = "BOP", Nama = "Input Setor Sisa Belanja",                       Link = "setor-sisa-belanja",                 Icon = "bi-arrow-return-left",     AllowedRolesCsv = allRoles, SortOrder = 21 },
            new() { KodeAplikasi = "BOP", Nama = "Batas Pengajuan Belanja",                        Link = "batas-pengajuan-belanja",            Icon = "bi-calendar-event",        AllowedRolesCsv = allRoles, SortOrder = 22 },
            new() { KodeAplikasi = "BOP", Nama = "BAP KAS Approval (PA)",                          Link = "bap-kas-approval-pa",                Icon = "bi-clipboard2-check",      AllowedRolesCsv = allRoles, SortOrder = 23 },
            new() { KodeAplikasi = "BOP", Nama = "Laporan Monitoring Sudin",                       Link = "laporan-monitoring-sudin",           Icon = "bi-bar-chart-line",        AllowedRolesCsv = allRoles, SortOrder = 24 },
            new() { KodeAplikasi = "BOP", Nama = "List BKU BOP",                                   Link = "list-bku-bop",                       Icon = "bi-table",                 AllowedRolesCsv = allRoles, SortOrder = 25 },
            new() { KodeAplikasi = "BOP", Nama = "Pengajuan & Persetujuan Pendapatan Lain-Lain BOP", Link = "pengajuan-pendapatan-lain-lain-bop", Icon = "bi-file-earmark-plus",   AllowedRolesCsv = allRoles, SortOrder = 26 },
            new() { KodeAplikasi = "BOP", Nama = "Pembayaran Pindah Buku BOP",                     Link = "pembayaran-pendapatan-lain-lain-bop", Icon = "bi-arrow-left-right",     AllowedRolesCsv = allRoles, SortOrder = 27 },
            new() { KodeAplikasi = "BOP", Nama = "Persetujuan Koreksi Periode Sebelum BOP",        Link = "persetujuan-koreksi-sudin-bop",      Icon = "bi-check-all",             AllowedRolesCsv = allRoles, SortOrder = 28 },
            new() { KodeAplikasi = "BOP", Nama = "Koreksi Periode Sebelum BOP",                    Link = "input-bku-koreksi",                  Icon = "bi-pencil-square",         AllowedRolesCsv = allRoles, SortOrder = 29 },
            new() { KodeAplikasi = "BOP", Nama = "Mutasi Semua Transaksi BOP",                     Link = "bop-mutasi-semua",                   Icon = "bi-bank",                  AllowedRolesCsv = allRoles, SortOrder = 30 },

            // 4. Administrator (ADMN) - Sesuai siapbosdev
            new() { KodeAplikasi = "ADMN", Nama = "Batas Pengajuan Belanja",                       Link = "batas-pengajuan-belanja-list-opd",   Icon = "bi-calendar-range",        AllowedRolesCsv = "ADMIN-DINAS,ADM_TA,SUDIN", SortOrder = 1 },
            new() { KodeAplikasi = "ADMN", Nama = "Help Desk Pembayaran BKU BOSP",                 Link = "help-pembayaran-bos",                Icon = "bi-life-preserver",        AllowedRolesCsv = "ADMIN-DINAS,ADM_TA,SUDIN", SortOrder = 2 },
            new() { KodeAplikasi = "ADMN", Nama = "Help Desk Pembayaran BKU BOP",                  Link = "help-pembayaran-bop",                Icon = "bi-headset",               AllowedRolesCsv = "ADMIN-DINAS,ADM_TA,SUDIN", SortOrder = 3 },
            new() { KodeAplikasi = "ADMN", Nama = "Help Desk Virtual Account PLN",                 Link = "help-va-pln",                        Icon = "bi-lightning-charge",      AllowedRolesCsv = "ADMIN-DINAS,ADM_TA,SUDIN", SortOrder = 4 },
            new() { KodeAplikasi = "ADMN", Nama = "Migrasi RKAS",                                  Link = "konversi-data",                      Icon = "bi-file-earmark-spreadsheet", AllowedRolesCsv = "ADMIN-DINAS,ADM_TA,SUDIN", SortOrder = 5 },
            new() { KodeAplikasi = "ADMN", Nama = "Dropping Dana BOS & BOP",                       Link = "dropping-dana",                      Icon = "bi-send-check",            AllowedRolesCsv = "ADMIN-DINAS,ADM_TA,SUDIN", SortOrder = 6 },
            new() { KodeAplikasi = "ADMN", Nama = "Konfirmasi Saldo Rekening",                     Link = "konfirmasi-rekening",                Icon = "bi-bank2",                 AllowedRolesCsv = allRoles, SortOrder = 7 },

            // 5. Help Desk (HELP) - Sesuai landingpage referensi
            new() { KodeAplikasi = "HELP", Nama = "User Manual",                                   Link = "user-manual",                        Icon = "bi-book-half",             AllowedRolesCsv = allRoles, SortOrder = 1 },
            new() { KodeAplikasi = "HELP", Nama = "Help Desk",                                     Link = "tiket-helpdesk",                     Icon = "bi-ticket-detailed",       AllowedRolesCsv = allRoles, SortOrder = 2 },
            new() { KodeAplikasi = "HELP", Nama = "Video Tutorial",                                Link = "video-tutorial",                     Icon = "bi-play-btn",              AllowedRolesCsv = allRoles, SortOrder = 3 }
        };
        db.AppMenus.AddRange(menus);

        // 3. Master Sekolah
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
            SaldoBos = 450000000m, // updated consistently with seeded transactions below
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
            IsRekeningConfirmed = false
        };

        db.Sekolahs.AddRange(sman1, smpn115, sdnMenteng01);
        await db.SaveChangesAsync();

        // 4. Users (Schema: auth.users) — termasuk akun referensi ADMIN-TDI (MonaS123!)
        var defaultPasswordHash = BCrypt.Net.BCrypt.HashPassword("password123");
        var adminTdiPasswordHash = BCrypt.Net.BCrypt.HashPassword("MonaS123!");
        var users = new List<AppUser>
        {
            new() { Username = "ADMIN-TDI", PasswordHash = adminTdiPasswordHash, NamaLengkap = "TDI ADMIN", Nrk = "ADMIN-TDI", Nip = "198501012010011001", Nik = "3171010101850001", Email = "admin.tdi@jakarta.go.id", NoHp = "081210000000", RoleCode = SiapBosRoles.AdminDinas, Jabatan = "ADMIN-TA (Administrator TDI)", WilayahSudin = "ALL", SekolahId = sman1.Id },
            new() { Username = "admin.dinas", PasswordHash = defaultPasswordHash, NamaLengkap = "Yusuf Pratama, M.Kom.", Nrk = "100001", Nip = "198001012005011001", Nik = "3171010101800001", Email = "admin.dinas@disdik.jakarta.go.id", NoHp = "081210000001", RoleCode = SiapBosRoles.AdminDinas, Jabatan = "Administrator Dinas Pendidikan Provinsi DKI Jakarta", WilayahSudin = "ALL", SekolahId = sman1.Id },
            new() { Username = "sudin.jp", PasswordHash = defaultPasswordHash, NamaLengkap = "Drs. Bambang Sutrisno, M.Si.", Nrk = "100002", Nip = "197504151999031002", Nik = "3171021504750002", Email = "sudin.jp@disdik.jakarta.go.id", NoHp = "081210000002", RoleCode = SiapBosRoles.Sudin, Jabatan = "Kepala Suku Dinas Pendidikan Wil. I Jakarta Pusat", WilayahSudin = "JP", SekolahId = sman1.Id },
            new() { Username = "kepsek.sman1", PasswordHash = defaultPasswordHash, NamaLengkap = sman1.NamaKepalaSekolah, Nrk = sman1.NrkKepalaSekolah, Nip = sman1.NipKepalaSekolah, Nik = "3171031205720003", Email = "pa.sman1@jakarta.sch.id", NoHp = "081210000003", RoleCode = SiapBosRoles.PaNegeri, Jabatan = "Kepala Sekolah (Pengguna Anggaran)", WilayahSudin = "JP", SekolahId = sman1.Id },
            new() { Username = "tu.sman1", PasswordHash = defaultPasswordHash, NamaLengkap = sman1.NamaKasubagTu, Nrk = sman1.NipKasubagTu, Nip = sman1.NipKasubagTu, Nik = "3171041503800004", Email = "tu.sman1@jakarta.sch.id", NoHp = "081210000004", RoleCode = SiapBosRoles.TuNegeri, Jabatan = "Kasubag Tata Usaha (Verifikator)", WilayahSudin = "JP", SekolahId = sman1.Id },
            new() { Username = "bendahara.sman1", PasswordHash = defaultPasswordHash, NamaLengkap = sman1.NamaBendahara, Nrk = sman1.NrkBendahara, Nip = sman1.NipBendahara, Nik = "3171052011880005", Email = "pk.sman1@jakarta.sch.id", NoHp = "081210000005", RoleCode = SiapBosRoles.PkNegeri, Jabatan = "Bendahara Sekolah (Pemegang Kas)", WilayahSudin = "JP", SekolahId = sman1.Id },
            new() { Username = "bendahara.smpn115", PasswordHash = defaultPasswordHash, NamaLengkap = smpn115.NamaBendahara, Nrk = smpn115.NrkBendahara, Nip = smpn115.NipBendahara, Nik = "3174011804910006", Email = "pk.smpn115@jakarta.sch.id", NoHp = "081210000006", RoleCode = SiapBosRoles.PkNegeri, Jabatan = "Bendahara Sekolah (Pemegang Kas)", WilayahSudin = "JS", SekolahId = smpn115.Id }
        };
        db.AppUsers.AddRange(users);

        // 5. Master Periode (2025 & 2026) & Tax & BAS (Schema: siap)
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
            TotalPagu = 15000000m, TotalRealisasi = 0m
        };

        db.RkasItems.AddRange(rkasAtk, rkasAc, rkasPln, rkasKonsumsi, rkasLaptop, rkasBopHonor, rkasBopPln, rkasSmpAtk);
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

        db.BkuTransactions.AddRange(bkuLunas, bkuSiapBayar, bkuMenungguTu, bkuDraft, bkuJoBop, bkuBopHonor);
        await db.SaveChangesAsync();

        // 8. Dropping Dana (1 confirmed BOS Tahap 1, 1 pending confirmation BOS Tahap 2, 1 confirmed BOP TW1, 1 SMPN115)
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
                NamaPeriode = "Tahap 1 (Januari - Juni 2026)", NomorSp2d = "SP2D/KEMENDIKBUD/BOS/2026/0119",
                TanggalDropping = new DateTime(2026, 1, 19, 8, 0, 0, DateTimeKind.Utc), NilaiDropping = 275000000m,
                Keterangan = "Penyaluran Dana BOSP Tahap 1 SMPN 115 Jakarta", IsConfirmedToBku = false
            }
        );

        // 9. NPD BOP Workflow Seed
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
            }
        );

        // 10. Bank Mutations (Rekening Koran Bank DKI)
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
            RoleCode = SiapBosRoles.AdminDinas,
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

        foreach (var b in bku2026)
        {
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
        }

        await db.SaveChangesAsync();
    }
}
