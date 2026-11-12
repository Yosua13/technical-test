using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SiapBos.Shared.Constants;
using SiapBos.Shared.Data;
using SiapBos.Shared.DTOs;
using SiapBos.Shared.Entities;

namespace SiapBos.Integration.Controllers;

[ApiController]
public class MutasiNpwpPajakController : ControllerBase
{
    private readonly SiapBosDbContext _db;

    public MutasiNpwpPajakController(SiapBosDbContext db) => _db = db;

    [HttpPost("/api/mutasi/byNoRek")]
    [HttpPost("/api/mutasi/inquiry-all-mutasi")]
    public async Task<ActionResult<ApiResponse<List<BankMutation>>>> GetMutasi([FromBody] MutasiRequest req)
    {
        var query = _db.BankMutations.AsQueryable();

        if (req.SekolahId.HasValue)
            query = query.Where(m => m.SekolahId == req.SekolahId.Value);

        if (!string.IsNullOrWhiteSpace(req.SumberDana))
            query = query.Where(m => m.SumberDana == req.SumberDana);

        if (!string.IsNullOrWhiteSpace(req.NomorRekening))
            query = query.Where(m => m.NomorRekening == req.NomorRekening);

        if (req.TanggalMulai.HasValue)
            query = query.Where(m => m.TanggalTransaksi >= req.TanggalMulai.Value.Date);

        if (req.TanggalAkhir.HasValue)
            query = query.Where(m => m.TanggalTransaksi <= req.TanggalAkhir.Value.Date.AddDays(1).AddSeconds(-1));

        var ordered = query.OrderByDescending(m => m.TanggalTransaksi).ThenByDescending(m => m.Id);
        var result = req.Limit12 ? await ordered.Take(12).ToListAsync() : await ordered.ToListAsync();

        return Ok(ApiResponse<List<BankMutation>>.Ok(result));
    }

    [HttpGet("/api/npwp/byNomorNpwp")]
    [HttpPost("/api/npwp/inquiry-npwp-bos")]
    [HttpPost("/api/npwp/inquiry-npwp-bop")]
    public async Task<ActionResult<ApiResponse<NpwpInquiryResponse>>> InquiryNpwp([FromQuery] string? nomorNpwp, [FromBody] NpwpRequest? body)
    {
        var raw = (nomorNpwp ?? body?.NomorNpwp ?? string.Empty).Trim();
        var digits = new string(raw.Where(char.IsDigit).ToArray());

        if (digits.Length < 15 || digits.StartsWith("999"))
        {
            var fail = new NpwpInquiryResponse
            {
                ResponseCode = "14",
                ResponseMessage = "NPWP tidak valid atau tidak terdaftar pada DJP/CTAS (minimal 15 digit).",
                NomorNpwp = raw,
                StatusPkp = "TIDAK TERDAFTAR"
            };
            await LogAsync("DJP_MPN", "/api/npwp/byNomorNpwp", new { nomorNpwp = raw }, fail, "14", false);
            return Ok(ApiResponse<NpwpInquiryResponse>.Ok(fail, fail.ResponseMessage));
        }

        var wpName = raw switch
        {
            "01.345.678.9-022.000" => "CV. GRAHA PUSTAKA NUSANTARA",
            "02.555.666.7-033.000" => "PT. SEJUK PRIMA TEKNIK",
            "03.777.888.9-012.000" => "CV. RASA NUSANTARA CATERING",
            "01.001.629.3-051.000" => "PT PLN (PERSERO)",
            _ => $"WAJIB PAJAK TERVERIFIKASI DJP (#{digits[^4..]})"
        };

        var resp = new NpwpInquiryResponse
        {
            ResponseCode = "00",
            ResponseMessage = "NPWP Aktif & Valid di Direktorat Jenderal Pajak (MPN G3)",
            NomorNpwp = raw,
            NamaWajibPajak = wpName,
            Alamat = "DKI Jakarta",
            StatusPkp = "PKP AKTIF",
            KppTerdaftar = "KPP Pratama Jakarta Pusat"
        };
        await LogAsync("DJP_MPN", "/api/npwp/byNomorNpwp", new { nomorNpwp = raw }, resp, "00", true);
        return Ok(ApiResponse<NpwpInquiryResponse>.Ok(resp));
    }

