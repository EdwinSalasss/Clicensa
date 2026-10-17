import test from "node:test";
import assert from "node:assert/strict";
import { fechaHoraFutura, fechaValida, minutos } from "./dateTime.js";

test("minutos convierte horas válidas y rechaza formatos inválidos", () => {
  assert.equal(minutos("00:00"), 0);
  assert.equal(minutos("09:30"), 570);
  assert.equal(minutos("23:59"), 1439);
  assert.equal(minutos("24:00"), null);
  assert.equal(minutos("9:30"), null);
});

test("fechaValida solo acepta fechas reales en formato ISO", () => {
  assert.equal(fechaValida("2026-10-16"), true);
  assert.equal(fechaValida("2026-02-29"), false);
  assert.equal(fechaValida("16-10-2026"), false);
  assert.equal(fechaValida(null), false);
});

test("fechaHoraFutura distingue horarios futuros de pasados", () => {
  assert.equal(fechaHoraFutura("2099-01-01", "12:00"), true);
  assert.equal(fechaHoraFutura("2000-01-01", "12:00"), false);
});
