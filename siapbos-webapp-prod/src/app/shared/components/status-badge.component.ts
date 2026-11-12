import { Component, input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    @switch (kind()) {
      @case ('bku') {
        @switch (value()) {
          @case (0) { <span class="badge rounded-pill text-bg-secondary">Draft PK</span> }
          @case (1) { <span class="badge rounded-pill text-bg-info text-white">Diajukan ke TU</span> }
          @case (2) { <span class="badge rounded-pill text-bg-primary">Disetujui TU → PA</span> }
          @case (3) { <span class="badge rounded-pill text-bg-warning text-dark">Disetujui PA (Siap Bayar)</span> }
          @case (4) { <span class="badge rounded-pill text-bg-warning">Disetujui Sudin</span> }
          @case (5) { <span class="badge rounded-pill text-bg-success"><i class="bi bi-check-circle me-1"></i>Lunas CMS Bank DKI</span> }
          @case (9) { <span class="badge rounded-pill text-bg-danger">Ditolak</span> }
          @default { <span class="badge rounded-pill text-bg-light text-dark">Status {{ value() }}</span> }
        }
      }
      @case ('tax') {
        @switch (value()) {
          @case (0) { <span class="badge rounded-pill text-bg-secondary">Belum Kode Billing</span> }
          @case (1) { <span class="badge rounded-pill text-bg-warning text-dark">Billing Aktif</span> }
          @case (2) { <span class="badge rounded-pill text-bg-success"><i class="bi bi-patch-check me-1"></i>Lunas NTPN</span> }
          @default { <span class="badge rounded-pill text-bg-light text-dark">-</span> }
        }
      }
      @case ('trx') {
        @switch (value()) {
          @case ('JO') { <span class="badge bg-success-subtle text-success border border-success-subtle">JO · Dropping Masuk</span> }
          @case ('JJ') { <span class="badge bg-primary-subtle text-primary border border-primary-subtle">JJ · Belanja SPJ</span> }
          @case ('JG') { <span class="badge bg-info-subtle text-info-emphasis border border-info-subtle">JG · Jasa Giro</span> }
          @case ('LL') { <span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle">LL · Lain-lain</span> }
          @case ('ST') { <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">ST · Setor STS</span> }
          @default { <span class="badge bg-light text-dark">{{ value() }}</span> }
        }
      }
      @case ('npd') {
        @switch (value()) {
          @case (0) { <span class="badge rounded-pill text-bg-secondary">Draft NPD</span> }
          @case (1) { <span class="badge rounded-pill text-bg-info text-white">Diajukan ke PA</span> }
          @case (2) { <span class="badge rounded-pill text-bg-primary">Disetujui PA → Sudin</span> }
          @case (3) { <span class="badge rounded-pill text-bg-warning text-dark">Disetujui Sudin</span> }
          @case (4) { <span class="badge rounded-pill text-bg-success"><i class="bi bi-send-check me-1"></i>Terkirim SIPKD</span> }
          @case (9) { <span class="badge rounded-pill text-bg-danger">Ditolak</span> }
        }
      }
    }
  `
})
export class StatusBadgeComponent {
  readonly kind = input.required<'bku' | 'tax' | 'trx' | 'npd'>();
  readonly value = input.required<number | string>();
}
