param(
    [string]$BaseUrl = "http://localhost:4200",
    [string]$DbPassword = "postgres",
    [switch]$NoManageServers
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Add-Type -AssemblyName System.Net.Http

$script:Passed = 0
$script:Failed = 0
$script:Failures = New-Object System.Collections.Generic.List[string]
$script:HttpClient = [System.Net.Http.HttpClient]::new()
$script:HttpClient.Timeout = [TimeSpan]::FromSeconds(45)
$script:AuthToken = ""

function Invoke-Api {
    param(
        [Parameter(Mandatory)][string]$Method,
        [Parameter(Mandatory)][string]$Path,
        [object]$Body = $null,
        [string]$Token = $script:AuthToken
    )
    $uri = if ($Path.StartsWith("http")) { $Path } else { "$BaseUrl$Path" }
    $req = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), $uri)
    if (-not [string]::IsNullOrWhiteSpace($Token)) {
        $req.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $Token)
    }
    if ($null -ne $Body) {
        $json = $Body | ConvertTo-Json -Depth 12 -Compress
        $req.Content = [System.Net.Http.StringContent]::new($json, [System.Text.Encoding]::UTF8, "application/json")
    }
    $resp = $script:HttpClient.SendAsync($req).GetAwaiter().GetResult()
    $raw = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $parsed = $null
    if (-not [string]::IsNullOrWhiteSpace($raw)) {
        try { $parsed = $raw | ConvertFrom-Json } catch { $parsed = $null }
    }
    return [PSCustomObject]@{
        StatusCode = [int]$resp.StatusCode
        Raw        = $raw
        Json       = $parsed
        Bytes      = $null
    }
}

function Invoke-ApiBytes {
    param(
        [Parameter(Mandatory)][string]$Path,
        [string]$Token = $script:AuthToken
    )
    $uri = if ($Path.StartsWith("http")) { $Path } else { "$BaseUrl$Path" }
    $req = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $uri)
    if (-not [string]::IsNullOrWhiteSpace($Token)) {
        $req.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $Token)
    }
    $resp = $script:HttpClient.SendAsync($req).GetAwaiter().GetResult()
    $bytes = $resp.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
    $ct = if ($resp.Content.Headers.ContentType) { $resp.Content.Headers.ContentType.MediaType } else { "" }
    return [PSCustomObject]@{
        StatusCode  = [int]$resp.StatusCode
        ContentType = $ct
        Bytes       = $bytes
    }
}

function Invoke-UploadFile {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][byte[]]$FileBytes,
        [Parameter(Mandatory)][string]$FileName,
        [string]$ContentType = "application/octet-stream",
        [string]$Token = $script:AuthToken
    )
    $uri = "$BaseUrl$Path"
    $mp = [System.Net.Http.MultipartFormDataContent]::new()
    $fc = [System.Net.Http.ByteArrayContent]::new($FileBytes)
    $fc.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse($ContentType)
    $mp.Add($fc, "file", $FileName)

    $req = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, $uri)
    if (-not [string]::IsNullOrWhiteSpace($Token)) {
        $req.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $Token)
    }
    $req.Content = $mp
    $resp = $script:HttpClient.SendAsync($req).GetAwaiter().GetResult()
    $raw = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $parsed = $null
    if (-not [string]::IsNullOrWhiteSpace($raw)) {
        try { $parsed = $raw | ConvertFrom-Json } catch { $parsed = $null }
    }
    return [PSCustomObject]@{
        StatusCode = [int]$resp.StatusCode
        Raw        = $raw
        Json       = $parsed
    }
}

function Assert-Step {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][scriptblock]$Test
    )
    try {
        & $Test
        $script:Passed++
        Write-Host "  [PASS] $Name" -ForegroundColor Green
    } catch {
        $script:Failed++
        $msg = $_.Exception.Message
        $script:Failures.Add("$Name -> $msg")
        Write-Host "  [FAIL] $Name :: $msg" -ForegroundColor Red
    }
}

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

function Wait-UntilUp([string]$Url, [string]$Label, [int]$TimeoutSec = 90) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) {
                Write-Host "  [READY] $Label ($Url)" -ForegroundColor Cyan
                return
            }
        } catch {
            Start-Sleep -Milliseconds 750
        }
    }
    throw "Timeout menunggu $Label di $Url"
}

Write-Host "================================================================" -ForegroundColor Yellow
Write-Host "  SIAP BOS (BOSP & BOP) - End-to-End Automated Functional Suite" -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Yellow

