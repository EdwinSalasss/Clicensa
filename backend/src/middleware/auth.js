import jwt from "jsonwebtoken";
import { prisma } from "../db/prisma.js";

const SECRETO_DESARROLLO = "clisensa_dev_secret_change_me";
const SECRETO_EJEMPLO = "replace-with-a-random-secret-of-at-least-32-characters";
const JWT_SECRET = process.env.JWT_SECRET || SECRETO_DESARROLLO;

if (
  process.env.NODE_ENV === "production" &&
  (JWT_SECRET === SECRETO_DESARROLLO ||
    JWT_SECRET === SECRETO_EJEMPLO ||
    JWT_SECRET.length < 32)
) {
  throw new Error("Configura JWT_SECRET con al menos 32 caracteres aleatorios en producción.");
}

export function firmarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol,
      medicoId: usuario.medicoId || null,
      hospitalId: usuario.hospitalId || null,
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

export function firmarTokenActivacion(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      rol: "MEDICO",
      medicoId: usuario.medicoId,
      hospitalId: usuario.hospitalId,
      tipo: "activacion_medico",
    },
    JWT_SECRET,
    { expiresIn: "48h" }
  );
}

export async function requiereAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: "Token invalido o expirado" });
  }
  let cuenta;
  try {
    cuenta = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      select: { activo: true },
    });
  } catch (err) {
    console.error("No se pudo validar el estado de la cuenta autenticada:", err);
    return res.status(500).json({ error: "No se pudo validar la sesión" });
  }
  if (!cuenta || !cuenta.activo) {
    return res.status(401).json({ error: "La cuenta está desactivada" });
  }
  return next();
}

// Uso: requiereRol("MEDICO"), requiereRol("PERSONAL_ADMINISTRATIVO"), etc.
export function requiereRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: "No tiene permisos para esta accion" });
    }
    next();
  };
}

export function requierePerfilMedico(req, res, next) {
  return requiereAuth(req, res, () => {
    if (
      req.usuario?.rol !== "MEDICO" ||
      (req.usuario.tipo !== "activacion_medico" && !req.usuario.id)
    ) {
      return res.status(403).json({ error: "Solo el médico invitado puede completar su perfil" });
    }
    next();
  });
}
