import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AppMenu, AppModule } from '../../core/models/siapbos.models';

export interface BeritaItem {
  id: number;
  kategori: string;
  badgeColor: string;
  bannerGradient: string;
  bannerIcon: string;
  tanggal: string;
  judul: string;
  ringkasan: string;
  isiLengkap: string;
}

export interface PeraturanItem {
  id: number;
  judul: string;
  deskripsi: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  kodeFile: string;
}

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background-color: #f8fafc;
      color: #1f2937;
      overflow-x: clip;
    }

    /* Sticky Navbar (#FF9A00 palette preserved) */
    .landing-nav {
      position: sticky;
      top: 0;
      z-index: 1030;
      background: #FF9A00;
      transition: box-shadow 0.25s ease;
    }
    .landing-nav.scrolled {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
    }

    .brand-logo-img {
      width: 44px;
      height: 44px;
      object-fit: contain;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
    }

    .nav-simple-link {
      color: #ffffff;
      font-weight: 500;
      font-size: 0.94rem;
      padding: 0.45rem 0.9rem;
      text-decoration: none;
      background: transparent;
      border: none;
      cursor: pointer;
      transition: color 0.18s ease, opacity 0.18s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }
    .nav-simple-link:hover {
      color: #ffedd5;
    }

    .btn-cta-red {
      background-color: #FF3800;
      color: #ffffff !important;
      border: none;
      font-weight: 700;
      transition: transform 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
    }
    .btn-cta-red:hover {
      background-color: #e03000;
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(255, 56, 0, 0.34);
    }

    /* Mobile Drawer */
    .mobile-drawer {
      background: #E68900;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
    }
    .mobile-nav-link {
      display: block;
      padding: 0.65rem 1rem;
      color: #ffffff;
      text-decoration: none;
      font-weight: 500;
      border-radius: 8px;
    }
    .mobile-nav-link:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
    }

    /* Hero Section (#FF9A00 palette preserved) */
    .hero-creative {
      position: relative;
      background: linear-gradient(135deg, #FF9A00 0%, #FF8400 60%, #FFA726 100%);
      padding: 3.75rem 0 7.5rem;
      overflow: hidden;
      color: #ffffff;
    }
    @media (min-width: 992px) {
      .hero-creative {
        padding: 4.5rem 0 9rem;
      }
    }

    .siap-acrostic {
      font-weight: 800;
      font-size: clamp(2.35rem, 4.2vw, 3.55rem);
      line-height: 1.15;
      letter-spacing: -0.02em;
    }
    .siap-letter {
      color: #FF3800;
      font-weight: 900;
      text-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
    }
    .hero-subtitle {
      font-size: 1.08rem;
      color: rgba(255, 255, 255, 0.94);
      max-width: 520px;
      line-height: 1.65;
      font-weight: 400;
    }
    .btn-hero-glass {
      background: rgba(255, 255, 255, 0.2);
      color: #ffffff !important;
      border: 1px solid rgba(255, 255, 255, 0.45);
      font-weight: 600;
      transition: background-color 0.2s ease, transform 0.2s ease;
    }
    .btn-hero-glass:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: translateY(-2px);
    }

    .hero-blob {
      position: absolute;
      width: 300px;
      height: 300px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.14);
      filter: blur(48px);
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }

    .hero-wave-bottom {
      position: absolute;
      bottom: -1px;
      left: 0;
      width: 100%;
      line-height: 0;
      pointer-events: none;
      z-index: 2;
    }

    /* Section Title Accent Underline */
    .section-title {
      font-weight: 800;
      color: #111827;
      position: relative;
      display: inline-block;
      padding-bottom: 0.75rem;
    }
    .section-title::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 64px;
      height: 4px;
      border-radius: 999px;
      background: #FF9A00;
    }
    .section-title-dark {
      color: #ffffff;
    }

    /* Berita Cards */
    .news-card {
      background: #ffffff;
      border: 1px solid #f1f5f9;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
      transition: transform 0.25s ease, box-shadow 0.25s ease;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    .news-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 16px 32px rgba(15, 23, 42, 0.09);
    }
    .news-thumb {
      height: 180px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .news-thumb i.watermark-icon {
      font-size: 4.5rem;
      color: rgba(255, 255, 255, 0.28);
      transition: transform 0.4s ease;
    }
    .news-card:hover .news-thumb i.watermark-icon {
      transform: scale(1.12);
    }
    .news-badge {
      position: absolute;
      top: 14px;
      left: 14px;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.3rem 0.8rem;
      border-radius: 999px;
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
    }

    /* Peraturan Items */
    .peraturan-box {
      background: #f8fafc;
      border-radius: 20px;
      border: 1px solid #e2e8f0;
      padding: 1.5rem;
    }
    @media (min-width: 768px) {
      .peraturan-box {
        padding: 2rem;
      }
    }
    .peraturan-item {
      background: #ffffff;
      border: 1px solid #f1f5f9;
      border-radius: 14px;
      padding: 1.15rem 1.25rem;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.03);
      transition: border-color 0.2s ease, transform 0.2s ease;
    }
    .peraturan-item:hover {
      border-color: #FF9A00;
      transform: translateY(-2px);
    }
    .peraturan-icon-box {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.35rem;
      flex-shrink: 0;
    }
    .btn-unduh-pdf {
      background: #f1f5f9;
      color: #334155;
      border: none;
      font-weight: 600;
      font-size: 0.86rem;
      border-radius: 10px;
      padding: 0.55rem 1rem;
      transition: background-color 0.2s ease, color 0.2s ease;
      white-space: nowrap;
    }
    .btn-unduh-pdf:hover {
      background: #FF9A00;
      color: #ffffff;
    }

    /* Sistem & Prosedur Dark Section */
    .prosedur-section {
      position: relative;
      background: #111827;
      color: #ffffff;
      overflow: hidden;
    }
    .prosedur-glow-orange {
      position: absolute;
      top: -80px;
      right: -80px;
      width: 320px;
      height: 320px;
      border-radius: 50%;
      background: rgba(255, 154, 0, 0.16);
      filter: blur(70px);
      pointer-events: none;
    }
    .prosedur-glow-red {
      position: absolute;
      bottom: -80px;
      left: -80px;
      width: 320px;
      height: 320px;
      border-radius: 50%;
      background: rgba(255, 56, 0, 0.16);
      filter: blur(70px);
      pointer-events: none;
    }
    .prosedur-connector {
      position: absolute;
      top: 40px;
      left: 12.5% !important;
      width: 75% !important;
      padding: 0 !important;
      height: 2px;
      background: #374151;
      z-index: 0;
    }
    .step-circle {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: #1f2937;
      border: 4px solid #374151;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.75rem;
      position: relative;
      margin: 0 auto 1.25rem;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    }
    .step-circle-final {
      background: #FF9A00;
      border-color: #E68900;
      color: #ffffff;
      box-shadow: 0 10px 30px rgba(255, 154, 0, 0.35);
    }
    .step-number-badge {
      position: absolute;
      top: -6px;
      right: -6px;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: 3px solid #111827;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.78rem;
      font-weight: 800;
    }

    /* Authenticated 5 Main Menus Cards */
    .main-menu-card {
      background: #ffffff;
      border-radius: 18px;
      padding: 1.2rem 1rem;
      border: 1px solid rgba(255, 154, 0, 0.22);
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
      cursor: pointer;
      transition: all 0.22s ease;
      height: 100%;
      text-align: center;
    }
    .main-menu-card:hover {
      transform: translateY(-4px);
      border-color: #FF9A00;
    }
    .main-menu-card.active {
      background: linear-gradient(135deg, #FF9A00 0%, #FF7A00 100%);
      color: #ffffff;
      border-color: #FF9A00;
      box-shadow: 0 12px 28px rgba(255, 154, 0, 0.3);
      transform: translateY(-4px);
    }
    .menu-icon-circle {
      width: 50px;
      height: 50px;
      border-radius: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 1.4rem;
      margin-bottom: 0.55rem;
      background: #FFF3E0;
      color: #FF8000;
    }
    .main-menu-card.active .menu-icon-circle {
      background: rgba(255, 255, 255, 0.22);
      color: #ffffff;
    }
    .submenu-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.48rem 0.9rem;
      border-radius: 10px;
      background: #FFF9F0;
      border: 1px solid rgba(255, 154, 0, 0.25);
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
    }

    /* Dropdown Aplikasi in Navbar */
    .app-dropdown-panel {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      width: min(92vw, 720px);
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      box-shadow: 0 20px 45px rgba(15, 23, 42, 0.16);
      padding: 1rem;
      z-index: 1060;
      max-height: 75vh;
      overflow-y: auto;
      color: #1e293b;
    }

    .footer-link {
      color: #64748b;
      text-decoration: none;
      transition: color 0.18s ease;
    }
    .footer-link:hover {
      color: #FF9A00;
    }

    /* Modern Scroll-Reveal Animation */
    .reveal-on-scroll {
      opacity: 0;
      transform: translateY(32px);
      transition: opacity 0.65s cubic-bezier(0.22, 1, 0.36, 1),
                  transform 0.65s cubic-bezier(0.22, 1, 0.36, 1);
      transition-delay: var(--reveal-delay, 0ms);
      will-change: opacity, transform;
    }
    .reveal-on-scroll.revealed {
      opacity: 1;
      transform: translateY(0);
    }

    /* Floating Back-to-Top Button */
    .btn-back-to-top {
      position: fixed;
      right: 26px;
      bottom: 26px;
      z-index: 1045;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.85);
      background: linear-gradient(135deg, #FF9A00 0%, #EA580C 100%);
      color: #ffffff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 26px rgba(234, 88, 12, 0.38);
      opacity: 0;
      visibility: hidden;
      transform: translateY(18px) scale(0.86);
      pointer-events: none;
      transition: opacity 0.28s ease, transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), visibility 0.28s ease, box-shadow 0.2s ease;
    }
    .btn-back-to-top.visible {
      opacity: 1;
      visibility: visible;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }
    .btn-back-to-top:hover {
      transform: translateY(-4px) scale(1.06);
      box-shadow: 0 14px 32px rgba(234, 88, 12, 0.48);
    }
  `],
  template: `
    <div (click)="showAppMenu.set(false)">
      <!-- STICKY NAVBAR (#FF9A00 palette preserved, uniform menu styling) -->
      <nav class="landing-nav py-2" [class.scrolled]="isScrolled()">
        <div class="container">
          <div class="d-flex justify-content-between align-items-center" style="min-height: 62px;">
            <!-- Clear SIAP BOS Logo + Title -->
            <a class="d-flex align-items-center gap-3 text-decoration-none text-white"
               href="javascript:void(0)" (click)="scrollTo('beranda')">
              <img src="assets/img/login/Logo.png" alt="Logo SIAP BOS" class="brand-logo-img">
              <span class="fw-bold fs-5 tracking-tight">SIAP BOSP &amp; BOP</span>
            </a>

            <!-- Desktop Menu Links -->
            <div class="d-none d-lg-flex align-items-center gap-2">
              <a class="nav-simple-link" href="javascript:void(0)" (click)="scrollTo('beranda')">Home</a>
              <a class="nav-simple-link" href="javascript:void(0)" (click)="scrollTo('berita')">Berita</a>
              <a class="nav-simple-link" href="javascript:void(0)" (click)="scrollTo('peraturan')">Peraturan</a>
              <a class="nav-simple-link" href="javascript:void(0)" (click)="scrollTo('prosedur')">Sistem dan Prosedur</a>

              <!-- Aplikasi & Ganti Password ONLY visible after login -->
              @if (auth.isLoggedIn()) {
                <div class="position-relative" (click)="$event.stopPropagation()">
                  <button type="button" class="nav-simple-link" (click)="showAppMenu.set(!showAppMenu())">
                    <span>Aplikasi</span>
                    <i class="bi bi-chevron-down small" style="font-size: 0.72rem;"></i>
                  </button>

                  @if (showAppMenu()) {
                    <div class="app-dropdown-panel animate-page">
                      <div class="row g-2">
                        @for (grp of auth.listAplikasi(); track grp.kodeAplikasi) {
                          <div class="col-md-4">
                            <div class="p-2 rounded-3 h-100" style="background: #FFFBF5;">
                              <div class="fw-bold small mb-2" style="color: #FF8000;">
                                <i class="bi {{ grp.icon }} me-1"></i>{{ grp.nama }}
                              </div>
                              <div class="d-flex flex-column gap-1" style="max-height: 170px; overflow-y: auto;">
                                @for (sub of grp.menu; track sub.link) {
                                  <a class="text-decoration-none small px-2 py-1 rounded-2 text-dark"
                                     style="font-size: 0.78rem; cursor: pointer;"
                                     (click)="openSubMenu(grp, sub); showAppMenu.set(false)">
                                    {{ sub.nama }}
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

                <button type="button" class="nav-simple-link" (click)="showPasswordModal.set(true)">
                  Ganti Password
                </button>
              }
            </div>

            <!-- Right Login / Log Out Button & Mobile Toggle -->
            <div class="d-flex align-items-center gap-2">
              @if (!auth.isLoggedIn()) {
                <a routerLink="/login"
                   class="d-none d-lg-inline-flex btn btn-cta-red rounded-pill px-4 py-2 align-items-center gap-2 shadow-sm">
                  <span>Login</span>
                  <i class="bi bi-box-arrow-in-right"></i>
                </a>
              } @else {
                <button type="button"
                        class="d-none d-lg-inline-flex btn btn-cta-red rounded-pill px-4 py-2 align-items-center gap-2 shadow-sm"
                        (click)="auth.logout()">
                  <span>Log Out</span>
                  <i class="bi bi-box-arrow-right"></i>
                </button>
              }

              <button type="button"
                      class="btn text-white d-lg-none p-1"
                      aria-label="Toggle Menu"
                      (click)="mobileMenuOpen.set(!mobileMenuOpen())">
                <i class="bi bi-list fs-2"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Mobile Menu Drawer -->
        @if (mobileMenuOpen()) {
          <div class="d-lg-none mobile-drawer px-3 py-3">
            <a class="mobile-nav-link" href="javascript:void(0)" (click)="scrollTo('beranda'); mobileMenuOpen.set(false)">Home</a>
            <a class="mobile-nav-link" href="javascript:void(0)" (click)="scrollTo('berita'); mobileMenuOpen.set(false)">Berita</a>
            <a class="mobile-nav-link" href="javascript:void(0)" (click)="scrollTo('peraturan'); mobileMenuOpen.set(false)">Peraturan</a>
            <a class="mobile-nav-link" href="javascript:void(0)" (click)="scrollTo('prosedur'); mobileMenuOpen.set(false)">Sistem dan Prosedur</a>
            @if (auth.isLoggedIn()) {
              <a class="mobile-nav-link" href="javascript:void(0)" (click)="scrollTo('aplikasi-section'); mobileMenuOpen.set(false)">Menu Aplikasi</a>
              <a class="mobile-nav-link" href="javascript:void(0)" (click)="showPasswordModal.set(true); mobileMenuOpen.set(false)">Ganti Password</a>
              <button type="button" class="btn btn-cta-red w-100 rounded-pill mt-2" (click)="auth.logout(); mobileMenuOpen.set(false)">Log Out</button>
            } @else {
              <a routerLink="/login" class="btn btn-cta-red w-100 rounded-pill mt-2" (click)="mobileMenuOpen.set(false)">Login</a>
            }
          </div>
        }
      </nav>

      <!-- HERO SECTION -->
      <header id="beranda" class="hero-creative">
        <div class="container position-relative" style="z-index: 3;">
          <div class="row align-items-center g-4">
            <!-- Hero Text Content -->
            <div class="col-lg-6 text-center text-lg-start">
              <h1 class="siap-acrostic mb-3">
                <span class="siap-letter">S</span>istem<br>
                <span class="siap-letter">I</span>nformasi<br>
                <span class="siap-letter">A</span>kuntabilitas<br>
                <span class="siap-letter">P</span>endidikan
              </h1>
              <p class="hero-subtitle mb-4 mx-auto mx-lg-0">
                Platform terpadu pengelolaan, pelaporan, dan pertanggungjawaban dana BOSP dan BOP Provinsi DKI Jakarta secara transparan dan akuntabel.
              </p>
              <div class="d-flex flex-column flex-sm-row gap-3 justify-content-center justify-content-lg-start">
                @if (!auth.isLoggedIn()) {
                  <a routerLink="/login"
                     class="btn btn-cta-red btn-lg rounded-pill px-4 py-3 d-inline-flex align-items-center justify-content-center gap-2 shadow">
                    <span>Masuk Aplikasi</span>
                    <i class="bi bi-arrow-right"></i>
                  </a>
                } @else {
                  <button type="button"
                          (click)="enterWorkspace()"
                          class="btn btn-cta-red btn-lg rounded-pill px-4 py-3 d-inline-flex align-items-center justify-content-center gap-2 shadow">
                    <span>Masuk Aplikasi</span>
                    <i class="bi bi-arrow-right"></i>
                  </button>
                }
                <a href="javascript:void(0)"
                   (click)="scrollTo('prosedur')"
                   class="btn btn-hero-glass btn-lg rounded-pill px-4 py-3 d-inline-flex align-items-center justify-content-center">
                  Pelajari Prosedur
                </a>
              </div>
            </div>

            <!-- Hero Illustration -->
            <div class="col-lg-6 position-relative text-center text-lg-end">
              <div class="hero-blob"></div>
              <img src="assets/img/login/SIAP BOS_login_ilustrasi.png"
                   alt="Ilustrasi SIAP BOS"
                   class="img-fluid position-relative animate-float"
                   style="max-height: 360px; object-fit: contain; z-index: 2;">
            </div>
          </div>
        </div>

        <!-- Organic White Wave Divider -->
        <div class="hero-wave-bottom">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"
               style="width: 100%; height: 95px; display: block;">
            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V95.8C59.71,118.08,130.83,123.15,198.81,118.89,240.75,116.27,282.8,107.54,321.39,56.44Z"
                  fill="#f8fafc"/>
          </svg>
        </div>
      </header>

      <!-- MAIN SECTIONS WRAPPER -->
      <main>
        <!-- 5 MENU UTAMA & SUB-MENU (HANYA MUNCUL SETELAH LOGIN) -->
        @if (auth.isLoggedIn()) {
          <section id="aplikasi-section" class="py-5" style="background: #f8fafc;">
            <div class="container reveal-on-scroll">
              <div class="text-center mb-4">
                <h2 class="h3 section-title mb-2">Menu Aplikasi</h2>
                <p class="text-muted small mb-0">Pilih menu utama di bawah untuk mengakses sub-menu modul.</p>
              </div>

              <div class="row g-3 justify-content-center mb-4">
                @for (grp of auth.listAplikasi(); track grp.kodeAplikasi) {
                  <div class="col-6 col-md-4 col-lg">
                    <div class="main-menu-card"
                         [class.active]="selectedApp()?.kodeAplikasi === grp.kodeAplikasi"
                         (click)="selectedAppKode.set(grp.kodeAplikasi)">
                      <div class="menu-icon-circle">
                        <i class="bi {{ grp.icon }}"></i>
                      </div>
                      <h6 class="fw-bold mb-0">{{ grp.nama }}</h6>
                    </div>
                  </div>
                }
              </div>

              @if (selectedApp(); as sel) {
                <div class="siap-card p-4 animate-page">
                  <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 pb-2 border-bottom">
                    <h6 class="fw-bold mb-0">
                      <i class="bi {{ sel.icon }} me-2" style="color: #FF9A00;"></i>{{ sel.nama }}
                    </h6>
                    <button class="btn btn-sm btn-siap rounded-pill px-3" (click)="openMainMenu(sel)">
                      Buka {{ sel.nama }}
                    </button>
                  </div>

                  <div class="d-flex flex-wrap gap-2">
                    @for (sub of sel.menu; track sub.link) {
                      <a class="submenu-chip" (click)="openSubMenu(sel, sub)">
                        <i class="bi {{ sub.icon }}" style="color: #FF8000;"></i>
                        <span>{{ sub.nama }}</span>
                      </a>
                    }
                  </div>
                </div>
              }
            </div>
          </section>
        }

        <!-- SECTION: BERITA & PENGUMUMAN -->
        <section id="berita" class="py-5" style="background: #f8fafc;">
          <div class="container py-lg-4">
            <div class="text-center mb-5 reveal-on-scroll">
              <h2 class="h2 section-title">Berita &amp; Pengumuman</h2>
              <p class="mt-3 text-muted mb-0">Informasi terbaru seputar pengelolaan dana pendidikan di lingkungan DKI Jakarta.</p>
            </div>

            <div class="row g-4">
              @for (item of beritaList; track item.id) {
                <div class="col-md-6 col-lg-4 reveal-on-scroll" [style.--reveal-delay.ms]="$index * 110">
                  <article class="news-card">
                    <div class="news-thumb" [style.background]="item.bannerGradient">
                      <i class="bi {{ item.bannerIcon }} watermark-icon"></i>
                      <span class="news-badge" [style.background]="item.badgeColor">{{ item.kategori }}</span>
                    </div>
                    <div class="p-4 d-flex flex-column flex-grow-1">
                      <p class="small text-muted mb-2 d-flex align-items-center gap-2">
                        <i class="bi bi-calendar3"></i>
                        <span>{{ item.tanggal }}</span>
                      </p>
                      <h5 class="fw-bold text-dark mb-2">{{ item.judul }}</h5>
                      <p class="text-muted small mb-4 flex-grow-1" style="line-height: 1.6;">
                        {{ item.ringkasan }}
                      </p>
                      <a href="javascript:void(0)"
                         class="fw-semibold text-decoration-none d-inline-flex align-items-center gap-1"
                         style="color: #FF9A00;"
                         (click)="selectedBerita.set(item)">
                        <span>Baca Selengkapnya</span>
                        <i class="bi bi-chevron-right small"></i>
                      </a>
                    </div>
                  </article>
                </div>
              }
            </div>
          </div>
        </section>

        <!-- SECTION: PERATURAN & JUKNIS -->
        <section id="peraturan" class="py-5 bg-white">
          <div class="container py-lg-4" style="max-width: 900px;">
            <div class="text-center mb-5 reveal-on-scroll">
              <h2 class="h2 section-title">Peraturan &amp; Juknis</h2>
              <p class="mt-3 text-muted mb-0">Dokumen landasan hukum dan petunjuk teknis pelaksanaan.</p>
            </div>

            <div class="peraturan-box d-flex flex-column gap-3 reveal-on-scroll">
              @for (doc of peraturanList; track doc.id) {
                <div class="peraturan-item reveal-on-scroll d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3" [style.--reveal-delay.ms]="$index * 95">
                  <div class="d-flex align-items-start align-items-sm-center gap-3">
                    <div class="peraturan-icon-box" [style.background]="doc.iconBg" [style.color]="doc.iconColor">
                      <i class="bi {{ doc.icon }}"></i>
                    </div>
                    <div>
                      <h5 class="fw-bold text-dark mb-1" style="font-size: 1.05rem;">{{ doc.judul }}</h5>
                      <p class="small text-muted mb-0">{{ doc.deskripsi }}</p>
                    </div>
                  </div>
                  <button type="button" class="btn-unduh-pdf d-inline-flex align-items-center justify-content-center gap-2"
                          (click)="selectedPeraturan.set(doc)">
                    <i class="bi bi-download"></i>
                    <span>Unduh PDF</span>
                  </button>
                </div>
              }
            </div>
          </div>
        </section>

        <!-- SECTION: SISTEM & PROSEDUR -->
        <section id="prosedur" class="prosedur-section py-5">
          <div class="prosedur-glow-orange"></div>
          <div class="prosedur-glow-red"></div>

          <div class="container py-lg-4 position-relative" style="z-index: 2;">
            <div class="text-center mb-5 reveal-on-scroll">
              <h2 class="h2 section-title section-title-dark">Sistem &amp; Prosedur</h2>
              <p class="mt-3 mb-0" style="color: #9ca3af;">Alur pelaporan yang mudah, transparan, dan terintegrasi.</p>
            </div>

            <div class="row g-4 position-relative">
              <div class="d-none d-lg-block prosedur-connector"></div>

              @for (step of prosedurSteps; track step.no) {
                <div class="col-md-6 col-lg-3 position-relative text-center reveal-on-scroll" [style.--reveal-delay.ms]="$index * 120" style="z-index: 2;">
                  <div class="step-circle" [class.step-circle-final]="step.isFinal" [style.color]="step.isFinal ? '#ffffff' : step.iconColor">
                    <i class="bi {{ step.icon }}"></i>
                    <div class="step-number-badge"
                         [style.background]="step.badgeBg"
                         [style.color]="step.badgeTextColor">
                      {{ step.no }}
                    </div>
                  </div>
                  <h5 class="fw-bold text-white mb-2">{{ step.judul }}</h5>
                  <p class="small mb-0 mx-auto" style="color: #9ca3af; max-width: 240px;">
                    {{ step.deskripsi }}
                  </p>
                </div>
              }
            </div>
          </div>
        </section>
      </main>

      <!-- FOOTER -->
      <footer id="landing-footer" class="bg-white border-top pt-5 pb-4">
        <div class="container reveal-on-scroll">
          <div class="row g-4 pb-4 border-bottom">
            <!-- Col 1: Brand & Social -->
            <div class="col-lg-6">
              <div class="d-flex align-items-center gap-2 mb-3">
                <div class="siap-logo-emblem p-1" style="border-radius: 10px;">
                  <img src="assets/img/login/Logo.png" alt="Logo SIAP BOS" width="32" height="32">
                </div>
                <span class="fw-bold fs-5 text-dark">SIAP BOSP &amp; BOP</span>
              </div>
              <p class="text-muted small mb-3" style="max-width: 440px; line-height: 1.65;">
                Sistem Informasi Akuntabilitas Pendidikan.<br>
                Portal resmi pelaporan dana Bantuan Operasional Satuan Pendidikan (BOSP) dan Bantuan Operasional Pendidikan (BOP) Provinsi DKI Jakarta.
              </p>
              <div class="d-flex gap-3">
                <a href="javascript:void(0)" class="footer-link fs-5" aria-label="Facebook"><i class="bi bi-facebook"></i></a>
                <a href="javascript:void(0)" class="footer-link fs-5" aria-label="Twitter"><i class="bi bi-twitter-x"></i></a>
                <a href="javascript:void(0)" class="footer-link fs-5" aria-label="Instagram"><i class="bi bi-instagram"></i></a>
                <a href="javascript:void(0)" class="footer-link fs-5" aria-label="YouTube"><i class="bi bi-youtube"></i></a>
              </div>
            </div>

            <!-- Col 2: Tautan Penting -->
            <div class="col-sm-6 col-lg-3">
              <h6 class="fw-bold text-dark text-uppercase small mb-3" style="letter-spacing: 0.05em;">Tautan Penting</h6>
              <ul class="list-unstyled d-flex flex-column gap-2 small mb-0">
                <li><a href="https://jakarta.go.id" target="_blank" rel="noopener" class="footer-link">Pemprov DKI Jakarta</a></li>
                <li><a href="https://disdik.jakarta.go.id" target="_blank" rel="noopener" class="footer-link">Dinas Pendidikan DKI</a></li>
                <li><a href="https://www.kemdikbud.go.id" target="_blank" rel="noopener" class="footer-link">Kemendikbudristek</a></li>
                <li><a href="https://pusdatin.kemdikbud.go.id" target="_blank" rel="noopener" class="footer-link">Pusdatin Dikbud</a></li>
              </ul>
            </div>

            <!-- Col 3: Hubungi Kami -->
            <div class="col-sm-6 col-lg-3">
              <h6 class="fw-bold text-dark text-uppercase small mb-3" style="letter-spacing: 0.05em;">Hubungi Kami</h6>
              <ul class="list-unstyled d-flex flex-column gap-2 small text-muted mb-0">
                <li class="d-flex align-items-start gap-2">
                  <i class="bi bi-geo-alt mt-1"></i>
                  <span>Jl. Gatot Subroto Kav. 40-41, Kuningan Timur, Setiabudi, Jakarta Selatan.</span>
                </li>
                <li class="d-flex align-items-center gap-2">
                  <i class="bi bi-telephone"></i>
                  <span>(021) 5255385</span>
                </li>
                <li class="d-flex align-items-center gap-2">
                  <i class="bi bi-envelope"></i>
                  <span>helpdesk.bosp&#64;jakarta.go.id</span>
                </li>
              </ul>
            </div>
          </div>

          <div class="pt-3 d-flex flex-column flex-md-row justify-content-between align-items-center gap-2 small text-muted">
            <div>&copy; 2026 Dinas Pendidikan Provinsi DKI Jakarta. Hak Cipta Dilindungi.</div>
            <div class="d-flex gap-3">
              <a href="javascript:void(0)" class="footer-link">Kebijakan Privasi</a>
              <a href="javascript:void(0)" class="footer-link">Syarat &amp; Ketentuan</a>
            </div>
          </div>
        </div>
      </footer>

      <!-- MODAL BACA BERITA -->
      @if (selectedBerita()) {
        <div class="modal-backdrop-custom" (click)="selectedBerita.set(null)">
          <div class="modal-dialog-custom" style="max-width: 560px;" (click)="$event.stopPropagation()">
            <div class="siap-card-header d-flex justify-content-between align-items-center">
              <span class="badge rounded-pill text-white" [style.background]="selectedBerita()!.badgeColor">
                {{ selectedBerita()!.kategori }}
              </span>
              <button class="btn-close btn-sm" (click)="selectedBerita.set(null)"></button>
            </div>
            <div class="modal-body-scroll">
              <small class="text-muted d-block mb-1"><i class="bi bi-calendar3 me-1"></i>{{ selectedBerita()!.tanggal }}</small>
              <h5 class="fw-bold text-dark mb-3">{{ selectedBerita()!.judul }}</h5>
              <p class="text-secondary mb-0" style="line-height: 1.7;">{{ selectedBerita()!.isiLengkap }}</p>
            </div>
          </div>
        </div>
      }

      <!-- MODAL DOKUMEN PERATURAN -->
      @if (selectedPeraturan()) {
        <div class="modal-backdrop-custom" (click)="selectedPeraturan.set(null)">
          <div class="modal-dialog-custom" style="max-width: 500px;" (click)="$event.stopPropagation()">
            <div class="siap-card-header d-flex justify-content-between align-items-center">
              <h6 class="fw-bold mb-0"><i class="bi bi-file-earmark-pdf-fill text-danger me-2"></i>{{ selectedPeraturan()!.judul }}</h6>
              <button class="btn-close btn-sm" (click)="selectedPeraturan.set(null)"></button>
            </div>
            <div class="modal-body-scroll">
              <p class="small text-secondary mb-3">{{ selectedPeraturan()!.deskripsi }}</p>
              <div class="p-3 rounded-3 bg-light border small mb-3">
                Berkas dokumen <strong>{{ selectedPeraturan()!.kodeFile }}</strong> tersedia untuk diunduh sebagai referensi tata kelola BOSP &amp; BOP DKI Jakarta.
              </div>
              <div class="d-flex justify-content-end gap-2">
                <button class="btn btn-light rounded-pill px-3" (click)="selectedPeraturan.set(null)">Tutup</button>
                <button class="btn btn-siap rounded-pill px-4" (click)="downloadPeraturanText(selectedPeraturan()!)">
                  <i class="bi bi-download me-1"></i>Unduh Dokumen
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- MODAL GANTI PASSWORD (DENGAN KONFIRMASI SANDI BARU) -->
      @if (showPasswordModal()) {
        <div class="modal-backdrop-custom" (click)="showPasswordModal.set(false)">
          <div class="modal-dialog-custom" style="max-width: 420px;" (click)="$event.stopPropagation()">
            <div class="siap-card-header d-flex justify-content-between align-items-center">
              <h6 class="fw-bold mb-0"><i class="bi bi-key-fill text-warning me-2"></i>Ganti Password</h6>
              <button class="btn-close btn-sm" (click)="showPasswordModal.set(false)"></button>
            </div>
            <div class="modal-body-scroll">
              <div class="mb-2">
                <label class="form-label small fw-semibold mb-1">NRK / ID Login</label>
                <input class="form-control form-control-sm" [(ngModel)]="pwdForm.nrk" placeholder="Masukkan NRK / ID Login">
              </div>
              <div class="mb-2">
                <label class="form-label small fw-semibold mb-1">Sandi Lama</label>
                <input type="password" class="form-control form-control-sm" [(ngModel)]="pwdForm.sandiLama" placeholder="Masukkan Sandi Lama">
              </div>
              <div class="mb-2">
                <label class="form-label small fw-semibold mb-1">Sandi Baru</label>
                <input type="password" class="form-control form-control-sm" [(ngModel)]="pwdForm.sandiBaru" placeholder="Masukkan Sandi Baru">
              </div>
              <div class="mb-3">
                <label class="form-label small fw-semibold mb-1">Konfirmasi Sandi Baru</label>
                <input type="password" class="form-control form-control-sm" [(ngModel)]="pwdForm.konfirmasiSandiBaru" placeholder="Ulangi Sandi Baru">
              </div>
              <button class="btn btn-siap w-100 rounded-pill" (click)="submitChangePassword()">Simpan Kata Sandi</button>
            </div>
          </div>
        </div>
      }
      <!-- FLOATING BACK-TO-TOP BUTTON (Muncul saat mencapai akhir landing page) -->
      <button type="button"
              class="btn-back-to-top"
              [class.visible]="showBackToTop()"
              aria-label="Kembali ke atas"
              title="Kembali ke Atas"
              (click)="scrollTo('beranda')">
        <i class="bi bi-arrow-up fs-5"></i>
      </button>
    </div>
  `
})
export class LandingPageComponent implements AfterViewInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly el: ElementRef<HTMLElement> = inject(ElementRef);

  readonly showAppMenu = signal(false);
  readonly showPasswordModal = signal(false);
  readonly mobileMenuOpen = signal(false);
  readonly isScrolled = signal(false);
  readonly showBackToTop = signal(false);
  readonly selectedBerita = signal<BeritaItem | null>(null);
  readonly selectedPeraturan = signal<PeraturanItem | null>(null);

  private revealObserver: IntersectionObserver | null = null;
  private footerObserver: IntersectionObserver | null = null;
  private footerInView = false;

  readonly beritaList: BeritaItem[] = [
    {
      id: 1,
      kategori: 'BOSP',
      badgeColor: '#FF9A00',
      bannerGradient: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)',
      bannerIcon: 'bi-calendar2-check-fill',
      tanggal: '12 November 2026',
      judul: 'Jadwal Cut-off Sinkronisasi Data Dapodik untuk Pencairan Tahap 2',
      ringkasan:
        'Diberitahukan kepada seluruh satuan pendidikan, batas akhir penarikan data (cut-off) Dapodik untuk penentuan alokasi BOSP Tahap 2 adalah tanggal 30 November.',
      isiLengkap:
        'Diberitahukan kepada seluruh Kepala Sekolah dan Bendahara Satuan Pendidikan Negeri di lingkungan Dinas Pendidikan Provinsi DKI Jakarta bahwa batas akhir penarikan dan sinkronisasi data Dapodik untuk penentuan alokasi dana BOSP Tahap 2 adalah tanggal 30 November. Harap pastikan data peserta didik serta nomor rekening giro Bank DKI sekolah telah terkonfirmasi dengan benar.'
    },
    {
      id: 2,
      kategori: 'BOP',
      badgeColor: '#3b82f6',
      bannerGradient: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)',
      bannerIcon: 'bi-laptop-fill',
      tanggal: '08 November 2026',
      judul: 'Sosialisasi Penggunaan Aplikasi SIAP Versi 2.0 untuk PAUD',
      ringkasan:
        'Dinas Pendidikan Provinsi DKI Jakarta menyelenggarakan sosialisasi pembaruan aplikasi pelaporan BOP khusus untuk jenjang PAUD dan Kesetaraan.',
      isiLengkap:
        'Dinas Pendidikan Provinsi DKI Jakarta menyelenggarakan bimbingan teknis dan sosialisasi pembaruan sistem pelaporan SIAP BOP secara terpadu. Materi meliputi pengajuan Nota Pencairan Dana (NPD) terintegrasi SIPKD, pencatatan belanja BKU, pemungutan pajak MPN G3, serta penyusunan BAP Kas periodik.'
    },
    {
      id: 3,
      kategori: 'UMUM',
      badgeColor: '#374151',
      bannerGradient: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
      bannerIcon: 'bi-award-fill',
      tanggal: '01 November 2026',
      judul: 'Penghargaan Sekolah dengan Pelaporan BOSP Terbaik 2026',
      ringkasan:
        'Apresiasi diberikan kepada sekolah yang tertib administrasi dan melaporkan realisasi penggunaan dana BOSP tepat waktu dan sesuai dengan petunjuk teknis.',
      isiLengkap:
        'Penghargaan diberikan kepada satuan pendidikan negeri di 5 wilayah Kota Administrasi dan Kepulauan Seribu yang konsisten melakukan tutup buku BKU tepat waktu, melakukan rekonsiliasi mutasi Bank DKI secara berkala, serta menyelesaikan setoran pajak NTPN tanpa tunggakan.'
    }
  ];

  readonly peraturanList: PeraturanItem[] = [
    {
      id: 1,
      judul: 'Permendikbudristek No. 63 Tahun 2022',
      deskripsi: 'Petunjuk Teknis Pengelolaan Dana Bantuan Operasional Satuan Pendidikan.',
      icon: 'bi-file-earmark-text',
      iconBg: '#fef2f2',
      iconColor: '#ef4444',
      kodeFile: 'Permendikbudristek_No_63_Tahun_2022_Juknis_BOSP.txt'
    },
    {
      id: 2,
      judul: 'Pergub DKI Jakarta No. 12 Tahun 2024',
      deskripsi: 'Pedoman Pelaksanaan BOP Jenjang PAUD dan Pendidikan Kesetaraan.',
      icon: 'bi-file-earmark-text',
      iconBg: '#fef2f2',
      iconColor: '#ef4444',
      kodeFile: 'Pergub_DKI_Jakarta_No_12_Tahun_2024_BOP.txt'
    },
    {
      id: 3,
      judul: 'Buku Panduan SIAP Versi 2.0',
      deskripsi: 'Manual penggunaan aplikasi untuk Bendahara dan Kepala Sekolah.',
      icon: 'bi-book',
      iconBg: '#eff6ff',
      iconColor: '#3b82f6',
      kodeFile: 'Buku_Panduan_SIAP_BOSP_BOP_v2.txt'
    }
  ];

  readonly prosedurSteps = [
    {
      no: 1,
      judul: 'Otentikasi Akun',
      deskripsi: 'Login menggunakan akun SSO yang divalidasi oleh Dinas Pendidikan.',
      icon: 'bi-shield-check',
      iconColor: '#FF9A00',
      badgeBg: '#FF9A00',
      badgeTextColor: '#ffffff',
      isFinal: false
    },
    {
      no: 2,
      judul: 'Input RKAS',
      deskripsi: 'Sekolah menyusun dan memasukkan Rencana Kegiatan dan Anggaran Sekolah.',
      icon: 'bi-file-earmark-spreadsheet',
      iconColor: '#60a5fa',
      badgeBg: '#3b82f6',
      badgeTextColor: '#ffffff',
      isFinal: false
    },
    {
      no: 3,
      judul: 'Pencatatan Realisasi',
      deskripsi: 'Input realisasi penggunaan dana setiap bulan disertai bukti transaksi.',
      icon: 'bi-calculator',
      iconColor: '#fbbf24',
      badgeBg: '#eab308',
      badgeTextColor: '#ffffff',
      isFinal: false
    },
    {
      no: 4,
      judul: 'Validasi & Pelaporan',
      deskripsi: 'Review oleh Kepala Sekolah dan otomatisasi laporan SPTJM untuk Dinas.',
      icon: 'bi-send-check',
      iconColor: '#ffffff',
      badgeBg: '#ffffff',
      badgeTextColor: '#FF9A00',
      isFinal: true
    }
  ];

  readonly selectedAppKode = signal<string>('');
  readonly selectedApp = computed<AppModule | null>(() => {
    const apps = this.auth.listAplikasi();
    if (!apps.length) return null;
    return apps.find((a) => a.kodeAplikasi === this.selectedAppKode()) ?? apps[0];
  });

  pwdForm = { nrk: '', sandiLama: '', sandiBaru: '', konfirmasiSandiBaru: '' };

  ngAfterViewInit(): void {
    const host = this.el.nativeElement;
    if (typeof IntersectionObserver !== 'undefined') {
      this.revealObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('revealed');
              this.revealObserver?.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.12, rootMargin: '0px 0px -36px 0px' }
      );
      host.querySelectorAll('.reveal-on-scroll').forEach((node: Element) => this.revealObserver?.observe(node));

      const footer = host.querySelector('#landing-footer');
      if (footer) {
        this.footerObserver = new IntersectionObserver(
          (entries) => {
            this.footerInView = entries.some((e) => e.isIntersecting);
            this.updateBackToTop();
          },
          { threshold: 0.08 }
        );
        this.footerObserver.observe(footer);
      }
    } else {
      host.querySelectorAll('.reveal-on-scroll').forEach((node: Element) => node.classList.add('revealed'));
    }

    this.revealVisibleInViewport();
    this.updateBackToTop();
  }

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
    this.footerObserver?.disconnect();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.isScrolled.set(window.scrollY > 10);
    this.revealVisibleInViewport();
    this.updateBackToTop();
  }

  private revealVisibleInViewport(): void {
    const viewBottom = window.innerHeight - 36;
    this.el.nativeElement.querySelectorAll('.reveal-on-scroll:not(.revealed)').forEach((node: Element) => {
      const rect = node.getBoundingClientRect();
      if (rect.top <= viewBottom) {
        node.classList.add('revealed');
        this.revealObserver?.unobserve(node);
      }
    });
  }

  private updateBackToTop(): void {
    const docEl = document.documentElement;
    const nearBottom = window.scrollY + window.innerHeight >= docEl.scrollHeight - 420;
    this.showBackToTop.set(this.footerInView || (window.scrollY > 300 && nearBottom));
  }

  scrollTo(sectionId: string): void {
    if (sectionId === 'beranda') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  enterWorkspace(): void {
    const first = this.auth.getFirstAllowedRoute();
    const meta = this.auth.findMenuMeta(first);
    if (this.auth.requiresSchoolPicker() && !this.auth.sekolahConfirmed() && meta?.menu?.requiresSekolah) {
      this.auth.openSekolahPicker(first);
      return;
    }
    this.router.navigateByUrl(first);
  }

  openMainMenu(grp: AppModule): void {
    const firstSub = grp.menu[0];
    if (!firstSub) return;
    this.openSubMenu(grp, firstSub);
  }

  openSubMenu(grp: AppModule, sub: AppMenu): void {
    const targetUrl = `/${grp.link}/${sub.link}`;
    if (this.auth.requiresSchoolPicker() && !this.auth.sekolahConfirmed() && sub.requiresSekolah) {
      this.auth.openSekolahPicker(targetUrl);
      return;
    }
    this.router.navigateByUrl(targetUrl);
  }

  downloadPeraturanText(doc: PeraturanItem): void {
    const content = `${doc.judul}\n${doc.deskripsi}\n\nDinas Pendidikan Provinsi DKI Jakarta - Portal SIAP BOSP & BOP`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.kodeFile;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success(`Dokumen ${doc.judul} berhasil diunduh.`);
  }

  submitChangePassword(): void {
    if (!this.pwdForm.nrk || !this.pwdForm.sandiLama || !this.pwdForm.sandiBaru || !this.pwdForm.konfirmasiSandiBaru) {
      this.toast.error('Harap lengkapi seluruh kolom ganti kata sandi.');
      return;
    }
    if (this.pwdForm.sandiBaru !== this.pwdForm.konfirmasiSandiBaru) {
      this.toast.error('Konfirmasi sandi baru tidak sesuai dengan sandi baru.');
      return;
    }
    this.http
      .post<any>('/auth-server/api/auth/change-password', {
        nrk: this.pwdForm.nrk,
        sandiLama: this.pwdForm.sandiLama,
        sandiBaru: this.pwdForm.sandiBaru
      })
      .subscribe({
        next: (res) => {
          this.toast.success(res?.message || 'Kata sandi berhasil diperbarui.');
          this.showPasswordModal.set(false);
          this.pwdForm = { nrk: '', sandiLama: '', sandiBaru: '', konfirmasiSandiBaru: '' };
        },
        error: (err) => this.toast.error(err?.error?.message || 'Gagal mengubah kata sandi.')
      });
  }
}
