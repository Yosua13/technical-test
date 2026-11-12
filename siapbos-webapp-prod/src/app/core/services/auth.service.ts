import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiResponse, AppModule, LoginResponse, Sekolah, UserProfile } from '../models/siapbos.models';
import { ToastService } from './toast.service';

const STORAGE_KEY = 'siapbos_session_v1';
const SEKOLAH_KEY = 'siapbos_selected_sekolah_id';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  private readonly sessionSignal = signal<LoginResponse | null>(this.loadSession());
  readonly selectedSekolahId = signal<number>(this.loadSelectedSekolahId());
  readonly sekolahList = signal<Sekolah[]>([]);

  readonly session = this.sessionSignal.asReadonly();
  readonly isLoggedIn = computed(() => !!this.sessionSignal()?.accessToken);
  readonly currentUser = computed<UserProfile | null>(() => this.sessionSignal()?.user ?? null);
  readonly tahunAnggaran = computed<number>(() => this.sessionSignal()?.tahunAnggaran ?? 2026);
  readonly listAplikasi = computed<AppModule[]>(() => this.sessionSignal()?.listAplikasi ?? []);

  readonly activeSekolah = computed<Sekolah | null>(() => {
    const userSekolah = this.currentUser()?.sekolah;
    const all = this.sekolahList();
    const selId = this.selectedSekolahId();
    if (all.length > 0) {
      return all.find((s) => s.id === selId) ?? all[0];
    }
    return userSekolah ?? null;
  });

  getToken(): string | null {
    return this.sessionSignal()?.accessToken ?? null;
  }

  getCaptcha(): Observable<ApiResponse<{ captchaToken: string; captchaCode: string }>> {
    return this.http.get<ApiResponse<{ captchaToken: string; captchaCode: string }>>('/auth-server/oauth/captcha');
  }

  getDemoAccounts(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>('/auth-server/api/auth/demo-accounts');
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

  quickSwitchRole(roleCode: string): Observable<ApiResponse<LoginResponse>> {
    const sekolahId = this.selectedSekolahId() || 1;
    return this.http
      .post<ApiResponse<LoginResponse>>('/auth-server/api/auth/quick-switch', {
        roleCode,
        sekolahId,
        tahunAnggaran: this.tahunAnggaran()
      })
      .pipe(
        tap((res) => {
          if (res.success && res.data) {
            this.setSession(res.data);
            this.toast.success(`Role aktif diganti ke ${res.data.user.roleCode} (${res.data.user.namaLengkap})`);
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

  loadSekolahOptions(): Observable<ApiResponse<Sekolah[]>> {
    return this.http.get<ApiResponse<Sekolah[]>>('/auth-server/api/master/sekolah').pipe(
      tap((res) => {
        if (res.success && res.data) {
          this.sekolahList.set(res.data);
          const cur = this.selectedSekolahId();
          if (!res.data.some((s) => s.id === cur) && res.data.length > 0) {
            this.setSelectedSekolah(res.data[0].id);
          }
        }
      })
    );
  }

  setSelectedSekolah(id: number): void {
    this.selectedSekolahId.set(id);
    localStorage.setItem(SEKOLAH_KEY, String(id));
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SEKOLAH_KEY);
    this.sessionSignal.set(null);
    this.sekolahList.set([]);
    this.router.navigate(['/landingpage']);
  }

  private setSession(data: LoginResponse): void {
    this.sessionSignal.set(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (data.user.sekolahId) {
      this.setSelectedSekolah(data.user.sekolahId);
    } else if (!this.selectedSekolahId()) {
      this.setSelectedSekolah(1);
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
    return raw ? Number(raw) || 1 : 1;
  }
}
