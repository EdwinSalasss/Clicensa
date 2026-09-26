$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

foreach ($command in @("node", "npm", "docker")) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "$command no esta instalado. Ejecuta .\scripts\setup-windows.ps1 primero."
  }
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Iniciando Docker Desktop..." -ForegroundColor Cyan
  docker desktop start --detach
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo iniciar Docker Desktop. Abrelo manualmente y vuelve a ejecutar este comando."
  }

  $dockerListo = $false
  for ($attempt = 1; $attempt -le 60; $attempt++) {
    Start-Sleep -Seconds 2
    docker info *> $null
    if ($LASTEXITCODE -eq 0) {
      $dockerListo = $true
      break
    }
    Write-Host "Esperando a que Docker Desktop este listo ($attempt/60)..."
  }

  if (-not $dockerListo) {
    throw "Docker Desktop no inicio a tiempo. Revisa Docker Desktop y vuelve a intentar."
  }
}

if (-not (Test-Path "backend\.env")) {
  throw "Falta backend\.env. Ejecuta .\scripts\setup-windows.ps1 primero."
}

docker compose up -d db

for ($attempt = 1; $attempt -le 30; $attempt++) {
  $status = (docker compose ps --format "{{.Health}}" db 2>$null).Trim()
  if ($status -eq "healthy") {
    break
  }
  if ($attempt -eq 30) {
    docker compose ps
    throw "PostgreSQL no llego a estado saludable. Revisa: docker compose logs db"
  }
  Start-Sleep -Seconds 2
}

Push-Location "backend"
npm run db:migrate
Pop-Location

Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; npm run dev"
Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"

Write-Host "Backend:  http://localhost:4000" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Green
