import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="login-canvas min-vh-100 d-flex align-items-center py-4 position-relative overflow-hidden">
      <div class="login-glow login-glow-1"></div>
      <div class="login-glow login-glow-2"></div>

      <div class="container position-relative" style="z-index: 2;">
        <div class="card border-0 overflow-hidden mx-auto login-shell animate-page">
          <div class="row g-0">
            <!-- Left Executive Brand Showcase Panel -->
            <div class="col-lg-5 d-none d-lg-flex flex-column justify-content-between p-4 p-xl-5 text-white left-editorial">
              <div>
                <a routerLink="/landingpage" class="text-decoration-none text-white-50 small d-inline-flex align-items-center gap-1 mb-4 hover-white">
                  <i class="bi bi-arrow-left"></i> Kembali ke Portal Informasi
                </a>
                <div class="d-flex align-items-center gap-2 mb-3">
                  <div class="bg-white rounded-3 p-1 shadow-sm">
                    <img src="assets/img/login/Logo.png" alt="SIAP Logo" height="44">
                  </div>
                  <div>
                    <div class="fw-bold fs-5 lh-1">SIAP BOSP &amp; BOP</div>
                    <small class="text-white-50">Dinas Pendidikan Provinsi DKI Jakarta</small>
                  </div>
                </div>
                <p class="small text-white-50 mb-0" style="line-height: 1.6;">
                  Sistem Penatausahaan &amp; Pelaporan Keuangan Sekolah Negeri Terintegrasi Bank DKI CMS, Pajak DJP MPN, SIPKD, dan SIMPEG.
                </p>
              </div>

              <div class="text-center my-3 p-3 rounded-4" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);">
                <img src="assets/img/login/SIAP%20BOS_login_ilustrasi.png"
                     alt="Ilustrasi SIAP BOS"
                     class="img-fluid animate-float"
                     style="max-height: 235px; object-fit: contain;">
              </div>

              <div class="d-flex flex-wrap gap-2">
                <span class="badge rounded-pill fw-normal px-3 py-2" style="background: rgba(245,158,11,0.18); color: #fcd34d;">
                  <i class="bi bi-shield-lock me-1"></i>JWT Auth + Captcha
                </span>
                <span class="badge rounded-pill fw-normal px-3 py-2" style="background: rgba(16,185,129,0.18); color: #6ee7b7;">
                  <i class="bi bi-hdd-network me-1"></i>6 Microservices
                </span>
              </div>
            </div>

            <!-- Right Form Panel (Crisp High-Contrast & Zero Premature Validation) -->
            <div class="col-lg-7 p-4 p-md-5 bg-white d-flex flex-column justify-content-center">
              <div class="d-flex justify-content-between align-items-start mb-4">
                <div>
                  <span class="badge bg-warning-subtle text-warning-emphasis rounded-pill mb-2">Otentikasi Pengguna</span>
                  <h4 class="fw-bold mb-1 text-dark">Masuk ke SIAP BOSP &amp; BOP</h4>
                  <p class="text-muted small mb-0">Gunakan Username, NRK Pegawai, atau NIP terdaftar.</p>
                </div>
                <a routerLink="/landingpage" class="d-lg-none btn btn-sm btn-outline-secondary rounded-pill">
                  <i class="bi bi-house"></i>
                </a>
              </div>

              <form [formGroup]="form" (ngSubmit)="onSubmit()">
                <div class="row g-3 mb-3">
                  <div class="col-sm-5">
                    <label class="form-label small fw-semibold text-secondary">Tahun Anggaran</label>
                    <select class="form-select rounded-3" formControlName="tahunAnggaran">
                      @for (y of availableYears(); track y.tahun) {
                        <option [ngValue]="y.tahun">{{ y.label }}</option>
                      }
                    </select>
                  </div>
                  <div class="col-sm-7">
                    <label class="form-label small fw-semibold text-secondary">ID Login (Username / NRK)</label>
                    <input type="text" class="form-control rounded-3"
                           placeholder="Contoh: bendahara.sman1"
                           formControlName="username">
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label small fw-semibold text-secondary">Password</label>
                  <div class="input-group">
                    <input [type]="showPass() ? 'text' : 'password'"
                           class="form-control rounded-start-3 border-end-0"
                           placeholder="Masukkan Password"
                           formControlName="password">
                    <button class="btn btn-outline-secondary rounded-end-3 border-start-0 px-3"
                            type="button" (click)="showPass.set(!showPass())" title="Tampilkan / Sembunyikan Password">
                      <i class="bi" [class.bi-eye]="!showPass()" [class.bi-eye-slash]="showPass()"></i>
                    </button>
                  </div>
                </div>

                <!-- Captcha Row -->
                <div class="mb-4">
                  <label class="form-label small fw-semibold text-secondary">Verifikasi Keamanan (Captcha)</label>
                  <div class="row g-2 align-items-center">
                    <div class="col-6">
                      <input type="text" class="form-control rounded-3 text-uppercase fw-semibold"
                             [class.is-invalid]="form.controls.captchaInput.invalid && (form.controls.captchaInput.touched || submitted())"
                             placeholder="Ketik 5 karakter" formControlName="captchaInput">
                    </div>
                    <div class="col-6">
                      <button type="button"
                              class="w-100 btn rounded-3 fw-bold fst-italic d-flex align-items-center justify-content-between px-3 captcha-box"
                              (click)="loadCaptcha()" title="Klik untuk memperbarui Captcha">
                        <span style="letter-spacing: 4px;">{{ captchaCode() || '.....' }}</span>
                        <i class="bi bi-arrow-clockwise"></i>
                      </button>
                    </div>
                  </div>
                </div>

                <div class="d-flex flex-wrap gap-2 mb-3">
                  <button class="btn btn-siap flex-grow-1 rounded-pill py-2 fw-semibold" type="submit" [disabled]="loading()">
                    @if (loading()) {
                      <span class="spinner-border spinner-border-sm me-2"></span>Memverifikasi...
                    } @else {
                      <i class="bi bi-box-arrow-in-right me-2"></i>Masuk Workspace
                    }
                  </button>
                  <button class="btn btn-outline-secondary rounded-pill px-3 py-2 small fw-semibold"
                          type="button" (click)="openPasswordModal('forgot')">
                    <i class="bi bi-key me-1"></i>Lupa / Ganti Sandi
                  </button>
                </div>
              </form>

              <!-- One-Click Demo Accounts Panel -->
              <div class="border-top pt-3 mt-1">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <span class="small fw-bold text-dark">
                    <i class="bi bi-lightning-charge-fill text-warning me-1"></i>Akses Cepat Akun Demo (Interview):
                  </span>
                  <span class="badge bg-light text-muted border">Sandi: password123</span>
                </div>
                <div class="d-flex flex-wrap gap-1">
                  @for (acc of demoAccounts(); track acc.username) {
                    <button type="button"
                            class="btn btn-sm btn-outline-dark rounded-pill px-2 py-1 demo-chip"
                            (click)="quickDemoLogin(acc.username)"
                            [disabled]="loading()">
                      <span class="badge bg-warning text-dark me-1">{{ acc.roleCode }}</span>
                      <span>{{ acc.username }}</span>
                    </button>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Dual-Tab: Ganti Password vs Lupa Password OTP -->
    @if (showResetModal()) {
      <div class="modal-backdrop-custom" (click)="showResetModal.set(false)">
        <div class="modal-dialog-custom" style="max-width: 480px;" (click)="$event.stopPropagation()">
          <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
            <h6 class="mb-0 fw-bold"><i class="bi bi-shield-lock text-warning me-2"></i>Pengaturan Kata Sandi</h6>
            <button type="button" class="btn-close" (click)="showResetModal.set(false)"></button>
          </div>
          <div class="modal-body-scroll">
            <div class="btn-group w-100 bg-light p-1 rounded-pill border mb-3">
              <button type="button" class="btn btn-sm rounded-pill fw-semibold"
                      [class.btn-navy]="passwordTab() === 'change'"
                      (click)="passwordTab.set('change')">
                Ganti Password (Tahu Sandi Lama)
              </button>
              <button type="button" class="btn btn-sm rounded-pill fw-semibold"
                      [class.btn-navy]="passwordTab() === 'forgot'"
                      (click)="passwordTab.set('forgot')">
                Lupa Password (OTP NRK)
              </button>
            </div>

            @if (passwordTab() === 'change') {
              <form [formGroup]="resetForm" (ngSubmit)="submitChangePassword()">
                <div class="mb-3">
                  <label class="form-label small fw-semibold">Username / NRK</label>
                  <input type="text" class="form-control" formControlName="nrk" placeholder="Contoh: bendahara.sman1 atau 199003">
                </div>
                <div class="mb-3">
                  <label class="form-label small fw-semibold">Sandi Lama</label>
                  <input type="password" class="form-control" formControlName="sandiLama">
                </div>
                <div class="mb-3">
                  <label class="form-label small fw-semibold">Sandi Baru (min. 6 karakter)</label>
                  <input type="password" class="form-control" formControlName="sandiBaru">
                </div>
                <div class="d-flex justify-content-end gap-2">
                  <button type="button" class="btn btn-light rounded-pill px-3" (click)="showResetModal.set(false)">Batal</button>
                  <button type="submit" class="btn btn-siap rounded-pill px-4" [disabled]="resetForm.invalid">Simpan Sandi</button>
                </div>
              </form>
            } @else {
              <form [formGroup]="forgotForm" (ngSubmit)="submitForgotPassword()">
                <div class="alert alert-info py-2 px-3 small mb-3">
                  <i class="bi bi-info-circle me-1"></i>
                  Reset mandiri menggunakan NRK/Username + kode OTP verifikasi. Untuk simulasi demo gunakan kode OTP: <strong>123456</strong>.
                </div>
                <div class="mb-3">
                  <label class="form-label small fw-semibold">Username / NRK Terdaftar</label>
                  <input type="text" class="form-control" formControlName="identifier" placeholder="Contoh: bendahara.sman1">
                </div>
                <div class="mb-3">
                  <label class="form-label small fw-semibold">Kode OTP SIMPEG/Email (Demo: 123456)</label>
                  <input type="text" class="form-control fw-bold" formControlName="otpDemo" placeholder="123456">
                </div>
                <div class="mb-3">
                  <label class="form-label small fw-semibold">Password Baru</label>
                  <input type="password" class="form-control" formControlName="sandiBaru" placeholder="Minimal 6 karakter">
                </div>
                <div class="d-flex justify-content-end gap-2">
                  <button type="button" class="btn btn-light rounded-pill px-3" (click)="showResetModal.set(false)">Batal</button>
                  <button type="submit" class="btn btn-siap rounded-pill px-4" [disabled]="forgotForm.invalid">Reset Password</button>
                </div>
              </form>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .login-canvas {
      background: radial-gradient(circle at top left, #16213e 0%, #0b132b 70%);
    }
    .login-glow {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      pointer-events: none;
      opacity: 0.35;
    }
    .login-glow-1 {
      width: 360px;
      height: 360px;
      background: #f59e0b;
      top: -100px;
      right: -60px;
    }
    .login-glow-2 {
      width: 300px;
      height: 300px;
      background: #2563eb;
      bottom: -90px;
      left: -60px;
    }
    .login-shell {
      max-width: 1040px;
      border-radius: 24px;
      box-shadow: 0 30px 70px rgba(0, 0, 0, 0.45);
    }
    .left-editorial {
      background: linear-gradient(160deg, #0f172a 0%, #1e293b 100%);
    }
    .hover-white:hover {
      color: #fff !important;
    }
    .captcha-box {
      background: #0f172a;
      color: #fbbf24;
      border: 1px solid #334155;
      transition: transform 0.15s ease, background-color 0.2s ease;
    }
    .captcha-box:hover {
      background: #1e293b;
      transform: translateY(-1px);
    }
    .demo-chip {
      font-size: 0.72rem;
      border-color: #e2e8f0;
      transition: all 0.18s ease;
    }
    .demo-chip:hover {
      border-color: #f59e0b;
      background-color: #fffbeb;
      color: #0f172a;
      transform: translateY(-1px);
    }
  `]
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly captchaCode = signal('');
  readonly captchaToken = signal('');
  readonly demoAccounts = signal<any[]>([]);
  readonly availableYears = signal<any[]>([
    { tahun: 2026, label: '2026 (Tahun Berjalan)' },
    { tahun: 2025, label: '2025' },
    { tahun: 2024, label: '2024' }
  ]);
  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly showPass = signal(false);
  readonly showResetModal = signal(false);
  readonly passwordTab = signal<'change' | 'forgot'>('change');

  readonly form = this.fb.nonNullable.group({
    tahunAnggaran: [2026, Validators.required],
    username: ['bendahara.sman1', Validators.required],
    password: ['password123', Validators.required],
    captchaInput: ['', Validators.required]
  });

  readonly resetForm = this.fb.nonNullable.group({
    nrk: ['', Validators.required],
    sandiLama: ['', Validators.required],
    sandiBaru: ['', [Validators.required, Validators.minLength(6)]]
  });

  readonly forgotForm = this.fb.nonNullable.group({
    identifier: ['', Validators.required],
    otpDemo: ['123456', Validators.required],
    sandiBaru: ['', [Validators.required, Validators.minLength(6)]]
  });

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/landingpage']);
      return;
    }
    this.loadCaptcha();
    this.auth.getPublicTahunAnggaran().subscribe({
      next: (res) => {
        if (res.success && res.data?.length) this.availableYears.set(res.data);
      }
    });
    this.auth.getDemoAccounts().subscribe({
      next: (res) => {
        if (res.success && res.data) this.demoAccounts.set(res.data);
      }
    });
  }

  openPasswordModal(tab: 'change' | 'forgot'): void {
    this.passwordTab.set(tab);
    this.showResetModal.set(true);
  }

  loadCaptcha(): void {
    this.auth.getCaptcha().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.captchaCode.set(res.data.captchaCode);
          this.captchaToken.set(res.data.captchaToken);
          this.form.patchValue({ captchaInput: res.data.captchaCode });
        }
      }
    });
  }

  onSubmit(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.toast.warning('Mohon lengkapi ID Login, Password, dan Captcha.');
      return;
    }
    const val = this.form.getRawValue();
    this.loading.set(true);
    this.auth
      .login({
        username: val.username,
        password: val.password,
        tahunAnggaran: val.tahunAnggaran,
        captchaInput: val.captchaInput,
        captchaToken: this.captchaToken(),
        skipCaptchaDemo: false
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          if (res.success) {
            this.toast.success(`Selamat datang, ${res.data.user.namaLengkap}`);
            this.router.navigate(['/landingpage']);
          }
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.error(err?.error?.message || 'Login gagal. Periksa kredensial Anda.');
          this.loadCaptcha();
        }
      });
  }

  quickDemoLogin(username: string): void {
    this.loading.set(true);
    this.auth
      .login({
        username,
        password: 'password123',
        tahunAnggaran: this.form.value.tahunAnggaran || 2026,
        captchaInput: '',
        captchaToken: '',
        skipCaptchaDemo: true
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          if (res.success) {
            this.toast.success(`Login Cepat: ${res.data.user.namaLengkap} (${res.data.user.roleCode})`);
            this.router.navigate(['/landingpage']);
          }
        },
        error: () => this.loading.set(false)
      });
  }

  submitChangePassword(): void {
    if (this.resetForm.invalid) return;
    this.auth.changePassword(this.resetForm.getRawValue()).subscribe({
      next: (res) => {
        if (res.success) {
          this.toast.success(res.message);
          this.showResetModal.set(false);
          this.resetForm.reset();
        }
      },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal mengganti sandi.')
    });
  }

  submitForgotPassword(): void {
    if (this.forgotForm.invalid) return;
    this.auth.forgotPasswordDemo(this.forgotForm.getRawValue()).subscribe({
      next: (res) => {
        if (res.success) {
          this.toast.success(res.message);
          this.showResetModal.set(false);
          this.forgotForm.patchValue({ identifier: '', sandiBaru: '' });
        }
      },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal mereset password.')
    });
  }
}
