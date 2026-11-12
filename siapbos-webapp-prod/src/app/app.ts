import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastService } from './core/services/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <router-outlet />
    <div class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 2000;">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast show align-items-center border-0 shadow-lg mb-2 toast-animated"
             [class.text-bg-success]="t.type === 'success'"
             [class.text-bg-danger]="t.type === 'danger'"
             [class.text-bg-warning]="t.type === 'warning'"
             [class.text-bg-info]="t.type === 'info'"
             role="alert">
          <div class="d-flex">
            <div class="toast-body">
              <strong class="d-block">{{ t.title }}</strong>
              <span class="small">{{ t.message }}</span>
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" (click)="toast.dismiss(t.id)"></button>
          </div>
        </div>
      }
    </div>
  `
})
export class App {
  readonly toast = inject(ToastService);
}
