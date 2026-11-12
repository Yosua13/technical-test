import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { BkuCorrection, BkuTransaction } from '../../core/models/siapbos.models';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';

@Component({
  selector: 'app-koreksi-bku',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, SekolahBarComponent],
  template: `
    <app-sekolah-bar sumberDana="BOP" (sekolahChanged)="loadAll()" />

    <div class="siap-card px-3 py-2 d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div class="small text-secondary">
        <i class="bi bi-wrench-adjustable-circle me-1 text-dark"></i>
        <strong class="text-dark">Koreksi BKU &amp; Pembatalan Transfer SPJ (Khusus BOP):</strong>
        Sekolah mengusulkan revisi kode rekening BAS atau Pembatalan Transfer SPJ Lunas, lalu disetujui oleh <strong class="text-dark">Suku Dinas (SUDIN)</strong>.
      </div>
      <button class="btn btn-neutral btn-sm py-1 px-3" (click)="switchSudin()">
        Switch Demo ke SUDIN
      </button>
    </div>

    <div class="row g-3">
      <!-- Form Usulan Koreksi -->
      <div class="col-lg-4">
        <div class="siap-card p-3">
          <h6 class="fw-bold mb-3 d-flex align-items-center gap-2">
            <i class="bi bi-pencil-square text-warning fs-5"></i>
            Ajukan Koreksi Transaksi BKU BOP
          </h6>

          <div class="mb-3">
            <label class="form-label small fw-semibold">Pilih Transaksi Belanja BKU (JJ)</label>
            <select class="form-select" [(ngModel)]="form.bkuTransactionId">
              <option [ngValue]="0">-- Pilih Transaksi BKU BOP --</option>
              @for (b of bkuBelanja(); track b.id) {
                <option [ngValue]="b.id">
                  {{ b.nomorBku }} · {{ b.uraian }} ({{ b.nilaiBrutoKeluar | currency:'IDR':'symbol':'1.0-0' }})
                </option>
              }
            </select>
          </div>

          <div class="mb-3">
            <label class="form-label small fw-semibold">Jenis Koreksi</label>
            <select class="form-select" [(ngModel)]="form.jenisKoreksi">
              <option value="KODE_AKUN">Koreksi Kode Akun / Rekening Belanja (BAS)</option>
              <option value="BATAL_TRANSFER">Batal Transfer SPJ Lunas → Kembalikan Saldo &amp; Draft</option>
            </select>
          </div>

          @if (form.jenisKoreksi === 'KODE_AKUN') {
            <div class="mb-3">
              <label class="form-label small fw-semibold">Kode Akun Tujuan (BAS Baru)</label>
              <select class="form-select" [(ngModel)]="form.kodeAkunSesudah">
                <option value="">-- Pilih Kode BAS --</option>
                @for (acc of basAccounts(); track acc.kodeAkun) {
                  <option [value]="acc.kodeAkun">{{ acc.kodeAkun }} · {{ acc.namaAkun }}</option>
                }
              </select>
            </div>
          }

          <div class="mb-3">
            <label class="form-label small fw-semibold">Alasan / Berita Acara Koreksi</label>
            <textarea class="form-control" rows="3" [(ngModel)]="form.alasan"
                      placeholder="Contoh: Salah pemetaan kode rekening belanja modal/jasa pada periode TW berjalan."></textarea>
          </div>

          <button class="btn btn-siap w-100 rounded-pill py-2" (click)="submitKoreksi()" [disabled]="submitting()">
            @if (submitting()) {
              <span class="spinner-border spinner-border-sm me-2"></span>Mengirim...
            } @else {
              <i class="bi bi-send me-1"></i>Ajukan Koreksi ke Suku Dinas
            }
          </button>
        </div>
      </div>

      <!-- Riwayat Usulan Koreksi -->
      <div class="col-lg-8">
        <div class="siap-card">
          <div class="siap-card-header d-flex justify-content-between align-items-center">
            <div>
              <h6 class="fw-bold mb-0">Daftar Usulan Koreksi BKU BOP</h6>
              <small class="text-muted">Memerlukan verifikasi dan persetujuan Suku Dinas Pendidikan</small>
            </div>
            <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" (click)="loadAll()">
              <i class="bi bi-arrow-clockwise me-1"></i>Refresh
            </button>
          </div>
          <div class="table-responsive">
            <table class="table table-siap table-hover">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>No. BKU</th>
                  <th>Jenis &amp; Alasan Koreksi</th>
                  <th>Perubahan</th>
                  <th>Status</th>
                  <th class="text-end">Aksi Sudin</th>
                </tr>
              </thead>
              <tbody>
                @if (koreksiList().length === 0) {
                  <tr>
                    <td colspan="6" class="text-center py-4 text-muted">Belum ada usulan koreksi BKU BOP.</td>
                  </tr>
                }
                @for (k of koreksiList(); track k.id) {
                  <tr>
                    <td>{{ k.createdAt | date:'dd/MM/yyyy' }}</td>
                    <td class="fw-bold">{{ k.bkuTransaction?.nomorBku || ('BKU#' + k.bkuTransactionId) }}</td>
                    <td>
                      <span class="badge bg-info-subtle text-info-emphasis border border-info-subtle mb-1">{{ k.jenisKoreksi }}</span>
                      <div class="small">{{ k.alasan }}</div>
                    </td>
                    <td class="small">
                      @if (k.jenisKoreksi === 'KODE_AKUN') {
                        <div><code>{{ k.kodeAkunSebelum || '-' }}</code> → <code class="text-success fw-bold">{{ k.kodeAkunSesudah }}</code></div>
                      } @else {
                        <div class="tabular-nums">Nilai SPJ: {{ k.nilaiSebelum | currency:'IDR':'symbol':'1.0-0' }}</div>
                      }
                    </td>
                    <td>
                      @switch (k.statusKoreksi) {
                        @case (1) { <span class="badge rounded-pill text-bg-warning text-dark">Menunggu Sudin</span> }
                        @case (2) { <span class="badge rounded-pill text-bg-success">Disetujui Sudin</span> }
                        @case (9) { <span class="badge rounded-pill text-bg-danger">Ditolak</span> }
                      }
                    </td>
                    <td class="text-end text-nowrap">
                      @if (k.statusKoreksi === 1) {
                        <div class="btn-group btn-group-sm">
                          <button class="btn btn-success" (click)="approve(k, true)">
                            <i class="bi bi-check-lg me-1"></i>Setuju
                          </button>
                          <button class="btn btn-outline-danger" (click)="approve(k, false)" title="Tolak Koreksi">
                            <i class="bi bi-x-lg"></i>
                          </button>
                        </div>
                      } @else {
                        <span class="text-muted small">Selesai</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
})
export class KoreksiBkuComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly koreksiList = signal<BkuCorrection[]>([]);
  readonly bkuBelanja = signal<BkuTransaction[]>([]);
  readonly basAccounts = signal<any[]>([]);
  readonly submitting = signal(false);

  form = {
    bkuTransactionId: 0,
    jenisKoreksi: 'KODE_AKUN',
    kodeAkunSesudah: '',
    alasan: ''
  };

  ngOnInit(): void {
    this.api.getBasAccounts().subscribe({
      next: (res) => this.basAccounts.set(res.data || [])
    });
    this.loadAll();
  }

  switchSudin(): void {
    this.auth.quickSwitchRole('SUDIN').subscribe();
  }

  loadAll(): void {
    const sekolahId = this.auth.selectedSekolahId() || 1;
    const tahun = this.auth.tahunAnggaran();
    this.api.getBkuList(sekolahId, tahun, 'BOP', undefined, 'JJ').subscribe({
      next: (res) => this.bkuBelanja.set(res.data || [])
    });
    this.api.getKoreksiBop(sekolahId, 'BOP').subscribe({
      next: (res) => this.koreksiList.set(res.data || [])
    });
  }

  submitKoreksi(): void {
    if (!this.form.bkuTransactionId || !this.form.alasan.trim()) {
      this.toast.error('Pilih transaksi BKU BOP dan isi alasan koreksi.');
      return;
    }
    if (this.form.jenisKoreksi === 'KODE_AKUN' && !this.form.kodeAkunSesudah) {
      this.toast.error('Pilih kode akun BAS tujuan koreksi.');
      return;
    }
    this.submitting.set(true);
    this.api
      .createKoreksiBop({
        bkuTransactionId: Number(this.form.bkuTransactionId),
        jenisKoreksi: this.form.jenisKoreksi,
        kodeAkunSesudah: this.form.jenisKoreksi === 'KODE_AKUN' ? this.form.kodeAkunSesudah : null,
        alasan: this.form.alasan.trim()
      })
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.toast.success(res.message);
          this.form.alasan = '';
          this.loadAll();
        },
        error: (err) => {
          this.submitting.set(false);
          this.toast.error(err?.error?.message || 'Gagal mengajukan koreksi BKU.');
        }
      });
  }

  approve(k: BkuCorrection, disetujui: boolean): void {
    const role = this.auth.currentUser()?.roleCode;
    if (role !== 'SUDIN' && role !== 'ADMIN-DINAS') {
      this.toast.info('Silakan switch ke role SUDIN terlebih dahulu untuk melakukan persetujuan koreksi.');
      return;
    }
    this.api.approveKoreksiSudin(k.id, disetujui).subscribe({
      next: (res) => {
        this.toast.success(res.message);
        this.auth.loadSekolahOptions().subscribe();
        this.loadAll();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal memproses persetujuan koreksi.')
    });
  }
}
