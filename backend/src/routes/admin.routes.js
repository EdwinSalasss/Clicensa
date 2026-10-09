import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import { requiereAuth, requiereRol } from "../middleware/auth.js";
import { esReferenciaImagenValida } from "../services/image.js";

const router = Router();

router.post("/hospitales", requiereAuth, requiereRol("ADMIN_SISTEMA"), async (req, res) => {
  try {
    const { nombre, direccion, telefono, logoUrl } = req.body || {};
    if (![nombre, direccion, telefono].every((value) => typeof value === "string" && value.trim())) {
      return res.status(400).json({ error: "nombre, direccion y telefono son requeridos" });
    }
    if (!esReferenciaImagenValida(logoUrl)) {
      return res.status(400).json({
        error: "logoUrl debe ser una URL HTTP/HTTPS o una imagen PNG, JPEG o WebP de hasta 512 KB",
      });
    }
    const hospital = await prisma.hospital.create({
      data: {
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        telefono: telefono.trim(),
        logoUrl: logoUrl || null,
      },
    });
    res.status(201).json(hospital);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear el hospital" });
  }
});

router.post("/personal", requiereAuth, requiereRol("ADMIN_SISTEMA"), async (req, res) => {
  try {
    const { hospitalId, nombre, correo, password } = req.body || {};
    const parsedHospitalId = Number(hospitalId);
    if (
      !Number.isInteger(parsedHospitalId) ||
      parsedHospitalId <= 0 ||
      typeof nombre !== "string" ||
      !nombre.trim() ||
      typeof correo !== "string" ||
      !correo.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim()) ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({ error: "hospitalId, nombre, correo válido y password son requeridos" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
    }

    const hospital = await prisma.hospital.findUnique({ where: { id: parsedHospitalId } });
    if (!hospital) return res.status(404).json({ error: "Hospital no encontrado" });
    const correoNormalizado = correo.trim().toLowerCase();
    const existente = await prisma.usuario.findUnique({ where: { correo: correoNormalizado } });
    if (existente) return res.status(409).json({ error: "Ya existe una cuenta con ese correo" });

    const usuario = await prisma.usuario.create({
      data: {
        nombre: nombre.trim(),
        correo: correoNormalizado,
        password: await bcrypt.hash(password, 12),
        rol: "PERSONAL_ADMINISTRATIVO",
        hospitalId: parsedHospitalId,
        activadoEn: new Date(),
      },
      select: { id: true, nombre: true, correo: true, rol: true, hospitalId: true },
    });
    res.status(201).json(usuario);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Ya existe una cuenta con ese correo" });
    console.error(err);
    res.status(500).json({ error: "Error al crear la cuenta administrativa" });
  }
});

export default router;
