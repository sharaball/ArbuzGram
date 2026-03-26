$ErrorActionPreference = "Stop"

function Write-Step($message) {
  Write-Host ""
  Write-Host "==> $message" -ForegroundColor Cyan
}

function Ensure-Command($commandName) {
  return [bool](Get-Command $commandName -ErrorAction SilentlyContinue)
}

function Refresh-PathForCurrentSession {
  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machinePath;$userPath"
}

Write-Step "Checking Node.js and npm"
if (-not (Ensure-Command "node") -or -not (Ensure-Command "npm")) {
  if (-not (Ensure-Command "winget")) {
    throw "winget is not available. Install Node.js LTS manually: https://nodejs.org/"
  }

  Write-Step "Installing Node.js LTS via winget"
  winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
  Refresh-PathForCurrentSession
}

if (-not (Ensure-Command "node") -or -not (Ensure-Command "npm")) {
  throw "Node.js or npm is still unavailable. Restart PowerShell and run the script again."
}

Write-Step "Versions"
node -v
npm -v

Write-Step "Installing project dependencies"
npm install

if (-not (Test-Path ".env.local")) {
  Write-Step "Creating .env.local"
  "GEMINI_API_KEY=" | Out-File -FilePath ".env.local" -Encoding utf8
  Write-Host ".env.local created. Add your Gemini API key if needed." -ForegroundColor Yellow
}

Write-Step "Starting dev server"
npm run dev
