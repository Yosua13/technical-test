using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SiapBos.Shared.Data;
using SiapBos.Shared.DTOs;
using SiapBos.Shared.Entities;

namespace SiapBos.Auth.Controllers;

[ApiController]
[Authorize]
public class MasterController : ControllerBase
{
    private readonly SiapBosDbContext _db;

    public MasterController(SiapBosDbContext db) => _db = db;

    [HttpGet("/api/master/sekolah")]
    public async Task<ActionResult<ApiResponse<List<Sekolah>>>> GetSekolahs([FromQuery] string? wilayah, [FromQuery] string? jenjang)
    {
        var role = User.FindFirst("roleCode")?.Value;
        var userWilayah = User.FindFirst("wilayahSudin")?.Value;
        var userSekolahClaim = User.FindFirst("sekolahId")?.Value;

        var query = _db.Sekolahs.AsQueryable();

        if (role is "PA-NEGERI" or "TU-NEGERI" or "PK-NEGERI" && int.TryParse(userSekolahClaim, out var secId))
        {
            query = query.Where(s => s.Id == secId);
        }
        else if (role == "SUDIN" && !string.IsNullOrWhiteSpace(userWilayah) && userWilayah != "ALL")
        {
            query = query.Where(s => s.WilayahSudin == userWilayah);
        }
        else if (!string.IsNullOrWhiteSpace(wilayah) && wilayah != "ALL")
        {
            query = query.Where(s => s.WilayahSudin == wilayah);
        }

        if (!string.IsNullOrWhiteSpace(jenjang))
            query = query.Where(s => s.Jenjang == jenjang);

        return Ok(ApiResponse<List<Sekolah>>.Ok(await query.OrderBy(s => s.NamaSekolah).ToListAsync()));
    }

    [HttpGet("/api/master/sekolah/{id:int}")]
    public async Task<ActionResult<ApiResponse<Sekolah>>> GetSekolahById(int id)
    {
        var s = await _db.Sekolahs.FindAsync(id);
        return s == null ? NotFound(ApiResponse<Sekolah>.Fail("Sekolah tidak ditemukan.")) : Ok(ApiResponse<Sekolah>.Ok(s));
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
