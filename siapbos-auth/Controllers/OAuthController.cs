using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SiapBos.Shared.Constants;
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
        var lowerId = identifier.ToLower();
        var user = await _db.AppUsers
            .Include(u => u.Sekolah)
            .FirstOrDefaultAsync(u =>
                u.Username.ToLower() == lowerId || u.Nrk.ToLower() == lowerId || u.Nip == identifier);

        var isPasswordValid = user != null && BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash);

        if (user == null || !isPasswordValid)
        {
            return Unauthorized(ApiResponse<LoginResponse>.Fail("Username / NRK atau Password salah."));
        }

        if (!user.IsActive)
        {
            return StatusCode(403, ApiResponse<LoginResponse>.Fail("Akun pengguna dalam status Nonaktif. Hubungi Administrator."));
        }

        if (user.IsLocked)
        {
            return StatusCode(403, ApiResponse<LoginResponse>.Fail("Akun pengguna sedang terkunci (Lock). Hubungi Administrator untuk Unlock."));
        }

        var response = await BuildLoginResponseAsync(user, req.TahunAnggaran > 0 ? req.TahunAnggaran : 2025);
        return Ok(ApiResponse<LoginResponse>.Ok(response, "Login SIAP BOSP & BOP berhasil."));
    }

    [HttpGet("/api/auth/me")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<LoginResponse>>> Me([FromQuery] int tahunAnggaran = 2026)
    {
        var username = User.FindFirst("username")?.Value;
        var user = await _db.AppUsers.Include(u => u.Sekolah).FirstOrDefaultAsync(u => u.Username == username);
        if (user == null || !user.IsActive || user.IsLocked)
            return Unauthorized(ApiResponse<LoginResponse>.Fail("Sesi pengguna tidak valid atau akun terkunci."));

        var response = await BuildLoginResponseAsync(user, tahunAnggaran > 0 ? tahunAnggaran : 2025, recordTokenLog: false);
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
            aktif = y == 2025,
            label = $"{y}"
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

    private async Task<LoginResponse> BuildLoginResponseAsync(AppUser user, int tahunAnggaran, bool recordTokenLog = true)
    {
        var assignedRoles = await _db.AppUserOtoritas
            .Include(uo => uo.Role)
            .Where(uo => uo.UserId == user.Id && uo.Role != null && uo.Role.IsActive)
            .Select(uo => uo.Role!)
            .OrderBy(r => r.Id)
            .ToListAsync();

        if (assignedRoles.Count == 0 && !string.IsNullOrWhiteSpace(user.RoleCode))
        {
            var fallbackRole = await _db.AppRoles.FirstOrDefaultAsync(r => r.RoleCode == user.RoleCode && r.IsActive);
            if (fallbackRole != null) assignedRoles.Add(fallbackRole);
        }

        var roleIds = assignedRoles.Select(r => r.Id).ToList();
        var roleCodes = assignedRoles.Select(r => r.RoleCode).Distinct().ToList();
        var primaryRole = assignedRoles.FirstOrDefault();
        var primaryRoleCode = primaryRole?.RoleCode ?? user.RoleCode;

        var allowedModuleIds = await _db.AppOtoritasAplikasis
            .Where(oa => roleIds.Contains(oa.RoleId))
            .Select(oa => oa.ModuleId)
            .Distinct()
            .ToListAsync();

        var allowedMenuIds = await _db.AppOtoritasMenus
            .Where(om => roleIds.Contains(om.RoleId))
            .Select(om => om.MenuId)
            .Distinct()
            .ToListAsync();

        var menuRolePairs = await _db.AppOtoritasMenus
            .Include(om => om.Role)
            .Where(om => om.Role != null && om.Role.IsActive)
            .Select(om => new { om.MenuId, RoleCode = om.Role!.RoleCode })
            .ToListAsync();

        var menuRolesLookup = menuRolePairs
            .GroupBy(x => x.MenuId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.RoleCode).Distinct().ToList());

        var modules = await _db.AppModules
            .Where(m => m.IsActive && allowedModuleIds.Contains(m.Id))
            .OrderBy(m => m.SortOrder)
            .ToListAsync();

        var menus = await _db.AppMenus
            .Where(mn => mn.IsActive && allowedMenuIds.Contains(mn.Id))
            .OrderBy(mn => mn.SortOrder)
            .ToListAsync();

        var allowedModules = modules
            .Select(m => new AppModuleDto
            {
                KodeAplikasi = m.KodeAplikasi,
                Nama = m.Nama,
                Link = m.Link,
                Deskripsi = m.Deskripsi,
                Icon = m.Icon,
                Menu = menus
                    .Where(mn => mn.KodeAplikasi == m.KodeAplikasi)
                    .Select(mn => new AppMenuDto
                    {
                        Id = mn.Id,
                        Nama = mn.Nama,
                        Link = mn.Link,
                        Icon = mn.Icon,
                        RequiresSekolah = mn.RequiresSekolah,
                        AllowedRoles = menuRolesLookup.GetValueOrDefault(mn.Id, [])
                    }).ToList()
            })
            .Where(m => m.Menu.Count > 0 || m.KodeAplikasi == "UM")
            .ToList();

        var requiresSchoolPicker = roleCodes.Any(rc =>
            rc == SiapBosRoles.AdminTdi ||
            rc == SiapBosRoles.AdminDinas ||
            rc == SiapBosRoles.Sudin);

        var assignedSekolah = user.Sekolah;
        if (!requiresSchoolPicker && assignedSekolah == null)
        {
            assignedSekolah = await _db.AppUserSekolahs
                .Include(us => us.Sekolah)
                .Where(us => us.UserId == user.Id && us.IsActive && us.Sekolah != null)
                .Select(us => us.Sekolah)
                .FirstOrDefaultAsync();
        }

        var jwt = ServiceCollectionAuthExtensions.GenerateToken(user, tahunAnggaran, _config, roleCodes);

        if (recordTokenLog)
        {
            var tokenId = $"tok-{user.Username.ToLower()}-{Guid.NewGuid():N}"[..28];
            var ipAddr = HttpContext?.Connection?.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            _db.OAuthAccessTokens.Add(new OAuthAccessToken
            {
                TokenId = tokenId,
                UserName = user.Username,
                ClientId = "siapbos-webapp-prod",
                RoleCode = primaryRoleCode,
                TahunAnggaran = tahunAnggaran,
                IpAddress = ipAddr,
                LoginAt = DateTime.UtcNow,
                ExpiredAt = DateTime.UtcNow.AddHours(8)
            });
            _db.OAuthTokenHistories.Add(new OAuthTokenHistory
            {
                AccessId = tokenId,
                UserName = user.Username,
                ClientId = "siapbos-webapp-prod",
                IpAddress = ipAddr,
                LoginAt = DateTime.UtcNow,
                IsLogout = false
            });
            await _db.SaveChangesAsync();
        }

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
                RoleCode = primaryRoleCode,
                ShortCode = primaryRole?.ShortCode ?? primaryRoleCode,
                RoleName = primaryRole?.RoleName ?? primaryRoleCode,
                Roles = roleCodes,
                RequiresSchoolPicker = requiresSchoolPicker,
                Jabatan = user.Jabatan,
                WilayahSudin = user.WilayahSudin,
                SekolahId = assignedSekolah?.Id ?? user.SekolahId,
                IsActive = user.IsActive,
                IsLocked = user.IsLocked,
                Sekolah = assignedSekolah == null ? null : new SekolahSummaryDto
                {
                    Id = assignedSekolah.Id,
                    Npsn = assignedSekolah.Npsn,
                    NamaSekolah = assignedSekolah.NamaSekolah,
                    Jenjang = assignedSekolah.Jenjang,
                    WilayahSudin = assignedSekolah.WilayahSudin,
                    NamaSudin = assignedSekolah.NamaSudin,
                    NoRekBos = assignedSekolah.NoRekBos,
                    NamaRekBos = assignedSekolah.NamaRekBos,
                    SaldoBos = assignedSekolah.SaldoBos,
                    NoRekBop = assignedSekolah.NoRekBop,
                    NamaRekBop = assignedSekolah.NamaRekBop,
                    SaldoBop = assignedSekolah.SaldoBop,
                    NpwpSekolah = assignedSekolah.NpwpSekolah,
                    NamaKepalaSekolah = assignedSekolah.NamaKepalaSekolah,
                    NrkKepalaSekolah = assignedSekolah.NrkKepalaSekolah,
                    NamaBendahara = assignedSekolah.NamaBendahara,
                    NrkBendahara = assignedSekolah.NrkBendahara,
                    IsRekeningConfirmed = assignedSekolah.IsRekeningConfirmed
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
