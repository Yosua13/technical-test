export function normalizeUtcIso(value?: string | null): string {
  if (!value) return '';
  const s = String(value).trim();
  if (!s) return '';
  // Treat ISO timestamps without an explicit Z / timezone offset as UTC (matching backend DateTime.UtcNow).
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    return `${s}Z`;
  }
  return s;
}

export function parseUtcTimestampMs(value?: string | null): number {
  const iso = normalizeUtcIso(value);
  if (!iso) return NaN;
  return new Date(iso).getTime();
}

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
  roleCode: 'ADMIN-TDI' | 'ADMIN-DINAS' | 'SUDIN' | 'PA-NEGERI' | 'TU-NEGERI' | 'PK-NEGERI' | string;
  shortCode?: string;
  roleName: string;
  roles?: string[];
  requiresSchoolPicker?: boolean;
  jabatan: string;
  wilayahSudin: string;
  sekolahId?: number | null;
  isActive?: boolean;
  isLocked?: boolean;
  sekolah?: Sekolah | null;
}

export interface AppMenu {
  id?: number;
  nama: string;
  link: string;
  icon: string;
  requiresSekolah?: boolean;
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
  kodeTrx: 'JO' | 'JJ' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | string;
  jenisPembayaran: string;
  caraPembayaran?: string;
  isVirtualAccount?: boolean;
  parentBkuId?: number | null;
  parentNomorBku?: string | null;
  nomorArsip?: string;
  namaBidang?: string;
  namaSnp?: string;
  masaPajak?: string;
  tahunPajak?: number | null;
  tarifPersen?: number | null;
  dasarPengenaanPajak?: number | null;
  uraian: string;
  nilaiBrutoMasuk: number;
  nilaiBrutoKeluar: number;
  totalPotonganPajak: number;
  nilaiNettoTransfer: number;
  namaRekanan: string;
  alamatRekanan?: string;
  kodeBankRekanan: string;
  namaBankRekanan: string;
  noRekRekanan: string;
  namaPemilikRekRekanan: string;
  npwpRekanan: string;
  namaWpRekanan: string;
  alamatWpRekanan?: string;
  noVaAtauPesanan?: string;
  stanVa?: string;
  kodeReffVa?: string;
  fileLampiranName?: string;
  fileLampiranPath?: string;
  statusBku: number; // 0 Draft, 1 DiajukanTU, 2 DisetujuiTU, 3 DisetujuiPA, 4 DisetujuiSudin, 5 Lunas, 9 Ditolak
  needSudinApproval: boolean;
  catatanVerifikasi?: string;
  submittedAt?: string;
  approvedByTuAt?: string;
  approvedByPaAt?: string;
  approvedBySudinAt?: string;
  createdBy?: string;
  createdAt?: string;
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

export interface MigrasiPaskRinci {
  id: number;
  migrasiPaskId: number;
  kodeKegiatan: string;
  namaKegiatan: string;
  kodeRekening: string;
  namaRekening: string;
  anggaran: number;
  akbPerPeriode: number;
  nilaiSebelum: number;
  nilaiNpd: number;
}

export interface MigrasiPask {
  id: number;
  batchKode: string;
  sekolahId: number;
  sekolah?: Sekolah;
  tahunAnggaran: number;
  sumberDana: 'BOS' | 'BOP';
  kodePeriode: string;
  namaPeriode: string;
  kodeSubgiat: string;
  namaSubgiat: string;
  namaPask: string;
  program: string;
  nomorDpaSkpd: string;
  sumberDanaLabel: string;
  totalDana: number;
  importedBy: string;
  importedAt: string;
  fileName: string;
  rincians: MigrasiPaskRinci[];
  alreadyUsedInPeriode?: boolean;
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
  migrasiPaskId?: number | null;
  migrasiPask?: MigrasiPask | null;
  program?: string;
  nomorDpaSkpd?: string;
  kodeSubgiat?: string;
  namaSubgiat?: string;
  namaPask?: string;
  statusDropping: number; // 0 Draft PK, 1 Menunggu TU, 2 Menunggu PA, 3 Menunggu Dinas/Sudin, 4 Cair, 9 Ditolak
  catatan?: string;
  createdBy?: string;
  tuApprovedBy?: string;
  paApprovedBy?: string;
  dinasApprovedBy?: string;
  isConfirmedToBku: boolean;
  tanggalKonfirmasi?: string;
  bkuTransactionId?: number;
}

export interface NpdBop {
  id: number;
  sekolahId: number;
  sekolah?: Sekolah;
  tahunAnggaran: number;
  kodePeriode: string;
  nomorNpd: string;
  tanggalNpd: string;
  uraian: string;
  nilaiPengajuan: number;
  statusNpd: number; // 0 Draft PK, 1 Menunggu TU, 2 Menunggu PA, 3 Menunggu Sudin, 4 Disetujui & Cair SIPKD, 9 Ditolak
  migrasiPaskId?: number | null;
  migrasiPask?: MigrasiPask | null;
  program?: string;
  nomorDpaSkpd?: string;
  kodeSubgiat?: string;
  namaSubgiat?: string;
  namaPask?: string;
  sumberDanaLabel?: string;
  createdBy?: string;
  tuApprovedBy?: string;
  paApprovedBy?: string;
  sudinApprovedBy?: string;
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

export interface VaStepTrace {
  stepName: string;
  endpoint: string;
  responseCode: string;
  stan?: string;
  kodeReff?: string;
  message: string;
  timestamp: string;
}

export interface VaTransferResponse {
  bit39: string;
  message: string;
  noJurnalBank: string;
  stan: string;
  kodeReff: string;
  tanggalTransfer: string;
  nominalDitransfer: number;
  sisaSaldoSekolah: number;
  steps: VaStepTrace[];
}
