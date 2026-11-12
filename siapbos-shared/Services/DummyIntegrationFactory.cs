using SiapBos.Shared.Constants;
using SiapBos.Shared.DTOs;
using SiapBos.Shared.Entities;

namespace SiapBos.Shared.Services;

/// <summary>
/// Central factory generating deterministic/dummy success payloads for external API integrations
/// (Bank DKI, DJP/MPN Pajak, SIMPEG, SIPKD) so testing never fails on external preconditions.
/// </summary>
public static class DummyIntegrationFactory
{
    public static readonly Dictionary<string, string> BankNames = new()
    {
        ["111"] = "Bank DKI",
        ["014"] = "Bank BCA",
        ["002"] = "Bank BRI",
        ["008"] = "Bank Mandiri",
        ["009"] = "Bank BNI",
        ["451"] = "Bank Syariah Indonesia (BSI)"
    };

    public static string SafeLast4(string? input, string fallback = "0001")
    {
        var clean = (input ?? string.Empty).Trim();
        if (clean.Length == 0) return fallback;
        return clean.Length >= 4 ? clean[^4..] : clean.PadLeft(4, '0');
    }

    public static BankDkiInquiryRekResponse BuildRekening(string? kodeBank, string? noRekening, Sekolah? matchedSekolah = null)
    {
        var bankCode = string.IsNullOrWhiteSpace(kodeBank) ? "111" : kodeBank.Trim();
        var bankName = BankNames.GetValueOrDefault(bankCode, "Bank Umum Nasional");
        var noRek = string.IsNullOrWhiteSpace(noRekening) ? "1110099887766" : noRekening.Trim();
        var suffix = SafeLast4(noRek);

        var ownerName = matchedSekolah != null
            ? (matchedSekolah.NoRekBos == noRek ? matchedSekolah.NamaRekBos : matchedSekolah.NamaRekBop)
            : noRek switch
            {
                "1110099887766" => "CV. GRAHA PUSTAKA NUSANTARA",
                "5400881234" => "PT. SEJUK PRIMA TEKNIK",
                "1110044556677" => "CV. RASA NUSANTARA CATERING",
                "1110077788899" => "DR. BUDI PRASETYO, M.PD",
                _ => $"REKANAN TERVERIFIKASI ({bankName.ToUpper()} #{suffix})"
            };

        var alamat = matchedSekolah?.Alamat ?? noRek switch
        {
            "1110099887766" => "Jl. Percetakan Negara No. 18, Jakarta Pusat",
            "5400881234" => "Jl. Pramuka Raya No. 45, Jakarta Timur",
            "1110044556677" => "Jl. Tebet Raya No. 72, Jakarta Selatan",
            "1110077788899" => "Jl. Rawamangun Muka No. 12, Jakarta Timur",
            _ => "DKI Jakarta"
        };

        return new BankDkiInquiryRekResponse
        {
            ResponseCode = "00",
            ResponseMessage = "Rekening Valid & Aktif",
            KodeBank = bankCode,
            NamaBank = bankName,
            NoRekening = noRek,
            NamaPemilikRekening = ownerName,
            AlamatPemilik = alamat,
            StatusRekening = "AKTIF"
        };
    }

