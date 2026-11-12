# SIAP BOS Dummy (SIAP BOSP & BOP) — Microservices (.NET 11 + Angular 22 + PostgreSQL 18)

Aplikasi **SIAP BOS** (*Sistem Informasi Akuntabilitas Pengelolaan Bantuan Operasional Satuan Pendidikan*) versi dummy *end-to-end* yang dibangun ulang berdasarkan arsitektur dan alur bisnis sistem produksi SIAP BOS Dinas Pendidikan Provinsi DKI Jakarta, menggunakan **Microservices Terpisah** dengan stack **Angular 22**, **.NET 11**, dan **PostgreSQL 18.4**.

---

## 1. SIAP BOS: Aplikasi Apa & Fungsinya Apa?

**SIAP BOS** adalah sistem penatausahaan, penganggaran kas, verifikasi belanja berjenjang, pemungutan/penyetoran pajak, pembayaran non-tunai (CMS), rekonsiliasi bank, dan pelaporan pertanggungjawaban dana bantuan operasional sekolah negeri:
1. **Dana BOSP Reguler (APBN)** — dikelola per **Tahap** (`01`, `02`), dengan fitur Setoran Sisa Kas / **STS**.
2. **Dana BOP Sekolah Negeri (APBD DKI Jakarta)** — dikelola per **Triwulan** (`TW1`–`TW4`), dilengkapi **NPD BOP + Integrasi SIPKD** dan **Koreksi BKU / Batal Transfer SPJ** oleh Suku Dinas.

### Fungsi Utama Aplikasi End-to-End
- **Otentikasi & RBAC Hierarkis**: Login terpusat berbasis NRK/Username + Captcha + Tahun Anggaran (`2024–2026`), serta matriks hak akses per role (`ADMIN-DINAS`, `SUDIN`, `PA-NEGERI`, `TU-NEGERI`, `PK-NEGERI`).
- **Konfirmasi Rekening & Dropping Dana**: Validasi nomor rekening giro Bank DKI & NPWP sekolah, lalu konfirmasi dana masuk **SP2D Dropping (`JO`)** ke Buku Kas Umum (BKU).
- **Input BKU & Belanja SPJ RKAS (`JO`, `JJ`, `JG`, `LL`, `ST`)**: Pencatatan belanja terikat ke komponen RKAS & Kode BAS, pengecekan Biller **VA PLN** / **e-Order/SIPLah**, upload lampiran PDF invoice, dan perhitungan otomatis pajak (**PPh 21, PPh 22, PPh 23, PPN**).
- **Persetujuan Berjenjang Sekolah & Sudin**: Bendahara (**PK**) mengajukan SPJ (`0 → 1`) → Kasubag **TU** memverifikasi (`1 → 2`) → Kepala Sekolah (**PA**) menyetujui (`2 → 3`) → opsional approval **Suku Dinas**.
- **Pembayaran Non-Tunai CMS Bank DKI & OTP PA**: Kepala Sekolah (PA) meminta token OTP, dilanjutkan simulasi transfer **Overbooking / SKN / RTGS / VA PLN / e-Order** yang otomatis mengurangi saldo kas bank sekolah dan mencatat mutasi debet rekening koran.
- **Perpajakan MPN G3 (Kode Billing & NTPN)**: Pembuatan Kode Billing DJP, Inquiry Tagihan, hingga Pelunasan Pajak terbit **NTPN & NTB** secara real-time.
- **Rekonsiliasi Bank, BAP Kas & Tutup Buku**: Sinkronisasi mutasi Bank DKI (`K` & `D`), hitung rincian fisik uang tunai / Berita Acara Pemeriksaan Kas (**BAP Kas**), approval PA/Dinas, serta **Tutup Buku** / Buka Buku periode.
- **Pelaporan Resmi PDF & Excel**: Cetak **Laporan BKU PDF**, **Laporan K1–K7 / Realisasi per SNP PDF**, **BAP Kas PDF**, **Rekapitulasi Pajak PDF**, dan **Export BKU Excel (`.xlsx`)**.
- **Integrasi Sistem Eksternal Dummy**: Bank DKI CMS & Inquiry Rekening, DJP MPN Pajak & NPWP, SIPKD BPKD (NPD BOP), serta SIMPEG DKI (Inquiry ASN by NRK) — seluruh komunikasi tercatat ke tabel `tiintegration_log`.

---

## 2. Arsitektur Microservices

