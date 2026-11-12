using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SiapBos.Shared.Entities;

[Table("tibank_mutasi", Schema = "siap")]
public class BankMutation
{
    [Key]
    public int Id { get; set; }

    public int SekolahId { get; set; }
    public Sekolah? Sekolah { get; set; }

    [Required, MaxLength(10)]
    public string SumberDana { get; set; } = "BOS";

    [Required, MaxLength(40)]
    public string NomorRekening { get; set; } = string.Empty;

    public DateTime TanggalTransaksi { get; set; }

    [Required, MaxLength(60)]
    public string NomorReferensi { get; set; } = string.Empty;

    [Required, MaxLength(350)]
    public string Uraian { get; set; } = string.Empty;

    [Required, MaxLength(5)]
    public string TipeMutasi { get; set; } = "D"; // K = Kredit (Masuk), D = Debet (Keluar)

    [Column(TypeName = "numeric(18,2)")]
    public decimal Nominal { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal SaldoAkhir { get; set; }

    [MaxLength(20)]
    public string KodeTrx { get; set; } = "JJ";

    public int? BkuTransactionId { get; set; }
}

[Table("trbap_kas", Schema = "siap")]
public class BapKasReport
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

    [Required, MaxLength(80)]
    public string NomorBap { get; set; } = string.Empty;

    public DateTime TanggalBap { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal SaldoBku { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal SaldoRekeningKoran { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal SaldoKasTunai { get; set; }

    public int Pecahan100rb { get; set; }
    public int Pecahan50rb { get; set; }
    public int Pecahan20rb { get; set; }
    public int Pecahan10rb { get; set; }
    public int Pecahan5rb { get; set; }
    public int Pecahan2rb { get; set; }
    public int Pecahan1rb { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal SelisihKas { get; set; }

    [MaxLength(350)]
    public string KeteranganSelisih { get; set; } = "Saldo BKU sama dengan Saldo Rekening Koran Bank DKI.";

    // 0: Draft, 1: Disetujui PA, 2: Disetujui Sudin/Dinas
    public int StatusBap { get; set; }
    public bool IsTutupBuku { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ApprovedPaAt { get; set; }
    public DateTime? ApprovedDinasAt { get; set; }
}

[Table("trsetoran_sts", Schema = "siap")]
public class SetoranSts
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

    [Required, MaxLength(80)]
    public string NomorSts { get; set; } = string.Empty;

    public DateTime TanggalSts { get; set; }

    [Required, MaxLength(40)]
    public string JenisSetoran { get; set; } = "JASA_GIRO"; // SISA_BELANJA, JASA_GIRO, PENDAPATAN_LAIN

    [Required, MaxLength(300)]
    public string Uraian { get; set; } = string.Empty;

    [Column(TypeName = "numeric(18,2)")]
    public decimal NilaiSetor { get; set; }

    [MaxLength(80)]
    public string RekeningTujuan { get; set; } = "1010000001999 - RKUD PEMPROV DKI JAKARTA";

    // 1: Diajukan, 2: Disetujui Sudin, 3: Lunas Setor (Masuk BKU ST)
    public int StatusSts { get; set; } = 1;
    public int? BkuTransactionId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("trkoreksi_bku", Schema = "siap")]
public class BkuCorrection
{
    [Key]
    public int Id { get; set; }

    public int BkuTransactionId { get; set; }
    public BkuTransaction? BkuTransaction { get; set; }

    public int SekolahId { get; set; }

    [Required, MaxLength(10)]
    public string SumberDana { get; set; } = "BOP";

    [Required, MaxLength(30)]
    public string JenisKoreksi { get; set; } = "KODE_AKUN"; // KODE_AKUN, NILAI_BELANJA, BATAL_TRANSFER

    [Column(TypeName = "numeric(18,2)")]
    public decimal NilaiSebelum { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal NilaiSesudah { get; set; }

    [MaxLength(40)]
    public string? KodeAkunSebelum { get; set; }

    [MaxLength(40)]
    public string? KodeAkunSesudah { get; set; }

    [Required, MaxLength(350)]
    public string Alasan { get; set; } = string.Empty;

    [MaxLength(250)]
    public string? FileBeritaAcara { get; set; }

    // 1: Diajukan ke Sudin, 2: Disetujui Sudin, 9: Ditolak
    public int StatusKoreksi { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ApprovedAt { get; set; }
}

[Table("tiintegration_log", Schema = "siap")]
public class IntegrationAuditLog
{
    [Key]
    public int Id { get; set; }

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    [Required, MaxLength(40)]
    public string SystemName { get; set; } = "BANK_DKI"; // BANK_DKI, DJP_MPN, SIPKD, SIMPEG

    [Required, MaxLength(120)]
    public string EndpointCalled { get; set; } = string.Empty;

    [Required, MaxLength(60)]
    public string CallerService { get; set; } = "siapbos-api";

    public string RequestPayload { get; set; } = "{}";
    public string ResponsePayload { get; set; } = "{}";

    [MaxLength(20)]
    public string StatusCode { get; set; } = "00";

    public bool IsSuccess { get; set; } = true;
}

[Table("trhelpdesk_ticket", Schema = "public")]
public class HelpdeskTicket
{
    [Key]
    public int Id { get; set; }

    public int SekolahId { get; set; }
    public Sekolah? Sekolah { get; set; }

    [MaxLength(120)]
    public string NamaPelapor { get; set; } = string.Empty;

    [MaxLength(40)]
    public string RolePelapor { get; set; } = string.Empty;

    [Required, MaxLength(180)]
    public string Judul { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Kategori { get; set; } = "Integrasi Bank DKI";

    [Required, MaxLength(1000)]
    public string Deskripsi { get; set; } = string.Empty;

    [MaxLength(30)]
    public string Status { get; set; } = "OPEN"; // OPEN, IN_PROGRESS, RESOLVED

    [MaxLength(1000)]
    public string? TanggapanAdmin { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }
}
