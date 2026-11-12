export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface Sekolah {
  id: number;
  npsn: string;
  namaSekolah: string;
  jenjang: string;
  statusSekolah?: string;
  wilayahSudin: string;
  namaSudin: string;
  alamat?: string;
  noRekBos: string;
  namaRekBos: string;
  saldoBos: number;
  noRekBop: string;
  namaRekBop: string;
  saldoBop: number;
  npwpSekolah: string;
  namaKepalaSekolah: string;
  nipKepalaSekolah?: string;
  nrkKepalaSekolah: string;
  namaKasubagTu?: string;
  nrkKasubagTu?: string;
  namaBendahara: string;
  nipBendahara?: string;
  nrkBendahara: string;
  isRekeningConfirmed: boolean;
}

export interface UserProfile {
  id: number;
  username: string;
  namaLengkap: string;
  nrk: string;
  nip: string;
  email: string;
  noHp: string;
  roleCode: 'ADMIN-DINAS' | 'SUDIN' | 'PA-NEGERI' | 'TU-NEGERI' | 'PK-NEGERI' | string;
  roleName: string;
  jabatan: string;
  wilayahSudin: string;
  sekolahId?: number | null;
  sekolah?: Sekolah | null;
}

export interface AppMenu {
  nama: string;
  link: string;
  icon: string;
  allowedRoles: string[];
}

export interface AppModule {
  kodeAplikasi: string;
  nama: string;
  link: string;
  deskripsi: string;
  icon: string;
  menu: AppMenu[];
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  tahunAnggaran: number;
  user: UserProfile;
  listAplikasi: AppModule[];
}

export interface BkuSummarySaldo {
  sekolahId: number;
  namaSekolah: string;
  sumberDana: string;
  tahunAnggaran: number;
  totalPaguRkas: number;
  totalDanaMasuk: number;
  totalBelanjaSpj: number;
  sisaKasBank: number;
  totalPajakDipungut: number;
  totalPajakDisetor: number;
  pajakBelumDisetor: number;
  sisaPaguRkas: number;
}

export interface BkuDetailItem {
  id?: number;
  rkasItemId?: number | null;
  kodeKegiatan: string;
  namaKegiatan: string;
  kodeAkun: string;
  namaAkun: string;
  kodeKomponen: string;
  namaKomponen: string;
  spesifikasi: string;
  volume: number;
  satuan: string;
  hargaSatuan: number;
  jumlah?: number;
}

export interface BkuTaxItem {
  id?: number;
  bkuTransactionId?: number;
  kodeTrxPajak: string;
  namaPajak?: string;
  kodeMap?: string;
  kodeJenisSetoran?: string;
  masaPajak?: string;
  tahunPajak?: number;
  dasarPengenaanPajak?: number;
  tarifPersen?: number;
  nilaiPajak: number;
  kodeBilling?: string;
  billingExpiredAt?: string;
  ntpn?: string;
  ntb?: string;
  tanggalLunasPajak?: string;
  statusPajak?: number; // 0 BelumBilling, 1 BillingAktif, 2 LunasNtpn
}

export interface BkuTransaction {
  id: number;
  sekolahId: number;
  tahunAnggaran: number;
  sumberDana: 'BOS' | 'BOP' | string;
  kodePeriode: string;
  bulan: number;
  nomorBku: string;
  nomorBukti: string;
  tanggalTransaksi: string;
  kodeTrx: 'JO' | 'JJ' | 'JG' | 'LL' | 'ST' | string;
  jenisPembayaran: string;
  uraian: string;
  nilaiBrutoMasuk: number;
  nilaiBrutoKeluar: number;
  totalPotonganPajak: number;
  nilaiNettoTransfer: number;
  namaRekanan: string;
  kodeBankRekanan: string;
  namaBankRekanan: string;
  noRekRekanan: string;
  namaPemilikRekRekanan: string;
  npwpRekanan: string;
  namaWpRekanan: string;
  noVaAtauPesanan?: string;
  fileLampiranName?: string;
  fileLampiranPath?: string;
  statusBku: number; // 0 Draft, 1 DiajukanTU, 2 DisetujuiTU, 3 DisetujuiPA, 4 DisetujuiSudin, 5 Lunas, 9 Ditolak
  needSudinApproval: boolean;
  catatanVerifikasi?: string;
  tokenOtpPa?: string;
  tokenExpiredAt?: string;
  tokenCreatedByNrk?: string;
  noJurnalBank?: string;
  tanggalTransferBank?: string;
  statusTransferBank?: string;
  isTutupBuku: boolean;
  detailItems: BkuDetailItem[];
  taxItems: BkuTaxItem[];
}

