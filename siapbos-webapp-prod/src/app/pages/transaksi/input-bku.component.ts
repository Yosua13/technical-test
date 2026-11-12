import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { BkuSummarySaldo, BkuTransaction, RkasItem } from '../../core/models/siapbos.models';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-input-bku',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, SekolahBarComponent, StatusBadgeComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="loadAll()" />

    <!-- 6 Summary Saldo Cards (Sesuai bos-input-bku-list) -->
    @if (summary(); as s) {
      <div class="row g-2 mb-3">
        <div class="col-6 col-md-4 col-xl-2">
          <div class="summary-kpi-card" style="--kpi-accent: #64748b;">
            <small class="text-muted fw-semibold d-block">Pagu RKAS</small>
            <strong class="tabular-nums">{{ s.totalPaguRkas | currency:'IDR':'symbol':'1.0-0' }}</strong>
          </div>
        </div>
        <div class="col-6 col-md-4 col-xl-2">
          <div class="summary-kpi-card" style="--kpi-accent: #16a34a;">
            <small class="text-muted fw-semibold d-block">Dana Masuk (JO/JG)</small>
            <strong class="text-success tabular-nums">{{ s.totalDanaMasuk | currency:'IDR':'symbol':'1.0-0' }}</strong>
          </div>
        </div>
        <div class="col-6 col-md-4 col-xl-2">
          <div class="summary-kpi-card" style="--kpi-accent: #2563eb;">
            <small class="text-muted fw-semibold d-block">Belanja SPJ (JJ/ST)</small>
            <strong class="text-primary tabular-nums">{{ s.totalBelanjaSpj | currency:'IDR':'symbol':'1.0-0' }}</strong>
          </div>
        </div>
        <div class="col-6 col-md-4 col-xl-2">
          <div class="summary-kpi-card" style="--kpi-accent: #ff9a00;">
            <small class="text-muted fw-semibold d-block">Sisa Kas Bank</small>
            <strong class="text-warning-emphasis tabular-nums">{{ s.sisaKasBank | currency:'IDR':'symbol':'1.0-0' }}</strong>
          </div>
        </div>
        <div class="col-6 col-md-4 col-xl-2">
          <div class="summary-kpi-card" style="--kpi-accent: #eab308;">
            <small class="text-muted fw-semibold d-block">Pajak Dipungut</small>
            <strong class="tabular-nums">{{ s.totalPajakDipungut | currency:'IDR':'symbol':'1.0-0' }}</strong>
          </div>
        </div>
        <div class="col-6 col-md-4 col-xl-2">
          <div class="summary-kpi-card" style="--kpi-accent: #0d9488;">
            <small class="text-muted fw-semibold d-block">Pajak Lunas NTPN</small>
            <strong class="text-teal tabular-nums">{{ s.totalPajakDisetor | currency:'IDR':'symbol':'1.0-0' }}</strong>
          </div>
        </div>
      </div>
    }

    <!-- BKU Toolbar & Table -->
    <div class="siap-card">
      <div class="siap-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div class="d-flex flex-wrap align-items-center gap-2">
          <select class="form-select form-select-sm" style="width: 170px;" [ngModel]="filterTrx()" (ngModelChange)="filterTrx.set($event); loadBku()">
            <option value="">Semua Kode Trx</option>
            <option value="JO">JO · Dropping Masuk</option>
            <option value="JJ">JJ · Belanja SPJ</option>
            <option value="JG">JG · Jasa Giro</option>
            <option value="ST">ST · Setoran STS</option>
          </select>
          <input type="text" class="form-control form-control-sm" style="width: 220px;"
                 placeholder="Cari No. BKU / Rekanan..." [ngModel]="searchText()" (ngModelChange)="searchText.set($event)">
        </div>

        <div class="d-flex flex-wrap gap-2">
          <button class="btn btn-sm btn-siap rounded-pill px-3" (click)="openAddSpjModal()">
            <i class="bi bi-plus-circle me-1"></i>Input Belanja SPJ (JJ)
          </button>
          <button class="btn btn-sm btn-outline-info rounded-pill px-3 fw-semibold" (click)="showJasaGiroModal.set(true)">
            <i class="bi bi-piggy-bank me-1"></i>Catat Jasa Giro (JG)
          </button>
          <a class="btn btn-sm btn-outline-danger rounded-pill px-3 fw-semibold"
             [href]="'/report-server/pdf/form22?sekolahId=' + auth.selectedSekolahId() + '&tahun=' + auth.tahunAnggaran() + '&sumberDana=' + sumberDana()"
             target="_blank">
            <i class="bi bi-file-earmark-pdf me-1"></i>Cetak Form 22
          </a>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table table-siap table-hover">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>No. BKU &amp; Bukti</th>
              <th>Jenis</th>
              <th>Uraian &amp; Rekanan</th>
              <th class="text-end">Masuk</th>
              <th class="text-end">Bruto Keluar</th>
              <th class="text-end">Pajak</th>
              <th class="text-end">Netto Transfer</th>
              <th>Status</th>
              <th class="text-end">Aksi</th>
            </tr>
          </thead>
          <tbody>
            @for (b of filteredBku(); track b.id) {
              <tr>
                <td class="text-nowrap">{{ b.tanggalTransaksi | date:'dd/MM/yyyy' }}</td>
                <td>
                  <div class="fw-bold text-dark">{{ b.nomorBku }}</div>
                  <small class="text-muted">{{ b.nomorBukti }}</small>
                </td>
                <td><app-status-badge kind="trx" [value]="b.kodeTrx" /></td>
                <td style="min-width: 220px;">
                  <div class="fw-medium">{{ b.uraian }}</div>
                  <small class="text-muted">{{ b.namaRekanan }} ({{ b.namaBankRekanan }} {{ b.noRekRekanan }})</small>
                </td>
                <td class="text-end text-success fw-semibold tabular-nums">
                  {{ b.nilaiBrutoMasuk > 0 ? (b.nilaiBrutoMasuk | currency:'IDR':'symbol':'1.0-0') : '-' }}
                </td>
                <td class="text-end text-danger fw-semibold tabular-nums">
                  {{ b.nilaiBrutoKeluar > 0 ? (b.nilaiBrutoKeluar | currency:'IDR':'symbol':'1.0-0') : '-' }}
                </td>
                <td class="text-end tabular-nums">
                  {{ b.totalPotonganPajak > 0 ? (b.totalPotonganPajak | currency:'IDR':'symbol':'1.0-0') : '-' }}
                </td>
                <td class="text-end fw-bold tabular-nums">
                  {{ b.nilaiNettoTransfer > 0 ? (b.nilaiNettoTransfer | currency:'IDR':'symbol':'1.0-0') : '-' }}
                </td>
                <td>
                  <app-status-badge kind="bku" [value]="b.statusBku" />
                  @if (b.isTutupBuku) {
                    <span class="badge text-bg-dark ms-1"><i class="bi bi-lock-fill"></i> Tutup Buku</span>
                  }
                </td>
                <td class="text-end text-nowrap">
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-secondary" title="Detail BKU" (click)="selectedDetail.set(b)">
                      <i class="bi bi-eye"></i>
                    </button>
                    @if (b.fileLampiranPath) {
                      <a class="btn btn-outline-info" title="Preview Invoice PDF" [href]="b.fileLampiranPath" target="_blank">
                        <i class="bi bi-file-pdf"></i>
                      </a>
                    }
                    @if (b.kodeTrx === 'JJ') {
                      <a class="btn btn-outline-danger" title="Cetak SPJ PDF" [href]="'/report-server/pdf/spj/' + b.id" target="_blank">
                        <i class="bi bi-printer"></i>
                      </a>
                    }
                    @if ((b.statusBku === 0 || b.statusBku === 9) && b.kodeTrx === 'JJ' && !b.isTutupBuku) {
                      <button class="btn btn-outline-primary" title="Ajukan ke Verifikator TU" (click)="ajukan(b)">
                        <i class="bi bi-send"></i>
                      </button>
                      <button class="btn btn-outline-danger" title="Hapus Draft" (click)="hapusDraft(b)">
                        <i class="bi bi-trash"></i>
                      </button>
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Input Belanja SPJ (JJ) dengan Integrasi Dummy Bank DKI, DJP NPWP & Upload PDF -->
    @if (showSpjModal()) {
      <div class="modal-backdrop-custom">
        <div class="modal-dialog-custom" style="max-width: 920px;">
          <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
            <h6 class="mb-0 fw-bold"><i class="bi bi-journal-plus me-2 text-secondary"></i>Input Belanja SPJ {{ sumberDana() }} (Terintegrasi RKAS, Bank DKI &amp; DJP)</h6>
            <button type="button" class="btn-close" (click)="showSpjModal.set(false)"></button>
          </div>
          <div class="modal-body-scroll">
            <div class="row g-3">
              <!-- Metode Pembayaran & Biller Inquiry -->
              <div class="col-md-4">
                <label class="form-label small fw-bold">Periode</label>
                <select class="form-select form-select-sm" [(ngModel)]="spjForm.kodePeriode">
                  @if (sumberDana() === 'BOS') {
                    <option value="01">Tahap 1 (Jan - Jun)</option>
                    <option value="02">Tahap 2 (Jul - Des)</option>
                  } @else {
                    <option value="TW1">Triwulan I (Jan - Mar)</option>
                    <option value="TW2">Triwulan II (Apr - Jun)</option>
                  }
                </select>
              </div>
              <div class="col-md-4">
                <label class="form-label small fw-bold">Tanggal Transaksi</label>
                <input type="date" class="form-control form-control-sm" [(ngModel)]="spjForm.tanggalTransaksi">
              </div>
              <div class="col-md-4">
                <label class="form-label small fw-bold">No. Bukti / Kwitansi</label>
                <input type="text" class="form-control form-control-sm" [(ngModel)]="spjForm.nomorBukti" placeholder="Contoh: INV/2026/099">
              </div>

              <div class="col-md-5">
                <label class="form-label small fw-bold">Metode Pembayaran</label>
                <select class="form-select form-select-sm" [(ngModel)]="spjForm.jenisPembayaran">
                  <option value="TRANSFER">Transfer Reguler (CMS Bank DKI / SKN)</option>
                  <option value="VA_PLN">Virtual Account PLN (Listrik Sekolah)</option>
                  <option value="E_ORDER">Marketplace e-Order DKI Jakarta</option>
                </select>
              </div>
              @if (spjForm.jenisPembayaran !== 'TRANSFER') {
                <div class="col-md-7">
                  <label class="form-label small fw-bold">Nomor {{ spjForm.jenisPembayaran === 'VA_PLN' ? 'ID Pelanggan PLN' : 'Pesanan e-Order' }}</label>
                  <div class="input-group input-group-sm">
                    <input type="text" class="form-control" [(ngModel)]="spjForm.noVaAtauPesanan" placeholder="Contoh: 541100229988 atau EORD-2026-01">
                    <button class="btn btn-warning fw-semibold" type="button" (click)="cekBiller()">
                      <i class="bi bi-search me-1"></i>Inquiry Biller Bank DKI
                    </button>
                  </div>
                </div>
              }

              <!-- Pemilihan Item RKAS -->
              <div class="col-12">
                <div class="p-3 rounded-3 bg-light border">
                  <label class="form-label small fw-bold text-primary mb-2">1. Pilih Komponen Anggaran RKAS {{ sumberDana() }}</label>
                  <div class="row g-2 align-items-end">
                    <div class="col-md-6">
                      <select class="form-select form-select-sm" [(ngModel)]="selectedRkasId" (ngModelChange)="onSelectRkas($event)">
                        <option [ngValue]="0">-- Pilih Komponen RKAS --</option>
                        @for (r of rkasItems(); track r.id) {
                          <option [ngValue]="r.id">
                            {{ r.namaKomponen }} (Sisa Pagu: {{ (r.totalPagu - r.totalRealisasi) | currency:'IDR':'symbol':'1.0-0' }})
                          </option>
                        }
                      </select>
                    </div>
                    <div class="col-md-2">
                      <label class="small text-muted">Volume</label>
                      <input type="number" class="form-control form-control-sm" [(ngModel)]="spjForm.volume" min="1">
                    </div>
                    <div class="col-md-4">
                      <label class="small text-muted">Harga Satuan (Rp)</label>
                      <input type="number" class="form-control form-control-sm" [(ngModel)]="spjForm.hargaSatuan" min="0">
                    </div>
                  </div>
                  <div class="mt-2 small fw-semibold text-end">
                    Bruto Belanja: <span class="text-danger fs-6">{{ calcBruto() | currency:'IDR':'symbol':'1.0-0' }}</span>
                  </div>
                </div>
              </div>

              <div class="col-12">
                <label class="form-label small fw-bold">Uraian Transaksi Belanja</label>
                <input type="text" class="form-control form-control-sm" [(ngModel)]="spjForm.uraian" placeholder="Jelaskan detail pengadaan barang/jasa...">
              </div>

              <!-- Identitas Rekanan + Inquiry Bank DKI + Inquiry NPWP DJP -->
              <div class="col-12">
                <div class="p-3 rounded-3 border">
                  <div class="small fw-bold text-dark mb-2">2. Validasi Rekening Bank DKI &amp; NPWP Rekanan</div>
                  <div class="row g-2">
                    <div class="col-md-4">
                      <label class="small text-muted">Bank Penerima</label>
                      <select class="form-select form-select-sm" [(ngModel)]="spjForm.kodeBankRekanan">
                        <option value="111">111 · Bank DKI (Overbooking)</option>
                        <option value="014">014 · Bank BCA (SKN/BI-FAST)</option>
                        <option value="008">008 · Bank Mandiri</option>
                        <option value="002">002 · Bank BRI</option>
                        <option value="009">009 · Bank BNI</option>
                      </select>
                    </div>
                    <div class="col-md-5">
                      <label class="small text-muted">Nomor Rekening Rekanan (Tip: awali 999 untuk simulasi gagal)</label>
                      <div class="input-group input-group-sm">
                        <input type="text" class="form-control" [(ngModel)]="spjForm.noRekRekanan" placeholder="1110099887766">
                        <button class="btn btn-outline-warning fw-semibold" type="button" (click)="cekRekening()">Cek Rekening</button>
                      </div>
                    </div>
                    <div class="col-md-3">
                      <label class="small text-muted">Nama Rekanan / Pemilik Rek.</label>
                      <input type="text" class="form-control form-control-sm" [(ngModel)]="spjForm.namaRekanan">
                    </div>
                    <div class="col-md-6">
                      <label class="small text-muted">NPWP Rekanan (15/16 Digit)</label>
                      <div class="input-group input-group-sm">
                        <input type="text" class="form-control" [(ngModel)]="spjForm.npwpRekanan" placeholder="01.345.678.9-022.000">
                        <button class="btn btn-outline-primary fw-semibold" type="button" (click)="cekNpwp()">Cek NPWP DJP</button>
                      </div>
                    </div>
                    <div class="col-md-6">
                      <label class="small text-muted">Nama Wajib Pajak (DJP)</label>
                      <input type="text" class="form-control form-control-sm" [(ngModel)]="spjForm.namaWpRekanan">
                    </div>
                  </div>
                </div>
              </div>

              <!-- Potongan Pajak & Upload Bukti -->
              <div class="col-md-7">
                <div class="p-3 rounded-3 border h-100">
                  <div class="small fw-bold mb-2">3. Potongan Pajak Otomatis (PPh / PPN)</div>
                  <div class="d-flex flex-wrap gap-3 small">
                    <label class="form-check-label d-flex align-items-center gap-1">
                      <input type="checkbox" class="form-check-input" [(ngModel)]="taxSelection.ppn"> PPN (11%)
                    </label>
                    <label class="form-check-label d-flex align-items-center gap-1">
                      <input type="checkbox" class="form-check-input" [(ngModel)]="taxSelection.pph22"> PPh 22 (1.5%)
                    </label>
                    <label class="form-check-label d-flex align-items-center gap-1">
                      <input type="checkbox" class="form-check-input" [(ngModel)]="taxSelection.pph23"> PPh 23 (2%)
                    </label>
                    <label class="form-check-label d-flex align-items-center gap-1">
                      <input type="checkbox" class="form-check-input" [(ngModel)]="taxSelection.pph21"> PPh 21 (5%)
                    </label>
                  </div>
                  <div class="mt-2 pt-2 border-top d-flex justify-content-between small">
                    <span>Total Pajak: <strong>{{ calcTotalPajak() | currency:'IDR':'symbol':'1.0-0' }}</strong></span>
                    <span>Netto Transfer Rekanan: <strong class="text-success">{{ (calcBruto() - calcTotalPajak()) | currency:'IDR':'symbol':'1.0-0' }}</strong></span>
                  </div>
                </div>
              </div>

              <div class="col-md-5">
                <div class="p-3 rounded-3 border h-100">
                  <div class="small fw-bold mb-2">4. Unggah Bukti Invoice / BAST (PDF)</div>
                  <input type="file" class="form-control form-control-sm" accept=".pdf,.png,.jpg" (change)="onFileUpload($event)">
                  @if (spjForm.fileLampiranName) {
                    <div class="small text-success mt-2"><i class="bi bi-check-circle-fill me-1"></i>{{ spjForm.fileLampiranName }}</div>
                  }
                </div>
              </div>
            </div>
          </div>
          <div class="p-3 border-top bg-light d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-light" (click)="showSpjModal.set(false)">Batal</button>
            <button type="button" class="btn btn-siap px-4" (click)="saveSpj()" [disabled]="saving()">
              @if (saving()) { <span class="spinner-border spinner-border-sm me-1"></span> }
              Simpan BKU (Draft)
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal Catat Jasa Giro -->
    @if (showJasaGiroModal()) {
      <div class="modal-backdrop-custom">
        <div class="modal-dialog-custom" style="max-width: 480px;">
          <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
            <h6 class="mb-0 fw-bold">Catat Jasa Giro Bank DKI (JG)</h6>
            <button type="button" class="btn-close" (click)="showJasaGiroModal.set(false)"></button>
          </div>
          <div class="modal-body-scroll">
            <div class="mb-3">
              <label class="form-label small fw-semibold">Uraian Penerimaan Jasa Giro</label>
              <input type="text" class="form-control" [(ngModel)]="jgForm.uraian">
            </div>
            <div class="mb-3">
              <label class="form-label small fw-semibold">Nominal Bunga / Jasa Giro (Rp)</label>
              <input type="number" class="form-control" [(ngModel)]="jgForm.nominal" min="1000">
            </div>
          </div>
          <div class="p-3 border-top bg-light d-flex justify-content-end gap-2">
            <button class="btn btn-light" (click)="showJasaGiroModal.set(false)">Batal</button>
            <button class="btn btn-siap" (click)="saveJasaGiro()">Simpan Jasa Giro</button>
          </div>
        </div>
      </div>
    }

    <!-- Modal Detail Transaksi BKU -->
    @if (selectedDetail(); as d) {
      <div class="modal-backdrop-custom">
        <div class="modal-dialog-custom" style="max-width: 680px;">
          <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
            <h6 class="mb-0 fw-bold">Detail Transaksi {{ d.nomorBku }}</h6>
            <button type="button" class="btn-close" (click)="selectedDetail.set(null)"></button>
          </div>
          <div class="modal-body-scroll small">
            <div class="row g-2 mb-3">
              <div class="col-6"><strong>Uraian:</strong><br>{{ d.uraian }}</div>
              <div class="col-6"><strong>Status:</strong><br><app-status-badge kind="bku" [value]="d.statusBku" /></div>
              <div class="col-6"><strong>Rekanan:</strong><br>{{ d.namaRekanan }} ({{ d.namaBankRekanan }} {{ d.noRekRekanan }})</div>
              <div class="col-6"><strong>Token / Jurnal Bank DKI:</strong><br>Token: {{ d.tokenOtpPa || '-' }} | Jurnal: {{ d.noJurnalBank || '-' }}</div>
              @if (d.catatanVerifikasi) {
                <div class="col-12 p-2 bg-light rounded border"><strong>Catatan Verifikasi:</strong> {{ d.catatanVerifikasi }}</div>
              }
            </div>
            @if (d.detailItems.length > 0) {
              <div class="fw-bold mb-1">Rincian Item Belanja RKAS:</div>
              <ul class="list-group mb-3">
                @for (item of d.detailItems; track $index) {
                  <li class="list-group-item d-flex justify-content-between">
                    <span>{{ item.namaKomponen }} ({{ item.volume }} {{ item.satuan }} × {{ item.hargaSatuan | currency:'IDR':'symbol':'1.0-0' }})</span>
                    <strong>{{ item.jumlah | currency:'IDR':'symbol':'1.0-0' }}</strong>
                  </li>
                }
              </ul>
            }
            @if (d.taxItems.length > 0) {
              <div class="fw-bold mb-1">Potongan Pajak MPN:</div>
              <ul class="list-group">
                @for (tx of d.taxItems; track $index) {
                  <li class="list-group-item d-flex justify-content-between align-items-center">
                    <span>{{ tx.kodeTrxPajak }} · {{ tx.namaPajak }} (Billing: {{ tx.kodeBilling || '-' }} | NTPN: {{ tx.ntpn || '-' }})</span>
                    <strong>{{ tx.nilaiPajak | currency:'IDR':'symbol':'1.0-0' }}</strong>
                  </li>
                }
              </ul>
            }
          </div>
          <div class="p-3 border-top bg-light text-end">
            <button class="btn btn-secondary btn-sm" (click)="selectedDetail.set(null)">Tutup</button>
          </div>
        </div>
      </div>
    }
  `
})
export class InputBkuComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly sumberDana = signal<'BOS' | 'BOP'>('BOS');
  readonly summary = signal<BkuSummarySaldo | null>(null);
  readonly bkuList = signal<BkuTransaction[]>([]);
  readonly rkasItems = signal<RkasItem[]>([]);
  readonly filterTrx = signal('');
  readonly searchText = signal('');

  readonly showSpjModal = signal(false);
  readonly showJasaGiroModal = signal(false);
  readonly selectedDetail = signal<BkuTransaction | null>(null);
  readonly saving = signal(false);

  selectedRkasId = 0;
  spjForm: any = {
    kodePeriode: '01',
    tanggalTransaksi: new Date().toISOString().slice(0, 10),
    nomorBukti: '',
    jenisPembayaran: 'TRANSFER',
    noVaAtauPesanan: '',
    uraian: '',
    volume: 1,
    hargaSatuan: 0,
    kodeBankRekanan: '111',
    noRekRekanan: '1110099887766',
    namaRekanan: '',
    npwpRekanan: '01.345.678.9-022.000',
    namaWpRekanan: '',
    fileLampiranName: '',
    fileLampiranPath: ''
  };
  taxSelection = { ppn: true, pph22: false, pph23: true, pph21: false };
  jgForm = { uraian: 'Penerimaan Jasa Giro Rekening Bank DKI Bulan Berjalan', nominal: 125000 };

  readonly filteredBku = computed(() => {
    const q = this.searchText().toLowerCase().trim();
    if (!q) return this.bkuList();
    return this.bkuList().filter(
      (b) =>
        b.nomorBku.toLowerCase().includes(q) ||
        b.uraian.toLowerCase().includes(q) ||
        b.namaRekanan.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    const sd = (this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS';
    this.sumberDana.set(sd);
    this.spjForm.kodePeriode = sd === 'BOP' ? 'TW1' : '01';
    this.loadAll();
  }

  loadAll(): void {
    const sekId = this.auth.selectedSekolahId() || 1;
    const thn = this.auth.tahunAnggaran();
    const sd = this.sumberDana();
    this.api.getSummarySaldo(sekId, thn, sd).subscribe((r) => { if (r.success) this.summary.set(r.data); });
    this.loadBku();
    this.api.getRkasItems(sekId, thn, sd).subscribe((r) => { if (r.success) this.rkasItems.set(r.data); });
  }

  loadBku(): void {
    const sekId = this.auth.selectedSekolahId() || 1;
    this.api.getBkuList(sekId, this.auth.tahunAnggaran(), this.sumberDana(), undefined, this.filterTrx() || undefined).subscribe({
      next: (r) => { if (r.success) this.bkuList.set(r.data); }
    });
  }

  openAddSpjModal(): void {
    this.spjForm.kodePeriode = this.sumberDana() === 'BOP' ? 'TW1' : '01';
    this.showSpjModal.set(true);
  }

  onSelectRkas(id: number): void {
    const item = this.rkasItems().find((x) => x.id === Number(id));
    if (item) {
      this.spjForm.hargaSatuan = item.hargaSatuan;
      this.spjForm.volume = 1;
      this.spjForm.uraian = `Pengadaan ${item.namaKomponen}`;
    }
  }

  calcBruto(): number {
    return Math.round((Number(this.spjForm.volume) || 0) * (Number(this.spjForm.hargaSatuan) || 0));
  }

  calcTotalPajak(): number {
    const bruto = this.calcBruto();
    let tot = 0;
    const dpp = this.taxSelection.ppn ? Math.round(bruto / 1.11) : bruto;
    if (this.taxSelection.ppn) tot += Math.round(dpp * 0.11);
    if (this.taxSelection.pph22) tot += Math.round(dpp * 0.015);
    if (this.taxSelection.pph23) tot += Math.round(dpp * 0.02);
    if (this.taxSelection.pph21) tot += Math.round(dpp * 0.05);
    return tot;
  }

  cekRekening(): void {
    this.api.inquiryRekening(this.spjForm.kodeBankRekanan, this.spjForm.noRekRekanan).subscribe((res) => {
      if (res.data?.responseCode === '00') {
        this.spjForm.namaRekanan = res.data.namaPemilikRekening;
        this.toast.success(`Rekening Valid (${res.data.namaBank}): ${res.data.namaPemilikRekening}`);
      } else {
        this.toast.error(res.data?.responseMessage || 'Rekening tidak ditemukan.');
      }
    });
  }

  cekNpwp(): void {
    this.api.inquiryNpwp(this.spjForm.npwpRekanan).subscribe((res) => {
      if (res.data?.responseCode === '00') {
        this.spjForm.namaWpRekanan = res.data.namaWajibPajak;
        this.toast.success(`NPWP Valid: ${res.data.namaWajibPajak}`);
      } else {
        this.toast.error(res.data?.responseMessage || 'NPWP tidak valid.');
      }
    });
  }

  cekBiller(): void {
    if (!this.spjForm.noVaAtauPesanan) {
      this.toast.warning('Isi nomor tagihan VA PLN atau e-Order terlebih dahulu.');
      return;
    }
    this.api.inquiryBiller(this.spjForm.jenisPembayaran, this.spjForm.noVaAtauPesanan).subscribe((res) => {
      if (res.data?.responseCode === '00') {
        this.spjForm.uraian = res.data.uraian;
        this.spjForm.namaRekanan = res.data.namaPelangganAtauMerchant;
        this.spjForm.noRekRekanan = res.data.noRekTujuan;
        this.spjForm.npwpRekanan = res.data.npwpTujuan;
        this.spjForm.volume = 1;
        this.spjForm.hargaSatuan = res.data.nominalTagihan;
        this.toast.success(`Inquiry Biller Bank DKI sukses: Nominal Rp ${res.data.nominalTagihan.toLocaleString('id-ID')}`);
      }
    });
  }

  onFileUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.api.uploadInvoicePdf(file).subscribe((res) => {
      if (res.success) {
        this.spjForm.fileLampiranName = res.data.originalName;
        this.spjForm.fileLampiranPath = res.data.previewUrl;
        this.toast.success('File lampiran berhasil diunggah ke Storage.');
      }
    });
  }

  saveSpj(): void {
    const rkas = this.rkasItems().find((x) => x.id === Number(this.selectedRkasId));
    if (!rkas) {
      this.toast.warning('Silakan pilih Komponen RKAS terlebih dahulu.');
      return;
    }
    const bruto = this.calcBruto();
    const dpp = this.taxSelection.ppn ? Math.round(bruto / 1.11) : bruto;
    const taxItems: any[] = [];
    if (this.taxSelection.ppn) taxItems.push({ kodeTrxPajak: 'P5', dasarPengenaanPajak: dpp, tarifPersen: 11, nilaiPajak: Math.round(dpp * 0.11) });
    if (this.taxSelection.pph22) taxItems.push({ kodeTrxPajak: 'P2', dasarPengenaanPajak: dpp, tarifPersen: 1.5, nilaiPajak: Math.round(dpp * 0.015) });
    if (this.taxSelection.pph23) taxItems.push({ kodeTrxPajak: 'P3', dasarPengenaanPajak: dpp, tarifPersen: 2, nilaiPajak: Math.round(dpp * 0.02) });
    if (this.taxSelection.pph21) taxItems.push({ kodeTrxPajak: 'P1', dasarPengenaanPajak: dpp, tarifPersen: 5, nilaiPajak: Math.round(dpp * 0.05) });

    this.saving.set(true);
    this.api
      .createBku(this.sumberDana(), {
        sekolahId: this.auth.selectedSekolahId() || 1,
        tahunAnggaran: this.auth.tahunAnggaran(),
        sumberDana: this.sumberDana(),
        kodePeriode: this.spjForm.kodePeriode,
        tanggalTransaksi: this.spjForm.tanggalTransaksi,
        nomorBukti: this.spjForm.nomorBukti,
        kodeTrx: 'JJ',
        jenisPembayaran: this.spjForm.jenisPembayaran,
        uraian: this.spjForm.uraian,
        namaRekanan: this.spjForm.namaRekanan || 'Rekanan Terdaftar',
        kodeBankRekanan: this.spjForm.kodeBankRekanan,
        namaBankRekanan: this.spjForm.kodeBankRekanan === '111' ? 'Bank DKI' : 'Bank Nasional',
        noRekRekanan: this.spjForm.noRekRekanan,
        namaPemilikRekRekanan: this.spjForm.namaRekanan || 'Rekanan Terdaftar',
        npwpRekanan: this.spjForm.npwpRekanan,
        namaWpRekanan: this.spjForm.namaWpRekanan || this.spjForm.namaRekanan,
        noVaAtauPesanan: this.spjForm.noVaAtauPesanan,
        fileLampiranName: this.spjForm.fileLampiranName,
        fileLampiranPath: this.spjForm.fileLampiranPath,
        detailItems: [
          {
            rkasItemId: rkas.id,
            kodeKegiatan: rkas.kodeKegiatan,
            namaKegiatan: rkas.namaKegiatan,
            kodeAkun: rkas.kodeAkun,
            namaAkun: rkas.namaAkun,
            kodeKomponen: rkas.kodeKomponen,
            namaKomponen: rkas.namaKomponen,
            spesifikasi: rkas.spesifikasi,
            volume: Number(this.spjForm.volume),
            satuan: rkas.satuan,
            hargaSatuan: Number(this.spjForm.hargaSatuan)
          }
        ],
        taxItems
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          if (res.success) {
            this.toast.success(res.message);
            this.showSpjModal.set(false);
            this.loadAll();
          }
        },
        error: () => this.saving.set(false)
      });
  }

  saveJasaGiro(): void {
    this.api
      .createBku(this.sumberDana(), {
        sekolahId: this.auth.selectedSekolahId() || 1,
        tahunAnggaran: this.auth.tahunAnggaran(),
        sumberDana: this.sumberDana(),
        kodePeriode: this.sumberDana() === 'BOP' ? 'TW1' : '01',
        tanggalTransaksi: new Date().toISOString().slice(0, 10),
        kodeTrx: 'JG',
        uraian: this.jgForm.uraian,
        nominalNonSpj: Number(this.jgForm.nominal),
        namaRekanan: 'PT BANK DKI'
      })
      .subscribe((res) => {
        if (res.success) {
          this.toast.success(res.message);
          this.showJasaGiroModal.set(false);
          this.loadAll();
          this.auth.loadSekolahOptions().subscribe();
        }
      });
  }

  ajukan(b: BkuTransaction): void {
    this.api.ajukanPk(this.sumberDana(), b.id).subscribe((res) => {
      if (res.success) {
        this.toast.success(res.message);
        this.loadAll();
      }
    });
  }

  hapusDraft(b: BkuTransaction): void {
    this.api.deleteDraftBku(this.sumberDana(), b.id).subscribe((res) => {
      if (res.success) {
        this.toast.success(res.message);
        this.loadAll();
      }
    });
  }
}