    public static BillerInquiryResponse BuildBiller(string? jenisBiller, string? nomorTagihan)
    {
        var nomor = string.IsNullOrWhiteSpace(nomorTagihan)
            ? $"VA-{DateTime.UtcNow:yyyyMMddHHmm}"
            : nomorTagihan.Trim();

        if (string.Equals(jenisBiller, JenisPembayaranBku.VaPln, StringComparison.OrdinalIgnoreCase))
        {
            return new BillerInquiryResponse
            {
                ResponseCode = "00",
                ResponseMessage = "Tagihan Listrik PLN Ditemukan",
                JenisBiller = JenisPembayaranBku.VaPln,
                NomorTagihan = nomor,
                NamaPelangganAtauMerchant = $"PT PLN (PERSERO) UID JAYA - IDPEL {nomor}",
                Uraian = $"Tagihan Listrik Bulan {DateTime.UtcNow:MMMM yyyy} IDPEL {nomor}",
                NominalTagihan = 8750000m,
                KodeBank = "111",
                NoRekTujuan = $"8801{nomor}",
                NpwpTujuan = "01.001.629.3-051.000"
            };
        }

        return new BillerInquiryResponse
        {
            ResponseCode = "00",
            ResponseMessage = "Pesanan Marketplace Virtual Account Ditemukan",
            JenisBiller = string.IsNullOrWhiteSpace(jenisBiller) ? JenisPembayaranBku.DaringVa : jenisBiller,
            NomorTagihan = nomor,
            NamaPelangganAtauMerchant = "PT. SARANA EDUKASI DIGITAL (Virtual Account)",
            Uraian = $"Pembayaran Pesanan Daring / VA {nomor} - Perlengkapan Sekolah",
            NominalTagihan = 3500000m,
            KodeBank = "111",
            NoRekTujuan = nomor,
            NpwpTujuan = "02.888.999.1-021.000"
        };
    }

    public static NpwpInquiryResponse BuildNpwp(string? nomorNpwp)
    {
        var raw = string.IsNullOrWhiteSpace(nomorNpwp) ? "01.345.678.9-022.000" : nomorNpwp.Trim();
        var digits = new string(raw.Where(char.IsDigit).ToArray());
        var suffix = SafeLast4(digits, "0022");

        var wpName = raw switch
        {
            "01.345.678.9-022.000" => "CV. GRAHA PUSTAKA NUSANTARA",
            "02.555.666.7-033.000" => "PT. SEJUK PRIMA TEKNIK",
            "03.777.888.9-012.000" => "CV. RASA NUSANTARA CATERING",
            "01.001.629.3-051.000" => "PT PLN (PERSERO)",
            _ => $"WAJIB PAJAK TERVERIFIKASI DJP (#{suffix})"
        };

        var wpAddress = raw switch
        {
            "01.345.678.9-022.000" => "Jl. Percetakan Negara No. 18, Jakarta Pusat",
            "02.555.666.7-033.000" => "Jl. Pramuka Raya No. 45, Jakarta Timur",
            "03.777.888.9-012.000" => "Jl. Tebet Raya No. 72, Jakarta Selatan",
            "01.001.629.3-051.000" => "Jl. M.I. Ridwan Rais No. 1, Jakarta Pusat",
            _ => "DKI Jakarta"
        };

        return new NpwpInquiryResponse
        {
            ResponseCode = "00",
            ResponseMessage = "NPWP Aktif & Valid di Direktorat Jenderal Pajak (MPN G3)",
            NomorNpwp = raw,
            NamaWajibPajak = wpName,
            Alamat = wpAddress,
            StatusPkp = "PKP AKTIF",
            KppTerdaftar = "KPP Pratama Jakarta Pusat"
        };
    }

    public static SimpegPegawaiResponse BuildSimpegPegawai(string? nrk, AppUser? existingUser = null)
    {
        var cleanNrk = string.IsNullOrWhiteSpace(nrk) ? "190001" : nrk.Trim();
        if (existingUser != null)
        {
            return new SimpegPegawaiResponse
            {
                ResponseCode = "00",
                ResponseMessage = "Data ASN Ditemukan di SIMPEG Provinsi DKI Jakarta",
                Nrk = existingUser.Nrk,
                Nip = existingUser.Nip,
                Nik = existingUser.Nik,
                NamaLengkap = existingUser.NamaLengkap,
                Jabatan = existingUser.Jabatan,
                Golongan = "Penata Tk. I (III/d)",
                UnitKerja = existingUser.Sekolah?.NamaSekolah ?? "Dinas Pendidikan Provinsi DKI Jakarta"
            };
        }

        var suffix = SafeLast4(cleanNrk);
        return new SimpegPegawaiResponse
        {
            ResponseCode = "00",
            ResponseMessage = "Data ASN Ditemukan di SIMPEG Provinsi DKI Jakarta (Dummy)",
            Nrk = cleanNrk,
            Nip = $"19860515201001{suffix}",
            Nik = $"317104150586{suffix}",
            NamaLengkap = $"Rizky Ramadhan, S.Pd. (NRK {cleanNrk})",
            Jabatan = "Guru / Tenaga Kependidikan Sekolah Negeri",
            Golongan = "Penata (III/c)",
            UnitKerja = "Dinas Pendidikan Provinsi DKI Jakarta"
        };
    }

