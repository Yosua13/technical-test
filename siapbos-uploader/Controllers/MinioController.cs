using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using SiapBos.Shared.DTOs;

namespace SiapBos.Uploader.Controllers;

[ApiController]
public class MinioController : ControllerBase
{
    private readonly string _bucketPath;

    public MinioController(IWebHostEnvironment env)
    {
        _bucketPath = Path.Combine(env.ContentRootPath, "Storage", "minio-bucket");
        Directory.CreateDirectory(_bucketPath);
    }

    [HttpPost("/api/v1/minio/upload")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> Upload(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(ApiResponse<object>.Fail("File lampiran tidak boleh kosong."));

        var ext = Path.GetExtension(file.FileName);
        var safeName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid().ToString("N")[..8]}{ext}";
        var fullPath = Path.Combine(_bucketPath, safeName);

        await using (var stream = new FileStream(fullPath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        return Ok(ApiResponse<object>.Ok(new
        {
            originalName = file.FileName,
            storedName = safeName,
            previewUrl = $"/uploader/api/v1/minio/preview/{safeName}",
            downloadUrl = $"/uploader/api/v1/minio/download/{safeName}",
            sizeBytes = file.Length
        }, "File bukti lampiran berhasil diunggah ke Storage."));
    }

    [HttpGet("/api/v1/minio/preview/{fileName}")]
    [AllowAnonymous]
    public IActionResult Preview(string fileName)
    {
        var safeFileName = Path.GetFileName(fileName);
        var fullPath = Path.Combine(_bucketPath, safeFileName);

        if (!System.IO.File.Exists(fullPath) && safeFileName.StartsWith("sample-invoice-", StringComparison.OrdinalIgnoreCase))
        {
            var pdfBytes = GenerateSampleInvoicePdf(safeFileName);
            return File(pdfBytes, "application/pdf");
        }

        if (!System.IO.File.Exists(fullPath))
            return NotFound("File lampiran tidak ditemukan.");

        var contentType = GetContentType(safeFileName);
        return PhysicalFile(fullPath, contentType);
    }

    [HttpGet("/api/v1/minio/download/{fileName}")]
    [AllowAnonymous]
    public IActionResult Download(string fileName)
    {
        var safeFileName = Path.GetFileName(fileName);
        var fullPath = Path.Combine(_bucketPath, safeFileName);

        if (!System.IO.File.Exists(fullPath) && safeFileName.StartsWith("sample-invoice-", StringComparison.OrdinalIgnoreCase))
        {
            var pdfBytes = GenerateSampleInvoicePdf(safeFileName);
            return File(pdfBytes, "application/pdf", safeFileName);
        }

        if (!System.IO.File.Exists(fullPath))
            return NotFound("File lampiran tidak ditemukan.");

        return PhysicalFile(fullPath, GetContentType(safeFileName), safeFileName);
    }

    private static string GetContentType(string fileName) => Path.GetExtension(fileName).ToLowerInvariant() switch
    {
        ".pdf" => "application/pdf",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        _ => "application/octet-stream"
    };

    private static byte[] GenerateSampleInvoicePdf(string fileName)
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(36);
                page.Content().Column(col =>
                {
                    col.Item().Text("DOKUMEN BUKTI INVOICE / BAST REKANAN (CONTOH LAMPIRAN)").FontSize(14).Bold().FontColor(Colors.Orange.Darken3);
                    col.Item().PaddingTop(6).Text($"Nama File Object Storage : {fileName}").FontSize(10);
                    col.Item().Text($"Tanggal Unggah Dokumen    : {DateTime.Now:dd MMMM yyyy}").FontSize(10);
                    col.Item().PaddingTop(14).Border(1).Padding(14).Column(box =>
                    {
                        box.Item().Text("Dokumen ini merupakan contoh berkas PDF Invoice / Berita Acara Serah Terima (BAST) yang tersimpan pada Object Storage siapbos-uploader.").FontSize(11);
                        box.Item().PaddingTop(8).Text("Pada transaksi nyata, file yang diunggah oleh Bendahara (PK) akan diverifikasi oleh Kasubag TU dan Kepala Sekolah (PA) sebelum permohonan Token CMS Bank DKI disetujui.").FontSize(10);
                    });
                });
            });
        }).GeneratePdf();
    }
}
