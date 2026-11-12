import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-otoritas-mgmt',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- TAB HEADER -->
    <ul class="nav nav-pills gap-2 mb-3">
      <li class="nav-item">
        <button type="button" class="nav-link rounded-pill px-3" [class.active]="activeTab() === 'otoritas'"
                (click)="activeTab.set('otoritas')">
          <i class="bi bi-shield-lock me-1"></i>Master Otoritas ({{ roles().length }})
        </button>
      </li>
      <li class="nav-item">
        <button type="button" class="nav-link rounded-pill px-3" [class.active]="activeTab() === 'aplikasi'"
                (click)="activeTab.set('aplikasi')">
          <i class="bi bi-grid-1x2 me-1"></i>Master Aplikasi ({{ apps().length }})
        </button>
      </li>
      <li class="nav-item">
        <button type="button" class="nav-link rounded-pill px-3" [class.active]="activeTab() === 'menu'"
                (click)="activeTab.set('menu')">
          <i class="bi bi-list-nested me-1"></i>Master Sub-Menu ({{ menus().length }})
        </button>
      </li>
    </ul>

    <!-- TAB 1: MASTER OTORITAS (RBAC) -->
    @if (activeTab() === 'otoritas') {
      <div class="siap-card overflow-hidden">
        <div class="siap-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <h6 class="fw-bold mb-0 text-dark">Daftar Otoritas (RBAC Berbasis Database)</h6>
            <small class="text-muted">Kelola otoritas, pemetaan modul aplikasi, dan hak akses sub-menu secara relasional</small>
          </div>
          <button type="button" class="btn btn-sm btn-siap rounded-pill px-3" (click)="openRoleCreate()">
            <i class="bi bi-plus-circle me-1"></i>Tambah Otoritas
          </button>
        </div>
        <div class="table-responsive">
          <table class="table table-siap table-hover align-middle">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama &amp; Deskripsi Otoritas</th>
                <th>Level</th>
                <th class="text-center">Pengguna</th>
                <th class="text-center">Modul</th>
                <th class="text-center">Sub-Menu</th>
                <th class="text-end">Kelola Hak Akses</th>
              </tr>
            </thead>
            <tbody>
              @for (r of roles(); track r.id) {
                <tr>
                  <td>
                    <span class="badge badge-role rounded-pill px-2 py-1">{{ r.roleCode }}</span>
                    <div class="small text-muted mt-1">{{ r.shortCode }}</div>
                  </td>
                  <td>
                    <div class="fw-semibold text-dark">{{ r.roleName }}</div>
                    <small class="text-muted">{{ r.deskripsi }}</small>
                  </td>
                  <td><span class="badge badge-neutral rounded-pill">{{ r.level }}</span></td>
                  <td class="text-center fw-semibold">{{ r.userCount ?? 0 }}</td>
                  <td class="text-center fw-semibold">{{ r.appCount ?? 0 }}</td>
                  <td class="text-center fw-semibold">{{ r.menuCount ?? 0 }}</td>
                  <td class="text-end text-nowrap">
                    <div class="d-inline-flex gap-1">
                      <button type="button" class="btn btn-sm btn-siap rounded-pill px-3" (click)="openAppMatrix(r)">
                        <i class="bi bi-grid-1x2 me-1"></i>Aplikasi
                      </button>
                      <button type="button" class="btn btn-sm btn-neutral rounded-pill px-3" (click)="openMenuMatrix(r)">
                        <i class="bi bi-list-check me-1"></i>Menu
                      </button>
                      <button type="button" class="btn btn-sm btn-neutral px-2" title="Edit Otoritas" (click)="openRoleEdit(r)">
                        <i class="bi bi-pencil"></i>
                      </button>
                      @if (r.roleCode !== 'ADMIN-TDI') {
                        <button type="button" class="btn btn-sm btn-outline-danger px-2" title="Hapus Otoritas" (click)="deleteRole(r)">
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
    }

    <!-- TAB 2: MASTER APLIKASI -->
    @if (activeTab() === 'aplikasi') {
      <div class="siap-card overflow-hidden">
        <div class="siap-card-header d-flex justify-content-between align-items-center">
          <h6 class="fw-bold mb-0 text-dark">Daftar Modul Utama Aplikasi</h6>
          <button type="button" class="btn btn-sm btn-neutral rounded-pill px-3" (click)="loadAll()">
            <i class="bi bi-arrow-clockwise me-1"></i>Refresh
          </button>
        </div>
        <div class="table-responsive">
          <table class="table table-siap table-hover align-middle">
            <thead>
              <tr>
                <th>Urutan</th>
                <th>Kode</th>
                <th>Nama Aplikasi</th>
                <th>Link URL</th>
                <th>Deskripsi</th>
                <th>Status</th>
                <th class="text-end">Aksi</th>
              </tr>
            </thead>
            <tbody>
              @for (a of apps(); track a.id) {
                <tr>
                  <td><span class="badge badge-neutral rounded-pill">{{ a.sortOrder }}</span></td>
                  <td><code class="fw-bold">{{ a.kodeAplikasi }}</code></td>
                  <td class="fw-semibold text-dark">
                    <i class="bi {{ a.icon }} me-2" style="color: #FF9A00;"></i>{{ a.nama }}
                  </td>
                  <td><code>/{{ a.link }}</code></td>
                  <td class="small text-muted">{{ a.deskripsi }}</td>
                  <td>
                    <span class="badge rounded-pill"
                          [class.bg-success-subtle]="a.isActive"
                          [class.text-success]="a.isActive"
                          [class.bg-secondary-subtle]="!a.isActive"
                          [class.text-secondary]="!a.isActive">
                      {{ a.isActive ? 'Aktif' : 'Nonaktif' }}
                    </span>
                  </td>
                  <td class="text-end">
                    <button type="button" class="btn btn-sm btn-neutral rounded-pill px-3" (click)="openAppEdit(a)">
                      <i class="bi bi-pencil me-1"></i>Sunting
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <!-- TAB 3: MASTER SUB-MENU -->
    @if (activeTab() === 'menu') {
      <div class="siap-card p-3 mb-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div class="d-flex flex-wrap align-items-center gap-2">
          <select class="form-select form-select-sm" style="width: auto;" [(ngModel)]="menuAppFilter" (ngModelChange)="loadMenus()">
            <option value="">Semua Aplikasi</option>
            @for (a of apps(); track a.id) {
              <option [value]="a.kodeAplikasi">{{ a.kodeAplikasi }} - {{ a.nama }}</option>
            }
          </select>
          <input type="text" class="form-control form-control-sm" style="width: 240px;"
                 [ngModel]="menuSearch()" (ngModelChange)="menuSearch.set($event)"
                 placeholder="Cari nama menu atau route...">
        </div>
        <button type="button" class="btn btn-sm btn-siap rounded-pill px-3" (click)="openMenuCreate()">
          <i class="bi bi-plus-circle me-1"></i>Tambah Sub-Menu
        </button>
      </div>

      <div class="siap-card overflow-hidden">
        <div class="table-responsive">
          <table class="table table-siap table-hover align-middle">
            <thead>
              <tr>
                <th>Aplikasi</th>
                <th>Nama Sub-Menu</th>
                <th>Link Route</th>
                <th>Wajib Pilih Sekolah</th>
                <th>Otoritas Diizinkan (DB)</th>
                <th class="text-end">Aksi</th>
              </tr>
            </thead>
            <tbody>
              @for (m of filteredMenus(); track m.id) {
                <tr>
                  <td><span class="badge badge-neutral rounded-pill">{{ m.kodeAplikasi }}</span></td>
                  <td class="fw-semibold text-dark">
                    <i class="bi {{ m.icon }} me-2 text-secondary"></i>{{ m.nama }}
                  </td>
                  <td><code class="small">{{ m.link }}</code></td>
                  <td>
                    @if (m.requiresSekolah) {
                      <span class="badge bg-warning-subtle text-warning-emphasis rounded-pill">Ya (DataTables)</span>
                    } @else {
                      <span class="badge badge-neutral rounded-pill">Tidak</span>
                    }
                  </td>
                  <td>
                    <div class="d-flex flex-wrap gap-1">
                      @for (role of (m.allowedRoles || []); track role) {
                        <span class="badge badge-role rounded-pill" style="font-size: 0.68rem;">{{ role }}</span>
                      }
                    </div>
                  </td>
                  <td class="text-end">
                    <button type="button" class="btn btn-sm btn-neutral rounded-pill px-3" (click)="openMenuEdit(m)">
                      <i class="bi bi-pencil"></i>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <!-- MODAL TAMBAH / EDIT OTORITAS -->
    @if (showRoleModal()) {
      <div class="modal-backdrop-custom" (click)="showRoleModal.set(false)">
        <div class="modal-dialog-custom" style="max-width: 520px;" (click)="$event.stopPropagation()">
          <div class="siap-card-header d-flex justify-content-between align-items-center">
            <h6 class="fw-bold mb-0">{{ editRoleId() ? 'Sunting Otoritas' : 'Tambah Otoritas Baru' }}</h6>
            <button type="button" class="btn-close btn-sm" (click)="showRoleModal.set(false)"></button>
          </div>
          <div class="modal-body-scroll">
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Kode Otoritas *</label>
                <input class="form-control form-control-sm" [(ngModel)]="roleForm.roleCode" [disabled]="!!editRoleId()">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Kode Singkat</label>
                <input class="form-control form-control-sm" [(ngModel)]="roleForm.shortCode">
              </div>
              <div class="col-12">
                <label class="form-label small fw-semibold mb-1">Nama Otoritas *</label>
                <input class="form-control form-control-sm" [(ngModel)]="roleForm.roleName">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Level</label>
                <select class="form-select form-select-sm" [(ngModel)]="roleForm.level">
                  <option value="PROVINSI">PROVINSI</option>
                  <option value="WILAYAH">WILAYAH</option>
                  <option value="SEKOLAH">SEKOLAH</option>
                </select>
              </div>
              <div class="col-md-6 d-flex align-items-end pb-1">
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" id="chkRoleActive" [(ngModel)]="roleForm.isActive">
                  <label class="form-check-label small fw-semibold" for="chkRoleActive">Status Aktif</label>
                </div>
              </div>
              <div class="col-12">
                <label class="form-label small fw-semibold mb-1">Deskripsi</label>
                <textarea class="form-control form-control-sm" rows="2" [(ngModel)]="roleForm.deskripsi"></textarea>
              </div>
            </div>
            <div class="d-flex justify-content-end gap-2 mt-4 pt-2 border-top">
              <button type="button" class="btn btn-neutral rounded-pill px-4" (click)="showRoleModal.set(false)">Batal</button>
              <button type="button" class="btn btn-siap rounded-pill px-4" [disabled]="saving()" (click)="saveRole()">Simpan</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- MODAL KELOLA APLIKASI PER OTORITAS (DUAL-LIST) -->
    @if (appMatrixRole(); as r) {
      <div class="modal-backdrop-custom" (click)="appMatrixRole.set(null)">
        <div class="modal-dialog-custom" style="max-width: 760px;" (click)="$event.stopPropagation()">
          <div class="siap-card-header d-flex justify-content-between align-items-center">
            <div>
              <h6 class="fw-bold mb-0">Kelola Aplikasi untuk {{ r.roleCode }}</h6>
              <small class="text-muted">Tentukan modul utama yang diizinkan untuk otoritas {{ r.roleName }}</small>
            </div>
            <button type="button" class="btn-close btn-sm" (click)="appMatrixRole.set(null)"></button>
          </div>
          <div class="modal-body-scroll">
            <div class="row g-3">
              <div class="col-md-6">
                <div class="small fw-bold text-muted mb-2">Aplikasi Tersedia ({{ matrixAppAvail().length }})</div>
                <div class="border rounded-3 p-2 bg-light" style="height: 260px; overflow-y: auto;">
                  @for (a of matrixAppAvail(); track a.id) {
                    <div class="d-flex justify-content-between align-items-center bg-white rounded-2 p-2 mb-1 border">
                      <div>
                        <div class="small fw-bold">{{ a.nama }}</div>
                        <small class="text-muted">{{ a.kodeAplikasi }}</small>
                      </div>
                      <button type="button" class="btn btn-sm btn-siap rounded-pill px-2" (click)="addAppToRole(a)">
                        <i class="bi bi-plus-lg"></i>
                      </button>
                    </div>
                  }
                </div>
              </div>
              <div class="col-md-6">
                <div class="small fw-bold text-success mb-2">Aplikasi Diizinkan ({{ matrixAppAssigned().length }})</div>
                <div class="border rounded-3 p-2 bg-light" style="height: 260px; overflow-y: auto;">
                  @for (a of matrixAppAssigned(); track a.id) {
                    <div class="d-flex justify-content-between align-items-center bg-white rounded-2 p-2 mb-1 border border-warning-subtle">
                      <div>
                        <div class="small fw-bold">{{ a.nama }}</div>
                        <small class="text-muted">{{ a.kodeAplikasi }}</small>
                      </div>
                      <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-2" (click)="removeAppFromRole(a)">
                        <i class="bi bi-dash-lg"></i>
                      </button>
                    </div>
                  }
                </div>
              </div>
            </div>
            <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
              <button type="button" class="btn btn-neutral rounded-pill px-4" (click)="appMatrixRole.set(null)">Batal</button>
              <button type="button" class="btn btn-siap rounded-pill px-4" [disabled]="saving()" (click)="saveAppMatrix()">Simpan Aplikasi</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- MODAL KELOLA SUB-MENU PER OTORITAS & APLIKASI (DUAL-LIST) -->
    @if (menuMatrixRole(); as r) {
      <div class="modal-backdrop-custom" (click)="menuMatrixRole.set(null)">
        <div class="modal-dialog-custom" style="max-width: 840px;" (click)="$event.stopPropagation()">
          <div class="siap-card-header d-flex justify-content-between align-items-center">
            <div>
              <h6 class="fw-bold mb-0">Kelola Sub-Menu untuk {{ r.roleCode }}</h6>
              <small class="text-muted">Pilih modul aplikasi lalu pindahkan sub-menu ke daftar aktif</small>
            </div>
            <button type="button" class="btn-close btn-sm" (click)="menuMatrixRole.set(null)"></button>
          </div>
          <div class="modal-body-scroll">
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <select class="form-select form-select-sm" style="width: auto; min-width: 240px;"
                      [ngModel]="menuMatrixAppKode()" (ngModelChange)="onChangeMatrixApp($event)">
                @for (a of matrixMenuModules(); track a.kodeAplikasi) {
                  <option [value]="a.kodeAplikasi">{{ a.kodeAplikasi }} - {{ a.nama }}</option>
                }
              </select>
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-sm btn-neutral rounded-pill px-3" (click)="grantAllMenus()">Pilih Semua</button>
                <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-3" (click)="revokeAllMenus()">Lepas Semua</button>
              </div>
            </div>

            <div class="row g-3">
              <div class="col-md-6">
                <div class="small fw-bold text-muted mb-2">Sub-Menu Tersedia ({{ matrixMenuAvail().length }})</div>
                <div class="border rounded-3 p-2 bg-light" style="height: 300px; overflow-y: auto;">
                  @for (mn of matrixMenuAvail(); track mn.id) {
                    <div class="d-flex justify-content-between align-items-center bg-white rounded-2 p-2 mb-1 border">
                      <div>
                        <div class="small fw-semibold"><i class="bi {{ mn.icon }} me-1 text-secondary"></i>{{ mn.nama }}</div>
                        <small class="text-muted"><code>{{ mn.link }}</code></small>
                      </div>
                      <button type="button" class="btn btn-sm btn-siap rounded-pill px-2" (click)="addMenuToRole(mn)">
                        <i class="bi bi-plus-lg"></i>
                      </button>
                    </div>
                  }
                </div>
              </div>
              <div class="col-md-6">
                <div class="small fw-bold text-success mb-2">Sub-Menu Diizinkan ({{ matrixMenuAssigned().length }})</div>
                <div class="border rounded-3 p-2 bg-light" style="height: 300px; overflow-y: auto;">
                  @for (mn of matrixMenuAssigned(); track mn.id) {
                    <div class="d-flex justify-content-between align-items-center bg-white rounded-2 p-2 mb-1 border border-warning-subtle">
                      <div>
                        <div class="small fw-semibold"><i class="bi {{ mn.icon }} me-1 text-warning-emphasis"></i>{{ mn.nama }}</div>
                        <small class="text-muted"><code>{{ mn.link }}</code></small>
                      </div>
                      <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-2" (click)="removeMenuFromRole(mn)">
                        <i class="bi bi-dash-lg"></i>
                      </button>
                    </div>
                  }
                </div>
              </div>
            </div>

            <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
              <button type="button" class="btn btn-neutral rounded-pill px-4" (click)="menuMatrixRole.set(null)">Batal</button>
              <button type="button" class="btn btn-siap rounded-pill px-4" [disabled]="saving()" (click)="saveMenuMatrix()">
                Simpan Hak Sub-Menu
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- MODAL EDIT APLIKASI -->
    @if (editingApp(); as app) {
      <div class="modal-backdrop-custom" (click)="editingApp.set(null)">
        <div class="modal-dialog-custom" style="max-width: 500px;" (click)="$event.stopPropagation()">
          <div class="siap-card-header d-flex justify-content-between align-items-center">
            <h6 class="fw-bold mb-0">Sunting Aplikasi: {{ app.kodeAplikasi }}</h6>
            <button type="button" class="btn-close btn-sm" (click)="editingApp.set(null)"></button>
          </div>
          <div class="modal-body-scroll">
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label small fw-semibold mb-1">Nama Aplikasi</label>
                <input class="form-control form-control-sm" [(ngModel)]="app.nama">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Ikon Bootstrap</label>
                <input class="form-control form-control-sm" [(ngModel)]="app.icon">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Urutan Tampil</label>
                <input type="number" class="form-control form-control-sm" [(ngModel)]="app.sortOrder">
              </div>
              <div class="col-12">
                <label class="form-label small fw-semibold mb-1">Deskripsi</label>
                <textarea class="form-control form-control-sm" rows="2" [(ngModel)]="app.deskripsi"></textarea>
              </div>
              <div class="col-12">
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" id="chkAppAktif" [(ngModel)]="app.isActive">
                  <label class="form-check-label small fw-semibold" for="chkAppAktif">Aktif</label>
                </div>
              </div>
            </div>
            <div class="d-flex justify-content-end gap-2 mt-4 pt-2 border-top">
              <button type="button" class="btn btn-neutral rounded-pill px-4" (click)="editingApp.set(null)">Batal</button>
              <button type="button" class="btn btn-siap rounded-pill px-4" [disabled]="saving()" (click)="saveAppEdit()">Simpan</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- MODAL TAMBAH / EDIT SUB-MENU -->
    @if (showMenuModal()) {
      <div class="modal-backdrop-custom" (click)="showMenuModal.set(false)">
        <div class="modal-dialog-custom" style="max-width: 520px;" (click)="$event.stopPropagation()">
          <div class="siap-card-header d-flex justify-content-between align-items-center">
            <h6 class="fw-bold mb-0">{{ editMenuId() ? 'Sunting Sub-Menu' : 'Tambah Sub-Menu Baru' }}</h6>
            <button type="button" class="btn-close btn-sm" (click)="showMenuModal.set(false)"></button>
          </div>
          <div class="modal-body-scroll">
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Modul Aplikasi</label>
                <select class="form-select form-select-sm" [(ngModel)]="menuForm.kodeAplikasi" [disabled]="!!editMenuId()">
                  @for (a of apps(); track a.id) {
                    <option [value]="a.kodeAplikasi">{{ a.kodeAplikasi }} - {{ a.nama }}</option>
                  }
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Urutan Tampil</label>
                <input type="number" class="form-control form-control-sm" [(ngModel)]="menuForm.sortOrder">
              </div>
              <div class="col-12">
                <label class="form-label small fw-semibold mb-1">Nama Sub-Menu *</label>
                <input class="form-control form-control-sm" [(ngModel)]="menuForm.nama">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Link Route *</label>
                <input class="form-control form-control-sm" [(ngModel)]="menuForm.link">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Ikon Bootstrap</label>
                <input class="form-control form-control-sm" [(ngModel)]="menuForm.icon">
              </div>
              <div class="col-12 d-flex gap-4">
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" id="chkMenuSekolah" [(ngModel)]="menuForm.requiresSekolah">
                  <label class="form-check-label small fw-semibold" for="chkMenuSekolah">Wajib Pilih Sekolah (DataTables)</label>
                </div>
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" id="chkMenuAktif" [(ngModel)]="menuForm.isActive">
                  <label class="form-check-label small fw-semibold" for="chkMenuAktif">Aktif</label>
                </div>
              </div>
            </div>
            <div class="d-flex justify-content-end gap-2 mt-4 pt-2 border-top">
              <button type="button" class="btn btn-neutral rounded-pill px-4" (click)="showMenuModal.set(false)">Batal</button>
              <button type="button" class="btn btn-siap rounded-pill px-4" [disabled]="saving()" (click)="saveMenuForm()">Simpan</button>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class OtoritasMgmtComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);
  private readonly toast = inject(ToastService);

  readonly activeTab = signal<'otoritas' | 'aplikasi' | 'menu'>('otoritas');
  readonly roles = signal<any[]>([]);
  readonly apps = signal<any[]>([]);
  readonly menus = signal<any[]>([]);
  readonly saving = signal(false);

  menuAppFilter = '';
  readonly menuSearch = signal('');

  // Role modal
  readonly showRoleModal = signal(false);
  readonly editRoleId = signal<number | null>(null);
  roleForm = { roleCode: '', shortCode: '', roleName: '', deskripsi: '', level: 'SEKOLAH', isActive: true };

  // App matrix per role
  readonly appMatrixRole = signal<any | null>(null);
  readonly matrixAppAvail = signal<any[]>([]);
  readonly matrixAppAssigned = signal<any[]>([]);

  // Menu matrix per role
  readonly menuMatrixRole = signal<any | null>(null);
  readonly matrixMenuModules = signal<any[]>([]);
  readonly menuMatrixAppKode = signal('');
  readonly matrixMenuAvail = signal<any[]>([]);
  readonly matrixMenuAssigned = signal<any[]>([]);

  // App edit modal
  readonly editingApp = signal<any | null>(null);

  // Menu form modal
  readonly showMenuModal = signal(false);
  readonly editMenuId = signal<number | null>(null);
  menuForm = { kodeAplikasi: 'BOS', nama: '', link: '', icon: 'bi-circle', requiresSekolah: true, sortOrder: 1, isActive: true };

  readonly filteredMenus = computed(() => {
    const q = this.menuSearch().trim().toLowerCase();
    if (!q) return this.menus();
    return this.menus().filter((m) =>
      m.nama?.toLowerCase().includes(q) || m.link?.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    const tab = this.route.snapshot.data['tab'] as 'otoritas' | 'aplikasi' | 'menu' | undefined;
    if (tab) this.activeTab.set(tab);
    this.loadAll();
  }

  loadAll(): void {
    this.api.getRoles().subscribe({ next: (res) => this.roles.set(res.data || []) });
    this.api.getAplikasi().subscribe({ next: (res) => this.apps.set(res.data || []) });
    this.loadMenus();
  }

  loadMenus(): void {
    this.api.getMenus(this.menuAppFilter || undefined).subscribe({ next: (res) => this.menus.set(res.data || []) });
  }

  // --- Role CRUD ---
  openRoleCreate(): void {
    this.editRoleId.set(null);
    this.roleForm = { roleCode: '', shortCode: '', roleName: '', deskripsi: '', level: 'SEKOLAH', isActive: true };
    this.showRoleModal.set(true);
  }

  openRoleEdit(r: any): void {
    this.editRoleId.set(r.id);
    this.roleForm = {
      roleCode: r.roleCode,
      shortCode: r.shortCode || '',
      roleName: r.roleName,
      deskripsi: r.deskripsi || '',
      level: r.level || 'SEKOLAH',
      isActive: r.isActive ?? true
    };
    this.showRoleModal.set(true);
  }

  saveRole(): void {
    if (!this.roleForm.roleCode.trim() || !this.roleForm.roleName.trim()) {
      this.toast.error('Kode dan Nama Otoritas wajib diisi.');
      return;
    }
    this.saving.set(true);
    const id = this.editRoleId();
    const obs = id ? this.api.updateOtoritas(id, this.roleForm) : this.api.createOtoritas(this.roleForm);
    obs.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(res.message);
        this.showRoleModal.set(false);
        this.loadAll();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.message || 'Gagal menyimpan otoritas.');
      }
    });
  }

  deleteRole(r: any): void {
    if (!confirm(`Hapus otoritas ${r.roleCode}?`)) return;
    this.api.deleteOtoritas(r.id).subscribe({
      next: (res) => { this.toast.success(res.message); this.loadAll(); },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal menghapus otoritas.')
    });
  }

  // --- Kelola Aplikasi per Role ---
  openAppMatrix(r: any): void {
    this.appMatrixRole.set(r);
    this.api.getOtoritasAplikasi(r.id).subscribe({
      next: (res) => {
        this.matrixAppAssigned.set(res.data?.assigned || []);
        this.matrixAppAvail.set(res.data?.available || []);
      }
    });
  }

  addAppToRole(a: any): void {
    this.matrixAppAssigned.set([...this.matrixAppAssigned(), a]);
    this.matrixAppAvail.set(this.matrixAppAvail().filter((x) => x.id !== a.id));
  }

  removeAppFromRole(a: any): void {
    this.matrixAppAvail.set([...this.matrixAppAvail(), a]);
    this.matrixAppAssigned.set(this.matrixAppAssigned().filter((x) => x.id !== a.id));
  }

  saveAppMatrix(): void {
    const r = this.appMatrixRole();
    if (!r) return;
    this.saving.set(true);
    const ids = this.matrixAppAssigned().map((a) => a.id);
    this.api.saveOtoritasAplikasi(r.id, ids).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(res.message);
        this.appMatrixRole.set(null);
        this.loadAll();
        this.auth.refreshSession().subscribe();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.message || 'Gagal menyimpan hak aplikasi.');
      }
    });
  }

  // --- Kelola Sub-Menu per Role ---
  openMenuMatrix(r: any): void {
    this.menuMatrixRole.set(r);
    this.api.getOtoritasMenu(r.id).subscribe({
      next: (res) => {
        const d = res.data;
        this.matrixMenuModules.set(d?.assignedModules || []);
        this.menuMatrixAppKode.set(d?.kodeAplikasi || '');
        this.matrixMenuAssigned.set(d?.assigned || []);
        this.matrixMenuAvail.set(d?.available || []);
      }
    });
  }

  onChangeMatrixApp(kode: string): void {
    const r = this.menuMatrixRole();
    if (!r) return;
    this.menuMatrixAppKode.set(kode);
    this.api.getOtoritasMenu(r.id, kode).subscribe({
      next: (res) => {
        const d = res.data;
        this.matrixMenuAssigned.set(d?.assigned || []);
        this.matrixMenuAvail.set(d?.available || []);
      }
    });
  }

  addMenuToRole(mn: any): void {
    this.matrixMenuAssigned.set([...this.matrixMenuAssigned(), mn]);
    this.matrixMenuAvail.set(this.matrixMenuAvail().filter((x) => x.id !== mn.id));
  }

  removeMenuFromRole(mn: any): void {
    this.matrixMenuAvail.set([...this.matrixMenuAvail(), mn]);
    this.matrixMenuAssigned.set(this.matrixMenuAssigned().filter((x) => x.id !== mn.id));
  }

  grantAllMenus(): void {
    this.matrixMenuAssigned.set([...this.matrixMenuAssigned(), ...this.matrixMenuAvail()]);
    this.matrixMenuAvail.set([]);
  }

  revokeAllMenus(): void {
    this.matrixMenuAvail.set([...this.matrixMenuAvail(), ...this.matrixMenuAssigned()]);
    this.matrixMenuAssigned.set([]);
  }

  saveMenuMatrix(): void {
    const r = this.menuMatrixRole();
    const kode = this.menuMatrixAppKode();
    if (!r || !kode) return;
    this.saving.set(true);
    const ids = this.matrixMenuAssigned().map((m) => m.id);
    this.api.saveOtoritasMenu(r.id, kode, ids).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(res.message);
        this.menuMatrixRole.set(null);
        this.loadAll();
        this.auth.refreshSession().subscribe();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.message || 'Gagal menyimpan hak sub-menu.');
      }
    });
  }

  // --- Aplikasi Edit ---
  openAppEdit(a: any): void {
    this.editingApp.set({ ...a });
  }

  saveAppEdit(): void {
    const a = this.editingApp();
    if (!a) return;
    this.saving.set(true);
    this.api.updateAplikasi(a.id, a).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(res.message);
        this.editingApp.set(null);
        this.loadAll();
        this.auth.refreshSession().subscribe();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.message || 'Gagal memperbarui aplikasi.');
      }
    });
  }

  // --- Sub-Menu Create / Edit ---
  openMenuCreate(): void {
    this.editMenuId.set(null);
    this.menuForm = {
      kodeAplikasi: this.menuAppFilter || 'BOS',
      nama: '',
      link: '',
      icon: 'bi-circle',
      requiresSekolah: true,
      sortOrder: this.menus().length + 1,
      isActive: true
    };
    this.showMenuModal.set(true);
  }

  openMenuEdit(m: any): void {
    this.editMenuId.set(m.id);
    this.menuForm = {
      kodeAplikasi: m.kodeAplikasi,
      nama: m.nama,
      link: m.link,
      icon: m.icon || 'bi-circle',
      requiresSekolah: !!m.requiresSekolah,
      sortOrder: m.sortOrder ?? 1,
      isActive: m.isActive ?? true
    };
    this.showMenuModal.set(true);
  }

  saveMenuForm(): void {
    if (!this.menuForm.nama.trim() || !this.menuForm.link.trim()) {
      this.toast.error('Nama Sub-Menu dan Link Route wajib diisi.');
      return;
    }
    this.saving.set(true);
    const id = this.editMenuId();
    const obs = id ? this.api.updateMenu(id, this.menuForm) : this.api.createMenu(this.menuForm);
    obs.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(res.message);
        this.showMenuModal.set(false);
        this.loadMenus();
        this.auth.refreshSession().subscribe();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.message || 'Gagal menyimpan sub-menu.');
      }
    });
  }
}
