import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { BkuSummarySaldo, BkuTransaction } from '../../core/models/siapbos.models';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-input-bku',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, SekolahBarComponent, StatusBadgeComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="loadAll()" />

    <!-- 6 Summary Saldo Cards -->
    @if (summary(); as s) {
      <div class="row g-2 mb-3">
        <div class="col-6 col-md-4 col-xl-2">
          <div class="summary-kpi-card" style="--kpi-accent: #64748b;">
            <small class="text-muted fw-semibold d-block">Pagu RKAS</small>
            <strong class="tabular-nums">{{ s.totalPaguRkas | currency:'IDR':'symbol':'1.0-0' }}</strong>
          </div>
        </div>
        <div class="col-6 col-md-4 col-xl-2">
          <div class="summary-kpi-card" style="--kpi-accent: #16a34a;">
            <small class="text-muted fw-semibold d-block">Dana Masuk (JO)</small>
            <strong class="text-success tabular-nums">{{ s.totalDanaMasuk | currency:'IDR':'symbol':'1.0-0' }}</strong>
          </div>
        </div>
        <div class="col-6 col-md-4 col-xl-2">
          <div class="summary-kpi-card" style="--kpi-accent: #2563eb;">
            <small class="text-muted fw-semibold d-block">Belanja SPJ (JJ)</small>
            <strong class="text-primary tabular-nums">{{ s.totalBelanjaSpj | currency:'IDR':'symbol':'1.0-0' }}</strong>
          </div>
        </div>
        <div class="col-6 col-md-4 col-xl-2">
          <div class="summary-kpi-card" style="--kpi-accent: #ff9a00;">
            <small class="text-muted fw-semibold d-block">Sisa Kas Bank</small>
            <strong class="text-warning-emphasis tabular-nums">{{ s.sisaKasBank | currency:'IDR':'symbol':'1.0-0' }}</strong>
          </div>
        </div>
        <div class="col-6 col-md-4 col-xl-2">
          <div class="summary-kpi-card" style="--kpi-accent: #eab308;">
            <small class="text-muted fw-semibold d-block">Pajak Dipungut</small>
            <strong class="tabular-nums">{{ s.totalPajakDipungut | currency:'IDR':'symbol':'1.0-0' }}</strong>
          </div>
        </div>
        <div class="col-6 col-md-4 col-xl-2">
          <div class="summary-kpi-card" style="--kpi-accent: #0d9488;">
            <small class="text-muted fw-semibold d-block">Pajak Lunas NTPN</small>
            <strong class="text-teal tabular-nums">{{ s.totalPajakDisetor | currency:'IDR':'symbol':'1.0-0' }}</strong>
          </div>
        </div>
      </div>
    }

    <!-- BKU Toolbar & Table (Tanpa Aksi Approval) -->
    <div class="siap-card">
      <div class="siap-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div class="d-flex flex-wrap align-items-center gap-2">
          <select class="form-select form-select-sm" style="width: 195px;" [ngModel]="filterTrx()" (ngModelChange)="filterTrx.set($event); loadBku()">
            <option value="">Semua Kode Trx</option>
            <option value="JO">JO &middot; Dropping Masuk</option>
            <option value="JJ">JJ &middot; Belanja SPJ</option>
            <option value="P1">P1 &middot; Pajak PPh 21</option>
            <option value="P2">P2 &middot; Pajak PPh 22</option>
            <option value="P3">P3 &middot; Pajak PPh 23</option>
            <option value="P4">P4 &middot; Pajak PPh 4(2)</option>
            <option value="P5">P5 &middot; Pajak PPN</option>
            <option value="P6">P6 &middot; Pajak PPh 26</option>
            <option value="P7">P7 &middot; Pajak PPh 15</option>
          </select>
          <input type="text" class="form-control form-control-sm" style="width: 240px;"
                 placeholder="Cari No. BKU / Uraian / Rekanan..." [ngModel]="searchText()" (ngModelChange)="searchText.set($event)">
        </div>

        <div class="d-flex flex-wrap gap-2">
          @if (auth.hasRole('PK-NEGERI', 'ADMIN-TDI')) {
            <button class="btn btn-sm btn-siap rounded-pill px-4" (click)="goToTambah()">
              <i class="bi bi-plus-circle me-1"></i>Tambah
            </button>
          }
        </div>
      </div>

      <div class="table-responsive">
        <table class="table table-siap table-hover align-middle">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>No. BKU &amp; Bukti</th>
              <th>Jenis Transaksi</th>
              <th>Uraian &amp; Rekanan</th>
              <th class="text-end">Masuk</th>
              <th class="text-end">Bruto Keluar</th>
              <th class="text-end">Pajak</th>
              <th class="text-end">Netto Transfer</th>
              <th>Status</th>
              <th class="text-end">Aksi</th>
            </tr>
          </thead>
          <tbody>
            @if (filteredBku().length === 0) {
              <tr><td colspan="10" class="text-center py-4 text-muted">Belum ada transaksi BKU untuk kriteria ini.</td></tr>
            }
            @for (b of filteredBku(); track b.id) {
              <tr>
                <td class="text-nowrap">{{ b.tanggalTransaksi | date:'dd/MM/yyyy' }}</td>
                <td>
                  <div class="fw-bold text-dark">{{ b.nomorBku }}</div>
                  <small class="text-muted">{{ b.nomorBukti }}</small>
                  @if (b.parentNomorBku) {
                    <div class="small text-primary"><i class="bi bi-link-45deg"></i>Induk: {{ b.parentNomorBku }}</div>
                  }
                </td>
                <td>
                  <div class="d-flex flex-column gap-1 align-items-start">
                    <div class="d-flex align-items-center gap-1">
                      <app-status-badge kind="trx" [value]="b.kodeTrx" />
                      @if (b.kodeTrx === 'JJ') {
                        @if (b.isVirtualAccount || b.caraPembayaran === 'VA') {
                          <span class="badge text-bg-info">VA</span>
                        } @else {
                          <span class="badge text-bg-secondary">BANK</span>
                        }
                      }
                    </div>
                    <span class="small fw-semibold text-muted">{{ getJenisLabel(b) }}</span>
                  </div>
                </td>
                <td style="min-width: 220px;">
                  <div class="fw-medium">{{ b.uraian }}</div>
                  <small class="text-muted">
                    {{ b.namaRekanan || '-' }}
                    @if (b.noRekRekanan) {
                      ({{ b.namaBankRekanan }} {{ b.noRekRekanan }})
                    }
                  </small>
                </td>
                <td class="text-end text-success fw-semibold tabular-nums">
                  {{ b.nilaiBrutoMasuk > 0 ? (b.nilaiBrutoMasuk | currency:'IDR':'symbol':'1.0-0') : '-' }}
                </td>
                <td class="text-end text-danger fw-semibold tabular-nums">
                  {{ b.nilaiBrutoKeluar > 0 ? (b.nilaiBrutoKeluar | currency:'IDR':'symbol':'1.0-0') : '-' }}
                </td>
                <td class="text-end tabular-nums">
                  {{ b.totalPotonganPajak > 0 ? (b.totalPotonganPajak | currency:'IDR':'symbol':'1.0-0') : '-' }}
                </td>
                <td class="text-end fw-bold tabular-nums">
                  {{ b.nilaiNettoTransfer > 0 ? (b.nilaiNettoTransfer | currency:'IDR':'symbol':'1.0-0') : '-' }}
                </td>
                <td>
                  <app-status-badge kind="bku" [value]="b.statusBku" />
                  @if (b.isTutupBuku) {
                    <span class="badge text-bg-dark ms-1"><i class="bi bi-lock-fill"></i> Tutup Buku</span>
                  }
                </td>
                <td class="text-end text-nowrap">
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-secondary" title="Lihat Detail" (click)="goToDetail(b.id)">
                      <i class="bi bi-eye me-1"></i>Detail
                    </button>
                    @if (b.fileLampiranPath) {
                      <a class="btn btn-outline-info" title="Preview Invoice PDF" [href]="b.fileLampiranPath" target="_blank">
                        <i class="bi bi-file-pdf"></i>
                      </a>
                    }
                    @if (b.kodeTrx === 'JJ') {
                      <a class="btn btn-outline-danger" title="Cetak SPJ PDF" [href]="'/report-server/pdf/spj/' + b.id" target="_blank">
                        <i class="bi bi-printer"></i>
                      </a>
                    }
                    @if (canEditOrDelete(b)) {
                      <button class="btn btn-outline-warning text-dark" title="Edit Draft PK" (click)="goToEdit(b.id)">
                        <i class="bi bi-pencil"></i>
                      </button>
                      <button class="btn btn-outline-danger" title="Hapus Draft PK" (click)="hapusDraft(b)">
                        <i class="bi bi-trash"></i>
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
export class InputBkuComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly sumberDana = signal<'BOS' | 'BOP'>('BOS');
  readonly summary = signal<BkuSummarySaldo | null>(null);
  readonly bkuList = signal<BkuTransaction[]>([]);
  readonly filterTrx = signal('');
  readonly searchText = signal('');

  readonly basePath = computed(() => (this.sumberDana() === 'BOP' ? '/bku-bop' : '/bos-negeri'));

  readonly filteredBku = computed(() => {
    const q = this.searchText().toLowerCase().trim();
    if (!q) return this.bkuList();
    return this.bkuList().filter(
      (b) =>
        b.nomorBku.toLowerCase().includes(q) ||
        b.uraian.toLowerCase().includes(q) ||
        (b.namaRekanan || '').toLowerCase().includes(q) ||
        (b.parentNomorBku || '').toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    const sd = (this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS';
    this.sumberDana.set(sd);
    this.loadAll();
  }

  loadAll(): void {
    const sekId = this.auth.selectedSekolahId() || 1;
    const thn = this.auth.tahunAnggaran();
    const sd = this.sumberDana();
    this.api.getSummarySaldo(sekId, thn, sd).subscribe((r) => {
      if (r.success) this.summary.set(r.data);
    });
    this.loadBku();
  }

  loadBku(): void {
    const sekId = this.auth.selectedSekolahId() || 1;
    this.api.getBkuList(sekId, this.auth.tahunAnggaran(), this.sumberDana(), undefined, this.filterTrx() || undefined).subscribe({
      next: (r) => {
        if (r.success) this.bkuList.set(r.data);
      }
    });
  }

  getJenisLabel(b: BkuTransaction): string {
    if (b.kodeTrx === 'JO') return 'Dropping Dana (JO)';
    if (b.kodeTrx === 'JJ') return 'SPJ Belanja';
    if (b.jenisPembayaran === 'PENGELUARAN') return 'Pengeluaran Pajak';
    if (b.jenisPembayaran === 'PENERIMAAN') return 'Penerimaan Pajak';
    return 'Transaksi Pajak';
  }

  canEditOrDelete(b: BkuTransaction): boolean {
    return (
      this.auth.hasRole('PK-NEGERI', 'ADMIN-TDI') &&
      b.kodeTrx !== 'JO' &&
      (b.statusBku === 0 || b.statusBku === 9) &&
      !b.isTutupBuku
    );
  }

  goToTambah(): void {
    this.router.navigate([this.basePath(), 'input-bku', 'tambah']);
  }

  goToEdit(id: number): void {
    this.router.navigate([this.basePath(), 'input-bku', 'edit', id]);
  }

  goToDetail(id: number): void {
    this.router.navigate([this.basePath(), 'input-bku', 'detail', id]);
  }

  hapusDraft(b: BkuTransaction): void {
    this.api.deleteDraftBku(this.sumberDana(), b.id).subscribe((res) => {
      if (res.success) {
        this.toast.success(res.message);
        this.loadAll();
      }
    });
  }
}
