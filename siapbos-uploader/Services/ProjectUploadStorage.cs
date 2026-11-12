using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;

namespace SiapBos.Uploader.Services;

/// <summary>
/// Pengelola penyimpanan terpusat ke satu folder "uploads" pada root project (tanpa MinIO).
/// </summary>
public static class ProjectUploadStorage
{
    public static string GetUploadFolder(IWebHostEnvironment env)
    {
        var dir = new DirectoryInfo(env.ContentRootPath);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "SiapBos.Microservices.slnx")))
        {
            dir = dir.Parent;
        }

        var rootPath = dir?.FullName ?? Directory.GetParent(env.ContentRootPath)?.FullName ?? env.ContentRootPath;
        var uploadFolder = Path.Combine(rootPath, "uploads");
        Directory.CreateDirectory(uploadFolder);
        return uploadFolder;
    }

    public static async Task<(string SafeName, string FullPath)> SaveFileAsync(
        IWebHostEnvironment env,
        IFormFile file,
        string? prefix = null)
    {
        var uploadFolder = GetUploadFolder(env);
        var ext = Path.GetExtension(file.FileName);
        var safePrefix = string.IsNullOrWhiteSpace(prefix) ? string.Empty : $"{prefix.Trim()}_";
        var safeName = $"{safePrefix}{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid().ToString("N")[..8]}{ext}";
        var fullPath = Path.Combine(uploadFolder, safeName);

        await using var stream = new FileStream(fullPath, FileMode.Create);
        await file.CopyToAsync(stream);

        return (safeName, fullPath);
    }
}
