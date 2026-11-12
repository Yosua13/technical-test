import { Routes, Route } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { DefaultLayoutComponent } from './containers/default-layout/default-layout.component';
import { LoginComponent } from './pages/login/login.component';
import { LandingPageComponent } from './pages/landing-page/landing-page.component';
import { DashboardDanaComponent } from './pages/transaksi/dashboard-dana.component';
import { KonfirmasiDanaComponent } from './pages/transaksi/konfirmasi-dana.component';
import { InputBkuComponent } from './pages/transaksi/input-bku.component';
import { PersetujuanBkuComponent } from './pages/transaksi/persetujuan-bku.component';
import { PembayaranBkuComponent } from './pages/transaksi/pembayaran-bku.component';
import { PembayaranPajakComponent } from './pages/transaksi/pembayaran-pajak.component';
import { SetoranStsComponent } from './pages/transaksi/setoran-sts.component';
import { BapKasTutupBukuComponent } from './pages/transaksi/bap-kas-tutup-buku.component';
import { LaporanBkuComponent } from './pages/transaksi/laporan-bku.component';
import { NpdBopComponent } from './pages/bop-specific/npd-bop.component';
import { KoreksiBkuComponent } from './pages/bop-specific/koreksi-bku.component';
import { KonfirmasiRekeningComponent } from './pages/sekolah/konfirmasi-rekening.component';
import {
  BatasPengajuanComponent,
  DroppingDanaAdminComponent,
  HelpdeskLogsComponent,
  KonversiRkasComponent
} from './pages/administrator/administrator-pages.component';
import {
  OtoritasMgmtComponent,
  PajakMgmtComponent,
  PenggunaMgmtComponent,
  SekolahMgmtComponent
} from './pages/user-management/user-management-pages.component';