export interface RkasItem {
  id: number;
  sekolahId: number;
  tahunAnggaran: number;
  sumberDana: string;
  kodePeriode: string;
  kodeSnp: string;
  namaSnp: string;
  kodeKegiatan: string;
  namaKegiatan: string;
  kodeAkun: string;
  namaAkun: string;
  kodeKomponen: string;
  namaKomponen: string;
  spesifikasi: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
  totalPagu: number;
  totalRealisasi: number;
}

export interface DroppingDana {
  id: number;
  sekolahId: number;
  sekolah?: Sekolah;
  tahunAnggaran: number;
  sumberDana: string;
  kodePeriode: string;
  namaPeriode: string;
  nomorSp2d: string;
  tanggalDropping: string;
  nilaiDropping: number;
  keterangan: string;
  isConfirmedToBku: boolean;
  tanggalKonfirmasi?: string;
  bkuTransactionId?: number;
}

export interface NpdBop {
  id: number;
  sekolahId: number;
  tahunAnggaran: number;
  kodePeriode: string;
  nomorNpd: string;
  tanggalNpd: string;
  uraian: string;
  nilaiPengajuan: number;
  statusNpd: number; // 0 Draft, 1 Diajukan, 2 PA, 3 Sudin, 4 Terkirim SIPKD, 9 Tolak
  nomorSipkd?: string;
  tanggalKirimSipkd?: string;
  catatan?: string;
}

export interface BankMutation {
  id: number;
  sekolahId: number;
  sumberDana: string;
  nomorRekening: string;
  tanggalTransaksi: string;
  nomorReferensi: string;
  uraian: string;
  tipeMutasi: 'K' | 'D';
  nominal: number;
  saldoAkhir: number;
  kodeTrx: string;
}

export interface BapKasReport {
  id: number;
  sekolahId: number;
  tahunAnggaran: number;
  sumberDana: string;
  kodePeriode: string;
  nomorBap: string;
  tanggalBap: string;
  saldoBku: number;
  saldoRekeningKoran: number;
  saldoKasTunai: number;
  pecahan100rb: number;
  pecahan50rb: number;
  pecahan20rb: number;
  pecahan10rb: number;
  pecahan5rb: number;
  pecahan2rb: number;
  pecahan1rb: number;
  selisihKas: number;
  keteranganSelisih: string;
  statusBap: number; // 0 Draft, 1 PA, 2 Dinas
  isTutupBuku: boolean;
}

export interface SetoranSts {
  id: number;
  sekolahId: number;
  tahunAnggaran: number;
  sumberDana: string;
  kodePeriode: string;
  nomorSts: string;
  tanggalSts: string;
  jenisSetoran: string;
  uraian: string;
  nilaiSetor: number;
  rekeningTujuan: string;
  statusSts: number;
}

export interface BkuCorrection {
  id: number;
  bkuTransactionId: number;
  bkuTransaction?: BkuTransaction;
  sekolahId: number;
  sumberDana: string;
  jenisKoreksi: string;
  nilaiSebelum: number;
  nilaiSesudah: number;
  kodeAkunSebelum?: string;
  kodeAkunSesudah?: string;
  alasan: string;
  statusKoreksi: number;
  createdAt: string;
}
