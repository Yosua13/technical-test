import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Sekolah } from '../../core/models/siapbos.models';

@Component({
  selector: 'app-sekolah-picker-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (auth.showSekolahPickerModal()) {
      <div class="modal-backdrop-custom" (click)="onBackdropClick()">
        <div class="modal-dialog-custom p-0 overflow-hidden" style="max-width: 920px;" (click)="$event.stopPropagation()">
          <!-- Modal Header -->
          <div class="px-4 py-3 text-white d-flex justify-content-between align-items-center"
               style="background: linear-gradient(90deg, #FF9A00 0%, #F97316 100%);">
            <div class="d-flex align-items-center gap-2">
              <div class="rounded-3 bg-white bg-opacity-25 d-flex align-items-center justify-content-center" style="width: 36px; height: 36px;">
                <i class="bi bi-building-fill-check fs-5"></i>
              </div>
              <div>
                <h6 class="fw-bold mb-0">DataTables Pemilihan Sekolah</h6>
                <small class="opacity-75">Pilih satuan pendidikan aktif untuk mengakses modul operasional sekolah</small>
              </div>
            </div>
            @if (allowDismiss()) {
              <button type="button" class="btn-close btn-close-white btn-sm" (click)="closeModal()"></button>
            }
          </div>

          <!-- Filter Toolbar -->
          <div class="p-3 border-bottom bg-light d-flex flex-wrap align-items-center gap-2">
            <div class="input-group input-group-sm flex-grow-1" style="min-width: 220px;">
              <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
              <input type="text"
                     class="form-control border-start-0 ps-0"
                     [ngModel]="searchText()"
                     (ngModelChange)="searchText.set($event); page.set(1)"
                     placeholder="Cari NPSN, Nama Sekolah, Kepala Sekolah, atau Bendahara...">
            </div>

            <select class="form-select form-select-sm" style="width: auto; min-width: 130px;"
                    [ngModel]="jenjangFilter()"
                    (ngModelChange)="jenjangFilter.set($event); page.set(1)">
              <option value="">Semua Jenjang</option>
              <option value="PAUD">PAUD</option>
              <option value="SD">SD</option>
              <option value="SMP">SMP</option>
              <option value="SMA">SMA</option>
              <option value="SMK">SMK</option>
              <option value="SLB">SLB</option>
            </select>

            <select class="form-select form-select-sm" style="width: auto; min-width: 155px;"
                    [ngModel]="wilayahFilter()"
                    (ngModelChange)="wilayahFilter.set($event); page.set(1)">
              <option value="">Semua Wilayah</option>
              <option value="JP">Jakarta Pusat</option>
              <option value="JU">Jakarta Utara</option>
              <option value="JB">Jakarta Barat</option>
              <option value="JS">Jakarta Selatan</option>
              <option value="JT">Jakarta Timur</option>
            </select>

            <select class="form-select form-select-sm" style="width: auto;"
                    [ngModel]="pageSize()"
                    (ngModelChange)="pageSize.set(+$event); page.set(1)">
              <option [ngValue]="10">10 / hal</option>
              <option [ngValue]="25">25 / hal</option>
              <option [ngValue]="50">50 / hal</option>
            </select>
          </div>

          <!-- DataTables Body -->
          <div class="table-responsive" style="max-height: 410px; overflow-y: auto;">
            <table class="table table-siap table-hover mb-0">
              <thead class="sticky-top bg-light" style="z-index: 2;">
                <tr>
                  <th style="width: 44px;">No</th>
                  <th>NPSN</th>
                  <th>Nama Satuan Pendidikan</th>
                  <th>Jenjang</th>
                  <th>Wilayah Sudin</th>
                  <th>Rekening BOSP / BOP</th>
                  <th class="text-end">Aksi</th>
                </tr>
              </thead>
              <tbody>
                @for (s of pagedSekolah(); track s.id; let idx = $index) {
                  <tr [class.table-warning]="auth.selectedSekolahId() === s.id" style="cursor: pointer;" (dblclick)="pick(s)">
                    <td class="text-muted small">{{ (page() - 1) * pageSize() + idx + 1 }}</td>
                    <td class="font-monospace small fw-semibold">{{ s.npsn }}</td>
                    <td>
                      <div class="fw-bold text-dark">{{ s.namaSekolah }}</div>
                      <small class="text-muted">KS: {{ s.namaKepalaSekolah }} · PK: {{ s.namaBendahara }}</small>
                    </td>
                    <td><span class="badge badge-role rounded-pill">{{ s.jenjang }}</span></td>
                    <td>
                      <span class="badge badge-neutral rounded-pill me-1">{{ s.wilayahSudin }}</span>
                      <div class="small text-muted">{{ s.namaSudin }}</div>
                    </td>
                    <td class="small font-monospace">
                      <div>BOS: {{ s.noRekBos }}</div>
                      <div class="text-muted">BOP: {{ s.noRekBop }}</div>
                    </td>
                    <td class="text-end text-nowrap">
                      <button type="button"
                              class="btn btn-sm btn-siap rounded-pill px-3"
                              (click)="pick(s)">
                        <i class="bi bi-check2-circle me-1"></i>Pilih Sekolah
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="text-center py-5 text-muted">
                      Tidak ada data sekolah yang sesuai filter DataTables.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Footer Info + Pagination -->
          <div class="px-4 py-3 border-top bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div class="small text-muted">
              Menampilkan {{ pagedSekolah().length }} dari {{ filteredSekolah().length }} sekolah
              @if (auth.activeSekolah()) {
                · Terpilih saat ini: <strong class="text-dark">{{ auth.activeSekolah()?.namaSekolah }}</strong>
              }
            </div>

            <div class="d-flex align-items-center gap-2">
              <button type="button" class="btn btn-sm btn-neutral rounded-pill px-3"
                      [disabled]="page() <= 1"
                      (click)="page.set(page() - 1)">
                <i class="bi bi-chevron-left"></i>
              </button>
              <span class="small fw-semibold px-2">Hal {{ page() }} / {{ totalPages() }}</span>
              <button type="button" class="btn btn-sm btn-neutral rounded-pill px-3"
                      [disabled]="page() >= totalPages()"
                      (click)="page.set(page() + 1)">
                <i class="bi bi-chevron-right"></i>
              </button>

              @if (!allowDismiss()) {
                <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill px-3 ms-2" (click)="backToSafe()">
                  Kembali ke Portal
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class SekolahPickerModalComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly searchText = signal('');
  readonly jenjangFilter = signal('');
  readonly wilayahFilter = signal('');
  readonly pageSize = signal(10);
  readonly page = signal(1);

  readonly allowDismiss = computed(() => {
    if (this.auth.sekolahConfirmed()) return true;
    const meta = this.auth.findMenuMeta(this.router.url);
    return !meta?.menu?.requiresSekolah;
  });

  readonly filteredSekolah = computed(() => {
    const q = this.searchText().trim().toLowerCase();
    const jen = this.jenjangFilter();
    const wil = this.wilayahFilter();
    return this.auth.sekolahList().filter((s) => {
      if (jen && s.jenjang !== jen) return false;
      if (wil && s.wilayahSudin !== wil) return false;
      if (!q) return true;
      return (
        s.namaSekolah?.toLowerCase().includes(q) ||
        s.npsn?.toLowerCase().includes(q) ||
        s.namaKepalaSekolah?.toLowerCase().includes(q) ||
        s.namaBendahara?.toLowerCase().includes(q)
      );
    });
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredSekolah().length / this.pageSize())));

  readonly pagedSekolah = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filteredSekolah().slice(start, start + this.pageSize());
  });

  ngOnInit(): void {
    if (this.auth.isLoggedIn() && this.auth.sekolahList().length === 0) {
      this.auth.loadSekolahOptions().subscribe();
    }
  }

  pick(s: Sekolah): void {
    this.auth.confirmSekolah(s);
  }

  onBackdropClick(): void {
    if (this.allowDismiss()) {
      this.closeModal();
    }
  }

  closeModal(): void {
    this.auth.pendingSekolahUrl.set(null);
    this.auth.showSekolahPickerModal.set(false);
  }

  backToSafe(): void {
    this.auth.pendingSekolahUrl.set(null);
    this.auth.showSekolahPickerModal.set(false);
    this.router.navigate(['/landingpage']);
  }
}
