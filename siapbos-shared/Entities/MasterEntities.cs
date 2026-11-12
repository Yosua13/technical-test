using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SiapBos.Shared.Entities;

[Table("trsekolah", Schema = "siap")]
public class Sekolah
{
    [Key]
    public int Id { get; set; }

    [Required, MaxLength(20)]
    public string Npsn { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string NamaSekolah { get; set; } = string.Empty;

    [Required, MaxLength(20)]
    public string Jenjang { get; set; } = "SMA"; // SD, SMP, SMA, SMK, SLB

    [Required, MaxLength(50)]
    public string StatusSekolah { get; set; } = "NEGERI";

    [Required, MaxLength(20)]
    public string WilayahSudin { get; set; } = "JP"; // JP, JU, JB, JS, JT

    [Required, MaxLength(100)]
    public string NamaSudin { get; set; } = "Suku Dinas Pendidikan Wilayah I Jakarta Pusat";

    [MaxLength(250)]
    public string Alamat { get; set; } = string.Empty;

    [MaxLength(40)]
    public string NoRekBos { get; set; } = string.Empty;

    [MaxLength(150)]
    public string NamaRekBos { get; set; } = string.Empty;

    [Column(TypeName = "numeric(18,2)")]
    public decimal SaldoAwalBos { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal SaldoBos { get; set; }

    [MaxLength(40)]
    public string NoRekBop { get; set; } = string.Empty;

    [MaxLength(150)]
    public string NamaRekBop { get; set; } = string.Empty;

    [Column(TypeName = "numeric(18,2)")]
    public decimal SaldoAwalBop { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal SaldoBop { get; set; }

    [MaxLength(30)]
    public string NpwpSekolah { get; set; } = string.Empty;

    [MaxLength(150)]
    public string NamaKepalaSekolah { get; set; } = string.Empty;

    [MaxLength(30)]
    public string NipKepalaSekolah { get; set; } = string.Empty;

    [MaxLength(20)]
    public string NrkKepalaSekolah { get; set; } = string.Empty;

    [MaxLength(150)]
    public string NamaKasubagTu { get; set; } = string.Empty;

    [MaxLength(30)]
    public string NipKasubagTu { get; set; } = string.Empty;

    [MaxLength(20)]
    public string NrkKasubagTu { get; set; } = string.Empty;

    [MaxLength(150)]
    public string NamaBendahara { get; set; } = string.Empty;

    [MaxLength(30)]
    public string NipBendahara { get; set; } = string.Empty;

    [MaxLength(20)]
    public string NrkBendahara { get; set; } = string.Empty;

    public bool IsRekeningConfirmed { get; set; }
    public DateTime? TanggalKonfirmasiRekening { get; set; }
}

[Table("users", Schema = "auth")]
public class AppUser
{
    [Key]
    public int Id { get; set; }

    [Required, MaxLength(80)]
    public string Username { get; set; } = string.Empty;

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string NamaLengkap { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Nrk { get; set; } = string.Empty;

    [MaxLength(30)]
    public string Nip { get; set; } = string.Empty;

    [MaxLength(30)]
    public string Nik { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(30)]
    public string NoHp { get; set; } = string.Empty;

    [Required, MaxLength(40)]
    public string RoleCode { get; set; } = "PK-NEGERI";

    [MaxLength(100)]
    public string Jabatan { get; set; } = string.Empty;

    [MaxLength(20)]
    public string WilayahSudin { get; set; } = "ALL";

    public int? SekolahId { get; set; }
    public Sekolah? Sekolah { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("roles", Schema = "auth")]
public class AppRole
{
    [Key]
    public int Id { get; set; }

    [Required, MaxLength(40)]
    public string RoleCode { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string RoleName { get; set; } = string.Empty;

    [MaxLength(250)]
    public string Deskripsi { get; set; } = string.Empty;

    [MaxLength(30)]
    public string Level { get; set; } = "SEKOLAH"; // DINAS, SUDIN, SEKOLAH
}

[Table("traplikasi", Schema = "siap")]
public class AppModule
{
    [Key]
    public int Id { get; set; }

    [Required, MaxLength(20)]
    public string KodeAplikasi { get; set; } = string.Empty; // UM, BOS, BOP, ADMN, HELP

    [Required, MaxLength(100)]
    public string Nama { get; set; } = string.Empty;

    [Required, MaxLength(80)]
    public string Link { get; set; } = string.Empty;

    [MaxLength(250)]
    public string Deskripsi { get; set; } = string.Empty;

    [MaxLength(60)]
    public string Icon { get; set; } = "bi-wallet2";

    [MaxLength(250)]
    public string AllowedRolesCsv { get; set; } = string.Empty;

    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

[Table("trmenu", Schema = "siap")]
public class AppMenu
{
    [Key]
    public int Id { get; set; }

    [Required, MaxLength(20)]
    public string KodeAplikasi { get; set; } = string.Empty;

    [Required, MaxLength(120)]
    public string Nama { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string Link { get; set; } = string.Empty;

    [MaxLength(60)]
    public string Icon { get; set; } = "bi-circle";

    [MaxLength(250)]
    public string AllowedRolesCsv { get; set; } = string.Empty;

    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

[Table("trperiode", Schema = "siap")]
public class MasterPeriode
{
    [Key]
    public int Id { get; set; }

    public int TahunAnggaran { get; set; }

    [Required, MaxLength(10)]
    public string SumberDana { get; set; } = "BOS"; // BOS, BOP

    [Required, MaxLength(20)]
    public string KodePeriode { get; set; } = "01"; // 01, 02, TW1, TW2

    [Required, MaxLength(100)]
    public string NamaPeriode { get; set; } = string.Empty;

    public int BulanMulai { get; set; }
    public int BulanSelesai { get; set; }
    public DateTime BatasPengajuanBelanja { get; set; }
    public bool IsActive { get; set; } = true;
}

[Table("trbas", Schema = "siap")]
public class BasAccount
{
    [Key]
    public int Id { get; set; }

    [Required, MaxLength(40)]
    public string KodeAkun { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    public string NamaAkun { get; set; } = string.Empty;

    [MaxLength(80)]
    public string Kelompok { get; set; } = "Belanja Barang dan Jasa";

    public bool IsBos { get; set; } = true;
    public bool IsBop { get; set; } = true;
    public bool IsActive { get; set; } = true;
}

[Table("trpotspm", Schema = "siap")]
public class TaxMaster
{
    [Key]
    public int Id { get; set; }

    [Required, MaxLength(10)]
    public string KodeTrxPajak { get; set; } = string.Empty; // P1, P2, P3, P4, P5

    [Required, MaxLength(120)]
    public string NamaPajak { get; set; } = string.Empty;

    [Required, MaxLength(20)]
    public string KodeMap { get; set; } = string.Empty;

    [Required, MaxLength(20)]
    public string KodeJenisSetoran { get; set; } = "100";

    [Column(TypeName = "numeric(5,2)")]
    public decimal TarifPersen { get; set; }

    [MaxLength(250)]
    public string Keterangan { get; set; } = string.Empty;
}

[Table("access_token", Schema = "oauth")]
public class OAuthAccessToken
{
    [Key]
    [MaxLength(80)]
    public string TokenId { get; set; } = Guid.NewGuid().ToString("N");

    [Required, MaxLength(80)]
    public string UserName { get; set; } = string.Empty;

    [MaxLength(60)]
    public string ClientId { get; set; } = "siapbos-webapp";

    [MaxLength(40)]
    public string RoleCode { get; set; } = string.Empty;

    public int TahunAnggaran { get; set; } = 2025;

    [MaxLength(60)]
    public string IpAddress { get; set; } = "127.0.0.1";

    public DateTime LoginAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiredAt { get; set; } = DateTime.UtcNow.AddHours(8);
}

[Table("history_access_token", Schema = "oauth")]
public class OAuthTokenHistory
{
    [Key]
    public int Id { get; set; }

    [Required, MaxLength(80)]
    public string AccessId { get; set; } = string.Empty;

    [Required, MaxLength(80)]
    public string UserName { get; set; } = string.Empty;

    [MaxLength(60)]
    public string ClientId { get; set; } = "siapbos-webapp";

    [MaxLength(60)]
    public string IpAddress { get; set; } = "127.0.0.1";

    public DateTime LoginAt { get; set; } = DateTime.UtcNow;
    public bool IsLogout { get; set; }
    public DateTime? LogoutAt { get; set; }
}
