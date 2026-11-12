import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { DroppingDana, MigrasiPask, MigrasiPaskRinci } from '../../core/models/siapbos.models';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-dropping-dana-form',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, SekolahBarComponent, StatusBadgeComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="onSekolahChanged()" />

    <div class="siap-card p-4 mb-3">
      <div class="d-flex flex-wrap justify-content-between align-items-center pb-3 mb-3 border-bottom gap-2">
        <div>
          <h6 class="fw-bold mb-0">
            <i class="bi bi-box-arrow-in-down text-warning me-2"></i>
            {{ formMode() === 'tambah' ? 'Dropping Dana ' + sumberDana() + ' / Tambah (Hasil Migrasi ADM)' : 'Detail Dropping Dana ' + sumberDana() }}
          </h6>
          <small class="text-muted">Data &amp; nominal Dropping Dana dikunci dari hasil migrasi Administrator (hanya 1x per periode triwulan).</small>
        </div>
        @if (detailItem(); as d) {
          <div class="d-flex align-items-center gap-2">
            <span class="fw-bold text-primary">{{ d.nomorSp2d }}</span>
            <app-status-badge kind="npd" [value]="d.statusDropping" />
          </div>
        }
      </div>

      <div class="row g-3 align-items-center">
        <div class="col-md-3 small fw-semibold text-muted">Tahun Anggaran</div>
        <div class="col-md-9">
          <input class="form-control bg-light" [value]="detailItem()?.tahunAnggaran || auth.tahunAnggaran()" readonly>
        </div>

        <div class="col-md-3 small fw-semibold text-muted">Sekolah</div>
        <div class="col-md-9">
          <input class="form-control bg-light" [value]="sekolahDisplay()" readonly>
        </div>

        <div class="col-md-3 small fw-semibold text-muted">Periode</div>
        <div class="col-md-9">
          <div class="row g-2">
            <div class="col-md-6">
              <input class="form-control bg-light" value="Triwulan" readonly>
            </div>
            <div class="col-md-6">
              <input class="form-control bg-light fw-semibold" [value]="periodeDisplay()" readonly>
            </div>
          </div>
          @if (formMode() === 'tambah' && selectedPask()?.alreadyUsedInPeriode) {
            <div class="alert alert-danger py-1 px-2 small mt-2 mb-0">
              <i class="bi bi-exclamation-triangle-fill me-1"></i>
              Triwulan <strong>{{ selectedPask()?.kodePeriode }}</strong> sudah memiliki pengajuan Dropping Dana {{ sumberDana() }}. Maksimal 1x per periode triwulan.
            </div>
          }
        </div>

        <div class="col-md-3 small fw-semibold text-muted">Tanggal</div>
        <div class="col-md-9">
          @if (formMode() === 'tambah') {
            <input type="date" class="form-control" [(ngModel)]="tanggalDropping">
          } @else {
            <input class="form-control bg-light" [value]="detailItem()?.tanggalDropping | date:'dd/MM/yyyy'" readonly>
          }
        </div>

        <div class="col-md-3 small fw-semibold text-muted">PASK / Subgiat</div>
        <div class="col-md-9">
          <div class="input-group">
            <input class="form-control bg-light"
                   [value]="detailItem()?.namaPask || selectedPask()?.namaPask || ''"
                   placeholder="Klik tombol kaca pembesar untuk memilih alokasi hasil migrasi ADM..."
                   readonly>
            @if (formMode() === 'tambah') {
              <button type="button" class="btn btn-warning text-white fw-semibold px-3" (click)="openPaskModal()">
                <i class="bi bi-search"></i>
              </button>
            }
          </div>
        </div>

        <div class="col-md-3 small fw-semibold text-muted">Program</div>
        <div class="col-md-9">
          <input class="form-control bg-light" [value]="detailItem()?.program || selectedPask()?.program || ''" readonly>
        </div>

        <div class="col-md-3 small fw-semibold text-muted">Nomor DPA SKPD</div>
        <div class="col-md-9">
          <input class="form-control bg-light" [value]="detailItem()?.nomorDpaSkpd || selectedPask()?.nomorDpaSkpd || ''" readonly>
        </div>

        <div class="col-md-3 small fw-semibold text-muted">Jumlah Dropping</div>
        <div class="col-md-9">
          <input class="form-control bg-light fw-bold text-success tabular-nums"
                 [value]="jumlahDropping() | currency:'IDR':'symbol':'1.0-0'"
                 readonly>
        </div>

        <div class="col-md-3 small fw-semibold text-muted align-self-start pt-2">Uraian / Keterangan</div>
        <div class="col-md-9">
          @if (formMode() === 'tambah') {
            <textarea class="form-control" rows="3" [(ngModel)]="keterangan"
                      placeholder="Masukkan keterangan penyaluran dropping dana..."></textarea>
          } @else {
            <textarea class="form-control bg-light" rows="3" [value]="detailItem()?.keterangan || ''" readonly></textarea>
          }
        </div>

        @if (detailItem(); as d) {
          <div class="col-md-3 small fw-semibold text-muted">Riwayat Persetujuan</div>
          <div class="col-md-9">
            <div class="p-2 rounded bg-light border small d-flex flex-wrap gap-3">
              <span><strong>PK:</strong> {{ d.createdBy || '-' }}</span>
              <span><strong>TU:</strong> {{ d.tuApprovedBy || 'Menunggu' }}</span>
              <span><strong>PA:</strong> {{ d.paApprovedBy || 'Menunggu' }}</span>
              <span><strong>Dinas/Sudin:</strong> {{ d.dinasApprovedBy || 'Menunggu' }}</span>
            </div>
            @if (d.catatan) {
              <small class="text-muted d-block mt-1">Catatan: {{ d.catatan }}</small>
            }
          </div>
        }
      </div>

      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4 pt-3 border-top">
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-dark px-4" (click)="goBack()">
            <i class="bi bi-x-lg me-1"></i>Kembali
          </button>
          @if (formMode() === 'tambah') {
            <button type="button" class="btn btn-siap px-4" (click)="saveDropping()"
                    [disabled]="saving() || !selectedPask() || selectedPask()?.alreadyUsedInPeriode || !keterangan.trim()">
              @if (saving()) {
                <span class="spinner-border spinner-border-sm me-1"></span>Menyimpan...
              } @else {
                <i class="bi bi-floppy me-1"></i>Simpan
              }
            </button>
          }
        </div>

        @if (formMode() === 'detail' && detailItem(); as d) {
          <div class="d-flex flex-wrap gap-2">
            @if (d.statusDropping === 0 && auth.hasRole('PK-NEGERI', 'ADMIN-TDI')) {
              <button class="btn btn-siap rounded-pill px-4" (click)="ajukan(d)">
                <i class="bi bi-send me-1"></i>Ajukan ke TU
              </button>
            }
            @if (d.statusDropping === 1 && auth.hasRole('TU-NEGERI', 'ADMIN-TDI')) {
              <button class="btn btn-primary rounded-pill px-3" (click)="approveTu(d, true)">
                <i class="bi bi-check2-circle me-1"></i>Setuju TU
              </button>
              <button class="btn btn-outline-danger rounded-pill px-3" (click)="approveTu(d, false)">
                <i class="bi bi-x-circle me-1"></i>Tolak
              </button>
            }
            @if (d.statusDropping === 2 && auth.hasRole('PA-NEGERI', 'ADMIN-TDI')) {
              <button class="btn btn-primary rounded-pill px-3" (click)="approvePa(d, true)">
                <i class="bi bi-award me-1"></i>Setuju PA
              </button>
              <button class="btn btn-outline-danger rounded-pill px-3" (click)="approvePa(d, false)">
                <i class="bi bi-x-circle me-1"></i>Tolak
              </button>
            }
            @if (d.statusDropping === 3 && ((sumberDana() === 'BOS' && auth.hasRole('ADMIN-DINAS', 'ADMIN-TDI')) || (sumberDana() === 'BOP' && auth.hasRole('SUDIN', 'ADMIN-DINAS', 'ADMIN-TDI')))) {
              <button class="btn btn-success rounded-pill px-4" (click)="approveDinas(d, true)">
                <i class="bi bi-check2-all me-1"></i>Setuju {{ sumberDana() === 'BOS' ? 'Dinas' : 'Sudin' }} &amp; Cairkan Otomatis
              </button>
              <button class="btn btn-outline-danger rounded-pill px-3" (click)="approveDinas(d, false)">
                <i class="bi bi-x-circle me-1"></i>Tolak
              </button>
            }
          </div>
        }
      </div>
    </div>

    <!-- Rincian PASK (Read-Only from ADM) -->
    <div class="siap-card">
      <div class="siap-card-header d-flex justify-content-between align-items-center">
        <h6 class="fw-bold mb-0">Rincian PASK Dropping Dana {{ sumberDana() }}</h6>
        <small class="text-muted">Read-Only dari Hasil Migrasi ADM</small>
      </div>
      <div class="table-responsive">
        <table class="table table-siap table-bordered mb-0">
          <thead>
            <tr>
              <th class="text-center" style="width: 50px;">No</th>
              <th>Nama Kegiatan</th>
              <th>Kode Rekening</th>
              <th>Nama Rekening</th>
              <th class="text-end">Anggaran</th>
              <th class="text-end">AKB Per Periode</th>
              <th class="text-end">Nilai Sebelum</th>
              <th class="text-end">Nilai Dropping</th>
            </tr>
          </thead>
          <tbody>
            @if (rincianRows().length === 0) {
              <tr>
                <td colspan="8" class="text-center py-4 text-muted">Pilih PASK terlebih dahulu untuk melihat rincian alokasi.</td>
              </tr>
            }
            @for (r of rincianRows(); track r.id; let idx = $index) {
              <tr>
                <td class="text-center">{{ idx + 1 }}</td>
                <td>{{ r.namaKegiatan }}</td>
                <td><code>{{ r.kodeRekening }}</code></td>
                <td>{{ r.namaRekening }}</td>
                <td class="text-end tabular-nums">{{ r.anggaran | currency:'IDR':'symbol':'1.0-0' }}</td>
                <td class="text-end tabular-nums">{{ r.akbPerPeriode | currency:'IDR':'symbol':'1.0-0' }}</td>
                <td class="text-end tabular-nums">{{ r.nilaiSebelum | currency:'IDR':'symbol':'1.0-0' }}</td>
                <td class="text-end fw-bold tabular-nums text-success">{{ r.nilaiNpd | currency:'IDR':'symbol':'1.0-0' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Pilih PASK -->
    @if (showPaskModal()) {
      <div class="modal d-block" style="background: rgba(15, 23, 42, 0.55); z-index: 1060;">
        <div class="modal-dialog modal-xl modal-dialog-centered">
          <div class="modal-content border-0 shadow-lg">
            <div class="modal-header">
              <h5 class="modal-title fw-bold">Pilih PASK ({{ sumberDana() }})</h5>
              <button type="button" class="btn-close" (click)="showPaskModal.set(false)"></button>
            </div>
            <div class="modal-body">
              <div class="row g-2 mb-3">
                <div class="col-md-4"><input class="form-control form-control-sm" [(ngModel)]="filterSearch" placeholder="Cari Kode / Nama Subgiat / Nama PASK..."></div>
                <div class="col-md-2"><button type="button" class="btn btn-success btn-sm w-100" (click)="loadCandidates()"><i class="bi bi-search me-1"></i>Cari</button></div>
              </div>
              <div class="table-responsive">
                <table class="table table-bordered table-hover align-middle mb-0">
                  <thead class="table-light">
                    <tr>
                      <th class="text-center" style="width: 60px;">Pilih</th>
                      <th>Kode Subgiat</th>
                      <th>Nama Subgiat</th>
                      <th>Nama PASK</th>
                      <th>Sumber Dana</th>
                      <th class="text-end">Total Dropping</th>
                    </tr>
                  </thead>
                  <tbody>
                    @if (filteredCandidates().length === 0) {
                      <tr>
                        <td colspan="6" class="text-center py-4 text-muted">Belum ada PASK {{ sumberDana() }} hasil migrasi ADM untuk sekolah &amp; tahun anggaran ini.</td>
                      </tr>
                    }
                    @for (p of filteredCandidates(); track p.id) {
                      <tr [class.table-warning]="modalPickedId() === p.id" (click)="modalPickedId.set(p.id)" style="cursor: pointer;">
                        <td class="text-center"><input type="radio" name="dropPick" [checked]="modalPickedId() === p.id" (change)="modalPickedId.set(p.id)"></td>
                        <td>
                          <div class="fw-semibold">{{ p.kodeSubgiat }}</div>
                          <span class="badge bg-light text-dark border">{{ p.kodePeriode }}</span>
                          @if (p.alreadyUsedInPeriode) { <span class="badge text-bg-danger ms-1">Sudah Diajukan</span> }
                        </td>
                        <td>{{ p.namaSubgiat }}</td>
                        <td>{{ p.namaPask }}</td>
                        <td>{{ p.sumberDanaLabel || p.sumberDana }}</td>
                        <td class="text-end fw-bold tabular-nums">{{ p.totalDana | currency:'IDR':'symbol':'1.0-0' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
            <div class="modal-footer justify-content-center">
              <button type="button" class="btn btn-info text-white px-4 fw-semibold" [disabled]="!modalPickedId()" (click)="confirmPickPask()">
                <i class="bi bi-check-lg me-1"></i>Pilih
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class DroppingDanaFormComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly sumberDana = signal<'BOS' | 'BOP'>('BOS');
  readonly formMode = signal<'tambah' | 'detail'>('tambah');
  readonly detailItem = signal<DroppingDana | null>(null);
  readonly candidates = signal<MigrasiPask[]>([]);
  readonly selectedPask = signal<MigrasiPask | null>(null);
  readonly showPaskModal = signal(false);
  readonly modalPickedId = signal<number | null>(null);
  readonly saving = signal(false);

  tanggalDropping = new Date().toISOString().slice(0, 10);
  keterangan = '';
  filterSearch = '';

  readonly filteredCandidates = computed(() => {
    const s = this.filterSearch.trim().toLowerCase();
    return this.candidates().filter((c) =>
      !s || c.kodeSubgiat.toLowerCase().includes(s) || c.namaSubgiat.toLowerCase().includes(s) || c.namaPask.toLowerCase().includes(s)
    );
  });

  readonly rincianRows = computed<MigrasiPaskRinci[]>(() => {
    return this.detailItem()?.migrasiPask?.rincians || this.selectedPask()?.rincians || [];
  });

  ngOnInit(): void {
    this.sumberDana.set((this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS');
    const mode = (this.route.snapshot.data['formMode'] as 'tambah' | 'detail') || 'tambah';
    this.formMode.set(mode);
    if (mode === 'detail') {
      const id = Number(this.route.snapshot.paramMap.get('id'));
      if (id > 0) this.loadDetail(id);
    } else {
      this.loadCandidates();
    }
  }

  onSekolahChanged(): void {
    if (this.formMode() === 'tambah') {
      this.selectedPask.set(null);
      this.loadCandidates();
    }
  }

  loadDetail(id: number): void {
    this.api.getDroppingDetail(id, this.sumberDana()).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.detailItem.set(res.data);
          this.keterangan = res.data.keterangan;
        }
      },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal memuat detail Dropping Dana.')
    });
  }

  loadCandidates(): void {
    const sekId = this.auth.selectedSekolahId() || this.auth.currentUser()?.sekolahId || 1;
    this.api.getMigrasiCandidatesDropping(sekId, this.auth.tahunAnggaran(), this.sumberDana()).subscribe({
      next: (res) => { if (res.success) this.candidates.set(res.data || []); }
    });
  }

  openPaskModal(): void {
    this.loadCandidates();
    this.modalPickedId.set(this.selectedPask()?.id || null);
    this.showPaskModal.set(true);
  }

  confirmPickPask(): void {
    const picked = this.candidates().find((c) => c.id === this.modalPickedId());
    if (picked) {
      this.selectedPask.set(picked);
      if (!this.keterangan.trim()) {
        this.keterangan = `Pengajuan Dropping Dana ${this.sumberDana()} ${picked.kodePeriode} - ${picked.namaPask}`;
      }
    }
    this.showPaskModal.set(false);
  }

  sekolahDisplay(): string {
    const sid = this.auth.selectedSekolahId();
    const sek = this.detailItem()?.sekolah || this.auth.sekolahList().find((s) => s.id === sid);
    return sek ? `${sek.npsn} / ${sek.namaSekolah}` : '-';
  }

  periodeDisplay(): string {
    const kp = this.detailItem()?.kodePeriode || this.selectedPask()?.kodePeriode || '';
    const map: Record<string, string> = { TW1: '01 (TW 1)', TW2: '02 (TW 2)', TW3: '03 (TW 3)', TW4: '04 (TW 4)' };
    return map[kp] || kp || '-';
  }

  jumlahDropping(): number {
    return this.detailItem()?.nilaiDropping ?? this.selectedPask()?.totalDana ?? 0;
  }

  saveDropping(): void {
    const pask = this.selectedPask();
    if (!pask) return;
    this.saving.set(true);
    this.api.createDroppingFromMigrasi(this.sumberDana(), {
      sekolahId: this.auth.selectedSekolahId() || pask.sekolahId,
      migrasiPaskId: pask.id,
      tanggalDropping: this.tanggalDropping,
      keterangan: this.keterangan.trim()
    }).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(res.message);
        this.goBack();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.message || 'Gagal menyimpan Dropping Dana.');
      }
    });
  }

  ajukan(d: DroppingDana): void {
    this.api.ajukanDropping(d.id, this.sumberDana()).subscribe({
      next: (res) => { this.toast.success(res.message); this.loadDetail(d.id); },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal mengajukan.')
    });
  }

  approveTu(d: DroppingDana, ok: boolean): void {
    this.api.approveDroppingTu(d.id, this.sumberDana(), ok).subscribe({
      next: (res) => { this.toast.success(res.message); this.loadDetail(d.id); },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal approval TU.')
    });
  }

  approvePa(d: DroppingDana, ok: boolean): void {
    this.api.approveDroppingPa(d.id, this.sumberDana(), ok).subscribe({
      next: (res) => { this.toast.success(res.message); this.loadDetail(d.id); },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal approval PA.')
    });
  }

  approveDinas(d: DroppingDana, ok: boolean): void {
    this.api.approveDroppingDinas(d.id, this.sumberDana(), ok).subscribe({
      next: (res) => {
        this.toast.success(res.message);
        this.loadDetail(d.id);
        this.auth.loadSekolahOptions().subscribe();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal approval Dinas/Sudin.')
    });
  }

  goBack(): void {
    const levels = this.formMode() === 'detail' ? '../../' : '../';
    this.router.navigate([levels], { relativeTo: this.route });
  }
}
