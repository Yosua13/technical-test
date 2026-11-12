using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SiapBos.Report.Services;

namespace SiapBos.Report.Controllers;

[ApiController]
[AllowAnonymous]
public class ReportController : ControllerBase
{
    private readonly BosBopPdfGenerator _pdf;
    private readonly BosBopExcelGenerator _excel;

    public ReportController(BosBopPdfGenerator pdf, BosBopExcelGenerator excel)
    {
        _pdf = pdf;
        _excel = excel;
    }

    [HttpGet("/pdf/form22")]
    public async Task<IActionResult> Form22([FromQuery] int sekolahId, [FromQuery] int tahun = 2026, [FromQuery] string sumberDana = "BOS", [FromQuery] string? kodePeriode = null)
    {
        var bytes = await _pdf.GenerateForm22Or23PdfAsync(sekolahId, tahun, sumberDana, kodePeriode, bankOnly: false);
        return File(bytes, "application/pdf", $"Form22_BKU_{sumberDana}_{tahun}.pdf");
    }

    [HttpGet("/pdf/form23")]
    public async Task<IActionResult> Form23([FromQuery] int sekolahId, [FromQuery] int tahun = 2026, [FromQuery] string sumberDana = "BOS", [FromQuery] string? kodePeriode = null)
    {
        var bytes = await _pdf.GenerateForm22Or23PdfAsync(sekolahId, tahun, sumberDana, kodePeriode, bankOnly: true);
        return File(bytes, "application/pdf", $"Form23_KasBank_{sumberDana}_{tahun}.pdf");
    }

    [HttpGet("/pdf/form25")]
    public async Task<IActionResult> Form25([FromQuery] int sekolahId, [FromQuery] int tahun = 2026, [FromQuery] string sumberDana = "BOS", [FromQuery] string? kodeTrxPajak = null)
    {
        var bytes = await _pdf.GenerateForm25TaxPdfAsync(sekolahId, tahun, sumberDana, kodeTrxPajak);
        return File(bytes, "application/pdf", $"Form25_BukuPajak_{sumberDana}_{tahun}.pdf");
    }

    [HttpGet("/pdf/kartu-kendali")]
    public async Task<IActionResult> KartuKendali([FromQuery] int sekolahId, [FromQuery] int tahun = 2026, [FromQuery] string sumberDana = "BOS")
    {
        var bytes = await _pdf.GenerateKartuKendaliPdfAsync(sekolahId, tahun, sumberDana, formatK1K7: false);
        return File(bytes, "application/pdf", $"Kartu_Kendali_{sumberDana}_{tahun}.pdf");
    }

    [HttpGet("/pdf/form19-k1k7")]
    public async Task<IActionResult> Form19K1K7([FromQuery] int sekolahId, [FromQuery] int tahun = 2026, [FromQuery] string sumberDana = "BOP")
    {
        var bytes = await _pdf.GenerateKartuKendaliPdfAsync(sekolahId, tahun, sumberDana, formatK1K7: true);
        return File(bytes, "application/pdf", $"Form19_FormatK1K7_{sumberDana}_{tahun}.pdf");
    }

    [HttpGet("/pdf/spj/{bkuId:int}")]
    public async Task<IActionResult> Spj(int bkuId)
    {
        var bytes = await _pdf.GenerateSpjIndividualPdfAsync(bkuId);
        return File(bytes, "application/pdf", $"SPJ_BKU_{bkuId}.pdf");
    }

    [HttpGet("/pdf/bpn/{taxId:int}")]
    public async Task<IActionResult> Bpn(int taxId)
    {
        var bytes = await _pdf.GenerateBpnPajakPdfAsync(taxId);
        return File(bytes, "application/pdf", $"BPN_Pajak_{taxId}.pdf");
    }

    [HttpGet("/pdf/sts/{stsId:int}")]
    public async Task<IActionResult> Sts(int stsId)
    {
        var bytes = await _pdf.GenerateStsPdfAsync(stsId);
        return File(bytes, "application/pdf", $"STS_{stsId}.pdf");
    }

    [HttpGet("/pdf/mutasi")]
    public async Task<IActionResult> Mutasi([FromQuery] int sekolahId, [FromQuery] string sumberDana = "BOS")
    {
        var bytes = await _pdf.GenerateMutasiPdfAsync(sekolahId, sumberDana);
        return File(bytes, "application/pdf", $"Mutasi_Rekening_{sumberDana}.pdf");
    }

    [HttpGet("/excel/bap-kas")]
    public async Task<IActionResult> ExcelBapKas([FromQuery] int sekolahId, [FromQuery] int tahun = 2026, [FromQuery] string sumberDana = "BOS", [FromQuery] string kodePeriode = "01")
    {
        var bytes = await _excel.GenerateBapKasExcelAsync(sekolahId, tahun, sumberDana, kodePeriode);
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"BAP_Kas_{sumberDana}_{tahun}.xlsx");
    }

    [HttpGet("/excel/monitoring")]
    public async Task<IActionResult> ExcelMonitoring([FromQuery] int tahun = 2026, [FromQuery] string sumberDana = "BOS", [FromQuery] string? wilayahSudin = null)
    {
        var bytes = await _excel.GenerateMonitoringExcelAsync(tahun, sumberDana, wilayahSudin);
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"Monitoring_{sumberDana}_{tahun}.xlsx");
    }
}