    [HttpPost("/api/spj-transfer-pajak/{taxId:int}/create")]
    public async Task<ActionResult<ApiResponse<BkuTaxItem>>> CreateBilling(int taxId)
    {
        var tax = await _db.BkuTaxItems.Include(t => t.BkuTransaction).FirstOrDefaultAsync(t => t.Id == taxId);
        if (tax == null) return NotFound(ApiResponse<BkuTaxItem>.Fail("Item pajak tidak ditemukan."));

        if (tax.StatusPajak == StatusPajakFlow.LunasNtpn)
            return BadRequest(ApiResponse<BkuTaxItem>.Fail("Pajak ini sudah lunas dibayar."));

        var now = DateTime.UtcNow;
        tax.KodeBilling = $"8{now:yyyyMMdd}{Random.Shared.Next(100000, 999999)}";
        tax.BillingCreatedAt = now;
        tax.BillingExpiredAt = now.AddDays(30);
        tax.StatusPajak = StatusPajakFlow.BillingAktif;

        await LogAsync("DJP_MPN", $"/api/spj-transfer-pajak/{taxId}/create", new { taxId, tax.KodeMap, tax.NilaiPajak }, new { tax.KodeBilling, tax.BillingExpiredAt }, "00", true);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<BkuTaxItem>.Ok(tax, $"Kode Billing {tax.KodeBilling} berhasil diterbitkan DJP."));
    }

    [HttpPost("/api/spj-transfer-pajak/{taxId:int}/reset")]
    public async Task<ActionResult<ApiResponse<BkuTaxItem>>> ResetBilling(int taxId)
    {
        var tax = await _db.BkuTaxItems.FindAsync(taxId);
        if (tax == null) return NotFound(ApiResponse<BkuTaxItem>.Fail("Item pajak tidak ditemukan."));
        if (tax.StatusPajak == StatusPajakFlow.LunasNtpn)
            return BadRequest(ApiResponse<BkuTaxItem>.Fail("Pajak yang sudah lunas tidak dapat direset."));

        tax.KodeBilling = null;
        tax.BillingCreatedAt = null;
        tax.BillingExpiredAt = null;
        tax.StatusPajak = StatusPajakFlow.BelumBilling;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<BkuTaxItem>.Ok(tax, "Kode Billing berhasil direset."));
    }

    [HttpPost("/api/spj-transfer-pajak/{taxId:int}/inquiry")]
    public async Task<ActionResult<ApiResponse<BkuTaxItem>>> InquiryBilling(int taxId)
    {
        var tax = await _db.BkuTaxItems.FindAsync(taxId);
        if (tax == null) return NotFound(ApiResponse<BkuTaxItem>.Fail("Item pajak tidak ditemukan."));
        if (string.IsNullOrWhiteSpace(tax.KodeBilling))
            return BadRequest(ApiResponse<BkuTaxItem>.Fail("Kode Billing belum dibuat."));

        await LogAsync("DJP_MPN", $"/api/spj-transfer-pajak/{taxId}/inquiry", new { tax.KodeBilling }, new { status = "BILLING_VALID", tax.NilaiPajak }, "00", true);
        return Ok(ApiResponse<BkuTaxItem>.Ok(tax, $"Inquiry Kode Billing {tax.KodeBilling}: Tagihan Aktif Rp {tax.NilaiPajak:N0}."));
    }

    [HttpPost("/api/spj-transfer-pajak/{taxId:int}/payment")]
    public async Task<ActionResult<ApiResponse<BkuTaxItem>>> PayBilling(int taxId)
    {
        var tax = await _db.BkuTaxItems
            .Include(t => t.BkuTransaction)
            .ThenInclude(b => b!.Sekolah)
            .FirstOrDefaultAsync(t => t.Id == taxId);

        if (tax == null || tax.BkuTransaction?.Sekolah == null)
            return NotFound(ApiResponse<BkuTaxItem>.Fail("Data pajak atau BKU tidak ditemukan."));

        if (tax.StatusPajak == StatusPajakFlow.LunasNtpn)
            return BadRequest(ApiResponse<BkuTaxItem>.Fail("Pajak sudah lunas dibayar sebelumnya."));

        if (string.IsNullOrWhiteSpace(tax.KodeBilling))
            return BadRequest(ApiResponse<BkuTaxItem>.Fail("Silakan buat Kode Billing DJP terlebih dahulu."));

        var bku = tax.BkuTransaction;
        if (bku.StatusBku < StatusBkuFlow.DisetujuiPa)
            return BadRequest(ApiResponse<BkuTaxItem>.Fail("Transaksi BKU induk harus sudah Disetujui PA sebelum membayar pajak."));

        var sekolah = bku.Sekolah;
        var saldo = bku.SumberDana == SumberDanaTypes.Bos ? sekolah.SaldoBos : sekolah.SaldoBop;
        if (saldo < tax.NilaiPajak)
            return BadRequest(ApiResponse<BkuTaxItem>.Fail($"Saldo rekening {bku.SumberDana} tidak cukup untuk membayar pajak."));

        if (bku.SumberDana == SumberDanaTypes.Bos)
            sekolah.SaldoBos -= tax.NilaiPajak;
        else
            sekolah.SaldoBop -= tax.NilaiPajak;

        var sisaSaldo = bku.SumberDana == SumberDanaTypes.Bos ? sekolah.SaldoBos : sekolah.SaldoBop;
        var now = DateTime.UtcNow;
        var ntpn = $"DJP{now:yyMMdd}DKI{Random.Shared.Next(1000, 9999)}X";
        var ntb = $"000{Random.Shared.Next(100000000, 999999999)}";

        tax.Ntpn = ntpn;
        tax.Ntb = ntb;
        tax.TanggalLunasPajak = now;
        tax.StatusPajak = StatusPajakFlow.LunasNtpn;

        _db.BankMutations.Add(new BankMutation
        {
            SekolahId = sekolah.Id,
            SumberDana = bku.SumberDana,
            NomorRekening = bku.SumberDana == SumberDanaTypes.Bos ? sekolah.NoRekBos : sekolah.NoRekBop,
            TanggalTransaksi = now,
            NomorReferensi = $"NTB-{ntb}",
            Uraian = $"DB MPN PAJAK {tax.KodeTrxPajak} BILLING {tax.KodeBilling} (NTPN {ntpn})",
            TipeMutasi = "D",
            Nominal = tax.NilaiPajak,
            SaldoAkhir = sisaSaldo,
            KodeTrx = tax.KodeTrxPajak,
            BkuTransactionId = bku.Id
        });

        await LogAsync("DJP_MPN", $"/api/spj-transfer-pajak/{taxId}/payment", new { tax.KodeBilling, tax.NilaiPajak }, new { ntpn, ntb, status = "LUNAS" }, "00", true);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<BkuTaxItem>.Ok(tax, $"Pembayaran Pajak MPN Berhasil! NTPN: {ntpn}"));
    }

    private async Task LogAsync(string sys, string endpoint, object reqObj, object respObj, string code, bool success)
    {
        _db.IntegrationAuditLogs.Add(new IntegrationAuditLog
        {
            SystemName = sys,
            EndpointCalled = endpoint,
            CallerService = "siapbos-integration",
            RequestPayload = JsonSerializer.Serialize(reqObj),
            ResponsePayload = JsonSerializer.Serialize(respObj),
            StatusCode = code,
            IsSuccess = success
        });
        await _db.SaveChangesAsync();
    }
}

public class MutasiRequest
{
    public int? SekolahId { get; set; }
    public string? SumberDana { get; set; }
    public string? NomorRekening { get; set; }
    public DateTime? TanggalMulai { get; set; }
    public DateTime? TanggalAkhir { get; set; }
    public bool Limit12 { get; set; } = true;
}

public class NpwpRequest
{
    public string? NomorNpwp { get; set; }
}
