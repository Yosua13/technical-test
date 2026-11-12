import { Routes, Route } from '@angular/router';
import { authGuard, rbacMenuGuard } from './core/guards/auth.guard';
import { DefaultLayoutComponent } from './containers/default-layout/default-layout.component';
import { LoginComponent } from './pages/login/login.component';
import { LandingPageComponent } from './pages/landing-page/landing-page.component';
import { DashboardDanaComponent } from './pages/transaksi/dashboard-dana.component';
import { KonfirmasiDanaComponent } from './pages/transaksi/konfirmasi-dana.component';
import { InputBkuComponent } from './pages/transaksi/input-bku.component';
import { InputBkuFormComponent } from './pages/transaksi/input-bku-form.component';
import { PersetujuanBkuComponent } from './pages/transaksi/persetujuan-bku.component';
import { PembayaranBkuComponent } from './pages/transaksi/pembayaran-bku.component';
import { PermohonanTokenComponent } from './pages/transaksi/permohonan-token.component';
import { PembayaranPajakComponent } from './pages/transaksi/pembayaran-pajak.component';
import { TutupBkuComponent } from './pages/transaksi/tutup-bku.component';
import { Mutasi12Component } from './pages/transaksi/mutasi-12.component';
import { MutasiSemuaComponent } from './pages/transaksi/mutasi-semua.component';
import { LaporanBkuComponent } from './pages/transaksi/laporan-bku.component';
import { DroppingDanaFormComponent } from './pages/transaksi/dropping-dana-form.component';
import { NpdBopComponent } from './pages/bop-specific/npd-bop.component';
import { NpdBopFormComponent } from './pages/bop-specific/npd-bop-form.component';
import { KonfirmasiRekeningComponent } from './pages/sekolah/konfirmasi-rekening.component';
import {
  BatasPengajuanComponent,
  DroppingDanaAdminComponent,
  HelpdeskLogsComponent,
  KonversiRkasComponent
} from './pages/administrator/administrator-pages.component';
import { PenggunaMgmtComponent } from './pages/user-management/pengguna-mgmt.component';
import { OtoritasMgmtComponent } from './pages/user-management/otoritas-mgmt.component';
import {
  PajakMgmtComponent,
  SekolahMgmtComponent
} from './pages/user-management/user-management-pages.component';
import { UserManualComponent } from './pages/helpdesk/user-manual.component';
import { VideoTutorialComponent } from './pages/helpdesk/video-tutorial.component';

