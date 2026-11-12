import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { Sekolah } from '../../core/models/siapbos.models';

// =========================================================================
// 1. MANAJEMEN PENGGUNA (FULL-WIDTH TABLE + MODAL DIALOG TAMBAH/EDIT)
// =========================================================================
@Component({
  selector: 'app-pengguna-mgmt',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Toolbar Aksi: Pencarian + Tombol Primary CTA (+ Tambah Pengguna) -->
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <div class="d-flex align-items-center gap-2 flex-grow-1" style="max-width: 440px;">
        <div class="input-group input-group-sm">
          <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
          <input class="form-control border-start-0 ps-0"
                 [(ngModel)]="searchText"
                 placeholder="Cari nama, username, NRK, atau role...">
        </div>
        <span class="badge badge-neutral rounded-pill px-3 py-2 flex-shrink-0">
          {{ filteredUsers().length }} Pengguna
        </span>
      </div>

      <button type="button" class="btn btn-sm btn-siap rounded-pill px-4 py-2 d-inline-flex align-items-center gap-2" (click)="openNewModal()">
        <i class="bi bi-plus-lg"></i>
        <span>Tambah Pengguna</span>
      </button>
    </div>

    <!-- Tabel Daftar Pengguna Lebar Penuh (Full Width) -->
    <div class="siap-card overflow-hidden">
      <div class="table-responsive">
        <table class="table table-siap table-hover w-100">
          <thead>
            <tr>
              <th>Pengguna</th>
              <th>NRK / NIP</th>
              <th>Role &amp; Jabatan</th>
              <th>Satuan Pendidikan / Unit Kerja</th>
              <th>Status</th>
              <th class="text-end">Aksi</th>
            </tr>
          </thead>
          <tbody>
            @for (u of filteredUsers(); track u.id) {
              <tr>
                <td>
                  <div class="fw-semibold text-dark">{{ u.namaLengkap }}</div>
                  <small class="text-muted">&#64;{{ u.username }}</small>
                </td>
                <td>
                  <div class="fw-medium text-dark">NRK {{ u.nrk }}</div>
                  <small class="text-muted">{{ u.nip || '-' }}</small>
                </td>
                <td>
                  <span class="badge badge-role rounded-pill px-2 py-1">{{ u.roleCode }}</span>
                  <div class="small text-muted mt-1">{{ u.jabatan }}</div>
                </td>
                <td class="text-secondary">{{ u.namaSekolah }}</td>
                <td>
                  <span class="badge rounded-pill px-2 py-1"
                        [ngClass]="u.isActive ? 'bg-success-subtle text-success border border-success-subtle' : 'badge-neutral'">
                    {{ u.isActive ? 'Aktif' : 'Nonaktif' }}
                  </span>
                </td>
                <td class="text-end">
                  <button type="button" class="btn btn-sm btn-neutral rounded-pill px-3" (click)="openEditModal(u)">
                    <i class="bi bi-pencil me-1"></i>Edit
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="text-center text-muted py-5">
                  Tidak ada data pengguna yang sesuai pencarian.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Dialog: Form Tambah / Edit Pengguna -->
    @if (showFormModal()) {
      <div class="modal-backdrop-custom" (click)="closeModal()">
        <div class="modal-dialog-custom" style="max-width: 580px;" (click)="$event.stopPropagation()">
          <div class="siap-card-header d-flex justify-content-between align-items-center">
            <h6 class="fw-bold mb-0 text-dark">
              <i class="bi bi-person-badge me-2 text-secondary"></i>
              {{ editId() ? 'Edit Pengguna #' + editId() : 'Tambah Pengguna Baru' }}
            </h6>
            <button type="button" class="btn-close btn-sm" (click)="closeModal()"></button>
          </div>

          <div class="modal-body-scroll">
            <div class="mb-3">
              <label class="form-label small fw-semibold mb-1">NRK Pegawai DKI Jakarta</label>
              <div class="input-group">
                <input class="form-control" [(ngModel)]="form.nrk" placeholder="Contoh: 185432">
                <button class="btn btn-neutral" type="button" (click)="cekSimpeg()">
                  <i class="bi bi-search me-1"></i>Cek SIMPEG
                </button>
              </div>
              <small class="text-muted">Sinkronisasi otomatis Nama, NIP, dan Jabatan dari layanan SIMPEG.</small>
            </div>

            <div class="row g-3 mb-3">
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Username Login</label>
                <input class="form-control" [(ngModel)]="form.username" [disabled]="!!editId()" placeholder="Contoh: bendahara.baru">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Password {{ editId() ? '(Opsional)' : '' }}</label>
                <input type="password" class="form-control" [(ngModel)]="form.password" placeholder="password123">
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label small fw-semibold mb-1">Nama Lengkap</label>
              <input class="form-control" [(ngModel)]="form.namaLengkap" placeholder="Nama lengkap beserta gelar">
            </div>

            <div class="row g-3 mb-3">
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">NIP</label>
                <input class="form-control" [(ngModel)]="form.nip" placeholder="Nomor Induk Pegawai">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">No. HP / WhatsApp</label>
                <input class="form-control" [(ngModel)]="form.noHp" placeholder="0812xxxxxxxx">
              </div>
            </div>

            <div class="row g-3 mb-3">
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Role / Otoritas</label>
                <select class="form-select" [(ngModel)]="form.roleCode">
                  @for (r of roles(); track r.roleCode) {
                    <option [value]="r.roleCode">{{ r.roleCode }}</option>
                  }
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Unit Sekolah</label>
                <select class="form-select" [(ngModel)]="form.sekolahId">
                  <option [ngValue]="null">Dinas / Sudin (Non-Sekolah)</option>
                  @for (s of auth.sekolahList(); track s.id) {
                    <option [ngValue]="s.id">{{ s.namaSekolah }}</option>
                  }
                </select>
              </div>
            </div>

            <div class="mb-4">
              <label class="form-label small fw-semibold mb-1">Jabatan</label>
              <input class="form-control" [(ngModel)]="form.jabatan" placeholder="Jabatan penanggung jawab">
            </div>

            <div class="d-flex justify-content-end gap-2 pt-2 border-top">
              <button type="button" class="btn btn-neutral rounded-pill px-4" (click)="closeModal()">Batal</button>
              <button type="button" class="btn btn-siap rounded-pill px-4" (click)="saveUser()" [disabled]="saving()">
                @if (saving()) { <span class="spinner-border spinner-border-sm me-1"></span>Menyimpan... }
                @else { <i class="bi bi-check2 me-1"></i>{{ editId() ? 'Simpan Perubahan' : 'Simpan Pengguna' }} }
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class PenggunaMgmtComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly users = signal<any[]>([]);
  readonly roles = signal<any[]>([]);
  readonly editId = signal<number | null>(null);
  readonly showFormModal = signal(false);
  readonly saving = signal(false);
  searchText = '';

  form: any = this.emptyForm();

  readonly filteredUsers = computed(() => {
    const q = this.searchText.trim().toLowerCase();
    if (!q) return this.users();
    return this.users().filter(
      (u) =>
        u.namaLengkap?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.nrk?.toLowerCase().includes(q) ||
        u.roleCode?.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    if (this.auth.sekolahList().length === 0) this.auth.loadSekolahOptions().subscribe();
    this.api.getRoles().subscribe({ next: (res) => this.roles.set(res.data || []) });
    this.loadUsers();
  }

  emptyForm(): any {
    return {
      username: '',
      password: 'password123',
      namaLengkap: '',
      nrk: '',
      nip: '',
      nik: '',
      email: 'pegawai@jakarta.go.id',
      noHp: '081200000001',
      roleCode: 'PK-NEGERI',
      jabatan: 'Bendahara Sekolah (PK)',
      wilayahSudin: 'JP',
      sekolahId: 1,
      isActive: true
    };
  }

  loadUsers(): void {
    this.api.getUsers().subscribe({ next: (res) => this.users.set(res.data || []) });
  }

  openNewModal(): void {
    this.editId.set(null);
    this.form = this.emptyForm();
    this.showFormModal.set(true);
  }

  openEditModal(u: any): void {
    this.editId.set(u.id);
    this.form = {
      username: u.username,
      password: '',
      namaLengkap: u.namaLengkap,
      nrk: u.nrk,
      nip: u.nip,
      nik: u.nik,
      email: u.email,
      noHp: u.noHp,
      roleCode: u.roleCode,
      jabatan: u.jabatan,
      wilayahSudin: u.wilayahSudin || 'JP',
      sekolahId: u.sekolahId,
      isActive: u.isActive
    };
    this.showFormModal.set(true);
  }

  closeModal(): void {
    this.showFormModal.set(false);
  }

  cekSimpeg(): void {
    if (!this.form.nrk?.trim()) {
      this.toast.error('Masukkan NRK terlebih dahulu.');
      return;
    }
    this.api.cekPegawaiSimpeg(this.form.nrk.trim()).subscribe({
      next: (res) => {
        const d = res.data;
        if (d) {
          this.form.namaLengkap = d.namaLengkap;
          this.form.nip = d.nip;
          this.form.nik = d.nik;
          this.form.jabatan = d.jabatan;
          if (!this.form.username) this.form.username = `user.${this.form.nrk.trim()}`;
          this.toast.success(`SIMPEG Ditemukan: ${d.namaLengkap} (${d.unitKerja})`);
        }
      },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal inquiry data pegawai SIMPEG.')
    });
  }

  saveUser(): void {
    if (!this.form.username?.trim() || !this.form.namaLengkap?.trim()) {
      this.toast.error('Username dan Nama Lengkap wajib diisi.');
      return;
    }
    this.saving.set(true);
    const id = this.editId();
    const obs = id ? this.api.updateUser(id, this.form) : this.api.createUser(this.form);
    obs.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(res.message);
        this.closeModal();
        this.loadUsers();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.message || 'Gagal menyimpan data pengguna.');
      }
    });
  }
}

// =========================================================================
// 2. MASTER SEKOLAH NEGERI (FULL-WIDTH TABLE + MODAL DIALOG EDIT)
// =========================================================================
@Component({
  selector: 'app-sekolah-mgmt',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <span class="badge badge-neutral rounded-pill px-3 py-2">
        {{ auth.sekolahList().length }} Satuan Pendidikan
      </span>
      <button type="button" class="btn btn-sm btn-neutral rounded-pill px-3" (click)="reload()">
        <i class="bi bi-arrow-clockwise me-1"></i>Refresh
      </button>
    </div>

    <div class="siap-card overflow-hidden">
      <div class="table-responsive">
        <table class="table table-siap table-hover w-100">
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
            @for (s of auth.sekolahList(); track s.id) {
              <tr>
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
                <td class="text-end">
                  <button type="button" class="btn btn-sm btn-neutral rounded-pill px-3" (click)="editSekolah(s)">
                    <i class="bi bi-pencil me-1"></i>Edit
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (editing()) {
      <div class="modal-backdrop-custom" (click)="editing.set(null)">
        <div class="modal-dialog-custom" style="max-width: 560px;" (click)="$event.stopPropagation()">
          <div class="siap-card-header d-flex justify-content-between align-items-center">
            <h6 class="fw-bold mb-0">Edit Profil: {{ editing()!.namaSekolah }}</h6>
            <button type="button" class="btn-close btn-sm" (click)="editing.set(null)"></button>
          </div>
          <div class="modal-body-scroll">
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label small fw-semibold mb-1">Nama Sekolah</label>
                <input class="form-control" [(ngModel)]="editing()!.namaSekolah">
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold mb-1">Kepala Sekolah (PA)</label>
                <input class="form-control" [(ngModel)]="editing()!.namaKepalaSekolah">
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold mb-1">NRK PA</label>
                <input class="form-control" [(ngModel)]="editing()!.nrkKepalaSekolah">
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold mb-1">Verifikator TU</label>
                <input class="form-control" [(ngModel)]="editing()!.namaKasubagTu">
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold mb-1">Bendahara (PK)</label>
                <input class="form-control" [(ngModel)]="editing()!.namaBendahara">
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold mb-1">No. Rek BOS</label>
                <input class="form-control" [(ngModel)]="editing()!.noRekBos">
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold mb-1">No. Rek BOP</label>
                <input class="form-control" [(ngModel)]="editing()!.noRekBop">
              </div>
              <div class="col-12">
                <label class="form-label small fw-semibold mb-1">NPWP Sekolah</label>
                <input class="form-control" [(ngModel)]="editing()!.npwpSekolah">
              </div>
            </div>
            <div class="d-flex justify-content-end gap-2 mt-4 pt-2 border-top">
              <button type="button" class="btn btn-neutral rounded-pill px-4" (click)="editing.set(null)">Batal</button>
              <button type="button" class="btn btn-siap rounded-pill px-4" (click)="save()">Simpan Perubahan</button>
            </div>
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
// 3. OTORITAS & HAK AKSES MENU (RBAC MATRIX)
// =========================================================================
@Component({
  selector: 'app-otoritas-mgmt',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="row g-4">
      <div class="col-lg-5">
        <div class="siap-card h-100">
          <div class="siap-card-header">
            <h6 class="fw-bold mb-0 text-dark">Daftar Role Otoritas (RBAC)</h6>
          </div>
          <div class="table-responsive">
            <table class="table table-siap">
              <thead>
                <tr>
                  <th>Kode Role</th>
                  <th>Level</th>
                  <th>Nama &amp; Kewenangan</th>
                </tr>
              </thead>
              <tbody>
                @for (r of roles(); track r.id) {
                  <tr>
                    <td><span class="badge badge-role rounded-pill px-2 py-1">{{ r.roleCode }}</span></td>
                    <td><span class="badge badge-neutral rounded-pill">{{ r.level }}</span></td>
                    <td>
                      <div class="fw-semibold text-dark">{{ r.roleName }}</div>
                      <small class="text-muted">{{ r.deskripsi }}</small>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="col-lg-7">
        <div class="siap-card h-100">
          <div class="siap-card-header d-flex justify-content-between align-items-center">
            <h6 class="fw-bold mb-0 text-dark">Matriks Hak Akses Modul &amp; Menu</h6>
            <span class="badge badge-neutral rounded-pill">{{ menus().length }} Sub-Menu</span>
          </div>
          <div class="table-responsive" style="max-height: 620px; overflow-y: auto;">
            <table class="table table-siap table-hover">
              <thead>
                <tr>
                  <th>Aplikasi</th>
                  <th>Nama Menu</th>
                  <th>Route Link</th>
                  <th>Role Diizinkan</th>
                </tr>
              </thead>
              <tbody>
                @for (m of menus(); track m.id) {
                  <tr>
                    <td><span class="badge badge-neutral rounded-pill">{{ m.kodeAplikasi }}</span></td>
                    <td class="fw-medium text-dark">
                      <i class="bi {{ m.icon }} me-2 text-secondary"></i>{{ m.nama }}
                    </td>
                    <td><code class="small text-secondary">{{ m.link }}</code></td>
                    <td class="small text-muted">{{ m.allowedRolesCsv }}</td>
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
export class OtoritasMgmtComponent implements OnInit {
  private readonly api = inject(SiapBosApiService);
  readonly roles = signal<any[]>([]);
  readonly menus = signal<any[]>([]);

  ngOnInit(): void {
    this.api.getRoles().subscribe({ next: (res) => this.roles.set(res.data || []) });
    this.api.getMenus().subscribe({ next: (res) => this.menus.set(res.data || []) });
  }
}

// =========================================================================
// 4. MASTER PAJAK & BAGAN AKUN STANDAR
// =========================================================================
@Component({
  selector: 'app-pajak-mgmt',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="row g-4">
      <div class="col-lg-6">
        <div class="siap-card h-100">
          <div class="siap-card-header">
            <h6 class="fw-bold mb-0 text-dark">Master Pajak MPN G3</h6>
          </div>
          <div class="table-responsive">
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
                @for (t of taxes(); track t.id) {
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
        </div>
      </div>

      <div class="col-lg-6">
        <div class="siap-card h-100">
          <div class="siap-card-header">
            <h6 class="fw-bold mb-0 text-dark">Master Bagan Akun Standar (BAS)</h6>
          </div>
          <div class="table-responsive">
            <table class="table table-siap table-hover mb-0">
              <thead>
                <tr>
                  <th>Kode Akun</th>
                  <th>Uraian Rekening</th>
                  <th>Kelompok</th>
                </tr>
              </thead>
              <tbody>
                @for (b of basList(); track b.id) {
                  <tr>
                    <td><code>{{ b.kodeAkun }}</code></td>
                    <td class="fw-medium text-dark">{{ b.namaAkun }}</td>
                    <td><span class="badge badge-neutral rounded-pill">{{ b.kelompok }}</span></td>
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
export class PajakMgmtComponent implements OnInit {
  private readonly api = inject(SiapBosApiService);
  readonly taxes = signal<any[]>([]);
  readonly basList = signal<any[]>([]);

  ngOnInit(): void {
    this.api.getTaxMasters().subscribe({ next: (res) => this.taxes.set(res.data || []) });
    this.api.getBasAccounts().subscribe({ next: (res) => this.basList.set(res.data || []) });
  }
}
