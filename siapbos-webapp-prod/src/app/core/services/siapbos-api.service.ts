import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  BankMutation,
  BapKasReport,
  BkuSummarySaldo,
  BkuTaxItem,
  BkuTransaction,
  DroppingDana,
  NpdBop,
  RkasItem,
  Sekolah,
  SetoranSts,
  VaTransferResponse
} from '../models/siapbos.models';

@Injectable({ providedIn: 'root' })
export class SiapBosApiService {
  private readonly http = inject(HttpClient);

  private prefix(sumberDana: string): string {
    return sumberDana === 'BOP' ? '/api-bop' : '/api';
  }

  // Dashboard & Summary
  getDashboardSummary(sekolahId: number, tahun: number, sumberDana: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`/api/dashboard/summary`, { params: { sekolahId, tahun, sumberDana } });
  }

  getSummarySaldo(sekolahId: number, tahun: number, sumberDana: string): Observable<ApiResponse<BkuSummarySaldo>> {
    return this.http.get<ApiResponse<BkuSummarySaldo>>(`${this.prefix(sumberDana)}/input-spj/summary`, { params: { sekolahId, tahun } });
  }

  // Master Data (auth-server)
  getPeriodes(tahun: number, sumberDana?: string): Observable<ApiResponse<any[]>> {
    const params: any = { tahun };
    if (sumberDana) params.sumberDana = sumberDana;
    return this.http.get<ApiResponse<any[]>>('/auth-server/api/master/periode', { params });
  }

  updateBatasPengajuan(periodeId: number, payload: { batasPengajuanBelanja: string; isActive: boolean }): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`/auth-server/api/master/periode/${periodeId}/batas-pengajuan`, payload);
  }

  getTaxMasters(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>('/auth-server/api/master/pajak');
  }

  getBasAccounts(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>('/auth-server/api/master/bas');
  }

  // Konfirmasi Rekening & Dropping
  konfirmasiRekeningSekolah(sekolahId: number, payload: any): Observable<ApiResponse<Sekolah>> {
    return this.http.post<ApiResponse<Sekolah>>(`/api/sekolah/${sekolahId}/konfirmasi-rekening`, payload);
  }

  getMigrasiCandidatesDropping(sekolahId: number, tahun: number, sumberDana: string): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.prefix(sumberDana)}/migrasi-candidates`, { params: { sekolahId, tahun } });
  }

  getDroppingSekolah(sekolahId: number, tahun: number, sumberDana: string, filters?: { kodePeriode?: string; status?: number | null; search?: string }): Observable<ApiResponse<DroppingDana[]>> {
    const params: any = { sekolahId, tahun };
    if (filters?.kodePeriode) params.kodePeriode = filters.kodePeriode;
    if (filters?.status !== undefined && filters?.status !== null) params.status = filters.status;
    if (filters?.search) params.search = filters.search;
    return this.http.get<ApiResponse<DroppingDana[]>>(`${this.prefix(sumberDana)}/konfirmasi-dana`, { params });
  }

  getDroppingDetail(droppingId: number, sumberDana: string): Observable<ApiResponse<DroppingDana>> {
    return this.http.get<ApiResponse<DroppingDana>>(`${this.prefix(sumberDana)}/konfirmasi-dana/${droppingId}`);
  }

  createDroppingFromMigrasi(sumberDana: string, payload: { sekolahId: number; migrasiPaskId: number; tanggalDropping?: string; keterangan: string }): Observable<ApiResponse<DroppingDana>> {
    return this.http.post<ApiResponse<DroppingDana>>(`${this.prefix(sumberDana)}/konfirmasi-dana`, payload);
  }

  ajukanDropping(droppingId: number, sumberDana: string): Observable<ApiResponse<DroppingDana>> {
    return this.http.post<ApiResponse<DroppingDana>>(`${this.prefix(sumberDana)}/konfirmasi-dana/${droppingId}/ajukan`, {});
  }

  approveDroppingTu(droppingId: number, sumberDana: string, disetujui: boolean, catatan?: string): Observable<ApiResponse<DroppingDana>> {
    return this.http.post<ApiResponse<DroppingDana>>(`${this.prefix(sumberDana)}/konfirmasi-dana/${droppingId}/approve-tu`, { disetujui, catatan });
  }

  approveDroppingPa(droppingId: number, sumberDana: string, disetujui: boolean, catatan?: string): Observable<ApiResponse<DroppingDana>> {
    return this.http.post<ApiResponse<DroppingDana>>(`${this.prefix(sumberDana)}/konfirmasi-dana/${droppingId}/approve-pa`, { disetujui, catatan });
  }

  approveDroppingDinas(droppingId: number, sumberDana: string, disetujui: boolean, catatan?: string): Observable<ApiResponse<DroppingDana>> {
    return this.http.post<ApiResponse<DroppingDana>>(`${this.prefix(sumberDana)}/konfirmasi-dana/${droppingId}/approve-dinas`, { disetujui, catatan });
  }

  confirmDropping(droppingId: number, sumberDana: string): Observable<ApiResponse<DroppingDana>> {
    return this.http.post<ApiResponse<DroppingDana>>(`${this.prefix(sumberDana)}/konfirmasi-dana/${droppingId}/confirm`, {});
  }

  // RKAS
  getRkasItems(sekolahId: number, tahun: number, sumberDana?: string): Observable<ApiResponse<RkasItem[]>> {
    const params: any = { sekolahId, tahun };
    if (sumberDana) params.sumberDana = sumberDana;
    return this.http.get<ApiResponse<RkasItem[]>>('/api/rkas', { params });
  }

  createRkasItem(payload: Partial<RkasItem>): Observable<ApiResponse<RkasItem>> {
    return this.http.post<ApiResponse<RkasItem>>('/api/rkas', payload);
  }

  // BKU CRUD & Workflow
  getBkuList(sekolahId: number, tahun: number, sumberDana: string, kodePeriode?: string, kodeTrx?: string, statusBku?: number): Observable<ApiResponse<BkuTransaction[]>> {
    const params: any = { sekolahId, tahun };
    if (kodePeriode) params.kodePeriode = kodePeriode;
    if (kodeTrx) params.kodeTrx = kodeTrx;
    if (statusBku !== undefined && statusBku !== null) params.statusBku = statusBku;
    return this.http.get<ApiResponse<BkuTransaction[]>>(`${this.prefix(sumberDana)}/input-spj`, { params });
  }

  getDraftSpjCandidates(sekolahId: number, tahun: number, sumberDana: string, search?: string): Observable<ApiResponse<BkuTransaction[]>> {
    const params: any = { sekolahId, tahun };
    if (search) params.search = search;
    return this.http.get<ApiResponse<BkuTransaction[]>>(`${this.prefix(sumberDana)}/input-spj/draft-spj-candidates`, { params });
  }

  getPenerimaanPajakCandidates(sekolahId: number, tahun: number, sumberDana: string, search?: string): Observable<ApiResponse<BkuTransaction[]>> {
    const params: any = { sekolahId, tahun };
    if (search) params.search = search;
    return this.http.get<ApiResponse<BkuTransaction[]>>(`${this.prefix(sumberDana)}/input-spj/penerimaan-pajak-candidates`, { params });
  }

  getBkuDetail(sumberDana: string, bkuId: number): Observable<ApiResponse<BkuTransaction>> {
    return this.http.get<ApiResponse<BkuTransaction>>(`${this.prefix(sumberDana)}/input-spj/${bkuId}`);
  }

  createBku(sumberDana: string, payload: any): Observable<ApiResponse<BkuTransaction>> {
    return this.http.post<ApiResponse<BkuTransaction>>(`${this.prefix(sumberDana)}/input-spj`, payload);
  }

  updateBku(sumberDana: string, bkuId: number, payload: any): Observable<ApiResponse<BkuTransaction>> {
    return this.http.put<ApiResponse<BkuTransaction>>(`${this.prefix(sumberDana)}/input-spj/${bkuId}`, payload);
  }

  deleteDraftBku(sumberDana: string, bkuId: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(`${this.prefix(sumberDana)}/input-spj/${bkuId}`);
  }

  ajukanPk(sumberDana: string, bkuId: number): Observable<ApiResponse<BkuTransaction>> {
    return this.http.post<ApiResponse<BkuTransaction>>(`${this.prefix(sumberDana)}/workflow/pengajuan-pk/${bkuId}`, {});
  }

  approveTu(sumberDana: string, bkuId: number, disetujui: boolean, catatan?: string): Observable<ApiResponse<BkuTransaction>> {
    return this.http.post<ApiResponse<BkuTransaction>>(`${this.prefix(sumberDana)}/workflow/approval-tu/${bkuId}`, { disetujui, catatan });
  }

  approvePa(sumberDana: string, bkuId: number, disetujui: boolean, catatan?: string): Observable<ApiResponse<BkuTransaction>> {
    return this.http.post<ApiResponse<BkuTransaction>>(`${this.prefix(sumberDana)}/workflow/approval-pa/${bkuId}`, { disetujui, catatan });
  }

  approveSudin(sumberDana: string, bkuId: number, disetujui: boolean, catatan?: string): Observable<ApiResponse<BkuTransaction>> {
    return this.http.post<ApiResponse<BkuTransaction>>(`${this.prefix(sumberDana)}/workflow/approval-sudin/${bkuId}`, { disetujui, catatan });
  }

  // Pembayaran CMS & Pajak MPN
  requestToken(sumberDana: string, bkuId: number, nrk: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.prefix(sumberDana)}/pembayaran/token`, { bkuId, nrk });
  }

  transferSpj(sumberDana: string, bkuId: number, tokenOtp: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.prefix(sumberDana)}/pembayaran/transfer`, { bkuId, tokenOtp });
  }

  vaTransferSpj(sumberDana: string, bkuId: number): Observable<ApiResponse<VaTransferResponse>> {
    return this.http.post<ApiResponse<VaTransferResponse>>(`${this.prefix(sumberDana)}/pembayaran/va-transfer`, { bkuId });
  }

  processTaxAction(sumberDana: string, taxId: number, action: 'create' | 'reset' | 'inquiry' | 'payment'): Observable<ApiResponse<BkuTaxItem>> {
    return this.http.post<ApiResponse<BkuTaxItem>>(`${this.prefix(sumberDana)}/pembayaran/pajak/${taxId}/${action}`, {});
  }

  // Integration Direct (Inquiry Rekening, NPWP, Biller VA PLN / e-Order, Audit Logs, SIMPEG)
  inquiryRekening(kodeBank: string, noRekening: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>('/integration-server/api/bank-dki/inquiryCheckRek', { kodeBank, noRekening });
  }

  inquiryBiller(jenisBiller: string, nomorTagihan: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>('/integration-server/api/bank-dki/biller-inquiry', { jenisBiller, nomorTagihan });
  }

  inquiryNpwp(nomorNpwp: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>('/integration-server/api/npwp/byNomorNpwp', { params: { nomorNpwp } });
  }

  inquiryPajak(payload: {
    kodeTrx: string;
    masaPajak: string;
    tahunPajak: number;
    brutoSpj?: number;
    dasarPengenaanPajak?: number;
    tarifPersen?: number;
    npwp?: string;
    namaWajibPajak?: string;
  }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>('/integration-server/api/pajak/inquiry', payload);
  }

  cekPegawaiSimpeg(nrk: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`/auth-server/api/pengguna/cek-simpeg/${encodeURIComponent(nrk)}`);
  }

  getIntegrationLogs(systemName?: string): Observable<ApiResponse<any[]>> {
    const params: any = {};
    if (systemName) params.systemName = systemName;
    return this.http.get<ApiResponse<any[]>>('/integration-server/api/integration/logs', { params });
  }

  // Mutasi, BAP Kas, Tutup Buku, Setoran STS
  getMutasi(sumberDana: string, sekolahId: number, limit12: boolean): Observable<ApiResponse<BankMutation[]>> {
    return this.http.get<ApiResponse<BankMutation[]>>(`${this.prefix(sumberDana)}/penutupan/mutasi`, { params: { sekolahId, limit12 } });
  }

  getBapKas(sumberDana: string, sekolahId: number, tahun: number): Observable<ApiResponse<BapKasReport[]>> {
    return this.http.get<ApiResponse<BapKasReport[]>>(`${this.prefix(sumberDana)}/penutupan/bap-kas`, { params: { sekolahId, tahun } });
  }

  saveBapKas(sumberDana: string, payload: any): Observable<ApiResponse<BapKasReport>> {
    return this.http.post<ApiResponse<BapKasReport>>(`${this.prefix(sumberDana)}/penutupan/bap-kas`, payload);
  }

  approveBapKas(sumberDana: string, bapId: number, targetStatus: number): Observable<ApiResponse<BapKasReport>> {
    return this.http.post<ApiResponse<BapKasReport>>(`${this.prefix(sumberDana)}/penutupan/bap-kas/${bapId}/approve/${targetStatus}`, {});
  }

  tutupBuku(sumberDana: string, sekolahId: number, tahun: number, kodePeriode: string): Observable<ApiResponse<BapKasReport>> {
    return this.http.post<ApiResponse<BapKasReport>>(`${this.prefix(sumberDana)}/penutupan/tutup-buku`, { sekolahId, tahunAnggaran: tahun, sumberDana, kodePeriode });
  }

  getSts(sumberDana: string, sekolahId: number, tahun: number): Observable<ApiResponse<SetoranSts[]>> {
    return this.http.get<ApiResponse<SetoranSts[]>>(`${this.prefix(sumberDana)}/penutupan/setoran-sts`, { params: { sekolahId, tahun } });
  }

  createSts(sumberDana: string, payload: any): Observable<ApiResponse<SetoranSts>> {
    return this.http.post<ApiResponse<SetoranSts>>(`${this.prefix(sumberDana)}/penutupan/setoran-sts`, payload);
  }

  processSts(sumberDana: string, stsId: number, targetStatus: number): Observable<ApiResponse<SetoranSts>> {
    return this.http.post<ApiResponse<SetoranSts>>(`${this.prefix(sumberDana)}/penutupan/setoran-sts/${stsId}/process/${targetStatus}`, {});
  }

  // BOP Specific (Permohonan NPD dari Migrasi ADM -> 4-Stage Approval -> SIPKD & Auto-Cair)
  getNpdPaskCandidates(sekolahId: number, tahun: number): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>('/api-bop/npd/pask-candidates', { params: { sekolahId, tahun } });
  }

  getNpdBop(sekolahId: number, tahun: number, filters?: { kodePeriode?: string; status?: number | null; search?: string }): Observable<ApiResponse<NpdBop[]>> {
    const params: any = { sekolahId, tahun };
    if (filters?.kodePeriode) params.kodePeriode = filters.kodePeriode;
    if (filters?.status !== undefined && filters?.status !== null) params.status = filters.status;
    if (filters?.search) params.search = filters.search;
    return this.http.get<ApiResponse<NpdBop[]>>('/api-bop/npd', { params });
  }

  getNpdDetail(id: number): Observable<ApiResponse<NpdBop>> {
    return this.http.get<ApiResponse<NpdBop>>(`/api-bop/npd/${id}`);
  }

  createNpdBop(payload: { sekolahId: number; migrasiPaskId: number; tanggalNpd?: string; uraian: string }): Observable<ApiResponse<NpdBop>> {
    return this.http.post<ApiResponse<NpdBop>>('/api-bop/npd', payload);
  }

  ajukanNpdBop(id: number): Observable<ApiResponse<NpdBop>> {
    return this.http.post<ApiResponse<NpdBop>>(`/api-bop/npd/${id}/ajukan`, {});
  }

  approveNpdTu(id: number, disetujui: boolean, catatan?: string): Observable<ApiResponse<NpdBop>> {
    return this.http.post<ApiResponse<NpdBop>>(`/api-bop/npd/${id}/approve-tu`, { disetujui, catatan });
  }

  approveNpdPa(id: number, disetujui: boolean, catatan?: string): Observable<ApiResponse<NpdBop>> {
    return this.http.post<ApiResponse<NpdBop>>(`/api-bop/npd/${id}/approve-pa`, { disetujui, catatan });
  }

  approveNpdSudin(id: number, disetujui: boolean, catatan?: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`/api-bop/npd/${id}/approve-sudin`, { disetujui, catatan });
  }

  getNpdPdfBlob(id: number): Observable<Blob> {
    return this.http.get(`/report-server/pdf/npd/${id}`, { responseType: 'blob' });
  }

  // Report PDF Blob Downloads (for inline PDF viewer / download)
  getLaporanPdfBlob(params: {
    sekolahId: number;
    tahun: number;
    sumberDana: string;
    jenisLaporan: string;
    jenisPeriode: string;
    waktuPeriode: string;
  }): Observable<Blob> {
    return this.http.get('/report-server/pdf/laporan', { params: params as any, responseType: 'blob' });
  }

  getMutasiPdfBlob(params: {
    sekolahId: number;
    sumberDana: string;
    limit12: boolean;
    startDate?: string;
    endDate?: string;
  }): Observable<Blob> {
    const q: any = { sekolahId: params.sekolahId, sumberDana: params.sumberDana, limit12: params.limit12 };
    if (params.startDate) q.startDate = params.startDate;
    if (params.endDate) q.endDate = params.endDate;
    return this.http.get('/report-server/pdf/mutasi', { params: q, responseType: 'blob' });
  }

  // Admin & User Management
  getAdminDropping(tahun: number): Observable<ApiResponse<DroppingDana[]>> {
    return this.http.get<ApiResponse<DroppingDana[]>>('/api/admin/dropping', { params: { tahun } });
  }

  createAdminDropping(payload: any): Observable<ApiResponse<DroppingDana>> {
    return this.http.post<ApiResponse<DroppingDana>>('/api/admin/dropping', payload);
  }

  getHelpdesk(sekolahId?: number): Observable<ApiResponse<any[]>> {
    const params: any = {};
    if (sekolahId) params.sekolahId = sekolahId;
    return this.http.get<ApiResponse<any[]>>('/api/helpdesk', { params });
  }

  createHelpdesk(payload: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>('/api/helpdesk', payload);
  }

  respondHelpdesk(id: number, tanggapanAdmin: string, status = 'RESOLVED'): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`/api/helpdesk/${id}/respond`, { tanggapanAdmin, status });
  }

  // User Management & RBAC (PostgreSQL relational via auth-server)
  getUsers(filters?: {
    search?: string;
    nama?: string;
    email?: string;
    nip?: string;
    nrk?: string;
    otoritas?: string;
    jenjang?: string;
  }): Observable<ApiResponse<any[]>> {
    const params: any = {};
    if (filters?.search) params.search = filters.search;
    if (filters?.nama) params.nama = filters.nama;
    if (filters?.email) params.email = filters.email;
    if (filters?.nip) params.nip = filters.nip;
    if (filters?.nrk) params.nrk = filters.nrk;
    if (filters?.otoritas) params.otoritas = filters.otoritas;
    if (filters?.jenjang) params.jenjang = filters.jenjang;
    return this.http.get<ApiResponse<any[]>>('/auth-server/api/pengguna', { params });
  }

  createUser(payload: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>('/auth-server/api/pengguna', payload);
  }

  updateUser(id: number, payload: any): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`/auth-server/api/pengguna/${id}`, payload);
  }

  deleteUser(id: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(`/auth-server/api/pengguna/${id}`);
  }

  setUsersLock(userIds: number[], flag: boolean): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>('/auth-server/api/pengguna/set-lock', { userIds, flag });
  }

  setUsersAktif(userIds: number[], flag: boolean): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>('/auth-server/api/pengguna/set-aktif', { userIds, flag });
  }

  resetUserPassword(id: number, sandiBaru: string): Observable<ApiResponse<string>> {
    return this.http.put<ApiResponse<string>>(`/auth-server/api/pengguna/${id}/reset-password`, { sandiBaru });
  }

  cekSimpeg(nrk: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`/auth-server/api/pengguna/cek-simpeg/${encodeURIComponent(nrk)}`);
  }

  getPenggunaOtoritas(id: number): Observable<ApiResponse<{ assigned: any[]; available: any[] }>> {
    return this.http.get<ApiResponse<{ assigned: any[]; available: any[] }>>(`/auth-server/api/pengguna/${id}/otoritas`);
  }

  savePenggunaOtoritas(id: number, roleIds: number[]): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`/auth-server/api/pengguna/${id}/otoritas`, { roleIds });
  }

  getPenggunaSekolah(id: number): Observable<ApiResponse<{ assigned: Sekolah[]; available: Sekolah[] }>> {
    return this.http.get<ApiResponse<{ assigned: Sekolah[]; available: Sekolah[] }>>(`/auth-server/api/pengguna/${id}/sekolah`);
  }

  savePenggunaSekolah(id: number, sekolahIds: number[]): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`/auth-server/api/pengguna/${id}/sekolah`, { sekolahIds });
  }

  getPenggunaWilayah(id: number): Observable<ApiResponse<{ assigned: any[]; available: any[] }>> {
    return this.http.get<ApiResponse<{ assigned: any[]; available: any[] }>>(`/auth-server/api/pengguna/${id}/wilayah`);
  }

  savePenggunaWilayah(id: number, kodeWilayahList: string[]): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`/auth-server/api/pengguna/${id}/wilayah`, { kodeWilayahList });
  }

  updateSekolah(id: number, payload: any): Observable<ApiResponse<Sekolah>> {
    return this.http.put<ApiResponse<Sekolah>>(`/auth-server/api/master/sekolah/${id}`, payload);
  }

  getRoles(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>('/auth-server/api/otoritas');
  }

  createOtoritas(payload: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>('/auth-server/api/otoritas', payload);
  }

  updateOtoritas(id: number, payload: any): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`/auth-server/api/otoritas/${id}`, payload);
  }

  deleteOtoritas(id: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(`/auth-server/api/otoritas/${id}`);
  }

  getOtoritasAplikasi(id: number): Observable<ApiResponse<{ assigned: any[]; available: any[] }>> {
    return this.http.get<ApiResponse<{ assigned: any[]; available: any[] }>>(`/auth-server/api/otoritas/${id}/aplikasi`);
  }

  saveOtoritasAplikasi(id: number, moduleIds: number[]): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`/auth-server/api/otoritas/${id}/aplikasi`, { moduleIds });
  }

  getOtoritasMenu(id: number, kodeAplikasi?: string): Observable<ApiResponse<{ kodeAplikasi: string; assignedModules: any[]; assigned: any[]; available: any[] }>> {
    const params: any = {};
    if (kodeAplikasi) params.kodeAplikasi = kodeAplikasi;
    return this.http.get<ApiResponse<any>>(`/auth-server/api/otoritas/${id}/menu`, { params });
  }

  saveOtoritasMenu(id: number, kodeAplikasi: string, menuIds: number[]): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`/auth-server/api/otoritas/${id}/menu`, { kodeAplikasi, menuIds });
  }

  getAplikasi(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>('/auth-server/api/aplikasi');
  }

  updateAplikasi(id: number, payload: any): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`/auth-server/api/aplikasi/${id}`, payload);
  }

  getMenus(kodeAplikasi?: string): Observable<ApiResponse<any[]>> {
    const params: any = {};
    if (kodeAplikasi) params.kodeAplikasi = kodeAplikasi;
    return this.http.get<ApiResponse<any[]>>('/auth-server/api/menu', { params });
  }

  createMenu(payload: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>('/auth-server/api/menu', payload);
  }

  updateMenu(id: number, payload: any): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`/auth-server/api/menu/${id}`, payload);
  }

  // Uploaders
  uploadInvoicePdf(file: File): Observable<ApiResponse<any>> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ApiResponse<any>>('/uploader/api/v1/files/upload', fd);
  }

  uploadRkasExcel(file: File): Observable<ApiResponse<any>> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ApiResponse<any>>('/file-uploader/api/file-uploader/upload-rkas', fd);
  }

  uploadMigrasiDanaExcel(file: File): Observable<ApiResponse<any>> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ApiResponse<any>>('/file-uploader/api/file-uploader/upload-migrasi-dana', fd);
  }

  getAdminMigrasiDana(tahun: number, sekolahId?: number, sumberDana?: string): Observable<ApiResponse<any[]>> {
    const params: any = { tahun };
    if (sekolahId) params.sekolahId = sekolahId;
    if (sumberDana) params.sumberDana = sumberDana;
    return this.http.get<ApiResponse<any[]>>('/api/migrasi-dana', { params });
  }
}
