using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SiapBos.Shared.Entities;

[Table("tmrkasbljrinci", Schema = "siap")]
public class RkasItem
{
    [Key]
    public int Id { get; set; }

    public int SekolahId { get; set; }
    public Sekolah? Sekolah { get; set; }

    public int TahunAnggaran { get; set; }

    [Required, MaxLength(10)]
    public string SumberDana { get; set; } = "BOS"; // BOS, BOP

    [Required, MaxLength(20)]
    public string KodePeriode { get; set; } = "01";

    [MaxLength(30)]
    public string KodeSnp { get; set; } = string.Empty;

    [MaxLength(150)]
    public string NamaSnp { get; set; } = string.Empty;

    [MaxLength(40)]
    public string KodeKegiatan { get; set; } = string.Empty;

    [MaxLength(200)]
    public string NamaKegiatan { get; set; } = string.Empty;

    [MaxLength(40)]
    public string KodeAkun { get; set; } = string.Empty;

    [MaxLength(200)]
    public string NamaAkun { get; set; } = string.Empty;

    [MaxLength(50)]
    public string KodeKomponen { get; set; } = string.Empty;

    [MaxLength(200)]
    public string NamaKomponen { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Spesifikasi { get; set; } = string.Empty;

    [MaxLength(30)]
    public string Satuan { get; set; } = "Unit";

    [Column(TypeName = "numeric(18,2)")]
    public decimal Volume { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal HargaSatuan { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal TotalPagu { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal TotalRealisasi { get; set; }

    public bool IsSynced { get; set; } = true;
}

[Table("tm_migrasi_pask", Schema = "siap")]
public class MigrasiPask
{
    [Key]
    public int Id { get; set; }

    [Required, MaxLength(50)]
    public string BatchKode { get; set; } = string.Empty;

    public int SekolahId { get; set; }
    public Sekolah? Sekolah { get; set; }

    public int TahunAnggaran { get; set; }

    [Required, MaxLength(10)]
    public string SumberDana { get; set; } = "BOP";

    [Required, MaxLength(20)]
    public string KodePeriode { get; set; } = "TW1";

    [MaxLength(100)]
    public string NamaPeriode { get; set; } = string.Empty;

    [Required, MaxLength(60)]
    public string KodeSubgiat { get; set; } = string.Empty;

    [Required, MaxLength(250)]
    public string NamaSubgiat { get; set; } = string.Empty;

    [Required, MaxLength(300)]
    public string NamaPask { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Program { get; set; } = "PROGRAM PENGELOLAAN PENDIDIKAN";

    [MaxLength(80)]
    public string NomorDpaSkpd { get; set; } = "001/DPA/2026";

    [MaxLength(120)]
    public string SumberDanaLabel { get; set; } = string.Empty;

    [Column(TypeName = "numeric(18,2)")]
    public decimal TotalDana { get; set; }

    [MaxLength(120)]
    public string ImportedBy { get; set; } = "ADMIN-TDI";

    public DateTime ImportedAt { get; set; } = DateTime.UtcNow;

    [MaxLength(200)]
    public string FileName { get; set; } = string.Empty;

    public List<MigrasiPaskRinci> Rincians { get; set; } = new();
}

[Table("tm_migrasi_pask_rinci", Schema = "siap")]
public class MigrasiPaskRinci
{
    [Key]
    public int Id { get; set; }

    public int MigrasiPaskId { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public MigrasiPask? MigrasiPask { get; set; }

    [MaxLength(40)]
    public string KodeKegiatan { get; set; } = string.Empty;

    [Required, MaxLength(250)]
    public string NamaKegiatan { get; set; } = string.Empty;

    [Required, MaxLength(60)]
    public string KodeRekening { get; set; } = string.Empty;

    [Required, MaxLength(250)]
    public string NamaRekening { get; set; } = string.Empty;

    [Column(TypeName = "numeric(18,2)")]
    public decimal Anggaran { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal AkbPerPeriode { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal NilaiSebelum { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal NilaiNpd { get; set; }
}

[Table("tijo_dropping", Schema = "siap")]
public class DroppingDana
{
    [Key]
    public int Id { get; set; }

    public int SekolahId { get; set; }
    public Sekolah? Sekolah { get; set; }

    public int TahunAnggaran { get; set; }

    [Required, MaxLength(10)]
    public string SumberDana { get; set; } = "BOS";

    [Required, MaxLength(20)]
    public string KodePeriode { get; set; } = "TW1";

    [MaxLength(100)]
    public string NamaPeriode { get; set; } = string.Empty;

    [Required, MaxLength(80)]
    public string NomorSp2d { get; set; } = string.Empty;

    public DateTime TanggalDropping { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal NilaiDropping { get; set; }

    [MaxLength(300)]
    public string Keterangan { get; set; } = string.Empty;

    public int? MigrasiPaskId { get; set; }
    public MigrasiPask? MigrasiPask { get; set; }

    [MaxLength(200)]
    public string Program { get; set; } = string.Empty;

    [MaxLength(80)]
    public string NomorDpaSkpd { get; set; } = string.Empty;

    [MaxLength(60)]
    public string KodeSubgiat { get; set; } = string.Empty;

    [MaxLength(250)]
    public string NamaSubgiat { get; set; } = string.Empty;

    [MaxLength(300)]
    public string NamaPask { get; set; } = string.Empty;

    // 0: Draft PK, 1: Diajukan TU, 2: Disetujui TU -> PA, 3: Disetujui PA -> Dinas/Sudin, 4: Disetujui Dinas/Sudin (Cair), 9: Ditolak
    public int StatusDropping { get; set; } = 4;

    [MaxLength(300)]
    public string? Catatan { get; set; }

    [MaxLength(80)]
    public string? CreatedBy { get; set; }

    [MaxLength(80)]
    public string? TuApprovedBy { get; set; }
    public DateTime? TuApprovedAt { get; set; }

    [MaxLength(80)]
    public string? PaApprovedBy { get; set; }
    public DateTime? PaApprovedAt { get; set; }

    [MaxLength(80)]
    public string? DinasApprovedBy { get; set; }
    public DateTime? DinasApprovedAt { get; set; }

    public bool IsConfirmedToBku { get; set; }
    public DateTime? TanggalKonfirmasi { get; set; }
    public int? BkuTransactionId { get; set; }
}

[Table("trnpd_bop", Schema = "siap")]
public class NpdBop
{
    [Key]
    public int Id { get; set; }

    public int SekolahId { get; set; }
    public Sekolah? Sekolah { get; set; }

    public int TahunAnggaran { get; set; }

    [Required, MaxLength(20)]
    public string KodePeriode { get; set; } = "TW1";

    [Required, MaxLength(80)]
    public string NomorNpd { get; set; } = string.Empty;

    public DateTime TanggalNpd { get; set; }

    [Required, MaxLength(300)]
    public string Uraian { get; set; } = string.Empty;

    [Column(TypeName = "numeric(18,2)")]
    public decimal NilaiPengajuan { get; set; }

    // 0: Draft PK, 1: Diajukan TU, 2: Disetujui TU -> PA, 3: Disetujui PA -> Sudin, 4: Disetujui Sudin & Cair SIPKD, 9: Ditolak
    public int StatusNpd { get; set; }

    public int? MigrasiPaskId { get; set; }
    public MigrasiPask? MigrasiPask { get; set; }

    [MaxLength(200)]
    public string Program { get; set; } = string.Empty;

    [MaxLength(80)]
    public string NomorDpaSkpd { get; set; } = string.Empty;

    [MaxLength(60)]
    public string KodeSubgiat { get; set; } = string.Empty;

    [MaxLength(250)]
    public string NamaSubgiat { get; set; } = string.Empty;

    [MaxLength(300)]
    public string NamaPask { get; set; } = string.Empty;

    [MaxLength(120)]
    public string SumberDanaLabel { get; set; } = string.Empty;

    [MaxLength(80)]
    public string? CreatedBy { get; set; }
    public DateTime? SubmittedAt { get; set; }

    [MaxLength(80)]
    public string? TuApprovedBy { get; set; }
    public DateTime? TuApprovedAt { get; set; }

    [MaxLength(80)]
    public string? PaApprovedBy { get; set; }
    public DateTime? PaApprovedAt { get; set; }

    [MaxLength(80)]
    public string? SudinApprovedBy { get; set; }
    public DateTime? SudinApprovedAt { get; set; }

    [MaxLength(80)]
    public string? NomorSipkd { get; set; }

    public DateTime? TanggalKirimSipkd { get; set; }

    [MaxLength(300)]
    public string? Catatan { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
