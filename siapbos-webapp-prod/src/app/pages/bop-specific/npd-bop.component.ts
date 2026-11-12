import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { NpdBop } from '../../core/models/siapbos.models';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-npd-bop',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, SekolahBarComponent, StatusBadgeComponent],
  template: `
    <app-sekolah-bar sumberDana="BOP" (sekolahChanged)="loadNpd()" />

    <!-- Top Info Box (Matching Reference Screenshot Daftar) -->
    <div class="siap-card p-3 mb-3">
      <div class="row g-2 small">
        <div class="col-md-2 fw-semibold text-muted">Tahun Anggaran</div>
        <div class="col-md-10 fw-bold">{{ auth.tahunAnggaran() }}</div>
        <div class="col-md-2 fw-semibold text-muted">Sekolah</div>
        <div class="col-md-10 fw-bold">
          @if (selectedSekolah(); as sek) {
            {{ sek.npsn }} / {{ sek.namaSekolah }}
          } @else {
            Semua Sekolah (Otoritas Sudin / Dinas)
          }
        </div>
      </div>
    </div>

    <!-- Daftar Permohonan NPD -->
    <div class="siap-card">
      <div class="siap-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div class="d-flex flex-wrap align-items-center gap-2">
          <input class="form-control form-control-sm" style="width: 190px;" [(ngModel)]="filterSearch" placeholder="Cari No NPD / PASK...">
          <select class="form-select form-select-sm" style="width: auto;" [(ngModel)]="filterPeriode">
            <option value="">Semua Periode</option>
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
            <option [ngValue]="3">Disetujui PA → Sudin</option>
            <option [ngValue]="4">Disetujui &amp; Cair SIPKD</option>
            <option [ngValue]="9">Ditolak</option>
          </select>
          <button class="btn btn-sm btn-success px-3" (click)="loadNpd()">
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
              <th>No NPD</th>
              <th>PASK</th>
              <th>Periode</th>
              <th class="text-end">Nilai NPD</th>
              <th>Uraian</th>
              <th>Status</th>
              <th class="text-end">Aksi</th>
            </tr>
          </thead>
          <tbody>
            @if (items().length === 0) {
              <tr>
                <td colspan="9" class="text-center py-4 text-muted">Belum ada permohonan NPD BOP pada filter terpilih.</td>
              </tr>
            }
            @for (n of items(); track n.id; let idx = $index) {
              <tr>
                <td class="text-center">{{ idx + 1 }}</td>
                <td class="text-nowrap">{{ n.tanggalNpd | date:'dd/MM/yyyy' }}</td>
                <td>
                  <div class="fw-bold text-primary">{{ n.nomorNpd }}</div>
                  @if (n.nomorSipkd) {
                    <span class="badge bg-success-subtle text-success border border-success-subtle">{{ n.nomorSipkd }}</span>
                  }
                </td>
                <td>
                  <div class="fw-medium">{{ n.namaPask || '-' }}</div>
                  @if (n.kodeSubgiat) {
                    <small class="text-muted">{{ n.kodeSubgiat }}</small>
                  }
                </td>
                <td class="text-nowrap">
                  <span class="badge text-bg-light border">{{ formatPeriode(n.kodePeriode) }}</span>
                </td>
                <td class="text-end fw-bold tabular-nums">{{ n.nilaiPengajuan | currency:'IDR':'symbol':'1.0-0' }}</td>
                <td>
                  <div>{{ n.uraian }}</div>
                  <small class="text-muted">{{ n.catatan || '' }}</small>
                </td>
                <td><app-status-badge kind="npd" [value]="n.statusNpd" /></td>
                <td class="text-end text-nowrap">
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-secondary" (click)="goDetail(n)" title="Lihat Detail & Rincian PASK">
                      <i class="bi bi-list-ul"></i> Detail
                    </button>
                    @if (n.statusNpd === 0 && auth.hasRole('PK-NEGERI', 'ADMIN-TDI')) {
                      <button class="btn btn-siap" (click)="ajukan(n)" title="Ajukan ke TU">
                        <i class="bi bi-send me-1"></i>Ajukan
                      </button>
                    }
                    @if (n.statusNpd === 1 && auth.hasRole('TU-NEGERI', 'ADMIN-TDI')) {
                      <button class="btn btn-primary" (click)="approveTu(n, true)" title="Setujui TU">
                        <i class="bi bi-check-lg me-1"></i>Setuju TU
                      </button>
                      <button class="btn btn-outline-danger" (click)="approveTu(n, false)" title="Tolak">
                        <i class="bi bi-x-lg"></i>
                      </button>
                    }
                    @if (n.statusNpd === 2 && auth.hasRole('PA-NEGERI', 'ADMIN-TDI')) {
                      <button class="btn btn-primary" (click)="approvePa(n, true)" title="Setujui PA">
                        <i class="bi bi-check-lg me-1"></i>Setuju PA
                      </button>
                      <button class="btn btn-outline-danger" (click)="approvePa(n, false)" title="Tolak">
                        <i class="bi bi-x-lg"></i>
                      </button>
                    }
                    @if (n.statusNpd === 3 && auth.hasRole('SUDIN', 'ADMIN-DINAS', 'ADMIN-TDI')) {
                      <button class="btn btn-success" (click)="approveSudin(n, true)" title="Setujui Sudin & Cairkan via SIPKD">
                        <i class="bi bi-send-check me-1"></i>Setuju Sudin
                      </button>
                      <button class="btn btn-outline-danger" (click)="approveSudin(n, false)" title="Tolak">
                        <i class="bi bi-x-lg"></i>
                      </button>
                    }
                    <button class="btn btn-outline-danger" (click)="downloadPdf(n)" title="Cetak PDF NPD">
                      <i class="bi bi-file-earmark-pdf"></i>
                    </button>
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
export class NpdBopComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly items = signal<NpdBop[]>([]);

  filterPeriode = '';
  filterStatus: number | null = null;
  filterSearch = '';

  selectedSekolah() {
    const id = this.auth.selectedSekolahId();
    return this.auth.sekolahList().find((s) => s.id === id) || null;
  }

  ngOnInit(): void {
    this.loadNpd();
  }

  loadNpd(): void {
    const isMultiSchoolAdmin = this.auth.hasRole('SUDIN', 'ADMIN-DINAS', 'ADMIN-TDI');
    const sekolahId = this.auth.selectedSekolahId() || (isMultiSchoolAdmin ? 0 : 1);
    this.api
      .getNpdBop(sekolahId, this.auth.tahunAnggaran(), {
        kodePeriode: this.filterPeriode || undefined,
        status: this.filterStatus,
        search: this.filterSearch || undefined
      })
      .subscribe({
        next: (res) => this.items.set(res.data || []),
        error: (err) => this.toast.error(err?.error?.message || 'Gagal memuat daftar NPD BOP.')
      });
  }

  formatPeriode(kp: string): string {
    const map: Record<string, string> = {
      TW1: 'Triwulan ke-01',
      TW2: 'Triwulan ke-02',
      TW3: 'Triwulan ke-03',
      TW4: 'Triwulan ke-04'
    };
    return map[kp] || kp;
  }

  goTambah(): void {
    this.router.navigate(['tambah'], { relativeTo: this.route });
  }

  goDetail(n: NpdBop): void {
    this.router.navigate(['detail', n.id], { relativeTo: this.route });
  }

  ajukan(n: NpdBop): void {
    this.api.ajukanNpdBop(n.id).subscribe({
      next: (res) => { this.toast.success(res.message); this.loadNpd(); },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal mengajukan NPD.')
    });
  }

  approveTu(n: NpdBop, disetujui: boolean): void {
    this.api.approveNpdTu(n.id, disetujui).subscribe({
      next: (res) => { this.toast.success(res.message); this.loadNpd(); },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal memproses approval TU.')
    });
  }

  approvePa(n: NpdBop, disetujui: boolean): void {
    this.api.approveNpdPa(n.id, disetujui).subscribe({
      next: (res) => { this.toast.success(res.message); this.loadNpd(); },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal memproses approval PA.')
    });
  }

  approveSudin(n: NpdBop, disetujui: boolean): void {
    this.api.approveNpdSudin(n.id, disetujui).subscribe({
      next: (res) => {
        this.toast.success(res.message);
        this.loadNpd();
        this.auth.loadSekolahOptions().subscribe();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal memproses approval Sudin.')
    });
  }

  downloadPdf(n: NpdBop): void {
    this.api.getNpdPdfBlob(n.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      },
      error: () => this.toast.error('Gagal mencetak PDF NPD.')
    });
  }
}
