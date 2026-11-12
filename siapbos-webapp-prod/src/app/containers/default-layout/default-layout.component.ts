import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-default-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="d-flex flex-column min-vh-100" style="background: var(--siap-bg);">
      <!-- Executive Glass Topbar + 3px Signature Amber Strip -->
      <header class="siap-topbar sticky-top">
        <div class="top-accent-strip"></div>
        <div class="container-fluid d-flex align-items-center justify-content-between px-3 px-lg-4" style="height: 61px;">
          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-sm btn-light border d-lg-none rounded-3 p-2" (click)="sidebarOpen.set(!sidebarOpen())">
              <i class="bi bi-list fs-5 text-dark"></i>
            </button>

            <a routerLink="/landingpage" class="d-flex align-items-center gap-2 text-decoration-none me-2" title="Kembali ke Portal Aplikasi">
              <div class="brand-icon-wrap">
                <img src="assets/img/login/Logo.png" alt="Logo SIAP BOS" height="32">
              </div>
              <div class="d-none d-sm-block lh-1">
                <div class="fw-bold text-dark" style="font-size: 0.95rem; letter-spacing: -0.02em;">
                  SIAP <span style="color: #ea580c;">BOSP BOP</span>
                </div>
                <small class="text-muted" style="font-size: 0.68rem;">Disdik DKI · TA {{ auth.tahunAnggaran() }}</small>
              </div>
            </a>

            <!-- Top Module Switcher Pills -->
            <div class="d-none d-xl-flex align-items-center gap-1 ms-2 ps-3 border-start">
              @for (app of auth.listAplikasi(); track app.kodeAplikasi) {
                <div class="dropdown">
                  <button class="btn btn-sm fw-semibold dropdown-toggle px-3 py-1 rounded-pill topbar-mod-pill"
                          [class.active-mod]="currentRoot() === app.link"
                          data-bs-toggle="dropdown" type="button">
                    <i class="bi {{ app.icon }} me-1"></i>{{ app.nama }}
                  </button>
                  <ul class="dropdown-menu shadow-lg border-0 rounded-4 py-2 mt-2" style="min-width: 270px;">
                    <li class="px-3 pb-1 mb-1 border-bottom small fw-bold text-uppercase" style="color: #ea580c;">{{ app.nama }}</li>
                    @for (mn of app.menu; track mn.link) {
                      <li>
                        <a class="dropdown-item py-2 px-3 d-flex align-items-center gap-2 rounded-2"
                           [routerLink]="['/', app.link, mn.link]">
                          <i class="bi {{ mn.icon }} text-warning"></i>
                          <span class="small fw-medium">{{ mn.nama }}</span>
                        </a>
                      </li>
                    }
                  </ul>
                </div>
              }
            </div>
          </div>

          <!-- Right Controls: Status Indicator + Quick Role Switcher + User Profile -->
          <div class="d-flex align-items-center gap-2">
            <div class="d-none d-xxl-flex align-items-center gap-2 px-3 py-1 rounded-pill bg-success-subtle text-success small fw-semibold border border-success-subtle">
              <span class="pulse-dot"></span>
              <span>Microservices Live</span>
            </div>

            <!-- Quick Role Switcher -->
            <div class="dropdown">
              <button class="btn btn-sm btn-light border fw-semibold rounded-pill px-3 dropdown-toggle d-flex align-items-center gap-2 shadow-xs"
                      type="button" data-bs-toggle="dropdown" title="Switch Role Cepat untuk Demo Workflow">
                <i class="bi bi-arrow-repeat text-warning"></i>
                <span class="d-none d-md-inline text-muted small">Role:</span>
                <span class="badge text-bg-dark rounded-pill">{{ auth.currentUser()?.roleCode }}</span>
              </button>
              <ul class="dropdown-menu dropdown-menu-end shadow-lg border-0 rounded-4 p-2 mt-2" style="min-width: 285px;">
                <li class="px-2 py-1 small fw-bold text-muted text-uppercase">Mode Demo — Pindah Role Cepat</li>
                @for (r of demoRoles; track r.code) {
                  <li>
                    <button class="dropdown-item rounded-3 py-2 d-flex justify-content-between align-items-center"
                            [class.active]="auth.currentUser()?.roleCode === r.code"
                            (click)="switchRole(r.code)">
                      <div>
                        <div class="fw-semibold small">{{ r.label }}</div>
                        <div style="font-size: 0.71rem; opacity: 0.8;">{{ r.desc }}</div>
                      </div>
                      <span class="badge bg-warning text-dark">{{ r.short }}</span>
                    </button>
                  </li>
                }
              </ul>
            </div>

            <!-- User Account Dropdown -->
            <div class="dropdown">
              <button class="btn btn-sm btn-navy rounded-pill px-3 dropdown-toggle d-flex align-items-center gap-2"
                      type="button" data-bs-toggle="dropdown">
                <i class="bi bi-person-circle text-warning"></i>
                <span class="d-none d-md-inline small">
                  {{ auth.activeSekolah()?.namaSekolah || auth.currentUser()?.namaLengkap }}
                </span>
              </button>
              <ul class="dropdown-menu dropdown-menu-end shadow-lg border-0 rounded-4 p-2 mt-2" style="min-width: 240px;">
                <li class="px-3 py-2 border-bottom mb-1">
                  <div class="fw-bold small text-dark">{{ auth.currentUser()?.namaLengkap }}</div>
                  <div class="text-muted" style="font-size: 0.74rem;">{{ auth.currentUser()?.jabatan }} · NRK {{ auth.currentUser()?.nrk }}</div>
                </li>
                <li>
                  <a class="dropdown-item rounded-3 py-2 small" routerLink="/landingpage">
                    <i class="bi bi-grid-fill me-2 text-warning"></i>Portal &amp; Pilih Modul
                  </a>
                </li>
                <li><hr class="dropdown-divider my-1"></li>
                <li>
                  <button class="dropdown-item rounded-3 py-2 small text-danger fw-semibold" (click)="auth.logout()">
                    <i class="bi bi-box-arrow-right me-2"></i>Keluar / Logout
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </header>

      <!-- Mobile Sidebar Backdrop -->
      @if (sidebarOpen()) {
        <div class="d-lg-none position-fixed inset-0 bg-dark bg-opacity-50" style="z-index: 1035;" (click)="sidebarOpen.set(false)"></div>
      }

      <!-- Workspace Split Shell -->
      <div class="d-flex flex-grow-1 position-relative">
        <!-- Midnight Navy Collapsible Sidebar -->
        <aside class="siap-sidebar flex-shrink-0" [class.show]="sidebarOpen()">
          <div class="p-3 border-bottom border-white border-opacity-10">
            <div class="d-flex align-items-center justify-content-between">
              <span class="text-uppercase fw-bold text-warning" style="font-size: 0.68rem; letter-spacing: 0.09em;">
                Workspace Aktif
              </span>
              <span class="badge bg-white bg-opacity-10 text-white-50" style="font-size: 0.68rem;">TA {{ auth.tahunAnggaran() }}</span>
            </div>
            <div class="text-white fw-bold mt-1 fs-6">{{ activeModule()?.nama || 'Navigasi Utama' }}</div>
            <small class="text-white-50 d-block mt-1" style="font-size: 0.74rem;">{{ auth.currentUser()?.roleName }}</small>
          </div>

          <nav class="p-2 flex-grow-1 overflow-auto">
            @for (mn of activeModule()?.menu || []; track mn.link) {
              <a class="sidebar-link d-flex align-items-center gap-2 px-3 py-2 rounded-3 mb-1 text-decoration-none"
                 [routerLink]="['/', activeModule()!.link, mn.link]"
                 routerLinkActive="active"
                 (click)="sidebarOpen.set(false)">
                <i class="bi {{ mn.icon }} sidebar-icon"></i>
                <span class="small fw-medium">{{ mn.nama }}</span>
              </a>
            }

            <div class="mt-3 pt-3 border-top border-white border-opacity-10 px-1">
              <div class="text-uppercase text-white-50 fw-bold mb-2 px-2" style="font-size: 0.67rem; letter-spacing: 0.08em;">Pindah Cepat Modul</div>
              @for (mod of auth.listAplikasi(); track mod.kodeAplikasi) {
                @if (mod.link !== activeModule()?.link) {
                  <a class="sidebar-link d-flex align-items-center gap-2 px-3 py-2 rounded-3 mb-1 text-decoration-none small"
                     [routerLink]="['/', mod.link, mod.menu[0]?.link || '']"
                     (click)="sidebarOpen.set(false)">
                    <i class="bi {{ mod.icon }} text-warning"></i>
                    <span>{{ mod.nama }}</span>
                  </a>
                }
              }
            </div>
          </nav>

          <div class="p-3 border-top border-white border-opacity-10 text-white-50" style="font-size: 0.72rem;">
            <div class="d-flex align-items-center gap-2 mb-1">
              <span class="pulse-dot"></span>
              <span class="text-white fw-semibold">6 Microservices Aktif</span>
            </div>
            <div>Ports: 5001 – 5006 · PostgreSQL 18</div>
          </div>
        </aside>

        <!-- Page Workspace with Smooth Route Entrance Animation -->
        <main class="flex-grow-1 d-flex flex-column overflow-x-hidden">
          <div class="container-fluid px-3 px-lg-4 py-3 flex-grow-1">
            <!-- Sleek Header Breadcrumb Card -->
            <div class="d-flex flex-wrap align-items-center justify-content-between mb-3 pb-2 border-bottom">
              <div>
                <h5 class="fw-bold mb-0 text-dark">{{ pageTitle() }}</h5>
              </div>
              <nav aria-label="breadcrumb">
                <ol class="breadcrumb mb-0 small bg-white px-3 py-1 rounded-pill border shadow-xs">
                  <li class="breadcrumb-item">
                    <a routerLink="/landingpage" class="text-decoration-none fw-semibold" style="color: #ea580c;">
                      <i class="bi bi-grid-fill me-1"></i>Portal
                    </a>
                  </li>
                  <li class="breadcrumb-item text-muted">{{ activeModule()?.nama }}</li>
                  <li class="breadcrumb-item active fw-semibold text-dark">{{ pageTitle() }}</li>
                </ol>
              </nav>
            </div>

            @if (routeVisible()) {
              <div class="animate-page">
                <router-outlet />
              </div>
            }
          </div>

          <footer class="bg-white border-top px-4 py-2 d-flex flex-wrap justify-content-between align-items-center text-muted small">
            <span>PUSAT DATA DAN INFORMASI KEUANGAN {{ auth.tahunAnggaran() }} · DINAS PENDIDIKAN DKI JAKARTA</span>
            <span><strong style="color: #ea580c;">SIAP BOSP BOP</strong> · .NET 11 + Angular 22 + PostgreSQL 18</span>
          </footer>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .siap-topbar {
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(15, 23, 42, 0.08);
      z-index: 1030;
    }
    .top-accent-strip {
      height: 3px;
      background: linear-gradient(90deg, #f59e0b 0%, #ea580c 55%, #0b132b 100%);
    }
    .brand-icon-wrap {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #fff7ed;
      border: 1px solid #fed7aa;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .topbar-mod-pill {
      color: #475569;
      background: transparent;
      border: 1px solid transparent;
      transition: all 0.18s ease;
    }
    .topbar-mod-pill:hover {
      background: #fffbeb;
      color: #b45309;
    }
    .topbar-mod-pill.active-mod {
      background: #fff7ed;
      color: #ea580c;
      border-color: #fed7aa;
    }
    .siap-sidebar {
      width: 270px;
      background: linear-gradient(180deg, #0b132b 0%, #111c3a 100%);
      color: #cbd5e1;
      display: flex;
      flex-direction: column;
      min-height: calc(100vh - 64px);
    }
    .sidebar-link {
      color: #cbd5e1;
      transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
    }
    .sidebar-link:hover {
      background: rgba(245, 158, 11, 0.14);
      color: #ffffff;
      transform: translateX(4px);
    }
    .sidebar-link.active {
      background: linear-gradient(90deg, #f59e0b 0%, #ea580c 100%);
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35);
      transform: translateX(2px);
    }
    @media (max-width: 991.98px) {
      .siap-sidebar {
        position: fixed;
        top: 64px;
        left: -285px;
        bottom: 0;
        z-index: 1040;
        transition: left 0.25s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .siap-sidebar.show {
        left: 0;
      }
    }
  `]
})
export class DefaultLayoutComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  readonly sidebarOpen = signal(false);
  readonly currentUrl = signal(this.router.url);
  readonly pageTitle = signal('Dashboard');
  readonly routeVisible = signal(true);

  readonly demoRoles = [
    { code: 'PK-NEGERI', short: 'PK', label: 'Bendahara Sekolah (PK)', desc: 'Input BKU, Ajukan, Transfer, Pajak, BAP' },
    { code: 'TU-NEGERI', short: 'TU', label: 'Verifikator (Kasubag TU)', desc: 'Verifikasi SPJ & Persetujuan TU' },
    { code: 'PA-NEGERI', short: 'PA', label: 'Kepala Sekolah (PA)', desc: 'Approval PA & Generate Token CMS' },
    { code: 'SUDIN', short: 'SDN', label: 'Suku Dinas (Sudin)', desc: 'Approval NPD/Sudin, STS & Koreksi' },
    { code: 'ADMIN-DINAS', short: 'ADM', label: 'Admin Dinas Pendidikan', desc: 'Dropping Dana, RKAS, User Mgmt' }
  ];

  readonly currentRoot = computed(() => {
    const seg = this.currentUrl().split('/').filter(Boolean)[0] ?? 'bos-negeri';
    return seg;
  });

  readonly activeModule = computed(() => {
    const root = this.currentRoot();
    return this.auth.listAplikasi().find((a) => a.link === root) ?? this.auth.listAplikasi()[0] ?? null;
  });

  ngOnInit(): void {
    this.auth.loadSekolahOptions().subscribe();
    this.updateTitle();
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.currentUrl.set(this.router.url);
      this.updateTitle();
    });
  }

  switchRole(roleCode: string): void {
    this.auth.quickSwitchRole(roleCode).subscribe({
      next: () => {
        this.auth.loadSekolahOptions().subscribe();
      }
    });
  }

  private updateTitle(): void {
    let r = this.route;
    while (r.firstChild) r = r.firstChild;
    const t = r.snapshot.data?.['title'];
    if (t) this.pageTitle.set(t);
  }
}
