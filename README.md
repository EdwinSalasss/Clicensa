# CLISENSA — Sistema de Gestión de Citas Médicas

Avance funcional (Fase 2) del proyecto CLISENSA — Grupo 5S3-SIS-S,
asignatura Diseño de Sistemas en Internet.

## Novedades de este avance

Respecto al avance anterior (que solo tenía la pantalla de agendar cita),
ahora cada rol tiene su propia pantalla, tal como se definió en el Mapa de
Navegación de la Fase 1 (Figura 4):

- **Home** (`/`): portal público de bienvenida, con acceso a iniciar sesión.
- **Login** (`/login`): autentica y redirige automáticamente según el rol.
- **Panel del Paciente**:
  - `/paciente/agendar` — agendar cita (especialidad → médico → horario → confirmar).
  - `/paciente/historial` — ver y cancelar sus propias citas.
- **Panel del Médico** (`/medico`): agenda del día propia, con nombre del
  paciente en cada cita. Ya **no comparte pantalla con el paciente**.
- **Panel Administrativo** (`/admin`): vista global de citas del centro médico
  con contadores de confirmadas/canceladas.

El backend ahora valida el rol en cada endpoint (un paciente no puede leer
la agenda de un médico, ni un médico la vista administrativa) — devuelve
`403 Forbidden` si el rol no corresponde.

## Estructura

```
clisensa/
├── backend/     API REST (Node.js + Express)
└── frontend/    Interfaz web (React + Vite + React Router)
```

## Cómo ejecutarlo localmente

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API disponible en `http://localhost:4000`. Verificación rápida:
`http://localhost:4000/api/health`.

### 2. Frontend (en otra terminal)

```bash
cd frontend
npm install
npm run dev
```

Aplicación disponible en `http://localhost:5173`.

### Cuentas de prueba

| Rol | Correo | Contraseña | A dónde va al iniciar sesión |
|---|---|---|---|
| Paciente | paciente@demo.com | 1234 | Agendar Cita |
| Médico | medico@demo.com | 1234 | Agenda del Día |
| Administrativo | admin@demo.com | 1234 | Panel Administrativo |

## Endpoints del backend

| Método | Ruta | Rol requerido | Descripción |
|---|---|---|---|
| POST | `/api/auth/login` | — | Autenticación y emisión de JWT |
| GET | `/api/medicos?especialidad=` | — | Listado de médicos filtrado |
| GET | `/api/horarios/disponibles?medicoId=&fecha=` | — | Disponibilidad en tiempo real |
| POST | `/api/citas` | paciente | Crear una cita |
| GET | `/api/citas` | paciente | Listar mis citas |
| PUT | `/api/citas/:id/cancelar` | paciente | Cancelar mi cita |
| GET | `/api/citas/medico?fecha=` | medico | Agenda del día del médico autenticado |
| GET | `/api/citas/todas?fecha=` | administrativo | Vista global de citas (reportes) |

## Qué falta (próximos avances)

- Persistencia real en PostgreSQL vía Prisma/Sequelize (hoy los datos viven
  en memoria y se reinician al reiniciar el servidor).
- Registro de nuevos pacientes (hoy solo hay usuarios semilla).
- Reprogramación de citas (hoy solo se puede cancelar, RF03 parcial).
- Gestión de médicos/horarios desde el Panel Administrativo (RF06, RF07).
- Documentación OpenAPI/Swagger de la API.
- Recordatorios automáticos por correo (RF05).

## Documentación relacionada

Los documentos de la Fase 1 (Diagnóstico, Marco Lógico, Ingeniería de
Requisitos, Arquitectura y Diagramas UWE) se encuentran en la carpeta
`docs/` de este mismo repositorio.
