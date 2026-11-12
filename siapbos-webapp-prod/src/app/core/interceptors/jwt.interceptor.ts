import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const toast = inject(ToastService);
  const token = auth.getToken();

  const authReq = token
    ? req.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      })
    : req;

  return next(authReq).pipe(
    catchError((err) => {
      if (err.status === 401 && !req.url.includes('/oauth/token')) {
        toast.warning('Sesi berakhir, silakan login kembali.');
        auth.logout();
      } else if (err.error?.message) {
        toast.error(err.error.message);
      } else if (err.status >= 500) {
        toast.error(`Microservice error (${err.status}). Pastikan seluruh service backend berjalan.`);
      }
      return throwError(() => err);
    })
  );
};
