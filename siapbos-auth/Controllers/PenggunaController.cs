using System.Net.Http.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SiapBos.Shared.Data;
using SiapBos.Shared.DTOs;
using SiapBos.Shared.Entities;

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

    [HttpGet("/api/pengguna")]
    public async Task<ActionResult<ApiResponse<object>>> GetAll([FromQuery] string? search, [FromQuery] string? roleCode)
    {
        var query = _db.AppUsers.Include(u => u.Sekolah).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.ToLower();
            query = query.Where(u => u.Username.ToLower().Contains(q) || u.NamaLengkap.ToLower().Contains(q) || u.Nrk.Contains(q));
        }
        if (!string.IsNullOrWhiteSpace(roleCode))
            query = query.Where(u => u.RoleCode == roleCode);

        var data = await query.OrderBy(u => u.Id).Select(u => new
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
            NamaSekolah = u.Sekolah != null ? u.Sekolah.NamaSekolah : "-",
            u.IsActive,
            u.CreatedAt
        }).ToListAsync();

        return Ok(ApiResponse<object>.Ok(data));
    }

    [HttpPost("/api/pengguna")]
    public async Task<ActionResult<ApiResponse<AppUser>>> Create([FromBody] CreatePenggunaRequest req)
    {
        if (await _db.AppUsers.AnyAsync(u => u.Username == req.Username))
            return BadRequest(ApiResponse<AppUser>.Fail("Username sudah terdaftar."));

        var user = new AppUser
        {
            Username = req.Username.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(string.IsNullOrWhiteSpace(req.Password) ? "password123" : req.Password),
            NamaLengkap = req.NamaLengkap,
            Nrk = req.Nrk,
            Nip = req.Nip,
            Nik = req.Nik,
            Email = req.Email,
            NoHp = req.NoHp,
            RoleCode = req.RoleCode,
            Jabatan = req.Jabatan,
            WilayahSudin = req.WilayahSudin,
            SekolahId = req.SekolahId,
            IsActive = true
        };

        _db.AppUsers.Add(user);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<AppUser>.Ok(user, "Pengguna baru berhasil ditambahkan."));
    }

    [HttpPut("/api/pengguna/{id:int}")]
    public async Task<ActionResult<ApiResponse<AppUser>>> Update(int id, [FromBody] CreatePenggunaRequest req)
    {
        var user = await _db.AppUsers.FindAsync(id);
        if (user == null) return NotFound(ApiResponse<AppUser>.Fail("Pengguna tidak ditemukan."));

        user.NamaLengkap = req.NamaLengkap;
        user.Nrk = req.Nrk;
        user.Nip = req.Nip;
        user.Nik = req.Nik;
        user.Email = req.Email;
        user.NoHp = req.NoHp;
        user.RoleCode = req.RoleCode;
        user.Jabatan = req.Jabatan;
        user.WilayahSudin = req.WilayahSudin;
        user.SekolahId = req.SekolahId;
        user.IsActive = req.IsActive;

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<AppUser>.Ok(user, "Data pengguna berhasil diperbarui."));
    }

    [HttpGet("/api/pengguna/cek-simpeg/{nrk}")]
    public async Task<ActionResult<ApiResponse<SimpegPegawaiResponse>>> CekSimpeg(string nrk)
    {
        var client = _httpClientFactory.CreateClient("IntegrationClient");
        var resp = await client.GetAsync($"/api/simpeg/getPegawai/byNrk?nrk={Uri.EscapeDataString(nrk)}");
        var result = await resp.Content.ReadFromJsonAsync<ApiResponse<SimpegPegawaiResponse>>();
        if (!resp.IsSuccessStatusCode || result == null)
            return BadRequest(ApiResponse<SimpegPegawaiResponse>.Fail("Gagal menghubungi siapbos-integration SIMPEG."));
        return Ok(result);
    }

    [HttpGet("/api/otoritas")]
    public async Task<ActionResult<ApiResponse<List<AppRole>>>> GetOtoritas() =>
        Ok(ApiResponse<List<AppRole>>.Ok(await _db.AppRoles.OrderBy(r => r.Id).ToListAsync()));

    [HttpGet("/api/aplikasi")]
    public async Task<ActionResult<ApiResponse<List<AppModule>>>> GetAplikasi() =>
        Ok(ApiResponse<List<AppModule>>.Ok(await _db.AppModules.OrderBy(m => m.SortOrder).ToListAsync()));

    [HttpGet("/api/menu")]
    public async Task<ActionResult<ApiResponse<List<AppMenu>>>> GetMenu([FromQuery] string? kodeAplikasi)
    {
        var query = _db.AppMenus.AsQueryable();
        if (!string.IsNullOrWhiteSpace(kodeAplikasi))
            query = query.Where(m => m.KodeAplikasi == kodeAplikasi);
        return Ok(ApiResponse<List<AppMenu>>.Ok(await query.OrderBy(m => m.SortOrder).ToListAsync()));
    }
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
}
