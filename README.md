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
Después de aplicar una migración que cambia los roles, cierra sesión y vuelve a
iniciarla para renovar el token JWT con el hospital asociado.

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
| `POST` | `/api/auth/register` | Público; crea paciente con cédula obligatoria |
| `GET`, `PUT` | `/api/auth/perfil` | Cuenta autenticada; editar datos, imagen y contraseña |
| `GET` | `/api/hospitales` | Público |
| `POST` | `/api/admin/hospitales` | Administrador del sistema |
| `POST` | `/api/admin/personal` | Administrador del sistema |
| `GET`, `POST` | `/api/hospital/servicios` | Público para consulta; personal administrativo para crear |
| `GET` | `/api/medicos` | Público |
| `POST` | `/api/medicos/invitar` | Personal administrativo |
| `GET`, `PUT` | `/api/medicos/perfil` | Médico; PUT también acepta un token de activación |
| `POST` | `/api/medicos` | Personal administrativo (compatibilidad) |
| `POST` | `/api/horarios` | Médico; reemplaza disponibilidad semanal |
| `DELETE` | `/api/medicos/:id/horarios/:horarioId` | Administrativo |
| `GET` | `/api/horarios/disponibles` | Público |
| `POST` | `/api/citas` | Paciente o médico de la agenda |
| `GET` | `/api/citas` | Paciente |
| `PUT` | `/api/citas/:id/cancelar` | Paciente |
| `PUT` | `/api/citas/:id/reprogramar` | Paciente |
| `PUT` | `/api/citas/:id/estado` | Médico de la cita, personal del hospital o administrador del sistema |
| `GET` | `/api/citas/medico` | Médico autenticado |
| `GET` | `/api/citas/proximas` | Próximas citas visibles para la cuenta autenticada |
| `GET` | `/api/citas/todas` | Personal del hospital o administrador del sistema |

## Cuentas de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador del sistema | `sistema@demo.com` | `1234` |
| Paciente | `paciente@demo.com` | `1234` |
| Paciente | `maria.lopez@demo.com` | `1234` |
| Paciente | `jose.perez@demo.com` | `1234` |
| Paciente | `lucia.gomez@demo.com` | `1234` |
| Médico | `medico@demo.com` | `1234` |
| Médico | `medico4@demo.com` | `1234` |
| Administrativo | `admin@demo.com` | `1234` |
| Administrativo | `admin.colinas@demo.com` | `1234` |

La semilla crea además una segunda clínica, sus servicios y perfiles de
demostración, horarios semanales y citas futuras de ejemplo. Puedes volver a
cargar estos datos sin borrar las citas existentes con `npm run db:seed` desde
`backend`.

La cuenta inicial `ADMIN_SISTEMA` se configura con `ADMIN_SISTEMA_EMAIL` y
`ADMIN_SISTEMA_PASSWORD` en `backend\.env`. La contraseña predeterminada `1234`
es únicamente para desarrollo local; reemplázala antes de desplegar.

## Funcionalidad multi-hospital

- El administrador del sistema crea hospitales y sus cuentas administrativas
  desde `/sistema`.
- El personal administrativo gestiona el catálogo de servicios, invita
  médicos y administra las citas de su hospital desde `/admin`. La gestión de
  médicos y horarios heredada continúa disponible en `/admin/medicos`.
- El médico completa su perfil desde el enlace de invitación, actualiza su
  disponibilidad semanal, consulta su agenda y asigna citas buscando pacientes
  por correo o cédula.
- El paciente selecciona hospital, servicio, médico y horario en un flujo de
  tres pasos; puede continuar reprogramando sus citas desde el historial.
- Los perfiles permiten actualizar nombre, correo, imagen mediante archivo o URL y
  contraseña con verificación de la contraseña actual. La cédula es obligatoria
  al crear y actualizar una cuenta de paciente; las contraseñas nuevas requieren
  al menos ocho caracteres. Los archivos de imagen admiten PNG, JPEG y WebP
  hasta 512 KB.
- Cada cuenta puede activar el modo oscuro desde la barra superior. La
  navegación, formularios, selector visual de hospitales, tablas y paneles se
  adaptan a pantallas de escritorio, tablet y teléfono.
- La campana de notificaciones muestra hasta ocho citas futuras activas según
  el rol y ámbito de acceso de la cuenta.
- El administrador del sistema puede asociar un logo a cada hospital. Los
  hospitales se muestran con su logo en el flujo de reserva y en el panel. Se
  puede cargar un archivo PNG, JPEG o WebP de hasta 512 KB o proporcionar una
  URL; las imágenes cargadas se almacenan en la base de datos.
- Las citas nuevas quedan en estado `PENDIENTE`; los servicios determinan la
  duración de los bloques de la agenda. La migración incremental asigna el
  hospital y un servicio por defecto a los datos existentes y conserva las
  citas. El índice único parcial continúa evitando reservas simultáneas,
  incluidas las pendientes, y libera las citas canceladas.

Las invitaciones y notificaciones de cita usan Resend. Para enviar invitaciones
configura `RESEND_API_KEY`, `EMAIL_FROM` y `FRONTEND_URL` en `backend\.env`. Si
el correo de invitación falla, se informa el error y no se conserva la cuenta
invitada. Una cita sí se conserva si el correo de notificación falla; la API
indica el resultado de la notificación en la respuesta.

Se mantienen React, Vite, Express, Prisma y PostgreSQL y la hoja de estilos CSS
existente: no se añade TailwindCSS ni se cambia el stack. La especificación
actualizada está en `backend/openapi.yaml` y se sirve en `/api/docs`.

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
