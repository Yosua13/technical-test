namespace SiapBos.Shared.Constants;

public static class SiapBosRoles
{
    public const string AdminDinas = "ADMIN-DINAS";
    public const string Sudin = "SUDIN";
    public const string PaNegeri = "PA-NEGERI";
    public const string TuNegeri = "TU-NEGERI";
    public const string PkNegeri = "PK-NEGERI";

    public static readonly string[] AllRoles =
    [
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
    public const string Dropping = "JO";
    public const string BelanjaSpj = "JJ";
    public const string JasaGiro = "JG";
    public const string PendapatanLain = "LL";
    public const string SetorSisa = "ST";
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
        LunasTransfer => "Lunas Transfer CMS Bank DKI",
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

public static class JenisPembayaranBku
{
    public const string Transfer = "TRANSFER";
    public const string VaPln = "VA_PLN";
    public const string EOrder = "E_ORDER";
    public const string NonTransfer = "NON_TRANSFER";
}
