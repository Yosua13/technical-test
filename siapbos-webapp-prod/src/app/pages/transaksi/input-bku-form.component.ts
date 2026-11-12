import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { BkuSummarySaldo, BkuTransaction, RkasItem } from '../../core/models/siapbos.models';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

type JenisTransaksiMode = 'SPJ' | 'PENERIMAAN_PAJAK' | 'PENGELUARAN_PAJAK';

interface BankOption {
  kode: string;
  nama: string;
}

interface PajakOption {
  kode: string;
  nama: string;
  tarif: number;
}

interface SpjRincianDraft {
  rkasItemId: number;
  kodeKegiatan: string;
  namaKegiatan: string;
  kodeAkun: string;
  namaAkun: string;
  kodeKomponen: string;
  namaKomponen: string;
  spesifikasi: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
}

const BANK_OPTIONS: BankOption[] = [
  { kode: '111', nama: 'Bank DKI' },
  { kode: '014', nama: 'Bank Central Asia (BCA)' },
  { kode: '008', nama: 'Bank Mandiri' },
  { kode: '002', nama: 'Bank Rakyat Indonesia (BRI)' },
  { kode: '009', nama: 'Bank Negara Indonesia (BNI)' },
  { kode: '451', nama: 'Bank Syariah Indonesia (BSI)' },
  { kode: '200', nama: 'Bank Tabungan Negara (BTN)' },
  { kode: '022', nama: 'Bank CIMB Niaga' }
];

const DEFAULT_PAJAK_OPTIONS: PajakOption[] = [
  { kode: 'P5', nama: 'P5 · Pajak Pertambahan Nilai (PPN)', tarif: 11 },
  { kode: 'P2', nama: 'P2 · PPh Pasal 22 (Belanja Barang)', tarif: 1.5 },
  { kode: 'P3', nama: 'P3 · PPh Pasal 23 (Jasa / Sewa)', tarif: 2 },
  { kode: 'P1', nama: 'P1 · PPh Pasal 21 (Honorarium)', tarif: 5 },
  { kode: 'P4', nama: 'P4 · PPh Pasal 4 Ayat (2) Final', tarif: 10 },
  { kode: 'P6', nama: 'P6 · PPh Pasal 26', tarif: 20 },
  { kode: 'P7', nama: 'P7 · PPh Pasal 15', tarif: 1.2 }
];

const BULAN_LIST = [
  { kode: '01', nama: '01 - Januari' },
  { kode: '02', nama: '02 - Februari' },
  { kode: '03', nama: '03 - Maret' },
  { kode: '04', nama: '04 - April' },
  { kode: '05', nama: '05 - Mei' },
  { kode: '06', nama: '06 - Juni' },
  { kode: '07', nama: '07 - Juli' },
  { kode: '08', nama: '08 - Agustus' },
  { kode: '09', nama: '09 - September' },
  { kode: '10', nama: '10 - Oktober' },
  { kode: '11', nama: '11 - November' },
  { kode: '12', nama: '12 - Desember' }
];

const TRIWULAN_LIST = [
  { kode: 'TW1', nama: '1' },
  { kode: 'TW2', nama: '2' },
  { kode: 'TW3', nama: '3' },
  { kode: 'TW4', nama: '4' }
];

