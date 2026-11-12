import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

interface ManualStep {
  stepNo: number;
  title: string;
  actor: string;
  description: string;
  sampleData?: string;
}

interface ManualSection {
  id: string;
  category: string;
  badge: string;
  title: string;
  summary: string;
  routeLink: string;
  routeLabel: string;
  roles: string[];
  steps: ManualStep[];
  tips: string[];
}

@Component({
  selector: 'app-user-manual',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container-fluid py-3">
      <!-- Header Banner -->
      <div class="card border-0 shadow-sm mb-3" style="background: linear-gradient(135deg, #d95d0f 0%, #f58220 100%); color: #fff;">
        <div class="card-body d-flex flex-wrap justify-content-between align-items-center gap-3 p-4">
          <div>
            <div class="d-flex align-items-center gap-2 mb-1">
              <i class="bi bi-book-half fs-4"></i>
              <span class="badge bg-white text-dark fw-semibold">PANDUAN RESMI DUMMY v2.6</span>
            </div>
            <h4 class="fw-bold mb-1">User Manual Aplikasi SIAP BOSP &amp; BOP DKI Jakarta</h4>
            <p class="mb-0 opacity-90 small">
              Panduan operasional lengkap menggunakan skenario data dummy: Login CAPTCHA, RBAC, Migrasi Excel (RKAS &amp; PASK),
              Dropping/NPD, BKU SPJ (Luring &amp; VA), Pajak MPN, Tutup Buku, dan Laporan Keuangan.
            </p>
          </div>
          <div class="d-flex gap-2">
            <a routerLink="/helpdesk/video-tutorial" class="btn btn-light btn-sm fw-semibold">
              <i class="bi bi-play-btn me-1 text-danger"></i> Lihat Video Tutorial
            </a>
            <a routerLink="/helpdesk/tiket-helpdesk" class="btn btn-outline-light btn-sm fw-semibold">
              <i class="bi bi-ticket-detailed me-1"></i> Buka Tiket Help Desk
            </a>
          </div>
        </div>
      </div>

      <!-- Search & Category Filter -->
      <div class="card border-0 shadow-sm mb-3">
        <div class="card-body p-3">
          <div class="row g-2 align-items-center">
            <div class="col-md-5">
              <div class="input-group input-group-sm">
                <span class="input-group-text bg-light"><i class="bi bi-search"></i></span>
                <input
                  type="text"
                  class="form-control"
                  placeholder="Cari modul, kode transaksi (JJ/JO/P1-P5), role, atau langkah..."
                  [ngModel]="searchQuery()"
                  (ngModelChange)="searchQuery.set($event)"
                />
                @if (searchQuery()) {
                  <button class="btn btn-outline-secondary" type="button" (click)="searchQuery.set('')">
                    <i class="bi bi-x"></i>
                  </button>
                }
              </div>
            </div>
            <div class="col-md-7 d-flex flex-wrap gap-1 justify-content-md-end">
              @for (cat of categories; track cat) {
                <button
                  type="button"
                  class="btn btn-sm"
                  [class.btn-warning]="selectedCategory() === cat"
                  [class.text-white]="selectedCategory() === cat"
                  [class.btn-outline-secondary]="selectedCategory() !== cat"
                  (click)="selectedCategory.set(cat)"
                >
                  {{ cat }}
                </button>
              }
            </div>
          </div>
        </div>
      </div>

      <div class="row g-3">
        <!-- Left Navigation TOC -->
        <div class="col-lg-4">
          <div class="card border-0 shadow-sm mb-3">
            <div class="card-header bg-white fw-bold d-flex justify-content-between align-items-center">
              <span><i class="bi bi-list-ol me-2 text-warning"></i>Daftar Bab Panduan</span>
              <span class="badge bg-secondary">{{ filteredSections().length }} Modul</span>
            </div>
            <div class="list-group list-group-flush">
              @for (sec of filteredSections(); track sec.id) {
                <button
                  type="button"
                  class="list-group-item list-group-item-action text-start py-2 px-3"
                  [class.active]="activeSection()?.id === sec.id"
                  [style.background-color]="activeSection()?.id === sec.id ? '#fff3e6' : ''"
                  [style.color]="activeSection()?.id === sec.id ? '#b44800' : ''"
                  [style.border-left]="activeSection()?.id === sec.id ? '4px solid #e66b12' : '4px solid transparent'"
                  (click)="selectSection(sec.id)"
                >
                  <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="badge" [ngClass]="activeSection()?.id === sec.id ? 'bg-warning text-dark' : 'bg-light text-secondary border'">
                      {{ sec.badge }}
                    </span>
                    <small class="text-muted">{{ sec.steps.length }} langkah</small>
                  </div>
                  <div class="fw-semibold small">{{ sec.title }}</div>
                </button>
              } @empty {
                <div class="p-4 text-center text-muted small">
                  <i class="bi bi-inbox fs-4 d-block mb-1"></i>
                  Topik tidak ditemukan untuk kata kunci "{{ searchQuery() }}".
                </div>
              }
            </div>
          </div>

          <!-- Dummy Quick Reference Card -->
          <div class="card border-0 shadow-sm">
            <div class="card-header bg-dark text-white fw-semibold small">
              <i class="bi bi-database-check me-2 text-warning"></i>Data Dummy Acuan Simulasi
            </div>
            <div class="card-body p-3 small">
              <div class="mb-2">
                <div class="fw-semibold text-dark">Sekolah Uji Coba:</div>
                <ul class="ps-3 mb-1 text-muted">
                  <li>ID 1: SMAN 1 JAKARTA (NPSN <code>20100101</code>)</li>
                  <li>ID 2: SMPN 115 JAKARTA (NPSN <code>20100202</code>)</li>
                  <li>ID 3: SDN MENTENG 01 PAGI (NPSN <code>20100303</code>)</li>
                </ul>
              </div>
              <div class="mb-2">
                <div class="fw-semibold text-dark">Rekening &amp; NPWP Rekanan Dummy:</div>
                <ul class="ps-3 mb-1 text-muted">
                  <li><code>1110099887766</code> (Bank DKI - CV. Graha Pustaka)</li>
                  <li><code>5400881234</code> (Bank BCA - PT. Sejuk Prima Teknik)</li>
                  <li>NPWP PLN: <code>01.001.629.3-051.000</code></li>
                  <li>NPWP Umum (16 digit): <code>0123456789012345</code></li>
                </ul>
              </div>
              <div>
                <div class="fw-semibold text-dark">Kode Transaksi Baku:</div>
                <div class="d-flex flex-wrap gap-1 mt-1">
                  <span class="badge bg-primary">JJ = Belanja SPJ</span>
                  <span class="badge bg-success">JO = Dropping/NPD Cair</span>
                  <span class="badge bg-secondary">P1..P5 = Pajak</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Content Viewer -->
        <div class="col-lg-8">
          @if (activeSection(); as sec) {
            <div class="card border-0 shadow-sm">
              <div class="card-header bg-white py-3 d-flex flex-wrap justify-content-between align-items-start gap-2">
                <div>
                  <span class="badge bg-warning text-dark mb-1">{{ sec.category }} &bull; {{ sec.badge }}</span>
                  <h5 class="fw-bold mb-1">{{ sec.title }}</h5>
                  <p class="text-muted small mb-0">{{ sec.summary }}</p>
                </div>
                <a [routerLink]="sec.routeLink" class="btn btn-sm btn-outline-warning fw-semibold text-dark">
                  <i class="bi bi-box-arrow-up-right me-1"></i>{{ sec.routeLabel }}
                </a>
              </div>

              <div class="card-body p-4">
                <!-- Role Badges -->
                <div class="mb-4 p-2 px-3 bg-light rounded border d-flex flex-wrap align-items-center gap-2">
                  <span class="small fw-semibold text-secondary"><i class="bi bi-shield-lock me-1"></i>Role Terlibat:</span>
                  @for (role of sec.roles; track role) {
                    <span class="badge bg-white text-dark border">{{ role }}</span>
                  }
                </div>

                <!-- Step by step guide -->
                <h6 class="fw-bold mb-3"><i class="bi bi-diagram-3 me-2 text-warning"></i>Alur Langkah Kerja (Data Dummy)</h6>
                <div class="d-flex flex-column gap-3 mb-4">
                  @for (st of sec.steps; track st.stepNo) {
                    <div class="border rounded p-3 bg-white position-relative">
                      <div class="d-flex align-items-center justify-content-between mb-1">
                        <div class="d-flex align-items-center gap-2">
                          <span
                            class="rounded-circle d-inline-flex align-items-center justify-content-center fw-bold text-white"
                            style="width: 26px; height: 26px; font-size: 0.8rem; background-color: #e66b12;"
                          >
                            {{ st.stepNo }}
                          </span>
                          <span class="fw-bold text-dark">{{ st.title }}</span>
                        </div>
                        <span class="badge bg-light text-dark border">{{ st.actor }}</span>
                      </div>
                      <p class="small text-secondary mb-2 ms-4 ps-2">{{ st.description }}</p>
                      @if (st.sampleData) {
                        <div class="ms-4 ps-2">
                          <div class="p-2 rounded bg-light border-start border-warning border-3 small font-monospace text-dark">
                            <strong>Contoh Input Dummy:</strong> {{ st.sampleData }}
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>

                <!-- Tips & Notes -->
                <div class="alert alert-warning bg-opacity-10 border-warning mb-0">
                  <div class="fw-bold small mb-1"><i class="bi bi-lightbulb me-1"></i>Catatan Penting &amp; Validasi Sistem</div>
                  <ul class="small mb-0 ps-3">
                    @for (tip of sec.tips; track tip) {
                      <li>{{ tip }}</li>
                    }
                  </ul>
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class UserManualComponent {
  readonly categories = [
    'Semua',
    'Login & RBAC',
    'Administrator & Migrasi',
    'BOSP (APBN)',
    'BOP (APBD)',
    'Pajak & Pembayaran',
    'Penutupan & Laporan'
  ];

  readonly searchQuery = signal('');
  readonly selectedCategory = signal('Semua');
  readonly selectedId = signal('login-rbac');

  readonly sections: ManualSection[] = [
    {
      id: 'login-rbac',
      category: 'Login & RBAC',
      badge: 'BAB 1',
      title: 'Akses Sistem, Validasi CAPTCHA & Hak Akses RBAC',
      summary: 'Cara masuk menggunakan akun sekolah/admin dummy, validasi kode keamanan real-time, serta pembatasan menu otomatis berdasarkan role.',
      routeLink: '/bos-negeri/dashboard',
      routeLabel: 'Buka Dashboard BOSP',
      roles: ['ADMIN-TDI', 'PK-NEGERI', 'TU-NEGERI', 'PA-NEGERI', 'SUDIN', 'ADMIN-DINAS'],
      steps: [
        {
          stepNo: 1,
          title: 'Login & Verifikasi CAPTCHA Real-Time',
          actor: 'Semua Role',
          description: 'Masukkan username, kata sandi, tahun anggaran (2026), dan kode CAPTCHA sesuai gambar. Indikator X merah akan berubah menjadi centang hijau seketika saat kode CAPTCHA sesuai.',
          sampleData: 'ADMIN-TDI / MonaS123! | PK SMAN 1: bendahara.sman1 / password123'
        },
        {
          stepNo: 2,
          title: 'Pemilihan Sekolah untuk ADMIN-TDI (Cross-Inspection)',
          actor: 'ADMIN-TDI',
          description: 'Saat Super Administrator membuka modul operasional sekolah (BOSP/BOP), sistem menampilkan modal DataTables Pilih Sekolah terlebih dahulu. Pengguna sekolah (PK/TU/PA) langsung terkunci ke 1 sekolah.',
          sampleData: 'Pilih SMAN 1 JAKARTA (NPSN: 20100101) atau SMPN 115 JAKARTA (NPSN: 20100202)'
        },
        {
          stepNo: 3,
          title: 'Navigasi Sidebar & Pencarian Menu',
          actor: 'Semua Role',
          description: 'Gunakan bilah pencarian di App Bar berwarna oranye untuk mencari nama menu secara instan. Daftar menu sidebar dapat digulir dan hanya menampilkan menu sesuai otoritas role.',
          sampleData: 'Ketik "Pembayaran" atau "Pajak" pada search bar atas'
        }
      ],
      tips: [
        'PK-NEGERI tidak dapat melihat atau menekan tombol persetujuan pada dokumen yang sudah berada di level TU, PA, atau Dinas/Sudin.',
        'Role Help Desk dapat diakses oleh seluruh role untuk panduan, tiket bantuan, dan video tutorial.'
      ]
    },
    {
      id: 'admin-migrasi',
      category: 'Administrator & Migrasi',
      badge: 'BAB 2',
      title: 'Migrasi Excel RKAS & Migrasi PASK Dropping/NPD',
      summary: 'Prosedur unggah template Excel RKAS untuk pagu belanja dan template Excel PASK untuk mencairkan dana triwulanan sekolah.',
      routeLink: '/administrator/konversi-data',
      routeLabel: 'Buka Migrasi RKAS',
      roles: ['ADMIN-TDI'],
      steps: [
        {
          stepNo: 1,
          title: 'Unduh & Unggah Template Migrasi RKAS (XLSX)',
          actor: 'ADMIN-TDI',
          description: 'Masuk ke Administrator -> Migrasi RKAS. Unduh Template_Migrasi_RKAS_SIAPBOS.xlsx, isi 16 kolom komponen anggaran sekolah (BOS periode 01/02, BOP periode TW1-TW4), lalu unggah file Excel.',
          sampleData: 'SekolahId=1, SumberDana=BOS, KodePeriode=01, KodeAkun=5.1.02.01.01.0024, Vol=10, Harga=150000'
        },
        {
          stepNo: 2,
          title: 'Unggah File Excel PASK (Dropping & NPD)',
          actor: 'ADMIN-TDI',
          description: 'Masuk ke Administrator -> Dropping Dana BOS & BOP. Unduh Template_Migrasi_NPD_Dropping_SIAPBOS.xlsx, sesuaikan nominal alokasi triwulan, lalu unggah agar data tersedia bagi PK.',
          sampleData: 'SumberDana=BOS (TW1 Rp 120.000.000) atau BOP (TW1 Rp 85.000.000)'
        },
        {
          stepNo: 3,
          title: 'Validasi File & Penyimpanan Otomatis',
          actor: 'Sistem Uploader',
          description: 'Sistem menolak file PASK jika diunggah ke endpoint RKAS (HTTP 400). File valid tersimpan langsung ke folder /uploads pada proyek tanpa MinIO.',
          sampleData: 'Folder tujuan: d:\\project_yosua\\siap-bos-tes-user\\uploads\\'
        }
      ],
      tips: [
        'Migrasi PASK Dropping & NPD hanya diizinkan 1 periode triwulan sekali per sekolah dan sumber dana.',
        'Data hasil migrasi bersifat read-only saat ditarik PK pada menu Dropping Dana maupun Permohonan NPD BOP.'
      ]
    },
    {
      id: 'bosp-dropping-bku',
      category: 'BOSP (APBN)',
      badge: 'BAB 3',
      title: 'Alur BKU BOSP Negeri: Dropping s/d Input Belanja SPJ',
      summary: 'Tahapan dari penarikan dana Dropping BOSP (approval PK -> TU -> PA -> Dinas) hingga penyusunan draft belanja SPJ (kode transaksi JJ).',
      routeLink: '/bos-negeri/konfirmasi-dana',
      routeLabel: 'Buka Dropping BOSP',
      roles: ['PK-NEGERI', 'TU-NEGERI', 'PA-NEGERI', 'ADMIN-DINAS'],
      steps: [
        {
          stepNo: 1,
          title: 'Ajukan Dropping Dana BOSP dari Hasil Migrasi ADM',
          actor: 'PK-NEGERI',
          description: 'Buka BKU BOSP Negeri -> Dropping Dana BOSP. Klik Ajukan Dropping, pilih PASK hasil migrasi ADM melalui pop-up DataTables (nominal read-only), lalu kirim untuk persetujuan bertingkat.',
          sampleData: 'bendahara.sman1 -> PASK BOSP Reguler TW1 Rp 120.000.000'
        },
        {
          stepNo: 2,
          title: 'Persetujuan Berjenjang & Pencairan Otomatis (Kode JO)',
          actor: 'TU -> PA -> ADMIN-DINAS',
          description: 'Lakukan approval berturut-turut sebagai tu.sman1, kepsek.sman1, dan admin.dinas. Begitu disetujui Dinas, saldo kas BOSP sekolah bertambah otomatis dan tercatat transaksi JO.',
          sampleData: 'Status akhir: DISETUJUI DINAS -> Saldo Kas BOSP otomatis bertambah'
        },
        {
          stepNo: 3,
          title: 'Tambah Belanja SPJ (Transaksi Luring / Bank vs Daring / VA)',
          actor: 'PK-NEGERI',
          description: 'Buka Input BKU BOSP -> klik Tambah (halaman form penuh). Pilih Jenis Transaksi JJ (Belanja SPJ), cari item RKAS dari modal, lalu jalankan tombol Inquiry Rekening & Inquiry NPWP rekanan.',
          sampleData: 'No Bukti: SPJ-BOS-001/2026 | Rekening: 1110099887766 | NPWP: 0123456789012345 | Nilai: Rp 2.500.000'
        },
        {
          stepNo: 4,
          title: 'Pengajuan Pembayaran ke TU & Persetujuan Kepala Sekolah',
          actor: 'PK -> TU -> PA',
          description: 'Draft BKU masih dapat diedit PK di halaman Input BKU. Setelah lengkap, ajukan melalui menu Pengajuan Pembayaran BKU BOSP agar muncul di antrean Persetujuan TU lalu Persetujuan PA.',
          sampleData: 'DRAFT_PK -> DIAJUKAN_TU -> DISETUJUI_TU -> DISETUJUI_PA'
        }
      ],
      tips: [
        'Halaman Input BKU tidak memiliki tombol Approve — seluruh persetujuan diproses di menu Pengajuan/Persetujuan masing-masing role.',
        'Daftar kode transaksi bersih hanya mendukung JJ (Belanja), JO (Dropping/NPD), dan Pajak (P1-P5).'
      ]
    },
    {
      id: 'bop-npd',
      category: 'BOP (APBD)',
      badge: 'BAB 4',
      title: 'Alur BKU BOP Negeri: Permohonan NPD & Persetujuan Sudin',
      summary: 'Proses pencairan dana BOP (APBD DKI) melalui Permohonan NPD hasil migrasi ADM dengan approval PK -> TU -> PA -> SUDIN.',
      routeLink: '/bop-negeri/npd-bop',
      routeLabel: 'Buka Permohonan NPD',
      roles: ['PK-NEGERI', 'TU-NEGERI', 'PA-NEGERI', 'SUDIN'],
      steps: [
        {
          stepNo: 1,
          title: 'Pilih PASK Migrasi pada Form Permohonan NPD BOP',
          actor: 'PK-NEGERI',
          description: 'Buka BKU BOP Negeri -> Permohonan NPD. Pilih periode triwulan aktif dan pilih paket PASK dari pop-up DataTables. Nilai NPD dikunci sesuai hasil migrasi ADM.',
          sampleData: 'bendahara.sman1 -> BOP Alokasi Dasar TW1'
        },
        {
          stepNo: 2,
          title: 'Approval 4 Tahap (PK -> TU -> PA -> SUDIN)',
          actor: 'TU -> PA -> SUDIN',
          description: 'Verifikator TU (tu.sman1) memeriksa kelengkapan NPD, diteruskan ke Kepala Sekolah (kepsek.sman1), dan disahkan oleh Suku Dinas Pendidikan (sudin.jp).',
          sampleData: 'Setelah disetujui sudin.jp, dana BOP otomatis masuk kas sekolah (transaksi JO)'
        },
        {
          stepNo: 3,
          title: 'Input SPJ BOP & Honorarium Narasumber',
          actor: 'PK-NEGERI',
          description: 'Gunakan sisa kas BOP untuk menginput belanja BOP (misalnya Honorarium Narasumber akun 5.1.02.02.01.0003 atau Tagihan Listrik PLN 5.1.02.02.01.0061).',
          sampleData: 'Rekening Narasumber: 1110077788899 (DR. BUDI PRASETYO, M.PD)'
        }
      ],
      tips: [
        'Berbeda dengan BOSP yang disetujui Dinas (admin.dinas), pencairan NPD BOP disahkan oleh Suku Dinas (sudin.jp).',
        'Monitoring penyerapan BOP tingkat wilayah tersedia di menu Laporan Monitoring Sudin.'
      ]
    },
    {
      id: 'pajak-token-bayar',
      category: 'Pajak & Pembayaran',
      badge: 'BAB 5',
      title: 'Token PA (5 Menit), Transfer Bank/VA & Siklus Pajak P1-P5',
      summary: 'Mekanisme keamanan token CMS 5 menit oleh Kepala Sekolah, transfer Overbook/VA 3-step, hingga penerimaan & penyetoran pajak MPN.',
      routeLink: '/bos-negeri/pembayaran-bku',
      routeLabel: 'Buka Pembayaran BKU',
      roles: ['PK-NEGERI', 'PA-NEGERI'],
      steps: [
        {
          stepNo: 1,
          title: 'Input Pajak Penerimaan (Referensi SPJ Draft PK)',
          actor: 'PK-NEGERI',
          description: 'Di Input BKU, pilih Jenis Transaksi Pajak Penerimaan lalu pilih SPJ induk berstatus Draft PK. Status pajak penerimaan akan otomatis mengikuti proses approval SPJ induknya.',
          sampleData: 'Pilih P5 (PPN 11%) atau P2 (PPh 22 1,5%) terhadap SPJ-BOS-001/2026'
        },
        {
          stepNo: 2,
          title: 'Permohonan Token CMS oleh Kepala Sekolah (Berlaku 5 Menit)',
          actor: 'PA-NEGERI',
          description: 'Untuk transaksi Transfer Bank (Luring), PA login ke menu Permohonan Token lalu klik Request Token. Sistem memanggil API eksternal dan menghasilkan kode OTP token dengan masa berlaku 5 menit.',
          sampleData: 'Login kepsek.sman1 -> Permohonan Token -> Catat 6 digit token aktif'
        },
        {
          stepNo: 3,
          title: 'Eksekusi Pembayaran BKU (Transfer Bank vs Virtual Account)',
          actor: 'PK-NEGERI',
          description: 'PK membuka Pembayaran BKU. Untuk Transfer Bank, masukkan Token PA sebelum klik Bayar. Untuk Virtual Account (Daring/PLN), tidak perlu token dan sistem langsung menjalankan alur Biller-Inquiry -> Overbook -> Payment.',
          sampleData: 'Hasil sukses: Jurnal & Kode Reff Bank DKI tercatat otomatis + status SETTLED'
        },
        {
          stepNo: 4,
          title: 'Input Pajak Pengeluaran & Pembayaran MPN/NTPN',
          actor: 'PK -> TU -> PA -> PK',
          description: 'Setelah SPJ induk selesai ditransfer, PK menginput Pajak Pengeluaran, melewati persetujuan TU-PA, lalu mengeksekusi penyetoran billing MPN untuk mendapatkan NTPN pada menu Pembayaran Pajak.',
          sampleData: 'Kode Billing DJP dummy terbit & NTPN otomatis tersimpan pada BKU Pajak'
        }
      ],
      tips: [
        'Batal Transfer SPJ dilengkapi modal pop-up pemilihan BKU dan memerlukan persetujuan berjenjang PK -> TU -> PA -> Dinas/Sudin.',
        'Token yang melewati batas 5 menit otomatis kedaluwarsa dan harus diminta ulang oleh PA.'
      ]
    },
    {
      id: 'tutup-laporan',
      category: 'Penutupan & Laporan',
      badge: 'BAB 6',
      title: 'Tutup BKU Bulanan, Mutasi Rekening & Cetak Laporan Resmi',
      summary: 'Rekonsiliasi saldo akhir kas, pemeriksaan mutasi 12 bulan & mutasi lengkap, serta pencetakan laporan BKU format PDF/Excel.',
      routeLink: '/bos-negeri/laporan-bku',
      routeLabel: 'Buka Laporan BKU',
      roles: ['PK-NEGERI', 'PA-NEGERI', 'SUDIN', 'ADMIN-DINAS'],
      steps: [
        {
          stepNo: 1,
          title: 'Rekonsiliasi Mutasi 12 Bulan & Mutasi Semua',
          actor: 'PK-NEGERI / PA-NEGERI',
          description: 'Cocokkan seluruh transaksi debet (JO, penerimaan pajak) dan kredit (JJ, pengeluaran pajak) pada menu Mutasi 12 dan Mutasi Semua terhadap rekening koran Bank DKI.',
          sampleData: 'Periode: Januari - Desember 2026 | Filter Sumber Dana: BOS atau BOP'
        },
        {
          stepNo: 2,
          title: 'Proses Tutup BKU Bulanan',
          actor: 'PK-NEGERI',
          description: 'Masuk ke Tutup BKU, pilih bulan buku yang sudah selesai direkonsiliasi, tinjau ringkasan saldo tunai dan bank, lalu klik Tutup BKU agar bulan tersebut terkunci.',
          sampleData: 'Bulan: Januari 2026 -> Saldo Awal + Penerimaan - Pengeluaran = Saldo Akhir'
        },
        {
          stepNo: 3,
          title: 'Cetak & Unduh Laporan BKU / K7a / Pajak',
          actor: 'PK / PA / SUDIN / DINAS',
          description: 'Buka menu Laporan BKU, pilih Jenis Laporan terlebih dahulu, tentukan periode/triwulan, lalu klik Pratinjau atau Unduh PDF untuk pelaporan resmi.',
          sampleData: 'Jenis Laporan: Buku Kas Umum (BKU) | Realisasi Per Kegiatan | Daftar Pajak'
        }
      ],
      tips: [
        'Jika ditemukan kesalahan setelah penutupan bulan, koordinasikan pembatalan tutup BKU sesuai otoritas administrator.',
        'Semua tombol pratinjau laporan merender dokumen langsung melalui layanan siapbos-report.'
      ]
    }
  ];

  readonly filteredSections = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const cat = this.selectedCategory();
    return this.sections.filter((sec) => {
      const catMatch = cat === 'Semua' || sec.category === cat;
      if (!catMatch) return false;
      if (!q) return true;
      const haystack = [
        sec.title,
        sec.summary,
        sec.category,
        sec.badge,
        ...sec.roles,
        ...sec.tips,
        ...sec.steps.flatMap((s) => [s.title, s.actor, s.description, s.sampleData ?? ''])
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  });

  readonly activeSection = computed(() => {
    const list = this.filteredSections();
    if (!list.length) return null;
    return list.find((s) => s.id === this.selectedId()) ?? list[0];
  });

  selectSection(id: string): void {
    this.selectedId.set(id);
  }
}
