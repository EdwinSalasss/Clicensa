# CLISENSA

Sistema de gestión de citas médicas con React, Express, Prisma y PostgreSQL.

## Requisitos

- Git, para clonar el repositorio.
- Node.js 20 o superior y npm.
- Docker Engine y Docker Compose (disponible como `docker compose`), para
  ejecutar PostgreSQL. En Windows puedes usar Docker Desktop; en macOS y Linux,
  Docker Desktop o Docker Engine con Compose.

## Instalación inicial

Los pasos siguientes sirven para Windows, macOS y Linux. Ejecuta los comandos
desde una terminal. Si tienes acceso al repositorio, clónalo así:

```sh
git clone https://github.com/EdwinSalasss/Clicensa.git
cd Clicensa
```

Si ya tienes una copia local, omite el `git clone` y entra en la carpeta raíz
del proyecto.

Crea la configuración local del backend copiando el archivo de ejemplo.
En PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

En macOS o Linux:

```sh
cp backend/.env.example backend/.env
```

Abre `backend/.env` y revisa la configuración:

- `DATABASE_URL` debe conectar con la base PostgreSQL que inicia Docker Compose.
  El valor de ejemplo coincide con las credenciales de desarrollo de
  `docker-compose.yml`.
- Cambia `JWT_SECRET` por una cadena aleatoria de al menos 32 caracteres.
- `ADMIN_SISTEMA_EMAIL` y `ADMIN_SISTEMA_PASSWORD` definen la cuenta inicial
  administradora. La contraseña de ejemplo es solo para desarrollo.
- `RESEND_API_KEY` y `EMAIL_FROM` son opcionales para iniciar la aplicación,
  pero se requieren para enviar correos de invitación y notificación.

La URL de API del frontend ya apunta por defecto a `http://localhost:4000/api`.
Si necesitas cambiarla, copia `frontend/.env.example` a `frontend/.env` y
actualiza `VITE_API_URL`.

Inicia PostgreSQL desde la raíz del repositorio y comprueba que el contenedor
esté saludable:

```sh
docker compose up -d db
docker compose ps
```

En una terminal instala las dependencias del backend, aplica las migraciones y
carga los datos de demostración:

```sh
cd backend
npm ci
npx prisma migrate deploy
npm run db:seed
```

`npm ci` instala las dependencias fijadas en el archivo de bloqueo y genera el
cliente de Prisma. `prisma migrate deploy` prepara el esquema de la base de
datos; el seed crea cuentas y datos de demostración. Ejecuta el seed solo en
entornos de desarrollo o prueba.

Al terminar la instalación, inicia el backend desde la terminal que ya está
ubicada en `backend`:

```sh
npm run dev
```

Abre una segunda terminal en la raíz del proyecto e inicia el frontend:

```sh
cd frontend
npm ci
npm run dev
```

Abre http://localhost:5173. Mantén abiertas las terminales del backend y del
frontend mientras uses la aplicación. Cuando termines, detén esos procesos con
`Ctrl+C`. Para detener PostgreSQL sin borrar sus datos, desde la raíz ejecuta
`docker compose stop db`.

En los siguientes inicios, no hace falta repetir `npm ci`, las migraciones ni
la semilla: inicia PostgreSQL con `docker compose up -d db` y ejecuta
`npm run dev` desde `backend` y `frontend` en dos terminales distintas.

Los archivos `iniciar.bat`, `detener.bat` y `scripts/*-windows.ps1` son
accesos directos opcionales exclusivos para Windows; no son necesarios para
seguir estos pasos.

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
| `GET` | `/api/horarios/calendario` | Público; disponibilidad por día para un rango de hasta 31 días |
| `POST` | `/api/citas` | Paciente o médico de la agenda |
| `GET` | `/api/citas` | Paciente |
| `PUT` | `/api/citas/:id/cancelar` | Paciente |
| `PUT` | `/api/citas/:id/reprogramar` | Paciente; crea una solicitud pendiente de aprobación |
| `GET` | `/api/citas/solicitudes-reprogramacion` | Médico asignado |
| `PUT` | `/api/citas/:id/reprogramacion/decision` | Médico asignado; aprobar o rechazar |
| `PUT` | `/api/citas/:id/estado` | Médico asignado; personal del hospital puede cancelar citas de su sede |
| `GET` | `/api/citas/medico` | Médico autenticado |
| `GET` | `/api/citas/proximas` | Paciente o médico; solo muestra sus propias citas |
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
- El personal administrativo pertenece a un hospital y gestiona solo los
  servicios, médicos y citas de esa sede. El médico completa su perfil y crea
  su contraseña desde el enlace de invitación enviado por correo, actualiza su
  disponibilidad semanal, consulta su agenda y asigna citas buscando pacientes
  por correo o cédula.
- El paciente selecciona hospital, servicio, médico y horario en un flujo de
  tres pasos. Solo se muestran médicos activos de la sede seleccionada; el
  calendario consulta en bloque la disponibilidad del mes, resalta los días con
  cupo y muestra botones grandes para elegir una hora libre. Los días agotados
  no se pueden seleccionar.
