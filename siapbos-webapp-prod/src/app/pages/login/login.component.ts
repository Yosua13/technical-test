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
            <!-- Left #FF9A00 Creative Brand Showcase Panel -->
            <div class="col-lg-5 d-none d-lg-flex flex-column justify-content-between p-4 p-xl-5 text-white left-editorial">
              <div>
                <a routerLink="/landingpage" class="text-decoration-none text-white small d-inline-flex align-items-center gap-1 mb-4 fw-semibold" style="opacity: 0.9;">
                  <i class="bi bi-arrow-left"></i> Kembali ke Landing Page
                </a>
                <div class="d-flex align-items-center gap-3 mb-3">
                  <div class="logo-crest-dark">
                    <img src="assets/img/login/Logo.png" alt="Logo Resmi SIAP BOS" width="52" height="52">
                  </div>
                  <div>
                    <div class="fw-extrabold fs-4 lh-1">SIAP BOSP &amp; BOP</div>
                    <small class="text-white" style="opacity: 0.9;">Dinas Pendidikan Provinsi DKI Jakarta</small>
                  </div>
                </div>
              </div>

              <div class="text-center my-2 p-3 rounded-4 bg-white shadow-sm">
                <img src="assets/img/login/SIAP BOS_login_ilustrasi.png"
                     alt="Ilustrasi SIAP BOS"
                     class="img-fluid animate-float"
                     style="max-height: 240px; object-fit: contain;">
              </div>

              <div class="d-flex flex-wrap gap-2">
                <span class="badge rounded-pill bg-white text-dark fw-bold px-3 py-2">
                  <i class="bi bi-grid-1x2-fill text-warning me-1"></i>5 Menu Utama
                </span>
                <span class="badge rounded-pill bg-white text-dark fw-bold px-3 py-2">
                  <i class="bi bi-database-check text-warning me-1"></i>Schema: auth · oauth · siap
                </span>
              </div>
            </div>

            <!-- Right Form Panel -->
            <div class="col-lg-7 p-4 p-md-5 bg-white d-flex flex-column justify-content-center">
              <div class="d-flex justify-content-between align-items-center mb-4">
                <div class="d-flex align-items-center gap-3">
                  <div class="siap-logo-emblem">
                    <img src="assets/img/login/Logo.png" alt="Logo SIAP BOS" width="44" height="44">
                  </div>
                  <div>
                    <div class="fw-extrabold text-uppercase small" style="color: #FF8000; letter-spacing: 0.04em;">
                      SIAP BOSP &amp; BOP DKI JAKARTA
                    </div>
                    <h4 class="fw-bold mb-0 text-dark">Selamat Datang, Silakan Login</h4>
                  </div>
                </div>
                <a routerLink="/landingpage" class="btn btn-sm btn-outline-secondary rounded-pill px-3">
                  <i class="bi bi-house me-1"></i>Home
                </a>
              </div>

              <form [formGroup]="form" (ngSubmit)="onSubmit()">
                <div class="row g-3 mb-3">
                  <div class="col-sm-5">
                    <label class="form-label small fw-bold text-secondary">Tahun Anggaran</label>
                    <select class="form-select rounded-3 fw-semibold" formControlName="tahunAnggaran">
                      @for (y of availableYears(); track y.tahun) {
                        <option [ngValue]="y.tahun">{{ y.label }}</option>
                      }
                    </select>
                  </div>
                  <div class="col-sm-7">
                    <label class="form-label small fw-bold text-secondary">ID Login (Username / NRK)</label>
                    <input type="text" class="form-control rounded-3 fw-semibold"
                           placeholder="Contoh: ADMIN-TDI"
                           formControlName="username">
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label small fw-bold text-secondary">Password</label>
                  <div class="input-group">
                    <input [type]="showPass() ? 'text' : 'password'"
                           class="form-control rounded-start-3 border-end-0"
                           placeholder="Masukkan Password (mis. MonaS123!)"
                           formControlName="password">
                    <button class="btn btn-outline-secondary rounded-end-3 border-start-0 px-3"
                            type="button" (click)="showPass.set(!showPass())" title="Tampilkan / Sembunyikan Password">
                      <i class="bi" [class.bi-eye]="!showPass()" [class.bi-eye-slash]="showPass()"></i>
                    </button>
                  </div>
                </div>

                <!-- Captcha Row -->
                <div class="mb-4">
                  <label class="form-label small fw-bold text-secondary">Kode Captcha (Ketik atau Klik Kode di Kanan)</label>
                  <div class="row g-2 align-items-center">
                    <div class="col-6">
                      <input type="text" class="form-control rounded-3 text-uppercase fw-bold"
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
                  <button class="btn btn-siap flex-grow-1 rounded-pill py-2 fw-bold" type="submit" [disabled]="loading()">
                    @if (loading()) {
                      <span class="spinner-border spinner-border-sm me-2"></span>Memverifikasi...
                    } @else {
                      <i class="bi bi-box-arrow-in-right me-2"></i>SIGN IN
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
                <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-1">
                  <span class="small fw-bold text-dark">
                    <i class="bi bi-lightning-charge-fill text-warning me-1"></i>Login Cepat Akun Referensi &amp; Demo:
                  </span>
                  <span class="badge rounded-pill" style="background: #FFF3E0; color: #D97706;">
                    ADMIN-TDI = MonaS123! (2025)
                  </span>
                </div>
                <div class="d-flex flex-wrap gap-1">
                  @for (acc of demoAccounts(); track acc.username) {
                    <button type="button"
                            class="btn btn-sm rounded-pill px-2 py-1 demo-chip"
                            [class.demo-chip-primary]="acc.username === 'ADMIN-TDI'"
                            (click)="quickDemoLogin(acc)"
                            [disabled]="loading()">
                      <span class="badge me-1"
                            [ngClass]="acc.username === 'ADMIN-TDI' ? 'bg-white text-dark' : 'bg-warning text-dark'">
                        {{ acc.roleCode }}
                      </span>
                      <span class="fw-semibold">{{ acc.username }}</span>
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
                      [class.btn-siap]="passwordTab() === 'change'"
                      (click)="passwordTab.set('change')">
                Ganti Password
              </button>
              <button type="button" class="btn btn-sm rounded-pill fw-semibold"
                      [class.btn-siap]="passwordTab() === 'forgot'"
                      (click)="passwordTab.set('forgot')">
                Lupa Password (OTP NRK)
              </button>
            </div>

            @if (passwordTab() === 'change') {
              <form [formGroup]="resetForm" (ngSubmit)="submitChangePassword()">
                <div class="mb-3">
                  <label class="form-label small fw-semibold">Username / NRK</label>
                  <input type="text" class="form-control" formControlName="nrk" placeholder="Contoh: ADMIN-TDI atau 199003">
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
                <div class="alert alert-warning py-2 px-3 small mb-3">
                  <i class="bi bi-info-circle me-1"></i>
                  Reset mandiri menggunakan NRK/Username + kode OTP verifikasi. Untuk simulasi demo gunakan kode OTP: <strong>123456</strong>.
                </div>
                <div class="mb-3">
                  <label class="form-label small fw-semibold">Username / NRK Terdaftar</label>
                  <input type="text" class="form-control" formControlName="identifier" placeholder="Contoh: ADMIN-TDI">
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
      background: linear-gradient(135deg, #FFF5E4 0%, #FFE0B2 50%, #FFCC80 100%);
    }
    .login-glow {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      pointer-events: none;
      opacity: 0.45;
    }
    .login-glow-1 {
      width: 380px;
      height: 380px;
      background: #FF9A00;
      top: -100px;
      right: -60px;
    }
    .login-glow-2 {
      width: 320px;
      height: 320px;
      background: #FF6D00;
      bottom: -90px;
      left: -60px;
    }
    .login-shell {
      max-width: 1040px;
      border-radius: 26px;
      box-shadow: 0 24px 60px rgba(255, 122, 0, 0.22);
      border: 2px solid rgba(255, 154, 0, 0.35) !important;
    }
    .left-editorial {
      background: linear-gradient(155deg, #FF9A00 0%, #FF7700 65%, #E65100 100%);
    }
    .logo-crest-dark {
      width: 68px;
      height: 68px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.2);
      border: 2px solid #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.16);
    }
    .logo-crest-dark img {
      filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.25));
    }
    .captcha-box {
      background: linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%);
      color: #9A3412;
      border: 2px dashed #FF9A00;
      transition: transform 0.15s ease, background-color 0.2s ease;
    }
    .captcha-box:hover {
      background: #FFE0B2;
      transform: translateY(-1px);
    }
    .demo-chip {
      font-size: 0.74rem;
      border: 1px solid rgba(255, 154, 0, 0.35);
      background: #FFFBF5;
      color: #1e293b;
      transition: all 0.18s ease;
    }
    .demo-chip:hover {
      border-color: #FF9A00;
      background-color: #FFF3E0;
      transform: translateY(-1px);
    }
    .demo-chip-primary {
      background: linear-gradient(135deg, #FF9A00 0%, #E67E00 100%);
      color: #ffffff !important;
      border-color: #FF9A00;
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
    { tahun: 2025, label: '2025 (Referensi SIAP Training)' },
    { tahun: 2026, label: '2026 (Tahun Berjalan)' },
    { tahun: 2024, label: '2024' }
  ]);
  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly showPass = signal(false);
  readonly showResetModal = signal(false);
  readonly passwordTab = signal<'change' | 'forgot'>('change');

  readonly form = this.fb.nonNullable.group({
    tahunAnggaran: [2025, Validators.required],
    username: ['ADMIN-TDI', Validators.required],
    password: ['MonaS123!', Validators.required],
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
      this.router.navigate(['/bos-negeri/dashboard']);
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
            this.toast.success(`Selamat datang, ${res.data.user.namaLengkap} (TA ${res.data.tahunAnggaran})`);
            this.router.navigate(['/bos-negeri/dashboard']);
          }
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.error(err?.error?.message || 'Login gagal. Periksa kredensial Anda.');
          this.loadCaptcha();
        }
      });
  }

  quickDemoLogin(acc: any): void {
    const username = typeof acc === 'string' ? acc : acc.username;
    const password = acc?.defaultPassword || (username === 'ADMIN-TDI' ? 'MonaS123!' : 'password123');
    const tahun = username === 'ADMIN-TDI' ? 2025 : (this.form.value.tahunAnggaran || 2025);
    this.form.patchValue({ username, password, tahunAnggaran: tahun });
    this.loading.set(true);
    this.auth
      .login({
        username,
        password,
        tahunAnggaran: tahun,
        captchaInput: '',
        captchaToken: '',
        skipCaptchaDemo: true
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          if (res.success) {
            this.toast.success(`Login Berhasil: ${res.data.user.namaLengkap} (${res.data.user.roleCode})`);
            this.router.navigate(['/bos-negeri/dashboard']);
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
