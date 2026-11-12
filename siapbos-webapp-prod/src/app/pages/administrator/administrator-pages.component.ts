import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { DroppingDana, RkasItem } from '../../core/models/siapbos.models';

// =========================================================================
// 1. DROPPING DANA ADMIN DINAS
// =========================================================================
@Component({
  selector: 'app-dropping-dana-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <div>
        <h5 class="fw-bold mb-0"><i class="bi bi-cash-coin text-warning me-2"></i>Penerbitan SP2D &amp; Dropping Dana Sekolah</h5>
        <small class="text-muted">Admin Dinas menyalurkan dana tahap/triwulan ke sekolah, selanjutnya dikonfirmasi oleh Bendahara ke BKU (JO).</small>
      </div>
      <div class="d-flex gap-2">
        <select class="form-select form-select-sm" style="width: auto;" [(ngModel)]="filterDana">
          <option value="ALL">Semua Sumber Dana</option>
          <option value="BOS">BOS</option>
          <option value="BOP">BOP</option>
        </select>
        <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" (click)="loadData()">
          <i class="bi bi-arrow-clockwise me-1"></i>Refresh
        </button>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-lg-4">
        <div class="siap-card p-3">
          <h6 class="fw-bold mb-3">Terbitkan Dropping SP2D Baru</h6>
          <div class="mb-2">
            <label class="form-label small fw-semibold">Sekolah Tujuan</label>
            <select class="form-select" [(ngModel)]="form.sekolahId">
              @for (s of auth.sekolahList(); track s.id) {
                <option [ngValue]="s.id">{{ s.namaSekolah }} ({{ s.npsn }})</option>
              }
            </select>
          </div>
          <div class="row g-2 mb-2">
            <div class="col-6">
              <label class="form-label small fw-semibold">Sumber Dana</label>
              <select class="form-select" [(ngModel)]="form.sumberDana" (ngModelChange)="onChangeSumberDana()">
                <option value="BOS">BOS</option>
                <option value="BOP">BOP</option>
              </select>
            </div>
            <div class="col-6">
              <label class="form-label small fw-semibold">Kode Periode</label>
              <select class="form-select" [(ngModel)]="form.kodePeriode">
                @if (form.sumberDana === 'BOS') {
                  <option value="01">01 - Tahap 1</option>
                  <option value="02">02 - Tahap 2</option>
                } @else {
                  <option value="TW1">TW1</option>
                  <option value="TW2">TW2</option>
                  <option value="TW3">TW3</option>
                  <option value="TW4">TW4</option>
                }
              </select>
            </div>
          </div>
          <div class="mb-2">
            <label class="form-label small fw-semibold">Nomor SP2D (Kosongkan = Auto Generate)</label>
            <input class="form-control" [(ngModel)]="form.nomorSp2d" placeholder="SP2D/DKI/BOS/2026/0012">
          </div>
          <div class="mb-2">
            <label class="form-label small fw-semibold">Nilai Dropping (Rp)</label>
            <input type="number" class="form-control fw-bold tabular-nums" [(ngModel)]="form.nilaiDropping" min="100000" step="500000">
          </div>
          <div class="mb-3">
            <label class="form-label small fw-semibold">Keterangan Penyaluran</label>
            <textarea class="form-control" rows="2" [(ngModel)]="form.keterangan"></textarea>
          </div>
          <button class="btn btn-siap w-100 rounded-pill py-2" (click)="createDropping()" [disabled]="saving()">
            @if (saving()) { <span class="spinner-border spinner-border-sm me-2"></span>Menyalurkan... }
            @else { <i class="bi bi-send-check me-1"></i>Terbitkan Dropping Dana }
          </button>
        </div>
      </div>

      <div class="col-lg-8">
        <div class="siap-card">
          <div class="table-responsive">
            <table class="table table-siap table-hover">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Sekolah</th>
                  <th>Dana / Periode</th>
                  <th>Nomor SP2D</th>
                  <th class="text-end">Nilai Dropping</th>
                  <th>Status Sekolah</th>
                </tr>
              </thead>
              <tbody>
                @for (d of filteredList(); track d.id) {
                  <tr>
                    <td>{{ d.tanggalDropping | date:'dd/MM/yyyy' }}</td>
                    <td class="fw-semibold">{{ d.sekolah?.namaSekolah || ('Sekolah #' + d.sekolahId) }}</td>
                    <td>
                      <span class="badge" [class.text-bg-warning]="d.sumberDana === 'BOS'" [class.text-bg-primary]="d.sumberDana === 'BOP'">
                        {{ d.sumberDana }}
                      </span>
                      <span class="ms-1 small">{{ d.kodePeriode }}</span>
                    </td>
                    <td>
                      <div class="fw-bold">{{ d.nomorSp2d }}</div>
                      <small class="text-muted">{{ d.keterangan }}</small>
                    </td>
                    <td class="text-end fw-bold text-success tabular-nums">{{ d.nilaiDropping | currency:'IDR':'symbol':'1.0-0' }}</td>
                    <td>
                      @if (d.isConfirmedToBku) {
                        <span class="badge bg-success-subtle text-success"><i class="bi bi-check-circle me-1"></i>Masuk BKU</span>
                      } @else {
                        <span class="badge bg-warning-subtle text-warning-emphasis">Menunggu Konfirmasi</span>
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
export class DroppingDanaAdminComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly list = signal<DroppingDana[]>([]);
  readonly saving = signal(false);
  filterDana = 'ALL';

  form = {
    sekolahId: 1,
    sumberDana: 'BOS',
    kodePeriode: '02',
    namaPeriode: 'Tahap 2',
    nomorSp2d: '',
    nilaiDropping: 50000000,
    keterangan: 'Penyaluran Dana Tahap II TA 2026'
  };

  readonly filteredList = computed(() =>
    this.filterDana === 'ALL' ? this.list() : this.list().filter((d) => d.sumberDana === this.filterDana)
  );

  ngOnInit(): void {
    if (this.auth.sekolahList().length === 0) {
      this.auth.loadSekolahOptions().subscribe((res) => {
        if (res.data?.length) this.form.sekolahId = res.data[0].id;
      });
    } else {
      this.form.sekolahId = this.auth.selectedSekolahId() || this.auth.sekolahList()[0]?.id || 1;
    }
    this.loadData();
  }

  onChangeSumberDana(): void {
    this.form.kodePeriode = this.form.sumberDana === 'BOS' ? '02' : 'TW2';
    this.form.namaPeriode = this.form.sumberDana === 'BOS' ? 'Tahap 2' : 'Triwulan II';
  }

  loadData(): void {
    this.api.getAdminDropping(this.auth.tahunAnggaran()).subscribe({
      next: (res) => this.list.set(res.data || []),
      error: (err) => this.toast.error(err?.error?.message || 'Gagal memuat daftar dropping.')
    });
  }

  createDropping(): void {
    if (this.form.nilaiDropping <= 0) {
      this.toast.error('Nilai dropping harus lebih dari 0.');
      return;
    }
    this.saving.set(true);
    this.api
      .createAdminDropping({
        ...this.form,
        sekolahId: Number(this.form.sekolahId),
        tahunAnggaran: this.auth.tahunAnggaran()
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.toast.success(res.message);
          this.form.nomorSp2d = '';
          this.loadData();
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error(err?.error?.message || 'Gagal menerbitkan dropping dana.');
        }
      });
  }
}

// =========================================================================
// 2. KONVERSI & MONITORING RKAS (UPLOAD EXCEL VIA :5006)
// =========================================================================
@Component({
  selector: 'app-konversi-rkas',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <div>
        <h5 class="fw-bold mb-0"><i class="bi bi-file-earmark-spreadsheet text-warning me-2"></i>Konversi &amp; Data Anggaran RKAS</h5>
        <small class="text-muted">Import Excel RKAS melalui microservice <code>siapbos-uploader (:5006)</code> atau tambah komponen pagu manual.</small>
      </div>
      <a class="btn btn-sm btn-outline-success rounded-pill px-3" href="/file-uploader/api/file-uploader/template-rkas" target="_blank">
        <i class="bi bi-download me-1"></i>Download Template Excel RKAS (.xlsx)
      </a>
    </div>

    <div class="row g-3 mb-3">
      <!-- Upload Excel Box -->
      <div class="col-lg-5">
        <div class="siap-card p-3 h-100">
          <h6 class="fw-bold mb-2">1. Upload File Excel Konversi RKAS</h6>
          <p class="text-muted small mb-3">Gunakan template resmi agar kolom Kode SNP, Kegiatan, Kode Akun BAS, dan Pagu terbaca otomatis.</p>
          <div class="input-group mb-2">
            <input type="file" class="form-control" accept=".xlsx,.xls" (change)="onFileSelected($event)">
            <button class="btn btn-siap" (click)="uploadExcel()" [disabled]="!selectedFile() || uploading()">
              @if (uploading()) { <span class="spinner-border spinner-border-sm me-1"></span>Upload... }
              @else { <i class="bi bi-cloud-upload me-1"></i>Import RKAS }
            </button>
          </div>
          @if (uploadMessage()) {
            <div class="alert alert-success py-2 px-3 small mb-0">{{ uploadMessage() }}</div>
          }
        </div>
      </div>

      <!-- Form Tambah Komponen RKAS Manual -->
      <div class="col-lg-7">
        <div class="siap-card p-3 h-100">
          <h6 class="fw-bold mb-2">2. Tambah Item Pagu RKAS Manual</h6>
          <div class="row g-2">
            <div class="col-md-4">
              <label class="form-label small fw-semibold mb-1">Sekolah</label>
              <select class="form-select form-select-sm" [(ngModel)]="manual.sekolahId" (ngModelChange)="loadRkas()">
                @for (s of auth.sekolahList(); track s.id) {
                  <option [ngValue]="s.id">{{ s.namaSekolah }}</option>
                }
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label small fw-semibold mb-1">Sumber Dana</label>
              <select class="form-select form-select-sm" [(ngModel)]="manual.sumberDana" (ngModelChange)="loadRkas()">
                <option value="BOS">BOS</option>
                <option value="BOP">BOP</option>
              </select>
            </div>
            <div class="col-md-5">
              <label class="form-label small fw-semibold mb-1">Kode Rekening BAS</label>
              <select class="form-select form-select-sm" [(ngModel)]="manual.kodeAkun" (ngModelChange)="onBasChange()">
                <option value="">-- Pilih Akun BAS --</option>
                @for (acc of basList(); track acc.kodeAkun) {
                  <option [value]="acc.kodeAkun">{{ acc.kodeAkun }} - {{ acc.namaAkun }}</option>
                }
              </select>
            </div>
            <div class="col-md-5">
              <label class="form-label small fw-semibold mb-1">Nama Komponen Belanja</label>
              <input class="form-control form-control-sm" [(ngModel)]="manual.namaKomponen" placeholder="Kertas HVS / Honor Ekskul">
            </div>
            <div class="col-md-2">
              <label class="form-label small fw-semibold mb-1">Volume</label>
              <input type="number" class="form-control form-control-sm" [(ngModel)]="manual.volume" min="1">
            </div>
            <div class="col-md-3">
              <label class="form-label small fw-semibold mb-1">Harga Satuan</label>
              <input type="number" class="form-control form-control-sm" [(ngModel)]="manual.hargaSatuan" min="1000">
            </div>
            <div class="col-md-2 d-flex align-items-end">
              <button class="btn btn-sm btn-siap w-100" (click)="saveManual()">+ Tambah</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabel RKAS -->
    <div class="siap-card">
      <div class="siap-card-header d-flex justify-content-between align-items-center">
        <div>
          <h6 class="fw-bold mb-0">Daftar Komponen RKAS ({{ manual.sumberDana }} TA {{ auth.tahunAnggaran() }})</h6>
          <small class="text-muted">Total Pagu: <strong class="text-dark">{{ totalPagu() | currency:'IDR':'symbol':'1.0-0' }}</strong> · Realisasi: <strong class="text-success">{{ totalRealisasi() | currency:'IDR':'symbol':'1.0-0' }}</strong></small>
        </div>
        <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" (click)="loadRkas()">
          <i class="bi bi-arrow-clockwise me-1"></i>Refresh RKAS
        </button>
      </div>
      <div class="table-responsive">
        <table class="table table-siap table-hover">
          <thead>
            <tr>
              <th>SNP / Kegiatan</th>
              <th>Kode &amp; Nama Akun BAS</th>
              <th>Komponen &amp; Spesifikasi</th>
              <th class="text-center">Vol</th>
              <th class="text-end">Total Pagu</th>
              <th class="text-end">Realisasi</th>
              <th class="text-end">Sisa Pagu</th>
            </tr>
          </thead>
          <tbody>
            @if (items().length === 0) {
              <tr><td colspan="7" class="text-center py-4 text-muted">Belum ada data RKAS pada filter terpilih.</td></tr>
            }
            @for (r of items(); track r.id) {
              <tr>
                <td>
                  <div class="fw-semibold">{{ r.kodeSnp }} · {{ r.kodeKegiatan }}</div>
                  <small class="text-muted">{{ r.namaKegiatan }}</small>
                </td>
                <td>
                  <code class="small">{{ r.kodeAkun }}</code>
                  <div class="small text-muted">{{ r.namaAkun }}</div>
                </td>
                <td>
                  <div class="fw-semibold">{{ r.namaKomponen }}</div>
                  <small class="text-muted">{{ r.spesifikasi || '-' }}</small>
                </td>
                <td class="text-center">{{ r.volume }} {{ r.satuan }}</td>
                <td class="text-end fw-semibold tabular-nums">{{ r.totalPagu | currency:'IDR':'symbol':'1.0-0' }}</td>
                <td class="text-end text-success tabular-nums">{{ r.totalRealisasi | currency:'IDR':'symbol':'1.0-0' }}</td>
                <td class="text-end fw-bold text-primary tabular-nums">{{ (r.totalPagu - r.totalRealisasi) | currency:'IDR':'symbol':'1.0-0' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class KonversiRkasComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly items = signal<RkasItem[]>([]);
  readonly basList = signal<any[]>([]);
  readonly selectedFile = signal<File | null>(null);
  readonly uploading = signal(false);
  readonly uploadMessage = signal('');

  manual = {
    sekolahId: 1,
    sumberDana: 'BOS',
    kodeAkun: '',
    namaAkun: '',
    namaKomponen: '',
    volume: 10,
    hargaSatuan: 50000
  };

  readonly totalPagu = computed(() => this.items().reduce((acc, i) => acc + i.totalPagu, 0));
  readonly totalRealisasi = computed(() => this.items().reduce((acc, i) => acc + i.totalRealisasi, 0));

  ngOnInit(): void {
    if (this.auth.sekolahList().length === 0) {
      this.auth.loadSekolahOptions().subscribe((res) => {
        if (res.data?.length) {
          this.manual.sekolahId = this.auth.selectedSekolahId() || res.data[0].id;
          this.loadRkas();
        }
      });
    } else {
      this.manual.sekolahId = this.auth.selectedSekolahId() || 1;
      this.loadRkas();
    }
    this.api.getBasAccounts().subscribe({
      next: (res) => this.basList.set(res.data || [])
    });
  }

  onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
    }
  }

  uploadExcel(): void {
    const f = this.selectedFile();
    if (!f) return;
    this.uploading.set(true);
    this.api.uploadRkasExcel(f).subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.uploadMessage.set(res.message);
        this.toast.success(res.message);
        this.selectedFile.set(null);
        this.loadRkas();
      },
      error: (err) => {
        this.uploading.set(false);
        this.toast.error(err?.error?.message || 'Gagal mengupload file Excel RKAS.');
      }
    });
  }

  onBasChange(): void {
    const found = this.basList().find((b) => b.kodeAkun === this.manual.kodeAkun);
    if (found) this.manual.namaAkun = found.namaAkun;
  }

  saveManual(): void {
    if (!this.manual.kodeAkun || !this.manual.namaKomponen.trim()) {
      this.toast.error('Kode Akun BAS dan Nama Komponen wajib diisi.');
      return;
    }
    this.api
      .createRkasItem({
        sekolahId: Number(this.manual.sekolahId),
        tahunAnggaran: this.auth.tahunAnggaran(),
        sumberDana: this.manual.sumberDana,
        kodePeriode: this.manual.sumberDana === 'BOS' ? '01' : 'TW2',
        kodeSnp: '05',
        namaSnp: 'Pengembangan Sarana dan Prasarana Sekolah',
        kodeKegiatan: '05.05.01',
        namaKegiatan: 'Pemeliharaan & Pengadaan Operasional Sekolah',
        kodeAkun: this.manual.kodeAkun,
        namaAkun: this.manual.namaAkun,
        kodeKomponen: `KMP-${Date.now().toString().slice(-4)}`,
        namaKomponen: this.manual.namaKomponen.trim(),
        spesifikasi: 'Input Manual Admin',
        satuan: 'Paket',
        volume: Number(this.manual.volume),
        hargaSatuan: Number(this.manual.hargaSatuan)
      })
      .subscribe({
        next: (res) => {
          this.toast.success(res.message);
          this.manual.namaKomponen = '';
          this.loadRkas();
        },
        error: (err) => this.toast.error(err?.error?.message || 'Gagal menambah komponen RKAS.')
      });
  }

  loadRkas(): void {
    this.api.getRkasItems(Number(this.manual.sekolahId), this.auth.tahunAnggaran(), this.manual.sumberDana).subscribe({
      next: (res) => this.items.set(res.data || []),
      error: (err) => this.toast.error(err?.error?.message || 'Gagal memuat RKAS.')
    });
  }
}

// =========================================================================
// 3. BATAS PENGAJUAN PERIODE
// =========================================================================
@Component({
  selector: 'app-batas-pengajuan',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="siap-card">
      <div class="siap-card-header d-flex justify-content-between align-items-center">
        <div>
          <h6 class="fw-bold mb-0"><i class="bi bi-calendar-check text-warning me-2"></i>Pengaturan Batas Waktu Pengajuan Belanja (TA {{ auth.tahunAnggaran() }})</h6>
          <small class="text-muted">Menentukan tanggal cut-off pengajuan SPJ &amp; status aktif setiap periode BOS dan BOP.</small>
        </div>
        <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" (click)="load()">
          <i class="bi bi-arrow-clockwise me-1"></i>Refresh
        </button>
      </div>
      <div class="table-responsive">
        <table class="table table-siap table-hover">
          <thead>
            <tr>
              <th>Sumber Dana</th>
              <th>Kode</th>
              <th>Nama Periode</th>
              <th>Bulan</th>
              <th>Batas Pengajuan Belanja</th>
              <th>Status Periode</th>
              <th class="text-end">Simpan</th>
            </tr>
          </thead>
          <tbody>
            @for (p of periodes(); track p.id) {
              <tr>
                <td>
                  <span class="badge" [class.text-bg-warning]="p.sumberDana === 'BOS'" [class.text-bg-primary]="p.sumberDana === 'BOP'">{{ p.sumberDana }}</span>
                </td>
                <td class="fw-bold">{{ p.kodePeriode }}</td>
                <td>{{ p.namaPeriode }}</td>
                <td>Bulan {{ p.bulanMulai }} s.d. {{ p.bulanSelesai }}</td>
                <td>
                  <input type="date" class="form-control form-control-sm" style="width: 170px;" [(ngModel)]="p.batasDateStr">
                </td>
                <td>
                  <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" [(ngModel)]="p.isActive" [id]="'act-' + p.id">
                    <label class="form-check-label small" [for]="'act-' + p.id">{{ p.isActive ? 'Aktif / Terbuka' : 'Tutup' }}</label>
                  </div>
                </td>
                <td class="text-end">
                  <button class="btn btn-sm btn-siap rounded-pill px-3" (click)="save(p)">
                    <i class="bi bi-save me-1"></i>Update
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class BatasPengajuanComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly periodes = signal<any[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getPeriodes(this.auth.tahunAnggaran()).subscribe({
      next: (res) => {
        const mapped = (res.data || []).map((p) => ({
          ...p,
          batasDateStr: p.batasPengajuanBelanja ? String(p.batasPengajuanBelanja).substring(0, 10) : '2026-12-31'
        }));
        this.periodes.set(mapped);
      }
    });
  }

  save(p: any): void {
    this.api
      .updateBatasPengajuan(p.id, {
        batasPengajuanBelanja: `${p.batasDateStr}T23:59:59`,
        isActive: Boolean(p.isActive)
      })
      .subscribe({
        next: (res) => this.toast.success(res.message),
        error: (err) => this.toast.error(err?.error?.message || 'Gagal memperbarui batas pengajuan.')
      });
  }
}

// =========================================================================
// 4. HELPDESK & INTEGRATION AUDIT LOG VIEWER (:5004)
// =========================================================================
@Component({
  selector: 'app-helpdesk-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <ul class="nav nav-pills mb-3 gap-2">
      <li class="nav-item">
        <button class="nav-link fw-semibold rounded-pill px-4"
                [class.active]="tab() === 'helpdesk'" [class.bg-warning]="tab() === 'helpdesk'" [class.text-dark]="tab() === 'helpdesk'"
                (click)="tab.set('helpdesk')">
          <i class="bi bi-headset me-1"></i>Tiket Helpdesk Sekolah ({{ tickets().length }})
        </button>
      </li>
      <li class="nav-item">
        <button class="nav-link fw-semibold rounded-pill px-4"
                [class.active]="tab() === 'logs'" [class.bg-warning]="tab() === 'logs'" [class.text-dark]="tab() === 'logs'"
                (click)="tab.set('logs'); loadLogs()">
          <i class="bi bi-activity me-1"></i>Live Audit Log Integrasi (Bank DKI / DJP / SIPKD / SIMPEG)
        </button>
      </li>
    </ul>

    @if (tab() === 'helpdesk') {
      <div class="row g-3">
        <div class="col-lg-4">
          <div class="siap-card p-3">
            <h6 class="fw-bold mb-3">Buat Tiket Bantuan / Pengaduan</h6>
            <div class="mb-2">
              <label class="form-label small fw-semibold">Kategori Masalah</label>
              <select class="form-select" [(ngModel)]="ticketForm.kategori">
                <option value="Integrasi Bank DKI">Integrasi CMS Bank DKI</option>
                <option value="Pajak MPN DJP">Pajak MPN / Kode Billing DJP</option>
                <option value="Sinkronisasi RKAS">Sinkronisasi &amp; Upload RKAS</option>
                <option value="Akun & Otoritas">Akun Pengguna &amp; Role</option>
              </select>
            </div>
            <div class="mb-2">
              <label class="form-label small fw-semibold">Judul Kendala</label>
              <input class="form-control" [(ngModel)]="ticketForm.judul" placeholder="Contoh: Gagal request OTP pembayaran SPJ">
            </div>
            <div class="mb-3">
              <label class="form-label small fw-semibold">Deskripsi Lengkap</label>
              <textarea class="form-control" rows="3" [(ngModel)]="ticketForm.deskripsi"></textarea>
            </div>
            <button class="btn btn-siap w-100 rounded-pill" (click)="submitTicket()">
              <i class="bi bi-send me-1"></i>Kirim Tiket Helpdesk
            </button>
          </div>
        </div>

        <div class="col-lg-8">
          <div class="siap-card p-3">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h6 class="fw-bold mb-0">Daftar Tiket Masuk</h6>
              <button class="btn btn-sm btn-outline-secondary rounded-pill" (click)="loadTickets()">Refresh</button>
            </div>
            @for (t of tickets(); track t.id) {
              <div class="border rounded-3 p-3 mb-2 bg-light">
                <div class="d-flex justify-content-between align-items-start gap-2">
                  <div>
                    <span class="badge text-bg-secondary me-1">{{ t.kategori }}</span>
                    <span class="badge" [class.text-bg-warning]="t.status === 'OPEN'" [class.text-bg-success]="t.status === 'RESOLVED'">{{ t.status }}</span>
                    <h6 class="fw-bold mt-2 mb-1">{{ t.judul }}</h6>
                    <div class="small text-muted">Pelapor: {{ t.namaPelapor }} ({{ t.rolePelapor }}) · {{ t.createdAt | date:'dd/MM/yyyy HH:mm' }}</div>
                    <p class="small mt-2 mb-2">{{ t.deskripsi }}</p>
                  </div>
                </div>
                @if (t.tanggapanAdmin) {
                  <div class="alert alert-success py-2 px-3 small mb-0">
                    <strong>Tanggapan Admin Dinas:</strong> {{ t.tanggapanAdmin }}
                  </div>
                } @else {
                  <div class="input-group input-group-sm mt-2">
                    <input class="form-control" [(ngModel)]="replyDraft[t.id]" placeholder="Ketik tanggapan Admin Dinas untuk menyelesaikan tiket...">
                    <button class="btn btn-success" (click)="replyTicket(t.id)">Tanggapi &amp; Resolve</button>
                  </div>
                }
              </div>
            } @empty {
              <div class="text-center text-muted py-4">Belum ada tiket helpdesk.</div>
            }
          </div>
        </div>
      </div>
    } @else {
      <div class="siap-card">
        <div class="siap-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <h6 class="fw-bold mb-0">Log Komunikasi External Gateway (<code>siapbos-integration :5004</code>)</h6>
            <small class="text-muted">Menampilkan setiap request &amp; response real-time ke sistem eksternal dummy.</small>
          </div>
          <div class="d-flex gap-1 flex-wrap">
            @for (sys of ['', 'BANK_DKI', 'DJP_MPN', 'SIPKD', 'SIMPEG']; track sys) {
              <button class="btn btn-sm rounded-pill px-3"
                      [class.btn-siap]="logFilter() === sys"
                      [class.btn-outline-secondary]="logFilter() !== sys"
                      (click)="logFilter.set(sys); loadLogs()">
                {{ sys || 'SEMUA' }}
              </button>
            }
          </div>
        </div>
        <div class="table-responsive">
          <table class="table table-siap table-hover">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Sistem</th>
                <th>Caller → Endpoint</th>
                <th>Status</th>
                <th>Request &amp; Response JSON</th>
              </tr>
            </thead>
            <tbody>
              @for (l of logs(); track l.id) {
                <tr>
                  <td class="text-nowrap small">{{ l.timestamp | date:'dd/MM HH:mm:ss' }}</td>
                  <td>
                    <span class="badge bg-dark-subtle text-dark border">{{ l.systemName }}</span>
                  </td>
                  <td class="small">
                    <div class="fw-semibold">{{ l.callerService }}</div>
                    <code>{{ l.endpointCalled }}</code>
                  </td>
                  <td>
                    <span class="badge" [class.text-bg-success]="l.isSuccess" [class.text-bg-danger]="!l.isSuccess">
                      RC {{ l.statusCode }}
                    </span>
                  </td>
                  <td style="max-width: 480px;">
                    <div class="small text-muted text-truncate"><strong>Req:</strong> {{ l.requestPayload }}</div>
                    <div class="small text-success text-truncate"><strong>Res:</strong> {{ l.responsePayload }}</div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="text-center py-4 text-muted">Belum ada log integrasi tercatat.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `
})
export class HelpdeskLogsComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly tab = signal<'helpdesk' | 'logs'>('helpdesk');
  readonly tickets = signal<any[]>([]);
  readonly logs = signal<any[]>([]);
  readonly logFilter = signal<string>('');
  replyDraft: Record<number, string> = {};

  ticketForm = {
    kategori: 'Integrasi Bank DKI',
    judul: '',
    deskripsi: ''
  };

  ngOnInit(): void {
    this.loadTickets();
    this.loadLogs();
  }

  loadTickets(): void {
    this.api.getHelpdesk().subscribe({
      next: (res) => this.tickets.set(res.data || [])
    });
  }

  loadLogs(): void {
    this.api.getIntegrationLogs(this.logFilter() || undefined).subscribe({
      next: (res) => this.logs.set(res.data || [])
    });
  }

  submitTicket(): void {
    if (!this.ticketForm.judul.trim() || !this.ticketForm.deskripsi.trim()) {
      this.toast.error('Judul dan deskripsi keluhan wajib diisi.');
      return;
    }
    const u = this.auth.currentUser();
    this.api
      .createHelpdesk({
        sekolahId: this.auth.selectedSekolahId() || u?.sekolahId || 1,
        namaPelapor: u?.namaLengkap || 'Operator Sekolah',
        rolePelapor: u?.roleCode || 'PK-NEGERI',
        judul: this.ticketForm.judul.trim(),
        kategori: this.ticketForm.kategori,
        deskripsi: this.ticketForm.deskripsi.trim()
      })
      .subscribe({
        next: (res) => {
          this.toast.success(res.message);
          this.ticketForm.judul = '';
          this.ticketForm.deskripsi = '';
          this.loadTickets();
        },
        error: (err) => this.toast.error(err?.error?.message || 'Gagal mengirim tiket helpdesk.')
      });
  }

  replyTicket(id: number): void {
    const text = (this.replyDraft[id] || '').trim();
    if (!text) {
      this.toast.error('Isi tanggapan admin terlebih dahulu.');
      return;
    }
    this.api.respondHelpdesk(id, text, 'RESOLVED').subscribe({
      next: (res) => {
        this.toast.success(res.message);
        this.loadTickets();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal menanggapi tiket.')
    });
  }
}
