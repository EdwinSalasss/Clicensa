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
import { esReferenciaImagenValida } from "../services/image.js";

const router = Router();

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (caracter) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[caracter]
  );
}

router.post("/invitar", requiereAuth, requiereRol("PERSONAL_ADMINISTRATIVO"), async (req, res) => {
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
    const usuario = await prisma.$transaction(async (tx) => {
      const medico = await tx.medico.create({
        data: { nombre: nombreCompleto, especialidad: especialidad.trim(), hospitalId: hospital.id },
      });
      const nuevaCuenta = await tx.usuario.create({
        data: {
          nombre: nombreCompleto,
          correo: correoNormalizado,
          password: await bcrypt.hash(randomUUID(), 12),
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
        html: `<p>Has sido invitado a completar tu perfil médico en ${escapeHtml(hospital.nombre)}.</p><p><a href="${activationUrl}">Activar cuenta y completar perfil</a></p><p>Este enlace vence en 48 horas.</p>`,
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
    if (err.code === "P2002") return res.status(409).json({ error: "El correo o la licencia médica ya están registrados" });
    console.error(err);
    res.status(500).json({ error: "Error al invitar al médico" });
  }
});

router.put("/perfil", requierePerfilMedico, async (req, res) => {
  try {
    const { biografia, fotoUrl, password, passwordActual, nombreCompleto } = req.body || {};
    if (
      req.usuario.tipo === "activacion_medico" &&
      (typeof password !== "string" ||
        password.length < 8 ||
        typeof nombreCompleto !== "string" ||
        !nombreCompleto.trim())
    ) {
      return res.status(400).json({ error: "Al activar la cuenta, nombreCompleto y password son requeridos" });
    }
    if (!esReferenciaImagenValida(fotoUrl)) {
      return res.status(400).json({
        error: "fotoUrl debe ser una URL HTTP/HTTPS o una imagen PNG, JPEG o WebP de hasta 512 KB",
      });
    }
    if (password && (typeof password !== "string" || password.length < 8)) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
    }
    if (password && req.usuario.tipo !== "activacion_medico") {
      if (typeof passwordActual !== "string" || !passwordActual) {
        return res.status(400).json({ error: "Indica tu contraseña actual para cambiarla" });
      }
      const cuenta = await prisma.usuario.findUnique({
        where: { id: req.usuario.id },
        select: { password: true },
      });
      if (!cuenta || !(await bcrypt.compare(passwordActual, cuenta.password))) {
        return res.status(400).json({ error: "La contraseña actual no es correcta" });
      }
    }

    const perfil = await prisma.perfilMedico.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!perfil) return res.status(404).json({ error: "Perfil médico no encontrado" });
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
      const usuario = await tx.usuario.update({
        where: { id: req.usuario.id },
        data: {
          nombre: datosPerfil.nombreCompleto,
          ...(password ? { password: await bcrypt.hash(password, 12) } : {}),
          ...(req.usuario.tipo === "activacion_medico" ? { activadoEn: new Date() } : {}),
        },
      });
      const perfilActualizado = await tx.perfilMedico.update({
        where: { id: perfil.id },
        data: datosPerfil,
      });
      return { usuario, perfil: perfilActualizado };
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
        correo: resultado.usuario.correo,
        rol: resultado.usuario.rol,
        medicoId: resultado.usuario.medicoId,
        hospitalId: resultado.usuario.hospitalId,
        fotoUrl: resultado.perfil.fotoUrl,
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
      select: { nombreCompleto: true, licenciaMedica: true, especialidad: true, biografia: true, fotoUrl: true },
    });
    if (!perfil) return res.status(404).json({ error: "Perfil médico no encontrado" });
    res.json(perfil);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar el perfil médico" });
  }
});

