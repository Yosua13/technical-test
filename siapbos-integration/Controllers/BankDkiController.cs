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
public class BankDkiController : ControllerBase
{
    private readonly SiapBosDbContext _db;

    public BankDkiController(SiapBosDbContext db) => _db = db;

    [HttpPost("/api/bank-dki/inquiryCheckRek")]
    [HttpPost("/api/bank-dki/inquiryOnUs")]
    [HttpPost("/api/bank-dki/inquiryOffUs")]
    public async Task<ActionResult<ApiResponse<BankDkiInquiryRekResponse>>> InquiryRekening([FromBody] BankDkiInquiryRekRequest req)
    {
        var noRek = req.NoRekening?.Trim() ?? string.Empty;
        var sekolahMatch = string.IsNullOrWhiteSpace(noRek)
            ? null
            : await _db.Sekolahs.FirstOrDefaultAsync(s => s.NoRekBos == noRek || s.NoRekBop == noRek);

        var resp = DummyIntegrationFactory.BuildRekening(req.KodeBank, noRek, sekolahMatch);
        await LogIntegrationAsync("BANK_DKI", "/api/bank-dki/inquiryCheckRek", req, resp, "00", true);
        return Ok(ApiResponse<BankDkiInquiryRekResponse>.Ok(resp));
    }

    [HttpPost("/api/bank-dki/biller-inquiry")]
    public async Task<ActionResult<ApiResponse<BillerInquiryResponse>>> BillerInquiry([FromBody] BillerInquiryRequest req)
    {
        var resp = DummyIntegrationFactory.BuildBiller(req.JenisBiller, req.NomorTagihan);
        await LogIntegrationAsync("BANK_DKI", "/api/bank-dki/biller-inquiry", req, resp, "00", true);
        return Ok(ApiResponse<BillerInquiryResponse>.Ok(resp));
    }

    [HttpPost("/api/bank-dki/va/biller-inquiry")]
    public async Task<ActionResult<ApiResponse<VaStepTraceDto>>> DirectVaBillerInquiry([FromBody] VaExecuteTransferRequest req)
    {
        var bku = await _db.BkuTransactions.FindAsync(req.BkuId);
        var vaNo = bku == null
            ? $"VA-DUMMY-{req.BkuId}"
            : (string.IsNullOrWhiteSpace(bku.NoVaAtauPesanan) ? bku.NoRekRekanan : bku.NoVaAtauPesanan);
        var nominal = bku?.NilaiNettoTransfer ?? 1000000m;

        var step = new VaStepTraceDto
        {
            StepName = "1. Biller Inquiry",
            Endpoint = "/api/bank-dki/va/biller-inquiry",
            ResponseCode = "00",
            Message = $"Tagihan VA {vaNo} valid Rp {nominal:N0}",
            Timestamp = DateTime.UtcNow
        };
        await LogIntegrationAsync("BANK_DKI", step.Endpoint, req, step, "00", true);
        return Ok(ApiResponse<VaStepTraceDto>.Ok(step));
    }

    [HttpPost("/api/bank-dki/va/overbook")]
    public async Task<ActionResult<ApiResponse<VaStepTraceDto>>> DirectVaOverbook([FromBody] VaExecuteTransferRequest req)
    {
        var stan = $"VA{DateTime.UtcNow:HHmmss}";
        var step = new VaStepTraceDto
        {
            StepName = "2. Overbook",
            Endpoint = "/api/bank-dki/va/overbook",
            ResponseCode = "00",
            Stan = stan,
            Message = $"Overbooking rekening sekolah siap diproses (STAN: {stan})",
            Timestamp = DateTime.UtcNow
        };
        await LogIntegrationAsync("BANK_DKI", step.Endpoint, req, step, "00", true);
        return Ok(ApiResponse<VaStepTraceDto>.Ok(step));
    }

    [HttpPost("/api/bank-dki/va/payment")]
    public async Task<ActionResult<ApiResponse<VaStepTraceDto>>> DirectVaPayment([FromBody] VaExecuteTransferRequest req)
    {
        var kodeReff = $"REFF-VA-{DateTime.UtcNow:yyyyMMddHHmmss}";
        var step = new VaStepTraceDto
        {
            StepName = "3. Payment",
            Endpoint = "/api/bank-dki/va/payment",
            ResponseCode = "00",
            KodeReff = kodeReff,
            Message = $"Payment VA settled ({kodeReff})",
            Timestamp = DateTime.UtcNow
        };
        await LogIntegrationAsync("BANK_DKI", step.Endpoint, req, step, "00", true);
        return Ok(ApiResponse<VaStepTraceDto>.Ok(step));
    }

