# CLISENSA

Sistema de gestión de citas médicas con React, Express, Prisma y PostgreSQL.

## Requisitos

- Git
- Node.js 20 o superior
- Docker Desktop
- WSL 2 en Windows. Si no está instalado, abre PowerShell como administrador y
  ejecuta `wsl --install`; después reinicia Windows si se solicita.

PostgreSQL se ejecuta en Docker. No es necesario instalar PostgreSQL
directamente en Windows.

## Instalación inicial

Abre Docker Desktop, espera a que termine de iniciar y ejecuta desde la raíz
del proyecto:

```powershell
cd C:\Users\HP\Downloads\clisensa
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup-windows.ps1
```

El script instala las dependencias, crea `backend\.env`, inicia PostgreSQL,
ejecuta las migraciones de Prisma y carga los datos de prueba. Solo necesitas
ejecutarlo la primera vez o después de clonar el proyecto en otro equipo.

## Flujo diario

Después de completar la instalación inicial:

1. Haz doble clic en `iniciar.bat`. Si Docker Desktop está cerrado, el script
   intentará iniciarlo y esperará a que el motor esté listo.
2. Abre http://localhost:5173.
3. Cuando termines, cierra las ventanas del backend y frontend.
4. Haz doble clic en `detener.bat` para detener PostgreSQL sin borrar datos y
   cerrar Docker Desktop y WSL 2.

## Iniciar todo

Después de la instalación inicial, puedes iniciar la aplicación de cualquiera
de estas formas:

### Con doble clic

Abre la carpeta `C:\Users\HP\Downloads\clisensa` en el Explorador de archivos
y haz doble clic en [`iniciar.bat`](./iniciar.bat). El archivo abre dos
ventanas de PowerShell: una para el backend y otra para el frontend. Déjalas
abiertas mientras uses el sistema.

### Desde PowerShell

```powershell
cd C:\Users\HP\Downloads\clisensa
.\scripts\start-windows.ps1
```

El script inicia Docker Desktop si está cerrado, inicia PostgreSQL, espera a
que esté saludable, aplica las migraciones y abre backend y frontend.

## URLs

- Aplicación: http://localhost:5173
- API: http://localhost:4000
- Healthcheck: http://localhost:4000/api/health
- Documentación interactiva de la API (Swagger): http://localhost:4000/api/docs
- Especificación OpenAPI en JSON: http://localhost:4000/api/openapi.json

La colección de pruebas para importar en Postman está en
`backend/postman/CLISENSA.postman_collection.json`.

## Endpoints principales

| Método | Ruta | Acceso |
|---|---|---|
| `POST` | `/api/auth/login` | Público |
| `POST` | `/api/auth/register` | Público; crea paciente |
| `GET` | `/api/medicos` | Público |
| `POST` | `/api/medicos` | Administrativo |
| `POST` | `/api/medicos/:id/horarios` | Administrativo |
| `DELETE` | `/api/medicos/:id/horarios/:horarioId` | Administrativo |
| `GET` | `/api/horarios/disponibles` | Público |
| `POST` | `/api/citas` | Paciente |
| `GET` | `/api/citas` | Paciente |
| `PUT` | `/api/citas/:id/cancelar` | Paciente |
| `PUT` | `/api/citas/:id/reprogramar` | Paciente |
| `GET` | `/api/citas/medico` | Médico |
| `GET` | `/api/citas/todas` | Administrativo |

## Cuentas de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Paciente | `paciente@demo.com` | `1234` |
| Médico | `medico@demo.com` | `1234` |
| Administrativo | `admin@demo.com` | `1234` |

## Detener PostgreSQL

Cierra las ventanas del backend y frontend. Para detener PostgreSQL sin borrar
sus datos:

```powershell
cd C:\Users\HP\Downloads\clisensa
docker compose stop db
```

Para iniciar nuevamente, usa `iniciar.bat`.

También puedes hacer doble clic en [`detener.bat`](./detener.bat) desde la
carpeta del proyecto. Detiene PostgreSQL sin borrar sus datos, cierra Docker
Desktop y ejecuta `wsl --shutdown`.

## Apagado completo en Windows

`detener.bat` realiza automáticamente el apagado completo: detiene PostgreSQL,
cierra Docker Desktop y ejecuta `wsl --shutdown` para liberar la memoria de
WSL 2. Si prefieres hacerlo manualmente:

1. Cierra las ventanas del backend y frontend.
2. Haz doble clic en `detener.bat`.
3. Cierra Docker Desktop desde su icono en la bandeja del sistema:
   **clic derecho → Quit Docker Desktop**.
4. Abre PowerShell y ejecuta:

```powershell
wsl --shutdown
```

Puedes comprobar que no haya distribuciones WSL activas con:

```powershell
wsl --list --running
```

Si aparece `Ubuntu`, puedes detenerla específicamente y repetir el apagado:

```powershell
wsl --terminate Ubuntu
wsl --shutdown
```

`vmmemWSL` puede tardar unos segundos en desaparecer del Administrador de
tareas. No lo finalices manualmente; `wsl --shutdown` es la forma segura de
liberar la memoria. Para volver a trabajar, abre Docker Desktop y después
ejecuta `iniciar.bat`.

## Estructura principal

```text
backend/              API Express y Prisma
backend/prisma/       Esquema, migraciones y seed
frontend/             Aplicación React
docker-compose.yml    PostgreSQL local
scripts/              Automatización para Windows
iniciar.bat           Lanzador de toda la aplicación
detener.bat           Detiene PostgreSQL sin borrar datos
```

## Solución rápida de problemas

- **Docker no responde:** abre Docker Desktop y espera a que termine de
  iniciar.
- **Puerto ocupado:** libera los puertos `4000`, `5173` o `5432`.
- **`docker compose` no encuentra configuración:** ejecuta el comando desde
  `C:\Users\HP\Downloads\clisensa`.
- **`iniciar.bat` no funciona desde Ubuntu/WSL:** ejecútalo con doble clic en
  Windows o desde PowerShell; es un archivo de Windows.

## Rutas y colaboración

Los scripts no dependen de una ruta fija. Usan la carpeta donde está el propio
archivo, por lo que funcionan aunque cada participante clone el repositorio en
una ubicación diferente.

Los archivos locales `backend\.env`, `.env`, `node_modules`, `dist` y los datos
de PostgreSQL no se suben al repositorio. Cada participante debe instalar sus
propias dependencias y tener Docker Desktop iniciado.

`npm run db:seed` sincroniza las cuentas y horarios de demostración sin borrar
citas existentes. Las reservas activas tienen además una restricción única en
PostgreSQL para impedir que solicitudes simultáneas ocupen el mismo horario.
