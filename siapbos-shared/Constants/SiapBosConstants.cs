namespace SiapBos.Shared.Constants;

public static class SiapBosRoles
{
    public const string AdminTdi = "ADMIN-TDI";
    public const string AdminDinas = "ADMIN-DINAS";
    public const string Sudin = "SUDIN";
    public const string PaNegeri = "PA-NEGERI";
    public const string TuNegeri = "TU-NEGERI";
    public const string PkNegeri = "PK-NEGERI";

    public static readonly string[] AllRoles =
    [
        AdminTdi,
        AdminDinas,
        Sudin,
        PaNegeri,
        TuNegeri,
        PkNegeri
    ];
}

public static class SumberDanaTypes
{
    public const string Bos = "BOS";
    public const string Bop = "BOP";
}

public static class KodeTrxBku
{
    public const string Dropping = "JO";     // Pengisian Kas / Dropping Masuk (BOS/BOP)
    public const string BelanjaSpj = "JJ";   // SPJ Pengajuan Belanja
    public const string PajakPph21 = "P1";   // PPh Pasal 21
    public const string PajakPph22 = "P2";   // PPh Pasal 22
    public const string PajakPph23 = "P3";   // PPh Pasal 23 Jasa I
    public const string PajakPph4  = "P4";   // PPh Pasal 4 Ayat 2
    public const string PajakPpn   = "P5";   // PPN
    public const string PajakPph26 = "P6";   // PPh Pasal 26
    public const string PajakPph15 = "P7";   // PPh Pasal 15

    public static bool IsPajak(string? kode) =>
        !string.IsNullOrWhiteSpace(kode) &&
        kode is PajakPph21 or PajakPph22 or PajakPph23 or PajakPph4 or PajakPpn or PajakPph26 or PajakPph15;

    public static bool IsValid(string? kode) =>
        kode is Dropping or BelanjaSpj || IsPajak(kode);
}

public static class StatusBkuFlow
{
    public const int Draft = 0;
    public const int DiajukanTu = 1;
    public const int DisetujuiTu = 2;
    public const int DisetujuiPa = 3;
    public const int DisetujuiSudin = 4;
    public const int LunasTransfer = 5;
    public const int Ditolak = 9;

    public static string GetLabel(int status) => status switch
    {
        Draft => "Draft (Belum Diajukan)",
        DiajukanTu => "Diajukan ke Verifikator (TU)",
        DisetujuiTu => "Disetujui TU / Menunggu PA",
        DisetujuiPa => "Disetujui PA (Siap Bayar)",
        DisetujuiSudin => "Disetujui Sudin (Siap Bayar)",
        LunasTransfer => "Lunas / Sudah Ditransfer",
        Ditolak => "Ditolak / Perlu Perbaikan",
        _ => "Tidak Diketahui"
    };
}

public static class StatusPajakFlow
{
    public const int BelumBilling = 0;
    public const int BillingAktif = 1;
    public const int LunasNtpn = 2;
}

public static class StatusDanaFlow
{
    public const int DraftPk = 0;
    public const int DiajukanTu = 1;
    public const int DisetujuiTu = 2;      // Menunggu PA
    public const int DisetujuiPa = 3;      // Menunggu Dinas / Sudin
    public const int CairDisetujui = 4;    // Disetujui Dinas / Sudin + Cair ke Rekening & Masuk BKU JO
    public const int Ditolak = 9;
}

public static class JenisPembayaranBku
{
    public const string Transfer = "TRANSFER";
    public const string Luring = "LURING";
    public const string DaringVa = "DARING_VA";
    public const string VirtualAccount = "VA";
    public const string VaPln = "VA_PLN";
    public const string EOrder = "E_ORDER";
    public const string Penerimaan = "PENERIMAAN";
    public const string Pengeluaran = "PENGELUARAN";
    public const string NonTransfer = "NON_TRANSFER";

    public static bool IsVirtualAccountMode(string? jenis) =>
        jenis is VirtualAccount or DaringVa or VaPln or EOrder;
}
