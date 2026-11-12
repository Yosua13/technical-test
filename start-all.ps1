param(
    [string]$DbHost = "localhost",
    [int]$DbPort = 5432,
    [string]$DbName = "siapbos_dummy_db",
    [string]$DbUser = "postgres",
    [string]$DbPassword = "postgres",
    [switch]$SkipBuild,
    [switch]$SkipFrontend,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogsDir = Join-Path $RootDir ".run-logs"
$PidFile = Join-Path $RootDir ".run-pids.json"

Write-Host "============================================================" -ForegroundColor DarkYellow
Write-Host "  SIAP BOS (BOSP & BOP) - Microservices & Angular Launcher" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor DarkYellow

# 1. Ensure dotnet is on PATH
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    $dotnetPath = "C:\Program Files\dotnet"
    if (Test-Path (Join-Path $dotnetPath "dotnet.exe")) {
        $env:PATH = "$dotnetPath;$env:PATH"
    } else {
        throw "dotnet CLI tidak ditemukan. Pastikan .NET 11 SDK terinstall."
    }
}

# 2. Stop previous instances if running
if (Test-Path $PidFile) {
    Write-Host "[*] Menghentikan instance sebelumnya..." -ForegroundColor Cyan
    & (Join-Path $RootDir "stop-all.ps1")
}

