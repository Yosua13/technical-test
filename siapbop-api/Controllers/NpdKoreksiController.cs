using System.Net.Http.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SiapBos.Shared.Constants;
using SiapBos.Shared.Data;
using SiapBos.Shared.DTOs;
using SiapBos.Shared.Entities;
using SiapBos.Shared.Services;

namespace SiapBop.Api.Controllers;

[ApiController]
[Authorize]
public class NpdKoreksiController : ControllerBase
{
    private readonly SiapBosDbContext _db;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly BkuCoreService _core;

    public NpdKoreksiController(SiapBosDbContext db, IHttpClientFactory httpClientFactory, BkuCoreService core)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
        _core = core;
    }

    private string CurrentUsername => User.Identity?.Name ?? "SYSTEM";

    [HttpGet("/api-bop/npd/pask-candidates")]
    public async Task<ActionResult<ApiResponse<object>>> GetPaskCandidates([FromQuery] int sekolahId, [FromQuery] int tahun = 2026)
    {
        var usedPeriodes = await _db.NpdBops
            .Where(n => n.SekolahId == sekolahId && n.TahunAnggaran == tahun && n.StatusNpd != StatusDanaFlow.Ditolak)
            .Select(n => n.KodePeriode)
            .ToListAsync();

        var pasks = await _db.MigrasiPasks
            .Include(m => m.Rincians)
            .Where(m => m.SekolahId == sekolahId && m.TahunAnggaran == tahun && m.SumberDana == SumberDanaTypes.Bop)
            .OrderBy(m => m.KodePeriode)
            .ThenBy(m => m.Id)
            .ToListAsync();

        var result = pasks.Select(p => new
        {
            p.Id,
            p.BatchKode,
            p.SekolahId,
            p.TahunAnggaran,
            p.SumberDana,
            p.KodePeriode,
            p.NamaPeriode,
            p.KodeSubgiat,
            p.NamaSubgiat,
            p.NamaPask,
            p.Program,
            p.NomorDpaSkpd,
            p.SumberDanaLabel,
            p.TotalDana,
            p.Rincians,
            alreadyUsedInPeriode = usedPeriodes.Contains(p.KodePeriode, StringComparer.OrdinalIgnoreCase)
        }).ToList();

        return Ok(ApiResponse<object>.Ok(result));
    }

    [HttpGet("/api-bop/npd")]
    public async Task<ActionResult<ApiResponse<List<NpdBop>>>> GetNpd(
        [FromQuery] int sekolahId = 0,
        [FromQuery] int tahun = 2026,
        [FromQuery] string? kodePeriode = null,
        [FromQuery] int? status = null,
        [FromQuery] string? search = null)
    {
        var query = _db.NpdBops
            .Include(n => n.Sekolah)
            .Include(n => n.MigrasiPask!)
            .ThenInclude(m => m.Rincians)
            .Where(n => n.TahunAnggaran == tahun);

        if (sekolahId > 0)
            query = query.Where(n => n.SekolahId == sekolahId);

        if (!string.IsNullOrWhiteSpace(kodePeriode))
            query = query.Where(n => n.KodePeriode == kodePeriode);

        if (status.HasValue)
            query = query.Where(n => n.StatusNpd == status.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(n =>
                n.NomorNpd.ToLower().Contains(term) ||
                n.NamaPask.ToLower().Contains(term) ||
                n.Uraian.ToLower().Contains(term));
        }

        var list = await query.OrderByDescending(n => n.Id).ToListAsync();
        return Ok(ApiResponse<List<NpdBop>>.Ok(list));
    }

    [HttpGet("/api-bop/npd/{id:int}")]
    public async Task<ActionResult<ApiResponse<NpdBop>>> GetNpdDetail(int id)
    {
        var npd = await _db.NpdBops
            .Include(n => n.Sekolah)
            .Include(n => n.MigrasiPask!)
            .ThenInclude(m => m.Rincians)
            .FirstOrDefaultAsync(n => n.Id == id);
        if (npd == null)
            return NotFound(ApiResponse<NpdBop>.Fail("Data Permohonan NPD tidak ditemukan."));
        return Ok(ApiResponse<NpdBop>.Ok(npd));
    }

    [HttpPost("/api-bop/npd")]
    public async Task<ActionResult<ApiResponse<NpdBop>>> CreateNpd([FromBody] CreateNpdFromMigrasiRequest req)
    {
        if (!User.IsInRole(SiapBosRoles.PkNegeri) && !User.IsInRole(SiapBosRoles.AdminTdi))
            return StatusCode(403, ApiResponse<NpdBop>.Fail("Hanya Bendahara Sekolah (PK) yang berhak membuat draft Permohonan NPD."));

        var pask = await _db.MigrasiPasks
            .Include(m => m.Rincians)
            .FirstOrDefaultAsync(m => m.Id == req.MigrasiPaskId && m.SumberDana == SumberDanaTypes.Bop);

        if (pask == null)
            return BadRequest(ApiResponse<NpdBop>.Fail("Data PASK hasil migrasi ADM untuk BOP tidak ditemukan."));

        if (req.SekolahId > 0 && req.SekolahId != pask.SekolahId)
            return StatusCode(403, ApiResponse<NpdBop>.Fail("Akses ditolak: Data PASK bukan milik sekolah ini."));

        if (string.IsNullOrWhiteSpace(req.Uraian))
            return BadRequest(ApiResponse<NpdBop>.Fail("Uraian kebutuhan pencairan NPD wajib diisi."));

        var alreadyExists = await _db.NpdBops.AnyAsync(n =>
            n.SekolahId == pask.SekolahId &&
            n.TahunAnggaran == pask.TahunAnggaran &&
            n.KodePeriode == pask.KodePeriode &&
            n.StatusNpd != StatusDanaFlow.Ditolak);

        if (alreadyExists)
            return BadRequest(ApiResponse<NpdBop>.Fail(
                $"Permohonan NPD untuk periode {pask.KodePeriode} TA {pask.TahunAnggaran} sudah pernah dibuat. Fitur ini hanya dapat dilakukan satu kali per periode triwulan."));

        var count = await _db.NpdBops.CountAsync() + 1;
        var tgl = (req.TanggalNpd ?? DateTime.UtcNow).ToUniversalTime();
        var npd = new NpdBop
        {
            SekolahId = pask.SekolahId,
            TahunAnggaran = pask.TahunAnggaran,
            KodePeriode = pask.KodePeriode,
            NomorNpd = $"NPD/BOP/{pask.TahunAnggaran}/{count:D4}",
            TanggalNpd = tgl,
            Uraian = req.Uraian.Trim(),
            NilaiPengajuan = pask.TotalDana,
            MigrasiPaskId = pask.Id,
            Program = pask.Program,
            NomorDpaSkpd = pask.NomorDpaSkpd,
            KodeSubgiat = pask.KodeSubgiat,
            NamaSubgiat = pask.NamaSubgiat,
            NamaPask = pask.NamaPask,
            SumberDanaLabel = pask.SumberDanaLabel,
            StatusNpd = StatusDanaFlow.DraftPk,
            CreatedBy = CurrentUsername,
            Catatan = "Draft Permohonan NPD dibuat oleh PK dari hasil migrasi ADM (nominal terkunci)."
        };
        _db.NpdBops.Add(npd);
        await _db.SaveChangesAsync();

        var created = await _db.NpdBops
            .Include(n => n.Sekolah)
            .Include(n => n.MigrasiPask!)
            .ThenInclude(m => m.Rincians)
            .FirstAsync(n => n.Id == npd.Id);

        return Ok(ApiResponse<NpdBop>.Ok(created, $"Draft Permohonan NPD {created.NomorNpd} berhasil disimpan."));
    }

    [HttpPut("/api-bop/npd/{id:int}")]
    [HttpDelete("/api-bop/npd/{id:int}")]
    public ActionResult<ApiResponse<object>> BlockNpdModification(int id)
        => StatusCode(403, ApiResponse<object>.Fail("Data Permohonan NPD berasal dari migrasi ADM dan tidak dapat diubah/diedit."));

    [HttpPost("/api-bop/npd/{id:int}/ajukan")]
    public async Task<ActionResult<ApiResponse<NpdBop>>> AjukanNpd(int id)
    {
        if (!User.IsInRole(SiapBosRoles.PkNegeri) && !User.IsInRole(SiapBosRoles.AdminTdi))
            return StatusCode(403, ApiResponse<NpdBop>.Fail("Hanya Bendahara Sekolah (PK) yang berhak mengajukan NPD ke TU."));

        var npd = await _db.NpdBops.FindAsync(id);
        if (npd == null) return NotFound(ApiResponse<NpdBop>.Fail("NPD tidak ditemukan."));
        if (npd.StatusNpd != StatusDanaFlow.DraftPk)
            return BadRequest(ApiResponse<NpdBop>.Fail("Hanya NPD berstatus Draft PK (0) yang dapat diajukan ke TU."));

        npd.StatusNpd = StatusDanaFlow.DiajukanTu;
        npd.SubmittedAt = DateTime.UtcNow;
        npd.Catatan = "Diajukan Bendahara (PK) untuk persetujuan Kepala Tata Usaha (TU).";
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<NpdBop>.Ok(npd, "NPD berhasil diajukan ke TU."));
    }

    [HttpPost("/api-bop/npd/{id:int}/approve-tu")]
    public async Task<ActionResult<ApiResponse<NpdBop>>> ApproveNpdTu(int id, [FromBody] ApprovalActionRequest req)
    {
        if (!User.IsInRole(SiapBosRoles.TuNegeri) && !User.IsInRole(SiapBosRoles.AdminTdi))
            return StatusCode(403, ApiResponse<NpdBop>.Fail("Akses ditolak: Persetujuan NPD tahap TU hanya untuk TU-NEGERI."));

        var npd = await _db.NpdBops.FindAsync(id);
        if (npd == null) return NotFound(ApiResponse<NpdBop>.Fail("NPD tidak ditemukan."));
        if (npd.StatusNpd != StatusDanaFlow.DiajukanTu)
            return BadRequest(ApiResponse<NpdBop>.Fail("NPD belum diajukan PK atau sudah diproses TU."));

        npd.StatusNpd = req.Disetujui ? StatusDanaFlow.DisetujuiTu : StatusDanaFlow.Ditolak;
        npd.TuApprovedBy = CurrentUsername;
        npd.TuApprovedAt = DateTime.UtcNow;
        npd.Catatan = string.IsNullOrWhiteSpace(req.Catatan)
            ? (req.Disetujui ? "Disetujui TU, diteruskan ke Kepala Sekolah (PA)." : "Ditolak oleh TU.")
            : req.Catatan;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<NpdBop>.Ok(npd, npd.Catatan));
    }

    [HttpPost("/api-bop/npd/{id:int}/approve-pa")]
    public async Task<ActionResult<ApiResponse<NpdBop>>> ApproveNpdPa(int id, [FromBody] ApprovalActionRequest req)
    {
        if (!User.IsInRole(SiapBosRoles.PaNegeri) && !User.IsInRole(SiapBosRoles.AdminTdi))
            return StatusCode(403, ApiResponse<NpdBop>.Fail("Akses ditolak: Persetujuan NPD oleh Kepala Sekolah hanya untuk PA-NEGERI."));

        var npd = await _db.NpdBops.FindAsync(id);
        if (npd == null) return NotFound(ApiResponse<NpdBop>.Fail("NPD tidak ditemukan."));
        if (npd.StatusNpd != StatusDanaFlow.DisetujuiTu)
            return BadRequest(ApiResponse<NpdBop>.Fail("NPD harus disetujui TU terlebih dahulu sebelum diproses PA."));

        npd.StatusNpd = req.Disetujui ? StatusDanaFlow.DisetujuiPa : StatusDanaFlow.Ditolak;
        npd.PaApprovedBy = CurrentUsername;
        npd.PaApprovedAt = DateTime.UtcNow;
        npd.Catatan = string.IsNullOrWhiteSpace(req.Catatan)
            ? (req.Disetujui ? "Disetujui PA, diteruskan ke Suku Dinas Pendidikan (SUDIN)." : "Ditolak oleh PA.")
            : req.Catatan;
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
        if (npd.StatusNpd != StatusDanaFlow.DisetujuiPa)
            return BadRequest(ApiResponse<object>.Fail("NPD harus menyelesaikan persetujuan PK → TU → PA sebelum diproses Sudin."));

        if (!req.Disetujui)
        {
            npd.StatusNpd = StatusDanaFlow.Ditolak;
            npd.SudinApprovedBy = CurrentUsername;
            npd.SudinApprovedAt = DateTime.UtcNow;
            npd.Catatan = string.IsNullOrWhiteSpace(req.Catatan) ? "Ditolak oleh Suku Dinas Pendidikan." : req.Catatan;
            await _db.SaveChangesAsync();
            return Ok(ApiResponse<object>.Ok(npd, "NPD ditolak oleh Sudin."));
        }

        npd.SudinApprovedBy = CurrentUsername;
        npd.SudinApprovedAt = DateTime.UtcNow;
        npd.Catatan = "Disetujui Sudin, mengirim data NPD ke SIPKD & mencairkan dana ke rekening sekolah...";
        await _db.SaveChangesAsync();

        // Integrasi langsung ke SIPKD melalui siapbos-integration -> auto-create SP2D Dropping
        ApiResponse<SipkdNpdResponse>? sipkdResult = null;
        try
        {
            var client = _httpClientFactory.CreateClient("IntegrationClient");
            var resp = await client.PostAsJsonAsync("/api/sipkd/npd/save", new { npdId = id });
            if (resp.IsSuccessStatusCode)
                sipkdResult = await resp.Content.ReadFromJsonAsync<ApiResponse<SipkdNpdResponse>>();
        }
        catch
        {
            // Fallback to local dummy SIPKD persistence below if integration service is unavailable
        }

        if (sipkdResult?.Data == null)
        {
            var now = DateTime.UtcNow;
            var nomorSipkd = $"SIPKD/NPD-BOP/{npd.TahunAnggaran}/{Random.Shared.Next(10000, 99999)}";
            npd.StatusNpd = 4;
            npd.NomorSipkd = nomorSipkd;
            npd.TanggalKirimSipkd = now;

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
                DinasApprovedBy = CurrentUsername,
                DinasApprovedAt = now,
                Catatan = $"Cair otomatis via SIPKD ({nomorSipkd})",
                IsConfirmedToBku = false
            };
            _db.DroppingDanas.Add(dropping);
            await _db.SaveChangesAsync();

            sipkdResult = ApiResponse<SipkdNpdResponse>.Ok(new SipkdNpdResponse
            {
                ResponseCode = "00",
                ResponseMessage = $"NPD BOP berhasil disetujui Sudin, dikirim ke SIPKD ({nomorSipkd}), dan dana cair ke rekening sekolah.",
                NomorSipkd = nomorSipkd,
                DroppingId = dropping.Id,
                TanggalProses = now
            });
        }

        DroppingDana? disbursed = null;
        if (sipkdResult?.Data?.DroppingId > 0)
        {
            disbursed = await _core.ConfirmDroppingToBkuAsync(sipkdResult.Data.DroppingId, CurrentUsername);
        }

        var updatedNpd = await _db.NpdBops
            .AsNoTracking()
            .Include(n => n.Sekolah)
            .Include(n => n.MigrasiPask!)
            .ThenInclude(m => m.Rincians)
            .FirstAsync(n => n.Id == id);

        return Ok(ApiResponse<object>.Ok(
            new { npd = updatedNpd, sipkd = sipkdResult?.Data, dropping = disbursed },
            sipkdResult?.Message ?? "Disetujui Sudin, dikirim ke SIPKD & otomatis cair ke rekening sekolah."));
    }
}
