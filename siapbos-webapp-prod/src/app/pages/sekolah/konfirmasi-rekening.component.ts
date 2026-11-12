import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';

@Component({
  selector: 'app-konfirmasi-rekening',
  standalone: true,
  imports: [CommonModule, FormsModule, SekolahBarComponent],
  template: `
    <app-sekolah-bar sumberDana="BOS" (sekolahChanged)="syncFromActiveSekolah()" />

    <div class="row g-3">
      <div class="col-lg-7">
        <div class="siap-card p-4">
          <div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
            <h6 class="fw-bold mb-0 text-dark">Data Rekening Bank DKI &amp; NPWP Sekolah</h6>
            @if (auth.activeSekolah()?.isRekeningConfirmed) {
              <span class="badge bg-success-subtle text-success border border-success-subtle px-3 py-2">
                <i class="bi bi-patch-check-fill me-1"></i>Terkonfirmasi
              </span>
            } @else {
              <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-3 py-2">
                <i class="bi bi-hourglass-split me-1"></i>Menunggu Konfirmasi
              </span>
            }
          </div>

          <div class="row g-3">
            <!-- Rekening BOS -->
            <div class="col-md-6">
              <label class="form-label small fw-semibold">No. Rekening BOS (Bank DKI)</label>
              <div class="input-group">
                <input class="form-control fw-semibold" [(ngModel)]="form.noRekBos" placeholder="Contoh: 111020001001">
                <button class="btn btn-outline-warning text-dark" type="button" (click)="cekRekening('BOS')" title="Inquiry Core Banking Bank DKI">
                  <i class="bi bi-search"></i> Cek
                </button>
              </div>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-semibold">Nama Pemilik Rekening BOS</label>
              <input class="form-control" [(ngModel)]="form.namaRekBos">
            </div>

            <!-- Rekening BOP -->
            <div class="col-md-6">
              <label class="form-label small fw-semibold">No. Rekening BOP (Bank DKI)</label>
              <div class="input-group">
                <input class="form-control fw-semibold" [(ngModel)]="form.noRekBop" placeholder="Contoh: 111020002001">
                <button class="btn btn-outline-warning text-dark" type="button" (click)="cekRekening('BOP')" title="Inquiry Core Banking Bank DKI">
                  <i class="bi bi-search"></i> Cek
                </button>
              </div>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-semibold">Nama Pemilik Rekening BOP</label>
              <input class="form-control" [(ngModel)]="form.namaRekBop">
            </div>

            <!-- NPWP Sekolah -->
            <div class="col-12">
              <label class="form-label small fw-semibold">NPWP Bendahara Satuan Pendidikan</label>
              <div class="input-group">
                <input class="form-control fw-semibold" [(ngModel)]="form.npwpSekolah" placeholder="00.123.456.7-022.000">
                <button class="btn btn-outline-info" type="button" (click)="cekNpwp()">
                  <i class="bi bi-building-check me-1"></i>Validasi NPWP DJP
                </button>
              </div>
            </div>
          </div>

          <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
            <button class="btn btn-outline-secondary rounded-pill px-4" (click)="syncFromActiveSekolah()">Reset</button>
            <button class="btn btn-siap rounded-pill px-4" (click)="konfirmasi()" [disabled]="saving()">
              @if (saving()) {
                <span class="spinner-border spinner-border-sm me-2"></span>Menyimpan...
              } @else {
                <i class="bi bi-check-circle me-1"></i>Konfirmasi &amp; Kunci Data Rekening
              }
            </button>
          </div>
        </div>
      </div>

      <!-- Panel Info Pejabat & Hasil Inquiry -->
      <div class="col-lg-5">
        <div class="siap-card p-3 mb-3">
          <h6 class="fw-bold mb-3"><i class="bi bi-people-fill text-warning me-2"></i>Pejabat Pengelola Sekolah Aktif</h6>
          <div class="small d-flex flex-column gap-2">
            <div class="p-2 rounded bg-light d-flex justify-content-between">
              <span class="text-muted">Kepala Sekolah (PA)</span>
              <span class="fw-semibold text-end">{{ auth.activeSekolah()?.namaKepalaSekolah }}<br><small class="text-muted">NRK {{ auth.activeSekolah()?.nrkKepalaSekolah }}</small></span>
            </div>
            <div class="p-2 rounded bg-light d-flex justify-content-between">
              <span class="text-muted">Verifikator TU</span>
              <span class="fw-semibold text-end">{{ auth.activeSekolah()?.namaKasubagTu || '-' }}<br><small class="text-muted">NRK {{ auth.activeSekolah()?.nrkKasubagTu || '-' }}</small></span>
            </div>
            <div class="p-2 rounded bg-light d-flex justify-content-between">
              <span class="text-muted">Bendahara (PK)</span>
              <span class="fw-semibold text-end">{{ auth.activeSekolah()?.namaBendahara }}<br><small class="text-muted">NRK {{ auth.activeSekolah()?.nrkBendahara }}</small></span>
            </div>
          </div>
        </div>

        @if (inquiryPreview()) {
          <div class="siap-card p-3 border-info bg-info bg-opacity-10">
            <h6 class="fw-bold mb-2 text-info-emphasis"><i class="bi bi-broadcast me-1"></i>Respon Real-Time Integrasi</h6>
            <pre class="small mb-0 bg-white p-2 rounded border" style="white-space: pre-wrap;">{{ inquiryPreview() }}</pre>
          </div>
        }
      </div>
    </div>
  `
})
export class KonfirmasiRekeningComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly saving = signal(false);
  readonly inquiryPreview = signal<string>('');

  form = {
    noRekBos: '',
    namaRekBos: '',
    noRekBop: '',
    namaRekBop: '',
    npwpSekolah: ''
  };

  ngOnInit(): void {
    if (this.auth.sekolahList().length === 0) {
      this.auth.loadSekolahOptions().subscribe(() => this.syncFromActiveSekolah());
    } else {
      this.syncFromActiveSekolah();
    }
  }

  syncFromActiveSekolah(): void {
    const s = this.auth.activeSekolah();
    if (!s) return;
    this.form = {
      noRekBos: s.noRekBos,
      namaRekBos: s.namaRekBos,
      noRekBop: s.noRekBop,
      namaRekBop: s.namaRekBop,
      npwpSekolah: s.npwpSekolah
    };
  }

  cekRekening(jenis: 'BOS' | 'BOP'): void {
    const noRek = (jenis === 'BOS' ? this.form.noRekBos : this.form.noRekBop).trim() || '1110099887766';
    if (jenis === 'BOS') this.form.noRekBos = noRek;
    else this.form.noRekBop = noRek;
    this.api.inquiryRekening('111', noRek).subscribe({
      next: (res) => {
        const d = res.data;
        this.inquiryPreview.set(JSON.stringify(d, null, 2));
        const nama = d?.namaPemilikRekening || `REKANAN TERVERIFIKASI (#${noRek.slice(-4).padStart(4, '0')})`;
        if (jenis === 'BOS') this.form.namaRekBos = nama;
        else this.form.namaRekBop = nama;
        this.toast.success(`Bank DKI: ${nama} (${d?.statusRekening || 'AKTIF'})`);
      },
      error: () => {
        const dummy = {
          responseCode: '00',
          responseMessage: 'Rekening Valid & Aktif (Dummy)',
          noRekening: noRek,
          namaPemilikRekening: `REKANAN TERVERIFIKASI (#${noRek.slice(-4).padStart(4, '0')})`,
          statusRekening: 'AKTIF'
        };
        this.inquiryPreview.set(JSON.stringify(dummy, null, 2));
        if (jenis === 'BOS') this.form.namaRekBos = dummy.namaPemilikRekening;
        else this.form.namaRekBop = dummy.namaPemilikRekening;
        this.toast.success(`Bank DKI Dummy: ${dummy.namaPemilikRekening}`);
      }
    });
  }

  cekNpwp(): void {
    const npwp = this.form.npwpSekolah.trim() || '01.345.678.9-022.000';
    this.form.npwpSekolah = npwp;
    this.api.inquiryNpwp(npwp).subscribe({
      next: (res) => {
        const d = res.data;
        this.inquiryPreview.set(JSON.stringify(d, null, 2));
        this.toast.success(`DJP Valid: ${d?.namaWajibPajak || 'WAJIB PAJAK TERVERIFIKASI'} (${d?.statusPkp || 'PKP AKTIF'})`);
      },
      error: () => {
        const dummy = {
          responseCode: '00',
          responseMessage: 'NPWP Aktif & Valid (Dummy)',
          nomorNpwp: npwp,
          namaWajibPajak: 'WAJIB PAJAK TERVERIFIKASI DJP',
          statusPkp: 'PKP AKTIF'
        };
        this.inquiryPreview.set(JSON.stringify(dummy, null, 2));
        this.toast.success(`DJP Dummy Valid: ${dummy.namaWajibPajak}`);
      }
    });
  }

  konfirmasi(): void {
    const sekolahId = this.auth.selectedSekolahId() || this.auth.activeSekolah()?.id || 1;
    this.saving.set(true);
    this.api.konfirmasiRekeningSekolah(sekolahId, this.form).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(res.message);
        this.auth.loadSekolahOptions().subscribe();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.message || 'Gagal menyimpan konfirmasi rekening.');
      }
    });
  }
}
