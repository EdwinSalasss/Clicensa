import test from "node:test";
import assert from "node:assert/strict";
import {
  obtenerCalendarioDisponibilidad,
  obtenerHorariosDisponibles,
} from "./availability.js";

function fechaFutura() {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 2);
  return fecha.toISOString().slice(0, 10);
}

test("excluye citas activas y solicitudes de reprogramación de los horarios libres", async () => {
  const fecha = fechaFutura();
  const diaSemana = new Date(`${fecha}T00:00:00.000Z`).getUTCDay();
  const prisma = {
    tipoServicio: {
      findUnique: async () => ({ id: 7, hospitalId: 3, duracionMin: 30 }),
    },
    horarioBase: { findMany: async () => [] },
    cita: {
      findMany: async ({ where }) => where.estadoReprogramacion === "PENDIENTE"
        ? [{
            fechaReprogramacion: fecha,
            horaReprogramacion: "10:00",
            servicio: { duracionMin: 30 },
          }]
        : [{ fecha, hora: "08:30", servicio: { duracionMin: 30 } }],
    },
  };

  const disponibles = await obtenerHorariosDisponibles(prisma, {
    id: 11,
    hospitalId: 3,
    disponibilidad: [{ diaSemana, horaInicio: "08:00", horaFin: "11:00" }],
  }, fecha, 7);

  assert.deepEqual(disponibles, ["08:00", "09:00", "09:30", "10:30"]);
});

test("oculta todos los horarios cuando el servicio no pertenece al hospital del médico", async () => {
  const prisma = {
    tipoServicio: { findUnique: async () => ({ id: 7, hospitalId: 99, duracionMin: 30 }) },
  };
  const disponibles = await obtenerHorariosDisponibles(prisma, {
    id: 11,
    hospitalId: 3,
    disponibilidad: [],
  }, fechaFutura(), 7);

  assert.deepEqual(disponibles, []);
});

test("calcula en una consulta de rango qué días quedan sin horas por citas y solicitudes", async () => {
  const inicio = new Date();
  inicio.setUTCDate(inicio.getUTCDate() + 7);
  const desde = inicio.toISOString().slice(0, 10);
  const segundoDia = new Date(inicio);
  segundoDia.setUTCDate(segundoDia.getUTCDate() + 1);
  const fechaSolicitud = segundoDia.toISOString().slice(0, 10);
  const hasta = new Date(segundoDia);
  hasta.setUTCDate(hasta.getUTCDate() + 1);
  const rangoFinal = hasta.toISOString().slice(0, 10);
  const prisma = {
    horarioBase: { findMany: async () => [] },
    cita: {
      findMany: async ({ where }) => where.estadoReprogramacion === "PENDIENTE"
        ? [{
            fechaReprogramacion: fechaSolicitud,
            horaReprogramacion: "08:00",
            servicio: { duracionMin: 30 },
          }, {
            fechaReprogramacion: fechaSolicitud,
            horaReprogramacion: "08:30",
            servicio: { duracionMin: 30 },
          }]
        : [{
            fecha: desde,
            hora: "08:00",
            servicio: { duracionMin: 30 },
          }],
    },
  };

  const dias = await obtenerCalendarioDisponibilidad(
    prisma,
    {
      id: 11,
      hospitalId: 3,
      disponibilidad: Array.from({ length: 7 }, (_, diaSemana) => ({
        diaSemana,
        horaInicio: "08:00",
        horaFin: "09:00",
      })),
    },
    { id: 7, hospitalId: 3, duracionMin: 30 },
    desde,
    rangoFinal
  );

  assert.deepEqual(dias.map((dia) => dia.disponibles), [["08:30"], [], ["08:00", "08:30"]]);
});
