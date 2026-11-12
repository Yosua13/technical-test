import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { DroppingDana } from '../../core/models/siapbos.models';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';

@Component({
  selector: 'app-konfirmasi-dana',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, SekolahBarComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="loadDropping()" />

    <div class="siap-card">
      <div class="siap-card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h6 class="fw-bold mb-0"><i class="bi bi-box-arrow-in-down me-2 text-warning"></i>Daftar Penyaluran (Dropping) Dana {{ sumberDana() }}</h6>
          <small class="text-muted">Konfirmasi dana masuk SP2D untuk otomatis mencatat transaksi Pengisian Kas (JO) ke BKU &amp; menambah saldo sekolah</small>
        </div>
        <button class="btn btn-sm btn-outline-secondary" (click)="loadDropping()">
          <i class="bi bi-arrow-clockwise me-1"></i>Refresh
        </button>
      </div>

      <div class="table-responsive">
        <table class="table table-siap table-hover">
          <thead>
            <tr>
              <th>No. SP2D</th>
              <th>Periode</th>
              <th>Tanggal Dropping</th>
              <th>Keterangan</th>
              <th class="text-end">Nilai Dropping</th>
              <th>Status BKU</th>
              <th class="text-end">Aksi</th>
            </tr>
          </thead>
          <tbody>
            @if (items().length === 0) {
              <tr>
                <td colspan="7" class="text-center py-4 text-muted">Belum ada data dropping dana untuk sekolah ini.</td>
              </tr>
            }
            @for (d of items(); track d.id) {
              <tr>
                <td class="fw-bold text-primary">{{ d.nomorSp2d }}</td>
                <td><span class="badge bg-light text-dark border">{{ d.kodePeriode }} · {{ d.namaPeriode }}</span></td>
                <td>{{ d.tanggalDropping | date:'dd MMM yyyy' }}</td>
                <td>{{ d.keterangan }}</td>
                <td class="text-end fw-bold text-success tabular-nums">{{ d.nilaiDropping | currency:'IDR':'symbol':'1.0-0' }}</td>
                <td>
                  @if (d.isConfirmedToBku) {
                    <span class="badge rounded-pill text-bg-success"><i class="bi bi-check-circle me-1"></i>Sudah Masuk BKU (JO)</span>
                  } @else {
                    <span class="badge rounded-pill text-bg-warning text-dark"><i class="bi bi-hourglass-split me-1"></i>Menunggu Konfirmasi PK</span>
                  }
                </td>
                <td class="text-end">
                  @if (!d.isConfirmedToBku) {
                    <button class="btn btn-sm btn-siap rounded-pill px-3" [disabled]="processingId() === d.id" (click)="confirm(d)">
                      @if (processingId() === d.id) {
                        <span class="spinner-border spinner-border-sm me-1"></span>
                      }
                      <i class="bi bi-check2-circle me-1"></i>Konfirmasi Masuk BKU
                    </button>
                  } @else {
                    <span class="text-muted small">Terkonfirmasi {{ d.tanggalKonfirmasi | date:'dd/MM/yy' }}</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class KonfirmasiDanaComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly sumberDana = signal<'BOS' | 'BOP'>('BOS');
  readonly items = signal<DroppingDana[]>([]);
  readonly processingId = signal<number | null>(null);

  ngOnInit(): void {
    this.sumberDana.set((this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS');
    this.loadDropping();
  }

  loadDropping(): void {
    const sekId = this.auth.selectedSekolahId() || 1;
    this.api.getDroppingSekolah(sekId, this.auth.tahunAnggaran(), this.sumberDana()).subscribe({
      next: (res) => {
        if (res.success) this.items.set(res.data);
      }
    });
  }

  confirm(d: DroppingDana): void {
    this.processingId.set(d.id);
    this.api.confirmDropping(d.id, this.sumberDana()).subscribe({
      next: (res) => {
        this.processingId.set(null);
        if (res.success) {
          this.toast.success(`Dropping ${d.nomorSp2d} (Rp ${d.nilaiDropping.toLocaleString('id-ID')}) berhasil masuk BKU!`);
          this.loadDropping();
          this.auth.loadSekolahOptions().subscribe();
        }
      },
      error: () => this.processingId.set(null)
    });
  }
}
