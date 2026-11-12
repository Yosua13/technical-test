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
    <div class="d-flex flex-column min-vh-100" style="background: var(--siap-bg);" (click)="closeDropdowns()">
      <!-- #FF9A00 Reference Topbar with Clear SIAP BOS Logo & 5 Main Menus -->
      <header class="siap-topbar sticky-top">
        <div class="container-fluid d-flex align-items-center justify-content-between px-3 px-lg-4" style="height: 64px;">
          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-sm btn-light d-lg-none rounded-3 p-2" (click)="sidebarOpen.set(!sidebarOpen()); $event.stopPropagation()">
              <i class="bi bi-list fs-5 text-dark"></i>
            </button>

            <!-- Official White Logo.png on #FF9A00 Header -->
            <a routerLink="/landingpage" class="d-flex align-items-center gap-2 text-decoration-none me-2" title="Kembali ke Landing Page">
              <div class="brand-icon-wrap">
                <img src="assets/img/login/Logo.png" alt="Logo SIAP BOS" width="42" height="42">
              </div>
              <div class="d-none d-sm-block lh-1 text-white">
                <div class="fw-extrabold" style="font-size: 1.02rem; letter-spacing: -0.02em;">
                  SIAP BOSP &amp; BOP
                </div>
                <small class="text-white" style="font-size: 0.7rem; opacity: 0.92;">Disdik Prov. DKI Jakarta</small>
              </div>
            </a>

            <!-- 5 Main Menus Horizontal Bar with Sub-Menu Dropdowns -->
            <div class="d-none d-lg-flex align-items-center gap-1 ms-2 ps-2 border-start border-white border-opacity-25">
              @for (app of auth.listAplikasi(); track app.kodeAplikasi) {
                <div class="position-relative" (click)="$event.stopPropagation()">
                  <button class="btn btn-sm fw-bold px-3 py-1 rounded-pill topbar-mod-pill d-flex align-items-center gap-1"
                          [class.active-mod]="isModuleActive(app.link)"
                          type="button"
                          (click)="toggleTopDropdown(app.kodeAplikasi)">
                    <i class="bi {{ app.icon }}"></i>
                    <span>{{ app.nama }}</span>
                    <i class="bi bi-chevron-down small ms-1" style="font-size: 0.68rem;"></i>
                  </button>

                  @if (openTopMenu() === app.kodeAplikasi) {
                    <div class="top-submenu-dropdown shadow-lg rounded-4 py-2 mt-2">
                      <div class="px-3 pb-2 mb-1 border-bottom d-flex justify-content-between align-items-center">
                        <span class="small fw-extrabold text-uppercase" style="color: #FF8000;">{{ app.nama }}</span>
                        <span class="badge rounded-pill text-bg-warning text-dark">{{ app.menu.length }} Sub-Menu</span>
                      </div>
                      <div class="submenu-scroll-list">
                        @for (mn of app.menu; track mn.link) {
                          <a class="dropdown-item py-2 px-3 d-flex align-items-center gap-2 rounded-2"
                             [routerLink]="['/', app.link, mn.link]"
                             (click)="openTopMenu.set(null)">
                            <i class="bi {{ mn.icon }}" style="color: #FF8000;"></i>
                            <span class="small fw-semibold">{{ mn.nama }}</span>
                          </a>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Right Controls: Tahun | User | NRK + Role Switcher + Logout -->
          <div class="d-flex align-items-center gap-2">
            <!-- Reference User Info Pill: Tahun | Nama | NRK -->
            <div class="d-none d-md-flex align-items-center gap-2 px-3 py-1 rounded-pill text-white small fw-bold"
                 style="background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.4);">
              <i class="bi bi-calendar2-check"></i>
              <span>{{ auth.tahunAnggaran() }} | {{ auth.currentUser()?.namaLengkap }} | {{ auth.currentUser()?.nrk }}</span>
            </div>

            <!-- Quick Role Switcher -->
            <div class="position-relative" (click)="$event.stopPropagation()">
              <button class="btn btn-sm btn-light fw-bold rounded-pill px-3 d-flex align-items-center gap-1 shadow-sm"
                      type="button"
                      (click)="showRoleMenu.set(!showRoleMenu()); openTopMenu.set(null)"
                      title="Pindah Role Cepat">
                <i class="bi bi-person-gear" style="color: #FF8000;"></i>
                <span class="badge rounded-pill text-white" style="background: #FF8000;">{{ auth.currentUser()?.roleCode }}</span>
              </button>
              @if (showRoleMenu()) {
                <div class="top-submenu-dropdown end-0 shadow-lg rounded-4 p-2 mt-2" style="min-width: 280px; left: auto;">
                  <div class="px-2 py-1 small fw-bold text-muted text-uppercase border-bottom mb-1">Pindah Role Cepat</div>
                  @for (r of demoRoles; track r.code) {
                    <button class="dropdown-item rounded-3 py-2 d-flex justify-content-between align-items-center"
                            [class.active]="auth.currentUser()?.roleCode === r.code"
                            (click)="switchRole(r.code); showRoleMenu.set(false)">
                      <div>
                        <div class="fw-bold small">{{ r.label }}</div>
                        <div style="font-size: 0.71rem; opacity: 0.8;">{{ r.desc }}</div>
                      </div>
                      <span class="badge bg-warning text-dark">{{ r.short }}</span>
                    </button>
                  }
                </div>
              }
            </div>

            <!-- Logout Button -->
            <button class="btn btn-sm rounded-pill px-3 py-1 fw-bold text-white shadow-sm"
                    style="background: #FF3800; border: 1px solid rgba(255,255,255,0.5);"
                    (click)="auth.logout()">
              <i class="bi bi-box-arrow-right me-1"></i><span class="d-none d-sm-inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <!-- Mobile Sidebar Backdrop -->
      @if (sidebarOpen()) {
        <div class="d-lg-none position-fixed inset-0 bg-dark bg-opacity-50" style="z-index: 1035;" (click)="sidebarOpen.set(false)"></div>
      }

      <!-- Workspace Split Shell -->
      <div class="d-flex flex-grow-1 position-relative">
        <!-- Clean #FF9A00-Accented Sidebar showing 5 Main Menus & Active Sub-Menus -->
        <aside class="siap-sidebar flex-shrink-0" [class.show]="sidebarOpen()">
          <!-- 5 Main Menu Selector Strip in Sidebar -->
          <div class="p-3 border-bottom" style="background: #FFF9F0;">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <span class="text-uppercase fw-extrabold" style="font-size: 0.7rem; color: #D97706; letter-spacing: 0.06em;">
                5 Menu Utama SIAP
              </span>
              <span class="badge rounded-pill text-bg-warning text-dark" style="font-size: 0.68rem;">TA {{ auth.tahunAnggaran() }}</span>
            </div>
            <div class="d-flex flex-wrap gap-1">
              @for (mod of auth.listAplikasi(); track mod.kodeAplikasi) {
                <a class="btn btn-xs rounded-pill px-2 py-1 fw-bold text-decoration-none"
                   style="font-size: 0.72rem;"
                   [ngClass]="isModuleActive(mod.link) ? 'btn-siap text-white' : 'btn-outline-secondary bg-white'"
                   [routerLink]="['/', mod.link, mod.menu[0]?.link || '']"
                   (click)="sidebarOpen.set(false)">
                  <i class="bi {{ mod.icon }} me-1"></i>{{ mod.nama }}
                </a>
              }
            </div>
          </div>

          <!-- Active Main Menu Sub-Menus List -->
          <div class="px-3 pt-3 pb-1 d-flex justify-content-between align-items-center">
            <div class="fw-extrabold text-dark" style="font-size: 0.88rem;">
              <i class="bi {{ activeModule()?.icon }} me-1" style="color: #FF9A00;"></i>
              {{ activeModule()?.nama || 'Sub-Menu' }}
            </div>
            <span class="badge rounded-pill bg-light text-dark border">{{ (activeModule()?.menu || []).length }}</span>
          </div>

          <nav class="p-2 flex-grow-1 overflow-auto" style="max-height: calc(100vh - 230px);">
            @for (mn of activeModule()?.menu || []; track mn.link) {
              <a class="sidebar-link d-flex align-items-center gap-2 px-3 py-2 rounded-3 mb-1 text-decoration-none"
                 [routerLink]="['/', activeModule()!.link, mn.link]"
                 routerLinkActive="active"
                 (click)="sidebarOpen.set(false)">
                <i class="bi {{ mn.icon }} sidebar-icon"></i>
                <span class="small fw-semibold">{{ mn.nama }}</span>
              </a>
            }
          </nav>

          <div class="p-3 border-top small text-muted" style="background: #FFFBF5; font-size: 0.72rem;">
            <div class="d-flex align-items-center gap-2 mb-1">
              <span class="pulse-dot"></span>
              <span class="text-dark fw-bold">DB Schema: auth · oauth · siap</span>
            </div>
            <div>{{ auth.activeSekolah()?.namaSekolah || 'Dinas Pendidikan DKI Jakarta' }}</div>
          </div>
        </aside>

        <!-- Page Workspace -->
        <main class="flex-grow-1 d-flex flex-column overflow-x-hidden">
          <div class="container-fluid px-3 px-lg-4 py-3 flex-grow-1">
            <!-- Header Breadcrumb Bar -->
            <div class="d-flex flex-wrap align-items-center justify-content-between mb-3 pb-2 border-bottom">
              <div class="d-flex align-items-center gap-2">
                <span class="badge rounded-pill px-3 py-1 fw-bold" style="background: #FFF3E0; color: #D97706;">
                  {{ activeModule()?.nama }}
                </span>
                <h5 class="fw-bold mb-0 text-dark">{{ pageTitle() }}</h5>
              </div>
              <nav aria-label="breadcrumb">
                <ol class="breadcrumb mb-0 small bg-white px-3 py-1 rounded-pill border">
                  <li class="breadcrumb-item">
                    <a routerLink="/landingpage" class="text-decoration-none fw-bold" style="color: #FF8000;">
                      <i class="bi bi-house-door-fill me-1"></i>Landing Page
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
            <span>PUSAT DATA DAN INFORMASI KEUANGAN {{ auth.tahunAnggaran() }} · DINAS PENDIDIKAN PROVINSI DKI JAKARTA</span>
            <span><strong style="color: #FF9A00;">SIAP BOSP &amp; BOP</strong> · Schema: <code>auth</code>, <code>oauth</code>, <code>siap</code></span>
          </footer>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .siap-topbar {
      background: linear-gradient(90deg, #FF9A00 0%, #FF8000 100%);
      box-shadow: 0 4px 18px rgba(255, 154, 0, 0.28);
      z-index: 1030;
    }
    .brand-icon-wrap {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.22);
      border: 2px solid rgba(255, 255, 255, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.14);
    }
    .brand-icon-wrap img {
      object-fit: contain;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.22));
    }
    .topbar-mod-pill {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.14);
      border: 1px solid rgba(255, 255, 255, 0.3);
      transition: all 0.18s ease;
      font-size: 0.8rem;
    }
    .topbar-mod-pill:hover {
      background: rgba(255, 255, 255, 0.28);
      color: #ffffff;
    }
    .topbar-mod-pill.active-mod {
      background: #ffffff;
      color: #D97706;
      border-color: #ffffff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    }
    .top-submenu-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      min-width: 280px;
      background: #ffffff;
      border: 2px solid rgba(255, 154, 0, 0.3);
      z-index: 1055;
    }
    .submenu-scroll-list {
      max-height: 360px;
      overflow-y: auto;
    }
    .siap-sidebar {
      width: 275px;
      background: #ffffff;
      border-right: 1px solid rgba(255, 154, 0, 0.2);
      color: #334155;
      display: flex;
      flex-direction: column;
      min-height: calc(100vh - 64px);
    }
    .sidebar-link {
      color: #334155;
      transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
    }
    .sidebar-link:hover {
      background: #FFF3E0;
      color: #D97706;
      transform: translateX(3px);
    }
    .sidebar-link.active {
      background: linear-gradient(90deg, #FF9A00 0%, #FF8000 100%);
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(255, 154, 0, 0.3);
      transform: translateX(2px);
    }
    .sidebar-link.active .sidebar-icon {
      color: #ffffff !important;
    }
    .sidebar-icon {
      color: #FF8000;
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
  readonly openTopMenu = signal<string | null>(null);
  readonly showRoleMenu = signal(false);
  readonly currentUrl = signal(this.router.url);
  readonly pageTitle = signal('Dashboard');
  readonly routeVisible = signal(true);

  readonly demoRoles = [
    { code: 'ADMIN-DINAS', short: 'ADM', label: 'ADMIN-TDI / Admin Dinas', desc: 'Akses Penuh 5 Menu Utama SIAP BOS' },
    { code: 'PK-NEGERI', short: 'PK', label: 'Bendahara Sekolah (PK)', desc: 'Input BKU, Ajukan, Transfer, Pajak, BAP' },
    { code: 'TU-NEGERI', short: 'TU', label: 'Verifikator (Kasubag TU)', desc: 'Verifikasi SPJ & Persetujuan TU' },
    { code: 'PA-NEGERI', short: 'PA', label: 'Kepala Sekolah (PA)', desc: 'Approval PA & Generate Token CMS' },
    { code: 'SUDIN', short: 'SDN', label: 'Suku Dinas (Sudin)', desc: 'Approval NPD/Sudin, STS & Koreksi' }
  ];

  readonly currentRoot = computed(() => {
    const seg = this.currentUrl().split('/').filter(Boolean)[0] ?? 'bos-negeri';
    return seg === 'bop-negeri' ? 'bku-bop' : seg;
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
      this.openTopMenu.set(null);
      this.showRoleMenu.set(false);
      this.updateTitle();
    });
  }

  isModuleActive(link: string): boolean {
    return this.currentRoot() === link;
  }

  toggleTopDropdown(kode: string): void {
    this.showRoleMenu.set(false);
    this.openTopMenu.set(this.openTopMenu() === kode ? null : kode);
  }

  closeDropdowns(): void {
    this.openTopMenu.set(null);
    this.showRoleMenu.set(false);
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
