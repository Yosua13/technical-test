import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
            <!-- Left #FF9A00 Brand & Illustration Panel -->
            <div class="col-lg-5 d-none d-lg-flex flex-column justify-content-center align-items-center p-4 p-xl-5 text-white left-editorial text-center">
              <a routerLink="/landingpage" class="text-decoration-none text-white d-flex flex-column align-items-center mb-4">
                <div class="logo-crest-dark mb-3">
                  <img src="assets/img/login/Logo.png" alt="Logo SIAP BOS" width="56" height="56">
                </div>
                <div class="fw-extrabold fs-4 lh-1">SIAP BOSP &amp; BOP</div>
                <small class="text-white mt-1" style="opacity: 0.9;">Dinas Pendidikan Provinsi DKI Jakarta</small>
              </a>

              <div class="p-3 rounded-4 bg-white shadow-sm w-100">
                <img src="assets/img/login/SIAP BOS_login_ilustrasi.png"
                     alt="Ilustrasi SIAP BOS"
                     class="img-fluid animate-float"
                     style="max-height: 250px; object-fit: contain;">
              </div>
            </div>

            <!-- Right Simple Login Form Panel -->
            <div class="col-lg-7 p-4 p-md-5 bg-white d-flex flex-column justify-content-center">
              <div class="d-flex align-items-center gap-3 mb-4">
                <a routerLink="/landingpage" class="siap-logo-emblem text-decoration-none" title="SIAP BOSP & BOP">
                  <img src="assets/img/login/Logo.png" alt="Logo SIAP BOS" width="44" height="44">
                </a>
                <div>
                  <div class="fw-extrabold text-uppercase small" style="color: #FF9A00; letter-spacing: 0.04em;">
                    SIAP BOSP &amp; BOP
                  </div>
                  <h4 class="fw-bold mb-0 text-dark">Selamat Datang, Silakan Login</h4>
                </div>
              </div>

              <form [formGroup]="form" (ngSubmit)="onSubmit()">
                <div class="mb-3">
                  <label class="form-label small fw-bold text-secondary">Tahun Anggaran</label>
                  <select class="form-select rounded-3" formControlName="tahunAnggaran">
                    <option [ngValue]="null" disabled>Pilih Tahun Anggaran</option>
                    @for (y of availableYears(); track y.tahun) {
                      <option [ngValue]="y.tahun">{{ y.tahun }}</option>
                    }
                  </select>
                </div>

                <div class="mb-3">
                  <label class="form-label small fw-bold text-secondary">ID Login</label>
                  <input type="text"
                         class="form-control rounded-3"
                         placeholder="Masukkan ID Login / NRK"
                         autocomplete="off"
                         formControlName="username">
                </div>

                <div class="mb-3">
                  <label class="form-label small fw-bold text-secondary">Password</label>
                  <div class="input-group">
                    <input [type]="showPass() ? 'text' : 'password'"
                           class="form-control rounded-start-3 border-end-0"
                           placeholder="Masukkan Password"
                           autocomplete="new-password"
                           formControlName="password">
                    <button class="btn btn-outline-secondary rounded-end-3 border-start-0 px-3"
                            type="button" (click)="showPass.set(!showPass())" title="Tampilkan / Sembunyikan Password">
                      <i class="bi" [class.bi-eye]="!showPass()" [class.bi-eye-slash]="showPass()"></i>
                    </button>
                  </div>
                </div>

                <!-- Captcha Row -->
                <div class="mb-4">
                  <label class="form-label small fw-bold text-secondary">Kode Captcha</label>
                  <div class="row g-2 align-items-center">
                    <div class="col-7">
                      <div class="captcha-input-wrap"
                           [class.captcha-invalid]="captchaStatus() === 'invalid'"
                           [class.captcha-valid]="captchaStatus() === 'valid'">
                        <input type="text"
                               class="form-control captcha-pill-input fw-semibold"
                               placeholder="Masukkan Kode Captcha"
                               autocomplete="off"
                               formControlName="captchaInput"
                               (input)="onCaptchaInput($event)">
                        @if (captchaStatus() === 'invalid') {
                          <span class="captcha-status-icon text-danger" title="Kode captcha belum sesuai">
                            <i class="bi bi-x-lg"></i>
                          </span>
                        } @else if (captchaStatus() === 'valid') {
                          <span class="captcha-status-icon text-success" title="Kode captcha sesuai">
                            <i class="bi bi-check-lg"></i>
                          </span>
                        }
                      </div>
                    </div>
                    <div class="col-5">
                      <button type="button"
                              class="w-100 btn rounded-pill fw-bold fst-italic d-flex align-items-center justify-content-center gap-2 px-3 captcha-box"
                              (click)="loadCaptcha()" title="Klik untuk memperbarui Captcha">
                        <span class="user-select-none" style="letter-spacing: 3px;">{{ captchaCode() || '.....' }}</span>
                        <i class="bi bi-arrow-clockwise small opacity-75"></i>
                      </button>
                    </div>
                  </div>
                </div>

                <div class="d-flex flex-wrap gap-2">
                  <button class="btn btn-siap flex-grow-1 rounded-pill py-2 fw-bold" type="submit" [disabled]="loading()">
                    @if (loading()) {
                      <span class="spinner-border spinner-border-sm me-2"></span>Memverifikasi...
                    } @else {
                      Sign In
                    }
                  </button>
                  <button class="btn btn-outline-secondary rounded-pill px-4 py-2 small fw-semibold"
                          type="button" (click)="showResetModal.set(true)">
                    Reset Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Ganti Kata Sandi (dengan Konfirmasi Sandi Baru) -->
    @if (showResetModal()) {
      <div class="modal-backdrop-custom" (click)="showResetModal.set(false)">
        <div class="modal-dialog-custom" style="max-width: 440px;" (click)="$event.stopPropagation()">
          <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
            <h6 class="mb-0 fw-bold"><i class="bi bi-key-fill text-warning me-2"></i>Ganti Password</h6>
            <button type="button" class="btn-close" (click)="showResetModal.set(false)"></button>
          </div>
          <div class="modal-body-scroll">
            <form [formGroup]="resetForm" (ngSubmit)="submitChangePassword()">
              <div class="mb-3">
                <label class="form-label small fw-semibold">NRK / ID Login</label>
                <input type="text" class="form-control" formControlName="nrk" placeholder="Masukkan NRK / ID Login">
              </div>
              <div class="mb-3">
                <label class="form-label small fw-semibold">Sandi Lama</label>
                <input type="password" class="form-control" formControlName="sandiLama" placeholder="Masukkan Sandi Lama">
              </div>
              <div class="mb-3">
                <label class="form-label small fw-semibold">Sandi Baru</label>
                <input type="password" class="form-control" formControlName="sandiBaru" placeholder="Masukkan Sandi Baru">
              </div>
              <div class="mb-3">
                <label class="form-label small fw-semibold">Konfirmasi Sandi Baru</label>
                <input type="password" class="form-control" formControlName="konfirmasiSandiBaru" placeholder="Ulangi Sandi Baru">
              </div>
              <div class="d-flex justify-content-end gap-2">
                <button type="button" class="btn btn-light rounded-pill px-3" (click)="showResetModal.set(false)">Batal</button>
                <button type="submit" class="btn btn-siap rounded-pill px-4">Simpan</button>
              </div>
            </form>
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
      max-width: 960px;
      border-radius: 24px;
      box-shadow: 0 24px 60px rgba(255, 122, 0, 0.2);
      border: 1px solid rgba(255, 154, 0, 0.3) !important;
    }
    .left-editorial {
      background: linear-gradient(155deg, #FF9A00 0%, #FF7700 65%, #E65100 100%);
    }
    .logo-crest-dark {
      width: 72px;
      height: 72px;
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
    .captcha-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
      border-radius: 999px;
      border: 1.5px solid #CBD5E1;
      background: #FFFFFF;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }
    .captcha-input-wrap:focus-within {
      border-color: #94A3B8;
      box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.16);
    }
    .captcha-input-wrap.captcha-invalid {
      border-color: #F87171;
      box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.22);
    }
    .captcha-input-wrap.captcha-valid {
      border-color: #22C55E;
      box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.22);
    }
    .captcha-pill-input {
      border: none !important;
      background: transparent !important;
      box-shadow: none !important;
      border-radius: 999px;
      height: 40px;
      padding: 0 2.4rem 0 1.1rem;
      font-size: 0.92rem;
    }
    .captcha-status-icon {
      position: absolute;
      right: 13px;
      top: 50%;
      transform: translateY(-50%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 1.05rem;
      pointer-events: none;
    }
    .captcha-box {
      height: 42px;
      background: linear-gradient(135deg, #6B7280 0%, #4B5563 100%);
      color: #FFFFFF;
      border: none;
      box-shadow: 0 3px 10px rgba(75, 85, 99, 0.22);
      transition: transform 0.15s ease, filter 0.2s ease;
    }
    .captcha-box:hover {
      background: linear-gradient(135deg, #4B5563 0%, #374151 100%);
      color: #FFFFFF;
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
  readonly captchaTyped = signal('');
  readonly captchaStatus = computed<'empty' | 'valid' | 'invalid'>(() => {
    const typed = this.captchaTyped().trim();
    const expected = this.captchaCode().trim();
    if (!typed) {
      return this.submitted() ? 'invalid' : 'empty';
    }
    if (!expected) return 'empty';
    return typed.toUpperCase() === expected.toUpperCase() ? 'valid' : 'invalid';
  });
  readonly availableYears = signal<any[]>([
    { tahun: 2026, label: '2026' },
    { tahun: 2025, label: '2025' },
    { tahun: 2024, label: '2024' }
  ]);
  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly showPass = signal(false);
  readonly showResetModal = signal(false);

  readonly form = this.fb.group({
    tahunAnggaran: [null as number | null, Validators.required],
    username: ['', Validators.required],
    password: ['', Validators.required],
    captchaInput: ['', Validators.required]
  });

  readonly resetForm = this.fb.nonNullable.group({
    nrk: ['', Validators.required],
    sandiLama: ['', Validators.required],
    sandiBaru: ['', [Validators.required, Validators.minLength(6)]],
    konfirmasiSandiBaru: ['', Validators.required]
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
  }

  onCaptchaInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.captchaTyped.set(value);
  }

  loadCaptcha(): void {
    this.auth.getCaptcha().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.captchaCode.set(res.data.captchaCode);
          this.captchaToken.set(res.data.captchaToken);
          this.captchaTyped.set('');
          this.form.patchValue({ captchaInput: '' });
        }
      }
    });
  }

  onSubmit(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.toast.warning('Mohon pilih Tahun Anggaran serta isi ID Login, Password, dan Kode Captcha.');
      return;
    }
    const val = this.form.getRawValue();
    this.loading.set(true);
    this.auth
      .login({
        username: val.username ?? '',
        password: val.password ?? '',
        tahunAnggaran: Number(val.tahunAnggaran) || 2025,
        captchaInput: val.captchaInput ?? '',
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
          this.toast.error(err?.error?.message || 'Login gagal. Periksa kembali data login Anda.');
          this.loadCaptcha();
        }
      });
  }

  submitChangePassword(): void {
    const val = this.resetForm.getRawValue();
    if (!val.nrk || !val.sandiLama || !val.sandiBaru || !val.konfirmasiSandiBaru) {
      this.toast.warning('Harap lengkapi seluruh kolom ganti kata sandi.');
      return;
    }
    if (val.sandiBaru !== val.konfirmasiSandiBaru) {
      this.toast.error('Konfirmasi sandi baru tidak sesuai dengan sandi baru.');
      return;
    }
    this.auth.changePassword({ nrk: val.nrk, sandiLama: val.sandiLama, sandiBaru: val.sandiBaru }).subscribe({
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
}
