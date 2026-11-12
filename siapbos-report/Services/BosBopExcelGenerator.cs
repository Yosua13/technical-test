using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using SiapBos.Shared.Constants;
using SiapBos.Shared.Data;

namespace SiapBos.Report.Services;

public class BosBopExcelGenerator
{
    private readonly SiapBosDbContext _db;

    public BosBopExcelGenerator(SiapBosDbContext db) => _db = db;

    public async Task<byte[]> GenerateBapKasExcelAsync(int sekolahId, int tahun, string sumberDana, string kodePeriode)
    {
        var sekolah = await _db.Sekolahs.FindAsync(sekolahId) ?? throw new KeyNotFoundException("Sekolah tidak ditemukan.");
        var bap = await _db.BapKasReports
            .FirstOrDefaultAsync(b => b.SekolahId == sekolahId && b.TahunAnggaran == tahun && b.SumberDana == sumberDana && b.KodePeriode == kodePeriode)
            ?? await _db.BapKasReports.Where(b => b.SekolahId == sekolahId).OrderByDescending(b => b.Id).FirstOrDefaultAsync();

        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("BAP Kas");

        ws.Cell("A1").Value = "BERITA ACARA PEMERIKSAAN KAS (BAP KAS)";
        ws.Cell("A1").Style.Font.Bold = true;
        ws.Cell("A1").Style.Font.FontSize = 14;
        ws.Cell("A2").Value = $"{sekolah.NamaSekolah} (NPSN: {sekolah.Npsn}) | Sumber Dana: {sumberDana} | TA {tahun}";
        ws.Cell("A3").Value = $"No. BAP: {bap?.NomorBap ?? "Belum Dibuat"} | Tanggal: {(bap?.TanggalBap ?? DateTime.Now):dd-MM-yyyy}";

        ws.Cell("A5").Value = "Uraian Rekonsiliasi Kas";
        ws.Cell("B5").Value = "Nominal (Rp)";
        ws.Range("A5:B5").Style.Fill.BackgroundColor = XLColor.Orange;
        ws.Range("A5:B5").Style.Font.FontColor = XLColor.White;
        ws.Range("A5:B5").Style.Font.Bold = true;

        var saldoSaatIni = sumberDana == SumberDanaTypes.Bos ? sekolah.SaldoBos : sekolah.SaldoBop;
        ws.Cell("A6").Value = "1. Saldo Kas Menurut Buku Kas Umum (BKU)";
        ws.Cell("B6").Value = bap?.SaldoBku ?? saldoSaatIni;
        ws.Cell("A7").Value = "2. Saldo Rekening Koran Bank DKI";
        ws.Cell("B7").Value = bap?.SaldoRekeningKoran ?? saldoSaatIni;
        ws.Cell("A8").Value = "3. Saldo Kas Tunai di Brankas Sekolah";
        ws.Cell("B8").Value = bap?.SaldoKasTunai ?? 0m;
        ws.Cell("A9").Value = "4. Selisih Kas (Bank + Tunai - BKU)";
        ws.Cell("B9").Value = bap?.SelisihKas ?? 0m;
        ws.Cell("A10").Value = "5. Status Persetujuan & Tutup Buku";
        ws.Cell("B10").Value = bap == null ? "Draft" : bap.IsTutupBuku ? "TUTUP BUKU" : $"Status Approval: {bap.StatusBap}";

        ws.Range("B6:B9").Style.NumberFormat.Format = "#,##0";
        ws.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    public async Task<byte[]> GenerateMonitoringExcelAsync(int tahun, string sumberDana, string? wilayahSudin)
    {
        var sekolahQuery = _db.Sekolahs.AsQueryable();
        if (!string.IsNullOrWhiteSpace(wilayahSudin) && wilayahSudin != "ALL")
            sekolahQuery = sekolahQuery.Where(s => s.WilayahSudin == wilayahSudin);

        var sekolahs = await sekolahQuery.OrderBy(s => s.NamaSekolah).ToListAsync();
        var rkasList = await _db.RkasItems.Where(r => r.TahunAnggaran == tahun && r.SumberDana == sumberDana).ToListAsync();
        var bkuList = await _db.BkuTransactions.Include(b => b.TaxItems).Where(b => b.TahunAnggaran == tahun && b.SumberDana == sumberDana).ToListAsync();
        var bapList = await _db.BapKasReports.Where(b => b.TahunAnggaran == tahun && b.SumberDana == sumberDana).ToListAsync();

        using var wb = new XLWorkbook();

        // Sheet 1: Monitoring Serapan & Realisasi Sekolah
        var ws1 = wb.Worksheets.Add("Monitoring Serapan");
        string[] headers1 = ["No", "NPSN", "Nama Sekolah", "Wilayah", "Pagu RKAS", "Total Dropping Masuk", "Total Belanja SPJ", "Sisa Kas Bank", "Persen Serapan", "Status Tutup Buku"];
        for (int i = 0; i < headers1.Length; i++)
        {
            ws1.Cell(1, i + 1).Value = headers1[i];
            ws1.Cell(1, i + 1).Style.Fill.BackgroundColor = XLColor.DarkOrange;
            ws1.Cell(1, i + 1).Style.Font.FontColor = XLColor.White;
            ws1.Cell(1, i + 1).Style.Font.Bold = true;
        }

        int row = 2;
        int no = 1;
        foreach (var s in sekolahs)
        {
            var pagu = rkasList.Where(r => r.SekolahId == s.Id).Sum(r => r.TotalPagu);
            var bkus = bkuList.Where(b => b.SekolahId == s.Id).ToList();
            var masuk = bkus.Where(b => b.KodeTrx == KodeTrxBku.Dropping).Sum(b => b.NilaiBrutoMasuk);
            var keluar = bkus.Where(b => b.KodeTrx == KodeTrxBku.BelanjaSpj && b.StatusBku != StatusBkuFlow.Ditolak).Sum(b => b.NilaiBrutoKeluar);
            var kas = sumberDana == SumberDanaTypes.Bos ? s.SaldoBos : s.SaldoBop;
            var pct = pagu > 0 ? Math.Round(keluar / pagu * 100, 2) : 0m;
            var tutup = bapList.Any(b => b.SekolahId == s.Id && b.IsTutupBuku) ? "SUDAH TUTUP BUKU" : "BELUM TUTUP BUKU";

            ws1.Cell(row, 1).Value = no++;
            ws1.Cell(row, 2).Value = s.Npsn;
            ws1.Cell(row, 3).Value = s.NamaSekolah;
            ws1.Cell(row, 4).Value = s.WilayahSudin;
            ws1.Cell(row, 5).Value = pagu;
            ws1.Cell(row, 6).Value = masuk;
            ws1.Cell(row, 7).Value = keluar;
            ws1.Cell(row, 8).Value = kas;
            ws1.Cell(row, 9).Value = pct / 100m;
            ws1.Cell(row, 10).Value = tutup;
            ws1.Range(row, 5, row, 8).Style.NumberFormat.Format = "#,##0";
            ws1.Cell(row, 9).Style.NumberFormat.Format = "0.0%";
            row++;
        }
        ws1.Columns().AdjustToContents();

        // Sheet 2: Monitoring Pajak MPN
        var ws2 = wb.Worksheets.Add("Monitoring Pajak MPN");
        string[] headers2 = ["No BKU", "Sekolah", "Jenis Pajak", "Kode MAP", "Nominal Pajak", "Kode Billing", "NTPN", "Status Pajak"];
        for (int i = 0; i < headers2.Length; i++)
        {
            ws2.Cell(1, i + 1).Value = headers2[i];
            ws2.Cell(1, i + 1).Style.Fill.BackgroundColor = XLColor.DarkSlateBlue;
            ws2.Cell(1, i + 1).Style.Font.FontColor = XLColor.White;
            ws2.Cell(1, i + 1).Style.Font.Bold = true;
        }
        int row2 = 2;
        foreach (var b in bkuList)
        {
            var schoolName = sekolahs.FirstOrDefault(x => x.Id == b.SekolahId)?.NamaSekolah ?? "-";
            foreach (var tx in b.TaxItems)
            {
                ws2.Cell(row2, 1).Value = b.NomorBku;
                ws2.Cell(row2, 2).Value = schoolName;
                ws2.Cell(row2, 3).Value = tx.NamaPajak;
                ws2.Cell(row2, 4).Value = tx.KodeMap;
                ws2.Cell(row2, 5).Value = tx.NilaiPajak;
                ws2.Cell(row2, 5).Style.NumberFormat.Format = "#,##0";
                ws2.Cell(row2, 6).Value = tx.KodeBilling ?? "-";
                ws2.Cell(row2, 7).Value = tx.Ntpn ?? "-";
                ws2.Cell(row2, 8).Value = tx.StatusPajak == StatusPajakFlow.LunasNtpn ? "LUNAS NTPN" : "BELUM LUNAS";
                row2++;
            }
        }
        ws2.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }
}