const bopChildren: Route[] = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardDanaComponent, data: { sumberDana: 'BOP', title: 'Dashboard BKU BOP' } },
  { path: 'laporan-monitoring-sudin', component: DashboardDanaComponent, data: { sumberDana: 'BOP', title: 'Laporan Monitoring Sudin (BOP)' } },
  { path: 'npd-bop', component: NpdBopComponent, data: { sumberDana: 'BOP', title: 'Permohonan NPD BOP & Integrasi SIPKD' } },
  { path: 'npd-bop/tambah', component: NpdBopFormComponent, data: { sumberDana: 'BOP', formMode: 'tambah', title: 'Permohonan NPD / Tambah' } },
  { path: 'npd-bop/detail/:id', component: NpdBopFormComponent, data: { sumberDana: 'BOP', formMode: 'detail', title: 'Permohonan NPD / Detail' } },
  { path: 'konfirmasi-drop-dana-bop', component: NpdBopComponent, data: { sumberDana: 'BOP', title: 'Permohonan NPD BOP' } },
  { path: 'konfirmasi-drop-dana-bop/tambah', component: NpdBopFormComponent, data: { sumberDana: 'BOP', formMode: 'tambah', title: 'Permohonan NPD / Tambah' } },
  { path: 'konfirmasi-drop-dana-bop/detail/:id', component: NpdBopFormComponent, data: { sumberDana: 'BOP', formMode: 'detail', title: 'Permohonan NPD / Detail' } },
  { path: 'pengajuan-npd', component: NpdBopComponent, data: { sumberDana: 'BOP', title: 'Pengajuan Permohonan NPD BOP' } },
  { path: 'pengajuan-npd/tambah', component: NpdBopFormComponent, data: { sumberDana: 'BOP', formMode: 'tambah', title: 'Pengajuan Permohonan NPD / Tambah' } },
  { path: 'pengajuan-npd/detail/:id', component: NpdBopFormComponent, data: { sumberDana: 'BOP', formMode: 'detail', title: 'Pengajuan Permohonan NPD / Detail' } },
  { path: 'persetujuan-npd', component: NpdBopComponent, data: { sumberDana: 'BOP', title: 'Persetujuan NPD BOP' } },
  { path: 'persetujuan-npd/detail/:id', component: NpdBopFormComponent, data: { sumberDana: 'BOP', formMode: 'detail', title: 'Persetujuan NPD / Detail' } },
  { path: 'konfirmasi-dana', component: KonfirmasiDanaComponent, data: { sumberDana: 'BOP', title: 'Konfirmasi Dropping Dana BOP' } },
  { path: 'konfirmasi-dana/tambah', component: DroppingDanaFormComponent, data: { sumberDana: 'BOP', formMode: 'tambah', title: 'Dropping Dana BOP / Tambah' } },
  { path: 'konfirmasi-dana/detail/:id', component: DroppingDanaFormComponent, data: { sumberDana: 'BOP', formMode: 'detail', title: 'Dropping Dana BOP / Detail' } },
  { path: 'input-bku', component: InputBkuComponent, data: { sumberDana: 'BOP', title: 'Input BKU BOP' } },
  { path: 'input-bku/tambah', component: InputBkuFormComponent, data: { sumberDana: 'BOP', formMode: 'tambah', title: 'Tambah Transaksi BKU BOP' } },
  { path: 'input-bku/edit/:id', component: InputBkuFormComponent, data: { sumberDana: 'BOP', formMode: 'edit', title: 'Edit Transaksi BKU BOP' } },
  { path: 'input-bku/detail/:id', component: InputBkuFormComponent, data: { sumberDana: 'BOP', formMode: 'detail', title: 'Detail Transaksi BKU BOP' } },
  { path: 'list-bku-bop', component: InputBkuComponent, data: { sumberDana: 'BOP', title: 'List BKU BOP' } },
  { path: 'pengajuan-pembayaran-bku', component: PersetujuanBkuComponent, data: { sumberDana: 'BOP', defaultTab: 'pk', title: 'Pengajuan Pembayaran BKU BOP' } },
  { path: 'persetujuan-bku', component: PersetujuanBkuComponent, data: { sumberDana: 'BOP', defaultTab: 'tu', title: 'Persetujuan Pembayaran BKU BOP' } },
  { path: 'persetujuan-bku-tu', component: PersetujuanBkuComponent, data: { sumberDana: 'BOP', defaultTab: 'tu', title: 'Persetujuan Pembayaran BKU BOP (TU)' } },
  { path: 'persetujuan-bku-pa', component: PersetujuanBkuComponent, data: { sumberDana: 'BOP', defaultTab: 'pa', title: 'Persetujuan Pembayaran BKU BOP (PA)' } },
  { path: 'pembayaran-bku', component: PembayaranBkuComponent, data: { sumberDana: 'BOP', title: 'Pembayaran BKU BOP (Bank & Virtual Account)' } },
  { path: 'permohonan-token', component: PermohonanTokenComponent, data: { sumberDana: 'BOP', title: 'Permohonan Token PA (BOP)' } },
  { path: 'pembayaran-pajak', component: PembayaranPajakComponent, data: { sumberDana: 'BOP', title: 'Pembayaran Pajak BKU BOP' } },
  { path: 'pembayaran-pajak-bop', component: PembayaranPajakComponent, data: { sumberDana: 'BOP', title: 'Pembayaran Pajak BKU BOP' } },
  { path: 'batas-pengajuan-belanja', component: BatasPengajuanComponent, data: { sumberDana: 'BOP', title: 'Batas Pengajuan Belanja BOP' } },
  { path: 'bap-kas-tutup-buku', component: TutupBkuComponent, data: { sumberDana: 'BOP', title: 'Tutup BKU BOP' } },
  { path: 'tutup-bku', component: TutupBkuComponent, data: { sumberDana: 'BOP', title: 'Tutup BKU BOP' } },
  { path: 'mutasi-transfer-12-transaksi', component: Mutasi12Component, data: { sumberDana: 'BOP', title: 'Mutasi 12 Transaksi BOP' } },
  { path: 'bop-mutasi-semua', component: MutasiSemuaComponent, data: { sumberDana: 'BOP', title: 'Mutasi Semua Transaksi BOP' } },
  { path: 'laporan-bku', component: LaporanBkuComponent, data: { sumberDana: 'BOP', title: 'Laporan BKU BOP K1-K7 (PDF & Excel)' } },
  { path: 'laporan-BKU', component: LaporanBkuComponent, data: { sumberDana: 'BOP', title: 'Laporan BKU BOP K1-K7 (PDF & Excel)' } }
];

