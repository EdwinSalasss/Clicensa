import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/prisma.js";
import {
  firmarToken,
  firmarTokenActivacion,
  requiereAuth,
  requierePerfilMedico,
  requiereRol,
} from "../middleware/auth.js";
import { correoConfigurado, enviarCorreo } from "../services/email.js";

const router = Router();

router.post(
  "/invitar",
  requiereAuth,
  requiereRol("PERSONAL_ADMINISTRATIVO"),
  async (req, res) => {
    try {
      const { licenciaMedica, correo, especialidad } = req.body || {};
      if (![licenciaMedica, correo, especialidad].every((value) => typeof value === "string" && value.trim())) {
        return res.status(400).json({ error: "licenciaMedica, correo y especialidad son requeridos" });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
        return res.status(400).json({ error: "correo debe ser una dirección válida" });
      }
      if (!req.usuario.hospitalId) {
        return res.status(403).json({ error: "La cuenta administrativa no está asociada a un hospital" });
      }
      if (!correoConfigurado()) {
        return res.status(503).json({ error: "Configura RESEND_API_KEY y EMAIL_FROM antes de enviar invitaciones." });
      }

      const correoNormalizado = correo.trim().toLowerCase();
      const [usuarioExistente, licenciaExistente] = await Promise.all([
        prisma.usuario.findUnique({ where: { correo: correoNormalizado } }),
        prisma.perfilMedico.findUnique({ where: { licenciaMedica: licenciaMedica.trim() } }),
      ]);
      if (usuarioExistente) return res.status(409).json({ error: "Ya existe una cuenta con ese correo" });
      if (licenciaExistente) return res.status(409).json({ error: "La licencia médica ya está registrada" });

      const hospital = await prisma.hospital.findUnique({ where: { id: req.usuario.hospitalId } });
      if (!hospital) return res.status(404).json({ error: "Hospital asociado no encontrado" });

      const nombreCompleto = `Médico ${licenciaMedica.trim()}`;
      const claveTemporal = randomUUID();
      const usuario = await prisma.$transaction(async (tx) => {
        const medico = await tx.medico.create({
          data: {
            nombre: nombreCompleto,
            especialidad: especialidad.trim(),
            hospitalId: hospital.id,
          },
        });
        const nuevaCuenta = await tx.usuario.create({
          data: {
            nombre: nombreCompleto,
            correo: correoNormalizado,
            password: await bcrypt.hash(claveTemporal, 12),
            rol: "MEDICO",
            hospitalId: hospital.id,
            medicoId: medico.id,
          },
        });
        await tx.perfilMedico.create({
          data: {
            usuarioId: nuevaCuenta.id,
            medicoId: medico.id,
            nombreCompleto,
            licenciaMedica: licenciaMedica.trim(),
            especialidad: especialidad.trim(),
          },
        });
        return nuevaCuenta;
      });

      const token = firmarTokenActivacion(usuario);
      const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const activationUrl = `${baseUrl.replace(/\/$/, "")}/medico/activar?token=${encodeURIComponent(token)}`;
      try {
        await enviarCorreo({
          to: correoNormalizado,
          subject: `Invitación para unirte a ${hospital.nombre}`,
          html: `<p>Has sido invitado a completar tu perfil médico en ${hospital.nombre.replace(/[&<>"']/g, (caracter) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[caracter])}.</p><p><a href="${activationUrl}">Activar cuenta y completar perfil</a></p><p>Este enlace vence en 48 horas.</p>`,
        });
      } catch (emailError) {
        await prisma.$transaction([
          prisma.usuario.delete({ where: { id: usuario.id } }),
          prisma.medico.delete({ where: { id: usuario.medicoId } }),
        ]);
        console.error(emailError);
        return res.status(502).json({ error: "No se pudo enviar la invitación; no se creó la cuenta." });
      }

      res.status(201).json({
        mensaje: "Invitación enviada",
        medico: { id: usuario.medicoId, correo: usuario.correo, especialidad: especialidad.trim() },
      });
    } catch (err) {
      if (err.code === "P2002") {
        return res.status(409).json({ error: "El correo o la licencia médica ya están registrados" });
      }
      console.error(err);
      res.status(500).json({ error: "Error al invitar al médico" });
    }
  }
);