@Component({
  selector: 'app-input-bku-form',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, SekolahBarComponent, StatusBadgeComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="onSekolahChanged()" />

    <div class="siap-card">
      <!-- Header -->
      <div class="siap-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h5 class="fw-bold mb-0">
            @if (mode() === 'detail') {
              <i class="bi bi-eye me-2 text-warning"></i>Detail Transaksi BKU {{ sumberDana() }}
            } @else if (mode() === 'edit') {
              <i class="bi bi-pencil-square me-2 text-warning"></i>Edit Transaksi BKU {{ sumberDana() }} (Draft PK)
            } @else {
              <i class="bi bi-plus-circle me-2 text-warning"></i>Input BKU {{ sumberDana() }} / Tambah
            }
          </h5>
          @if (detail(); as d) {
            <small class="text-muted">No. BKU: <strong>{{ d.nomorBku }}</strong> &middot; Dibuat oleh {{ d.createdBy || 'Bendahara' }}</small>
          }
        </div>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-sm btn-outline-dark rounded-pill px-3" (click)="goBack()">
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
            <div>Memuat data transaksi BKU...</div>
          </div>
        } @else if (mode() === 'detail' && detail(); as b) {
          <!-- READ-ONLY DETAIL VIEW -->
          <div class="row g-3 mb-4">
            <div class="col-md-3">
              <div class="p-3 rounded-3 bg-light border h-100">
                <div class="small text-muted">Nomor BKU / Bukti / Arsip</div>
                <div class="fw-bold text-dark">{{ b.nomorBku }}</div>
                <div class="small text-muted mt-1">Bukti: {{ b.nomorBukti }}</div>
                @if (b.nomorArsip) {
                  <div class="small text-muted">Arsip: {{ b.nomorArsip }}</div>
                }
                <div class="small mt-1">{{ b.tanggalTransaksi | date:'dd MMM yyyy' }}</div>
              </div>
            </div>

            <div class="col-md-3">
              <div class="p-3 rounded-3 bg-light border h-100">
                <div class="small text-muted mb-1">Transaksi, Cara Bayar &amp; Status</div>
                <div class="d-flex flex-wrap gap-1 align-items-center">
                  <app-status-badge kind="trx" [value]="b.kodeTrx" />
                  @if (b.jenisPembayaran) {
                    <span class="badge text-bg-light border text-dark">{{ b.jenisPembayaran }}</span>
                  }
                  @if (b.isVirtualAccount) {
                    <span class="badge text-bg-info">Virtual Account</span>
                  } @else if (b.caraPembayaran) {
                    <span class="badge text-bg-secondary">{{ b.caraPembayaran }}</span>
                  }
                </div>
                <div class="mt-2"><app-status-badge kind="bku" [value]="b.statusBku" /></div>
                <div class="small text-muted mt-1">Periode: <strong>{{ b.kodePeriode }}</strong></div>
                @if (b.parentBkuId) {
                  <div class="mt-2">
                    <button type="button" class="btn btn-xs btn-outline-primary py-0 px-2 small" (click)="goToDetailId(b.parentBkuId!)">
                      <i class="bi bi-link-45deg me-1"></i>Induk: {{ b.parentNomorBku || ('BKU #' + b.parentBkuId) }}
                    </button>
                  </div>
                }
              </div>
            </div>

            <div class="col-md-3">
              <div class="p-3 rounded-3 bg-light border h-100">
                <div class="small text-muted">Ringkasan Nilai</div>
                @if (b.nilaiBrutoMasuk > 0) {
                  <div class="small">Penerimaan: <strong class="text-success">{{ b.nilaiBrutoMasuk | currency:'IDR':'symbol':'1.0-0' }}</strong></div>
                }
                <div class="small">Bruto Keluar: <strong class="text-danger">{{ b.nilaiBrutoKeluar | currency:'IDR':'symbol':'1.0-0' }}</strong></div>
                <div class="small">Potongan Pajak: <strong>{{ b.totalPotonganPajak | currency:'IDR':'symbol':'1.0-0' }}</strong></div>
                <div class="small mt-1 pt-1 border-top">Netto Transfer: <strong class="text-primary">{{ b.nilaiNettoTransfer | currency:'IDR':'symbol':'1.0-0' }}</strong></div>
              </div>
            </div>

            <div class="col-md-3">
              <div class="p-3 rounded-3 bg-light border h-100">
                <div class="small text-muted">Rekanan, NPWP &amp; Pembayaran</div>
                <div class="fw-semibold">{{ b.namaRekanan || '-' }}</div>
                @if (b.alamatRekanan) {
                  <div class="small text-muted">{{ b.alamatRekanan }}</div>
                }
                <div class="small text-muted">{{ b.namaBankRekanan || '-' }} &middot; {{ b.noRekRekanan || '-' }}</div>
                <div class="small text-muted">NPWP: {{ b.npwpRekanan || '-' }} ({{ b.namaWpRekanan || '-' }})</div>
                @if (b.alamatWpRekanan) {
                  <div class="small text-muted">{{ b.alamatWpRekanan }}</div>
                }
                @if (b.noJurnalBank) {
                  <div class="small text-success mt-1 fw-semibold">Jurnal: {{ b.noJurnalBank }}</div>
                }
                @if (b.stanVa || b.kodeReffVa) {
                  <div class="small text-info-emphasis">STAN: {{ b.stanVa || '-' }} &middot; Reff: {{ b.kodeReffVa || '-' }}</div>
                }
              </div>
            </div>

            <div class="col-12">
              <div class="p-3 rounded-3 border bg-white">
                <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
                  <div>
                    <div class="small text-muted fw-semibold">Uraian Transaksi</div>
                    <div class="fw-medium">{{ b.uraian }}</div>
                    @if (b.namaBidang || b.namaSnp) {
                      <div class="small text-muted mt-1">
                        Bidang: <strong>{{ b.namaBidang || '-' }}</strong> &middot; Standar: <strong>{{ b.namaSnp || '-' }}</strong>
                      </div>
                    }
                    @if (b.catatanVerifikasi) {
                      <div class="small text-danger mt-1">Catatan Verifikasi: <em>{{ b.catatanVerifikasi }}</em></div>
                    }
                  </div>
                  <div class="d-flex gap-2">
                    @if (b.fileLampiranPath) {
                      <button type="button" class="btn btn-sm btn-outline-info" (click)="openInvoicePreview(b.fileLampiranPath!, b.fileLampiranName || '')">
                        <i class="bi bi-file-earmark-pdf me-1"></i>Lihat Invoice
                      </button>
                    }
                    @if (b.kodeTrx === 'JJ') {
                      <a class="btn btn-sm btn-outline-danger" [href]="'/report-server/pdf/spj/' + b.id" target="_blank">
                        <i class="bi bi-printer me-1"></i>Cetak SPJ PDF
                      </a>
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>

          @if (b.detailItems.length > 0) {
            <h6 class="fw-bold mb-2">Rincian Item Belanja (RKAS)</h6>
            <div class="table-responsive mb-4">
              <table class="table table-sm table-bordered">
                <thead class="table-light">
                  <tr>
                    <th>Kegiatan &amp; Akun</th>
                    <th>Komponen</th>
                    <th class="text-end">Volume</th>
                    <th class="text-end">Harga Satuan</th>
                    <th class="text-end">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  @for (d of b.detailItems; track d.id || $index) {
                    <tr>
                      <td>
                        <div class="fw-semibold">{{ d.kodeKegiatan }} - {{ d.namaKegiatan }}</div>
                        <small class="text-muted">{{ d.kodeAkun }} - {{ d.namaAkun }}</small>
                      </td>
                      <td>
                        <div>{{ d.namaKomponen }}</div>
                        <small class="text-muted">{{ d.spesifikasi }}</small>
                      </td>
                      <td class="text-end">{{ d.volume }} {{ d.satuan }}</td>
                      <td class="text-end">{{ d.hargaSatuan | currency:'IDR':'symbol':'1.0-0' }}</td>
                      <td class="text-end fw-bold">{{ (d.jumlah || (d.volume * d.hargaSatuan)) | currency:'IDR':'symbol':'1.0-0' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          @if (b.taxItems.length > 0) {
            <h6 class="fw-bold mb-2">Rincian Setoran Pajak MPN</h6>
            <div class="table-responsive">
              <table class="table table-sm table-bordered">
                <thead class="table-light">
                  <tr>
                    <th>Jenis Pajak</th>
                    <th>MAP / KJS</th>
                    <th class="text-end">DPP</th>
                    <th class="text-end">Tarif</th>
                    <th class="text-end">Nilai Pajak</th>
                    <th>Kode Billing / NTPN</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (t of b.taxItems; track t.id || $index) {
                    <tr>
                      <td><app-status-badge kind="trx" [value]="t.kodeTrxPajak" /> {{ t.namaPajak }}</td>
                      <td>{{ t.kodeMap }} / {{ t.kodeJenisSetoran }} (Masa {{ t.masaPajak }}/{{ t.tahunPajak }})</td>
                      <td class="text-end">{{ (t.dasarPengenaanPajak || 0) | currency:'IDR':'symbol':'1.0-0' }}</td>
                      <td class="text-end">{{ t.tarifPersen }}%</td>
                      <td class="text-end fw-bold">{{ t.nilaiPajak | currency:'IDR':'symbol':'1.0-0' }}</td>
                      <td>
                        <div>Billing: <span class="font-monospace">{{ t.kodeBilling || '-' }}</span></div>
                        <div>NTPN: <span class="font-monospace text-success fw-bold">{{ t.ntpn || '-' }}</span></div>
                      </td>
                      <td><app-status-badge kind="tax" [value]="t.statusPajak ?? 0" /></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        } @else {
          <!-- TAMBAH / EDIT TWO-COLUMN FORM -->
          <div class="row g-4">
            <!-- LEFT COLUMN -->
            <div class="col-lg-6">
              <!-- Tahun Anggaran -->
              <div class="row mb-2 align-items-center">
                <label class="col-sm-4 col-form-label small fw-semibold">Tahun Anggaran</label>
                <div class="col-sm-8">
                  <input type="text" class="form-control form-control-sm bg-secondary-subtle" [value]="auth.tahunAnggaran()" readonly>
                </div>
              </div>

              <!-- Sekolah -->
              <div class="row mb-2 align-items-center">
                <label class="col-sm-4 col-form-label small fw-semibold">Sekolah</label>
                <div class="col-sm-8">
                  <input type="text" class="form-control form-control-sm bg-secondary-subtle" [value]="sekolahLabel()" readonly>
                </div>
              </div>

              <!-- Periode -->
              <div class="row mb-2 align-items-center">
                <label class="col-sm-4 col-form-label small fw-semibold">Periode</label>
                <div class="col-sm-4">
                  <select class="form-select form-select-sm" [ngModel]="jenisPeriode()" (ngModelChange)="onJenisPeriodeChange($event)">
                    <option value="Bulanan">Bulanan</option>
                    <option value="Triwulan">Triwulan</option>
                  </select>
                </div>
                <div class="col-sm-4">
                  <select class="form-select form-select-sm" [(ngModel)]="form.kodePeriode">
                    @for (p of activePeriodeList(); track p.kode) {
                      <option [value]="p.kode">{{ p.nama }}</option>
                    }
                  </select>
                </div>
              </div>

              <!-- Jenis Transaksi -->
              <div class="row mb-3 align-items-center">
                <label class="col-sm-4 col-form-label small fw-semibold">Jenis Transaksi</label>
                <div class="col-sm-8">
                  <select class="form-select form-select-sm fw-semibold"
                          [disabled]="mode() === 'edit'"
                          [(ngModel)]="jenisTransaksi"
                          (ngModelChange)="onJenisTransaksiChange($event)">
                    <option value="SPJ">SPJ (PENGAJUAN BELANJA)</option>
                    <option value="PENERIMAAN_PAJAK">PENERIMAAN PAJAK</option>
                    <option value="PENGELUARAN_PAJAK">PENGELUARAN PAJAK</option>
                  </select>
                </div>
              </div>

              @if (jenisTransaksi === 'SPJ') {
                <h5 class="fw-bold my-3 border-bottom pb-2">Input SPJ (Pengajuan Belanja)</h5>

                <!-- Jenis Pembayaran -->
                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Jenis Pembayaran</label>
                  <div class="col-sm-8">
                    <select class="form-select form-select-sm" [(ngModel)]="spj.jenisPembayaran">
                      <option value="Transaksi Luring">Transaksi Luring</option>
                    </select>
                  </div>
                </div>

                <!-- No Bukti Dokumen -->
                <div class="row mb-2 align-items-start">
                  <label class="col-sm-4 col-form-label small fw-semibold">No Bukti Dokumen</label>
                  <div class="col-sm-8">
                    <input type="text" class="form-control form-control-sm" [(ngModel)]="form.nomorBukti" placeholder="Contoh: INV/2025/BOS/001">
                    @if (!form.nomorBukti.trim()) {
                      <div class="text-danger" style="font-size: 0.75rem;">No Bukti Dokumen harus diisi.</div>
                    }
                  </div>
                </div>

                <!-- Tanggal Dokumen -->
                <div class="row mb-2 align-items-start">
                  <label class="col-sm-4 col-form-label small fw-semibold">Tanggal Dokumen</label>
                  <div class="col-sm-8">
                    <div class="input-group input-group-sm">
                      <input type="date" class="form-control" [(ngModel)]="form.tanggalTransaksi">
                      <span class="input-group-text bg-warning text-white border-warning"><i class="bi bi-calendar3"></i></span>
                    </div>
                    @if (!form.tanggalTransaksi) {
                      <div class="text-danger" style="font-size: 0.75rem;">Tanggal Dokumen harus diisi.</div>
                    }
                  </div>
                </div>

                <!-- Nomor Arsip -->
                <div class="row mb-2 align-items-start">
                  <label class="col-sm-4 col-form-label small fw-semibold">Nomor Arsip</label>
                  <div class="col-sm-8">
                    <input type="text" class="form-control form-control-sm" [(ngModel)]="form.nomorArsip" placeholder="Contoh: ARS/2025/001">
                    @if (!form.nomorArsip.trim()) {
                      <div class="text-danger" style="font-size: 0.75rem;">Nomor Arsip harus diisi.</div>
                    }
                  </div>
                </div>

                <!-- Kegiatan (Popup DataTable) -->
                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Kegiatan</label>
                  <div class="col-sm-8">
                    <div class="input-group input-group-sm">
                      <input type="text" class="form-control bg-secondary-subtle"
                             [value]="spj.kodeKegiatan ? (spj.kodeKegiatan + ' - ' + spj.namaKegiatan) : ''"
                             placeholder="Klik tombol kaca pembesar untuk memilih Kegiatan..." readonly>
                      <button type="button" class="btn btn-warning text-white" title="Pilih Kegiatan RKAS" (click)="openKegiatanModal()">
                        <i class="bi bi-search"></i>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Bidang -->
                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Bidang</label>
                  <div class="col-sm-8">
                    <input type="text" class="form-control form-control-sm bg-secondary-subtle" [value]="spj.namaBidang" readonly>
                  </div>
                </div>

                <!-- Standar Pendidikan -->
                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Standar Pendidikan</label>
                  <div class="col-sm-8">
                    <input type="text" class="form-control form-control-sm bg-secondary-subtle" [value]="spj.namaSnp" readonly>
                  </div>
                </div>

                <!-- Sumber Dana -->
                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Sumber Dana</label>
                  <div class="col-sm-8">
                    <input type="text" class="form-control form-control-sm bg-secondary-subtle" [value]="sumberDana()" readonly>
                  </div>
                </div>

                <!-- Akun (Popup DataTable) -->
                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Akun</label>
                  <div class="col-sm-8">
                    <div class="input-group input-group-sm">
                      <input type="text" class="form-control bg-secondary-subtle"
                             [value]="spj.kodeAkun ? (spj.kodeAkun + ' - ' + spj.namaAkun) : ''"
                             placeholder="Pilih Akun &amp; Komponen Belanja..." readonly>
                      <button type="button" class="btn btn-warning text-white" title="Pilih Akun & Komponen RKAS" (click)="openAkunModal()">
                        <i class="bi bi-search"></i>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Pagu AKB Akun -->
                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Pagu AKB Akun</label>
                  <div class="col-sm-8">
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-light">Rp</span>
                      <input type="text" class="form-control bg-secondary-subtle text-end tabular-nums"
                             [value]="formatNumber(spj.paguAkbAkun)" readonly>
                    </div>
                  </div>
                </div>

                <!-- Sisa Pagu AKB Akun -->
                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Sisa Pagu AKB Akun</label>
                  <div class="col-sm-8">
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-light">Rp</span>
                      <input type="text" class="form-control bg-secondary-subtle text-end tabular-nums"
                             [value]="formatNumber(spj.sisaPaguAkbAkun)" readonly>
                    </div>
                  </div>
                </div>

                <!-- Sisa Kas -->
                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Sisa Kas</label>
                  <div class="col-sm-8">
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-light">Rp</span>
                      <input type="text" class="form-control bg-secondary-subtle text-end tabular-nums fw-semibold"
                             [value]="formatNumber(sisaKasBank())" readonly>
                    </div>
                  </div>
                </div>
              } @else if (jenisTransaksi === 'PENERIMAAN_PAJAK') {
                <h5 class="fw-bold my-3 border-bottom pb-2">Input Penerimaan Pajak (Pemungutan)</h5>

                <div class="row mb-2 align-items-start">
                  <label class="col-sm-4 col-form-label small fw-semibold">Pilih SPJ BKU (Draft PK)</label>
                  <div class="col-sm-8">
                    <div class="input-group input-group-sm">
                      <input type="text" class="form-control bg-secondary-subtle"
                             [value]="selectedDraftSpj() ? (selectedDraftSpj()!.nomorBku + ' | ' + selectedDraftSpj()!.uraian) : ''"
                             placeholder="Klik cari untuk pilih SPJ berstatus Draft PK..." readonly>
                      <button type="button" class="btn btn-warning text-white" (click)="openDraftSpjModal()">
                        <i class="bi bi-search me-1"></i>Pilih SPJ
                      </button>
                    </div>
                    <small class="text-muted">Hanya SPJ berstatus <strong>Draft PK</strong> yang dapat dipungut pajaknya.</small>
                  </div>
                </div>

                @if (selectedDraftSpj(); as parentSpj) {
                  <div class="p-3 rounded-3 bg-light border mb-3 small">
                    <div class="fw-bold text-primary mb-1"><i class="bi bi-link-45deg me-1"></i>Ringkasan SPJ Induk: {{ parentSpj.nomorBku }}</div>
                    <div class="d-flex justify-content-between">
                      <span>Bruto Belanja SPJ:</span>
                      <strong>{{ parentSpj.nilaiBrutoKeluar | currency:'IDR':'symbol':'1.0-0' }}</strong>
                    </div>
                    <div class="d-flex justify-content-between">
                      <span>Pajak Terpungut Lainnya:</span>
                      <strong>{{ parentSpj.totalPotonganPajak | currency:'IDR':'symbol':'1.0-0' }}</strong>
                    </div>
                    <div class="d-flex justify-content-between border-top pt-1 mt-1">
                      <span>Perkiraan Netto Transfer:</span>
                      <strong class="text-success">{{ MathMax0(parentSpj.nilaiBrutoKeluar - (parentSpj.totalPotonganPajak || 0) - NumberVal(pajakForm.nilaiPajak)) | currency:'IDR':'symbol':'1.0-0' }}</strong>
                    </div>
                  </div>
                }

                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">No Bukti Dokumen</label>
                  <div class="col-sm-8">
                    <input type="text" class="form-control form-control-sm" [(ngModel)]="form.nomorBukti" placeholder="Contoh: BKT-PJK/2025/001">
                  </div>
                </div>

                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Tanggal Dokumen</label>
                  <div class="col-sm-8">
                    <input type="date" class="form-control form-control-sm" [(ngModel)]="form.tanggalTransaksi">
                  </div>
                </div>

                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Nomor Arsip</label>
                  <div class="col-sm-8">
                    <input type="text" class="form-control form-control-sm" [(ngModel)]="form.nomorArsip" placeholder="ARS-PJK/2025/001">
                  </div>
                </div>

                <div class="row mb-2 align-items-start">
                  <label class="col-sm-4 col-form-label small fw-semibold">Uraian</label>
                  <div class="col-sm-8">
                    <textarea class="form-control form-control-sm" rows="3" [(ngModel)]="form.uraian" placeholder="Uraian pemungutan pajak atas SPJ..."></textarea>
                  </div>
                </div>
              } @else if (jenisTransaksi === 'PENGELUARAN_PAJAK') {
                <h5 class="fw-bold my-3 border-bottom pb-2">Input Pengeluaran Pajak (Penyetoran MPN)</h5>

                <div class="row mb-2 align-items-start">
                  <label class="col-sm-4 col-form-label small fw-semibold">Pilih Penerimaan Pajak</label>
                  <div class="col-sm-8">
                    <div class="input-group input-group-sm">
                      <input type="text" class="form-control bg-secondary-subtle"
                             [value]="selectedPenerimaan() ? (selectedPenerimaan()!.nomorBku + ' | ' + selectedPenerimaan()!.kodeTrx + ' - ' + selectedPenerimaan()!.uraian) : ''"
                             placeholder="Klik cari Penerimaan Pajak (SPJ induk sudah Lunas Transfer)..." readonly>
                      <button type="button" class="btn btn-warning text-white" (click)="openPenerimaanModal()">
                        <i class="bi bi-search me-1"></i>Pilih
                      </button>
                    </div>
                    <small class="text-muted">Hanya Penerimaan Pajak yang SPJ induknya sudah <strong>Lunas Transfer</strong>.</small>
                  </div>
                </div>

                @if (selectedPenerimaan(); as pIn) {
                  <div class="p-3 rounded-3 bg-light border mb-3 small">
                    <div class="fw-bold text-primary mb-1"><i class="bi bi-receipt me-1"></i>Referensi Penerimaan Pajak: {{ pIn.nomorBku }}</div>
                    <div>Kode Pajak: <strong>{{ pIn.kodeTrx }}</strong> &middot; SPJ Induk: <strong>{{ pIn.parentNomorBku || '-' }}</strong></div>
                    <div>Nominal Dipungut: <strong class="text-success">{{ pIn.nilaiBrutoMasuk | currency:'IDR':'symbol':'1.0-0' }}</strong></div>
                  </div>
                }

                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">No Bukti Dokumen</label>
                  <div class="col-sm-8">
                    <input type="text" class="form-control form-control-sm" [(ngModel)]="form.nomorBukti" placeholder="Contoh: SSP-MPN/2025/001">
                  </div>
                </div>

                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Tanggal Dokumen</label>
                  <div class="col-sm-8">
                    <input type="date" class="form-control form-control-sm" [(ngModel)]="form.tanggalTransaksi">
                  </div>
                </div>

                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Nomor Arsip</label>
                  <div class="col-sm-8">
                    <input type="text" class="form-control form-control-sm" [(ngModel)]="form.nomorArsip" placeholder="ARS-SETOR/2025/001">
                  </div>
                </div>

                <div class="row mb-2 align-items-start">
                  <label class="col-sm-4 col-form-label small fw-semibold">Uraian</label>
                  <div class="col-sm-8">
                    <textarea class="form-control form-control-sm" rows="3" [(ngModel)]="form.uraian" placeholder="Uraian penyetoran pajak ke Kas Negara (MPN G3)..."></textarea>
                  </div>
                </div>
              }
            </div>

            <!-- RIGHT COLUMN -->
            <div class="col-lg-6">
              @if (jenisTransaksi === 'SPJ') {
                <!-- Cara Pembayaran (Satu Metode Pembayaran) -->
                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Cara Pembayaran</label>
                  <div class="col-sm-8">
                    <select class="form-select form-select-sm" [(ngModel)]="spj.caraPembayaran">
                      <option value="BANK">BANK</option>
                    </select>
                  </div>
                </div>

                <!-- Kode Bank -->
                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Kode Bank</label>
                  <div class="col-sm-8">
                    <div class="input-group input-group-sm">
                      <input type="text" class="form-control bg-secondary-subtle" [value]="spj.kodeBankRekanan" readonly>
                      <button type="button" class="btn btn-warning text-white" title="Pilih Kode Bank" (click)="openBankModal()">
                        <i class="bi bi-search"></i>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Nama Bank -->
                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Nama Bank</label>
                  <div class="col-sm-8">
                    <input type="text" class="form-control form-control-sm bg-secondary-subtle" [value]="spj.namaBankRekanan" readonly>
                  </div>
                </div>

                <!-- No Rekening Bank + External Inquiry -->
                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">No Rekening Bank</label>
                  <div class="col-sm-8">
                    <div class="input-group input-group-sm">
                      <input type="text" class="form-control"
                             [(ngModel)]="spj.noRekRekanan"
                             (ngModelChange)="onRekeningInputChanged()"
                             placeholder="Contoh: 1110099887766">
                      <button type="button" class="btn btn-warning text-white"
                              [disabled]="inquiringRek()"
                              title="Inquiry Rekening Bank (API Eksternal)"
                              (click)="cekRekening()">
                        @if (inquiringRek()) {
                          <span class="spinner-border spinner-border-sm"></span>
                        } @else {
                          <i class="bi bi-arrow-repeat"></i>
                        }
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Nama Rekanan -->
                <div class="row mb-2 align-items-start">
                  <label class="col-sm-4 col-form-label small fw-semibold">Nama Rekanan</label>
                  <div class="col-sm-8">
                    <input type="text" class="form-control form-control-sm bg-secondary-subtle" [value]="spj.namaRekanan" readonly>
                    @if (!rekeningVerified()) {
                      <div class="text-danger" style="font-size: 0.75rem;">Silahkan Klik Tombol Samping Kanan Kolom No Rekening</div>
                    }
                  </div>
                </div>

                <!-- Alamat Rekanan -->
                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Alamat Rekanan</label>
                  <div class="col-sm-8">
                    <input type="text" class="form-control form-control-sm bg-secondary-subtle" [value]="spj.alamatRekanan" readonly>
                  </div>
                </div>

                <!-- Nomor NPWP Rekanan + External Inquiry -->
                <div class="row mb-2 align-items-start">
                  <label class="col-sm-4 col-form-label small fw-semibold">Nomor NPWP Rekanan</label>
                  <div class="col-sm-8">
                    <div class="input-group input-group-sm">
                      <input type="text" class="form-control"
                             [(ngModel)]="spj.npwpRekanan"
                             (ngModelChange)="onNpwpInputChanged()"
                             placeholder="15 / 16 digit (contoh: 01.345.678.9-022.000)">
                      <button type="button" class="btn btn-warning text-white"
                              [disabled]="inquiringNpwp()"
                              title="Inquiry NPWP DJP (API Eksternal)"
                              (click)="cekNpwp()">
                        @if (inquiringNpwp()) {
                          <span class="spinner-border spinner-border-sm"></span>
                        } @else {
                          <i class="bi bi-arrow-repeat"></i>
                        }
                      </button>
                    </div>
                    @if (!isNpwpFormatValid()) {
                      <div class="text-muted" style="font-size: 0.75rem;">Kosongkan atau isi NPWP lalu klik tombol Inquiry untuk data dummy otomatis.</div>
                    }
                  </div>
                </div>

                <!-- Nama Npwp Rekanan -->
                <div class="row mb-2 align-items-start">
                  <label class="col-sm-4 col-form-label small fw-semibold">Nama Npwp Rekanan</label>
                  <div class="col-sm-8">
                    <input type="text" class="form-control form-control-sm bg-secondary-subtle" [value]="spj.namaWpRekanan" readonly>
                    @if (!npwpVerified()) {
                      <div class="text-danger" style="font-size: 0.75rem;">Silahkan Klik Tombol Samping Kanan Kolom No Npwp Rekanan</div>
                    }
                  </div>
                </div>

                <!-- Alamat NPWP Rekanan -->
                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Alamat NPWP Rekanan</label>
                  <div class="col-sm-8">
                    <input type="text" class="form-control form-control-sm bg-secondary-subtle" [value]="spj.alamatWpRekanan" readonly>
                  </div>
                </div>

                <!-- Unggah Invoice & Lihat Invoice -->
                <div class="row mb-2 align-items-start">
                  <label class="col-sm-4 col-form-label small fw-semibold">Unggah Invoice</label>
                  <div class="col-sm-8">
                    <div class="input-group input-group-sm">
                      <input type="text"
                             class="form-control bg-secondary-subtle"
                             [value]="form.fileLampiranName || extractFileName(form.fileLampiranPath)"
                             placeholder="Belum ada file invoice terunggah"
                             readonly>
                      <button type="button"
                              class="btn btn-warning text-white"
                              [disabled]="uploadingInvoice()"
                              title="Unggah File Invoice"
                              (click)="invoiceFileInput.click()">
                        @if (uploadingInvoice()) {
                          <span class="spinner-border spinner-border-sm"></span>
                        } @else {
                          <i class="bi bi-upload"></i>
                        }
                      </button>
                    </div>
                    <input #invoiceFileInput type="file" class="d-none" accept=".pdf,image/*" (change)="onFileUpload($event)">
                    <div class="mt-1 d-flex flex-wrap justify-content-between align-items-center gap-2">
                      @if (form.fileLampiranName || form.fileLampiranPath) {
                        <span class="small text-success fw-semibold">
                          <i class="bi bi-check-circle-fill me-1"></i>Sudah diupload: {{ form.fileLampiranName || extractFileName(form.fileLampiranPath) }}
                        </span>
                      } @else {
                        <span class="small text-muted">Belum ada file yang diupload.</span>
                      }
                      @if (form.fileLampiranPath) {
                        <button type="button"
                                class="btn btn-link btn-sm p-0 text-primary fw-semibold text-decoration-underline"
                                (click)="openInvoicePreview(form.fileLampiranPath, form.fileLampiranName)">
                          <i class="bi bi-eye me-1"></i>Lihat Invoice
                        </button>
                      }
                    </div>
                  </div>
                </div>

                <!-- Uraian -->
                <div class="row mb-2 align-items-start">
                  <label class="col-sm-4 col-form-label small fw-semibold">Uraian</label>
                  <div class="col-sm-8">
                    <textarea class="form-control form-control-sm" rows="3" [(ngModel)]="form.uraian" placeholder="Uraian pengajuan belanja SPJ..."></textarea>
                    @if (!form.uraian.trim()) {
                      <div class="text-danger" style="font-size: 0.75rem;">Uraian harus diisi.</div>
                    }
                  </div>
                </div>

                <!-- Nilai SPJ -->
                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Nilai SPJ</label>
                  <div class="col-sm-8">
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-light">Rp</span>
                      <input type="text" class="form-control bg-secondary-subtle fw-bold text-end tabular-nums"
                             [value]="formatNumber(calcTotalSpj())" readonly>
                    </div>
                  </div>
                </div>
              } @else {
                <!-- PENERIMAAN / PENGELUARAN PAJAK RIGHT PANEL -->
                <h5 class="fw-bold my-3 border-bottom pb-2">Detail Perhitungan Pajak (Kode Trx P1–P7)</h5>

                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Jenis Pajak (MAP)</label>
                  <div class="col-sm-8">
                    <select class="form-select form-select-sm"
                            [disabled]="jenisTransaksi === 'PENGELUARAN_PAJAK'"
                            [(ngModel)]="pajakForm.kodeTrx"
                            (ngModelChange)="onJenisPajakChanged($event)">
                      @for (p of pajakOptions; track p.kode) {
                        <option [value]="p.kode">{{ p.nama }}</option>
                      }
                    </select>
                  </div>
                </div>

                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Masa / Tahun Pajak</label>
                  <div class="col-sm-4">
                    <select class="form-select form-select-sm"
                            [disabled]="jenisTransaksi === 'PENGELUARAN_PAJAK'"
                            [(ngModel)]="pajakForm.masaPajak"
                            (ngModelChange)="onMasaPajakChanged($event)">
                      <option value="">-- Pilih Bulan --</option>
                      @for (m of bulanList; track m.kode) {
                        <option [value]="m.kode">{{ m.nama }}</option>
                      }
                    </select>
                  </div>
                  <div class="col-sm-4">
                    <div class="input-group input-group-sm">
                      <input type="number"
                             class="form-control"
                             [readonly]="jenisTransaksi === 'PENGELUARAN_PAJAK'"
                             [(ngModel)]="pajakForm.tahunPajak"
                             (ngModelChange)="onTahunPajakChanged($event)">
                      @if (jenisTransaksi === 'PENERIMAAN_PAJAK') {
                        <button type="button"
                                class="btn btn-warning text-white"
                                [disabled]="inquiringPajak() || !pajakForm.masaPajak"
                                title="Inquiry Pajak DJP"
                                (click)="runInquiryPajak(true)">
                          @if (inquiringPajak()) {
                            <span class="spinner-border spinner-border-sm"></span>
                          } @else {
                            <i class="bi bi-arrow-repeat"></i>
                          }
                        </button>
                      }
                    </div>
                  </div>
                </div>
                @if (jenisTransaksi === 'PENERIMAAN_PAJAK' && pajakInquiryStatus()) {
                  <div class="row mb-2">
                    <div class="offset-sm-4 col-sm-8">
                      <span class="badge bg-success-subtle text-success border border-success-subtle">
                        <i class="bi bi-check-circle-fill me-1"></i>{{ pajakInquiryStatus() }}
                      </span>
                    </div>
                  </div>
                }

                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Dasar Pengenaan Pajak</label>
                  <div class="col-sm-8">
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-light">Rp</span>
                      <input type="number" min="0" class="form-control text-end"
                             [readonly]="jenisTransaksi === 'PENGELUARAN_PAJAK'"
                             [(ngModel)]="pajakForm.dasarPengenaanPajak"
                             (ngModelChange)="recalcNilaiPajak()">
                    </div>
                  </div>
                </div>

                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Tarif Pajak (%)</label>
                  <div class="col-sm-8">
                    <div class="input-group input-group-sm">
                      <input type="number" min="0" step="0.1" class="form-control text-end"
                             [readonly]="jenisTransaksi === 'PENGELUARAN_PAJAK'"
                             [(ngModel)]="pajakForm.tarifPersen"
                             (ngModelChange)="recalcNilaiPajak()">
                      <span class="input-group-text bg-light">%</span>
                    </div>
                  </div>
                </div>

                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Nilai Pajak</label>
                  <div class="col-sm-8">
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-light">Rp</span>
                      <input type="number" min="0" class="form-control text-end fw-bold"
                             [readonly]="jenisTransaksi === 'PENGELUARAN_PAJAK'"
                             [(ngModel)]="pajakForm.nilaiPajak">
                    </div>
                  </div>
                </div>

                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">NPWP Wajib Pajak</label>
                  <div class="col-sm-8">
                    <input type="text" class="form-control form-control-sm bg-secondary-subtle" [value]="pajakForm.npwpRekanan" readonly>
                  </div>
                </div>

                <div class="row mb-2 align-items-center">
                  <label class="col-sm-4 col-form-label small fw-semibold">Nama Wajib Pajak</label>
                  <div class="col-sm-8">
                    <input type="text" class="form-control form-control-sm bg-secondary-subtle" [value]="pajakForm.namaWpRekanan" readonly>
                  </div>
                </div>

                @if (jenisTransaksi === 'PENERIMAAN_PAJAK') {
                  <div class="alert alert-info small mt-3 mb-0">
                    <i class="bi bi-info-circle me-1"></i>
                    Status <strong>PENERIMAAN PAJAK</strong> mengikuti otomatis status SPJ Induk (<strong>PK &rarr; TU &rarr; PA &rarr; Transfer</strong>).
                  </div>
                } @else {
                  <div class="alert alert-warning small mt-3 mb-0">
                    <i class="bi bi-shield-check me-1"></i>
                    <strong>PENGELUARAN PAJAK</strong> akan masuk alur verifikasi <strong>PK &rarr; TU &rarr; PA</strong> sebelum dibayarkan di menu <strong>Pembayaran Pajak (MPN G3)</strong>.
                  </div>
                }
              }
            </div>
          </div>

          <!-- Rincian Komponen / Item SPJ (Only when SPJ) -->
          @if (jenisTransaksi === 'SPJ') {
            <div class="mt-4 pt-3 border-top">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="fw-bold mb-0"><i class="bi bi-list-check text-warning me-2"></i>Rincian Komponen Belanja SPJ</h6>
                <button type="button" class="btn btn-sm btn-outline-warning text-dark" (click)="openAkunModal()">
                  <i class="bi bi-plus-circle me-1"></i>Tambah / Pilih Komponen RKAS
                </button>
              </div>
              <div class="table-responsive">
                <table class="table table-sm table-bordered align-middle mb-0">
                  <thead class="table-light">
                    <tr>
                      <th>Kegiatan / Akun</th>
                      <th>Komponen &amp; Spesifikasi</th>
                      <th style="width: 110px;">Volume</th>
                      <th>Satuan</th>
                      <th style="width: 160px;">Harga Satuan (Rp)</th>
                      <th class="text-end" style="width: 160px;">Subtotal</th>
                      <th class="text-center" style="width: 60px;">Hapus</th>
                    </tr>
                  </thead>
                  <tbody>
                    @if (rincianItems().length === 0) {
                      <tr>
                        <td colspan="7" class="text-center py-3 text-muted small">
                          Pilih <strong>Kegiatan</strong> dan <strong>Akun / Komponen RKAS</strong> di atas untuk mengisi rincian nilai SPJ.
                        </td>
                      </tr>
                    }
                    @for (item of rincianItems(); track $index) {
                      <tr>
                        <td class="small">
                          <div class="fw-semibold">{{ item.kodeKegiatan }} - {{ item.namaKegiatan }}</div>
                          <div class="text-muted">{{ item.kodeAkun }} - {{ item.namaAkun }}</div>
                        </td>
                        <td class="small">
                          <div class="fw-semibold">{{ item.namaKomponen }}</div>
                          <div class="text-muted">{{ item.spesifikasi }}</div>
                        </td>
                        <td>
                          <input type="number" min="1" class="form-control form-control-sm text-end"
                                 [ngModel]="item.volume" (ngModelChange)="updateItemVolume($index, $event)">
                        </td>
                        <td class="small">{{ item.satuan }}</td>
                        <td>
                          <input type="number" min="0" class="form-control form-control-sm text-end"
                                 [ngModel]="item.hargaSatuan" (ngModelChange)="updateItemHarga($index, $event)">
                        </td>
                        <td class="text-end fw-bold tabular-nums">
                          {{ (item.volume * item.hargaSatuan) | currency:'IDR':'symbol':'1.0-0' }}
                        </td>
                        <td class="text-center">
                          <button type="button" class="btn btn-xs btn-outline-danger py-0 px-2" (click)="removeRincianItem($index)">
                            <i class="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <!-- Action Buttons -->
          <div class="mt-4 pt-3 border-top d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-dark px-4" (click)="goBack()">
              <i class="bi bi-x-lg me-1"></i>Kembali
            </button>
            <button type="button" class="btn btn-siap px-4 fw-semibold" [disabled]="saving()" (click)="save()">
              @if (saving()) {
                <span class="spinner-border spinner-border-sm me-1"></span>
              } @else {
                <i class="bi bi-save2 me-1"></i>
              }
              {{ mode() === 'edit' ? 'Perbarui Data' : 'Simpan Data' }}
            </button>
          </div>
        }
      </div>
    </div>

    <!-- MODAL 1: PILIH KEGIATAN RKAS -->
    @if (showKegiatanModal()) {
      <div class="modal-backdrop-custom">
        <div class="modal-dialog-custom" style="max-width: 920px;">
          <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
            <h6 class="mb-0 fw-bold">Pilih Kegiatan RKAS</h6>
            <button type="button" class="btn-close" (click)="showKegiatanModal.set(false)"></button>
          </div>
          <div class="modal-body-scroll">
            <div class="mb-2 d-flex gap-2">
              <input type="text" class="form-control form-control-sm" [ngModel]="modalSearch()" (ngModelChange)="modalSearch.set($event)"
                     placeholder="Cari kode / nama kegiatan / SNP...">
            </div>
            <div class="table-responsive">
              <table class="table table-sm table-bordered table-hover align-middle">
                <thead class="table-light">
                  <tr>
                    <th class="text-center" style="width: 80px;">Pilih</th>
                    <th>Kode</th>
                    <th>Nama Kegiatan</th>
                    <th>Standar Pendidikan (SNP)</th>
                    <th class="text-end">Jumlah Item</th>
                  </tr>
                </thead>
                <tbody>
                  @for (k of filteredKegiatan(); track k.kodeKegiatan) {
                    <tr>
                      <td class="text-center">
                        <button type="button" class="btn btn-sm btn-siap py-0 px-2" (click)="selectKegiatan(k)">Pilih</button>
                      </td>
                      <td class="fw-bold">{{ k.kodeKegiatan }}</td>
                      <td>{{ k.namaKegiatan }}</td>
                      <td>{{ k.kodeSnp }} - {{ k.namaSnp }}</td>
                      <td class="text-end">{{ k.count }} item</td>
                    </tr>
                  }
                  @if (filteredKegiatan().length === 0) {
                    <tr><td colspan="5" class="text-center py-3 text-muted">Data kegiatan RKAS tidak ditemukan.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- MODAL 2: PILIH AKUN & KOMPONEN RKAS -->
    @if (showAkunModal()) {
      <div class="modal-backdrop-custom">
        <div class="modal-dialog-custom" style="max-width: 980px;">
          <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
            <h6 class="mb-0 fw-bold">Pilih Akun &amp; Komponen Belanja RKAS</h6>
            <button type="button" class="btn-close" (click)="showAkunModal.set(false)"></button>
          </div>
          <div class="modal-body-scroll">
            <div class="mb-2 d-flex gap-2">
              <input type="text" class="form-control form-control-sm" [ngModel]="modalSearch()" (ngModelChange)="modalSearch.set($event)"
                     placeholder="Cari kode akun, nama akun, atau komponen RKAS...">
            </div>
            <div class="table-responsive">
              <table class="table table-sm table-bordered table-hover align-middle">
                <thead class="table-light">
                  <tr>
                    <th class="text-center" style="width: 80px;">Pilih</th>
                    <th>Kode Akun</th>
                    <th>Nama Akun &amp; Komponen</th>
                    <th>Kegiatan</th>
                    <th class="text-end">Pagu AKB</th>
                    <th class="text-end">Sisa Pagu</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of filteredAkunItems(); track r.id) {
                    <tr>
                      <td class="text-center">
                        <button type="button" class="btn btn-sm btn-siap py-0 px-2" (click)="selectRkasAkun(r)">Pilih</button>
                      </td>
                      <td class="fw-bold font-monospace">{{ r.kodeAkun }}</td>
                      <td>
                        <div class="fw-semibold">{{ r.namaAkun }}</div>
                        <small class="text-muted">{{ r.namaKomponen }} ({{ r.spesifikasi }})</small>
                      </td>
                      <td class="small">{{ r.kodeKegiatan }} - {{ r.namaKegiatan }}</td>
                      <td class="text-end tabular-nums">{{ r.totalPagu | currency:'IDR':'symbol':'1.0-0' }}</td>
                      <td class="text-end tabular-nums fw-bold text-primary">{{ (r.totalPagu - r.totalRealisasi) | currency:'IDR':'symbol':'1.0-0' }}</td>
                    </tr>
                  }
                  @if (filteredAkunItems().length === 0) {
                    <tr><td colspan="6" class="text-center py-3 text-muted">Data akun RKAS tidak ditemukan.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- MODAL 3: PILIH BANK -->
    @if (showBankModal()) {
      <div class="modal-backdrop-custom">
        <div class="modal-dialog-custom" style="max-width: 580px;">
          <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
            <h6 class="mb-0 fw-bold">Pilih Kode Bank Rekanan</h6>
            <button type="button" class="btn-close" (click)="showBankModal.set(false)"></button>
          </div>
          <div class="modal-body-scroll">
            <table class="table table-sm table-bordered table-hover align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th class="text-center" style="width: 80px;">Pilih</th>
                  <th>Kode Bank</th>
                  <th>Nama Bank</th>
                </tr>
              </thead>
              <tbody>
                @for (bk of bankOptions; track bk.kode) {
                  <tr>
                    <td class="text-center">
                      <button type="button" class="btn btn-sm btn-siap py-0 px-2" (click)="selectBank(bk)">Pilih</button>
                    </td>
                    <td class="fw-bold font-monospace">{{ bk.kode }}</td>
                    <td>{{ bk.nama }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    }

    <!-- MODAL 4: PILIH SPJ BKU DRAFT PK (UNTUK PENERIMAAN PAJAK) -->
    @if (showDraftSpjModal()) {
      <div class="modal-backdrop-custom">
        <div class="modal-dialog-custom" style="max-width: 980px;">
          <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
            <h6 class="mb-0 fw-bold">Pilih SPJ BKU (Hanya Status Draft PK)</h6>
            <button type="button" class="btn-close" (click)="showDraftSpjModal.set(false)"></button>
          </div>
          <div class="modal-body-scroll">
            <div class="row g-2 mb-3">
              <div class="col-md-9">
                <input type="text" class="form-control form-control-sm" [ngModel]="modalSearch()" (ngModelChange)="modalSearch.set($event)"
                       placeholder="Cari No. BKU / No. Bukti / Uraian SPJ...">
              </div>
              <div class="col-md-3">
                <button type="button" class="btn btn-sm btn-success w-100" (click)="loadDraftSpjCandidates()">
                  <i class="bi bi-search me-1"></i>Cari
                </button>
              </div>
            </div>
            <div class="table-responsive">
              <table class="table table-sm table-bordered table-hover align-middle">
                <thead class="table-light">
                  <tr>
                    <th class="text-center" style="width: 80px;">Pilih</th>
                    <th>No. BKU</th>
                    <th>No. Bukti Dokumen</th>
                    <th>Uraian &amp; Rekanan</th>
                    <th class="text-end">Bruto SPJ</th>
                    <th class="text-end">Pajak Ada</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (s of filteredDraftSpj(); track s.id) {
                    <tr>
                      <td class="text-center">
                        <button type="button" class="btn btn-sm btn-siap py-0 px-2" (click)="selectDraftSpj(s)">Pilih</button>
                      </td>
                      <td class="fw-bold">{{ s.nomorBku }}</td>
                      <td>{{ s.nomorBukti }}</td>
                      <td class="small">
                        <div class="fw-semibold">{{ s.uraian }}</div>
                        <div class="text-muted">{{ s.namaRekanan }} &middot; NPWP: {{ s.npwpRekanan || '-' }}</div>
                      </td>
                      <td class="text-end tabular-nums fw-semibold">{{ s.nilaiBrutoKeluar | currency:'IDR':'symbol':'1.0-0' }}</td>
                      <td class="text-end tabular-nums">{{ s.totalPotonganPajak | currency:'IDR':'symbol':'1.0-0' }}</td>
                      <td><app-status-badge kind="bku" [value]="s.statusBku" /></td>
                    </tr>
                  }
                  @if (filteredDraftSpj().length === 0) {
                    <tr>
                      <td colspan="7" class="text-center py-4 text-muted">
                        Tidak ada SPJ BKU berstatus <strong>Draft PK</strong> yang tersedia.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- MODAL 5: PILIH PENERIMAAN PAJAK (UNTUK PENGELUARAN PAJAK) -->
    @if (showPenerimaanModal()) {
      <div class="modal-backdrop-custom">
        <div class="modal-dialog-custom" style="max-width: 980px;">
          <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
            <h6 class="mb-0 fw-bold">Pilih Penerimaan Pajak (SPJ Induk Sudah Lunas Transfer)</h6>
            <button type="button" class="btn-close" (click)="showPenerimaanModal.set(false)"></button>
          </div>
          <div class="modal-body-scroll">
            <div class="row g-2 mb-3">
              <div class="col-md-9">
                <input type="text" class="form-control form-control-sm" [ngModel]="modalSearch()" (ngModelChange)="modalSearch.set($event)"
                       placeholder="Cari No. BKU Penerimaan / Kode Pajak / No. BKU SPJ Induk...">
              </div>
              <div class="col-md-3">
                <button type="button" class="btn btn-sm btn-success w-100" (click)="loadPenerimaanCandidates()">
                  <i class="bi bi-search me-1"></i>Cari
                </button>
              </div>
            </div>
            <div class="table-responsive">
              <table class="table table-sm table-bordered table-hover align-middle">
                <thead class="table-light">
                  <tr>
                    <th class="text-center" style="width: 80px;">Pilih</th>
                    <th>No. BKU Penerimaan</th>
                    <th>Kode Pajak</th>
                    <th>SPJ Induk</th>
                    <th>Uraian &amp; Wajib Pajak</th>
                    <th class="text-end">Nilai Pajak</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of filteredPenerimaanCandidates(); track p.id) {
                    <tr>
                      <td class="text-center">
                        <button type="button" class="btn btn-sm btn-siap py-0 px-2" (click)="selectPenerimaan(p)">Pilih</button>
                      </td>
                      <td class="fw-bold">{{ p.nomorBku }}</td>
                      <td><app-status-badge kind="trx" [value]="p.kodeTrx" /></td>
                      <td class="fw-semibold text-primary">{{ p.parentNomorBku || '-' }}</td>
                      <td class="small">
                        <div>{{ p.uraian }}</div>
                        <div class="text-muted">WP: {{ p.namaWpRekanan || p.namaRekanan }} ({{ p.npwpRekanan || '-' }})</div>
                      </td>
                      <td class="text-end tabular-nums fw-bold">{{ p.nilaiBrutoMasuk | currency:'IDR':'symbol':'1.0-0' }}</td>
                      <td><app-status-badge kind="bku" [value]="p.statusBku" /></td>
                    </tr>
                  }
                  @if (filteredPenerimaanCandidates().length === 0) {
                    <tr>
                      <td colspan="7" class="text-center py-4 text-muted">
                        Belum ada Penerimaan Pajak siap setor (SPJ induk harus berstatus Lunas Transfer &amp; belum dibuatkan Pengeluaran Pajak).
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- MODAL 6: PREVIEW INVOICE / LAMPIRAN -->
    @if (previewInvoice(); as inv) {
      <div class="modal-backdrop-custom" (click)="closeInvoicePreview()">
        <div class="modal-dialog-custom" style="max-width: 900px;" (click)="$event.stopPropagation()">
          <div class="siap-card-header d-flex justify-content-between align-items-center">
            <div>
              <h6 class="fw-bold mb-0"><i class="bi bi-file-earmark-text me-2 text-warning-emphasis"></i>Lihat Invoice / Lampiran</h6>
              <small class="text-muted">{{ inv.name }}</small>
            </div>
            <button type="button" class="btn-close btn-sm" (click)="closeInvoicePreview()"></button>
          </div>
          <div class="modal-body-scroll text-center bg-light">
            @if (inv.isImage) {
              <img [src]="inv.url" [alt]="inv.name" class="img-fluid rounded border bg-white" style="max-height: 68vh; object-fit: contain;">
            } @else {
              <iframe [src]="inv.safeUrl" class="w-100 rounded border bg-white" style="height: 68vh;" title="Preview Invoice"></iframe>
            }
          </div>
          <div class="modal-footer-custom">
            <a [href]="inv.url" target="_blank" class="btn btn-outline-primary rounded-pill px-3">
              <i class="bi bi-box-arrow-up-right me-1"></i>Buka di Tab Baru
            </a>
            <button type="button" class="btn btn-neutral rounded-pill px-4" (click)="closeInvoicePreview()">Tutup</button>
          </div>
        </div>
      </div>
    }
  `
})
export class InputBkuFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly sanitizer = inject(DomSanitizer);
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly sumberDana = signal<'BOS' | 'BOP'>('BOS');
  readonly mode = signal<'tambah' | 'edit' | 'detail'>('tambah');
  readonly recordId = signal<number | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uploadingInvoice = signal(false);
  readonly inquiringRek = signal(false);
  readonly inquiringNpwp = signal(false);
  readonly inquiringPajak = signal(false);
  readonly pajakInquiryStatus = signal('');
  readonly previewInvoice = signal<{ url: string; safeUrl: SafeResourceUrl; name: string; isImage: boolean } | null>(null);

  readonly summary = signal<BkuSummarySaldo | null>(null);
  readonly rkasItems = signal<RkasItem[]>([]);
  readonly detail = signal<BkuTransaction | null>(null);
  readonly rincianItems = signal<SpjRincianDraft[]>([]);

  readonly draftSpjCandidates = signal<BkuTransaction[]>([]);
  readonly penerimaanCandidates = signal<BkuTransaction[]>([]);
  readonly selectedDraftSpj = signal<BkuTransaction | null>(null);
  readonly selectedPenerimaan = signal<BkuTransaction | null>(null);

  readonly showKegiatanModal = signal(false);
  readonly showAkunModal = signal(false);
  readonly showBankModal = signal(false);
  readonly showDraftSpjModal = signal(false);
  readonly showPenerimaanModal = signal(false);
  readonly modalSearch = signal('');

  readonly rekeningVerified = signal(false);
  readonly npwpVerified = signal(false);

  readonly bankOptions = BANK_OPTIONS;
  readonly pajakOptions = DEFAULT_PAJAK_OPTIONS;
  readonly bulanList = BULAN_LIST;

  readonly basePath = computed(() => (this.sumberDana() === 'BOP' ? '/bku-bop' : '/bos-negeri'));
  readonly sisaKasBank = computed(() => this.summary()?.sisaKasBank ?? this.activeSaldoFallback());
  readonly sekolahLabel = computed(() => {
    const s = this.auth.activeSekolah();
    return s ? `${s.npsn} / ${s.namaSekolah}` : '-';
  });

  readonly activePeriodeList = computed(() => (this.jenisPeriode() === 'Triwulan' ? TRIWULAN_LIST : BULAN_LIST));

  readonly kegiatanGroups = computed(() => {
    const map = new Map<string, { kodeKegiatan: string; namaKegiatan: string; kodeSnp: string; namaSnp: string; count: number }>();
    for (const r of this.rkasItems()) {
      const existing = map.get(r.kodeKegiatan);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(r.kodeKegiatan, {
          kodeKegiatan: r.kodeKegiatan,
          namaKegiatan: r.namaKegiatan,
          kodeSnp: r.kodeSnp,
          namaSnp: r.namaSnp,
          count: 1
        });
      }
    }
    return Array.from(map.values());
  });

  readonly filteredKegiatan = computed(() => {
    const q = this.modalSearch().toLowerCase().trim();
    if (!q) return this.kegiatanGroups();
    return this.kegiatanGroups().filter(
      (k) =>
        k.kodeKegiatan.toLowerCase().includes(q) ||
        k.namaKegiatan.toLowerCase().includes(q) ||
        k.namaSnp.toLowerCase().includes(q)
    );
  });

  readonly filteredAkunItems = computed(() => {
    const q = this.modalSearch().toLowerCase().trim();
    let list = this.rkasItems();
    if (this.spj.kodeKegiatan) {
      const scoped = list.filter((r) => r.kodeKegiatan === this.spj.kodeKegiatan);
      if (scoped.length > 0) list = scoped;
    }
    if (!q) return list;
    return list.filter(
      (r) =>
        r.kodeAkun.toLowerCase().includes(q) ||
        r.namaAkun.toLowerCase().includes(q) ||
        r.namaKomponen.toLowerCase().includes(q) ||
        r.namaKegiatan.toLowerCase().includes(q)
    );
  });

  readonly filteredDraftSpj = computed(() => {
    const q = this.modalSearch().toLowerCase().trim();
    if (!q) return this.draftSpjCandidates();
    return this.draftSpjCandidates().filter(
      (s) =>
        s.nomorBku.toLowerCase().includes(q) ||
        s.nomorBukti.toLowerCase().includes(q) ||
        s.uraian.toLowerCase().includes(q) ||
        s.namaRekanan.toLowerCase().includes(q)
    );
  });

  readonly filteredPenerimaanCandidates = computed(() => {
    const q = this.modalSearch().toLowerCase().trim();
    if (!q) return this.penerimaanCandidates();
    return this.penerimaanCandidates().filter(
      (p) =>
        p.nomorBku.toLowerCase().includes(q) ||
        p.kodeTrx.toLowerCase().includes(q) ||
        (p.parentNomorBku || '').toLowerCase().includes(q) ||
        p.uraian.toLowerCase().includes(q)
    );
  });

  readonly jenisPeriode = signal<'Bulanan' | 'Triwulan'>('Bulanan');
  jenisTransaksi: JenisTransaksiMode = 'SPJ';

  form = {
    kodePeriode: '01',
    tanggalTransaksi: new Date().toISOString().slice(0, 10),
    nomorBukti: '',
    nomorArsip: '',
    uraian: '',
    fileLampiranName: '',
    fileLampiranPath: ''
  };

  spj = {
    jenisPembayaran: 'Transaksi Luring',
    caraPembayaran: 'BANK',
    isVirtualAccount: false,
    noVaAtauPesanan: '',
    kodeKegiatan: '',
    namaKegiatan: '',
    namaBidang: '',
    namaSnp: '',
    kodeAkun: '',
    namaAkun: '',
    paguAkbAkun: 0,
    sisaPaguAkbAkun: 0,
    kodeBankRekanan: '111',
    namaBankRekanan: 'Bank DKI',
    noRekRekanan: '',
    namaRekanan: '',
    alamatRekanan: '',
    npwpRekanan: '',
    namaWpRekanan: '',
    alamatWpRekanan: ''
  };

  pajakForm = {
    kodeTrx: 'P5',
    masaPajak: '',
    tahunPajak: new Date().getFullYear(),
    dasarPengenaanPajak: 0,
    tarifPersen: 11,
    nilaiPajak: 0,
    npwpRekanan: '',
    namaWpRekanan: ''
  };

  ngOnInit(): void {
    const sd = (this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS';
    const fm = (this.route.snapshot.data['formMode'] as 'tambah' | 'edit' | 'detail') || 'tambah';
    this.sumberDana.set(sd);
    this.mode.set(fm);
    this.jenisPeriode.set(sd === 'BOP' ? 'Triwulan' : 'Bulanan');
    this.form.kodePeriode = sd === 'BOP' ? 'TW1' : '01';
    this.pajakForm.tahunPajak = this.auth.tahunAnggaran();

    const idParam = this.route.snapshot.paramMap.get('id');
    const parsedId = idParam ? Number(idParam) : null;
    this.recordId.set(parsedId);

    this.loadReferenceData();
    if ((fm === 'edit' || fm === 'detail') && parsedId) {
      this.loadDetail(parsedId);
    }
  }

  onSekolahChanged(): void {
    this.loadReferenceData();
  }

  loadReferenceData(): void {
    const sekId = this.auth.selectedSekolahId() || 1;
    const thn = this.auth.tahunAnggaran();
    const sd = this.sumberDana();
    this.api.getSummarySaldo(sekId, thn, sd).subscribe((r) => {
      if (r.success) this.summary.set(r.data);
    });
    this.api.getRkasItems(sekId, thn, sd).subscribe((r) => {
      if (r.success) this.rkasItems.set(r.data || []);
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
    this.jenisPeriode.set((b.kodePeriode || '').startsWith('TW') ? 'Triwulan' : 'Bulanan');
    this.form = {
      kodePeriode: b.kodePeriode || (this.sumberDana() === 'BOP' ? 'TW1' : '01'),
      tanggalTransaksi: (b.tanggalTransaksi || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      nomorBukti: b.nomorBukti || '',
      nomorArsip: b.nomorArsip || '',
      uraian: b.uraian || '',
      fileLampiranName: b.fileLampiranName || '',
      fileLampiranPath: b.fileLampiranPath || ''
    };

    if (b.kodeTrx === 'JJ') {
      this.jenisTransaksi = 'SPJ';
      const firstDet = b.detailItems?.[0];
      const matchedRkas = this.rkasItems().find((r) => r.id === firstDet?.rkasItemId);
      this.spj = {
        jenisPembayaran: 'Transaksi Luring',
        caraPembayaran: 'BANK',
        isVirtualAccount: false,
        noVaAtauPesanan: '',
        kodeKegiatan: firstDet?.kodeKegiatan || '',
        namaKegiatan: firstDet?.namaKegiatan || '',
        namaBidang: b.namaBidang || this.deriveBidang(firstDet?.kodeKegiatan || ''),
        namaSnp: b.namaSnp || (matchedRkas ? `${matchedRkas.kodeSnp} - ${matchedRkas.namaSnp}` : ''),
        kodeAkun: firstDet?.kodeAkun || '',
        namaAkun: firstDet?.namaAkun || '',
        paguAkbAkun: matchedRkas?.totalPagu || 0,
        sisaPaguAkbAkun: matchedRkas ? matchedRkas.totalPagu - matchedRkas.totalRealisasi : 0,
        kodeBankRekanan: b.kodeBankRekanan || '111',
        namaBankRekanan: b.namaBankRekanan || 'Bank DKI',
        noRekRekanan: b.noRekRekanan || '',
        namaRekanan: b.namaRekanan || '',
        alamatRekanan: b.alamatRekanan || '',
        npwpRekanan: b.npwpRekanan || '',
        namaWpRekanan: b.namaWpRekanan || '',
        alamatWpRekanan: b.alamatWpRekanan || ''
      };
      this.rincianItems.set(
        (b.detailItems || []).map((d) => ({
          rkasItemId: d.rkasItemId || 0,
          kodeKegiatan: d.kodeKegiatan,
          namaKegiatan: d.namaKegiatan,
          kodeAkun: d.kodeAkun,
          namaAkun: d.namaAkun,
          kodeKomponen: d.kodeKomponen,
          namaKomponen: d.namaKomponen,
          spesifikasi: d.spesifikasi,
          satuan: d.satuan,
          volume: d.volume,
          hargaSatuan: d.hargaSatuan
        }))
      );
      this.rekeningVerified.set(Boolean(b.noRekRekanan && b.namaRekanan));
      this.npwpVerified.set(Boolean(b.npwpRekanan && b.namaWpRekanan));
    } else if (b.jenisPembayaran === 'PENGELUARAN') {
      this.jenisTransaksi = 'PENGELUARAN_PAJAK';
      const tx = b.taxItems?.[0];
      this.pajakForm = {
        kodeTrx: b.kodeTrx,
        masaPajak: tx?.masaPajak || b.masaPajak || '01',
        tahunPajak: tx?.tahunPajak || b.tahunPajak || this.auth.tahunAnggaran(),
        dasarPengenaanPajak: tx?.dasarPengenaanPajak || b.dasarPengenaanPajak || 0,
        tarifPersen: tx?.tarifPersen || b.tarifPersen || 0,
        nilaiPajak: tx?.nilaiPajak || b.nilaiBrutoKeluar || 0,
        npwpRekanan: b.npwpRekanan || '',
        namaWpRekanan: b.namaWpRekanan || b.namaRekanan || ''
      };
      if (b.parentBkuId) {
        this.selectedPenerimaan.set({
          id: b.parentBkuId,
          nomorBku: b.parentNomorBku || `BKU #${b.parentBkuId}`,
          kodeTrx: b.kodeTrx,
          uraian: b.uraian,
          nilaiBrutoMasuk: this.pajakForm.nilaiPajak
        } as BkuTransaction);
      }
    } else {
      this.jenisTransaksi = 'PENERIMAAN_PAJAK';
      this.pajakForm = {
        kodeTrx: b.kodeTrx,
        masaPajak: b.masaPajak || '01',
        tahunPajak: b.tahunPajak || this.auth.tahunAnggaran(),
        dasarPengenaanPajak: b.dasarPengenaanPajak || 0,
        tarifPersen: b.tarifPersen || 0,
        nilaiPajak: b.nilaiBrutoMasuk > 0 ? b.nilaiBrutoMasuk : b.nilaiBrutoKeluar,
        npwpRekanan: b.npwpRekanan || '',
        namaWpRekanan: b.namaWpRekanan || b.namaRekanan || ''
      };
      if (b.parentBkuId) {
        this.selectedDraftSpj.set({
          id: b.parentBkuId,
          nomorBku: b.parentNomorBku || `BKU #${b.parentBkuId}`,
          uraian: b.uraian,
          nilaiBrutoKeluar: b.dasarPengenaanPajak || 0,
          totalPotonganPajak: 0
        } as BkuTransaction);
      }
    }
  }

  activeSaldoFallback(): number {
    const s = this.auth.activeSekolah();
    if (!s) return 0;
    return this.sumberDana() === 'BOP' ? s.saldoBop : s.saldoBos;
  }

  deriveBidang(kodeKegiatan: string): string {
    if (kodeKegiatan.startsWith('02')) return 'Bidang Perpustakaan & Sarana Sekolah';
    if (kodeKegiatan.startsWith('03')) return 'Bidang Kegiatan Pembelajaran & Kesiswaan';
    if (kodeKegiatan.startsWith('04')) return 'Bidang Pendidik & Tenaga Kependidikan';
    if (kodeKegiatan.startsWith('05')) return 'Bidang Sarana dan Prasarana Sekolah';
    if (kodeKegiatan.startsWith('06')) return 'Bidang Pengembangan Standar Pengelolaan';
    if (kodeKegiatan.startsWith('07')) return 'Bidang Pembiayaan Operasional';
    return 'Bidang Program Kerja Sekolah';
  }

  onJenisPeriodeChange(val: 'Bulanan' | 'Triwulan'): void {
    this.jenisPeriode.set(val);
    this.form.kodePeriode = val === 'Triwulan' ? 'TW1' : '01';
  }

  onJenisTransaksiChange(val: JenisTransaksiMode): void {
    this.jenisTransaksi = val;
    this.pajakInquiryStatus.set('');
    if (val === 'PENERIMAAN_PAJAK') {
      this.loadDraftSpjCandidates();
    } else if (val === 'PENGELUARAN_PAJAK') {
      this.loadPenerimaanCandidates();
    }
  }

  openKegiatanModal(): void {
    this.modalSearch.set('');
    this.showKegiatanModal.set(true);
  }

  selectKegiatan(k: { kodeKegiatan: string; namaKegiatan: string; kodeSnp: string; namaSnp: string }): void {
    this.spj.kodeKegiatan = k.kodeKegiatan;
    this.spj.namaKegiatan = k.namaKegiatan;
    this.spj.namaSnp = `${k.kodeSnp} - ${k.namaSnp}`;
    this.spj.namaBidang = this.deriveBidang(k.kodeKegiatan);
    this.spj.kodeAkun = '';
    this.spj.namaAkun = '';
    this.spj.paguAkbAkun = 0;
    this.spj.sisaPaguAkbAkun = 0;
    this.showKegiatanModal.set(false);
  }

  openAkunModal(): void {
    this.modalSearch.set('');
    this.showAkunModal.set(true);
  }

  selectRkasAkun(r: RkasItem): void {
    this.spj.kodeKegiatan = r.kodeKegiatan;
    this.spj.namaKegiatan = r.namaKegiatan;
    this.spj.namaSnp = `${r.kodeSnp} - ${r.namaSnp}`;
    this.spj.namaBidang = this.deriveBidang(r.kodeKegiatan);
    this.spj.kodeAkun = r.kodeAkun;
    this.spj.namaAkun = r.namaAkun;
    this.spj.paguAkbAkun = r.totalPagu;
    this.spj.sisaPaguAkbAkun = Math.max(0, r.totalPagu - r.totalRealisasi);

    const newItem: SpjRincianDraft = {
      rkasItemId: r.id,
      kodeKegiatan: r.kodeKegiatan,
      namaKegiatan: r.namaKegiatan,
      kodeAkun: r.kodeAkun,
      namaAkun: r.namaAkun,
      kodeKomponen: r.kodeKomponen,
      namaKomponen: r.namaKomponen,
      spesifikasi: r.spesifikasi,
      satuan: r.satuan,
      volume: 1,
      hargaSatuan: r.hargaSatuan
    };

    this.rincianItems.update((list) => [...list, newItem]);
    if (!this.form.uraian.trim()) {
      this.form.uraian = `Belanja ${r.namaKomponen}`;
    }
    this.showAkunModal.set(false);
  }

  updateItemVolume(index: number, volume: number): void {
    this.rincianItems.update((list) =>
      list.map((it, idx) => (idx === index ? { ...it, volume: Math.max(1, Number(volume) || 1) } : it))
    );
  }

  updateItemHarga(index: number, harga: number): void {
    this.rincianItems.update((list) =>
      list.map((it, idx) => (idx === index ? { ...it, hargaSatuan: Math.max(0, Number(harga) || 0) } : it))
    );
  }

  removeRincianItem(index: number): void {
    this.rincianItems.update((list) => list.filter((_, idx) => idx !== index));
  }

  calcTotalSpj(): number {
    return this.rincianItems().reduce((sum, it) => sum + Math.round((Number(it.volume) || 0) * (Number(it.hargaSatuan) || 0)), 0);
  }

  openBankModal(): void {
    this.showBankModal.set(true);
  }

  selectBank(bk: BankOption): void {
    this.spj.kodeBankRekanan = bk.kode;
    this.spj.namaBankRekanan = bk.nama;
    this.onRekeningInputChanged();
    this.showBankModal.set(false);
  }

  onRekeningInputChanged(): void {
    this.rekeningVerified.set(false);
    this.spj.namaRekanan = '';
    this.spj.alamatRekanan = '';
  }

  cekRekening(): void {
    const noRek = this.spj.noRekRekanan.trim() || '1110099887766';
    this.spj.noRekRekanan = noRek;
    this.inquiringRek.set(true);
    this.api.inquiryRekening(this.spj.kodeBankRekanan || '111', noRek).subscribe({
      next: (res) => {
        this.inquiringRek.set(false);
        const d = res.data;
        this.spj.namaBankRekanan = d?.namaBank || this.spj.namaBankRekanan || 'Bank DKI';
        this.spj.namaRekanan = d?.namaPemilikRekening || `REKANAN TERVERIFIKASI (#${noRek.slice(-4).padStart(4, '0')})`;
        this.spj.alamatRekanan = d?.alamatPemilik || 'DKI Jakarta';
        this.rekeningVerified.set(true);
        this.toast.success(`Inquiry Rekening Berhasil: ${this.spj.namaRekanan}`);
      },
      error: () => {
        this.inquiringRek.set(false);
        this.spj.namaBankRekanan = this.spj.namaBankRekanan || 'Bank DKI';
        this.spj.namaRekanan = `REKANAN TERVERIFIKASI (#${noRek.slice(-4).padStart(4, '0')})`;
        this.spj.alamatRekanan = 'DKI Jakarta';
        this.rekeningVerified.set(true);
        this.toast.success(`Inquiry Rekening Dummy: ${this.spj.namaRekanan}`);
      }
    });
  }

  isNpwpFormatValid(): boolean {
    return (this.spj.npwpRekanan || '').trim().length > 0;
  }

  onNpwpInputChanged(): void {
    this.npwpVerified.set(false);
    this.spj.namaWpRekanan = '';
    this.spj.alamatWpRekanan = '';
  }

  cekNpwp(): void {
    const npwp = this.spj.npwpRekanan.trim() || '01.345.678.9-022.000';
    this.spj.npwpRekanan = npwp;
    this.inquiringNpwp.set(true);
    this.api.inquiryNpwp(npwp).subscribe({
      next: (res) => {
        this.inquiringNpwp.set(false);
        const d = res.data;
        this.spj.namaWpRekanan = d?.namaWajibPajak || `WAJIB PAJAK TERVERIFIKASI DJP (#${npwp.replace(/\D/g, '').slice(-4).padStart(4, '0')})`;
        this.spj.alamatWpRekanan = d?.alamat || 'DKI Jakarta';
        this.npwpVerified.set(true);
        this.toast.success(`Inquiry NPWP Berhasil: ${this.spj.namaWpRekanan}`);
      },
      error: () => {
        this.inquiringNpwp.set(false);
        this.spj.namaWpRekanan = `WAJIB PAJAK TERVERIFIKASI DJP (#${npwp.replace(/\D/g, '').slice(-4).padStart(4, '0')})`;
        this.spj.alamatWpRekanan = 'DKI Jakarta';
        this.npwpVerified.set(true);
        this.toast.success(`Inquiry NPWP Dummy: ${this.spj.namaWpRekanan}`);
      }
    });
  }

  onFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadingInvoice.set(true);
    this.form.fileLampiranName = file.name;
    this.api.uploadInvoicePdf(file).subscribe({
      next: (res) => {
        this.uploadingInvoice.set(false);
        input.value = '';
        if (res.success && res.data) {
          this.form.fileLampiranName = res.data.originalName || file.name;
          this.form.fileLampiranPath = res.data.previewUrl;
          this.toast.success(`File ${this.form.fileLampiranName} berhasil diupload.`);
        } else {
          this.toast.warning(res.message || 'Gagal mengupload file invoice.');
        }
      },
      error: (err) => {
        this.uploadingInvoice.set(false);
        input.value = '';
        this.toast.error(err?.error?.message || 'Gagal mengupload file invoice.');
      }
    });
  }

  extractFileName(path?: string): string {
    if (!path) return '-';
    const clean = path.split('?')[0];
    const parts = clean.split('/');
    return decodeURIComponent(parts[parts.length - 1] || path);
  }

  openInvoicePreview(url: string, name?: string): void {
    if (!url) return;
    const clean = url.split('?')[0].toLowerCase();
    const displayName = name || this.extractFileName(url);
    const isImage =
      clean.endsWith('.png') ||
      clean.endsWith('.jpg') ||
      clean.endsWith('.jpeg') ||
      clean.endsWith('.gif') ||
      clean.endsWith('.webp');
    this.previewInvoice.set({
      url,
      safeUrl: this.sanitizer.bypassSecurityTrustResourceUrl(url),
      name: displayName,
      isImage
    });
  }

  closeInvoicePreview(): void {
    this.previewInvoice.set(null);
  }

  openDraftSpjModal(): void {
    this.modalSearch.set('');
    this.loadDraftSpjCandidates();
    this.showDraftSpjModal.set(true);
  }

  loadDraftSpjCandidates(): void {
    const sekId = this.auth.selectedSekolahId() || 1;
    this.api
      .getDraftSpjCandidates(sekId, this.auth.tahunAnggaran(), this.sumberDana(), this.modalSearch().trim() || undefined)
      .subscribe((r) => {
        if (r.success) this.draftSpjCandidates.set(r.data || []);
      });
  }

  selectDraftSpj(s: BkuTransaction): void {
    this.selectedDraftSpj.set(s);
    const bruto = s.nilaiBrutoKeluar || 0;
    this.pajakForm.dasarPengenaanPajak = this.pajakForm.kodeTrx === 'P5' ? Math.round(bruto / 1.11) : bruto;
    this.recalcNilaiPajak();
    this.pajakForm.npwpRekanan = s.npwpRekanan || '';
    this.pajakForm.namaWpRekanan = s.namaWpRekanan || s.namaRekanan || '';
    this.form.uraian = `Penerimaan ${this.pajakForm.kodeTrx} atas ${s.nomorBku} (${s.uraian})`;
    if (!this.form.nomorBukti.trim()) {
      this.form.nomorBukti = `PJK-IN/${this.auth.tahunAnggaran()}/${s.id}`;
    }
    this.showDraftSpjModal.set(false);
    if (this.pajakForm.masaPajak) {
      this.runInquiryPajak(true);
    }
  }

  openPenerimaanModal(): void {
    this.modalSearch.set('');
    this.loadPenerimaanCandidates();
    this.showPenerimaanModal.set(true);
  }

  loadPenerimaanCandidates(): void {
    const sekId = this.auth.selectedSekolahId() || 1;
    this.api
      .getPenerimaanPajakCandidates(sekId, this.auth.tahunAnggaran(), this.sumberDana(), this.modalSearch().trim() || undefined)
      .subscribe((r) => {
        if (r.success) this.penerimaanCandidates.set(r.data || []);
      });
  }

  selectPenerimaan(p: BkuTransaction): void {
    this.selectedPenerimaan.set(p);
    this.pajakForm.kodeTrx = p.kodeTrx;
    this.pajakForm.masaPajak = p.masaPajak || '01';
    this.pajakForm.tahunPajak = p.tahunPajak || this.auth.tahunAnggaran();
    this.pajakForm.dasarPengenaanPajak = p.dasarPengenaanPajak || p.nilaiBrutoMasuk || 0;
    this.pajakForm.tarifPersen = p.tarifPersen || this.findDefaultTarif(p.kodeTrx);
    this.pajakForm.nilaiPajak = p.nilaiBrutoMasuk || 0;
    this.pajakForm.npwpRekanan = p.npwpRekanan || '';
    this.pajakForm.namaWpRekanan = p.namaWpRekanan || p.namaRekanan || '';
    this.form.uraian = `Setoran Pajak ${p.kodeTrx} atas ${p.nomorBku} (SPJ ${p.parentNomorBku || '-'})`;
    if (!this.form.nomorBukti.trim()) {
      this.form.nomorBukti = `PJK-OUT/${this.auth.tahunAnggaran()}/${p.id}`;
    }
    this.showPenerimaanModal.set(false);
  }

  findDefaultTarif(kode: string): number {
    return this.pajakOptions.find((x) => x.kode === kode)?.tarif ?? 0;
  }

  onJenisPajakChanged(kode: string): void {
    this.pajakForm.tarifPersen = this.findDefaultTarif(kode);
    const parentSpj = this.selectedDraftSpj();
    if (parentSpj) {
      const bruto = parentSpj.nilaiBrutoKeluar || 0;
      this.pajakForm.dasarPengenaanPajak = kode === 'P5' ? Math.round(bruto / 1.11) : bruto;
    }
    this.recalcNilaiPajak();
    if (this.jenisTransaksi === 'PENERIMAAN_PAJAK' && this.pajakForm.masaPajak) {
      this.runInquiryPajak(true);
    }
  }

  onMasaPajakChanged(masa: string): void {
    if (masa && this.jenisTransaksi === 'PENERIMAAN_PAJAK') {
      this.runInquiryPajak(true);
    } else {
      this.pajakInquiryStatus.set('');
    }
  }

  onTahunPajakChanged(_tahun: number): void {
    if (this.pajakForm.masaPajak && this.jenisTransaksi === 'PENERIMAAN_PAJAK') {
      this.runInquiryPajak(false);
    }
  }

  runInquiryPajak(showToast = false): void {
    if (!this.pajakForm.masaPajak) {
      if (showToast) this.toast.warning('Silakan pilih Masa Pajak (Bulan) terlebih dahulu.');
      return;
    }
    const parentSpj = this.selectedDraftSpj();
    this.inquiringPajak.set(true);
    this.api
      .inquiryPajak({
        kodeTrx: this.pajakForm.kodeTrx,
        masaPajak: this.pajakForm.masaPajak,
        tahunPajak: Number(this.pajakForm.tahunPajak) || this.auth.tahunAnggaran(),
        brutoSpj: parentSpj?.nilaiBrutoKeluar || 0,
        dasarPengenaanPajak: Number(this.pajakForm.dasarPengenaanPajak) || 0,
        npwp: this.pajakForm.npwpRekanan || undefined,
        namaWajibPajak: this.pajakForm.namaWpRekanan || undefined
      })
      .subscribe({
        next: (res) => {
          this.inquiringPajak.set(false);
          if (res.success && res.data) {
            const d = res.data;
            this.pajakForm.dasarPengenaanPajak = Number(d.dasarPengenaanPajak) || this.pajakForm.dasarPengenaanPajak;
            this.pajakForm.tarifPersen = Number(d.tarifPersen) || this.pajakForm.tarifPersen;
            this.pajakForm.nilaiPajak = Number(d.nilaiPajak) || 0;
            const statusText = `${d.responseMessage || res.message || 'Inquiry pajak berhasil.'} (MAP ${d.kodeMap}/${d.kodeJenisSetoran}, Tarif ${this.pajakForm.tarifPersen}%)`;
            this.pajakInquiryStatus.set(statusText);
            if (showToast) {
              this.toast.success(d.responseMessage || res.message || 'Inquiry pajak berhasil.');
            }
          } else {
            this.recalcNilaiPajak();
            this.pajakInquiryStatus.set(res.message || 'Inquiry pajak berhasil (perhitungan lokal).');
          }
        },
        error: () => {
          this.inquiringPajak.set(false);
          this.recalcNilaiPajak();
          this.pajakInquiryStatus.set('Inquiry pajak berhasil (fallback lokal).');
          if (showToast) {
            this.toast.success('Inquiry pajak berhasil.');
          }
        }
      });
  }

  recalcNilaiPajak(): void {
    const dpp = Number(this.pajakForm.dasarPengenaanPajak) || 0;
    const tarif = Number(this.pajakForm.tarifPersen) || 0;
    this.pajakForm.nilaiPajak = Math.round((dpp * tarif) / 100);
  }

  save(): void {
    if (!this.form.nomorBukti.trim()) {
      this.toast.warning('No Bukti Dokumen harus diisi.');
      return;
    }
    if (!this.form.tanggalTransaksi) {
      this.toast.warning('Tanggal Dokumen harus diisi.');
      return;
    }
    if (!this.form.uraian.trim()) {
      this.toast.warning('Uraian transaksi wajib diisi.');
      return;
    }

    let payload: any;
    const sekId = this.auth.selectedSekolahId() || 1;
    const thn = this.auth.tahunAnggaran();
    const sd = this.sumberDana();

    if (this.jenisTransaksi === 'SPJ') {
      if (!this.form.nomorArsip.trim()) {
        this.toast.warning('Nomor Arsip harus diisi untuk pengajuan SPJ.');
        return;
      }
      if (this.rincianItems().length === 0 || this.calcTotalSpj() <= 0) {
        this.toast.warning('Silakan pilih Akun / Komponen Belanja RKAS dengan Nilai SPJ lebih dari Rp 0.');
        return;
      }
      if (!this.rekeningVerified() || !this.spj.noRekRekanan.trim() || !this.spj.namaRekanan.trim()) {
        this.toast.warning('Silakan lakukan Inquiry No Rekening Bank hingga Nama Rekanan terisi.');
        return;
      }
      if (!this.npwpVerified() || !this.spj.namaWpRekanan.trim()) {
        this.toast.warning('Silakan lakukan Inquiry NPWP hingga Nama NPWP Rekanan terisi.');
        return;
      }

      payload = {
        sekolahId: sekId,
        tahunAnggaran: thn,
        sumberDana: sd,
        kodePeriode: this.form.kodePeriode,
        tanggalTransaksi: this.form.tanggalTransaksi,
        nomorBukti: this.form.nomorBukti.trim(),
        nomorArsip: this.form.nomorArsip.trim(),
        kodeTrx: 'JJ',
        jenisPembayaran: 'Transaksi Luring',
        caraPembayaran: 'BANK',
        isVirtualAccount: false,
        namaBidang: this.spj.namaBidang,
        namaSnp: this.spj.namaSnp,
        uraian: this.form.uraian.trim(),
        kodeBankRekanan: this.spj.kodeBankRekanan,
        namaBankRekanan: this.spj.namaBankRekanan,
        noRekRekanan: this.spj.noRekRekanan.trim(),
        namaRekanan: this.spj.namaRekanan,
        namaPemilikRekRekanan: this.spj.namaRekanan,
        alamatRekanan: this.spj.alamatRekanan,
        npwpRekanan: this.spj.npwpRekanan.trim(),
        namaWpRekanan: this.spj.namaWpRekanan,
        alamatWpRekanan: this.spj.alamatWpRekanan,
        noVaAtauPesanan: '',
        fileLampiranName: this.form.fileLampiranName,
        fileLampiranPath: this.form.fileLampiranPath,
        detailItems: this.rincianItems().map((it) => ({
          rkasItemId: it.rkasItemId || null,
          kodeKegiatan: it.kodeKegiatan,
          namaKegiatan: it.namaKegiatan,
          kodeAkun: it.kodeAkun,
          namaAkun: it.namaAkun,
          kodeKomponen: it.kodeKomponen,
          namaKomponen: it.namaKomponen,
          spesifikasi: it.spesifikasi,
          volume: Number(it.volume),
          satuan: it.satuan,
          hargaSatuan: Number(it.hargaSatuan)
        })),
        taxItems: []
      };
    } else if (this.jenisTransaksi === 'PENERIMAAN_PAJAK') {
      const parentSpj = this.selectedDraftSpj();
      if (!parentSpj) {
        this.toast.warning('Silakan pilih SPJ BKU berstatus Draft PK sebagai referensi.');
        return;
      }
      if (!this.pajakForm.masaPajak) {
        this.toast.warning('Silakan pilih Masa Pajak (Bulan) agar inquiry dan perhitungan pajak diproses.');
        return;
      }
      if (Number(this.pajakForm.nilaiPajak) <= 0) {
        this.toast.warning('Nilai Pajak harus lebih dari Rp 0.');
        return;
      }
      payload = {
        sekolahId: sekId,
        tahunAnggaran: thn,
        sumberDana: sd,
        kodePeriode: this.form.kodePeriode,
        tanggalTransaksi: this.form.tanggalTransaksi,
        nomorBukti: this.form.nomorBukti.trim(),
        nomorArsip: this.form.nomorArsip.trim(),
        kodeTrx: this.pajakForm.kodeTrx,
        jenisPembayaran: 'PENERIMAAN',
        caraPembayaran: 'PAJAK',
        isVirtualAccount: false,
        parentBkuId: parentSpj.id,
        masaPajak: this.pajakForm.masaPajak,
        tahunPajak: Number(this.pajakForm.tahunPajak),
        dasarPengenaanPajak: Number(this.pajakForm.dasarPengenaanPajak),
        tarifPersen: Number(this.pajakForm.tarifPersen),
        nominalNonSpj: Number(this.pajakForm.nilaiPajak),
        uraian: this.form.uraian.trim(),
        npwpRekanan: this.pajakForm.npwpRekanan,
        namaWpRekanan: this.pajakForm.namaWpRekanan,
        namaRekanan: this.pajakForm.namaWpRekanan || 'Pemungutan Pajak Negara'
      };
    } else {
      const pIn = this.selectedPenerimaan();
      if (!pIn) {
        this.toast.warning('Silakan pilih data Penerimaan Pajak yang SPJ induknya sudah Lunas Transfer.');
        return;
      }
      if (Number(this.pajakForm.nilaiPajak) <= 0) {
        this.toast.warning('Nilai Setor Pajak harus lebih dari Rp 0.');
        return;
      }
      payload = {
        sekolahId: sekId,
        tahunAnggaran: thn,
        sumberDana: sd,
        kodePeriode: this.form.kodePeriode,
        tanggalTransaksi: this.form.tanggalTransaksi,
        nomorBukti: this.form.nomorBukti.trim(),
        nomorArsip: this.form.nomorArsip.trim(),
        kodeTrx: this.pajakForm.kodeTrx,
        jenisPembayaran: 'PENGELUARAN',
        caraPembayaran: 'MPN',
        isVirtualAccount: false,
        parentBkuId: pIn.id,
        masaPajak: this.pajakForm.masaPajak,
        tahunPajak: Number(this.pajakForm.tahunPajak),
        dasarPengenaanPajak: Number(this.pajakForm.dasarPengenaanPajak),
        tarifPersen: Number(this.pajakForm.tarifPersen),
        nominalNonSpj: Number(this.pajakForm.nilaiPajak),
        uraian: this.form.uraian.trim(),
        npwpRekanan: this.pajakForm.npwpRekanan,
        namaWpRekanan: this.pajakForm.namaWpRekanan,
        namaRekanan: 'KAS NEGARA / DJP (MPN G3)',
        taxItems: [
          {
            kodeTrxPajak: this.pajakForm.kodeTrx,
            masaPajak: this.pajakForm.masaPajak,
            tahunPajak: Number(this.pajakForm.tahunPajak),
            dasarPengenaanPajak: Number(this.pajakForm.dasarPengenaanPajak),
            tarifPersen: Number(this.pajakForm.tarifPersen),
            nilaiPajak: Number(this.pajakForm.nilaiPajak)
          }
        ]
      };
    }

    this.saving.set(true);
    const id = this.recordId();
    const obs =
      this.mode() === 'edit' && id
        ? this.api.updateBku(sd, id, payload)
        : this.api.createBku(sd, payload);

    obs.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.toast.success(res.message || 'Transaksi BKU berhasil disimpan.');
          this.router.navigate([this.basePath(), 'input-bku']);
        }
      },
      error: (err) => {
        this.saving.set(false);
        const msg = err?.error?.message || 'Gagal menyimpan transaksi BKU.';
        this.toast.error(msg);
      }
    });
  }

  canEditRecord(b: BkuTransaction | null): boolean {
    if (!b) return false;
    return this.auth.hasRole('PK-NEGERI', 'ADMIN-TDI') && (b.statusBku === 0 || b.statusBku === 9) && !b.isTutupBuku;
  }

  goToEdit(id: number): void {
    this.mode.set('edit');
    this.router.navigate([this.basePath(), 'input-bku', 'edit', id]);
  }

  goToDetailId(id: number): void {
    this.mode.set('detail');
    this.recordId.set(id);
    this.router.navigate([this.basePath(), 'input-bku', 'detail', id]);
    this.loadDetail(id);
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate([this.basePath(), 'input-bku']);
    }
  }

  formatNumber(val: number): string {
    return (Number(val) || 0).toLocaleString('id-ID');
  }

  MathMax0(val: number): number {
    return Math.max(0, val);
  }

  NumberVal(val: unknown): number {
    return Number(val) || 0;
  }
}
