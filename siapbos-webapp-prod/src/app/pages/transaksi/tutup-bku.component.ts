import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { BapKasReport, BkuTransaction } from '../../core/models/siapbos.models';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-tutup-bku',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, SekolahBarComponent, StatusBadgeComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="loadData()" />

    <div class="siap-card mb-3">
      <div class="p-4 border-bottom bg-white">
        <div class="border rounded-3 p-3 bg-light mb-3">
          <div class="row g-2 align-items-center mb-2">
            <label class="col-md-2 col-form-label small fw-semibold">Tahun Anggaran</label>
            <div class="col-md-8">
              <input type="text" class="form-control form-control-sm bg-white" [value]="auth.tahunAnggaran()" readonly>
            </div>
          </div>
          <div class="row g-2 align-items-center mb-2">
            <label class="col-md-2 col-form-label small fw-semibold">Sekolah</label>
            <div class="col-md-8">
              <input type="text" class="form-control form-control-sm bg-white"
                     [value]="(auth.activeSekolah()?.npsn || '') + ' / ' + (auth.activeSekolah()?.namaSekolah || '')" readonly>
            </div>
          </div>
          <div class="row g-2 align-items-center">
            <label class="col-md-2 col-form-label small fw-semibold">Periode</label>
            <div class="col-md-5">
              <select class="form-select form-select-sm" [(ngModel)]="kodePeriode" (ngModelChange)="loadData()">
                @for (p of periodeOptions(); track p.kode) {
                  <option [value]="p.kode">{{ p.label }} : {{ isPeriodeClosed(p.kode) ? 'Sudah Tutup BKU' : (hasBapDraft(p.kode) ? 'Draft BAP Tersimpan' : 'Belum Tutup BKU') }}</option>
                }
              </select>
            </div>
            <div class="col-md-3">
              @if (currentBap(); as cb) {
                @if (cb.isTutupBuku) {
                  <span class="badge rounded-pill text-bg-success px-3 py-2"><i class="bi bi-lock-fill me-1"></i>Periode Ditutup</span>
                } @else {
                  <span class="badge rounded-pill text-bg-warning text-dark px-3 py-2">Status BAP: {{ cb.statusBap === 2 ? 'Disetujui Dinas' : cb.statusBap === 1 ? 'Disetujui PA' : 'Draft BAP' }}</span>
                }
              } @else {
                <span class="badge rounded-pill text-bg-secondary px-3 py-2">Belum Ada BAP / Tutup Buku</span>
              }
            </div>
          </div>
        </div>

        <div class="d-flex flex-wrap gap-2">
          <button type="button" class="btn btn-sm btn-primary px-3" (click)="loadData()">
            <i class="bi bi-search me-1"></i>Cari Laporan
          </button>
          @if (auth.hasRole('PK-NEGERI', 'PA-NEGERI', 'SUDIN', 'ADMIN-DINAS', 'ADMIN-TDI')) {
            <button type="button" class="btn btn-sm btn-success px-3" (click)="openDraftModal()">
              <i class="bi bi-pencil-square me-1"></i>Draft BAP Kas &amp; Kertas Kerja
            </button>
          }
          <a class="btn btn-sm btn-success px-3"
             [href]="'/report-server/pdf/form22?sekolahId=' + (auth.selectedSekolahId() || 1) + '&tahun=' + auth.tahunAnggaran() + '&sumberDana=' + sumberDana() + '&kodePeriode=' + kodePeriode"
             target="_blank">
            <i class="bi bi-file-earmark-pdf me-1"></i>Unduh PDF
          </a>
          <a class="btn btn-sm btn-success px-3"
             [href]="'/report-server/excel/bap-kas?sekolahId=' + (auth.selectedSekolahId() || 1) + '&tahun=' + auth.tahunAnggaran() + '&sumberDana=' + sumberDana() + '&kodePeriode=' + kodePeriode"
             target="_blank">
            <i class="bi bi-file-earmark-excel me-1"></i>Unduh XLS
          </a>
          @if (auth.hasRole('PK-NEGERI', 'ADMIN-TDI')) {
            <button type="button" class="btn btn-sm btn-siap px-3"
                    [disabled]="currentBap()?.isTutupBuku"
                    (click)="prosesTutupBku()">
              <i class="bi bi-lock-fill me-1"></i>Proses Tutup BKU
            </button>
          }
        </div>
      </div>

      <div class="p-0">
        <div class="table-responsive">
          <table class="table table-siap table-hover mb-0">
            <thead>
              <tr>
                <th class="text-center" style="width: 50px;">No</th>
                <th>No. BKU</th>
                <th>Tanggal</th>
                <th>Kode Trx</th>
                <th>Uraian Transaksi &amp; Rekanan</th>
                <th class="text-end">Penerimaan</th>
                <th class="text-end">Pengeluaran</th>
                <th>Status BKU</th>
              </tr>
            </thead>
            <tbody>
              @if (bkuRows().length === 0) {
                <tr><td colspan="8" class="text-center py-4 text-muted">Tidak ada transaksi BKU pada periode {{ kodePeriode }}.</td></tr>
              }
              @for (b of bkuRows(); track b.id; let i = $index) {
                <tr>
                  <td class="text-center">{{ i + 1 }}</td>
                  <td>
                    <div class="fw-bold">{{ b.nomorBku }}</div>
                    <small class="text-muted">{{ b.nomorBukti }}</small>
                  </td>
                  <td class="text-nowrap">{{ b.tanggalTransaksi | date:'dd/MM/yyyy' }}</td>
                  <td><app-status-badge kind="trx" [value]="b.kodeTrx" /></td>
                  <td>
                    <div class="small fw-medium">{{ b.uraian }}</div>
                    <small class="text-muted">{{ b.namaRekanan }}</small>
                  </td>
                  <td class="text-end text-success fw-semibold tabular-nums">{{ b.nilaiBrutoMasuk | currency:'IDR':'symbol':'1.0-0' }}</td>
                  <td class="text-end text-danger fw-semibold tabular-nums">{{ b.nilaiBrutoKeluar | currency:'IDR':'symbol':'1.0-0' }}</td>
                  <td>
                    <app-status-badge kind="bku" [value]="b.statusBku" />
                    @if (b.isTutupBuku) {
                      <span class="badge text-bg-dark ms-1">Locked</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
            @if (bkuRows().length > 0) {
              <tfoot class="table-light fw-bold">
                <tr>
                  <td colspan="5" class="text-end">Total Penerimaan / Pengeluaran Periode {{ kodePeriode }}</td>
                  <td class="text-end text-success tabular-nums">{{ totalMasuk() | currency:'IDR':'symbol':'1.0-0' }}</td>
                  <td class="text-end text-danger tabular-nums">{{ totalKeluar() | currency:'IDR':'symbol':'1.0-0' }}</td>
                  <td class="text-end tabular-nums">Saldo: {{ (totalMasuk() - totalKeluar()) | currency:'IDR':'symbol':'1.0-0' }}</td>
                </tr>
              </tfoot>
            }
          </table>
        </div>
      </div>
    </div>

    <!-- Modal Detail Draft / Tutup BKU (Kertas Kerja Rekonsiliasi BAP Kas) -->
    @if (showDraftModal()) {
      <div class="modal-backdrop-custom">
        <div class="modal-dialog-custom" style="max-width: 820px;">
          <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
            <h5 class="mb-0 fw-bold">Detail Draft / Tutup BKU — Periode {{ kodePeriode }} ({{ sumberDana() }})</h5>
            <button type="button" class="btn-close" (click)="showDraftModal.set(false)"></button>
          </div>
          <div class="modal-body-scroll">
            <div class="row g-3 mb-3">
              <div class="col-md-6">
                <label class="form-label small fw-bold">Nomor BAP Kas</label>
                <input type="text" class="form-control form-control-sm" [(ngModel)]="bapForm.nomorBap" readonly>
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-bold">Tanggal BAP / Tutup Buku</label>
                <input type="date" class="form-control form-control-sm" [(ngModel)]="bapForm.tanggalBap">
              </div>
              <div class="col-md-4">
                <label class="form-label small fw-bold">Saldo Rekening Bank (Rp)</label>
                <input type="number" class="form-control form-control-sm" [(ngModel)]="bapForm.saldoRekeningKoran">
              </div>
              <div class="col-md-4">
                <label class="form-label small fw-bold">Saldo Kas Tunai (Rp)</label>
                <input type="text" class="form-control form-control-sm bg-light fw-bold"
                       [value]="calcTunai() | currency:'IDR':'symbol':'1.0-0'" readonly>
              </div>
              <div class="col-md-4">
                <label class="form-label small fw-bold">Selisih Terhadap BKU</label>
                <input type="text" class="form-control form-control-sm bg-light fw-bold"
                       [value]="((bapForm.saldoRekeningKoran + calcTunai()) - (totalMasuk() - totalKeluar())) | currency:'IDR':'symbol':'1.0-0'" readonly>
              </div>
            </div>

            <div class="p-3 rounded-3 border bg-light mb-3">
              <div class="small fw-bold mb-2">Rincian Pecahan Uang Kas Tunai</div>
              <div class="row g-2 small">
                <div class="col-6 col-sm-3"><label>Rp 100.000</label><input type="number" min="0" class="form-control form-control-sm" [(ngModel)]="bapForm.pecahan100rb"></div>
                <div class="col-6 col-sm-3"><label>Rp 50.000</label><input type="number" min="0" class="form-control form-control-sm" [(ngModel)]="bapForm.pecahan50rb"></div>
                <div class="col-6 col-sm-3"><label>Rp 20.000</label><input type="number" min="0" class="form-control form-control-sm" [(ngModel)]="bapForm.pecahan20rb"></div>
                <div class="col-6 col-sm-3"><label>Rp 10.000</label><input type="number" min="0" class="form-control form-control-sm" [(ngModel)]="bapForm.pecahan10rb"></div>
                <div class="col-6 col-sm-3"><label>Rp 5.000</label><input type="number" min="0" class="form-control form-control-sm" [(ngModel)]="bapForm.pecahan5rb"></div>
                <div class="col-6 col-sm-3"><label>Rp 2.000</label><input type="number" min="0" class="form-control form-control-sm" [(ngModel)]="bapForm.pecahan2rb"></div>
                <div class="col-6 col-sm-3"><label>Rp 1.000</label><input type="number" min="0" class="form-control form-control-sm" [(ngModel)]="bapForm.pecahan1rb"></div>
              </div>
            </div>

            <div>
              <label class="form-label small fw-bold">Keterangan Rekonsiliasi / Penjelasan Selisih</label>
              <textarea class="form-control form-control-sm" rows="2" [(ngModel)]="bapForm.keteranganSelisih"></textarea>
            </div>
          </div>
          <div class="p-3 border-top bg-light d-flex flex-wrap justify-content-between gap-2">
            <div class="d-flex gap-2">
              @if (currentBap(); as cb) {
                @if (cb.statusBap === 0 && auth.hasRole('PA-NEGERI', 'ADMIN-TDI')) {
                  <button type="button" class="btn btn-sm btn-primary" (click)="approveBap(cb.id, 1)">Setujui PA</button>
                }
                @if (cb.statusBap === 1 && auth.hasRole('SUDIN', 'ADMIN-DINAS', 'ADMIN-TDI')) {
                  <button type="button" class="btn btn-sm btn-warning fw-semibold" (click)="approveBap(cb.id, 2)">Setujui Sudin/Dinas</button>
                }
              }
            </div>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-sm btn-dark" (click)="showDraftModal.set(false)">Tutup</button>
              @if (auth.hasRole('PK-NEGERI', 'ADMIN-TDI')) {
                <button type="button" class="btn btn-sm btn-siap px-4" (click)="simpanDraftBap()">Simpan Draft BAP Kas</button>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class TutupBkuComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly sumberDana = signal<'BOS' | 'BOP'>('BOS');
  readonly bkuList = signal<BkuTransaction[]>([]);
  readonly bapList = signal<BapKasReport[]>([]);
  readonly showDraftModal = signal(false);

  kodePeriode = '01';

  bapForm = {
    nomorBap: '',
    tanggalBap: new Date().toISOString().slice(0, 10),
    saldoRekeningKoran: 0,
    pecahan100rb: 0,
    pecahan50rb: 0,
    pecahan20rb: 0,
    pecahan10rb: 0,
    pecahan5rb: 0,
    pecahan2rb: 0,
    pecahan1rb: 0,
    keteranganSelisih: 'Saldo BKU sesuai dengan Rekening Koran Bank DKI.'
  };

  readonly periodeOptions = computed(() =>
    this.sumberDana() === 'BOP'
      ? [
          { kode: 'TW1', label: 'Triwulan TW1' },
          { kode: 'TW2', label: 'Triwulan TW2' },
          { kode: 'TW3', label: 'Triwulan TW3' },
          { kode: 'TW4', label: 'Triwulan TW4' }
        ]
      : [
          { kode: '01', label: 'Periode 01 (Januari / Tahap 1)' },
          { kode: '02', label: 'Periode 02 (Februari / Tahap 2)' },
          { kode: '03', label: 'Periode 03 (Maret)' },
          { kode: '04', label: 'Periode 04 (April)' }
        ]
  );

  readonly bkuRows = computed(() =>
    this.bkuList().filter((b) => !this.kodePeriode || b.kodePeriode === this.kodePeriode || b.kodePeriode === `0${Number(this.kodePeriode)}`)
  );
  readonly totalMasuk = computed(() => this.bkuRows().reduce((a, b) => a + (b.nilaiBrutoMasuk || 0), 0));
  readonly totalKeluar = computed(() => this.bkuRows().reduce((a, b) => a + (b.nilaiBrutoKeluar || 0), 0));
  readonly currentBap = computed(() => this.bapList().find((b) => b.kodePeriode === this.kodePeriode) || null);

  ngOnInit(): void {
    const sd = (this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS';
    this.sumberDana.set(sd);
    this.kodePeriode = sd === 'BOP' ? 'TW1' : '01';
    this.loadData();
  }

  loadData(): void {
    const sekId = this.auth.selectedSekolahId() || 1;
    const thn = this.auth.tahunAnggaran();
    const sd = this.sumberDana();
    this.api.getBkuList(sekId, thn, sd).subscribe((r) => {
      if (r.success) this.bkuList.set(r.data || []);
    });
    this.api.getBapKas(sd, sekId, thn).subscribe((r) => {
      if (r.success) this.bapList.set(r.data || []);
    });
  }

  isPeriodeClosed(kode: string): boolean {
    return this.bapList().some((b) => b.kodePeriode === kode && b.isTutupBuku);
  }

  hasBapDraft(kode: string): boolean {
    return this.bapList().some((b) => b.kodePeriode === kode);
  }

  openDraftModal(): void {
    const existing = this.currentBap();
    const sek = this.auth.activeSekolah();
    const activeSaldo = this.sumberDana() === 'BOP' ? (sek?.saldoBop || 0) : (sek?.saldoBos || 0);
    if (existing) {
      this.bapForm = {
        nomorBap: existing.nomorBap,
        tanggalBap: (existing.tanggalBap || '').slice(0, 10),
        saldoRekeningKoran: existing.saldoRekeningKoran,
        pecahan100rb: existing.pecahan100rb,
        pecahan50rb: existing.pecahan50rb,
        pecahan20rb: existing.pecahan20rb,
        pecahan10rb: existing.pecahan10rb,
        pecahan5rb: existing.pecahan5rb,
        pecahan2rb: existing.pecahan2rb,
        pecahan1rb: existing.pecahan1rb,
        keteranganSelisih: existing.keteranganSelisih
      };
    } else {
      this.bapForm.nomorBap = `BAP-KAS/${this.sumberDana()}/${this.auth.tahunAnggaran()}/${this.kodePeriode}`;
      this.bapForm.saldoRekeningKoran = activeSaldo;
    }
    this.showDraftModal.set(true);
  }

  calcTunai(): number {
    return (
      this.bapForm.pecahan100rb * 100000 +
      this.bapForm.pecahan50rb * 50000 +
      this.bapForm.pecahan20rb * 20000 +
      this.bapForm.pecahan10rb * 10000 +
      this.bapForm.pecahan5rb * 5000 +
      this.bapForm.pecahan2rb * 2000 +
      this.bapForm.pecahan1rb * 1000
    );
  }

  simpanDraftBap(): void {
    this.api
      .saveBapKas(this.sumberDana(), {
        sekolahId: this.auth.selectedSekolahId() || 1,
        tahunAnggaran: this.auth.tahunAnggaran(),
        sumberDana: this.sumberDana(),
        kodePeriode: this.kodePeriode,
        ...this.bapForm
      })
      .subscribe((r) => {
        if (r.success) {
          this.toast.success(r.message);
          this.loadData();
        }
      });
  }

  approveBap(id: number, targetStatus: number): void {
    this.api.approveBapKas(this.sumberDana(), id, targetStatus).subscribe((r) => {
      if (r.success) {
        this.toast.success(r.message);
        this.loadData();
      }
    });
  }

  prosesTutupBku(): void {
    this.api
      .tutupBuku(this.sumberDana(), this.auth.selectedSekolahId() || 1, this.auth.tahunAnggaran(), this.kodePeriode)
      .subscribe((r) => {
        if (r.success) {
          this.toast.success(r.message);
          this.loadData();
        }
      });
  }
}