```text
+-------------------------------------------------------------------------+
|   Angular 22 Frontend (siapbos-webapp-prod)   http://localhost:4200     |
|   Development Reverse Proxy: proxy.conf.json                            |
+----+-----------+-----------+---------------+-------------+--------------+
     |           |           |               |             |
     v /auth-server          v /api          v /api-bop    v /integration-server
+----+----+ +----+----+ +----+-----+ +-------+------+ +----+--------+ +----+---------+
| Auth    | | BOS API | | BOP API  | | Integration  | | Report      | | Uploader     |
| :5001   | | :5002   | | :5003    | | Gateway :5004| | :5005       | | :5006        |
+----+----+ +----+----+ +----+-----+ +-------+------+ +----+--------+ +----+---------+
     \           |           |               |             |               /
      +----------+-----------+---------------+-------------+--------------+
                                             |
                                             v
                      PostgreSQL 18.4 (localhost:5432 / siapbos_dummy_db)
                      Schemas: auth | oauth | siap (tanpa public & rkas)
```

| Service / Project | Port | Proxy Path di Frontend | Tanggung Jawab Utama |
|---|---|---|---|
| `siapbos-shared` | *(Library)* | — | EF Core Entities (`auth`, `oauth`, `siap`), `SiapBosDbContext`, `DbSeeder`, `BkuCoreService`, `BaseBkuController`, JWT Extensions |
| `siapbos-auth` | **5001** | `/auth-server/*` | OAuth2 Token (`oauth.access_token` & `oauth.history_access_token`) & Captcha, Master Sekolah/Periode/BAS/Pajak, CRUD Pengguna + Inquiry SIMPEG, Otoritas & Auto Seeder DB |
| `siapbos-api` | **5002** | `/api/*` | Core BKU BOSP APBN, Dashboard Summary, Dropping Admin Dinas, RKAS (`siap.tmrkasbljrinci`), Helpdesk (`siap.trhelpdesk_ticket`) |
| `siapbop-api` | **5003** | `/api-bop/*` | Core BKU BOP APBD, NPD BOP (+ auto SIPKD), Koreksi BKU & Batal Transfer SPJ |
| `siapbos-integration` | **5004** | `/integration-server/*` | Dummy External Gateway: Bank DKI (Inquiry Rekening, VA/Biller, Transfer CMS), DJP MPN (NPWP, Billing, NTPN), SIPKD, SIMPEG + Audit Log |
| `siapbos-report` | **5005** | `/report-server/*` | Generator Laporan Resmi PDF (`QuestPDF`) & Excel (`ClosedXML`) |
| `siapbos-uploader` | **5006** | `/uploader/*`, `/file-uploader/*` | Simulasi MinIO Upload/Preview PDF Invoice & Export/Import Template Excel RKAS |
| `siapbos-webapp-prod` | **4200** | — | Frontend **Angular 22.2.6** + Bootstrap 5 + Creative UI **`#FF9A00` Palette**, Logo Resmi `Logo.png` Jelas, Landing Page Ringkas, & **5 Menu Utama (`User Management`, `BKU BOSP Negeri`, `BKU BOP Negeri`, `Administrator`, `Help Desk`)** |

---

## 3. Prasyarat Environment

- **.NET SDK**: `11.0.100` (`dotnet --version`)
- **Node.js**: `26.13.0` (`node -v`) & `npm`
- **PostgreSQL**: `18.4` berjalan di `localhost:5432`
- **PowerShell**: Windows PowerShell 5.1 / PowerShell 7+

---

## 4. Cara Menjalankan Aplikasi

### Opsi A — Cara Cepat 1-Klik via PowerShell (`start-all.ps1`) **[Direkomendasikan]**

1. Buka PowerShell di root folder `D:\project_yosua\siap-bos-tes-user`.
2. Jalankan script launcher:
   ```powershell
   .\start-all.ps1
   ```
   *(Atau sertakan parameter password PostgreSQL Anda jika berbeda dari `postgres`:)*
   ```powershell
   .\start-all.ps1 -DbPassword "password_postgres_anda"
   ```
3. Script akan otomatis:
   - Memastikan `C:\Program Files\dotnet` terbaca di `PATH`.
   - Meneruskan string koneksi PostgreSQL melalui environment variable `SIAPBOS_DB_CONNECTION` (tanpa perlu mengubah file `appsettings.json` satu per satu).
   - Membangun `SiapBos.Microservices.slnx`.
   - Menjalankan `siapbos-auth (:5001)` terlebih dahulu agar **PostgreSQL database (`siapbos_dummy_db`), schema (`auth`, `public`, `siap`), tabel, dan data dummy** terbentuk & terisi otomatis melalui `DbSeeder`.
   - Menjalankan ke-5 microservice backend lainnya (`:5004`, `:5002`, `:5003`, `:5005`, `:5006`) dan melakukan cek `/health`.
   - Menjalankan Frontend Angular (`http://localhost:4200`) dengan proxy konfigurasi aktif dan membuka browser secara otomatis.
