using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SiapBos.Shared.Constants;
using SiapBos.Shared.Data;
using SiapBos.Shared.DTOs;
using SiapBos.Shared.Entities;
using SiapBos.Shared.Services;

namespace SiapBos.Api.Controllers;

[ApiController]
[Authorize]
public class AdminDashboardController : ControllerBase
{
    private readonly SiapBosDbContext _db;
    private readonly BkuCoreService _core;

    public AdminDashboardController(SiapBosDbContext db, BkuCoreService core)
    {
        _db = db;
        _core = core;
    }

    [HttpGet("/api/dashboard/summary")]
    public async Task<ActionResult<ApiResponse<object>>> GetDashboardSummary([FromQuery] int sekolahId, [FromQuery] int tahun = 2026, [FromQuery] string sumberDana = "BOS")
    {
        var saldo = await _core.GetSummarySaldoAsync(sekolahId, tahun, sumberDana);

        var allBku = await _db.BkuTransactions
            .Include(b => b.TaxItems)
            .Where(b => b.SekolahId == sekolahId && b.TahunAnggaran == tahun && b.SumberDana == sumberDana)
            .ToListAsync();

        var pendingCounts = new
        {
            draftPk = allBku.Count(b => b.StatusBku == StatusBkuFlow.Draft || b.StatusBku == StatusBkuFlow.Ditolak),
            menungguTu = allBku.Count(b => b.StatusBku == StatusBkuFlow.DiajukanTu),
            menungguPa = allBku.Count(b => b.StatusBku == StatusBkuFlow.DisetujuiTu),
            siapBayarCms = allBku.Count(b => b.StatusBku == StatusBkuFlow.DisetujuiPa || b.StatusBku == StatusBkuFlow.DisetujuiSudin),
            lunasTransfer = allBku.Count(b => b.StatusBku == StatusBkuFlow.LunasTransfer),
            pajakBelumLunas = allBku.SelectMany(b => b.TaxItems).Count(t => t.StatusPajak != StatusPajakFlow.LunasNtpn),
            droppingPending = await _db.DroppingDanas.CountAsync(d => d.SekolahId == sekolahId && d.TahunAnggaran == tahun && d.SumberDana == sumberDana && !d.IsConfirmedToBku),
            npdMenungguSudin = await _db.NpdBops.CountAsync(n => n.SekolahId == sekolahId && n.TahunAnggaran == tahun && n.StatusNpd == StatusDanaFlow.DisetujuiPa)
        };

        var chartBulanan = Enumerable.Range(1, 6).Select(bulan =>
        {
            var masuk = allBku.Where(b => b.Bulan == bulan).Sum(b => b.NilaiBrutoMasuk);
            var keluar = allBku.Where(b => b.Bulan == bulan && b.StatusBku != StatusBkuFlow.Ditolak).Sum(b => b.NilaiBrutoKeluar);
            return new
            {
                bulan,
                label = new DateTime(tahun, bulan, 1).ToString("MMM"),
                masuk,
                keluar
            };
        }).ToList();

        var recentTransactions = allBku
            .OrderByDescending(b => b.TanggalTransaksi)
            .Take(5)
            .Select(b => new
            {
                b.Id,
                b.NomorBku,
                b.TanggalTransaksi,
                b.KodeTrx,
                b.Uraian,
                b.NilaiBrutoMasuk,
                b.NilaiBrutoKeluar,
                b.StatusBku,
                StatusLabel = StatusBkuFlow.GetLabel(b.StatusBku)
            }).ToList();

        return Ok(ApiResponse<object>.Ok(new
        {
            saldo,
            pendingCounts,
            chartBulanan,
            recentTransactions
        }));
    }

