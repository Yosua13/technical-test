import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { BkuTransaction } from '../../core/models/siapbos.models';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-persetujuan-bku',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, SekolahBarComponent, StatusBadgeComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="loadData()" />

    <!-- Role Context Banner -->
    <div class="siap-card px-3 py-2 d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div class="small text-secondary">
        <i class="bi bi-shield-check me-1 text-dark"></i>
        Role Login Aktif: <strong class="text-dark">{{ auth.currentUser()?.roleCode }} ({{ auth.currentUser()?.namaLengkap }})</strong> ·
        Alur: <strong class="text-dark">PK (0→1) → TU (1→2) → PA (2→3) → CMS</strong>
      </div>
      <span class="badge badge-neutral rounded-pill px-3">Sumber Dana: {{ sumberDana() }}</span>
    </div>

    <!-- Pipeline Tabs -->
    <ul class="nav nav-pills mb-3 gap-2">
      @for (tab of tabs; track tab.key) {
        <li class="nav-item">
          <button class="btn btn-sm fw-semibold rounded-pill px-3"
                  [class.btn-dark]="activeTab() === tab.key"
                  [class.btn-neutral]="activeTab() !== tab.key"
                  (click)="activeTab.set(tab.key)">
            {{ tab.label }}
            <span class="badge rounded-pill ms-1"
                  [class.bg-white]="activeTab() === tab.key"
                  [class.text-dark]="activeTab() === tab.key"
                  [class.text-bg-secondary]="activeTab() !== tab.key">
              {{ countByTab(tab.key) }}
            </span>
          </button>
        </li>
      }
    </ul>

    <div class="siap-card">
      <div class="table-responsive">
        <table class="table table-siap table-hover">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>No. BKU</th>
              <th>Uraian Belanja &amp; Rekanan</th>
              <th class="text-end">Bruto</th>
              <th class="text-end">Pajak</th>
              <th class="text-end">Netto</th>
              <th>Status</th>
              <th>Lampiran</th>
              <th class="text-end">Aksi Workflow</th>
            </tr>
          </thead>
          <tbody>
            @if (tabItems().length === 0) {
              <tr>
                <td colspan="9" class="text-center py-4 text-muted">Tidak ada antrian transaksi pada tahap ini.</td>
              </tr>
            }
            @for (b of tabItems(); track b.id) {
              <tr>
                <td>{{ b.tanggalTransaksi | date:'dd/MM/yyyy' }}</td>
                <td class="fw-bold">{{ b.nomorBku }}</td>
                <td>
                  <div class="fw-medium">{{ b.uraian }}</div>
                  <small class="text-muted">{{ b.namaRekanan }} | {{ b.catatanVerifikasi || '-' }}</small>
                </td>
                <td class="text-end tabular-nums">{{ b.nilaiBrutoKeluar | currency:'IDR':'symbol':'1.0-0' }}</td>
                <td class="text-end tabular-nums">{{ b.totalPotonganPajak | currency:'IDR':'symbol':'1.0-0' }}</td>
                <td class="text-end fw-bold tabular-nums">{{ b.nilaiNettoTransfer | currency:'IDR':'symbol':'1.0-0' }}</td>
                <td><app-status-badge kind="bku" [value]="b.statusBku" /></td>
                <td>
                  @if (b.fileLampiranPath) {
                    <a class="btn btn-sm btn-outline-info py-0 px-2" [href]="b.fileLampiranPath" target="_blank">
                      <i class="bi bi-file-pdf me-1"></i>PDF
                    </a>
                  } @else {
                    <span class="text-muted small">-</span>
                  }
                </td>
                <td class="text-end text-nowrap">
                  <div class="d-inline-flex align-items-center gap-1">
                    <button class="btn btn-sm btn-outline-secondary" title="Lihat Detail BKU" (click)="goToDetail(b.id)">
                      <i class="bi bi-eye me-1"></i>Detail
                    </button>
                    @if (b.statusBku === 0 || b.statusBku === 9) {
                      @if (auth.hasRole('PK-NEGERI', 'ADMIN-TDI')) {
                        <button class="btn btn-sm btn-siap rounded-pill px-3" (click)="ajukanPk(b)">
                          <i class="bi bi-send me-1"></i>Ajukan ke TU
                        </button>
                      } @else {
                        <span class="badge bg-light text-secondary border">Menunggu PK</span>
                      }
                    } @else if (b.statusBku === 1) {
                      @if (auth.hasRole('TU-NEGERI', 'ADMIN-TDI')) {
                        <div class="btn-group btn-group-sm">
                          <button class="btn btn-success" (click)="approveTu(b, true)">
                            <i class="bi bi-check-lg me-1"></i>Setujui TU
                          </button>
                          <button class="btn btn-outline-danger" (click)="approveTu(b, false)">Tolak</button>
                        </div>
                      } @else {
                        <span class="badge bg-info-subtle text-info-emphasis border">Menunggu Verifikasi TU</span>
                      }
                    } @else if (b.statusBku === 2) {
                      @if (auth.hasRole('PA-NEGERI', 'ADMIN-TDI')) {
                        <div class="btn-group btn-group-sm">
                          <button class="btn btn-primary" (click)="approvePa(b, true)">
                            <i class="bi bi-check-lg me-1"></i>Setujui PA (Kepsek)
                          </button>
                          <button class="btn btn-outline-danger" (click)="approvePa(b, false)">Tolak</button>
                        </div>
                      } @else {
                        <span class="badge bg-primary-subtle text-primary border">Menunggu Persetujuan PA</span>
                      }
                    } @else if (b.statusBku === 3 && b.needSudinApproval) {
                      @if (auth.hasRole('SUDIN', 'ADMIN-DINAS', 'ADMIN-TDI')) {
                        <div class="btn-group btn-group-sm">
                          <button class="btn btn-warning" (click)="approveSudin(b, true)">Setujui Sudin</button>
                          <button class="btn btn-outline-danger" (click)="approveSudin(b, false)">Tolak</button>
                        </div>
                      } @else {
                        <span class="badge bg-warning-subtle text-dark border">Menunggu Sudin</span>
                      }
                    } @else {
                      <span class="badge bg-success-subtle text-success">Selesai Persetujuan</span>
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
export class PersetujuanBkuComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly sumberDana = signal<'BOS' | 'BOP'>('BOS');
  readonly basePath = computed(() => (this.sumberDana() === 'BOP' ? '/bku-bop' : '/bos-negeri'));
  readonly items = signal<BkuTransaction[]>([]);
  readonly activeTab = signal<'pk' | 'tu' | 'pa' | 'siap' | 'lunas'>('tu');

  readonly tabs: { key: 'pk' | 'tu' | 'pa' | 'siap' | 'lunas'; label: string }[] = [
    { key: 'pk', label: '1. Draft / Ditolak (PK)' },
    { key: 'tu', label: '2. Verifikasi TU' },
    { key: 'pa', label: '3. Approval Kepala Sekolah (PA)' },
    { key: 'siap', label: '4. Disetujui PA (Siap Bayar)' },
    { key: 'lunas', label: '5. Lunas CMS Bank DKI' }
  ];

  readonly tabItems = computed(() => this.filterByTab(this.activeTab()));

  ngOnInit(): void {
    this.sumberDana.set((this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS');
    const tab = this.route.snapshot.data['defaultTab'] as 'pk' | 'tu' | 'pa' | undefined;
    if (tab) {
      this.activeTab.set(tab);
    } else if (this.auth.hasRole('PK-NEGERI')) {
      this.activeTab.set('pk');
    } else if (this.auth.hasRole('PA-NEGERI')) {
      this.activeTab.set('pa');
    }
    this.loadData();
  }

  loadData(): void {
    const sekId = this.auth.selectedSekolahId() || 1;
    this.api.getBkuList(sekId, this.auth.tahunAnggaran(), this.sumberDana(), undefined, 'JJ').subscribe((res) => {
      if (res.success) this.items.set(res.data);
    });
  }

  countByTab(key: string): number {
    return this.filterByTab(key).length;
  }

  private filterByTab(key: string): BkuTransaction[] {
    return this.items().filter((b) => {
      if (key === 'pk') return b.statusBku === 0 || b.statusBku === 9;
      if (key === 'tu') return b.statusBku === 1;
      if (key === 'pa') return b.statusBku === 2;
      if (key === 'siap') return b.statusBku === 3 || b.statusBku === 4;
      return b.statusBku === 5;
    });
  }

  ajukanPk(b: BkuTransaction): void {
    this.api.ajukanPk(this.sumberDana(), b.id).subscribe((res) => {
      if (res.success) { this.toast.success(res.message); this.loadData(); }
    });
  }

  approveTu(b: BkuTransaction, ok: boolean): void {
    const cat = ok ? 'Dokumen & invoice diverifikasi lengkap oleh TU.' : 'Dikembalikan oleh TU untuk revisi dokumen.';
    this.api.approveTu(this.sumberDana(), b.id, ok, cat).subscribe((res) => {
      if (res.success) { this.toast.success(res.message); this.loadData(); }
    });
  }

  approvePa(b: BkuTransaction, ok: boolean): void {
    const cat = ok ? 'Disetujui Kepala Sekolah (PA). Lanjut Permohonan Token CMS.' : 'Ditolak oleh PA.';
    this.api.approvePa(this.sumberDana(), b.id, ok, cat).subscribe((res) => {
      if (res.success) { this.toast.success(res.message); this.loadData(); }
    });
  }

  approveSudin(b: BkuTransaction, ok: boolean): void {
    this.api.approveSudin(this.sumberDana(), b.id, ok, ok ? 'Disetujui Sudin' : 'Ditolak Sudin').subscribe((res) => {
      if (res.success) { this.toast.success(res.message); this.loadData(); }
    });
  }

  goToDetail(id: number): void {
    this.router.navigate([this.basePath(), 'input-bku', 'detail', id]);
  }
}
