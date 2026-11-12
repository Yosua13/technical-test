import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { Sekolah } from '../../core/models/siapbos.models';

// =========================================================================
// 1. MANAJEMEN PENGGUNA + INQUIRY SIMPEG BY NRK
// =========================================================================
@Component({
  selector: 'app-pengguna-mgmt',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <div>
        <h5 class="fw-bold mb-0"><i class="bi bi-people-fill text-warning me-2"></i>Manajemen Pengguna &amp; Sinkronisasi SIMPEG</h5>
        <small class="text-muted">Tambah atau kelola akun pengelola dana BOS/BOP menggunakan integrasi Inquiry Pegawai SIMPEG berdasarkan NRK.</small>
      </div>
      <div class="d-flex gap-2">
        <input class="form-control form-control-sm" style="width: 220px;" [(ngModel)]="searchText" placeholder="Cari nama / username / NRK...">
        <button class="btn btn-sm btn-siap rounded-pill px-3" (click)="openNew()">
          <i class="bi bi-person-plus me-1"></i>Tambah Pengguna
        </button>
      </div>
    </div>

    <div class="row g-3">
      <!-- Form Tambah / Edit -->
      <div class="col-lg-4">
        <div class="siap-card p-3">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="fw-bold mb-0">{{ editId() ? 'Edit Pengguna #' + editId() : 'Tambah Pengguna Baru' }}</h6>
            @if (editId()) {
              <button class="btn btn-xs btn-link text-decoration-none p-0 small" (click)="openNew()">Reset ke Baru</button>
            }
          </div>

          <div class="mb-2">
            <label class="form-label small fw-semibold mb-1">NRK Pegawai DKI Jakarta</label>
            <div class="input-group input-group-sm">
              <input class="form-control fw-semibold" [(ngModel)]="form.nrk" placeholder="Contoh: 185432">
              <button class="btn btn-info text-white fw-semibold" type="button" (click)="cekSimpeg()">
                <i class="bi bi-search me-1"></i>Cek SIMPEG
              </button>
            </div>
            <small class="text-muted">Memanggil <code>/api/simpeg/getPegawai/byNrk</code> pada :5004</small>
          </div>

          <div class="row g-2 mb-2">
            <div class="col-6">
              <label class="form-label small fw-semibold mb-1">Username Login</label>
              <input class="form-control form-control-sm" [(ngModel)]="form.username" [disabled]="!!editId()">
            </div>
            <div class="col-6">
              <label class="form-label small fw-semibold mb-1">Password {{ editId() ? '(Opsional)' : '' }}</label>
              <input type="password" class="form-control form-control-sm" [(ngModel)]="form.password" placeholder="password123">
            </div>
          </div>

          <div class="mb-2">
            <label class="form-label small fw-semibold mb-1">Nama Lengkap</label>
            <input class="form-control form-control-sm" [(ngModel)]="form.namaLengkap">
          </div>

          <div class="row g-2 mb-2">
            <div class="col-6">
              <label class="form-label small fw-semibold mb-1">NIP</label>
              <input class="form-control form-control-sm" [(ngModel)]="form.nip">
            </div>
            <div class="col-6">
              <label class="form-label small fw-semibold mb-1">No. HP / WA</label>
              <input class="form-control form-control-sm" [(ngModel)]="form.noHp">
            </div>
          </div>

          <div class="row g-2 mb-2">
            <div class="col-6">
              <label class="form-label small fw-semibold mb-1">Role / Otoritas</label>
              <select class="form-select form-select-sm" [(ngModel)]="form.roleCode">
                @for (r of roles(); track r.roleCode) {
                  <option [value]="r.roleCode">{{ r.roleCode }}</option>
                }
              </select>
            </div>
            <div class="col-6">
              <label class="form-label small fw-semibold mb-1">Unit Sekolah</label>
              <select class="form-select form-select-sm" [(ngModel)]="form.sekolahId">
                <option [ngValue]="null">Dinas / Sudin (Non-Sekolah)</option>
                @for (s of auth.sekolahList(); track s.id) {
                  <option [ngValue]="s.id">{{ s.namaSekolah }}</option>
                }
              </select>
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label small fw-semibold mb-1">Jabatan</label>
            <input class="form-control form-control-sm" [(ngModel)]="form.jabatan">
          </div>

          <button class="btn btn-siap w-100 rounded-pill" (click)="saveUser()" [disabled]="saving()">
            @if (saving()) { <span class="spinner-border spinner-border-sm me-1"></span>Menyimpan... }
            @else { <i class="bi bi-save me-1"></i>{{ editId() ? 'Simpan Perubahan' : 'Simpan Pengguna Baru' }} }
          </button>
        </div>
      </div>

      <!-- Tabel Pengguna -->
      <div class="col-lg-8">
        <div class="siap-card">
          <div class="table-responsive">
            <table class="table table-siap table-hover">
              <thead>
                <tr>
                  <th>Username &amp; Nama</th>
                  <th>NRK / NIP</th>
                  <th>Role &amp; Jabatan</th>
                  <th>Satuan Pendidikan</th>
                  <th class="text-end">Aksi</th>
                </tr>
              </thead>
              <tbody>
                @for (u of filteredUsers(); track u.id) {
                  <tr>
                    <td>
                      <div class="fw-bold">{{ u.namaLengkap }}</div>
                      <small class="text-muted">&#64;{{ u.username }}</small>
                    </td>
                    <td class="small">
                      <div>NRK: <strong>{{ u.nrk }}</strong></div>
                      <small class="text-muted">{{ u.nip || '-' }}</small>
                    </td>
                    <td>
                      <span class="badge text-bg-warning text-dark">{{ u.roleCode }}</span>
                      <div class="small text-muted mt-1">{{ u.jabatan }}</div>
                    </td>
                    <td class="small">{{ u.namaSekolah }}</td>
                    <td class="text-end">
                      <button class="btn btn-sm btn-outline-primary py-0 px-2" (click)="selectEdit(u)">
                        <i class="bi bi-pencil"></i> Edit
                      </button>
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
export class PenggunaMgmtComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly users = signal<any[]>([]);
  readonly roles = signal<any[]>([]);
  readonly editId = signal<number | null>(null);
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

  openNew(): void {
    this.editId.set(null);
    this.form = this.emptyForm();
  }

  selectEdit(u: any): void {
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
        this.openNew();
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
// 2. DATA SEKOLAH NEGERI
// =========================================================================
@Component({
  selector: 'app-sekolah-mgmt',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div>
        <h5 class="fw-bold mb-0"><i class="bi bi-buildings text-warning me-2"></i>Master Data Sekolah &amp; Pejabat Penanggung Jawab</h5>
        <small class="text-muted">Kelola profil satuan pendidikan, nomor rekening BOS/BOP, serta pejabat PA/TU/Bendahara untuk penandatanganan dokumen PDF.</small>
      </div>
      <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" (click)="reload()">Refresh</button>
    </div>

    <div class="row g-3">
      <div class="col-lg-7">
        <div class="siap-card">
          <div class="table-responsive">
            <table class="table table-siap table-hover">
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
                      <div class="fw-bold">{{ s.namaSekolah }}</div>
                      <small class="text-muted">NPSN {{ s.npsn }} · {{ s.jenjang }}</small>
                    </td>
                    <td class="small">{{ s.namaSudin }}</td>
                    <td class="small">
                      <div>BOS: <code>{{ s.noRekBos }}</code></div>
                      <div>BOP: <code>{{ s.noRekBop }}</code></div>
                    </td>
                    <td class="small">
                      <div>PA: {{ s.namaKepalaSekolah }}</div>
                      <div class="text-muted">PK: {{ s.namaBendahara }}</div>
                    </td>
                    <td class="text-end">
                      <button class="btn btn-sm btn-outline-primary py-0 px-2" (click)="editSekolah(s)">Edit</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="col-lg-5">
        @if (editing()) {
          <div class="siap-card p-3">
            <h6 class="fw-bold mb-3">Edit Profil: {{ editing()!.namaSekolah }}</h6>
            <div class="row g-2">
              <div class="col-12">
                <label class="form-label small fw-semibold mb-1">Nama Sekolah</label>
                <input class="form-control form-control-sm" [(ngModel)]="editing()!.namaSekolah">
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold mb-1">Kepala Sekolah (PA)</label>
                <input class="form-control form-control-sm" [(ngModel)]="editing()!.namaKepalaSekolah">
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold mb-1">NRK PA</label>
                <input class="form-control form-control-sm" [(ngModel)]="editing()!.nrkKepalaSekolah">
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold mb-1">Verifikator TU</label>
                <input class="form-control form-control-sm" [(ngModel)]="editing()!.namaKasubagTu">
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold mb-1">Bendahara (PK)</label>
                <input class="form-control form-control-sm" [(ngModel)]="editing()!.namaBendahara">
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold mb-1">No. Rek BOS</label>
                <input class="form-control form-control-sm" [(ngModel)]="editing()!.noRekBos">
              </div>
              <div class="col-6">
                <label class="form-label small fw-semibold mb-1">No. Rek BOP</label>
                <input class="form-control form-control-sm" [(ngModel)]="editing()!.noRekBop">
              </div>
              <div class="col-12">
                <label class="form-label small fw-semibold mb-1">NPWP Sekolah</label>
                <input class="form-control form-control-sm" [(ngModel)]="editing()!.npwpSekolah">
              </div>
            </div>
            <div class="d-flex justify-content-end gap-2 mt-3">
              <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" (click)="editing.set(null)">Batal</button>
              <button class="btn btn-sm btn-siap rounded-pill px-3" (click)="save()">Simpan Perubahan</button>
            </div>
          </div>
        } @else {
          <div class="siap-card p-4 text-center text-muted">
            <i class="bi bi-building-gear fs-1 d-block mb-2 text-warning"></i>
            Pilih tombol <strong>Edit</strong> pada salah satu sekolah di sebelah kiri untuk memperbarui profil dan pejabat sekolah.
          </div>
        }
      </div>
    </div>
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
    <div class="row g-3">
      <div class="col-lg-5">
        <div class="siap-card h-100">
          <div class="siap-card-header">
            <h6 class="fw-bold mb-0"><i class="bi bi-shield-lock text-warning me-2"></i>Daftar Role Otoritas (RBAC)</h6>
            <small class="text-muted">Hierarki kewenangan dari Sekolah, Suku Dinas, hingga Dinas Pendidikan.</small>
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
                    <td><span class="badge text-bg-warning text-dark">{{ r.roleCode }}</span></td>
                    <td><span class="badge bg-light text-dark border">{{ r.level }}</span></td>
                    <td>
                      <div class="fw-semibold">{{ r.roleName }}</div>
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
          <div class="siap-card-header">
            <h6 class="fw-bold mb-0"><i class="bi bi-diagram-2 text-warning me-2"></i>Matriks Hak Akses Modul &amp; Menu Aplikasi</h6>
            <small class="text-muted">Setiap menu disaring dinamis saat login berdasarkan claim JWT <code>roleCode</code>.</small>
          </div>
          <div class="table-responsive">
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
                    <td><span class="badge bg-secondary-subtle text-dark">{{ m.kodeAplikasi }}</span></td>
                    <td class="fw-semibold"><i class="bi {{ m.icon }} me-1 text-warning"></i>{{ m.nama }}</td>
                    <td><code class="small">{{ m.link }}</code></td>
                    <td class="small">{{ m.allowedRolesCsv }}</td>
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
