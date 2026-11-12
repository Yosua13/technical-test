import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiResponse, AppMenu, AppModule, LoginResponse, Sekolah, UserProfile } from '../models/siapbos.models';

const STORAGE_KEY = 'siapbos_session_v1';
const SEKOLAH_KEY = 'siapbos_selected_sekolah_id';
const SEKOLAH_CONFIRMED_KEY = 'siapbos_sekolah_confirmed';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly sessionSignal = signal<LoginResponse | null>(this.loadSession());
  readonly selectedSekolahId = signal<number>(this.loadSelectedSekolahId());
  readonly sekolahConfirmed = signal<boolean>(this.loadSekolahConfirmed());
  readonly sekolahList = signal<Sekolah[]>([]);
  readonly showSekolahPickerModal = signal<boolean>(false);
  readonly pendingSekolahUrl = signal<string | null>(null);

  readonly session = this.sessionSignal.asReadonly();
  readonly isLoggedIn = computed(() => !!this.sessionSignal()?.accessToken);
  readonly currentUser = computed<UserProfile | null>(() => this.sessionSignal()?.user ?? null);
  readonly tahunAnggaran = computed<number>(() => this.sessionSignal()?.tahunAnggaran ?? 2025);
  readonly listAplikasi = computed<AppModule[]>(() => this.sessionSignal()?.listAplikasi ?? []);

  readonly requiresSchoolPicker = computed<boolean>(() => {
    const u = this.currentUser();
    if (!u) return false;
    if (typeof u.requiresSchoolPicker === 'boolean') return u.requiresSchoolPicker;
    const roles = this.getUserRoles();
    return roles.includes('ADMIN-TDI') || roles.includes('ADMIN-DINAS') || roles.includes('SUDIN');
  });

  readonly activeSekolah = computed<Sekolah | null>(() => {
    const userSekolah = this.currentUser()?.sekolah;
    const all = this.sekolahList();
    const selId = this.selectedSekolahId();
    if (selId > 0 && all.length > 0) {
      return all.find((s) => s.id === selId) ?? null;
    }
    if (!this.requiresSchoolPicker()) {
      return userSekolah ?? all[0] ?? null;
    }
    return null;
  });

  getToken(): string | null {
    return this.sessionSignal()?.accessToken ?? null;
  }

  getUserRoles(): string[] {
    const u = this.currentUser();
    if (!u) return [];
    const list = [...(u.roles ?? [])];
    if (u.roleCode && !list.includes(u.roleCode)) list.unshift(u.roleCode);
    return list;
  }

  hasRole(...targetRoles: string[]): boolean {
    const userRoles = this.getUserRoles();
    return targetRoles.some((r) => userRoles.includes(r));
  }

  findMenuMeta(url: string): { app: AppModule; menu: AppMenu } | null {
    const clean = url.split('?')[0].split('#')[0];
    const parts = clean.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const root = parts[0] === 'bop-negeri' ? 'bku-bop' : parts[0];
    const sub = parts[1];
    for (const app of this.listAplikasi()) {
      if (app.link === root) {
        const mn = app.menu.find((m) => m.link === sub);
        if (mn) return { app, menu: mn };
      }
    }
    return null;
  }

  hasMenuAccess(url: string): boolean {
    const clean = url.split('?')[0].split('#')[0];
    const parts = clean.split('/').filter(Boolean);
    if (parts.length === 0) return true;
    const root = parts[0] === 'bop-negeri' ? 'bku-bop' : parts[0];
    const sub = parts[1] ?? '';

    const app = this.listAplikasi().find((a) => a.link === root);
    if (!app) {
      // Allow /sekolah/konfirmasi-rekening only if user has ADMN Konfirmasi Saldo Rekening or sekolah-level role
      if (root === 'sekolah' && sub === 'konfirmasi-rekening') {
        return this.hasRole('ADMIN-TDI', 'PK-NEGERI', 'PA-NEGERI');
      }
      return false;
    }
    if (!sub) return app.menu.length > 0;
    if (app.menu.some((m) => m.link === sub)) return true;

    // Izinkan akses Lihat Detail BKU / Batal Transfer SPJ bagi user dengan menu pengajuan, persetujuan, pembayaran, atau batal transfer
    const actionSegment = parts[2] ?? '';
    if (sub === 'input-bku' && actionSegment === 'detail') {
      const detailAllowedMenus = [
        'input-bku',
        'pengajuan-bku',
        'pengajuan-pembayaran-bku',
        'persetujuan-bku-tu',
        'persetujuan-bku-pa',
        'permohonan-token',
        'pembayaran-bku',
        'pembayaran-pajak-bku',
        'pembayaran-pajak-bop',
        'batal-transfer-spj',
        'persetujuan-batal-tf-spj'
      ];
      if (app.menu.some((m) => detailAllowedMenus.includes(m.link))) return true;
    }
    if (sub === 'batal-transfer-spj' && actionSegment === 'detail') {
      if (app.menu.some((m) => m.link === 'batal-transfer-spj' || m.link === 'persetujuan-batal-tf-spj')) return true;
    }

    // Allow alias dashboard/route mappings when base module menu exists in DB
    if (root === 'user-management' && sub === 'sekolah') {
      return app.menu.some((m) => m.link === 'master-sekolah');
    }
    return false;
  }

  getFirstAllowedRoute(): string {
    for (const app of this.listAplikasi()) {
      if (app.menu && app.menu.length > 0) {
        return `/${app.link}/${app.menu[0].link}`;
      }
    }
    return '/landingpage';
  }

  getCaptcha(): Observable<ApiResponse<{ captchaToken: string; captchaCode: string }>> {
    return this.http.get<ApiResponse<{ captchaToken: string; captchaCode: string }>>('/auth-server/oauth/captcha');
  }

  login(payload: {
    username: string;
    password: string;
    tahunAnggaran: number;
    captchaInput: string;
    captchaToken: string;
    skipCaptchaDemo?: boolean;
  }): Observable<ApiResponse<LoginResponse>> {
    return this.http.post<ApiResponse<LoginResponse>>('/auth-server/oauth/token', payload).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this.setSession(res.data);
        }
      })
    );
  }

  refreshSession(): Observable<ApiResponse<LoginResponse>> {
    const tahun = this.tahunAnggaran();
    return this.http
      .get<ApiResponse<LoginResponse>>('/auth-server/api/auth/me', { params: { tahunAnggaran: tahun } })
      .pipe(
        tap((res) => {
          if (res.success && res.data) {
            const cur = this.sessionSignal();
            const merged: LoginResponse = {
              ...res.data,
              accessToken: res.data.accessToken || cur?.accessToken || ''
            };
            this.sessionSignal.set(merged);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          }
        })
      );
  }

  changePassword(payload: { nrk: string; sandiLama: string; sandiBaru: string }): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>('/auth-server/api/auth/change-password', payload);
  }

  forgotPasswordDemo(payload: { identifier: string; otpDemo: string; sandiBaru: string }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>('/auth-server/api/auth/forgot-password-demo', payload);
  }

  getPublicTahunAnggaran(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>('/auth-server/api/public/tahun-anggaran');
  }

  getPublicLandingSummary(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>('/auth-server/api/public/landing-summary');
  }

  loadSekolahOptions(filters?: { wilayah?: string; jenjang?: string; search?: string }): Observable<ApiResponse<Sekolah[]>> {
    const params: any = {};
    if (filters?.wilayah) params.wilayah = filters.wilayah;
    if (filters?.jenjang) params.jenjang = filters.jenjang;
    if (filters?.search) params.search = filters.search;

    return this.http.get<ApiResponse<Sekolah[]>>('/auth-server/api/master/sekolah', { params }).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this.sekolahList.set(res.data);
          // Single-school roles auto-bind strictly to their school
          if (!this.requiresSchoolPicker() && res.data.length > 0) {
            this.setSelectedSekolah(res.data[0].id, true);
          }
        }
      })
    );
  }

  setSelectedSekolah(id: number, confirmed = true): void {
    this.selectedSekolahId.set(id);
    localStorage.setItem(SEKOLAH_KEY, String(id));
    if (confirmed && id > 0) {
      this.sekolahConfirmed.set(true);
      localStorage.setItem(SEKOLAH_CONFIRMED_KEY, '1');
    } else if (!confirmed) {
      this.sekolahConfirmed.set(false);
      localStorage.removeItem(SEKOLAH_CONFIRMED_KEY);
    }
  }

  confirmSekolah(sekolah: Sekolah): void {
    this.setSelectedSekolah(sekolah.id, true);
    this.showSekolahPickerModal.set(false);
    const pending = this.pendingSekolahUrl();
    this.pendingSekolahUrl.set(null);
    if (pending) {
      this.router.navigateByUrl(pending);
    }
  }

  openSekolahPicker(pendingUrl?: string): void {
    if (pendingUrl) this.pendingSekolahUrl.set(pendingUrl);
    if (this.sekolahList().length === 0) {
      this.loadSekolahOptions().subscribe();
    }
    this.showSekolahPickerModal.set(true);
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SEKOLAH_KEY);
    localStorage.removeItem(SEKOLAH_CONFIRMED_KEY);
    this.sessionSignal.set(null);
    this.sekolahList.set([]);
    this.selectedSekolahId.set(0);
    this.sekolahConfirmed.set(false);
    this.showSekolahPickerModal.set(false);
    this.pendingSekolahUrl.set(null);
    this.router.navigate(['/landingpage']);
  }

  private setSession(data: LoginResponse): void {
    this.sessionSignal.set(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    const needPicker =
      data.user.requiresSchoolPicker ??
      (['ADMIN-TDI', 'ADMIN-DINAS', 'SUDIN'].includes(data.user.roleCode));

    if (!needPicker && data.user.sekolahId) {
      this.setSelectedSekolah(data.user.sekolahId, true);
    } else if (needPicker) {
      // Multi-school / Superadmin wajib memilih sekolah via DataTables Sekolah saat masuk modul operasional
      this.setSelectedSekolah(0, false);
    } else {
      this.setSelectedSekolah(data.user.sekolahId || 0, !!data.user.sekolahId);
    }
  }

  private loadSession(): LoginResponse | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as LoginResponse) : null;
    } catch {
      return null;
    }
  }

  private loadSelectedSekolahId(): number {
    const raw = localStorage.getItem(SEKOLAH_KEY);
    return raw ? Number(raw) || 0 : 0;
  }

  private loadSekolahConfirmed(): boolean {
    return localStorage.getItem(SEKOLAH_CONFIRMED_KEY) === '1';
  }
}