// GET /api/medicos?especialidad=Medicina General
router.get("/", async (req, res) => {
  try {
    const { especialidad } = req.query;
    if (especialidad !== undefined && typeof especialidad !== "string") {
      return res.status(400).json({ error: "especialidad debe ser texto" });
    }
    const hospitalId = req.query.hospitalId === undefined ? undefined : Number(req.query.hospitalId);
    if (hospitalId !== undefined && (!Number.isInteger(hospitalId) || hospitalId <= 0)) {
      return res.status(400).json({ error: "hospitalId debe ser un entero positivo" });
    }
    const medicos = await prisma.medico.findMany({
      where: {
        ...(hospitalId ? { hospitalId } : {}),
        ...(especialidad ? { especialidad: { contains: especialidad, mode: "insensitive" } } : {}),
      },
      orderBy: { nombre: "asc" },
      include: {
        horarios: { orderBy: { hora: "asc" } },
        perfil: {
          select: {
            nombreCompleto: true,
            licenciaMedica: true,
            biografia: true,
            fotoUrl: true,
          },
        },
      },
    });
    res.json(medicos.map(({ perfil, ...medico }) => ({
      ...medico,
      nombre: perfil?.nombreCompleto || medico.nombre,
      licenciaMedica: perfil?.licenciaMedica || null,
      biografia: perfil?.biografia || "",
      fotoUrl: perfil?.fotoUrl || null,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar medicos" });
  }
});

router.post("/", requiereAuth, requiereRol("PERSONAL_ADMINISTRATIVO"), async (req, res) => {
  try {
    if (!req.usuario.hospitalId) {
      return res.status(403).json({ error: "La cuenta administrativa no está asociada a un hospital" });
    }
    const { nombre, especialidad } = req.body || {};
    if (
      typeof nombre !== "string" ||
      typeof especialidad !== "string" ||
      !nombre.trim() ||
      !especialidad.trim()
    ) {
      return res.status(400).json({ error: "nombre y especialidad son requeridos" });
    }

    const medico = await prisma.medico.create({
      data: {
        nombre: nombre.trim(),
        especialidad: especialidad.trim(),
        hospitalId: req.usuario.hospitalId,
      },
    });
    res.status(201).json(medico);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear medico" });
  }
});

router.post("/:id/horarios", requiereAuth, requiereRol("PERSONAL_ADMINISTRATIVO"), async (req, res) => {
  try {
    if (!req.usuario.hospitalId) {
      return res.status(403).json({ error: "La cuenta administrativa no está asociada a un hospital" });
    }
    const medicoId = Number(req.params.id);
    const { hora } = req.body || {};
    if (!Number.isInteger(medicoId) || medicoId <= 0) {
      return res.status(404).json({ error: "Medico no encontrado" });
    }

    const medico = await prisma.medico.findUnique({ where: { id: medicoId } });
    if (!medico) return res.status(404).json({ error: "Medico no encontrado" });
    if (medico.hospitalId !== req.usuario.hospitalId) {
      return res.status(403).json({ error: "El médico pertenece a otro hospital" });
    }
    if (typeof hora !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
      return res.status(400).json({ error: "hora debe tener formato HH:mm" });
    }

    const existente = await prisma.horarioBase.findFirst({
      where: { medicoId, hora },
    });
    if (existente) {
      return res.status(409).json({ error: "Ese horario ya existe para el medico" });
    }

    const horario = await prisma.horarioBase.create({
      data: { medicoId, hora },
    });
    res.status(201).json(horario);
  } catch (err) {
    console.error(err);
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Ese horario ya existe para el medico" });
    }
    res.status(500).json({ error: "Error al crear horario" });
  }
});

router.delete(
  "/:id/horarios/:horarioId",
  requiereAuth,
  requiereRol("PERSONAL_ADMINISTRATIVO"),
  async (req, res) => {
    try {
      const medicoId = Number(req.params.id);
      const horarioId = Number(req.params.horarioId);
      if (
        !Number.isInteger(medicoId) ||
        medicoId <= 0 ||
        !Number.isInteger(horarioId) ||
        horarioId <= 0
      ) {
        return res.status(404).json({ error: "Horario no encontrado" });
      }

      const horario = await prisma.horarioBase.findFirst({
        where: { id: horarioId, medicoId },
      });
      if (!horario) {
        return res.status(404).json({ error: "Horario no encontrado" });
      }
      const medico = await prisma.medico.findUnique({ where: { id: medicoId } });
      if (!medico || medico.hospitalId !== req.usuario.hospitalId) {
        return res.status(403).json({ error: "El médico pertenece a otro hospital" });
      }

      await prisma.horarioBase.delete({ where: { id: horarioId } });
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al eliminar horario" });
    }
  }
);

export default router;