    public static string GenerateOtpToken() => Random.Shared.Next(100000, 999999).ToString();

    public static string GenerateKodeBilling(DateTime? now = null)
        => $"8{(now ?? DateTime.UtcNow):yyyyMMdd}{Random.Shared.Next(100000, 999999)}";

    public static string GenerateNtpn(DateTime? now = null)
        => $"DJP{(now ?? DateTime.UtcNow):yyMMdd}DKI{Random.Shared.Next(1000, 9999)}X";

    public static string GenerateNtb()
        => $"000{Random.Shared.Next(100000000, 999999999)}";

    public static string GenerateJurnal(string prefix = "DKI", DateTime? now = null)
        => $"JRN-{prefix}-{(now ?? DateTime.UtcNow):yyyyMMddHHmmss}";

    public static string GenerateStan(DateTime? now = null)
        => $"VA{(now ?? DateTime.UtcNow):HHmmss}{Random.Shared.Next(10, 99)}";

    public static List<VaStepTraceDto> BuildVaSteps(string vaNo, string payee, decimal nominal, string stan, string kodeReff, string jurnal, DateTime now)
        =>
        [
            new VaStepTraceDto
            {
                StepName = "1. Biller Inquiry",
                Endpoint = "/api/bank-dki/va/biller-inquiry",
                ResponseCode = "00",
                Message = $"Inquiry tagihan VA [{vaNo}] {payee} valid Rp {nominal:N0}.",
                Timestamp = now
            },
            new VaStepTraceDto
            {
                StepName = "2. Overbook",
                Endpoint = "/api/bank-dki/va/overbook",
                ResponseCode = "00",
                Stan = stan,
                Message = $"Overbooking internal Bank DKI sebesar Rp {nominal:N0} berhasil (STAN: {stan}).",
                Timestamp = now
            },
            new VaStepTraceDto
            {
                StepName = "3. Payment",
                Endpoint = "/api/bank-dki/va/payment",
                ResponseCode = "00",
                Stan = stan,
                KodeReff = kodeReff,
                Message = $"Payment Virtual Account settled. Jurnal: {jurnal}, Reff: {kodeReff}.",
                Timestamp = now
            }
        ];

    public static object BuildTaxInquiry(
        string? kodeTrx,
        string? masaPajak,
        int tahunPajak,
        decimal brutoSpj,
        decimal dasarPengenaanPajak,
        decimal? tarifOverride = null,
        TaxMaster? dbTax = null,
        string? npwp = null,
        string? namaWp = null)
    {
        var code = string.IsNullOrWhiteSpace(kodeTrx) ? "P5" : kodeTrx.Trim().ToUpperInvariant();
        var masa = string.IsNullOrWhiteSpace(masaPajak) ? "01" : masaPajak.Trim().PadLeft(2, '0');
        var tahun = tahunPajak > 0 ? tahunPajak : DateTime.UtcNow.Year;

        var (map, kjs, nama, defaultTarif) = code switch
        {
            "P1" => ("411121", "100", "PPh Pasal 21 (Honorarium)", 5.0m),
            "P2" => ("411122", "920", "PPh Pasal 22 (Belanja Barang)", 1.5m),
            "P3" => ("411124", "100", "PPh Pasal 23 (Jasa / Sewa)", 2.0m),
            "P4" => ("411128", "403", "PPh Pasal 4 Ayat (2) Final", 10.0m),
            "P5" => ("411211", "920", "PPN (Pajak Pertambahan Nilai)", 11.0m),
            "P6" => ("411127", "100", "PPh Pasal 26", 20.0m),
            "P7" => ("411128", "410", "PPh Pasal 15", 1.2m),
            _ => ("411211", "920", "PPN (Pajak Pertambahan Nilai)", 11.0m)
        };

        var kodeMap = dbTax?.KodeMap ?? map;
        var kodeSetoran = dbTax?.KodeJenisSetoran ?? kjs;
        var namaPajak = dbTax?.NamaPajak ?? nama;
        var tarif = tarifOverride is > 0 ? tarifOverride.Value : (dbTax?.TarifPersen ?? defaultTarif);

        var dpp = brutoSpj > 0
            ? (code == "P5" ? Math.Round(brutoSpj / 1.11m, 0) : Math.Round(brutoSpj, 0))
            : Math.Max(0m, Math.Round(dasarPengenaanPajak, 0));

        var nilaiPajak = Math.Round((dpp * tarif) / 100m, 0);

        return new
        {
            responseCode = "00",
            responseMessage = "Inquiry pajak berhasil",
            kodeTrx = code,
            kodeMap,
            kodeJenisSetoran = kodeSetoran,
            namaPajak,
            masaPajak = masa,
            tahunPajak = tahun,
            dasarPengenaanPajak = dpp,
            tarifPersen = tarif,
            nilaiPajak,
            npwp = string.IsNullOrWhiteSpace(npwp) ? "01.345.678.9-022.000" : npwp.Trim(),
            namaWajibPajak = string.IsNullOrWhiteSpace(namaWp) ? "WAJIB PAJAK TERVERIFIKASI DJP" : namaWp.Trim()
        };
    }

