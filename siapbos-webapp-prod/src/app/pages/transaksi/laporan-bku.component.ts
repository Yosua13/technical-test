import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';

@Component({
  selector: 'app-laporan-bku',
  standalone: true,
  imports: [CommonModule, FormsModule, SekolahBarComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="onSekolahChanged()" />

    <div class="siap-card p-4">
      <div class="row mb-3">
        <div class="col-lg-8">
          <div class="row g-2 align-items-center mb-2">
            <label class="col-sm-3 col-form-label small fw-semibold">Tahun Anggaran</label>
            <div class="col-sm-7">
              <input type="text" class="form-control form-control-sm bg-light" [value]="auth.tahunAnggaran()" readonly>
            </div>
          </div>
          <div class="row g-2 align-items-center mb-2">
            <label class="col-sm-3 col-form-label small fw-semibold">Sekolah</label>
            <div class="col-sm-7">
              <input type="text" class="form-control form-control-sm bg-light"
                     [value]="(auth.activeSekolah()?.npsn || '') + ' - ' + (auth.activeSekolah()?.namaSekolah || '')" readonly>
            </div>
          </div>
          <div class="row g-2 align-items-center mb-2">
            <label class="col-sm-3 col-form-label small fw-semibold">Jenis Laporan</label>
            <div class="col-sm-7">
              <select class="form-select form-select-sm" [(ngModel)]="jenisLaporan" (ngModelChange)="onJenisLaporanChange()">
                <option value="">-- Pilih Jenis Laporan --</option>
                @for (item of jenisLaporanOptions(); track item.value) {
                  <option [value]="item.value">{{ item.name }}</option>
                }
              </select>
            </div>
          </div>

          @if (jenisLaporan) {
            <div class="row g-2 align-items-center mb-3">
              <label class="col-sm-3 col-form-label small fw-semibold">Periode</label>
              <div class="col-sm-4">
                <select class="form-select form-select-sm" [(ngModel)]="jenisPeriode" (ngModelChange)="onJenisPeriodeChange()">
                  <option value="TW">Triwulan</option>
                  <option value="CW">Caturwulan</option>
                  <option value="SM">Semester</option>
                  <option value="BL">Bulan</option>
                </select>
              </div>
              <div class="col-sm-3">
                <select class="form-select form-select-sm" [(ngModel)]="waktuPeriode">
                  @if (jenisPeriode !== 'BL') {
                    <option value="00">Semua Periode</option>
                  }
                  @for (opt of waktuPeriodeOptions(); track opt.value) {
                    <option [value]="opt.value">{{ opt.name }}</option>
                  }
                </select>
              </div>
            </div>
          }

          <div class="row">
            <div class="col-sm-7 offset-sm-3 d-flex flex-wrap gap-2">
              <button type="button" class="btn btn-sm btn-success px-4"
                      [disabled]="!jenisLaporan || !waktuPeriode || loading()"
                      (click)="cariData()">
                @if (loading()) { <span class="spinner-border spinner-border-sm me-1"></span> }
                <i class="bi bi-search me-1"></i>Cari Data
              </button>
              <button type="button" class="btn btn-sm btn-primary px-4"
                      [disabled]="!rawBlobUrl"
                      (click)="downloadPdf()">
                <i class="bi bi-download me-1"></i>Download
              </button>
              <a class="btn btn-sm btn-outline-success ms-auto"
                 [href]="'/report-server/excel/bap-kas?sekolahId=' + (auth.selectedSekolahId() || 1) + '&tahun=' + auth.tahunAnggaran() + '&sumberDana=' + sumberDana() + '&kodePeriode=' + waktuPeriode"
                 target="_blank">
                <i class="bi bi-file-earmark-excel me-1"></i>Unduh Excel BAP Kas
              </a>
            </div>
          </div>
        </div>
      </div>

      <hr>

      @if (loading()) {
        <div class="text-center py-5 text-muted">
          <div class="spinner-border text-warning mb-2"></div>
          <div>Menghasilkan laporan PDF {{ jenisLaporan }} ({{ sumberDana() }})...</div>
        </div>
      } @else if (isPdfShown()) {
        @if (safePdfUrl()) {
          <iframe title="Preview Laporan BKU PDF" [src]="safePdfUrl()!" class="w-100 border rounded" style="min-height: 78vh;"></iframe>
        } @else {
          <div class="text-center py-5 text-muted">PDF Tidak Ditemukan</div>
        }
      } @else {
        <div class="text-center py-5 text-muted small">
          <i class="bi bi-file-earmark-pdf fs-2 d-block mb-2 text-warning"></i>
          Pilih <strong>Jenis Laporan</strong> dan <strong>Periode</strong> di atas, lalu klik <strong>Cari Data</strong> untuk menampilkan preview PDF di halaman ini.
        </div>
      }
    </div>
  `
})
export class LaporanBkuComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly sumberDana = signal<'BOS' | 'BOP'>('BOS');
  readonly loading = signal(false);
  readonly isPdfShown = signal(false);
  readonly safePdfUrl = signal<SafeResourceUrl | null>(null);
  rawBlobUrl: string | null = null;

  jenisLaporan = '';
  jenisPeriode: 'TW' | 'CW' | 'SM' | 'BL' = 'TW';
  waktuPeriode = '00';

  readonly jenisLaporanOptions = computed(() => {
    const label = this.sumberDana() === 'BOP' ? 'BOP' : 'BOS';
    const base = [
      { name: 'Form 22 : BKU (Tutup Buku)', value: 'form22' },
      { name: 'Form 23 : Buku Pembantu Bank', value: 'form23' },
      { name: 'Form 25 : PPH PS 21', value: '25PPh21' },
      { name: 'Form 25 : PPH PS 22', value: '25PPh22' },
      { name: 'Form 25 : PPH PS 23 Jasa I', value: '25PPh23' },
      { name: 'Form 25 : PPH PS 4 Ayat 2', value: '25PPh4' },
      { name: 'Form 25 : PPN', value: '25PPN' },
      { name: 'Form : Pajak (Rekap MPN)', value: 'pajakRekap' },
      { name: 'Form : Laporan Kartu Kendali', value: 'kartuKendaliGiat' },
      { name: `Form : Realisasi Dana ${label}`, value: 'realisasiDanaBos' },
      { name: 'Form : Surat Pernyataan Tanggung Jawab (SPTJ)', value: 'suratPernyataanTanggunggJawab' },
      { name: 'Form : Laporan Monitoring Transfer', value: 'laporanMonitoringTransfer' }
    ];
    if (this.sumberDana() === 'BOP') {
      base.splice(9, 0, { name: 'Form 19 : Realisasi Format K1–K7 (BOP)', value: 'form19-k1k7' });
    }
    return base;
  });

  readonly waktuPeriodeOptions = signal<{ name: string; value: string }[]>([
    { name: 'Ke - 1', value: '01' },
    { name: 'Ke - 2', value: '02' },
    { name: 'Ke - 3', value: '03' },
    { name: 'Ke - 4', value: '04' }
  ]);

  ngOnInit(): void {
    this.sumberDana.set((this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS');
    this.updateWaktuOptions();
  }

  onSekolahChanged(): void {
    if (this.isPdfShown() && this.jenisLaporan) {
      this.cariData();
    }
  }

  onJenisLaporanChange(): void {
    this.revokeBlob();
    this.isPdfShown.set(false);
  }

  onJenisPeriodeChange(): void {
    this.updateWaktuOptions();
    this.waktuPeriode = this.jenisPeriode === 'BL' ? '01' : '00';
  }

  private updateWaktuOptions(): void {
    if (this.jenisPeriode === 'TW') {
      this.waktuPeriodeOptions.set([
        { name: 'Ke - 1', value: '01' },
        { name: 'Ke - 2', value: '02' },
        { name: 'Ke - 3', value: '03' },
        { name: 'Ke - 4', value: '04' }
      ]);
    } else if (this.jenisPeriode === 'CW') {
      this.waktuPeriodeOptions.set([
        { name: 'Ke - 1', value: '01' },
        { name: 'Ke - 2', value: '02' },
        { name: 'Ke - 3', value: '03' }
      ]);
    } else if (this.jenisPeriode === 'SM') {
      this.waktuPeriodeOptions.set([
        { name: 'Ke - 1', value: '01' },
        { name: 'Ke - 2', value: '02' }
      ]);
    } else {
      const bulan = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      this.waktuPeriodeOptions.set(bulan.map((n, i) => ({ name: n, value: String(i + 1).padStart(2, '0') })));
    }
  }

  cariData(): void {
    if (!this.jenisLaporan) {
      this.toast.warning('Silakan pilih Jenis Laporan terlebih dahulu.');
      return;
    }
    this.loading.set(true);
    this.isPdfShown.set(true);
    this.revokeBlob();
    this.api
      .getLaporanPdfBlob({
        sekolahId: this.auth.selectedSekolahId() || 1,
        tahun: this.auth.tahunAnggaran(),
        sumberDana: this.sumberDana(),
        jenisLaporan: this.jenisLaporan,
        jenisPeriode: this.jenisPeriode,
        waktuPeriode: this.waktuPeriode
      })
      .subscribe({
        next: (blob) => {
          this.loading.set(false);
          this.rawBlobUrl = URL.createObjectURL(blob);
          this.safePdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.rawBlobUrl));
        },
        error: () => {
          this.loading.set(false);
          this.toast.error('Gagal menghasilkan PDF laporan.');
        }
      });
  }

  downloadPdf(): void {
    if (!this.rawBlobUrl) return;
    const a = document.createElement('a');
    a.href = this.rawBlobUrl;
    a.download = `Laporan_${this.jenisLaporan}_${this.sumberDana()}_${this.auth.tahunAnggaran()}.pdf`;
    a.click();
  }

  private revokeBlob(): void {
    if (this.rawBlobUrl) {
      URL.revokeObjectURL(this.rawBlobUrl);
      this.rawBlobUrl = null;
      this.safePdfUrl.set(null);
    }
  }

  ngOnDestroy(): void {
    this.revokeBlob();
  }
}
