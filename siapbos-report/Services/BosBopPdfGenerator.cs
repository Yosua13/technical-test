using System.Globalization;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using SiapBos.Shared.Constants;
using SiapBos.Shared.Data;
using SiapBos.Shared.Entities;

namespace SiapBos.Report.Services;

public class BosBopPdfGenerator
{
    private readonly SiapBosDbContext _db;
    private static readonly CultureInfo IdCulture = new("id-ID");

    public BosBopPdfGenerator(SiapBosDbContext db) => _db = db;

    private static string Rp(decimal val) => val == 0 ? "-" : $"Rp {val:N0}";

    private static IContainer HeaderCellStyle(IContainer c) =>
        c.Background(Colors.Orange.Darken2).Border(0.5f).BorderColor(Colors.Grey.Darken1).Padding(4);

    private static IContainer BodyCellStyle(IContainer c, bool alternate = false) =>
        c.Background(alternate ? Colors.Grey.Lighten4 : Colors.White)
         .Border(0.5f).BorderColor(Colors.Grey.Medium).Padding(4);

    private static void ComposeKopAndSchool(ColumnDescriptor col, string reportTitle, string subtitle, Sekolah sekolah, string sumberDana, int tahun, string periode)
    {
        col.Item().BorderBottom(2).BorderColor(Colors.Black).PaddingBottom(6).Column(hdr =>
        {
            hdr.Item().AlignCenter().Text("PEMERINTAH PROVINSI DAERAH KHUSUS IBUKOTA JAKARTA").FontSize(11).Bold();
            hdr.Item().AlignCenter().Text("DINAS PENDIDIKAN — SISTEM INFORMASI AKUNTABILITAS PENDIDIKAN (SIAP BOSP & BOP)").FontSize(9).SemiBold();
            hdr.Item().AlignCenter().PaddingTop(4).Text(reportTitle).FontSize(13).Bold().FontColor(Colors.Orange.Darken3);
            hdr.Item().AlignCenter().Text(subtitle).FontSize(9).Italic();
        });

        col.Item().PaddingTop(8).PaddingBottom(8).Row(row =>
        {
            row.RelativeItem().Column(left =>
            {
                left.Item().Text($"Satuan Pendidikan : {sekolah.NamaSekolah} (NPSN: {sekolah.Npsn})").FontSize(9).Bold();
                left.Item().Text($"Suku Dinas Wilayah : {sekolah.NamaSudin}").FontSize(8);
                left.Item().Text($"Alamat Sekolah      : {sekolah.Alamat}").FontSize(8);
            });
            row.ConstantItem(220).Column(right =>
            {
                right.Item().Text($"Sumber Dana    : {sumberDana}").FontSize(9).Bold();
                right.Item().Text($"Tahun Anggaran : {tahun}").FontSize(8);
                right.Item().Text($"Periode        : {periode}").FontSize(8);
                right.Item().Text($"No. Rekening   : {(sumberDana == "BOS" ? sekolah.NoRekBos : sekolah.NoRekBop)} (Bank DKI)").FontSize(8);
            });
        });
    }

    private static void ComposeSignatures(ColumnDescriptor col, Sekolah sekolah, string tanggalText)
    {
        col.Item().PaddingTop(18).Row(row =>
        {
            row.RelativeItem().AlignCenter().Column(pa =>
            {
                pa.Item().Text("Mengetahui / Menyetujui,").FontSize(9);
                pa.Item().Text("Kepala Sekolah / Pengguna Anggaran (PA)").FontSize(9).Bold();
                pa.Item().PaddingTop(36).Text(sekolah.NamaKepalaSekolah).FontSize(9).Bold().Underline();
                pa.Item().Text($"NIP. {sekolah.NipKepalaSekolah} / NRK. {sekolah.NrkKepalaSekolah}").FontSize(8);
            });

            row.RelativeItem().AlignCenter().Column(pk =>
            {
                pk.Item().Text($"Jakarta, {tanggalText}").FontSize(9);
                pk.Item().Text("Bendahara / Pemegang Kas (PK)").FontSize(9).Bold();
                pk.Item().PaddingTop(36).Text(sekolah.NamaBendahara).FontSize(9).Bold().Underline();
                pk.Item().Text($"NIP. {sekolah.NipBendahara} / NRK. {sekolah.NrkBendahara}").FontSize(8);
            });
        });
    }

