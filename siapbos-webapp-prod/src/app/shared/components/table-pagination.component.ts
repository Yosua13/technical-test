import { Component, computed, input, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: -1, label: 'All' }
] as const;

export function slicePaged<T>(items: T[], page: number, pageSize: number): T[] {
  if (pageSize <= 0) return items;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

@Component({
  selector: 'app-table-pagination',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 px-3 py-2 border-top bg-light bg-opacity-50">
      <div class="d-flex flex-wrap align-items-center gap-2 small text-muted">
        <span>Tampilkan</span>
        <select class="form-select form-select-sm" style="width: auto; min-width: 78px;"
                [ngModel]="pageSize()" (ngModelChange)="onSizeChange($event)">
          @for (opt of sizeOptions; track opt.value) {
            <option [ngValue]="opt.value">{{ opt.label }}</option>
          }
        </select>
        <span>
          &middot; Menampilkan <strong>{{ startItem() }}&ndash;{{ endItem() }}</strong> dari <strong>{{ totalItems() }}</strong> {{ itemLabel() }}
        </span>
      </div>

      @if (totalPages() > 1) {
        <div class="d-flex align-items-center gap-1">
          <button type="button" class="btn btn-sm btn-neutral rounded-pill px-2"
                  title="Halaman Pertama" [disabled]="safePage() <= 1" (click)="goTo(1)">
            <i class="bi bi-chevron-double-left"></i>
          </button>
          <button type="button" class="btn btn-sm btn-neutral rounded-pill px-2"
                  title="Sebelumnya" [disabled]="safePage() <= 1" (click)="goTo(safePage() - 1)">
            <i class="bi bi-chevron-left"></i>
          </button>

          @for (p of visiblePages(); track p) {
            @if (p < 0) {
              <span class="px-1 text-muted small">&hellip;</span>
            } @else {
              <button type="button"
                      class="btn btn-sm rounded-pill px-2"
                      style="min-width: 32px;"
                      [class]="p === safePage() ? 'btn-siap' : 'btn-neutral'"
                      (click)="goTo(p)">
                {{ p }}
              </button>
            }
          }

          <button type="button" class="btn btn-sm btn-neutral rounded-pill px-2"
                  title="Berikutnya" [disabled]="safePage() >= totalPages()" (click)="goTo(safePage() + 1)">
            <i class="bi bi-chevron-right"></i>
          </button>
          <button type="button" class="btn btn-sm btn-neutral rounded-pill px-2"
                  title="Halaman Terakhir" [disabled]="safePage() >= totalPages()" (click)="goTo(totalPages())">
            <i class="bi bi-chevron-double-right"></i>
          </button>
        </div>
      }
    </div>
  `
})
export class TablePaginationComponent {
  readonly totalItems = input.required<number>();
  readonly itemLabel = input<string>('data');
  readonly page = model<number>(1);
  readonly pageSize = model<number>(10);
  readonly sizeOptions = PAGE_SIZE_OPTIONS;

  readonly totalPages = computed(() => {
    const size = this.pageSize();
    const total = this.totalItems();
    if (size <= 0 || total <= 0) return 1;
    return Math.max(1, Math.ceil(total / size));
  });

  readonly safePage = computed(() => Math.min(Math.max(1, this.page()), this.totalPages()));

  readonly startItem = computed(() => {
    if (this.totalItems() === 0) return 0;
    const size = this.pageSize();
    if (size <= 0) return 1;
    return (this.safePage() - 1) * size + 1;
  });

  readonly endItem = computed(() => {
    const total = this.totalItems();
    if (total === 0) return 0;
    const size = this.pageSize();
    if (size <= 0) return total;
    return Math.min(total, this.safePage() * size);
  });

  readonly visiblePages = computed<number[]>(() => {
    const total = this.totalPages();
    const current = this.safePage();
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: number[] = [1];
    if (current > 3) pages.push(-1);
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push(-2);
    pages.push(total);
    return pages;
  });

  onSizeChange(newSize: number): void {
    this.pageSize.set(Number(newSize));
    this.page.set(1);
  }

  goTo(p: number): void {
    const clamped = Math.min(Math.max(1, p), this.totalPages());
    this.page.set(clamped);
  }
}
