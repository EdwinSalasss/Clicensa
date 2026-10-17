import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { requiereAuth, requiereRol } from "../middleware/auth.js";
import { correoConfigurado, enviarCorreo } from "../services/email.js";

const router = Router();
const ESTADOS_VALIDOS = ["CONFIRMADA", "CANCELADA", "ATENDIDA"];

function minutos(hora) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora || "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function fechaValida(fecha) {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha || "") &&
    !Number.isNaN(new Date(`${fecha}T00:00:00.000Z`).getTime()) &&
    new Date(`${fecha}T00:00:00.000Z`).toISOString().slice(0, 10) === fecha;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (caracter) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[caracter]
  );
}

async function enviarAvisoCita(cita, paciente, medico, hospital) {
  if (!correoConfigurado()) {
    console.warn("Notificación de cita no enviada: configura RESEND_API_KEY y EMAIL_FROM.");
    return { enviada: false, motivo: "correo_no_configurado" };
  }
  try {
    await enviarCorreo({
      to: paciente.correo,
      subject: `Cita médica en ${hospital?.nombre || "CLISENSA"}`,
      html: `<p>Hola ${escapeHtml(paciente.nombre)}, tu cita con ${escapeHtml(medico.nombre)} está agendada para el ${escapeHtml(cita.fecha)} a las ${escapeHtml(cita.hora)}.</p>`,
    });
    return { enviada: true };
  } catch (err) {
    console.error("No se pudo enviar la notificación de la cita:", err);
    return { enviada: false, motivo: "fallo_proveedor" };
  }
}

