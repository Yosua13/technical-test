import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { BankMutation } from '../../core/models/siapbos.models';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';

@Component({
  selector: 'app-mutasi-semua',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, SekolahBarComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="onSekolahChanged()" />

    <div class="siap-card p-4">
      <div class="row g-3 mb-3">
        <div class="col-md-6">
          <div class="row g-2 align-items-center mb-2">
            <label class="col-sm-4 col-form-label small fw-semibold">NPSN / Sekolah</label>
            <div class="col-sm-8">
              <input type="text" class="form-control form-control-sm bg-light"
                     [value]="(auth.activeSekolah()?.npsn || '') + ' - ' + (auth.activeSekolah()?.namaSekolah || '')" readonly>
            </div>
          </div>
          <div class="row g-2 align-items-center mb-2">
            <label class="col-sm-4 col-form-label small fw-semibold">Nomor Rekening</label>
            <div class="col-sm-8">
              <input type="text" class="form-control form-control-sm bg-light fw-semibold"
                     [value]="sumberDana() === 'BOP' ? auth.activeSekolah()?.noRekBop : auth.activeSekolah()?.noRekBos" readonly>
            </div>
          </div>
          <div class="row g-2 align-items-center mb-2">
            <label class="col-sm-4 col-form-label small fw-semibold">Nama Rekening</label>
            <div class="col-sm-8">
              <input type="text" class="form-control form-control-sm bg-light"
                     [value]="sumberDana() === 'BOP' ? (auth.activeSekolah()?.namaRekBop || auth.activeSekolah()?.namaSekolah) : (auth.activeSekolah()?.namaRekBos || auth.activeSekolah()?.namaSekolah)" readonly>
            </div>
          </div>
          <div class="row g-2 align-items-center mb-2">
            <label class="col-sm-4 col-form-label small fw-semibold">Tanggal Awal</label>
            <div class="col-sm-8">
              <div class="input-group input-group-sm">
                <input type="date" class="form-control" [(ngModel)]="tanggalAwal">
                @if (tanggalAwal) {
                  <button type="button" class="btn btn-outline-secondary" (click)="tanggalAwal = ''">Reset</button>
                }
              </div>
            </div>
          </div>
          <div class="row g-2 align-items-center mb-2">
            <label class="col-sm-4 col-form-label small fw-semibold">Tanggal Akhir</label>
            <div class="col-sm-8">
              <div class="input-group input-group-sm">
                <input type="date" class="form-control" [(ngModel)]="tanggalAkhir">
                @if (tanggalAkhir) {
                  <button type="button" class="btn btn-outline-secondary" (click)="tanggalAkhir = ''">Reset</button>
                }
              </div>
            </div>
          </div>
          <div class="row g-2 align-items-center">
            <label class="col-sm-4 col-form-label small fw-semibold">Saldo Akhir</label>
            <div class="col-sm-8">
              <input type="text" class="form-control form-control-sm bg-light text-end fw-bold text-success"
                     [value]="((sumberDana() === 'BOP' ? auth.activeSekolah()?.saldoBop : auth.activeSekolah()?.saldoBos) || 0) | currency:'IDR':'symbol':'1.0-0'" readonly>
            </div>
          </div>
        </div>
      </div>

      <div class="d-flex flex-wrap gap-2 pb-3 border-bottom mb-3">
        <button type="button" class="btn btn-sm btn-success px-4" (click)="tampil()">
          <i class="bi bi-table me-1"></i>Tampil
        </button>
        <button type="button" class="btn btn-sm btn-primary px-4" (click)="cetak()">
          <i class="bi bi-printer me-1"></i>Cetak
        </button>
        @if (activeTab() === 'cetak' && rawBlobUrl) {
          <button type="button" class="btn btn-sm btn-outline-primary ms-auto px-3" (click)="downloadPdf()">
            <i class="bi bi-download me-1"></i>Unduh PDF
          </button>
        }
      </div>

      @if (loading()) {
        <div class="text-center py-4 text-muted">Memuat mutasi Bank DKI...</div>
      } @else if (activeTab() === 'tampil') {
        <div class="table-responsive">
          <table class="table table-sm table-bordered table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th class="text-center" style="width: 50px;">No.</th>
                <th class="text-center">Tanggal Transaksi</th>
                <th class="text-center">Jam Transaksi</th>
                <th>Nomor Referensi</th>
                <th>Keterangan</th>
                <th class="text-end">Nilai Terima</th>
                <th class="text-end">Nilai Keluar</th>
                <th class="text-end">Saldo Akhir</th>
              </tr>
            </thead>
            <tbody>
              @if (filteredMutations().length === 0) {
                <tr><td colspan="8" class="text-center py-4 text-muted">Tidak ada data mutasi pada rentang tanggal yang dipilih.</td></tr>
              }
              @for (m of filteredMutations(); track m.id; let i = $index) {
                <tr>
                  <td class="text-center">{{ i + 1 }}</td>
                  <td class="text-center text-nowrap">{{ m.tanggalTransaksi | date:'dd/MM/yyyy' }}</td>
                  <td class="text-center text-nowrap">{{ m.tanggalTransaksi | date:'HH:mm:ss' }}</td>
                  <td class="font-monospace small">{{ m.nomorReferensi }}</td>
                  <td>{{ m.uraian }}</td>
                  <td class="text-end text-success fw-semibold tabular-nums">
                    {{ (m.tipeMutasi === 'K' ? m.nominal : 0) | currency:'IDR':'symbol':'1.0-0' }}
                  </td>
                  <td class="text-end text-danger fw-semibold tabular-nums">
                    {{ (m.tipeMutasi === 'D' ? m.nominal : 0) | currency:'IDR':'symbol':'1.0-0' }}
                  </td>
                  <td class="text-end fw-bold tabular-nums">{{ m.saldoAkhir | currency:'IDR':'symbol':'1.0-0' }}</td>
                </tr>
              }
              @if (filteredMutations().length > 0) {
                <tr class="table-light fw-bold">
                  <td colspan="5" class="text-end">Total</td>
                  <td class="text-end text-success tabular-nums">{{ totalTerima() | currency:'IDR':'symbol':'1.0-0' }}</td>
                  <td class="text-end text-danger tabular-nums">{{ totalKeluar() | currency:'IDR':'symbol':'1.0-0' }}</td>
                  <td></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        @if (safePdfUrl()) {
          <iframe title="Preview Cetak Mutasi Semua" [src]="safePdfUrl()!" class="w-100 border rounded" style="min-height: 75vh;"></iframe>
        } @else {
          <div class="text-center py-4 text-muted">PDF Tidak Ditemukan</div>
        }
      }
    </div>
  `
})
export class MutasiSemuaComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly sumberDana = signal<'BOS' | 'BOP'>('BOS');
  readonly activeTab = signal<'tampil' | 'cetak'>('tampil');
  readonly loading = signal(false);
  readonly mutations = signal<BankMutation[]>([]);
  readonly safePdfUrl = signal<SafeResourceUrl | null>(null);
  rawBlobUrl: string | null = null;

  tanggalAwal = '';
  tanggalAkhir = '';

  readonly filteredMutations = computed(() => {
    return this.mutations().filter((m) => {
      const dateStr = (m.tanggalTransaksi || '').slice(0, 10);
      if (this.tanggalAwal && dateStr < this.tanggalAwal) return false;
      if (this.tanggalAkhir && dateStr > this.tanggalAkhir) return false;
      return true;
    });
  });

  readonly totalTerima = computed(() =>
    this.filteredMutations().filter((m) => m.tipeMutasi === 'K').reduce((a, b) => a + b.nominal, 0)
  );
  readonly totalKeluar = computed(() =>
    this.filteredMutations().filter((m) => m.tipeMutasi === 'D').reduce((a, b) => a + b.nominal, 0)
  );

  ngOnInit(): void {
    const sd = (this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS';
    this.sumberDana.set(sd);
    this.tampil();
  }

  onSekolahChanged(): void {
    if (this.activeTab() === 'cetak') this.cetak();
    else this.tampil();
  }

  tampil(): void {
    this.activeTab.set('tampil');
    this.loading.set(true);
    this.api.getMutasi(this.sumberDana(), this.auth.selectedSekolahId() || 1, false).subscribe({
      next: (r) => {
        this.loading.set(false);
        if (r.success) this.mutations.set(r.data || []);
      },
      error: () => this.loading.set(false)
    });
  }

  cetak(): void {
    this.activeTab.set('cetak');
    this.loading.set(true);
    this.revokeBlob();
    this.api
      .getMutasiPdfBlob({
        sekolahId: this.auth.selectedSekolahId() || 1,
        sumberDana: this.sumberDana(),
        limit12: false,
        startDate: this.tanggalAwal || undefined,
        endDate: this.tanggalAkhir || undefined
      })
      .subscribe({
        next: (blob) => {
          this.loading.set(false);
          this.rawBlobUrl = URL.createObjectURL(blob);
          this.safePdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.rawBlobUrl));
        },
        error: () => this.loading.set(false)
      });
  }

  downloadPdf(): void {
    if (!this.rawBlobUrl) return;
    const a = document.createElement('a');
    a.href = this.rawBlobUrl;
    a.download = `Mutasi_Semua_${this.sumberDana()}.pdf`;
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
