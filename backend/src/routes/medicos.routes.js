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
import { obtenerHorariosDisponibles } from "../services/availability.js";
import { contrasenaValida } from "../services/validation.js";

const router = Router();

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (caracter) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[caracter]
  );
}

router.post("/invitar", requiereAuth, requiereRol("PERSONAL_ADMINISTRATIVO"), async (req, res) => {
  try {
    const { licenciaMedica, correo, especialidad } = req.body || {};
    if (
      typeof licenciaMedica !== "string" || !licenciaMedica.trim() || licenciaMedica.trim().length > 80 ||
      typeof correo !== "string" || !correo.trim() || correo.trim().length > 254 ||
      typeof especialidad !== "string" || !especialidad.trim() || especialidad.trim().length > 100
    ) {
      return res.status(400).json({ error: "Ingresa la licencia médica (máximo 80 caracteres), un correo válido y una especialidad (máximo 100 caracteres)." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
      return res.status(400).json({ error: "Escribe un correo electrónico válido." });
    }
    if (!req.usuario.hospitalId) {
      return res.status(403).json({ error: "La cuenta administrativa no está asociada a un hospital" });
    }
    if (!correoConfigurado()) {
      return res.status(503).json({ error: "El envío de invitaciones no está configurado. Solicita al administrador que configure el servicio de correo." });
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
      (!contrasenaValida(password) ||
        typeof nombreCompleto !== "string" ||
        !nombreCompleto.trim() ||
        nombreCompleto.trim().length > 120)
    ) {
      return res.status(400).json({ error: "Al activar tu cuenta, ingresa tu nombre completo (máximo 120 caracteres) y una contraseña de al menos 8 caracteres y hasta 72 bytes." });
    }
    if (
      nombreCompleto !== undefined &&
      (typeof nombreCompleto !== "string" || !nombreCompleto.trim() || nombreCompleto.trim().length > 120)
    ) {
      return res.status(400).json({ error: "Ingresa un nombre completo de hasta 120 caracteres." });
    }
    if (biografia !== undefined && (typeof biografia !== "string" || biografia.length > 2000)) {
      return res.status(400).json({ error: "La biografía no puede superar los 2,000 caracteres." });
    }
    if (!esReferenciaImagenValida(fotoUrl)) {
      return res.status(400).json({
        error: "La imagen debe ser una dirección web HTTP/HTTPS o un archivo PNG, JPEG o WebP de hasta 512 KB.",
      });
    }
    if (password && !contrasenaValida(password)) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres y no superar 72 bytes." });
    }
    if (password && req.usuario.tipo !== "activacion_medico") {
      if (typeof passwordActual !== "string" || !passwordActual) {
        return res.status(400).json({ error: "Escribe tu contraseña actual para poder cambiarla." });
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

router.get(
  "/administracion",
  requiereAuth,
  requiereRol("PERSONAL_ADMINISTRATIVO"),
  async (req, res) => {
    try {
      if (!req.usuario.hospitalId) {
        return res.status(403).json({ error: "La cuenta administrativa no está asociada a un hospital" });
      }
      const medicos = await prisma.medico.findMany({
        where: { hospitalId: req.usuario.hospitalId },
        orderBy: { nombre: "asc" },
        include: {
          horarios: { orderBy: { hora: "asc" } },
          perfil: { select: { licenciaMedica: true } },
          usuario: {
            select: { id: true, correo: true, activo: true, activadoEn: true },
          },
        },
      });
      res.json(medicos.map(({ usuario, perfil, ...medico }) => ({
        ...medico,
        licenciaMedica: perfil?.licenciaMedica || null,
        cuenta: usuario
          ? {
              id: usuario.id,
              correo: usuario.correo,
              activo: usuario.activo,
              activada: Boolean(usuario.activadoEn),
            }
          : null,
      })));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al consultar los médicos del hospital" });
    }
  }
);

// GET /api/medicos?especialidad=Medicina General
router.get("/", async (req, res) => {
  try {
    const { especialidad } = req.query;
    const soloDisponibles = req.query.soloDisponibles === "true";
    if (especialidad !== undefined && typeof especialidad !== "string") {
      return res.status(400).json({ error: "especialidad debe ser texto" });
    }
    const hospitalId = req.query.hospitalId === undefined ? undefined : Number(req.query.hospitalId);
    if (hospitalId !== undefined && (!Number.isInteger(hospitalId) || hospitalId <= 0)) {
      return res.status(400).json({ error: "hospitalId debe ser un entero positivo" });
    }
    const servicioId = req.query.servicioId === undefined ? undefined : Number(req.query.servicioId);
    const { fecha } = req.query;
    if (soloDisponibles && (
      !hospitalId ||
      !Number.isInteger(servicioId) || servicioId <= 0 ||
      typeof fecha !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
      Number.isNaN(new Date(`${fecha}T00:00:00.000Z`).getTime()) ||
      new Date(`${fecha}T00:00:00.000Z`).toISOString().slice(0, 10) !== fecha
    )) {
      return res.status(400).json({ error: "hospitalId, servicioId y fecha válida son requeridos para filtrar disponibilidad" });
    }
    if (soloDisponibles) {
      const servicio = await prisma.tipoServicio.findUnique({ where: { id: servicioId } });
      if (!servicio || servicio.hospitalId !== hospitalId) {
        return res.status(400).json({ error: "El servicio no pertenece al hospital seleccionado" });
      }
    }
    const medicos = await prisma.medico.findMany({
      where: {
        ...(hospitalId ? { hospitalId } : {}),
        ...(especialidad ? { especialidad: { contains: especialidad, mode: "insensitive" } } : {}),
        usuario: {
          is: {
            rol: "MEDICO",
            activo: true,
            activadoEn: { not: null },
          },
        },
      },
      orderBy: { nombre: "asc" },
      include: {
        horarios: { orderBy: { hora: "asc" } },
        disponibilidad: true,
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
    const conDisponibilidad = soloDisponibles
      ? (await Promise.all(medicos.map(async (medico) => ({
          medico,
          disponibles: await obtenerHorariosDisponibles(prisma, medico, fecha, servicioId),
        })))).filter(({ disponibles }) => disponibles.length > 0)
      : medicos.map((medico) => ({ medico, disponibles: undefined }));
    res.json(conDisponibilidad.map(({ medico: { perfil, disponibilidad, ...medico }, disponibles }) => ({
      ...medico,
      nombre: perfil?.nombreCompleto || medico.nombre,
      licenciaMedica: perfil?.licenciaMedica || null,
      biografia: perfil?.biografia || "",
      fotoUrl: perfil?.fotoUrl || null,
      ...(soloDisponibles ? { disponibles } : {}),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar medicos" });
  }
});

router.patch(
  "/:id/estado",
  requiereAuth,
  requiereRol("PERSONAL_ADMINISTRATIVO"),
  async (req, res) => {
    try {
      if (!req.usuario.hospitalId) {
        return res.status(403).json({ error: "La cuenta administrativa no está asociada a un hospital" });
      }
      const medicoId = Number(req.params.id);
      const { activo } = req.body || {};
      if (!Number.isInteger(medicoId) || medicoId <= 0 || typeof activo !== "boolean") {
        return res.status(400).json({ error: "Indica un médico válido y activo como valor booleano" });
      }

      const medico = await prisma.medico.findFirst({
        where: { id: medicoId, hospitalId: req.usuario.hospitalId },
        include: {
          usuario: {
            select: { id: true, rol: true, activo: true },
          },
        },
      });
      if (!medico) return res.status(404).json({ error: "Médico no encontrado en este hospital" });
      if (!medico.usuario || medico.usuario.rol !== "MEDICO") {
        return res.status(409).json({ error: "El médico no tiene una cuenta administrable" });
      }

      const citasCanceladas = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "usuarios" WHERE "id" = ${medico.usuario.id} FOR UPDATE`;
        await tx.usuario.update({
          where: { id: medico.usuario.id },
          data: { activo },
        });
        if (activo) return [];

        const ahora = new Date();
        const citasFuturas = await tx.cita.findMany({
          where: {
            medicoId,
            fechaHora: { gte: ahora },
            estado: { in: ["PENDIENTE", "CONFIRMADA"] },
          },
          include: {
            paciente: { select: { nombre: true, correo: true } },
            medico: { select: { nombre: true } },
            hospital: { select: { nombre: true, telefono: true } },
            servicio: { select: { nombre: true } },
          },
          orderBy: [{ fechaHora: "asc" }],
        });

        for (const cita of citasFuturas) {
          await tx.cita.update({
            where: { id: cita.id },
            data: {
              estado: "CANCELADA",
              ...(cita.estadoReprogramacion === "PENDIENTE"
                ? {
                    estadoReprogramacion: "RECHAZADA",
                    resueltaReprogramacionEn: ahora,
                  }
                : {}),
            },
          });
        }
        return citasFuturas;
      });

      let enviadas = 0;
      let fallidas = 0;
      for (const cita of citasCanceladas) {
        try {
          await enviarCorreo({
            to: cita.paciente.correo,
            subject: `Cita cancelada en ${cita.hospital.nombre}`,
            html: `<p>Hola ${escapeHtml(cita.paciente.nombre)}, te informamos que tu cita de ${escapeHtml(cita.servicio.nombre)} con ${escapeHtml(cita.medico.nombre)} del ${escapeHtml(cita.fecha)} a las ${escapeHtml(cita.hora)} fue cancelada porque la cuenta del médico fue bloqueada por el hospital.</p><p>Comunícate con ${escapeHtml(cita.hospital.nombre)}${cita.hospital.telefono ? ` al ${escapeHtml(cita.hospital.telefono)}` : ""} para coordinar una nueva cita.</p>`,
          });
          enviadas += 1;
        } catch (err) {
          fallidas += 1;
          console.error(`No se pudo notificar la cancelación de la cita ${cita.id}:`, err);
        }
      }

      res.json({
        medicoId,
        activo,
        citasCanceladas: citasCanceladas.length,
        notificaciones: { enviadas, fallidas },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al actualizar el estado del médico" });
    }
  }
);

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
      return res.status(400).json({ error: "Escribe la hora con el formato de 24 horas HH:mm." });
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
