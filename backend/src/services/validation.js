export function telefonoValido(telefono) {
  if (typeof telefono !== "string") return false;
  const normalizado = telefono.replace(/[ ()-]/g, "");
  return /^\+?\d{7,15}$/.test(normalizado);
}

export function contrasenaValida(contrasena) {
  return typeof contrasena === "string" &&
    contrasena.length >= 8 &&
    Buffer.byteLength(contrasena, "utf8") <= 72;
}
