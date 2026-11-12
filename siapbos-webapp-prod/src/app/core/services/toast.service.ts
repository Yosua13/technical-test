import { Injectable, signal } from '@angular/core';

export interface ToastItem {
  id: number;
  type: 'success' | 'danger' | 'warning' | 'info';
  title: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<ToastItem[]>([]);
  private nextId = 1;

  show(type: ToastItem['type'], title: string, message: string): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, type, title, message }]);
    setTimeout(() => this.dismiss(id), 4500);
  }

  success(message: string, title = 'Berhasil'): void {
    this.show('success', title, message);
  }

  error(message: string, title = 'Terjadi Kesalahan'): void {
    this.show('danger', title, message);
  }

  info(message: string, title = 'Informasi'): void {
    this.show('info', title, message);
  }

  warning(message: string, title = 'Perhatian'): void {
    this.show('warning', title, message);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((x) => x.id !== id));
  }
}
