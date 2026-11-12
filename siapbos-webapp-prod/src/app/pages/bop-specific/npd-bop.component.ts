import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

    <!-- Header -->
    <div class="alert alert-primary bg-primary bg-opacity-10 border-primary-subtle d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div class="small">
        <i class="bi bi-diagram-3-fill me-1 text-primary"></i>
        <strong>Alur Pencairan NPD BOP → SIPKD BPKD:</strong>
        <span>Draft Bendahara (0) → Diajukan ke PA (1) → Disetujui Kepala Sekolah (2) → Disetujui Sudin &amp; Kirim Otomatis ke SIPKD (4) → Terbit Dropping BOP</span>
      </div>
      <span class="badge badge-neutral rounded-pill px-3">{{ auth.currentUser()?.roleCode }}</span>
    </div>

    <div class="row g-3">
      <!-- Form Buat Draft NPD BOP (Hanya PK-NEGERI / ADMIN-TDI) -->
      @if (auth.hasRole('PK-NEGERI', 'ADMIN-TDI')) {
        <div class="col-lg-4">
          <div class="siap-card p-3">
            <h6 class="fw-bold mb-3 d-flex align-items-center gap-2">
              <i class="bi bi-file-earmark-plus text-warning fs-5"></i>
              Buat Pengajuan NPD BOP
            </h6>
            <div class="mb-3">
              <label class="form-label small fw-semibold">Triwulan / Periode BOP</label>
              <select class="form-select" [(ngModel)]="form.kodePeriode">
                <option value="TW1">TW1 - Triwulan I (Jan - Mar)</option>
                <option value="TW2">TW2 - Triwulan II (Apr - Jun)</option>
                <option value="TW3">TW3 - Triwulan III (Jul - Sep)</option>
                <option value="TW4">TW4 - Triwulan IV (Okt - Des)</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label small fw-semibold">Uraian Kebutuhan Pencairan NPD</label>
              <textarea class="form-control" rows="3" [(ngModel)]="form.uraian"
                        placeholder="Contoh: Pengajuan Pencairan BOP Triwulan II Belanja Honorarium, Langganan Daya & Jasa, dan Pemeliharaan"></textarea>
            </div>
            <div class="mb-3">
              <label class="form-label small fw-semibold">Nilai Pengajuan (Rp)</label>
              <input type="number" class="form-control fw-bold tabular-nums" [(ngModel)]="form.nilaiPengajuan" min="100000" step="100000">
              <small class="text-muted">Otomatis akan menerbitkan SP2D Dropping BOP setelah disetujui Sudin &amp; terkirim ke SIPKD.</small>
            </div>
            <button class="btn btn-siap w-100 rounded-pill py-2" (click)="createNpd()" [disabled]="submitting()">
              @if (submitting()) {
                <span class="spinner-border spinner-border-sm me-2"></span>Menyimpan...
              } @else {
                <i class="bi bi-save me-1"></i>Simpan Draft NPD BOP
              }
            </button>
          </div>
        </div>
      }

      <!-- Tabel Daftar Pengajuan NPD BOP -->
      <div [class]="auth.hasRole('PK-NEGERI', 'ADMIN-TDI') ? 'col-lg-8' : 'col-12'">
        <div class="siap-card">
          <div class="siap-card-header d-flex justify-content-between align-items-center">
            <div>
              <h6 class="fw-bold mb-0">Daftar Nota Pencairan Dana (NPD) BOP</h6>
              <small class="text-muted">Tahun Anggaran {{ auth.tahunAnggaran() }} · Terintegrasi SIPKD</small>
            </div>
            <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" (click)="loadNpd()">
              <i class="bi bi-arrow-clockwise me-1"></i>Refresh
            </button>
          </div>
          <div class="table-responsive">
            <table class="table table-siap table-hover">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Nomor NPD / SIPKD</th>
                  <th>Triwulan</th>
                  <th>Uraian</th>
                  <th class="text-end">Nilai Pengajuan</th>
                  <th>Status</th>
                  <th class="text-end">Aksi</th>
                </tr>
              </thead>
              <tbody>
                @if (items().length === 0) {
                  <tr>
                    <td colspan="7" class="text-center py-4 text-muted">Belum ada pengajuan NPD BOP untuk tahun anggaran ini.</td>
                  </tr>
                }
                @for (n of items(); track n.id) {
                  <tr>
                    <td>{{ n.tanggalNpd | date:'dd/MM/yyyy' }}</td>
                    <td>
                      <div class="fw-bold">{{ n.nomorNpd }}</div>
                      @if (n.nomorSipkd) {
                        <span class="badge bg-success-subtle text-success border border-success-subtle">{{ n.nomorSipkd }}</span>
                      }
                    </td>
                    <td><span class="badge text-bg-light border">{{ n.kodePeriode }}</span></td>
                    <td>
                      <div class="fw-medium">{{ n.uraian }}</div>
                      <small class="text-muted">{{ n.catatan || '-' }}</small>
                    </td>
                    <td class="text-end fw-bold tabular-nums">{{ n.nilaiPengajuan | currency:'IDR':'symbol':'1.0-0' }}</td>
                    <td><app-status-badge kind="npd" [value]="n.statusNpd" /></td>
                    <td class="text-end text-nowrap">
                      @if (n.statusNpd === 0) {
                        @if (auth.hasRole('PK-NEGERI', 'ADMIN-TDI')) {
                          <button class="btn btn-sm btn-siap rounded-pill px-3" (click)="ajukan(n)">
                            <i class="bi bi-send me-1"></i>Ajukan ke PA
                          </button>
                        } @else {
                          <span class="badge bg-light text-secondary border">Draft PK</span>
                        }
                      }
                      @if (n.statusNpd === 1) {
                        @if (auth.hasRole('PA-NEGERI', 'ADMIN-TDI')) {
                          <div class="btn-group btn-group-sm">
                            <button class="btn btn-primary" (click)="approvePa(n, true)">
                              <i class="bi bi-check-lg me-1"></i>Setuju PA
                            </button>
                            <button class="btn btn-outline-danger" (click)="approvePa(n, false)" title="Tolak NPD">
                              <i class="bi bi-x-lg"></i>
                            </button>
                          </div>
                        } @else {
                          <span class="badge bg-info-subtle text-info-emphasis border">Menunggu PA</span>
                        }
                      }
                      @if (n.statusNpd === 2) {
                        @if (auth.hasRole('SUDIN', 'ADMIN-DINAS', 'ADMIN-TDI')) {
                          <div class="btn-group btn-group-sm">
                            <button class="btn btn-success" (click)="approveSudin(n, true)">
                              <i class="bi bi-send-check me-1"></i>Setuju Sudin &amp; Kirim SIPKD
                            </button>
                            <button class="btn btn-outline-danger" (click)="approveSudin(n, false)" title="Tolak Sudin">
                              <i class="bi bi-x-lg"></i>
                            </button>
                          </div>
                        } @else {
                          <span class="badge bg-primary-subtle text-primary border">Menunggu Sudin</span>
                        }
                      }
                      @if (n.statusNpd === 4) {
                        <span class="text-success small fw-semibold"><i class="bi bi-check2-all me-1"></i>SP2D Terbit</span>
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
export class NpdBopComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly items = signal<NpdBop[]>([]);
  readonly submitting = signal(false);

  form = {
    kodePeriode: 'TW2',
    uraian: '',
    nilaiPengajuan: 25000000
  };

  ngOnInit(): void {
    this.loadNpd();
  }

  loadNpd(): void {
    const sekolahId = this.auth.selectedSekolahId() || 1;
    this.api.getNpdBop(sekolahId, this.auth.tahunAnggaran()).subscribe({
      next: (res) => this.items.set(res.data || []),
      error: (err) => this.toast.error(err?.error?.message || 'Gagal memuat daftar NPD BOP.')
    });
  }

  createNpd(): void {
    if (!this.form.uraian.trim() || this.form.nilaiPengajuan <= 0) {
      this.toast.error('Uraian dan nilai pengajuan NPD wajib diisi.');
      return;
    }
    this.submitting.set(true);
    this.api
      .createNpdBop({
        sekolahId: this.auth.selectedSekolahId() || 1,
        tahunAnggaran: this.auth.tahunAnggaran(),
        kodePeriode: this.form.kodePeriode,
        uraian: this.form.uraian.trim(),
        nilaiPengajuan: Number(this.form.nilaiPengajuan)
      })
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.toast.success(res.message);
          this.form.uraian = '';
          this.loadNpd();
        },
        error: (err) => {
          this.submitting.set(false);
          this.toast.error(err?.error?.message || 'Gagal membuat draft NPD BOP.');
        }
      });
  }

  ajukan(n: NpdBop): void {
    this.api.ajukanNpdBop(n.id).subscribe({
      next: (res) => {
        this.toast.success(res.message);
        this.loadNpd();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal mengajukan NPD.')
    });
  }

  approvePa(n: NpdBop, disetujui: boolean): void {
    if (!this.auth.hasRole('PA-NEGERI', 'ADMIN-TDI', 'ADMIN-DINAS')) {
      this.toast.error('Hanya akun Kepala Sekolah (PA) atau ADMIN-TDI yang berwenang menyetujui NPD.');
      return;
    }
    this.api.approveNpdPa(n.id, disetujui).subscribe({
      next: (res) => {
        this.toast.success(res.message);
        this.loadNpd();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal memproses approval PA.')
    });
  }

  approveSudin(n: NpdBop, disetujui: boolean): void {
    if (!this.auth.hasRole('SUDIN', 'ADMIN-TDI', 'ADMIN-DINAS')) {
      this.toast.error('Hanya akun Suku Dinas (SUDIN) atau ADMIN-TDI yang berwenang menyetujui NPD Sudin.');
      return;
    }
    this.api.approveNpdSudin(n.id, disetujui).subscribe({
      next: (res) => {
        this.toast.success(res.message);
        this.loadNpd();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal mengirim NPD ke SIPKD.')
    });
  }
}
