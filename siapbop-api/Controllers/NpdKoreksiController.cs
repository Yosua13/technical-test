using System.Net.Http.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SiapBos.Shared.Constants;
using SiapBos.Shared.Data;
using SiapBos.Shared.DTOs;
using SiapBos.Shared.Entities;

namespace SiapBop.Api.Controllers;

[ApiController]
[Authorize]
public class NpdKoreksiController : ControllerBase
{
    private readonly SiapBosDbContext _db;
    private readonly IHttpClientFactory _httpClientFactory;

    public NpdKoreksiController(SiapBosDbContext db, IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
    }

    [HttpGet("/api-bop/npd")]
    public async Task<ActionResult<ApiResponse<List<NpdBop>>>> GetNpd([FromQuery] int sekolahId, [FromQuery] int tahun = 2026)
    {
        var list = await _db.NpdBops
            .Where(n => n.SekolahId == sekolahId && n.TahunAnggaran == tahun)
            .OrderByDescending(n => n.Id)
            .ToListAsync();
        return Ok(ApiResponse<List<NpdBop>>.Ok(list));
    }

    [HttpPost("/api-bop/npd")]
    public async Task<ActionResult<ApiResponse<NpdBop>>> CreateNpd([FromBody] CreateNpdRequest req)
    {
        if (!User.IsInRole(SiapBosRoles.PkNegeri) && !User.IsInRole(SiapBosRoles.AdminTdi))
            return StatusCode(403, ApiResponse<NpdBop>.Fail("Hanya Bendahara Sekolah (PK) yang berhak membuat draft NPD."));

        if (req.NilaiPengajuan <= 0)
            return BadRequest(ApiResponse<NpdBop>.Fail("Nilai pengajuan NPD harus lebih dari 0."));

        var count = await _db.NpdBops.CountAsync() + 1;
        var npd = new NpdBop
        {
            SekolahId = req.SekolahId,
            TahunAnggaran = req.TahunAnggaran,
            KodePeriode = req.KodePeriode,
            NomorNpd = $"NPD/BOP/{req.TahunAnggaran}/{count:D4}",
            TanggalNpd = DateTime.UtcNow,
            Uraian = req.Uraian,
            NilaiPengajuan = req.NilaiPengajuan,
            StatusNpd = 0,
            Catatan = "Draft NPD BOP dibuat oleh Bendahara Sekolah."
        };
        _db.NpdBops.Add(npd);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<NpdBop>.Ok(npd, $"Draft NPD {npd.NomorNpd} berhasil dibuat."));
    }

    [HttpPost("/api-bop/npd/{id:int}/ajukan")]
    public async Task<ActionResult<ApiResponse<NpdBop>>> AjukanNpd(int id)
    {
        if (!User.IsInRole(SiapBosRoles.PkNegeri) && !User.IsInRole(SiapBosRoles.AdminTdi))
            return StatusCode(403, ApiResponse<NpdBop>.Fail("Hanya Bendahara Sekolah (PK) yang berhak mengajukan NPD."));

        var npd = await _db.NpdBops.FindAsync(id);
        if (npd == null) return NotFound(ApiResponse<NpdBop>.Fail("NPD tidak ditemukan."));
        npd.StatusNpd = 1;
        npd.Catatan = "Diajukan Bendahara untuk persetujuan Kepala Sekolah (PA).";
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<NpdBop>.Ok(npd, "NPD berhasil diajukan ke PA."));
    }

    [HttpPost("/api-bop/npd/{id:int}/approve-pa")]
    public async Task<ActionResult<ApiResponse<NpdBop>>> ApproveNpdPa(int id, [FromBody] ApprovalActionRequest req)
    {
        if (!User.IsInRole(SiapBosRoles.PaNegeri) && !User.IsInRole(SiapBosRoles.AdminTdi))
            return StatusCode(403, ApiResponse<NpdBop>.Fail("Akses ditolak: Persetujuan NPD oleh Kepala Sekolah hanya untuk PA-NEGERI."));

        var npd = await _db.NpdBops.FindAsync(id);
        if (npd == null) return NotFound(ApiResponse<NpdBop>.Fail("NPD tidak ditemukan."));
        npd.StatusNpd = req.Disetujui ? 2 : 9;
        npd.Catatan = req.Catatan ?? (req.Disetujui ? "Disetujui PA, diteruskan ke Sudin." : "Ditolak PA.");
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<NpdBop>.Ok(npd, npd.Catatan));
    }

    [HttpPost("/api-bop/npd/{id:int}/approve-sudin")]
    public async Task<ActionResult<ApiResponse<object>>> ApproveNpdSudin(int id, [FromBody] ApprovalActionRequest req)
    {
        if (!User.IsInRole(SiapBosRoles.Sudin) && !User.IsInRole(SiapBosRoles.AdminDinas) && !User.IsInRole(SiapBosRoles.AdminTdi))
            return StatusCode(403, ApiResponse<object>.Fail("Akses ditolak: Persetujuan akhir NPD hanya untuk SUDIN / ADMIN-DINAS."));

        var npd = await _db.NpdBops.FindAsync(id);
        if (npd == null) return NotFound(ApiResponse<object>.Fail("NPD tidak ditemukan."));

        if (!req.Disetujui)
        {
            npd.StatusNpd = 9;
            npd.Catatan = req.Catatan ?? "Ditolak oleh Suku Dinas Pendidikan.";
            await _db.SaveChangesAsync();
            return Ok(ApiResponse<object>.Ok(npd, "NPD ditolak oleh Sudin."));
        }

        npd.StatusNpd = 3;
        npd.Catatan = "Disetujui Sudin, mengirim data NPD ke SIPKD...";
        await _db.SaveChangesAsync();

        // Integrasi langsung ke SIPKD melalui siapbos-integration
        var client = _httpClientFactory.CreateClient("IntegrationClient");
        var resp = await client.PostAsJsonAsync("/api/sipkd/npd/save", new { npdId = id });
        var sipkdResult = await resp.Content.ReadFromJsonAsync<ApiResponse<SipkdNpdResponse>>();

        return Ok(ApiResponse<object>.Ok(new { npd, sipkd = sipkdResult?.Data }, sipkdResult?.Message ?? "Disetujui Sudin & dikirim ke SIPKD."));
    }
}

public class CreateNpdRequest
{
    public int SekolahId { get; set; }
    public int TahunAnggaran { get; set; } = 2026;
    public string KodePeriode { get; set; } = "TW2";
    public string Uraian { get; set; } = string.Empty;
    public decimal NilaiPengajuan { get; set; }
}
