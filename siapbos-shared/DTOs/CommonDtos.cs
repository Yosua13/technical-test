namespace SiapBos.Shared.DTOs;

public class ApiResponse<T>
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "OK";
    public T? Data { get; set; }

    public static ApiResponse<T> Ok(T data, string message = "Berhasil") =>
        new() { Success = true, Message = message, Data = data };

    public static ApiResponse<T> Fail(string message) =>
        new() { Success = false, Message = message, Data = default };
}

public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public int TahunAnggaran { get; set; } = 2026;
    public string CaptchaInput { get; set; } = string.Empty;
    public string CaptchaToken { get; set; } = string.Empty;
    public bool SkipCaptchaDemo { get; set; }
}

public class LoginResponse
{
    public string AccessToken { get; set; } = string.Empty;
    public string TokenType { get; set; } = "Bearer";
    public int ExpiresIn { get; set; } = 28800;
    public int TahunAnggaran { get; set; }
    public UserProfileDto User { get; set; } = new();
    public List<AppModuleDto> ListAplikasi { get; set; } = [];
}

public class UserProfileDto
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string NamaLengkap { get; set; } = string.Empty;
    public string Nrk { get; set; } = string.Empty;
    public string Nip { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string NoHp { get; set; } = string.Empty;
    public string RoleCode { get; set; } = string.Empty;
    public string ShortCode { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
    public List<string> Roles { get; set; } = [];
    public bool RequiresSchoolPicker { get; set; }
    public string Jabatan { get; set; } = string.Empty;
    public string WilayahSudin { get; set; } = string.Empty;
    public int? SekolahId { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsLocked { get; set; }
    public SekolahSummaryDto? Sekolah { get; set; }
}

public class SekolahSummaryDto
{
    public int Id { get; set; }
    public string Npsn { get; set; } = string.Empty;
    public string NamaSekolah { get; set; } = string.Empty;
    public string Jenjang { get; set; } = string.Empty;
    public string WilayahSudin { get; set; } = string.Empty;
    public string NamaSudin { get; set; } = string.Empty;
    public string NoRekBos { get; set; } = string.Empty;
    public string NamaRekBos { get; set; } = string.Empty;
    public decimal SaldoBos { get; set; }
    public string NoRekBop { get; set; } = string.Empty;
    public string NamaRekBop { get; set; } = string.Empty;
    public decimal SaldoBop { get; set; }
    public string NpwpSekolah { get; set; } = string.Empty;
    public string NamaKepalaSekolah { get; set; } = string.Empty;
    public string NrkKepalaSekolah { get; set; } = string.Empty;
    public string NamaBendahara { get; set; } = string.Empty;
    public string NrkBendahara { get; set; } = string.Empty;
    public bool IsRekeningConfirmed { get; set; }
}

public class AppModuleDto
{
    public string KodeAplikasi { get; set; } = string.Empty;
    public string Nama { get; set; } = string.Empty;
    public string Link { get; set; } = string.Empty;
    public string Deskripsi { get; set; } = string.Empty;
    public string Icon { get; set; } = string.Empty;
    public List<AppMenuDto> Menu { get; set; } = [];
}

public class AppMenuDto
{
    public int Id { get; set; }
    public string Nama { get; set; } = string.Empty;
    public string Link { get; set; } = string.Empty;
    public string Icon { get; set; } = string.Empty;
    public bool RequiresSekolah { get; set; }
    public List<string> AllowedRoles { get; set; } = [];
}

public class BkuSummarySaldoDto
{
    public int SekolahId { get; set; }
    public string NamaSekolah { get; set; } = string.Empty;
    public string SumberDana { get; set; } = "BOS";
    public int TahunAnggaran { get; set; }
    public decimal TotalPaguRkas { get; set; }
    public decimal TotalDanaMasuk { get; set; }
    public decimal TotalBelanjaSpj { get; set; }
    public decimal SisaKasBank { get; set; }
    public decimal TotalPajakDipungut { get; set; }
    public decimal TotalPajakDisetor { get; set; }
    public decimal PajakBelumDisetor { get; set; }
    public decimal SisaPaguRkas { get; set; }
}

public class CreateBkuRequest
{
    public int SekolahId { get; set; }
    public int TahunAnggaran { get; set; } = 2026;
    public string SumberDana { get; set; } = "BOS";
    public string KodePeriode { get; set; } = "01";
    public DateTime TanggalTransaksi { get; set; } = DateTime.UtcNow;
    public string NomorBukti { get; set; } = string.Empty;
    public string KodeTrx { get; set; } = "JJ"; // JO, JJ, P1..P7
    public string JenisPembayaran { get; set; } = "TRANSFER";
    public string Uraian { get; set; } = string.Empty;
    public decimal? NominalNonSpj { get; set; } // Untuk JO / Pajak non-SPJ
    public string NamaRekanan { get; set; } = string.Empty;
    public string KodeBankRekanan { get; set; } = "111";
    public string NamaBankRekanan { get; set; } = "Bank DKI";
    public string NoRekRekanan { get; set; } = string.Empty;
    public string NamaPemilikRekRekanan { get; set; } = string.Empty;
    public string NpwpRekanan { get; set; } = string.Empty;
    public string NamaWpRekanan { get; set; } = string.Empty;
    public string? NoVaAtauPesanan { get; set; }
    public string? FileLampiranName { get; set; }
    public string? FileLampiranPath { get; set; }
    public bool NeedSudinApproval { get; set; }
    public List<CreateBkuDetailRequest> DetailItems { get; set; } = [];
    public List<CreateBkuTaxRequest> TaxItems { get; set; } = [];
}

public class CreateBkuDetailRequest
{
    public int? RkasItemId { get; set; }
    public string KodeKegiatan { get; set; } = string.Empty;
    public string NamaKegiatan { get; set; } = string.Empty;
    public string KodeAkun { get; set; } = string.Empty;
    public string NamaAkun { get; set; } = string.Empty;
    public string KodeKomponen { get; set; } = string.Empty;
    public string NamaKomponen { get; set; } = string.Empty;
    public string Spesifikasi { get; set; } = string.Empty;
    public decimal Volume { get; set; } = 1;
    public string Satuan { get; set; } = "Paket";
    public decimal HargaSatuan { get; set; }
}

public class CreateBkuTaxRequest
{
    public string KodeTrxPajak { get; set; } = "P5";
    public string? KodeMap { get; set; }
    public string? KodeJenisSetoran { get; set; }
    public decimal? DasarPengenaanPajak { get; set; }
    public decimal? TarifPersen { get; set; }
    public decimal NilaiPajak { get; set; }
}

public class ApprovalActionRequest
{
    public bool Disetujui { get; set; } = true;
    public string? Catatan { get; set; }
}

// Integration Request & Response Contracts (Shared between siapbos-api / siapbop-api / siapbos-integration)
public class BankDkiInquiryRekRequest
{
    public string KodeBank { get; set; } = "111";
    public string NoRekening { get; set; } = string.Empty;
}

public class BankDkiInquiryRekResponse
{
    public string ResponseCode { get; set; } = "00"; // "00" valid
    public string ResponseMessage { get; set; } = "Rekening Valid & Aktif";
    public string KodeBank { get; set; } = "111";
    public string NamaBank { get; set; } = "Bank DKI";
    public string NoRekening { get; set; } = string.Empty;
    public string NamaPemilikRekening { get; set; } = string.Empty;
    public string StatusRekening { get; set; } = "AKTIF";
}

public class BankDkiCreateTokenRequest
{
    public int BkuId { get; set; }
    public string Nrk { get; set; } = string.Empty;
}

public class BankDkiCreateTokenResponse
{
    public string ResponseCode { get; set; } = "00";
    public string ResponseMessage { get; set; } = "Token CMS Bank DKI berhasil dibuat";
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiredAt { get; set; }
}

public class SpjTransferRequest
{
    public int BkuId { get; set; }
    public string TokenOtp { get; set; } = string.Empty;
    public string ExecutedBy { get; set; } = string.Empty;
}

public class SpjTransferResponse
{
    public string Bit39 { get; set; } = "00";
    public string Message { get; set; } = "Transfer SPJ CMS Bank DKI Berhasil";
    public string NoJurnalBank { get; set; } = string.Empty;
    public DateTime TanggalTransfer { get; set; }
    public decimal NominalDitransfer { get; set; }
    public decimal SisaSaldoSekolah { get; set; }
}

public class BillerInquiryRequest
{
    public string JenisBiller { get; set; } = "VA_PLN"; // VA_PLN or E_ORDER
    public string NomorTagihan { get; set; } = string.Empty;
}

public class BillerInquiryResponse
{
    public string ResponseCode { get; set; } = "00";
    public string ResponseMessage { get; set; } = "Tagihan Ditemukan";
    public string JenisBiller { get; set; } = string.Empty;
    public string NomorTagihan { get; set; } = string.Empty;
    public string NamaPelangganAtauMerchant { get; set; } = string.Empty;
    public string Uraian { get; set; } = string.Empty;
    public decimal NominalTagihan { get; set; }
    public string KodeBank { get; set; } = "111";
    public string NoRekTujuan { get; set; } = string.Empty;
    public string NpwpTujuan { get; set; } = string.Empty;
}

public class NpwpInquiryResponse
{
    public string ResponseCode { get; set; } = "00";
    public string ResponseMessage { get; set; } = "NPWP Aktif Terdaftar di DJP";
    public string NomorNpwp { get; set; } = string.Empty;
    public string NamaWajibPajak { get; set; } = string.Empty;
    public string Alamat { get; set; } = string.Empty;
    public string StatusPkp { get; set; } = "PKP AKTIF";
    public string KppTerdaftar { get; set; } = "KPP Pratama Jakarta Gambir";
}

public class SimpegPegawaiResponse
{
    public string ResponseCode { get; set; } = "00";
    public string ResponseMessage { get; set; } = "Data Pegawai Ditemukan di SIMPEG DKI";
    public string Nrk { get; set; } = string.Empty;
    public string Nip { get; set; } = string.Empty;
    public string Nik { get; set; } = string.Empty;
    public string NamaLengkap { get; set; } = string.Empty;
    public string Jabatan { get; set; } = string.Empty;
    public string Golongan { get; set; } = string.Empty;
    public string UnitKerja { get; set; } = string.Empty;
}

public class SipkdNpdResponse
{
    public string ResponseCode { get; set; } = "00";
    public string ResponseMessage { get; set; } = "NPD BOP Berhasil Disimpan ke SIPKD DKI Jakarta";
    public string NomorSipkd { get; set; } = string.Empty;
    public DateTime TanggalProses { get; set; }
}

public class BapKasSaveRequest
{
    public int SekolahId { get; set; }
    public int TahunAnggaran { get; set; } = 2026;
    public string SumberDana { get; set; } = "BOS";
    public string KodePeriode { get; set; } = "01";
    public decimal SaldoKasTunai { get; set; }
    public int Pecahan100rb { get; set; }
    public int Pecahan50rb { get; set; }
    public int Pecahan20rb { get; set; }
    public int Pecahan10rb { get; set; }
    public int Pecahan5rb { get; set; }
    public int Pecahan2rb { get; set; }
    public int Pecahan1rb { get; set; }
    public string KeteranganSelisih { get; set; } = string.Empty;
}

public class TutupBukuRequest
{
    public int SekolahId { get; set; }
    public int TahunAnggaran { get; set; } = 2026;
    public string SumberDana { get; set; } = "BOS";
    public string KodePeriode { get; set; } = "01";
}

public class SetoranStsCreateRequest
{
    public int SekolahId { get; set; }
    public int TahunAnggaran { get; set; } = 2026;
    public string SumberDana { get; set; } = "BOS";
    public string KodePeriode { get; set; } = "01";
    public string JenisSetoran { get; set; } = "SISA_BELANJA";
    public string Uraian { get; set; } = string.Empty;
    public decimal NilaiSetor { get; set; }
}

public class SaveBatalTransferRequest
{
    public int SekolahId { get; set; }
    public int BkuTransactionId { get; set; }
    public int TahunAnggaran { get; set; } = 2026;
    public string SumberDana { get; set; } = "BOS";
    public string JenisPeriode { get; set; } = "TW";
    public string KodePeriode { get; set; } = "01";
    public string NomorBeritaAcara { get; set; } = string.Empty;
    public DateTime TanggalPembatalan { get; set; } = DateTime.UtcNow;
    public string NrkPengkoreksi { get; set; } = string.Empty;
    public string NamaPengkoreksi { get; set; } = string.Empty;
    public string? FileBeritaAcaraName { get; set; }
    public string? FileBeritaAcaraPath { get; set; }
    public string UraianBeritaAcara { get; set; } = string.Empty;
    public bool PajakTidakDikoreksi { get; set; } = true;
    public bool SubmitToTu { get; set; } = false;
}
