import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { BatalTransferSpj } from '../../core/models/siapbos.models';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-batal-transfer-list',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, SekolahBarComponent, StatusBadgeComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="loadData()" />

    <!-- Header Ringkasan & Counter (Sesuai SIAP BOS Batal Transfer SPJ) -->
    <div class="siap-card p-3 mb-3">
      <div class="row g-3 border rounded-3 p-3 mx-0 bg-light">
        <div class="col-md-6">
          <div class="row g-2 align-items-center mb-2">
            <label class="col-sm-4 col-form-label small fw-semibold">Tahun Anggaran</label>
            <div class="col-sm-8">
              <input type="text" class="form-control form-control-sm bg-white" [value]="auth.tahunAnggaran()" readonly>
            </div>
          </div>
          <div class="row g-2 align-items-center">
            <label class="col-sm-4 col-form-label small fw-semibold">Sekolah</label>
            <div class="col-sm-8">
              <input type="text" class="form-control form-control-sm bg-white"
                     [value]="(auth.activeSekolah()?.npsn || '') + ' - ' + (auth.activeSekolah()?.namaSekolah || '')" readonly>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="d-flex flex-column gap-2 h-100 justify-content-center">
            <div class="d-flex justify-content-between align-items-center px-3 py-2 bg-white rounded border">
              <span class="small fw-semibold text-muted">Jumlah yang Belum Diajukan (Draft PK)</span>
              <span class="badge rounded-pill text-bg-secondary fs-6">{{ countBelumDiajukan() }}</span>
            </div>
            <div class="d-flex justify-content-between align-items-center px-3 py-2 bg-white rounded border">
              <span class="small fw-semibold text-muted">Jumlah yang Sudah Diajukan / Disetujui</span>
              <span class="badge rounded-pill text-bg-success fs-6">{{ countSudahDiajukan() }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Workflow Legend -->
      <div class="mt-3 px-1 small text-muted d-flex flex-wrap justify-content-between align-items-center gap-2">
        <span>
          <i class="bi bi-diagram-3 me-1 text-warning"></i>
          <strong>Alur Persetujuan Bertingkat Batal Transfer SPJ {{ sumberDana() }}:</strong>
          PK (Draft 0 → 1) → TU (1 → 2) → PA / Kepala Sekolah (2 → 3) → Sudin (3 → 4 &amp; Reversal BKU/RKAS)
        </span>
        <span class="badge badge-neutral rounded-pill px-3">Role: {{ auth.currentUser()?.roleCode }}</span>
      </div>
    </div>

    <!-- Filter Toolbar & Tabel Daftar Berita Acara Batal Transfer SPJ -->
    <div class="siap-card">
      <div class="siap-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div class="d-flex flex-wrap align-items-center gap-2">
          <input type="text" class="form-control form-control-sm" style="width: 210px;"
                 placeholder="No. BKU Mohon / No. Berita Acara..." [(ngModel)]="filterNoMohon" (keyup.enter)="loadData()">
          <select class="form-select form-select-sm" style="width: 150px;" [(ngModel)]="filterPeriode">
            <option value="">Semua Periode</option>
            @if (sumberDana() === 'BOP') {
              <option value="TW1">Triwulan 1</option>
              <option value="TW2">Triwulan 2</option>
              <option value="TW3">Triwulan 3</option>
              <option value="TW4">Triwulan 4</option>
            } @else {
              <option value="01">Tahap / Ke - 1</option>
              <option value="02">Tahap / Ke - 2</option>
              <option value="03">Ke - 3</option>
              <option value="04">Ke - 4</option>
            }
          </select>
          <select class="form-select form-select-sm" style="width: 210px;" [(ngModel)]="filterStatus">
            <option [ngValue]="null">Semua Status</option>
            <option [ngValue]="0">0 · Draft PK (Belum Diajukan)</option>
            <option [ngValue]="1">1 · Diajukan ke TU</option>
            <option [ngValue]="2">2 · Disetujui TU → PA</option>
            <option [ngValue]="3">3 · Disetujui PA → Sudin</option>
            <option [ngValue]="4">4 · Disetujui Sudin (Selesai)</option>
            <option [ngValue]="9">9 · Ditolak</option>
          </select>
          <button type="button" class="btn btn-sm btn-success rounded-pill px-3" (click)="loadData()">
            <i class="bi bi-search me-1"></i>Cari
          </button>
        </div>

        <div class="d-flex flex-wrap gap-2">
          @if (auth.hasRole('PK-NEGERI', 'ADMIN-TDI')) {
            <button type="button" class="btn btn-sm btn-siap rounded-pill px-4" (click)="goToTambah()">
              <i class="bi bi-plus-circle me-1"></i>Tambah
            </button>
          }
        </div>
      </div>

      <div class="table-responsive">
        <table class="table table-siap table-hover">
          <thead>
            <tr>
              <th style="width: 45px;">No</th>
              <th>Tanggal Batal</th>
              <th>Nomor Berita Acara</th>
              <th>Nomor BKU Mohon</th>
              <th>Uraian Pembatalan &amp; Pengkoreksi</th>
              <th class="text-end">Nilai SPJ Batal</th>
              <th>Status Approval</th>
              <th class="text-end">Aksi</th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              <tr><td colspan="8" class="text-center py-4 text-muted">Memuat data Batal Transfer SPJ...</td></tr>
            } @else if (items().length === 0) {
              <tr><td colspan="8" class="text-center py-4 text-muted">Belum ada pengajuan Berita Acara Batal Transfer SPJ {{ sumberDana() }}.</td></tr>
            }
            @for (row of items(); track row.id; let idx = $index) {
              <tr>
                <td>{{ idx + 1 }}</td>
                <td class="text-nowrap">{{ row.tanggalPembatalan | date:'dd/MM/yyyy' }}</td>
                <td>
                  <div class="fw-bold text-dark">{{ row.nomorBeritaAcara }}</div>
                  <small class="text-muted">Periode {{ row.jenisPeriode }} {{ row.kodePeriode }}</small>
                </td>
                <td>
                  <div class="fw-bold text-primary">{{ row.nomorBkuMohon }}</div>
                  <small class="text-muted">{{ row.bkuTransaction?.namaRekanan || '-' }}</small>
                </td>
                <td style="min-width: 240px;">
                  <div class="small fw-medium">{{ row.uraianBeritaAcara }}</div>
                  <small class="text-muted">Pengkoreksi: {{ row.namaPengkoreksi }} ({{ row.nrkPengkoreksi }})</small>
                  @if (row.catatanVerifikasi) {
                    <div class="small text-secondary fst-italic">{{ row.catatanVerifikasi }}</div>
                  }
                </td>
                <td class="text-end fw-bold text-danger tabular-nums">{{ row.nilaiSpjBatal | currency:'IDR':'symbol':'1.0-0' }}</td>
                <td>
                  <app-status-badge kind="batal" [value]="row.statusBatal" />
                </td>
                <td class="text-end text-nowrap">
                  <div class="d-inline-flex flex-wrap justify-content-end gap-1">
                    <button class="btn btn-sm btn-outline-secondary" title="Lihat Detail Berita Acara" (click)="goToDetail(row.id)">
                      <i class="bi bi-eye me-1"></i>Detail BA
                    </button>
                    <button class="btn btn-sm btn-outline-info" title="Lihat Detail SPJ BKU" (click)="goToBkuDetail(row.bkuTransactionId)">
                      <i class="bi bi-journal-text me-1"></i>Detail BKU
                    </button>

                    @if (canEditOrDelete(row)) {
                      <button class="btn btn-sm btn-outline-warning text-dark" title="Edit Berita Acara" (click)="goToEdit(row.id)">
                        <i class="bi bi-pencil"></i>
                      </button>
                      <button class="btn btn-sm btn-outline-danger" title="Hapus Draft" (click)="hapus(row)">
                        <i class="bi bi-trash"></i>
                      </button>
                    }

                    <!-- Strict 4-Stage Role-Based Approvals: PK -> TU -> PA -> SUDIN -->
                    @if (row.statusBatal === 0 || row.statusBatal === 9) {
                      @if (auth.hasRole('PK-NEGERI', 'ADMIN-TDI')) {
                        <button class="btn btn-sm btn-siap" (click)="ajukanPk(row)">
                          <i class="bi bi-send me-1"></i>Ajukan ke TU
                        </button>
                      }
                    } @else if (row.statusBatal === 1) {
                      @if (auth.hasRole('TU-NEGERI', 'ADMIN-TDI')) {
                        <div class="btn-group btn-group-sm">
                          <button class="btn btn-success" (click)="approveTu(row, true)">Setujui TU</button>
                          <button class="btn btn-outline-danger" (click)="approveTu(row, false)">Tolak</button>
                        </div>
                      }
                    } @else if (row.statusBatal === 2) {
                      @if (auth.hasRole('PA-NEGERI', 'ADMIN-TDI')) {
                        <div class="btn-group btn-group-sm">
                          <button class="btn btn-primary" (click)="approvePa(row, true)">Setujui PA</button>
                          <button class="btn btn-outline-danger" (click)="approvePa(row, false)">Tolak</button>
                        </div>
                      }
                    } @else if (row.statusBatal === 3) {
                      @if (auth.hasRole('SUDIN', 'ADMIN-DINAS', 'ADMIN-TDI')) {
                        <div class="btn-group btn-group-sm">
                          <button class="btn btn-warning fw-semibold" (click)="approveSudin(row, true)">Setujui Sudin</button>
                          <button class="btn btn-outline-danger" (click)="approveSudin(row, false)">Tolak</button>
                        </div>
                      }
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
export class BatalTransferListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly sumberDana = signal<'BOS' | 'BOP'>('BOS');
  readonly items = signal<BatalTransferSpj[]>([]);
  readonly loading = signal(false);

  filterNoMohon = '';
  filterPeriode = '';
  filterStatus: number | null = null;

  readonly basePath = computed(() => (this.sumberDana() === 'BOP' ? '/bku-bop' : '/bos-negeri'));
  readonly countBelumDiajukan = computed(() => this.items().filter((x) => x.statusBatal === 0 || x.statusBatal === 9).length);
  readonly countSudahDiajukan = computed(() => this.items().filter((x) => x.statusBatal >= 1 && x.statusBatal <= 4).length);

  ngOnInit(): void {
    const sd = (this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS';
    this.sumberDana.set(sd);
    const mode = this.route.snapshot.data['mode'] as string | undefined;
    if (mode === 'approve') {
      if (this.auth.hasRole('TU-NEGERI')) this.filterStatus = 1;
      else if (this.auth.hasRole('PA-NEGERI')) this.filterStatus = 2;
      else if (this.auth.hasRole('SUDIN', 'ADMIN-DINAS')) this.filterStatus = 3;
    }
    this.loadData();
  }

  loadData(): void {
    const sekId = this.auth.selectedSekolahId() || 1;
    this.loading.set(true);
    this.api
      .getBatalTransfers(this.sumberDana(), sekId, this.auth.tahunAnggaran(), {
        kodePeriode: this.filterPeriode || undefined,
        status: this.filterStatus,
        nomorBkuMohon: this.filterNoMohon || undefined
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          if (res.success) this.items.set(res.data || []);
        },
        error: () => this.loading.set(false)
      });
  }

  canEditOrDelete(row: BatalTransferSpj): boolean {
    return this.auth.hasRole('PK-NEGERI', 'ADMIN-TDI') && (row.statusBatal === 0 || row.statusBatal === 9);
  }

  goToTambah(): void {
    this.router.navigate([this.basePath(), 'batal-transfer-spj', 'tambah']);
  }

  goToEdit(id: number): void {
    this.router.navigate([this.basePath(), 'batal-transfer-spj', 'edit', id]);
  }

  goToDetail(id: number): void {
    this.router.navigate([this.basePath(), 'batal-transfer-spj', 'detail', id]);
  }

  goToBkuDetail(bkuId: number): void {
    this.router.navigate([this.basePath(), 'input-bku', 'detail', bkuId]);
  }

  hapus(row: BatalTransferSpj): void {
    this.api.deleteBatalTransfer(this.sumberDana(), row.id).subscribe((res) => {
      if (res.success) {
        this.toast.success(res.message);
        this.loadData();
      }
    });
  }

  ajukanPk(row: BatalTransferSpj): void {
    this.api.ajukanBatalTransferPk(this.sumberDana(), row.id, 'Diajukan ke Verifikator TU.').subscribe((res) => {
      if (res.success) {
        this.toast.success(res.message);
        this.loadData();
      }
    });
  }

  approveTu(row: BatalTransferSpj, ok: boolean): void {
    this.api
      .approveBatalTransferTu(
        this.sumberDana(),
        row.id,
        ok,
        ok ? 'Diverifikasi lengkap oleh TU, diteruskan ke Kepala Sekolah (PA).' : 'Ditolak oleh TU untuk revisi Berita Acara.'
      )
      .subscribe((res) => {
        if (res.success) {
          this.toast.success(res.message);
          this.loadData();
        }
      });
  }

  approvePa(row: BatalTransferSpj, ok: boolean): void {
    this.api
      .approveBatalTransferPa(
        this.sumberDana(),
        row.id,
        ok,
        ok ? 'Disetujui Kepala Sekolah (PA), diteruskan ke Sudin.' : 'Ditolak oleh Kepala Sekolah (PA).'
      )
      .subscribe((res) => {
        if (res.success) {
          this.toast.success(res.message);
          this.loadData();
        }
      });
  }

  approveSudin(row: BatalTransferSpj, ok: boolean): void {
    this.api
      .approveBatalTransferSudin(
        this.sumberDana(),
        row.id,
        ok,
        ok ? 'Disetujui Sudin: SPJ dibatalkan dan saldo dikembalikan.' : 'Ditolak oleh Sudin.'
      )
      .subscribe((res) => {
        if (res.success) {
          this.toast.success(res.message);
          this.loadData();
          this.auth.loadSekolahOptions().subscribe();
        }
      });
  }
}