    public static BkuTaxItem BuildDummyTaxItem(int taxId, DateTime? now = null, bool paid = false, bool withBilling = true)
    {
        var ts = now ?? DateTime.UtcNow;
        var kodeBilling = withBilling ? GenerateKodeBilling(ts) : null;
        return new BkuTaxItem
        {
            Id = taxId,
            KodeTrxPajak = KodeTrxBku.PajakPpn,
            NamaPajak = "PPN (Dummy MPN)",
            KodeMap = "411211",
            KodeJenisSetoran = "100",
            NilaiPajak = 110000m,
            KodeBilling = kodeBilling,
            BillingCreatedAt = withBilling ? ts : null,
            BillingExpiredAt = withBilling ? ts.AddDays(30) : null,
            Ntpn = paid ? GenerateNtpn(ts) : null,
            Ntb = paid ? GenerateNtb() : null,
            TanggalLunasPajak = paid ? ts : null,
            StatusPajak = paid
                ? StatusPajakFlow.LunasNtpn
                : (withBilling ? StatusPajakFlow.BillingAktif : StatusPajakFlow.BelumBilling)
        };
    }

    public static List<BankMutation> BuildDummyMutations(int sekolahId, string sumberDana, string noRek)
    {
        var now = DateTime.UtcNow;
        var sd = string.IsNullOrWhiteSpace(sumberDana) ? SumberDanaTypes.Bos : sumberDana;
        var rek = string.IsNullOrWhiteSpace(noRek) ? "1010010012345" : noRek;
        return
        [
            new BankMutation
            {
                Id = 9001,
                SekolahId = sekolahId,
                SumberDana = sd,
                NomorRekening = rek,
                TanggalTransaksi = now.AddDays(-2),
                NomorReferensi = $"SP2D-DUMMY-{now:yyyyMMdd}",
                Uraian = $"KR PENYALURAN DANA {sd} (DATA DUMMY INTEGRASI)",
                TipeMutasi = "K",
                Nominal = 50000000m,
                SaldoAkhir = 50000000m,
                KodeTrx = KodeTrxBku.Dropping
            },
            new BankMutation
            {
                Id = 9002,
                SekolahId = sekolahId,
                SumberDana = sd,
                NomorRekening = rek,
                TanggalTransaksi = now.AddDays(-1),
                NomorReferensi = GenerateJurnal(),
                Uraian = "DB CMS SPJ PENGADAAN ATK & BUKU (DATA DUMMY INTEGRASI)",
                TipeMutasi = "D",
                Nominal = 2500000m,
                SaldoAkhir = 47500000m,
                KodeTrx = KodeTrxBku.BelanjaSpj
            }
        ];
    }
}
