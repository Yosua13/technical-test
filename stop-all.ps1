$ErrorActionPreference = "SilentlyContinue"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PidFile = Join-Path $RootDir ".run-pids.json"

if (-not (Test-Path $PidFile)) {
    Write-Host "[*] Tidak ada file .run-pids.json. Tidak ada service tercatat berjalan." -ForegroundColor Yellow
    exit 0
}

$records = Get-Content $PidFile -Raw | ConvertFrom-Json
if ($records -isnot [System.Array]) {
    $records = @($records)
}

foreach ($rec in $records) {
    $procId = [int]$rec.pid
    if ($procId -gt 0) {
        $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($p) {
            # Kill process tree (especially important for cmd.exe -> node / ng serve)
            & taskkill /PID $procId /T /F | Out-Null
            Write-Host "[STOPPED] $($rec.name) (Port $($rec.port), PID $procId)" -ForegroundColor Cyan
        } else {
            Write-Host "[SKIP]    $($rec.name) (PID $procId sudah berhenti)" -ForegroundColor DarkGray
        }
    }
}

Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
Write-Host "[OK] Semua service SIAP BOS berhasil dihentikan." -ForegroundColor Green
