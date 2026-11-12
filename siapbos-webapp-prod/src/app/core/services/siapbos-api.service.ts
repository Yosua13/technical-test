import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  BankMutation,
  BapKasReport,
  BkuCorrection,
  BkuSummarySaldo,
  BkuTaxItem,
  BkuTransaction,
  DroppingDana,
  NpdBop,
  RkasItem,
  Sekolah,
  SetoranSts
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

  getDroppingSekolah(sekolahId: number, tahun: number, sumberDana: string): Observable<ApiResponse<DroppingDana[]>> {
    return this.http.get<ApiResponse<DroppingDana[]>>(`${this.prefix(sumberDana)}/konfirmasi-dana`, { params: { sekolahId, tahun } });
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

  createBku(sumberDana: string, payload: any): Observable<ApiResponse<BkuTransaction>> {
    return this.http.post<ApiResponse<BkuTransaction>>(`${this.prefix(sumberDana)}/input-spj`, payload);
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

  batalTutupBuku(sumberDana: string, sekolahId: number, tahun: number, kodePeriode: string): Observable<ApiResponse<BapKasReport>> {
    return this.http.post<ApiResponse<BapKasReport>>(`${this.prefix(sumberDana)}/penutupan/batal-tutup-buku`, { sekolahId, tahunAnggaran: tahun, sumberDana, kodePeriode });
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

  // BOP Specific (NPD & Koreksi)
  getNpdBop(sekolahId: number, tahun: number): Observable<ApiResponse<NpdBop[]>> {
    return this.http.get<ApiResponse<NpdBop[]>>('/api-bop/npd', { params: { sekolahId, tahun } });
  }

  createNpdBop(payload: any): Observable<ApiResponse<NpdBop>> {
    return this.http.post<ApiResponse<NpdBop>>('/api-bop/npd', payload);
  }

  ajukanNpdBop(id: number): Observable<ApiResponse<NpdBop>> {
    return this.http.post<ApiResponse<NpdBop>>(`/api-bop/npd/${id}/ajukan`, {});
  }

  approveNpdPa(id: number, disetujui: boolean, catatan?: string): Observable<ApiResponse<NpdBop>> {
    return this.http.post<ApiResponse<NpdBop>>(`/api-bop/npd/${id}/approve-pa`, { disetujui, catatan });
  }

  approveNpdSudin(id: number, disetujui: boolean, catatan?: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`/api-bop/npd/${id}/approve-sudin`, { disetujui, catatan });
  }

  getKoreksiBop(sekolahId: number, sumberDana = 'BOP'): Observable<ApiResponse<BkuCorrection[]>> {
    return this.http.get<ApiResponse<BkuCorrection[]>>('/api-bop/koreksi', { params: { sekolahId, sumberDana } });
  }

  createKoreksiBop(payload: any): Observable<ApiResponse<BkuCorrection>> {
    return this.http.post<ApiResponse<BkuCorrection>>('/api-bop/koreksi', payload);
  }

  approveKoreksiSudin(id: number, disetujui: boolean): Observable<ApiResponse<BkuCorrection>> {
    return this.http.post<ApiResponse<BkuCorrection>>(`/api-bop/koreksi/${id}/approve-sudin`, { disetujui });
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

  getUsers(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>('/auth-server/api/pengguna');
  }

  createUser(payload: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>('/auth-server/api/pengguna', payload);
  }

  updateUser(id: number, payload: any): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`/auth-server/api/pengguna/${id}`, payload);
  }

  updateSekolah(id: number, payload: any): Observable<ApiResponse<Sekolah>> {
    return this.http.put<ApiResponse<Sekolah>>(`/auth-server/api/master/sekolah/${id}`, payload);
  }

  getRoles(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>('/auth-server/api/otoritas');
  }

  getAplikasi(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>('/auth-server/api/aplikasi');
  }

  getMenus(kodeAplikasi?: string): Observable<ApiResponse<any[]>> {
    const params: any = {};
    if (kodeAplikasi) params.kodeAplikasi = kodeAplikasi;
    return this.http.get<ApiResponse<any[]>>('/auth-server/api/menu', { params });
  }

  // Uploaders
  uploadInvoicePdf(file: File): Observable<ApiResponse<any>> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ApiResponse<any>>('/uploader/api/v1/minio/upload', fd);
  }

  uploadRkasExcel(file: File): Observable<ApiResponse<any>> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ApiResponse<any>>('/file-uploader/api/file-uploader/upload-rkas', fd);
  }
}
