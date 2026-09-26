import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import { firmarToken } from "../middleware/auth.js";

const router = Router();

function correoValido(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

// POST /api/auth/login  { correo, password }
router.post("/login", async (req, res) => {
  try {
    const { correo, password } = req.body || {};
    if (
      typeof correo !== "string" ||
      typeof password !== "string" ||
      !correo.trim() ||
      !password.trim()
    ) {
      return res.status(400).json({ error: "correo y password son requeridos" });
    }

    const correoNormalizado = correo.trim().toLowerCase();
    const usuario = await prisma.usuario.findUnique({ where: { correo: correoNormalizado } });
    if (!usuario) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const passwordOk = await bcrypt.compare(password, usuario.password);
    if (!passwordOk) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const token = firmarToken(usuario);
    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
        medicoId: usuario.medicoId || null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno al iniciar sesion" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { nombre, correo, password } = req.body || {};
    if (
      typeof nombre !== "string" ||
      typeof correo !== "string" ||
      typeof password !== "string" ||
      !nombre.trim() ||
      !correo.trim() ||
      !password.trim()
    ) {
      return res.status(400).json({ error: "nombre, correo y password son requeridos" });
    }

    const correoNormalizado = correo.trim();
    if (!correoValido(correoNormalizado)) {
      return res.status(400).json({ error: "correo debe tener un formato valido" });
    }
    const correoCanonico = correoNormalizado.toLowerCase();
    const existente = await prisma.usuario.findUnique({
      where: { correo: correoCanonico },
    });
    if (existente) {
      return res.status(409).json({ error: "Ese correo ya esta registrado" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const usuario = await prisma.usuario.create({
      data: {
        nombre: nombre.trim(),
        correo: correoCanonico,
        password: passwordHash,
        rol: "paciente",
      },
    });
    const token = firmarToken(usuario);

    res.status(201).json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
        medicoId: null,
      },
    });
  } catch (err) {
    console.error(err);
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Ese correo ya esta registrado" });
    }
    res.status(500).json({ error: "Error interno al registrar paciente" });
  }
});

export default router;
