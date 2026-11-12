using System.Net.Http.Json;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SiapBos.Shared.Constants;
using SiapBos.Shared.Data;
using SiapBos.Shared.DTOs;
using SiapBos.Shared.Entities;
using SiapBos.Shared.Security;
using SiapBos.Shared.Services;

namespace SiapBos.Auth.Controllers;

[ApiController]
[Authorize]
public class PenggunaController : ControllerBase
{
    private readonly SiapBosDbContext _db;
    private readonly IHttpClientFactory _httpClientFactory;

    public PenggunaController(SiapBosDbContext db, IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
    }

    private async Task<bool> HasUmAccessAsync()
    {
        var uid = User.GetUserId();
        if (!uid.HasValue) return false;

        var roles = await _db.AppUserOtoritas
            .Include(uo => uo.Role)
            .Where(uo => uo.UserId == uid.Value && uo.Role != null && uo.Role.IsActive)
            .Select(uo => new { uo.RoleId, uo.Role!.RoleCode })
            .ToListAsync();

        if (roles.Any(r => r.RoleCode == SiapBosRoles.AdminTdi)) return true;

        var roleIds = roles.Select(r => r.RoleId).ToList();
        var umModuleIds = await _db.AppModules
            .Where(m => m.KodeAplikasi == "UM" && m.IsActive)
            .Select(m => m.Id)
            .ToListAsync();

        return await _db.AppOtoritasAplikasis
            .AnyAsync(oa => roleIds.Contains(oa.RoleId) && umModuleIds.Contains(oa.ModuleId));
    }

    private string CurrentActor => User.FindFirst("username")?.Value ?? "SYSTEM";

    // =========================================================================
    // 1. PENGGUNA CRUD, FILTER PENCARIAN, LOCK/AKTIF & KELOLA RELASI
    // =========================================================================

