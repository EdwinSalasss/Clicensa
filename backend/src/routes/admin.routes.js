import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import { requiereAuth, requiereRol } from "../middleware/auth.js";
import { esReferenciaImagenValida } from "../services/image.js";
import { contrasenaValida, telefonoValido } from "../services/validation.js";

const router = Router();

router.post("/hospitales", requiereAuth, requiereRol("ADMIN_SISTEMA"), async (req, res) => {
  try {
    const { nombre, direccion, telefono, logoUrl } = req.body || {};
    if (
      typeof nombre !== "string" || !nombre.trim() || nombre.trim().length > 120 ||
      typeof direccion !== "string" || !direccion.trim() || direccion.trim().length > 240
    ) {
      return res.status(400).json({ error: "Ingresa el nombre del hospital (máximo 120 caracteres) y una dirección (máximo 240 caracteres)." });
    }
    if (!telefonoValido(telefono)) {
      return res.status(400).json({ error: "Ingresa un teléfono con entre 7 y 15 dígitos; puedes incluir +, espacios, guiones o paréntesis." });
    }
    if (!esReferenciaImagenValida(logoUrl)) {
      return res.status(400).json({
        error: "El logo debe ser una dirección web HTTP/HTTPS o una imagen PNG, JPEG o WebP de hasta 512 KB.",
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
      nombre.trim().length > 120 ||
      typeof correo !== "string" ||
      !correo.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim()) ||
      correo.trim().length > 254 ||
      !contrasenaValida(password)
    ) {
      return res.status(400).json({ error: "Selecciona un hospital e ingresa un nombre de hasta 120 caracteres, un correo válido y una contraseña de 8 caracteres como mínimo y hasta 72 bytes." });
    }
    const hospital = await prisma.hospital.findUnique({ where: { id: parsedHospitalId } });
    if (!hospital) return res.status(404).json({ error: "No se encontró el hospital seleccionado." });
    const correoNormalizado = correo.trim().toLowerCase();
    const existente = await prisma.usuario.findUnique({ where: { correo: correoNormalizado } });
    if (existente) return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });

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
    if (err.code === "P2002") return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });
    console.error(err);
    res.status(500).json({ error: "Error al crear la cuenta administrativa" });
  }
});

export default router;