async function crearCita(req, res) {
  try {
    const { medicoId, fecha, hora, servicioId, hospitalId } = req.body || {};
    const medicoIdNum = Number(medicoId);
    let servicioIdNum =
      servicioId === undefined || servicioId === null || servicioId === ""
        ? null
        : Number(servicioId);
    if (!Number.isInteger(medicoIdNum) || medicoIdNum <= 0 || !fechaValida(fecha) || minutos(hora) === null) {
      return res.status(400).json({ error: "medicoId, fecha válida y hora (HH:mm) son requeridos" });
    }
    if (servicioIdNum !== null && (!Number.isInteger(servicioIdNum) || servicioIdNum <= 0)) {
      return res.status(400).json({ error: "servicioId debe ser un entero positivo" });
    }

    const rol = req.usuario.rol;
    if (rol !== "PACIENTE" && rol !== "MEDICO") {
      return res.status(403).json({ error: "Solo pacientes y médicos pueden agendar citas" });
    }

    let pacienteId = req.usuario.id;
    if (rol === "MEDICO") {
      if (req.usuario.medicoId !== medicoIdNum) {
        return res.status(403).json({ error: "Solo puede asignar citas en su propia agenda" });
      }
      const { pacienteId: idSolicitado, correo, cedula } = req.body || {};
      if (idSolicitado) {
        pacienteId = Number(idSolicitado);
      } else if ((typeof correo === "string" && correo.trim()) || (typeof cedula === "string" && cedula.trim())) {
        const correoBusqueda = typeof correo === "string" ? correo.trim().toLowerCase() : "";
        const cedulaBusqueda = typeof cedula === "string" ? cedula.trim() : "";
        const paciente = await prisma.usuario.findFirst({
          where: {
            rol: "PACIENTE",
            ...(correoBusqueda ? { correo: correoBusqueda } : { cedula: cedulaBusqueda }),
          },
        });
        if (!paciente) return res.status(404).json({ error: "No se encontró el paciente" });
        pacienteId = paciente.id;
      } else {
        return res.status(400).json({ error: "Indique pacienteId, correo o cédula del paciente" });
      }
    }

    const [medico, paciente] = await Promise.all([
      prisma.medico.findUnique({ where: { id: medicoIdNum }, include: { disponibilidad: true } }),
      prisma.usuario.findUnique({ where: { id: pacienteId } }),
    ]);
    if (!medico) return res.status(404).json({ error: "Médico no encontrado" });
    if (!paciente || paciente.rol !== "PACIENTE") {
      return res.status(404).json({ error: "Paciente no encontrado" });
    }
    const clinicId = Number(hospitalId || medico.hospitalId || paciente.hospitalId);
    if (!Number.isInteger(clinicId) || clinicId <= 0 || medico.hospitalId !== clinicId) {
      return res.status(400).json({ error: "El médico no pertenece al hospital seleccionado" });
    }
    if (rol === "PACIENTE" && req.usuario.hospitalId && req.usuario.hospitalId !== clinicId) {
      return res.status(403).json({ error: "No puede agendar fuera de su hospital" });
    }

    let servicio = servicioIdNum
      ? await prisma.tipoServicio.findUnique({ where: { id: servicioIdNum } })
      : await prisma.tipoServicio.findFirst({
          where: { hospitalId: clinicId },
          orderBy: { id: "asc" },
        });
    if (!servicio || servicio.hospitalId !== clinicId) {
      return res.status(400).json({ error: "El servicio no pertenece al hospital seleccionado" });
    }
    servicioIdNum = servicio.id;
    const duracionMin = servicio.duracionMin;

    const inicioMin = minutos(hora);
    const dow = new Date(`${fecha}T00:00:00.000Z`).getUTCDay();
    const bloques = medico.disponibilidad.filter((bloque) => bloque.diaSemana === dow);
    if (medico.disponibilidad.length) {
      const enBloque = bloques.some(
        (bloque) => inicioMin >= minutos(bloque.horaInicio) && inicioMin + duracionMin <= minutos(bloque.horaFin)
      );
      if (!enBloque) return res.status(400).json({ error: "La hora está fuera de la disponibilidad del médico" });
    } else {
      const horarioLegacy = await prisma.horarioBase.findFirst({
        where: { medicoId: medicoIdNum, hora },
      });
      if (!horarioLegacy) {
        return res.status(400).json({ error: "El horario solicitado no está disponible para ese médico" });
      }
    }

    let nueva;
    try {
      nueva = await prisma.$transaction(
        async (tx) => {
          const existentes = await tx.cita.findMany({
            where: { medicoId: medicoIdNum, fecha, estado: { not: "CANCELADA" } },
            select: { hora: true, servicio: { select: { duracionMin: true } } },
          });
          const seTraslapa = existentes.some((cita) => {
            const otroInicio = minutos(cita.hora);
            const otraDuracion = cita.servicio?.duracionMin || 30;
            return otroInicio !== null && inicioMin < otroInicio + otraDuracion && inicioMin + duracionMin > otroInicio;
          });
          if (seTraslapa) return null;
          return tx.cita.create({
            data: {
              pacienteId,
              medicoId: medicoIdNum,
              hospitalId: clinicId,
              servicioId: servicioIdNum,
              fecha,
              hora,
              fechaHora: new Date(`${fecha}T${hora}:00`),
              estado: "PENDIENTE",
            },
            include: { servicio: true, hospital: true },
          });
        },
        { isolationLevel: "Serializable" }
      );
    } catch (err) {
      if (err.code === "P2034") return res.status(409).json({ error: "El horario acaba de ser reservado; elija otro." });
      throw err;
    }
    if (!nueva) return res.status(409).json({ error: "El horario ya fue reservado" });

    const notificacion = await enviarAvisoCita(nueva, paciente, medico, nueva.hospital);
    res.status(201).json({ ...nueva, notificacion });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear la cita" });
  }
}

router.post("/", requiereAuth, crearCita);