    [HttpGet("/api/pengguna")]
    public async Task<ActionResult<ApiResponse<object>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? nama,
        [FromQuery] string? email,
        [FromQuery] string? nip,
        [FromQuery] string? nrk,
        [FromQuery] string? roleCode,
        [FromQuery] string? otoritas,
        [FromQuery] string? jenjang)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<object>.Fail("Akses ditolak: menu Manajemen Pengguna khusus Administrator / Otoritas UM."));

        var query = _db.AppUsers.Include(u => u.Sekolah).AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            query = query.Where(u =>
                u.Username.ToLower().Contains(q) ||
                u.NamaLengkap.ToLower().Contains(q) ||
                u.Nrk.ToLower().Contains(q) ||
                u.Nip.ToLower().Contains(q) ||
                u.Email.ToLower().Contains(q));
        }

        if (!string.IsNullOrWhiteSpace(nama))
        {
            var n = nama.Trim().ToLower();
            query = query.Where(u => u.NamaLengkap.ToLower().Contains(n));
        }
        if (!string.IsNullOrWhiteSpace(email))
        {
            var e = email.Trim().ToLower();
            query = query.Where(u => u.Email.ToLower().Contains(e));
        }
        if (!string.IsNullOrWhiteSpace(nip))
        {
            var np = nip.Trim().ToLower();
            query = query.Where(u => u.Nip.ToLower().Contains(np));
        }
        if (!string.IsNullOrWhiteSpace(nrk))
        {
            var nr = nrk.Trim().ToLower();
            query = query.Where(u => u.Nrk.ToLower().Contains(nr) || u.Username.ToLower().Contains(nr));
        }
        if (!string.IsNullOrWhiteSpace(jenjang))
        {
            query = query.Where(u => u.Sekolah != null && u.Sekolah.Jenjang == jenjang);
        }

        var roleFilter = !string.IsNullOrWhiteSpace(otoritas) ? otoritas : roleCode;
        var users = await query.OrderBy(u => u.Id).ToListAsync();
        var userIds = users.Select(u => u.Id).ToList();

        var userOtorList = await _db.AppUserOtoritas
            .Include(uo => uo.Role)
            .Where(uo => userIds.Contains(uo.UserId) && uo.Role != null)
            .ToListAsync();

        var userSekolahList = await _db.AppUserSekolahs
            .Include(us => us.Sekolah)
            .Where(us => userIds.Contains(us.UserId) && us.Sekolah != null)
            .ToListAsync();

        var userWilayahList = await _db.AppUserWilayahs
            .Where(uw => userIds.Contains(uw.UserId) && uw.IsActive)
            .ToListAsync();

        var result = users
            .Select(u =>
            {
                var roles = userOtorList
                    .Where(uo => uo.UserId == u.Id)
                    .Select(uo => new { uo.Role!.Id, uo.Role.RoleCode, uo.Role.ShortCode, uo.Role.RoleName })
                    .ToList();

                var schools = userSekolahList
                    .Where(us => us.UserId == u.Id)
                    .Select(us => new { us.Sekolah!.Id, us.Sekolah.Npsn, us.Sekolah.NamaSekolah, us.Sekolah.Jenjang, us.Sekolah.WilayahSudin })
                    .ToList();

                var wilayahs = userWilayahList
                    .Where(uw => uw.UserId == u.Id)
                    .Select(uw => new { uw.KodeWilayah, uw.NamaWilayah })
                    .ToList();

                return new
                {
                    u.Id,
                    u.Username,
                    u.NamaLengkap,
                    u.Nrk,
                    u.Nip,
                    u.Nik,
                    u.Email,
                    u.NoHp,
                    u.RoleCode,
                    u.Jabatan,
                    u.WilayahSudin,
                    u.SekolahId,
                    NamaSekolah = schools.Count > 0 ? string.Join(", ", schools.Select(s => s.NamaSekolah)) : (u.Sekolah != null ? u.Sekolah.NamaSekolah : "-"),
                    Jenjang = schools.FirstOrDefault()?.Jenjang ?? u.Sekolah?.Jenjang ?? "-",
                    OtoritasList = roles,
                    SekolahList = schools,
                    WilayahList = wilayahs,
                    u.IsActive,
                    u.IsLocked,
                    u.CreatedAt
                };
            })
            .Where(x => string.IsNullOrWhiteSpace(roleFilter) ||
                        x.RoleCode == roleFilter ||
                        x.OtoritasList.Any(r => r.RoleCode == roleFilter))
            .ToList();

        return Ok(ApiResponse<object>.Ok(result));
    }

    [HttpGet("/api/pengguna/{id:int}")]
    public async Task<ActionResult<ApiResponse<object>>> GetById(int id)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<object>.Fail("Akses ditolak."));

        var user = await _db.AppUsers.Include(u => u.Sekolah).FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound(ApiResponse<object>.Fail("Pengguna tidak ditemukan."));

        var otor = await _db.AppUserOtoritas.Include(x => x.Role).Where(x => x.UserId == id && x.Role != null).Select(x => x.Role!).ToListAsync();
        var schools = await _db.AppUserSekolahs.Include(x => x.Sekolah).Where(x => x.UserId == id && x.Sekolah != null).Select(x => x.Sekolah!).ToListAsync();
        var wilayah = await _db.AppUserWilayahs.Where(x => x.UserId == id && x.IsActive).ToListAsync();

        return Ok(ApiResponse<object>.Ok(new { user, otoritas = otor, sekolah = schools, wilayah }));
    }

    [HttpPost("/api/pengguna")]
    public async Task<ActionResult<ApiResponse<AppUser>>> Create([FromBody] CreatePenggunaRequest req)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<AppUser>.Fail("Akses ditolak."));

        if (string.IsNullOrWhiteSpace(req.Username))
            return BadRequest(ApiResponse<AppUser>.Fail("Username wajib diisi."));

        if (await _db.AppUsers.AnyAsync(u => u.Username.ToLower() == req.Username.Trim().ToLower()))
            return BadRequest(ApiResponse<AppUser>.Fail("Username sudah terdaftar."));

        var role = await _db.AppRoles.FirstOrDefaultAsync(r => r.RoleCode == req.RoleCode);
        if (role == null)
            return BadRequest(ApiResponse<AppUser>.Fail($"Otoritas '{req.RoleCode}' tidak ditemukan di database."));

        var user = new AppUser
        {
            Username = req.Username.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(string.IsNullOrWhiteSpace(req.Password) ? "password123" : req.Password),
            NamaLengkap = req.NamaLengkap.Trim(),
            Nrk = string.IsNullOrWhiteSpace(req.Nrk) ? req.Username.Trim() : req.Nrk.Trim(),
            Nip = req.Nip.Trim(),
            Nik = req.Nik.Trim(),
            Email = req.Email.Trim(),
            NoHp = req.NoHp.Trim(),
            RoleCode = role.RoleCode,
            Jabatan = string.IsNullOrWhiteSpace(req.Jabatan) ? role.RoleName : req.Jabatan.Trim(),
            WilayahSudin = string.IsNullOrWhiteSpace(req.WilayahSudin) ? "ALL" : req.WilayahSudin.Trim(),
            SekolahId = req.SekolahId,
            IsActive = req.IsActive,
            IsLocked = req.IsLocked
        };

        _db.AppUsers.Add(user);
        await _db.SaveChangesAsync();

        _db.AppUserOtoritas.Add(new AppUserOtoritas { UserId = user.Id, RoleId = role.Id, CreatedBy = CurrentActor });

        if (req.SekolahId.HasValue)
        {
            _db.AppUserSekolahs.Add(new AppUserSekolah { UserId = user.Id, SekolahId = req.SekolahId.Value, IsActive = true, CreatedBy = CurrentActor });
        }

        if (!string.IsNullOrWhiteSpace(user.WilayahSudin))
        {
            _db.AppUserWilayahs.Add(new AppUserWilayah
            {
                UserId = user.Id,
                KodeWilayah = user.WilayahSudin,
                NamaWilayah = ResolveWilayahName(user.WilayahSudin),
                IsActive = true
            });
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<AppUser>.Ok(user, "Pengguna baru berhasil ditambahkan."));
    }

    [HttpPut("/api/pengguna/{id:int}")]
    public async Task<ActionResult<ApiResponse<AppUser>>> Update(int id, [FromBody] CreatePenggunaRequest req)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<AppUser>.Fail("Akses ditolak."));

        var user = await _db.AppUsers.FindAsync(id);
        if (user == null) return NotFound(ApiResponse<AppUser>.Fail("Pengguna tidak ditemukan."));

        var role = await _db.AppRoles.FirstOrDefaultAsync(r => r.RoleCode == req.RoleCode);
        if (role == null)
            return BadRequest(ApiResponse<AppUser>.Fail($"Otoritas '{req.RoleCode}' tidak ditemukan."));

        user.NamaLengkap = req.NamaLengkap.Trim();
        user.Nrk = req.Nrk.Trim();
        user.Nip = req.Nip.Trim();
        user.Nik = req.Nik.Trim();
        user.Email = req.Email.Trim();
        user.NoHp = req.NoHp.Trim();
        user.RoleCode = role.RoleCode;
        user.Jabatan = req.Jabatan.Trim();
        user.WilayahSudin = string.IsNullOrWhiteSpace(req.WilayahSudin) ? "ALL" : req.WilayahSudin.Trim();
        user.SekolahId = req.SekolahId;
        user.IsActive = req.IsActive;
        user.IsLocked = req.IsLocked;

        if (!string.IsNullOrWhiteSpace(req.Password))
        {
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password);
        }

        // Pastikan primary role selalu tercatat pada relasi trsiappenggunaotoritas
        var existingRoles = await _db.AppUserOtoritas.Where(uo => uo.UserId == user.Id).ToListAsync();
        if (!existingRoles.Any(uo => uo.RoleId == role.Id))
        {
            _db.AppUserOtoritas.Add(new AppUserOtoritas { UserId = user.Id, RoleId = role.Id, CreatedBy = CurrentActor });
        }

        if (req.SekolahId.HasValue)
        {
            var hasSec = await _db.AppUserSekolahs.AnyAsync(us => us.UserId == user.Id && us.SekolahId == req.SekolahId.Value);
            if (!hasSec)
                _db.AppUserSekolahs.Add(new AppUserSekolah { UserId = user.Id, SekolahId = req.SekolahId.Value, IsActive = true, CreatedBy = CurrentActor });
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<AppUser>.Ok(user, "Data pengguna berhasil diperbarui."));
    }

    [HttpPut("/api/pengguna/set-lock")]
    public async Task<ActionResult<ApiResponse<object>>> SetLock([FromBody] BatchStatusRequest req)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<object>.Fail("Akses ditolak."));

        if (req.UserIds == null || req.UserIds.Count == 0)
            return BadRequest(ApiResponse<object>.Fail("Pilih minimal satu pengguna."));

        var users = await _db.AppUsers.Where(u => req.UserIds.Contains(u.Id)).ToListAsync();
        foreach (var u in users)
        {
            if (u.Username == "ADMIN-TDI" && req.Flag) continue; // Guard superadmin
            u.IsLocked = req.Flag;
        }
        await _db.SaveChangesAsync();
        var label = req.Flag ? "dikunci (Lock)" : "dibuka kuncinya (Unlock)";
        return Ok(ApiResponse<object>.Ok(new { updated = users.Count }, $"{users.Count} pengguna berhasil {label}."));
    }

    [HttpPut("/api/pengguna/set-aktif")]
    public async Task<ActionResult<ApiResponse<object>>> SetAktif([FromBody] BatchStatusRequest req)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<object>.Fail("Akses ditolak."));

        if (req.UserIds == null || req.UserIds.Count == 0)
            return BadRequest(ApiResponse<object>.Fail("Pilih minimal satu pengguna."));

        var users = await _db.AppUsers.Where(u => req.UserIds.Contains(u.Id)).ToListAsync();
        foreach (var u in users)
        {
            if (u.Username == "ADMIN-TDI" && !req.Flag) continue;
            u.IsActive = req.Flag;
        }
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { updated = users.Count }, $"Status aktif {users.Count} pengguna berhasil diperbarui."));
    }

    [HttpPut("/api/pengguna/{id:int}/reset-password")]
    public async Task<ActionResult<ApiResponse<string>>> AdminResetPassword(int id, [FromBody] AdminResetPasswordRequest req)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<string>.Fail("Akses ditolak."));

        if (string.IsNullOrWhiteSpace(req.SandiBaru) || req.SandiBaru.Length < 6)
            return BadRequest(ApiResponse<string>.Fail("Sandi baru minimal 6 karakter."));

        var user = await _db.AppUsers.FindAsync(id);
        if (user == null) return NotFound(ApiResponse<string>.Fail("Pengguna tidak ditemukan."));

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.SandiBaru);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<string>.Ok("OK", $"Kata sandi pengguna {user.Username} berhasil diubah."));
    }

    [HttpDelete("/api/pengguna/{id:int}")]
    public async Task<ActionResult<ApiResponse<string>>> DeletePengguna(int id)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<string>.Fail("Akses ditolak."));

        var user = await _db.AppUsers.FindAsync(id);
        if (user == null) return NotFound(ApiResponse<string>.Fail("Pengguna tidak ditemukan."));
        if (string.Equals(user.Username, "ADMIN-TDI", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(user.Username, CurrentActor, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(ApiResponse<string>.Fail("Tidak dapat menghapus akun superadmin atau akun yang sedang login."));
        }

        _db.AppUsers.Remove(user);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<string>.Ok("OK", $"Pengguna {user.Username} berhasil dihapus."));
    }

    // --- Kelola Otoritas Pengguna ---
    [HttpGet("/api/pengguna/{id:int}/otoritas")]
    public async Task<ActionResult<ApiResponse<object>>> GetPenggunaOtoritas(int id)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<object>.Fail("Akses ditolak."));

        var allRoles = await _db.AppRoles.Where(r => r.IsActive).OrderBy(r => r.Id).ToListAsync();
        var assignedIds = await _db.AppUserOtoritas.Where(uo => uo.UserId == id).Select(uo => uo.RoleId).ToListAsync();

        var assigned = allRoles.Where(r => assignedIds.Contains(r.Id)).ToList();
        var available = allRoles.Where(r => !assignedIds.Contains(r.Id)).ToList();

        return Ok(ApiResponse<object>.Ok(new { assigned, available }));
    }

    [HttpPut("/api/pengguna/{id:int}/otoritas")]
    public async Task<ActionResult<ApiResponse<object>>> SavePenggunaOtoritas(int id, [FromBody] SaveRoleIdsRequest req)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<object>.Fail("Akses ditolak."));

        var user = await _db.AppUsers.FindAsync(id);
        if (user == null) return NotFound(ApiResponse<object>.Fail("Pengguna tidak ditemukan."));

        var validRoles = await _db.AppRoles.Where(r => req.RoleIds.Contains(r.Id)).OrderBy(r => r.Id).ToListAsync();
        if (validRoles.Count == 0)
            return BadRequest(ApiResponse<object>.Fail("Pengguna wajib memiliki minimal satu Otoritas."));

        var existing = await _db.AppUserOtoritas.Where(uo => uo.UserId == id).ToListAsync();
        _db.AppUserOtoritas.RemoveRange(existing);

        foreach (var r in validRoles)
        {
            _db.AppUserOtoritas.Add(new AppUserOtoritas { UserId = id, RoleId = r.Id, CreatedBy = CurrentActor });
        }

        user.RoleCode = validRoles[0].RoleCode;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(validRoles, $"Otoritas pengguna {user.Username} berhasil disimpan."));
    }

    // --- Kelola Sekolah Pengguna ---
    [HttpGet("/api/pengguna/{id:int}/sekolah")]
    public async Task<ActionResult<ApiResponse<object>>> GetPenggunaSekolah(int id)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<object>.Fail("Akses ditolak."));

        var allSekolah = await _db.Sekolahs.OrderBy(s => s.NamaSekolah).ToListAsync();
        var assignedIds = await _db.AppUserSekolahs.Where(us => us.UserId == id && us.IsActive).Select(us => us.SekolahId).ToListAsync();

        var assigned = allSekolah.Where(s => assignedIds.Contains(s.Id)).ToList();
        var available = allSekolah.Where(s => !assignedIds.Contains(s.Id)).ToList();

        return Ok(ApiResponse<object>.Ok(new { assigned, available }));
    }

    [HttpPut("/api/pengguna/{id:int}/sekolah")]
    public async Task<ActionResult<ApiResponse<object>>> SavePenggunaSekolah(int id, [FromBody] SaveSekolahIdsRequest req)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<object>.Fail("Akses ditolak."));

        var user = await _db.AppUsers.FindAsync(id);
        if (user == null) return NotFound(ApiResponse<object>.Fail("Pengguna tidak ditemukan."));

        var validSekolahs = await _db.Sekolahs.Where(s => req.SekolahIds.Contains(s.Id)).OrderBy(s => s.Id).ToListAsync();
        var existing = await _db.AppUserSekolahs.Where(us => us.UserId == id).ToListAsync();
        _db.AppUserSekolahs.RemoveRange(existing);

        foreach (var s in validSekolahs)
        {
            _db.AppUserSekolahs.Add(new AppUserSekolah { UserId = id, SekolahId = s.Id, IsActive = true, CreatedBy = CurrentActor });
        }

        user.SekolahId = validSekolahs.FirstOrDefault()?.Id;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(validSekolahs, $"Daftar sekolah untuk {user.Username} berhasil diperbarui."));
    }

    // --- Kelola OPD / Wilayah Pengguna ---
    [HttpGet("/api/pengguna/{id:int}/wilayah")]
    public async Task<ActionResult<ApiResponse<object>>> GetPenggunaWilayah(int id)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<object>.Fail("Akses ditolak."));

        var allWilayah = GetMasterWilayahList();
        var assignedCodes = await _db.AppUserWilayahs
            .Where(w => w.UserId == id && w.IsActive)
            .Select(w => w.KodeWilayah)
            .ToListAsync();

        var assigned = allWilayah.Where(w => assignedCodes.Contains(w.Kode)).ToList();
        var available = allWilayah.Where(w => !assignedCodes.Contains(w.Kode)).ToList();
        return Ok(ApiResponse<object>.Ok(new { assigned, available }));
    }

    [HttpPut("/api/pengguna/{id:int}/wilayah")]
    public async Task<ActionResult<ApiResponse<object>>> SavePenggunaWilayah(int id, [FromBody] SaveWilayahRequest req)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<object>.Fail("Akses ditolak."));

        var user = await _db.AppUsers.FindAsync(id);
        if (user == null) return NotFound(ApiResponse<object>.Fail("Pengguna tidak ditemukan."));

        var existing = await _db.AppUserWilayahs.Where(w => w.UserId == id).ToListAsync();
        _db.AppUserWilayahs.RemoveRange(existing);

        var cleanCodes = (req.KodeWilayahList ?? []).Where(k => !string.IsNullOrWhiteSpace(k)).Distinct().ToList();
        foreach (var kode in cleanCodes)
        {
            _db.AppUserWilayahs.Add(new AppUserWilayah
            {
                UserId = id,
                KodeWilayah = kode,
                NamaWilayah = ResolveWilayahName(kode),
                IsActive = true
            });
        }

        user.WilayahSudin = cleanCodes.Contains("ALL") ? "ALL" : (cleanCodes.FirstOrDefault() ?? "JP");
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(cleanCodes, $"Wilayah OPD untuk {user.Username} berhasil disimpan."));
    }

    [HttpGet("/api/pengguna/cek-simpeg/{nrk}")]
    public async Task<ActionResult<ApiResponse<SimpegPegawaiResponse>>> CekSimpeg(string nrk)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<SimpegPegawaiResponse>.Fail("Akses ditolak."));

        try
        {
            var client = _httpClientFactory.CreateClient("IntegrationClient");
            var resp = await client.GetAsync($"/api/simpeg/getPegawai/byNrk?nrk={Uri.EscapeDataString(nrk)}");
            if (resp.IsSuccessStatusCode)
            {
                var result = await resp.Content.ReadFromJsonAsync<ApiResponse<SimpegPegawaiResponse>>();
                if (result?.Success == true && result.Data != null)
                    return Ok(result);
            }
        }
        catch
        {
            // Fallback to local dummy SIMPEG profile if integration service is unavailable
        }

        var existingUser = await _db.AppUsers.Include(u => u.Sekolah).FirstOrDefaultAsync(u => u.Nrk == nrk.Trim());
        var dummy = DummyIntegrationFactory.BuildSimpegPegawai(nrk, existingUser);
        return Ok(ApiResponse<SimpegPegawaiResponse>.Ok(dummy));
    }

    // =========================================================================
    // 2. OTORITAS (ROLE), KELOLA APLIKASI & KELOLA MENU (RBAC MATRIKS)
    // =========================================================================

    [HttpGet("/api/otoritas")]
    public async Task<ActionResult<ApiResponse<object>>> GetOtoritas()
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<object>.Fail("Akses ditolak."));

        var roles = await _db.AppRoles.OrderBy(r => r.Id).ToListAsync();
        var userCounts = await _db.AppUserOtoritas.GroupBy(x => x.RoleId).Select(g => new { RoleId = g.Key, Cnt = g.Count() }).ToDictionaryAsync(x => x.RoleId, x => x.Cnt);
        var appCounts = await _db.AppOtoritasAplikasis.GroupBy(x => x.RoleId).Select(g => new { RoleId = g.Key, Cnt = g.Count() }).ToDictionaryAsync(x => x.RoleId, x => x.Cnt);
        var menuCounts = await _db.AppOtoritasMenus.GroupBy(x => x.RoleId).Select(g => new { RoleId = g.Key, Cnt = g.Count() }).ToDictionaryAsync(x => x.RoleId, x => x.Cnt);

        var data = roles.Select(r => new
        {
            r.Id,
            r.RoleCode,
            r.ShortCode,
            r.RoleName,
            r.Deskripsi,
            r.Level,
            r.IsActive,
            UserCount = userCounts.GetValueOrDefault(r.Id, 0),
            AppCount = appCounts.GetValueOrDefault(r.Id, 0),
            MenuCount = menuCounts.GetValueOrDefault(r.Id, 0)
        }).ToList();

        return Ok(ApiResponse<object>.Ok(data));
    }

    [HttpPost("/api/otoritas")]
    public async Task<ActionResult<ApiResponse<AppRole>>> CreateOtoritas([FromBody] SaveOtoritasRequest req)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<AppRole>.Fail("Akses ditolak."));

        if (string.IsNullOrWhiteSpace(req.RoleCode) || string.IsNullOrWhiteSpace(req.RoleName))
            return BadRequest(ApiResponse<AppRole>.Fail("Kode dan Nama Otoritas wajib diisi."));

        var code = req.RoleCode.Trim().ToUpperInvariant();
        if (await _db.AppRoles.AnyAsync(r => r.RoleCode == code))
            return BadRequest(ApiResponse<AppRole>.Fail($"Kode Otoritas '{code}' sudah ada."));

        var role = new AppRole
        {
            RoleCode = code,
            ShortCode = string.IsNullOrWhiteSpace(req.ShortCode) ? code[..Math.Min(4, code.Length)] : req.ShortCode.Trim().ToUpperInvariant(),
            RoleName = req.RoleName.Trim(),
            Deskripsi = req.Deskripsi?.Trim() ?? "",
            Level = string.IsNullOrWhiteSpace(req.Level) ? "SEKOLAH" : req.Level.Trim().ToUpperInvariant(),
            IsActive = req.IsActive
        };
        _db.AppRoles.Add(role);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<AppRole>.Ok(role, "Otoritas baru berhasil ditambahkan."));
    }

    [HttpPut("/api/otoritas/{id:int}")]
    public async Task<ActionResult<ApiResponse<AppRole>>> UpdateOtoritas(int id, [FromBody] SaveOtoritasRequest req)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<AppRole>.Fail("Akses ditolak."));

        var role = await _db.AppRoles.FindAsync(id);
        if (role == null) return NotFound(ApiResponse<AppRole>.Fail("Otoritas tidak ditemukan."));

        role.ShortCode = string.IsNullOrWhiteSpace(req.ShortCode) ? role.ShortCode : req.ShortCode.Trim().ToUpperInvariant();
        role.RoleName = req.RoleName.Trim();
        role.Deskripsi = req.Deskripsi?.Trim() ?? "";
        role.Level = string.IsNullOrWhiteSpace(req.Level) ? role.Level : req.Level.Trim().ToUpperInvariant();
        role.IsActive = req.IsActive;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<AppRole>.Ok(role, $"Otoritas {role.RoleCode} berhasil diperbarui."));
    }

    [HttpDelete("/api/otoritas/{id:int}")]
    public async Task<ActionResult<ApiResponse<string>>> DeleteOtoritas(int id)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<string>.Fail("Akses ditolak."));

        var role = await _db.AppRoles.FindAsync(id);
        if (role == null) return NotFound(ApiResponse<string>.Fail("Otoritas tidak ditemukan."));
        if (role.RoleCode == SiapBosRoles.AdminTdi)
            return BadRequest(ApiResponse<string>.Fail("Otoritas superadmin ADMIN-TDI tidak boleh dihapus."));
        if (await _db.AppUserOtoritas.AnyAsync(x => x.RoleId == id))
            return BadRequest(ApiResponse<string>.Fail("Otoritas masih digunakan oleh pengguna. Lepaskan relasi pengguna terlebih dahulu."));

        _db.AppRoles.Remove(role);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<string>.Ok("OK", $"Otoritas {role.RoleCode} berhasil dihapus."));
    }

    [HttpGet("/api/otoritas/{id:int}/aplikasi")]
    public async Task<ActionResult<ApiResponse<object>>> GetOtoritasAplikasi(int id)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<object>.Fail("Akses ditolak."));

        var allApps = await _db.AppModules.OrderBy(m => m.SortOrder).ToListAsync();
        var assignedIds = await _db.AppOtoritasAplikasis.Where(oa => oa.RoleId == id).Select(oa => oa.ModuleId).ToListAsync();

        var assigned = allApps.Where(m => assignedIds.Contains(m.Id)).ToList();
        var available = allApps.Where(m => m.IsActive && !assignedIds.Contains(m.Id)).ToList();
        return Ok(ApiResponse<object>.Ok(new { assigned, available }));
    }

    [HttpPut("/api/otoritas/{id:int}/aplikasi")]
    public async Task<ActionResult<ApiResponse<object>>> SaveOtoritasAplikasi(int id, [FromBody] SaveModuleIdsRequest req)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<object>.Fail("Akses ditolak."));

        var role = await _db.AppRoles.FindAsync(id);
        if (role == null) return NotFound(ApiResponse<object>.Fail("Otoritas tidak ditemukan."));

        var validApps = await _db.AppModules.Where(m => req.ModuleIds.Contains(m.Id)).ToListAsync();

        var existing = await _db.AppOtoritasAplikasis.Where(oa => oa.RoleId == id).ToListAsync();
        var existingModuleIds = existing.Select(oa => oa.ModuleId).ToHashSet();
        _db.AppOtoritasAplikasis.RemoveRange(existing);

        foreach (var app in validApps)
        {
            _db.AppOtoritasAplikasis.Add(new AppOtoritasAplikasi { RoleId = id, ModuleId = app.Id, CreatedBy = CurrentActor });
        }

        // Pertahankan hak sub-menu yang sudah ada bila aplikasi dinonaktifkan sementara agar saat diaktifkan kembali tidak hilang.
        // Jika aplikasi baru ditambahkan dan role belum punya sub-menu untuk modul tersebut, beri default sub-menu aktifnya.
        var addedApps = validApps.Where(a => !existingModuleIds.Contains(a.Id)).ToList();
        if (addedApps.Count > 0)
        {
            var addedCodes = addedApps.Select(a => a.KodeAplikasi).Distinct().ToList();
            var existingRoleMenusByApp = await _db.AppOtoritasMenus
                .Include(om => om.Menu)
                .Where(om => om.RoleId == id && om.Menu != null && addedCodes.Contains(om.Menu.KodeAplikasi))
                .Select(om => om.Menu!.KodeAplikasi)
                .Distinct()
                .ToListAsync();

            var codesNeedingDefaultMenus = addedCodes
                .Where(c => !existingRoleMenusByApp.Contains(c))
                .ToList();

            if (codesNeedingDefaultMenus.Count > 0)
            {
                var defaultMenuIds = await _db.AppMenus
                    .Where(mn => mn.IsActive && codesNeedingDefaultMenus.Contains(mn.KodeAplikasi))
                    .Select(mn => mn.Id)
                    .ToListAsync();

                foreach (var mid in defaultMenuIds)
                {
                    _db.AppOtoritasMenus.Add(new AppOtoritasMenu { RoleId = id, MenuId = mid, CreatedBy = CurrentActor });
                }
            }
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(validApps, $"Hak akses aplikasi untuk {role.RoleCode} berhasil disimpan."));
    }

    [HttpGet("/api/otoritas/{id:int}/menu")]
    public async Task<ActionResult<ApiResponse<object>>> GetOtoritasMenu(int id, [FromQuery] string? kodeAplikasi)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<object>.Fail("Akses ditolak."));

        var appIds = await _db.AppOtoritasAplikasis.Where(oa => oa.RoleId == id).Select(oa => oa.ModuleId).ToListAsync();
        var assignedModules = await _db.AppModules.Where(m => appIds.Contains(m.Id) && m.IsActive).OrderBy(m => m.SortOrder).ToListAsync();
        var activeKode = !string.IsNullOrWhiteSpace(kodeAplikasi) ? kodeAplikasi : assignedModules.FirstOrDefault()?.KodeAplikasi;

        var allMenusInApp = string.IsNullOrWhiteSpace(activeKode)
            ? []
            : await _db.AppMenus.Where(mn => mn.IsActive && mn.KodeAplikasi == activeKode).OrderBy(mn => mn.SortOrder).ToListAsync();

        var assignedMenuIds = await _db.AppOtoritasMenus.Where(om => om.RoleId == id).Select(om => om.MenuId).ToListAsync();

        var assigned = allMenusInApp.Where(mn => assignedMenuIds.Contains(mn.Id)).ToList();
        var available = allMenusInApp.Where(mn => !assignedMenuIds.Contains(mn.Id)).ToList();

        return Ok(ApiResponse<object>.Ok(new { kodeAplikasi = activeKode, assignedModules, assigned, available }));
    }

    [HttpPut("/api/otoritas/{id:int}/menu")]
    public async Task<ActionResult<ApiResponse<object>>> SaveOtoritasMenu(int id, [FromBody] SaveMenuIdsRequest req)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<object>.Fail("Akses ditolak."));

        var role = await _db.AppRoles.FindAsync(id);
        if (role == null) return NotFound(ApiResponse<object>.Fail("Otoritas tidak ditemukan."));

        var appMenuIds = await _db.AppMenus.Where(mn => mn.KodeAplikasi == req.KodeAplikasi).Select(mn => mn.Id).ToListAsync();
        var existing = await _db.AppOtoritasMenus.Where(om => om.RoleId == id && appMenuIds.Contains(om.MenuId)).ToListAsync();
        _db.AppOtoritasMenus.RemoveRange(existing);

        var validMenuIds = appMenuIds.Intersect(req.MenuIds ?? []).Distinct().ToList();
        foreach (var mid in validMenuIds)
        {
            _db.AppOtoritasMenus.Add(new AppOtoritasMenu { RoleId = id, MenuId = mid, CreatedBy = CurrentActor });
        }

        // Pastikan modul induknya otomatis terhubung ke Otoritas bila ada menu yang dicentang
        var mod = await _db.AppModules.FirstOrDefaultAsync(m => m.KodeAplikasi == req.KodeAplikasi);
        if (mod != null && validMenuIds.Count > 0 && !await _db.AppOtoritasAplikasis.AnyAsync(oa => oa.RoleId == id && oa.ModuleId == mod.Id))
        {
            _db.AppOtoritasAplikasis.Add(new AppOtoritasAplikasi { RoleId = id, ModuleId = mod.Id, CreatedBy = CurrentActor });
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(validMenuIds, $"Hak sub-menu modul {req.KodeAplikasi} untuk {role.RoleCode} berhasil disimpan."));
    }

    // =========================================================================
    // 3. APLIKASI & MENU MASTER
    // =========================================================================

    [HttpGet("/api/aplikasi")]
    public async Task<ActionResult<ApiResponse<List<AppModule>>>> GetAplikasi()
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<List<AppModule>>.Fail("Akses ditolak."));
        return Ok(ApiResponse<List<AppModule>>.Ok(await _db.AppModules.OrderBy(m => m.SortOrder).ToListAsync()));
    }

    [HttpPut("/api/aplikasi/{id:int}")]
    public async Task<ActionResult<ApiResponse<AppModule>>> UpdateAplikasi(int id, [FromBody] SaveModuleRequest req)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<AppModule>.Fail("Akses ditolak."));

        var mod = await _db.AppModules.FindAsync(id);
        if (mod == null) return NotFound(ApiResponse<AppModule>.Fail("Aplikasi tidak ditemukan."));
        mod.Nama = req.Nama.Trim();
        mod.Deskripsi = req.Deskripsi.Trim();
        mod.Icon = req.Icon.Trim();
        mod.SortOrder = req.SortOrder;
        mod.IsActive = req.IsActive;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<AppModule>.Ok(mod, "Master Aplikasi berhasil diperbarui."));
    }

    [HttpGet("/api/menu")]
    public async Task<ActionResult<ApiResponse<object>>> GetMenu([FromQuery] string? kodeAplikasi)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<object>.Fail("Akses ditolak."));

        var query = _db.AppMenus.AsQueryable();
        if (!string.IsNullOrWhiteSpace(kodeAplikasi))
            query = query.Where(m => m.KodeAplikasi == kodeAplikasi);

        var menus = await query.OrderBy(m => m.KodeAplikasi).ThenBy(m => m.SortOrder).ToListAsync();
        var menuIds = menus.Select(m => m.Id).ToList();

        var roleMappings = await _db.AppOtoritasMenus
            .Include(om => om.Role)
            .Where(om => menuIds.Contains(om.MenuId) && om.Role != null && om.Role.IsActive)
            .ToListAsync();

        var data = menus.Select(m => new
        {
            m.Id,
            m.KodeAplikasi,
            m.Nama,
            m.Link,
            m.Icon,
            m.RequiresSekolah,
            m.SortOrder,
            m.IsActive,
            AllowedRoles = roleMappings.Where(rm => rm.MenuId == m.Id).Select(rm => rm.Role!.RoleCode).Distinct().ToList()
        }).ToList();

        return Ok(ApiResponse<object>.Ok(data));
    }

    [HttpPost("/api/menu")]
    public async Task<ActionResult<ApiResponse<AppMenu>>> CreateMenu([FromBody] SaveMenuRequest req)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<AppMenu>.Fail("Akses ditolak."));

        var menu = new AppMenu
        {
            KodeAplikasi = req.KodeAplikasi.Trim().ToUpperInvariant(),
            Nama = req.Nama.Trim(),
            Link = req.Link.Trim(),
            Icon = string.IsNullOrWhiteSpace(req.Icon) ? "bi-circle" : req.Icon.Trim(),
            RequiresSekolah = req.RequiresSekolah,
            SortOrder = req.SortOrder,
            IsActive = req.IsActive
        };
        _db.AppMenus.Add(menu);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<AppMenu>.Ok(menu, "Sub-menu berhasil ditambahkan."));
    }

    [HttpPut("/api/menu/{id:int}")]
    public async Task<ActionResult<ApiResponse<AppMenu>>> UpdateMenu(int id, [FromBody] SaveMenuRequest req)
    {
        if (!await HasUmAccessAsync())
            return StatusCode(403, ApiResponse<AppMenu>.Fail("Akses ditolak."));

        var menu = await _db.AppMenus.FindAsync(id);
        if (menu == null) return NotFound(ApiResponse<AppMenu>.Fail("Menu tidak ditemukan."));

        menu.Nama = req.Nama.Trim();
        menu.Link = req.Link.Trim();
        menu.Icon = string.IsNullOrWhiteSpace(req.Icon) ? menu.Icon : req.Icon.Trim();
        menu.RequiresSekolah = req.RequiresSekolah;
        menu.SortOrder = req.SortOrder;
        menu.IsActive = req.IsActive;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<AppMenu>.Ok(menu, "Sub-menu berhasil diperbarui."));
    }

    private static List<WilayahItem> GetMasterWilayahList() =>
    [
        new("ALL", "Semua Wilayah Provinsi DKI Jakarta"),
        new("JP", "Jakarta Pusat"),
        new("JU", "Jakarta Utara"),
        new("JB", "Jakarta Barat"),
        new("JS", "Jakarta Selatan"),
        new("JT", "Jakarta Timur")
    ];

    private static string ResolveWilayahName(string kode) =>
        GetMasterWilayahList().FirstOrDefault(w => w.Kode == kode)?.Nama ?? kode;

    private record WilayahItem(string Kode, string Nama);
}

