import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { BapKasReport } from '../../core/models/siapbos.models';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';

@Component({
  selector: 'app-batal-tutup-bku',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, SekolahBarComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="loadData()" />

    <div class="siap-card mb-3">
      <div class="p-4 border-bottom bg-white">
        <div class="border rounded-3 p-3 bg-light mb-3">
          <div class="row g-2 align-items-center mb-2">
            <label class="col-md-2 col-form-label small fw-semibold">Tahun Anggaran</label>
            <div class="col-md-8">
              <input type="text" class="form-control form-control-sm bg-white" [value]="auth.tahunAnggaran()" readonly>
            </div>
          </div>
          <div class="row g-2 align-items-center mb-2">
            <label class="col-md-2 col-form-label small fw-semibold">Sekolah</label>
            <div class="col-md-8">
              <input type="text" class="form-control form-control-sm bg-white"
                     [value]="(auth.activeSekolah()?.npsn || '') + ' / ' + (auth.activeSekolah()?.namaSekolah || '')" readonly>
            </div>
          </div>
          <div class="row g-2 align-items-center mb-2">
            <label class="col-md-2 col-form-label small fw-semibold">Jenis Periode</label>
            <div class="col-md-4">
              <select class="form-select form-select-sm" [(ngModel)]="jenisPeriode" (ngModelChange)="onJenisChange()">
                <option value="TW">Triwulan</option>
                <option value="CW">Caturwulan</option>
                <option value="SM">Semester</option>
                <option value="BL">Bulan</option>
              </select>
            </div>
          </div>
          <div class="row g-2 align-items-center">
            <label class="col-md-2 col-form-label small fw-semibold">Periode</label>
            <div class="col-md-4">
              <select class="form-select form-select-sm" [(ngModel)]="kodePeriode">
                @for (p of waktuOptions(); track p.value) {
                  <option [value]="p.value">{{ p.label }}</option>
                }
              </select>
            </div>
          </div>
        </div>

        <div class="d-flex flex-wrap gap-2">
          <button type="button" class="btn btn-sm btn-primary px-3" (click)="loadData()">
            <i class="bi bi-search me-1"></i>Cari Data Tutup BKU
          </button>
          @if (canBatalTutup()) {
            <button type="button" class="btn btn-sm btn-danger px-4" (click)="prosesBatalTutup(kodePeriode)">
              <i class="bi bi-unlock-fill me-1"></i>Batal Tutup BKU ({{ kodePeriode }})
            </button>
          }
        </div>
      </div>

      <div class="p-0">
        <div class="table-responsive">
          <table class="table table-siap table-hover mb-0">
            <thead>
              <tr>
                <th class="text-center" style="width: 50px;">No</th>
                <th>Nomor BAP Kas</th>
                <th>Periode</th>
                <th>Tanggal Tutup</th>
                <th class="text-end">Saldo BKU</th>
                <th class="text-end">Saldo Bank DKI</th>
                <th>Status Tutup Buku</th>
                <th class="text-end">Aksi</th>
              </tr>
            </thead>
            <tbody>
              @if (bapList().length === 0) {
                <tr><td colspan="8" class="text-center py-4 text-muted">Belum ada data BAP Kas / Tutup BKU pada tahun ini.</td></tr>
              }
              @for (b of bapList(); track b.id; let i = $index) {
                <tr>
                  <td class="text-center">{{ i + 1 }}</td>
                  <td class="fw-bold">{{ b.nomorBap }}</td>
                  <td><span class="badge text-bg-light border">{{ b.kodePeriode }}</span></td>
                  <td>{{ b.tanggalBap | date:'dd/MM/yyyy' }}</td>
                  <td class="text-end tabular-nums">{{ b.saldoBku | currency:'IDR':'symbol':'1.0-0' }}</td>
                  <td class="text-end tabular-nums">{{ b.saldoRekeningKoran | currency:'IDR':'symbol':'1.0-0' }}</td>
                  <td>
                    @if (b.isTutupBuku) {
                      <span class="badge rounded-pill text-bg-success"><i class="bi bi-lock-fill me-1"></i>Sudah Tutup BKU</span>
                    } @else {
                      <span class="badge rounded-pill text-bg-secondary"><i class="bi bi-unlock me-1"></i>Terbuka / Dibuka Kembali</span>
                    }
                  </td>
                  <td class="text-end">
                    @if (b.isTutupBuku && canBatalTutup()) {
                      <button type="button" class="btn btn-sm btn-outline-danger" (click)="prosesBatalTutup(b.kodePeriode)">
                        <i class="bi bi-unlock me-1"></i>Batal Tutup Buku
                      </button>
                    } @else {
                      <span class="text-muted small">-</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class BatalTutupBkuComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly sumberDana = signal<'BOS' | 'BOP'>('BOS');
  readonly bapList = signal<BapKasReport[]>([]);

  jenisPeriode = 'TW';
  kodePeriode = '01';

  readonly waktuOptions = computed(() => {
    if (this.sumberDana() === 'BOP' && this.jenisPeriode === 'TW') {
      return [
        { value: 'TW1', label: 'Triwulan 1 (TW1)' },
        { value: 'TW2', label: 'Triwulan 2 (TW2)' },
        { value: 'TW3', label: 'Triwulan 3 (TW3)' },
        { value: 'TW4', label: 'Triwulan 4 (TW4)' }
      ];
    }
    const max = this.jenisPeriode === 'TW' ? 4 : this.jenisPeriode === 'CW' ? 3 : this.jenisPeriode === 'SM' ? 2 : 12;
    return Array.from({ length: max }, (_, idx) => {
      const k = String(idx + 1).padStart(2, '0');
      return { value: k, label: `Periode Ke - ${idx + 1} (${k})` };
    });
  });

  ngOnInit(): void {
    const sd = (this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS';
    this.sumberDana.set(sd);
    this.kodePeriode = sd === 'BOP' ? 'TW1' : '01';
    this.loadData();
  }

  onJenisChange(): void {
    this.kodePeriode = this.waktuOptions()[0]?.value || '01';
  }

  canBatalTutup(): boolean {
    return this.auth.hasRole('PK-NEGERI', 'PA-NEGERI', 'SUDIN', 'ADMIN-DINAS', 'ADMIN-TDI');
  }

  loadData(): void {
    const sekId = this.auth.selectedSekolahId() || 1;
    this.api.getBapKas(this.sumberDana(), sekId, this.auth.tahunAnggaran()).subscribe((r) => {
      if (r.success) this.bapList.set(r.data || []);
    });
  }

  prosesBatalTutup(periode: string): void {
    this.api
      .batalTutupBuku(this.sumberDana(), this.auth.selectedSekolahId() || 1, this.auth.tahunAnggaran(), periode)
      .subscribe((r) => {
        if (r.success) {
          this.toast.success(r.message);
          this.loadData();
        }
      });
  }
}
