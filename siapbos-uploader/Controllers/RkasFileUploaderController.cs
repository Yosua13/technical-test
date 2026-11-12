using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SiapBos.Shared.Data;
using SiapBos.Shared.DTOs;
using SiapBos.Shared.Entities;

namespace SiapBos.Uploader.Controllers;

[ApiController]
public class RkasFileUploaderController : ControllerBase
{
    private readonly SiapBosDbContext _db;

    public RkasFileUploaderController(SiapBosDbContext db) => _db = db;

    [HttpGet("/api/file-uploader/template-rkas")]
    [AllowAnonymous]
    public IActionResult DownloadTemplate()
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
            ws.Cell(1, i + 1).Value = headers[i];
            ws.Cell(1, i + 1).Style.Fill.BackgroundColor = XLColor.DarkOrange;
            ws.Cell(1, i + 1).Style.Font.FontColor = XLColor.White;
            ws.Cell(1, i + 1).Style.Font.Bold = true;
        }

        ws.Cell(2, 1).Value = 1;
        ws.Cell(2, 2).Value = 2026;
        ws.Cell(2, 3).Value = "BOS";
        ws.Cell(2, 4).Value = "01";
        ws.Cell(2, 5).Value = "05";
        ws.Cell(2, 6).Value = "Pengembangan Sarana dan Prasarana";
        ws.Cell(2, 7).Value = "05.05.01";
        ws.Cell(2, 8).Value = "Pengadaan Buku Perpustakaan";
        ws.Cell(2, 9).Value = "5.1.02.01.01.0024";
        ws.Cell(2, 10).Value = "Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor";
        ws.Cell(2, 11).Value = "KMP-IMP-001";
        ws.Cell(2, 12).Value = "Buku Referensi Olimpiade Sains";
        ws.Cell(2, 13).Value = "Cetakan Berwarna HVS";
        ws.Cell(2, 14).Value = "Eksemplar";
        ws.Cell(2, 15).Value = 50;
        ws.Cell(2, 16).Value = 120000;

        ws.Columns().AdjustToContents();
        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Template_Migrasi_RKAS_SIAPBOS.xlsx");
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
        var ws = wb.Worksheet(1);
        var rows = ws.RangeUsed()?.RowsUsed().Skip(1) ?? [];

        foreach (var row in rows)
        {
            var namaKomponen = row.Cell(12).GetString().Trim();
            if (string.IsNullOrWhiteSpace(namaKomponen)) continue;

            var vol = row.Cell(15).GetValue<decimal>();
            var harga = row.Cell(16).GetValue<decimal>();

            var item = new RkasItem
            {
                SekolahId = row.Cell(1).GetValue<int>(),
                TahunAnggaran = row.Cell(2).GetValue<int>(),
                SumberDana = row.Cell(3).GetString().Trim(),
                KodePeriode = row.Cell(4).GetString().Trim(),
                KodeSnp = row.Cell(5).GetString().Trim(),
                NamaSnp = row.Cell(6).GetString().Trim(),
                KodeKegiatan = row.Cell(7).GetString().Trim(),
                NamaKegiatan = row.Cell(8).GetString().Trim(),
                KodeAkun = row.Cell(9).GetString().Trim(),
                NamaAkun = row.Cell(10).GetString().Trim(),
                KodeKomponen = row.Cell(11).GetString().Trim(),
                NamaKomponen = namaKomponen,
                Spesifikasi = row.Cell(13).GetString().Trim(),
                Satuan = row.Cell(14).GetString().Trim(),
                Volume = vol,
                HargaSatuan = harga,
                TotalPagu = Math.Round(vol * harga, 2),
                TotalRealisasi = 0,
                IsSynced = true
            };
            imported.Add(item);
        }

        if (imported.Count == 0)
            return BadRequest(ApiResponse<object>.Fail("Tidak ada baris valid yang ditemukan di file Excel RKAS."));

        _db.RkasItems.AddRange(imported);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { importedCount = imported.Count, items = imported },
            $"Migrasi RKAS berhasil mengimpor {imported.Count} komponen anggaran."));
    }
}
