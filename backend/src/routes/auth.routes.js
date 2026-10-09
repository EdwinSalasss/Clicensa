import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import { firmarToken, requiereAuth } from "../middleware/auth.js";
import { esReferenciaImagenValida } from "../services/image.js";

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
    const usuario = await prisma.usuario.findUnique({
      where: { correo: correoNormalizado },
      include: { perfilMedico: { select: { fotoUrl: true } } },
    });
    if (!usuario) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    if (usuario.rol === "MEDICO" && !usuario.activadoEn) {
      return res.status(403).json({ error: "Activa tu cuenta desde el enlace enviado por correo" });
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
        hospitalId: usuario.hospitalId || null,
        cedula: usuario.cedula || null,
        fotoUrl: usuario.perfilMedico?.fotoUrl || usuario.fotoUrl || null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno al iniciar sesion" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { nombre, correo, password, cedula } = req.body || {};
    if (
      typeof nombre !== "string" ||
      typeof correo !== "string" ||
      typeof password !== "string" ||
      !nombre.trim() ||
      !correo.trim() ||
      !password.trim() ||
      typeof cedula !== "string" ||
      !cedula.trim()
    ) {
      return res.status(400).json({ error: "nombre, correo, password y cédula son requeridos" });
    }

    const correoNormalizado = correo.trim();
    if (!correoValido(correoNormalizado)) {
      return res.status(400).json({ error: "correo debe tener un formato valido" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
    }
    const correoCanonico = correoNormalizado.toLowerCase();
    const existente = await prisma.usuario.findUnique({
      where: { correo: correoCanonico },
    });
    if (existente) {
      return res.status(409).json({ error: "Ese correo ya esta registrado" });
    }
    const cedulaNormalizada = cedula.trim();
    const cedulaExistente = await prisma.usuario.findUnique({
      where: { cedula: cedulaNormalizada },
    });
    if (cedulaExistente) {
      return res.status(409).json({ error: "Esa cédula ya está registrada" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const usuario = await prisma.usuario.create({
      data: {
        nombre: nombre.trim(),
        correo: correoCanonico,
        password: passwordHash,
        rol: "PACIENTE",
        cedula: cedulaNormalizada,
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
        hospitalId: null,
        cedula: usuario.cedula || null,
      },
    });
  } catch (err) {
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Ese correo o cédula ya está registrado" });
    }
    console.error(err);
    res.status(500).json({ error: "Error interno al registrar paciente" });
  }
});

router.get("/perfil", requiereAuth, async (req, res) => {
  try {
    if (req.usuario.tipo === "activacion_medico") {
      return res.status(403).json({ error: "Activa tu cuenta antes de consultar el perfil" });
    }
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      include: { perfilMedico: { select: { fotoUrl: true } } },
    });
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({
      id: usuario.id,
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol,
      cedula: usuario.cedula,
      fotoUrl: usuario.perfilMedico?.fotoUrl || usuario.fotoUrl,
      medicoId: usuario.medicoId,
      hospitalId: usuario.hospitalId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar el perfil" });
  }
});

router.put("/perfil", requiereAuth, async (req, res) => {
  try {
    if (req.usuario.tipo === "activacion_medico") {
      return res.status(403).json({ error: "Activa tu cuenta antes de editar el perfil general" });
    }
    const { nombre, correo, cedula, fotoUrl, password, passwordActual } = req.body || {};
    if (
      typeof nombre !== "string" || !nombre.trim() ||
      typeof correo !== "string" || !correo.trim() ||
      !correoValido(correo.trim())
    ) {
      return res.status(400).json({ error: "nombre y un correo válido son requeridos" });
    }
    if (req.usuario.rol === "PACIENTE" && (typeof cedula !== "string" || !cedula.trim())) {
      return res.status(400).json({ error: "La cédula es obligatoria para pacientes" });
    }
    if (cedula !== undefined && (typeof cedula !== "string" || !cedula.trim())) {
      return res.status(400).json({ error: "cedula debe ser texto no vacío" });
    }
    if (!esReferenciaImagenValida(fotoUrl)) {
      return res.status(400).json({
        error: "fotoUrl debe ser una URL HTTP/HTTPS o una imagen PNG, JPEG o WebP de hasta 512 KB",
      });
    }
    if (password !== undefined && password !== "") {
      if (typeof password !== "string" || password.length < 8) {
        return res.status(400).json({ error: "La nueva contraseña debe tener al menos 8 caracteres" });
      }
      if (typeof passwordActual !== "string" || !passwordActual) {
        return res.status(400).json({ error: "Indica tu contraseña actual para cambiarla" });
      }
    }

    const usuarioActual = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
    if (!usuarioActual) return res.status(404).json({ error: "Usuario no encontrado" });
    if (password && !(await bcrypt.compare(passwordActual, usuarioActual.password))) {
      return res.status(400).json({ error: "La contraseña actual no es correcta" });
    }

    const correoCanonico = correo.trim().toLowerCase();
    const cedulaNormalizada = typeof cedula === "string" ? cedula.trim() : undefined;
    const datos = {
      nombre: nombre.trim(),
      correo: correoCanonico,
      ...(cedulaNormalizada ? { cedula: cedulaNormalizada } : {}),
      ...(!usuarioActual.medicoId ? { fotoUrl: fotoUrl || null } : {}),
      ...(password ? { password: await bcrypt.hash(password, 12) } : {}),
    };
    const actualizado = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.update({
        where: { id: req.usuario.id },
        data: datos,
      });
      if (usuario.medicoId) {
        await tx.medico.update({
          where: { id: usuario.medicoId },
          data: { nombre: usuario.nombre },
        });
        await tx.perfilMedico.updateMany({
          where: { usuarioId: usuario.id },
          data: {
            nombreCompleto: usuario.nombre,
            fotoUrl: fotoUrl || null,
          },
        });
      }
      return usuario;
    });
    res.json({
      usuario: {
        id: actualizado.id,
        nombre: actualizado.nombre,
        correo: actualizado.correo,
        rol: actualizado.rol,
        cedula: actualizado.cedula,
        fotoUrl: fotoUrl || null,
        medicoId: actualizado.medicoId,
        hospitalId: actualizado.hospitalId,
      },
    });
  } catch (err) {
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Ese correo o cédula ya está registrado" });
    }
    console.error(err);
    res.status(500).json({ error: "Error al actualizar el perfil" });
  }
});

export default router;
