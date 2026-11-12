import { Routes } from '@angular/router';
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
  PenggunaMgmtComponent,
  SekolahMgmtComponent
} from './pages/user-management/user-management-pages.component';

export const routes: Routes = [
  { path: '', redirectTo: 'landingpage', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'landingpage', component: LandingPageComponent },
  {
    path: '',
    component: DefaultLayoutComponent,
    canActivate: [authGuard],
    children: [
      // BKU BOSP NEGERI (APBN)
      {
        path: 'bos-negeri',
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          { path: 'dashboard', component: DashboardDanaComponent, data: { sumberDana: 'BOS', title: 'Dashboard BOSP' } },
          { path: 'konfirmasi-dana', component: KonfirmasiDanaComponent, data: { sumberDana: 'BOS', title: 'Konfirmasi Dropping Dana BOSP' } },
          { path: 'input-bku', component: InputBkuComponent, data: { sumberDana: 'BOS', title: 'Input BKU & SPJ BOSP' } },
          { path: 'persetujuan-bku', component: PersetujuanBkuComponent, data: { sumberDana: 'BOS', title: 'Persetujuan Berjenjang BOSP' } },
          { path: 'pembayaran-bku', component: PembayaranBkuComponent, data: { sumberDana: 'BOS', title: 'Token PA & Transfer CMS Bank DKI (BOS)' } },
          { path: 'pembayaran-pajak', component: PembayaranPajakComponent, data: { sumberDana: 'BOS', title: 'Billing & NTPN Pajak MPN (BOS)' } },
          { path: 'setoran-sts', component: SetoranStsComponent, data: { sumberDana: 'BOS', title: 'Setoran Sisa Kas / STS (BOS)' } },
          { path: 'bap-kas-tutup-buku', component: BapKasTutupBukuComponent, data: { sumberDana: 'BOS', title: 'Mutasi Bank DKI, BAP Kas & Tutup Buku (BOS)' } },
          { path: 'laporan-bku', component: LaporanBkuComponent, data: { sumberDana: 'BOS', title: 'Cetak Laporan BOSP (PDF & Excel)' } }
        ]
      },

      // BKU BOP NEGERI (APBD)
      {
        path: 'bop-negeri',
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          { path: 'dashboard', component: DashboardDanaComponent, data: { sumberDana: 'BOP', title: 'Dashboard BOP' } },
          { path: 'npd-bop', component: NpdBopComponent, data: { sumberDana: 'BOP', title: 'NPD BOP & Integrasi SIPKD' } },
          { path: 'konfirmasi-dana', component: KonfirmasiDanaComponent, data: { sumberDana: 'BOP', title: 'Konfirmasi Dropping Dana BOP' } },
          { path: 'input-bku', component: InputBkuComponent, data: { sumberDana: 'BOP', title: 'Input BKU & SPJ BOP' } },
          { path: 'persetujuan-bku', component: PersetujuanBkuComponent, data: { sumberDana: 'BOP', title: 'Persetujuan Berjenjang BOP' } },
          { path: 'pembayaran-bku', component: PembayaranBkuComponent, data: { sumberDana: 'BOP', title: 'Token PA & Transfer CMS Bank DKI (BOP)' } },
          { path: 'pembayaran-pajak', component: PembayaranPajakComponent, data: { sumberDana: 'BOP', title: 'Billing & NTPN Pajak MPN (BOP)' } },
          { path: 'koreksi-bku', component: KoreksiBkuComponent, data: { sumberDana: 'BOP', title: 'Koreksi BKU & Batal Transfer SPJ (BOP)' } },
          { path: 'bap-kas-tutup-buku', component: BapKasTutupBukuComponent, data: { sumberDana: 'BOP', title: 'Mutasi Bank DKI, BAP Kas & Tutup Buku (BOP)' } },
          { path: 'laporan-bku', component: LaporanBkuComponent, data: { sumberDana: 'BOP', title: 'Cetak Laporan BOP K1-K7 (PDF & Excel)' } }
        ]
      },

      // ADMINISTRATOR DINAS & SUDIN
      {
        path: 'administrator',
        children: [
          { path: '', redirectTo: 'dropping-dana', pathMatch: 'full' },
          { path: 'dropping-dana', component: DroppingDanaAdminComponent, data: { title: 'Dropping Dana BOS & BOP' } },
          { path: 'konversi-rkas', component: KonversiRkasComponent, data: { title: 'Konversi & Data RKAS' } },
          { path: 'batas-pengajuan', component: BatasPengajuanComponent, data: { title: 'Batas Pengajuan Periode' } },
          { path: 'helpdesk', component: HelpdeskLogsComponent, data: { title: 'Helpdesk & Live Audit Log Integrasi' } }
        ]
      },

      // USER MANAGEMENT & MASTER
      {
        path: 'user-management',
        children: [
          { path: '', redirectTo: 'pengguna', pathMatch: 'full' },
          { path: 'pengguna', component: PenggunaMgmtComponent, data: { title: 'Manajemen Pengguna & SIMPEG' } },
          { path: 'sekolah', component: SekolahMgmtComponent, data: { title: 'Master Sekolah & Rekening' } },
          { path: 'otoritas', component: OtoritasMgmtComponent, data: { title: 'Master Otoritas & Modul Aplikasi' } }
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
