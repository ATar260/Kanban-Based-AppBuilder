# Open Lovable - Start All Services
# Usage: .\start-all-services.ps1

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Open Lovable - Starting Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to project directory
Set-Location $PSScriptRoot

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
    Write-Host "[!] Warning: .env.local not found. Copy .env.example to .env.local and add your API keys." -ForegroundColor Yellow
}

Write-Host "[*] Starting Next.js dev server in new terminal window..." -ForegroundColor Green
Write-Host "[*] App will be available at: http://localhost:3002" -ForegroundColor Green
Write-Host ""

# Launch dev server in a new terminal window
$scriptPath = $PSScriptRoot
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
`$Host.UI.RawUI.WindowTitle = 'Open Lovable - Dev Server'
Set-Location '$scriptPath'
Write-Host 'Starting Next.js dev server with Turbopack on port 3002...' -ForegroundColor Green
Write-Host 'Press Ctrl+C to stop the server' -ForegroundColor DarkGray
Write-Host ''
npx next dev --turbopack --port 3002
"@

# Open browser after a short delay
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 3
    Start-Process "http://localhost:3002"
} | Out-Null

Write-Host "[*] Dev server launched in separate window." -ForegroundColor Green
Write-Host ""
