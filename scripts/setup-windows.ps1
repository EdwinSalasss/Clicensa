$ErrorActionPreference = "Stop"

function Require-Command($name, $installHint) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "$name no esta instalado. $installHint"
  }
}

Write-Host "Preparando CLISENSA..." -ForegroundColor Cyan
Require-Command "node" "Instala Node.js 20 o superior desde https://nodejs.org/"
Require-Command "npm" "Instala Node.js 20 o superior desde https://nodejs.org/"
Require-Command "docker" "Instala Docker Desktop, abrelo y espera a que este iniciado."

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  throw "Docker Desktop no esta iniciado. Abrelo y vuelve a ejecutar este script."
}

if (-not (Test-Path "backend\.env")) {
  Copy-Item "backend\.env.example" "backend\.env"
  Write-Host "Creado backend\.env"
}

Write-Host "Instalando dependencias del backend..."
Push-Location "backend"
npm install
Pop-Location

Write-Host "Instalando dependencias del frontend..."
Push-Location "frontend"
npm install
Pop-Location

Write-Host "Levantando PostgreSQL..."
docker compose up -d db

Write-Host "Esperando a que PostgreSQL este saludable..."
for ($attempt = 1; $attempt -le 30; $attempt++) {
  $status = docker compose ps --format "{{.Health}}" db 2>$null
  if ($status -eq "healthy") {
    Write-Host "PostgreSQL esta listo." -ForegroundColor Green
    Push-Location "backend"
    npm run db:migrate
    npm run db:seed
    Pop-Location
    exit 0
  }
  Start-Sleep -Seconds 2
}

docker compose ps
throw "PostgreSQL no llego a estado saludable. Revisa: docker compose logs db"