4. Untuk menghentikan seluruh backend dan frontend sekaligus:
   ```powershell
   .\stop-all.ps1
   ```
   *(Log output/error tiap service tersimpan di folder `.run-logs\`.)*

---

### Opsi B — Cara Manual per Terminal (Untuk Debug / Presentasi Kode)

> **Catatan Koneksi DB**: Pastikan password PostgreSQL lokal sesuai dengan `"DefaultConnection"` pada `appsettings.json` masing-masing service (default: `Host=localhost;Port=5432;Database=siapbos_dummy_db;Username=postgres;Password=postgres`), atau set environment variable di setiap terminal:
> ```powershell
> $env:SIAPBOS_DB_CONNECTION = "Host=localhost;Port=5432;Database=siapbos_dummy_db;Username=postgres;Password=PASSWORD_ANDA"
> ```

1. **Build Solution**:
   ```powershell
   $env:PATH = "C:\Program Files\dotnet;" + $env:PATH
   dotnet build SiapBos.Microservices.slnx
   ```
2. **Jalankan ke-6 Microservice Backend di Terminal Terpisah** (mulai dari `siapbos-auth` agar DB ter-seed terlebih dahulu):
   ```powershell
   # Terminal 1 (Port 5001 - wajib duluan agar DB siapbos_dummy_db terbentuk)
   dotnet run --project siapbos-auth

   # Terminal 2 (Port 5004 - Gateway Integrasi Eksternal)
   dotnet run --project siapbos-integration

   # Terminal 3 (Port 5002 - BOS APBN API)
   dotnet run --project siapbos-api

   # Terminal 4 (Port 5003 - BOP APBD API)
   dotnet run --project siapbop-api

   # Terminal 5 (Port 5005 - PDF & Excel Report Server)
   dotnet run --project siapbos-report

   # Terminal 6 (Port 5006 - MinIO & RKAS Excel Uploader)
   dotnet run --project siapbos-uploader
   ```
3. **Jalankan Frontend Angular 22 (Terminal 7)**:
   ```powershell
   cd siapbos-webapp-prod
   npm install
   npm start
   ```
4. Akses aplikasi di browser: **`http://localhost:4200`**

---

## 5. Akun Demo Login & 5 Menu Utama

Tersedia akun referensi utama **`ADMIN-TDI`** (Tahun Anggaran **`2025`**, Password **`MonaS123!`**) serta akun demo tiap peran (Password **`password123`**):

| Username / ID Login | Password | Tahun Default | Role (`RoleCode`) | Pemegang Peran | Unit Kerja |
|---|---|---|---|---|---|
| `ADMIN-TDI` | **`MonaS123!`** | `2025` / `2026` | `ADMIN-DINAS` (`ADM_TA`) | TDI ADMIN (Akses Penuh 5 Menu Utama) | Dinas Pendidikan Prov. DKI Jakarta |
| `bendahara.sman1` | `password123` | `2025` / `2026` | `PK-NEGERI` | Bendahara / Pemegang Kas | SMAN 1 Jakarta |
| `tu.sman1` | `password123` | `2025` / `2026` | `TU-NEGERI` | Kasubag Tata Usaha (Verifikator) | SMAN 1 Jakarta |
| `kepsek.sman1` | `password123` | `2025` / `2026` | `PA-NEGERI` | Kepala Sekolah (Pengguna Anggaran) | SMAN 1 Jakarta |
| `sudin.jp` | `password123` | `2025` / `2026` | `SUDIN` | Suku Dinas Pendidikan Wil. I Jakarta Pusat | Wilayah JP |
| `admin.dinas` | `password123` | `2025` / `2026` | `ADMIN-DINAS` | Administrator Dinas Pendidikan Provinsi DKI Jakarta | Dinas Provinsi |
| `bendahara.smpn115` | `password123` | `2025` / `2026` | `PK-NEGERI` | Bendahara Sekolah (Multi-Sekolah Demo) | SMPN 115 Jakarta |

### Daftar 5 Menu Utama & Sub-Menu (Sesuai Referensi `siapbosdev`)
1. **User Management (`UM`)**: `Pengguna`, `Otoritas`, `Aplikasi`, `Menu`, `Periode`, `Master Sekolah`, `Pajak`.
2. **BKU BOSP Negeri (`BOS`)**: 27 sub-menu lengkap (`Dashboard BKU BOSP`, `Dropping Dana BOSP`, `Konfirmasi Dropping Dana`, `Input BKU BOSP`, `Pengajuan Pembayaran BKU BOSP`, `Persetujuan Pembayaran BKU BOSP (TU)`, `Persetujuan Pembayaran BKU BOSP (PA)`, `Permohonan Token`, `Pembayaran BKU BOSP`, `Pembayaran Pajak BKU BOSP`, `Batal Transfer BKU BOSP`, `Setor Pendapatan Lain-Lain BOSP`, `Cetak Setor`, `Persetujuan Setoran`, `BAP KAS BOSP`, `Tutup BKU`, `Batal Tutup BKU`, `Mutasi 12 Transaksi BOSP`, `Mutasi Semua Transaksi BOSP`, `Laporan BKU BOSP`, `List BKU BOSP`, `Laporan Monitoring Dinas`, dll.).
3. **BKU BOP Negeri (`BOP`)**: 30 sub-menu lengkap (`Dashboard BKU BOP`, `Permohonan NPD`, `Pengajuan Permohonan NPD`, `Persetujuan NPD`, `Input BKU BOP`, `Pengajuan Pembayaran BKU BOP`, `Persetujuan Pembayaran BKU BOP`, `Permohonan Token`, `Pembayaran BKU BOP`, `Pembayaran Pajak`, `Batal Transfer BKU BOP`, `Persetujuan Batal Transfer BKU BOP`, `Cetak Setoran BOP`, `Persetujuan Setoran BOP`, `BAP KAS BOP`, `Batal Tutup BKU`, `Tutup BKU`, `Mutasi 12 Transaksi`, `Laporan BKU BOP`, `BAP Kas Approval (Sudin)`, `Input Setor Sisa Belanja`, `Batas Pengajuan Belanja`, `BAP KAS Approval (PA)`, `Laporan Monitoring Sudin`, `List BKU BOP`, dll.).
4. **Administrator (`ADMN`)**: `Batas Pengajuan Belanja`, `Help Desk Pembayaran BKU BOSP`, `Help Desk Pembayaran BKU BOP`, `Help Desk Virtual Account PLN`, `Migrasi RKAS`, `Dropping Dana BOS & BOP`, `Konfirmasi Saldo Rekening`.
5. **Help Desk (`HELP`)**: `User Manual`, `Help Desk`, `Video Tutorial`.

> **Tips Demo Cepat**: Pada header atas maupun halaman Persetujuan BKU / Pembayaran / NPD tersedia tombol **Quick Role Switcher (`PK` / `TU` / `PA` / `SUDIN` / `ADMIN`)** untuk memindahkan role aktif dalam 1 klik tanpa logout saat mendemokan alur persetujuan berjenjang!

---

## 6. Skenario Uji Coba End-to-End (Walkthrough Interview)

1. **Login & Portal Modul**: Masuk dengan `bendahara.sman1` (`password123`), lihat halaman portal modul SIAP BOS (`BKU BOSP Negeri`, `BKU BOP Negeri`, `Administrator Dinas`, `User Management`, `Konfirmasi Rekening`).
2. **Konfirmasi Rekening & Dropping Masuk (`JO`)**:
   - Buka **Konfirmasi Rekening Sekolah** → klik **Cek Rekening Bank DKI** & **Validasi NPWP DJP** → Konfirmasi.
   - Masuk ke **BKU BOSP Negeri → Konfirmasi Dropping Dana BOS** → konfirmasi SP2D tahap berjalan agar dana masuk sebagai transaksi `JO` dan saldo kas bertambah.
3. **Input Belanja SPJ (`JJ`) + Inquiry Rekening/NPWP + Upload PDF Invoice**:
   - Buka **Input BKU & SPJ BOSP** → tambah transaksi Belanja `JJ`, pilih komponen RKAS, tekan tombol **Inquiry Bank DKI**, **Inquiry NPWP**, upload bukti PDF melalui `:5006`, dan tambahkan pajak otomatis (**PPh 22 / PPN**).
4. **Workflow Approval Berjenjang (`0 → 1 → 2 → 3`)**:
   - Buka **Pengajuan & Persetujuan** → PK Ajukan (`0 → 1`), pindah role ke `TU-NEGERI` via Quick Switch → Setujui TU (`1 → 2`), pindah role ke `PA-NEGERI` → Setujui PA (`2 → 3`).
5. **Token OTP PA & Pembayaran CMS Bank DKI (`:5004`)**:
   - Buka **Token PA & Pembayaran CMS Bank DKI** → Request Token OTP PA → Eksekusi Transfer CMS → transaksi berubah menjadi **Lunas CMS Bank DKI (`5`)**, nomor jurnal Bank DKI tercatat, dan mutasi debet otomatis masuk ke **Mutasi Bank DKI**.
6. **Pajak MPN G3 (Billing → NTPN)**:
   - Buka **Pembayaran Pajak MPN** → **Buat Kode Billing DJP** → **Inquiry Billing** → **Bayar Pajak** → terbit nomor **NTPN & NTB** lunas.
7. **Alur Khusus BOP APBD (NPD → SIPKD & Koreksi BKU)**:
   - Buka **BKU BOP Negeri → NPD BOP & Integrasi SIPKD** → Buat Draft NPD → Ajukan PA → Approval PA → pindah role `SUDIN` → **Setuju Sudin & Kirim SIPKD** → otomatis menerbitkan nomor `SIPKD/NPD-BOP/...` dan Dropping BOP baru!
   - Uji juga **Koreksi BKU & Batal Transfer SPJ** oleh `SUDIN`.
8. **BAP Kas, Tutup Buku & Cetak Laporan Resmi PDF/Excel (`:5005`)**:
   - Buka **Mutasi Rekening, BAP Kas & Tutup Buku** → hitung rincian pecahan kas tunai vs saldo Bank DKI → simpan BAP Kas → Approve & Tutup Buku.
   - Buka **Cetak Laporan BKU & Monitoring** → download **Laporan BKU PDF**, **Laporan K1–K7 PDF**, **BAP Kas PDF**, **Rekap Pajak PDF**, dan **Excel BKU (`.xlsx`)**.
9. **Audit Log Integrasi & SIMPEG (`:5004`)**:
   - Switch ke `ADMIN-DINAS` → buka **User Management → Manajemen Pengguna**, ketik NRK (mis. `185432`) dan klik **Cek SIMPEG**.
   - Buka **Administrator → Log Integrasi & Helpdesk** tab **Live Audit Log Integrasi** untuk melihat jejak real-time seluruh komunikasi API ke `BANK_DKI`, `DJP_MPN`, `SIPKD`, dan `SIMPEG`.
10. **Public Transparency Portal (`/landingpage`) & Lupa Password OTP Demo**:
   - Saat belum login, `http://localhost:4200/landingpage` tampil sebagai **Portal Transparansi Publik SIAP BOSP & BOP** (terhubung ke endpoint live `/auth-server/api/public/landing-summary`), lengkap dengan tab interaktif **Berita**, **Peraturan Resmi**, dan **Sistem & Prosedur** serta *reader modal*.
   - Halaman **Login (`/login`)** memuat daftar tahun anggaran aktif secara dinamis dari PostgreSQL dan mendukung modal dual-tab **Ganti Password** serta **Lupa Password (OTP Demo NRK `123456`)**.

---

## 7. Pengujian Otomatis End-to-End (`test-e2e.ps1`)

Tersedia skrip pengujian fungsional lengkap [test-e2e.ps1](file:///d:/project_yosua/siap-bos-tes-user/test-e2e.ps1) yang menjalankan 43 skenario *end-to-end* terhadap seluruh 6 microservice `.NET 11`, PostgreSQL, dan proxy Angular (`http://localhost:4200`):

```powershell
# Menjalankan full suite (otomatis start semua service -> uji 43 skenario -> stop-all.ps1)
powershell -ExecutionPolicy Bypass -File .\test-e2e.ps1

# Atau jika seluruh server sudah berjalan:
powershell -ExecutionPolicy Bypass -File .\test-e2e.ps1 -NoManageServers
```

Cakupan uji meliputi: Public Transparency API, Captcha & JWT Login, Forgot Password OTP Demo, Quick Role Switch (`PK-NEGERI`, `TU-NEGERI`, `PA-NEGERI`, `SUDIN`, `ADMIN-DINAS`), Master & SIMPEG, Bank DKI & DJP NPWP Inquiry, Excel RKAS Template & Round-Trip Upload, MinIO PDF Upload/Preview, Dropping BOS (`JO`), BKU SPJ (`JJ` + tolakan TU + Approval `0→1→2→3→4` + Transfer CMS + MPN Pajak `Create→Reset→Inquiry→Payment`), BAP Kas, Tutup Buku/Batal Tutup Buku, Setoran STS, NPD BOP + SIPKD, Koreksi Akun & Batal Transfer BOP, Helpdesk, serta verifikasi tanda tangan biner seluruh **9 laporan PDF & 2 Excel**.
