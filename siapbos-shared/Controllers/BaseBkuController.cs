using System.Net.Http.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SiapBos.Shared.Constants;
using SiapBos.Shared.Data;
using SiapBos.Shared.DTOs;
using SiapBos.Shared.Entities;
using SiapBos.Shared.Services;

namespace SiapBos.Shared.Controllers;

[Authorize]
[ApiController]
public abstract class BaseBkuController : ControllerBase
{
    protected readonly SiapBosDbContext Db;
    protected readonly BkuCoreService Core;
    protected readonly IHttpClientFactory HttpClientFactory;

    protected abstract string DefaultSumberDana { get; }

    protected BaseBkuController(SiapBosDbContext db, BkuCoreService core, IHttpClientFactory httpClientFactory)
    {
        Db = db;
        Core = core;
        HttpClientFactory = httpClientFactory;
    }

    protected string CurrentUsername => User.FindFirst("username")?.Value ?? "system";

    protected bool HasAnyRole(params string[] roles) => roles.Any(r => User.IsInRole(r));

    protected ActionResult<ApiResponse<T>> ForbiddenRole<T>(string message) =>
        StatusCode(403, ApiResponse<T>.Fail(message));

    [HttpGet("migrasi-candidates")]
    public async Task<ActionResult<ApiResponse<object>>> GetMigrasiCandidates(
        [FromQuery] int sekolahId,
        [FromQuery] int tahun = 2026)
    {
        var usedPeriodes = await Db.DroppingDanas
            .Where(d => d.SekolahId == sekolahId && d.TahunAnggaran == tahun && d.SumberDana == DefaultSumberDana && d.StatusDropping != StatusDanaFlow.Ditolak)
            .Select(d => d.KodePeriode)
            .ToListAsync();

        var pasks = await Db.MigrasiPasks
            .Include(m => m.Rincians)
            .Where(m => m.SekolahId == sekolahId && m.TahunAnggaran == tahun && m.SumberDana == DefaultSumberDana)
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

    [HttpGet("konfirmasi-dana")]
    public async Task<ActionResult<ApiResponse<List<DroppingDana>>>> GetDropping(
        [FromQuery] int sekolahId = 0,
        [FromQuery] int tahun = 2026,
        [FromQuery] string? kodePeriode = null,
        [FromQuery] int? status = null,
        [FromQuery] string? search = null)
    {
        var query = Db.DroppingDanas
            .Include(d => d.Sekolah)
            .Include(d => d.MigrasiPask!)
            .ThenInclude(m => m.Rincians)
            .Where(d => d.TahunAnggaran == tahun && d.SumberDana == DefaultSumberDana);

        if (sekolahId > 0)
            query = query.Where(d => d.SekolahId == sekolahId);

        if (!string.IsNullOrWhiteSpace(kodePeriode))
            query = query.Where(d => d.KodePeriode == kodePeriode);

        if (status.HasValue)
            query = query.Where(d => d.StatusDropping == status.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(d =>
                d.NomorSp2d.ToLower().Contains(term) ||
                d.NamaPask.ToLower().Contains(term) ||
                d.Keterangan.ToLower().Contains(term));
        }

        var list = await query.OrderByDescending(d => d.Id).ToListAsync();
        return Ok(ApiResponse<List<DroppingDana>>.Ok(list));
    }

    [HttpGet("konfirmasi-dana/{droppingId:int}")]
    public async Task<ActionResult<ApiResponse<DroppingDana>>> GetDroppingDetail(int droppingId)
    {
        var item = await Db.DroppingDanas
            .Include(d => d.Sekolah)
            .Include(d => d.MigrasiPask!)
            .ThenInclude(m => m.Rincians)
            .FirstOrDefaultAsync(d => d.Id == droppingId && d.SumberDana == DefaultSumberDana);
        if (item == null)
            return NotFound(ApiResponse<DroppingDana>.Fail("Data Dropping Dana tidak ditemukan."));
        return Ok(ApiResponse<DroppingDana>.Ok(item));
    }

    [HttpPost("konfirmasi-dana")]
    public async Task<ActionResult<ApiResponse<DroppingDana>>> CreateDroppingFromMigrasi([FromBody] CreateDroppingFromMigrasiRequest req)
    {
        if (!HasAnyRole(SiapBosRoles.PkNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<DroppingDana>("Hanya Bendahara Sekolah (PK) yang berhak menginput Dropping Dana dari hasil migrasi ADM.");

        var pask = await Db.MigrasiPasks
            .Include(m => m.Rincians)
            .FirstOrDefaultAsync(m => m.Id == req.MigrasiPaskId && m.SumberDana == DefaultSumberDana);

        if (pask == null)
            return BadRequest(ApiResponse<DroppingDana>.Fail($"Data PASK hasil migrasi ADM untuk {DefaultSumberDana} tidak ditemukan."));

        if (req.SekolahId > 0 && req.SekolahId != pask.SekolahId)
            return ForbiddenRole<DroppingDana>("Akses ditolak: Data migrasi PASK bukan milik sekolah ini.");

        if (string.IsNullOrWhiteSpace(req.Keterangan))
            return BadRequest(ApiResponse<DroppingDana>.Fail("Uraian / keterangan pengajuan Dropping Dana wajib diisi."));

        var alreadyExists = await Db.DroppingDanas.AnyAsync(d =>
            d.SekolahId == pask.SekolahId &&
            d.TahunAnggaran == pask.TahunAnggaran &&
            d.SumberDana == DefaultSumberDana &&
            d.KodePeriode == pask.KodePeriode &&
            d.StatusDropping != StatusDanaFlow.Ditolak);

        if (alreadyExists)
            return BadRequest(ApiResponse<DroppingDana>.Fail(
                $"Dropping Dana {DefaultSumberDana} untuk periode {pask.KodePeriode} TA {pask.TahunAnggaran} sudah pernah diinput. Fitur ini hanya dapat dilakukan satu kali per periode triwulan."));

        var count = await Db.DroppingDanas.CountAsync() + 1;
        var tgl = (req.TanggalDropping ?? DateTime.UtcNow).ToUniversalTime();
        var prefix = DefaultSumberDana == SumberDanaTypes.Bos ? "KEMENDIKBUD/BOS" : "BPKD-DKI/BOP";

        var dropping = new DroppingDana
        {
            SekolahId = pask.SekolahId,
            TahunAnggaran = pask.TahunAnggaran,
            SumberDana = DefaultSumberDana,
            KodePeriode = pask.KodePeriode,
            NamaPeriode = string.IsNullOrWhiteSpace(pask.NamaPeriode) ? pask.KodePeriode : pask.NamaPeriode,
            NomorSp2d = $"SP2D/{prefix}/{pask.TahunAnggaran}/{count:D4}",
            TanggalDropping = tgl,
            NilaiDropping = pask.TotalDana,
            Keterangan = req.Keterangan.Trim(),
            MigrasiPaskId = pask.Id,
            Program = pask.Program,
            NomorDpaSkpd = pask.NomorDpaSkpd,
            KodeSubgiat = pask.KodeSubgiat,
            NamaSubgiat = pask.NamaSubgiat,
            NamaPask = pask.NamaPask,
            StatusDropping = StatusDanaFlow.DraftPk,
            CreatedBy = CurrentUsername,
            Catatan = "Draft Dropping Dana dibuat oleh PK berdasarkan migrasi ADM (nominal terkunci).",
            IsConfirmedToBku = false
        };

        Db.DroppingDanas.Add(dropping);
        await Db.SaveChangesAsync();

        var created = await Db.DroppingDanas
            .Include(d => d.Sekolah)
            .Include(d => d.MigrasiPask!)
            .ThenInclude(m => m.Rincians)
            .FirstAsync(d => d.Id == dropping.Id);

        return Ok(ApiResponse<DroppingDana>.Ok(created, $"Draft Dropping Dana {created.NomorSp2d} berhasil dibuat dari migrasi ADM."));
    }

    [HttpPost("konfirmasi-dana/{droppingId:int}/ajukan")]
    public async Task<ActionResult<ApiResponse<DroppingDana>>> AjukanDropping(int droppingId)
    {
        if (!HasAnyRole(SiapBosRoles.PkNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<DroppingDana>("Hanya Bendahara Sekolah (PK) yang berhak mengajukan Dropping Dana ke TU.");

        var d = await Db.DroppingDanas.FindAsync(droppingId);
        if (d == null || d.SumberDana != DefaultSumberDana)
            return NotFound(ApiResponse<DroppingDana>.Fail("Data Dropping Dana tidak ditemukan."));
        if (d.StatusDropping != StatusDanaFlow.DraftPk)
            return BadRequest(ApiResponse<DroppingDana>.Fail("Hanya Dropping Dana berstatus Draft PK (0) yang dapat diajukan ke TU."));

        d.StatusDropping = StatusDanaFlow.DiajukanTu;
        d.Catatan = "Diajukan Bendahara (PK), menunggu persetujuan Kepala Tata Usaha (TU).";
        await Db.SaveChangesAsync();
        return Ok(ApiResponse<DroppingDana>.Ok(d, "Dropping Dana berhasil diajukan ke TU."));
    }

    [HttpPost("konfirmasi-dana/{droppingId:int}/approve-tu")]
    public async Task<ActionResult<ApiResponse<DroppingDana>>> ApproveDroppingTu(int droppingId, [FromBody] ApprovalActionRequest req)
    {
        if (!HasAnyRole(SiapBosRoles.TuNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<DroppingDana>("Akses ditolak: Persetujuan Dropping Dana tahap TU hanya untuk TU-NEGERI.");

        var d = await Db.DroppingDanas.FindAsync(droppingId);
        if (d == null || d.SumberDana != DefaultSumberDana)
            return NotFound(ApiResponse<DroppingDana>.Fail("Data Dropping Dana tidak ditemukan."));
        if (d.StatusDropping != StatusDanaFlow.DiajukanTu)
            return BadRequest(ApiResponse<DroppingDana>.Fail("Dropping Dana belum diajukan oleh PK atau sudah diproses TU."));

        d.StatusDropping = req.Disetujui ? StatusDanaFlow.DisetujuiTu : StatusDanaFlow.Ditolak;
        d.TuApprovedBy = CurrentUsername;
        d.TuApprovedAt = DateTime.UtcNow;
        d.Catatan = string.IsNullOrWhiteSpace(req.Catatan)
            ? (req.Disetujui ? "Disetujui TU, menunggu persetujuan Kepala Sekolah (PA)." : "Ditolak oleh TU.")
            : req.Catatan;
        await Db.SaveChangesAsync();
        return Ok(ApiResponse<DroppingDana>.Ok(d, d.Catatan));
    }

    [HttpPost("konfirmasi-dana/{droppingId:int}/approve-pa")]
    public async Task<ActionResult<ApiResponse<DroppingDana>>> ApproveDroppingPa(int droppingId, [FromBody] ApprovalActionRequest req)
    {
        if (!HasAnyRole(SiapBosRoles.PaNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<DroppingDana>("Akses ditolak: Persetujuan Dropping Dana tahap PA hanya untuk PA-NEGERI.");

        var d = await Db.DroppingDanas.FindAsync(droppingId);
        if (d == null || d.SumberDana != DefaultSumberDana)
            return NotFound(ApiResponse<DroppingDana>.Fail("Data Dropping Dana tidak ditemukan."));
        if (d.StatusDropping != StatusDanaFlow.DisetujuiTu)
            return BadRequest(ApiResponse<DroppingDana>.Fail("Dropping Dana harus disetujui TU terlebih dahulu sebelum diproses PA."));

        var nextLabel = DefaultSumberDana == SumberDanaTypes.Bos ? "Dinas Pendidikan (ADMIN-DINAS)" : "Suku Dinas (SUDIN)";
        d.StatusDropping = req.Disetujui ? StatusDanaFlow.DisetujuiPa : StatusDanaFlow.Ditolak;
        d.PaApprovedBy = CurrentUsername;
        d.PaApprovedAt = DateTime.UtcNow;
        d.Catatan = string.IsNullOrWhiteSpace(req.Catatan)
            ? (req.Disetujui ? $"Disetujui PA, menunggu persetujuan & pencairan {nextLabel}." : "Ditolak oleh PA.")
            : req.Catatan;
        await Db.SaveChangesAsync();
        return Ok(ApiResponse<DroppingDana>.Ok(d, d.Catatan));
    }

    [HttpPost("konfirmasi-dana/{droppingId:int}/approve-dinas")]
    public async Task<ActionResult<ApiResponse<DroppingDana>>> ApproveDroppingDinas(int droppingId, [FromBody] ApprovalActionRequest req)
    {
        var allowed = DefaultSumberDana == SumberDanaTypes.Bos
            ? HasAnyRole(SiapBosRoles.AdminDinas, SiapBosRoles.AdminTdi)
            : HasAnyRole(SiapBosRoles.Sudin, SiapBosRoles.AdminDinas, SiapBosRoles.AdminTdi);

        if (!allowed)
            return ForbiddenRole<DroppingDana>($"Akses ditolak: Persetujuan akhir Dropping Dana {DefaultSumberDana} hanya untuk DINAS/SUDIN.");

        var d = await Db.DroppingDanas.FindAsync(droppingId);
        if (d == null || d.SumberDana != DefaultSumberDana)
            return NotFound(ApiResponse<DroppingDana>.Fail("Data Dropping Dana tidak ditemukan."));
        if (d.StatusDropping != StatusDanaFlow.DisetujuiPa)
            return BadRequest(ApiResponse<DroppingDana>.Fail("Dropping Dana harus disetujui berjenjang PK → TU → PA sebelum persetujuan akhir Dinas/Sudin."));

        if (!req.Disetujui)
        {
            d.StatusDropping = StatusDanaFlow.Ditolak;
            d.DinasApprovedBy = CurrentUsername;
            d.DinasApprovedAt = DateTime.UtcNow;
            d.Catatan = string.IsNullOrWhiteSpace(req.Catatan) ? "Ditolak oleh Dinas/Sudin." : req.Catatan;
            await Db.SaveChangesAsync();
            return Ok(ApiResponse<DroppingDana>.Ok(d, d.Catatan));
        }

        d.StatusDropping = StatusDanaFlow.CairDisetujui;
        d.DinasApprovedBy = CurrentUsername;
        d.DinasApprovedAt = DateTime.UtcNow;
        d.Catatan = string.IsNullOrWhiteSpace(req.Catatan)
            ? "Disetujui Dinas/Sudin & otomatis cair ke rekening sekolah (BKU JO)."
            : req.Catatan;
        await Db.SaveChangesAsync();

        try
        {
            var res = await Core.ConfirmDroppingToBkuAsync(droppingId, CurrentUsername);
            return Ok(ApiResponse<DroppingDana>.Ok(res, $"Dropping dana {res.NomorSp2d} disetujui & otomatis cair ke rekening sekolah (transaksi BKU JO)."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<DroppingDana>.Fail(ex.Message));
        }
    }

    [HttpPut("konfirmasi-dana/{droppingId:int}")]
    [HttpDelete("konfirmasi-dana/{droppingId:int}")]
    public ActionResult<ApiResponse<object>> BlockDroppingModification(int droppingId)
        => StatusCode(403, ApiResponse<object>.Fail("Data Dropping Dana berasal dari migrasi ADM dan tidak dapat diubah/diedit."));

    [HttpPost("konfirmasi-dana/{droppingId:int}/confirm")]
    public async Task<ActionResult<ApiResponse<DroppingDana>>> ConfirmDropping(int droppingId)
    {
        if (!HasAnyRole(SiapBosRoles.PkNegeri, SiapBosRoles.AdminDinas, SiapBosRoles.Sudin, SiapBosRoles.AdminTdi))
            return ForbiddenRole<DroppingDana>("Tidak memiliki hak akses konfirmasi dana.");
        var d = await Db.DroppingDanas.FindAsync(droppingId);
        if (d == null || d.SumberDana != DefaultSumberDana)
            return NotFound(ApiResponse<DroppingDana>.Fail("Data Dropping Dana tidak ditemukan."));
        if (d.StatusDropping < StatusDanaFlow.DisetujuiPa)
            return BadRequest(ApiResponse<DroppingDana>.Fail("Dropping Dana belum menyelesaikan persetujuan PK → TU → PA."));
        try
        {
            if (d.StatusDropping == StatusDanaFlow.DisetujuiPa)
            {
                d.StatusDropping = StatusDanaFlow.CairDisetujui;
                d.DinasApprovedBy = CurrentUsername;
                d.DinasApprovedAt = DateTime.UtcNow;
                await Db.SaveChangesAsync();
            }
            var res = await Core.ConfirmDroppingToBkuAsync(droppingId, CurrentUsername);
            return Ok(ApiResponse<DroppingDana>.Ok(res, $"Dropping dana {res.NomorSp2d} berhasil masuk ke BKU sebagai transaksi JO."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<DroppingDana>.Fail(ex.Message));
        }
    }

    [HttpGet("input-spj/summary")]
    public async Task<ActionResult<ApiResponse<BkuSummarySaldoDto>>> GetSummarySaldo([FromQuery] int sekolahId, [FromQuery] int tahun = 2026)
    {
        try
        {
            var summary = await Core.GetSummarySaldoAsync(sekolahId, tahun, DefaultSumberDana);
            return Ok(ApiResponse<BkuSummarySaldoDto>.Ok(summary));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<BkuSummarySaldoDto>.Fail(ex.Message));
        }
    }

    [HttpGet("input-spj")]
    public async Task<ActionResult<ApiResponse<List<BkuTransaction>>>> GetBkuList(
        [FromQuery] int sekolahId,
        [FromQuery] int tahun = 2026,
        [FromQuery] string? kodePeriode = null,
        [FromQuery] string? kodeTrx = null,
        [FromQuery] int? statusBku = null)
    {
        var list = await Core.GetBkuListAsync(sekolahId, tahun, DefaultSumberDana, kodePeriode, kodeTrx, statusBku);
        return Ok(ApiResponse<List<BkuTransaction>>.Ok(list));
    }

    [HttpGet("input-spj/draft-spj-candidates")]
    public async Task<ActionResult<ApiResponse<List<BkuTransaction>>>> GetDraftSpjCandidates(
        [FromQuery] int sekolahId,
        [FromQuery] int tahun = 2026,
        [FromQuery] string? search = null)
    {
        var list = await Core.GetDraftSpjCandidatesAsync(sekolahId, tahun, DefaultSumberDana, search);
        return Ok(ApiResponse<List<BkuTransaction>>.Ok(list));
    }

    [HttpGet("input-spj/penerimaan-pajak-candidates")]
    public async Task<ActionResult<ApiResponse<List<BkuTransaction>>>> GetPenerimaanPajakCandidates(
        [FromQuery] int sekolahId,
        [FromQuery] int tahun = 2026,
        [FromQuery] string? search = null)
    {
        var list = await Core.GetPenerimaanPajakCandidatesAsync(sekolahId, tahun, DefaultSumberDana, search);
        return Ok(ApiResponse<List<BkuTransaction>>.Ok(list));
    }

    [HttpGet("input-spj/{bkuId:int}")]
    public async Task<ActionResult<ApiResponse<BkuTransaction>>> GetBkuDetail(int bkuId)
    {
        try
        {
            var detail = await Core.GetBkuDetailAsync(bkuId);
            return Ok(ApiResponse<BkuTransaction>.Ok(detail));
        }
        catch (Exception ex)
        {
            return NotFound(ApiResponse<BkuTransaction>.Fail(ex.Message));
        }
    }

    [HttpPost("input-spj")]
    public async Task<ActionResult<ApiResponse<BkuTransaction>>> CreateBku([FromBody] CreateBkuRequest req)
    {
        if (!HasAnyRole(SiapBosRoles.PkNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<BkuTransaction>("Hanya Bendahara Sekolah (PK) yang dapat menginput transaksi BKU.");
        try
        {
            req.SumberDana = DefaultSumberDana;
            var created = await Core.CreateBkuAsync(req, CurrentUsername);
            return Ok(ApiResponse<BkuTransaction>.Ok(created, $"Transaksi {created.NomorBku} berhasil dicatat."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<BkuTransaction>.Fail(ex.Message));
        }
    }

    [HttpPut("input-spj/{bkuId:int}")]
    public async Task<ActionResult<ApiResponse<BkuTransaction>>> UpdateBku(int bkuId, [FromBody] CreateBkuRequest req)
    {
        if (!HasAnyRole(SiapBosRoles.PkNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<BkuTransaction>("Hanya Bendahara Sekolah (PK) yang dapat mengubah Draft BKU.");
        try
        {
            req.SumberDana = DefaultSumberDana;
            var updated = await Core.UpdateDraftBkuAsync(bkuId, req, CurrentUsername);
            return Ok(ApiResponse<BkuTransaction>.Ok(updated, $"Draft BKU {updated.NomorBku} berhasil diperbarui."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<BkuTransaction>.Fail(ex.Message));
        }
    }

    [HttpDelete("input-spj/{bkuId:int}")]
    public async Task<ActionResult<ApiResponse<string>>> DeleteDraft(int bkuId)
    {
        if (!HasAnyRole(SiapBosRoles.PkNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<string>("Hanya Bendahara Sekolah (PK) yang dapat menghapus Draft BKU.");
        try
        {
            await Core.DeleteDraftBkuAsync(bkuId);
            return Ok(ApiResponse<string>.Ok("OK", "Transaksi draft berhasil dihapus."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<string>.Fail(ex.Message));
        }
    }

    [HttpPost("workflow/pengajuan-pk/{bkuId:int}")]
    public async Task<ActionResult<ApiResponse<BkuTransaction>>> PengajuanPk(int bkuId)
    {
        if (!HasAnyRole(SiapBosRoles.PkNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<BkuTransaction>("Hanya Bendahara Sekolah (PK) yang berhak mengajukan BKU ke TU.");
        try
        {
            var res = await Core.AjukanPkAsync(bkuId);
            return Ok(ApiResponse<BkuTransaction>.Ok(res, "BKU berhasil diajukan ke Verifikator (TU)."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<BkuTransaction>.Fail(ex.Message));
        }
    }

    [HttpPost("workflow/approval-tu/{bkuId:int}")]
    public async Task<ActionResult<ApiResponse<BkuTransaction>>> ApprovalTu(int bkuId, [FromBody] ApprovalActionRequest req)
    {
        if (!HasAnyRole(SiapBosRoles.TuNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<BkuTransaction>("Akses ditolak: Persetujuan tahap TU hanya dapat dilakukan oleh Verifikator Tata Usaha (TU-NEGERI).");
        try
        {
            var res = await Core.ApproveTuAsync(bkuId, req);
            return Ok(ApiResponse<BkuTransaction>.Ok(res, req.Disetujui ? "Disetujui TU, diteruskan ke Kepala Sekolah (PA)." : "Ditolak TU."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<BkuTransaction>.Fail(ex.Message));
        }
    }

    [HttpPost("workflow/approval-pa/{bkuId:int}")]
    public async Task<ActionResult<ApiResponse<BkuTransaction>>> ApprovalPa(int bkuId, [FromBody] ApprovalActionRequest req)
    {
        if (!HasAnyRole(SiapBosRoles.PaNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<BkuTransaction>("Akses ditolak: Persetujuan tahap PA hanya dapat dilakukan oleh Kepala Sekolah (PA-NEGERI).");
        try
        {
            var res = await Core.ApprovePaAsync(bkuId, req);
            return Ok(ApiResponse<BkuTransaction>.Ok(res, req.Disetujui ? "Disetujui Kepala Sekolah (PA). Siap dibuatkan Token CMS." : "Ditolak PA."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<BkuTransaction>.Fail(ex.Message));
        }
    }

    [HttpPost("workflow/approval-sudin/{bkuId:int}")]
    public async Task<ActionResult<ApiResponse<BkuTransaction>>> ApprovalSudin(int bkuId, [FromBody] ApprovalActionRequest req)
    {
        if (!HasAnyRole(SiapBosRoles.Sudin, SiapBosRoles.AdminDinas, SiapBosRoles.AdminTdi))
            return ForbiddenRole<BkuTransaction>("Akses ditolak: Persetujuan tahap Sudin/Dinas hanya dapat dilakukan oleh SUDIN atau ADMIN-DINAS.");
        try
        {
            var res = await Core.ApproveSudinAsync(bkuId, req);
            return Ok(ApiResponse<BkuTransaction>.Ok(res, req.Disetujui ? "Disetujui Suku Dinas Pendidikan." : "Ditolak Sudin."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<BkuTransaction>.Fail(ex.Message));
        }
    }

    [HttpPost("pembayaran/token")]
    public async Task<ActionResult<ApiResponse<BankDkiCreateTokenResponse>>> PermohonanToken([FromBody] BankDkiCreateTokenRequest req)
    {
        if (!HasAnyRole(SiapBosRoles.PaNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<BankDkiCreateTokenResponse>("Akses ditolak: Permohonan Token OTP CMS hanya dapat dilakukan oleh Kepala Sekolah (PA-NEGERI).");
        try
        {
            var res = await Core.RequestTokenViaIntegrationAsync(req.BkuId, req.Nrk);
            return Ok(ApiResponse<BankDkiCreateTokenResponse>.Ok(res, res.ResponseMessage));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<BankDkiCreateTokenResponse>.Fail(ex.Message));
        }
    }

    [HttpPost("pembayaran/transfer")]
    public async Task<ActionResult<ApiResponse<SpjTransferResponse>>> TransferSpj([FromBody] SpjTransferRequest req)
    {
        if (!HasAnyRole(SiapBosRoles.PkNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<SpjTransferResponse>("Akses ditolak: Eksekusi transfer CMS Bank DKI hanya dilakukan oleh Bendahara (PK-NEGERI).");
        try
        {
            req.ExecutedBy = CurrentUsername;
            var res = await Core.ExecuteTransferViaIntegrationAsync(req.BkuId, req.TokenOtp, req.ExecutedBy, DefaultSumberDana);
            return Ok(ApiResponse<SpjTransferResponse>.Ok(res, res.Message));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<SpjTransferResponse>.Fail(ex.Message));
        }
    }

    [HttpPost("pembayaran/va-transfer")]
    public async Task<ActionResult<ApiResponse<VaTransferResponse>>> VaTransferSpj([FromBody] VaExecuteTransferRequest req)
    {
        if (!HasAnyRole(SiapBosRoles.PkNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<VaTransferResponse>("Akses ditolak: Eksekusi transfer Virtual Account hanya dilakukan oleh Bendahara (PK-NEGERI).");
        try
        {
            req.ExecutedBy = CurrentUsername;
            var res = await Core.ExecuteVaTransferViaIntegrationAsync(req.BkuId, req.ExecutedBy, DefaultSumberDana);
            return Ok(ApiResponse<VaTransferResponse>.Ok(res, res.Message));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<VaTransferResponse>.Fail(ex.Message));
        }
    }

    [HttpPost("pembayaran/pajak/{taxId:int}/{actionName}")]
    public async Task<ActionResult<ApiResponse<BkuTaxItem>>> ProcessTax(int taxId, string actionName)
    {
        if (!HasAnyRole(SiapBosRoles.PkNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<BkuTaxItem>("Hanya Bendahara Sekolah (PK) yang mengelola Billing & NTPN Pajak.");
        try
        {
            var res = await Core.ExecuteTaxIntegrationAsync(taxId, actionName);
            return Ok(ApiResponse<BkuTaxItem>.Ok(res, $"Proses pajak '{actionName}' berhasil."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<BkuTaxItem>.Fail(ex.Message));
        }
    }

    [HttpGet("penutupan/mutasi")]
    public async Task<ActionResult<ApiResponse<List<BankMutation>>>> GetMutasi(
        [FromQuery] int sekolahId,
        [FromQuery] bool limit12 = true,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        try
        {
            var client = HttpClientFactory.CreateClient("IntegrationClient");
            var resp = await client.PostAsJsonAsync("/api/mutasi/byNoRek", new
            {
                sekolahId,
                sumberDana = DefaultSumberDana,
                limit12,
                tanggalMulai = startDate,
                tanggalAkhir = endDate
            });
            if (resp.IsSuccessStatusCode)
            {
                var result = await resp.Content.ReadFromJsonAsync<ApiResponse<List<BankMutation>>>();
                if (result?.Success == true && result.Data != null && result.Data.Count > 0)
                    return Ok(result);
            }
        }
        catch
        {
            // Fallback to dummy mutations when integration service is unavailable
        }

        return Ok(ApiResponse<List<BankMutation>>.Ok(DummyIntegrationFactory.BuildDummyMutations(sekolahId, DefaultSumberDana, "1010010012345")));
    }

    [HttpGet("penutupan/bap-kas")]
    public async Task<ActionResult<ApiResponse<List<BapKasReport>>>> GetBapKas([FromQuery] int sekolahId, [FromQuery] int tahun = 2026)
    {
        var list = await Db.BapKasReports
            .Where(b => b.SekolahId == sekolahId && b.TahunAnggaran == tahun && b.SumberDana == DefaultSumberDana)
            .OrderByDescending(b => b.Id)
            .ToListAsync();
        return Ok(ApiResponse<List<BapKasReport>>.Ok(list));
    }

    [HttpPost("penutupan/bap-kas")]
    public async Task<ActionResult<ApiResponse<BapKasReport>>> SaveBapKas([FromBody] BapKasSaveRequest req)
    {
        if (!HasAnyRole(SiapBosRoles.PkNegeri, SiapBosRoles.PaNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<BapKasReport>("Hanya PK / PA Sekolah yang dapat membuat atau mengubah BAP Kas.");
        try
        {
            var res = await Core.SaveOrUpdateBapKasAsync(
                req.SekolahId, req.TahunAnggaran, DefaultSumberDana, req.KodePeriode,
                req.SaldoKasTunai, req.Pecahan100rb, req.Pecahan50rb, req.Pecahan20rb,
                req.Pecahan10rb, req.Pecahan5rb, req.Pecahan2rb, req.Pecahan1rb, req.KeteranganSelisih);
            return Ok(ApiResponse<BapKasReport>.Ok(res, $"BAP Kas {res.NomorBap} berhasil disimpan."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<BapKasReport>.Fail(ex.Message));
        }
    }

    [HttpPost("penutupan/bap-kas/{bapId:int}/approve/{targetStatus:int}")]
    public async Task<ActionResult<ApiResponse<BapKasReport>>> ApproveBapKas(int bapId, int targetStatus)
    {
        if (targetStatus == 1 && !HasAnyRole(SiapBosRoles.PaNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<BapKasReport>("Persetujuan tahap 1 BAP Kas hanya dapat dilakukan oleh PA-NEGERI.");
        if (targetStatus == 2 && !HasAnyRole(SiapBosRoles.Sudin, SiapBosRoles.AdminDinas, SiapBosRoles.AdminTdi))
            return ForbiddenRole<BapKasReport>("Persetujuan tahap 2 BAP Kas hanya dapat dilakukan oleh SUDIN atau ADMIN-DINAS.");
        try
        {
            var res = await Core.ApproveBapKasAsync(bapId, targetStatus);
            return Ok(ApiResponse<BapKasReport>.Ok(res, "Status persetujuan BAP Kas diperbarui."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<BapKasReport>.Fail(ex.Message));
        }
    }

    [HttpPost("penutupan/tutup-buku")]
    public async Task<ActionResult<ApiResponse<BapKasReport>>> TutupBuku([FromBody] TutupBukuRequest req)
    {
        if (!HasAnyRole(SiapBosRoles.PkNegeri, SiapBosRoles.PaNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<BapKasReport>("Hanya PK / PA Sekolah yang dapat melakukan Tutup Buku BKU.");
        try
        {
            var res = await Core.TutupBukuAsync(req.SekolahId, req.TahunAnggaran, DefaultSumberDana, req.KodePeriode);
            return Ok(ApiResponse<BapKasReport>.Ok(res, $"Tutup Buku {DefaultSumberDana} Periode {req.KodePeriode} berhasil dikunci."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<BapKasReport>.Fail(ex.Message));
        }
    }

    [HttpGet("penutupan/setoran-sts")]
    public async Task<ActionResult<ApiResponse<List<SetoranSts>>>> GetSts([FromQuery] int sekolahId, [FromQuery] int tahun = 2026) =>
        Ok(ApiResponse<List<SetoranSts>>.Ok(await Core.GetSetoranStsAsync(sekolahId, tahun, DefaultSumberDana)));

    [HttpPost("penutupan/setoran-sts")]
    public async Task<ActionResult<ApiResponse<SetoranSts>>> CreateSts([FromBody] SetoranStsCreateRequest req)
    {
        if (!HasAnyRole(SiapBosRoles.PkNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<SetoranSts>("Hanya Bendahara Sekolah (PK) yang dapat membuat pengajuan STS.");
        try
        {
            var res = await Core.CreateSetoranStsAsync(req.SekolahId, req.TahunAnggaran, DefaultSumberDana, req.KodePeriode, req.JenisSetoran, req.Uraian, req.NilaiSetor);
            return Ok(ApiResponse<SetoranSts>.Ok(res, $"Pengajuan STS {res.NomorSts} berhasil dibuat."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<SetoranSts>.Fail(ex.Message));
        }
    }

    [HttpPost("penutupan/setoran-sts/{stsId:int}/process/{targetStatus:int}")]
    public async Task<ActionResult<ApiResponse<SetoranSts>>> ProcessSts(int stsId, int targetStatus)
    {
        if (targetStatus == 2 && !HasAnyRole(SiapBosRoles.Sudin, SiapBosRoles.AdminDinas, SiapBosRoles.AdminTdi))
            return ForbiddenRole<SetoranSts>("Persetujuan STS tahap Sudin hanya untuk SUDIN / ADMIN-DINAS.");
        if (targetStatus == 3 && !HasAnyRole(SiapBosRoles.PkNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<SetoranSts>("Eksekusi setor STS hanya dapat dilakukan oleh Bendahara Sekolah (PK).");
        try
        {
            var res = await Core.ApproveOrExecuteStsAsync(stsId, targetStatus, CurrentUsername);
            return Ok(ApiResponse<SetoranSts>.Ok(res, targetStatus == 3 ? "STS lunas disetor & tercatat di BKU." : "STS disetujui Sudin."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<SetoranSts>.Fail(ex.Message));
        }
    }
}
