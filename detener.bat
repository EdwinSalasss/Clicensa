@echo off
cd /d "%~dp0"
docker compose stop db
if errorlevel 1 (
  echo.
  echo No se pudo detener PostgreSQL.
  echo Comprueba que Docker Desktop este abierto.
  pause
  exit /b 1
)
echo PostgreSQL detenido. Los datos se conservaron.
echo Cerrando Docker Desktop...
docker desktop stop
if errorlevel 1 (
  echo No se pudo cerrar Docker Desktop automaticamente.
  echo Puedes cerrarlo manualmente y ejecutar "wsl --shutdown".
  pause
  exit /b 1
)
echo Cerrando WSL 2 para liberar memoria...
wsl --shutdown
if errorlevel 1 (
  echo No se pudo ejecutar wsl --shutdown.
  pause
  exit /b 1
)
echo CLISENSA, Docker Desktop y WSL 2 fueron detenidos.
pause
