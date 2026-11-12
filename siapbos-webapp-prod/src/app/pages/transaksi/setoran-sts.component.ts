import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { SetoranSts } from '../../core/models/siapbos.models';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';

@Component({
  selector: 'app-setoran-sts',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, SekolahBarComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="loadData()" />

    <div class="row g-3">
      <div class="col-lg-4">
        <div class="siap-card p-3">
          <h6 class="fw-bold mb-3"><i class="bi bi-arrow-return-left me-2 text-warning"></i>Input Setoran Sisa / STS ({{ sumberDana() }})</h6>
          <div class="mb-2">
            <label class="form-label small fw-semibold">Jenis Setoran</label>
            <select class="form-select form-select-sm" [(ngModel)]="form.jenisSetoran">
              <option value="SISA_BELANJA">Pengembalian Sisa Belanja</option>
              <option value="PENDAPATAN_LAIN">Setoran Pendapatan Lain-lain</option>
            </select>
          </div>
          <div class="mb-2">
            <label class="form-label small fw-semibold">Uraian Setoran</label>
            <textarea class="form-control form-control-sm" rows="2" [(ngModel)]="form.uraian" placeholder="Penyetoran pengembalian sisa belanja ke RKUD..."></textarea>
          </div>
          <div class="mb-3">
            <label class="form-label small fw-semibold">Nominal Setoran (Rp)</label>
            <input type="number" class="form-control form-control-sm" [(ngModel)]="form.nilaiSetor" min="1000">
          </div>
          <button class="btn btn-siap w-100" (click)="submitSts()">Ajukan Setoran STS</button>
        </div>
      </div>

      <div class="col-lg-8">
        <div class="siap-card">
          <div class="siap-card-header d-flex justify-content-between align-items-center">
            <h6 class="fw-bold mb-0">Daftar Surat Tanda Setoran (STS)</h6>
            <button class="btn btn-sm btn-outline-secondary" (click)="loadData()">Refresh</button>
          </div>
          <div class="table-responsive">
            <table class="table table-siap table-hover">
              <thead>
                <tr>
                  <th>Nomor STS</th>
                  <th>Jenis &amp; Uraian</th>
                  <th class="text-end">Nilai Setor</th>
                  <th>Status</th>
                  <th class="text-end">Aksi</th>
                </tr>
              </thead>
              <tbody>
                @if (items().length === 0) {
                  <tr><td colspan="5" class="text-center py-4 text-muted">Belum ada pengajuan STS pada tahun ini.</td></tr>
                }
                @for (s of items(); track s.id) {
                  <tr>
                    <td>
                      <div class="fw-bold">{{ s.nomorSts }}</div>
                      <small class="text-muted">{{ s.tanggalSts | date:'dd/MM/yyyy' }}</small>
                    </td>
                    <td>
                      <span class="badge bg-light text-dark border me-1">{{ s.jenisSetoran }}</span>
                      <div class="small">{{ s.uraian }}</div>
                    </td>
                    <td class="text-end fw-bold tabular-nums">{{ s.nilaiSetor | currency:'IDR':'symbol':'1.0-0' }}</td>
                    <td>
                      @if (s.statusSts === 1) { <span class="badge text-bg-warning">Menunggu Approval Sudin</span> }
                      @else if (s.statusSts === 2) { <span class="badge text-bg-primary">Disetujui Sudin (Siap Setor)</span> }
                      @else { <span class="badge text-bg-success">Lunas Disetor (BKU ST)</span> }
                    </td>
                    <td class="text-end text-nowrap">
                      @if (s.statusSts === 1) {
                        <button class="btn btn-sm btn-outline-primary" (click)="process(s.id, 2)">Setujui Sudin</button>
                      } @else if (s.statusSts === 2) {
                        <button class="btn btn-sm btn-siap" (click)="process(s.id, 3)">Eksekusi Setor STS</button>
                      } @else {
                        <a class="btn btn-sm btn-outline-danger" [href]="'/report-server/pdf/sts/' + s.id" target="_blank">
                          <i class="bi bi-printer me-1"></i>Cetak STS
                        </a>
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
export class SetoranStsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly sumberDana = signal<'BOS' | 'BOP'>('BOS');
  readonly items = signal<SetoranSts[]>([]);
  form = { jenisSetoran: 'SISA_BELANJA', uraian: 'Penyetoran pengembalian sisa belanja ke RKUD', nilaiSetor: 125000 };

  ngOnInit(): void {
    this.sumberDana.set((this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS');
    this.loadData();
  }

  loadData(): void {
    this.api.getSts(this.sumberDana(), this.auth.selectedSekolahId() || 1, this.auth.tahunAnggaran()).subscribe((r) => {
      if (r.success) this.items.set(r.data);
    });
  }

  submitSts(): void {
    this.api
      .createSts(this.sumberDana(), {
        sekolahId: this.auth.selectedSekolahId() || 1,
        tahunAnggaran: this.auth.tahunAnggaran(),
        sumberDana: this.sumberDana(),
        kodePeriode: this.sumberDana() === 'BOP' ? 'TW1' : '01',
        ...this.form
      })
      .subscribe((r) => {
        if (r.success) {
          this.toast.success(r.message);
          this.loadData();
        }
      });
  }

  process(id: number, targetStatus: number): void {
    this.api.processSts(this.sumberDana(), id, targetStatus).subscribe((r) => {
      if (r.success) {
        this.toast.success(r.message);
        this.loadData();
        if (targetStatus === 3) this.auth.loadSekolahOptions().subscribe();
      }
    });
  }
}