- Al solicitar una reprogramación, el mismo calendario consulta primero los
  horarios libres del médico y servicio originales. El paciente elige un día
  con cupo y una hora disponible mediante botones, sin escribir ni ajustar la
  hora manualmente.
- Las solicitudes de cita quedan pendientes hasta que el médico asignado las
  confirme. Una solicitud de reprogramación no mueve ni libera la cita original:
  el horario propuesto también queda reservado mientras espera la decisión del
  mismo médico. Al aprobarla, se actualizan fecha y hora; al rechazarla, se
  conserva la cita original. Pacientes y médicos reciben avisos; el personal
  administrativo y el administrador del sistema no tienen notificaciones de
  citas pendientes.
- El médico asignado es quien confirma las citas, aprueba o rechaza las
  reprogramaciones y las marca como atendidas. Las citas pendientes o
  confirmadas pasan a `VENCIDA` al terminar la duración del servicio; una tarea
  periódica las actualiza y las consultas también refrescan ese estado. El
  médico aún puede registrarlas como atendidas. El personal administrativo
  puede cancelar citas de su hospital, pero no confirmarlas ni marcarlas como
  atendidas.
- Los perfiles permiten actualizar nombre, correo, imagen mediante archivo o URL y
  contraseña con verificación de la contraseña actual. La cédula es obligatoria
  al crear y actualizar una cuenta de paciente; las contraseñas nuevas requieren
  al menos ocho caracteres. Los archivos de imagen admiten PNG, JPEG y WebP
  hasta 512 KB.
- Cada cuenta puede activar el modo oscuro desde la barra superior. La
  navegación, formularios, selector visual de hospitales, tablas y paneles se
  adaptan a pantallas de escritorio, tablet y teléfono.
- La campana de notificaciones solo aparece para pacientes y médicos y muestra
  sus próximas citas y solicitudes de reprogramación pendientes.
- El administrador del sistema puede asociar un logo a cada hospital. Los
  hospitales se muestran con su logo en el flujo de reserva y en el panel. Se
  puede cargar un archivo PNG, JPEG o WebP de hasta 512 KB o proporcionar una
  URL; las imágenes cargadas se almacenan en la base de datos.
- Las citas nuevas quedan en estado `PENDIENTE`; los servicios determinan la
  duración de los bloques de la agenda. La migración incremental asigna el
  hospital y un servicio por defecto a los datos existentes y conserva las
  citas. El índice único parcial continúa evitando reservas simultáneas,
  incluidas las pendientes. Los horarios propuestos para reprogramación también
  se excluyen de la disponibilidad hasta que el médico los apruebe o rechace;
  los horarios cancelados y vencidos quedan libres.

Las invitaciones y notificaciones de cita usan Resend. Para enviar invitaciones
configura `RESEND_API_KEY`, `EMAIL_FROM` y `FRONTEND_URL` en `backend/.env`. Si
el correo de invitación falla, se informa el error y no se conserva la cuenta
invitada. Una cita sí se conserva si el correo de notificación falla; la API
indica el resultado de la notificación en la respuesta.

Se mantienen React, Vite, Express, Prisma y PostgreSQL y la hoja de estilos CSS
existente: no se añade TailwindCSS ni se cambia el stack. La especificación
actualizada está en `backend/openapi.yaml` y se sirve en `/api/docs`.

## Estructura principal

```text
backend/              API Express y Prisma
backend/prisma/       Esquema, migraciones y seed
frontend/             Aplicación React
docker-compose.yml    PostgreSQL local
scripts/              Automatización opcional para Windows
```

## Solución rápida de problemas

- **Docker no responde:** verifica que Docker Engine esté iniciado y que
  `docker compose version` funcione en la terminal.
- **La base de datos no está disponible:** ejecuta `docker compose ps` desde la
  raíz del proyecto y confirma que PostgreSQL esté saludable. Comprueba que
  `DATABASE_URL` en `backend/.env` coincida con el puerto, nombre de base y
  credenciales configurados en `docker-compose.yml`.
- **Puerto ocupado:** libera los puertos `4000`, `5173` o `5432`, o modifica
  los valores de configuración correspondientes.
- **Falla una migración:** confirma que PostgreSQL esté activo y que
  `DATABASE_URL` apunte a la base correcta; después vuelve a ejecutar
  `npx prisma migrate deploy` desde `backend`.
- **El frontend no alcanza la API:** comprueba que el backend esté activo y
  que `VITE_API_URL` apunte a `http://localhost:4000/api`.

Los archivos locales de configuración (`backend/.env`, `frontend/.env`), las
dependencias (`node_modules`), los artefactos (`dist`) y el volumen de datos
PostgreSQL no se incluyen al clonar el repositorio. Cada persona debe preparar
su configuración y su propia base de desarrollo.
