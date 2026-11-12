import { Component, EventEmitter, OnInit, Output, inject, input } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-sekolah-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  template: `
    <div class="siap-card p-3 mb-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
      <div class="d-flex align-items-center gap-3">
        <div class="rounded-3 d-flex align-items-center justify-content-center"
             style="width: 44px; height: 44px; background: var(--siap-amber-soft); color: var(--siap-orange-dark);">
          <i class="bi bi-building-check fs-4"></i>
        </div>
        <div>
          @if (auth.sekolahList().length > 1) {
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="text-muted small fw-semibold">Satuan Pendidikan:</span>
              <select class="form-select form-select-sm fw-bold border-warning" style="width: auto; min-width: 240px;"
                      [ngModel]="auth.selectedSekolahId()" (ngModelChange)="onChangeSekolah($event)">
                @for (s of auth.sekolahList(); track s.id) {
                  <option [ngValue]="s.id">{{ s.namaSekolah }} ({{ s.npsn }})</option>
                }
              </select>
              @if (auth.requiresSchoolPicker()) {
                <button type="button"
                        class="btn btn-sm btn-outline-warning rounded-pill px-3 text-dark fw-semibold"
                        (click)="auth.openSekolahPicker()">
                  <i class="bi bi-table me-1"></i>DataTables Sekolah
                </button>
              }
            </div>
          } @else {
            <div class="fw-bold fs-6 text-dark">
              {{ auth.activeSekolah()?.namaSekolah || 'Memuat Sekolah...' }}
              <span class="badge text-bg-light border ms-1 fw-normal">NPSN: {{ auth.activeSekolah()?.npsn }}</span>
            </div>
          }
          <div class="text-muted small mt-1">
            {{ auth.activeSekolah()?.namaSudin }} ·
            Rek. {{ sumberDana() }}: <span class="fw-semibold text-dark">{{ sumberDana() === 'BOS' ? auth.activeSekolah()?.noRekBos : auth.activeSekolah()?.noRekBop }}</span> (Bank DKI)
          </div>
        </div>
      </div>

      <div class="d-flex align-items-center gap-3">
        <div class="text-end px-3 py-2 rounded-3 bg-light border">
          <div class="text-muted" style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase;">
            Saldo Kas Bank {{ sumberDana() }}
          </div>
          <div class="fw-bold fs-6 text-success tabular-nums">
            {{ (sumberDana() === 'BOS' ? auth.activeSekolah()?.saldoBos : auth.activeSekolah()?.saldoBop) | currency:'IDR':'symbol':'1.0-0' }}
          </div>
        </div>
        <span class="badge px-3 py-2 rounded-pill fs-6"
              [class.text-bg-warning]="sumberDana() === 'BOS'"
              [class.text-bg-primary]="sumberDana() === 'BOP'">
          TA {{ auth.tahunAnggaran() }} · {{ sumberDana() }}
        </span>
      </div>
    </div>
  `
})
export class SekolahBarComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly sumberDana = input<string>('BOS');
  @Output() readonly sekolahChanged = new EventEmitter<number>();

  ngOnInit(): void {
    if (this.auth.sekolahList().length === 0) {
      this.auth.loadSekolahOptions().subscribe();
    }
  }

  onChangeSekolah(newId: number): void {
    this.auth.setSelectedSekolah(Number(newId));
    this.sekolahChanged.emit(Number(newId));
  }
}
