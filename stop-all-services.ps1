# Open Lovable - Stop All Services (cross-platform)
# Usage:
#   Windows (PowerShell): .\stop-all-services.ps1
#   macOS/Linux (PowerShell 7+): pwsh ./stop-all-services.ps1

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Open Lovable - Stopping Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$port = 3002
$stoppedCount = 0

# Used to avoid double-stopping the same PID when using multiple strategies
$killedPids = New-Object "System.Collections.Generic.HashSet[int]"

Write-Host "[*] Looking for processes on port $port..." -ForegroundColor Yellow

if ($IsWindows) {
    # Find processes using port 3002 (Next.js dev server)
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($procId in $processIds) {
            $procIdInt = [int]$procId
            if (-not $killedPids.Add($procIdInt)) { continue }

            $process = Get-Process -Id $procIdInt -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "[*] Stopping process: $($process.ProcessName) (PID: $procIdInt)" -ForegroundColor Yellow
            } else {
                Write-Host "[*] Stopping process on port $port (PID: $procIdInt)" -ForegroundColor Yellow
            }

            Stop-Process -Id $procIdInt -Force -ErrorAction SilentlyContinue
            $stoppedCount++
        }
    }

    # Kill any remaining node processes associated with this project (best-effort)
    $allNodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
    foreach ($proc in $allNodeProcesses) {
        try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
            if ($cmdLine -match "firecrawltest|next dev|turbopack") {
                $pid = [int]$proc.Id
                if (-not $killedPids.Add($pid)) { continue }

                Write-Host "[*] Stopping Node.js process (PID: $pid)" -ForegroundColor Yellow
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                $stoppedCount++
            }
        } catch {
            # Ignore errors for processes we can't inspect
        }
    }
}
else {
    # macOS/Linux: stop the listener on :3002 (preferred) using lsof.
    $pids = @()

    if (Get-Command lsof -ErrorAction SilentlyContinue) {
        try {
            $pids = & lsof -nP -iTCP:$port -sTCP:LISTEN -t 2>$null
        } catch {
            $pids = @()
        }
    } else {
        Write-Host "[!] 'lsof' not found; can't reliably stop by port. Install it (or stop the process manually)." -ForegroundColor Yellow
    }

    $pids = $pids | Where-Object { $_ } | ForEach-Object { [int]$_ } | Select-Object -Unique

    foreach ($pid in $pids) {
        if (-not $killedPids.Add($pid)) { continue }

        Write-Host "[*] Stopping process on port $port (PID: $pid)" -ForegroundColor Yellow
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        $stoppedCount++
    }

    # Fallback: if something is still running, try to match Next.js dev processes that include --port 3002.
    if (Get-Command ps -ErrorAction SilentlyContinue) {
        try {
            $psLines = & ps -ax -o pid=,command= 2>$null
            $matches = $psLines | Where-Object { $_ -match "next(\.js)? dev" -and $_ -match "--port\s+$port" }
            foreach ($line in $matches) {
                $parts = $line.Trim() -split '\s+', 2
                if ($parts.Count -lt 1) { continue }

                $pid = [int]$parts[0]
                if (-not $killedPids.Add($pid)) { continue }

                Write-Host "[*] Stopping Next.js process (PID: $pid)" -ForegroundColor Yellow
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                $stoppedCount++
            }
        } catch {
            # Ignore ps parsing errors
        }
    }
}

Write-Host ""
if ($stoppedCount -gt 0) {
    Write-Host "[OK] Stopped $stoppedCount process(es)" -ForegroundColor Green
} else {
    Write-Host "[OK] No running services found" -ForegroundColor Green
}
Write-Host ""
