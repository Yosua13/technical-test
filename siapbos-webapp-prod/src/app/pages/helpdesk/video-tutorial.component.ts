import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';

interface VideoTutorialItem {
  id: string;
  videoId: string;
  category: string;
  durationLabel: string;
  channel: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-video-tutorial',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container-fluid py-3">
      <!-- Header -->
      <div class="card border-0 shadow-sm mb-3" style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: #fff;">
        <div class="card-body d-flex flex-wrap justify-content-between align-items-center gap-3 p-4">
          <div>
            <div class="d-flex align-items-center gap-2 mb-1">
              <i class="bi bi-youtube fs-4 text-danger"></i>
              <span class="badge bg-warning text-dark fw-semibold">WEB VIEW PLAYER YOUTUBE</span>
            </div>
            <h4 class="fw-bold mb-1">Video Tutorial &amp; Edukasi Pengelolaan BOSP / BOP</h4>
            <p class="mb-0 text-white-50 small">
              Tonton langsung panduan video edukasi YouTube di dalam aplikasi tanpa berpindah tab, lengkap dengan kontrol WebView URL YouTube.
            </p>
          </div>
          <div class="d-flex gap-2">
            <a routerLink="/helpdesk/user-manual" class="btn btn-outline-light btn-sm fw-semibold">
              <i class="bi bi-book-half me-1"></i> Baca User Manual
            </a>
            <a routerLink="/helpdesk/tiket-helpdesk" class="btn btn-warning btn-sm fw-semibold text-dark">
              <i class="bi bi-ticket-detailed me-1"></i> Hubungi Help Desk
            </a>
          </div>
        </div>
      </div>

      <div class="row g-3">
        <!-- Main WebView Player Column -->
        <div class="col-lg-8">
          <div class="card border-0 shadow-sm overflow-hidden">
            <!-- Mock Browser/WebView Top Chrome Bar -->
            <div class="bg-light border-bottom px-3 py-2 d-flex flex-wrap align-items-center gap-2">
              <div class="d-flex align-items-center gap-1 me-2">
                <span class="rounded-circle bg-danger d-inline-block" style="width:10px;height:10px;"></span>
                <span class="rounded-circle bg-warning d-inline-block" style="width:10px;height:10px;"></span>
                <span class="rounded-circle bg-success d-inline-block" style="width:10px;height:10px;"></span>
              </div>
              <div class="input-group input-group-sm flex-grow-1">
                <span class="input-group-text bg-white text-success border-end-0">
                  <i class="bi bi-lock-fill"></i>
                </span>
                <input
                  type="text"
                  class="form-control border-start-0 font-monospace small"
                  [(ngModel)]="customUrlInput"
                  placeholder="Tempel tautan atau ID YouTube (contoh: https://www.youtube.com/watch?v=0KIlyTQpzh4)"
                  (keyup.enter)="loadCustomYoutube()"
                />
                <button class="btn btn-warning text-dark fw-semibold" type="button" (click)="loadCustomYoutube()">
                  <i class="bi bi-play-fill me-1"></i>Muat di WebView
                </button>
              </div>
              <a
                [href]="'https://www.youtube.com/watch?v=' + currentVideoId()"
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-sm btn-outline-secondary"
                title="Buka di YouTube"
              >
                <i class="bi bi-box-arrow-up-right"></i>
              </a>
            </div>

            @if (urlError()) {
              <div class="alert alert-danger rounded-0 mb-0 py-2 px-3 small">
                <i class="bi bi-exclamation-triangle me-1"></i>{{ urlError() }}
              </div>
            }

            <!-- Responsive 16:9 YouTube Iframe WebView -->
            <div class="ratio ratio-16x9 bg-dark">
              <iframe
                [src]="safeEmbedUrl()"
                [title]="currentTitle()"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerpolicy="strict-origin-when-cross-origin"
                allowfullscreen
                style="border: 0;"
              ></iframe>
            </div>

            <!-- Active Video Metadata -->
            <div class="card-body p-3 p-md-4 bg-white">
              <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                <div>
                  <span class="badge bg-warning text-dark me-2">{{ currentCategory() }}</span>
                  <span class="badge bg-light text-secondary border">
                    <i class="bi bi-broadcast me-1 text-danger"></i>{{ currentChannel() }}
                  </span>
                </div>
                <span class="small text-muted font-monospace">ID: {{ currentVideoId() }}</span>
              </div>
              <h5 class="fw-bold mb-2">{{ currentTitle() }}</h5>
              <p class="small text-secondary mb-0">{{ currentDescription() }}</p>
            </div>
          </div>
        </div>

