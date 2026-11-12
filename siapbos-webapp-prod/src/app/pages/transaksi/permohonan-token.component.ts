import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { BkuTransaction, normalizeUtcIso, parseUtcTimestampMs } from '../../core/models/siapbos.models';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-permohonan-token',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, SekolahBarComponent, StatusBadgeComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="loadData()" />

    <div class="siap-card p-3 mb-3 border-start border-4 border-warning">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h6 class="fw-bold mb-1">
            <i class="bi bi-key-fill text-warning me-2"></i>
            Permohonan Token OTP CMS Bank DKI (Khusus PA · Masa Aktif 5 Menit)
          </h6>
          <div class="small text-secondary">
            Daftar di bawah hanya menampilkan transaksi <strong>SPJ (JJ) Cara Pembayaran BANK</strong> yang sudah disetujui Kepala Sekolah (PA).
            Transaksi <strong>Virtual Account</strong> dibayarkan langsung di menu Pembayaran BKU tanpa token.
          </div>
        </div>
        <div class="d-flex align-items-center gap-2">
          <div class="input-group input-group-sm" style="width: 220px;">
            <span class="input-group-text bg-white">NRK PA</span>
            <input class="form-control" [(ngModel)]="nrkPa" placeholder="NRK Kepala Sekolah" />
          </div>
          <button class="btn btn-sm btn-outline-dark" (click)="loadData()">
            <i class="bi bi-arrow-clockwise me-1"></i>Refresh
          </button>
        </div>
      </div>
    </div>

    <div class="siap-card">
      <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center border-0">
        <span class="fw-bold">
          <i class="bi bi-bank me-2 text-primary"></i>Antrian Permohonan Token SPJ Bank ({{ bankSpjList().length }})
        </span>
        <span class="badge bg-light text-dark border">TTL Token: 5 Menit · API /api/bank-dki/createToken</span>
      </div>
      <div class="table-responsive">
        <table class="table table-siap table-hover align-middle">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>No. BKU &amp; Bukti</th>
              <th>Uraian Belanja</th>
              <th>Rekening Bank Rekanan</th>
              <th class="text-end">Netto Transfer</th>
              <th>Status BKU</th>
              <th>Token OTP PA (5 Menit)</th>
              <th class="text-end">Aksi PA</th>
            </tr>
          </thead>
          <tbody>
            @if (bankSpjList().length === 0) {
              <tr>
                <td colspan="8" class="text-center py-4 text-muted">
                  Tidak ada transaksi SPJ via BANK yang berstatus Disetujui PA / Menunggu Token saat ini.
                </td>
              </tr>
            }
            @for (b of bankSpjList(); track b.id) {
              <tr>
                <td>{{ b.tanggalTransaksi | date:'dd/MM/yyyy' }}</td>
                <td>
                  <div class="fw-bold">{{ b.nomorBku }}</div>
                  <small class="text-muted">{{ b.nomorBukti }}</small>
                </td>
                <td>
                  <div class="fw-medium">{{ b.uraian }}</div>
                  <small class="text-muted">Pajak: {{ b.totalPotonganPajak | currency:'IDR':'symbol':'1.0-0' }}</small>
                </td>
                <td>
                  <div class="fw-medium">{{ b.namaRekanan }}</div>
                  <small class="text-muted">{{ b.namaBankRekanan }} · {{ b.noRekRekanan }}</small>
                </td>
                <td class="text-end fw-bold tabular-nums">{{ b.nilaiNettoTransfer | currency:'IDR':'symbol':'1.0-0' }}</td>
                <td><app-status-badge kind="bku" [value]="b.statusBku" /></td>
                <td>
                  @if (b.tokenOtpPa) {
                    @if (isTokenActive(b)) {
                      <div class="d-flex align-items-center gap-2">
                        <span class="badge text-bg-dark fs-6 font-monospace px-2">{{ b.tokenOtpPa }}</span>
                        <span class="badge text-bg-success">
                          <i class="bi bi-stopwatch me-1"></i>{{ remainingText(b) }}
                        </span>
                      </div>
                      <small class="text-muted d-block">Exp: {{ normalizeUtc(b.tokenExpiredAt) | date:'HH:mm:ss' }}</small>
                    } @else {
                      <span class="badge text-bg-danger">Token Kedaluwarsa</span>
                      <small class="text-muted d-block">Silakan Request Ulang</small>
                    }
                  } @else {
                    <span class="text-muted small">Belum ada token</span>
                  }
                </td>
                <td class="text-end text-nowrap">
                  <div class="d-inline-flex align-items-center gap-1">
                    <button class="btn btn-sm btn-outline-secondary" title="Lihat Detail SPJ" (click)="goToDetail(b.id)">
                      <i class="bi bi-eye"></i>
                    </button>
                    @if (auth.hasRole('PA-NEGERI', 'ADMIN-TDI')) {
                      @if (!b.needSudinApproval || b.statusBku === 4) {
                        <button class="btn btn-sm btn-siap rounded-pill px-3"
                                [disabled]="loadingId() === b.id"
                                (click)="requestToken(b)">
                          <i class="bi bi-key me-1"></i>
                          {{ b.tokenOtpPa ? 'Generate Ulang Token' : 'Request Token PA' }}
                        </button>
                      } @else {
                        <span class="badge bg-warning-subtle text-dark border">Menunggu Sudin</span>
                      }
                    } @else {
                      <span class="badge bg-light text-secondary border">Khusus PA-NEGERI</span>
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
export class PermohonanTokenComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly sumberDana = signal<'BOS' | 'BOP'>('BOS');
  readonly items = signal<BkuTransaction[]>([]);
  readonly loadingId = signal<number | null>(null);
  readonly nowMs = signal<number>(Date.now());
  nrkPa = '';
  private timerHandle: any;

  readonly bankSpjList = computed(() =>
    this.items().filter((b) => {
      const isVa = b.isVirtualAccount || b.caraPembayaran === 'VA' || b.jenisPembayaran === 'Transaksi Daring / Virtual Account' || b.jenisPembayaran === 'VA_PLN';
      return b.kodeTrx === 'JJ' && !isVa && (b.statusBku === 3 || b.statusBku === 4);
    })
  );

  ngOnInit(): void {
    this.sumberDana.set((this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS');
    this.nrkPa = this.auth.activeSekolah()?.nrkKepalaSekolah || this.auth.currentUser()?.nrk || '198201';
    this.timerHandle = setInterval(() => this.nowMs.set(Date.now()), 1000);
    this.loadData();
  }

  ngOnDestroy(): void {
    if (this.timerHandle) clearInterval(this.timerHandle);
  }

  loadData(): void {
    const sekId = this.auth.selectedSekolahId() || 1;
    this.nrkPa = this.auth.activeSekolah()?.nrkKepalaSekolah || this.nrkPa || '198201';
    this.api.getBkuList(sekId, this.auth.tahunAnggaran(), this.sumberDana(), undefined, 'JJ').subscribe((res) => {
      if (res.success) this.items.set(res.data);
    });
  }

  readonly normalizeUtc = normalizeUtcIso;

  isTokenActive(b: BkuTransaction): boolean {
    if (!b.tokenOtpPa || !b.tokenExpiredAt) return false;
    const expMs = parseUtcTimestampMs(b.tokenExpiredAt);
    return Number.isFinite(expMs) && expMs > this.nowMs();
  }

  remainingText(b: BkuTransaction): string {
    if (!b.tokenExpiredAt) return '00:00';
    const expMs = parseUtcTimestampMs(b.tokenExpiredAt);
    if (!Number.isFinite(expMs)) return '00:00';
    const diffSec = Math.max(0, Math.floor((expMs - this.nowMs()) / 1000));
    const m = Math.floor(diffSec / 60).toString().padStart(2, '0');
    const s = (diffSec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  requestToken(b: BkuTransaction): void {
    this.loadingId.set(b.id);
    this.api.requestToken(this.sumberDana(), b.id, this.nrkPa).subscribe({
      next: (res) => {
        this.loadingId.set(null);
        if (res.success && res.data) {
          this.items.update((list) =>
            list.map((item) =>
              item.id === b.id
                ? { ...item, tokenOtpPa: res.data.token, tokenExpiredAt: res.data.expiredAt }
                : item
            )
          );
          this.toast.success(`Token PA: ${res.data.token} (berlaku 5 menit)`);
          this.loadData();
        }
      },
      error: (err) => {
        this.loadingId.set(null);
        this.toast.error(err?.error?.message || 'Gagal meminta token OTP.');
      }
    });
  }

  goToDetail(id: number): void {
    const base = this.sumberDana() === 'BOP' ? '/bku-bop' : '/bos-negeri';
    this.router.navigate([base, 'input-bku', 'detail', id]);
  }
}