export const routes: Routes = [
  { path: '', redirectTo: 'landingpage', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'landingpage', component: LandingPageComponent },
  {
    path: '',
    component: DefaultLayoutComponent,
    canActivate: [authGuard],
    canActivateChild: [rbacMenuGuard],
    children: [
      // 1. USER MANAGEMENT
      {
        path: 'user-management',
        children: [
          { path: '', redirectTo: 'pengguna', pathMatch: 'full' },
          { path: 'pengguna', component: PenggunaMgmtComponent, data: { title: 'Manajemen Pengguna', desc: 'Kelola akun pengelola BOS/BOP, filter lengkap, lock/aktif, dan pemetaan otoritas/sekolah.' } },
          { path: 'otoritas', component: OtoritasMgmtComponent, data: { tab: 'otoritas', title: 'Master Otoritas (RBAC)', desc: 'Hierarki kewenangan role serta pengaturan hak akses modul & sub-menu.' } },
          { path: 'aplikasi', component: OtoritasMgmtComponent, data: { tab: 'aplikasi', title: 'Master Aplikasi', desc: 'Daftar modul utama beserta pengelolaan urutan & deskripsi aplikasi.' } },
          { path: 'menu', component: OtoritasMgmtComponent, data: { tab: 'menu', title: 'Master Sub-Menu Aplikasi', desc: 'Pengaturan tautan rute, ikon, dan flag wajib pilih sekolah.' } },
          { path: 'periode', component: BatasPengajuanComponent, data: { title: 'Master Periode Anggaran', desc: 'Pengaturan batas pengajuan belanja dan status aktif tiap periode.' } },
          { path: 'master-sekolah', component: SekolahMgmtComponent, data: { title: 'Master Sekolah & Rekening', desc: 'Kelola profil satuan pendidikan, nomor rekening BOS/BOP, serta pejabat penandatangan.' } },
          { path: 'sekolah', component: SekolahMgmtComponent, data: { title: 'Master Sekolah & Rekening', desc: 'Kelola profil satuan pendidikan, nomor rekening BOS/BOP, serta pejabat penandatangan.' } },
          { path: 'pajak', component: PajakMgmtComponent, data: { title: 'Master Pajak & BAS', desc: 'Daftar tarif pemotongan pajak MPN G3 serta Bagan Akun Standar (BAS).' } }
        ]
      },

      // 2. BKU BOSP NEGERI (Clean from Section II eliminated menus)
      {
        path: 'bos-negeri',
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          { path: 'dashboard', component: DashboardDanaComponent, data: { sumberDana: 'BOS', title: 'Dashboard BKU BOSP' } },
          { path: 'laporan-monitoring-dinas', component: DashboardDanaComponent, data: { sumberDana: 'BOS', title: 'Laporan Monitoring Dinas (BOSP)' } },
          { path: 'konfirmasi-dana', component: KonfirmasiDanaComponent, data: { sumberDana: 'BOS', title: 'Dropping Dana BOSP' } },
          { path: 'konfirmasi-dana/tambah', component: DroppingDanaFormComponent, data: { sumberDana: 'BOS', formMode: 'tambah', title: 'Dropping Dana BOSP / Tambah' } },
          { path: 'konfirmasi-dana/detail/:id', component: DroppingDanaFormComponent, data: { sumberDana: 'BOS', formMode: 'detail', title: 'Dropping Dana BOSP / Detail' } },
          { path: 'konfirmasi-drop-dana', component: KonfirmasiDanaComponent, data: { sumberDana: 'BOS', title: 'Dropping Dana BOSP' } },
          { path: 'konfirmasi-drop-dana/tambah', component: DroppingDanaFormComponent, data: { sumberDana: 'BOS', formMode: 'tambah', title: 'Dropping Dana BOSP / Tambah' } },
          { path: 'konfirmasi-drop-dana/detail/:id', component: DroppingDanaFormComponent, data: { sumberDana: 'BOS', formMode: 'detail', title: 'Dropping Dana BOSP / Detail' } },
          { path: 'dinas-konfirmasi-drop-dana', component: KonfirmasiDanaComponent, data: { sumberDana: 'BOS', title: 'Konfirmasi Dropping Dana BOSP' } },
          { path: 'dinas-konfirmasi-drop-dana/detail/:id', component: DroppingDanaFormComponent, data: { sumberDana: 'BOS', formMode: 'detail', title: 'Konfirmasi Dropping Dana BOSP / Detail' } },
          { path: 'input-bku', component: InputBkuComponent, data: { sumberDana: 'BOS', title: 'Input BKU BOSP' } },
          { path: 'input-bku/tambah', component: InputBkuFormComponent, data: { sumberDana: 'BOS', formMode: 'tambah', title: 'Tambah Transaksi BKU BOSP' } },
          { path: 'input-bku/edit/:id', component: InputBkuFormComponent, data: { sumberDana: 'BOS', formMode: 'edit', title: 'Edit Transaksi BKU BOSP' } },
          { path: 'input-bku/detail/:id', component: InputBkuFormComponent, data: { sumberDana: 'BOS', formMode: 'detail', title: 'Detail Transaksi BKU BOSP' } },
          { path: 'list-bku-bosp', component: InputBkuComponent, data: { sumberDana: 'BOS', title: 'List BKU BOSP' } },
          { path: 'persetujuan-bku', component: PersetujuanBkuComponent, data: { sumberDana: 'BOS', defaultTab: 'tu', title: 'Persetujuan Berjenjang BOSP' } },
          { path: 'pengajuan-bku', component: PersetujuanBkuComponent, data: { sumberDana: 'BOS', defaultTab: 'pk', title: 'Pengajuan Pembayaran BKU BOSP' } },
          { path: 'persetujuan-bku-tu', component: PersetujuanBkuComponent, data: { sumberDana: 'BOS', defaultTab: 'tu', title: 'Persetujuan Pembayaran BKU BOSP (TU)' } },
          { path: 'persetujuan-bku-pa', component: PersetujuanBkuComponent, data: { sumberDana: 'BOS', defaultTab: 'pa', title: 'Persetujuan Pembayaran BKU BOSP (PA)' } },
          { path: 'pembayaran-bku', component: PembayaranBkuComponent, data: { sumberDana: 'BOS', title: 'Pembayaran BKU BOSP (Bank & Virtual Account)' } },
          { path: 'permohonan-token', component: PermohonanTokenComponent, data: { sumberDana: 'BOS', title: 'Permohonan Token PA (BOSP)' } },
          { path: 'pembayaran-pajak', component: PembayaranPajakComponent, data: { sumberDana: 'BOS', title: 'Pembayaran Pajak BKU BOSP' } },
          { path: 'pembayaran-pajak-bku', component: PembayaranPajakComponent, data: { sumberDana: 'BOS', title: 'Pembayaran Pajak BKU BOSP' } },
          { path: 'bap-kas-tutup-buku', component: TutupBkuComponent, data: { sumberDana: 'BOS', title: 'Tutup BKU BOSP' } },
          { path: 'tutup-bku', component: TutupBkuComponent, data: { sumberDana: 'BOS', title: 'Tutup BKU BOSP' } },
          { path: 'bos-mutasi-12', component: Mutasi12Component, data: { sumberDana: 'BOS', title: 'Mutasi 12 Transaksi BOSP' } },
          { path: 'bos-mutasi-semua', component: MutasiSemuaComponent, data: { sumberDana: 'BOS', title: 'Mutasi Semua Transaksi BOSP' } },
          { path: 'laporan-bku', component: LaporanBkuComponent, data: { sumberDana: 'BOS', title: 'Laporan BKU BOSP (PDF & Excel)' } },
          { path: 'laporan-BKU', component: LaporanBkuComponent, data: { sumberDana: 'BOS', title: 'Laporan BKU BOSP (PDF & Excel)' } }
        ]
      },

      // 3. BKU BOP NEGERI (/bku-bop dan /bop-negeri)
      {
        path: 'bku-bop',
        children: bopChildren
      },
      {
        path: 'bop-negeri',
        children: bopChildren
      },

      // 4. ADMINISTRATOR
      {
        path: 'administrator',
        children: [
          { path: '', redirectTo: 'batas-pengajuan-belanja-list-opd', pathMatch: 'full' },
          { path: 'batas-pengajuan', component: BatasPengajuanComponent, data: { title: 'Batas Pengajuan Belanja' } },
          { path: 'batas-pengajuan-belanja-list-opd', component: BatasPengajuanComponent, data: { title: 'Batas Pengajuan Belanja' } },
          { path: 'konversi-rkas', component: KonversiRkasComponent, data: { title: 'Migrasi RKAS' } },
          { path: 'konversi-data', component: KonversiRkasComponent, data: { title: 'Migrasi RKAS' } },
          { path: 'dropping-dana', component: DroppingDanaAdminComponent, data: { title: 'Dropping Dana BOS & BOP' } },
          { path: 'helpdesk', component: HelpdeskLogsComponent, data: { title: 'Help Desk & Audit Log Integrasi' } }
        ]
      },

      // 5. HELP DESK
      {
        path: 'helpdesk',
        children: [
          { path: '', redirectTo: 'tiket-helpdesk', pathMatch: 'full' },
          { path: 'user-manual', component: UserManualComponent, data: { title: 'User Manual SIAP BOSP & BOP' } },
          { path: 'tiket-helpdesk', component: HelpdeskLogsComponent, data: { title: 'Help Desk & Tiket Bantuan' } },
          { path: 'video-tutorial', component: VideoTutorialComponent, data: { title: 'Video Tutorial SIAP BOSP & BOP' } }
        ]
      },

      // KONFIRMASI REKENING SEKOLAH
      {
        path: 'sekolah',
        children: [
          { path: '', redirectTo: 'konfirmasi-rekening', pathMatch: 'full' },
          { path: 'konfirmasi-rekening', component: KonfirmasiRekeningComponent, data: { title: 'Konfirmasi Rekening & NPWP Sekolah' } }
        ]
      }
    ]
  },
  { path: '**', redirectTo: 'landingpage' }
];