router.put("/perfil", requierePerfilMedico, async (req, res) => {
  try {
    const { biografia, fotoUrl, password, nombreCompleto } = req.body || {};
    if (
      req.usuario.tipo === "activacion_medico" &&
      (typeof password !== "string" ||
        password.length < 8 ||
        typeof nombreCompleto !== "string" ||
        !nombreCompleto.trim())
    ) {
      return res.status(400).json({ error: "Al activar la cuenta, nombreCompleto y password son requeridos" });
    }
    if (fotoUrl && (typeof fotoUrl !== "string" || !/^https?:\/\//i.test(fotoUrl))) {
      return res.status(400).json({ error: "fotoUrl debe ser una URL HTTP o HTTPS válida" });
    }
    if (password && (typeof password !== "string" || password.length < 8)) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
    }

    const perfil = await prisma.perfilMedico.findUnique({
      where: { usuarioId: req.usuario.id },
      include: { medico: true },
    });
    if (!perfil) return res.status(404).json({ error: "Perfil médico no encontrado" });

    const actualizacionUsuario = {};
    if (password) actualizacionUsuario.password = await bcrypt.hash(password, 12);
    if (req.usuario.tipo === "activacion_medico") actualizacionUsuario.activadoEn = new Date();

    const resultado = await prisma.$transaction(async (tx) => {
      const datosPerfil = {
        biografia: typeof biografia === "string" ? biografia.trim() : perfil.biografia,
        fotoUrl: fotoUrl === undefined ? perfil.fotoUrl : fotoUrl || null,
        nombreCompleto:
          typeof nombreCompleto === "string" && nombreCompleto.trim()
            ? nombreCompleto.trim()
            : perfil.nombreCompleto,
      };
      await tx.medico.update({
        where: { id: perfil.medicoId },
        data: { nombre: datosPerfil.nombreCompleto },
      });
      const usuarioActualizado = await tx.usuario.update({
        where: { id: req.usuario.id },
        data: { ...actualizacionUsuario, nombre: datosPerfil.nombreCompleto },
      });
      const perfilActualizado = await tx.perfilMedico.update({
        where: { id: perfil.id },
        data: datosPerfil,
      });
      return { perfil: perfilActualizado, usuario: usuarioActualizado };
    });

    const respuesta = {
      perfil: resultado.perfil,
      activado: req.usuario.tipo === "activacion_medico",
    };
    if (req.usuario.tipo === "activacion_medico") {
      respuesta.token = firmarToken(resultado.usuario);
      respuesta.usuario = {
        id: resultado.usuario.id,
        nombre: resultado.usuario.nombre,
        rol: resultado.usuario.rol,
        medicoId: resultado.usuario.medicoId,
        hospitalId: resultado.usuario.hospitalId,
      };
    }
    res.json(respuesta);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar el perfil médico" });
  }
});

router.get("/perfil", requiereAuth, requiereRol("MEDICO"), async (req, res) => {
  try {
    const perfil = await prisma.perfilMedico.findUnique({
      where: { usuarioId: req.usuario.id },
      select: {
        nombreCompleto: true,
        licenciaMedica: true,
        especialidad: true,
        biografia: true,
        fotoUrl: true,
      },
    });
    if (!perfil) return res.status(404).json({ error: "Perfil médico no encontrado" });
    res.json(perfil);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar el perfil médico" });
  }
});

router.get("/", async (req, res) => {
  try {
    const hospitalId = req.query.hospitalId ? Number(req.query.hospitalId) : undefined;
    const especialidad = typeof req.query.especialidad === "string" ? req.query.especialidad : undefined;
    if (hospitalId !== undefined && (!Number.isInteger(hospitalId) || hospitalId <= 0)) {
      return res.status(400).json({ error: "hospitalId debe ser un entero positivo" });
    }
    const medicos = await prisma.medico.findMany({
      where: {
        ...(hospitalId ? { hospitalId } : {}),
        ...(especialidad ? { especialidad: { contains: especialidad, mode: "insensitive" } } : {}),
      },
      include: { perfil: true },
      orderBy: { nombre: "asc" },
    });
    res.json(
      medicos.map(({ perfil, ...medico }) => ({
        ...medico,
        nombre: perfil?.nombreCompleto || medico.nombre,
        licenciaMedica: perfil?.licenciaMedica || null,
        biografia: perfil?.biografia || "",
        fotoUrl: perfil?.fotoUrl || null,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar médicos" });
  }
});

export default router;
