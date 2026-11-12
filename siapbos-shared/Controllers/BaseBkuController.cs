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

    [HttpGet("konfirmasi-dana")]
    public async Task<ActionResult<ApiResponse<List<DroppingDana>>>> GetDropping([FromQuery] int sekolahId, [FromQuery] int tahun = 2026)
    {
        var list = await Db.DroppingDanas
            .Where(d => d.SekolahId == sekolahId && d.TahunAnggaran == tahun && d.SumberDana == DefaultSumberDana)
            .OrderByDescending(d => d.Id)
            .ToListAsync();
        return Ok(ApiResponse<List<DroppingDana>>.Ok(list));
    }

    [HttpPost("konfirmasi-dana/{droppingId:int}/confirm")]
    public async Task<ActionResult<ApiResponse<DroppingDana>>> ConfirmDropping(int droppingId)
    {
        if (!HasAnyRole(SiapBosRoles.PkNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<DroppingDana>("Hanya Bendahara Sekolah (PK) yang berhak mengkonfirmasi dana masuk.");
        try
        {
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

    // ==================== BATAL TRANSFER SPJ (4-STAGE APPROVAL: PK -> TU -> PA -> SUDIN) ====================

    [HttpGet("batal-transfer/spj-candidates")]
    public async Task<ActionResult<ApiResponse<List<BkuTransaction>>>> GetBatalTransferSpjCandidates(
        [FromQuery] int sekolahId,
        [FromQuery] int tahun = 2026,
        [FromQuery] string? noMohon = null,
        [FromQuery] string? noBukti = null,
        [FromQuery] string? kegiatan = null)
    {
        var list = await Core.GetSpjCandidatesForBatalTransferAsync(sekolahId, tahun, DefaultSumberDana, noMohon, noBukti, kegiatan);
        return Ok(ApiResponse<List<BkuTransaction>>.Ok(list));
    }

    [HttpGet("batal-transfer")]
    public async Task<ActionResult<ApiResponse<List<BatalTransferSpj>>>> GetBatalTransferList(
        [FromQuery] int sekolahId,
        [FromQuery] int tahun = 2026,
        [FromQuery] string? kodePeriode = null,
        [FromQuery] int? status = null,
        [FromQuery] string? nomorBkuMohon = null)
    {
        var list = await Core.GetBatalTransferListAsync(sekolahId, tahun, DefaultSumberDana, kodePeriode, status, nomorBkuMohon);
        return Ok(ApiResponse<List<BatalTransferSpj>>.Ok(list));
    }

    [HttpGet("batal-transfer/{id:int}")]
    public async Task<ActionResult<ApiResponse<BatalTransferSpj>>> GetBatalTransferDetail(int id)
    {
        try
        {
            var detail = await Core.GetBatalTransferDetailAsync(id);
            return Ok(ApiResponse<BatalTransferSpj>.Ok(detail));
        }
        catch (Exception ex)
        {
            return NotFound(ApiResponse<BatalTransferSpj>.Fail(ex.Message));
        }
    }

    [HttpPost("batal-transfer")]
    public async Task<ActionResult<ApiResponse<BatalTransferSpj>>> CreateBatalTransfer([FromBody] SaveBatalTransferRequest req)
    {
        if (!HasAnyRole(SiapBosRoles.PkNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<BatalTransferSpj>("Hanya Bendahara Sekolah (PK) yang dapat membuat Berita Acara Batal Transfer.");
        try
        {
            req.SumberDana = DefaultSumberDana;
            var res = await Core.SaveOrUpdateBatalTransferAsync(null, req, CurrentUsername);
            return Ok(ApiResponse<BatalTransferSpj>.Ok(res, $"Berita Acara Batal Transfer {res.NomorBeritaAcara} berhasil disimpan."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<BatalTransferSpj>.Fail(ex.Message));
        }
    }

    [HttpPut("batal-transfer/{id:int}")]
    public async Task<ActionResult<ApiResponse<BatalTransferSpj>>> UpdateBatalTransfer(int id, [FromBody] SaveBatalTransferRequest req)
    {
        if (!HasAnyRole(SiapBosRoles.PkNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<BatalTransferSpj>("Hanya Bendahara Sekolah (PK) yang dapat mengubah Draft Batal Transfer.");
        try
        {
            req.SumberDana = DefaultSumberDana;
            var res = await Core.SaveOrUpdateBatalTransferAsync(id, req, CurrentUsername);
            return Ok(ApiResponse<BatalTransferSpj>.Ok(res, $"Berita Acara {res.NomorBeritaAcara} berhasil diperbarui."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<BatalTransferSpj>.Fail(ex.Message));
        }
    }

    [HttpDelete("batal-transfer/{id:int}")]
    public async Task<ActionResult<ApiResponse<string>>> DeleteBatalTransfer(int id)
    {
        if (!HasAnyRole(SiapBosRoles.PkNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<string>("Hanya Bendahara Sekolah (PK) yang dapat menghapus Draft Batal Transfer.");
        try
        {
            await Core.DeleteBatalTransferAsync(id);
            return Ok(ApiResponse<string>.Ok("OK", "Draft Batal Transfer berhasil dihapus."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<string>.Fail(ex.Message));
        }
    }

    [HttpPost("batal-transfer/{id:int}/ajukan-pk")]
    public async Task<ActionResult<ApiResponse<BatalTransferSpj>>> AjukanBatalTransferPk(int id, [FromBody] ApprovalActionRequest? req)
    {
        if (!HasAnyRole(SiapBosRoles.PkNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<BatalTransferSpj>("Hanya Bendahara Sekolah (PK) yang berhak mengajukan Batal Transfer ke TU.");
        try
        {
            var res = await Core.AjukanBatalTransferPkAsync(id, CurrentUsername, req?.Catatan);
            return Ok(ApiResponse<BatalTransferSpj>.Ok(res, "Usulan Batal Transfer berhasil diajukan ke TU."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<BatalTransferSpj>.Fail(ex.Message));
        }
    }

    [HttpPost("batal-transfer/{id:int}/approve-tu")]
    public async Task<ActionResult<ApiResponse<BatalTransferSpj>>> ApproveBatalTransferTu(int id, [FromBody] ApprovalActionRequest req)
    {
        if (!HasAnyRole(SiapBosRoles.TuNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<BatalTransferSpj>("Akses ditolak: Approval TU Batal Transfer hanya boleh dilakukan oleh TU-NEGERI.");
        try
        {
            var res = await Core.ApproveBatalTransferTuAsync(id, CurrentUsername, req);
            return Ok(ApiResponse<BatalTransferSpj>.Ok(res, req.Disetujui ? "Disetujui TU, diteruskan ke Kepala Sekolah (PA)." : "Ditolak TU."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<BatalTransferSpj>.Fail(ex.Message));
        }
    }

    [HttpPost("batal-transfer/{id:int}/approve-pa")]
    public async Task<ActionResult<ApiResponse<BatalTransferSpj>>> ApproveBatalTransferPa(int id, [FromBody] ApprovalActionRequest req)
    {
        if (!HasAnyRole(SiapBosRoles.PaNegeri, SiapBosRoles.AdminTdi))
            return ForbiddenRole<BatalTransferSpj>("Akses ditolak: Approval PA Batal Transfer hanya boleh dilakukan oleh Kepala Sekolah (PA-NEGERI).");
        try
        {
            var res = await Core.ApproveBatalTransferPaAsync(id, CurrentUsername, req);
            return Ok(ApiResponse<BatalTransferSpj>.Ok(res, req.Disetujui ? "Disetujui PA, diteruskan ke Sudin/Dinas." : "Ditolak PA."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<BatalTransferSpj>.Fail(ex.Message));
        }
    }

    [HttpPost("batal-transfer/{id:int}/approve-sudin")]
    public async Task<ActionResult<ApiResponse<BatalTransferSpj>>> ApproveBatalTransferSudin(int id, [FromBody] ApprovalActionRequest req)
    {
        if (!HasAnyRole(SiapBosRoles.Sudin, SiapBosRoles.AdminDinas, SiapBosRoles.AdminTdi))
            return ForbiddenRole<BatalTransferSpj>("Akses ditolak: Approval final Batal Transfer hanya oleh SUDIN / ADMIN-DINAS.");
        try
        {
            var res = await Core.ApproveBatalTransferSudinAsync(id, CurrentUsername, req);
            return Ok(ApiResponse<BatalTransferSpj>.Ok(res, req.Disetujui ? "Batal Transfer disetujui Sudin & saldo dikembalikan ke kas sekolah." : "Batal Transfer ditolak Sudin."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<BatalTransferSpj>.Fail(ex.Message));
        }
    }

    [HttpGet("penutupan/mutasi")]
    public async Task<ActionResult<ApiResponse<List<BankMutation>>>> GetMutasi(
        [FromQuery] int sekolahId,
        [FromQuery] bool limit12 = true,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
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
        var result = await resp.Content.ReadFromJsonAsync<ApiResponse<List<BankMutation>>>();
        return Ok(result ?? ApiResponse<List<BankMutation>>.Ok([]));
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

    [HttpPost("penutupan/batal-tutup-buku")]
    public async Task<ActionResult<ApiResponse<BapKasReport>>> BatalTutupBuku([FromBody] TutupBukuRequest req)
    {
        if (!HasAnyRole(SiapBosRoles.PkNegeri, SiapBosRoles.PaNegeri, SiapBosRoles.Sudin, SiapBosRoles.AdminDinas, SiapBosRoles.AdminTdi))
            return ForbiddenRole<BapKasReport>("Anda tidak memiliki otoritas Batal Tutup Buku.");
        try
        {
            var res = await Core.BatalTutupBukuAsync(req.SekolahId, req.TahunAnggaran, DefaultSumberDana, req.KodePeriode);
            return Ok(ApiResponse<BapKasReport>.Ok(res, $"Batal Tutup Buku {DefaultSumberDana} Periode {req.KodePeriode} berhasil dibuka kembali."));
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
