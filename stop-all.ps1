$ErrorActionPreference = "SilentlyContinue"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PidFile = Join-Path $RootDir ".run-pids.json"

if (Test-Path $PidFile) {
    $records = Get-Content $PidFile -Raw | ConvertFrom-Json
    if ($records -isnot [System.Array]) {
        $records = @($records)
    }

    foreach ($rec in $records) {
        $procId = [int]$rec.pid
        if ($procId -gt 0) {
            $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($p) {
                & taskkill /PID $procId /T /F | Out-Null
                Write-Host "[STOPPED] $($rec.name) (Port $($rec.port), PID $procId)" -ForegroundColor Cyan
            }
        }
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

# Ensure any lingering processes on ports 5001..5006 and 4200 are also stopped
$ports = @(5001, 5002, 5003, 5004, 5005, 5006, 4200)
$conns = Get-NetTCPConnection -LocalPort $ports -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
    if ($c.OwningProcess -gt 4) {
        & taskkill /PID $c.OwningProcess /T /F | Out-Null
        Write-Host "[STOPPED] Port $($c.LocalPort) (PID $($c.OwningProcess))" -ForegroundColor Cyan
    }
}

Write-Host "[OK] Semua service SIAP BOS berhasil dihentikan." -ForegroundColor Green
