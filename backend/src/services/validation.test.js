import test from "node:test";
import assert from "node:assert/strict";
import { contrasenaValida, telefonoValido } from "./validation.js";

test("acepta teléfonos locales e internacionales con separadores comunes", () => {
  assert.equal(telefonoValido("8888-8888"), true);
  assert.equal(telefonoValido("+505 8888 8888"), true);
  assert.equal(telefonoValido("(212) 555-0100"), true);
});

test("rechaza teléfonos con letras o una cantidad incorrecta de dígitos", () => {
  assert.equal(telefonoValido("123456"), false);
  assert.equal(telefonoValido("1234567890123456"), false);
  assert.equal(telefonoValido("555-ABCD"), false);
});

test("limita contraseñas a un mínimo de 8 caracteres y 72 bytes", () => {
  assert.equal(contrasenaValida("clave123"), true);
  assert.equal(contrasenaValida("corta"), false);
  assert.equal(contrasenaValida("á".repeat(37)), false);
});
