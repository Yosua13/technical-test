using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SiapBos.Shared.Constants;
using SiapBos.Shared.Data;
using SiapBos.Shared.DTOs;
using SiapBos.Shared.Entities;
using SiapBos.Shared.Security;

namespace SiapBos.Auth.Controllers;

[ApiController]
[Authorize]
public class MasterController : ControllerBase
{
    private readonly SiapBosDbContext _db;

    public MasterController(SiapBosDbContext db) => _db = db;

    [HttpGet("/api/master/sekolah")]
    public async Task<ActionResult<ApiResponse<List<Sekolah>>>> GetSekolahs(
        [FromQuery] string? wilayah,
        [FromQuery] string? jenjang,
        [FromQuery] string? search)
    {
        var userId = User.GetUserId();
        var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
        var primaryRole = User.FindFirst("roleCode")?.Value ?? "";
        if (!string.IsNullOrWhiteSpace(primaryRole) && !roles.Contains(primaryRole))
            roles.Add(primaryRole);

        var isProvinceWide = roles.Contains(SiapBosRoles.AdminTdi) || roles.Contains(SiapBosRoles.AdminDinas);
        var isSudin = roles.Contains(SiapBosRoles.Sudin);

        var query = _db.Sekolahs.AsQueryable();

        if (!isProvinceWide)
        {
            if (isSudin && userId.HasValue)
            {
                var assignedWilayah = await _db.AppUserWilayahs
                    .Where(w => w.UserId == userId.Value && w.IsActive)
                    .Select(w => w.KodeWilayah)
                    .ToListAsync();

                var fallbackWilayah = User.FindFirst("wilayahSudin")?.Value;
                if (assignedWilayah.Count == 0 && !string.IsNullOrWhiteSpace(fallbackWilayah) && fallbackWilayah != "ALL")
                    assignedWilayah.Add(fallbackWilayah);

                if (assignedWilayah.Count > 0 && !assignedWilayah.Contains("ALL"))
                {
                    query = query.Where(s => assignedWilayah.Contains(s.WilayahSudin));
                }
            }
            else if (userId.HasValue)
            {
                var allowedSekolahIds = await _db.AppUserSekolahs
                    .Where(us => us.UserId == userId.Value && us.IsActive)
                    .Select(us => us.SekolahId)
                    .ToListAsync();

                if (int.TryParse(User.FindFirst("sekolahId")?.Value, out var claimSecId) &&
                    !allowedSekolahIds.Contains(claimSecId))
                {
                    allowedSekolahIds.Add(claimSecId);
                }

                query = query.Where(s => allowedSekolahIds.Contains(s.Id));
            }
            else
            {
                query = query.Where(_ => false);
            }
        }

        if (!string.IsNullOrWhiteSpace(wilayah) && wilayah != "ALL")
            query = query.Where(s => s.WilayahSudin == wilayah);

        if (!string.IsNullOrWhiteSpace(jenjang))
            query = query.Where(s => s.Jenjang == jenjang);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            query = query.Where(s =>
                s.NamaSekolah.ToLower().Contains(q) ||
                s.Npsn.ToLower().Contains(q) ||
                s.NamaKepalaSekolah.ToLower().Contains(q) ||
                s.NamaBendahara.ToLower().Contains(q));
        }

