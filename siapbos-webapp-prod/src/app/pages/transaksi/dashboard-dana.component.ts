import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SiapBosApiService } from '../../core/services/siapbos-api.service';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-dashboard-dana',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, RouterLink, SekolahBarComponent, StatusBadgeComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" (sekolahChanged)="loadData()" />

    @if (summary(); as d) {
      <!-- 4 Executive KPI Cards with Staggered Entrance -->
      <div class="row g-3 mb-4">
        <div class="col-md-6 col-xl-3 animate-stagger" style="--stagger: 0;">
          <div class="summary-kpi-card" style="--kpi-accent: #f59e0b;">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="text-muted small fw-semibold">Total Pagu RKAS {{ sumberDana() }}</div>
                <div class="fs-5 fw-bold mt-1 tabular-nums text-dark">{{ d.saldo.totalPaguRkas | currency:'IDR':'symbol':'1.0-0' }}</div>
              </div>
              <div class="kpi-icon-pill bg-warning-subtle text-warning-emphasis"><i class="bi bi-wallet2"></i></div>
            </div>
            <div class="small text-muted mt-2">Sisa Pagu: <strong>{{ d.saldo.sisaPaguRkas | currency:'IDR':'symbol':'1.0-0' }}</strong></div>
          </div>
        </div>

        <div class="col-md-6 col-xl-3 animate-stagger" style="--stagger: 1;">
          <div class="summary-kpi-card" style="--kpi-accent: #059669;">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="text-muted small fw-semibold">Total Dana Masuk (JO + JG)</div>
                <div class="fs-5 fw-bold text-success mt-1 tabular-nums">{{ d.saldo.totalDanaMasuk | currency:'IDR':'symbol':'1.0-0' }}</div>
              </div>
              <div class="kpi-icon-pill bg-success-subtle text-success"><i class="bi bi-arrow-down-left-circle"></i></div>
            </div>
            <div class="small text-muted mt-2">Dropping Pending Konfirmasi: <strong class="text-dark">{{ d.pendingCounts.droppingPending }}</strong></div>
          </div>
        </div>

        <div class="col-md-6 col-xl-3 animate-stagger" style="--stagger: 2;">
          <div class="summary-kpi-card" style="--kpi-accent: #4f46e5;">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="text-muted small fw-semibold">Total Realisasi Belanja SPJ</div>
                <div class="fs-5 fw-bold text-primary mt-1 tabular-nums">{{ d.saldo.totalBelanjaSpj | currency:'IDR':'symbol':'1.0-0' }}</div>
              </div>
              <div class="kpi-icon-pill bg-primary-subtle text-primary"><i class="bi bi-bag-check"></i></div>
            </div>
            <div class="small text-muted mt-2">Serapan Anggaran: <strong class="text-primary">{{ serapanPct() | number:'1.1-1' }}%</strong></div>
          </div>
        </div>

        <div class="col-md-6 col-xl-3 animate-stagger" style="--stagger: 3;">
          <div class="summary-kpi-card" style="--kpi-accent: #dc2626;">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="text-muted small fw-semibold">Kewajiban Pajak MPN</div>
                <div class="fs-5 fw-bold text-dark mt-1 tabular-nums">{{ d.saldo.totalPajakDipungut | currency:'IDR':'symbol':'1.0-0' }}</div>
              </div>
              <div class="kpi-icon-pill bg-danger-subtle text-danger"><i class="bi bi-receipt"></i></div>
            </div>
            <div class="small mt-2">
              <span class="text-success fw-semibold"><i class="bi bi-patch-check-fill me-1"></i>Lunas NTPN: {{ d.saldo.totalPajakDisetor | currency:'IDR':'symbol':'1.0-0' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Interactive Workflow Pipeline Stepper -->
      <div class="siap-card p-3 p-lg-4 mb-4 animate-stagger" style="--stagger: 4;">
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div>
            <h6 class="fw-bold mb-0"><i class="bi bi-diagram-3 me-2 text-warning"></i>Antrian Workflow Akuntabilitas {{ sumberDana() }}</h6>
            <small class="text-muted">Klik kartu tahap untuk langsung meninjau atau menindaklanjuti transaksi</small>
          </div>
          <span class="badge bg-light text-dark border rounded-pill px-3 py-1">Lunas CMS Bank DKI: <strong>{{ d.pendingCounts.lunasTransfer }} SPJ</strong></span>
        </div>

        <div class="row g-2 text-center">
          <div class="col-6 col-md-4 col-lg-2">
            <a [routerLink]="['/', baseRoute(), 'konfirmasi-dana']" class="d-block p-3 rounded-4 border text-decoration-none bg-light-subtle workflow-step">
              <div class="fs-4 fw-bold text-warning tabular-nums">{{ d.pendingCounts.droppingPending }}</div>
              <div class="small fw-semibold text-dark">Dropping Pending</div>
              <small class="text-muted" style="font-size: 0.7rem;">Konfirmasi Dana</small>
            </a>
          </div>
          <div class="col-6 col-md-4 col-lg-2">
            <a [routerLink]="['/', baseRoute(), 'persetujuan-bku']" class="d-block p-3 rounded-4 border text-decoration-none bg-light-subtle workflow-step">
              <div class="fs-4 fw-bold text-secondary tabular-nums">{{ d.pendingCounts.draftPk }}</div>
              <div class="small fw-semibold text-dark">Draft BKU (PK)</div>
              <small class="text-muted" style="font-size: 0.7rem;">Siap Diajukan</small>
            </a>
          </div>
          <div class="col-6 col-md-4 col-lg-2">
            <a [routerLink]="['/', baseRoute(), 'persetujuan-bku']" class="d-block p-3 rounded-4 border text-decoration-none bg-light-subtle workflow-step">
              <div class="fs-4 fw-bold text-info tabular-nums">{{ d.pendingCounts.menungguTu }}</div>
              <div class="small fw-semibold text-dark">Verifikasi TU</div>
              <small class="text-muted" style="font-size: 0.7rem;">Menunggu TU</small>
            </a>
          </div>
          <div class="col-6 col-md-4 col-lg-2">
            <a [routerLink]="['/', baseRoute(), 'persetujuan-bku']" class="d-block p-3 rounded-4 border text-decoration-none bg-light-subtle workflow-step">
              <div class="fs-4 fw-bold text-primary tabular-nums">{{ d.pendingCounts.menungguPa }}</div>
              <div class="small fw-semibold text-dark">Approval PA</div>
              <small class="text-muted" style="font-size: 0.7rem;">Kepala Sekolah</small>
            </a>
          </div>
          <div class="col-6 col-md-4 col-lg-2">
            <a [routerLink]="['/', baseRoute(), 'pembayaran-bku']" class="d-block p-3 rounded-4 border text-decoration-none bg-light-subtle workflow-step">
              <div class="fs-4 fw-bold text-warning-emphasis tabular-nums">{{ d.pendingCounts.siapBayarCms }}</div>
              <div class="small fw-semibold text-dark">Siap Token &amp; CMS</div>
              <small class="text-muted" style="font-size: 0.7rem;">Transfer Bank DKI</small>
            </a>
          </div>
          <div class="col-6 col-md-4 col-lg-2">
            <a [routerLink]="['/', baseRoute(), 'pembayaran-pajak']" class="d-block p-3 rounded-4 border text-decoration-none bg-light-subtle workflow-step">
              <div class="fs-4 fw-bold text-danger tabular-nums">{{ d.pendingCounts.pajakBelumLunas }}</div>
              <div class="small fw-semibold text-dark">Pajak Belum Lunas</div>
              <small class="text-muted" style="font-size: 0.7rem;">Billing &amp; NTPN</small>
            </a>
          </div>
        </div>
      </div>

      <!-- Analytics Row: Animated Absorption Ring + Cashflow Chart + Recent Transactions -->
      <div class="row g-3">
        <div class="col-lg-5 animate-stagger" style="--stagger: 5;">
          <div class="siap-card p-3 p-lg-4 h-100">
            <!-- Animated SVG Donut Serapan Anggaran -->
            <div class="d-flex align-items-center gap-3 p-3 rounded-4 bg-light border mb-3">
              <svg width="86" height="86" viewBox="0 0 100 100" class="flex-shrink-0">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" stroke-width="10" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="url(#siapRingGrad)" stroke-width="10"
                        stroke-linecap="round"
                        [attr.stroke-dasharray]="circumference"
                        [attr.stroke-dashoffset]="dashOffset()"
                        transform="rotate(-90 50 50)"
                        style="transition: stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1);" />
                <defs>
                  <linearGradient id="siapRingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#f59e0b" />
                    <stop offset="100%" stop-color="#ea580c" />
                  </linearGradient>
                </defs>
                <text x="50" y="55" text-anchor="middle" font-size="18" font-weight="800" fill="#0b132b">
                  {{ serapanPct() | number:'1.0-0' }}%
                </text>
              </svg>
              <div>
                <div class="small fw-bold text-uppercase text-warning-emphasis">Rasio Penyerapan RKAS</div>
                <div class="fw-bold text-dark fs-6">{{ d.saldo.totalBelanjaSpj | currency:'IDR':'symbol':'1.0-0' }}</div>
                <small class="text-muted">dari pagu {{ d.saldo.totalPaguRkas | currency:'IDR':'symbol':'1.0-0' }}</small>
              </div>
            </div>

            <h6 class="fw-bold mb-3"><i class="bi bi-bar-chart-fill me-2 text-warning"></i>Arus Kas Bulanan {{ sumberDana() }}</h6>
            <div class="d-flex flex-column gap-3 mt-2">
              @for (m of d.chartBulanan; track m.bulan) {
                <div>
                  <div class="d-flex justify-content-between small mb-1">
                    <span class="fw-semibold">{{ m.label }} {{ auth.tahunAnggaran() }}</span>
                    <span class="tabular-nums text-muted">
                      <span class="text-success">+{{ m.masuk | currency:'IDR':'symbol':'1.0-0' }}</span> /
                      <span class="text-danger">-{{ m.keluar | currency:'IDR':'symbol':'1.0-0' }}</span>
                    </span>
                  </div>
                  <div class="progress" style="height: 8px;">
                    <div class="progress-bar bg-success" [style.width.%]="calcBarWidth(m.masuk)"></div>
                  </div>
                  <div class="progress mt-1" style="height: 8px;">
                    <div class="progress-bar bg-warning" [style.width.%]="calcBarWidth(m.keluar)"></div>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>

        <div class="col-lg-7 animate-stagger" style="--stagger: 6;">
          <div class="siap-card h-100">
            <div class="siap-card-header d-flex justify-content-between align-items-center">
              <h6 class="fw-bold mb-0"><i class="bi bi-clock-history me-2 text-warning"></i>5 Transaksi BKU Terbaru</h6>
              <a [routerLink]="['/', baseRoute(), 'input-bku']" class="btn btn-sm btn-siap rounded-pill px-3">Lihat Semua BKU</a>
            </div>
            <div class="table-responsive">
              <table class="table table-siap table-hover">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>No. BKU &amp; Uraian</th>
                    <th class="text-end">Nominal</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (t of d.recentTransactions; track t.id) {
                    <tr>
                      <td class="text-nowrap">{{ t.tanggalTransaksi | date:'dd MMM yyyy' }}</td>
                      <td>
                        <div class="fw-bold small">{{ t.nomorBku }} · <app-status-badge kind="trx" [value]="t.kodeTrx" /></div>
                        <div class="text-muted small">{{ t.uraian }}</div>
                      </td>
                      <td class="text-end fw-bold tabular-nums">
                        @if (t.nilaiBrutoMasuk > 0) {
                          <span class="text-success">+{{ t.nilaiBrutoMasuk | currency:'IDR':'symbol':'1.0-0' }}</span>
                        } @else {
                          <span class="text-danger">-{{ t.nilaiBrutoKeluar | currency:'IDR':'symbol':'1.0-0' }}</span>
                        }
                      </td>
                      <td><app-status-badge kind="bku" [value]="t.statusBku" /></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    } @else {
      <!-- Loading Shimmer Skeletons -->
      <div class="row g-3 mb-4">
        @for (s of [1,2,3,4]; track s) {
          <div class="col-md-6 col-xl-3"><div class="siap-skeleton" style="height: 112px;"></div></div>
        }
      </div>
      <div class="siap-skeleton" style="height: 300px;"></div>
    }
  `,
  styles: [`
    .kpi-icon-pill {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
    }
    .workflow-step {
      transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
    }
    .workflow-step:hover {
      border-color: #f59e0b !important;
      background-color: #fffbeb !important;
      transform: translateY(-3px);
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
    }
  `]
})
export class DashboardDanaComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  private readonly api = inject(SiapBosApiService);

  readonly sumberDana = signal<'BOS' | 'BOP'>('BOS');
  readonly baseRoute = signal('bos-negeri');
  readonly summary = signal<any>(null);
  readonly circumference = 2 * Math.PI * 40;

  readonly serapanPct = computed(() => {
    const d = this.summary();
    if (!d?.saldo?.totalPaguRkas || d.saldo.totalPaguRkas <= 0) return 0;
    return Math.min(100, (d.saldo.totalBelanjaSpj / d.saldo.totalPaguRkas) * 100);
  });

  readonly dashOffset = computed(() => {
    const pct = this.serapanPct();
    return this.circumference - (pct / 100) * this.circumference;
  });

  ngOnInit(): void {
    const sd = (this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS';
    this.sumberDana.set(sd);
    this.baseRoute.set(sd === 'BOP' ? 'bop-negeri' : 'bos-negeri');
    this.loadData();
  }

  loadData(): void {
    const sekId = this.auth.selectedSekolahId() || 1;
    this.api.getDashboardSummary(sekId, this.auth.tahunAnggaran(), this.sumberDana()).subscribe({
      next: (res) => {
        if (res.success) this.summary.set(res.data);
      }
    });
  }

  calcBarWidth(val: number): number {
    if (!val || val <= 0) return 0;
    return Math.min(100, Math.max(6, (val / 500000000) * 100));
  }
}