public class CreatePenggunaRequest
{
    public string Username { get; set; } = string.Empty;
    public string? Password { get; set; }
    public string NamaLengkap { get; set; } = string.Empty;
    public string Nrk { get; set; } = string.Empty;
    public string Nip { get; set; } = string.Empty;
    public string Nik { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string NoHp { get; set; } = string.Empty;
    public string RoleCode { get; set; } = "PK-NEGERI";
    public string Jabatan { get; set; } = string.Empty;
    public string WilayahSudin { get; set; } = "JP";
    public int? SekolahId { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsLocked { get; set; } = false;
}

public class BatchStatusRequest
{
    public List<int> UserIds { get; set; } = [];
    public bool Flag { get; set; }
}

public class AdminResetPasswordRequest
{
    public string SandiBaru { get; set; } = string.Empty;
}

public class SaveRoleIdsRequest
{
    public List<int> RoleIds { get; set; } = [];
}

public class SaveSekolahIdsRequest
{
    public List<int> SekolahIds { get; set; } = [];
}

public class SaveWilayahRequest
{
    public List<string> KodeWilayahList { get; set; } = [];
}

public class SaveOtoritasRequest
{
    public string RoleCode { get; set; } = string.Empty;
    public string ShortCode { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
    public string Deskripsi { get; set; } = string.Empty;
    public string Level { get; set; } = "SEKOLAH";
    public bool IsActive { get; set; } = true;
}

public class SaveModuleIdsRequest
{
    public List<int> ModuleIds { get; set; } = [];
}

public class SaveMenuIdsRequest
{
    public string KodeAplikasi { get; set; } = string.Empty;
    public List<int> MenuIds { get; set; } = [];
}

public class SaveModuleRequest
{
    public string Nama { get; set; } = string.Empty;
    public string Deskripsi { get; set; } = string.Empty;
    public string Icon { get; set; } = "bi-wallet2";
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class SaveMenuRequest
{
    public string KodeAplikasi { get; set; } = "BOS";
    public string Nama { get; set; } = string.Empty;
    public string Link { get; set; } = string.Empty;
    public string Icon { get; set; } = "bi-circle";
    public bool RequiresSekolah { get; set; } = false;
    public int SortOrder { get; set; } = 1;
    public bool IsActive { get; set; } = true;
}
