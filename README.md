# CLISENSA — Sistema de Gestión de Citas Médicas

Avance funcional inicial (Fase 2) del proyecto CLISENSA, desarrollado para la
asignatura **Diseño de Sistemas en Internet** — Grupo 5S3-SIS-S.

Este avance implementa el flujo principal identificado en la Fase 1
(Diagrama de Casos de Uso de Proceso — RF01, RF02, RF04): iniciar sesión y
agendar una cita médica seleccionando especialidad, médico y horario
disponible, consumiendo una API REST real.

## Estructura

```
clisensa/
├── backend/     API REST (Node.js + Express)
└── frontend/    Interfaz web (React + Vite)
```

## Cómo ejecutarlo localmente

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

El API queda disponible en `http://localhost:4000`.
Verificación rápida: abrir `http://localhost:4000/api/health`.

### 2. Frontend (en otra terminal)

```bash
cd frontend
npm install
npm run dev
```

La aplicación queda disponible en `http://localhost:5173`.

### Cuenta de prueba

- Correo: `paciente@demo.com`
- Contraseña: `1234`

## Endpoints implementados en este avance

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Autenticación y emisión de JWT |
| GET | `/api/medicos?especialidad=` | Listado de médicos filtrado |
| GET | `/api/horarios/disponibles?medicoId=&fecha=` | Disponibilidad en tiempo real |
| POST | `/api/citas` | Crear una cita (requiere token) |
| GET | `/api/citas` | Listar mis citas (requiere token) |
| PUT | `/api/citas/:id/cancelar` | Cancelar una cita (requiere token) |

## Qué falta (próximos avances — Fase 2 completa)

- Persistencia real en PostgreSQL vía Prisma/Sequelize (ahora mismo los datos
  viven en memoria y se reinician al reiniciar el servidor).
- Endpoints de reprogramación de citas, gestión de médicos/horarios y reportes
  administrativos (RF03, RF06–RF09).
- Documentación OpenAPI/Swagger de la API.
- Registro de nuevos pacientes (RF01, hoy solo hay usuarios semilla).
- Recordatorios automáticos por correo (RF05).

## Documentación relacionada

Los documentos de la Fase 1 (Diagnóstico, Marco Lógico, Ingeniería de
Requisitos, Arquitectura y Diagramas UWE) se encuentran en la carpeta
`docs/` de este mismo repositorio.
