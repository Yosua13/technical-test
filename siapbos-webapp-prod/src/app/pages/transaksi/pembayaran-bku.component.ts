import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { BkuTransaction, VaTransferResponse, normalizeUtcIso, parseUtcTimestampMs } from '../../core/models/siapbos.models';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-pembayaran-bku',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, SekolahBarComponent, StatusBadgeComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="loadData()" />

    <!-- Payment Channel Info -->
    <div class="row g-3 mb-3">
      <div class="col-md-6">
        <div class="siap-card p-3 h-100 border-start border-4 border-primary">
          <div class="fw-bold text-primary mb-1"><i class="bi bi-bank2 me-1"></i>Jalur 1: Transfer Bank (Wajib Token PA 5 Menit)</div>
          <div class="small text-secondary">
            Kepala Sekolah (PA) meminta token 6 digit OTP di menu <strong>Permohonan Token</strong> (berlaku <strong>5 menit</strong>).
            PK kemudian mengeksekusi <strong>Transfer CMS</strong> ke rekening bank rekanan.
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="siap-card p-3 h-100 border-start border-4 border-info">
          <div class="fw-bold text-info-emphasis mb-1"><i class="bi bi-qr-code-scan me-1"></i>Jalur 2: Virtual Account (Tanpa Token PA)</div>
          <div class="small text-secondary">
            SPJ bertipe <strong>Virtual Account</strong> langsung siap dibayar PK setelah disetujui PA tanpa token OTP,
            mengeksekusi 3 tahap API Bank DKI: <strong>1. Biller Inquiry &rarr; 2. Overbook &rarr; 3. Payment</strong>.
          </div>
        </div>
      </div>
    </div>

    <!-- Last Bank Response Alert -->
    @if (lastBankResponse(); as resp) {
      <div class="alert alert-success alert-dismissible fade show shadow-sm mb-3">
        <div class="fw-bold"><i class="bi bi-check-circle-fill me-2"></i>Respon Transfer Bank CMS Bank DKI (bit39: "{{ resp.bit39 }}")</div>
        <div class="small mt-1">
          No. Jurnal Bank: <strong>{{ resp.noJurnalBank }}</strong> |
          Nominal Ditransfer: <strong>{{ resp.nominalDitransfer | currency:'IDR':'symbol':'1.0-0' }}</strong> |
          Sisa Saldo Rekening Sekolah: <strong>{{ resp.sisaSaldoSekolah | currency:'IDR':'symbol':'1.0-0' }}</strong>
        </div>
        <button type="button" class="btn-close" (click)="lastBankResponse.set(null)"></button>
      </div>
    }

    <!-- Last VA 3-Step Trace Alert -->
    @if (lastVaResponse(); as vaResp) {
      <div class="alert alert-info alert-dismissible fade show shadow-sm mb-3">
        <div class="fw-bold mb-1">
          <i class="bi bi-lightning-charge-fill me-1"></i>
          Pembayaran Virtual Account 3-Langkah Selesai (Bit39: "{{ vaResp.bit39 }}")
        </div>
        <div class="small mb-2">
          No. Jurnal: <strong>{{ vaResp.noJurnalBank }}</strong> &middot;
          STAN: <strong>{{ vaResp.stan }}</strong> &middot;
          Kode Reff: <strong>{{ vaResp.kodeReff }}</strong> &middot;
          Nominal: <strong>{{ vaResp.nominalDitransfer | currency:'IDR':'symbol':'1.0-0' }}</strong> &middot;
          Sisa Saldo: <strong>{{ vaResp.sisaSaldoSekolah | currency:'IDR':'symbol':'1.0-0' }}</strong>
        </div>
        <div class="d-flex flex-wrap gap-2">
          @for (st of vaResp.steps; track $index) {
            <div class="badge bg-white text-dark border p-2 text-start">
              <div class="fw-bold text-primary">{{ st.stepName }} ({{ st.responseCode }})</div>
              <div class="text-muted" style="font-size: 0.72rem;">{{ st.endpoint }}</div>
              <div style="font-size: 0.72rem;">{{ st.message }}</div>
            </div>
          }
        </div>
        <button type="button" class="btn-close" (click)="lastVaResponse.set(null)"></button>
      </div>
    }

    <div class="siap-card">
      <div class="siap-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div class="btn-group btn-group-sm" role="group">
          <button type="button" class="btn" [class.btn-siap]="channelTab() === 'ALL'" [class.btn-outline-secondary]="channelTab() !== 'ALL'" (click)="channelTab.set('ALL')">
            Semua SPJ ({{ items().length }})
          </button>
          <button type="button" class="btn" [class.btn-siap]="channelTab() === 'BANK'" [class.btn-outline-secondary]="channelTab() !== 'BANK'" (click)="channelTab.set('BANK')">
            Transfer Bank ({{ bankCount() }})
          </button>
          <button type="button" class="btn" [class.btn-siap]="channelTab() === 'VA'" [class.btn-outline-secondary]="channelTab() !== 'VA'" (click)="channelTab.set('VA')">
            Virtual Account ({{ vaCount() }})
          </button>
        </div>

        <button class="btn btn-sm btn-outline-secondary" (click)="loadData()">
          <i class="bi bi-arrow-clockwise me-1"></i>Refresh
        </button>
      </div>

      <div class="table-responsive">
        <table class="table table-siap table-hover align-middle">
          <thead>
            <tr>
              <th>No. BKU &amp; Tanggal</th>
              <th>Cara Bayar</th>
              <th>Uraian &amp; Rekanan Tujuan</th>
              <th class="text-end">Netto Transfer</th>
              <th>Token OTP / Referensi VA</th>
              <th>Jurnal Bank DKI</th>
              <th>Status</th>
              <th class="text-end">Aksi Pembayaran</th>
            </tr>
          </thead>
          <tbody>
            @if (filteredItems().length === 0) {
              <tr><td colspan="8" class="text-center py-4 text-muted">Tidak ada SPJ untuk kategori pembayaran ini.</td></tr>
            }
            @for (b of filteredItems(); track b.id) {
              <tr>
                <td>
                  <div class="fw-bold">{{ b.nomorBku }}</div>
                  <small class="text-muted">{{ b.tanggalTransaksi | date:'dd MMM yyyy' }}</small>
                </td>
                <td>
                  @if (isVa(b)) {
                    <span class="badge text-bg-info"><i class="bi bi-qr-code me-1"></i>VA (Tanpa Token)</span>
                  } @else {
                    <span class="badge text-bg-secondary"><i class="bi bi-bank me-1"></i>BANK (Token 5m)</span>
                  }
                </td>
                <td>
                  <div class="fw-medium">{{ b.uraian }}</div>
                  <small class="text-muted">
                    {{ b.namaRekanan }} &middot; <strong>{{ b.namaBankRekanan }} {{ b.noRekRekanan }}</strong>
                    @if (b.noVaAtauPesanan) {
                      <span> &middot; VA: {{ b.noVaAtauPesanan }}</span>
                    }
                  </small>
                </td>
                <td class="text-end fw-bold text-primary tabular-nums">{{ b.nilaiNettoTransfer | currency:'IDR':'symbol':'1.0-0' }}</td>
                <td>
                  @if (isVa(b)) {
                    @if (b.stanVa || b.kodeReffVa) {
                      <div class="small font-monospace text-info-emphasis">STAN {{ b.stanVa }}</div>
                      <small class="text-muted">Reff: {{ b.kodeReffVa }}</small>
                    } @else {
                      <span class="badge bg-info-subtle text-info-emphasis border">Siap 3-Step VA</span>
                    }
                  } @else {
                    @if (b.tokenOtpPa) {
                      @if (isTokenActive(b)) {
                        <span class="badge bg-dark text-warning fs-6 font-monospace">{{ b.tokenOtpPa }}</span>
                        <div class="text-success fw-semibold" style="font-size: 0.72rem;">Aktif: {{ remainingText(b) }}</div>
                      } @else {
                        <span class="badge text-bg-danger">Token Kedaluwarsa</span>
                        <div class="text-muted" style="font-size: 0.7rem;">PA harus buat token baru</div>
                      }
                    } @else {
                      <span class="text-muted small">Menunggu Token PA</span>
                    }
                  }
                </td>
                <td>
                  @if (b.noJurnalBank) {
                    <div class="fw-bold text-success small">{{ b.noJurnalBank }}</div>
                    <small class="text-muted">Bit39: {{ b.statusTransferBank }} &middot; {{ normalizeUtc(b.tanggalTransferBank) | date:'dd/MM HH:mm' }}</small>
                  } @else {
                    <span class="text-muted small">-</span>
                  }
                </td>
                <td><app-status-badge kind="bku" [value]="b.statusBku" /></td>
                <td class="text-end text-nowrap">
                  <div class="d-inline-flex align-items-center gap-1">
                    <button class="btn btn-sm btn-outline-secondary" title="Lihat Detail BKU" (click)="goToDetail(b.id)">
                      <i class="bi bi-eye me-1"></i>Detail
                    </button>

                    @if (b.statusBku === 3 || b.statusBku === 4) {
                      @if (isVa(b)) {
                        @if (auth.hasRole('PK-NEGERI', 'ADMIN-TDI')) {
                          <button class="btn btn-sm btn-info text-white fw-semibold"
                                  [disabled]="executingVaId() === b.id"
                                  (click)="executeVaPayment(b)">
                            @if (executingVaId() === b.id) {
                              <span class="spinner-border spinner-border-sm me-1"></span>Proses 3-Step VA...
                            } @else {
                              <i class="bi bi-lightning-fill me-1"></i>Bayar VA
                            }
                          </button>
                        }
                      } @else {
                        @if (auth.hasRole('PK-NEGERI', 'ADMIN-TDI')) {
                          <button class="btn btn-sm btn-siap" [disabled]="!isTokenActive(b)" (click)="openTransferModal(b)">
                            <i class="bi bi-send-check me-1"></i>Transfer Bank
                          </button>
                        }
                        @if (auth.hasRole('PA-NEGERI', 'ADMIN-TDI') && !isTokenActive(b)) {
                          <button class="btn btn-sm btn-outline-primary" (click)="goToPermohonanToken()">
                            <i class="bi bi-key me-1"></i>Minta Token PA
                          </button>
                        }
                      }
                    } @else if (b.statusBku === 5) {
                      <a class="btn btn-sm btn-outline-danger" [href]="'/report-server/pdf/spj/' + b.id" target="_blank">
                        <i class="bi bi-file-earmark-pdf me-1"></i>Cetak SPJ
                      </a>
                    } @else {
                      <span class="text-muted small">Menunggu Persetujuan PA</span>
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Transfer Bank CMS -->
    @if (transferModalBku(); as b) {
      <div class="modal-backdrop-custom">
        <div class="modal-dialog-custom" style="max-width: 480px;">
          <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
            <h6 class="mb-0 fw-bold">Konfirmasi Eksekusi Transfer Bank CMS DKI</h6>
            <button type="button" class="btn-close" (click)="transferModalBku.set(null)"></button>
          </div>
          <div class="modal-body-scroll small">
            <div class="p-3 rounded-3 bg-light border mb-3">
              <div><strong>Penerima:</strong> {{ b.namaRekanan }}</div>
              <div><strong>Rekening:</strong> {{ b.namaBankRekanan }} - {{ b.noRekRekanan }}</div>
              <div class="fs-6 mt-1"><strong>Nominal Transfer Netto:</strong> <span class="text-success fw-bold">{{ b.nilaiNettoTransfer | currency:'IDR':'symbol':'1.0-0' }}</span></div>
            </div>
            <div class="mb-2">
              <label class="form-label fw-bold">Token OTP PA (Aktif {{ remainingText(b) }})</label>
              <input type="text" class="form-control form-control-lg text-center font-monospace fw-bold" [(ngModel)]="otpInput">
            </div>
          </div>
          <div class="p-3 border-top bg-light d-flex justify-content-end gap-2">
            <button class="btn btn-light" (click)="transferModalBku.set(null)">Batal</button>
            <button class="btn btn-siap px-4" (click)="submitTransfer()">Eksekusi Transfer Bank</button>
          </div>
        </div>
      </div>
    }
  `
})
export class PembayaranBkuComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly sumberDana = signal<'BOS' | 'BOP'>('BOS');
  readonly basePath = computed(() => (this.sumberDana() === 'BOP' ? '/bku-bop' : '/bos-negeri'));
  readonly items = signal<BkuTransaction[]>([]);
  readonly channelTab = signal<'ALL' | 'BANK' | 'VA'>('ALL');
  readonly nowTick = signal(Date.now());
  readonly executingVaId = signal<number | null>(null);
  readonly transferModalBku = signal<BkuTransaction | null>(null);
  readonly lastBankResponse = signal<any>(null);
  readonly lastVaResponse = signal<VaTransferResponse | null>(null);

  otpInput = '';
  private timerHandle: any;

  readonly bankCount = computed(() => this.items().filter((x) => !this.isVa(x)).length);
  readonly vaCount = computed(() => this.items().filter((x) => this.isVa(x)).length);
  readonly filteredItems = computed(() => {
    const tab = this.channelTab();
    if (tab === 'BANK') return this.items().filter((x) => !this.isVa(x));
    if (tab === 'VA') return this.items().filter((x) => this.isVa(x));
    return this.items();
  });

  ngOnInit(): void {
    this.sumberDana.set((this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS');
    this.timerHandle = setInterval(() => this.nowTick.set(Date.now()), 1000);
    this.loadData();
  }

  ngOnDestroy(): void {
    if (this.timerHandle) clearInterval(this.timerHandle);
  }

  loadData(): void {
    const sekId = this.auth.selectedSekolahId() || 1;
    this.api.getBkuList(sekId, this.auth.tahunAnggaran(), this.sumberDana(), undefined, 'JJ').subscribe((res) => {
      if (res.success) {
        this.items.set((res.data || []).filter((x) => x.statusBku >= 2 && x.statusBku <= 5));
      }
    });
  }

  isVa(b: BkuTransaction): boolean {
    return Boolean(b.isVirtualAccount) || b.caraPembayaran === 'VA';
  }

  readonly normalizeUtc = normalizeUtcIso;

  isTokenActive(b: BkuTransaction): boolean {
    if (!b.tokenOtpPa || !b.tokenExpiredAt) return false;
    const expMs = parseUtcTimestampMs(b.tokenExpiredAt);
    return Number.isFinite(expMs) && expMs > this.nowTick();
  }

  remainingText(b: BkuTransaction): string {
    if (!b.tokenExpiredAt) return '';
    const expMs = parseUtcTimestampMs(b.tokenExpiredAt);
    if (!Number.isFinite(expMs)) return '';
    const diffSec = Math.max(0, Math.floor((expMs - this.nowTick()) / 1000));
    const mm = String(Math.floor(diffSec / 60)).padStart(2, '0');
    const ss = String(diffSec % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  openTransferModal(b: BkuTransaction): void {
    this.otpInput = b.tokenOtpPa || '';
    this.transferModalBku.set(b);
  }

  submitTransfer(): void {
    const b = this.transferModalBku();
    if (!b) return;
    this.api.transferSpj(this.sumberDana(), b.id, this.otpInput).subscribe({
      next: (res) => {
        if (res.success) {
          this.lastBankResponse.set(res.data);
          this.toast.success(res.message);
          this.transferModalBku.set(null);
          this.loadData();
          this.auth.loadSekolahOptions().subscribe();
        }
      },
      error: (err) => {
        this.toast.error(err?.error?.message || 'Gagal memproses transfer SPJ.');
      }
    });
  }

  executeVaPayment(b: BkuTransaction): void {
    this.executingVaId.set(b.id);
    this.api.vaTransferSpj(this.sumberDana(), b.id).subscribe({
      next: (res) => {
        this.executingVaId.set(null);
        if (res.success) {
          this.lastVaResponse.set(res.data);
          this.toast.success(res.message || 'Pembayaran Virtual Account 3-tahap berhasil.');
          this.loadData();
          this.auth.loadSekolahOptions().subscribe();
        }
      },
      error: (err) => {
        this.executingVaId.set(null);
        this.toast.error(err?.error?.message || 'Gagal mengeksekusi pembayaran Virtual Account.');
      }
    });
  }

  goToPermohonanToken(): void {
    this.router.navigate([this.basePath(), 'permohonan-token']);
  }

  goToDetail(id: number): void {
    this.router.navigate([this.basePath(), 'input-bku', 'detail', id]);
  }
}
