import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { Sekolah } from '../../core/models/siapbos.models';
import { TablePaginationComponent, slicePaged } from '../../shared/components/table-pagination.component';

export { PenggunaMgmtComponent } from './pengguna-mgmt.component';
export { OtoritasMgmtComponent } from './otoritas-mgmt.component';

// =========================================================================
// MASTER SEKOLAH NEGERI (DATATABLES SEARCH/FILTER + MODAL DIALOG EDIT)
// =========================================================================
@Component({
  selector: 'app-sekolah-mgmt',
  standalone: true,
  imports: [CommonModule, FormsModule, TablePaginationComponent],
  template: `
    <div class="siap-card p-3 mb-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
      <div class="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
        <div class="input-group input-group-sm" style="max-width: 300px;">
          <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
          <input type="text" class="form-control border-start-0 ps-0"
                 [ngModel]="searchText()" (ngModelChange)="searchText.set($event); page.set(1)"
                 placeholder="Cari NPSN, Sekolah, PA, Bendahara...">
        </div>
        <select class="form-select form-select-sm" style="width: auto;"
                [ngModel]="jenjangFilter()" (ngModelChange)="jenjangFilter.set($event); page.set(1)">
          <option value="">Semua Jenjang</option>
          <option value="SD">SD</option>
          <option value="SMP">SMP</option>
          <option value="SMA">SMA</option>
          <option value="SMK">SMK</option>
          <option value="SLB">SLB</option>
        </select>
        <span class="badge badge-neutral rounded-pill px-3 py-2">
          {{ filteredSekolah().length }} Satuan Pendidikan
        </span>
      </div>
      <div class="d-flex gap-2">
        @if (auth.requiresSchoolPicker()) {
          <button type="button" class="btn btn-sm btn-siap rounded-pill px-3" (click)="auth.openSekolahPicker()">
            <i class="bi bi-table me-1"></i>Modal DataTables Sekolah
          </button>
        }
        <button type="button" class="btn btn-sm btn-neutral rounded-pill px-3" (click)="reload()">
          <i class="bi bi-arrow-clockwise me-1"></i>Refresh
        </button>
      </div>
    </div>

    <div class="siap-card overflow-hidden">
      <div class="table-responsive">
        <table class="table table-siap table-hover w-100 align-middle">
          <thead>
            <tr>
              <th>NPSN &amp; Sekolah</th>
              <th>Wilayah Sudin</th>
              <th>Rekening BOS / BOP</th>
              <th>Kepala Sekolah &amp; Bendahara</th>
              <th class="text-end">Aksi</th>
            </tr>
          </thead>
          <tbody>
            @if (filteredSekolah().length === 0) {
              <tr><td colspan="5" class="text-center py-4 text-muted">Tidak ada data sekolah sesuai filter.</td></tr>
            }
            @for (s of pagedSekolah(); track s.id) {
              <tr [class.table-warning]="auth.selectedSekolahId() === s.id">
                <td>
                  <div class="fw-semibold text-dark">{{ s.namaSekolah }}</div>
                  <small class="text-muted">NPSN {{ s.npsn }} · {{ s.jenjang }}</small>
                </td>
                <td class="text-secondary">{{ s.namaSudin }}</td>
                <td>
                  <div><small class="text-muted">BOS:</small> <code>{{ s.noRekBos }}</code></div>
                  <div><small class="text-muted">BOP:</small> <code>{{ s.noRekBop }}</code></div>
                </td>
                <td>
                  <div class="text-dark">PA: {{ s.namaKepalaSekolah }}</div>
                  <small class="text-muted">PK: {{ s.namaBendahara }}</small>
                </td>
                <td class="text-end text-nowrap">
                  <div class="d-inline-flex gap-1">
                    @if (auth.requiresSchoolPicker()) {
                      <button type="button"
                              class="btn btn-sm rounded-pill px-3"
                              [class.btn-siap]="auth.selectedSekolahId() !== s.id"
                              [class.btn-outline-success]="auth.selectedSekolahId() === s.id"
                              (click)="auth.confirmSekolah(s)">
                        {{ auth.selectedSekolahId() === s.id ? 'Sekolah Aktif' : 'Pilih' }}
                      </button>
                    }
                    <button type="button" class="btn btn-sm btn-neutral rounded-pill px-3" (click)="editSekolah(s)">
                      <i class="bi bi-pencil me-1"></i>Edit
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <app-table-pagination [totalItems]="filteredSekolah().length" itemLabel="sekolah" [(page)]="page" [(pageSize)]="pageSize" />
    </div>

    @if (editing()) {
      <div class="modal-backdrop-custom" (click)="editing.set(null)">
        <div class="modal-dialog-custom" style="max-width: 580px;" (click)="$event.stopPropagation()">
          <div class="siap-card-header d-flex justify-content-between align-items-center">
            <h6 class="fw-bold mb-0"><i class="bi bi-building-gear me-2 text-warning-emphasis"></i>Sunting Profil: {{ editing()!.namaSekolah }}</h6>
            <button type="button" class="btn-close btn-sm" (click)="editing.set(null)"></button>
          </div>
          <div class="modal-body-scroll">
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label small fw-semibold mb-1">Nama Sekolah</label>
                <input class="form-control form-control-sm" [(ngModel)]="editing()!.namaSekolah">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Kepala Sekolah (PA)</label>
                <input class="form-control form-control-sm" [(ngModel)]="editing()!.namaKepalaSekolah">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">NRK PA</label>
                <input class="form-control form-control-sm" [(ngModel)]="editing()!.nrkKepalaSekolah">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Verifikator TU</label>
                <input class="form-control form-control-sm" [(ngModel)]="editing()!.namaKasubagTu">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Bendahara (PK)</label>
                <input class="form-control form-control-sm" [(ngModel)]="editing()!.namaBendahara">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">No. Rek BOS</label>
                <input class="form-control form-control-sm" [(ngModel)]="editing()!.noRekBos">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">No. Rek BOP</label>
                <input class="form-control form-control-sm" [(ngModel)]="editing()!.noRekBop">
              </div>
              <div class="col-12">
                <label class="form-label small fw-semibold mb-1">NPWP Sekolah</label>
                <input class="form-control form-control-sm" [(ngModel)]="editing()!.npwpSekolah">
              </div>
            </div>
          </div>
          <div class="modal-footer-custom">
            <button type="button" class="btn btn-neutral rounded-pill px-4" (click)="editing.set(null)">Batal</button>
            <button type="button" class="btn btn-siap rounded-pill px-4" (click)="save()">
              <i class="bi bi-check2-circle me-1"></i>Simpan Perubahan
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class SekolahMgmtComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly editing = signal<Sekolah | null>(null);
  readonly searchText = signal('');
  readonly jenjangFilter = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(10);

  readonly filteredSekolah = computed(() => {
    const q = this.searchText().trim().toLowerCase();
    const jen = this.jenjangFilter();
    return this.auth.sekolahList().filter((s) => {
      if (jen && s.jenjang !== jen) return false;
      if (!q) return true;
      return (
        s.namaSekolah?.toLowerCase().includes(q) ||
        s.npsn?.toLowerCase().includes(q) ||
        s.namaKepalaSekolah?.toLowerCase().includes(q) ||
        s.namaBendahara?.toLowerCase().includes(q)
      );
    });
  });

  readonly pagedSekolah = computed(() =>
    slicePaged(this.filteredSekolah(), this.page(), this.pageSize())
  );

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.auth.loadSekolahOptions().subscribe();
  }

  editSekolah(s: Sekolah): void {
    this.editing.set({ ...s });
  }

  save(): void {
    const s = this.editing();
    if (!s) return;
    this.api.updateSekolah(s.id, s).subscribe({
      next: (res) => {
        this.toast.success(res.message);
        this.editing.set(null);
        this.reload();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal memperbarui data sekolah.')
    });
  }
}

// =========================================================================
// MASTER PAJAK & BAGAN AKUN STANDAR
// =========================================================================
@Component({
  selector: 'app-pajak-mgmt',
  standalone: true,
  imports: [CommonModule, TablePaginationComponent],
  template: `
    <div class="row g-4">
      <div class="col-lg-6">
        <div class="siap-card h-100 d-flex flex-column overflow-hidden">
          <div class="siap-card-header">
            <h6 class="fw-bold mb-0 text-dark">Master Pajak MPN G3</h6>
          </div>
          <div class="table-responsive flex-grow-1">
            <table class="table table-siap table-hover mb-0">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Jenis Pajak</th>
                  <th>MAP / Setoran</th>
                  <th class="text-end">Tarif</th>
                </tr>
              </thead>
              <tbody>
                @for (t of pagedTaxes(); track t.id) {
                  <tr>
                    <td><span class="badge badge-role rounded-pill">{{ t.kodeTrxPajak }}</span></td>
                    <td>
                      <div class="fw-semibold text-dark">{{ t.namaPajak }}</div>
                      <small class="text-muted">{{ t.keterangan }}</small>
                    </td>
                    <td><code>{{ t.kodeMap }} / {{ t.kodeJenisSetoran }}</code></td>
                    <td class="text-end fw-bold text-dark">{{ t.tarifPersen }}%</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-table-pagination [totalItems]="taxes().length" itemLabel="pajak" [(page)]="taxPage" [(pageSize)]="taxPageSize" />
        </div>
      </div>

      <div class="col-lg-6">
        <div class="siap-card h-100 d-flex flex-column overflow-hidden">
          <div class="siap-card-header">
            <h6 class="fw-bold mb-0 text-dark">Master Bagan Akun Standar (BAS)</h6>
          </div>
          <div class="table-responsive flex-grow-1">
            <table class="table table-siap table-hover mb-0">
              <thead>
                <tr>
                  <th>Kode Akun</th>
                  <th>Uraian Rekening</th>
                  <th>Kelompok</th>
                </tr>
              </thead>
              <tbody>
                @for (b of pagedBas(); track b.id) {
                  <tr>
                    <td><code>{{ b.kodeAkun }}</code></td>
                    <td class="fw-medium text-dark">{{ b.namaAkun }}</td>
                    <td><span class="badge badge-neutral rounded-pill">{{ b.kelompok }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-table-pagination [totalItems]="basList().length" itemLabel="akun BAS" [(page)]="basPage" [(pageSize)]="basPageSize" />
        </div>
      </div>
    </div>
  `
})
export class PajakMgmtComponent implements OnInit {
  private readonly api = inject(SiapBosApiService);
  readonly taxes = signal<any[]>([]);
  readonly basList = signal<any[]>([]);
  readonly taxPage = signal(1);
  readonly taxPageSize = signal(10);
  readonly basPage = signal(1);
  readonly basPageSize = signal(10);

  readonly pagedTaxes = computed(() => slicePaged(this.taxes(), this.taxPage(), this.taxPageSize()));
  readonly pagedBas = computed(() => slicePaged(this.basList(), this.basPage(), this.basPageSize()));

  ngOnInit(): void {
    this.api.getTaxMasters().subscribe({ next: (res) => this.taxes.set(res.data || []) });
    this.api.getBasAccounts().subscribe({ next: (res) => this.basList.set(res.data || []) });
  }
}
