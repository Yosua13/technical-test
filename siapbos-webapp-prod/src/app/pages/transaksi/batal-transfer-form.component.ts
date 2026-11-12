import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { BatalTransferSpj, BkuTransaction } from '../../core/models/siapbos.models';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-batal-transfer-form',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, SekolahBarComponent, StatusBadgeComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="onSekolahChanged()" />

    <!-- Card 1: Form Berita Acara Batal Transfer SPJ (Sesuai berita-acara-kelola SIAP BOS) -->
    <div class="siap-card mb-3">
      <div class="siap-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h5 class="fw-bold mb-0">
            @if (mode() === 'detail') {
              <i class="bi bi-file-earmark-text me-2 text-warning"></i>Detail Berita Acara Batal Transfer SPJ ({{ sumberDana() }})
            } @else if (mode() === 'edit') {
              <i class="bi bi-pencil-square me-2 text-warning"></i>Edit Berita Acara Batal Transfer SPJ ({{ sumberDana() }})
            } @else {
              <i class="bi bi-plus-circle me-2 text-warning"></i>Tambah Berita Acara Batal Transfer SPJ ({{ sumberDana() }})
            }
          </h5>
          @if (existingRecord(); as rec) {
            <div class="mt-1 d-flex align-items-center gap-2">
              <app-status-badge kind="batal" [value]="rec.statusBatal" />
              <small class="text-muted">{{ rec.catatanVerifikasi || '-' }}</small>
            </div>
          }
        </div>
        <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill px-3" (click)="goBack()">
          <i class="bi bi-arrow-left me-1"></i>Kembali
        </button>
      </div>

      <div class="p-4">
        @if (loading()) {
          <div class="text-center py-4 text-muted">Memuat Berita Acara Batal Transfer SPJ...</div>
        } @else {
          <div class="row g-3">
            <!-- Kolom Kiri -->
            <div class="col-lg-6">
              <div class="row g-2 align-items-center mb-2">
                <label class="col-sm-4 col-form-label small fw-semibold">Tahun Anggaran</label>
                <div class="col-sm-8">
                  <input type="text" class="form-control form-control-sm bg-light" [value]="auth.tahunAnggaran()" readonly>
                </div>
              </div>
              <div class="row g-2 align-items-center mb-2">
                <label class="col-sm-4 col-form-label small fw-semibold">Sekolah</label>
                <div class="col-sm-8">
                  <input type="text" class="form-control form-control-sm bg-light"
                         [value]="(auth.activeSekolah()?.npsn || '') + ' - ' + (auth.activeSekolah()?.namaSekolah || '')" readonly>
                </div>
              </div>
              <div class="row g-2 align-items-center mb-2">
                <label class="col-sm-4 col-form-label small fw-semibold">Periode</label>
                <div class="col-sm-4">
                  <select class="form-select form-select-sm" [(ngModel)]="form.jenisPeriode" [disabled]="isReadOnly()">
                    <option value="TW">Triwulan</option>
                    <option value="CW">Caturwulan</option>
                    <option value="SM">Semester</option>
                    <option value="BL">Bulan</option>
                  </select>
                </div>
                <div class="col-sm-4">
                  <select class="form-select form-select-sm" [(ngModel)]="form.kodePeriode" [disabled]="isReadOnly()">
                    @if (sumberDana() === 'BOP') {
                      <option value="TW1">Ke - 1 (TW1)</option>
                      <option value="TW2">Ke - 2 (TW2)</option>
                      <option value="TW3">Ke - 3 (TW3)</option>
                      <option value="TW4">Ke - 4 (TW4)</option>
                    } @else {
                      <option value="01">Ke - 1</option>
                      <option value="02">Ke - 2</option>
                      <option value="03">Ke - 3</option>
                      <option value="04">Ke - 4</option>
                    }
                  </select>
                </div>
              </div>

              <!-- Field Pilih SPJ via Popup DataTables Modal -->
              <div class="row g-2 align-items-center mb-2">
                <label class="col-sm-4 col-form-label small fw-semibold">SPJ</label>
                <div class="col-sm-8">
                  <div class="input-group input-group-sm">
                    <input type="text" class="form-control bg-light fw-semibold"
                           [value]="selectedSpj() ? (selectedSpj()!.nomorBku + ' · ' + selectedSpj()!.nomorBukti) : ''"
                           placeholder="Klik ikon cari untuk memilih SPJ BKU..." readonly>
                    @if (!isReadOnly()) {
                      <button type="button" class="btn btn-outline-warning text-dark" title="Pilih SPJ BKU" (click)="openSpjModal()">
                        <i class="bi bi-search"></i>
                      </button>
                    }
                  </div>
                </div>
              </div>

              <div class="row g-2 align-items-center mb-2">
                <label class="col-sm-4 col-form-label small fw-semibold">Nomor Berita Acara</label>
                <div class="col-sm-8">
                  <input type="text" class="form-control form-control-sm" [(ngModel)]="form.nomorBeritaAcara" [readonly]="isReadOnly()">
                </div>
              </div>
              <div class="row g-2 align-items-center mb-2">
                <label class="col-sm-4 col-form-label small fw-semibold">Tanggal Pembatalan</label>
                <div class="col-sm-8">
                  <input type="date" class="form-control form-control-sm" [(ngModel)]="form.tanggalPembatalan" [readonly]="isReadOnly()">
                </div>
              </div>
              <div class="row g-2 align-items-center mb-2">
                <label class="col-sm-4 col-form-label small fw-semibold">Nomor BKU Mohon</label>
                <div class="col-sm-8">
                  <input type="text" class="form-control form-control-sm bg-light fw-bold"
                         [value]="selectedSpj()?.nomorBku || existingRecord()?.nomorBkuMohon || ''" readonly>
                </div>
              </div>
              <div class="row g-2 align-items-center">
                <label class="col-sm-4 col-form-label small fw-semibold">Nilai SPJ yang dibatalkan</label>
                <div class="col-sm-8">
                  <input type="text" class="form-control form-control-sm bg-light text-end fw-bold text-danger"
                         [value]="(selectedSpj()?.nilaiBrutoKeluar ?? existingRecord()?.nilaiSpjBatal ?? 0) | currency:'IDR':'symbol':'1.0-0'" readonly>
                </div>
              </div>
            </div>

            <!-- Kolom Kanan -->
            <div class="col-lg-6">
              <div class="row g-2 align-items-center mb-2">
                <label class="col-sm-4 col-form-label small fw-semibold">NRK Pengkoreksi</label>
                <div class="col-sm-8">
                  <input type="text" class="form-control form-control-sm bg-light" [(ngModel)]="form.nrkPengkoreksi" readonly>
                </div>
              </div>
              <div class="row g-2 align-items-center mb-2">
                <label class="col-sm-4 col-form-label small fw-semibold">Nama Pengkoreksi</label>
                <div class="col-sm-8">
                  <input type="text" class="form-control form-control-sm bg-light" [(ngModel)]="form.namaPengkoreksi" readonly>
                </div>
              </div>
              <div class="row g-2 align-items-center mb-2">
                <label class="col-sm-4 col-form-label small fw-semibold">Unggah Berita Acara</label>
                <div class="col-sm-8">
                  <div class="input-group input-group-sm">
                    <input type="text" class="form-control bg-light" [value]="form.fileBeritaAcaraName || 'Belum ada file diunggah'" readonly>
                    @if (!isReadOnly()) {
                      <label class="btn btn-outline-warning text-dark mb-0" style="cursor: pointer;">
                        <i class="bi bi-upload me-1"></i>Pilih
                        <input type="file" class="d-none" accept=".pdf,.png,.jpg,.jpeg" (change)="onUploadBa($event)">
                      </label>
                    }
                  </div>
                  @if (form.fileBeritaAcaraPath) {
                    <a class="small text-primary text-decoration-underline mt-1 d-inline-block" [href]="form.fileBeritaAcaraPath" target="_blank">
                      Lihat Berita Acara ({{ form.fileBeritaAcaraName || 'PDF' }})
                    </a>
                  }
                </div>
              </div>
              <div class="row g-2">
                <label class="col-sm-4 col-form-label small fw-semibold">Uraian Berita Acara</label>
                <div class="col-sm-8">
                  <textarea class="form-control form-control-sm" rows="6" [(ngModel)]="form.uraianBeritaAcara"
                            placeholder="Jelaskan alasan pembatalan transfer SPJ secara rinci..." [readonly]="isReadOnly()"></textarea>
                </div>
              </div>
            </div>
          </div>
        }
      </div>

      <div class="p-3 border-top bg-light d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-sm btn-dark px-3" (click)="goBack()">
            <i class="bi bi-x-lg me-1"></i>Kembali
          </button>
          @if (!isReadOnly()) {
            <button type="button" class="btn btn-sm btn-siap px-4" (click)="save()" [disabled]="saving()">
              @if (saving()) { <span class="spinner-border spinner-border-sm me-1"></span> }
              <i class="bi bi-save me-1"></i>{{ mode() === 'edit' ? 'Simpan Perubahan' : 'Simpan Draft' }}
            </button>
          }
          @if (mode() === 'detail' && existingRecord(); as rec) {
            @if (auth.hasRole('PK-NEGERI', 'ADMIN-TDI') && (rec.statusBatal === 0 || rec.statusBatal === 9)) {
              <button type="button" class="btn btn-sm btn-outline-warning text-dark px-3" (click)="switchToEdit(rec.id)">
                <i class="bi bi-pencil me-1"></i>Edit
              </button>
              <button type="button" class="btn btn-sm btn-primary px-3" (click)="ajukanPk()">
                <i class="bi bi-send me-1"></i>Ajukan ke TU
              </button>
            } @else if (rec.statusBatal === 1 && auth.hasRole('TU-NEGERI', 'ADMIN-TDI')) {
              <button type="button" class="btn btn-sm btn-success px-3" (click)="approveStage('tu', true)">Setujui TU</button>
              <button type="button" class="btn btn-sm btn-outline-danger px-3" (click)="approveStage('tu', false)">Tolak TU</button>
            } @else if (rec.statusBatal === 2 && auth.hasRole('PA-NEGERI', 'ADMIN-TDI')) {
              <button type="button" class="btn btn-sm btn-primary px-3" (click)="approveStage('pa', true)">Setujui PA</button>
              <button type="button" class="btn btn-sm btn-outline-danger px-3" (click)="approveStage('pa', false)">Tolak PA</button>
            } @else if (rec.statusBatal === 3 && auth.hasRole('SUDIN', 'ADMIN-DINAS', 'ADMIN-TDI')) {
              <button type="button" class="btn btn-sm btn-warning fw-semibold px-3" (click)="approveStage('sudin', true)">Setujui Sudin</button>
              <button type="button" class="btn btn-sm btn-outline-danger px-3" (click)="approveStage('sudin', false)">Tolak Sudin</button>
            }
          }
        </div>
        @if (existingRecord(); as rec) {
          <div class="small text-muted d-flex flex-wrap gap-3">
            <span>PK: <strong>{{ rec.submittedByPk || '-' }}</strong></span>
            <span>TU: <strong>{{ rec.approvedByTu || '-' }}</strong></span>
            <span>PA: <strong>{{ rec.approvedByPa || '-' }}</strong></span>
            <span>Sudin: <strong>{{ rec.approvedBySudin || '-' }}</strong></span>
          </div>
        }
      </div>
    </div>

    <!-- Card 2: Detail SPJ yang ingin Dibatalkan (otomatis muncul setelah SPJ dipilih) -->
    @if (selectedSpj(); as spj) {
      <div class="siap-card mb-3 p-4">
        <h6 class="fw-bold mb-3 border-bottom pb-2">Detail SPJ yang ingin Dibatalkan</h6>
        <div class="row g-2 small mb-4">
          <div class="col-md-6">
            <div class="row g-2 mb-1">
              <div class="col-4 text-muted">No Bukti Dokumen</div>
              <div class="col-8 fw-semibold">{{ spj.nomorBukti }}</div>
            </div>
            <div class="row g-2 mb-1">
              <div class="col-4 text-muted">Tanggal Dokumen</div>
              <div class="col-8 fw-semibold">{{ spj.tanggalTransaksi | date:'dd/MM/yyyy' }}</div>
            </div>
            <div class="row g-2 mb-1">
              <div class="col-4 text-muted">Kegiatan</div>
              <div class="col-8 fw-semibold">{{ spj.detailItems?.[0]?.kodeKegiatan }} · {{ spj.detailItems?.[0]?.namaKegiatan || '-' }}</div>
            </div>
            <div class="row g-2 mb-1">
              <div class="col-4 text-muted">Sumber Dana</div>
              <div class="col-8 fw-semibold">{{ spj.sumberDana }} ({{ spj.tahunAnggaran }})</div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="row g-2 mb-1">
              <div class="col-4 text-muted">Cara Pembayaran</div>
              <div class="col-8 fw-semibold">{{ spj.jenisPembayaran }}</div>
            </div>
            <div class="row g-2 mb-1">
              <div class="col-4 text-muted">Bank &amp; No. Rekening</div>
              <div class="col-8 fw-semibold">{{ spj.namaBankRekanan }} · {{ spj.noRekRekanan }}</div>
            </div>
            <div class="row g-2 mb-1">
              <div class="col-4 text-muted">No. Jurnal Bank DKI</div>
              <div class="col-8 fw-semibold text-success">{{ spj.noJurnalBank || '-' }}</div>
            </div>
            <div class="row g-2 mb-1">
              <div class="col-4 text-muted">Nilai SPJ</div>
              <div class="col-8 fw-bold text-primary">{{ spj.nilaiBrutoKeluar | currency:'IDR':'symbol':'1.0-0' }}</div>
            </div>
          </div>
        </div>

        <h6 class="fw-bold mb-2">Rincian SPJ Pengajuan Belanja</h6>
        <div class="table-responsive mb-4">
          <table class="table table-sm table-bordered align-middle">
            <thead class="table-light">
              <tr>
                <th>No</th>
                <th>Akun</th>
                <th>Komponen</th>
                <th>Keterangan Rinci</th>
                <th class="text-end">Volume</th>
                <th class="text-end">Harga Satuan</th>
                <th class="text-end">Nilai SPJ</th>
              </tr>
            </thead>
            <tbody>
              @if (!spj.detailItems || spj.detailItems.length === 0) {
                <tr><td colspan="7" class="text-center text-muted py-3">Data tidak ada</td></tr>
              }
              @for (d of spj.detailItems; track d.id; let i = $index) {
                <tr>
                  <td>{{ i + 1 }}</td>
                  <td>{{ d.kodeAkun }} / {{ d.namaAkun }}</td>
                  <td>{{ d.namaKomponen }}</td>
                  <td>{{ d.spesifikasi || spj.uraian }}</td>
                  <td class="text-end tabular-nums">{{ d.volume }} {{ d.satuan }}</td>
                  <td class="text-end tabular-nums">{{ d.hargaSatuan | currency:'IDR':'symbol':'1.0-0' }}</td>
                  <td class="text-end fw-bold tabular-nums">{{ d.jumlah | currency:'IDR':'symbol':'1.0-0' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <h6 class="fw-bold mb-2">Rincian Potongan Pajak SPJ</h6>
        <div class="form-check mb-2">
          <input id="chkPajakTidakKoreksi" class="form-check-input" type="checkbox"
                 [(ngModel)]="form.pajakTidakDikoreksi" [disabled]="isReadOnly()">
          <label class="form-check-label small fw-semibold" for="chkPajakTidakKoreksi">Pajak Tidak Dikoreksi</label>
        </div>
        <div class="table-responsive">
          <table class="table table-sm table-bordered align-middle">
            <thead class="table-light">
              <tr>
                <th>No</th>
                <th>Uraian Pajak</th>
                <th>No. BKU</th>
                <th>Potongan Pajak</th>
                <th class="text-end">Nilai Pajak</th>
                <th>Status MPN</th>
              </tr>
            </thead>
            <tbody>
              @if (!spj.taxItems || spj.taxItems.length === 0) {
                <tr><td colspan="6" class="text-center text-muted py-3">Tidak ada potongan pajak pada SPJ ini</td></tr>
              }
              @for (t of spj.taxItems; track t.id; let i = $index) {
                <tr>
                  <td>{{ i + 1 }}</td>
                  <td>{{ t.namaPajak }}</td>
                  <td>{{ spj.nomorBku }}</td>
                  <td><span class="badge text-bg-light border">{{ t.kodeTrxPajak }}</span></td>
                  <td class="text-end fw-bold tabular-nums">{{ t.nilaiPajak | currency:'IDR':'symbol':'1.0-0' }}</td>
                  <td><app-status-badge kind="tax" [value]="t.statusPajak ?? 0" /></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <!-- MODAL POPUP DATATABLES: Pilih SPJ BKU (Sesuai Screenshot Web Training SIAP BOS) -->
    @if (showSpjModal()) {
      <div class="modal-backdrop-custom">
        <div class="modal-dialog-custom" style="max-width: 980px;">
          <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-white">
            <h5 class="mb-0 fw-bold">Pilih SPJ BKU</h5>
            <button type="button" class="btn-close" (click)="showSpjModal.set(false)"></button>
          </div>
          <div class="modal-body-scroll">
            <!-- Filter Bar Modal -->
            <div class="row g-2 mb-3 align-items-center">
              <div class="col-md-3">
                <input type="text" class="form-control form-control-sm" placeholder="No. BKU Mohon"
                       [(ngModel)]="spjSearch.noMohon" (keyup.enter)="searchSpjCandidates()">
              </div>
              <div class="col-md-3">
                <input type="text" class="form-control form-control-sm" placeholder="Nomor Bukti"
                       [(ngModel)]="spjSearch.noBukti" (keyup.enter)="searchSpjCandidates()">
              </div>
              <div class="col-md-4">
                <input type="text" class="form-control form-control-sm" placeholder="Kegiatan"
                       [(ngModel)]="spjSearch.kegiatan" (keyup.enter)="searchSpjCandidates()">
              </div>
              <div class="col-md-2">
                <button type="button" class="btn btn-sm btn-success w-100" (click)="searchSpjCandidates()">
                  <i class="bi bi-search me-1"></i>Cari
                </button>
              </div>
            </div>

            <div class="table-responsive">
              <table class="table table-sm table-bordered table-striped table-hover align-middle">
                <thead class="table-light">
                  <tr>
                    <th class="text-center" style="width: 60px;">Pilih</th>
                    <th>No. BKU Mohon</th>
                    <th>No. Bukti Dokumen</th>
                    <th>Jenis Transaksi</th>
                    <th>Kegiatan</th>
                    <th class="text-end">Penerimaan</th>
                    <th class="text-end">Pengeluaran</th>
                  </tr>
                </thead>
                <tbody>
                  @if (loadingCandidates()) {
                    <tr><td colspan="7" class="text-center py-4 text-muted">Memuat daftar SPJ BKU Lunas Transfer...</td></tr>
                  } @else if (spjCandidates().length === 0) {
                    <tr><td colspan="7" class="text-center py-4 text-muted">Tidak ditemukan SPJ BKU yang tersedia untuk dibatalkan.</td></tr>
                  }
                  @for (c of spjCandidates(); track c.id) {
                    <tr (click)="tempSelectedSpjId = c.id" style="cursor: pointer;"
                        [class.table-warning]="tempSelectedSpjId === c.id">
                      <td class="text-center">
                        <input type="radio" class="form-check-input" name="pilihSpjRadio"
                               [checked]="tempSelectedSpjId === c.id" (change)="tempSelectedSpjId = c.id">
                      </td>
                      <td class="fw-bold">{{ c.nomorBku }}</td>
                      <td>{{ c.nomorBukti }}</td>
                      <td>SPJ (Pengajuan Belanja)</td>
                      <td>
                        @if (c.detailItems && c.detailItems.length > 0) {
                          <div class="small fw-medium">{{ c.detailItems[0].kodeKegiatan }}. {{ c.detailItems[0].namaKegiatan }}</div>
                        } @else {
                          <div class="small text-muted">{{ c.uraian }}</div>
                        }
                      </td>
                      <td class="text-end tabular-nums">{{ (c.nilaiBrutoMasuk || 0) | currency:'IDR':'symbol':'1.0-0' }}</td>
                      <td class="text-end fw-semibold tabular-nums">{{ (c.nilaiBrutoKeluar || 0) | currency:'IDR':'symbol':'1.0-0' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="small text-muted mt-1">Menampilkan {{ spjCandidates().length }} SPJ Lunas Transfer Bank DKI.</div>
          </div>
          <div class="p-3 border-top bg-light d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-sm btn-dark px-3" (click)="showSpjModal.set(false)">
              <i class="bi bi-x-lg me-1"></i>Tutup
            </button>
            <button type="button" class="btn btn-sm btn-primary px-3" [disabled]="!tempSelectedSpjId" (click)="confirmSelectSpj()">
              <i class="bi bi-check-lg me-1"></i>Kirim
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class BatalTransferFormComponent implements OnInit {
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
  readonly existingRecord = signal<BatalTransferSpj | null>(null);
  readonly selectedSpj = signal<BkuTransaction | null>(null);

  readonly showSpjModal = signal(false);
  readonly loadingCandidates = signal(false);
  readonly spjCandidates = signal<BkuTransaction[]>([]);
  tempSelectedSpjId: number | null = null;
  spjSearch = { noMohon: '', noBukti: '', kegiatan: '' };

  readonly basePath = computed(() => (this.sumberDana() === 'BOP' ? '/bku-bop' : '/bos-negeri'));
  readonly isReadOnly = computed(() => this.mode() === 'detail');

  form = {
    bkuTransactionId: 0,
    jenisPeriode: 'TW',
    kodePeriode: '01',
    nomorBeritaAcara: '',
    tanggalPembatalan: new Date().toISOString().slice(0, 10),
    nrkPengkoreksi: '',
    namaPengkoreksi: '',
    fileBeritaAcaraName: '',
    fileBeritaAcaraPath: '',
    uraianBeritaAcara: '',
    pajakTidakDikoreksi: true
  };

  ngOnInit(): void {
    const sd = (this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS';
    const fm = (this.route.snapshot.data['formMode'] as 'tambah' | 'edit' | 'detail') || 'tambah';
    this.sumberDana.set(sd);
    this.mode.set(fm);

    const user = this.auth.currentUser();
    const sek = this.auth.activeSekolah();
    this.form.kodePeriode = sd === 'BOP' ? 'TW1' : '01';
    this.form.nrkPengkoreksi = user?.nrk || sek?.nrkBendahara || '198501';
    this.form.namaPengkoreksi = user?.namaLengkap || sek?.namaBendahara || 'Bendahara Sekolah';

    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? Number(idParam) : null;
    this.recordId.set(id);

    if ((fm === 'edit' || fm === 'detail') && id) {
      this.loadDetail(id);
    }
  }

  onSekolahChanged(): void {
    if (this.mode() === 'tambah') {
      const sek = this.auth.activeSekolah();
      if (sek && !this.auth.currentUser()?.nrk) {
        this.form.nrkPengkoreksi = sek.nrkBendahara;
        this.form.namaPengkoreksi = sek.namaBendahara;
      }
      this.selectedSpj.set(null);
      this.form.bkuTransactionId = 0;
    }
  }

  loadDetail(id: number): void {
    this.loading.set(true);
    this.api.getBatalTransferDetail(this.sumberDana(), id).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          const rec = res.data;
          this.existingRecord.set(rec);
          this.selectedSpj.set(rec.bkuTransaction || null);
          this.form = {
            bkuTransactionId: rec.bkuTransactionId,
            jenisPeriode: rec.jenisPeriode || 'TW',
            kodePeriode: rec.kodePeriode || (this.sumberDana() === 'BOP' ? 'TW1' : '01'),
            nomorBeritaAcara: rec.nomorBeritaAcara,
            tanggalPembatalan: (rec.tanggalPembatalan || '').slice(0, 10),
            nrkPengkoreksi: rec.nrkPengkoreksi,
            namaPengkoreksi: rec.namaPengkoreksi,
            fileBeritaAcaraName: rec.fileBeritaAcaraName || '',
            fileBeritaAcaraPath: rec.fileBeritaAcaraPath || '',
            uraianBeritaAcara: rec.uraianBeritaAcara,
            pajakTidakDikoreksi: rec.pajakTidakDikoreksi
          };
        }
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Gagal memuat detail Berita Acara Batal Transfer SPJ.');
      }
    });
  }

  openSpjModal(): void {
    this.tempSelectedSpjId = this.selectedSpj()?.id || null;
    this.showSpjModal.set(true);
    this.searchSpjCandidates();
  }

  searchSpjCandidates(): void {
    const sekId = this.auth.selectedSekolahId() || 1;
    this.loadingCandidates.set(true);
    this.api
      .getBatalTransferCandidates(this.sumberDana(), sekId, this.auth.tahunAnggaran(), this.spjSearch)
      .subscribe({
        next: (res) => {
          this.loadingCandidates.set(false);
          if (res.success) this.spjCandidates.set(res.data || []);
        },
        error: () => this.loadingCandidates.set(false)
      });
  }

  confirmSelectSpj(): void {
    const found = this.spjCandidates().find((c) => c.id === this.tempSelectedSpjId);
    if (!found) return;
    this.selectedSpj.set(found);
    this.form.bkuTransactionId = found.id;
    if (!this.form.kodePeriode) this.form.kodePeriode = found.kodePeriode;
    if (!this.form.nomorBeritaAcara) {
      this.form.nomorBeritaAcara = `BA-BATAL/${this.sumberDana()}/${this.auth.tahunAnggaran()}/${String(found.id).padStart(3, '0')}`;
    }
    this.showSpjModal.set(false);
  }

  onUploadBa(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.api.uploadInvoicePdf(file).subscribe((res) => {
      if (res.success) {
        this.form.fileBeritaAcaraName = res.data.originalName;
        this.form.fileBeritaAcaraPath = res.data.previewUrl;
        this.toast.success('Berita Acara berhasil diunggah ke Storage.');
      }
    });
  }

  save(): void {
    if (!this.form.bkuTransactionId) {
      this.toast.warning('Silakan pilih SPJ BKU melalui tombol pencarian terlebih dahulu.');
      return;
    }
    if (!this.form.uraianBeritaAcara?.trim()) {
      this.toast.warning('Uraian Berita Acara pembatalan wajib diisi.');
      return;
    }

    const payload = {
      bkuTransactionId: this.form.bkuTransactionId,
      sekolahId: this.auth.selectedSekolahId() || 1,
      tahunAnggaran: this.auth.tahunAnggaran(),
      sumberDana: this.sumberDana(),
      jenisPeriode: this.form.jenisPeriode,
      kodePeriode: this.form.kodePeriode,
      nomorBeritaAcara: this.form.nomorBeritaAcara,
      tanggalPembatalan: this.form.tanggalPembatalan,
      nrkPengkoreksi: this.form.nrkPengkoreksi,
      namaPengkoreksi: this.form.namaPengkoreksi,
      fileBeritaAcaraName: this.form.fileBeritaAcaraName || undefined,
      fileBeritaAcaraPath: this.form.fileBeritaAcaraPath || undefined,
      uraianBeritaAcara: this.form.uraianBeritaAcara.trim(),
      pajakTidakDikoreksi: this.form.pajakTidakDikoreksi
    };

    this.saving.set(true);
    const id = this.recordId();
    const obs =
      this.mode() === 'edit' && id
        ? this.api.updateBatalTransfer(this.sumberDana(), id, payload)
        : this.api.createBatalTransfer(this.sumberDana(), payload);

    obs.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.toast.success(res.message);
          this.router.navigate([this.basePath(), 'batal-transfer-spj']);
        }
      },
      error: () => this.saving.set(false)
    });
  }

  switchToEdit(id: number): void {
    this.mode.set('edit');
    this.router.navigate([this.basePath(), 'batal-transfer-spj', 'edit', id]);
  }

  ajukanPk(): void {
    const id = this.recordId();
    if (!id) return;
    this.api.ajukanBatalTransferPk(this.sumberDana(), id).subscribe((res) => {
      if (res.success) {
        this.toast.success(res.message);
        this.loadDetail(id);
      }
    });
  }

  approveStage(stage: 'tu' | 'pa' | 'sudin', ok: boolean): void {
    const id = this.recordId();
    if (!id) return;
    const obs =
      stage === 'tu'
        ? this.api.approveBatalTransferTu(this.sumberDana(), id, ok)
        : stage === 'pa'
          ? this.api.approveBatalTransferPa(this.sumberDana(), id, ok)
          : this.api.approveBatalTransferSudin(this.sumberDana(), id, ok);

    obs.subscribe((res) => {
      if (res.success) {
        this.toast.success(res.message);
        this.loadDetail(id);
        if (stage === 'sudin' && ok) this.auth.loadSekolahOptions().subscribe();
      }
    });
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate([this.basePath(), 'batal-transfer-spj']);
    }
  }
}