# 3. Resolve PostgreSQL connection password without hardcoding user secrets
$resolvedPass = $DbPassword
if ([string]::IsNullOrWhiteSpace($resolvedPass)) {
    $resolvedPass = $env:SIAPBOS_DB_PASSWORD
}
if ([string]::IsNullOrWhiteSpace($resolvedPass) -and -not $env:SIAPBOS_DB_CONNECTION) {
    $sec = Read-Host "Masukkan password PostgreSQL user '$DbUser' (tekan Enter untuk default 'postgres')" -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try {
        $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    $resolvedPass = if ([string]::IsNullOrWhiteSpace($plain)) { "postgres" } else { $plain }
}

if (-not $env:SIAPBOS_DB_CONNECTION) {
    $env:SIAPBOS_DB_CONNECTION = "Host=$DbHost;Port=$DbPort;Database=$DbName;Username=$DbUser;Password=$resolvedPass"
}

# Check PostgreSQL TCP port
try {
    $tcp = [System.Net.Sockets.TcpClient]::new()
    $iar = $tcp.BeginConnect($DbHost, $DbPort, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(2000, $false)
    if ($ok) { $tcp.EndConnect($iar) }
    $tcp.Close()
    if (-not $ok) { throw "Timeout" }
    Write-Host "[OK] PostgreSQL terdeteksi aktif pada ${DbHost}:${DbPort}" -ForegroundColor Green
} catch {
    Write-Warning "PostgreSQL belum merespons pada ${DbHost}:${DbPort}. Pastikan service PostgreSQL berjalan."
}

# 4. Build .NET solution once so all 6 microservices share clean binaries
if (-not $SkipBuild) {
    Write-Host "[*] Membangun solution .NET (SiapBos.Microservices.slnx)..." -ForegroundColor Cyan
    Push-Location $RootDir
    try {
        & dotnet build "SiapBos.Microservices.slnx" --nologo
        if ($LASTEXITCODE -ne 0) {
            throw "Build .NET gagal. Periksa pesan error di atas."
        }
    } finally {
        Pop-Location
    }
    Write-Host "[OK] Build seluruh backend microservices berhasil." -ForegroundColor Green
}

New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

$services = @(
    @{ Name = "siapbos-auth";        Port = 5001; Dll = "siapbos-auth\bin\Debug\net11.0\siapbos-auth.dll" },
    @{ Name = "siapbos-integration"; Port = 5004; Dll = "siapbos-integration\bin\Debug\net11.0\siapbos-integration.dll" },
    @{ Name = "siapbos-api";         Port = 5002; Dll = "siapbos-api\bin\Debug\net11.0\siapbos-api.dll" },
    @{ Name = "siapbop-api";         Port = 5003; Dll = "siapbop-api\bin\Debug\net11.0\siapbop-api.dll" },
    @{ Name = "siapbos-report";      Port = 5005; Dll = "siapbos-report\bin\Debug\net11.0\siapbos-report.dll" },
    @{ Name = "siapbos-uploader";    Port = 5006; Dll = "siapbos-uploader\bin\Debug\net11.0\siapbos-uploader.dll" }
)

$pidRecords = @()

function Wait-Health([string]$Url, [string]$ServiceName, [int]$TimeoutSec = 25) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-RestMethod -Uri $Url -TimeoutSec 2 -ErrorAction Stop
            if ($resp.status -eq "UP") {
                Write-Host "  [UP]   $ServiceName ($Url)" -ForegroundColor Green
                return $true
            }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    Write-Warning "  [WARN] $ServiceName belum merespons di $Url (cek log: .run-logs\$ServiceName.err.log)"
    return $false
}

Write-Host "[*] Menjalankan 6 Backend Microservices (.NET 11)..." -ForegroundColor Cyan
foreach ($svc in $services) {
    $svcDir = Join-Path $RootDir $svc.Name
    $dllFullPath = Join-Path $RootDir $svc.Dll
    if (-not (Test-Path $dllFullPath)) {
        throw "Binary tidak ditemukan: $dllFullPath. Jalankan tanpa -SkipBuild."
    }

    $outLog = Join-Path $LogsDir "$($svc.Name).out.log"
    $errLog = Join-Path $LogsDir "$($svc.Name).err.log"
    $env:ASPNETCORE_ENVIRONMENT = "Development"

    $proc = Start-Process -FilePath "dotnet" `
        -ArgumentList "`"$dllFullPath`" --urls http://localhost:$($svc.Port)" `
        -WorkingDirectory $svcDir `
        -RedirectStandardOutput $outLog `
        -RedirectStandardError $errLog `
        -WindowStyle Hidden `
        -PassThru

    $pidRecords += [PSCustomObject]@{
        name = $svc.Name
        port = $svc.Port
        pid  = $proc.Id
    }

    # Tunggu siapbos-auth UP dulu agar DB & Seeder selesai sebelum service lain start
    if ($svc.Name -eq "siapbos-auth") {
        Wait-Health "http://localhost:5001/health" $svc.Name 30 | Out-Null
    }
}

Write-Host "[*] Verifikasi healthcheck seluruh backend services..." -ForegroundColor Cyan
foreach ($svc in $services | Where-Object { $_.Name -ne "siapbos-auth" }) {
    Wait-Health "http://localhost:$($svc.Port)/health" $svc.Name 20 | Out-Null
}

# 5. Start Angular Frontend
if (-not $SkipFrontend) {
    $feDir = Join-Path $RootDir "siapbos-webapp-prod"
    if (-not (Test-Path (Join-Path $feDir "node_modules"))) {
        Write-Host "[*] Menginstall dependency npm Angular..." -ForegroundColor Cyan
        Push-Location $feDir
        try {
            & npm install
        } finally {
            Pop-Location
        }
    }

    Write-Host "[*] Menjalankan Frontend Angular 22 pada http://localhost:4200..." -ForegroundColor Cyan
    $feOut = Join-Path $LogsDir "siapbos-webapp-prod.out.log"
    $feErr = Join-Path $LogsDir "siapbos-webapp-prod.err.log"

    $feProc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c npx ng serve --proxy-config proxy.conf.json --port 4200" `
        -WorkingDirectory $feDir `
        -RedirectStandardOutput $feOut `
        -RedirectStandardError $feErr `
        -WindowStyle Hidden `
        -PassThru

    $pidRecords += [PSCustomObject]@{
        name = "siapbos-webapp-prod"
        port = 4200
        pid  = $feProc.Id
    }

    $feDeadline = (Get-Date).AddSeconds(60)
    $feReady = $false
    while ((Get-Date) -lt $feDeadline) {
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:4200" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($r.StatusCode -eq 200) {
                $feReady = $true
                break
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }

    if ($feReady) {
        Write-Host "  [UP]   siapbos-webapp-prod (http://localhost:4200)" -ForegroundColor Green
    } else {
        Write-Warning "Frontend masih kompilasi atau gagal. Cek log: .run-logs\siapbos-webapp-prod.err.log"
    }
}

$pidRecords | ConvertTo-Json | Set-Content -Path $PidFile -Encoding UTF8

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkYellow
Write-Host "  APLIKASI SIAP BOS BERHASIL BERJALAN!" -ForegroundColor Green
Write-Host "  Frontend Angular   : http://localhost:4200" -ForegroundColor White
Write-Host "  Auth Swagger       : http://localhost:5001/swagger" -ForegroundColor Gray
Write-Host "  BOS API Swagger    : http://localhost:5002/swagger" -ForegroundColor Gray
Write-Host "  BOP API Swagger    : http://localhost:5003/swagger" -ForegroundColor Gray
Write-Host "  Integration Swagger: http://localhost:5004/swagger" -ForegroundColor Gray
Write-Host "  Report Swagger     : http://localhost:5005/swagger" -ForegroundColor Gray
Write-Host "  Uploader Swagger   : http://localhost:5006/swagger" -ForegroundColor Gray
Write-Host "  Untuk menghentikan semua service: .\stop-all.ps1" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor DarkYellow

if (-not $SkipFrontend -and -not $NoBrowser) {
    Start-Process "http://localhost:4200"
}
