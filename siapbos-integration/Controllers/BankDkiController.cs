using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SiapBos.Shared.Constants;
using SiapBos.Shared.Data;
using SiapBos.Shared.DTOs;
using SiapBos.Shared.Entities;

namespace SiapBos.Integration.Controllers;

[ApiController]
public class BankDkiController : ControllerBase
{
    private readonly SiapBosDbContext _db;

    public BankDkiController(SiapBosDbContext db) => _db = db;

    private static readonly Dictionary<string, string> BankNames = new()
    {
        ["111"] = "Bank DKI",
        ["014"] = "Bank BCA",
        ["002"] = "Bank BRI",
        ["008"] = "Bank Mandiri",
        ["009"] = "Bank BNI",
        ["451"] = "Bank Syariah Indonesia (BSI)"
    };

    [HttpPost("/api/bank-dki/inquiryCheckRek")]
    [HttpPost("/api/bank-dki/inquiryOnUs")]
    [HttpPost("/api/bank-dki/inquiryOffUs")]
    public async Task<ActionResult<ApiResponse<BankDkiInquiryRekResponse>>> InquiryRekening([FromBody] BankDkiInquiryRekRequest req)
    {
        var noRek = req.NoRekening?.Trim() ?? string.Empty;
        var bankName = BankNames.GetValueOrDefault(req.KodeBank, "Bank Umum Nasional");

        if (noRek.Length < 6 || noRek.StartsWith("999"))
        {
            var errResp = new BankDkiInquiryRekResponse
            {
                ResponseCode = "14",
                ResponseMessage = "Nomor Rekening Tidak Ditemukan atau Dormant di Core Banking Bank DKI",
                KodeBank = req.KodeBank,
                NamaBank = bankName,
                NoRekening = noRek,
                StatusRekening = "TIDAK AKTIF"
            };
            await LogIntegrationAsync("BANK_DKI", "/api/bank-dki/inquiryCheckRek", req, errResp, "14", false);
            return Ok(ApiResponse<BankDkiInquiryRekResponse>.Ok(errResp, errResp.ResponseMessage));
        }

        // Check known school or seeded accounts
        var sekolahMatch = await _db.Sekolahs.FirstOrDefaultAsync(s => s.NoRekBos == noRek || s.NoRekBop == noRek);
        var ownerName = sekolahMatch != null
            ? (sekolahMatch.NoRekBos == noRek ? sekolahMatch.NamaRekBos : sekolahMatch.NamaRekBop)
            : noRek switch
            {
                "1110099887766" => "CV. GRAHA PUSTAKA NUSANTARA",
                "5400881234" => "PT. SEJUK PRIMA TEKNIK",
                "1110044556677" => "CV. RASA NUSANTARA CATERING",
                "1110077788899" => "DR. BUDI PRASETYO, M.PD",
                _ => $"REKANAN TERVERIFIKASI ({bankName.ToUpper()} #{noRek[^4..]})"
            };

        var resp = new BankDkiInquiryRekResponse
        {
            ResponseCode = "00",
            ResponseMessage = "Rekening Valid & Aktif",
            KodeBank = req.KodeBank,
            NamaBank = bankName,
            NoRekening = noRek,
            NamaPemilikRekening = ownerName,
            StatusRekening = "AKTIF"
        };
        await LogIntegrationAsync("BANK_DKI", "/api/bank-dki/inquiryCheckRek", req, resp, "00", true);
        return Ok(ApiResponse<BankDkiInquiryRekResponse>.Ok(resp));
    }

    [HttpPost("/api/bank-dki/biller-inquiry")]
    [HttpPost("/api/bank-dki/va/biller-inquiry-bos")]
    [HttpPost("/api/bank-dki/va/biller-inquiry-bop")]
    public async Task<ActionResult<ApiResponse<BillerInquiryResponse>>> BillerInquiry([FromBody] BillerInquiryRequest req)
    {
        var nomor = req.NomorTagihan?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(nomor))
            return BadRequest(ApiResponse<BillerInquiryResponse>.Fail("Nomor VA / ID Pelanggan / No Pesanan wajib diisi."));

        BillerInquiryResponse resp;
        if (req.JenisBiller == JenisPembayaranBku.VaPln)
        {
            resp = new BillerInquiryResponse
            {
                ResponseCode = "00",
                ResponseMessage = "Tagihan Listrik PLN Ditemukan",
                JenisBiller = JenisPembayaranBku.VaPln,
                NomorTagihan = nomor,
                NamaPelangganAtauMerchant = $"PT PLN (PERSERO) UID JAYA - IDPEL {nomor}",
                Uraian = $"Tagihan Listrik Bulan {DateTime.UtcNow:MMMM yyyy} IDPEL {nomor}",
                NominalTagihan = 8750000m,
                KodeBank = "111",
                NoRekTujuan = $"8801{nomor}",
                NpwpTujuan = "01.001.629.3-051.000"
            };
        }
        else
        {
            resp = new BillerInquiryResponse
            {
                ResponseCode = "00",
                ResponseMessage = "Pesanan Marketplace e-Order DKI Ditemukan",
                JenisBiller = JenisPembayaranBku.EOrder,
                NomorTagihan = nomor,
                NamaPelangganAtauMerchant = "PT. SARANA EDUKASI DIGITAL (e-Order DKI)",
                Uraian = $"Pembayaran Pesanan e-Order {nomor} - Perlengkapan Sekolah",
                NominalTagihan = 12500000m,
                KodeBank = "111",
                NoRekTujuan = "1110055443322",
                NpwpTujuan = "02.888.999.1-021.000"
            };
        }

        await LogIntegrationAsync("BANK_DKI", "/api/bank-dki/biller-inquiry", req, resp, "00", true);
        return Ok(ApiResponse<BillerInquiryResponse>.Ok(resp));
    }

    [HttpPost("/api/bank-dki/createToken")]
    public async Task<ActionResult<ApiResponse<BankDkiCreateTokenResponse>>> CreateToken([FromBody] BankDkiCreateTokenRequest req)
    {
        var bku = await _db.BkuTransactions.Include(b => b.Sekolah).FirstOrDefaultAsync(b => b.Id == req.BkuId);
        if (bku == null)
            return NotFound(ApiResponse<BankDkiCreateTokenResponse>.Fail("Transaksi BKU tidak ditemukan."));

        if (bku.StatusBku != StatusBkuFlow.DisetujuiPa && bku.StatusBku != StatusBkuFlow.DisetujuiSudin)
            return BadRequest(ApiResponse<BankDkiCreateTokenResponse>.Fail("Token hanya dapat diterbitkan untuk BKU yang sudah Disetujui PA."));

        if (string.IsNullOrWhiteSpace(req.Nrk) || req.Nrk.Length < 4)
            return BadRequest(ApiResponse<BankDkiCreateTokenResponse>.Fail("NRK Kepala Sekolah (PA) tidak valid."));

        var otp = Random.Shared.Next(100000, 999999).ToString();
        var expired = DateTime.UtcNow.AddMinutes(30);

        bku.TokenOtpPa = otp;
        bku.TokenCreatedByNrk = req.Nrk;
        bku.TokenExpiredAt = expired;
        bku.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var resp = new BankDkiCreateTokenResponse
        {
            ResponseCode = "00",
            ResponseMessage = $"Token OTP Bank DKI berhasil dikirim ke PA (NRK {req.Nrk}).",
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
