using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SiapBos.Shared.Data;
using SiapBos.Shared.DTOs;
using SiapBos.Shared.Entities;
using SiapBos.Shared.Security;

namespace SiapBos.Auth.Controllers;

[ApiController]
public class OAuthController : ControllerBase
{
    private readonly SiapBosDbContext _db;
    private readonly IMemoryCache _cache;
    private readonly IConfiguration _config;

    public OAuthController(SiapBosDbContext db, IMemoryCache cache, IConfiguration config)
    {
        _db = db;
        _cache = cache;
        _config = config;
    }

    [HttpGet("/oauth/captcha")]
    [AllowAnonymous]
    public ActionResult<ApiResponse<object>> GenerateCaptcha()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var code = new string(Enumerable.Range(0, 5).Select(_ => chars[Random.Shared.Next(chars.Length)]).ToArray());
        var token = Guid.NewGuid().ToString("N");
        _cache.Set($"captcha:{token}", code, TimeSpan.FromMinutes(10));

        return Ok(ApiResponse<object>.Ok(new { captchaToken = token, captchaCode = code }));
    }

    [HttpGet("/api/auth/demo-accounts")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<object>>> GetDemoAccounts()
    {
        var users = await _db.AppUsers
            .Include(u => u.Sekolah)
            .Where(u => u.IsActive)
            .OrderBy(u => u.Id)
            .Select(u => new
            {
                u.Username,
                u.NamaLengkap,
                u.Nrk,
                u.RoleCode,
                u.Jabatan,
                SekolahNama = u.Sekolah != null ? u.Sekolah.NamaSekolah : "Dinas / Suku Dinas Pendidikan",
                DefaultPassword = "password123"
            })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(users));
    }

    [HttpPost("/oauth/token")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<LoginResponse>>> Login([FromBody] LoginRequest req)
    {
        if (!req.SkipCaptchaDemo)
        {
            if (string.IsNullOrWhiteSpace(req.CaptchaToken) ||
                !_cache.TryGetValue<string>($"captcha:{req.CaptchaToken}", out var expectedCode) ||
                !string.Equals(expectedCode, req.CaptchaInput?.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(ApiResponse<LoginResponse>.Fail("Kode Captcha tidak sesuai atau sudah kedaluwarsa."));
            }
            _cache.Remove($"captcha:{req.CaptchaToken}");
        }

        var identifier = req.Username.Trim();
        var user = await _db.AppUsers
            .Include(u => u.Sekolah)
            .FirstOrDefaultAsync(u =>
                (u.Username == identifier || u.Nrk == identifier || u.Nip == identifier) && u.IsActive);

        if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
        {
            return Unauthorized(ApiResponse<LoginResponse>.Fail("Username / NRK atau Password salah."));
        }

        var response = await BuildLoginResponseAsync(user, req.TahunAnggaran > 0 ? req.TahunAnggaran : 2026);
        return Ok(ApiResponse<LoginResponse>.Ok(response, "Login SIAP BOS berhasil."));
    }

    [HttpPost("/api/auth/quick-switch")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<LoginResponse>>> QuickSwitchRole([FromBody] QuickSwitchRoleRequest req)
    {
        var query = _db.AppUsers.Include(u => u.Sekolah).Where(u => u.RoleCode == req.RoleCode && u.IsActive);
        if (req.SekolahId.HasValue)
        {
            query = query.Where(u => u.SekolahId == req.SekolahId.Value || u.SekolahId == null);
        }

        var user = await query.FirstOrDefaultAsync();
        if (user == null)
        {
            return NotFound(ApiResponse<LoginResponse>.Fail($"Akun demo untuk role {req.RoleCode} tidak ditemukan."));
        }

        var response = await BuildLoginResponseAsync(user, req.TahunAnggaran > 0 ? req.TahunAnggaran : 2026);
        return Ok(ApiResponse<LoginResponse>.Ok(response, $"Berhasil beralih ke role {user.RoleCode} ({user.NamaLengkap})."));
    }

    [HttpGet("/api/auth/me")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<LoginResponse>>> Me([FromQuery] int tahunAnggaran = 2026)
    {
        var username = User.FindFirst("username")?.Value;
        var user = await _db.AppUsers.Include(u => u.Sekolah).FirstOrDefaultAsync(u => u.Username == username);
        if (user == null) return NotFound(ApiResponse<LoginResponse>.Fail("Pengguna tidak ditemukan."));

        var response = await BuildLoginResponseAsync(user, tahunAnggaran);
        return Ok(ApiResponse<LoginResponse>.Ok(response));
    }

    [HttpPost("/api/auth/change-password")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<string>>> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        var user = await _db.AppUsers.FirstOrDefaultAsync(u => u.Nrk == req.Nrk || u.Username == req.Nrk);
        if (user == null || !BCrypt.Net.BCrypt.Verify(req.SandiLama, user.PasswordHash))
        {
            return BadRequest(ApiResponse<string>.Fail("NRK/Username atau sandi lama tidak sesuai."));
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.SandiBaru);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<string>.Ok("OK", "Password berhasil diperbarui."));
    }

    [HttpPost("/api/auth/forgot-password-demo")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<object>>> ForgotPasswordDemo([FromBody] ForgotPasswordDemoRequest req)
    {
        var key = req.Identifier?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(req.SandiBaru) || req.SandiBaru.Length < 6)
        {
            return BadRequest(ApiResponse<object>.Fail("NRK/Username wajib diisi dan sandi baru minimal 6 karakter."));
        }

        var user = await _db.AppUsers.FirstOrDefaultAsync(u => u.Nrk == key || u.Username == key);
        if (user == null)
        {
            return NotFound(ApiResponse<object>.Fail("Akun dengan NRK atau Username tersebut tidak ditemukan di database."));
        }

        if (string.IsNullOrWhiteSpace(req.OtpDemo) || req.OtpDemo.Trim() != "123456")
        {
            return BadRequest(ApiResponse<object>.Fail("Kode OTP Verifikasi salah. Untuk simulasi demo gunakan OTP: 123456."));
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.SandiBaru);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { user.Username, user.Nrk }, $"Password akun {user.Username} berhasil di-reset via OTP NRK."));
    }

    [HttpGet("/api/public/tahun-anggaran")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<object>>> GetPublicTahunAnggaran()
    {
        var years = await _db.MasterPeriodes
            .Select(p => p.TahunAnggaran)
            .Distinct()
            .OrderByDescending(y => y)
            .ToListAsync();

        if (!years.Contains(2026)) years.Insert(0, 2026);
        if (!years.Contains(2025)) years.Add(2025);
        if (!years.Contains(2024)) years.Add(2024);

        return Ok(ApiResponse<object>.Ok(years.OrderByDescending(y => y).Select(y => new
        {
            tahun = y,
            aktif = y == 2026,
            label = y == 2026 ? $"{y} (Tahun Berjalan)" : $"{y}"
        }).ToList()));
    }

    [HttpGet("/api/public/landing-summary")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<object>>> GetPublicLandingSummary()
    {
        var jumlahSekolah = await _db.Sekolahs.CountAsync();
        var totalPagu = await _db.RkasItems.SumAsync(r => (decimal?)r.TotalPagu) ?? 0m;
        var totalRealisasi = await _db.RkasItems.SumAsync(r => (decimal?)r.TotalRealisasi) ?? 0m;
        var totalDropping = await _db.DroppingDanas.Where(d => d.IsConfirmedToBku).SumAsync(d => (decimal?)d.NilaiDropping) ?? 0m;
        var persenSerapan = totalPagu > 0 ? Math.Round((totalRealisasi / totalPagu) * 100m, 1) : 0m;

        var berita = new[]
        {
            new
            {
                id = 1,
                kategori = "Penyaluran BOSP",
                tanggal = "12 Nov 2026",
                judul = "Penyaluran Dana BOSP Reguler Tahap II & Rekonsiliasi BKU DKI Jakarta",
                ringkasan = "Satuan Pendidikan Negeri diminta segera melakukan konfirmasi saldo rekening Bank DKI dan menyelesaikan pengajuan SPJ sebelum tanggal cut-off periode.",
                badgeColor = "amber"
            },
            new
            {
                id = 2,
                kategori = "BOP APBD & SIPKD",
                tanggal = "08 Nov 2026",
                judul = "Optimalisasi NPD BOP Terintegrasi SIPKD BPKD untuk Triwulan Berjalan",
                ringkasan = "Pengajuan Nota Pencairan Dana (NPD) BOP yang telah disetujui Kepala Sekolah (PA) dan Suku Dinas otomatis diteruskan secara real-time ke SIPKD.",
                badgeColor = "indigo"
            },
            new
            {
                id = 3,
                kategori = "Perpajakan MPN",
                tanggal = "02 Nov 2026",
                judul = "Pembaruan Validasi NPWP 16 Digit (CTAS) & Pelunasan Billing NTPN MPN G3",
                ringkasan = "Bendahara sekolah dapat mencetak langsung Bukti Penerimaan Negara (BPN) pada Formulir 25 setelah pelunasan Kode Billing pajak berhasil.",
                badgeColor = "emerald"
            }
        };

        var peraturan = new[]
        {
            new { kode = "Permendikbudristek No. 63 Tahun 2023", tentang = "Perubahan Juknis Pengelolaan Dana BOSP", lingkup = "BOSP APBN" },
            new { kode = "Pergub Provinsi DKI Jakarta No. 48 Tahun 2023", tentang = "Pedoman Pengelolaan Dana Bantuan Operasional Pendidikan (BOP)", lingkup = "BOP APBD" },
            new { kode = "PMK No. 59/PMK.03/2022", tentang = "Tata Cara Pemungutan & Penyetoran Pajak Instansi Pemerintah", lingkup = "Pajak MPN G3" },
            new { kode = "SE Kadisdik DKI Jakarta Tahun 2026", tentang = "Jadwal Batas Pengajuan SPJ, BAP Kas & Tutup Buku Periodik", lingkup = "Tata Kelola" }
        };

        var prosedur = new[]
        {
            new { step = 1, title = "Konfirmasi Rekening & RKAS", desc = "Validasi rekening giro Bank DKI, NPWP sekolah, dan sinkronisasi pagu komponen e-RKAS.", actor = "Bendahara & Admin" },
            new { step = 2, title = "Dropping Dana & NPD SIPKD", desc = "Konfirmasi SP2D Dropping BOS atau pengajuan NPD BOP hingga terbit persetujuan Sudin & SIPKD.", actor = "PK, PA & Sudin" },
            new { step = 3, title = "Input BKU Belanja & Pajak", desc = "Catat transaksi SPJ (JJ), cek rekening rekanan/VA PLN/e-Order, hitung PPh/PPN, unggah PDF bukti.", actor = "Bendahara (PK)" },
            new { step = 4, title = "Approval Berjenjang TU → PA", desc = "Verifikasi kelengkapan berkas oleh Kasubag TU dilanjutkan persetujuan Kepala Sekolah (PA).", actor = "TU & PA" },
            new { step = 5, title = "Token OTP & Transfer CMS + NTPN", desc = "Kepala Sekolah request Token Bank DKI, eksekusi transfer cashless & pelunasan Kode Billing DJP.", actor = "PA & Bendahara" },
            new { step = 6, title = "BAP Kas, Tutup Buku & Cetak PDF", desc = "Rekonsiliasi mutasi Bank DKI, susun BAP Kas, Tutup Buku, dan unduh Form 22/23/25 & K1–K7.", actor = "PK, PA & Dinas" }
        };

        return Ok(ApiResponse<object>.Ok(new
        {
            jumlahSekolah,
            totalPagu,
            totalRealisasi,
            totalDropping,
            persenSerapan,
            berita,
            peraturan,
            prosedur
        }));
    }

    private async Task<LoginResponse> BuildLoginResponseAsync(AppUser user, int tahunAnggaran)
    {
        var role = await _db.AppRoles.FirstOrDefaultAsync(r => r.RoleCode == user.RoleCode);
        var allModules = await _db.AppModules.Where(m => m.IsActive).OrderBy(m => m.SortOrder).ToListAsync();
        var allMenus = await _db.AppMenus.Where(m => m.IsActive).OrderBy(m => m.SortOrder).ToListAsync();

        var allowedModules = allModules
            .Where(m => m.AllowedRolesCsv.Split(',', StringSplitOptions.RemoveEmptyEntries).Contains(user.RoleCode))
            .Select(m => new AppModuleDto
            {
                KodeAplikasi = m.KodeAplikasi,
                Nama = m.Nama,
                Link = m.Link,
                Deskripsi = m.Deskripsi,
                Icon = m.Icon,
                Menu = allMenus
                    .Where(mn => mn.KodeAplikasi == m.KodeAplikasi &&
                                 mn.AllowedRolesCsv.Split(',', StringSplitOptions.RemoveEmptyEntries).Contains(user.RoleCode))
                    .Select(mn => new AppMenuDto
                    {
                        Nama = mn.Nama,
                        Link = mn.Link,
                        Icon = mn.Icon,
                        AllowedRoles = mn.AllowedRolesCsv.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList()
                    }).ToList()
            })
            .ToList();

        var jwt = ServiceCollectionAuthExtensions.GenerateToken(user, tahunAnggaran, _config);

        return new LoginResponse
        {
            AccessToken = jwt,
            TahunAnggaran = tahunAnggaran,
            User = new UserProfileDto
            {
                Id = user.Id,
                Username = user.Username,
                NamaLengkap = user.NamaLengkap,
                Nrk = user.Nrk,
                Nip = user.Nip,
                Email = user.Email,
                NoHp = user.NoHp,
                RoleCode = user.RoleCode,
                RoleName = role?.RoleName ?? user.RoleCode,
                Jabatan = user.Jabatan,
                WilayahSudin = user.WilayahSudin,
                SekolahId = user.SekolahId,
                Sekolah = user.Sekolah == null ? null : new SekolahSummaryDto
                {
                    Id = user.Sekolah.Id,
                    Npsn = user.Sekolah.Npsn,
                    NamaSekolah = user.Sekolah.NamaSekolah,
                    Jenjang = user.Sekolah.Jenjang,
                    WilayahSudin = user.Sekolah.WilayahSudin,
                    NamaSudin = user.Sekolah.NamaSudin,
                    NoRekBos = user.Sekolah.NoRekBos,
                    NamaRekBos = user.Sekolah.NamaRekBos,
                    SaldoBos = user.Sekolah.SaldoBos,
                    NoRekBop = user.Sekolah.NoRekBop,
                    NamaRekBop = user.Sekolah.NamaRekBop,
                    SaldoBop = user.Sekolah.SaldoBop,
                    NpwpSekolah = user.Sekolah.NpwpSekolah,
                    NamaKepalaSekolah = user.Sekolah.NamaKepalaSekolah,
                    NrkKepalaSekolah = user.Sekolah.NrkKepalaSekolah,
                    NamaBendahara = user.Sekolah.NamaBendahara,
                    NrkBendahara = user.Sekolah.NrkBendahara,
                    IsRekeningConfirmed = user.Sekolah.IsRekeningConfirmed
                }
            },
            ListAplikasi = allowedModules
        };
    }
}

public class ChangePasswordRequest
{
    public string Nrk { get; set; } = string.Empty;
    public string SandiLama { get; set; } = string.Empty;
    public string SandiBaru { get; set; } = string.Empty;
}

public class ForgotPasswordDemoRequest
{
    public string Identifier { get; set; } = string.Empty;
    public string OtpDemo { get; set; } = "123456";
    public string SandiBaru { get; set; } = string.Empty;
}
