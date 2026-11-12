import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { ToastService } from '../../core/services/toast.service';
import { Sekolah } from '../../core/models/siapbos.models';

@Component({
  selector: 'app-pengguna-mgmt',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- FILTER BAR (MULTI-KRITERIA & OTORITAS DB) -->
    <div class="siap-card p-3 mb-3">
      <div class="row g-2 align-items-end">
        <div class="col-md-2">
          <label class="form-label small fw-semibold text-muted mb-1">Nama</label>
          <input type="text" class="form-control form-control-sm" [(ngModel)]="filters.nama"
                 (keyup.enter)="loadUsers()" placeholder="Cari nama...">
        </div>
        <div class="col-md-2">
          <label class="form-label small fw-semibold text-muted mb-1">Username / NRK</label>
          <input type="text" class="form-control form-control-sm" [(ngModel)]="filters.nrk"
                 (keyup.enter)="loadUsers()" placeholder="NRK / username...">
        </div>
        <div class="col-md-2">
          <label class="form-label small fw-semibold text-muted mb-1">NIP</label>
          <input type="text" class="form-control form-control-sm" [(ngModel)]="filters.nip"
                 (keyup.enter)="loadUsers()" placeholder="Cari NIP...">
        </div>
        <div class="col-md-2">
          <label class="form-label small fw-semibold text-muted mb-1">Email</label>
          <input type="text" class="form-control form-control-sm" [(ngModel)]="filters.email"
                 (keyup.enter)="loadUsers()" placeholder="Cari email...">
        </div>
        <div class="col-md-2">
          <label class="form-label small fw-semibold text-muted mb-1">Otoritas</label>
          <select class="form-select form-select-sm" [(ngModel)]="filters.otoritas" (ngModelChange)="loadUsers()">
            <option value="">Semua Otoritas</option>
            @for (r of roles(); track r.id) {
              <option [value]="r.roleCode">{{ r.roleCode }}</option>
            }
          </select>
        </div>
        <div class="col-md-2">
          <label class="form-label small fw-semibold text-muted mb-1">Jenjang</label>
          <select class="form-select form-select-sm" [(ngModel)]="filters.jenjang" (ngModelChange)="loadUsers()">
            <option value="">Semua Jenjang</option>
            <option value="SD">SD</option>
            <option value="SMP">SMP</option>
            <option value="SMA">SMA</option>
            <option value="SMK">SMK</option>
            <option value="SLB">SLB</option>
          </select>
        </div>
      </div>

      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3 pt-2 border-top">
        <div class="d-flex flex-wrap align-items-center gap-2">
          <button type="button" class="btn btn-sm btn-siap rounded-pill px-3" (click)="loadUsers()">
            <i class="bi bi-search me-1"></i>Filter
          </button>
          <button type="button" class="btn btn-sm btn-neutral rounded-pill px-3" (click)="resetFilter()">
            <i class="bi bi-arrow-counterclockwise me-1"></i>Reset
          </button>
          <span class="badge badge-neutral rounded-pill px-3 py-2">{{ users().length }} Pengguna</span>
        </div>

        <div class="d-flex flex-wrap align-items-center gap-2">
          @if (selectedIds().length > 0) {
            <div class="btn-group btn-group-sm">
              <button type="button" class="btn btn-outline-warning text-dark" (click)="batchLock(true)" title="Kunci akun terpilih">
                <i class="bi bi-lock-fill me-1"></i>Kunci ({{ selectedIds().length }})
              </button>
              <button type="button" class="btn btn-outline-secondary" (click)="batchLock(false)" title="Buka kunci akun terpilih">
                <i class="bi bi-unlock me-1"></i>Unlock
              </button>
              <button type="button" class="btn btn-outline-success" (click)="batchAktif(true)" title="Aktifkan akun terpilih">
                <i class="bi bi-check-circle me-1"></i>Aktif
              </button>
              <button type="button" class="btn btn-outline-danger" (click)="batchAktif(false)" title="Nonaktifkan akun terpilih">
                <i class="bi bi-slash-circle me-1"></i>Nonaktif
              </button>
            </div>
          }
          <button type="button" class="btn btn-sm btn-neutral rounded-pill px-3" (click)="exportCsv()">
            <i class="bi bi-file-earmark-excel me-1 text-success"></i>Ekspor Excel/CSV
          </button>
          <button type="button" class="btn btn-sm btn-siap rounded-pill px-3" (click)="openCreateModal()">
            <i class="bi bi-person-plus-fill me-1"></i>Tambah Pengguna
          </button>
        </div>
      </div>
    </div>

    <!-- TABEL DAFTAR PENGGUNA -->
    <div class="siap-card overflow-hidden">
      <div class="table-responsive">
        <table class="table table-siap table-hover w-100 align-middle">
          <thead>
            <tr>
              <th style="width: 36px;">
                <input type="checkbox" class="form-check-input"
                       [checked]="allSelected()"
                       (change)="toggleSelectAll($any($event.target).checked)">
              </th>
              <th>Pengguna</th>
              <th>NRK / NIP</th>
              <th>Otoritas</th>
              <th>Sekolah / Wilayah</th>
              <th>Status</th>
              <th class="text-end">Aksi Kelola</th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              <tr><td colspan="7" class="text-center py-4 text-muted">Memuat data pengguna...</td></tr>
            } @else if (users().length === 0) {
              <tr><td colspan="7" class="text-center py-4 text-muted">Tidak ada pengguna sesuai kriteria pencarian.</td></tr>
            } @else {
              @for (u of users(); track u.id) {
                <tr>
                  <td>
                    <input type="checkbox" class="form-check-input"
                           [checked]="isSelected(u.id)"
                           (change)="toggleSelect(u.id, $any($event.target).checked)">
                  </td>
                  <td>
                    <div class="fw-semibold text-dark">{{ u.namaLengkap }}</div>
                    <div class="small text-muted"><code>{{ u.username }}</code> · {{ u.email || '-' }}</div>
                  </td>
                  <td>
                    <div class="small fw-medium">NRK {{ u.nrk || '-' }}</div>
                    <small class="text-muted">NIP {{ u.nip || '-' }}</small>
                  </td>
                  <td>
                    <div class="d-flex flex-wrap gap-1">
                      @if (u.otoritasList?.length) {
                        @for (r of u.otoritasList; track r.id) {
                          <span class="badge badge-role rounded-pill px-2 py-1">{{ r.roleCode }}</span>
                        }
                      } @else {
                        <span class="badge badge-role rounded-pill px-2 py-1">{{ u.roleCode }}</span>
                      }
                    </div>
                  </td>
                  <td>
                    <div class="small text-dark fw-medium text-truncate" style="max-width: 240px;" [title]="u.namaSekolah || ''">
                      {{ u.namaSekolah || '-' }}
                    </div>
                    <small class="text-muted">
                      Wilayah: {{ formatWilayah(u) }}
                    </small>
                  </td>
                  <td>
                    <div class="d-flex flex-column gap-1">
                      @if (u.isActive) {
                        <span class="badge bg-success-subtle text-success rounded-pill" style="width: fit-content;">Aktif</span>
                      } @else {
                        <span class="badge bg-danger-subtle text-danger rounded-pill" style="width: fit-content;">Nonaktif</span>
                      }
                      @if (u.isLocked) {
                        <span class="badge bg-warning-subtle text-warning-emphasis rounded-pill" style="width: fit-content;">
                          <i class="bi bi-lock-fill me-1"></i>Terkunci
                        </span>
                      }
                    </div>
                  </td>
                  <td class="text-end">
                    <div class="d-inline-flex flex-wrap justify-content-end gap-1">
                      <button type="button" class="btn btn-sm btn-neutral px-2" title="Sunting Data" (click)="openEditModal(u)">
                        <i class="bi bi-pencil"></i>
                      </button>
                      <button type="button" class="btn btn-sm btn-neutral px-2" title="Kelola Otoritas" (click)="openOtoritasModal(u)">
                        <i class="bi bi-shield-lock text-warning-emphasis"></i>
                      </button>
                      <button type="button" class="btn btn-sm btn-neutral px-2" title="Kelola Sekolah" (click)="openSekolahModal(u)">
                        <i class="bi bi-building text-primary"></i>
                      </button>
                      <button type="button" class="btn btn-sm btn-neutral px-2" title="Kelola Wilayah / OPD" (click)="openWilayahModal(u)">
                        <i class="bi bi-geo-alt text-success"></i>
                      </button>
                      <button type="button" class="btn btn-sm btn-neutral px-2" title="Reset Sandi" (click)="openResetPwdModal(u)">
                        <i class="bi bi-key"></i>
                      </button>
                      @if (u.username !== 'ADMIN-TDI') {
                        <button type="button" class="btn btn-sm btn-outline-danger px-2" title="Hapus Pengguna" (click)="deleteUser(u)">
                          <i class="bi bi-trash"></i>
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL TAMBAH / SUNTING PENGGUNA -->
    @if (showFormModal()) {
      <div class="modal-backdrop-custom" (click)="showFormModal.set(false)">
        <div class="modal-dialog-custom" style="max-width: 680px;" (click)="$event.stopPropagation()">
          <div class="siap-card-header d-flex justify-content-between align-items-center">
            <h6 class="fw-bold mb-0">
              <i class="bi bi-person-gear me-2" style="color: #FF9A00;"></i>
              {{ editId() ? 'Sunting Data Pengguna' : 'Tambah Pengguna Baru' }}
            </h6>
            <button type="button" class="btn-close btn-sm" (click)="showFormModal.set(false)"></button>
          </div>
          <div class="modal-body-scroll">
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">NRK (Inquiry SIMPEG)</label>
                <div class="input-group input-group-sm">
                  <input class="form-control" [(ngModel)]="form.nrk" placeholder="Masukkan NRK...">
                  <button type="button" class="btn btn-neutral" (click)="cekSimpeg()">
                    <i class="bi bi-search me-1"></i>Cek SIMPEG
                  </button>
                </div>
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Username Login *</label>
                <input class="form-control form-control-sm" [(ngModel)]="form.username" [disabled]="!!editId()">
              </div>

              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Nama Lengkap *</label>
                <input class="form-control form-control-sm" [(ngModel)]="form.namaLengkap">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">NIP</label>
                <input class="form-control form-control-sm" [(ngModel)]="form.nip">
              </div>

              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Email</label>
                <input type="email" class="form-control form-control-sm" [(ngModel)]="form.email">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">No. Handphone</label>
                <input class="form-control form-control-sm" [(ngModel)]="form.noHp">
              </div>

              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Otoritas Utama *</label>
                <select class="form-select form-select-sm" [(ngModel)]="form.roleCode">
                  @for (r of roles(); track r.id) {
                    <option [value]="r.roleCode">{{ r.roleCode }} - {{ r.roleName }}</option>
                  }
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Sekolah Binaan / Utama</label>
                <select class="form-select form-select-sm" [(ngModel)]="form.sekolahId">
                  <option [ngValue]="null">Dinas / Sudin / Lintas Sekolah</option>
                  @for (s of auth.sekolahList(); track s.id) {
                    <option [ngValue]="s.id">{{ s.namaSekolah }} ({{ s.npsn }})</option>
                  }
                </select>
              </div>

              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Jabatan</label>
                <input class="form-control form-control-sm" [(ngModel)]="form.jabatan">
              </div>
              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">Wilayah Sudin</label>
                <select class="form-select form-select-sm" [(ngModel)]="form.wilayahSudin">
                  <option value="ALL">ALL - Semua Wilayah DKI Jakarta</option>
                  <option value="JP">JP - Jakarta Pusat</option>
                  <option value="JU">JU - Jakarta Utara</option>
                  <option value="JB">JB - Jakarta Barat</option>
                  <option value="JS">JS - Jakarta Selatan</option>
                  <option value="JT">JT - Jakarta Timur</option>
                </select>
              </div>

              <div class="col-md-6">
                <label class="form-label small fw-semibold mb-1">
                  {{ editId() ? 'Kata Sandi Baru (Opsional)' : 'Kata Sandi Awal' }}
                </label>
                <input type="password" class="form-control form-control-sm" [(ngModel)]="form.password"
                       [placeholder]="editId() ? 'Kosongkan jika tidak diubah' : 'Default: password123'">
              </div>
              <div class="col-md-6 d-flex align-items-end gap-4 pb-1">
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" id="chkAktifUser" [(ngModel)]="form.isActive">
                  <label class="form-check-label small fw-semibold" for="chkAktifUser">Aktif</label>
                </div>
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" id="chkLockUser" [(ngModel)]="form.isLocked">
                  <label class="form-check-label small fw-semibold" for="chkLockUser">Terkunci</label>
                </div>
              </div>
            </div>

            <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
              <button type="button" class="btn btn-neutral rounded-pill px-4" (click)="showFormModal.set(false)">Batal</button>
              <button type="button" class="btn btn-siap rounded-pill px-4" [disabled]="saving()" (click)="saveUser()">
                {{ saving() ? 'Menyimpan...' : 'Simpan Data' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- MODAL KELOLA OTORITAS PENGGUNA (DUAL-LIST) -->
    @if (otoritasModalUser(); as u) {
      <div class="modal-backdrop-custom" (click)="otoritasModalUser.set(null)">
        <div class="modal-dialog-custom" style="max-width: 760px;" (click)="$event.stopPropagation()">
          <div class="siap-card-header d-flex justify-content-between align-items-center">
            <div>
              <h6 class="fw-bold mb-0">Kelola Otoritas Pengguna: {{ u.namaLengkap }}</h6>
              <small class="text-muted">Atur otoritas role yang diberikan kepada akun <code>{{ u.username }}</code></small>
            </div>
            <button type="button" class="btn-close btn-sm" (click)="otoritasModalUser.set(null)"></button>
          </div>
          <div class="modal-body-scroll">
            <div class="row g-3">
              <div class="col-md-6">
                <div class="small fw-bold text-muted mb-2">Otoritas Tersedia ({{ otorAvail().length }})</div>
                <div class="border rounded-3 p-2 bg-light" style="height: 260px; overflow-y: auto;">
                  @for (r of otorAvail(); track r.id) {
                    <div class="d-flex justify-content-between align-items-center bg-white rounded-2 p-2 mb-1 border">
                      <div>
                        <div class="small fw-bold">{{ r.roleCode }}</div>
                        <small class="text-muted">{{ r.roleName }}</small>
                      </div>
                      <button type="button" class="btn btn-sm btn-siap rounded-pill px-2" (click)="addOtoritas(r)">
                        <i class="bi bi-plus-lg"></i>
                      </button>
                    </div>
                  }
                </div>
              </div>
              <div class="col-md-6">
                <div class="small fw-bold text-success mb-2">Otoritas Dimiliki ({{ otorAssigned().length }})</div>
                <div class="border rounded-3 p-2 bg-light" style="height: 260px; overflow-y: auto;">
                  @for (r of otorAssigned(); track r.id) {
                    <div class="d-flex justify-content-between align-items-center bg-white rounded-2 p-2 mb-1 border border-warning-subtle">
                      <div>
                        <div class="small fw-bold text-dark">{{ r.roleCode }}</div>
                        <small class="text-muted">{{ r.roleName }}</small>
                      </div>
                      <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-2" (click)="removeOtoritas(r)">
                        <i class="bi bi-dash-lg"></i>
                      </button>
                    </div>
                  }
                </div>
              </div>
            </div>
            <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
              <button type="button" class="btn btn-neutral rounded-pill px-4" (click)="otoritasModalUser.set(null)">Batal</button>
              <button type="button" class="btn btn-siap rounded-pill px-4" [disabled]="saving()" (click)="saveOtoritas()">Simpan Otoritas</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- MODAL KELOLA SEKOLAH PENGGUNA (SEARCHABLE DUAL-LIST) -->
    @if (sekolahModalUser(); as u) {
      <div class="modal-backdrop-custom" (click)="sekolahModalUser.set(null)">
        <div class="modal-dialog-custom" style="max-width: 820px;" (click)="$event.stopPropagation()">
          <div class="siap-card-header d-flex justify-content-between align-items-center">
            <div>
              <h6 class="fw-bold mb-0">Kelola Sekolah Pengguna: {{ u.namaLengkap }}</h6>
              <small class="text-muted">Hubungkan sekolah binaan / penempatan pada relasi pengguna-sekolah</small>
            </div>
            <button type="button" class="btn-close btn-sm" (click)="sekolahModalUser.set(null)"></button>
          </div>
          <div class="modal-body-scroll">
            <input type="text" class="form-control form-control-sm mb-3"
                   [ngModel]="sekolahSearch()" (ngModelChange)="sekolahSearch.set($event)"
                   placeholder="Cari NPSN atau Nama Sekolah...">
            <div class="row g-3">
              <div class="col-md-6">
                <div class="small fw-bold text-muted mb-2">Sekolah Tersedia ({{ filteredSekolahAvail().length }})</div>
                <div class="border rounded-3 p-2 bg-light" style="height: 280px; overflow-y: auto;">
                  @for (s of filteredSekolahAvail(); track s.id) {
                    <div class="d-flex justify-content-between align-items-center bg-white rounded-2 p-2 mb-1 border">
                      <div>
                        <div class="small fw-semibold">{{ s.namaSekolah }}</div>
                        <small class="text-muted">NPSN {{ s.npsn }} · {{ s.jenjang }}</small>
                      </div>
                      <button type="button" class="btn btn-sm btn-siap rounded-pill px-2" (click)="addSekolah(s)">
                        <i class="bi bi-plus-lg"></i>
                      </button>
                    </div>
                  }
                </div>
              </div>
              <div class="col-md-6">
                <div class="small fw-bold text-success mb-2">Sekolah Terhubung ({{ sekolahAssigned().length }})</div>
                <div class="border rounded-3 p-2 bg-light" style="height: 280px; overflow-y: auto;">
                  @for (s of sekolahAssigned(); track s.id) {
                    <div class="d-flex justify-content-between align-items-center bg-white rounded-2 p-2 mb-1 border border-warning-subtle">
                      <div>
                        <div class="small fw-semibold">{{ s.namaSekolah }}</div>
                        <small class="text-muted">NPSN {{ s.npsn }} · {{ s.jenjang }}</small>
                      </div>
                      <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-2" (click)="removeSekolah(s)">
                        <i class="bi bi-dash-lg"></i>
                      </button>
                    </div>
                  }
                </div>
              </div>
            </div>
            <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
              <button type="button" class="btn btn-neutral rounded-pill px-4" (click)="sekolahModalUser.set(null)">Batal</button>
              <button type="button" class="btn btn-siap rounded-pill px-4" [disabled]="saving()" (click)="saveSekolah()">Simpan Sekolah</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- MODAL KELOLA WILAYAH / OPD PENGGUNA -->
    @if (wilayahModalUser(); as u) {
      <div class="modal-backdrop-custom" (click)="wilayahModalUser.set(null)">
        <div class="modal-dialog-custom" style="max-width: 720px;" (click)="$event.stopPropagation()">
          <div class="siap-card-header d-flex justify-content-between align-items-center">
            <div>
              <h6 class="fw-bold mb-0">Kelola Wilayah / OPD: {{ u.namaLengkap }}</h6>
              <small class="text-muted">Tentukan batas cakupan wilayah Suku Dinas / Dinas Pendidikan</small>
            </div>
            <button type="button" class="btn-close btn-sm" (click)="wilayahModalUser.set(null)"></button>
          </div>
          <div class="modal-body-scroll">
            <div class="row g-3">
              <div class="col-md-6">
                <div class="small fw-bold text-muted mb-2">Wilayah Tersedia ({{ wilayahAvail().length }})</div>
                <div class="border rounded-3 p-2 bg-light" style="height: 230px; overflow-y: auto;">
                  @for (w of wilayahAvail(); track w.kode) {
                    <div class="d-flex justify-content-between align-items-center bg-white rounded-2 p-2 mb-1 border">
                      <div>
                        <span class="badge badge-neutral me-1">{{ w.kode }}</span>
                        <span class="small fw-semibold">{{ w.nama }}</span>
                      </div>
                      <button type="button" class="btn btn-sm btn-siap rounded-pill px-2" (click)="addWilayah(w)">
                        <i class="bi bi-plus-lg"></i>
                      </button>
                    </div>
                  }
                </div>
              </div>
              <div class="col-md-6">
                <div class="small fw-bold text-success mb-2">Wilayah Aktif ({{ wilayahAssigned().length }})</div>
                <div class="border rounded-3 p-2 bg-light" style="height: 230px; overflow-y: auto;">
                  @for (w of wilayahAssigned(); track w.kode) {
                    <div class="d-flex justify-content-between align-items-center bg-white rounded-2 p-2 mb-1 border border-warning-subtle">
                      <div>
                        <span class="badge badge-role me-1">{{ w.kode }}</span>
                        <span class="small fw-semibold">{{ w.nama }}</span>
                      </div>
                      <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-2" (click)="removeWilayah(w)">
                        <i class="bi bi-dash-lg"></i>
                      </button>
                    </div>
                  }
                </div>
              </div>
            </div>
            <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
              <button type="button" class="btn btn-neutral rounded-pill px-4" (click)="wilayahModalUser.set(null)">Batal</button>
              <button type="button" class="btn btn-siap rounded-pill px-4" [disabled]="saving()" (click)="saveWilayah()">Simpan Wilayah</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- MODAL RESET SANDI PENGGUNA -->
    @if (resetPwdUser(); as u) {
      <div class="modal-backdrop-custom" (click)="resetPwdUser.set(null)">
        <div class="modal-dialog-custom" style="max-width: 440px;" (click)="$event.stopPropagation()">
          <div class="siap-card-header d-flex justify-content-between align-items-center">
            <h6 class="fw-bold mb-0">Reset Kata Sandi: {{ u.username }}</h6>
            <button type="button" class="btn-close btn-sm" (click)="resetPwdUser.set(null)"></button>
          </div>
          <div class="modal-body-scroll">
            <div class="mb-3">
              <label class="form-label small fw-semibold mb-1">Kata Sandi Baru</label>
              <input type="password" class="form-control" [(ngModel)]="resetForm.sandiBaru" placeholder="Minimal 6 karakter...">
            </div>
            <div class="mb-3">
              <label class="form-label small fw-semibold mb-1">Konfirmasi Kata Sandi Baru</label>
              <input type="password" class="form-control" [(ngModel)]="resetForm.konfirmasi" placeholder="Ulangi kata sandi baru...">
            </div>
            <div class="d-flex justify-content-end gap-2 pt-2 border-top">
              <button type="button" class="btn btn-neutral rounded-pill px-4" (click)="resetPwdUser.set(null)">Batal</button>
              <button type="button" class="btn btn-siap rounded-pill px-4" [disabled]="saving()" (click)="confirmResetPwd()">Simpan Sandi</button>
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
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly selectedIds = signal<number[]>([]);

  readonly showFormModal = signal(false);
  readonly editId = signal<number | null>(null);

  readonly otoritasModalUser = signal<any | null>(null);
  readonly otorAvail = signal<any[]>([]);
  readonly otorAssigned = signal<any[]>([]);

  readonly sekolahModalUser = signal<any | null>(null);
  readonly sekolahAvail = signal<Sekolah[]>([]);
  readonly sekolahAssigned = signal<Sekolah[]>([]);
  readonly sekolahSearch = signal('');

  readonly wilayahModalUser = signal<any | null>(null);
  readonly wilayahAvail = signal<{ kode: string; nama: string }[]>([]);
  readonly wilayahAssigned = signal<{ kode: string; nama: string }[]>([]);

  readonly resetPwdUser = signal<any | null>(null);
  resetForm = { sandiBaru: '', konfirmasi: '' };

  filters = {
    nama: '',
    nrk: '',
    nip: '',
    email: '',
    otoritas: '',
    jenjang: ''
  };

  form: any = this.emptyForm();

  readonly allSelected = computed(() =>
    this.users().length > 0 && this.users().every((u) => this.selectedIds().includes(u.id))
  );

  readonly filteredSekolahAvail = computed(() => {
    const q = this.sekolahSearch().trim().toLowerCase();
    if (!q) return this.sekolahAvail();
    return this.sekolahAvail().filter((s) =>
      s.namaSekolah?.toLowerCase().includes(q) || s.npsn?.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.api.getRoles().subscribe({ next: (res) => this.roles.set(res.data || []) });
    this.auth.loadSekolahOptions().subscribe();
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.api.getUsers(this.filters).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.users.set(res.data || []);
        this.selectedIds.set([]);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(err?.error?.message || 'Gagal memuat daftar pengguna.');
      }
    });
  }

  resetFilter(): void {
    this.filters = { nama: '', nrk: '', nip: '', email: '', otoritas: '', jenjang: '' };
    this.loadUsers();
  }

  formatWilayah(u: any): string {
    if (u.wilayahList?.length) {
      return u.wilayahList.map((w: any) => w.kodeWilayah).join(', ');
    }
    return u.wilayahSudin || '-';
  }

  isSelected(id: number): boolean {
    return this.selectedIds().includes(id);
  }

  toggleSelect(id: number, checked: boolean): void {
    const set = new Set(this.selectedIds());
    if (checked) set.add(id); else set.delete(id);
    this.selectedIds.set(Array.from(set));
  }

  toggleSelectAll(checked: boolean): void {
    this.selectedIds.set(checked ? this.users().map((u) => u.id) : []);
  }

  batchLock(flag: boolean): void {
    const ids = this.selectedIds();
    if (!ids.length) return;
    this.api.setUsersLock(ids, flag).subscribe({
      next: (res) => { this.toast.success(res.message); this.loadUsers(); },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal memperbarui status lock.')
    });
  }

  batchAktif(flag: boolean): void {
    const ids = this.selectedIds();
    if (!ids.length) return;
    this.api.setUsersAktif(ids, flag).subscribe({
      next: (res) => { this.toast.success(res.message); this.loadUsers(); },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal memperbarui status aktif.')
    });
  }

  openCreateModal(): void {
    this.editId.set(null);
    this.form = this.emptyForm();
    const firstRole = this.roles()[0]?.roleCode;
    if (firstRole) this.form.roleCode = firstRole;
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
      sekolahId: u.sekolahId ?? null,
      isActive: u.isActive ?? true,
      isLocked: u.isLocked ?? false
    };
    this.showFormModal.set(true);
  }

  cekSimpeg(): void {
    if (!this.form.nrk?.trim()) {
      this.toast.error('Masukkan NRK terlebih dahulu.');
      return;
    }
    this.api.cekSimpeg(this.form.nrk.trim()).subscribe({
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
      error: (err) => this.toast.error(err?.error?.message || 'Gagal inquiry SIMPEG.')
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
        this.showFormModal.set(false);
        this.loadUsers();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.message || 'Gagal menyimpan data pengguna.');
      }
    });
  }

  deleteUser(u: any): void {
    if (!confirm(`Yakin ingin menghapus pengguna ${u.namaLengkap} (${u.username})?`)) return;
    this.api.deleteUser(u.id).subscribe({
      next: (res) => { this.toast.success(res.message); this.loadUsers(); },
      error: (err) => this.toast.error(err?.error?.message || 'Gagal menghapus pengguna.')
    });
  }

  // --- Kelola Otoritas ---
  openOtoritasModal(u: any): void {
    this.otoritasModalUser.set(u);
    this.api.getPenggunaOtoritas(u.id).subscribe({
      next: (res) => {
        this.otorAssigned.set(res.data?.assigned || []);
        this.otorAvail.set(res.data?.available || []);
      }
    });
  }

  addOtoritas(r: any): void {
    this.otorAssigned.set([...this.otorAssigned(), r]);
    this.otorAvail.set(this.otorAvail().filter((x) => x.id !== r.id));
  }

  removeOtoritas(r: any): void {
    if (this.otorAssigned().length <= 1) {
      this.toast.error('Pengguna wajib memiliki minimal satu Otoritas.');
      return;
    }
    this.otorAvail.set([...this.otorAvail(), r]);
    this.otorAssigned.set(this.otorAssigned().filter((x) => x.id !== r.id));
  }

  saveOtoritas(): void {
    const u = this.otoritasModalUser();
    if (!u) return;
    this.saving.set(true);
    const roleIds = this.otorAssigned().map((r) => r.id);
    this.api.savePenggunaOtoritas(u.id, roleIds).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(res.message);
        this.otoritasModalUser.set(null);
        this.loadUsers();
        if (u.id === this.auth.currentUser()?.id) {
          this.auth.refreshSession().subscribe();
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.message || 'Gagal menyimpan otoritas.');
      }
    });
  }

  // --- Kelola Sekolah ---
  openSekolahModal(u: any): void {
    this.sekolahModalUser.set(u);
    this.sekolahSearch.set('');
    this.api.getPenggunaSekolah(u.id).subscribe({
      next: (res) => {
        this.sekolahAssigned.set(res.data?.assigned || []);
        this.sekolahAvail.set(res.data?.available || []);
      }
    });
  }

  addSekolah(s: Sekolah): void {
    this.sekolahAssigned.set([...this.sekolahAssigned(), s]);
    this.sekolahAvail.set(this.sekolahAvail().filter((x) => x.id !== s.id));
  }

  removeSekolah(s: Sekolah): void {
    this.sekolahAvail.set([...this.sekolahAvail(), s]);
    this.sekolahAssigned.set(this.sekolahAssigned().filter((x) => x.id !== s.id));
  }

  saveSekolah(): void {
    const u = this.sekolahModalUser();
    if (!u) return;
    this.saving.set(true);
    const sekolahIds = this.sekolahAssigned().map((s) => s.id);
    this.api.savePenggunaSekolah(u.id, sekolahIds).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(res.message);
        this.sekolahModalUser.set(null);
        this.loadUsers();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.message || 'Gagal menyimpan daftar sekolah.');
      }
    });
  }

  // --- Kelola Wilayah / OPD ---
  openWilayahModal(u: any): void {
    this.wilayahModalUser.set(u);
    this.api.getPenggunaWilayah(u.id).subscribe({
      next: (res) => {
        this.wilayahAssigned.set(res.data?.assigned || []);
        this.wilayahAvail.set(res.data?.available || []);
      }
    });
  }

  addWilayah(w: { kode: string; nama: string }): void {
    this.wilayahAssigned.set([...this.wilayahAssigned(), w]);
    this.wilayahAvail.set(this.wilayahAvail().filter((x) => x.kode !== w.kode));
  }

  removeWilayah(w: { kode: string; nama: string }): void {
    this.wilayahAvail.set([...this.wilayahAvail(), w]);
    this.wilayahAssigned.set(this.wilayahAssigned().filter((x) => x.kode !== w.kode));
  }

  saveWilayah(): void {
    const u = this.wilayahModalUser();
    if (!u) return;
    this.saving.set(true);
    const codes = this.wilayahAssigned().map((w) => w.kode);
    this.api.savePenggunaWilayah(u.id, codes).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(res.message);
        this.wilayahModalUser.set(null);
        this.loadUsers();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.message || 'Gagal menyimpan wilayah.');
      }
    });
  }

  // --- Reset Sandi ---
  openResetPwdModal(u: any): void {
    this.resetPwdUser.set(u);
    this.resetForm = { sandiBaru: '', konfirmasi: '' };
  }

  confirmResetPwd(): void {
    const u = this.resetPwdUser();
    if (!u) return;
    if (!this.resetForm.sandiBaru || this.resetForm.sandiBaru.length < 6) {
      this.toast.error('Kata sandi baru minimal 6 karakter.');
      return;
    }
    if (this.resetForm.sandiBaru !== this.resetForm.konfirmasi) {
      this.toast.error('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    this.saving.set(true);
    this.api.resetUserPassword(u.id, this.resetForm.sandiBaru).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(res.message);
        this.resetPwdUser.set(null);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.message || 'Gagal mereset sandi.');
      }
    });
  }

  exportCsv(): void {
    const headers = ['ID', 'Username', 'Nama Lengkap', 'NRK', 'NIP', 'Email', 'Otoritas', 'Sekolah', 'Wilayah', 'Aktif', 'Terkunci'];
    const rows = this.users().map((u) => [
      u.id,
      u.username,
      `"${(u.namaLengkap || '').replace(/"/g, '""')}"`,
      u.nrk || '',
      u.nip || '',
      u.email || '',
      u.roleCode || '',
      `"${(u.namaSekolah || '').replace(/"/g, '""')}"`,
      this.formatWilayah(u),
      u.isActive ? 'Aktif' : 'Nonaktif',
      u.isLocked ? 'Terkunci' : 'Normal'
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daftar-pengguna-siapbos.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success('Data pengguna berhasil diekspor.');
  }

  private emptyForm(): any {
    return {
      username: '',
      password: '',
      namaLengkap: '',
      nrk: '',
      nip: '',
      nik: '',
      email: '',
      noHp: '',
      roleCode: '',
      jabatan: '',
      wilayahSudin: 'JP',
      sekolahId: null,
      isActive: true,
      isLocked: false
    };
  }
}