        return Ok(ApiResponse<List<Sekolah>>.Ok(await query.OrderBy(s => s.NamaSekolah).ToListAsync()));
    }

    [HttpGet("/api/master/sekolah/{id:int}")]
    public async Task<ActionResult<ApiResponse<Sekolah>>> GetSekolahById(int id)
    {
        var listResult = await GetSekolahs(null, null, null);
        if (listResult.Result is OkObjectResult ok && ok.Value is ApiResponse<List<Sekolah>> resp)
        {
            var s = resp.Data?.FirstOrDefault(x => x.Id == id);
            if (s == null)
            {
                var exists = await _db.Sekolahs.AnyAsync(x => x.Id == id);
                if (exists) return StatusCode(403, ApiResponse<Sekolah>.Fail("Akses ditolak: sekolah di luar otoritas pengguna."));
                return NotFound(ApiResponse<Sekolah>.Fail("Sekolah tidak ditemukan."));
            }
            return Ok(ApiResponse<Sekolah>.Ok(s));
        }
        return NotFound(ApiResponse<Sekolah>.Fail("Sekolah tidak ditemukan."));
    }

    [HttpPost("/api/master/sekolah")]
    public async Task<ActionResult<ApiResponse<Sekolah>>> CreateSekolah([FromBody] Sekolah req)
    {
        _db.Sekolahs.Add(req);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<Sekolah>.Ok(req, "Sekolah berhasil ditambahkan."));
    }

    [HttpPut("/api/master/sekolah/{id:int}")]
    public async Task<ActionResult<ApiResponse<Sekolah>>> UpdateSekolah(int id, [FromBody] Sekolah req)
    {
        var s = await _db.Sekolahs.FindAsync(id);
        if (s == null) return NotFound(ApiResponse<Sekolah>.Fail("Sekolah tidak ditemukan."));

        s.NamaSekolah = req.NamaSekolah;
        s.Jenjang = req.Jenjang;
        s.WilayahSudin = req.WilayahSudin;
        s.NamaSudin = req.NamaSudin;
        s.Alamat = req.Alamat;
        s.NoRekBos = req.NoRekBos;
        s.NamaRekBos = req.NamaRekBos;
        s.NoRekBop = req.NoRekBop;
        s.NamaRekBop = req.NamaRekBop;
        s.NpwpSekolah = req.NpwpSekolah;
        s.NamaKepalaSekolah = req.NamaKepalaSekolah;
        s.NipKepalaSekolah = req.NipKepalaSekolah;
        s.NrkKepalaSekolah = req.NrkKepalaSekolah;
        s.NamaKasubagTu = req.NamaKasubagTu;
        s.NipKasubagTu = req.NipKasubagTu;
        s.NrkKasubagTu = req.NrkKasubagTu;
        s.NamaBendahara = req.NamaBendahara;
        s.NipBendahara = req.NipBendahara;
        s.NrkBendahara = req.NrkBendahara;

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<Sekolah>.Ok(s, "Profil sekolah berhasil diperbarui."));
    }

    [HttpGet("/api/master/periode")]
    public async Task<ActionResult<ApiResponse<List<MasterPeriode>>>> GetPeriodes([FromQuery] int tahun = 2026, [FromQuery] string? sumberDana = null)
    {
        await DbSeeder.EnsureMasterPeriodesCompleteAsync(_db, tahun);

        var query = _db.MasterPeriodes.Where(p => p.TahunAnggaran == tahun);
        if (!string.IsNullOrWhiteSpace(sumberDana))
            query = query.Where(p => p.SumberDana == sumberDana);

        return Ok(ApiResponse<List<MasterPeriode>>.Ok(await query.OrderBy(p => p.SumberDana).ThenBy(p => p.BulanMulai).ToListAsync()));
    }

    [HttpPut("/api/master/periode/{id:int}/batas-pengajuan")]
    public async Task<ActionResult<ApiResponse<MasterPeriode>>> UpdateBatasPengajuan(int id, [FromBody] UpdateBatasRequest req)
    {
        var p = await _db.MasterPeriodes.FindAsync(id);
        if (p == null) return NotFound(ApiResponse<MasterPeriode>.Fail("Periode tidak ditemukan."));
        p.BatasPengajuanBelanja = DateTime.SpecifyKind(req.BatasPengajuanBelanja, DateTimeKind.Utc);
        p.IsActive = req.IsActive;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<MasterPeriode>.Ok(p, "Batas pengajuan periode berhasil diperbarui."));
    }

    [HttpGet("/api/master/bas")]
    public async Task<ActionResult<ApiResponse<List<BasAccount>>>> GetBasAccounts() =>
        Ok(ApiResponse<List<BasAccount>>.Ok(await _db.BasAccounts.Where(b => b.IsActive).OrderBy(b => b.KodeAkun).ToListAsync()));

    [HttpGet("/api/master/pajak")]
    public async Task<ActionResult<ApiResponse<List<TaxMaster>>>> GetTaxMasters() =>
        Ok(ApiResponse<List<TaxMaster>>.Ok(await _db.TaxMasters.OrderBy(t => t.KodeTrxPajak).ToListAsync()));

    [HttpGet("/api/master/wilayah")]
    public ActionResult<ApiResponse<object>> GetWilayah()
    {
        var wilayah = new[]
        {
            new { kode = "JP", nama = "Jakarta Pusat" },
            new { kode = "JU", nama = "Jakarta Utara" },
            new { kode = "JB", nama = "Jakarta Barat" },
            new { kode = "JS", nama = "Jakarta Selatan" },
            new { kode = "JT", nama = "Jakarta Timur" }
        };
        return Ok(ApiResponse<object>.Ok(wilayah));
    }
}

public class UpdateBatasRequest
{
    public DateTime BatasPengajuanBelanja { get; set; }
    public bool IsActive { get; set; } = true;
}