    public async Task<byte[]> GenerateForm22Or23PdfAsync(int sekolahId, int tahun, string sumberDana, string? kodePeriode, bool bankOnly)
    {
        var sekolah = await _db.Sekolahs.FindAsync(sekolahId) ?? throw new KeyNotFoundException("Sekolah tidak ditemukan.");
        var query = _db.BkuTransactions
            .Where(b => b.SekolahId == sekolahId && b.TahunAnggaran == tahun && b.SumberDana == sumberDana && b.StatusBku != StatusBkuFlow.Ditolak);

        if (!string.IsNullOrWhiteSpace(kodePeriode))
            query = query.Where(b => b.KodePeriode == kodePeriode);

        if (bankOnly)
            query = query.Where(b => b.StatusBku == StatusBkuFlow.LunasTransfer || b.KodeTrx == KodeTrxBku.Dropping || b.KodeTrx == KodeTrxBku.JasaGiro);

        var items = await query.OrderBy(b => b.TanggalTransaksi).ThenBy(b => b.Id).ToListAsync();

        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(24);
                page.DefaultTextStyle(x => x.FontSize(8.5f));

                page.Content().Column(col =>
                {
                    var title = bankOnly
                        ? $"FORMULIR 23 — BUKU PEMBANTU BANK ({sumberDana})"
                        : $"FORMULIR 22 — BUKU KAS UMUM SEKOLAH ({sumberDana})";
                    ComposeKopAndSchool(col, title, "Laporan Resmi Penatausahaan Keuangan Satuan Pendidikan", sekolah, sumberDana, tahun, kodePeriode ?? "Semua Periode");

                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(cols =>
                        {
                            cols.ConstantColumn(28);
                            cols.ConstantColumn(65);
                            cols.ConstantColumn(95);
                            cols.ConstantColumn(32);
                            cols.RelativeColumn(3);
                            cols.ConstantColumn(95);
                            cols.ConstantColumn(95);
                            cols.ConstantColumn(100);
                        });

                        table.Header(h =>
                        {
                            h.Cell().Element(HeaderCellStyle).Text("No").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).Text("Tanggal").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).Text("No. BKU").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).Text("Trx").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).Text("Uraian Transaksi & Rekanan").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).AlignRight().Text("Penerimaan (Debet)").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).AlignRight().Text("Pengeluaran (Kredit)").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).AlignRight().Text("Saldo Berjalan").Bold().FontColor(Colors.White);
                        });

                        decimal saldo = 0;
                        decimal totMasuk = 0;
                        decimal totKeluar = 0;
                        int no = 1;

                        foreach (var item in items)
                        {
                            var alt = no % 2 == 0;
                            saldo += item.NilaiBrutoMasuk - item.NilaiBrutoKeluar;
                            totMasuk += item.NilaiBrutoMasuk;
                            totKeluar += item.NilaiBrutoKeluar;

                            table.Cell().Element(c => BodyCellStyle(c, alt)).AlignCenter().Text(no.ToString());
                            table.Cell().Element(c => BodyCellStyle(c, alt)).Text(item.TanggalTransaksi.ToString("dd/MM/yyyy"));
                            table.Cell().Element(c => BodyCellStyle(c, alt)).Text(item.NomorBku);
                            table.Cell().Element(c => BodyCellStyle(c, alt)).AlignCenter().Text(item.KodeTrx);
                            table.Cell().Element(c => BodyCellStyle(c, alt)).Text($"{item.Uraian}\nRekanan: {item.NamaRekanan} | Status: {StatusBkuFlow.GetLabel(item.StatusBku)}");
                            table.Cell().Element(c => BodyCellStyle(c, alt)).AlignRight().Text(Rp(item.NilaiBrutoMasuk));
                            table.Cell().Element(c => BodyCellStyle(c, alt)).AlignRight().Text(Rp(item.NilaiBrutoKeluar));
                            table.Cell().Element(c => BodyCellStyle(c, alt)).AlignRight().Text(Rp(saldo)).Bold();
                            no++;
                        }

                        table.Cell().ColumnSpan(5).Element(c => c.Background(Colors.Orange.Lighten5).Border(0.5f).Padding(5)).AlignRight().Text("JUMLAH TOTAL MUTASI PERIODE INI").Bold();
                        table.Cell().Element(c => c.Background(Colors.Orange.Lighten5).Border(0.5f).Padding(5)).AlignRight().Text(Rp(totMasuk)).Bold();
                        table.Cell().Element(c => c.Background(Colors.Orange.Lighten5).Border(0.5f).Padding(5)).AlignRight().Text(Rp(totKeluar)).Bold();
                        table.Cell().Element(c => c.Background(Colors.Orange.Lighten5).Border(0.5f).Padding(5)).AlignRight().Text(Rp(saldo)).Bold();
                    });

                    ComposeSignatures(col, sekolah, DateTime.Now.ToString("dd MMMM yyyy", IdCulture));
                });
            });
        });

        return doc.GeneratePdf();
    }

    public async Task<byte[]> GenerateForm25TaxPdfAsync(int sekolahId, int tahun, string sumberDana, string? kodeTrxPajak)
    {
        var sekolah = await _db.Sekolahs.FindAsync(sekolahId) ?? throw new KeyNotFoundException("Sekolah tidak ditemukan.");
        var query = _db.BkuTaxItems
            .Include(t => t.BkuTransaction)
            .Where(t => t.BkuTransaction!.SekolahId == sekolahId &&
                        t.BkuTransaction.TahunAnggaran == tahun &&
                        t.BkuTransaction.SumberDana == sumberDana &&
                        t.BkuTransaction.StatusBku != StatusBkuFlow.Ditolak);

        if (!string.IsNullOrWhiteSpace(kodeTrxPajak))
            query = query.Where(t => t.KodeTrxPajak == kodeTrxPajak);

        var items = await query.OrderBy(t => t.BkuTransaction!.TanggalTransaksi).ToListAsync();

        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(24);
                page.DefaultTextStyle(x => x.FontSize(8.5f));

                page.Content().Column(col =>
                {
                    ComposeKopAndSchool(col, $"FORMULIR 25 — BUKU PEMBANTU PAJAK ({sumberDana})", $"Filter Jenis Pajak: {(string.IsNullOrWhiteSpace(kodeTrxPajak) ? "Semua Pajak (P1-P5)" : kodeTrxPajak)}", sekolah, sumberDana, tahun, "Tahun Berjalan");

                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(cols =>
                        {
                            cols.ConstantColumn(25);
                            cols.ConstantColumn(65);
                            cols.ConstantColumn(90);
                            cols.ConstantColumn(35);
                            cols.RelativeColumn(2);
                            cols.ConstantColumn(85);
                            cols.ConstantColumn(85);
                            cols.ConstantColumn(95);
                            cols.ConstantColumn(95);
                        });

                        table.Header(h =>
                        {
                            h.Cell().Element(HeaderCellStyle).Text("No").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).Text("Tanggal").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).Text("No. BKU").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).Text("Kode").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).Text("Jenis Pajak & Uraian").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).AlignRight().Text("Pungut (Masuk)").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).AlignRight().Text("Setor (Lunas)").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).Text("Kode Billing").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).Text("NTPN").Bold().FontColor(Colors.White);
                        });

                        decimal totPungut = 0, totSetor = 0;
                        int no = 1;
                        foreach (var tx in items)
                        {
                            var alt = no % 2 == 0;
                            var setor = tx.StatusPajak == StatusPajakFlow.LunasNtpn ? tx.NilaiPajak : 0m;
                            totPungut += tx.NilaiPajak;
                            totSetor += setor;

                            table.Cell().Element(c => BodyCellStyle(c, alt)).AlignCenter().Text(no.ToString());
                            table.Cell().Element(c => BodyCellStyle(c, alt)).Text(tx.BkuTransaction!.TanggalTransaksi.ToString("dd/MM/yyyy"));
                            table.Cell().Element(c => BodyCellStyle(c, alt)).Text(tx.BkuTransaction.NomorBku);
                            table.Cell().Element(c => BodyCellStyle(c, alt)).AlignCenter().Text(tx.KodeTrxPajak);
                            table.Cell().Element(c => BodyCellStyle(c, alt)).Text($"{tx.NamaPajak}\nMAP: {tx.KodeMap}-{tx.KodeJenisSetoran} | {tx.BkuTransaction.Uraian}");
                            table.Cell().Element(c => BodyCellStyle(c, alt)).AlignRight().Text(Rp(tx.NilaiPajak));
                            table.Cell().Element(c => BodyCellStyle(c, alt)).AlignRight().Text(Rp(setor));
                            table.Cell().Element(c => BodyCellStyle(c, alt)).Text(tx.KodeBilling ?? "-");
                            table.Cell().Element(c => BodyCellStyle(c, alt)).Text(tx.Ntpn ?? "BELUM LUNAS");
                            no++;
                        }

                        table.Cell().ColumnSpan(5).Element(c => c.Background(Colors.Orange.Lighten5).Border(0.5f).Padding(5)).AlignRight().Text("TOTAL PEMUNGUTAN & PENYETORAN PAJAK").Bold();
                        table.Cell().Element(c => c.Background(Colors.Orange.Lighten5).Border(0.5f).Padding(5)).AlignRight().Text(Rp(totPungut)).Bold();
                        table.Cell().Element(c => c.Background(Colors.Orange.Lighten5).Border(0.5f).Padding(5)).AlignRight().Text(Rp(totSetor)).Bold();
                        table.Cell().ColumnSpan(2).Element(c => c.Background(Colors.Orange.Lighten5).Border(0.5f).Padding(5)).Text($"Sisa Belum Disetor: {Rp(totPungut - totSetor)}").Bold();
                    });

                    ComposeSignatures(col, sekolah, DateTime.Now.ToString("dd MMMM yyyy", IdCulture));
                });
            });
        });

        return doc.GeneratePdf();
    }

    public async Task<byte[]> GenerateKartuKendaliPdfAsync(int sekolahId, int tahun, string sumberDana, bool formatK1K7 = false)
    {
        var sekolah = await _db.Sekolahs.FindAsync(sekolahId) ?? throw new KeyNotFoundException("Sekolah tidak ditemukan.");
        var rkas = await _db.RkasItems
            .Where(r => r.SekolahId == sekolahId && r.TahunAnggaran == tahun && r.SumberDana == sumberDana)
            .OrderBy(r => r.KodeSnp).ThenBy(r => r.KodeKegiatan)
            .ToListAsync();

        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(24);
                page.DefaultTextStyle(x => x.FontSize(8.5f));

                page.Content().Column(col =>
                {
                    var title = formatK1K7
                        ? $"FORMULIR 19 & FORMAT K1-K7 (1B/1E) REALISASI ANGGARAN ({sumberDana})"
                        : $"KARTU KENDALI KEGIATAN & KOMPONEN RKAS ({sumberDana})";
                    ComposeKopAndSchool(col, title, "Pemantauan Pagu Anggaran vs Realisasi Belanja per Kegiatan & Kode Akun BAS", sekolah, sumberDana, tahun, "TA " + tahun);

                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(cols =>
                        {
                            cols.ConstantColumn(25);
                            cols.ConstantColumn(65);
                            cols.RelativeColumn(2);
                            cols.RelativeColumn(2);
                            cols.ConstantColumn(95);
                            cols.ConstantColumn(95);
                            cols.ConstantColumn(95);
                            cols.ConstantColumn(50);
                        });

                        table.Header(h =>
                        {
                            h.Cell().Element(HeaderCellStyle).Text("No").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).Text("Kode Akun").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).Text("SNP & Nama Kegiatan").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).Text("Komponen & Spesifikasi").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).AlignRight().Text("Pagu Anggaran").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).AlignRight().Text("Realisasi SPJ").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).AlignRight().Text("Sisa Pagu").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).AlignRight().Text("%").Bold().FontColor(Colors.White);
                        });

                        decimal totPagu = 0, totReal = 0;
                        int no = 1;
                        foreach (var r in rkas)
                        {
                            var alt = no % 2 == 0;
                            var sisa = r.TotalPagu - r.TotalRealisasi;
                            var pct = r.TotalPagu > 0 ? Math.Round(r.TotalRealisasi / r.TotalPagu * 100, 1) : 0;
                            totPagu += r.TotalPagu;
                            totReal += r.TotalRealisasi;

                            table.Cell().Element(c => BodyCellStyle(c, alt)).AlignCenter().Text(no.ToString());
                            table.Cell().Element(c => BodyCellStyle(c, alt)).Text(r.KodeAkun);
                            table.Cell().Element(c => BodyCellStyle(c, alt)).Text($"[{r.KodeSnp}] {r.NamaSnp}\n{r.KodeKegiatan} - {r.NamaKegiatan}");
                            table.Cell().Element(c => BodyCellStyle(c, alt)).Text($"{r.NamaKomponen}\n({r.Volume} {r.Satuan} x {Rp(r.HargaSatuan)})");
                            table.Cell().Element(c => BodyCellStyle(c, alt)).AlignRight().Text(Rp(r.TotalPagu));
                            table.Cell().Element(c => BodyCellStyle(c, alt)).AlignRight().Text(Rp(r.TotalRealisasi));
                            table.Cell().Element(c => BodyCellStyle(c, alt)).AlignRight().Text(Rp(sisa));
                            table.Cell().Element(c => BodyCellStyle(c, alt)).AlignRight().Text($"{pct}%");
                            no++;
                        }

                        var totPct = totPagu > 0 ? Math.Round(totReal / totPagu * 100, 1) : 0;
                        table.Cell().ColumnSpan(4).Element(c => c.Background(Colors.Orange.Lighten5).Border(0.5f).Padding(5)).AlignRight().Text("TOTAL ANGGARAN & SERAPAN").Bold();
                        table.Cell().Element(c => c.Background(Colors.Orange.Lighten5).Border(0.5f).Padding(5)).AlignRight().Text(Rp(totPagu)).Bold();
                        table.Cell().Element(c => c.Background(Colors.Orange.Lighten5).Border(0.5f).Padding(5)).AlignRight().Text(Rp(totReal)).Bold();
                        table.Cell().Element(c => c.Background(Colors.Orange.Lighten5).Border(0.5f).Padding(5)).AlignRight().Text(Rp(totPagu - totReal)).Bold();
                        table.Cell().Element(c => c.Background(Colors.Orange.Lighten5).Border(0.5f).Padding(5)).AlignRight().Text($"{totPct}%").Bold();
                    });

                    ComposeSignatures(col, sekolah, DateTime.Now.ToString("dd MMMM yyyy", IdCulture));
                });
            });
        });

        return doc.GeneratePdf();
    }

    public async Task<byte[]> GenerateSpjIndividualPdfAsync(int bkuId)
    {
        var bku = await _db.BkuTransactions
            .Include(b => b.Sekolah)
            .Include(b => b.DetailItems)
            .Include(b => b.TaxItems)
            .FirstOrDefaultAsync(b => b.Id == bkuId)
            ?? throw new KeyNotFoundException("Transaksi BKU tidak ditemukan.");

        var sekolah = bku.Sekolah!;
        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(28);
                page.DefaultTextStyle(x => x.FontSize(9));

                page.Content().Column(col =>
                {
                    ComposeKopAndSchool(col, $"SURAT PERTANGGUNGJAWABAN (SPJ) — BUKTI PENGELUARAN KAS", $"Nomor BKU: {bku.NomorBku} | No. Bukti: {bku.NomorBukti}", sekolah, bku.SumberDana, bku.TahunAnggaran, bku.KodePeriode);

                    col.Item().Border(0.5f).Padding(8).Column(box =>
                    {
                        box.Item().Text($"Tanggal Transaksi : {bku.TanggalTransaksi:dd MMMM yyyy}").Bold();
                        box.Item().Text($"Uraian Belanja    : {bku.Uraian}");
                        box.Item().Text($"Nama Rekanan      : {bku.NamaRekanan} | NPWP: {bku.NpwpRekanan}");
                        box.Item().Text($"Rekening Penerima : {bku.NamaBankRekanan} - {bku.NoRekRekanan} ({bku.NamaPemilikRekRekanan})");
                        box.Item().Text($"Status Pembayaran : {StatusBkuFlow.GetLabel(bku.StatusBku)} | Jurnal Bank DKI: {bku.NoJurnalBank ?? "-"}");
                    });

                    col.Item().PaddingTop(10).Text("Rincian Komponen Belanja:").Bold();
                    col.Item().PaddingTop(4).Table(table =>
                    {
                        table.ColumnsDefinition(cols =>
                        {
                            cols.ConstantColumn(25);
                            cols.RelativeColumn(2);
                            cols.ConstantColumn(60);
                            cols.ConstantColumn(80);
                            cols.ConstantColumn(90);
                        });
                        table.Header(h =>
                        {
                            h.Cell().Element(HeaderCellStyle).Text("No").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).Text("Komponen & Akun Belanja").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).AlignRight().Text("Vol").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).AlignRight().Text("Harga Satuan").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).AlignRight().Text("Jumlah").Bold().FontColor(Colors.White);
                        });

                        int idx = 1;
                        foreach (var d in bku.DetailItems)
                        {
                            table.Cell().Element(c => BodyCellStyle(c)).AlignCenter().Text(idx++.ToString());
                            table.Cell().Element(c => BodyCellStyle(c)).Text($"{d.NamaKomponen}\n[{d.KodeAkun}] {d.Spesifikasi}");
                            table.Cell().Element(c => BodyCellStyle(c)).AlignRight().Text($"{d.Volume} {d.Satuan}");
                            table.Cell().Element(c => BodyCellStyle(c)).AlignRight().Text(Rp(d.HargaSatuan));
                            table.Cell().Element(c => BodyCellStyle(c)).AlignRight().Text(Rp(d.Jumlah));
                        }
                    });

                    col.Item().PaddingTop(10).Border(0.5f).Background(Colors.Grey.Lighten4).Padding(8).Column(tot =>
                    {
                        tot.Item().Row(r => { r.RelativeItem().Text("Total Bruto Belanja").Bold(); r.ConstantItem(140).AlignRight().Text(Rp(bku.NilaiBrutoKeluar)).Bold(); });
                        tot.Item().Row(r => { r.RelativeItem().Text("Total Potongan Pajak (PPh / PPN)"); r.ConstantItem(140).AlignRight().Text(Rp(bku.TotalPotonganPajak)); });
                        tot.Item().Row(r => { r.RelativeItem().Text("Nilai Netto Ditransfer ke Rekanan").Bold().FontSize(10); r.ConstantItem(140).AlignRight().Text(Rp(bku.NilaiNettoTransfer)).Bold().FontSize(10); });
                    });

                    ComposeSignatures(col, sekolah, bku.TanggalTransaksi.ToString("dd MMMM yyyy", IdCulture));
                });
            });
        });

        return doc.GeneratePdf();
    }

    public async Task<byte[]> GenerateBpnPajakPdfAsync(int taxId)
    {
        var tax = await _db.BkuTaxItems
            .Include(t => t.BkuTransaction)
            .ThenInclude(b => b!.Sekolah)
            .FirstOrDefaultAsync(t => t.Id == taxId)
            ?? throw new KeyNotFoundException("Data pajak tidak ditemukan.");

        var sekolah = tax.BkuTransaction!.Sekolah!;
        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(32);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Content().Column(col =>
                {
                    col.Item().BorderBottom(2).BorderColor(Colors.Black).PaddingBottom(8).Column(h =>
                    {
                        h.Item().AlignCenter().Text("KEMENTERIAN KEUANGAN REPUBLIK INDONESIA").FontSize(12).Bold();
                        h.Item().AlignCenter().Text("BUKTI PENERIMAAN NEGARA (BPN) — MODUL PENERIMAAN NEGARA G3").FontSize(11).Bold().FontColor(Colors.Orange.Darken3);
                        h.Item().AlignCenter().Text("Diterbitkan melalui Sistem Pembayaran Pajak CMS Bank DKI - SIAP BOS").FontSize(8.5f).Italic();
                    });

                    col.Item().PaddingTop(14).Border(1).Padding(12).Column(body =>
                    {
                        void RowLine(string label, string val, bool bold = false)
                        {
                            body.Item().PaddingVertical(3).Row(r =>
                            {
                                r.ConstantItem(190).Text(label);
                                r.ConstantItem(15).Text(":");
                                var t = r.RelativeItem().Text(val);
                                if (bold) t.Bold();
                            });
                        }

                        RowLine("Status Transaksi", tax.StatusPajak == StatusPajakFlow.LunasNtpn ? "TRANSAKSI BERHASIL / LUNAS" : "BELUM LUNAS", true);
                        RowLine("NTPN (Nomor Transaksi Penerimaan Negara)", tax.Ntpn ?? "-", true);
                        RowLine("NTB (Nomor Transaksi Bank DKI)", tax.Ntb ?? "-", true);
                        RowLine("Kode Billing DJP", tax.KodeBilling ?? "-", true);
                        RowLine("Tanggal Buku Lunas", tax.TanggalLunasPajak?.ToString("dd MMMM yyyy HH:mm:ss 'WIB'") ?? "-");
                        RowLine("Nama Wajib Pajak / Penyetor", sekolah.NamaSekolah);
                        RowLine("NPWP Sekolah", sekolah.NpwpSekolah);
                        RowLine("Kode Akun Pajak (MAP)", $"{tax.KodeMap} — {tax.NamaPajak}");
                        RowLine("Kode Jenis Setoran (KJS)", tax.KodeJenisSetoran);
                        RowLine("Masa & Tahun Pajak", $"Masa {tax.MasaPajak} / Tahun {tax.TahunPajak}");
                        RowLine("Nomor Referensi BKU", tax.BkuTransaction.NomorBku);
                        RowLine("Jumlah Setoran Pajak", Rp(tax.NilaiPajak), true);
                    });

                    col.Item().PaddingTop(14).Text("Catatan: Dokumen ini adalah bukti penerimaan negara yang sah sesuai ketentuan MPN Generasi 3.").FontSize(8.5f).Italic();
                });
            });
        });

        return doc.GeneratePdf();
    }

    public async Task<byte[]> GenerateStsPdfAsync(int stsId)
    {
        var sts = await _db.SetoranStses.Include(s => s.Sekolah).FirstOrDefaultAsync(s => s.Id == stsId)
            ?? throw new KeyNotFoundException("Data STS tidak ditemukan.");

        var sekolah = sts.Sekolah!;
        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(30);
                page.DefaultTextStyle(x => x.FontSize(9.5f));

                page.Content().Column(col =>
                {
                    ComposeKopAndSchool(col, $"SURAT TANDA SETORAN (STS) — {sts.SumberDana}", $"Nomor STS: {sts.NomorSts}", sekolah, sts.SumberDana, sts.TahunAnggaran, sts.KodePeriode);

                    col.Item().Border(1).Padding(12).Column(b =>
                    {
                        b.Item().Text($"Tanggal Setoran : {sts.TanggalSts:dd MMMM yyyy}");
                        b.Item().Text($"Jenis Setoran   : {sts.JenisSetoran}");
                        b.Item().Text($"Rekening Tujuan : {sts.RekeningTujuan}").Bold();
                        b.Item().Text($"Uraian Setoran  : {sts.Uraian}");
                        b.Item().PaddingTop(8).Text($"Nilai Setoran   : {Rp(sts.NilaiSetor)}").FontSize(12).Bold().FontColor(Colors.Orange.Darken3);
                    });

                    ComposeSignatures(col, sekolah, sts.TanggalSts.ToString("dd MMMM yyyy", IdCulture));
                });
            });
        });

        return doc.GeneratePdf();
    }

    public async Task<byte[]> GenerateMutasiPdfAsync(int sekolahId, string sumberDana)
    {
        var sekolah = await _db.Sekolahs.FindAsync(sekolahId) ?? throw new KeyNotFoundException("Sekolah tidak ditemukan.");
        var mutasi = await _db.BankMutations
            .Where(m => m.SekolahId == sekolahId && m.SumberDana == sumberDana)
            .OrderByDescending(m => m.TanggalTransaksi).ThenByDescending(m => m.Id)
            .ToListAsync();

        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(24);
                page.DefaultTextStyle(x => x.FontSize(8.5f));

                page.Content().Column(col =>
                {
                    ComposeKopAndSchool(col, $"CETAKAN MUTASI REKENING KORAN BANK DKI ({sumberDana})", "Rekening Koran Resmi CMS Bank DKI", sekolah, sumberDana, DateTime.Now.Year, "Semua Transaksi");

                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(cols =>
                        {
                            cols.ConstantColumn(25);
                            cols.ConstantColumn(75);
                            cols.ConstantColumn(110);
                            cols.RelativeColumn(3);
                            cols.ConstantColumn(35);
                            cols.ConstantColumn(95);
                            cols.ConstantColumn(100);
                        });
                        table.Header(h =>
                        {
                            h.Cell().Element(HeaderCellStyle).Text("No").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).Text("Tanggal").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).Text("No. Jurnal / Ref").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).Text("Keterangan Mutasi").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).AlignCenter().Text("D/K").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).AlignRight().Text("Nominal").Bold().FontColor(Colors.White);
                            h.Cell().Element(HeaderCellStyle).AlignRight().Text("Saldo Akhir").Bold().FontColor(Colors.White);
                        });

                        int idx = 1;
                        foreach (var m in mutasi)
                        {
                            var alt = idx % 2 == 0;
                            table.Cell().Element(c => BodyCellStyle(c, alt)).AlignCenter().Text(idx++.ToString());
                            table.Cell().Element(c => BodyCellStyle(c, alt)).Text(m.TanggalTransaksi.ToString("dd/MM/yyyy HH:mm"));
                            table.Cell().Element(c => BodyCellStyle(c, alt)).Text(m.NomorReferensi);
                            table.Cell().Element(c => BodyCellStyle(c, alt)).Text(m.Uraian);
                            table.Cell().Element(c => BodyCellStyle(c, alt)).AlignCenter().Text(m.TipeMutasi).Bold();
                            table.Cell().Element(c => BodyCellStyle(c, alt)).AlignRight().Text(Rp(m.Nominal));
                            table.Cell().Element(c => BodyCellStyle(c, alt)).AlignRight().Text(Rp(m.SaldoAkhir)).Bold();
                        }
                    });
                });
            });
        });

        return doc.GeneratePdf();
    }
}
