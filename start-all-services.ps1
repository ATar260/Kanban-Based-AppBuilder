# Open Lovable - Start All Services (cross-platform)
# Usage:
#   Windows (PowerShell): .\start-all-services.ps1
#   macOS/Linux (PowerShell 7+): pwsh ./start-all-services.ps1

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Open Lovable - Starting Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to project directory
Set-Location $PSScriptRoot

$port = 3002
$devUrl = "http://localhost:$port"
$devCmd = "npx next dev --turbopack --port $port"

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "[!] node_modules not found. Running npm install..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] npm install failed!" -ForegroundColor Red
        exit 1
    }
}

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "[!] Warning: .env.local not found." -ForegroundColor Yellow
    Write-Host "    Create .env.local in the project root and set E2B_API_KEY (and optionally SANDBOX_PROVIDER=e2b, E2B_TEMPLATE_ID)." -ForegroundColor Yellow
    Write-Host "    See PRODUCT_PLAN.md > PART 7: ENVIRONMENT VARIABLES." -ForegroundColor DarkGray
}

Write-Host "[*] App will be available at: $devUrl" -ForegroundColor Green
Write-Host ""

if ($IsWindows) {
    Write-Host "[*] Starting Next.js dev server in new terminal window..." -ForegroundColor Green

    # Launch dev server in a new terminal window
    $scriptPath = $PSScriptRoot

    # Prefer pwsh if available, fall back to Windows PowerShell
    $psExe = if (Get-Command pwsh -ErrorAction SilentlyContinue) { "pwsh" } else { "powershell" }

    Start-Process $psExe -ArgumentList "-NoExit", "-Command", @"
`$Host.UI.RawUI.WindowTitle = 'Open Lovable - Dev Server'
Set-Location '$scriptPath'
Write-Host 'Starting Next.js dev server with Turbopack on port $port...' -ForegroundColor Green
Write-Host 'Press Ctrl+C to stop the server' -ForegroundColor DarkGray
Write-Host ''
$devCmd
"@

    # Open browser after a short delay
    Start-Job -ArgumentList $devUrl -ScriptBlock {
        param($url)
        Start-Sleep -Seconds 3
        Start-Process $url
    } | Out-Null

    Write-Host "[*] Dev server launched in separate window." -ForegroundColor Green
    Write-Host ""
}
elseif ($IsMacOS) {
    Write-Host "[*] Starting Next.js dev server in a new Terminal window..." -ForegroundColor Green

    $scriptPath = $PSScriptRoot
    $scriptPathForShell = $scriptPath.Replace("'", "'\''")

    $terminalCmd = "cd '$scriptPathForShell' && echo 'Starting Next.js dev server with Turbopack on port $port...' && echo 'Press Ctrl+C to stop the server' && $devCmd"
    $terminalCmdForAppleScript = $terminalCmd.Replace('\', '\\').Replace('"', '\"')

    $appleScript = @"
tell application "Terminal"
  activate
  do script "$terminalCmdForAppleScript"
end tell
"@

    if (Get-Command osascript -ErrorAction SilentlyContinue) {
        & osascript -e $appleScript | Out-Null

        Start-Sleep -Seconds 3
        if (Get-Command open -ErrorAction SilentlyContinue) {
            & open $devUrl | Out-Null
        } else {
            Start-Process $devUrl
        }

        Write-Host "[*] Dev server launched in a separate Terminal window." -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "[!] osascript not found. Starting dev server in this terminal instead..." -ForegroundColor Yellow
        Write-Host "    $devCmd" -ForegroundColor DarkGray
        Write-Host ""
        & npx next dev --turbopack --port $port
    }
}
else {
    # Linux / other Unix
    Write-Host "[*] Starting Next.js dev server in this terminal (no GUI terminal automation configured)..." -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop the server" -ForegroundColor DarkGray
    Write-Host ""
    & npx next dev --turbopack --port $port
}