    [HttpPost("/api/bank-dki/va/biller-inquiry-bos")]
    [HttpPost("/api/bank-dki/va/biller-inquiry-bop")]
    public async Task<ActionResult<ApiResponse<VaTransferResponse>>> ExecuteVaPipeline([FromBody] VaExecuteTransferRequest req)
    {
        var bku = await _db.BkuTransactions
            .Include(b => b.Sekolah)
            .FirstOrDefaultAsync(b => b.Id == req.BkuId);

        var now = DateTime.UtcNow;
        if (bku == null || bku.Sekolah == null)
        {
            var dummyVaNo = $"VA-DUMMY-{req.BkuId}";
            var dummyStan = DummyIntegrationFactory.GenerateStan(now);
            var dummyReff = $"REFF-VA-{now:yyyyMMddHHmmss}";
            var dummyJurnal = DummyIntegrationFactory.GenerateJurnal("VA", now);
            var dummySteps = DummyIntegrationFactory.BuildVaSteps(dummyVaNo, "REKANAN VIRTUAL ACCOUNT", 1000000m, dummyStan, dummyReff, dummyJurnal, now);
            var dummyResp = new VaTransferResponse
            {
                Bit39 = "00",
                Message = $"Pembayaran Virtual Account ({dummyVaNo}) dummy berhasil (Biller Inquiry -> Overbook -> Payment)!",
                Stan = dummyStan,
                KodeReff = dummyReff,
                NoJurnalBank = dummyJurnal,
                TanggalTransfer = now,
                NominalDitransfer = 1000000m,
                SisaSaldoSekolah = 50000000m,
                Steps = dummySteps
            };
            await LogIntegrationAsync("BANK_DKI", "/api/bank-dki/va/biller-inquiry-bos", req, dummyResp, "00", true);
            return Ok(ApiResponse<VaTransferResponse>.Ok(dummyResp, dummyResp.Message));
        }

        var sekolah = bku.Sekolah;
        var vaNo = string.IsNullOrWhiteSpace(bku.NoVaAtauPesanan)
            ? (string.IsNullOrWhiteSpace(bku.NoRekRekanan) ? $"VA-{bku.Id}" : bku.NoRekRekanan)
            : bku.NoVaAtauPesanan;
        var caller = bku.SumberDana == SumberDanaTypes.Bop ? "siapbop-api" : "siapbos-api";

        if (bku.StatusBku == StatusBkuFlow.LunasTransfer)
        {
            var existingStan = string.IsNullOrWhiteSpace(bku.StanVa) ? DummyIntegrationFactory.GenerateStan(now) : bku.StanVa;
            var existingReff = string.IsNullOrWhiteSpace(bku.KodeReffVa) ? $"REFF-VA-{now:yyyyMMddHHmmss}" : bku.KodeReffVa;
            var existingJurnal = string.IsNullOrWhiteSpace(bku.NoJurnalBank) ? DummyIntegrationFactory.GenerateJurnal("VA", now) : bku.NoJurnalBank;
            var currentSaldo = bku.SumberDana == SumberDanaTypes.Bos ? sekolah.SaldoBos : sekolah.SaldoBop;
            var existingSteps = DummyIntegrationFactory.BuildVaSteps(vaNo, bku.NamaRekanan, bku.NilaiNettoTransfer, existingStan, existingReff, existingJurnal, bku.TanggalTransferBank ?? now);
            var existingResp = new VaTransferResponse
            {
                Bit39 = "00",
                Message = $"Pembayaran Virtual Account ({vaNo}) Rp {bku.NilaiNettoTransfer:N0} telah lunas (Jurnal: {existingJurnal}).",
                Stan = existingStan,
                KodeReff = existingReff,
                NoJurnalBank = existingJurnal,
                TanggalTransfer = bku.TanggalTransferBank ?? now,
                NominalDitransfer = bku.NilaiNettoTransfer,
                SisaSaldoSekolah = currentSaldo,
                Steps = existingSteps
            };
            return Ok(ApiResponse<VaTransferResponse>.Ok(existingResp, existingResp.Message));
        }

        // Step 1: Biller Inquiry
        var stan = DummyIntegrationFactory.GenerateStan(now);
        var kodeReff = $"REFF-VA-{now:yyyyMMddHHmmss}";
        var jurnal = DummyIntegrationFactory.GenerateJurnal("VA", now);
        var steps = DummyIntegrationFactory.BuildVaSteps(vaNo, bku.NamaRekanan, bku.NilaiNettoTransfer, stan, kodeReff, jurnal, now);
        var step1 = steps[0];
        var step2 = steps[1];
        var step3 = steps[2];

        _db.IntegrationAuditLogs.Add(new IntegrationAuditLog
        {
            SystemName = "BANK_DKI",
            EndpointCalled = step1.Endpoint,
            CallerService = caller,
            RequestPayload = JsonSerializer.Serialize(new { req.BkuId, vaNo, nominal = bku.NilaiNettoTransfer }),
            ResponsePayload = JsonSerializer.Serialize(step1),
            StatusCode = "00",
            IsSuccess = true
        });

        // Step 2: Overbook (clamp minimum 0 if demo balance is lower)
        if (bku.SumberDana == SumberDanaTypes.Bos)
            sekolah.SaldoBos = Math.Max(0m, sekolah.SaldoBos - bku.NilaiNettoTransfer);
        else
            sekolah.SaldoBop = Math.Max(0m, sekolah.SaldoBop - bku.NilaiNettoTransfer);

        var sisaSaldo = bku.SumberDana == SumberDanaTypes.Bos ? sekolah.SaldoBos : sekolah.SaldoBop;
        _db.IntegrationAuditLogs.Add(new IntegrationAuditLog
        {
            SystemName = "BANK_DKI",
            EndpointCalled = step2.Endpoint,
            CallerService = caller,
            RequestPayload = JsonSerializer.Serialize(new { req.BkuId, stan, nominal = bku.NilaiNettoTransfer }),
            ResponsePayload = JsonSerializer.Serialize(step2),
            StatusCode = "00",
            IsSuccess = true
        });

        // Step 3: Payment
        _db.IntegrationAuditLogs.Add(new IntegrationAuditLog
        {
            SystemName = "BANK_DKI",
            EndpointCalled = step3.Endpoint,
            CallerService = caller,
            RequestPayload = JsonSerializer.Serialize(new { req.BkuId, vaNo, stan, kodeReff }),
            ResponsePayload = JsonSerializer.Serialize(step3),
            StatusCode = "00",
            IsSuccess = true
        });

        bku.StatusBku = StatusBkuFlow.LunasTransfer;
        bku.StanVa = stan;
        bku.KodeReffVa = kodeReff;
        bku.NoJurnalBank = jurnal;
        bku.TanggalTransferBank = now;
        bku.StatusTransferBank = "00";
        bku.CatatanVerifikasi = $"Pembayaran VA Selesai (Inquiry -> Overbook -> Payment). Jurnal: {jurnal}, STAN: {stan}";
        bku.UpdatedAt = now;

        // Sync child Penerimaan Pajak status to LunasTransfer
        var childPenerimaan = await _db.BkuTransactions
            .Where(c => c.ParentBkuId == bku.Id && c.JenisPembayaran == JenisPembayaranBku.Penerimaan)
            .ToListAsync();
        foreach (var child in childPenerimaan)
        {
            child.StatusBku = StatusBkuFlow.LunasTransfer;
            child.NoJurnalBank = jurnal;
            child.TanggalTransferBank = now;
            child.StatusTransferBank = "00";
            child.UpdatedAt = now;
            child.CatatanVerifikasi = $"Status Lunas mengikuti pembayaran VA SPJ {bku.NomorBku}.";
        }

        _db.BankMutations.Add(new BankMutation
        {
            SekolahId = sekolah.Id,
            SumberDana = bku.SumberDana,
            NomorRekening = bku.SumberDana == SumberDanaTypes.Bos ? sekolah.NoRekBos : sekolah.NoRekBop,
            TanggalTransaksi = now,
            NomorReferensi = jurnal,
            Uraian = $"DB VA BANK DKI ({vaNo}) KE {bku.NamaRekanan} - {bku.NomorBku}",
            TipeMutasi = "D",
            Nominal = bku.NilaiNettoTransfer,
            SaldoAkhir = sisaSaldo,
            KodeTrx = bku.KodeTrx,
            BkuTransactionId = bku.Id
        });

        var resp = new VaTransferResponse
        {
            Bit39 = "00",
            Message = $"Pembayaran Virtual Account ({vaNo}) Rp {bku.NilaiNettoTransfer:N0} berhasil (Biller Inquiry -> Overbook -> Payment)!",
            Stan = stan,
            KodeReff = kodeReff,
            NoJurnalBank = jurnal,
            TanggalTransfer = now,
            NominalDitransfer = bku.NilaiNettoTransfer,
            SisaSaldoSekolah = sisaSaldo,
            Steps = steps
        };

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<VaTransferResponse>.Ok(resp, resp.Message));
    }

    [HttpPost("/api/bank-dki/createToken")]
    public async Task<ActionResult<ApiResponse<BankDkiCreateTokenResponse>>> CreateToken([FromBody] BankDkiCreateTokenRequest req)
    {
        var bku = await _db.BkuTransactions.Include(b => b.Sekolah).FirstOrDefaultAsync(b => b.Id == req.BkuId);
        var nrk = string.IsNullOrWhiteSpace(req.Nrk) ? "180101" : req.Nrk.Trim();
        var otp = DummyIntegrationFactory.GenerateOtpToken();
        var expired = DateTime.UtcNow.AddMinutes(5);

        if (bku != null)
        {
            bku.TokenOtpPa = otp;
            bku.TokenCreatedByNrk = nrk;
            bku.TokenExpiredAt = expired;
            bku.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        var resp = new BankDkiCreateTokenResponse
        {
            ResponseCode = "00",
            ResponseMessage = $"Token OTP Bank DKI berhasil dikirim ke PA (NRK {nrk}). Berlaku 5 menit.",
            Token = otp,
            ExpiredAt = expired
        };
        await LogIntegrationAsync("BANK_DKI", "/api/bank-dki/createToken", req, resp, "00", true);
        return Ok(ApiResponse<BankDkiCreateTokenResponse>.Ok(resp, resp.ResponseMessage));
    }

    private async Task LogIntegrationAsync(string sys, string endpoint, object reqObj, object respObj, string code, bool success)
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
