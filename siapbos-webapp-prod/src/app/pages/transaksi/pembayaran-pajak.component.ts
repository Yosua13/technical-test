import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { BkuTaxItem, BkuTransaction } from '../../core/models/siapbos.models';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

interface TaxRow extends BkuTaxItem {
  bkuId: number;
  bkuNomor: string;
  bkuUraian: string;
  bkuStatus: number;
  parentNomorBku?: string | null;
}

@Component({
  selector: 'app-pembayaran-pajak',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, SekolahBarComponent, StatusBadgeComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="loadData()" />

    <div class="siap-card p-3 mb-3 bg-info bg-opacity-10 border-info small">
      <i class="bi bi-receipt-cutoff me-1 text-info-emphasis"></i>
      <strong>Alur Penyetoran Pengeluaran Pajak DJP / MPN G3 (2 Tahap):</strong>
      Hanya menampilkan transaksi <strong>Pengeluaran Pajak</strong> yang sudah <strong>Disetujui PA</strong>.
      <strong>1. Proses Billing</strong> (terbitkan 15-digit Kode Billing) &rarr;
      <strong>2. Transfer Pajak</strong> (Inquiry Tagihan + Bayar MPN &rarr; menerbitkan <strong>NTPN &amp; NTB</strong> &amp; menandai Lunas).
    </div>

    <div class="siap-card">
      <div class="siap-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <h6 class="fw-bold mb-0"><i class="bi bi-receipt me-2 text-warning"></i>Daftar Penyetoran Pengeluaran Pajak {{ sumberDana() }}</h6>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary" (click)="loadData()">
            <i class="bi bi-arrow-clockwise me-1"></i>Refresh
          </button>
          <a class="btn btn-sm btn-outline-danger rounded-pill px-3 fw-semibold"
             [href]="'/report-server/pdf/form25?sekolahId=' + auth.selectedSekolahId() + '&tahun=' + auth.tahunAnggaran() + '&sumberDana=' + sumberDana()"
             target="_blank">
            <i class="bi bi-file-earmark-pdf me-1"></i>Cetak Form 25 Pajak
          </a>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table table-siap table-hover align-middle">
          <thead>
            <tr>
              <th>No. BKU Pengeluaran Pajak</th>
              <th>Jenis Pajak &amp; MAP</th>
              <th class="text-end">Nilai Pajak</th>
              <th>Kode Billing DJP</th>
              <th>NTPN &amp; NTB</th>
              <th>Status</th>
              <th class="text-end">Aksi MPN G3</th>
            </tr>
          </thead>
          <tbody>
            @if (taxRows().length === 0) {
              <tr>
                <td colspan="7" class="text-center py-4 text-muted">
                  Belum ada transaksi <strong>Pengeluaran Pajak</strong> yang disetujui Kepala Sekolah (PA).
                </td>
              </tr>
            }
            @for (t of taxRows(); track t.id) {
              <tr>
                <td>
                  <div class="fw-bold">{{ t.bkuNomor }}</div>
                  <small class="text-muted d-block" style="max-width: 240px;">{{ t.bkuUraian }}</small>
                  @if (t.parentNomorBku) {
                    <small class="text-primary d-block">Induk Penerimaan: {{ t.parentNomorBku }}</small>
                  }
                </td>
                <td>
                  <span class="badge text-bg-light border fw-bold me-1">{{ t.kodeTrxPajak }}</span>
                  <span class="fw-semibold">{{ t.namaPajak }}</span>
                  <div class="text-muted small">MAP {{ t.kodeMap }} &middot; KJS {{ t.kodeJenisSetoran }} &middot; Masa {{ t.masaPajak }}/{{ t.tahunPajak }}</div>
                </td>
                <td class="text-end fw-bold tabular-nums">{{ t.nilaiPajak | currency:'IDR':'symbol':'1.0-0' }}</td>
                <td>
                  @if (t.kodeBilling) {
                    <span class="font-monospace fw-bold text-primary">{{ t.kodeBilling }}</span>
                    <div class="text-muted" style="font-size: 0.72rem;">Exp: {{ t.billingExpiredAt | date:'dd/MM/yy' }}</div>
                  } @else {
                    <span class="text-muted small">-</span>
                  }
                </td>
                <td>
                  @if (t.ntpn) {
                    <div class="font-monospace fw-bold text-success">{{ t.ntpn }}</div>
                    <small class="text-muted">NTB: {{ t.ntb }}</small>
                  } @else {
                    <span class="text-muted small">-</span>
                  }
                </td>
                <td><app-status-badge kind="tax" [value]="t.statusPajak ?? 0" /></td>
                <td class="text-end text-nowrap">
                  <div class="d-inline-flex align-items-center gap-1">
                    <button class="btn btn-sm btn-outline-secondary" title="Lihat Detail BKU" (click)="goToDetail(t.bkuId)">
                      <i class="bi bi-eye me-1"></i>Detail
                    </button>

                    @if ((t.statusPajak ?? 0) === 0) {
                      @if (auth.hasRole('PK-NEGERI', 'ADMIN-TDI')) {
                        <button class="btn btn-sm btn-warning fw-semibold"
                                [disabled]="processingId() === t.id"
                                (click)="prosesBilling(t)">
                          <i class="bi bi-qr-code me-1"></i>1. Proses Billing
                        </button>
                      } @else {
                        <span class="badge bg-light text-secondary border">Menunggu PK</span>
                      }
                    } @else if ((t.statusPajak ?? 0) === 1) {
                      @if (auth.hasRole('PK-NEGERI', 'ADMIN-TDI')) {
                        <div class="btn-group btn-group-sm">
                          <button class="btn btn-siap fw-semibold"
                                  [disabled]="processingId() === t.id"
                                  (click)="transferPajak(t)">
                            @if (processingId() === t.id) {
                              <span class="spinner-border spinner-border-sm me-1"></span>Transfer...
                            } @else {
                              <i class="bi bi-cash-stack me-1"></i>2. Transfer Pajak
                            }
                          </button>
                          <button class="btn btn-outline-secondary" title="Reset Kode Billing"
                                  [disabled]="processingId() === t.id"
                                  (click)="resetBilling(t)">
                            <i class="bi bi-arrow-counterclockwise"></i>
                          </button>
                        </div>
                      } @else {
                        <span class="badge bg-warning-subtle text-dark border">Billing Aktif (PK)</span>
                      }
                    } @else {
                      <a class="btn btn-sm btn-outline-success fw-semibold" [href]="'/report-server/pdf/bpn/' + t.id" target="_blank">
                        <i class="bi bi-file-earmark-check me-1"></i>Cetak BPN Pajak
                      </a>
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
export class PembayaranPajakComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly sumberDana = signal<'BOS' | 'BOP'>('BOS');
  readonly basePath = computed(() => (this.sumberDana() === 'BOP' ? '/bku-bop' : '/bos-negeri'));
  readonly bkus = signal<BkuTransaction[]>([]);
  readonly processingId = signal<number | null>(null);

  readonly taxRows = computed<TaxRow[]>(() => {
    const rows: TaxRow[] = [];
    for (const b of this.bkus()) {
      if (b.jenisPembayaran !== 'PENGELUARAN' || b.statusBku < 3 || b.statusBku === 9) {
        continue;
      }
      for (const t of b.taxItems || []) {
        rows.push({
          ...t,
          bkuId: b.id,
          bkuNomor: b.nomorBku,
          bkuUraian: b.uraian,
          bkuStatus: b.statusBku,
          parentNomorBku: b.parentNomorBku
        });
      }
    }
    return rows;
  });

  ngOnInit(): void {
    this.sumberDana.set((this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS');
    this.loadData();
  }

  loadData(): void {
    const sekId = this.auth.selectedSekolahId() || 1;
    this.api.getBkuList(sekId, this.auth.tahunAnggaran(), this.sumberDana()).subscribe((res) => {
      if (res.success) this.bkus.set(res.data || []);
    });
  }

  prosesBilling(t: TaxRow): void {
    if (!t.id) return;
    this.processingId.set(t.id);
    this.api.processTaxAction(this.sumberDana(), t.id, 'create').subscribe({
      next: (res) => {
        this.processingId.set(null);
        if (res.success) {
          this.toast.success(res.message || 'Kode Billing DJP berhasil dibuat.');
          this.loadData();
        }
      },
      error: (err) => {
        this.processingId.set(null);
        this.toast.error(err?.error?.message || 'Gagal membuat Kode Billing.');
      }
    });
  }

  transferPajak(t: TaxRow): void {
    if (!t.id) return;
    const taxId = t.id;
    const sd = this.sumberDana();
    this.processingId.set(taxId);
    this.api
      .processTaxAction(sd, taxId, 'inquiry')
      .pipe(switchMap(() => this.api.processTaxAction(sd, taxId, 'payment')))
      .subscribe({
        next: (res) => {
          this.processingId.set(null);
          if (res.success) {
            this.toast.success(res.message || 'Transfer Pajak MPN G3 berhasil & NTPN diterbitkan.');
            this.loadData();
            this.auth.loadSekolahOptions().subscribe();
          }
        },
        error: (err) => {
          this.processingId.set(null);
          this.toast.error(err?.error?.message || 'Gagal memproses Transfer Pajak MPN.');
        }
      });
  }

  resetBilling(t: TaxRow): void {
    if (!t.id) return;
    this.processingId.set(t.id);
    this.api.processTaxAction(this.sumberDana(), t.id, 'reset').subscribe({
      next: (res) => {
        this.processingId.set(null);
        if (res.success) {
          this.toast.success(res.message || 'Kode Billing di-reset.');
          this.loadData();
        }
      },
      error: (err) => {
        this.processingId.set(null);
        this.toast.error(err?.error?.message || 'Gagal reset Kode Billing.');
      }
    });
  }

  goToDetail(bkuId: number): void {
    this.router.navigate([this.basePath(), 'input-bku', 'detail', bkuId]);
  }
}
