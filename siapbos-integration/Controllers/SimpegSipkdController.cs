using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SiapBos.Shared.Constants;
using SiapBos.Shared.Data;
using SiapBos.Shared.DTOs;
using SiapBos.Shared.Entities;
using SiapBos.Shared.Services;

namespace SiapBos.Integration.Controllers;

[ApiController]
public class SimpegSipkdController : ControllerBase
{
    private readonly SiapBosDbContext _db;

    public SimpegSipkdController(SiapBosDbContext db) => _db = db;

    [HttpGet("/api/simpeg/getPegawai/byNrk")]
    public async Task<ActionResult<ApiResponse<SimpegPegawaiResponse>>> GetPegawaiByNrk([FromQuery] string? nrk)
    {
        var cleanNrk = string.IsNullOrWhiteSpace(nrk) ? "190001" : nrk.Trim();
        var existingUser = await _db.AppUsers.Include(u => u.Sekolah).FirstOrDefaultAsync(u => u.Nrk == cleanNrk);
        var resp = DummyIntegrationFactory.BuildSimpegPegawai(cleanNrk, existingUser);

        _db.IntegrationAuditLogs.Add(new IntegrationAuditLog
        {
            SystemName = "SIMPEG",
            EndpointCalled = "/api/simpeg/getPegawai/byNrk",
            CallerService = "siapbos-auth",
            RequestPayload = JsonSerializer.Serialize(new { nrk = cleanNrk }),
            ResponsePayload = JsonSerializer.Serialize(resp),
            StatusCode = "00",
            IsSuccess = true
        });
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<SimpegPegawaiResponse>.Ok(resp));
    }

    [HttpPost("/api/sipkd/npd/save")]
    public async Task<ActionResult<ApiResponse<SipkdNpdResponse>>> SaveNpdToSipkd([FromBody] SipkdSaveNpdRequest req)
    {
        var npd = await _db.NpdBops.Include(n => n.Sekolah).FirstOrDefaultAsync(n => n.Id == req.NpdId);
        var now = DateTime.UtcNow;

        if (npd == null)
        {
            var dummySipkd = $"SIPKD/NPD-BOP/{now.Year}/{Random.Shared.Next(10000, 99999)}";
            var dummyResp = new SipkdNpdResponse
            {
                ResponseCode = "00",
                ResponseMessage = $"NPD BOP berhasil dikirim ke SIPKD ({dummySipkd}).",
                NomorSipkd = dummySipkd,
                TanggalProses = now
            };
            _db.IntegrationAuditLogs.Add(new IntegrationAuditLog
            {
                SystemName = "SIPKD",
                EndpointCalled = "/api/sipkd/npd/save",
                CallerService = "siapbop-api",
                RequestPayload = JsonSerializer.Serialize(req),
                ResponsePayload = JsonSerializer.Serialize(dummyResp),
                StatusCode = "00",
                IsSuccess = true
            });
            await _db.SaveChangesAsync();
            return Ok(ApiResponse<SipkdNpdResponse>.Ok(dummyResp, dummyResp.ResponseMessage));
        }

        var nomorSipkd = $"SIPKD/NPD-BOP/{npd.TahunAnggaran}/{Random.Shared.Next(10000, 99999)}";
        npd.StatusNpd = 4;
        npd.NomorSipkd = nomorSipkd;
        npd.TanggalKirimSipkd = now;
        npd.SudinApprovedAt ??= now;
        npd.Catatan = $"Disetujui Sudin & terkirim ke SIPKD ({nomorSipkd}). Dana BOP otomatis cair ke rekening sekolah.";

        // Otomatis menerbitkan SP2D Dropping BOP untuk langsung dicairkan ke BKU (JO) & Saldo Sekolah
        var dropping = new DroppingDana
        {
            SekolahId = npd.SekolahId,
            TahunAnggaran = npd.TahunAnggaran,
            SumberDana = SumberDanaTypes.Bop,
            KodePeriode = npd.KodePeriode,
            NamaPeriode = npd.KodePeriode switch { "TW1" => "Triwulan ke-01", "TW2" => "Triwulan ke-02", "TW3" => "Triwulan ke-03", _ => "Triwulan ke-04" },
            NomorSp2d = $"SP2D/BPKD-DKI/{npd.TahunAnggaran}/{Random.Shared.Next(1000, 9999)}",
            TanggalDropping = now,
            NilaiDropping = npd.NilaiPengajuan,
            Keterangan = $"Dropping otomatis hasil persetujuan NPD {npd.NomorNpd} ({nomorSipkd})",
            MigrasiPaskId = npd.MigrasiPaskId,
            Program = npd.Program,
            NomorDpaSkpd = npd.NomorDpaSkpd,
            KodeSubgiat = npd.KodeSubgiat,
            NamaSubgiat = npd.NamaSubgiat,
            NamaPask = npd.NamaPask,
            StatusDropping = StatusDanaFlow.CairDisetujui,
            CreatedBy = npd.CreatedBy,
            TuApprovedBy = npd.TuApprovedBy,
            TuApprovedAt = npd.TuApprovedAt,
            PaApprovedBy = npd.PaApprovedBy,
            PaApprovedAt = npd.PaApprovedAt,
            DinasApprovedBy = npd.SudinApprovedBy ?? "SUDIN",
            DinasApprovedAt = now,
            Catatan = $"Cair otomatis via SIPKD ({nomorSipkd})",
            IsConfirmedToBku = false
        };
        _db.DroppingDanas.Add(dropping);
        await _db.SaveChangesAsync();

        var resp = new SipkdNpdResponse
        {
            ResponseCode = "00",
            ResponseMessage = $"NPD BOP berhasil disetujui Sudin, dikirim ke SIPKD ({nomorSipkd}), dan dana cair ke rekening sekolah.",
            NomorSipkd = nomorSipkd,
            DroppingId = dropping.Id,
            TanggalProses = now
        };

        _db.IntegrationAuditLogs.Add(new IntegrationAuditLog
        {
            SystemName = "SIPKD",
            EndpointCalled = "/api/sipkd/npd/save",
            CallerService = "siapbop-api",
            RequestPayload = JsonSerializer.Serialize(req),
            ResponsePayload = JsonSerializer.Serialize(resp),
            StatusCode = "00",
            IsSuccess = true
        });
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<SipkdNpdResponse>.Ok(resp, resp.ResponseMessage));
    }

    [HttpGet("/api/integration/logs")]
    public async Task<ActionResult<ApiResponse<List<IntegrationAuditLog>>>> GetAuditLogs([FromQuery] string? systemName)
    {
        var query = _db.IntegrationAuditLogs.AsQueryable();
        if (!string.IsNullOrWhiteSpace(systemName))
            query = query.Where(l => l.SystemName == systemName);

        var logs = await query.OrderByDescending(l => l.Timestamp).Take(50).ToListAsync();
        return Ok(ApiResponse<List<IntegrationAuditLog>>.Ok(logs));
    }
}

public class SipkdSaveNpdRequest
{
    public int NpdId { get; set; }
}
