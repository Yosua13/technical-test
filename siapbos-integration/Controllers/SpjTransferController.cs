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

        var now = DateTime.UtcNow;
        if (bku == null || bku.Sekolah == null)
        {
            var dummyJurnal = DummyIntegrationFactory.GenerateJurnal("DKI", now);
            var dummyResp = new SpjTransferResponse
            {
                Bit39 = "00",
                Message = $"Transfer SPJ CMS Bank DKI dummy berhasil (Jurnal: {dummyJurnal}).",
                NoJurnalBank = dummyJurnal,
                TanggalTransfer = now,
                NominalDitransfer = 1000000m,
                SisaSaldoSekolah = 50000000m
            };
            _db.IntegrationAuditLogs.Add(new IntegrationAuditLog
            {
                SystemName = "BANK_DKI",
                EndpointCalled = "/api/spj-transfer/transfer",
                CallerService = "siapbos-api",
                RequestPayload = JsonSerializer.Serialize(req),
                ResponsePayload = JsonSerializer.Serialize(dummyResp),
                StatusCode = "00",
                IsSuccess = true
            });
            await _db.SaveChangesAsync();
            return Ok(ApiResponse<SpjTransferResponse>.Ok(dummyResp, dummyResp.Message));
        }

        var sekolah = bku.Sekolah;
        if (bku.StatusBku == StatusBkuFlow.LunasTransfer)
        {
            var existingJurnal = string.IsNullOrWhiteSpace(bku.NoJurnalBank)
                ? DummyIntegrationFactory.GenerateJurnal("DKI", now)
                : bku.NoJurnalBank;
            var currentSaldo = bku.SumberDana == SumberDanaTypes.Bos ? sekolah.SaldoBos : sekolah.SaldoBop;
            var existingResp = new SpjTransferResponse
            {
                Bit39 = "00",
                Message = $"Transfer SPJ sebesar Rp {bku.NilaiNettoTransfer:N0} telah lunas (Jurnal: {existingJurnal}).",
                NoJurnalBank = existingJurnal,
                TanggalTransfer = bku.TanggalTransferBank ?? now,
                NominalDitransfer = bku.NilaiNettoTransfer,
                SisaSaldoSekolah = currentSaldo
            };
            return Ok(ApiResponse<SpjTransferResponse>.Ok(existingResp, existingResp.Message));
        }

        if (bku.SumberDana == SumberDanaTypes.Bos)
            sekolah.SaldoBos = Math.Max(0m, sekolah.SaldoBos - bku.NilaiNettoTransfer);
        else
            sekolah.SaldoBop = Math.Max(0m, sekolah.SaldoBop - bku.NilaiNettoTransfer);

        var sisaSaldo = bku.SumberDana == SumberDanaTypes.Bos ? sekolah.SaldoBos : sekolah.SaldoBop;
        var jurnal = DummyIntegrationFactory.GenerateJurnal("DKI", now);

        bku.StatusBku = StatusBkuFlow.LunasTransfer;
        bku.NoJurnalBank = jurnal;
        bku.TanggalTransferBank = now;
        bku.StatusTransferBank = "00";
        bku.CatatanVerifikasi = $"Transfer CMS Bank DKI Berhasil (Bit39=00). Jurnal: {jurnal}";
        bku.UpdatedAt = now;

        // Sync status of linked Penerimaan Pajak BKU to LunasTransfer (status 5)
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
            child.CatatanVerifikasi = $"Status Lunas mengikuti transfer Bank SPJ induk {bku.NomorBku}.";
        }

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