router.get("/", requiereAuth, requiereRol("PACIENTE"), async (req, res) => {
  try {
    const propias = await prisma.cita.findMany({
      where: { pacienteId: req.usuario.id },
      include: { medico: true, hospital: true, servicio: true },
      orderBy: [{ fecha: "asc" }, { hora: "asc" }],
    });
    res.json(
      propias.map(({ medico, hospital, servicio, ...cita }) => ({
        ...cita,
        medicoNombre: medico.nombre,
        hospitalNombre: hospital?.nombre || null,
        servicioNombre: servicio?.nombre || null,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar citas" });
  }
});

router.put("/:id/cancelar", requiereAuth, requiereRol("PACIENTE"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "id de cita inválido" });
    const cita = await prisma.cita.findUnique({ where: { id } });
    if (!cita) return res.status(404).json({ error: "Cita no encontrada" });
    if (cita.pacienteId !== req.usuario.id) return res.status(403).json({ error: "No autorizado" });
    const actualizada = await prisma.cita.update({
      where: { id },
      data: { estado: "CANCELADA" },
    });
    res.json(actualizada);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al cancelar la cita" });
  }
});

router.put(
  "/:id/estado",
  requiereAuth,
  requiereRol("MEDICO", "PERSONAL_ADMINISTRATIVO", "ADMIN_SISTEMA"),
  async (req, res) => {
    try {
      const estado = typeof req.body?.estado === "string" ? req.body.estado.toUpperCase() : "";
      if (!ESTADOS_VALIDOS.includes(estado)) {
        return res.status(400).json({ error: "estado debe ser CONFIRMADA, CANCELADA o ATENDIDA" });
      }
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "id de cita inválido" });
      const cita = await prisma.cita.findUnique({ where: { id } });
      if (!cita) return res.status(404).json({ error: "Cita no encontrada" });
      if (req.usuario.rol === "MEDICO" && cita.medicoId !== req.usuario.medicoId) {
        return res.status(403).json({ error: "No autorizado para modificar esta cita" });
      }
      if (
        req.usuario.rol === "PERSONAL_ADMINISTRATIVO" &&
        cita.hospitalId !== req.usuario.hospitalId
      ) {
        return res.status(403).json({ error: "La cita pertenece a otro hospital" });
      }
      const actualizada = await prisma.cita.update({ where: { id: cita.id }, data: { estado } });
      res.json(actualizada);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al cambiar el estado de la cita" });
    }
  }
);

router.get("/medico", requiereAuth, requiereRol("MEDICO"), async (req, res) => {
  try {
    const { fecha } = req.query;
    if (!fechaValida(fecha)) return res.status(400).json({ error: "fecha válida es requerida" });
    const agenda = await prisma.cita.findMany({
      where: { medicoId: req.usuario.medicoId, fecha },
      include: { paciente: true, servicio: true },
      orderBy: { hora: "asc" },
    });
    res.json(
      agenda.map(({ paciente, servicio, ...cita }) => ({
        ...cita,
        pacienteNombre: paciente.nombre,
        pacienteCorreo: paciente.correo,
        servicioNombre: servicio?.nombre || null,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar la agenda" });
  }
});

router.get(
  "/todas",
  requiereAuth,
  requiereRol("PERSONAL_ADMINISTRATIVO", "ADMIN_SISTEMA"),
  async (req, res) => {
    try {
      const { fecha } = req.query;
      if (fecha && !fechaValida(fecha)) return res.status(400).json({ error: "fecha no válida" });
      if (req.usuario.rol === "PERSONAL_ADMINISTRATIVO" && !req.usuario.hospitalId) {
        return res.status(403).json({ error: "La cuenta administrativa no está asociada a un hospital" });
      }
      const hospitalFilter =
        req.usuario.rol === "PERSONAL_ADMINISTRATIVO" ? { hospitalId: req.usuario.hospitalId } : {};
      const citas = await prisma.cita.findMany({
        where: { ...hospitalFilter, ...(fecha ? { fecha } : {}) },
        include: { paciente: true, medico: true, hospital: true, servicio: true },
        orderBy: [{ fecha: "asc" }, { hora: "asc" }],
      });
      res.json(
        citas.map(({ paciente, medico, hospital, servicio, ...cita }) => ({
          ...cita,
          pacienteNombre: paciente.nombre,
          medicoNombre: medico.nombre,
          hospitalNombre: hospital?.nombre || null,
          servicioNombre: servicio?.nombre || null,
        }))
      );
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al consultar citas" });
    }
  }
);

export default router;