        <!-- Playlist & Category Sidebar -->
        <div class="col-lg-4">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-header bg-white py-3">
              <div class="fw-bold mb-2">
                <i class="bi bi-collection-play me-2 text-warning"></i>Daftar Putar Edukasi YouTube
              </div>
              <div class="d-flex flex-wrap gap-1">
                @for (cat of categories; track cat) {
                  <button
                    type="button"
                    class="btn btn-sm py-0 px-2"
                    [class.btn-warning]="selectedCategory() === cat"
                    [class.text-dark]="selectedCategory() === cat"
                    [class.btn-outline-secondary]="selectedCategory() !== cat"
                    (click)="selectedCategory.set(cat)"
                  >
                    {{ cat }}
                  </button>
                }
              </div>
            </div>

            <div class="list-group list-group-flush overflow-auto" style="max-height: 540px;">
              @for (item of filteredVideos(); track item.id) {
                <button
                  type="button"
                  class="list-group-item list-group-item-action p-3 text-start"
                  [style.background-color]="!customTitle() && activeVideo().id === item.id ? '#fff4e5' : ''"
                  [style.border-left]="!customTitle() && activeVideo().id === item.id ? '4px solid #e66b12' : '4px solid transparent'"
                  (click)="selectVideo(item)"
                >
                  <div class="d-flex gap-3 align-items-start">
                    <div class="position-relative flex-shrink-0" style="width: 112px;">
                      <img
                        [src]="'https://i.ytimg.com/vi/' + item.videoId + '/hqdefault.jpg'"
                        [alt]="item.title"
                        class="img-fluid rounded border"
                        style="width: 112px; height: 63px; object-fit: cover;"
                      />
                      <span
                        class="badge bg-dark bg-opacity-75 position-absolute bottom-0 end-0 m-1"
                        style="font-size: 0.65rem;"
                      >
                        {{ item.durationLabel }}
                      </span>
                    </div>
                    <div class="flex-grow-1 min-w-0">
                      <div class="small fw-bold text-dark lh-sm mb-1">{{ item.title }}</div>
                      <div class="text-muted" style="font-size: 0.75rem;">
                        <i class="bi bi-person-video3 me-1"></i>{{ item.channel }}
                      </div>
                      <span class="badge bg-light text-secondary border mt-1" style="font-size: 0.68rem;">
                        {{ item.category }}
                      </span>
                    </div>
                  </div>
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class VideoTutorialComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly categories = ['Semua', 'RKAS & BOSP', 'Perpajakan', 'BOP', 'Edukasi Ekonomi'];
  readonly selectedCategory = signal('Semua');

  readonly videos: VideoTutorialItem[] = [
    {
      id: 'arkas-kk',
      videoId: '0KIlyTQpzh4',
      category: 'RKAS & BOSP',
      durationLabel: 'Resmi',
      channel: 'Sobat ARKAS Kemendikbud',
      title: 'Tutorial ARKAS 4 - Episode 3: Mengaktifkan Kertas Kerja (KK)',
      description: 'Panduan resmi Sobat ARKAS Kemendikbud mengenai pengaktifan dan penyusunan Kertas Kerja Rencana Kegiatan dan Anggaran Sekolah (RKAS) sebelum migrasi anggaran BOSP.'
    },
    {
      id: 'arkas-404',
      videoId: '0Ed9PWcBCmc',
      category: 'RKAS & BOSP',
      durationLabel: 'Panduan',
      channel: 'Jerry Riandy',
      title: 'Tutorial Cara Menggunakan Aplikasi ARKAS Versi Terbaru',
      description: 'Penjelasan praktis alur penggunaan aplikasi penganggaran dan penatausahaan dana BOSP sekolah dari tahap penyusunan hingga pelaporan.'
    },
    {
      id: 'pajak-bosp-bop',
      videoId: 'gNS_7xUSmwA',
      category: 'Perpajakan',
      durationLabel: 'Pajak',
      channel: 'abank703',
      title: 'Cara Bayar Pajak Dana BOSP / BOP untuk Bendahara Sekolah',
      description: 'Pembahasan teknis perhitungan pemotongan/pemungutan pajak (PPN, PPh 21/22/23) atas belanja dana BOSP dan BOP serta tata cara pembuatan kode billing dan penyetorannya.'
    },
    {
      id: 'bop-webinar',
      videoId: '_OrztX3k7gk',
      category: 'BOP',
      durationLabel: 'Webinar',
      channel: 'BPMP Kepri',
      title: 'Webinar Penggunaan ARKAS 4 untuk Pengelolaan Dana BOP',
      description: 'Sosialisasi dan pendampingan perencanaan, penatausahaan BKU, dan akuntabilitas pengelolaan Dana Bantuan Operasional Penyelenggaraan (BOP).'
    },
    {
      id: 'kok-bisa-ekonomi',
      videoId: '_44pe9_iu14',
      category: 'Edukasi Ekonomi',
      durationLabel: 'Edukasi',
      channel: 'Kok Bisa?',
      title: "Apa Itu Ilmu 'Ekonomi' Sebenarnya? #BelajardiRumah",
      description: 'Video animasi edukasi dari Kok Bisa? tentang konsep dasar ilmu ekonomi, pengelolaan sumber daya terbatas, dan pengambilan keputusan anggaran.'
    },
    {
      id: 'kok-bisa-uang',
      videoId: 'z5rgIeCg0FU',
      category: 'Edukasi Ekonomi',
      durationLabel: 'Edukasi',
      channel: 'Kok Bisa?',
      title: 'Bagaimana Uang Bisa Jadi Segalanya? - Literasi Keuangan',
      description: 'Konten edukasi populer mengenai sejarah uang, perputaran dana dalam perekonomian modern, serta pentingnya transparansi pencatatan kas.'
    }
  ];

  readonly activeVideo = signal<VideoTutorialItem>(this.videos[0]);
  readonly customVideoId = signal<string | null>(null);
  readonly customTitle = signal<string | null>(null);
  readonly urlError = signal('');
  customUrlInput = `https://www.youtube.com/watch?v=${this.videos[0].videoId}`;

  readonly filteredVideos = computed(() => {
    const cat = this.selectedCategory();
    return cat === 'Semua' ? this.videos : this.videos.filter((v) => v.category === cat);
  });

  readonly currentVideoId = computed(() => this.customVideoId() ?? this.activeVideo().videoId);
  readonly currentTitle = computed(() => this.customTitle() ?? this.activeVideo().title);
  readonly currentChannel = computed(() => (this.customVideoId() ? 'Custom YouTube WebView' : this.activeVideo().channel));
  readonly currentCategory = computed(() => (this.customVideoId() ? 'Tautan Kustom' : this.activeVideo().category));
  readonly currentDescription = computed(() =>
    this.customVideoId()
      ? 'Video diputar dari tautan YouTube kustom melalui WebView terintegrasi SIAP BOSP & BOP.'
      : this.activeVideo().description
  );

  readonly safeEmbedUrl = computed<SafeResourceUrl>(() => {
    const vid = this.currentVideoId();
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${vid}?rel=0&modestbranding=1`
    );
  });

  selectVideo(video: VideoTutorialItem): void {
    this.urlError.set('');
    this.customVideoId.set(null);
    this.customTitle.set(null);
    this.activeVideo.set(video);
    this.customUrlInput = `https://www.youtube.com/watch?v=${video.videoId}`;
  }

  loadCustomYoutube(): void {
    const raw = (this.customUrlInput || '').trim();
    const extracted = this.extractYoutubeId(raw);
    if (!extracted) {
      this.urlError.set('Tautan atau Video ID YouTube tidak valid. Gunakan format https://www.youtube.com/watch?v=XXXXXXXXXXX atau youtu.be/XXXXXXXXXXX.');
      return;
    }
    this.urlError.set('');
    const matched = this.videos.find((v) => v.videoId === extracted);
    if (matched) {
      this.selectVideo(matched);
      return;
    }
    this.customVideoId.set(extracted);
    this.customTitle.set(`Pemutaran Video YouTube (${extracted})`);
  }

  private extractYoutubeId(input: string): string | null {
    if (/^[A-Za-z0-9_-]{11}$/.test(input)) {
      return input;
    }
    const watchMatch = input.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (watchMatch) return watchMatch[1];
    const shortMatch = input.match(/(?:youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/);
    return shortMatch ? shortMatch[1] : null;
  }
}
