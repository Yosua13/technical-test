import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SekolahBarComponent } from '../../shared/components/sekolah-bar.component';

@Component({
  selector: 'app-laporan-bku',
  standalone: true,
  imports: [CommonModule, FormsModule, SekolahBarComponent],
  template: `
    <app-sekolah-bar [sumberDana]="sumberDana()" />

    <div class="siap-card p-3 mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
      <div>
        <h6 class="fw-bold mb-0"><i class="bi bi-file-earmark-bar-graph me-2 text-warning"></i>Pusat Cetak Laporan Resmi {{ sumberDana() }}</h6>
        <small class="text-muted">Dihasilkan secara real-time oleh microservice <code>siapbos-report (:5005)</code> menggunakan QuestPDF &amp; ClosedXML</small>
      </div>
      <div class="d-flex align-items-center gap-2">
        <label class="small fw-semibold mb-0">Filter Jenis Pajak (Form 25):</label>
        <select class="form-select form-select-sm" style="width: 170px;" [(ngModel)]="filterPajak">
          <option value="">Semua Pajak (P1-P5)</option>
          <option value="P1">P1 · PPh Pasal 21</option>
          <option value="P2">P2 · PPh Pasal 22</option>
          <option value="P3">P3 · PPh Pasal 23</option>
          <option value="P4">P4 · PPh Pasal 4(2)</option>
          <option value="P5">P5 · PPN 11%</option>
        </select>
      </div>
    </div>

    <div class="row g-3">
      @for (rpt of reports; track rpt.code) {
        <div class="col-md-6 col-xl-4">
          <div class="siap-card p-3 h-100 d-flex flex-column justify-content-between">
            <div>
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="badge rounded-pill" [class.text-bg-danger]="rpt.format === 'PDF'" [class.text-bg-success]="rpt.format === 'EXCEL'">
                  {{ rpt.format }}
                </span>
                <small class="text-muted font-monospace">{{ rpt.code }}</small>
              </div>
              <h6 class="fw-bold text-dark">{{ rpt.title }}</h6>
              <p class="text-muted small">{{ rpt.desc }}</p>
            </div>
            <a [href]="buildUrl(rpt.path)" target="_blank"
               class="btn btn-sm w-100 fw-semibold"
               [class.btn-outline-danger]="rpt.format === 'PDF'"
               [class.btn-outline-success]="rpt.format === 'EXCEL'">
              <i class="bi" [class.bi-file-earmark-pdf]="rpt.format === 'PDF'" [class.bi-file-earmark-excel]="rpt.format === 'EXCEL'"></i>
              Cetak / Unduh {{ rpt.format }}
            </a>
          </div>
        </div>
      }
    </div>
  `
})
export class LaporanBkuComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);

  readonly sumberDana = signal<'BOS' | 'BOP'>('BOS');
  filterPajak = '';

  readonly reports = [
    { code: 'FORM-22', title: 'Formulir 22 — Buku Kas Umum (BKU)', desc: 'Laporan kronologis penerimaan (Debet), pengeluaran (Kredit), dan saldo berjalan.', format: 'PDF', path: '/report-server/pdf/form22' },
    { code: 'FORM-23', title: 'Formulir 23 — Buku Pembantu Bank', desc: 'Rincian transaksi kas pada rekening Bank DKI (Dropping, Jasa Giro, CMS SPJ).', format: 'PDF', path: '/report-server/pdf/form23' },
    { code: 'FORM-25', title: 'Formulir 25 — Buku Pembantu Pajak', desc: 'Rekap pemungutan dan pelunasan pajak per jenis pajak dilengkapi Kode Billing & NTPN.', format: 'PDF', path: '/report-server/pdf/form25' },
    { code: 'KARTU-KENDALI', title: 'Kartu Kendali Kegiatan & Komponen RKAS', desc: 'Pemantauan pagu anggaran RKAS terhadap realisasi belanja serta sisa pagu per komponen.', format: 'PDF', path: '/report-server/pdf/kartu-kendali' },
    { code: 'K1-K7 / FORM-19', title: 'Formulir 19 & Format K1-K7 (1A-1E)', desc: 'Laporan realisasi penyerapan dana sesuai standar regulasi Kemendikbud & DKI Jakarta.', format: 'PDF', path: '/report-server/pdf/form19-k1k7' },
    { code: 'MUTASI-BANK', title: 'Cetakan Mutasi Rekening Koran Bank DKI', desc: 'Laporan resmi mutasi debet/kredit rekening sekolah dari Core Banking Bank DKI.', format: 'PDF', path: '/report-server/pdf/mutasi' },
    { code: 'BAP-KAS-XLSX', title: 'Berita Acara Pemeriksaan Kas (BAP Kas)', desc: 'Spreadsheet rekonsiliasi saldo BKU, saldo rekening koran, dan kas tunai sekolah.', format: 'EXCEL', path: '/report-server/excel/bap-kas' },
    { code: 'MON-DINAS-SUDIN', title: 'Monitoring Serapan, Pajak & Tutup Buku', desc: 'Workbook Excel multi-sheet monitoring kinerja realisasi & kepatuhan seluruh sekolah.', format: 'EXCEL', path: '/report-server/excel/monitoring' }
  ];

  ngOnInit(): void {
    this.sumberDana.set((this.route.snapshot.data['sumberDana'] as 'BOS' | 'BOP') || 'BOS');
  }

  buildUrl(basePath: string): string {
    const sekId = this.auth.selectedSekolahId() || 1;
    const tahun = this.auth.tahunAnggaran();
    const sd = this.sumberDana();
    if (basePath.endsWith('/form25') && this.filterPajak) {
      return `${basePath}?sekolahId=${sekId}&tahun=${tahun}&sumberDana=${sd}&kodeTrxPajak=${this.filterPajak}`;
    }
    return `${basePath}?sekolahId=${sekId}&tahun=${tahun}&sumberDana=${sd}`;
  }
}
