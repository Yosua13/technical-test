using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using SiapBos.Shared.Constants;
using SiapBos.Shared.Data;
using SiapBos.Shared.DTOs;
using SiapBos.Shared.Entities;

namespace SiapBos.Shared.Services;

public class BkuCoreService
{
    private readonly SiapBosDbContext _db;
    private readonly IHttpClientFactory _httpClientFactory;

    public BkuCoreService(SiapBosDbContext db, IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<BkuSummarySaldoDto> GetSummarySaldoAsync(int sekolahId, int tahun, string sumberDana)
    {
        var sekolah = await _db.Sekolahs.FindAsync(sekolahId)
            ?? throw new KeyNotFoundException("Sekolah tidak ditemukan.");

        var rkasPagu = await _db.RkasItems
            .Where(r => r.SekolahId == sekolahId && r.TahunAnggaran == tahun && r.SumberDana == sumberDana)
            .SumAsync(r => r.TotalPagu);

        var bkus = await _db.BkuTransactions
            .Include(b => b.TaxItems)
            .Where(b => b.SekolahId == sekolahId && b.TahunAnggaran == tahun && b.SumberDana == sumberDana)
            .ToListAsync();

        var danaMasuk = bkus.Where(b => b.KodeTrx is KodeTrxBku.Dropping or KodeTrxBku.JasaGiro or KodeTrxBku.PendapatanLain)
                            .Sum(b => b.NilaiBrutoMasuk);
        var belanjaSpj = bkus.Where(b => b.KodeTrx is KodeTrxBku.BelanjaSpj or KodeTrxBku.SetorSisa && b.StatusBku != StatusBkuFlow.Ditolak)
                             .Sum(b => b.NilaiBrutoKeluar);

        var allTaxes = bkus.Where(b => b.StatusBku != StatusBkuFlow.Ditolak).SelectMany(b => b.TaxItems).ToList();
        var pajakDipungut = allTaxes.Sum(t => t.NilaiPajak);
        var pajakDisetor = allTaxes.Where(t => t.StatusPajak == StatusPajakFlow.LunasNtpn).Sum(t => t.NilaiPajak);

        var sisaKasBank = sumberDana == SumberDanaTypes.Bos ? sekolah.SaldoBos : sekolah.SaldoBop;

        return new BkuSummarySaldoDto
        {
            SekolahId = sekolahId,
            NamaSekolah = sekolah.NamaSekolah,
            SumberDana = sumberDana,
            TahunAnggaran = tahun,
            TotalPaguRkas = rkasPagu,
            TotalDanaMasuk = danaMasuk,
            TotalBelanjaSpj = belanjaSpj,
            SisaKasBank = sisaKasBank,
            TotalPajakDipungut = pajakDipungut,
            TotalPajakDisetor = pajakDisetor,
            PajakBelumDisetor = pajakDipungut - pajakDisetor,
            SisaPaguRkas = rkasPagu - belanjaSpj
        };
    }

    public async Task<List<BkuTransaction>> GetBkuListAsync(int sekolahId, int tahun, string sumberDana, string? kodePeriode = null, string? kodeTrx = null, int? statusBku = null)
    {
        var query = _db.BkuTransactions
            .Include(b => b.DetailItems)
            .Include(b => b.TaxItems)
            .Where(b => b.SekolahId == sekolahId && b.TahunAnggaran == tahun && b.SumberDana == sumberDana);

        if (!string.IsNullOrWhiteSpace(kodePeriode))
            query = query.Where(b => b.KodePeriode == kodePeriode);

        if (!string.IsNullOrWhiteSpace(kodeTrx))
            query = query.Where(b => b.KodeTrx == kodeTrx);

        if (statusBku.HasValue)
            query = query.Where(b => b.StatusBku == statusBku.Value);

        return await query.OrderByDescending(b => b.TanggalTransaksi).ThenByDescending(b => b.Id).ToListAsync();
    }

    public async Task<BkuTransaction> CreateBkuAsync(CreateBkuRequest req, string username)
    {
        var sekolah = await _db.Sekolahs.FindAsync(req.SekolahId)
            ?? throw new KeyNotFoundException("Sekolah tidak ditemukan.");

        if (!sekolah.IsRekeningConfirmed)
            throw new InvalidOperationException("Sekolah belum melakukan Konfirmasi Saldo Rekening di menu Sekolah.");

        var count = await _db.BkuTransactions.CountAsync(b => b.SumberDana == req.SumberDana && b.TahunAnggaran == req.TahunAnggaran) + 1;
        var prefix = req.SumberDana == SumberDanaTypes.Bos ? "BOS" : "BOP";

        decimal nilaiMasuk = 0m;
        decimal nilaiKeluar = 0m;
        decimal totalPajak = 0m;
        decimal netto = 0m;
        int initialStatus = StatusBkuFlow.Draft;

        var bku = new BkuTransaction
        {
            SekolahId = req.SekolahId,
            TahunAnggaran = req.TahunAnggaran,
            SumberDana = req.SumberDana,
            KodePeriode = req.KodePeriode,
            Bulan = req.TanggalTransaksi.Month,
            NomorBku = $"BKU-{prefix}-{req.TahunAnggaran}-{count:D4}",
            NomorBukti = string.IsNullOrWhiteSpace(req.NomorBukti) ? $"BUKTI/{prefix}/{DateTime.UtcNow:yyyyMMdd}/{count:D3}" : req.NomorBukti,
            TanggalTransaksi = DateTime.SpecifyKind(req.TanggalTransaksi, DateTimeKind.Utc),
            KodeTrx = req.KodeTrx,
            JenisPembayaran = req.KodeTrx == KodeTrxBku.BelanjaSpj ? req.JenisPembayaran : JenisPembayaranBku.NonTransfer,
            Uraian = req.Uraian,
            NamaRekanan = req.NamaRekanan,
            KodeBankRekanan = req.KodeBankRekanan,
            NamaBankRekanan = req.NamaBankRekanan,
            NoRekRekanan = req.NoRekRekanan,
            NamaPemilikRekRekanan = string.IsNullOrWhiteSpace(req.NamaPemilikRekRekanan) ? req.NamaRekanan : req.NamaPemilikRekRekanan,
            NpwpRekanan = req.NpwpRekanan,
            NamaWpRekanan = string.IsNullOrWhiteSpace(req.NamaWpRekanan) ? req.NamaRekanan : req.NamaWpRekanan,
            NoVaAtauPesanan = req.NoVaAtauPesanan,
            FileLampiranName = req.FileLampiranName,
            FileLampiranPath = req.FileLampiranPath,
            NeedSudinApproval = req.NeedSudinApproval,
            CreatedBy = username,
            CreatedAt = DateTime.UtcNow
        };

        if (req.KodeTrx is KodeTrxBku.JasaGiro or KodeTrxBku.PendapatanLain)
        {
            nilaiMasuk = req.NominalNonSpj ?? 0m;
            if (nilaiMasuk <= 0) throw new InvalidOperationException("Nominal penerimaan harus lebih dari 0.");

            initialStatus = StatusBkuFlow.LunasTransfer;
            bku.StatusTransferBank = "00";
            bku.NoJurnalBank = $"JRN-DKI-{DateTime.UtcNow:yyyyMMddHHmm}";
            bku.TanggalTransferBank = DateTime.UtcNow;

            if (req.SumberDana == SumberDanaTypes.Bos) sekolah.SaldoBos += nilaiMasuk;
            else sekolah.SaldoBop += nilaiMasuk;

            _db.BankMutations.Add(new BankMutation
            {
                SekolahId = sekolah.Id,
                SumberDana = req.SumberDana,
                NomorRekening = req.SumberDana == SumberDanaTypes.Bos ? sekolah.NoRekBos : sekolah.NoRekBop,
                TanggalTransaksi = bku.TanggalTransaksi,
                NomorReferensi = bku.NoJurnalBank,
                Uraian = $"CR {req.KodeTrx} - {req.Uraian}",
                TipeMutasi = "K",
                Nominal = nilaiMasuk,
                SaldoAkhir = req.SumberDana == SumberDanaTypes.Bos ? sekolah.SaldoBos : sekolah.SaldoBop,
                KodeTrx = req.KodeTrx
            });
        }
        else // Belanja SPJ (JJ)
        {
            if (req.DetailItems.Count == 0)
                throw new InvalidOperationException("Minimal harus terdapat 1 rincian item belanja RKAS.");

            foreach (var item in req.DetailItems)
            {
                var subtotal = Math.Round(item.Volume * item.HargaSatuan, 2);
                nilaiKeluar += subtotal;

                if (item.RkasItemId.HasValue)
                {
                    var rkas = await _db.RkasItems.FindAsync(item.RkasItemId.Value);
                    if (rkas != null)
                    {
                        var sisaPagu = rkas.TotalPagu - rkas.TotalRealisasi;
                        if (subtotal > sisaPagu)
                            throw new InvalidOperationException($"Belanja komponen '{rkas.NamaKomponen}' (Rp {subtotal:N0}) melebihi sisa pagu RKAS (Rp {sisaPagu:N0}).");
                        rkas.TotalRealisasi += subtotal;
                    }
                }

                bku.DetailItems.Add(new BkuDetailItem
                {
                    RkasItemId = item.RkasItemId,
                    KodeKegiatan = item.KodeKegiatan,
                    NamaKegiatan = item.NamaKegiatan,
                    KodeAkun = item.KodeAkun,
                    NamaAkun = item.NamaAkun,
                    KodeKomponen = item.KodeKomponen,
                    NamaKomponen = item.NamaKomponen,
                    Spesifikasi = item.Spesifikasi,
                    Volume = item.Volume,
                    Satuan = item.Satuan,
                    HargaSatuan = item.HargaSatuan,
                    Jumlah = subtotal
                });
            }

            var saldoSaatIni = req.SumberDana == SumberDanaTypes.Bos ? sekolah.SaldoBos : sekolah.SaldoBop;
            if (nilaiKeluar > saldoSaatIni)
                throw new InvalidOperationException($"Saldo kas bank {req.SumberDana} tidak mencukupi (Saldo: Rp {saldoSaatIni:N0}, Kebutuhan: Rp {nilaiKeluar:N0}).");

            var taxMasters = await _db.TaxMasters.ToDictionaryAsync(t => t.KodeTrxPajak);
            foreach (var tx in req.TaxItems.Where(t => t.NilaiPajak > 0))
            {
                taxMasters.TryGetValue(tx.KodeTrxPajak, out var master);
                totalPajak += tx.NilaiPajak;
                bku.TaxItems.Add(new BkuTaxItem
                {
                    KodeTrxPajak = tx.KodeTrxPajak,
                    NamaPajak = master?.NamaPajak ?? tx.KodeTrxPajak,
                    KodeMap = tx.KodeMap ?? master?.KodeMap ?? "411211",
                    KodeJenisSetoran = tx.KodeJenisSetoran ?? master?.KodeJenisSetoran ?? "100",
                    MasaPajak = req.TanggalTransaksi.Month.ToString("D2"),
                    TahunPajak = req.TahunAnggaran,
                    DasarPengenaanPajak = tx.DasarPengenaanPajak ?? nilaiKeluar,
                    TarifPersen = tx.TarifPersen ?? master?.TarifPersen ?? 0m,
                    NilaiPajak = tx.NilaiPajak,
                    StatusPajak = StatusPajakFlow.BelumBilling
                });
            }

            netto = nilaiKeluar - totalPajak;
            if (netto < 0) throw new InvalidOperationException("Total potongan pajak tidak boleh melebihi nilai bruto belanja.");
        }

        bku.NilaiBrutoMasuk = nilaiMasuk;
        bku.NilaiBrutoKeluar = nilaiKeluar;
        bku.TotalPotonganPajak = totalPajak;
        bku.NilaiNettoTransfer = netto;
        bku.StatusBku = initialStatus;

        _db.BkuTransactions.Add(bku);
        await _db.SaveChangesAsync();
        return bku;
    }

    public async Task DeleteDraftBkuAsync(int bkuId)
    {
        var bku = await _db.BkuTransactions
            .Include(b => b.DetailItems)
            .FirstOrDefaultAsync(b => b.Id == bkuId)
            ?? throw new KeyNotFoundException("Transaksi BKU tidak ditemukan.");

        if (bku.StatusBku != StatusBkuFlow.Draft && bku.StatusBku != StatusBkuFlow.Ditolak)
            throw new InvalidOperationException("Hanya transaksi berstatus Draft atau Ditolak yang dapat dihapus.");

        foreach (var d in bku.DetailItems)
        {
            if (d.RkasItemId.HasValue)
            {
                var rkas = await _db.RkasItems.FindAsync(d.RkasItemId.Value);
                if (rkas != null) rkas.TotalRealisasi = Math.Max(0, rkas.TotalRealisasi - d.Jumlah);
            }
        }

        _db.BkuTransactions.Remove(bku);
        await _db.SaveChangesAsync();
    }

    public async Task<BkuTransaction> AjukanPkAsync(int bkuId)
    {
        var bku = await _db.BkuTransactions.FindAsync(bkuId)
            ?? throw new KeyNotFoundException("Transaksi BKU tidak ditemukan.");

        if (bku.StatusBku != StatusBkuFlow.Draft && bku.StatusBku != StatusBkuFlow.Ditolak)
            throw new InvalidOperationException("Transaksi hanya bisa diajukan dari status Draft atau Ditolak.");

        bku.StatusBku = StatusBkuFlow.DiajukanTu;
        bku.SubmittedAt = DateTime.UtcNow;
        bku.CatatanVerifikasi = "Diajukan oleh Bendahara (PK) untuk verifikasi TU.";
        bku.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return bku;
    }

    public async Task<BkuTransaction> ApproveTuAsync(int bkuId, ApprovalActionRequest req)
    {
        var bku = await _db.BkuTransactions.FindAsync(bkuId)
            ?? throw new KeyNotFoundException("Transaksi BKU tidak ditemukan.");

        if (bku.StatusBku != StatusBkuFlow.DiajukanTu)
            throw new InvalidOperationException("Transaksi harus berstatus Diajukan ke TU.");

        bku.StatusBku = req.Disetujui ? StatusBkuFlow.DisetujuiTu : StatusBkuFlow.Ditolak;
        bku.ApprovedByTuAt = DateTime.UtcNow;
        bku.CatatanVerifikasi = string.IsNullOrWhiteSpace(req.Catatan)
            ? (req.Disetujui ? "Diverifikasi lengkap oleh Verifikator TU." : "Ditolak oleh TU, mohon perbaiki dokumen.")
            : req.Catatan;
        bku.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return bku;
    }

    public async Task<BkuTransaction> ApprovePaAsync(int bkuId, ApprovalActionRequest req)
    {
        var bku = await _db.BkuTransactions.FindAsync(bkuId)
            ?? throw new KeyNotFoundException("Transaksi BKU tidak ditemukan.");

        if (bku.StatusBku != StatusBkuFlow.DisetujuiTu)
            throw new InvalidOperationException("Transaksi harus sudah disetujui TU sebelum persetujuan Kepala Sekolah (PA).");

        bku.StatusBku = req.Disetujui ? StatusBkuFlow.DisetujuiPa : StatusBkuFlow.Ditolak;
        bku.ApprovedByPaAt = DateTime.UtcNow;
        bku.CatatanVerifikasi = string.IsNullOrWhiteSpace(req.Catatan)
            ? (req.Disetujui ? "Disetujui PA. Siap dilakukan Permohonan Token & Transfer Bank DKI." : "Ditolak oleh PA.")
            : req.Catatan;
        bku.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return bku;
    }

    public async Task<BkuTransaction> ApproveSudinAsync(int bkuId, ApprovalActionRequest req)
    {
        var bku = await _db.BkuTransactions.FindAsync(bkuId)
            ?? throw new KeyNotFoundException("Transaksi BKU tidak ditemukan.");

        if (bku.StatusBku != StatusBkuFlow.DisetujuiPa)
            throw new InvalidOperationException("Transaksi harus sudah disetujui PA terlebih dahulu.");

        bku.StatusBku = req.Disetujui ? StatusBkuFlow.DisetujuiSudin : StatusBkuFlow.Ditolak;
        bku.ApprovedBySudinAt = DateTime.UtcNow;
        bku.CatatanVerifikasi = string.IsNullOrWhiteSpace(req.Catatan)
            ? (req.Disetujui ? "Disetujui Suku Dinas Pendidikan Wilayah." : "Ditolak oleh Sudin.")
            : req.Catatan;
        bku.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return bku;
    }

    public async Task<BankDkiCreateTokenResponse> RequestTokenViaIntegrationAsync(int bkuId, string nrk)
    {
        var client = _httpClientFactory.CreateClient("IntegrationClient");
        var resp = await client.PostAsJsonAsync("/api/bank-dki/createToken", new BankDkiCreateTokenRequest
        {
            BkuId = bkuId,
            Nrk = nrk
        });
        var result = await resp.Content.ReadFromJsonAsync<ApiResponse<BankDkiCreateTokenResponse>>();
        if (!resp.IsSuccessStatusCode || result?.Success != true || result.Data == null)
            throw new InvalidOperationException(result?.Message ?? "Gagal memanggil siapbos-integration createToken.");
        return result.Data;
    }

    public async Task<SpjTransferResponse> ExecuteTransferViaIntegrationAsync(int bkuId, string tokenOtp, string executedBy, string sumberDana)
    {
        var client = _httpClientFactory.CreateClient("IntegrationClient");
        var endpoint = sumberDana == SumberDanaTypes.Bop
            ? "/api/spj-transfer/transfer-bop"
            : "/api/spj-transfer/transfer";

        var resp = await client.PostAsJsonAsync(endpoint, new SpjTransferRequest
        {
            BkuId = bkuId,
            TokenOtp = tokenOtp,
            ExecutedBy = executedBy
        });
        var result = await resp.Content.ReadFromJsonAsync<ApiResponse<SpjTransferResponse>>();
        if (!resp.IsSuccessStatusCode || result?.Success != true || result.Data == null)
            throw new InvalidOperationException(result?.Message ?? "Gagal mengeksekusi transfer SPJ melalui siapbos-integration.");
        return result.Data;
    }

    public async Task<BkuTaxItem> ExecuteTaxIntegrationAsync(int taxId, string action)
    {
        var client = _httpClientFactory.CreateClient("IntegrationClient");
        var path = action switch
        {
            "create" => $"/api/spj-transfer-pajak/{taxId}/create",
            "reset" => $"/api/spj-transfer-pajak/{taxId}/reset",
            "inquiry" => $"/api/spj-transfer-pajak/{taxId}/inquiry",
            "payment" => $"/api/spj-transfer-pajak/{taxId}/payment",
            _ => throw new ArgumentException("Aksi pajak tidak valid.")
        };

        var resp = await client.PostAsJsonAsync(path, new { });
        var result = await resp.Content.ReadFromJsonAsync<ApiResponse<BkuTaxItem>>();
        if (!resp.IsSuccessStatusCode || result?.Success != true || result.Data == null)
            throw new InvalidOperationException(result?.Message ?? "Gagal memanggil siapbos-integration layanan pajak.");
        return result.Data;
    }

    public async Task<DroppingDana> ConfirmDroppingToBkuAsync(int droppingId, string username)
    {
        var dropping = await _db.DroppingDanas.Include(d => d.Sekolah).FirstOrDefaultAsync(d => d.Id == droppingId)
            ?? throw new KeyNotFoundException("Data Dropping Dana tidak ditemukan.");

        if (dropping.IsConfirmedToBku)
            throw new InvalidOperationException("Dropping Dana ini sudah dikonfirmasi masuk ke BKU.");

        var sekolah = dropping.Sekolah!;
        var count = await _db.BkuTransactions.CountAsync(b => b.SumberDana == dropping.SumberDana && b.TahunAnggaran == dropping.TahunAnggaran) + 1;

        if (dropping.SumberDana == SumberDanaTypes.Bos)
            sekolah.SaldoBos += dropping.NilaiDropping;
        else
            sekolah.SaldoBop += dropping.NilaiDropping;

        var jurnal = $"JRN-DROP-{DateTime.UtcNow:yyyyMMddHHmmss}";
        var bkuJo = new BkuTransaction
        {
            SekolahId = dropping.SekolahId,
            TahunAnggaran = dropping.TahunAnggaran,
            SumberDana = dropping.SumberDana,
            KodePeriode = dropping.KodePeriode,
            Bulan = DateTime.UtcNow.Month,
            NomorBku = $"BKU-{dropping.SumberDana}-{dropping.TahunAnggaran}-{count:D4}",
            NomorBukti = dropping.NomorSp2d,
            TanggalTransaksi = DateTime.UtcNow,
            KodeTrx = KodeTrxBku.Dropping,
            JenisPembayaran = JenisPembayaranBku.NonTransfer,
            Uraian = $"Konfirmasi Dropping Dana {dropping.SumberDana} ({dropping.NamaPeriode}) - {dropping.NomorSp2d}",
            NilaiBrutoMasuk = dropping.NilaiDropping,
            NilaiBrutoKeluar = 0,
            TotalPotonganPajak = 0,
            NilaiNettoTransfer = 0,
            NamaRekanan = dropping.SumberDana == SumberDanaTypes.Bos ? "KPPN / KEMENDIKBUDRISTEK" : "BPKD PROVINSI DKI JAKARTA",
            NamaBankRekanan = "Bank DKI",
            NoRekRekanan = dropping.SumberDana == SumberDanaTypes.Bos ? sekolah.NoRekBos : sekolah.NoRekBop,
            StatusBku = StatusBkuFlow.LunasTransfer,
            StatusTransferBank = "00",
            NoJurnalBank = jurnal,
            TanggalTransferBank = DateTime.UtcNow,
            CreatedBy = username
        };

        _db.BkuTransactions.Add(bkuJo);
        await _db.SaveChangesAsync();

        _db.BankMutations.Add(new BankMutation
        {
            SekolahId = dropping.SekolahId,
            SumberDana = dropping.SumberDana,
            NomorRekening = dropping.SumberDana == SumberDanaTypes.Bos ? sekolah.NoRekBos : sekolah.NoRekBop,
            TanggalTransaksi = DateTime.UtcNow,
            NomorReferensi = jurnal,
            Uraian = $"CR DROPPING DANA {dropping.SumberDana} {dropping.KodePeriode} ({dropping.NomorSp2d})",
            TipeMutasi = "K",
            Nominal = dropping.NilaiDropping,
            SaldoAkhir = dropping.SumberDana == SumberDanaTypes.Bos ? sekolah.SaldoBos : sekolah.SaldoBop,
            KodeTrx = KodeTrxBku.Dropping,
            BkuTransactionId = bkuJo.Id
        });

        dropping.IsConfirmedToBku = true;
        dropping.TanggalKonfirmasi = DateTime.UtcNow;
        dropping.BkuTransactionId = bkuJo.Id;
        await _db.SaveChangesAsync();
        return dropping;
    }

    public async Task<BapKasReport> SaveOrUpdateBapKasAsync(int sekolahId, int tahun, string sumberDana, string kodePeriode, decimal kasTunai, int p100, int p50, int p20, int p10, int p5, int p2, int p1, string keterangan)
    {
        var summary = await GetSummarySaldoAsync(sekolahId, tahun, sumberDana);
        var saldoBku = summary.SisaKasBank;
        var saldoBank = summary.SisaKasBank;
        var selisih = saldoBank + kasTunai - saldoBku;

        var existing = await _db.BapKasReports.FirstOrDefaultAsync(b =>
            b.SekolahId == sekolahId && b.TahunAnggaran == tahun && b.SumberDana == sumberDana && b.KodePeriode == kodePeriode);

        if (existing != null)
        {
            if (existing.IsTutupBuku)
                throw new InvalidOperationException("Periode ini sudah dilakukan Tutup Buku.");

            existing.TanggalBap = DateTime.UtcNow;
            existing.SaldoBku = saldoBku;
            existing.SaldoRekeningKoran = saldoBank;
            existing.SaldoKasTunai = kasTunai;
            existing.Pecahan100rb = p100;
            existing.Pecahan50rb = p50;
            existing.Pecahan20rb = p20;
            existing.Pecahan10rb = p10;
            existing.Pecahan5rb = p5;
            existing.Pecahan2rb = p2;
            existing.Pecahan1rb = p1;
            existing.SelisihKas = selisih;
            existing.KeteranganSelisih = keterangan;
            await _db.SaveChangesAsync();
            return existing;
        }

        var count = await _db.BapKasReports.CountAsync() + 1;
        var bap = new BapKasReport
        {
            SekolahId = sekolahId,
            TahunAnggaran = tahun,
            SumberDana = sumberDana,
            KodePeriode = kodePeriode,
            NomorBap = $"BAP-KAS/{sumberDana}/{tahun}/{count:D4}",
            TanggalBap = DateTime.UtcNow,
            SaldoBku = saldoBku,
            SaldoRekeningKoran = saldoBank,
            SaldoKasTunai = kasTunai,
            Pecahan100rb = p100,
            Pecahan50rb = p50,
            Pecahan20rb = p20,
            Pecahan10rb = p10,
            Pecahan5rb = p5,
            Pecahan2rb = p2,
            Pecahan1rb = p1,
            SelisihKas = selisih,
            KeteranganSelisih = string.IsNullOrWhiteSpace(keterangan) ? "Saldo BKU sama dengan Saldo Rekening Koran Bank DKI." : keterangan,
            StatusBap = 0
        };
        _db.BapKasReports.Add(bap);
        await _db.SaveChangesAsync();
        return bap;
    }

    public async Task<BapKasReport> ApproveBapKasAsync(int bapId, int targetStatus)
    {
        var bap = await _db.BapKasReports.FindAsync(bapId)
            ?? throw new KeyNotFoundException("BAP Kas tidak ditemukan.");
        bap.StatusBap = targetStatus;
        if (targetStatus == 1) bap.ApprovedPaAt = DateTime.UtcNow;
        if (targetStatus == 2) bap.ApprovedDinasAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return bap;
    }

    public async Task<BapKasReport> TutupBukuAsync(int sekolahId, int tahun, string sumberDana, string kodePeriode)
    {
        var bap = await _db.BapKasReports.FirstOrDefaultAsync(b =>
            b.SekolahId == sekolahId && b.TahunAnggaran == tahun && b.SumberDana == sumberDana && b.KodePeriode == kodePeriode)
            ?? throw new InvalidOperationException("Silakan buat BAP Kas periode ini terlebih dahulu sebelum Tutup Buku.");

        if (bap.StatusBap < 2)
            throw new InvalidOperationException("BAP Kas harus sudah disetujui Kepala Sekolah (PA) dan Dinas/Sudin (status >= 2) sebelum Tutup Buku.");

        var hasUnpaidTax = await _db.BkuTransactions
            .Include(b => b.TaxItems)
            .Where(b => b.SekolahId == sekolahId && b.TahunAnggaran == tahun && b.SumberDana == sumberDana && b.KodePeriode == kodePeriode && b.StatusBku == StatusBkuFlow.LunasTransfer)
            .SelectMany(b => b.TaxItems)
            .AnyAsync(t => t.StatusPajak != StatusPajakFlow.LunasNtpn);

        if (hasUnpaidTax)
            throw new InvalidOperationException("Masih terdapat pajak transaksi lunas yang belum dibayar (belum berstatus Lunas NTPN).");

        var bkus = await _db.BkuTransactions
            .Where(b => b.SekolahId == sekolahId && b.TahunAnggaran == tahun && b.SumberDana == sumberDana && b.KodePeriode == kodePeriode)
            .ToListAsync();

        foreach (var b in bkus)
        {
            b.IsTutupBuku = true;
            b.TanggalTutupBuku = DateTime.UtcNow;
        }

        bap.IsTutupBuku = true;
        await _db.SaveChangesAsync();
        return bap;
    }

    public async Task<BapKasReport> BatalTutupBukuAsync(int sekolahId, int tahun, string sumberDana, string kodePeriode)
    {
        var bap = await _db.BapKasReports.FirstOrDefaultAsync(b =>
            b.SekolahId == sekolahId && b.TahunAnggaran == tahun && b.SumberDana == sumberDana && b.KodePeriode == kodePeriode)
            ?? throw new KeyNotFoundException("Data BAP Kas / Tutup Buku tidak ditemukan.");

        var bkus = await _db.BkuTransactions
            .Where(b => b.SekolahId == sekolahId && b.TahunAnggaran == tahun && b.SumberDana == sumberDana && b.KodePeriode == kodePeriode)
            .ToListAsync();

        foreach (var b in bkus)
        {
            b.IsTutupBuku = false;
            b.TanggalTutupBuku = null;
        }

        bap.IsTutupBuku = false;
        await _db.SaveChangesAsync();
        return bap;
    }

    public async Task<List<SetoranSts>> GetSetoranStsAsync(int sekolahId, int tahun, string sumberDana) =>
        await _db.SetoranStses
            .Where(s => s.SekolahId == sekolahId && s.TahunAnggaran == tahun && s.SumberDana == sumberDana)
            .OrderByDescending(s => s.Id)
            .ToListAsync();

    public async Task<SetoranSts> CreateSetoranStsAsync(int sekolahId, int tahun, string sumberDana, string kodePeriode, string jenisSetoran, string uraian, decimal nilaiSetor)
    {
        if (nilaiSetor <= 0) throw new InvalidOperationException("Nilai setoran harus lebih dari 0.");
        var count = await _db.SetoranStses.CountAsync() + 1;
        var sts = new SetoranSts
        {
            SekolahId = sekolahId,
            TahunAnggaran = tahun,
            SumberDana = sumberDana,
            KodePeriode = kodePeriode,
            NomorSts = $"STS/{sumberDana}/{tahun}/{count:D4}",
            TanggalSts = DateTime.UtcNow,
            JenisSetoran = jenisSetoran,
            Uraian = uraian,
            NilaiSetor = nilaiSetor,
            StatusSts = 1
        };
        _db.SetoranStses.Add(sts);
        await _db.SaveChangesAsync();
        return sts;
    }

    public async Task<SetoranSts> ApproveOrExecuteStsAsync(int stsId, int targetStatus, string username)
    {
        var sts = await _db.SetoranStses.Include(s => s.Sekolah).FirstOrDefaultAsync(s => s.Id == stsId)
            ?? throw new KeyNotFoundException("Data STS tidak ditemukan.");

        if (targetStatus == 2)
        {
            sts.StatusSts = 2;
            await _db.SaveChangesAsync();
            return sts;
        }

        if (sts.StatusSts == 3)
            throw new InvalidOperationException("STS sudah disetorkan sebelumnya.");

        var sekolah = sts.Sekolah!;
        var saldo = sts.SumberDana == SumberDanaTypes.Bos ? sekolah.SaldoBos : sekolah.SaldoBop;
        if (saldo < sts.NilaiSetor)
            throw new InvalidOperationException($"Saldo {sts.SumberDana} tidak cukup untuk penyetoran STS.");

        if (sts.SumberDana == SumberDanaTypes.Bos) sekolah.SaldoBos -= sts.NilaiSetor;
        else sekolah.SaldoBop -= sts.NilaiSetor;

        var sisaSaldo = sts.SumberDana == SumberDanaTypes.Bos ? sekolah.SaldoBos : sekolah.SaldoBop;
        var count = await _db.BkuTransactions.CountAsync(b => b.SumberDana == sts.SumberDana && b.TahunAnggaran == sts.TahunAnggaran) + 1;
        var jurnal = $"JRN-STS-{DateTime.UtcNow:yyyyMMddHHmmss}";

        var bkuSt = new BkuTransaction
        {
            SekolahId = sts.SekolahId,
            TahunAnggaran = sts.TahunAnggaran,
            SumberDana = sts.SumberDana,
            KodePeriode = sts.KodePeriode,
            Bulan = DateTime.UtcNow.Month,
            NomorBku = $"BKU-{sts.SumberDana}-{sts.TahunAnggaran}-{count:D4}",
            NomorBukti = sts.NomorSts,
            TanggalTransaksi = DateTime.UtcNow,
            KodeTrx = KodeTrxBku.SetorSisa,
            JenisPembayaran = JenisPembayaranBku.Transfer,
            Uraian = $"Setor {sts.JenisSetoran}: {sts.Uraian}",
            NilaiBrutoKeluar = sts.NilaiSetor,
            NilaiNettoTransfer = sts.NilaiSetor,
            NamaRekanan = "RKUD PEMPROV DKI JAKARTA / KAS NEGARA",
            KodeBankRekanan = "111",
            NamaBankRekanan = "Bank DKI",
            NoRekRekanan = sts.RekeningTujuan,
            StatusBku = StatusBkuFlow.LunasTransfer,
            StatusTransferBank = "00",
            NoJurnalBank = jurnal,
            TanggalTransferBank = DateTime.UtcNow,
            CreatedBy = username
        };

        _db.BkuTransactions.Add(bkuSt);
        await _db.SaveChangesAsync();

        _db.BankMutations.Add(new BankMutation
        {
            SekolahId = sekolah.Id,
            SumberDana = sts.SumberDana,
            NomorRekening = sts.SumberDana == SumberDanaTypes.Bos ? sekolah.NoRekBos : sekolah.NoRekBop,
            TanggalTransaksi = DateTime.UtcNow,
            NomorReferensi = jurnal,
            Uraian = $"DB SETORAN STS {sts.NomorSts} - {sts.Uraian}",
            TipeMutasi = "D",
            Nominal = sts.NilaiSetor,
            SaldoAkhir = sisaSaldo,
            KodeTrx = KodeTrxBku.SetorSisa,
            BkuTransactionId = bkuSt.Id
        });

        sts.StatusSts = 3;
        sts.BkuTransactionId = bkuSt.Id;
        await _db.SaveChangesAsync();
        return sts;
    }
}
