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

        if (result.Count == 0)
        {
            var sekolah = req.SekolahId.HasValue ? await _db.Sekolahs.FindAsync(req.SekolahId.Value) : null;
            var sd = string.IsNullOrWhiteSpace(req.SumberDana) ? SumberDanaTypes.Bos : req.SumberDana;
            var noRek = string.IsNullOrWhiteSpace(req.NomorRekening)
                ? (sd == SumberDanaTypes.Bop ? sekolah?.NoRekBop : sekolah?.NoRekBos) ?? "1010010012345"
                : req.NomorRekening;
            result = DummyIntegrationFactory.BuildDummyMutations(req.SekolahId ?? 1, sd, noRek);
        }

        return Ok(ApiResponse<List<BankMutation>>.Ok(result));
    }

    [HttpGet("/api/npwp/byNomorNpwp")]
    [HttpPost("/api/npwp/inquiry-npwp-bos")]
    [HttpPost("/api/npwp/inquiry-npwp-bop")]
    public async Task<ActionResult<ApiResponse<NpwpInquiryResponse>>> InquiryNpwp([FromQuery] string? nomorNpwp, [FromBody] NpwpRequest? body)
    {
        var raw = (nomorNpwp ?? body?.NomorNpwp ?? string.Empty).Trim();
        var resp = DummyIntegrationFactory.BuildNpwp(raw);
        await LogAsync("DJP_MPN", "/api/npwp/byNomorNpwp", new { nomorNpwp = raw }, resp, "00", true);
        return Ok(ApiResponse<NpwpInquiryResponse>.Ok(resp));
    }

    [HttpPost("/api/pajak/inquiry")]
    public async Task<ActionResult<ApiResponse<object>>> InquiryPajak([FromBody] PajakInquiryRequest req)
    {
        var code = (req.KodeTrx ?? "P5").Trim().ToUpperInvariant();
        var dbTax = await _db.TaxMasters.FirstOrDefaultAsync(t => t.KodeTrxPajak == code);
        var resp = DummyIntegrationFactory.BuildTaxInquiry(
            code,
            req.MasaPajak,
            req.TahunPajak,
            req.BrutoSpj,
            req.DasarPengenaanPajak,
            req.TarifPersen,
            dbTax,
            req.Npwp,
            req.NamaWajibPajak);

        await LogAsync("DJP_MPN", "/api/pajak/inquiry", req, resp, "00", true);
        return Ok(ApiResponse<object>.Ok(resp, "Inquiry pajak berhasil."));
    }

    [HttpPost("/api/spj-transfer-pajak/{taxId:int}/create")]
    public async Task<ActionResult<ApiResponse<BkuTaxItem>>> CreateBilling(int taxId)
    {
        var tax = await _db.BkuTaxItems.Include(t => t.BkuTransaction).FirstOrDefaultAsync(t => t.Id == taxId);
        var now = DateTime.UtcNow;

        if (tax == null)
        {
            var dummyTax = DummyIntegrationFactory.BuildDummyTaxItem(taxId, now);
            await LogAsync("DJP_MPN", $"/api/spj-transfer-pajak/{taxId}/create", new { taxId }, new { dummyTax.KodeBilling }, "00", true);
            return Ok(ApiResponse<BkuTaxItem>.Ok(dummyTax, $"Kode Billing {dummyTax.KodeBilling} berhasil diterbitkan DJP."));
        }

        if (tax.StatusPajak == StatusPajakFlow.LunasNtpn)
        {
            if (string.IsNullOrWhiteSpace(tax.KodeBilling))
                tax.KodeBilling = DummyIntegrationFactory.GenerateKodeBilling(now);
            return Ok(ApiResponse<BkuTaxItem>.Ok(tax, $"Pajak sudah lunas (NTPN: {tax.Ntpn})."));
        }

        tax.KodeBilling = DummyIntegrationFactory.GenerateKodeBilling(now);
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
        if (tax == null)
            return Ok(ApiResponse<BkuTaxItem>.Ok(new BkuTaxItem { Id = taxId, StatusPajak = StatusPajakFlow.BelumBilling }, "Kode Billing berhasil direset."));

        if (tax.StatusPajak == StatusPajakFlow.LunasNtpn)
            return Ok(ApiResponse<BkuTaxItem>.Ok(tax, $"Pajak sudah lunas (NTPN: {tax.Ntpn})."));

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
        var now = DateTime.UtcNow;

        if (tax == null)
        {
            var dummyTax = DummyIntegrationFactory.BuildDummyTaxItem(taxId, now);
            await LogAsync("DJP_MPN", $"/api/spj-transfer-pajak/{taxId}/inquiry", new { taxId }, new { status = "BILLING_VALID", dummyTax.KodeBilling }, "00", true);
            return Ok(ApiResponse<BkuTaxItem>.Ok(dummyTax, $"Inquiry Kode Billing {dummyTax.KodeBilling}: Tagihan Aktif Rp {dummyTax.NilaiPajak:N0}."));
        }

        if (string.IsNullOrWhiteSpace(tax.KodeBilling))
        {
            tax.KodeBilling = DummyIntegrationFactory.GenerateKodeBilling(now);
            tax.BillingCreatedAt ??= now;
            tax.BillingExpiredAt ??= now.AddDays(30);
            if (tax.StatusPajak == StatusPajakFlow.BelumBilling)
                tax.StatusPajak = StatusPajakFlow.BillingAktif;
            await _db.SaveChangesAsync();
        }

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

        var now = DateTime.UtcNow;
        if (tax == null || tax.BkuTransaction?.Sekolah == null)
        {
            var dummyTax = DummyIntegrationFactory.BuildDummyTaxItem(taxId, now, paid: true);
            await LogAsync("DJP_MPN", $"/api/spj-transfer-pajak/{taxId}/payment", new { taxId }, new { ntpn = dummyTax.Ntpn, ntb = dummyTax.Ntb, status = "LUNAS" }, "00", true);
            return Ok(ApiResponse<BkuTaxItem>.Ok(dummyTax, $"Pembayaran Pajak MPN Berhasil! NTPN: {dummyTax.Ntpn}"));
        }

        if (tax.StatusPajak == StatusPajakFlow.LunasNtpn)
        {
            if (string.IsNullOrWhiteSpace(tax.KodeBilling))
                tax.KodeBilling = DummyIntegrationFactory.GenerateKodeBilling(now);
            if (string.IsNullOrWhiteSpace(tax.Ntpn))
                tax.Ntpn = DummyIntegrationFactory.GenerateNtpn(now);
            if (string.IsNullOrWhiteSpace(tax.Ntb))
                tax.Ntb = DummyIntegrationFactory.GenerateNtb();
            return Ok(ApiResponse<BkuTaxItem>.Ok(tax, $"Pembayaran Pajak MPN sudah lunas (NTPN: {tax.Ntpn})."));
        }

        if (string.IsNullOrWhiteSpace(tax.KodeBilling))
        {
            tax.KodeBilling = DummyIntegrationFactory.GenerateKodeBilling(now);
            tax.BillingCreatedAt ??= now;
            tax.BillingExpiredAt ??= now.AddDays(30);
        }

        var bku = tax.BkuTransaction;
        var sekolah = bku.Sekolah;
        if (bku.SumberDana == SumberDanaTypes.Bos)
            sekolah.SaldoBos = Math.Max(0m, sekolah.SaldoBos - tax.NilaiPajak);
        else
            sekolah.SaldoBop = Math.Max(0m, sekolah.SaldoBop - tax.NilaiPajak);

        var sisaSaldo = bku.SumberDana == SumberDanaTypes.Bos ? sekolah.SaldoBos : sekolah.SaldoBop;
        var ntpn = DummyIntegrationFactory.GenerateNtpn(now);
        var ntb = DummyIntegrationFactory.GenerateNtb();

        tax.Ntpn = ntpn;
        tax.Ntb = ntb;
        tax.TanggalLunasPajak = now;
        tax.StatusPajak = StatusPajakFlow.LunasNtpn;

        bku.StatusBku = StatusBkuFlow.LunasTransfer;
        bku.NoJurnalBank = ntb;
        bku.TanggalTransferBank = now;
        bku.StatusTransferBank = "00";
        bku.UpdatedAt = now;
        bku.CatatanVerifikasi = $"Lunas Setor Pajak MPN (NTPN: {ntpn}, NTB: {ntb})";

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

public class PajakInquiryRequest
{
    public string? KodeTrx { get; set; }
    public string? MasaPajak { get; set; }
    public int TahunPajak { get; set; } = DateTime.UtcNow.Year;
    public decimal BrutoSpj { get; set; }
    public decimal DasarPengenaanPajak { get; set; }
    public decimal? TarifPersen { get; set; }
    public string? Npwp { get; set; }
    public string? NamaWajibPajak { get; set; }
}
