import test from "node:test";
import assert from "node:assert/strict";
import { crearResumenCitas } from "./reporting.js";

test("calcula estados e ingresos atendidos y por atender sin sumar cancelaciones", () => {
  const resultado = crearResumenCitas([
    {
      id: 1,
      fecha: "2026-10-29",
      hora: "09:00",
      estado: "ATENDIDA",
      paciente: { nombre: "Ana" },
      medico: { nombre: "Dr. Uno" },
      servicio: { nombre: "Consulta", precio: "25.50" },
    },
    {
      id: 2,
      fecha: "2026-10-29",
      hora: "09:30",
      estado: "PENDIENTE",
      paciente: { nombre: "Luis" },
      medico: { nombre: "Dr. Uno" },
      servicio: { nombre: "Consulta", precio: "25.50" },
    },
    {
      id: 3,
      fecha: "2026-10-29",
      hora: "10:00",
      estado: "CANCELADA",
      paciente: { nombre: "Eva" },
      medico: { nombre: "Dr. Uno" },
      servicio: { nombre: "Consulta", precio: "25.50" },
    },
  ]);

  assert.deepEqual(resultado.resumen.porEstado, {
    PENDIENTE: 1,
    CONFIRMADA: 0,
    CANCELADA: 1,
    ATENDIDA: 1,
    VENCIDA: 0,
  });
  assert.equal(resultado.resumen.totalCitas, 3);
  assert.equal(resultado.resumen.ingresosAtendidos, 25.5);
  assert.equal(resultado.resumen.ingresosPendientes, 25.5);
  assert.equal(resultado.resumen.ingresosPotenciales, 51);
  assert.equal(resultado.citas[2].precio, 25.5);
});
