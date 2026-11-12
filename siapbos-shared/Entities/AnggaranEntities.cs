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
    public string KodePeriode { get; set; } = "01";

    [MaxLength(100)]
    public string NamaPeriode { get; set; } = string.Empty;

    [Required, MaxLength(80)]
    public string NomorSp2d { get; set; } = string.Empty;

    public DateTime TanggalDropping { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal NilaiDropping { get; set; }

    [MaxLength(250)]
    public string Keterangan { get; set; } = string.Empty;

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
    public string KodePeriode { get; set; } = "01";

    [Required, MaxLength(80)]
    public string NomorNpd { get; set; } = string.Empty;

    public DateTime TanggalNpd { get; set; }

    [Required, MaxLength(300)]
    public string Uraian { get; set; } = string.Empty;

    [Column(TypeName = "numeric(18,2)")]
    public decimal NilaiPengajuan { get; set; }

    // 0: Draft, 1: Diajukan PK, 2: Disetujui PA, 3: Disetujui Sudin, 4: Terkirim SIPKD, 9: Ditolak
    public int StatusNpd { get; set; }

    [MaxLength(80)]
    public string? NomorSipkd { get; set; }

    public DateTime? TanggalKirimSipkd { get; set; }

    [MaxLength(300)]
    public string? Catatan { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
