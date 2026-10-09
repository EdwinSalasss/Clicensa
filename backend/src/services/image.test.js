import test from "node:test";
import assert from "node:assert/strict";
import { esReferenciaImagenValida } from "./image.js";

const firmaPng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const firmaJpeg = Buffer.from([255, 216, 255, 0]);
const firmaWebp = Buffer.from("RIFF0000WEBP");

test("acepta URL HTTP y HTTPS", () => {
  assert.equal(esReferenciaImagenValida("https://example.com/avatar.png"), true);
  assert.equal(esReferenciaImagenValida("http://example.com/avatar.png"), true);
  assert.equal(esReferenciaImagenValida("javascript:alert(1)"), false);
  assert.equal(esReferenciaImagenValida("https://"), false);
});

test("acepta datos de imagen PNG, JPEG y WebP con su firma correspondiente", () => {
  for (const [tipo, firma] of [
    ["png", firmaPng],
    ["jpeg", firmaJpeg],
    ["webp", firmaWebp],
  ]) {
    assert.equal(
      esReferenciaImagenValida(`data:image/${tipo};base64,${firma.toString("base64")}`),
      true
    );
  }
});

test("rechaza SVG, firmas inválidas y datos superiores a 512 KB", () => {
  assert.equal(
    esReferenciaImagenValida(`data:image/svg+xml;base64,${firmaPng.toString("base64")}`),
    false
  );
  assert.equal(
    esReferenciaImagenValida(`data:image/png;base64,${firmaJpeg.toString("base64")}`),
    false
  );
  const demasiadoGrande = Buffer.concat([firmaPng, Buffer.alloc(512 * 1024)]);
  assert.equal(
    esReferenciaImagenValida(`data:image/png;base64,${demasiadoGrande.toString("base64")}`),
    false
  );
});

test("acepta referencias vacías para quitar la imagen", () => {
  assert.equal(esReferenciaImagenValida(null), true);
  assert.equal(esReferenciaImagenValida(""), true);
});
