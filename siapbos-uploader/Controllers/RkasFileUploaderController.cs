using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SiapBos.Shared.Data;
using SiapBos.Shared.DTOs;
using SiapBos.Shared.Entities;
using SiapBos.Uploader.Services;

namespace SiapBos.Uploader.Controllers;

[ApiController]
public class RkasFileUploaderController : ControllerBase
{
    private readonly SiapBosDbContext _db;
    private readonly IWebHostEnvironment _env;

    public RkasFileUploaderController(SiapBosDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    [HttpGet("/api/file-uploader/template-rkas")]
    [AllowAnonymous]
    public IActionResult DownloadTemplate()
    {
        var bytes = BuildTemplateWorkbookBytes();
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Template_Migrasi_RKAS_SIAPBOS.xlsx");
    }

    public static byte[] BuildTemplateWorkbookBytes()
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Template RKAS");
        string[] headers =
        [
            "SekolahId", "TahunAnggaran", "SumberDana", "KodePeriode",
            "KodeSnp", "NamaSnp", "KodeKegiatan", "NamaKegiatan",
            "KodeAkun", "NamaAkun", "KodeKomponen", "NamaKomponen",
            "Spesifikasi", "Satuan", "Volume", "HargaSatuan"
        ];
        for (int i = 0; i < headers.Length; i++)
        {
            var cell = ws.Cell(1, i + 1);
            cell.Value = headers[i];
            cell.Style.Fill.BackgroundColor = XLColor.DarkOrange;
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Font.Bold = true;
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        }
        ws.SheetView.FreezeRows(1);

        object[][] sampleRows =
        [
            [1, 2026, "BOS", "01", "05", "Pengembangan Sarana dan Prasarana Sekolah", "05.05.01", "Pengadaan Buku Perpustakaan", "5.1.02.01.01.0024", "Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor", "KMP-BOS-001", "Buku Referensi Olimpiade & Literasi", "Cetakan Berwarna HVS 80gr", "Eksemplar", 50m, 120000m],
            [1, 2026, "BOS", "02", "03", "Pengembangan Standar Proses", "03.03.12", "Penyelenggaraan Ekstrakurikuler & Lomba Siswa", "5.1.02.01.01.0052", "Belanja Makanan dan Minuman Rapat/Kegiatan", "KMP-BOS-002", "Paket Konsumsi Pelatihan Olimpiade", "Nasi Box + Air Mineral", "Box", 120m, 45000m],
            [1, 2026, "BOP", "TW1", "04", "Pengembangan Pendidik dan Tenaga Kependidikan", "04.06.01", "Peningkatan Kompetensi Guru & Kurikulum Merdeka", "5.1.02.02.01.0003", "Honorarium Narasumber / Tenaga Ahli Kegiatan Sekolah", "KMP-BOP-001", "Honorarium Narasumber Workshop Kurikulum", "Tarif Narasumber Provinsi DKI Jakarta", "OJ", 16m, 900000m],
            [1, 2026, "BOP", "TW2", "06", "Pengembangan Standar Pengelolaan", "06.07.01", "Pembayaran Langganan Daya dan Jasa", "5.1.02.02.01.0061", "Belanja Tagihan Listrik (PLN)", "KMP-BOP-002", "Tagihan Listrik Bulanan Gedung Sekolah", "Daya 105 kVA Virtual Account PLN", "Bulan", 3m, 6500000m],
            [2, 2026, "BOS", "01", "05", "Pengembangan Sarana dan Prasarana Sekolah", "05.08.01", "Pemeliharaan Sarana dan Prasarana Ruang Kelas", "5.1.02.03.02.0121", "Belanja Pemeliharaan Alat Pendingin (AC)", "KMP-SMP-001", "Jasa Servis & Cuci AC Laboratorium", "AC Split 2 PK", "Unit", 15m, 350000m],
            [3, 2026, "BOP", "TW1", "05", "Pengembangan Sarana dan Prasarana Sekolah", "05.02.03", "Pengadaan Peralatan TIK Kelas", "5.2.02.10.01.0002", "Belanja Modal Peralatan Personal Komputer / Laptop", "KMP-SDN-001", "Laptop Penunjang Asesmen Sekolah", "Core i5 / 16GB / 512GB SSD", "Unit", 2m, 11500000m]
        ];

        for (int r = 0; r < sampleRows.Length; r++)
        {
            var rowIdx = r + 2;
            var rowData = sampleRows[r];
            for (int c = 0; c < rowData.Length; c++)
            {
                var cell = ws.Cell(rowIdx, c + 1);
                var val = rowData[c];
                switch (val)
                {
                    case int iv:
                        cell.Value = iv;
                        break;
                    case decimal dv:
                        cell.Value = dv;
                        cell.Style.NumberFormat.Format = "#,##0";
                        break;
                    default:
                        cell.Value = val?.ToString() ?? string.Empty;
                        break;
                }
                if (r % 2 == 1)
                {
                    cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#FFF7ED");
                }
            }
        }

        ws.Columns().AdjustToContents();

        // Sheet 2: Petunjuk Pengisian & Kode Referensi
        var guide = wb.Worksheets.Add("Petunjuk Pengisian");
        string[] guideHeaders = ["Kolom", "Keterangan & Aturan Pengisian", "Contoh Nilai Valid"];
        for (int i = 0; i < guideHeaders.Length; i++)
        {
            var c = guide.Cell(1, i + 1);
            c.Value = guideHeaders[i];
            c.Style.Fill.BackgroundColor = XLColor.SlateGray;
            c.Style.Font.FontColor = XLColor.White;
            c.Style.Font.Bold = true;
        }

        string[][] guideRows =
        [
            ["SekolahId", "ID Sekolah di database SIAP (1 = SMAN 1 JAKARTA, 2 = SMPN 115 JAKARTA, 3 = SDN MENTENG 01 PAGI)", "1"],
            ["TahunAnggaran", "Tahun anggaran 4 digit angka", "2026"],
            ["SumberDana", "Maksimal 10 karakter. Isi BOS atau BOP", "BOS / BOP"],
            ["KodePeriode", "Maksimal 20 karakter. BOSP pakai 01 atau 02; BOP pakai TW1, TW2, TW3, atau TW4", "01 / TW1"],
            ["KodeSnp & NamaSnp", "Kode (maks 30) & Nama Standar Nasional Pendidikan (maks 150)", "05 | Pengembangan Sarana dan Prasarana Sekolah"],
            ["KodeKegiatan & NamaKegiatan", "Kode (maks 40) & Nama Kegiatan (maks 200)", "05.05.01 | Pengadaan Buku Perpustakaan"],
            ["KodeAkun & NamaAkun", "Kode BAS (maks 40) & Nama Rekening BAS (maks 200): 5.1.02.01.01.0024, .0052, 5.1.02.02.01.0003, .0061, 5.1.02.03.02.0121, 5.2.02.10.01.0002", "5.1.02.01.01.0024"],
            ["KodeKomponen & NamaKomponen", "Kode Komponen (maks 50) & Nama Barang/Jasa (maks 200, wajib diisi)", "KMP-BOS-001 | Buku Referensi"],
            ["Spesifikasi & Satuan", "Spesifikasi barang/jasa (maks 200) & Satuan (maks 30)", "HVS 80gr | Eksemplar"],
            ["Volume & HargaSatuan", "Angka numerik positif (TotalPagu otomatis dihitung Volume x HargaSatuan)", "50 | 120000"],
            ["Catatan Penting", "JANGAN ubah urutan 16 kolom atau nama sheet Template RKAS. Jangan gunakan file Template PASK Dropping/NPD di menu Migrasi RKAS.", "-"]
        ];
        for (int r = 0; r < guideRows.Length; r++)
        {
            for (int c = 0; c < guideRows[r].Length; c++)
            {
                guide.Cell(r + 2, c + 1).Value = guideRows[r][c];
            }
        }
        guide.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    [HttpPost("/api/file-uploader/upload-rkas")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> UploadRkasExcel(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(ApiResponse<object>.Fail("File Excel RKAS wajib dipilih."));

        var imported = new List<RkasItem>();
        await using var stream = file.OpenReadStream();
        using var wb = new XLWorkbook(stream);
        var ws = wb.Worksheets.FirstOrDefault(w => w.Name.Contains("RKAS", StringComparison.OrdinalIgnoreCase))
                 ?? wb.Worksheet(1);

        var usedRows = ws.RangeUsed()?.RowsUsed().ToList() ?? [];
        if (usedRows.Count < 2)
            return BadRequest(ApiResponse<object>.Fail("File Excel RKAS kosong atau hanya berisi header."));

        var headerTexts = Enumerable.Range(1, Math.Min(20, ws.LastColumnUsed()?.ColumnNumber() ?? 16))
            .Select(c => usedRows[0].Cell(c).GetString().Trim())
            .ToList();

        if (headerTexts.Any(h => h.Equals("NamaPask", StringComparison.OrdinalIgnoreCase) ||
                                 h.Equals("NilaiNpd", StringComparison.OrdinalIgnoreCase) ||
                                 h.Equals("KodeSubgiat", StringComparison.OrdinalIgnoreCase)))
        {
            return BadRequest(ApiResponse<object>.Fail(
                "File yang diunggah adalah Template Migrasi Dropping Dana & NPD (PASK), bukan Template RKAS. Silakan unggah di menu Administrator -> Dropping Dana BOS & BOP, atau gunakan Template Excel RKAS."));
        }

        foreach (var row in usedRows.Skip(1))
        {
            var namaKomponen = Truncate(row.Cell(12).GetString().Trim(), 200);
            if (string.IsNullOrWhiteSpace(namaKomponen)) continue;

            if (!int.TryParse(row.Cell(1).GetString().Trim(), out var sekolahId) &&
                !row.Cell(1).TryGetValue(out sekolahId))
                continue;

            if (!int.TryParse(row.Cell(2).GetString().Trim(), out var tahun) &&
                !row.Cell(2).TryGetValue(out tahun))
                tahun = 2026;

            var vol = ReadDecimal(row.Cell(15));
            var harga = ReadDecimal(row.Cell(16));

            var item = new RkasItem
            {
                SekolahId = sekolahId > 0 ? sekolahId : 1,
                TahunAnggaran = tahun > 0 ? tahun : 2026,
                SumberDana = Truncate(row.Cell(3).GetString().Trim(), 10, "BOS"),
                KodePeriode = Truncate(row.Cell(4).GetString().Trim(), 20, "01"),
                KodeSnp = Truncate(row.Cell(5).GetString().Trim(), 30),
                NamaSnp = Truncate(row.Cell(6).GetString().Trim(), 150),
                KodeKegiatan = Truncate(row.Cell(7).GetString().Trim(), 40),
                NamaKegiatan = Truncate(row.Cell(8).GetString().Trim(), 200),
                KodeAkun = Truncate(row.Cell(9).GetString().Trim(), 40),
                NamaAkun = Truncate(row.Cell(10).GetString().Trim(), 200),
                KodeKomponen = Truncate(row.Cell(11).GetString().Trim(), 50),
                NamaKomponen = namaKomponen,
                Spesifikasi = Truncate(row.Cell(13).GetString().Trim(), 200),
                Satuan = Truncate(row.Cell(14).GetString().Trim(), 30, "Unit"),
                Volume = vol,
                HargaSatuan = harga,
                TotalPagu = Math.Round(vol * harga, 2),
                TotalRealisasi = 0,
                IsSynced = true
            };
            imported.Add(item);
        }

        if (imported.Count == 0)
            return BadRequest(ApiResponse<object>.Fail("Tidak ada baris valid yang ditemukan di file Excel RKAS. Pastikan format mengikuti Template Excel RKAS."));

        var (storedName, _) = await ProjectUploadStorage.SaveFileAsync(_env, file, "rkas");

        _db.RkasItems.AddRange(imported);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { importedCount = imported.Count, storedName, folderPath = "uploads", items = imported },
            $"Migrasi RKAS berhasil mengimpor {imported.Count} komponen anggaran."));
    }

    private static string Truncate(string? value, int maxLength, string fallback = "")
    {
        var v = (value ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(v)) return fallback;
        return v.Length <= maxLength ? v : v[..maxLength];
    }

    private static decimal ReadDecimal(IXLCell cell)
    {
        if (cell.TryGetValue<decimal>(out var d)) return d;
        var s = cell.GetString().Trim().Replace(",", ".");
        return decimal.TryParse(s, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : 0m;
    }
}
