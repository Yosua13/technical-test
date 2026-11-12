import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-default-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="d-flex flex-column min-vh-100" style="background: var(--siap-bg);" (click)="closePopovers()">
      <!-- ORANGE TOP NAVBAR (Logo Left | Menu Search Center | Notifications & User Profile Right) -->
      <header class="siap-topbar sticky-top">
        <div class="container-fluid d-flex align-items-center justify-content-between gap-3 px-3 px-lg-4" style="height: 62px;">
          <!-- Left: Sidebar Collapse Toggle + Logo -->
          <div class="d-flex align-items-center gap-2 flex-shrink-0">
            <!-- Desktop Collapse Button -->
            <button type="button"
                    class="btn btn-sm topbar-btn d-none d-lg-inline-flex align-items-center justify-content-center rounded-3"
                    style="width: 36px; height: 36px;"
                    [title]="sidebarCollapsed() ? 'Perluas Sidebar Menu' : 'Kecilkan Sidebar (Ikon Saja)'"
                    (click)="sidebarCollapsed.set(!sidebarCollapsed())">
              <i class="bi" [class.bi-layout-sidebar-inset]="!sidebarCollapsed()" [class.bi-layout-sidebar]="sidebarCollapsed()"></i>
            </button>

            <!-- Mobile Drawer Toggle -->
            <button type="button"
                    class="btn btn-sm topbar-btn d-lg-none rounded-3"
                    style="width: 36px; height: 36px;"
                    (click)="sidebarOpen.set(!sidebarOpen()); $event.stopPropagation()">
              <i class="bi bi-list fs-5"></i>
            </button>

            <a routerLink="/landingpage" class="d-flex align-items-center gap-2 text-decoration-none ms-1" title="Kembali ke Portal">
              <div class="topbar-logo-wrap">
                <img src="assets/img/login/Logo.png" alt="Logo SIAP BOS" width="28" height="28">
              </div>
              <div class="d-none d-sm-block lh-1">
                <div class="fw-bold text-white" style="font-size: 0.96rem; letter-spacing: -0.02em;">
                  SIAP BOSP &amp; BOP
                </div>
                <small class="text-white" style="font-size: 0.7rem; opacity: 0.9;">TA {{ auth.tahunAnggaran() }} · Disdik DKI</small>
              </div>
            </a>
          </div>

          <!-- Center: Search Menu by Exact Menu Name -->
          <div class="position-relative flex-grow-1 d-none d-md-block" style="max-width: 440px;" (click)="$event.stopPropagation()">
            <div class="global-search-box d-flex align-items-center px-3 rounded-pill">
              <i class="bi bi-search text-muted me-2 small"></i>
              <input type="text"
                     class="form-control form-control-sm border-0 bg-transparent shadow-none px-0"
                     [ngModel]="globalQuery()"
                     (ngModelChange)="onSearchChange($event)"
                     (focus)="showSearchDropdown.set(true)"
                     (keydown.enter)="onSearchEnter()"
                     placeholder="Cari nama menu...">
              @if (globalQuery()) {
                <button type="button" class="btn btn-sm p-0 text-muted border-0" (click)="clearSearch()">
                  <i class="bi bi-x-circle-fill"></i>
                </button>
              }
            </div>

            @if (showSearchDropdown() && globalQuery().trim().length > 0) {
              <div class="topbar-popover shadow-lg rounded-4 p-2 mt-2 w-100">
                <div class="px-2 py-1 small fw-semibold text-muted border-bottom mb-1">
                  Hasil Pencarian Menu ({{ searchResults().length }})
                </div>
                @if (searchResults().length === 0) {
                  <div class="p-3 text-center small text-muted">Tidak ada nama menu yang cocok.</div>
                } @else {
                  <div style="max-height: 300px; overflow-y: auto;">
                    @for (item of searchResults(); track item.fullUrl) {
                      <button type="button"
                              class="dropdown-item rounded-3 py-2 px-2 d-flex align-items-center justify-content-between text-start"
                              (click)="navigateFromSearch(item)">
                        <div class="d-flex align-items-center gap-2">
                          <i class="bi {{ item.icon }} text-secondary"></i>
                          <span class="small fw-semibold text-dark">{{ item.menuNama }}</span>
                        </div>
                        <span class="badge badge-neutral small" style="font-size: 0.68rem;">{{ item.appNama }}</span>
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </div>

          <!-- Right: Notifications + User Profile + Logout -->
          <div class="d-flex align-items-center gap-2 flex-shrink-0">
            <!-- Notifications Bell -->
            <div class="position-relative" (click)="$event.stopPropagation()">
              <button type="button"
                      class="btn btn-sm topbar-btn rounded-circle position-relative d-inline-flex align-items-center justify-content-center"
                      style="width: 38px; height: 38px;"
                      title="Notifikasi Sistem"
                      (click)="showNotifMenu.set(!showNotifMenu()); showUserMenu.set(false)">
                <i class="bi bi-bell"></i>
                <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                      style="font-size: 0.6rem; padding: 0.2rem 0.38rem;">
                  2
                </span>
              </button>

              @if (showNotifMenu()) {
                <div class="topbar-popover end-0 shadow-lg rounded-4 p-2 mt-2" style="width: 310px; left: auto;">
                  <div class="px-2 py-1 border-bottom d-flex justify-content-between align-items-center mb-1">
                    <span class="small fw-bold text-dark">Notifikasi</span>
                    <span class="badge badge-neutral" style="font-size: 0.68rem;">TA {{ auth.tahunAnggaran() }}</span>
                  </div>
                  <div class="p-2 rounded-3 hover-bg-light mb-1">
                    <div class="small fw-semibold text-dark">Rekonsiliasi &amp; Tutup Buku</div>
                    <small class="text-muted d-block">Pastikan seluruh SPJ telah diajukan sebelum batas pengajuan periode.</small>
                  </div>
                  <div class="p-2 rounded-3 hover-bg-light">
                    <div class="small fw-semibold text-dark">Koneksi Layanan Aktif</div>
                    <small class="text-muted d-block">Gateway Bank DKI CMS, Pajak MPN G3, SIPKD &amp; SIMPEG siap digunakan.</small>
                  </div>
                </div>
              }
            </div>

            <!-- User Profile & Quick Role Switcher Dropdown -->
            <div class="position-relative" (click)="$event.stopPropagation()">
              <button type="button"
                      class="btn btn-sm topbar-btn rounded-pill px-2 px-md-3 py-1 d-flex align-items-center gap-2"
                      (click)="showUserMenu.set(!showUserMenu()); showNotifMenu.set(false)">
                <div class="rounded-circle bg-white text-dark d-flex align-items-center justify-content-center fw-bold"
                     style="width: 28px; height: 28px; font-size: 0.75rem;">
                  {{ userInitials() }}
                </div>
                <div class="d-none d-md-block text-start lh-1">
                  <div class="small fw-bold text-white">{{ auth.currentUser()?.namaLengkap }}</div>
                  <div class="text-white" style="font-size: 0.68rem; opacity: 0.88;">{{ auth.currentUser()?.roleCode }} · NRK {{ auth.currentUser()?.nrk }}</div>
                </div>
                <i class="bi bi-chevron-down text-white small"></i>
              </button>

              @if (showUserMenu()) {
                <div class="topbar-popover end-0 shadow-lg rounded-4 p-2 mt-2" style="width: 300px; left: auto;">
                  <div class="px-2 py-2 border-bottom mb-2">
                    <div class="fw-bold small text-dark">{{ auth.currentUser()?.namaLengkap }}</div>
                    <div class="text-muted" style="font-size: 0.72rem;">{{ auth.currentUser()?.jabatan }}</div>
                    <div class="d-flex flex-wrap gap-1 mt-1">
                      @for (role of auth.getUserRoles(); track role) {
                        <span class="badge badge-neutral" style="font-size: 0.66rem;">{{ role }}</span>
                      }
                    </div>
                    <div class="text-muted mt-1" style="font-size: 0.72rem;">
                      TA {{ auth.tahunAnggaran() }} · {{ auth.activeSekolah()?.namaSekolah || (auth.requiresSchoolPicker() ? 'Belum memilih sekolah' : 'Dinas Pendidikan') }}
                    </div>
                  </div>

                  @if (auth.requiresSchoolPicker()) {
                    <button type="button"
                            class="dropdown-item rounded-3 py-2 small fw-semibold"
                            style="color: #B45309; background: #FFF8EB;"
                            (click)="auth.openSekolahPicker(); showUserMenu.set(false)">
                      <i class="bi bi-building-fill-check me-2"></i>Pilih Sekolah (DataTables)
                    </button>
                    <hr class="my-2">
                  }

                  <a class="dropdown-item rounded-3 py-2 small" routerLink="/landingpage" (click)="showUserMenu.set(false)">
                    <i class="bi bi-house-door me-2 text-muted"></i>Ke Landing Page
                  </a>
                  <button type="button" class="dropdown-item rounded-3 py-2 small text-danger fw-semibold" (click)="auth.logout()">
                    <i class="bi bi-box-arrow-right me-2"></i>Logout
                  </button>
                </div>
              }
            </div>

            <!-- Direct Logout Icon Button on Desktop -->
            <button type="button"
                    class="btn btn-sm topbar-btn rounded-pill px-3 d-none d-lg-inline-flex align-items-center gap-1"
                    title="Keluar dari Aplikasi"
                    (click)="auth.logout()">
              <i class="bi bi-box-arrow-right"></i>
              <span class="small fw-semibold">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <!-- Mobile Sidebar Backdrop -->
      @if (sidebarOpen()) {
        <div class="d-lg-none position-fixed inset-0 bg-dark bg-opacity-50" style="z-index: 1035;" (click)="sidebarOpen.set(false)"></div>
      }

      <!-- WORKSPACE SPLIT SHELL -->
      <div class="d-flex flex-grow-1 position-relative">
        <!-- COLLAPSIBLE LEFT SIDEBAR: ALL 5 MAIN MODULES IN ONE ACCORDION TREE -->
        <aside class="siap-sidebar flex-shrink-0"
               [class.collapsed]="sidebarCollapsed()"
               [class.show]="sidebarOpen()">
          <nav class="sidebar-scroll-nav p-2">
            @for (app of auth.listAplikasi(); track app.kodeAplikasi) {
              <div class="mb-1">
                <!-- Module Parent Header -->
                <button type="button"
                        class="sidebar-group-btn w-100 d-flex align-items-center px-2 py-2 rounded-3 border-0 bg-transparent text-start"
                        [class.justify-content-center]="sidebarCollapsed()"
                        [class.justify-content-between]="!sidebarCollapsed()"
                        [class.group-active]="isModuleActive(app.link)"
                        [title]="app.nama"
                        (click)="onModuleHeaderClick(app)">
                  <div class="d-flex align-items-center gap-2 overflow-hidden">
                    <span class="sidebar-group-icon flex-shrink-0">
                      <i class="bi {{ app.icon }}"></i>
                    </span>
                    @if (!sidebarCollapsed()) {
                      <span class="small fw-bold text-truncate">{{ app.nama }}</span>
                    }
                  </div>

                  @if (!sidebarCollapsed()) {
                    <div class="d-flex align-items-center gap-1 flex-shrink-0">
                      <span class="badge badge-neutral rounded-pill" style="font-size: 0.68rem;">{{ app.menu.length }}</span>
                      <i class="bi small text-muted"
                         [class.bi-chevron-down]="isGroupExpanded(app.link)"
                         [class.bi-chevron-right]="!isGroupExpanded(app.link)"></i>
                    </div>
                  }
                </button>

                <!-- Sub-Menus List (when expanded and sidebar not collapsed) -->
                @if (!sidebarCollapsed() && isGroupExpanded(app.link)) {
                  <div class="ps-3 ms-2 border-start mt-1 mb-2">
                    @for (mn of app.menu; track mn.link) {
                      <a class="sidebar-sub-link d-flex align-items-center gap-2 px-2 py-2 rounded-2 mb-1 text-decoration-none"
                         [routerLink]="['/', app.link, mn.link]"
                         routerLinkActive="active"
                         (click)="sidebarOpen.set(false)">
                        <i class="bi {{ mn.icon }} sub-icon"></i>
                        <span class="small text-truncate">{{ mn.nama }}</span>
                      </a>
                    }
                  </div>
                }
              </div>
            }
          </nav>

          @if (!sidebarCollapsed()) {
            <div class="p-3 border-top small text-muted" style="background: #F8FAFC; font-size: 0.74rem;">
              <div class="d-flex align-items-center justify-content-between gap-2 mb-1">
                <div class="d-flex align-items-center gap-2">
                  <span class="pulse-dot"></span>
                  <span class="fw-semibold text-dark">Unit Aktif</span>
                </div>
                @if (auth.requiresSchoolPicker()) {
                  <button type="button"
                          class="btn btn-link btn-sm p-0 text-decoration-none fw-semibold"
                          style="font-size: 0.7rem; color: #EA580C;"
                          (click)="auth.openSekolahPicker()">
                    DataTables
                  </button>
                }
              </div>
              <div class="text-truncate">{{ auth.activeSekolah()?.namaSekolah || (auth.requiresSchoolPicker() ? 'Pilih Sekolah via DataTables' : 'Dinas Pendidikan DKI Jakarta') }}</div>
            </div>
          }
        </aside>

        <!-- MAIN CONTENT WORKSPACE -->
        <main class="flex-grow-1 d-flex flex-column min-w-0" style="overflow-x: clip;">
          <div class="container-fluid px-3 px-lg-4 py-4 flex-grow-1">
            <!-- SINGLE UNIFIED DECLUTTERED PAGE HEADER -->
            <div class="mb-4">
              <nav aria-label="breadcrumb" class="mb-1">
                <ol class="breadcrumb mb-0 small text-muted" style="font-size: 0.76rem;">
                  <li class="breadcrumb-item">
                    <a routerLink="/landingpage" class="text-decoration-none text-muted">Portal</a>
                  </li>
                  <li class="breadcrumb-item text-muted">{{ activeModule()?.nama }}</li>
                  <li class="breadcrumb-item active text-dark fw-semibold">{{ pageTitle() }}</li>
                </ol>
              </nav>

              <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div class="d-flex align-items-center gap-2 position-relative">
                  <h4 class="fw-bold mb-0 text-dark" style="letter-spacing: -0.02em;">{{ pageTitle() }}</h4>
                  @if (pageDescription()) {
                    <button type="button"
                            class="btn btn-sm p-0 border-0 text-muted d-inline-flex align-items-center"
                            [title]="pageDescription()"
                            (click)="showPageHelp.set(!showPageHelp()); $event.stopPropagation()">
                      <i class="bi bi-info-circle"></i>
                    </button>
                    @if (showPageHelp()) {
                      <div class="topbar-popover p-3 rounded-3 shadow-sm small text-secondary"
                           style="width: 320px; top: 100%; left: 0; margin-top: 6px; z-index: 1020;"
                           (click)="$event.stopPropagation()">
                        {{ pageDescription() }}
                      </div>
                    }
                  }
                </div>
                @if (auth.requiresSchoolPicker()) {
                  <button type="button"
                          class="btn btn-sm btn-outline-warning rounded-pill px-3 d-inline-flex align-items-center gap-2 text-dark border"
                          style="background: #FFFBF5; border-color: rgba(255,154,0,0.45) !important;"
                          (click)="auth.openSekolahPicker()">
                    <i class="bi bi-building-fill-check" style="color: #F97316;"></i>
                    <span class="small fw-semibold">{{ auth.activeSekolah()?.namaSekolah || 'Pilih Sekolah (DataTables)' }}</span>
                  </button>
                }
              </div>
            </div>

            @if (needsSekolahGate()) {
              <div class="siap-card p-5 text-center my-4">
                <div class="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                     style="width: 64px; height: 64px; background: #FFF4E5; color: #FF9A00;">
                  <i class="bi bi-building-fill-check fs-2"></i>
                </div>
                <h5 class="fw-bold text-dark mb-2">Pilih Sekolah Terlebih Dahulu</h5>
                <p class="text-muted small mx-auto mb-4" style="max-width: 480px;">
                  Menu operasional ini memerlukan pemilihan satuan pendidikan aktif melalui <strong>DataTables Sekolah</strong> sebelum data dapat ditampilkan.
                </p>
                <button type="button" class="btn btn-siap rounded-pill px-4" (click)="openGateSekolahPicker()">
                  <i class="bi bi-table me-2"></i>Buka DataTables Sekolah
                </button>
              </div>
            } @else {
              <div class="animate-page">
                <router-outlet />
              </div>
            }
          </div>

          <footer class="bg-white border-top px-4 py-2 d-flex flex-wrap justify-content-between align-items-center text-muted" style="font-size: 0.76rem;">
            <span>PUSAT DATA DAN INFORMASI KEUANGAN {{ auth.tahunAnggaran() }} · DINAS PENDIDIKAN PROVINSI DKI JAKARTA</span>
            <span class="fw-semibold text-dark">SIAP BOSP &amp; BOP</span>
          </footer>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .siap-topbar {
      background: linear-gradient(90deg, #FF9A00 0%, #F97316 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.22);
      box-shadow: 0 4px 14px rgba(249, 115, 22, 0.22);
      z-index: 1030;
    }
    .topbar-logo-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.22);
      border: 1.5px solid rgba(255, 255, 255, 0.55);
      border-radius: 10px;
      padding: 4px 6px;
    }
    .topbar-btn {
      background: rgba(255, 255, 255, 0.16);
      border: 1px solid rgba(255, 255, 255, 0.32);
      color: #FFFFFF !important;
      font-weight: 600;
      transition: background-color 0.16s ease, border-color 0.16s ease;
    }
    .topbar-btn:hover {
      background: rgba(255, 255, 255, 0.28);
      border-color: rgba(255, 255, 255, 0.55);
      color: #FFFFFF !important;
    }
    .global-search-box {
      background: #FFFFFF;
      border: 1px solid rgba(255, 255, 255, 0.9);
      height: 36px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      transition: box-shadow 0.16s ease;
    }
    .global-search-box:focus-within {
      background: #FFFFFF;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.14);
    }
    .topbar-popover {
      position: absolute;
      top: 100%;
      left: 0;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      z-index: 1055;
    }
    .active-role-item {
      background-color: #FFF7ED;
      color: #C2410C;
    }

    /* Left Sidebar (Fixed Viewport Height + Independent Scroll + Collapsible) */
    .siap-sidebar {
      width: 272px;
      background: #FFFFFF;
      border-right: 1px solid #E2E8F0;
      display: flex;
      flex-direction: column;
      height: calc(100vh - 63px);
      max-height: calc(100vh - 63px);
      position: sticky;
      top: 63px;
      overflow: hidden;
      transition: width 0.22s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .sidebar-scroll-nav {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
    }
    .siap-sidebar.collapsed {
      width: 72px;
    }
    .sidebar-group-btn {
      color: #334155;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .sidebar-group-btn:hover {
      background-color: #F8FAFC !important;
      color: #0F172A;
    }
    .sidebar-group-btn.group-active {
      color: #0F172A;
      background-color: #F8FAFC !important;
    }
    .sidebar-group-icon {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: #F1F5F9;
      color: #475569;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.95rem;
    }
    .sidebar-group-btn.group-active .sidebar-group-icon {
      background: #FFF7ED;
      color: #FF9A00;
    }

    /* Restrained Orange Active Indicator ONLY on current active sub-menu */
    .sidebar-sub-link {
      color: #475569;
      position: relative;
      transition: background-color 0.14s ease, color 0.14s ease;
    }
    .sidebar-sub-link .sub-icon {
      color: #94A3B8;
      font-size: 0.85rem;
      flex-shrink: 0;
    }
    .sidebar-sub-link:hover {
      background-color: #F8FAFC;
      color: #0F172A;
    }
    .sidebar-sub-link.active {
      background-color: #FFF7ED;
      color: #C2410C;
      font-weight: 600;
      border-left: 3px solid #FF9A00;
    }
    .sidebar-sub-link.active .sub-icon {
      color: #FF9A00;
    }
    .hover-bg-light:hover {
      background-color: #F8FAFC;
    }

    @media (max-width: 991.98px) {
      .siap-sidebar {
        position: fixed;
        top: 63px;
        left: -285px;
        bottom: 0;
        width: 272px !important;
        z-index: 1040;
        transition: left 0.24s cubic-bezier(0.22, 1, 0.36, 1);
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

  readonly sidebarOpen = signal(false);
  readonly sidebarCollapsed = signal(false);
  readonly expandedGroup = signal<string | null>(null);
  readonly showSearchDropdown = signal(false);
  readonly showNotifMenu = signal(false);
  readonly showUserMenu = signal(false);
  readonly showPageHelp = signal(false);
  readonly currentUrl = signal(this.router.url);
  readonly pageTitle = signal('Dashboard');
  readonly pageDescription = signal('');

  readonly globalQuery = signal('');

  readonly currentRoot = computed(() => {
    const seg = this.currentUrl().split('/').filter(Boolean)[0] ?? 'bos-negeri';
    return seg === 'bop-negeri' ? 'bku-bop' : seg;
  });

  readonly activeModule = computed(() => {
    const root = this.currentRoot();
    return this.auth.listAplikasi().find((a) => a.link === root) ?? this.auth.listAplikasi()[0] ?? null;
  });

  readonly needsSekolahGate = computed(() => {
    if (!this.auth.requiresSchoolPicker() || this.auth.sekolahConfirmed()) return false;
    const meta = this.auth.findMenuMeta(this.currentUrl());
    return !!meta?.menu?.requiresSekolah;
  });

  readonly userInitials = computed(() => {
    const name = this.auth.currentUser()?.namaLengkap?.trim() || 'U';
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  });

  readonly searchResults = computed(() => {
    const q = this.globalQuery().trim().toLowerCase();
    if (!q) return [];
    const results: { appNama: string; appLink: string; menuNama: string; fullUrl: string; icon: string; requiresSekolah: boolean }[] = [];
    for (const app of this.auth.listAplikasi()) {
      for (const mn of app.menu) {
        if (mn.nama.toLowerCase().includes(q)) {
          results.push({
            appNama: app.nama,
            appLink: app.link,
            menuNama: mn.nama,
            fullUrl: `/${app.link}/${mn.link}`,
            icon: mn.icon,
            requiresSekolah: !!mn.requiresSekolah
          });
        }
      }
    }
    results.sort((a, b) => {
      const aStarts = a.menuNama.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.menuNama.toLowerCase().startsWith(q) ? 0 : 1;
      return aStarts - bStarts || a.menuNama.localeCompare(b.menuNama);
    });
    return results.slice(0, 15);
  });

  ngOnInit(): void {
    this.auth.loadSekolahOptions().subscribe();
    this.expandedGroup.set(this.currentRoot());
    this.updateTitle();
    this.checkSekolahGate(this.router.url);
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.currentUrl.set(this.router.url);
      this.expandedGroup.set(this.currentRoot());
      this.closePopovers();
      this.updateTitle();
      this.checkSekolahGate(this.router.url);
    });
  }

  onSearchChange(value: string): void {
    this.globalQuery.set(value);
    this.showSearchDropdown.set(true);
  }

  onSearchEnter(): void {
    const first = this.searchResults()[0];
    if (first) {
      this.navigateFromSearch(first);
    }
  }

  clearSearch(): void {
    this.globalQuery.set('');
    this.showSearchDropdown.set(false);
  }

  isModuleActive(link: string): boolean {
    return this.currentRoot() === link;
  }

  isGroupExpanded(link: string): boolean {
    return this.expandedGroup() === link;
  }

  onModuleHeaderClick(app: { link: string; menu: { link: string }[] }): void {
    if (this.sidebarCollapsed()) {
      this.sidebarCollapsed.set(false);
      this.expandedGroup.set(app.link);
      return;
    }
    this.expandedGroup.set(this.expandedGroup() === app.link ? null : app.link);
  }

  navigateFromSearch(item: { appLink: string; fullUrl: string; requiresSekolah: boolean }): void {
    this.expandedGroup.set(item.appLink);
    this.globalQuery.set('');
    this.showSearchDropdown.set(false);
    if (this.auth.requiresSchoolPicker() && !this.auth.sekolahConfirmed() && item.requiresSekolah) {
      this.auth.openSekolahPicker(item.fullUrl);
      return;
    }
    this.router.navigateByUrl(item.fullUrl);
  }

  closePopovers(): void {
    this.showSearchDropdown.set(false);
    this.showNotifMenu.set(false);
    this.showUserMenu.set(false);
    this.showPageHelp.set(false);
  }

  openGateSekolahPicker(): void {
    this.auth.openSekolahPicker(this.router.url);
  }

  private checkSekolahGate(url: string): void {
    if (!this.auth.requiresSchoolPicker() || this.auth.sekolahConfirmed()) return;
    const meta = this.auth.findMenuMeta(url);
    if (meta?.menu?.requiresSekolah) {
      this.auth.openSekolahPicker(url);
    }
  }

  private updateTitle(): void {
    let r = this.route;
    while (r.firstChild) r = r.firstChild;
    const t = r.snapshot.data?.['title'];
    const d = r.snapshot.data?.['desc'] || '';
    if (t) this.pageTitle.set(t);
    this.pageDescription.set(d);
  }
}
