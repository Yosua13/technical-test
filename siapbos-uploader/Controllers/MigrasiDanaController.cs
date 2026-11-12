using System.Globalization;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SiapBos.Shared.Constants;
using SiapBos.Shared.Data;
using SiapBos.Shared.DTOs;
using SiapBos.Shared.Entities;
using SiapBos.Uploader.Services;

namespace SiapBos.Uploader.Controllers;

[ApiController]
public class MigrasiDanaController : ControllerBase
{
    private readonly SiapBosDbContext _db;
    private readonly IWebHostEnvironment _env;

    public MigrasiDanaController(SiapBosDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    private bool IsAdminMigrator =>
        User.IsInRole(SiapBosRoles.AdminTdi) ||
        User.IsInRole(SiapBosRoles.AdminDinas) ||
        string.Equals(User.FindFirst("roleCode")?.Value, SiapBosRoles.AdminTdi, StringComparison.OrdinalIgnoreCase) ||
        string.Equals(User.FindFirst("roleCode")?.Value, SiapBosRoles.AdminDinas, StringComparison.OrdinalIgnoreCase);

    private string CurrentUsername => User.FindFirst("username")?.Value ?? User.Identity?.Name ?? "ADMIN-TDI";

    [HttpGet("/api/file-uploader/template-migrasi-dana")]
    [AllowAnonymous]
    public IActionResult DownloadTemplate()
    {
        var bytes = BuildSampleWorkbookBytes();
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Template_Migrasi_NPD_Dropping_SIAPBOS.xlsx");
    }

    [HttpPost("/api/file-uploader/upload-migrasi-dana")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> UploadMigrasiDana(IFormFile file)
    {
        if (!IsAdminMigrator)
            return StatusCode(403, ApiResponse<object>.Fail("Hanya ADMIN-TDI atau ADMIN-DINAS yang berwenang melakukan migrasi data Dropping Dana & NPD."));

        if (file == null || file.Length == 0)
            return BadRequest(ApiResponse<object>.Fail("File Excel migrasi tidak valid atau kosong."));

        using var stream = file.OpenReadStream();
        using var wb = new XLWorkbook(stream);
        var ws = wb.Worksheets.FirstOrDefault(w => w.Name.Contains("Migrasi", StringComparison.OrdinalIgnoreCase))
                 ?? wb.Worksheets.First();

        var sekolahList = await _db.Sekolahs.AsNoTracking().ToListAsync();
        var sekolahByNpsn = sekolahList.ToDictionary(s => s.Npsn.Trim(), StringComparer.OrdinalIgnoreCase);
        var sekolahById = sekolahList.ToDictionary(s => s.Id);

        var rows = ws.RowsUsed().Skip(1).ToList();
        if (rows.Count == 0)
            return BadRequest(ApiResponse<object>.Fail("Sheet Excel tidak memiliki baris data (minimal 1 baris setelah header)."));

        var batchKode = $"MIG-{DateTime.UtcNow:yyyyMMddHHmmss}";
        var errors = new List<string>();
        var grouped = new Dictionary<string, MigrasiPask>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in rows)
        {
            var npsnOrId = row.Cell(1).GetString().Trim();
            if (string.IsNullOrWhiteSpace(npsnOrId)) continue;

            Sekolah? sekolah = null;
            if (!sekolahByNpsn.TryGetValue(npsnOrId, out sekolah) && int.TryParse(npsnOrId, out var sid))
                sekolahById.TryGetValue(sid, out sekolah);

            if (sekolah == null)
            {
                errors.Add($"Baris {row.RowNumber()}: Sekolah/NPSN '{npsnOrId}' tidak ditemukan.");
                continue;
            }

            if (!int.TryParse(row.Cell(2).GetString().Trim(), out var tahun) || tahun < 2020 || tahun > 2100)
                tahun = row.Cell(2).TryGetValue(out double dTahun) ? (int)dTahun : 2026;

            var sumberDana = row.Cell(3).GetString().Trim().ToUpperInvariant();
            if (sumberDana is not (SumberDanaTypes.Bos or SumberDanaTypes.Bop))
            {
                errors.Add($"Baris {row.RowNumber()}: SumberDana '{sumberDana}' harus BOS atau BOP.");
                continue;
            }

            var kodePeriode = NormalizeTriwulan(row.Cell(4).GetString());
            if (kodePeriode == null)
            {
                errors.Add($"Baris {row.RowNumber()}: KodePeriode '{row.Cell(4).GetString()}' harus TW1, TW2, TW3, atau TW4.");
                continue;
            }

            var namaPeriode = row.Cell(5).GetString().Trim();
            if (string.IsNullOrWhiteSpace(namaPeriode))
                namaPeriode = kodePeriode switch { "TW1" => "Triwulan ke-01", "TW2" => "Triwulan ke-02", "TW3" => "Triwulan ke-03", _ => "Triwulan ke-04" };

            var kodeSubgiat = row.Cell(6).GetString().Trim();
            var namaSubgiat = row.Cell(7).GetString().Trim();
            var namaPask = row.Cell(8).GetString().Trim();
            var program = row.Cell(9).GetString().Trim();
            var nomorDpa = row.Cell(10).GetString().Trim();
            var kodeKeg = row.Cell(11).GetString().Trim();
            var namaKeg = row.Cell(12).GetString().Trim();
            var kodeRek = row.Cell(13).GetString().Trim();
            var namaRek = row.Cell(14).GetString().Trim();

            var anggaran = ParseDecimal(row.Cell(15));
            var akb = ParseDecimal(row.Cell(16));
            var sblm = ParseDecimal(row.Cell(17));
            var nilaiNpd = ParseDecimal(row.Cell(18));

            if (string.IsNullOrWhiteSpace(namaPask) || string.IsNullOrWhiteSpace(kodeSubgiat))
            {
                errors.Add($"Baris {row.RowNumber()}: KodeSubgiat dan NamaPASK wajib diisi.");
                continue;
            }
            if (nilaiNpd <= 0)
            {
                errors.Add($"Baris {row.RowNumber()}: NilaiDanaNpd harus lebih dari 0.");
                continue;
            }

            var key = $"{sekolah.Id}|{tahun}|{sumberDana}|{kodePeriode}|{kodeSubgiat}|{namaPask}";
            if (!grouped.TryGetValue(key, out var header))
            {
                header = new MigrasiPask
                {
                    BatchKode = batchKode,
                    SekolahId = sekolah.Id,
                    TahunAnggaran = tahun,
                    SumberDana = sumberDana,
                    KodePeriode = kodePeriode,
                    NamaPeriode = namaPeriode,
                    KodeSubgiat = kodeSubgiat,
                    NamaSubgiat = string.IsNullOrWhiteSpace(namaSubgiat) ? kodeSubgiat : namaSubgiat,
                    NamaPask = namaPask,
                    Program = string.IsNullOrWhiteSpace(program) ? "PROGRAM PENGELOLAAN PENDIDIKAN" : program,
                    NomorDpaSkpd = string.IsNullOrWhiteSpace(nomorDpa) ? $"001/DPA/{tahun}" : nomorDpa,
                    SumberDanaLabel = sumberDana == SumberDanaTypes.Bos ? "BOSP-REGULER" : $"BOP-{sekolah.Jenjang}N ALOKASI DASAR",
                    ImportedBy = CurrentUsername,
                    ImportedAt = DateTime.UtcNow,
                    FileName = file.FileName
                };
                grouped[key] = header;
            }

            header.Rincians.Add(new MigrasiPaskRinci
            {
                KodeKegiatan = kodeKeg,
                NamaKegiatan = string.IsNullOrWhiteSpace(namaKeg) ? $"{kodeKeg}. Belanja Operasional" : namaKeg,
                KodeRekening = kodeRek,
                NamaRekening = string.IsNullOrWhiteSpace(namaRek) ? kodeRek : namaRek,
                Anggaran = anggaran,
                AkbPerPeriode = akb,
                NilaiSebelum = sblm,
                NilaiNpd = nilaiNpd
            });
            header.TotalDana += nilaiNpd;
        }

        if (errors.Count > 0 && grouped.Count == 0)
            return BadRequest(ApiResponse<object>.Fail(string.Join(" | ", errors.Take(5))));

        int inserted = 0, replaced = 0, skippedLocked = 0;
        var savedHeaders = new List<MigrasiPask>();

        foreach (var candidate in grouped.Values)
        {
            var existing = await _db.MigrasiPasks
                .Include(m => m.Rincians)
                .FirstOrDefaultAsync(m =>
                    m.SekolahId == candidate.SekolahId &&
                    m.TahunAnggaran == candidate.TahunAnggaran &&
                    m.SumberDana == candidate.SumberDana &&
                    m.KodePeriode == candidate.KodePeriode &&
                    m.KodeSubgiat == candidate.KodeSubgiat &&
                    m.NamaPask == candidate.NamaPask);

            if (existing != null)
            {
                var usedByDropping = await _db.DroppingDanas.AnyAsync(d => d.MigrasiPaskId == existing.Id && d.StatusDropping != StatusDanaFlow.Ditolak);
                var usedByNpd = await _db.NpdBops.AnyAsync(n => n.MigrasiPaskId == existing.Id && n.StatusNpd != StatusDanaFlow.Ditolak);
                if (usedByDropping || usedByNpd)
                {
                    skippedLocked++;
                    continue;
                }

                _db.MigrasiPaskRincis.RemoveRange(existing.Rincians);
                existing.BatchKode = candidate.BatchKode;
                existing.NamaPeriode = candidate.NamaPeriode;
                existing.NamaSubgiat = candidate.NamaSubgiat;
                existing.Program = candidate.Program;
                existing.NomorDpaSkpd = candidate.NomorDpaSkpd;
                existing.SumberDanaLabel = candidate.SumberDanaLabel;
                existing.TotalDana = candidate.TotalDana;
                existing.ImportedBy = candidate.ImportedBy;
                existing.ImportedAt = candidate.ImportedAt;
                existing.FileName = candidate.FileName;
                existing.Rincians = candidate.Rincians;
                replaced++;
                savedHeaders.Add(existing);
            }
            else
            {
                _db.MigrasiPasks.Add(candidate);
                inserted++;
                savedHeaders.Add(candidate);
            }
        }

        var (storedName, _) = await ProjectUploadStorage.SaveFileAsync(_env, file, "migrasi");

        await _db.SaveChangesAsync();

        var totalRinci = savedHeaders.Sum(h => h.Rincians.Count);
        var msg = $"Migrasi Excel berhasil: {inserted} PASK baru, {replaced} PASK diperbarui ({totalRinci} rincian kegiatan/rekening)."
                  + (skippedLocked > 0 ? $" {skippedLocked} PASK dilewati karena sudah dipakai pengajuan aktif." : "");

        return Ok(ApiResponse<object>.Ok(new
        {
            batchKode,
            storedName,
            folderPath = "uploads",
            inserted,
            replaced,
            skippedLocked,
            totalRinci,
            warnings = errors.Take(10).ToList(),
            items = savedHeaders.Select(h => new
            {
                h.Id,
                h.SekolahId,
                h.TahunAnggaran,
                h.SumberDana,
                h.KodePeriode,
                h.KodeSubgiat,
                h.NamaPask,
                h.TotalDana,
                rincianCount = h.Rincians.Count
            })
        }, msg));
    }

    public static byte[] BuildSampleWorkbookBytes()
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Migrasi_Dana_PASK");

        string[] headers =
        [
            "NPSN", "TahunAnggaran", "SumberDana", "KodePeriode", "NamaPeriode",
            "KodeSubgiat", "NamaSubgiat", "NamaPASK", "Program", "NomorDpaSkpd",
            "KodeKegiatan", "NamaKegiatan", "KodeRekening", "NamaRekening",
            "Anggaran", "AkbPerPeriode", "NilaiSebelum", "NilaiDanaNpd"
        ];

        for (int i = 0; i < headers.Length; i++)
        {
            var cell = ws.Cell(1, i + 1);
            cell.Value = headers[i];
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#EA580C");
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Font.Bold = true;
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        }

        object[][] sampleRows =
        [
            // SMAN 1 Jakarta (20100101) - BOP Triwulan III & IV (NPD BOP)
            ["20100101", 2026, "BOP", "TW3", "Triwulan ke-03", "1.01.02.2.01.0047", "Penyediaan Biaya Operasional Pendidikan SMA Negeri", "Penyediaan Biaya Operasional Pendidikan SMA Negeri (BOP-SMAN) Alokasi Dasar TW 3", "PROGRAM PENGELOLAAN PENDIDIKAN", "001/DPA/2026", "06.05", "06.05. Pelaksanaan administrasi kegiatan sekolah", "5.1.02.01.01.0012", "Belanja Bahan-Bahan Lainnya", 350000000m, 95000000m, 95000000m, 95000000m],
            ["20100101", 2026, "BOP", "TW3", "Triwulan ke-03", "1.01.02.2.01.0047", "Penyediaan Biaya Operasional Pendidikan SMA Negeri", "Penyediaan Biaya Operasional Pendidikan SMA Negeri (BOP-SMAN) Alokasi Dasar TW 3", "PROGRAM PENGELOLAAN PENDIDIKAN", "001/DPA/2026", "06.07", "06.07. Pembiayaan langganan daya dan jasa", "5.1.02.02.01.0061", "Belanja Tagihan Listrik, Air, dan Internet", 320000000m, 80000000m, 80000000m, 80000000m],
            ["20100101", 2026, "BOP", "TW4", "Triwulan ke-04", "1.01.02.2.01.0047", "Penyediaan Biaya Operasional Pendidikan SMA Negeri", "Penyediaan Biaya Operasional Pendidikan SMA Negeri (BOP-SMAN) Alokasi Dasar TW 4", "PROGRAM PENGELOLAAN PENDIDIKAN", "001/DPA/2026", "06.05", "06.05. Pelaksanaan administrasi kegiatan sekolah", "5.2.02.05.02.0004", "Belanja Modal Alat Pendingin", 120000000m, 45000000m, 30000000m, 45000000m],
            ["20100101", 2026, "BOP", "TW4", "Triwulan ke-04", "1.01.02.2.01.0047", "Penyediaan Biaya Operasional Pendidikan SMA Negeri", "Penyediaan Biaya Operasional Pendidikan SMA Negeri (BOP-SMAN) Alokasi Dasar TW 4", "PROGRAM PENGELOLAAN PENDIDIKAN", "001/DPA/2026", "06.07", "06.07. Pembiayaan langganan daya dan jasa", "5.1.02.01.01.0012", "Belanja Bahan-Bahan Lainnya", 240000000m, 65000000m, 40000000m, 65000000m],
            // SMAN 1 Jakarta (20100101) - BOS Triwulan III & IV (Dropping Dana BOSP)
            ["20100101", 2026, "BOS", "TW3", "Triwulan ke-03", "1.01.02.2.01.0016", "Pengelolaan Pendidikan Sekolah Menengah Atas", "Dana Bantuan Operasional Satuan Pendidikan (BOSP) SMAN 1 Jakarta TW 3", "PROGRAM PENGELOLAAN PENDIDIKAN", "001/DPA/2026", "05.08", "05.08. Pemeliharaan Sarana dan Prasarana Sekolah", "5.1.02.03.02.0117", "Belanja Pemeliharaan Alat Pendingin & Ruang Kelas", 350000000m, 125000000m, 125000000m, 125000000m],
            ["20100101", 2026, "BOS", "TW3", "Triwulan ke-03", "1.01.02.2.01.0016", "Pengelolaan Pendidikan Sekolah Menengah Atas", "Dana Bantuan Operasional Satuan Pendidikan (BOSP) SMAN 1 Jakarta TW 3", "PROGRAM PENGELOLAAN PENDIDIKAN", "001/DPA/2026", "06.07", "06.07. Pembiayaan langganan daya dan jasa", "5.1.02.02.01.0061", "Belanja Tagihan Listrik, Air, dan Internet", 350000000m, 125000000m, 125000000m, 125000000m],
            ["20100101", 2026, "BOS", "TW4", "Triwulan ke-04", "1.01.02.2.01.0016", "Pengelolaan Pendidikan Sekolah Menengah Atas", "Dana Bantuan Operasional Satuan Pendidikan (BOSP) SMAN 1 Jakarta TW 4", "PROGRAM PENGELOLAAN PENDIDIKAN", "001/DPA/2026", "02.02", "02.02. Pengembangan Perpustakaan dan Pojok Baca", "5.1.02.01.01.0024", "Belanja Alat Tulis Kantor & Bahan Pustaka", 180000000m, 60000000m, 35000000m, 60000000m],
            ["20100101", 2026, "BOS", "TW4", "Triwulan ke-04", "1.01.02.2.01.0016", "Pengelolaan Pendidikan Sekolah Menengah Atas", "Dana Bantuan Operasional Satuan Pendidikan (BOSP) SMAN 1 Jakarta TW 4", "PROGRAM PENGELOLAAN PENDIDIKAN", "001/DPA/2026", "05.08", "05.08. Pemeliharaan Sarana dan Prasarana Sekolah", "5.1.02.03.02.0117", "Belanja Pemeliharaan Ruang Belajar", 250000000m, 90000000m, 55000000m, 90000000m],
            // SMPN 115 Jakarta (20100202) - BOP & BOS Triwulan III + Triwulan IV
            ["20100202", 2026, "BOP", "TW3", "Triwulan ke-03", "1.01.02.2.01.0046", "Penyediaan Biaya Operasional Pendidikan SMP Negeri", "Penyediaan BOP SMP Negeri (BOP-SMPN) Alokasi Dasar TW 3", "PROGRAM PENGELOLAAN PENDIDIKAN", "002/DPA/2026", "06.05", "06.05. Administrasi Kegiatan Sekolah", "5.1.02.01.01.0012", "Belanja Bahan Operasional Sekolah", 160000000m, 80000000m, 40000000m, 80000000m],
            ["20100202", 2026, "BOS", "TW3", "Triwulan ke-03", "1.01.02.2.01.0014", "Pengelolaan Pendidikan Sekolah Menengah Pertama", "Dana BOSP SMPN 115 Jakarta TW 3", "PROGRAM PENGELOLAAN PENDIDIKAN", "002/DPA/2026", "03.03", "03.03. Pembelajaran & Ekstrakurikuler", "5.1.02.01.01.0052", "Belanja Bahan Pembelajaran Siswa", 190000000m, 95000000m, 45000000m, 95000000m],
            ["20100202", 2026, "BOP", "TW4", "Triwulan ke-04", "1.01.02.2.01.0046", "Penyediaan Biaya Operasional Pendidikan SMP Negeri", "Penyediaan BOP SMP Negeri (BOP-SMPN) Alokasi Dasar TW 4", "PROGRAM PENGELOLAAN PENDIDIKAN", "002/DPA/2026", "06.07", "06.07. Pembiayaan Langganan Daya & Jasa", "5.1.02.02.01.0061", "Belanja Tagihan Listrik, Air & Internet", 150000000m, 75000000m, 35000000m, 75000000m],
            ["20100202", 2026, "BOS", "TW4", "Triwulan ke-04", "1.01.02.2.01.0014", "Pengelolaan Pendidikan Sekolah Menengah Pertama", "Dana BOSP SMPN 115 Jakarta TW 4", "PROGRAM PENGELOLAAN PENDIDIKAN", "002/DPA/2026", "02.02", "02.02. Pengembangan Perpustakaan & Literasi", "5.1.02.01.01.0024", "Belanja Alat Tulis Kantor & Bahan Pustaka", 170000000m, 85000000m, 40000000m, 85000000m],
            // SDN Menteng 01 Pagi (20100303) - BOP & BOS Triwulan II
            ["20100303", 2026, "BOP", "TW2", "Triwulan ke-02", "1.01.02.2.01.0045", "Penyediaan Biaya Operasional Pendidikan SD Negeri", "Penyediaan BOP SD Negeri (BOP-SDN) Alokasi Dasar TW 2", "PROGRAM PENGELOLAAN PENDIDIKAN", "003/DPA/2026", "06.07", "06.07. Pembiayaan Langganan Daya & Jasa", "5.1.02.02.01.0061", "Belanja Tagihan Listrik, Air & Internet", 140000000m, 70000000m, 30000000m, 70000000m],
            ["20100303", 2026, "BOS", "TW2", "Triwulan ke-02", "1.01.02.2.01.0012", "Pengelolaan Pendidikan Sekolah Dasar", "Dana BOSP SDN Menteng 01 Pagi TW 2", "PROGRAM PENGELOLAAN PENDIDIKAN", "003/DPA/2026", "02.02", "02.02. Pengembangan Perpustakaan", "5.1.02.01.01.0024", "Belanja Bahan Pustaka & ATK", 150000000m, 75000000m, 35000000m, 75000000m]
        ];

        for (int r = 0; r < sampleRows.Length; r++)
        {
            for (int c = 0; c < sampleRows[r].Length; c++)
            {
                var cell = ws.Cell(r + 2, c + 1);
                var val = sampleRows[r][c];
                if (val is int iv) cell.Value = iv;
                else if (val is decimal dv)
                {
                    cell.Value = dv;
                    cell.Style.NumberFormat.Format = "#,##0";
                }
                else cell.Value = val.ToString() ?? string.Empty;
            }
        }
        ws.Columns().AdjustToContents();

        var guide = wb.Worksheets.Add("Petunjuk");
        guide.Cell(1, 1).Value = "PETUNJUK MIGRASI EXCEL DROPPING DANA & PERMOHONAN NPD (SIAP BOSP & BOP)";
        guide.Cell(1, 1).Style.Font.Bold = true;
        guide.Cell(3, 1).Value = "1. Isi sheet 'Migrasi_Dana_PASK' oleh akun ADMIN-TDI atau ADMIN-DINAS melalui menu Administrator -> Migrasi Data.";
        guide.Cell(4, 1).Value = "2. Beberapa baris dengan kombinasi (NPSN, TahunAnggaran, SumberDana, KodePeriode, KodeSubgiat, NamaPASK) yang sama akan otomatis digabung menjadi 1 PASK beserta tabel Rincian PASK-nya.";
        guide.Cell(5, 1).Value = "3. Kolom SumberDana wajib diisi BOS (untuk Dropping Dana BOSP) atau BOP (untuk Permohonan NPD BOP).";
        guide.Cell(6, 1).Value = "4. Kolom KodePeriode wajib diisi TW1, TW2, TW3, atau TW4. Pengajuan PK hanya diperbolehkan 1 kali per periode triwulan.";
        guide.Cell(7, 1).Value = "5. Nilai Anggaran, AkbPerPeriode, NilaiSebelum, dan NilaiDanaNpd bersifat read-only bagi sekolah (PK tidak dapat mengubah nominal hasil migrasi ADM).";
        guide.Cell(8, 1).Value = "6. Daftar NPSN Sekolah Default: 20100101 (SMAN 1 JAKARTA), 20100202 (SMPN 115 JAKARTA), 20100303 (SDN MENTENG 01 PAGI).";
        guide.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    private static string? NormalizeTriwulan(string raw)
    {
        var s = raw.Trim().ToUpperInvariant();
        return s switch
        {
            "TW1" or "TW01" or "01" or "1" or "TRIWULAN 1" => "TW1",
            "TW2" or "TW02" or "02" or "2" or "TRIWULAN 2" => "TW2",
            "TW3" or "TW03" or "03" or "3" or "TRIWULAN 3" => "TW3",
            "TW4" or "TW04" or "04" or "4" or "TRIWULAN 4" => "TW4",
            _ => null
        };
    }

    private static decimal ParseDecimal(IXLCell cell)
    {
        if (cell.TryGetValue(out double d)) return Convert.ToDecimal(d);
        var s = cell.GetString().Replace("Rp", "", StringComparison.OrdinalIgnoreCase).Replace(".", "").Replace(",", ".").Trim();
        return decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var res) ? res : 0m;
    }
}
