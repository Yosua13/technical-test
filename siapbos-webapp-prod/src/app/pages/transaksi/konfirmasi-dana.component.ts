import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { DroppingDana } from '../../core/models/siapbos.models';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-konfirmasi-dana',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, SekolahBarComponent, StatusBadgeComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="loadDropping()" />

    <div class="siap-card">
      <div class="siap-card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div class="d-flex flex-wrap align-items-center gap-2">
          <input class="form-control form-control-sm" style="width: 190px;" [(ngModel)]="filterSearch" placeholder="Cari No SP2D / PASK...">
          <select class="form-select form-select-sm" style="width: auto;" [(ngModel)]="filterPeriode">
            <option value="">Semua Triwulan</option>
            <option value="TW1">Triwulan ke-01 (TW1)</option>
            <option value="TW2">Triwulan ke-02 (TW2)</option>
            <option value="TW3">Triwulan ke-03 (TW3)</option>
            <option value="TW4">Triwulan ke-04 (TW4)</option>
          </select>
          <select class="form-select form-select-sm" style="width: auto;" [(ngModel)]="filterStatus">
            <option [ngValue]="null">Semua Status</option>
            <option [ngValue]="0">Draft PK</option>
            <option [ngValue]="1">Diajukan ke TU</option>
            <option [ngValue]="2">Disetujui TU → PA</option>
            <option [ngValue]="3">Disetujui PA → Dinas/Sudin</option>
            <option [ngValue]="4">Disetujui &amp; Cair BKU</option>
            <option [ngValue]="9">Ditolak</option>
          </select>
          <button class="btn btn-sm btn-success px-3" (click)="loadDropping()">
            <i class="bi bi-search me-1"></i>Cari
          </button>
          @if (auth.hasRole('PK-NEGERI', 'ADMIN-TDI')) {
            <button class="btn btn-sm btn-primary px-3" (click)="goTambah()">
              <i class="bi bi-plus-lg me-1"></i>Tambah
            </button>
          }
        </div>
        <span class="badge badge-neutral rounded-pill px-3">{{ auth.currentUser()?.roleCode }}</span>
      </div>

      <div class="table-responsive">
        <table class="table table-siap table-hover mb-0">
          <thead>
            <tr>
              <th class="text-center" style="width: 48px;">No</th>
              <th>Tanggal</th>
              <th>No. SP2D</th>
              <th>PASK / Sekolah</th>
              <th>Periode</th>
              <th class="text-end">Nilai Dropping</th>
              <th>Status</th>
              <th class="text-end">Aksi</th>
            </tr>
          </thead>
          <tbody>
            @if (items().length === 0) {
              <tr>
                <td colspan="8" class="text-center py-4 text-muted">Belum ada data dropping dana untuk filter terpilih.</td>
              </tr>
            }
            @for (d of items(); track d.id; let idx = $index) {
              <tr>
                <td class="text-center">{{ idx + 1 }}</td>
                <td class="text-nowrap">{{ d.tanggalDropping | date:'dd/MM/yyyy' }}</td>
                <td class="fw-bold text-primary">{{ d.nomorSp2d }}</td>
                <td>
                  <div class="fw-medium">{{ d.namaPask || d.keterangan }}</div>
                  <small class="text-muted">{{ d.sekolah?.namaSekolah || '-' }}</small>
                </td>
                <td><span class="badge bg-light text-dark border">{{ d.kodePeriode }} · {{ d.namaPeriode }}</span></td>
                <td class="text-end fw-bold text-success tabular-nums">{{ d.nilaiDropping | currency:'IDR':'symbol':'1.0-0' }}</td>
                <td><app-status-badge kind="npd" [value]="d.statusDropping" /></td>
                <td class="text-end text-nowrap">
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-secondary" (click)="goDetail(d)">
                      <i class="bi bi-list-ul me-1"></i>Detail
                    </button>
                    @if (d.statusDropping === 0 && auth.hasRole('PK-NEGERI', 'ADMIN-TDI')) {
                      <button class="btn btn-siap" (click)="ajukan(d)">
                        <i class="bi bi-send me-1"></i>Ajukan
                      </button>
                    }
                    @if (d.statusDropping === 1 && auth.hasRole('TU-NEGERI', 'ADMIN-TDI')) {
                      <button class="btn btn-primary" (click)="approveTu(d, true)">
                        <i class="bi bi-check-lg me-1"></i>Setuju TU
                      </button>
                      <button class="btn btn-outline-danger" (click)="approveTu(d, false)">
                        <i class="bi bi-x-lg"></i>
                      </button>
                    }
                    @if (d.statusDropping === 2 && auth.hasRole('PA-NEGERI', 'ADMIN-TDI')) {
                      <button class="btn btn-primary" (click)="approvePa(d, true)">
                        <i class="bi bi-check-lg me-1"></i>Setuju PA
                      </button>
                      <button class="btn btn-outline-danger" (click)="approvePa(d, false)">
                        <i class="bi bi-x-lg"></i>
                      </button>
                    }
                    @if (d.statusDropping === 3 && ((sumberDana() === 'BOS' && auth.hasRole('ADMIN-DINAS', 'ADMIN-TDI')) || (sumberDana() === 'BOP' && auth.hasRole('SUDIN', 'ADMIN-DINAS', 'ADMIN-TDI')))) {
                      <button class="btn btn-success" (click)="approveDinas(d, true)">
                        <i class="bi bi-check2-all me-1"></i>Setuju {{ sumberDana() === 'BOS' ? 'Dinas' : 'Sudin' }}
                      </button>
                      <button class="btn btn-outline-danger" (click)="approveDinas(d, false)">
                        <i class="bi bi-x-lg"></i>
                      </button>
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class KonfirmasiDanaComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly sumberDana = signal<'BOS' | 'BOP'>('BOS');
  readonly items = signal<DroppingDana[]>([]);

  filterPeriode = '';
  filterStatus: number | null = null;
  filterSearch = '';

  ngOnInit(): void {
    this.sumberDana.set((this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS');
    this.loadDropping();
  }

  loadDropping(): void {
    const isMulti = this.auth.hasRole('ADMIN-DINAS', 'SUDIN', 'ADMIN-TDI');
    const sekId = this.auth.selectedSekolahId() || (isMulti ? 0 : 1);
    this.api
      .getDroppingSekolah(sekId, this.auth.tahunAnggaran(), this.sumberDana(), {
        kodePeriode: this.filterPeriode || undefined,
        status: this.filterStatus,
        search: this.filterSearch || undefined
      })
      .subscribe({
        next: (res) => { if (res.success) this.items.set(res.data || []); }
      });
  }

  goTambah(): void {
    this.router.navigate(['tambah'], { relativeTo: this.route });
  }

  goDetail(d: DroppingDana): void {
    this.router.navigate(['detail', d.id], { relativeTo: this.route });
  }

  ajukan(d: DroppingDana): void {
    this.api.ajukanDropping(d.id, this.sumberDana()).subscribe({
      next: (res) => { this.toast.success(res.message); this.loadDropping(); },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal mengajukan Dropping.')
    });
  }

  approveTu(d: DroppingDana, ok: boolean): void {
    this.api.approveDroppingTu(d.id, this.sumberDana(), ok).subscribe({
      next: (res) => { this.toast.success(res.message); this.loadDropping(); },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal approval TU.')
    });
  }

  approvePa(d: DroppingDana, ok: boolean): void {
    this.api.approveDroppingPa(d.id, this.sumberDana(), ok).subscribe({
      next: (res) => { this.toast.success(res.message); this.loadDropping(); },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal approval PA.')
    });
  }

  approveDinas(d: DroppingDana, ok: boolean): void {
    this.api.approveDroppingDinas(d.id, this.sumberDana(), ok).subscribe({
      next: (res) => {
        this.toast.success(res.message);
        this.loadDropping();
        this.auth.loadSekolahOptions().subscribe();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal approval Dinas.')
    });
  }
}
