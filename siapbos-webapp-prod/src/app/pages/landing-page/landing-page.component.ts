import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

export interface MainMenuGroup {
  kode: string;
  nama: string;
  link: string;
  icon: string;
  badge: string;
  color: string;
  subMenus: { nama: string; link: string; icon: string }[];
}

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background-color: #FFFBF5;
      color: #1e293b;
      overflow-x: hidden;
    }

    /* Top Creative Navbar */
    .landing-nav {
      position: sticky;
      top: 0;
      z-index: 1030;
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(14px);
      border-bottom: 2px solid rgba(255, 154, 0, 0.22);
      box-shadow: 0 4px 20px rgba(255, 154, 0, 0.08);
    }

    .brand-logo-box {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: linear-gradient(135deg, #FF9A00 0%, #FF6D00 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 16px rgba(255, 154, 0, 0.38);
      border: 2px solid #fff;
      flex-shrink: 0;
    }

    .brand-logo-box img {
      width: 38px;
      height: 38px;
      object-fit: contain;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
    }

    .nav-pill-link {
      color: #334155;
      font-weight: 600;
      font-size: 0.88rem;
      padding: 0.45rem 0.9rem;
      border-radius: 999px;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .nav-pill-link:hover, .nav-pill-link.active {
      background: #FFF3E0;
      color: #D97706;
    }

    /* Envato-Inspired Creative #FF9A00 Hero */
    .hero-creative {
      position: relative;
      background: linear-gradient(135deg, #FF9A00 0%, #FF8000 55%, #FFB340 100%);
      padding: 3.2rem 0 5.5rem;
      overflow: hidden;
      color: #ffffff;
    }

    .hero-orb-1 {
      position: absolute;
      width: 420px;
      height: 420px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.26) 0%, rgba(255, 255, 255, 0) 70%);
      top: -120px;
      right: -80px;
      pointer-events: none;
    }

    .hero-orb-2 {
      position: absolute;
      width: 320px;
      height: 320px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255, 56, 0, 0.22) 0%, rgba(255, 56, 0, 0) 70%);
      bottom: -80px;
      left: 10%;
      pointer-events: none;
    }

    .hero-logo-showcase {
      display: inline-flex;
      align-items: center;
      gap: 0.9rem;
      background: rgba(255, 255, 255, 0.18);
      backdrop-filter: blur(10px);
      border: 2px solid rgba(255, 255, 255, 0.55);
      border-radius: 20px;
      padding: 0.55rem 1.15rem 0.55rem 0.65rem;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.12);
    }

    .hero-logo-crest {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      background: linear-gradient(135deg, #FF7700 0%, #FF3800 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #ffffff;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
    }

    .hero-logo-crest img {
      width: 48px;
      height: 48px;
      object-fit: contain;
      filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.25));
    }

    .siap-acrostic {
      font-weight: 800;
      font-size: clamp(2rem, 3.6vw, 3.1rem);
      line-height: 1.12;
      letter-spacing: -0.02em;
      text-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    }

    .siap-letter {
      color: #FF3800;
      background: #ffffff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.32em;
      height: 1.32em;
      border-radius: 12px;
      margin-right: 0.14em;
      margin-bottom: 0.12em;
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.14);
      font-weight: 900;
    }

    .hero-illustration-card {
      position: relative;
      background: rgba(255, 255, 255, 0.96);
      border-radius: 28px;
      padding: 1.5rem;
      box-shadow: 0 24px 50px rgba(124, 45, 18, 0.24);
      border: 3px solid rgba(255, 255, 255, 0.9);
    }

    .hero-stat-pill {
      background: #ffffff;
      color: #1e293b;
      border-radius: 16px;
      padding: 0.55rem 0.95rem;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
      border: 1px solid rgba(255, 154, 0, 0.3);
      font-size: 0.8rem;
    }

    .hero-wave-bottom {
      position: absolute;
      bottom: -1px;
      left: 0;
      width: 100%;
      line-height: 0;
      pointer-events: none;
    }

    /* 5 Main Menus Cards */
    .menu-section-wrap {
      margin-top: -2.6rem;
      position: relative;
      z-index: 10;
    }

    .main-menu-card {
      background: #ffffff;
      border-radius: 20px;
      padding: 1.25rem 1rem;
      border: 2px solid rgba(255, 154, 0, 0.18);
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
      cursor: pointer;
      transition: all 0.24s cubic-bezier(0.22, 1, 0.36, 1);
      height: 100%;
      text-align: center;
    }

    .main-menu-card:hover {
      transform: translateY(-5px);
      border-color: #FF9A00;
      box-shadow: 0 16px 34px rgba(255, 154, 0, 0.2);
    }

    .main-menu-card.active {
      background: linear-gradient(135deg, #FF9A00 0%, #FF7A00 100%);
      color: #ffffff;
      border-color: #ffffff;
      box-shadow: 0 16px 34px rgba(255, 154, 0, 0.38);
      transform: translateY(-5px);
    }

    .menu-icon-circle {
      width: 54px;
      height: 54px;
      border-radius: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      margin-bottom: 0.65rem;
      background: #FFF3E0;
      color: #FF8000;
      transition: all 0.2s ease;
    }

    .main-menu-card.active .menu-icon-circle {
      background: rgba(255, 255, 255, 0.24);
      color: #ffffff;
    }

    .submenu-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.5rem 0.95rem;
      border-radius: 12px;
      background: #FFF9F0;
      border: 1px solid rgba(255, 154, 0, 0.28);
      color: #1e293b;
      font-weight: 600;
      font-size: 0.82rem;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.18s ease;
    }

    .submenu-chip:hover {
      background: #FF9A00;
      color: #ffffff;
      border-color: #FF9A00;
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(255, 154, 0, 0.28);
    }

    /* Dropdown Mega Menu in Navbar */
    .app-dropdown-panel {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: min(92vw, 760px);
      background: #ffffff;
      border-radius: 20px;
      border: 2px solid rgba(255, 154, 0, 0.3);
      box-shadow: 0 24px 55px rgba(15, 23, 42, 0.18);
      padding: 1.15rem;
      z-index: 1060;
      max-height: 78vh;
      overflow-y: auto;
    }
  `],
  template: `
    <!-- TOP NAVBAR -->
    <nav class="landing-nav py-2">
      <div class="container d-flex align-items-center justify-content-between gap-2">
        <!-- Clear SIAP BOS Logo + Brand -->
        <a class="d-flex align-items-center gap-3 text-decoration-none" routerLink="/landingpage">
          <div class="brand-logo-box">
            <img src="assets/img/login/Logo.png" alt="Logo SIAP BOS">
          </div>
          <div>
            <div class="fw-extrabold fs-5 text-dark lh-1" style="letter-spacing: -0.02em;">
              SIAP <span style="color: #FF9A00;">BOSP &amp; BOP</span>
            </div>
            <small class="text-muted fw-semibold" style="font-size: 0.72rem;">Dinas Pendidikan Prov. DKI Jakarta</small>
          </div>
        </a>

        <!-- Simple Nav Links + Aplikasi Dropdown -->
        <div class="d-none d-lg-flex align-items-center gap-1">
          <a class="nav-pill-link" [class.active]="infoTab() === 'menu'" (click)="scrollToSection('menu-section')">5 Menu Utama</a>
          <a class="nav-pill-link" [class.active]="infoTab() === 'berita'" (click)="selectInfoTab('berita')">Berita</a>
          <a class="nav-pill-link" [class.active]="infoTab() === 'peraturan'" (click)="selectInfoTab('peraturan')">Peraturan</a>
          <a class="nav-pill-link" [class.active]="infoTab() === 'prosedur'" (click)="selectInfoTab('prosedur')">Prosedur</a>

          <!-- Dropdown Aplikasi (5 Menu Utama + Sub Menu) -->
          <div class="position-relative">
            <button class="btn btn-sm rounded-pill px-3 fw-bold"
                    style="background: #FFF3E0; color: #D97706; border: 1px solid rgba(255,154,0,0.4);"
                    (click)="showAppMenu.set(!showAppMenu())">
              <i class="bi bi-grid-3x3-gap-fill me-1"></i>Aplikasi (5 Menu)
              <i class="bi bi-chevron-down ms-1 small"></i>
            </button>

            @if (showAppMenu()) {
              <div class="app-dropdown-panel animate-page">
                <div class="d-flex justify-content-between align-items-center pb-2 mb-2 border-bottom">
                  <span class="fw-bold text-dark small"><i class="bi bi-layers-fill text-warning me-1"></i>5 Menu Utama &amp; Sub-Menu SIAP BOS</span>
                  <button class="btn-close btn-sm" (click)="showAppMenu.set(false)"></button>
                </div>
                <div class="row g-2">
                  @for (grp of mainMenus; track grp.kode) {
                    <div class="col-md-4">
                      <div class="p-2 rounded-3 h-100" style="background: #FFFBF5; border: 1px solid rgba(255,154,0,0.2);">
                        <div class="fw-bold small mb-2 d-flex align-items-center justify-content-between" style="color: #D97706;">
                          <span><i class="bi {{ grp.icon }} me-1"></i>{{ grp.nama }}</span>
                          <span class="badge rounded-pill text-bg-warning text-dark">{{ grp.subMenus.length }}</span>
                        </div>
                        <div class="d-flex flex-column gap-1" style="max-height: 170px; overflow-y: auto;">
                          @for (sub of grp.subMenus; track sub.link) {
                            <a class="text-decoration-none small px-2 py-1 rounded-2 text-dark hover-orange"
                               style="font-size: 0.76rem; cursor: pointer;"
                               (click)="openSubMenu(grp, sub); showAppMenu.set(false)">
                              <i class="bi {{ sub.icon }} text-warning me-1"></i>{{ sub.nama }}
                            </a>
                          }
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Right CTA: Login / Workspace / Logout -->
        <div class="d-flex align-items-center gap-2">
          @if (auth.isLoggedIn()) {
            <span class="badge rounded-pill d-none d-md-inline-flex align-items-center gap-1 px-3 py-2"
                  style="background: #FFF3E0; color: #9A3412; border: 1px solid rgba(255,154,0,0.35);">
              <i class="bi bi-person-check-fill text-warning"></i>
              {{ auth.tahunAnggaran() }} | {{ auth.currentUser()?.namaLengkap }}
            </span>
            <a routerLink="/bos-negeri/dashboard" class="btn btn-sm btn-siap rounded-pill px-3 py-2">
              <i class="bi bi-grid-1x2-fill me-1"></i>Workspace
            </a>
            <button class="btn btn-sm btn-navy rounded-pill px-3 py-2" (click)="auth.logout()">
              <i class="bi bi-box-arrow-right me-1"></i>Log Out
            </button>
          } @else {
            <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 py-2 d-none d-sm-inline-block" (click)="showPasswordModal.set(true)">
              <i class="bi bi-key me-1"></i>Ubah Sandi
            </button>
            <a routerLink="/login" class="btn btn-sm btn-siap rounded-pill px-4 py-2 shadow-sm">
              <i class="bi bi-box-arrow-in-right me-1"></i>Login
            </a>
          }
        </div>
      </div>
    </nav>

    <!-- CREATIVE #FF9A00 HERO SECTION (SIMPLE, VISUAL, CLEAR LOGO) -->
    <section class="hero-creative">
      <div class="hero-orb-1"></div>
      <div class="hero-orb-2"></div>

      <div class="container position-relative" style="z-index: 2;">
        <div class="row align-items-center g-4">
          <!-- Left Column: Clear SIAP BOS Logo + S-I-A-P Acrostic + Simple CTA -->
          <div class="col-lg-6">
            <div class="hero-logo-showcase mb-4 animate-page">
              <div class="hero-logo-crest">
                <img src="assets/img/login/Logo.png" alt="Logo Resmi SIAP BOS">
              </div>
              <div>
                <div class="badge bg-white text-dark fw-bold rounded-pill mb-1 px-2 py-1" style="font-size: 0.7rem;">
                  PORTAL RESMI DKI JAKARTA
                </div>
                <div class="fw-extrabold fs-5 text-white lh-1">SIAP BOSP &amp; BOP</div>
                <small class="text-white-50" style="font-size: 0.74rem;">Auth · OAuth · SIAP Database Terintegrasi</small>
              </div>
            </div>

            <div class="siap-acrostic mb-3">
              <div><span class="siap-letter">S</span>istem</div>
              <div><span class="siap-letter">I</span>nformasi</div>
              <div><span class="siap-letter">A</span>kuntabilitas</div>
              <div><span class="siap-letter">P</span>endidikan</div>
            </div>

            <p class="fs-6 text-white mb-4 fw-medium" style="max-width: 480px; opacity: 0.95;">
              Kelola BKU BOSP &amp; BOP Negeri secara ringkas, transparan, dan terintegrasi langsung dengan Bank DKI, SIPKD &amp; Pajak MPN.
            </p>

            <div class="d-flex flex-wrap gap-2">
              @if (auth.isLoggedIn()) {
                <a routerLink="/bos-negeri/dashboard" class="btn btn-light btn-lg rounded-pill px-4 fw-bold shadow" style="color: #D97706;">
                  <i class="bi bi-rocket-takeoff-fill me-2"></i>Buka Dashboard BKU
                </a>
                <button class="btn btn-navy btn-lg rounded-pill px-4 fw-bold shadow" (click)="auth.logout()">
                  <i class="bi bi-power me-1"></i>Log Out
                </button>
              } @else {
                <a routerLink="/login" class="btn btn-light btn-lg rounded-pill px-4 fw-bold shadow" style="color: #D97706;">
                  <i class="bi bi-box-arrow-in-right me-2"></i>Login Aplikasi
                </a>
                <button class="btn btn-outline-light btn-lg rounded-pill px-4 fw-semibold" (click)="scrollToSection('menu-section')">
                  <i class="bi bi-grid-fill me-1"></i>Lihat 5 Menu Utama
                </button>
              }
            </div>
          </div>

          <!-- Right Column: Official Illustration + Compact KPI Pills -->
          <div class="col-lg-6">
            <div class="hero-illustration-card animate-float">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <div class="d-flex align-items-center gap-2">
                  <span class="siap-logo-emblem p-1" style="border-radius: 10px;">
                    <img src="assets/img/login/Logo.png" alt="SIAP Logo" width="28" height="28">
                  </span>
                  <span class="fw-bold text-dark small">SIAP BOSP &amp; BOP · Tahun 2025 / 2026</span>
                </div>
                <span class="badge rounded-pill" style="background: #FFF3E0; color: #D97706;">
                  <span class="pulse-dot me-1"></span>Online
                </span>
              </div>

              <div class="text-center py-2">
                <img src="assets/img/login/SIAP BOS_login_ilustrasi.png"
                     alt="Ilustrasi SIAP BOS"
                     class="img-fluid rounded-4"
                     style="max-height: 290px; object-fit: contain;">
              </div>

              <div class="row g-2 mt-1">
                <div class="col-4">
                  <div class="hero-stat-pill text-center">
                    <div class="fw-extrabold fs-6" style="color: #FF8000;">{{ summary().jumlahSekolah }}</div>
                    <div class="text-muted" style="font-size: 0.7rem;">Sekolah Negeri</div>
                  </div>
                </div>
                <div class="col-4">
                  <div class="hero-stat-pill text-center">
                    <div class="fw-extrabold fs-6 text-success">{{ summary().persenSerapan }}%</div>
                    <div class="text-muted" style="font-size: 0.7rem;">Serapan BKU</div>
                  </div>
                </div>
                <div class="col-4">
                  <div class="hero-stat-pill text-center">
                    <div class="fw-extrabold fs-6 text-primary">5 Modul</div>
                    <div class="text-muted" style="font-size: 0.7rem;">70+ Sub-Menu</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Wave Divider -->
      <div class="hero-wave-bottom">
        <svg viewBox="0 0 1440 90" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style="width: 100%; height: 65px;">
          <path d="M0 36C240 90 480 90 720 48C960 6 1200 6 1440 48V90H0V36Z" fill="#FFFBF5"/>
        </svg>
      </div>
    </section>

    <!-- 5 MAIN MENUS & INTERACTIVE SUB-MENUS -->
    <section id="menu-section" class="menu-section-wrap pb-5">
      <div class="container">
        <!-- 5 Main Menu Cards -->
        <div class="row g-3 justify-content-center mb-4">
          @for (grp of mainMenus; track grp.kode) {
            <div class="col-6 col-md-4 col-lg">
              <div class="main-menu-card"
                   [class.active]="selectedMenu().kode === grp.kode"
                   (click)="selectedMenu.set(grp)">
                <div class="menu-icon-circle">
                  <i class="bi {{ grp.icon }}"></i>
                </div>
                <h6 class="fw-bold mb-1">{{ grp.nama }}</h6>
                <span class="badge rounded-pill"
                      [ngClass]="selectedMenu().kode === grp.kode ? 'bg-white text-dark' : 'text-bg-warning text-dark'">
                  {{ grp.subMenus.length }} Sub-Menu
                </span>
              </div>
            </div>
          }
        </div>

        <!-- Active Main Menu Sub-Menu Chips Box -->
        <div class="siap-card p-4 animate-page" style="border: 2px solid rgba(255, 154, 0, 0.28);">
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 pb-2 border-bottom">
            <div class="d-flex align-items-center gap-2">
              <span class="siap-logo-emblem p-2" style="border-radius: 12px;">
                <i class="bi {{ selectedMenu().icon }} text-white fs-5"></i>
              </span>
              <div>
                <h5 class="fw-bold mb-0">{{ selectedMenu().nama }}</h5>
                <small class="text-muted">Klik sub-menu di bawah untuk langsung membuka halaman modul</small>
              </div>
            </div>
            <button class="btn btn-sm btn-siap rounded-pill px-3" (click)="openMainMenu(selectedMenu())">
              <i class="bi bi-box-arrow-up-right me-1"></i>Buka {{ selectedMenu().nama }}
            </button>
          </div>

          <div class="d-flex flex-wrap gap-2">
            @for (sub of selectedMenu().subMenus; track sub.link) {
              <a class="submenu-chip" (click)="openSubMenu(selectedMenu(), sub)">
                <i class="bi {{ sub.icon }}" style="color: #FF8000;"></i>
                <span>{{ sub.nama }}</span>
              </a>
            }
          </div>
        </div>
      </div>
    </section>

    <!-- SIMPLE TABBED INFO STRIP (BERITA / PERATURAN / PROSEDUR) -->
    <section id="info-section" class="pb-5">
      <div class="container">
        <div class="d-flex justify-content-center gap-2 mb-3 flex-wrap">
          <button class="btn btn-sm rounded-pill px-4 fw-bold"
                  [ngClass]="infoTab() === 'berita' ? 'btn-siap' : 'btn-outline-secondary'"
                  (click)="infoTab.set('berita')">
            <i class="bi bi-newspaper me-1"></i>Berita Terkini
          </button>
          <button class="btn btn-sm rounded-pill px-4 fw-bold"
                  [ngClass]="infoTab() === 'peraturan' ? 'btn-siap' : 'btn-outline-secondary'"
                  (click)="infoTab.set('peraturan')">
            <i class="bi bi-journal-bookmark me-1"></i>Peraturan
          </button>
          <button class="btn btn-sm rounded-pill px-4 fw-bold"
                  [ngClass]="infoTab() === 'prosedur' ? 'btn-siap' : 'btn-outline-secondary'"
                  (click)="infoTab.set('prosedur')">
            <i class="bi bi-diagram-3 me-1"></i>Alur Sistem
          </button>
        </div>

        @if (infoTab() === 'berita') {
          <div class="row g-3">
            @for (b of summary().berita; track b.id) {
              <div class="col-md-4">
                <div class="siap-card p-3 h-100">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="badge rounded-pill" style="background: #FFF3E0; color: #D97706;">{{ b.kategori }}</span>
                    <small class="text-muted">{{ b.tanggal }}</small>
                  </div>
                  <h6 class="fw-bold mb-0">{{ b.judul }}</h6>
                </div>
              </div>
            }
          </div>
        }

        @if (infoTab() === 'peraturan') {
          <div class="row g-3">
            @for (p of summary().peraturan; track p.kode) {
              <div class="col-md-6 col-lg-3">
                <div class="siap-card p-3 h-100">
                  <span class="badge rounded-pill mb-2" style="background: #FFF3E0; color: #D97706;">{{ p.lingkup }}</span>
                  <div class="fw-bold small">{{ p.kode }}</div>
                  <small class="text-muted">{{ p.tentang }}</small>
                </div>
              </div>
            }
          </div>
        }

        @if (infoTab() === 'prosedur') {
          <div class="row g-3">
            @for (s of summary().prosedur; track s.step) {
              <div class="col-md-4 col-lg-2">
                <div class="siap-card p-3 h-100 text-center">
                  <div class="badge rounded-pill text-bg-warning text-dark mb-2">Tahap {{ s.step }}</div>
                  <div class="fw-bold small">{{ s.title }}</div>
                  <small class="text-muted d-block mt-1" style="font-size: 0.72rem;">{{ s.actor }}</small>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </section>

    <!-- SIMPLE FOOTER -->
    <footer class="py-3 border-top bg-white">
      <div class="container d-flex flex-wrap justify-content-between align-items-center gap-2 small text-muted">
        <div class="d-flex align-items-center gap-2">
          <span class="siap-logo-emblem p-1" style="border-radius: 8px;">
            <img src="assets/img/login/Logo.png" alt="Logo SIAP BOS" width="22" height="22">
          </span>
          <strong class="text-dark">SIAP BOSP &amp; BOP</strong> · Dinas Pendidikan Provinsi DKI Jakarta
        </div>
        <div>Schema DB: <code>auth</code> · <code>oauth</code> · <code>siap</code></div>
      </div>
    </footer>

    <!-- MODAL UBAH PASSWORD -->
    @if (showPasswordModal()) {
      <div class="modal-backdrop-custom" (click)="showPasswordModal.set(false)">
        <div class="modal-dialog-custom" style="max-width: 420px;" (click)="$event.stopPropagation()">
          <div class="siap-card-header d-flex justify-content-between align-items-center">
            <h6 class="fw-bold mb-0"><i class="bi bi-key-fill text-warning me-2"></i>Ubah Kata Sandi</h6>
            <button class="btn-close btn-sm" (click)="showPasswordModal.set(false)"></button>
          </div>
          <div class="modal-body-scroll">
            <div class="mb-2">
              <label class="form-label small fw-semibold mb-1">ID Login / NRK</label>
              <input class="form-control form-control-sm" [(ngModel)]="pwdForm.nrk" placeholder="Contoh: ADMIN-TDI atau 199003">
            </div>
            <div class="mb-2">
              <label class="form-label small fw-semibold mb-1">Kata Sandi Lama</label>
              <input type="password" class="form-control form-control-sm" [(ngModel)]="pwdForm.sandiLama">
            </div>
            <div class="mb-3">
              <label class="form-label small fw-semibold mb-1">Kata Sandi Baru</label>
              <input type="password" class="form-control form-control-sm" [(ngModel)]="pwdForm.sandiBaru">
            </div>
            <button class="btn btn-siap w-100 rounded-pill" (click)="submitChangePassword()">Simpan Kata Sandi</button>
          </div>
        </div>
      </div>
    }
  `
})
export class LandingPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly showAppMenu = signal(false);
  readonly showPasswordModal = signal(false);
  readonly infoTab = signal<'menu' | 'berita' | 'peraturan' | 'prosedur'>('berita');

  readonly mainMenus: MainMenuGroup[] = [
    {
      kode: 'UM',
      nama: 'User Management',
      link: 'user-management',
      icon: 'bi-people-fill',
      badge: '7 Sub-Menu',
      color: '#FF9A00',
      subMenus: [
        { nama: 'Pengguna', link: 'pengguna', icon: 'bi-person-badge' },
        { nama: 'Otoritas', link: 'otoritas', icon: 'bi-shield-lock' },
        { nama: 'Aplikasi', link: 'aplikasi', icon: 'bi-grid-1x2' },
        { nama: 'Menu', link: 'menu', icon: 'bi-list-nested' },
        { nama: 'Periode', link: 'periode', icon: 'bi-calendar3' },
        { nama: 'Master Sekolah', link: 'master-sekolah', icon: 'bi-building' },
        { nama: 'Pajak', link: 'pajak', icon: 'bi-percent' }
      ]
    },
    {
      kode: 'BOS',
      nama: 'BKU BOSP Negeri',
      link: 'bos-negeri',
      icon: 'bi-journal-bookmark-fill',
      badge: '27 Sub-Menu',
      color: '#FF9A00',
      subMenus: [
        { nama: 'Dashboard BKU BOSP', link: 'dashboard', icon: 'bi-speedometer2' },
        { nama: 'Dropping Dana BOSP', link: 'konfirmasi-drop-dana', icon: 'bi-box-arrow-in-down' },
        { nama: 'Konfirmasi Dropping Dana', link: 'dinas-konfirmasi-drop-dana', icon: 'bi-check2-circle' },
        { nama: 'Input BKU BOSP', link: 'input-bku', icon: 'bi-journal-plus' },
        { nama: 'Pengajuan Pembayaran BKU BOSP', link: 'pengajuan-bku', icon: 'bi-send-check' },
        { nama: 'Persetujuan Pembayaran BKU BOSP (TU)', link: 'persetujuan-bku-tu', icon: 'bi-check2-square' },
        { nama: 'Persetujuan Pembayaran BKU BOSP (PA)', link: 'persetujuan-bku-pa', icon: 'bi-award' },
        { nama: 'Permohonan Token', link: 'permohonan-token', icon: 'bi-key-fill' },
        { nama: 'Pembayaran BKU BOSP', link: 'pembayaran-bku', icon: 'bi-credit-card-2-front' },
        { nama: 'Pembayaran Pajak BKU BOSP', link: 'pembayaran-pajak-bku', icon: 'bi-receipt-cutoff' },
        { nama: 'Batal Transfer BKU BOSP', link: 'batal-transfer-spj', icon: 'bi-x-octagon' },
        { nama: 'Setor Pendapatan Lain-Lain BOSP', link: 'setor-pendapatan-lain2-bos', icon: 'bi-arrow-return-left' },
        { nama: 'Cetak Setor', link: 'cetak-setoran', icon: 'bi-printer' },
        { nama: 'Persetujuan Setoran', link: 'persetujuan-setoran', icon: 'bi-patch-check' },
        { nama: 'BAP KAS BOSP', link: 'bap-kas-bos', icon: 'bi-clipboard-data' },
        { nama: 'Tutup BKU', link: 'tutup-bku', icon: 'bi-lock-fill' },
        { nama: 'Batal Tutup BKU', link: 'batal-tutup-bku', icon: 'bi-unlock-fill' },
        { nama: 'Mutasi 12 Transaksi BOSP', link: 'bos-mutasi-12', icon: 'bi-clock-history' },
        { nama: 'Mutasi Semua Transaksi BOSP', link: 'bos-mutasi-semua', icon: 'bi-bank' },
        { nama: 'Laporan BKU BOSP', link: 'laporan-BKU', icon: 'bi-file-earmark-pdf' },
        { nama: 'List BKU BOSP', link: 'list-bku-bosp', icon: 'bi-table' },
        { nama: 'Laporan Monitoring Dinas', link: 'laporan-monitoring-dinas', icon: 'bi-bar-chart-line' },
        { nama: 'Pengajuan dan Persetujuan Pendapatan Lain-Lain', link: 'pengajuan-pendapatan-lain-lain', icon: 'bi-file-earmark-plus' },
        { nama: 'Pembayaran Pindah Buku BOSP', link: 'pembayaran-pendapatan-lain-lain', icon: 'bi-arrow-left-right' },
        { nama: 'Persetujuan Koreksi Periode Sebelum BOSP', link: 'persetujuan-koreksi-dinas-bos', icon: 'bi-check-all' },
        { nama: 'Koreksi Periode Sebelum BOSP', link: 'input-bku-koreksi', icon: 'bi-pencil-square' },
        { nama: 'Koreksi Tahun Lalu', link: 'input-bku-koreksi-tahun-lalu', icon: 'bi-journal-arrow-up' }
      ]
    },
    {
      kode: 'BOP',
      nama: 'BKU BOP Negeri',
      link: 'bku-bop',
      icon: 'bi-bank2',
      badge: '30 Sub-Menu',
      color: '#FF9A00',
      subMenus: [
        { nama: 'Dashboard BKU BOP', link: 'dashboard', icon: 'bi-speedometer2' },
        { nama: 'Permohonan NPD', link: 'konfirmasi-drop-dana-bop', icon: 'bi-file-earmark-text' },
        { nama: 'Pengajuan Permohonan NPD', link: 'pengajuan-npd', icon: 'bi-send-plus' },
        { nama: 'Persetujuan NPD', link: 'persetujuan-npd', icon: 'bi-check2-all' },
        { nama: 'Input BKU BOP', link: 'input-bku', icon: 'bi-journal-plus' },
        { nama: 'Pengajuan Pembayaran BKU BOP', link: 'pengajuan-pembayaran-bku', icon: 'bi-send-check' },
        { nama: 'Persetujuan Pembayaran BKU BOP', link: 'persetujuan-bku', icon: 'bi-check2-square' },
        { nama: 'Permohonan Token', link: 'permohonan-token', icon: 'bi-key-fill' },
        { nama: 'Pembayaran BKU BOP', link: 'pembayaran-bku', icon: 'bi-credit-card-2-front' },
        { nama: 'Pembayaran Pajak', link: 'pembayaran-pajak-bop', icon: 'bi-receipt-cutoff' },
        { nama: 'Batal Transfer BKU BOP', link: 'batal-transfer-spj', icon: 'bi-x-octagon' },
        { nama: 'Persetujuan Batal Transfer BKU BOP', link: 'persetujuan-batal-tf-spj', icon: 'bi-shield-check' },
        { nama: 'Cetak Setoran BOP', link: 'cetak-setoran', icon: 'bi-printer' },
        { nama: 'Persetujuan Setoran BOP', link: 'persetujuan-setoran', icon: 'bi-patch-check' },
        { nama: 'BAP KAS BOP', link: 'bap-kas', icon: 'bi-clipboard-data' },
        { nama: 'Batal Tutup BKU', link: 'batal-tutup-bku', icon: 'bi-unlock-fill' },
        { nama: 'Tutup BKU', link: 'tutup-bku', icon: 'bi-lock-fill' },
        { nama: 'Mutasi 12 Transaksi', link: 'mutasi-transfer-12-transaksi', icon: 'bi-clock-history' },
        { nama: 'Laporan BKU BOP', link: 'laporan-BKU', icon: 'bi-file-earmark-pdf' },
        { nama: 'BAP Kas Approval (Sudin)', link: 'bap-kas-approval-sudin', icon: 'bi-clipboard-check' },
        { nama: 'Input Setor Sisa Belanja', link: 'setor-sisa-belanja', icon: 'bi-arrow-return-left' },
        { nama: 'Batas Pengajuan Belanja', link: 'batas-pengajuan-belanja', icon: 'bi-calendar-event' },
        { nama: 'BAP KAS Approval (PA)', link: 'bap-kas-approval-pa', icon: 'bi-clipboard2-check' },
        { nama: 'Laporan Monitoring Sudin', link: 'laporan-monitoring-sudin', icon: 'bi-bar-chart-line' },
        { nama: 'List BKU BOP', link: 'list-bku-bop', icon: 'bi-table' },
        { nama: 'Pengajuan & Persetujuan Pendapatan Lain-Lain BOP', link: 'pengajuan-pendapatan-lain-lain-bop', icon: 'bi-file-earmark-plus' },
        { nama: 'Pembayaran Pindah Buku BOP', link: 'pembayaran-pendapatan-lain-lain-bop', icon: 'bi-arrow-left-right' },
        { nama: 'Persetujuan Koreksi Periode Sebelum BOP', link: 'persetujuan-koreksi-sudin-bop', icon: 'bi-check-all' },
        { nama: 'Koreksi Periode Sebelum BOP', link: 'input-bku-koreksi', icon: 'bi-pencil-square' },
        { nama: 'Mutasi Semua Transaksi BOP', link: 'bop-mutasi-semua', icon: 'bi-bank' }
      ]
    },
    {
      kode: 'ADMN',
      nama: 'Administrator',
      link: 'administrator',
      icon: 'bi-sliders2-vertical',
      badge: '7 Sub-Menu',
      color: '#FF9A00',
      subMenus: [
        { nama: 'Batas Pengajuan Belanja', link: 'batas-pengajuan-belanja-list-opd', icon: 'bi-calendar-range' },
        { nama: 'Help Desk Pembayaran BKU BOSP', link: 'help-pembayaran-bos', icon: 'bi-life-preserver' },
        { nama: 'Help Desk Pembayaran BKU BOP', link: 'help-pembayaran-bop', icon: 'bi-headset' },
        { nama: 'Help Desk Virtual Account PLN', link: 'help-va-pln', icon: 'bi-lightning-charge' },
        { nama: 'Migrasi RKAS', link: 'konversi-data', icon: 'bi-file-earmark-spreadsheet' },
        { nama: 'Dropping Dana BOS & BOP', link: 'dropping-dana', icon: 'bi-send-check' },
        { nama: 'Konfirmasi Saldo Rekening', link: 'konfirmasi-rekening', icon: 'bi-bank2' }
      ]
    },
    {
      kode: 'HELP',
      nama: 'Help Desk',
      link: 'helpdesk',
      icon: 'bi-headset',
      badge: '3 Sub-Menu',
      color: '#FF9A00',
      subMenus: [
        { nama: 'User Manual', link: 'user-manual', icon: 'bi-book-half' },
        { nama: 'Help Desk', link: 'tiket-helpdesk', icon: 'bi-ticket-detailed' },
        { nama: 'Video Tutorial', link: 'video-tutorial', icon: 'bi-play-btn' }
      ]
    }
  ];

  readonly selectedMenu = signal<MainMenuGroup>(this.mainMenus[1]); // Default highlight: BKU BOSP Negeri

  readonly summary = signal<any>({
    jumlahSekolah: 3,
    totalPagu: 248000000,
    totalRealisasi: 66090000,
    persenSerapan: 26.6,
    berita: [
      { id: 1, kategori: 'BOSP 2025/2026', tanggal: 'Terbaru', judul: 'Penyaluran Dana BOSP & Rekonsiliasi BKU Negeri' },
      { id: 2, kategori: 'BOP & SIPKD', tanggal: 'Terbaru', judul: 'Integrasi NPD BOP Real-Time dengan SIPKD BPKD' },
      { id: 3, kategori: 'Pajak MPN G3', tanggal: 'Terbaru', judul: 'Validasi NPWP 16 Digit & Cetak Bukti NTPN Formulir 25' }
    ],
    peraturan: [
      { kode: 'Permendikbudristek No. 63/2023', tentang: 'Juknis Pengelolaan Dana BOSP', lingkup: 'BOSP APBN' },
      { kode: 'Pergub DKI Jakarta No. 48/2023', tentang: 'Pedoman Dana BOP Satuan Pendidikan', lingkup: 'BOP APBD' },
      { kode: 'PMK No. 59/PMK.03/2022', tentang: 'Tata Cara Pemungutan Pajak Instansi', lingkup: 'Pajak MPN' },
      { kode: 'SE Kadisdik DKI Jakarta', tentang: 'Jadwal Cut-Off SPJ, BAP Kas & Tutup Buku', lingkup: 'Tata Kelola' }
    ],
    prosedur: [
      { step: 1, title: 'Konfirmasi Rekening', actor: 'Bendahara' },
      { step: 2, title: 'Dropping / NPD', actor: 'PK & Sudin' },
      { step: 3, title: 'Input BKU & Pajak', actor: 'Bendahara' },
      { step: 4, title: 'Approval TU & PA', actor: 'TU & Kepsek' },
      { step: 5, title: 'Token & Transfer CMS', actor: 'PA & Bank DKI' },
      { step: 6, title: 'BAP Kas & Laporan', actor: 'PK, PA & Dinas' }
    ]
  });

  pwdForm = { nrk: '', sandiLama: '', sandiBaru: '' };

  ngOnInit(): void {
    this.http.get<any>('/auth-server/api/public/landing-summary').subscribe({
      next: (res) => {
        if (res?.data) {
          this.summary.set(res.data);
        }
      },
      error: () => {}
    });
  }

  scrollToSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  selectInfoTab(tab: 'berita' | 'peraturan' | 'prosedur'): void {
    this.infoTab.set(tab);
    document.getElementById('info-section')?.scrollIntoView({ behavior: 'smooth' });
  }

  openMainMenu(grp: MainMenuGroup): void {
    const firstSub = grp.subMenus[0]?.link || '';
    if (this.auth.isLoggedIn()) {
      this.router.navigateByUrl(`/${grp.link}/${firstSub}`);
    } else {
      this.toast.info(`Silakan login terlebih dahulu untuk membuka menu ${grp.nama}.`);
      this.router.navigate(['/login']);
    }
  }

  openSubMenu(grp: MainMenuGroup, sub: { nama: string; link: string }): void {
    if (this.auth.isLoggedIn()) {
      this.router.navigateByUrl(`/${grp.link}/${sub.link}`);
    } else {
      this.toast.info(`Silakan login untuk mengakses ${grp.nama} → ${sub.nama}.`);
      this.router.navigate(['/login']);
    }
  }

  submitChangePassword(): void {
    if (!this.pwdForm.nrk || !this.pwdForm.sandiLama || !this.pwdForm.sandiBaru) {
      this.toast.error('Harap lengkapi seluruh kolom ubah kata sandi.');
      return;
    }
    this.http.post<any>('/auth-server/api/auth/change-password', this.pwdForm).subscribe({
      next: (res) => {
        this.toast.success(res?.message || 'Kata sandi berhasil diperbarui.');
        this.showPasswordModal.set(false);
        this.pwdForm = { nrk: '', sandiLama: '', sandiBaru: '' };
      },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal mengubah kata sandi.')
    });
  }
}
