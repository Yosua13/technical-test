using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SiapBos.Shared.Constants;
using SiapBos.Shared.Data;
using SiapBos.Shared.DTOs;
using SiapBos.Shared.Entities;

namespace SiapBos.Integration.Controllers;

[ApiController]
public class SpjTransferController : ControllerBase
{
    private readonly SiapBosDbContext _db;

    public SpjTransferController(SiapBosDbContext db) => _db = db;

    [HttpPost("/api/spj-transfer/transfer")]
    [HttpPost("/api/spj-transfer/transfer-bop")]
    public async Task<ActionResult<ApiResponse<SpjTransferResponse>>> ExecuteSpjTransfer([FromBody] SpjTransferRequest req)
    {
        var bku = await _db.BkuTransactions
            .Include(b => b.Sekolah)
            .FirstOrDefaultAsync(b => b.Id == req.BkuId);

        if (bku == null || bku.Sekolah == null)
            return NotFound(ApiResponse<SpjTransferResponse>.Fail("Transaksi BKU atau Sekolah tidak ditemukan."));

        if (bku.StatusBku == StatusBkuFlow.LunasTransfer)
            return BadRequest(ApiResponse<SpjTransferResponse>.Fail("Transaksi BKU ini sudah dibayar/ditransfer sebelumnya."));

        if (bku.StatusBku != StatusBkuFlow.DisetujuiPa && bku.StatusBku != StatusBkuFlow.DisetujuiSudin)
            return BadRequest(ApiResponse<SpjTransferResponse>.Fail("BKU belum mendapat persetujuan Kepala Sekolah (PA)."));

        if (bku.NeedSudinApproval && bku.StatusBku != StatusBkuFlow.DisetujuiSudin)
            return BadRequest(ApiResponse<SpjTransferResponse>.Fail("Transaksi ini memerlukan persetujuan Sudin sebelum dibayar."));

        if (string.IsNullOrWhiteSpace(bku.TokenOtpPa))
            return BadRequest(ApiResponse<SpjTransferResponse>.Fail("Token CMS PA belum diterbitkan. Silakan minta PA melakukan Permohonan Token."));

        if (!string.Equals(bku.TokenOtpPa, req.TokenOtp?.Trim(), StringComparison.Ordinal))
            return BadRequest(ApiResponse<SpjTransferResponse>.Fail("Kode Token OTP tidak sesuai."));

        if (bku.TokenExpiredAt.HasValue && bku.TokenExpiredAt.Value < DateTime.UtcNow)
            return BadRequest(ApiResponse<SpjTransferResponse>.Fail("Token OTP sudah kedaluwarsa, silakan generate ulang token."));

        var sekolah = bku.Sekolah;
        var currentSaldo = bku.SumberDana == SumberDanaTypes.Bos ? sekolah.SaldoBos : sekolah.SaldoBop;
        if (currentSaldo < bku.NilaiNettoTransfer)
            return BadRequest(ApiResponse<SpjTransferResponse>.Fail($"Saldo rekening {bku.SumberDana} sekolah tidak cukup untuk transfer Rp {bku.NilaiNettoTransfer:N0}."));

        if (bku.SumberDana == SumberDanaTypes.Bos)
            sekolah.SaldoBos -= bku.NilaiNettoTransfer;
        else
            sekolah.SaldoBop -= bku.NilaiNettoTransfer;

        var sisaSaldo = bku.SumberDana == SumberDanaTypes.Bos ? sekolah.SaldoBos : sekolah.SaldoBop;
        var jurnal = $"JRN-DKI-{DateTime.UtcNow:yyyyMMddHHmmss}";
        var now = DateTime.UtcNow;

        bku.StatusBku = StatusBkuFlow.LunasTransfer;
        bku.NoJurnalBank = jurnal;
        bku.TanggalTransferBank = now;
        bku.StatusTransferBank = "00";
        bku.CatatanVerifikasi = $"Transfer CMS Bank DKI Berhasil (Bit39=00). Jurnal: {jurnal}";
        bku.UpdatedAt = now;

        _db.BankMutations.Add(new BankMutation
        {
            SekolahId = sekolah.Id,
            SumberDana = bku.SumberDana,
            NomorRekening = bku.SumberDana == SumberDanaTypes.Bos ? sekolah.NoRekBos : sekolah.NoRekBop,
            TanggalTransaksi = now,
            NomorReferensi = jurnal,
            Uraian = $"DB CMS SPJ ({bku.JenisPembayaran}) KE {bku.NamaRekanan} [{bku.NoRekRekanan}] - {bku.NomorBku}",
            TipeMutasi = "D",
            Nominal = bku.NilaiNettoTransfer,
            SaldoAkhir = sisaSaldo,
            KodeTrx = bku.KodeTrx,
            BkuTransactionId = bku.Id
        });

        var resp = new SpjTransferResponse
        {
            Bit39 = "00",
            Message = $"Transfer SPJ sebesar Rp {bku.NilaiNettoTransfer:N0} ke {bku.NamaRekanan} ({bku.NoRekRekanan}) berhasil!",
            NoJurnalBank = jurnal,
            TanggalTransfer = now,
            NominalDitransfer = bku.NilaiNettoTransfer,
            SisaSaldoSekolah = sisaSaldo
        };

        _db.IntegrationAuditLogs.Add(new IntegrationAuditLog
        {
            SystemName = "BANK_DKI",
            EndpointCalled = bku.SumberDana == SumberDanaTypes.Bop ? "/api/spj-transfer/transfer-bop" : "/api/spj-transfer/transfer",
            CallerService = bku.SumberDana == SumberDanaTypes.Bop ? "siapbop-api" : "siapbos-api",
            RequestPayload = JsonSerializer.Serialize(req),
            ResponsePayload = JsonSerializer.Serialize(resp),
            StatusCode = "00",
            IsSuccess = true
        });

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<SpjTransferResponse>.Ok(resp, resp.Message));
    }
}
