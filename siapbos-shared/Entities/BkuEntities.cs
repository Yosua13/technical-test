using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SiapBos.Shared.Entities;

[Table("tmbkubos_bop", Schema = "siap")]
public class BkuTransaction
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

    public int Bulan { get; set; } = 1;

    [Required, MaxLength(60)]
    public string NomorBku { get; set; } = string.Empty;

    [MaxLength(80)]
    public string NomorBukti { get; set; } = string.Empty;

    public DateTime TanggalTransaksi { get; set; }

    public int? ParentBkuId { get; set; }

    [MaxLength(60)]
    public string? ParentNomorBku { get; set; }

    [Required, MaxLength(10)]
    public string KodeTrx { get; set; } = "JJ"; // JO, JJ, P1-P7

    [MaxLength(30)]
    public string JenisPembayaran { get; set; } = "TRANSFER"; // TRANSFER/LURING, VA/DARING_VA/VA_PLN/E_ORDER, PENERIMAAN, PENGELUARAN, NON_TRANSFER

    [MaxLength(30)]
    public string CaraPembayaran { get; set; } = "BANK"; // BANK | VA

    public bool IsVirtualAccount { get; set; }

    [MaxLength(80)]
    public string NomorArsip { get; set; } = string.Empty;

    [MaxLength(150)]
    public string NamaBidang { get; set; } = string.Empty;

    [MaxLength(150)]
    public string NamaSnp { get; set; } = string.Empty;

    [Required, MaxLength(500)]
    public string Uraian { get; set; } = string.Empty;

    [MaxLength(10)]
    public string? MasaPajak { get; set; }

    public int? TahunPajak { get; set; }

    [Column(TypeName = "numeric(5,2)")]
    public decimal? TarifPersen { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal? DasarPengenaanPajak { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal NilaiBrutoMasuk { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal NilaiBrutoKeluar { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal TotalPotonganPajak { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal NilaiNettoTransfer { get; set; }

    // Data Rekanan & Integrasi Bank DKI / DJP
    [MaxLength(150)]
    public string NamaRekanan { get; set; } = string.Empty;

    [MaxLength(20)]
    public string KodeBankRekanan { get; set; } = "111";

    [MaxLength(100)]
    public string NamaBankRekanan { get; set; } = "Bank DKI";

    [MaxLength(50)]
    public string NoRekRekanan { get; set; } = string.Empty;

    [MaxLength(150)]
    public string NamaPemilikRekRekanan { get; set; } = string.Empty;

    [MaxLength(250)]
    public string AlamatRekanan { get; set; } = string.Empty;

    [MaxLength(30)]
    public string NpwpRekanan { get; set; } = string.Empty;

    [MaxLength(150)]
    public string NamaWpRekanan { get; set; } = string.Empty;

    [MaxLength(250)]
    public string AlamatWpRekanan { get; set; } = string.Empty;

    [MaxLength(80)]
    public string? NoVaAtauPesanan { get; set; }

    [MaxLength(200)]
    public string? FileLampiranName { get; set; }

    [MaxLength(300)]
    public string? FileLampiranPath { get; set; }

    // Workflow Approval: 0 Draft, 1 Diajukan TU, 2 Disetujui TU, 3 Disetujui PA, 4 Disetujui Sudin, 5 Lunas Transfer, 9 Ditolak
    public int StatusBku { get; set; }

    public bool NeedSudinApproval { get; set; }

    [MaxLength(300)]
    public string? CatatanVerifikasi { get; set; }

    public DateTime? SubmittedAt { get; set; }
    public DateTime? ApprovedByTuAt { get; set; }
    public DateTime? ApprovedByPaAt { get; set; }
    public DateTime? ApprovedBySudinAt { get; set; }

    // Token & CMS Bank DKI
    [MaxLength(20)]
    public string? TokenOtpPa { get; set; }

    public DateTime? TokenExpiredAt { get; set; }

    [MaxLength(20)]
    public string? TokenCreatedByNrk { get; set; }

    [MaxLength(60)]
    public string? NoJurnalBank { get; set; }

    [MaxLength(40)]
    public string? StanVa { get; set; }

    [MaxLength(60)]
    public string? KodeReffVa { get; set; }

    public DateTime? TanggalTransferBank { get; set; }

    [MaxLength(10)]
    public string? StatusTransferBank { get; set; } // "00" = Sukses

    public bool IsTutupBuku { get; set; }
    public DateTime? TanggalTutupBuku { get; set; }

    [MaxLength(80)]
    public string CreatedBy { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public ICollection<BkuDetailItem> DetailItems { get; set; } = new List<BkuDetailItem>();
    public ICollection<BkuTaxItem> TaxItems { get; set; } = new List<BkuTaxItem>();
}

[Table("tmbku_rinci", Schema = "siap")]
public class BkuDetailItem
{
    [Key]
    public int Id { get; set; }

    public int BkuTransactionId { get; set; }
    public BkuTransaction? BkuTransaction { get; set; }

    public int? RkasItemId { get; set; }
    public RkasItem? RkasItem { get; set; }

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

    [Column(TypeName = "numeric(18,2)")]
    public decimal Volume { get; set; }

    [MaxLength(30)]
    public string Satuan { get; set; } = "Unit";

    [Column(TypeName = "numeric(18,2)")]
    public decimal HargaSatuan { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal Jumlah { get; set; }
}

[Table("tmbku_pajak", Schema = "siap")]
public class BkuTaxItem
{
    [Key]
    public int Id { get; set; }

    public int BkuTransactionId { get; set; }
    public BkuTransaction? BkuTransaction { get; set; }

    [Required, MaxLength(10)]
    public string KodeTrxPajak { get; set; } = "P5"; // P1..P5

    [MaxLength(120)]
    public string NamaPajak { get; set; } = string.Empty;

    [MaxLength(20)]
    public string KodeMap { get; set; } = "411211";

    [MaxLength(20)]
    public string KodeJenisSetoran { get; set; } = "100";

    [MaxLength(10)]
    public string MasaPajak { get; set; } = "01";

    public int TahunPajak { get; set; } = 2026;

    [Column(TypeName = "numeric(18,2)")]
    public decimal DasarPengenaanPajak { get; set; }

    [Column(TypeName = "numeric(5,2)")]
    public decimal TarifPersen { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal NilaiPajak { get; set; }

    [MaxLength(30)]
    public string? KodeBilling { get; set; }

    public DateTime? BillingCreatedAt { get; set; }
    public DateTime? BillingExpiredAt { get; set; }

    [MaxLength(40)]
    public string? Ntpn { get; set; }

    [MaxLength(40)]
    public string? Ntb { get; set; }

    public DateTime? TanggalLunasPajak { get; set; }

    // 0: Belum Billing, 1: Billing Aktif, 2: Lunas BPN/NTPN
    public int StatusPajak { get; set; }
}
