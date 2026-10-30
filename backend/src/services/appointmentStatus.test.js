import test from "node:test";
import assert from "node:assert/strict";
import { marcarCitasVencidas } from "./appointmentStatus.js";

test("marca vencida solo después de terminar la duración del servicio", async () => {
  const ahora = new Date("2026-10-08T18:00:00.000Z");
  let filtroActualizado;
  const cliente = {
    cita: {
      findMany: async () => [
        {
          id: 1,
          fechaHora: new Date("2026-10-08T17:29:00.000Z"),
          servicio: { duracionMin: 30 },
        },
        {
          id: 2,
          fechaHora: new Date("2026-10-08T17:31:00.000Z"),
          servicio: { duracionMin: 30 },
        },
      ],
      updateMany: async ({ where }) => { filtroActualizado = where; },
    },
  };

  await marcarCitasVencidas({ pacienteId: 12 }, cliente, ahora);

  assert.deepEqual(filtroActualizado.id.in, [1]);
  assert.equal(filtroActualizado.pacienteId, 12);
});

test("no ejecuta una actualización cuando aún no hay citas vencidas", async () => {
  let actualizaciones = 0;
  const cliente = {
    cita: {
      findMany: async () => [],
      updateMany: async () => { actualizaciones += 1; },
    },
  };

  await marcarCitasVencidas({}, cliente, new Date());

  assert.equal(actualizaciones, 0);
});

test("marca vencida una cita que ya terminó aunque tenga una reprogramación pendiente", async () => {
  const ahora = new Date("2026-10-08T18:00:00.000Z");
  let idsActualizados = [];
  let filtroConsultado;
  const cliente = {
    cita: {
      findMany: async ({ where }) => {
        filtroConsultado = where;
        return where.OR ? [] : [{
          id: 3,
          fechaHora: new Date("2026-10-08T17:00:00.000Z"),
          estadoReprogramacion: "PENDIENTE",
          servicio: { duracionMin: 30 },
        }];
      },
      updateMany: async ({ where }) => { idsActualizados = where.id.in; },
    },
  };

  await marcarCitasVencidas({}, cliente, ahora);

  assert.deepEqual(idsActualizados, [3]);
  assert.equal(filtroConsultado.estadoReprogramacion, undefined);
  assert.equal(filtroConsultado.estado.in.includes("CONFIRMADA"), true);
});
