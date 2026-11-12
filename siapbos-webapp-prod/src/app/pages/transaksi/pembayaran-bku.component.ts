import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { BkuTransaction } from '../../core/models/siapbos.models';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-pembayaran-bku',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, SekolahBarComponent, StatusBadgeComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="loadData()" />

    <!-- Highlight Integration Flow -->
    <div class="siap-card p-3 mb-3 bg-primary bg-opacity-10 border-primary">
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div class="small">
          <strong class="text-primary"><i class="bi bi-bank2 me-1"></i>Integrasi Cash Management System (CMS) Bank DKI:</strong>
          1) Kepala Sekolah (PA) klik <strong>Permohonan Token (NRK)</strong> → menerbitkan 6 digit OTP.
          2) Bendahara (PK) klik <strong>Transfer SPJ CMS</strong> → memotong saldo kas sekolah secara real-time &amp; mencatat <strong>Nomor Jurnal Bank (Bit39=00)</strong>.
        </div>
        <span class="badge text-bg-primary">Endpoint: siapbos-integration (:5004)</span>
      </div>
    </div>

    @if (lastResponse(); as resp) {
      <div class="alert alert-success alert-dismissible fade show shadow-sm mb-3">
        <div class="fw-bold"><i class="bi bi-check-circle-fill me-2"></i>Respon Live Core Banking Bank DKI (bit39: "{{ resp.bit39 }}")</div>
        <div class="small mt-1">
          No. Jurnal Bank: <strong>{{ resp.noJurnalBank }}</strong> |
          Nominal Ditransfer: <strong>{{ resp.nominalDitransfer | currency:'IDR':'symbol':'1.0-0' }}</strong> |
          Sisa Saldo Rekening Sekolah: <strong>{{ resp.sisaSaldoSekolah | currency:'IDR':'symbol':'1.0-0' }}</strong>
        </div>
        <button type="button" class="btn-close" (click)="lastResponse.set(null)"></button>
      </div>
    }

    <div class="siap-card">
      <div class="siap-card-header d-flex justify-content-between align-items-center">
        <h6 class="fw-bold mb-0"><i class="bi bi-credit-card-2-front me-2 text-warning"></i>Daftar SPJ Siap Bayar &amp; Riwayat Transfer CMS Bank DKI ({{ sumberDana() }})</h6>
        <button class="btn btn-sm btn-outline-secondary" (click)="loadData()"><i class="bi bi-arrow-clockwise me-1"></i>Refresh</button>
      </div>
      <div class="table-responsive">
        <table class="table table-siap table-hover">
          <thead>
            <tr>
              <th>No. BKU &amp; Tanggal</th>
              <th>Uraian &amp; Rekanan Tujuan</th>
              <th class="text-end">Netto Transfer</th>
              <th>Token OTP PA</th>
              <th>Jurnal Bank DKI</th>
              <th>Status</th>
              <th class="text-end">Aksi CMS Bank DKI</th>
            </tr>
          </thead>
          <tbody>
            @for (b of items(); track b.id) {
              <tr>
                <td>
                  <div class="fw-bold">{{ b.nomorBku }}</div>
                  <small class="text-muted">{{ b.tanggalTransaksi | date:'dd MMM yyyy' }}</small>
                </td>
                <td>
                  <div class="fw-medium">{{ b.uraian }}</div>
                  <small class="text-muted">{{ b.namaRekanan }} · <strong>{{ b.namaBankRekanan }} {{ b.noRekRekanan }}</strong></small>
                </td>
                <td class="text-end fw-bold text-primary tabular-nums">{{ b.nilaiNettoTransfer | currency:'IDR':'symbol':'1.0-0' }}</td>
                <td>
                  @if (b.tokenOtpPa) {
                    <span class="badge bg-dark text-warning fs-6 font-monospace">{{ b.tokenOtpPa }}</span>
                    <div class="text-muted" style="font-size: 0.7rem;">NRK {{ b.tokenCreatedByNrk }}</div>
                  } @else {
                    <span class="text-muted small">Belum ada token</span>
                  }
                </td>
                <td>
                  @if (b.noJurnalBank) {
                    <div class="fw-bold text-success small">{{ b.noJurnalBank }}</div>
                    <small class="text-muted">Bit39: {{ b.statusTransferBank }} · {{ b.tanggalTransferBank | date:'dd/MM HH:mm' }}</small>
                  } @else {
                    <span class="text-muted small">-</span>
                  }
                </td>
                <td><app-status-badge kind="bku" [value]="b.statusBku" /></td>
                <td class="text-end text-nowrap">
                  @if (b.statusBku === 3 || b.statusBku === 4) {
                    <div class="d-flex justify-content-end gap-1">
                      <button class="btn btn-sm btn-outline-primary fw-semibold" (click)="openTokenModal(b)">
                        <i class="bi bi-key-fill me-1"></i>{{ b.tokenOtpPa ? 'Regen Token' : 'Permohonan Token PA' }}
                      </button>
                      <button class="btn btn-sm btn-siap" [disabled]="!b.tokenOtpPa" (click)="openTransferModal(b)">
                        <i class="bi bi-send-check me-1"></i>Transfer CMS
                      </button>
                    </div>
                  } @else if (b.statusBku === 5) {
                    <a class="btn btn-sm btn-outline-danger" [href]="'/report-server/pdf/spj/' + b.id" target="_blank">
                      <i class="bi bi-file-earmark-pdf me-1"></i>Cetak SPJ
                    </a>
                  } @else {
                    <span class="text-muted small">Menunggu Persetujuan PA</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Permohonan Token PA -->
    @if (tokenModalBku(); as b) {
      <div class="modal-backdrop-custom">
        <div class="modal-dialog-custom" style="max-width: 460px;">
          <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
            <h6 class="mb-0 fw-bold">Permohonan Token CMS Bank DKI (PA)</h6>
            <button type="button" class="btn-close" (click)="tokenModalBku.set(null)"></button>
          </div>
          <div class="modal-body-scroll">
            <p class="small text-muted">Transaksi: <strong>{{ b.nomorBku }}</strong> — Netto: <strong>{{ b.nilaiNettoTransfer | currency:'IDR':'symbol':'1.0-0' }}</strong></p>
            <div class="mb-3">
              <label class="form-label small fw-bold">NRK Kepala Sekolah (Pengguna Anggaran)</label>
              <input type="text" class="form-control" [(ngModel)]="nrkInput">
              <small class="text-muted">NRK Kepala Sekolah aktif: {{ auth.activeSekolah()?.nrkKepalaSekolah }}</small>
            </div>
          </div>
          <div class="p-3 border-top bg-light d-flex justify-content-end gap-2">
            <button class="btn btn-light" (click)="tokenModalBku.set(null)">Batal</button>
            <button class="btn btn-primary" (click)="submitToken()">Generate Token OTP Bank DKI</button>
          </div>
        </div>
      </div>
    }

    <!-- Modal Transfer CMS -->
    @if (transferModalBku(); as b) {
      <div class="modal-backdrop-custom">
        <div class="modal-dialog-custom" style="max-width: 480px;">
          <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
            <h6 class="mb-0 fw-bold">Konfirmasi Eksekusi Transfer SPJ CMS Bank DKI</h6>
            <button type="button" class="btn-close" (click)="transferModalBku.set(null)"></button>
          </div>
          <div class="modal-body-scroll small">
            <div class="p-3 rounded-3 bg-light border mb-3">
              <div><strong>Penerima:</strong> {{ b.namaRekanan }}</div>
              <div><strong>Rekening:</strong> {{ b.namaBankRekanan }} - {{ b.noRekRekanan }}</div>
              <div class="fs-6 mt-1"><strong>Nominal Transfer Netto:</strong> <span class="text-success fw-bold">{{ b.nilaiNettoTransfer | currency:'IDR':'symbol':'1.0-0' }}</span></div>
            </div>
            <div class="mb-2">
              <label class="form-label fw-bold">Masukkan 6-Digit Token OTP Kepala Sekolah</label>
              <input type="text" class="form-control form-control-lg text-center font-monospace fw-bold" [(ngModel)]="otpInput">
            </div>
          </div>
          <div class="p-3 border-top bg-light d-flex justify-content-end gap-2">
            <button class="btn btn-light" (click)="transferModalBku.set(null)">Batal</button>
            <button class="btn btn-siap px-4" (click)="submitTransfer()">Eksekusi Transfer Sekarang</button>
          </div>
        </div>
      </div>
    }
  `
})
export class PembayaranBkuComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly sumberDana = signal<'BOS' | 'BOP'>('BOS');
  readonly items = signal<BkuTransaction[]>([]);
  readonly tokenModalBku = signal<BkuTransaction | null>(null);
  readonly transferModalBku = signal<BkuTransaction | null>(null);
  readonly lastResponse = signal<any>(null);

  nrkInput = '';
  otpInput = '';

  ngOnInit(): void {
    this.sumberDana.set((this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS');
    this.loadData();
  }

  loadData(): void {
    const sekId = this.auth.selectedSekolahId() || 1;
    this.api.getBkuList(sekId, this.auth.tahunAnggaran(), this.sumberDana(), undefined, 'JJ').subscribe((res) => {
      if (res.success) {
        this.items.set(res.data.filter((x) => x.statusBku >= 2 && x.statusBku <= 5));
      }
    });
  }

  openTokenModal(b: BkuTransaction): void {
    this.nrkInput = this.auth.activeSekolah()?.nrkKepalaSekolah || '198201';
    this.tokenModalBku.set(b);
  }

  submitToken(): void {
    const b = this.tokenModalBku();
    if (!b) return;
    this.api.requestToken(this.sumberDana(), b.id, this.nrkInput).subscribe((res) => {
      if (res.success) {
        this.toast.success(`Token OTP Bank DKI terbit: ${res.data.token}`);
        this.tokenModalBku.set(null);
        this.loadData();
      }
    });
  }

  openTransferModal(b: BkuTransaction): void {
    this.otpInput = b.tokenOtpPa || '';
    this.transferModalBku.set(b);
  }

  submitTransfer(): void {
    const b = this.transferModalBku();
    if (!b) return;
    this.api.transferSpj(this.sumberDana(), b.id, this.otpInput).subscribe((res) => {
      if (res.success) {
        this.lastResponse.set(res.data);
        this.toast.success(res.message);
        this.transferModalBku.set(null);
        this.loadData();
        this.auth.loadSekolahOptions().subscribe();
      }
    });
  }
}
