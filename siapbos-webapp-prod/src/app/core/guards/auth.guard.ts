import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};

export const rbacMenuGuard: CanActivateChildFn = (_childRoute, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }

  // Izinkan akses menu sesuai otoritas DB dari endpoint /oauth/token & /api/auth/me
  if (auth.hasMenuAccess(state.url)) {
    return true;
  }

  toast.warning('Menu tersebut tidak termasuk dalam hak akses Otoritas Anda di database.');
  const fallback = auth.getFirstAllowedRoute();
  return router.parseUrl(fallback);
};
