import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
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
}

@Component({
  selector: 'app-pembayaran-pajak',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, SekolahBarComponent, StatusBadgeComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="loadData()" />

    <div class="siap-card p-3 mb-3 bg-info bg-opacity-10 border-info small">
      <i class="bi bi-receipt-cutoff me-1 text-info-emphasis"></i>
      <strong>Alur Integrasi Pajak DJP / MPN G3:</strong>
      <strong>1. Buat Kode Billing (15 digit)</strong> → <strong>2. Inquiry Tagihan MPN</strong> → <strong>3. Bayar Pajak</strong> (menerbitkan <strong>NTPN &amp; NTB</strong> dan memotong saldo rekening sekolah) → <strong>4. Cetak BPN PDF</strong>.
    </div>

    <div class="siap-card">
      <div class="siap-card-header d-flex justify-content-between align-items-center">
        <h6 class="fw-bold mb-0"><i class="bi bi-receipt me-2 text-warning"></i>Daftar Pemungutan &amp; Penyetoran Pajak {{ sumberDana() }}</h6>
        <a class="btn btn-sm btn-outline-danger rounded-pill px-3 fw-semibold"
           [href]="'/report-server/pdf/form25?sekolahId=' + auth.selectedSekolahId() + '&tahun=' + auth.tahunAnggaran() + '&sumberDana=' + sumberDana()"
           target="_blank">
          <i class="bi bi-file-earmark-pdf me-1"></i>Cetak Form 25 Pajak
        </a>
      </div>

      <div class="table-responsive">
        <table class="table table-siap table-hover">
          <thead>
            <tr>
              <th>No. BKU Induk</th>
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
              <tr><td colspan="7" class="text-center py-4 text-muted">Belum ada potongan pajak pada transaksi BKU.</td></tr>
            }
            @for (t of taxRows(); track t.id) {
              <tr>
                <td>
                  <div class="fw-bold">{{ t.bkuNomor }}</div>
                  <small class="text-muted d-block" style="max-width: 220px;">{{ t.bkuUraian }}</small>
                </td>
                <td>
                  <span class="badge text-bg-light border fw-bold me-1">{{ t.kodeTrxPajak }}</span>
                  <span class="fw-semibold">{{ t.namaPajak }}</span>
                  <div class="text-muted small">MAP {{ t.kodeMap }} · KJS {{ t.kodeJenisSetoran }} · Masa {{ t.masaPajak }}/{{ t.tahunPajak }}</div>
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
                    @if (t.statusPajak === 0) {
                      @if (auth.hasRole('PK-NEGERI', 'ADMIN-TDI')) {
                        <button class="btn btn-sm btn-warning fw-semibold" (click)="runAction(t, 'create')">
                          <i class="bi bi-qr-code me-1"></i>Buat Kode Billing
                        </button>
                      } @else {
                        <span class="badge bg-light text-secondary border">Menunggu PK</span>
                      }
                    } @else if (t.statusPajak === 1) {
                      @if (auth.hasRole('PK-NEGERI', 'ADMIN-TDI')) {
                        <div class="btn-group btn-group-sm">
                          <button class="btn btn-outline-info" (click)="runAction(t, 'inquiry')">Inquiry</button>
                          <button class="btn btn-siap" (click)="runAction(t, 'payment')" [disabled]="t.bkuStatus < 3">
                            <i class="bi bi-cash-stack me-1"></i>Bayar NTPN
                          </button>
                          <button class="btn btn-outline-secondary" title="Reset Billing" (click)="runAction(t, 'reset')">
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

  readonly taxRows = computed<TaxRow[]>(() => {
    const rows: TaxRow[] = [];
    for (const b of this.bkus()) {
      for (const t of b.taxItems || []) {
        rows.push({
          ...t,
          bkuId: b.id,
          bkuNomor: b.nomorBku,
          bkuUraian: b.uraian,
          bkuStatus: b.statusBku
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
    this.api.getBkuList(sekId, this.auth.tahunAnggaran(), this.sumberDana(), undefined, 'JJ').subscribe((res) => {
      if (res.success) this.bkus.set(res.data);
    });
  }

  runAction(t: TaxRow, action: 'create' | 'reset' | 'inquiry' | 'payment'): void {
    if (!t.id) return;
    this.api.processTaxAction(this.sumberDana(), t.id, action).subscribe((res) => {
      if (res.success) {
        this.toast.success(res.message);
        this.loadData();
        if (action === 'payment') this.auth.loadSekolahOptions().subscribe();
      }
    });
  }

  goToDetail(bkuId: number): void {
    this.router.navigate([this.basePath(), 'input-bku', 'detail', bkuId]);
  }
}
