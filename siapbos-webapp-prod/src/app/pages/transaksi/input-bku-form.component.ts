import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { BkuTransaction, RkasItem } from '../../core/models/siapbos.models';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-input-bku-form',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, SekolahBarComponent, StatusBadgeComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="onSekolahChanged()" />

    <div class="siap-card">
      <div class="siap-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h5 class="fw-bold mb-0">
            @if (mode() === 'detail') {
              <i class="bi bi-eye me-2 text-warning"></i>Detail Transaksi BKU {{ sumberDana() }}
            } @else if (mode() === 'edit') {
              <i class="bi bi-pencil-square me-2 text-warning"></i>Edit Transaksi BKU {{ sumberDana() }} (Draft PK)
            } @else {
              <i class="bi bi-plus-circle me-2 text-warning"></i>Tambah Transaksi BKU {{ sumberDana() }}
            }
          </h5>
          @if (detail(); as d) {
            <small class="text-muted">No. BKU: <strong>{{ d.nomorBku }}</strong> · Dibuat oleh {{ d.createdBy || 'Bendahara' }}</small>
          }
        </div>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill px-3" (click)="goBack()">
            <i class="bi bi-arrow-left me-1"></i>Kembali
          </button>
          @if (mode() === 'detail' && canEditRecord(detail())) {
            <button type="button" class="btn btn-sm btn-siap rounded-pill px-3" (click)="goToEdit(detail()!.id)">
              <i class="bi bi-pencil me-1"></i>Edit Data
            </button>
          }
        </div>
      </div>

      <div class="p-4">
        @if (loading()) {
          <div class="text-center py-5 text-muted">
            <div class="spinner-border text-warning mb-2"></div>
            <div>Memuat data BKU...</div>
          </div>
        } @else if (mode() === 'detail' && detail(); as b) {
          <!-- READ-ONLY DETAIL VIEW -->
          <div class="row g-3 mb-4">
            <div class="col-md-3">
              <div class="p-3 rounded-3 bg-light border h-100">
                <div class="small text-muted">Nomor BKU / Bukti</div>
                <div class="fw-bold text-dark">{{ b.nomorBku }}</div>
                <div class="small text-muted mt-1">{{ b.nomorBukti }}</div>
                <div class="small mt-1">{{ b.tanggalTransaksi | date:'dd MMM yyyy' }}</div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="p-3 rounded-3 bg-light border h-100">
                <div class="small text-muted mb-1">Kode Transaksi &amp; Status</div>
                <div><app-status-badge kind="trx" [value]="b.kodeTrx" /></div>
                <div class="mt-2"><app-status-badge kind="bku" [value]="b.statusBku" /></div>
                <div class="small text-muted mt-1">Periode: <strong>{{ b.kodePeriode }}</strong></div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="p-3 rounded-3 bg-light border h-100">
                <div class="small text-muted">Ringkasan Nilai</div>
                @if (b.nilaiBrutoMasuk > 0) {
                  <div class="small">Masuk: <strong class="text-success">{{ b.nilaiBrutoMasuk | currency:'IDR':'symbol':'1.0-0' }}</strong></div>
                }
                <div class="small">Bruto Keluar: <strong class="text-danger">{{ b.nilaiBrutoKeluar | currency:'IDR':'symbol':'1.0-0' }}</strong></div>
                <div class="small">Potongan Pajak: <strong>{{ b.totalPotonganPajak | currency:'IDR':'symbol':'1.0-0' }}</strong></div>
                <div class="small mt-1 pt-1 border-top">Netto Transfer: <strong class="text-primary">{{ b.nilaiNettoTransfer | currency:'IDR':'symbol':'1.0-0' }}</strong></div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="p-3 rounded-3 bg-light border h-100">
                <div class="small text-muted">Rekanan &amp; Pembayaran</div>
                <div class="fw-semibold">{{ b.namaRekanan || '-' }}</div>
                <div class="small text-muted">{{ b.namaBankRekanan }} · {{ b.noRekRekanan || '-' }}</div>
                <div class="small text-muted">NPWP: {{ b.npwpRekanan || '-' }}</div>
                @if (b.noJurnalBank) {
                  <div class="small text-success mt-1 fw-semibold">Jurnal: {{ b.noJurnalBank }}</div>
                }
              </div>
            </div>
            <div class="col-12">
              <div class="p-3 rounded-3 border">
                <div class="small text-muted fw-semibold">Uraian Transaksi</div>
                <div class="fw-medium">{{ b.uraian }}</div>
                @if (b.catatanVerifikasi) {
                  <div class="small text-muted mt-1">Catatan Verifikasi: <em>{{ b.catatanVerifikasi }}</em></div>
                }
                @if (b.fileLampiranPath) {
                  <div class="mt-2">
                    <a class="btn btn-sm btn-outline-info" [href]="b.fileLampiranPath" target="_blank">
                      <i class="bi bi-file-earmark-pdf me-1"></i>Lihat Lampiran ({{ b.fileLampiranName || 'Dokumen' }})
                    </a>
                  </div>
                }
              </div>
            </div>
          </div>

          <h6 class="fw-bold mb-2">Rincian Item Belanja (RKAS)</h6>
          <div class="table-responsive mb-4">
            <table class="table table-sm table-bordered align-middle">
              <thead class="table-light">
                <tr>
                  <th>Kode Kegiatan</th>
                  <th>Nama Kegiatan</th>
                  <th>Kode Akun</th>
                  <th>Komponen</th>
                  <th class="text-end">Volume</th>
                  <th class="text-end">Harga Satuan</th>
                  <th class="text-end">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                @if (!b.detailItems || b.detailItems.length === 0) {
                  <tr><td colspan="7" class="text-center text-muted py-3">Tidak ada rincian item RKAS (transaksi non-SPJ).</td></tr>
                }
                @for (d of b.detailItems; track d.id) {
                  <tr>
                    <td>{{ d.kodeKegiatan }}</td>
                    <td>{{ d.namaKegiatan }}</td>
                    <td>{{ d.kodeAkun }}</td>
                    <td>
                      <div class="fw-semibold">{{ d.namaKomponen }}</div>
                      <small class="text-muted">{{ d.spesifikasi }}</small>
                    </td>
                    <td class="text-end tabular-nums">{{ d.volume }} {{ d.satuan }}</td>
                    <td class="text-end tabular-nums">{{ d.hargaSatuan | currency:'IDR':'symbol':'1.0-0' }}</td>
                    <td class="text-end fw-bold tabular-nums">{{ d.jumlah | currency:'IDR':'symbol':'1.0-0' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <h6 class="fw-bold mb-2">Rincian Potongan Pajak (MPN)</h6>
          <div class="table-responsive mb-4">
            <table class="table table-sm table-bordered align-middle">
              <thead class="table-light">
                <tr>
                  <th>Kode Pajak</th>
                  <th>Nama Pajak</th>
                  <th class="text-end">DPP</th>
                  <th class="text-end">Tarif</th>
                  <th class="text-end">Nilai Pajak</th>
                  <th>Kode Billing / NTPN</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @if (!b.taxItems || b.taxItems.length === 0) {
                  <tr><td colspan="7" class="text-center text-muted py-3">Tidak ada potongan pajak pada transaksi ini.</td></tr>
                }
                @for (t of b.taxItems; track t.id) {
                  <tr>
                    <td><span class="badge text-bg-light border">{{ t.kodeTrxPajak }}</span></td>
                    <td>{{ t.namaPajak }}</td>
                    <td class="text-end tabular-nums">{{ t.dasarPengenaanPajak | currency:'IDR':'symbol':'1.0-0' }}</td>
                    <td class="text-end tabular-nums">{{ t.tarifPersen }}%</td>
                    <td class="text-end fw-bold tabular-nums">{{ t.nilaiPajak | currency:'IDR':'symbol':'1.0-0' }}</td>
                    <td class="small">{{ t.kodeBilling || '-' }} / {{ t.ntpn || '-' }}</td>
                    <td><app-status-badge kind="tax" [value]="t.statusPajak ?? 0" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="p-3 rounded-3 bg-light border small d-flex flex-wrap gap-4">
            <div><span class="text-muted">Diajukan PK:</span> <strong>{{ b.submittedAt ? (b.submittedAt | date:'dd/MM/yyyy HH:mm') : '-' }}</strong></div>
            <div><span class="text-muted">Disetujui TU:</span> <strong>{{ b.approvedByTuAt ? (b.approvedByTuAt | date:'dd/MM/yyyy HH:mm') : '-' }}</strong></div>
            <div><span class="text-muted">Disetujui PA:</span> <strong>{{ b.approvedByPaAt ? (b.approvedByPaAt | date:'dd/MM/yyyy HH:mm') : '-' }}</strong></div>
            <div><span class="text-muted">Transfer Bank DKI:</span> <strong>{{ b.tanggalTransferBank ? (b.tanggalTransferBank | date:'dd/MM/yyyy HH:mm') : '-' }}</strong></div>
          </div>
        } @else {
          <!-- TAMBAH / EDIT FORM VIEW (STRICTLY JO, JJ, P1..P7 ONLY; NO APPROVAL BUTTON) -->
          <div class="row g-3">
            <div class="col-md-3">
              <label class="form-label small fw-bold">Kode Transaksi BKU</label>
              <select class="form-select form-select-sm" [(ngModel)]="spjForm.kodeTrx" [disabled]="mode() === 'edit'">
                <option value="JJ">JJ · Belanja SPJ</option>
                <option value="JO">JO · Dropping Masuk</option>
                <option value="P1">P1 · Pajak PPh Pasal 21</option>
                <option value="P2">P2 · Pajak PPh Pasal 22</option>
                <option value="P3">P3 · Pajak PPh Pasal 23</option>
                <option value="P4">P4 · Pajak PPh Pasal 4(2)</option>
                <option value="P5">P5 · Pajak PPN</option>
                <option value="P6">P6 · Pajak PPh Pasal 26</option>
                <option value="P7">P7 · Pajak PPh Pasal 15</option>
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label small fw-bold">Periode</label>
              <select class="form-select form-select-sm" [(ngModel)]="spjForm.kodePeriode">
                @if (sumberDana() === 'BOS') {
                  <option value="01">Tahap 1 (Jan - Jun)</option>
                  <option value="02">Tahap 2 (Jul - Des)</option>
                } @else {
                  <option value="TW1">Triwulan I (Jan - Mar)</option>
                  <option value="TW2">Triwulan II (Apr - Jun)</option>
                  <option value="TW3">Triwulan III (Jul - Sep)</option>
                  <option value="TW4">Triwulan IV (Okt - Des)</option>
                }
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label small fw-bold">Tanggal Transaksi</label>
              <input type="date" class="form-control form-control-sm" [(ngModel)]="spjForm.tanggalTransaksi">
            </div>
            <div class="col-md-3">
              <label class="form-label small fw-bold">No. Bukti / Kwitansi</label>
              <input type="text" class="form-control form-control-sm" [(ngModel)]="spjForm.nomorBukti" placeholder="Contoh: INV/2026/099">
            </div>

            @if (spjForm.kodeTrx === 'JJ') {
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
                            {{ r.kodeKegiatan }} · {{ r.namaKomponen }} (Sisa Pagu: {{ (r.totalPagu - r.totalRealisasi) | currency:'IDR':'symbol':'1.0-0' }})
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
            } @else {
              <div class="col-md-6">
                <label class="form-label small fw-bold">Nominal Transaksi {{ spjForm.kodeTrx }} (Rp)</label>
                <input type="number" class="form-control form-control-sm" [(ngModel)]="spjForm.nominalNonSpj" min="1">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-bold">Rekanan / Instansi Terkait</label>
                <input type="text" class="form-control form-control-sm" [(ngModel)]="spjForm.namaRekanan" placeholder="Kas Negara / DJP MPN / BPKD">
              </div>
            }

            <div class="col-12">
              <label class="form-label small fw-bold">Uraian Transaksi</label>
              <input type="text" class="form-control form-control-sm" [(ngModel)]="spjForm.uraian" placeholder="Jelaskan detail transaksi BKU...">
            </div>

            @if (spjForm.kodeTrx === 'JJ') {
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
                      <label class="small text-muted">Nomor Rekening Rekanan</label>
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

              <div class="col-md-7">
                <div class="p-3 rounded-3 border h-100">
                  <div class="small fw-bold mb-2">3. Potongan Pajak (P1–P7)</div>
                  <div class="d-flex flex-wrap gap-3 small">
                    <label class="form-check-label d-flex align-items-center gap-1">
                      <input type="checkbox" class="form-check-input" [(ngModel)]="taxSelection.ppn"> P5 · PPN (11%)
                    </label>
                    <label class="form-check-label d-flex align-items-center gap-1">
                      <input type="checkbox" class="form-check-input" [(ngModel)]="taxSelection.pph22"> P2 · PPh 22 (1.5%)
                    </label>
                    <label class="form-check-label d-flex align-items-center gap-1">
                      <input type="checkbox" class="form-check-input" [(ngModel)]="taxSelection.pph23"> P3 · PPh 23 (2%)
                    </label>
                    <label class="form-check-label d-flex align-items-center gap-1">
                      <input type="checkbox" class="form-check-input" [(ngModel)]="taxSelection.pph21"> P1 · PPh 21 (5%)
                    </label>
                    <label class="form-check-label d-flex align-items-center gap-1">
                      <input type="checkbox" class="form-check-input" [(ngModel)]="taxSelection.pph4"> P4 · PPh 4(2) (10%)
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
            }
          </div>

          <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
            <button type="button" class="btn btn-light px-4" (click)="goBack()">Kembali</button>
            <button type="button" class="btn btn-siap px-4" (click)="save()" [disabled]="saving()">
              @if (saving()) { <span class="spinner-border spinner-border-sm me-1"></span> }
              {{ mode() === 'edit' ? 'Simpan Perubahan (Draft PK)' : 'Simpan Draft BKU' }}
            </button>
          </div>
        }
      </div>
    </div>
  `
})
export class InputBkuFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly sumberDana = signal<'BOS' | 'BOP'>('BOS');
  readonly mode = signal<'tambah' | 'edit' | 'detail'>('tambah');
  readonly recordId = signal<number | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly rkasItems = signal<RkasItem[]>([]);
  readonly detail = signal<BkuTransaction | null>(null);

  readonly basePath = computed(() => (this.sumberDana() === 'BOP' ? '/bku-bop' : '/bos-negeri'));

  selectedRkasId = 0;
  spjForm: any = {
    kodeTrx: 'JJ',
    kodePeriode: '01',
    tanggalTransaksi: new Date().toISOString().slice(0, 10),
    nomorBukti: '',
    jenisPembayaran: 'TRANSFER',
    noVaAtauPesanan: '',
    uraian: '',
    volume: 1,
    hargaSatuan: 0,
    nominalNonSpj: 0,
    kodeBankRekanan: '111',
    noRekRekanan: '1110099887766',
    namaRekanan: '',
    npwpRekanan: '01.345.678.9-022.000',
    namaWpRekanan: '',
    fileLampiranName: '',
    fileLampiranPath: ''
  };
  taxSelection = { ppn: true, pph22: false, pph23: true, pph21: false, pph4: false };

  ngOnInit(): void {
    const sd = (this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS';
    const fm = (this.route.snapshot.data['formMode'] as 'tambah' | 'edit' | 'detail') || 'tambah';
    this.sumberDana.set(sd);
    this.mode.set(fm);
    this.spjForm.kodePeriode = sd === 'BOP' ? 'TW1' : '01';

    const idParam = this.route.snapshot.paramMap.get('id');
    const parsedId = idParam ? Number(idParam) : null;
    this.recordId.set(parsedId);

    this.loadRkas();
    if ((fm === 'edit' || fm === 'detail') && parsedId) {
      this.loadDetail(parsedId);
    }
  }

  onSekolahChanged(): void {
    this.loadRkas();
  }

  loadRkas(): void {
    const sekId = this.auth.selectedSekolahId() || 1;
    this.api.getRkasItems(sekId, this.auth.tahunAnggaran(), this.sumberDana()).subscribe((r) => {
      if (r.success) this.rkasItems.set(r.data);
    });
  }

  loadDetail(id: number): void {
    this.loading.set(true);
    this.api.getBkuDetail(this.sumberDana(), id).subscribe({
      next: (r) => {
        this.loading.set(false);
        if (r.success && r.data) {
          this.detail.set(r.data);
          this.patchFormFromBku(r.data);
        }
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Gagal memuat detail transaksi BKU.');
      }
    });
  }

  patchFormFromBku(b: BkuTransaction): void {
    const firstDet = b.detailItems?.[0];
    this.selectedRkasId = firstDet?.rkasItemId || 0;
    this.spjForm = {
      kodeTrx: b.kodeTrx,
      kodePeriode: b.kodePeriode || (this.sumberDana() === 'BOP' ? 'TW1' : '01'),
      tanggalTransaksi: (b.tanggalTransaksi || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      nomorBukti: b.nomorBukti || '',
      jenisPembayaran: b.jenisPembayaran || 'TRANSFER',
      noVaAtauPesanan: b.noVaAtauPesanan || '',
      uraian: b.uraian || '',
      volume: firstDet?.volume || 1,
      hargaSatuan: firstDet?.hargaSatuan || b.nilaiBrutoKeluar || 0,
      nominalNonSpj: b.nilaiBrutoMasuk > 0 ? b.nilaiBrutoMasuk : b.nilaiBrutoKeluar,
      kodeBankRekanan: b.kodeBankRekanan || '111',
      noRekRekanan: b.noRekRekanan || '',
      namaRekanan: b.namaRekanan || '',
      npwpRekanan: b.npwpRekanan || '',
      namaWpRekanan: b.namaWpRekanan || '',
      fileLampiranName: b.fileLampiranName || '',
      fileLampiranPath: b.fileLampiranPath || ''
    };
    const codes = new Set((b.taxItems || []).map((t) => t.kodeTrxPajak));
    this.taxSelection = {
      ppn: codes.has('P5'),
      pph22: codes.has('P2'),
      pph23: codes.has('P3'),
      pph21: codes.has('P1'),
      pph4: codes.has('P4')
    };
  }

  canEditRecord(b: BkuTransaction | null): boolean {
    if (!b) return false;
    return this.auth.hasRole('PK-NEGERI', 'ADMIN-TDI') && (b.statusBku === 0 || b.statusBku === 9) && !b.isTutupBuku;
  }

  goToEdit(id: number): void {
    this.mode.set('edit');
    this.router.navigate([this.basePath(), 'input-bku', 'edit', id]);
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate([this.basePath(), 'input-bku']);
    }
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
    if (this.taxSelection.pph4) tot += Math.round(dpp * 0.1);
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

  save(): void {
    if (!this.spjForm.uraian?.trim()) {
      this.toast.warning('Uraian transaksi wajib diisi.');
      return;
    }

    let payload: any;
    if (this.spjForm.kodeTrx === 'JJ') {
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
      if (this.taxSelection.pph4) taxItems.push({ kodeTrxPajak: 'P4', dasarPengenaanPajak: dpp, tarifPersen: 10, nilaiPajak: Math.round(dpp * 0.1) });

      payload = {
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
      };
    } else {
      payload = {
        sekolahId: this.auth.selectedSekolahId() || 1,
        tahunAnggaran: this.auth.tahunAnggaran(),
        sumberDana: this.sumberDana(),
        kodePeriode: this.spjForm.kodePeriode,
        tanggalTransaksi: this.spjForm.tanggalTransaksi,
        nomorBukti: this.spjForm.nomorBukti,
        kodeTrx: this.spjForm.kodeTrx,
        uraian: this.spjForm.uraian,
        nominalNonSpj: Number(this.spjForm.nominalNonSpj),
        namaRekanan: this.spjForm.namaRekanan || (this.spjForm.kodeTrx === 'JO' ? 'BPKD / KAS NEGARA' : 'KAS NEGARA / DJP')
      };
    }

    this.saving.set(true);
    const id = this.recordId();
    const obs = this.mode() === 'edit' && id
      ? this.api.updateBku(this.sumberDana(), id, payload)
      : this.api.createBku(this.sumberDana(), payload);

    obs.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.toast.success(res.message);
          this.router.navigate([this.basePath(), 'input-bku']);
        }
      },
      error: () => this.saving.set(false)
    });
  }
}
