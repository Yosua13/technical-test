import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { BankMutation, BapKasReport } from '../../core/models/siapbos.models';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';

@Component({
  selector: 'app-bap-kas-tutup-buku',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, SekolahBarComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="loadAll()" />

    <div class="row g-3">
      <!-- Panel Kiri: BAP Kas & Tutup Buku -->
      <div class="col-lg-5">
        <div class="siap-card p-3 mb-3">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-bold mb-0"><i class="bi bi-journal-check me-2 text-warning"></i>Pemeriksaan Kas (BAP Kas) &amp; Tutup Buku</h6>
            <a class="btn btn-sm btn-outline-success"
               [href]="'/report-server/excel/bap-kas?sekolahId=' + auth.selectedSekolahId() + '&tahun=' + auth.tahunAnggaran() + '&sumberDana=' + sumberDana() + '&kodePeriode=' + kodePeriode"
               target="_blank">
              <i class="bi bi-file-earmark-excel me-1"></i>Excel BAP
            </a>
          </div>

          <div class="mb-2">
            <label class="form-label small fw-semibold">Periode Buku</label>
            <select class="form-select form-select-sm" [(ngModel)]="kodePeriode">
              @if (sumberDana() === 'BOS') {
                <option value="01">Tahap 1 (Januari - Juni)</option>
                <option value="02">Tahap 2 (Juli - Desember)</option>
              } @else {
                <option value="TW1">Triwulan I</option>
                <option value="TW2">Triwulan II</option>
              }
            </select>
          </div>
          <div class="mb-2">
            <label class="form-label small fw-semibold">Saldo Kas Tunai di Brankas (Rp)</label>
            <input type="number" class="form-control form-control-sm" [(ngModel)]="kasTunai" min="0">
          </div>
          <div class="mb-3">
            <label class="form-label small fw-semibold">Keterangan Pemeriksaan Kas</label>
            <textarea class="form-control form-control-sm" rows="2" [(ngModel)]="keteranganSelisih"></textarea>
          </div>

          <button class="btn btn-siap w-100 mb-3" (click)="saveBapKas()">
            <i class="bi bi-save me-1"></i>Simpan / Hitung Rekonsiliasi BAP Kas
          </button>

          @if (bapList().length > 0) {
            <div class="border-top pt-3">
              @for (bap of bapList(); track bap.id) {
                <div class="p-3 rounded-3 bg-light border mb-2 small">
                  <div class="d-flex justify-content-between fw-bold mb-1">
                    <span>{{ bap.nomorBap }} ({{ bap.kodePeriode }})</span>
                    @if (bap.isTutupBuku) {
                      <span class="badge text-bg-dark"><i class="bi bi-lock-fill me-1"></i>TUTUP BUKU</span>
                    } @else if (bap.statusBap === 2) {
                      <span class="badge text-bg-success">Disetujui Dinas/Sudin</span>
                    } @else if (bap.statusBap === 1) {
                      <span class="badge text-bg-primary">Disetujui PA → Menunggu Dinas</span>
                    } @else {
                      <span class="badge text-bg-secondary">Draft BAP Kas</span>
                    }
                  </div>
                  <div>Saldo BKU: <strong>{{ bap.saldoBku | currency:'IDR':'symbol':'1.0-0' }}</strong></div>
                  <div>Saldo Rek. Bank DKI: <strong>{{ bap.saldoRekeningKoran | currency:'IDR':'symbol':'1.0-0' }}</strong></div>
                  <div>Selisih Kas: <strong class="text-success">{{ bap.selisihKas | currency:'IDR':'symbol':'1.0-0' }}</strong></div>

                  <div class="mt-2 d-flex flex-wrap gap-1">
                    @if (bap.statusBap < 1) {
                      <button class="btn btn-sm btn-outline-primary" (click)="approveBap(bap.id, 1)">Setujui PA (Kepsek)</button>
                    }
                    @if (bap.statusBap === 1) {
                      <button class="btn btn-sm btn-outline-success" (click)="approveBap(bap.id, 2)">Setujui Sudin/Dinas</button>
                    }
                    @if (bap.statusBap >= 2 && !bap.isTutupBuku) {
                      <button class="btn btn-sm btn-danger fw-semibold" (click)="tutupBuku(bap.kodePeriode)">
                        <i class="bi bi-lock me-1"></i>Eksekusi Tutup Buku Periode
                      </button>
                    }
                    @if (bap.isTutupBuku) {
                      <button class="btn btn-sm btn-outline-dark" (click)="batalTutupBuku(bap.kodePeriode)">
                        <i class="bi bi-unlock me-1"></i>Batal Tutup Buku (Admin)
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- Panel Kanan: Mutasi Rekening Koran Bank DKI -->
      <div class="col-lg-7">
        <div class="siap-card">
          <div class="siap-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <h6 class="fw-bold mb-0"><i class="bi bi-bank me-2 text-warning"></i>Mutasi Rekening Koran Bank DKI ({{ sumberDana() }})</h6>
              <small class="text-muted">Sinkronisasi real-time via siapbos-integration (/api/mutasi/byNoRek)</small>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-sm" [class.btn-warning]="limit12()" [class.btn-outline-secondary]="!limit12()" (click)="limit12.set(true); loadMutasi()">12 Terakhir</button>
              <button class="btn btn-sm" [class.btn-warning]="!limit12()" [class.btn-outline-secondary]="limit12()" (click)="limit12.set(false); loadMutasi()">Semua Mutasi</button>
              <a class="btn btn-sm btn-outline-danger" [href]="'/report-server/pdf/mutasi?sekolahId=' + auth.selectedSekolahId() + '&sumberDana=' + sumberDana()" target="_blank">
                <i class="bi bi-file-pdf me-1"></i>Cetak PDF
              </a>
            </div>
          </div>

          <div class="table-responsive">
            <table class="table table-siap table-hover">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Ref Jurnal</th>
                  <th>Uraian Mutasi Bank DKI</th>
                  <th class="text-center">D/K</th>
                  <th class="text-end">Nominal</th>
                  <th class="text-end">Saldo Akhir</th>
                </tr>
              </thead>
              <tbody>
                @for (m of mutasiList(); track m.id) {
                  <tr>
                    <td class="text-nowrap">{{ m.tanggalTransaksi | date:'dd/MM/yy HH:mm' }}</td>
                    <td class="font-monospace small">{{ m.nomorReferensi }}</td>
                    <td class="small">{{ m.uraian }}</td>
                    <td class="text-center">
                      @if (m.tipeMutasi === 'K') {
                        <span class="badge bg-success-subtle text-success">Kredit (+)</span>
                      } @else {
                        <span class="badge bg-danger-subtle text-danger">Debet (-)</span>
                      }
                    </td>
                    <td class="text-end fw-semibold tabular-nums" [class.text-success]="m.tipeMutasi === 'K'" [class.text-danger]="m.tipeMutasi === 'D'">
                      {{ m.nominal | currency:'IDR':'symbol':'1.0-0' }}
                    </td>
                    <td class="text-end fw-bold tabular-nums">{{ m.saldoAkhir | currency:'IDR':'symbol':'1.0-0' }}</td>
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
export class BapKasTutupBukuComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly sumberDana = signal<'BOS' | 'BOP'>('BOS');
  readonly mutasiList = signal<BankMutation[]>([]);
  readonly bapList = signal<BapKasReport[]>([]);
  readonly limit12 = signal(true);

  kodePeriode = '01';
  kasTunai = 0;
  keteranganSelisih = 'Saldo Buku Kas Umum (BKU) telah sesuai dengan Saldo Rekening Koran Bank DKI.';

  ngOnInit(): void {
    const sd = (this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS';
    this.sumberDana.set(sd);
    this.kodePeriode = sd === 'BOP' ? 'TW1' : '01';
    this.loadAll();
  }

  loadAll(): void {
    this.loadMutasi();
    this.loadBap();
  }

  loadMutasi(): void {
    this.api.getMutasi(this.sumberDana(), this.auth.selectedSekolahId() || 1, this.limit12()).subscribe((r) => {
      if (r.success) this.mutasiList.set(r.data);
    });
  }

  loadBap(): void {
    this.api.getBapKas(this.sumberDana(), this.auth.selectedSekolahId() || 1, this.auth.tahunAnggaran()).subscribe((r) => {
      if (r.success) this.bapList.set(r.data);
    });
  }

  saveBapKas(): void {
    this.api
      .saveBapKas(this.sumberDana(), {
        sekolahId: this.auth.selectedSekolahId() || 1,
        tahunAnggaran: this.auth.tahunAnggaran(),
        sumberDana: this.sumberDana(),
        kodePeriode: this.kodePeriode,
        saldoKasTunai: Number(this.kasTunai),
        keteranganSelisih: this.keteranganSelisih
      })
      .subscribe((r) => {
        if (r.success) {
          this.toast.success(r.message);
          this.loadBap();
        }
      });
  }

  approveBap(id: number, target: number): void {
    this.api.approveBapKas(this.sumberDana(), id, target).subscribe((r) => {
      if (r.success) {
        this.toast.success(r.message);
        this.loadBap();
      }
    });
  }

  tutupBuku(periode: string): void {
    this.api.tutupBuku(this.sumberDana(), this.auth.selectedSekolahId() || 1, this.auth.tahunAnggaran(), periode).subscribe((r) => {
      if (r.success) {
        this.toast.success(r.message);
        this.loadBap();
      }
    });
  }

  batalTutupBuku(periode: string): void {
    this.api.batalTutupBuku(this.sumberDana(), this.auth.selectedSekolahId() || 1, this.auth.tahunAnggaran(), periode).subscribe((r) => {
      if (r.success) {
        this.toast.success(r.message);
        this.loadBap();
      }
    });
  }
}
