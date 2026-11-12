using System.Net.Http.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

    [HttpPost("input-spj")]
    public async Task<ActionResult<ApiResponse<BkuTransaction>>> CreateBku([FromBody] CreateBkuRequest req)
    {
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

    [HttpDelete("input-spj/{bkuId:int}")]
    public async Task<ActionResult<ApiResponse<string>>> DeleteDraft(int bkuId)
    {
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
