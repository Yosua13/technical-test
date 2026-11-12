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

    [HttpGet("/api-bop/koreksi")]
    public async Task<ActionResult<ApiResponse<List<BkuCorrection>>>> GetKoreksi([FromQuery] int sekolahId, [FromQuery] string sumberDana = "BOP")
    {
        var list = await _db.BkuCorrections
            .Include(k => k.BkuTransaction)
            .Where(k => k.SekolahId == sekolahId && k.SumberDana == sumberDana)
            .OrderByDescending(k => k.Id)
            .ToListAsync();
        return Ok(ApiResponse<List<BkuCorrection>>.Ok(list));
    }

    [HttpPost("/api-bop/koreksi")]
    public async Task<ActionResult<ApiResponse<BkuCorrection>>> CreateKoreksi([FromBody] CreateKoreksiRequest req)
    {
        var bku = await _db.BkuTransactions.Include(b => b.DetailItems).FirstOrDefaultAsync(b => b.Id == req.BkuTransactionId);
        if (bku == null) return NotFound(ApiResponse<BkuCorrection>.Fail("Transaksi BKU tidak ditemukan."));

        var koreksi = new BkuCorrection
        {
            BkuTransactionId = bku.Id,
            SekolahId = bku.SekolahId,
            SumberDana = bku.SumberDana,
            JenisKoreksi = req.JenisKoreksi,
            NilaiSebelum = bku.NilaiBrutoKeluar,
            NilaiSesudah = req.NilaiSesudah ?? bku.NilaiBrutoKeluar,
            KodeAkunSebelum = bku.DetailItems.FirstOrDefault()?.KodeAkun ?? "-",
            KodeAkunSesudah = req.KodeAkunSesudah,
            Alasan = req.Alasan,
            StatusKoreksi = 1
        };

        _db.BkuCorrections.Add(koreksi);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<BkuCorrection>.Ok(koreksi, "Usulan koreksi BKU berhasil diajukan ke Suku Dinas."));
    }

    [HttpPost("/api-bop/koreksi/{id:int}/approve-sudin")]
    public async Task<ActionResult<ApiResponse<BkuCorrection>>> ApproveKoreksiSudin(int id, [FromBody] ApprovalActionRequest req)
    {
        var kor = await _db.BkuCorrections
            .Include(k => k.BkuTransaction)
            .ThenInclude(b => b!.DetailItems)
            .FirstOrDefaultAsync(k => k.Id == id);
        if (kor == null || kor.BkuTransaction == null)
            return NotFound(ApiResponse<BkuCorrection>.Fail("Data koreksi tidak ditemukan."));

        if (!req.Disetujui)
        {
            kor.StatusKoreksi = 9;
            await _db.SaveChangesAsync();
            return Ok(ApiResponse<BkuCorrection>.Ok(kor, "Usulan koreksi ditolak Sudin."));
        }

        var bku = kor.BkuTransaction;
        if (kor.JenisKoreksi == "KODE_AKUN" && !string.IsNullOrWhiteSpace(kor.KodeAkunSesudah))
        {
            var firstItem = bku.DetailItems.FirstOrDefault();
            if (firstItem != null)
            {
                firstItem.KodeAkun = kor.KodeAkunSesudah;
            }
        }
        else if (kor.JenisKoreksi == "BATAL_TRANSFER")
        {
            var sekolah = await _db.Sekolahs.FindAsync(bku.SekolahId);
            if (sekolah != null && bku.StatusBku == StatusBkuFlow.LunasTransfer)
            {
                if (bku.SumberDana == SumberDanaTypes.Bos) sekolah.SaldoBos += bku.NilaiNettoTransfer;
                else sekolah.SaldoBop += bku.NilaiNettoTransfer;
            }
            bku.StatusBku = StatusBkuFlow.Draft;
            bku.NoJurnalBank = null;
            bku.StatusTransferBank = null;
            bku.TokenOtpPa = null;
            bku.CatatanVerifikasi = $"Batal Transfer SPJ disetujui Sudin: {kor.Alasan}";
        }

        kor.StatusKoreksi = 2;
        kor.ApprovedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<BkuCorrection>.Ok(kor, "Koreksi BKU disetujui Sudin dan data BKU telah disesuaikan."));
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

public class CreateKoreksiRequest
{
    public int BkuTransactionId { get; set; }
    public string JenisKoreksi { get; set; } = "KODE_AKUN"; // KODE_AKUN, BATAL_TRANSFER
    public decimal? NilaiSesudah { get; set; }
    public string? KodeAkunSesudah { get; set; }
    public string Alasan { get; set; } = string.Empty;
}