$startedHere = $false
try {
    if (-not $NoManageServers) {
        Write-Host "`n[*] Menjalankan seluruh microservices & Angular via start-all.ps1..." -ForegroundColor Cyan
        & (Join-Path $RootDir "start-all.ps1") -DbPassword $DbPassword -SkipBuild -NoBrowser
        $startedHere = $true
    }

    Write-Host "`n[*] Verifikasi ketersediaan Frontend & Proxy API Gateway..." -ForegroundColor Cyan
    Wait-UntilUp "http://localhost:5001/health" "siapbos-auth" 45
    Wait-UntilUp "http://localhost:5002/health" "siapbos-api" 45
    Wait-UntilUp "http://localhost:5003/health" "siapbop-api" 45
    Wait-UntilUp "http://localhost:5004/health" "siapbos-integration" 45
    Wait-UntilUp "http://localhost:5005/health" "siapbos-report" 45
    Wait-UntilUp "http://localhost:5006/health" "siapbos-uploader" 45
    Wait-UntilUp "$BaseUrl/auth-server/api/public/tahun-anggaran" "Angular Proxy (:4200 -> :5001)" 90

    # ============================================================
    # 1. PUBLIC ENDPOINTS, CAPTCHA, AUTH & PASSWORD DEMO FLOW
    # ============================================================
    Write-Host "`n[1/9] Public Portal, Captcha, JWT Login & Lupa/Ganti Password" -ForegroundColor Cyan

    Assert-Step "GET /auth-server/api/public/tahun-anggaran" {
        $r = Invoke-Api "GET" "/auth-server/api/public/tahun-anggaran"
        Assert-True ($r.StatusCode -eq 200 -and $r.Json.success) "HTTP $($r.StatusCode): $($r.Raw)"
        Assert-True ($r.Json.data.Count -ge 1) "List tahun anggaran kosong"
    }

    Assert-Step "GET /auth-server/api/public/landing-summary" {
        $r = Invoke-Api "GET" "/auth-server/api/public/landing-summary"
        Assert-True ($r.StatusCode -eq 200 -and $r.Json.success) "HTTP $($r.StatusCode): $($r.Raw)"
        Assert-True ($r.Json.data.berita.Count -ge 3) "Data berita publik tidak lengkap"
        Assert-True ($r.Json.data.peraturan.Count -ge 3) "Data peraturan publik tidak lengkap"
        Assert-True ($r.Json.data.prosedur.Count -ge 3) "Data prosedur publik tidak lengkap"
    }

    function Invoke-LoginRole([string]$Username, [string]$Password, [int]$Tahun = 2026) {
        $cap = (Invoke-Api "GET" "/auth-server/oauth/captcha" -Token "").Json.data
        return Invoke-Api "POST" "/auth-server/oauth/token" @{
            username = $Username; password = $Password; tahunAnggaran = $Tahun
            captchaInput = $cap.captchaCode; captchaToken = $cap.captchaToken; skipCaptchaDemo = $false
        } -Token ""
    }

    Assert-Step "Removed demo-accounts & quick-switch endpoints return 404" {
        $r1 = Invoke-Api "GET" "/auth-server/api/auth/demo-accounts" -Token ""
        $r2 = Invoke-Api "POST" "/auth-server/api/auth/quick-switch" @{ roleCode = "PK-NEGERI" } -Token ""
        Assert-True ($r1.StatusCode -eq 404 -or $r1.StatusCode -eq 405) "demo-accounts masih ada ($($r1.StatusCode))"
        Assert-True ($r2.StatusCode -eq 404 -or $r2.StatusCode -eq 405) "quick-switch masih ada ($($r2.StatusCode))"
    }

    Assert-Step "POST /auth-server/oauth/token (Negative: wrong captcha)" {
        $cap = (Invoke-Api "GET" "/auth-server/oauth/captcha").Json.data
        $r = Invoke-Api "POST" "/auth-server/oauth/token" @{
            username = "bendahara.sman1"; password = "password123"; tahunAnggaran = 2026
            captchaInput = "WRONGC"; captchaToken = $cap.captchaToken; skipCaptchaDemo = $false
        }
        Assert-True ($r.StatusCode -ge 400 -or -not $r.Json.success) "Seharusnya gagal saat captcha salah"
    }

    Assert-Step "POST /auth-server/oauth/token (Negative: wrong password)" {
        $cap = (Invoke-Api "GET" "/auth-server/oauth/captcha").Json.data
        $r = Invoke-Api "POST" "/auth-server/oauth/token" @{
            username = "bendahara.sman1"; password = "wrongpassword"; tahunAnggaran = 2026
            captchaInput = $cap.captchaCode; captchaToken = $cap.captchaToken; skipCaptchaDemo = $false
        }
        Assert-True ($r.StatusCode -eq 401 -or $r.StatusCode -eq 400) "Seharusnya ditolak (actual: $($r.StatusCode))"
    }

    $adminToken = ""
    $pkToken = ""
    $tuToken = ""
    $paToken = ""
    $sudinToken = ""
    $dinasToken = ""
    Assert-Step "RBAC Login Verification: 6 DB Roles & Zero Section II Eliminated Menus" {
        $eliminatedNames = @(
            "Setor Pendapatan Lain-Lain BOSP", "Cetak Setor", "BAP KAS BOSP",
            "Pengajuan dan Persetujuan Pendapatan Lain-Lain", "Koreksi Periode Sebelum BOSP", "Koreksi Tahun Lalu",
            "Cetak Setoran BOP", "BAP KAS BOP", "Input Setor Sisa Belanja",
            "Pengajuan & Persetujuan Pendapatan Lain-Lain BOP", "Koreksi Periode Sebelum BOP"
        )

        # 1. ADMIN-TDI (Tahun 2025 -> 5 Main Modules + requiresSchoolPicker)
        $rAdm = Invoke-LoginRole "ADMIN-TDI" "MonaS123!" 2025
        Assert-True ($rAdm.StatusCode -eq 200 -and $rAdm.Json.success) "Login ADMIN-TDI gagal: $($rAdm.Raw)"
        $script:adminToken = $rAdm.Json.data.accessToken
        Assert-True ($rAdm.Json.data.user.requiresSchoolPicker -eq $true) "ADMIN-TDI wajib requiresSchoolPicker=true"
        $admMods = @($rAdm.Json.data.listAplikasi)
        Assert-True ($admMods.Count -eq 5) "Jumlah Menu Utama ADMIN-TDI harus 5 (actual: $($admMods.Count))"
        $admMenuNames = $admMods | ForEach-Object { $_.menu } | ForEach-Object { $_.nama }
        foreach ($dead in $eliminatedNames) {
            Assert-True ($admMenuNames -notcontains $dead) "Menu tereliminasi '$dead' masih ditemukan di DB!"
        }

        # 2. PK-NEGERI (bendahara.sman1 -> BOS 12, BOP 13, HELP 3 + single-school isolation + 403 UM)
        $rPk = Invoke-LoginRole "bendahara.sman1" "password123" 2026
        Assert-True ($rPk.StatusCode -eq 200 -and $rPk.Json.success) "Login PK-NEGERI gagal: $($rPk.Raw)"
        $script:pkToken = $rPk.Json.data.accessToken
        $pkMods = @($rPk.Json.data.listAplikasi)
        Assert-True ((($pkMods | ForEach-Object { $_.kodeAplikasi }) -join ",") -eq "BOS,BOP,HELP") "Modul PK-NEGERI salah"
        Assert-True (($pkMods | Where-Object { $_.kodeAplikasi -eq "BOS" }).menu.Count -eq 12) "Sub-menu BOS PK-NEGERI harus 12"
        Assert-True (($pkMods | Where-Object { $_.kodeAplikasi -eq "BOP" }).menu.Count -eq 13) "Sub-menu BOP PK-NEGERI harus 13"
        Assert-True (($pkMods | Where-Object { $_.kodeAplikasi -eq "HELP" }).menu.Count -eq 3) "Sub-menu HELP PK-NEGERI harus 3"
        $rPkPengguna = Invoke-Api "GET" "/auth-server/api/pengguna" -Token $rPk.Json.data.accessToken
        Assert-True ($rPkPengguna.StatusCode -eq 403) "PK-NEGERI harus ditolak (403) saat akses /api/pengguna"
        $rPkSek = Invoke-Api "GET" "/auth-server/api/master/sekolah" -Token $rPk.Json.data.accessToken
        Assert-True ($rPkSek.Json.data.Count -eq 1) "PK-NEGERI harus terisolasi hanya 1 sekolah"
        $rPkOtherSek = Invoke-Api "GET" "/auth-server/api/master/sekolah/2" -Token $rPk.Json.data.accessToken
        Assert-True ($rPkOtherSek.StatusCode -eq 403) "PK-NEGERI harus ditolak (403) akses sekolah lain"

        # 3. TU-NEGERI (tu.sman1)
        $rTu = Invoke-LoginRole "tu.sman1" "password123" 2026
        Assert-True ($rTu.StatusCode -eq 200 -and $rTu.Json.success) "Login TU-NEGERI gagal"
        $script:tuToken = $rTu.Json.data.accessToken
        $tuMods = @($rTu.Json.data.listAplikasi)
        Assert-True ((($tuMods | ForEach-Object { $_.kodeAplikasi }) -join ",") -eq "BOS,BOP,HELP") "Modul TU-NEGERI salah"

        # 4. PA-NEGERI (kepsek.sman1)
        $rPa = Invoke-LoginRole "kepsek.sman1" "password123" 2026
        Assert-True ($rPa.StatusCode -eq 200 -and $rPa.Json.success) "Login PA-NEGERI gagal"
        $script:paToken = $rPa.Json.data.accessToken
        $paMenus = @($rPa.Json.data.listAplikasi) | ForEach-Object { $_.menu } | ForEach-Object { $_.nama }
        Assert-True ($paMenus -contains "Permohonan Token" -and $paMenus -contains "Persetujuan NPD") "Menu PA-NEGERI kurang"

        # 5. SUDIN (sudin.jp -> BOP, ADMN, HELP; NO BOS, NO UM)
        $rSdn = Invoke-LoginRole "sudin.jp" "password123" 2026
        Assert-True ($rSdn.StatusCode -eq 200 -and $rSdn.Json.success) "Login SUDIN gagal"
        $script:sudinToken = $rSdn.Json.data.accessToken
        $sdnCodes = ($rSdn.Json.data.listAplikasi | ForEach-Object { $_.kodeAplikasi }) -join ","
        Assert-True ($sdnCodes -eq "BOP,ADMN,HELP") "Modul SUDIN harus BOP,ADMN,HELP (actual: $sdnCodes)"

        # 6. ADMIN-DINAS (admin.dinas -> BOS, ADMN, HELP; NO BOP, NO UM)
        $rDns = Invoke-LoginRole "admin.dinas" "password123" 2026
        Assert-True ($rDns.StatusCode -eq 200 -and $rDns.Json.success) "Login ADMIN-DINAS gagal"
        $script:dinasToken = $rDns.Json.data.accessToken
        $dnsCodes = ($rDns.Json.data.listAplikasi | ForEach-Object { $_.kodeAplikasi }) -join ","
        Assert-True ($dnsCodes -eq "BOS,ADMN,HELP") "Modul ADMIN-DINAS harus BOS,ADMN,HELP (actual: $dnsCodes)"
    }

    $userProfile = $null
    Assert-Step "POST /auth-server/oauth/token (Valid Login bendahara.sman1 + real captcha)" {
        $r = Invoke-LoginRole "bendahara.sman1" "password123" 2026
        Assert-True ($r.StatusCode -eq 200 -and $r.Json.success) "Login gagal: $($r.Raw)"
        $script:AuthToken = $r.Json.data.accessToken
        $script:userProfile = $r.Json.data.user
        Assert-True (-not [string]::IsNullOrWhiteSpace($script:AuthToken)) "AccessToken kosong"
    }

    Assert-Step "GET /auth-server/api/auth/me (Authenticated Session Check)" {
        $r = Invoke-Api "GET" "/auth-server/api/auth/me?tahunAnggaran=2026"
        Assert-True ($r.StatusCode -eq 200 -and $r.Json.success) "HTTP $($r.StatusCode): $($r.Raw)"
        Assert-True ($r.Json.data.user.username -eq "bendahara.sman1") "Username tidak sesuai"
    }

    Assert-Step "Forgot Password OTP Demo + Login Baru + Restore Password Awal" {
        $r1 = Invoke-Api "POST" "/auth-server/api/auth/forgot-password-demo" @{
            identifier = "bendahara.sman1"; otpDemo = "123456"; sandiBaru = "baru12345"
        }
        Assert-True ($r1.StatusCode -eq 200 -and $r1.Json.success) "Forgot password gagal: $($r1.Raw)"

        $rLoginNew = Invoke-LoginRole "bendahara.sman1" "baru12345" 2026
        Assert-True ($rLoginNew.StatusCode -eq 200 -and $rLoginNew.Json.success) "Login password baru gagal"

        $rRestore = Invoke-Api "POST" "/auth-server/api/auth/change-password" @{
            nrk = "bendahara.sman1"; sandiLama = "baru12345"; sandiBaru = "password123"
        }
        Assert-True ($rRestore.StatusCode -eq 200 -and $rRestore.Json.success) "Restore password gagal: $($rRestore.Raw)"
    }

    # ============================================================
    # 2. MASTER DATA, PENGGUNA, SIMPEG & EXTERNAL INTEGRATIONS
    # ============================================================
    Write-Host "`n[2/9] Master Data, Pengguna, SIMPEG, Bank DKI & DJP NPWP" -ForegroundColor Cyan

    Assert-Step "Master Endpoints (/sekolah, /periode, /bas, /pajak, /wilayah)" {
        foreach ($ep in @("/auth-server/api/master/sekolah", "/auth-server/api/master/periode?tahun=2026", "/auth-server/api/master/bas", "/auth-server/api/master/pajak", "/auth-server/api/master/wilayah")) {
            $r = Invoke-Api "GET" $ep -Token $script:adminToken
            Assert-True ($r.StatusCode -eq 200 -and $r.Json.success) "$ep gagal ($($r.StatusCode))"
        }
    }

    Assert-Step "PUT /auth-server/api/master/periode/{id}/batas-pengajuan" {
        $periodes = (Invoke-Api "GET" "/auth-server/api/master/periode?tahun=2026" -Token $script:adminToken).Json.data
        $p1 = $periodes[0]
        $r = Invoke-Api "PUT" "/auth-server/api/master/periode/$($p1.id)/batas-pengajuan" @{
            batasPengajuanBelanja = "2026-12-31T00:00:00Z"; isActive = $true
        } -Token $script:adminToken
        Assert-True ($r.StatusCode -eq 200 -and $r.Json.success) "Update batas gagal: $($r.Raw)"
    }

    Assert-Step "User Management Full RBAC Workflow (ADMIN-TDI): Pengguna, Lock, Otoritas, Sekolah, Wilayah, Aplikasi & Menu" {
        $rSimpeg = Invoke-Api "GET" "/auth-server/api/pengguna/cek-simpeg/190101" -Token $script:adminToken
        Assert-True ($rSimpeg.StatusCode -eq 200 -and $rSimpeg.Json.success) "SIMPEG inquiry gagal: $($rSimpeg.Raw)"

        $stamp = Get-Date -Format "HHmmssff"
        $rCreateUser = Invoke-Api "POST" "/auth-server/api/pengguna" @{
            username = "e2e_$stamp"; password = "password123"; namaLengkap = "Pengguna E2E $stamp"
            nrk = "99$stamp".Substring(0,6); nip = "199001012020011001"; nik = "3171010101900001"
            email = "e2e_$stamp@jakarta.go.id"; noHp = "081200000001"; roleCode = "PK-NEGERI"
            jabatan = "Bendahara Penguji E2E"; wilayahSudin = "JP"; sekolahId = 1; isActive = $true
        } -Token $script:adminToken
        Assert-True ($rCreateUser.StatusCode -eq 200 -and $rCreateUser.Json.success) "Create user gagal: $($rCreateUser.Raw)"
        $newUid = $rCreateUser.Json.data.id

        # Lock -> Unlock -> Reset Password -> Kelola Otoritas/Sekolah/Wilayah -> Delete
        $rLock = Invoke-Api "PUT" "/auth-server/api/pengguna/set-lock" @{ userIds = @($newUid); flag = $true } -Token $script:adminToken
        Assert-True ($rLock.StatusCode -eq 200 -and $rLock.Json.success) "Set lock gagal"
        $rLockedLogin = Invoke-LoginRole "e2e_$stamp" "password123" 2026
        Assert-True ($rLockedLogin.StatusCode -eq 401 -or -not $rLockedLogin.Json.success) "User terkunci seharusnya ditolak login"

        $rUnlock = Invoke-Api "PUT" "/auth-server/api/pengguna/set-lock" @{ userIds = @($newUid); flag = $false } -Token $script:adminToken
        Assert-True ($rUnlock.StatusCode -eq 200 -and $rUnlock.Json.success) "Unlock gagal"

        $rPwd = Invoke-Api "PUT" "/auth-server/api/pengguna/$newUid/reset-password" @{ sandiBaru = "baruE2e99" } -Token $script:adminToken
        Assert-True ($rPwd.StatusCode -eq 200 -and $rPwd.Json.success) "Reset password gagal"

        $roles = (Invoke-Api "GET" "/auth-server/api/otoritas" -Token $script:adminToken).Json.data
        Assert-True ($roles.Count -eq 6) "Master Otoritas harus tepat 6 role (actual: $($roles.Count))"
        $tuRole = ($roles | Where-Object { $_.roleCode -eq "TU-NEGERI" })[0]
        $rSetOtor = Invoke-Api "PUT" "/auth-server/api/pengguna/$newUid/otoritas" @{ roleIds = @([int]$tuRole.id) } -Token $script:adminToken
        Assert-True ($rSetOtor.StatusCode -eq 200 -and $rSetOtor.Json.success) "Simpan otoritas gagal"

        $rSetSek = Invoke-Api "PUT" "/auth-server/api/pengguna/$newUid/sekolah" @{ sekolahIds = @(1) } -Token $script:adminToken
        Assert-True ($rSetSek.StatusCode -eq 200 -and $rSetSek.Json.success) "Simpan sekolah gagal"

        $rSetWil = Invoke-Api "PUT" "/auth-server/api/pengguna/$newUid/wilayah" @{ kodeWilayahList = @("JP") } -Token $script:adminToken
        Assert-True ($rSetWil.StatusCode -eq 200 -and $rSetWil.Json.success) "Simpan wilayah gagal"

        $rDel = Invoke-Api "DELETE" "/auth-server/api/pengguna/$newUid" -Token $script:adminToken
        Assert-True ($rDel.StatusCode -eq 200 -and $rDel.Json.success) "Hapus user E2E gagal"

        # Otoritas CRUD & Kelola Aplikasi/Menu roundtrip
        $rNewRole = Invoke-Api "POST" "/auth-server/api/otoritas" @{
            roleCode = "ROLE-E2E"; shortCode = "E2E"; roleName = "Role Uji E2E"
            deskripsi = "Role sementara pengujian RBAC"; level = "SEKOLAH"; isActive = $true
        } -Token $script:adminToken
        Assert-True ($rNewRole.StatusCode -eq 200 -and $rNewRole.Json.success) "Create otoritas gagal"
        $roleIdE2e = $rNewRole.Json.data.id

        $apps = (Invoke-Api "GET" "/auth-server/api/aplikasi" -Token $script:adminToken).Json.data
        $helpMod = ($apps | Where-Object { $_.kodeAplikasi -eq "HELP" })[0]
        $rSaveApp = Invoke-Api "PUT" "/auth-server/api/otoritas/$roleIdE2e/aplikasi" @{ moduleIds = @([int]$helpMod.id) } -Token $script:adminToken
        Assert-True ($rSaveApp.StatusCode -eq 200 -and $rSaveApp.Json.success) "Save otoritas aplikasi gagal"

        $menuMat = (Invoke-Api "GET" "/auth-server/api/otoritas/$roleIdE2e/menu?kodeAplikasi=HELP" -Token $script:adminToken).Json.data
        $menuIds = @($menuMat.available | ForEach-Object { [int]$_.id })
        $rSaveMn = Invoke-Api "PUT" "/auth-server/api/otoritas/$roleIdE2e/menu" @{ kodeAplikasi = "HELP"; menuIds = $menuIds } -Token $script:adminToken
        Assert-True ($rSaveMn.StatusCode -eq 200 -and $rSaveMn.Json.success) "Save otoritas menu gagal"

        $rDelRole = Invoke-Api "DELETE" "/auth-server/api/otoritas/$roleIdE2e" -Token $script:adminToken
        Assert-True ($rDelRole.StatusCode -eq 200 -and $rDelRole.Json.success) "Cleanup otoritas E2E gagal"
    }

    Assert-Step "POST /api/sekolah/1/konfirmasi-rekening" {
        $sec = (Invoke-Api "GET" "/auth-server/api/master/sekolah/1").Json.data
        $r = Invoke-Api "POST" "/api/sekolah/1/konfirmasi-rekening" @{
            noRekBos = $sec.noRekBos; namaRekBos = $sec.namaRekBos
            noRekBop = $sec.noRekBop; namaRekBop = $sec.namaRekBop
            npwpSekolah = $sec.npwpSekolah
        }
        Assert-True ($r.StatusCode -eq 200 -and $r.Json.success -and $r.Json.data.isRekeningConfirmed) "Konfirmasi rekening gagal: $($r.Raw)"
    }

    Assert-Step "Integration: Bank DKI Check Rekening (Valid & Dormant) & Biller (VA_PLN, E_ORDER)" {
        $rValid = Invoke-Api "POST" "/integration-server/api/bank-dki/inquiryCheckRek" @{ kodeBank = "111"; noRekening = "1110099887766" }
        Assert-True ($rValid.StatusCode -eq 200 -and $rValid.Json.data.responseCode -eq "00") "Bank DKI valid rek gagal: $($rValid.Raw)"

        $rDormant = Invoke-Api "POST" "/integration-server/api/bank-dki/inquiryCheckRek" @{ kodeBank = "111"; noRekening = "999888777" }
        Assert-True ($rDormant.StatusCode -eq 200 -and $rDormant.Json.data.responseCode -eq "14") "Bank DKI dormant check gagal"

        $rPln = Invoke-Api "POST" "/integration-server/api/bank-dki/biller-inquiry" @{ jenisBiller = "VA_PLN"; nomorTagihan = "541100012345" }
        Assert-True ($rPln.StatusCode -eq 200 -and $rPln.Json.data.nominalTagihan -gt 0) "VA PLN biller gagal"

        $rEord = Invoke-Api "POST" "/integration-server/api/bank-dki/biller-inquiry" @{ jenisBiller = "E_ORDER"; nomorTagihan = "ORD-2026-009" }
        Assert-True ($rEord.StatusCode -eq 200 -and $rEord.Json.data.nominalTagihan -gt 0) "e-Order biller gagal"
    }

    Assert-Step "Integration: DJP NPWP Inquiry (Valid & Invalid) + Audit Logs" {
        $rNpwp = Invoke-Api "GET" "/integration-server/api/npwp/byNomorNpwp?nomorNpwp=01.345.678.9-022.000"
        Assert-True ($rNpwp.StatusCode -eq 200 -and $rNpwp.Json.data.responseCode -eq "00") "NPWP valid gagal (HTTP $($rNpwp.StatusCode)): $($rNpwp.Raw)"

        $rNpwpBad = Invoke-Api "GET" "/integration-server/api/npwp/byNomorNpwp?nomorNpwp=999111222333444"
        Assert-True ($rNpwpBad.StatusCode -eq 200 -and $rNpwpBad.Json.data.responseCode -eq "14") "NPWP invalid gagal"

        $rLogs = Invoke-Api "GET" "/integration-server/api/integration/logs"
        Assert-True ($rLogs.StatusCode -eq 200 -and $rLogs.Json.data.Count -ge 1) "Audit logs kosong"
    }

    # ============================================================
    # 3. UPLOADER (TEMPLATE RKAS, EXCEL UPLOAD, MINIO PDF UPLOAD)
    # ============================================================
    Write-Host "`n[3/9] Uploader Microservice: Excel RKAS & MinIO PDF Storage" -ForegroundColor Cyan

    $templateBytes = $null
    Assert-Step "GET /file-uploader/api/file-uploader/template-rkas (Verify XLSX signature)" {
        $b = Invoke-ApiBytes "/file-uploader/api/file-uploader/template-rkas"
        Assert-True ($b.StatusCode -eq 200 -and $b.Bytes.Length -gt 1000) "Template size invalid"
        Assert-True ($b.Bytes[0] -eq 0x50 -and $b.Bytes[1] -eq 0x4B) "Bukan file XLSX (PK header tidak cocok)"
        $script:templateBytes = $b.Bytes
    }

    Assert-Step "POST /file-uploader/api/file-uploader/upload-rkas (Excel Round-Trip)" {
        $r = Invoke-UploadFile "/file-uploader/api/file-uploader/upload-rkas" $script:templateBytes "Template_E2E.xlsx" "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        Assert-True ($r.StatusCode -eq 200 -and $r.Json.success) "Upload RKAS Excel gagal: $($r.Raw)"
    }

    $uploadedFileName = ""
    Assert-Step "POST & GET /uploader/api/v1/minio/upload & /preview (PDF Upload)" {
        $pdfSample = [System.Text.Encoding]::ASCII.GetBytes("%PDF-1.4`n1 0 obj<<>>endobj`ntrailer<<>>`n%%EOF")
        $r = Invoke-UploadFile "/uploader/api/v1/minio/upload" $pdfSample "kwitansi_e2e.pdf" "application/pdf"
        Assert-True ($r.StatusCode -eq 200 -and $r.Json.success) "MinIO upload gagal: $($r.Raw)"
        $script:uploadedFileName = $r.Json.data.storedName

        $p = Invoke-ApiBytes "/uploader/api/v1/minio/preview/$($script:uploadedFileName)"
        Assert-True ($p.StatusCode -eq 200 -and $p.Bytes.Length -gt 20) "Preview uploaded file gagal"

        $pSample = Invoke-ApiBytes "/uploader/api/v1/minio/preview/sample-invoice-e2e.pdf"
        Assert-True ($pSample.StatusCode -eq 200 -and [System.Text.Encoding]::ASCII.GetString($pSample.Bytes[0..3]) -eq "%PDF") "Sample invoice PDF invalid"
    }

    # ============================================================
    # 4. ADMIN DROPPING & KONFIRMASI DROPPING BOS (JO) + RKAS
    # ============================================================
    Write-Host "`n[4/9] Admin Dropping -> Konfirmasi Dropping BOS (JO) & RKAS BOS/BOP" -ForegroundColor Cyan

    Assert-Step "Admin Create Dropping BOS Rp 10.000.000 -> Bendahara Confirm JO (Saldo bertambah)" {
        $saldoBefore = (Invoke-Api "GET" "/auth-server/api/master/sekolah/1").Json.data.saldoBos

        $rDrop = Invoke-Api "POST" "/api/admin/dropping" @{
            sekolahId = 1; tahunAnggaran = 2026; sumberDana = "BOS"; kodePeriode = "02"
            namaPeriode = "Tahap 2 E2E"; nilaiDropping = 10000000; keterangan = "Dropping Uji E2E BOS"
        } -Token $script:adminToken
        Assert-True ($rDrop.StatusCode -eq 200 -and $rDrop.Json.success) "Create dropping gagal: $($rDrop.Raw)"
        $droppingId = $rDrop.Json.data.id

        $rConf = Invoke-Api "POST" "/api/konfirmasi-dana/$droppingId/confirm"
        Assert-True ($rConf.StatusCode -eq 200 -and $rConf.Json.success) "Konfirmasi dana gagal: $($rConf.Raw)"

        $saldoAfter = (Invoke-Api "GET" "/auth-server/api/master/sekolah/1").Json.data.saldoBos
        Assert-True (($saldoAfter - $saldoBefore) -eq 10000000) "Saldo BOS tidak bertambah Rp 10.000.000 ($saldoBefore -> $saldoAfter)"
    }

    $e2eRkasBosId = 0
    $e2eRkasBopId = 0
    Assert-Step "POST /api/rkas (Create E2E RKAS items for BOS & BOP)" {
        $rBos = Invoke-Api "POST" "/api/rkas" @{
            sekolahId = 1; tahunAnggaran = 2026; sumberDana = "BOS"; kodePeriode = "01"
            kodeSnp = "05"; namaSnp = "Pengembangan Sarana dan Prasarana"
            kodeKegiatan = "05.05.E2E"; namaKegiatan = "Pengadaan Buku Uji E2E"
            kodeAkun = "5.1.02.01.01.0024"; namaAkun = "Belanja Alat/Bahan Kantor"
            kodeKomponen = "E2E-BOS-01"; namaKomponen = "Paket Kertas & Toner E2E BOS"
            spesifikasi = "HVS A4 80gr"; satuan = "Paket"; volume = 10; hargaSatuan = 500000
        }
        Assert-True ($rBos.StatusCode -eq 200 -and $rBos.Json.success) "Create RKAS BOS gagal"
        $script:e2eRkasBosId = $rBos.Json.data.id

        $rBop = Invoke-Api "POST" "/api/rkas" @{
            sekolahId = 1; tahunAnggaran = 2026; sumberDana = "BOP"; kodePeriode = "TW1"
            kodeSnp = "06"; namaSnp = "Standar Pengelolaan"
            kodeKegiatan = "06.01.E2E"; namaKegiatan = "Pemeliharaan Rutin E2E"
            kodeAkun = "5.1.02.03.02.0115"; namaAkun = "Belanja Pemeliharaan"
            kodeKomponen = "E2E-BOP-01"; namaKomponen = "Servis AC Ruang Kelas E2E BOP"
            spesifikasi = "Cuci + Freon"; satuan = "Unit"; volume = 10; hargaSatuan = 400000
        }
        Assert-True ($rBop.StatusCode -eq 200 -and $rBop.Json.success) "Create RKAS BOP gagal"
        $script:e2eRkasBopId = $rBop.Json.data.id
    }

    # ============================================================
    # 5. BOS BKU SPJ LIFECYCLE + REJECT + DELETE + TRANSFER + PAJAK
    # ============================================================
    Write-Host "`n[5/9] BOS BKU Lifecycle (Draft -> Reject -> Delete -> TU -> PA -> Sudin -> CMS -> MPN)" -ForegroundColor Cyan

    Assert-Step "BKU Draft Creation, Edit (PUT) & Delete Verification" {
        $rDraft = Invoke-Api "POST" "/api/input-spj" @{
            sekolahId = 1; tahunAnggaran = 2026; sumberDana = "BOS"; kodePeriode = "01"
            tanggalTransaksi = "2026-03-10T00:00:00Z"; kodeTrx = "JJ"; jenisPembayaran = "TRANSFER"
            uraian = "Draft E2E Akan Diubah & Dihapus"; namaRekanan = "CV Test"; kodeBankRekanan = "111"
            namaBankRekanan = "Bank DKI"; noRekRekanan = "1110099887766"; npwpRekanan = "01.345.678.9-022.000"
            detailItems = @(@{ rkasItemId = $script:e2eRkasBosId; kodeKegiatan = "05.05.E2E"; namaKegiatan = "Pengadaan Buku Uji E2E"; kodeAkun = "5.1.02.01.01.0024"; namaAkun = "Belanja Alat"; kodeKomponen = "E2E-BOS-01"; namaKomponen = "Paket Kertas E2E"; volume = 1; satuan = "Paket"; hargaSatuan = 250000 })
            taxItems = @()
        }
        Assert-True ($rDraft.StatusCode -eq 200 -and $rDraft.Json.success) "Create draft gagal: $($rDraft.Raw)"
        $draftId = $rDraft.Json.data.id

        $rGet = Invoke-Api "GET" "/api/input-spj/$draftId"
        Assert-True ($rGet.StatusCode -eq 200 -and $rGet.Json.data.id -eq $draftId) "Get detail draft gagal: $($rGet.Raw)"

        $rEdit = Invoke-Api "PUT" "/api/input-spj/$draftId" @{
            sekolahId = 1; tahunAnggaran = 2026; sumberDana = "BOS"; kodePeriode = "01"
            tanggalTransaksi = "2026-03-10T00:00:00Z"; kodeTrx = "JJ"; jenisPembayaran = "TRANSFER"
            uraian = "Draft E2E Diperbarui PK"; namaRekanan = "CV Test Edit"; kodeBankRekanan = "111"
            namaBankRekanan = "Bank DKI"; noRekRekanan = "1110099887766"; npwpRekanan = "01.345.678.9-022.000"
            detailItems = @(@{ rkasItemId = $script:e2eRkasBosId; kodeKegiatan = "05.05.E2E"; namaKegiatan = "Pengadaan Buku Uji E2E"; kodeAkun = "5.1.02.01.01.0024"; namaAkun = "Belanja Alat"; kodeKomponen = "E2E-BOS-01"; namaKomponen = "Paket Kertas E2E"; volume = 1; satuan = "Paket"; hargaSatuan = 250000 })
            taxItems = @()
        }
        Assert-True ($rEdit.StatusCode -eq 200 -and $rEdit.Json.data.uraian -eq "Draft E2E Diperbarui PK") "Edit draft gagal: $($rEdit.Raw)"

        $rDel = Invoke-Api "DELETE" "/api/input-spj/$draftId"
        Assert-True ($rDel.StatusCode -eq 200 -and $rDel.Json.success) "Delete draft gagal: $($rDel.Raw)"
    }

    $e2eBkuId = 0
    $e2eTaxId = 0
    $e2eNetto = 0

    Assert-Step "Create BKU SPJ BOS (with RKAS + Tax P5) & Strict Role Workflow Approval 0->1->2->3->4 (NeedSudin)" {
        $rCreate = Invoke-Api "POST" "/api/input-spj" @{
            sekolahId = 1; tahunAnggaran = 2026; sumberDana = "BOS"; kodePeriode = "01"
            tanggalTransaksi = "2026-03-15T00:00:00Z"; kodeTrx = "JJ"; jenisPembayaran = "TRANSFER"
            uraian = "Pembelian Paket Kertas E2E Full Flow"; namaRekanan = "CV. GRAHA PUSTAKA NUSANTARA"
            kodeBankRekanan = "111"; namaBankRekanan = "Bank DKI"; noRekRekanan = "1110099887766"
            npwpRekanan = "01.345.678.9-022.000"; fileLampiranName = "kwitansi_e2e.pdf"
            fileLampiranPath = "/uploader/api/v1/minio/preview/$($script:uploadedFileName)"
            needSudinApproval = $true
            detailItems = @(@{
                rkasItemId = $script:e2eRkasBosId; kodeKegiatan = "05.05.E2E"; namaKegiatan = "Pengadaan Buku Uji E2E"
                kodeAkun = "5.1.02.01.01.0024"; namaAkun = "Belanja Alat/Bahan Kantor"
                kodeKomponen = "E2E-BOS-01"; namaKomponen = "Paket Kertas & Toner E2E BOS"
                spesifikasi = "HVS A4"; volume = 4; satuan = "Paket"; hargaSatuan = 500000
            })
            taxItems = @(@{
                kodeTrxPajak = "P5"; kodeMap = "411211"; kodeJenisSetoran = "920"
                dasarPengenaanPajak = 2000000; tarifPersen = 11; nilaiPajak = 220000
            })
        }
        Assert-True ($rCreate.StatusCode -eq 200 -and $rCreate.Json.success) "Create BKU SPJ gagal: $($rCreate.Raw)"
        $script:e2eBkuId = $rCreate.Json.data.id
        $script:e2eTaxId = $rCreate.Json.data.taxItems[0].id
        $script:e2eNetto = $rCreate.Json.data.nilaiNettoTransfer
        Assert-True ($rCreate.Json.data.statusBku -eq 0) "Status awal harus Draft (0)"

        $r1 = Invoke-Api "POST" "/api/workflow/pengajuan-pk/$($script:e2eBkuId)" @{ disetujui = $true; catatan = "Ajukan E2E" }
        Assert-True ($r1.StatusCode -eq 200 -and $r1.Json.data.statusBku -eq 1) "Pengajuan PK gagal"

        # Negative RBAC: PK tidak boleh approve TU / PA
        $rPkTryTu = Invoke-Api "POST" "/api/workflow/approval-tu/$($script:e2eBkuId)" @{ disetujui = $true; catatan = "Ilegal PK" }
        Assert-True ($rPkTryTu.StatusCode -eq 403) "PK seharusnya ditolak 403 pada approval-tu (actual: $($rPkTryTu.StatusCode))"

        $rPkTryPa = Invoke-Api "POST" "/api/workflow/approval-pa/$($script:e2eBkuId)" @{ disetujui = $true; catatan = "Ilegal PK" }
        Assert-True ($rPkTryPa.StatusCode -eq 403) "PK seharusnya ditolak 403 pada approval-pa (actual: $($rPkTryPa.StatusCode))"

        # Uji Tolak oleh TU lalu PK Edit/Ajukan Ulang!
        $rTolak = Invoke-Api "POST" "/api/workflow/approval-tu/$($script:e2eBkuId)" @{ disetujui = $false; catatan = "Revisi catatan E2E" } -Token $script:tuToken
        Assert-True ($rTolak.StatusCode -eq 200 -and $rTolak.Json.data.statusBku -eq 9) "Reject TU gagal: $($rTolak.Raw)"

        $rReAjukan = Invoke-Api "POST" "/api/workflow/pengajuan-pk/$($script:e2eBkuId)" @{ disetujui = $true; catatan = "Ajukan ulang pasca revisi E2E" }
        Assert-True ($rReAjukan.StatusCode -eq 200 -and $rReAjukan.Json.data.statusBku -eq 1) "Re-ajukan gagal"

        $r2 = Invoke-Api "POST" "/api/workflow/approval-tu/$($script:e2eBkuId)" @{ disetujui = $true; catatan = "OK TU E2E" } -Token $script:tuToken
        Assert-True ($r2.StatusCode -eq 200 -and $r2.Json.data.statusBku -eq 2) "Approval TU gagal: $($r2.Raw)"

        $rTuTryPa = Invoke-Api "POST" "/api/workflow/approval-pa/$($script:e2eBkuId)" @{ disetujui = $true; catatan = "Ilegal TU" } -Token $script:tuToken
        Assert-True ($rTuTryPa.StatusCode -eq 403) "TU seharusnya ditolak 403 pada approval-pa (actual: $($rTuTryPa.StatusCode))"

        $r3 = Invoke-Api "POST" "/api/workflow/approval-pa/$($script:e2eBkuId)" @{ disetujui = $true; catatan = "OK PA E2E" } -Token $script:paToken
        Assert-True ($r3.StatusCode -eq 200 -and $r3.Json.data.statusBku -eq 3) "Approval PA gagal: $($r3.Raw)"

        $r4 = Invoke-Api "POST" "/api/workflow/approval-sudin/$($script:e2eBkuId)" @{ disetujui = $true; catatan = "OK Sudin E2E" } -Token $script:dinasToken
        Assert-True ($r4.StatusCode -eq 200 -and $r4.Json.data.statusBku -eq 4) "Approval Sudin gagal: $($r4.Raw)"
    }

    Assert-Step "Pembayaran Token OTP PA + Reject PK Create Token + Reject OTP Salah + Transfer SPJ CMS Bank DKI" {
        $rPkTok = Invoke-Api "POST" "/api/pembayaran/token" @{ bkuId = $script:e2eBkuId; nrk = "180101" }
        Assert-True ($rPkTok.StatusCode -eq 403) "PK seharusnya ditolak 403 saat Permohonan Token OTP (actual: $($rPkTok.StatusCode))"

        $rTok = Invoke-Api "POST" "/api/pembayaran/token" @{ bkuId = $script:e2eBkuId; nrk = "180101" } -Token $script:paToken
        Assert-True ($rTok.StatusCode -eq 200 -and $rTok.Json.success) "Create token OTP gagal: $($rTok.Raw)"
        $otp = $rTok.Json.data.token

        $rBadOtp = Invoke-Api "POST" "/api/pembayaran/transfer" @{ bkuId = $script:e2eBkuId; tokenOtp = "000000"; executedBy = "e2e" }
        Assert-True ($rBadOtp.StatusCode -ge 400 -or -not $rBadOtp.Json.success) "Transfer OTP salah seharusnya ditolak"

        $saldoBefore = (Invoke-Api "GET" "/auth-server/api/master/sekolah/1").Json.data.saldoBos
        $rTx = Invoke-Api "POST" "/api/pembayaran/transfer" @{ bkuId = $script:e2eBkuId; tokenOtp = $otp; executedBy = "bendahara.sman1" }
        Assert-True ($rTx.StatusCode -eq 200 -and $rTx.Json.success) "Transfer SPJ gagal: $($rTx.Raw)"
        Assert-True ($rTx.Json.data.bit39 -eq "00" -and -not [string]::IsNullOrWhiteSpace($rTx.Json.data.noJurnalBank)) "Bit39/NoJurnal invalid"

        $saldoAfter = (Invoke-Api "GET" "/auth-server/api/master/sekolah/1").Json.data.saldoBos
        Assert-True (($saldoBefore - $saldoAfter) -eq $script:e2eNetto) "Pemotongan saldo BOS tidak akurat ($saldoBefore - $saldoAfter != $($script:e2eNetto))"
    }

    Assert-Step "Siklus Pajak MPN G3: Create Billing -> Reset -> Re-Create -> Inquiry -> Payment (NTPN)" {
        $rC1 = Invoke-Api "POST" "/api/pembayaran/pajak/$($script:e2eTaxId)/create"
        Assert-True ($rC1.StatusCode -eq 200 -and $rC1.Json.data.statusPajak -eq 1) "Create billing gagal: $($rC1.Raw)"

        $rRst = Invoke-Api "POST" "/api/pembayaran/pajak/$($script:e2eTaxId)/reset"
        Assert-True ($rRst.StatusCode -eq 200 -and $rRst.Json.data.statusPajak -eq 0) "Reset billing gagal"

        $rC2 = Invoke-Api "POST" "/api/pembayaran/pajak/$($script:e2eTaxId)/create"
        Assert-True ($rC2.StatusCode -eq 200 -and -not [string]::IsNullOrWhiteSpace($rC2.Json.data.kodeBilling)) "Re-create billing gagal"

        $rInq = Invoke-Api "POST" "/api/pembayaran/pajak/$($script:e2eTaxId)/inquiry"
        Assert-True ($rInq.StatusCode -eq 200 -and $rInq.Json.success) "Inquiry billing gagal"

        $rPay = Invoke-Api "POST" "/api/pembayaran/pajak/$($script:e2eTaxId)/payment"
        Assert-True ($rPay.StatusCode -eq 200 -and $rPay.Json.data.statusPajak -eq 2) "Bayar pajak MPN gagal: $($rPay.Raw)"
        Assert-True (-not [string]::IsNullOrWhiteSpace($rPay.Json.data.ntpn) -and -not [string]::IsNullOrWhiteSpace($rPay.Json.data.ntb)) "NTPN/NTB kosong"
    }

    Assert-Step "Validasi Kode Transaksi (Tolak JG/LL/ST; Izinkan JO/JJ/P1-P7) & Dashboard Summary API" {
        foreach ($badKode in @("JG", "LL", "ST")) {
            $rBadKode = Invoke-Api "POST" "/api/input-spj" @{
                sekolahId = 1; tahunAnggaran = 2026; sumberDana = "BOS"; kodePeriode = "01"
                tanggalTransaksi = "2026-03-20T00:00:00Z"; kodeTrx = $badKode; uraian = "Uji Kode Terlarang $badKode"
                nominalNonSpj = 100000; detailItems = @(); taxItems = @()
            }
            Assert-True ($rBadKode.StatusCode -ge 400 -or -not $rBadKode.Json.success) "Kode transaksi terlarang $badKode seharusnya ditolak!"
        }

        $rP5 = Invoke-Api "POST" "/api/input-spj" @{
            sekolahId = 1; tahunAnggaran = 2026; sumberDana = "BOS"; kodePeriode = "01"
            tanggalTransaksi = "2026-03-20T00:00:00Z"; kodeTrx = "P5"; jenisPembayaran = "TRANSFER"
            uraian = "Pungutan/Setoran PPN P5 Standalone E2E"
            nominalNonSpj = 110000; detailItems = @(); taxItems = @()
        }
        Assert-True ($rP5.StatusCode -eq 200 -and $rP5.Json.success) "Create transaksi pajak P5 gagal: $($rP5.Raw)"

        $rDash = Invoke-Api "GET" "/api/dashboard/summary?sekolahId=1&tahun=2026&sumberDana=BOS"
        Assert-True ($rDash.StatusCode -eq 200 -and $rDash.Json.data.saldo.totalDanaMasuk -gt 0) "Dashboard summary gagal"
    }

    # ============================================================
    # 6. PENUTUPAN KAS, BAP KAS, TUTUP BUKU & SETORAN STS
    # ============================================================
    Write-Host "`n[6/9] Rekonsiliasi Mutasi, BAP Kas, Tutup Buku & Setoran STS" -ForegroundColor Cyan

    $e2eStsId = 0
    Assert-Step "GET /api/penutupan/mutasi (Cek mutasi tercatat dari Transfer CMS & Pajak MPN)" {
        $r = Invoke-Api "GET" "/api/penutupan/mutasi?sekolahId=1&sumberDana=BOS"
        Assert-True ($r.StatusCode -eq 200 -and $r.Json.data.Count -ge 2) "Mutasi Bank DKI kosong/kurang"
    }

    Assert-Step "BAP Kas Save -> Approve PA (1) -> Approve Dinas (2)" {
        $rBap = Invoke-Api "POST" "/api/penutupan/bap-kas" @{
            sekolahId = 1; tahunAnggaran = 2026; sumberDana = "BOS"; kodePeriode = "02"
            saldoKasTunai = 0; pecahan100rb = 0; pecahan50rb = 0; pecahan20rb = 0
            pecahan10rb = 0; pecahan5rb = 0; pecahan2rb = 0; pecahan1rb = 0
            keteranganSelisih = "BAP Kas E2E Sesuai Rekening Koran"
        }
        Assert-True ($rBap.StatusCode -eq 200 -and $rBap.Json.success) "Save BAP Kas gagal: $($rBap.Raw)"
        $bapId = $rBap.Json.data.id

        $rAp1 = Invoke-Api "POST" "/api/penutupan/bap-kas/$bapId/approve/1" -Token $script:paToken
        Assert-True ($rAp1.StatusCode -eq 200 -and $rAp1.Json.data.statusBap -eq 1) "Approve PA BAP Kas gagal: $($rAp1.Raw)"

        $rAp2 = Invoke-Api "POST" "/api/penutupan/bap-kas/$bapId/approve/2" -Token $script:dinasToken
        Assert-True ($rAp2.StatusCode -eq 200 -and $rAp2.Json.data.statusBap -eq 2) "Approve Dinas BAP Kas gagal: $($rAp2.Raw)"
    }

    Assert-Step "Tutup Buku Periode 02 -> Batal Tutup Buku (Cleanup Lock)" {
        $rTutup = Invoke-Api "POST" "/api/penutupan/tutup-buku" @{
            sekolahId = 1; tahunAnggaran = 2026; sumberDana = "BOS"; kodePeriode = "02"
        }
        Assert-True ($rTutup.StatusCode -eq 200 -and $rTutup.Json.success) "Tutup buku gagal: $($rTutup.Raw)"

        $rBatal = Invoke-Api "POST" "/api/penutupan/batal-tutup-buku" @{
            sekolahId = 1; tahunAnggaran = 2026; sumberDana = "BOS"; kodePeriode = "02"
        }
        Assert-True ($rBatal.StatusCode -eq 200 -and $rBatal.Json.success) "Batal tutup buku gagal: $($rBatal.Raw)"
    }

    Assert-Step "Setoran STS Create -> Process Sudin (2) -> Setor Lunas (3)" {
        $rSts = Invoke-Api "POST" "/api/penutupan/setoran-sts" @{
            sekolahId = 1; tahunAnggaran = 2026; sumberDana = "BOS"; kodePeriode = "01"
            jenisSetoran = "SISA_BELANJA"; uraian = "Setoran STS Sisa Belanja E2E"; nilaiSetor = 100000
        }
        Assert-True ($rSts.StatusCode -eq 200 -and $rSts.Json.success) "Create STS gagal: $($rSts.Raw)"
        $script:e2eStsId = $rSts.Json.data.id

        $rP2 = Invoke-Api "POST" "/api/penutupan/setoran-sts/$($script:e2eStsId)/process/2" -Token $script:dinasToken
        Assert-True ($rP2.StatusCode -eq 200 -and $rP2.Json.data.statusSts -eq 2) "STS approve Sudin gagal: $($rP2.Raw)"

        $rP3 = Invoke-Api "POST" "/api/penutupan/setoran-sts/$($script:e2eStsId)/process/3"
        Assert-True ($rP3.StatusCode -eq 200 -and $rP3.Json.data.statusSts -eq 3) "STS setor Bank DKI gagal"
    }

    # ============================================================
    # 7. MODUL KHUSUS BOP: NPD -> SIPKD -> DROPPING -> BATAL TRANSFER SPJ (4-STAGE)
    # ============================================================
    Write-Host "`n[7/9] Modul BOP (/api-bop): NPD -> SIPKD -> Dropping & Batal Transfer SPJ (PK->TU->PA->SUDIN)" -ForegroundColor Cyan

    Assert-Step "NPD BOP Create -> Ajukan -> Approve PA -> Approve Sudin & Auto-SIPKD -> Confirm Dropping BOP" {
        $rNpd = Invoke-Api "POST" "/api-bop/npd" @{
            sekolahId = 1; tahunAnggaran = 2026; kodePeriode = "TW2"
            uraian = "NPD BOP Triwulan 2 Uji E2E"; nilaiPengajuan = 15000000
        }
        Assert-True ($rNpd.StatusCode -eq 200 -and $rNpd.Json.success) "Create NPD gagal"
        $npdId = $rNpd.Json.data.id

        $rAj = Invoke-Api "POST" "/api-bop/npd/$npdId/ajukan"
        Assert-True ($rAj.StatusCode -eq 200 -and $rAj.Json.data.statusNpd -eq 1) "Ajukan NPD gagal"

        $rPkTryPa = Invoke-Api "POST" "/api-bop/npd/$npdId/approve-pa" @{ disetujui = $true; catatan = "Ilegal PK" }
        Assert-True ($rPkTryPa.StatusCode -eq 403) "PK seharusnya ditolak 403 saat approve-pa NPD (actual: $($rPkTryPa.StatusCode))"

        $rPa = Invoke-Api "POST" "/api-bop/npd/$npdId/approve-pa" @{ disetujui = $true; catatan = "OK PA NPD E2E" } -Token $script:paToken
        Assert-True ($rPa.StatusCode -eq 200 -and $rPa.Json.data.statusNpd -eq 2) "Approve PA NPD gagal: $($rPa.Raw)"

        $rSd = Invoke-Api "POST" "/api-bop/npd/$npdId/approve-sudin" @{ disetujui = $true; catatan = "Cair SIPKD E2E" } -Token $script:sudinToken
        Assert-True ($rSd.StatusCode -eq 200 -and $rSd.Json.data.sipkd.responseCode -eq "00") "Approve Sudin SIPKD gagal: $($rSd.Raw)"

        # Cek Dropping BOP terbaru yang belum dikonfirmasi & langsung konfirmasi!
        $rDrops = Invoke-Api "GET" "/api-bop/konfirmasi-dana?sekolahId=1&tahun=2026"
        $pendingBop = $rDrops.Json.data | Where-Object { -not $_.isConfirmedToBku } | Select-Object -First 1
        Assert-True ($null -ne $pendingBop) "Dropping otomatis hasil NPD SIPKD tidak ditemukan"

        $saldoBopBefore = (Invoke-Api "GET" "/auth-server/api/master/sekolah/1").Json.data.saldoBop
        $rConfBop = Invoke-Api "POST" "/api-bop/konfirmasi-dana/$($pendingBop.id)/confirm"
        Assert-True ($rConfBop.StatusCode -eq 200 -and $rConfBop.Json.success) "Konfirmasi Dropping BOP gagal"
        $saldoBopAfter = (Invoke-Api "GET" "/auth-server/api/master/sekolah/1").Json.data.saldoBop
        Assert-True ($saldoBopAfter -gt $saldoBopBefore) "Saldo BOP tidak bertambah setelah konfirmasi NPD SIPKD"
    }

    Assert-Step "BOP BKU SPJ -> Transfer -> Batal Transfer SPJ 4-Stage (PK -> TU -> PA -> SUDIN + Refund Saldo)" {
        $rBkuBop = Invoke-Api "POST" "/api-bop/input-spj" @{
            sekolahId = 1; tahunAnggaran = 2026; sumberDana = "BOP"; kodePeriode = "TW1"
            tanggalTransaksi = "2026-03-18T00:00:00Z"; kodeTrx = "JJ"; jenisPembayaran = "TRANSFER"
            uraian = "Servis AC Ruang Kelas E2E Batal Transfer"; namaRekanan = "PT. SEJUK PRIMA TEKNIK"
            kodeBankRekanan = "014"; namaBankRekanan = "Bank BCA"; noRekRekanan = "5400881234"
            npwpRekanan = "02.555.666.7-033.000"; needSudinApproval = $false
            detailItems = @(@{
                rkasItemId = $script:e2eRkasBopId; kodeKegiatan = "06.01.E2E"; namaKegiatan = "Pemeliharaan Rutin E2E"
                kodeAkun = "5.1.02.03.02.0115"; namaAkun = "Belanja Pemeliharaan"
                kodeKomponen = "E2E-BOP-01"; namaKomponen = "Servis AC Ruang Kelas E2E BOP"
                spesifikasi = "Cuci + Freon"; volume = 2; satuan = "Unit"; hargaSatuan = 400000
            })
            taxItems = @()
        }
        Assert-True ($rBkuBop.StatusCode -eq 200 -and $rBkuBop.Json.success) "Create BKU BOP gagal: $($rBkuBop.Raw)"
        $bkuBopId = $rBkuBop.Json.data.id

        $rB1 = Invoke-Api "POST" "/api-bop/workflow/pengajuan-pk/$bkuBopId" @{ disetujui = $true }
        Assert-True ($rB1.StatusCode -eq 200) "Pengajuan PK BOP gagal"
        $rB2 = Invoke-Api "POST" "/api-bop/workflow/approval-tu/$bkuBopId" @{ disetujui = $true } -Token $script:tuToken
        Assert-True ($rB2.StatusCode -eq 200) "Approval TU BOP gagal"
        $rB3 = Invoke-Api "POST" "/api-bop/workflow/approval-pa/$bkuBopId" @{ disetujui = $true } -Token $script:paToken
        Assert-True ($rB3.StatusCode -eq 200) "Approval PA BOP gagal"
        $tok = (Invoke-Api "POST" "/api-bop/pembayaran/token" @{ bkuId = $bkuBopId; nrk = "180101" } -Token $script:paToken).Json.data.token
        $txBop = Invoke-Api "POST" "/api-bop/pembayaran/transfer" @{ bkuId = $bkuBopId; tokenOtp = $tok; executedBy = "bendahara.sman1" }
        Assert-True ($txBop.StatusCode -eq 200 -and $txBop.Json.success) "Transfer BKU BOP gagal: $($txBop.Raw)"

        # Candidates modal query
        $rCand = Invoke-Api "GET" "/api-bop/batal-transfer/spj-candidates?sekolahId=1&tahun=2026"
        Assert-True ($rCand.StatusCode -eq 200 -and ($rCand.Json.data.id -contains $bkuBopId)) "Kandidat SPJ Batal Transfer tidak memuat BKU ID $bkuBopId"

        # Save Draft -> Edit Draft -> Detail -> 4-stage Approval
        $saldoBeforeRefund = (Invoke-Api "GET" "/auth-server/api/master/sekolah/1").Json.data.saldoBop
        $rBtCreate = Invoke-Api "POST" "/api-bop/batal-transfer" @{
            sekolahId = 1; bkuTransactionId = $bkuBopId; tahunAnggaran = 2026; sumberDana = "BOP"
            jenisPeriode = "TW"; kodePeriode = "TW1"; nomorBeritaAcara = "BA-E2E-BOP-001"
            tanggalPembatalan = "2026-03-25T00:00:00Z"; nrkPengkoreksi = "190202"; namaPengkoreksi = "Budi Bendahara E2E"
            uraianBeritaAcara = "Draft batal transfer retur rekening rekanan E2E"; pajakTidakDikoreksi = $true; submitToTu = $false
        }
        Assert-True ($rBtCreate.StatusCode -eq 200 -and $rBtCreate.Json.data.statusBatal -eq 0) "Create Draft Batal Transfer gagal: $($rBtCreate.Raw)"
        $btId = $rBtCreate.Json.data.id

        $rBtEdit = Invoke-Api "PUT" "/api-bop/batal-transfer/$btId" @{
            sekolahId = 1; bkuTransactionId = $bkuBopId; tahunAnggaran = 2026; sumberDana = "BOP"
            jenisPeriode = "TW"; kodePeriode = "TW1"; nomorBeritaAcara = "BA-E2E-BOP-001"
            tanggalPembatalan = "2026-03-25T00:00:00Z"; nrkPengkoreksi = "190202"; namaPengkoreksi = "Budi Bendahara E2E"
            uraianBeritaAcara = "Revisi Berita Acara Batal Transfer E2E"; pajakTidakDikoreksi = $true; submitToTu = $false
        }
        Assert-True ($rBtEdit.StatusCode -eq 200 -and $rBtEdit.Json.data.uraianBeritaAcara -eq "Revisi Berita Acara Batal Transfer E2E") "Edit Draft Batal Transfer gagal"

        $rBtDet = Invoke-Api "GET" "/api-bop/batal-transfer/$btId"
        Assert-True ($rBtDet.StatusCode -eq 200 -and $null -ne $rBtDet.Json.data.bkuTransaction) "Detail Batal Transfer gagal memuat SPJ"

        $rBtPk = Invoke-Api "POST" "/api-bop/batal-transfer/$btId/ajukan-pk" @{ disetujui = $true; catatan = "Ajukan PK E2E" }
        Assert-True ($rBtPk.StatusCode -eq 200 -and $rBtPk.Json.data.statusBatal -eq 1) "Ajukan PK Batal Transfer gagal"

        # Negative RBAC 403
        $rBtPkTryTu = Invoke-Api "POST" "/api-bop/batal-transfer/$btId/approve-tu" @{ disetujui = $true; catatan = "Ilegal PK" }
        Assert-True ($rBtPkTryTu.StatusCode -eq 403) "PK seharusnya ditolak 403 pada approve-tu Batal Transfer"

        $rBtTu = Invoke-Api "POST" "/api-bop/batal-transfer/$btId/approve-tu" @{ disetujui = $true; catatan = "OK TU" } -Token $script:tuToken
        Assert-True ($rBtTu.StatusCode -eq 200 -and $rBtTu.Json.data.statusBatal -eq 2) "Approve TU Batal Transfer gagal"

        $rBtPa = Invoke-Api "POST" "/api-bop/batal-transfer/$btId/approve-pa" @{ disetujui = $true; catatan = "OK PA" } -Token $script:paToken
        Assert-True ($rBtPa.StatusCode -eq 200 -and $rBtPa.Json.data.statusBatal -eq 3) "Approve PA Batal Transfer gagal"

        $rBtSudin = Invoke-Api "POST" "/api-bop/batal-transfer/$btId/approve-sudin" @{ disetujui = $true; catatan = "Disetujui Sudin E2E" } -Token $script:sudinToken
        Assert-True ($rBtSudin.StatusCode -eq 200 -and $rBtSudin.Json.data.statusBatal -eq 4) "Approve Sudin Batal Transfer gagal: $($rBtSudin.Raw)"

        $saldoAfterRefund = (Invoke-Api "GET" "/auth-server/api/master/sekolah/1").Json.data.saldoBop
        Assert-True ($saldoAfterRefund -eq ($saldoBeforeRefund + 800000)) "Saldo BOP tidak dikembalikan saat Batal Transfer ($saldoBeforeRefund -> $saldoAfterRefund)"

        $rBkuAfter = Invoke-Api "GET" "/api-bop/input-spj/$bkuBopId"
        Assert-True ($rBkuAfter.StatusCode -eq 200 -and $rBkuAfter.Json.data.statusBku -eq 0) "Status SPJ harus kembali menjadi Draft (0) setelah Batal Transfer disetujui Sudin"
    }

    # ============================================================
    # 8. HELPDESK DINAS
    # ============================================================
    Write-Host "`n[8/9] Helpdesk Pengaduan Sekolah & Tanggapan Dinas" -ForegroundColor Cyan

    Assert-Step "POST /api/helpdesk & PUT /api/helpdesk/{id}/respond" {
        $rH = Invoke-Api "POST" "/api/helpdesk" @{
            sekolahId = 1; namaPelapor = "Budi Bendahara E2E"; rolePelapor = "PK-NEGERI"
            judul = "Uji Tiket Helpdesk E2E"; kategori = "Integrasi Bank DKI"
            deskripsi = "Verifikasi tiket helpdesk berjalan end-to-end."
        }
        Assert-True ($rH.StatusCode -eq 200 -and $rH.Json.success) "Create helpdesk gagal: $($rH.Raw)"
        $tid = $rH.Json.data.id

        $rRes = Invoke-Api "PUT" "/api/helpdesk/$tid/respond" @{
            tanggapanAdmin = "Sudah diverifikasi oleh Admin Dinas pada pengujian E2E."; status = "RESOLVED"
        }
        Assert-True ($rRes.StatusCode -eq 200 -and $rRes.Json.data.status -eq "RESOLVED") "Respond helpdesk gagal: $($rRes.Raw)"
    }

    # ============================================================
    # 9. SELURUH 11 ENDPOINT LAPORAN PDF & EXCEL (/report-server)
    # ============================================================
    Write-Host "`n[9/9] Report Server: Verifikasi 9 PDF & 2 Excel Laporan Resmi" -ForegroundColor Cyan

    $pdfRoutes = @(
        "/report-server/pdf/form22?sekolahId=1&tahun=2026&sumberDana=BOS",
        "/report-server/pdf/laporan?sekolahId=1&tahun=2026&sumberDana=BOS&jenisLaporan=form22&jenisPeriode=TW&waktuPeriode=01",
        "/report-server/pdf/form23?sekolahId=1&tahun=2026&sumberDana=BOS",
        "/report-server/pdf/form25?sekolahId=1&tahun=2026&sumberDana=BOS",
        "/report-server/pdf/kartu-kendali?sekolahId=1&tahun=2026&sumberDana=BOS",
        "/report-server/pdf/form19-k1k7?sekolahId=1&tahun=2026&sumberDana=BOP",
        "/report-server/pdf/mutasi?sekolahId=1&sumberDana=BOS",
        "/report-server/pdf/spj/$($script:e2eBkuId)",
        "/report-server/pdf/bpn/$($script:e2eTaxId)",
        "/report-server/pdf/sts/$($script:e2eStsId)"
    )

    foreach ($pRoute in $pdfRoutes) {
        Assert-Step "PDF $pRoute" {
            $res = Invoke-ApiBytes $pRoute
            Assert-True ($res.StatusCode -eq 200) "HTTP $($res.StatusCode)"
            Assert-True ($res.Bytes.Length -gt 500) "Ukuran PDF terlalu kecil ($($res.Bytes.Length))"
            $hdr = [System.Text.Encoding]::ASCII.GetString($res.Bytes[0..4])
            Assert-True ($hdr -eq "%PDF-") "Header bukan %PDF- (actual: $hdr)"
        }
    }

    $excelRoutes = @(
        "/report-server/excel/bap-kas?sekolahId=1&tahun=2026&sumberDana=BOS&kodePeriode=02",
        "/report-server/excel/monitoring?tahun=2026&sumberDana=BOS"
    )

    foreach ($xRoute in $excelRoutes) {
        Assert-Step "Excel $xRoute" {
            $res = Invoke-ApiBytes $xRoute
            Assert-True ($res.StatusCode -eq 200) "HTTP $($res.StatusCode)"
            Assert-True ($res.Bytes.Length -gt 1000) "Ukuran Excel terlalu kecil ($($res.Bytes.Length))"
            Assert-True ($res.Bytes[0] -eq 0x50 -and $res.Bytes[1] -eq 0x4B) "Header bukan XLSX PK"
        }
    }

    Assert-Step "PostgreSQL Schema, Table & TrxCode Verification (ONLY auth,oauth,siap; NO trkoreksi_bku; ONLY JO/JJ/P1-P7)" {
        $psqlExe = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
        if (Test-Path $psqlExe) {
            $env:PGPASSWORD = $DbPassword
            $schemasRaw = (& $psqlExe -h localhost -p 5432 -U postgres -d siapbos_dummy_db -t -A -c "SELECT DISTINCT table_schema FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema;") -join ","
            Assert-True ($schemasRaw -eq "auth,oauth,siap") "Schema aktif harus tepat 'auth,oauth,siap' (actual: $schemasRaw)"

            $hasBatal = (& $psqlExe -h localhost -p 5432 -U postgres -d siapbos_dummy_db -t -A -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='siap' AND table_name='trbatal_transfer_spj';").Trim()
            Assert-True ([int]$hasBatal -eq 1) "Tabel siap.trbatal_transfer_spj tidak ditemukan"

            $hasKoreksi = (& $psqlExe -h localhost -p 5432 -U postgres -d siapbos_dummy_db -t -A -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='siap' AND table_name='trkoreksi_bku';").Trim()
            Assert-True ([int]$hasKoreksi -eq 0) "Tabel terlarang siap.trkoreksi_bku masih ada!"

            $badTrxCount = (('SELECT COUNT(*) FROM siap.tmbkubos_bop WHERE "KodeTrx" NOT IN (''JO'',''JJ'',''P1'',''P2'',''P3'',''P4'',''P5'',''P6'',''P7'');' | & $psqlExe -h localhost -p 5432 -U postgres -d siapbos_dummy_db -t -A) -join "").Trim()
            Assert-True ([int]$badTrxCount -eq 0) "Masih ada $badTrxCount baris BKU dengan KodeTrx selain JO/JJ/P1-P7!"
        }
    }
} finally {
    if ($startedHere -and -not $NoManageServers) {
        Write-Host "`n[*] Menghentikan seluruh server uji melalui stop-all.ps1..." -ForegroundColor Cyan
        & (Join-Path $RootDir "stop-all.ps1")
    }
}

Write-Host "`n================================================================" -ForegroundColor Yellow
Write-Host "  RINGKASAN PENGUJIAN END-TO-END SIAP BOS" -ForegroundColor Yellow
Write-Host "  TOTAL PASS : $script:Passed" -ForegroundColor Green
Write-Host "  TOTAL FAIL : $script:Failed" -ForegroundColor $(if ($script:Failed -eq 0) { "Green" } else { "Red" })
Write-Host "================================================================" -ForegroundColor Yellow

if ($script:Failed -gt 0) {
    Write-Host "`nDaftar Kegagalan:" -ForegroundColor Red
    foreach ($f in $script:Failures) {
        Write-Host "  - $f" -ForegroundColor Red
    }
    exit 1
}

exit 0
