import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { DroppingDana, RkasItem } from '../../core/models/siapbos.models';
import { TablePaginationComponent, slicePaged } from '../../shared/components/table-pagination.component';

// =========================================================================
// 1. DROPPING DANA & MIGRASI EXCEL PASK ADMIN DINAS
// =========================================================================
@Component({
  selector: 'app-dropping-dana-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  template: `
    <!-- Section Migrasi Excel Dropping Dana & Permohonan NPD (ADM Only) -->
    <div class="siap-card mb-3 border border-warning-subtle">
      <div class="siap-card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h6 class="fw-bold mb-0"><i class="bi bi-file-earmark-excel text-success me-2"></i>Migrasi Data Dropping Dana &amp; Permohonan NPD (Excel → PASK)</h6>
          <small class="text-muted">Upload file Excel Template Migrasi PASK untuk memunculkan pilihan PASK read-only pada Dropping Dana (BOS) dan Permohonan NPD (BOP) — 1x per triwulan.</small>
        </div>
        <a class="btn btn-sm btn-siap rounded-pill px-3" href="/file-uploader/api/file-uploader/template-migrasi-dana" target="_blank">
          <i class="bi bi-download me-1"></i>Download Template Excel Dropping &amp; NPD (.xlsx)
        </a>
      </div>
      <div class="p-3">
        <div class="row g-2 align-items-center mb-3">
          <div class="col-lg-6">
            <div class="input-group input-group-sm">
              <input #migrasiFileInput type="file" class="form-control" accept=".xlsx,.xls" (change)="onMigrasiFileSelected($event)">
              <button class="btn btn-siap" (click)="uploadMigrasiExcel(migrasiFileInput)" [disabled]="!migrasiFile() || uploadingMigrasi()">
                @if (uploadingMigrasi()) { <span class="spinner-border spinner-border-sm me-1"></span>Mengimpor... }
                @else { <i class="bi bi-cloud-upload me-1"></i>Upload &amp; Migrasi Data Dana }
              </button>
            </div>
            @if (migrasiFile(); as mf) {
              <div class="small text-primary mt-1">
                <i class="bi bi-file-earmark-spreadsheet me-1"></i>File dipilih: <strong>{{ mf.name }}</strong> (klik Upload untuk mengimpor)
              </div>
            } @else if (lastUploadedMigrasiName()) {
              <div class="small text-success fw-semibold mt-1">
                <i class="bi bi-check-circle-fill me-1"></i>File sudah diupload: <strong>{{ lastUploadedMigrasiName() }}</strong>
              </div>
            }
          </div>
          <div class="col-lg-3">
            <select class="form-select form-select-sm" [(ngModel)]="migrasiFilterSumber" (ngModelChange)="loadMigrasiList()">
              <option value="">Semua Sumber Dana (BOS &amp; BOP)</option>
              <option value="BOS">BOS (Dropping Dana BOSP)</option>
              <option value="BOP">BOP (Permohonan NPD)</option>
            </select>
          </div>
          <div class="col-lg-3 text-lg-end">
            <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" (click)="loadMigrasiList()">
              <i class="bi bi-arrow-clockwise me-1"></i>Refresh Hasil Migrasi
            </button>
          </div>
        </div>
        @if (migrasiMessage()) {
          <div class="alert alert-success py-2 px-3 small mb-3">{{ migrasiMessage() }}</div>
        }

        <div class="table-responsive">
          <table class="table table-siap table-hover mb-0">
            <thead>
              <tr>
                <th>Sekolah</th>
                <th>Dana &amp; Triwulan</th>
                <th>Kode Subgiat &amp; Nama PASK</th>
                <th class="text-center">Rincian</th>
                <th class="text-end">Total Alokasi (Terkunci)</th>
                <th>Import</th>
              </tr>
            </thead>
            <tbody>
              @if (migrasiList().length === 0) {
                <tr><td colspan="6" class="text-center py-3 text-muted">Belum ada data hasil migrasi PASK pada filter terpilih.</td></tr>
              }
              @for (m of migrasiList(); track m.id) {
                <tr>
                  <td>
                    <div class="fw-semibold">{{ m.sekolah?.namaSekolah || ('Sekolah #' + m.sekolahId) }}</div>
                    <small class="text-muted">NPSN: {{ m.sekolah?.npsn || '-' }}</small>
                  </td>
                  <td>
                    <span class="badge me-1" [class]="m.sumberDana === 'BOS' ? 'text-bg-primary' : 'text-bg-warning text-dark'">{{ m.sumberDana }}</span>
                    <span class="badge bg-light text-dark border">{{ m.kodePeriode }}</span>
                  </td>
                  <td>
                    <div class="fw-semibold">{{ m.kodeSubgiat }} · {{ m.namaPask }}</div>
                    <small class="text-muted">{{ m.program }} ({{ m.nomorDpaSkpd }})</small>
                  </td>
                  <td class="text-center"><span class="badge rounded-pill text-bg-light border">{{ m.rincians?.length || 0 }} baris</span></td>
                  <td class="text-end fw-bold tabular-nums text-success">{{ m.totalDana | currency:'IDR':'symbol':'1.0-0' }}</td>
                  <td>
                    <small class="text-muted d-block">{{ m.importedBy }}</small>
                    <small class="text-muted">{{ m.importedAt | date:'dd/MM/yy HH:mm' }}</small>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="d-flex justify-content-end align-items-center mb-3 flex-wrap gap-2">
      <select class="form-select form-select-sm" style="width: auto;" [(ngModel)]="filterDana">
        <option value="ALL">Semua Sumber Dana</option>
        <option value="BOS">BOS</option>
        <option value="BOP">BOP</option>
      </select>
      <button class="btn btn-sm btn-neutral rounded-pill px-3" (click)="loadData()">
        <i class="bi bi-arrow-clockwise me-1"></i>Refresh
      </button>
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
                      <span class="badge-neutral">
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

  readonly migrasiList = signal<any[]>([]);
  readonly migrasiFile = signal<File | null>(null);
  readonly lastUploadedMigrasiName = signal('');
  readonly uploadingMigrasi = signal(false);
  readonly migrasiMessage = signal('');
  migrasiFilterSumber = '';

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
    this.loadMigrasiList();
  }

  onMigrasiFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.migrasiFile.set(input.files[0]);
    }
  }

  uploadMigrasiExcel(fileInput?: HTMLInputElement): void {
    const f = this.migrasiFile();
    if (!f) return;
    const uploadedName = f.name;
    this.uploadingMigrasi.set(true);
    this.api.uploadMigrasiDanaExcel(f).subscribe({
      next: (res) => {
        this.uploadingMigrasi.set(false);
        this.migrasiMessage.set(res.message);
        this.lastUploadedMigrasiName.set(uploadedName);
        this.toast.success(res.message);
        this.migrasiFile.set(null);
        if (fileInput) fileInput.value = '';
        this.loadMigrasiList();
      },
      error: (err) => {
        this.uploadingMigrasi.set(false);
        this.toast.error(err?.error?.message || 'Gagal mengupload file Excel migrasi PASK.');
      }
    });
  }

  loadMigrasiList(): void {
    this.api.getAdminMigrasiDana(this.auth.tahunAnggaran(), undefined, this.migrasiFilterSumber || undefined).subscribe({
      next: (res) => this.migrasiList.set(res.data || []),
      error: () => {}
    });
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
// 2. MIGRASI RKAS (HANYA UPLOAD FILE EXCEL)
// =========================================================================
@Component({
  selector: 'app-konversi-rkas',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  template: `
    <div class="siap-card mb-3">
      <div class="siap-card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h6 class="fw-bold mb-0"><i class="bi bi-file-earmark-spreadsheet text-warning me-2"></i>Upload Data Migrasi RKAS</h6>
          <small class="text-muted">Unggah file Excel RKAS untuk mengimpor komponen anggaran secara otomatis ke sistem.</small>
        </div>
        <a class="btn btn-sm btn-neutral rounded-pill px-3" href="/file-uploader/api/file-uploader/template-rkas" target="_blank">
          <i class="bi bi-download me-1"></i>Download Template Excel RKAS (.xlsx)
        </a>
      </div>
      <div class="p-4">
        <div class="input-group mb-2" style="max-width: 680px;">
          <input #rkasFileInput type="file" class="form-control" accept=".xlsx,.xls" (change)="onFileSelected($event)">
          <button class="btn btn-siap px-4" (click)="uploadExcel(rkasFileInput)" [disabled]="!selectedFile() || uploading()">
            @if (uploading()) { <span class="spinner-border spinner-border-sm me-1"></span>Mengunggah... }
            @else { <i class="bi bi-cloud-upload me-1"></i>Upload Migrasi RKAS }
          </button>
        </div>
        @if (selectedFile(); as sf) {
          <div class="small text-primary mb-2">
            <i class="bi bi-file-earmark-spreadsheet me-1"></i>File dipilih: <strong>{{ sf.name }}</strong> (klik Upload Migrasi RKAS)
          </div>
        } @else if (lastUploadedRkasName()) {
          <div class="small text-success fw-semibold mb-2">
            <i class="bi bi-check-circle-fill me-1"></i>File sudah diupload: <strong>{{ lastUploadedRkasName() }}</strong>
          </div>
        }
        @if (uploadMessage()) {
          <div class="alert alert-success py-2 px-3 small mb-0">{{ uploadMessage() }}</div>
        }
        @if (uploadError()) {
          <div class="alert alert-danger py-2 px-3 small mb-0">{{ uploadError() }}</div>
        }
      </div>
    </div>

    <!-- Daftar Hasil Migrasi RKAS (Read-Only) -->
    <div class="siap-card">
      <div class="siap-card-header d-flex justify-content-between align-items-center">
        <div>
          <h6 class="fw-bold mb-0">Hasil Data RKAS (TA {{ auth.tahunAnggaran() }})</h6>
          <small class="text-muted">Total Pagu: <strong class="text-dark">{{ totalPagu() | currency:'IDR':'symbol':'1.0-0' }}</strong> · Realisasi: <strong class="text-success">{{ totalRealisasi() | currency:'IDR':'symbol':'1.0-0' }}</strong></small>
        </div>
        <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" (click)="loadRkas()">
          <i class="bi bi-arrow-clockwise me-1"></i>Refresh
        </button>
      </div>
      <div class="table-responsive">
        <table class="table table-siap table-hover mb-0">
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
              <tr><td colspan="7" class="text-center py-4 text-muted">Belum ada data RKAS tersimpan.</td></tr>
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
  readonly selectedFile = signal<File | null>(null);
  readonly lastUploadedRkasName = signal('');
  readonly uploading = signal(false);
  readonly uploadMessage = signal('');
  readonly uploadError = signal('');
  private sekolahId = 1;

  readonly totalPagu = computed(() => this.items().reduce((acc, i) => acc + i.totalPagu, 0));
  readonly totalRealisasi = computed(() => this.items().reduce((acc, i) => acc + i.totalRealisasi, 0));

  ngOnInit(): void {
    if (this.auth.sekolahList().length === 0) {
      this.auth.loadSekolahOptions().subscribe((res) => {
        if (res.data?.length) {
          this.sekolahId = this.auth.selectedSekolahId() || res.data[0].id;
          this.loadRkas();
        }
      });
    } else {
      this.sekolahId = this.auth.selectedSekolahId() || 1;
      this.loadRkas();
    }
  }

  onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
      this.uploadError.set('');
      this.uploadMessage.set('');
    }
  }

  uploadExcel(fileInput?: HTMLInputElement): void {
    const f = this.selectedFile();
    if (!f) return;
    const uploadedName = f.name;
    this.uploading.set(true);
    this.uploadError.set('');
    this.uploadMessage.set('');
    this.api.uploadRkasExcel(f).subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.uploadMessage.set(res.message);
        this.lastUploadedRkasName.set(uploadedName);
        this.toast.success(res.message);
        this.selectedFile.set(null);
        if (fileInput) fileInput.value = '';
        this.loadRkas();
      },
      error: (err) => {
        this.uploading.set(false);
        const msg = err?.error?.message || 'Gagal mengupload file Excel RKAS.';
        this.uploadError.set(msg);
        this.toast.error(msg);
      }
    });
  }

  loadRkas(): void {
    this.api.getRkasItems(this.sekolahId, this.auth.tahunAnggaran(), 'BOS').subscribe({
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
  imports: [CommonModule, FormsModule, TablePaginationComponent],
  template: `
    <div class="siap-card overflow-hidden">
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
            @for (p of pagedPeriodes(); track p.id) {
              <tr>
                <td>
                  <span class="badge-neutral">{{ p.sumberDana }}</span>
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
      <app-table-pagination [totalItems]="periodes().length" itemLabel="periode" [(page)]="page" [(pageSize)]="pageSize" />
    </div>
  `
})
export class BatasPengajuanComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly periodes = signal<any[]>([]);
  readonly page = signal(1);
  readonly pageSize = signal(10);

  readonly pagedPeriodes = computed(() =>
    slicePaged(this.periodes(), this.page(), this.pageSize())
  );

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
        this.page.set(1);
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
        <button class="btn btn-sm rounded-pill px-3"
                [class.btn-dark]="tab() === 'helpdesk'" [class.btn-neutral]="tab() !== 'helpdesk'"
                (click)="tab.set('helpdesk')">
          <i class="bi bi-headset me-1"></i>Tiket Helpdesk Sekolah ({{ tickets().length }})
        </button>
      </li>
      <li class="nav-item">
        <button class="btn btn-sm rounded-pill px-3"
                [class.btn-dark]="tab() === 'logs'" [class.btn-neutral]="tab() !== 'logs'"
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
