import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe],
  template: `
    <div class="min-vh-100 d-flex flex-column" style="background: var(--siap-bg);">
      <!-- TOP FROSTED EXECUTIVE HEADER -->
      <header class="portal-topbar sticky-top">
        <div class="top-accent-line"></div>
        <div class="container-xl px-3 px-lg-4 py-2 d-flex align-items-center justify-content-between gap-3">
          <a routerLink="/landingpage" class="d-flex align-items-center gap-2 text-decoration-none">
            <div class="brand-badge-box">
              <img src="assets/img/login/Logo.png" alt="Logo SIAP BOSP BOP" height="36">
            </div>
            <div>
              <div class="fw-bold text-dark lh-1" style="font-size: 1rem; letter-spacing: -0.02em;">
                SIAP <span style="color: #ea580c;">BOSP</span> &amp; <span style="color: #0b132b;">BOP</span>
              </div>
              <small class="text-muted" style="font-size: 0.72rem;">Dinas Pendidikan Provinsi DKI Jakarta</small>
            </div>
          </a>

          <!-- Public Links (Always functional, zero 404s!) -->
          <nav class="d-none d-md-flex align-items-center gap-1">
            <button type="button" class="nav-pill-btn" [class.active]="activePublicTab() === 'berita'" (click)="scrollToInfo('berita')">
              <i class="bi bi-newspaper me-1"></i>Berita Penyaluran
            </button>
            <button type="button" class="nav-pill-btn" [class.active]="activePublicTab() === 'peraturan'" (click)="scrollToInfo('peraturan')">
              <i class="bi bi-journal-bookmark me-1"></i>Peraturan &amp; Juknis
            </button>
            <button type="button" class="nav-pill-btn" [class.active]="activePublicTab() === 'prosedur'" (click)="scrollToInfo('prosedur')">
              <i class="bi bi-diagram-3 me-1"></i>Sistem &amp; Prosedur
            </button>
          </nav>

          <div class="d-flex align-items-center gap-2">
            @if (auth.isLoggedIn()) {
              <div class="d-none d-sm-flex align-items-center gap-2 bg-light border rounded-pill px-3 py-1">
                <span class="pulse-dot"></span>
                <span class="small fw-semibold text-dark">{{ auth.currentUser()?.namaLengkap }}</span>
                <span class="badge text-bg-dark rounded-pill">{{ auth.currentUser()?.roleCode }}</span>
              </div>
              <button class="btn btn-sm btn-outline-danger rounded-pill px-3 fw-semibold" (click)="auth.logout()">
                <i class="bi bi-box-arrow-right me-1"></i>Logout
              </button>
            } @else {
              <a routerLink="/login" class="btn btn-siap btn-sm rounded-pill px-4 py-2 d-flex align-items-center gap-2">
                <i class="bi bi-box-arrow-in-right"></i>
                <span>Masuk Sistem</span>
              </a>
            }
          </div>
        </div>
      </header>

      <!-- HERO SECTION (Redesigned Midnight Navy + Amber Glow + Floating Stats Card) -->
      <section class="hero-canvas text-white position-relative overflow-hidden">
        <div class="hero-orb hero-orb-1"></div>
        <div class="hero-orb hero-orb-2"></div>

        <div class="container-xl px-3 px-lg-4 py-5 position-relative" style="z-index: 2;">
          @if (!auth.isLoggedIn()) {
            <!-- MODE PUBLIK: Perbaikan Menyeluruh dari siap.jakarta.go.id/#/landingpage -->
            <div class="row align-items-center g-4 py-lg-2">
              <div class="col-lg-7 animate-page">
                <div class="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-3"
                     style="background: rgba(245, 158, 11, 0.16); border: 1px solid rgba(245, 158, 11, 0.35); color: #fcd34d;">
                  <span class="pulse-dot"></span>
                  <small class="fw-semibold">Portal Resmi Akuntabilitas Keuangan Sekolah · TA 2026</small>
                </div>

                <h1 class="display-5 fw-bold mb-3 lh-sm" style="letter-spacing: -0.02em;">
                  Sistem Informasi Akuntabilitas Pendidikan
                  <span class="d-block mt-1" style="background: linear-gradient(90deg, #fbbf24, #fb923c); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                    BOSP &amp; BOP DKI Jakarta
                  </span>
                </h1>

                <p class="text-white-50 fs-6 mb-4" style="max-width: 600px; line-height: 1.65;">
                  Platform terpadu pengelolaan dana APBN (BOSP) dan APBD (BOP) berbasis transaksi non-tunai CMS Bank DKI, perpajakan elektronik MPN G3, NPD SIPKD, serta pelaporan akuntabel real-time.
                </p>

                <div class="d-flex flex-wrap align-items-center gap-3 mb-4">
                  <a routerLink="/login" class="btn btn-siap rounded-pill px-4 py-2 fs-6 d-inline-flex align-items-center gap-2">
                    <span>Masuk ke Aplikasi</span>
                    <i class="bi bi-arrow-right-circle"></i>
                  </a>
                  <button type="button" class="btn btn-outline-light rounded-pill px-4 py-2 fw-semibold"
                          (click)="quickStartDemo('bendahara.sman1')" [disabled]="demoLoading()">
                    @if (demoLoading()) {
                      <span class="spinner-border spinner-border-sm me-2"></span>Membuka Demo...
                    } @else {
                      <i class="bi bi-lightning-charge-fill text-warning me-1"></i>Demo Instan Bendahara
                    }
                  </button>
                </div>

                <div class="d-flex flex-wrap gap-2">
                  <span class="eco-pill"><i class="bi bi-bank me-1 text-warning"></i>Bank DKI CMS</span>
                  <span class="eco-pill"><i class="bi bi-receipt-cutoff me-1 text-info"></i>DJP Pajak NTPN</span>
                  <span class="eco-pill"><i class="bi bi-diagram-2 me-1 text-success"></i>SIPKD BPKD</span>
                  <span class="eco-pill"><i class="bi bi-person-badge me-1 text-warning"></i>SIMPEG ASN</span>
                </div>
              </div>

              <!-- Live Database Transparency Card -->
              <div class="col-lg-5 animate-page" style="animation-delay: 120ms;">
                <div class="transparency-glass-card p-4 animate-float">
                  <div class="d-flex justify-content-between align-items-center mb-3">
                    <div>
                      <small class="text-warning fw-bold text-uppercase" style="font-size: 0.7rem; letter-spacing: 0.08em;">Live Database PostgreSQL</small>
                      <h5 class="fw-bold mb-0 text-white">Transparansi Penyerapan</h5>
                    </div>
                    <div class="rounded-3 p-2" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24;">
                      <i class="bi bi-graph-up-arrow fs-4"></i>
                    </div>
                  </div>

                  @if (publicSummary(); as sum) {
                    <div class="row g-2 mb-3">
                      <div class="col-6">
                        <div class="metric-mini">
                          <small class="text-white-50 d-block">Sekolah Terdaftar</small>
                          <div class="fs-4 fw-bold text-white tabular-nums">{{ sum.jumlahSekolah }} Sekolah</div>
                        </div>
                      </div>
                      <div class="col-6">
                        <div class="metric-mini">
                          <small class="text-white-50 d-block">Serapan RKAS</small>
                          <div class="fs-4 fw-bold text-warning tabular-nums">{{ sum.persenSerapan }}%</div>
                        </div>
                      </div>
                      <div class="col-12">
                        <div class="metric-mini">
                          <small class="text-white-50 d-block">Total Pagu RKAS Terkelola</small>
                          <div class="fs-5 fw-bold text-white tabular-nums">{{ sum.totalPagu | currency:'IDR':'symbol':'1.0-0' }}</div>
                        </div>
                      </div>
                      <div class="col-12">
                        <div class="metric-mini">
                          <small class="text-white-50 d-block">Dropping Dana Terkonfirmasi BKU</small>
                          <div class="fs-5 fw-bold text-success tabular-nums">{{ sum.totalDropping | currency:'IDR':'symbol':'1.0-0' }}</div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div class="d-flex justify-content-between small mb-1 text-white-50">
                        <span>Progres Realisasi Belanja</span>
                        <span class="text-warning fw-bold">{{ sum.totalRealisasi | currency:'IDR':'symbol':'1.0-0' }}</span>
                      </div>
                      <div class="progress" style="height: 8px; background: rgba(255,255,255,0.12);">
                        <div class="progress-bar bg-warning" [style.width.%]="sum.persenSerapan"></div>
                      </div>
                    </div>
                  } @else {
                    <div class="siap-skeleton mb-2" style="height: 60px; opacity: 0.2;"></div>
                    <div class="siap-skeleton" style="height: 60px; opacity: 0.2;"></div>
                  }
                </div>
              </div>
            </div>
          } @else {
            <!-- MODE TERAUTENTIKASI: Workspace Bento Hub -->
            <div class="row align-items-center g-3 py-2 animate-page">
              <div class="col-lg-7">
                <span class="badge rounded-pill px-3 py-2 mb-2" style="background: rgba(245, 158, 11, 0.2); color: #fcd34d; border: 1px solid rgba(245,158,11,0.35);">
                  <i class="bi bi-shield-check me-1"></i>TA {{ auth.tahunAnggaran() }} · Sesi Terautentikasi
                </span>
                <h2 class="fw-bold mb-1">Selamat Datang, {{ auth.currentUser()?.namaLengkap }}</h2>
                <p class="text-white-50 mb-0 small">
                  {{ auth.currentUser()?.jabatan }} · NRK {{ auth.currentUser()?.nrk }} · Pilih modul penatausahaan di bawah untuk mulai bekerja.
                </p>
              </div>
              @if (auth.activeSekolah(); as sek) {
                <div class="col-lg-5">
                  <div class="transparency-glass-card p-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                      <div>
                        <small class="text-white-50 d-block">Satuan Pendidikan Aktif</small>
                        <strong class="text-white">{{ sek.namaSekolah }} ({{ sek.npsn }})</strong>
                      </div>
                      <span class="badge bg-warning text-dark">{{ sek.wilayahSudin }}</span>
                    </div>
                    <div class="row g-2">
                      <div class="col-6">
                        <div class="metric-mini py-2">
                          <small class="text-white-50 d-block" style="font-size: 0.7rem;">Saldo Kas BOS</small>
                          <strong class="text-success tabular-nums">{{ sek.saldoBos | currency:'IDR':'symbol':'1.0-0' }}</strong>
                        </div>
                      </div>
                      <div class="col-6">
                        <div class="metric-mini py-2">
                          <small class="text-white-50 d-block" style="font-size: 0.7rem;">Saldo Kas BOP</small>
                          <strong class="text-info tabular-nums">{{ sek.saldoBop | currency:'IDR':'symbol':'1.0-0' }}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </section>

      <!-- MAIN BODY -->
      <main class="container-xl px-3 px-lg-4 flex-grow-1 pb-5" style="margin-top: -1.6rem; position: relative; z-index: 3;">
        @if (auth.isLoggedIn()) {
          <!-- BENTO MODULE LAUNCHER GRID -->
          <div class="row g-4 mb-5">
            @for (mod of auth.listAplikasi(); track mod.kodeAplikasi; let i = $index) {
              <div class="col-md-6 col-xl-4 animate-stagger" [style.--stagger]="i">
                <div class="siap-card siap-card-interactive h-100 p-4 d-flex flex-column justify-content-between module-bento">
                  <div>
                    <div class="d-flex align-items-center justify-content-between mb-3">
                      <div class="module-icon-box">
                        <i class="bi {{ mod.icon }} fs-3"></i>
                      </div>
                      <span class="badge rounded-pill bg-light text-dark border fw-bold px-3 py-2">{{ mod.kodeAplikasi }}</span>
                    </div>
                    <h5 class="fw-bold text-dark mb-1">{{ mod.nama }}</h5>
                    <p class="text-muted small mb-3" style="line-height: 1.55;">{{ mod.deskripsi }}</p>

                    <div class="border-top pt-3 mb-3 d-flex flex-column gap-1">
                      @for (mn of mod.menu.slice(0, 4); track mn.link) {
                        <a [routerLink]="['/', mod.link, mn.link]" class="portal-sublink d-flex align-items-center justify-content-between py-1 px-2 rounded-2 text-decoration-none">
                          <span class="small d-flex align-items-center gap-2">
                            <i class="bi {{ mn.icon }} text-warning"></i>
                            <span>{{ mn.nama }}</span>
                          </span>
                          <i class="bi bi-chevron-right small opacity-50"></i>
                        </a>
                      }
                    </div>
                  </div>

                  <a [routerLink]="['/', mod.link, mod.menu[0]?.link || '']"
                     class="btn btn-navy w-100 rounded-pill py-2 d-flex align-items-center justify-content-center gap-2 module-cta">
                    <span>Buka Workspace</span>
                    <i class="bi bi-arrow-right arrow-shift"></i>
                  </a>
                </div>
              </div>
            }
          </div>
        }

        <!-- INTERACTIVE PUBLIC PORTAL KNOWLEDGE BASE (Berita, Peraturan, Sistem & Prosedur) -->
        <section id="portal-info-section" class="siap-card p-4 animate-page">
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4 pb-3 border-bottom">
            <div>
              <span class="badge bg-warning-subtle text-warning-emphasis rounded-pill mb-1">Pusat Informasi &amp; Layanan Publik</span>
              <h5 class="fw-bold mb-0 text-dark">Informasi Resmi Pengelolaan BOSP &amp; BOP DKI Jakarta</h5>
            </div>

            <div class="btn-group bg-light p-1 rounded-pill border" role="group">
              <button type="button" class="btn btn-sm rounded-pill px-3 fw-semibold"
                      [class.btn-navy]="activePublicTab() === 'berita'"
                      [class.text-muted]="activePublicTab() !== 'berita'"
                      (click)="activePublicTab.set('berita')">
                <i class="bi bi-newspaper me-1"></i>Berita
              </button>
              <button type="button" class="btn btn-sm rounded-pill px-3 fw-semibold"
                      [class.btn-navy]="activePublicTab() === 'peraturan'"
                      [class.text-muted]="activePublicTab() !== 'peraturan'"
                      (click)="activePublicTab.set('peraturan')">
                <i class="bi bi-journal-bookmark me-1"></i>Peraturan
              </button>
              <button type="button" class="btn btn-sm rounded-pill px-3 fw-semibold"
                      [class.btn-navy]="activePublicTab() === 'prosedur'"
                      [class.text-muted]="activePublicTab() !== 'prosedur'"
                      (click)="activePublicTab.set('prosedur')">
                <i class="bi bi-diagram-3 me-1"></i>Prosedur (SOP)
              </button>
            </div>
          </div>

          @if (publicSummary(); as info) {
            @switch (activePublicTab()) {
              @case ('berita') {
                <div class="row g-3">
                  @for (b of info.berita; track b.id; let idx = $index) {
                    <div class="col-md-4 animate-stagger" [style.--stagger]="idx">
                      <div class="border rounded-4 p-3 h-100 d-flex flex-column justify-content-between bg-light-subtle hover-border-amber"
                           style="cursor: pointer;" (click)="selectedNews.set(b)">
                        <div>
                          <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">{{ b.kategori }}</span>
                            <small class="text-muted">{{ b.tanggal }}</small>
                          </div>
                          <h6 class="fw-bold text-dark mb-2">{{ b.judul }}</h6>
                          <p class="text-muted small mb-3">{{ b.ringkasan }}</p>
                        </div>
                        <span class="small fw-semibold text-primary">Baca Selengkapnya <i class="bi bi-arrow-right ms-1"></i></span>
                      </div>
                    </div>
                  }
                </div>
              }
              @case ('peraturan') {
                <div class="table-responsive animate-page">
                  <table class="table table-siap table-hover">
                    <thead>
                      <tr>
                        <th>Dasar Hukum / Peraturan</th>
                        <th>Tentang</th>
                        <th>Lingkup</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (p of info.peraturan; track p.kode) {
                        <tr>
                          <td class="fw-bold text-dark">{{ p.kode }}</td>
                          <td>{{ p.tentang }}</td>
                          <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle">{{ p.lingkup }}</span></td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
              @case ('prosedur') {
                <div class="row g-3">
                  @for (s of info.prosedur; track s.step; let idx = $index) {
                    <div class="col-md-6 col-lg-4 animate-stagger" [style.--stagger]="idx">
                      <div class="border rounded-4 p-3 h-100 bg-white position-relative">
                        <div class="d-flex align-items-center gap-2 mb-2">
                          <span class="step-circle">{{ s.step }}</span>
                          <span class="badge bg-light text-dark border small">{{ s.actor }}</span>
                        </div>
                        <h6 class="fw-bold text-dark mb-1">{{ s.title }}</h6>
                        <p class="text-muted small mb-0">{{ s.desc }}</p>
                      </div>
                    </div>
                  }
                </div>
              }
            }
          }
        </section>
      </main>

      <!-- RICH OFFICIAL FOOTER -->
      <footer class="bg-white border-top py-4 mt-auto">
        <div class="container-xl px-3 px-lg-4">
          <div class="row g-3 align-items-center justify-content-between">
            <div class="col-md-6">
              <div class="fw-bold text-dark">Dinas Pendidikan Provinsi DKI Jakarta · PUSDATIK</div>
              <small class="text-muted">Jl. Jenderal Gatot Subroto Kav. 40–41, Jakarta Selatan · Helpdesk SIAP BOSP BOP</small>
            </div>
            <div class="col-md-6 text-md-end small text-muted">
              <div><i class="bi bi-telephone me-1 text-warning"></i>(021) 3950-xxxx · <i class="bi bi-envelope ms-2 me-1 text-warning"></i>siapbos&#64;disdik.jakarta.go.id</div>
              <div class="mt-1">Architecture: 6 .NET 11 Microservices + Angular 22 + PostgreSQL 18</div>
            </div>
          </div>
        </div>
      </footer>
    </div>

    <!-- Modal Reader Berita -->
    @if (selectedNews(); as news) {
      <div class="modal-backdrop-custom" (click)="selectedNews.set(null)">
        <div class="modal-dialog-custom" style="max-width: 540px;" (click)="$event.stopPropagation()">
          <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
            <div>
              <span class="badge bg-warning-subtle text-warning-emphasis me-2">{{ news.kategori }}</span>
              <small class="text-muted">{{ news.tanggal }}</small>
            </div>
            <button type="button" class="btn-close" (click)="selectedNews.set(null)"></button>
          </div>
          <div class="modal-body-scroll">
            <h5 class="fw-bold text-dark mb-3">{{ news.judul }}</h5>
            <p class="text-secondary lh-lg mb-3">{{ news.ringkasan }}</p>
            <div class="alert alert-light border small text-muted mb-0">
              Seluruh proses administrasi ini dapat langsung diuji coba pada lingkungan simulasi dengan menekan tombol <strong>Masuk Sistem</strong>.
            </div>
          </div>
          <div class="p-3 border-top bg-light d-flex justify-content-end gap-2">
            <button class="btn btn-light rounded-pill px-3" (click)="selectedNews.set(null)">Tutup</button>
            <a routerLink="/login" class="btn btn-siap rounded-pill px-4" (click)="selectedNews.set(null)">Masuk Sistem</a>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .portal-topbar {
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(15, 23, 42, 0.08);
      z-index: 1030;
    }
    .top-accent-line {
      height: 3px;
      background: linear-gradient(90deg, #f59e0b 0%, #ea580c 50%, #0b132b 100%);
    }
    .brand-badge-box {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: #fff7ed;
      border: 1px solid #fed7aa;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .nav-pill-btn {
      background: transparent;
      border: none;
      padding: 0.45rem 0.9rem;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 600;
      color: #475569;
      transition: all 0.2s ease;
    }
    .nav-pill-btn:hover, .nav-pill-btn.active {
      background: #fff7ed;
      color: #ea580c;
    }
    .hero-canvas {
      background: radial-gradient(circle at top right, #1e293b 0%, #0b132b 65%);
      padding-bottom: 3rem;
    }
    .hero-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(70px);
      pointer-events: none;
      opacity: 0.45;
    }
    .hero-orb-1 {
      width: 380px;
      height: 380px;
      background: #f59e0b;
      top: -120px;
      right: -80px;
    }
    .hero-orb-2 {
      width: 300px;
      height: 300px;
      background: #2563eb;
      bottom: -110px;
      left: -60px;
    }
    .eco-pill {
      display: inline-flex;
      align-items: center;
      font-size: 0.78rem;
      font-weight: 600;
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.14);
      color: #e2e8f0;
    }
    .transparency-glass-card {
      background: rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 20px;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.28);
    }
    .metric-mini {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 0.65rem 0.85rem;
    }
    .module-icon-box {
      width: 54px;
      height: 54px;
      border-radius: 14px;
      background: linear-gradient(135deg, #fffbeb, #fef3c7);
      border: 1px solid #fde68a;
      color: #d97706;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .module-bento:hover .module-icon-box {
      transform: scale(1.08) rotate(-3deg);
    }
    .portal-sublink {
      color: #475569;
      transition: background-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
    }
    .portal-sublink:hover {
      background: #fffbeb;
      color: #b45309;
      transform: translateX(3px);
    }
    .arrow-shift {
      transition: transform 0.2s ease;
    }
    .module-cta:hover .arrow-shift {
      transform: translateX(4px);
    }
    .step-circle {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f59e0b, #ea580c);
      color: #fff;
      font-weight: 800;
      font-size: 0.8rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .hover-border-amber {
      transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
    }
    .hover-border-amber:hover {
      border-color: #f59e0b !important;
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
    }
  `]
})
export class LandingPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly activePublicTab = signal<'berita' | 'peraturan' | 'prosedur'>('berita');
  readonly publicSummary = signal<any>(null);
  readonly selectedNews = signal<any>(null);
  readonly demoLoading = signal(false);

  ngOnInit(): void {
    this.auth.getPublicLandingSummary().subscribe({
      next: (res) => {
        if (res.success && res.data) this.publicSummary.set(res.data);
      }
    });
    if (this.auth.isLoggedIn()) {
      this.auth.loadSekolahOptions().subscribe();
    }
  }

  scrollToInfo(tab: 'berita' | 'peraturan' | 'prosedur'): void {
    this.activePublicTab.set(tab);
    document.getElementById('portal-info-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  quickStartDemo(username: string): void {
    this.demoLoading.set(true);
    this.auth
      .login({
        username,
        password: 'password123',
        tahunAnggaran: 2026,
        captchaInput: '',
        captchaToken: '',
        skipCaptchaDemo: true
      })
      .subscribe({
        next: (res) => {
          this.demoLoading.set(false);
          if (res.success) {
            this.toast.success(`Masuk Demo: ${res.data.user.namaLengkap} (${res.data.user.roleCode})`);
            this.auth.loadSekolahOptions().subscribe();
          }
        },
        error: () => this.demoLoading.set(false)
      });
  }
}