    [HttpPost("/api/sekolah/{sekolahId:int}/konfirmasi-rekening")]
    public async Task<ActionResult<ApiResponse<Sekolah>>> KonfirmasiRekeningSekolah(int sekolahId, [FromBody] KonfirmasiRekeningRequest req)
    {
        var sekolah = await _db.Sekolahs.FindAsync(sekolahId);
        if (sekolah == null) return NotFound(ApiResponse<Sekolah>.Fail("Sekolah tidak ditemukan."));

        sekolah.NoRekBos = req.NoRekBos;
        sekolah.NamaRekBos = req.NamaRekBos;
        sekolah.NoRekBop = req.NoRekBop;
        sekolah.NamaRekBop = req.NamaRekBop;
        sekolah.NpwpSekolah = req.NpwpSekolah;
        sekolah.IsRekeningConfirmed = true;
        sekolah.TanggalKonfirmasiRekening = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<Sekolah>.Ok(sekolah, $"Rekening & NPWP {sekolah.NamaSekolah} berhasil dikonfirmasi."));
    }

    [HttpGet("/api/rkas")]
    public async Task<ActionResult<ApiResponse<List<RkasItem>>>> GetRkas(
        [FromQuery] int sekolahId,
        [FromQuery] int tahun = 2026,
        [FromQuery] string? sumberDana = null)
    {
        var query = _db.RkasItems.Where(r => r.SekolahId == sekolahId && r.TahunAnggaran == tahun);
        if (!string.IsNullOrWhiteSpace(sumberDana))
            query = query.Where(r => r.SumberDana == sumberDana);

        return Ok(ApiResponse<List<RkasItem>>.Ok(await query.OrderBy(r => r.KodeSnp).ThenBy(r => r.KodeKegiatan).ToListAsync()));
    }

    [HttpPost("/api/rkas")]
    public async Task<ActionResult<ApiResponse<RkasItem>>> CreateRkas([FromBody] RkasItem item)
    {
        item.TotalPagu = Math.Round(item.Volume * item.HargaSatuan, 2);
        item.IsSynced = true;
        _db.RkasItems.Add(item);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<RkasItem>.Ok(item, "Komponen RKAS berhasil ditambahkan."));
    }

    [HttpGet("/api/migrasi-dana")]
    public async Task<ActionResult<ApiResponse<List<MigrasiPask>>>> GetAllMigrasiDana(
        [FromQuery] int tahun = 2026,
        [FromQuery] int? sekolahId = null,
        [FromQuery] string? sumberDana = null)
    {
        var query = _db.MigrasiPasks
            .Include(m => m.Sekolah)
            .Include(m => m.Rincians)
            .Where(m => m.TahunAnggaran == tahun);

        if (sekolahId.HasValue && sekolahId.Value > 0)
            query = query.Where(m => m.SekolahId == sekolahId.Value);

        if (!string.IsNullOrWhiteSpace(sumberDana))
            query = query.Where(m => m.SumberDana == sumberDana);

        return Ok(ApiResponse<List<MigrasiPask>>.Ok(await query.OrderByDescending(m => m.Id).ToListAsync()));
    }

    [HttpGet("/api/admin/dropping")]
    public async Task<ActionResult<ApiResponse<List<DroppingDana>>>> GetAllDropping([FromQuery] int tahun = 2026, [FromQuery] string? sumberDana = null)
    {
        var query = _db.DroppingDanas.Include(d => d.Sekolah).Where(d => d.TahunAnggaran == tahun);
        if (!string.IsNullOrWhiteSpace(sumberDana))
            query = query.Where(d => d.SumberDana == sumberDana);

        return Ok(ApiResponse<List<DroppingDana>>.Ok(await query.OrderByDescending(d => d.Id).ToListAsync()));
    }

    [HttpPost("/api/admin/dropping")]
    public async Task<ActionResult<ApiResponse<DroppingDana>>> CreateDropping([FromBody] CreateDroppingRequest req)
    {
        if (req.NilaiDropping <= 0)
            return BadRequest(ApiResponse<DroppingDana>.Fail("Nilai dropping harus lebih dari 0."));

        var dropping = new DroppingDana
        {
            SekolahId = req.SekolahId,
            TahunAnggaran = req.TahunAnggaran,
            SumberDana = req.SumberDana,
            KodePeriode = req.KodePeriode,
            NamaPeriode = req.NamaPeriode,
            NomorSp2d = string.IsNullOrWhiteSpace(req.NomorSp2d) ? $"SP2D/DKI/{req.SumberDana}/{req.TahunAnggaran}/{Random.Shared.Next(1000, 9999)}" : req.NomorSp2d,
            TanggalDropping = DateTime.UtcNow,
            NilaiDropping = req.NilaiDropping,
            Keterangan = req.Keterangan,
            IsConfirmedToBku = false
        };
        _db.DroppingDanas.Add(dropping);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<DroppingDana>.Ok(dropping, "Dropping Dana berhasil dibuat oleh Admin Dinas dan menunggu konfirmasi sekolah."));
    }

    [HttpGet("/api/helpdesk")]
    public async Task<ActionResult<ApiResponse<List<HelpdeskTicket>>>> GetHelpdesk([FromQuery] int? sekolahId)
    {
        var query = _db.HelpdeskTickets.Include(h => h.Sekolah).AsQueryable();
        if (sekolahId.HasValue && sekolahId.Value > 0)
            query = query.Where(h => h.SekolahId == sekolahId.Value);

        return Ok(ApiResponse<List<HelpdeskTicket>>.Ok(await query.OrderByDescending(h => h.CreatedAt).ToListAsync()));
    }

    [HttpPost("/api/helpdesk")]
    public async Task<ActionResult<ApiResponse<HelpdeskTicket>>> CreateHelpdesk([FromBody] HelpdeskTicket req)
    {
        req.Status = "OPEN";
        req.CreatedAt = DateTime.UtcNow;
        _db.HelpdeskTickets.Add(req);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<HelpdeskTicket>.Ok(req, "Tiket Helpdesk berhasil dikirim ke Admin Dinas."));
    }

    [HttpPut("/api/helpdesk/{id:int}/respond")]
    public async Task<ActionResult<ApiResponse<HelpdeskTicket>>> RespondHelpdesk(int id, [FromBody] HelpdeskRespondRequest req)
    {
        var ticket = await _db.HelpdeskTickets.FindAsync(id);
        if (ticket == null) return NotFound(ApiResponse<HelpdeskTicket>.Fail("Tiket tidak ditemukan."));

        ticket.TanggapanAdmin = req.TanggapanAdmin;
        ticket.Status = req.Status;
        if (req.Status == "RESOLVED") ticket.ResolvedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<HelpdeskTicket>.Ok(ticket, "Tanggapan tiket berhasil disimpan."));
    }
}

public class KonfirmasiRekeningRequest
{
    public string NoRekBos { get; set; } = string.Empty;
    public string NamaRekBos { get; set; } = string.Empty;
    public string NoRekBop { get; set; } = string.Empty;
    public string NamaRekBop { get; set; } = string.Empty;
    public string NpwpSekolah { get; set; } = string.Empty;
}

public class CreateDroppingRequest
{
    public int SekolahId { get; set; }
    public int TahunAnggaran { get; set; } = 2026;
    public string SumberDana { get; set; } = "BOS";
    public string KodePeriode { get; set; } = "02";
    public string NamaPeriode { get; set; } = "Tahap 2";
    public string NomorSp2d { get; set; } = string.Empty;
    public decimal NilaiDropping { get; set; }
    public string Keterangan { get; set; } = string.Empty;
}

public class HelpdeskRespondRequest
{
    public string TanggapanAdmin { get; set; } = string.Empty;
    public string Status { get; set; } = "RESOLVED";
}