const bopChildren: Route[] = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardDanaComponent, data: { sumberDana: 'BOP', title: 'Dashboard BKU BOP' } },
  { path: 'laporan-monitoring-sudin', component: DashboardDanaComponent, data: { sumberDana: 'BOP', title: 'Laporan Monitoring Sudin (BOP)' } },
  { path: 'npd-bop', component: NpdBopComponent, data: { sumberDana: 'BOP', title: 'Permohonan NPD BOP & Integrasi SIPKD' } },
  { path: 'konfirmasi-drop-dana-bop', component: NpdBopComponent, data: { sumberDana: 'BOP', title: 'Permohonan NPD BOP' } },
  { path: 'pengajuan-npd', component: NpdBopComponent, data: { sumberDana: 'BOP', title: 'Pengajuan Permohonan NPD BOP' } },
  { path: 'persetujuan-npd', component: NpdBopComponent, data: { sumberDana: 'BOP', title: 'Persetujuan NPD BOP' } },
  { path: 'konfirmasi-dana', component: KonfirmasiDanaComponent, data: { sumberDana: 'BOP', title: 'Konfirmasi Dropping Dana BOP' } },
  { path: 'input-bku', component: InputBkuComponent, data: { sumberDana: 'BOP', title: 'Input BKU BOP' } },
  { path: 'list-bku-bop', component: InputBkuComponent, data: { sumberDana: 'BOP', title: 'List BKU BOP' } },
  { path: 'persetujuan-bku', component: PersetujuanBkuComponent, data: { sumberDana: 'BOP', title: 'Persetujuan Pembayaran BKU BOP' } },
  { path: 'pengajuan-pembayaran-bku', component: PersetujuanBkuComponent, data: { sumberDana: 'BOP', title: 'Pengajuan Pembayaran BKU BOP' } },
  { path: 'pembayaran-bku', component: PembayaranBkuComponent, data: { sumberDana: 'BOP', title: 'Pembayaran BKU BOP (CMS Bank DKI)' } },
  { path: 'permohonan-token', component: PembayaranBkuComponent, data: { sumberDana: 'BOP', title: 'Permohonan Token PA (BOP)' } },
  { path: 'pembayaran-pajak', component: PembayaranPajakComponent, data: { sumberDana: 'BOP', title: 'Pembayaran Pajak BKU BOP' } },
  { path: 'pembayaran-pajak-bop', component: PembayaranPajakComponent, data: { sumberDana: 'BOP', title: 'Pembayaran Pajak BKU BOP' } },
  { path: 'koreksi-bku', component: KoreksiBkuComponent, data: { sumberDana: 'BOP', title: 'Koreksi BKU & Batal Transfer SPJ (BOP)' } },
  { path: 'batal-transfer-spj', component: KoreksiBkuComponent, data: { sumberDana: 'BOP', title: 'Batal Transfer BKU BOP' } },
  { path: 'persetujuan-batal-tf-spj', component: KoreksiBkuComponent, data: { sumberDana: 'BOP', title: 'Persetujuan Batal Transfer BKU BOP' } },
  { path: 'persetujuan-koreksi-sudin-bop', component: KoreksiBkuComponent, data: { sumberDana: 'BOP', title: 'Persetujuan Koreksi Periode Sebelum BOP' } },
  { path: 'input-bku-koreksi', component: KoreksiBkuComponent, data: { sumberDana: 'BOP', title: 'Koreksi Periode Sebelum BOP' } },
  { path: 'cetak-setoran', component: SetoranStsComponent, data: { sumberDana: 'BOP', title: 'Cetak Setoran BOP' } },
  { path: 'persetujuan-setoran', component: SetoranStsComponent, data: { sumberDana: 'BOP', title: 'Persetujuan Setoran BOP' } },
  { path: 'setor-sisa-belanja', component: SetoranStsComponent, data: { sumberDana: 'BOP', title: 'Input Setor Sisa Belanja BOP' } },
  { path: 'pengajuan-pendapatan-lain-lain-bop', component: SetoranStsComponent, data: { sumberDana: 'BOP', title: 'Pengajuan & Persetujuan Pendapatan Lain-Lain BOP' } },
  { path: 'pembayaran-pendapatan-lain-lain-bop', component: SetoranStsComponent, data: { sumberDana: 'BOP', title: 'Pembayaran Pindah Buku BOP' } },
  { path: 'batas-pengajuan-belanja', component: BatasPengajuanComponent, data: { sumberDana: 'BOP', title: 'Batas Pengajuan Belanja BOP' } },
  { path: 'bap-kas-tutup-buku', component: BapKasTutupBukuComponent, data: { sumberDana: 'BOP', title: 'Mutasi Bank DKI, BAP Kas & Tutup Buku (BOP)' } },
  { path: 'bap-kas', component: BapKasTutupBukuComponent, data: { sumberDana: 'BOP', title: 'BAP KAS BOP' } },
  { path: 'batal-tutup-bku', component: BapKasTutupBukuComponent, data: { sumberDana: 'BOP', title: 'Batal Tutup BKU BOP' } },
  { path: 'tutup-bku', component: BapKasTutupBukuComponent, data: { sumberDana: 'BOP', title: 'Tutup BKU BOP' } },
  { path: 'mutasi-transfer-12-transaksi', component: BapKasTutupBukuComponent, data: { sumberDana: 'BOP', title: 'Mutasi 12 Transaksi BOP' } },
  { path: 'bap-kas-approval-sudin', component: BapKasTutupBukuComponent, data: { sumberDana: 'BOP', title: 'BAP Kas Approval (Sudin)' } },
  { path: 'bap-kas-approval-pa', component: BapKasTutupBukuComponent, data: { sumberDana: 'BOP', title: 'BAP KAS Approval (PA)' } },
  { path: 'bop-mutasi-semua', component: BapKasTutupBukuComponent, data: { sumberDana: 'BOP', title: 'Mutasi Semua Transaksi BOP' } },
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
    children: [
      // 1. USER MANAGEMENT (7 Sub Menu)
      {
        path: 'user-management',
        children: [
          { path: '', redirectTo: 'pengguna', pathMatch: 'full' },
          { path: 'pengguna', component: PenggunaMgmtComponent, data: { title: 'Pengguna & Sinkronisasi SIMPEG' } },
          { path: 'otoritas', component: OtoritasMgmtComponent, data: { title: 'Master Otoritas (RBAC)' } },
          { path: 'aplikasi', component: OtoritasMgmtComponent, data: { title: 'Master Aplikasi (5 Menu Utama)' } },
          { path: 'menu', component: OtoritasMgmtComponent, data: { title: 'Master Sub-Menu Aplikasi' } },
          { path: 'periode', component: BatasPengajuanComponent, data: { title: 'Master Periode Anggaran' } },
          { path: 'master-sekolah', component: SekolahMgmtComponent, data: { title: 'Master Sekolah & Rekening' } },
          { path: 'sekolah', component: SekolahMgmtComponent, data: { title: 'Master Sekolah & Rekening' } },
          { path: 'pajak', component: PajakMgmtComponent, data: { title: 'Master Pajak & Bagan Akun Standar' } }
        ]
      },

      // 2. BKU BOSP NEGERI (27 Sub Menu)
      {
        path: 'bos-negeri',
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          { path: 'dashboard', component: DashboardDanaComponent, data: { sumberDana: 'BOS', title: 'Dashboard BKU BOSP' } },
          { path: 'laporan-monitoring-dinas', component: DashboardDanaComponent, data: { sumberDana: 'BOS', title: 'Laporan Monitoring Dinas (BOSP)' } },
          { path: 'konfirmasi-dana', component: KonfirmasiDanaComponent, data: { sumberDana: 'BOS', title: 'Dropping Dana BOSP' } },
          { path: 'konfirmasi-drop-dana', component: KonfirmasiDanaComponent, data: { sumberDana: 'BOS', title: 'Dropping Dana BOSP' } },
          { path: 'dinas-konfirmasi-drop-dana', component: KonfirmasiDanaComponent, data: { sumberDana: 'BOS', title: 'Konfirmasi Dropping Dana BOSP' } },
          { path: 'input-bku', component: InputBkuComponent, data: { sumberDana: 'BOS', title: 'Input BKU BOSP' } },
          { path: 'list-bku-bosp', component: InputBkuComponent, data: { sumberDana: 'BOS', title: 'List BKU BOSP' } },
          { path: 'persetujuan-bku', component: PersetujuanBkuComponent, data: { sumberDana: 'BOS', title: 'Persetujuan Berjenjang BOSP' } },
          { path: 'pengajuan-bku', component: PersetujuanBkuComponent, data: { sumberDana: 'BOS', title: 'Pengajuan Pembayaran BKU BOSP' } },
          { path: 'persetujuan-bku-tu', component: PersetujuanBkuComponent, data: { sumberDana: 'BOS', title: 'Persetujuan Pembayaran BKU BOSP (TU)' } },
          { path: 'persetujuan-bku-pa', component: PersetujuanBkuComponent, data: { sumberDana: 'BOS', title: 'Persetujuan Pembayaran BKU BOSP (PA)' } },
          { path: 'pembayaran-bku', component: PembayaranBkuComponent, data: { sumberDana: 'BOS', title: 'Pembayaran BKU BOSP (CMS Bank DKI)' } },
          { path: 'permohonan-token', component: PembayaranBkuComponent, data: { sumberDana: 'BOS', title: 'Permohonan Token PA (BOSP)' } },
          { path: 'pembayaran-pajak', component: PembayaranPajakComponent, data: { sumberDana: 'BOS', title: 'Pembayaran Pajak BKU BOSP' } },
          { path: 'pembayaran-pajak-bku', component: PembayaranPajakComponent, data: { sumberDana: 'BOS', title: 'Pembayaran Pajak BKU BOSP' } },
          { path: 'setoran-sts', component: SetoranStsComponent, data: { sumberDana: 'BOS', title: 'Setoran Sisa Kas / STS (BOSP)' } },
          { path: 'setor-pendapatan-lain2-bos', component: SetoranStsComponent, data: { sumberDana: 'BOS', title: 'Setor Pendapatan Lain-Lain BOSP' } },
          { path: 'cetak-setoran', component: SetoranStsComponent, data: { sumberDana: 'BOS', title: 'Cetak Setor BOSP' } },
          { path: 'persetujuan-setoran', component: SetoranStsComponent, data: { sumberDana: 'BOS', title: 'Persetujuan Setoran BOSP' } },
          { path: 'pengajuan-pendapatan-lain-lain', component: SetoranStsComponent, data: { sumberDana: 'BOS', title: 'Pengajuan dan Persetujuan Pendapatan Lain-Lain' } },
          { path: 'pembayaran-pendapatan-lain-lain', component: SetoranStsComponent, data: { sumberDana: 'BOS', title: 'Pembayaran Pindah Buku BOSP' } },
          { path: 'batal-transfer-spj', component: KoreksiBkuComponent, data: { sumberDana: 'BOS', title: 'Batal Transfer BKU BOSP' } },
          { path: 'persetujuan-koreksi-dinas-bos', component: KoreksiBkuComponent, data: { sumberDana: 'BOS', title: 'Persetujuan Koreksi Periode Sebelum BOSP' } },
          { path: 'input-bku-koreksi', component: KoreksiBkuComponent, data: { sumberDana: 'BOS', title: 'Koreksi Periode Sebelum BOSP' } },
          { path: 'input-bku-koreksi-tahun-lalu', component: KoreksiBkuComponent, data: { sumberDana: 'BOS', title: 'Koreksi Tahun Lalu BOSP' } },
          { path: 'bap-kas-tutup-buku', component: BapKasTutupBukuComponent, data: { sumberDana: 'BOS', title: 'Mutasi Bank DKI, BAP Kas & Tutup Buku (BOS)' } },
          { path: 'bap-kas-bos', component: BapKasTutupBukuComponent, data: { sumberDana: 'BOS', title: 'BAP KAS BOSP' } },
          { path: 'tutup-bku', component: BapKasTutupBukuComponent, data: { sumberDana: 'BOS', title: 'Tutup BKU BOSP' } },
          { path: 'batal-tutup-bku', component: BapKasTutupBukuComponent, data: { sumberDana: 'BOS', title: 'Batal Tutup BKU BOSP' } },
          { path: 'bos-mutasi-12', component: BapKasTutupBukuComponent, data: { sumberDana: 'BOS', title: 'Mutasi 12 Transaksi BOSP' } },
          { path: 'bos-mutasi-semua', component: BapKasTutupBukuComponent, data: { sumberDana: 'BOS', title: 'Mutasi Semua Transaksi BOSP' } },
          { path: 'laporan-bku', component: LaporanBkuComponent, data: { sumberDana: 'BOS', title: 'Laporan BKU BOSP (PDF & Excel)' } },
          { path: 'laporan-BKU', component: LaporanBkuComponent, data: { sumberDana: 'BOS', title: 'Laporan BKU BOSP (PDF & Excel)' } }
        ]
      },

      // 3. BKU BOP NEGERI (30 Sub Menu - mendukug prefix /bku-bop dan /bop-negeri)
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
          { path: 'help-pembayaran-bos', component: HelpdeskLogsComponent, data: { title: 'Help Desk Pembayaran BKU BOSP' } },
          { path: 'help-pembayaran-bop', component: HelpdeskLogsComponent, data: { title: 'Help Desk Pembayaran BKU BOP' } },
          { path: 'help-va-pln', component: HelpdeskLogsComponent, data: { title: 'Help Desk Virtual Account PLN' } },
          { path: 'konversi-rkas', component: KonversiRkasComponent, data: { title: 'Migrasi RKAS' } },
          { path: 'konversi-data', component: KonversiRkasComponent, data: { title: 'Migrasi RKAS' } },
          { path: 'dropping-dana', component: DroppingDanaAdminComponent, data: { title: 'Dropping Dana BOS & BOP' } },
          { path: 'konfirmasi-rekening', component: KonfirmasiRekeningComponent, data: { title: 'Konfirmasi Saldo Rekening' } },
          { path: 'helpdesk', component: HelpdeskLogsComponent, data: { title: 'Help Desk & Audit Log Integrasi' } }
        ]
      },

      // 5. HELP DESK
      {
        path: 'helpdesk',
        children: [
          { path: '', redirectTo: 'tiket-helpdesk', pathMatch: 'full' },
          { path: 'user-manual', component: HelpdeskLogsComponent, data: { title: 'User Manual SIAP BOSP & BOP' } },
          { path: 'tiket-helpdesk', component: HelpdeskLogsComponent, data: { title: 'Help Desk & Tiket Bantuan' } },
          { path: 'video-tutorial', component: HelpdeskLogsComponent, data: { title: 'Video Tutorial SIAP BOSP & BOP' } }
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
