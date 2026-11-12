using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SiapBos.Shared.Constants;
using SiapBos.Shared.Data;
using SiapBos.Shared.DTOs;
using SiapBos.Shared.Entities;

namespace SiapBos.Integration.Controllers;

[ApiController]
public class SimpegSipkdController : ControllerBase
{
    private readonly SiapBosDbContext _db;

    public SimpegSipkdController(SiapBosDbContext db) => _db = db;

    [HttpGet("/api/simpeg/getPegawai/byNrk")]
    public async Task<ActionResult<ApiResponse<SimpegPegawaiResponse>>> GetPegawaiByNrk([FromQuery] string nrk)
    {
        var cleanNrk = nrk?.Trim() ?? string.Empty;
        if (cleanNrk.Length < 4)
            return BadRequest(ApiResponse<SimpegPegawaiResponse>.Fail("NRK harus diisi minimal 4 digit."));

        var existingUser = await _db.AppUsers.Include(u => u.Sekolah).FirstOrDefaultAsync(u => u.Nrk == cleanNrk);
        var resp = existingUser != null
            ? new SimpegPegawaiResponse
            {
                ResponseCode = "00",
                ResponseMessage = "Data ASN Ditemukan di SIMPEG Provinsi DKI Jakarta",
                Nrk = existingUser.Nrk,
                Nip = existingUser.Nip,
                Nik = existingUser.Nik,
                NamaLengkap = existingUser.NamaLengkap,
                Jabatan = existingUser.Jabatan,
                Golongan = "Penata Tk. I (III/d)",
                UnitKerja = existingUser.Sekolah?.NamaSekolah ?? "Dinas Pendidikan Provinsi DKI Jakarta"
            }
            : new SimpegPegawaiResponse
            {
                ResponseCode = "00",
                ResponseMessage = "Data ASN Ditemukan di SIMPEG Provinsi DKI Jakarta (Simulasi)",
                Nrk = cleanNrk,
                Nip = $"19860515201001{cleanNrk[^4..]}",
                Nik = $"317104150586{cleanNrk[^4..]}",
                NamaLengkap = $"Rizky Ramadhan, S.Pd. (NRK {cleanNrk})",
                Jabatan = "Guru / Tenaga Kependidikan Sekolah Negeri",
                Golongan = "Penata (III/c)",
                UnitKerja = "Dinas Pendidikan Provinsi DKI Jakarta"
            };

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
        if (npd == null)
            return NotFound(ApiResponse<SipkdNpdResponse>.Fail("Data NPD BOP tidak ditemukan."));

        if (npd.StatusNpd < 3)
            return BadRequest(ApiResponse<SipkdNpdResponse>.Fail("NPD BOP harus disetujui Sudin terlebih dahulu sebelum dikirim ke SIPKD."));

        var now = DateTime.UtcNow;
        var nomorSipkd = $"SIPKD/NPD-BOP/{npd.TahunAnggaran}/{Random.Shared.Next(10000, 99999)}";
        npd.StatusNpd = 4;
        npd.NomorSipkd = nomorSipkd;
        npd.TanggalKirimSipkd = now;
        npd.Catatan = $"Terkirim ke SIPKD ({nomorSipkd}). Dana dropping BOP otomatis diterbitkan ke sekolah.";

        // Otomatis menerbitkan SP2D Dropping BOP agar bisa dikonfirmasi sekolah
        _db.DroppingDanas.Add(new DroppingDana
        {
            SekolahId = npd.SekolahId,
            TahunAnggaran = npd.TahunAnggaran,
            SumberDana = SumberDanaTypes.Bop,
            KodePeriode = npd.KodePeriode,
            NamaPeriode = $"Pencairan NPD SIPKD {npd.KodePeriode}",
            NomorSp2d = $"SP2D/BPKD-DKI/{npd.TahunAnggaran}/{Random.Shared.Next(1000, 9999)}",
            TanggalDropping = now,
            NilaiDropping = npd.NilaiPengajuan,
            Keterangan = $"Dropping otomatis hasil persetujuan NPD {npd.NomorNpd} ({nomorSipkd})",
            IsConfirmedToBku = false
        });

        var resp = new SipkdNpdResponse
        {
            ResponseCode = "00",
            ResponseMessage = $"NPD BOP berhasil dikirim ke SIPKD ({nomorSipkd}) & SP2D Dropping BOP siap dikonfirmasi.",
            NomorSipkd = nomorSipkd,
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
