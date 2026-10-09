import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { requiereAuth, requiereRol } from "../middleware/auth.js";
import { correoConfigurado, enviarCorreo } from "../services/email.js";

const router = Router();
const ESTADOS_VALIDOS = ["CONFIRMADA", "CANCELADA", "ATENDIDA"];

function minutos(hora) {
  const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(hora || "");
  return match ? Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3)) : null;
}

function fechaValida(fecha) {
  return typeof fecha === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
    !Number.isNaN(new Date(`${fecha}T00:00:00.000Z`).getTime()) &&
    new Date(`${fecha}T00:00:00.000Z`).toISOString().slice(0, 10) === fecha;
}

function fechaHoraFutura(fecha, hora) {
  return new Date(`${fecha}T${hora}:00`).getTime() > Date.now();
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
      subject: `Cita médica en ${hospital.nombre}`,
      html: `<p>Hola ${escapeHtml(paciente.nombre)}, tu cita con ${escapeHtml(medico.nombre)} está agendada para el ${escapeHtml(cita.fecha)} a las ${escapeHtml(cita.hora)}.</p>`,
    });
    return { enviada: true };
  } catch (err) {
    console.error("No se pudo enviar la notificación de la cita:", err);
    return { enviada: false, motivo: "fallo_proveedor" };
  }
}

async function validarReserva({ medicoId, hospitalId, servicioId, fecha, hora, excluirCitaId }) {
  const [medico, servicio] = await Promise.all([
    prisma.medico.findUnique({ where: { id: medicoId }, include: { disponibilidad: true } }),
    prisma.tipoServicio.findUnique({ where: { id: servicioId } }),
  ]);
  if (!medico) return { error: "Médico no encontrado", status: 404 };
  if (!servicio || servicio.hospitalId !== hospitalId || medico.hospitalId !== hospitalId) {
    return { error: "El médico y el servicio deben pertenecer al hospital seleccionado", status: 400 };
  }

  const inicio = minutos(hora);
  const diaSemana = new Date(`${fecha}T00:00:00.000Z`).getUTCDay();
  const disponibilidadSemanal = medico.disponibilidad;
  if (disponibilidadSemanal.length) {
    const bloquesDelDia = disponibilidadSemanal.filter((bloque) => bloque.diaSemana === diaSemana);
    const dentroDeBloque = bloquesDelDia.some((bloque) =>
      inicio >= minutos(bloque.horaInicio) &&
      inicio + servicio.duracionMin <= minutos(bloque.horaFin)
    );
    if (!dentroDeBloque) {
      return { error: "La hora está fuera de la disponibilidad del médico", status: 400 };
    }
  } else {
    const legacy = await prisma.horarioBase.findFirst({ where: { medicoId, hora } });
    if (!legacy) return { error: "El horario solicitado no está disponible para ese médico", status: 400 };
  }

  const citasExistentes = await prisma.cita.findMany({
    where: {
      medicoId,
      fecha,
      estado: { not: "CANCELADA" },
      ...(excluirCitaId ? { id: { not: excluirCitaId } } : {}),
    },
    select: { hora: true, servicio: { select: { duracionMin: true } } },
  });
  const seTraslapa = citasExistentes.some((cita) => {
    const inicioExistente = minutos(cita.hora);
    return inicioExistente !== null &&
      inicio < inicioExistente + (cita.servicio?.duracionMin || 30) &&
      inicio + servicio.duracionMin > inicioExistente;
  });
  if (seTraslapa) return { error: "El horario ya fue reservado", status: 409 };
  return { medico, servicio };
}

router.post("/", requiereAuth, async (req, res) => {
  try {
    const { medicoId, fecha, hora, servicioId, hospitalId } = req.body || {};
    const medicoIdNum = Number(medicoId);
    const clinicId = Number(hospitalId);
    let servicioIdNum = servicioId === undefined || servicioId === null || servicioId === ""
      ? null
      : Number(servicioId);
    if (
      !Number.isInteger(medicoIdNum) || medicoIdNum <= 0 ||
      !fechaValida(fecha) || minutos(hora) === null
    ) {
      return res.status(400).json({ error: "medicoId, fecha válida y hora (HH:mm) son requeridos" });
    }
    if (!Number.isInteger(clinicId) || clinicId <= 0) {
      return res.status(400).json({ error: "hospitalId debe ser un entero positivo" });
    }
    if (!fechaHoraFutura(fecha, hora)) {
      return res.status(400).json({ error: "La cita debe programarse para una fecha y hora futuras" });
    }
    if (servicioIdNum !== null && (!Number.isInteger(servicioIdNum) || servicioIdNum <= 0)) {
      return res.status(400).json({ error: "servicioId debe ser un entero positivo" });
    }
    if (!["PACIENTE", "MEDICO"].includes(req.usuario.rol)) {
      return res.status(403).json({ error: "Solo pacientes y médicos pueden agendar citas" });
    }

    let pacienteId = req.usuario.id;
    if (req.usuario.rol === "MEDICO") {
      if (req.usuario.medicoId !== medicoIdNum) {
        return res.status(403).json({ error: "Solo puede asignar citas en su propia agenda" });
      }
      const { pacienteId: idSolicitado, correo, cedula } = req.body || {};
      if (idSolicitado !== undefined) {
        pacienteId = Number(idSolicitado);
        if (!Number.isInteger(pacienteId) || pacienteId <= 0) {
          return res.status(400).json({ error: "pacienteId debe ser un entero positivo" });
        }
      } else if ((typeof correo === "string" && correo.trim()) || (typeof cedula === "string" && cedula.trim())) {
        const paciente = await prisma.usuario.findFirst({
          where: {
            rol: "PACIENTE",
            ...(typeof correo === "string" && correo.trim()
              ? { correo: correo.trim().toLowerCase() }
              : { cedula: cedula.trim() }),
          },
        });
        if (!paciente) return res.status(404).json({ error: "No se encontró el paciente" });
        pacienteId = paciente.id;
      } else {
        return res.status(400).json({ error: "Indique pacienteId, correo o cédula del paciente" });
      }
    }

    const paciente = await prisma.usuario.findUnique({ where: { id: pacienteId } });
    if (!paciente || paciente.rol !== "PACIENTE") {
      return res.status(404).json({ error: "Paciente no encontrado" });
    }
    if (
      req.usuario.rol === "PACIENTE" &&
      req.usuario.hospitalId &&
      req.usuario.hospitalId !== clinicId
    ) {
      return res.status(403).json({ error: "No puede agendar fuera de su hospital" });
    }
    if (!servicioIdNum) {
      const defaultService = await prisma.tipoServicio.findFirst({
        where: { hospitalId: clinicId },
        orderBy: { id: "asc" },
      });
      servicioIdNum = defaultService?.id || null;
    }
    if (!servicioIdNum) return res.status(400).json({ error: "Seleccione un servicio válido" });

    const validacion = await validarReserva({
      medicoId: medicoIdNum,
      hospitalId: clinicId,
      servicioId: servicioIdNum,
      fecha,
      hora,
    });
    if (validacion.error) return res.status(validacion.status).json({ error: validacion.error });

    let nueva;
    try {
      nueva = await prisma.$transaction(async (tx) => {
        const otrasCitas = await tx.cita.findMany({
          where: { medicoId: medicoIdNum, fecha, estado: { not: "CANCELADA" } },
          select: { hora: true, servicio: { select: { duracionMin: true } } },
        });
        const inicio = minutos(hora);
        if (otrasCitas.some((cita) => {
          const otroInicio = minutos(cita.hora);
          return otroInicio !== null &&
            inicio < otroInicio + (cita.servicio?.duracionMin || 30) &&
            inicio + validacion.servicio.duracionMin > otroInicio;
        })) return null;
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
          include: { hospital: true },
        });
      }, { isolationLevel: "Serializable" });
    } catch (err) {
      if (err.code === "P2034" || err.code === "P2002") {
        return res.status(409).json({ error: "El horario acaba de ser reservado; elija otro." });
      }
      throw err;
    }
    if (!nueva) return res.status(409).json({ error: "El horario ya fue reservado" });

    const notificacion = await enviarAvisoCita(nueva, paciente, validacion.medico, nueva.hospital);
    res.status(201).json({ ...nueva, notificacion });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear la cita" });
  }
});

router.get("/", requiereAuth, requiereRol("PACIENTE"), async (req, res) => {
  try {
    const propias = await prisma.cita.findMany({
      where: { pacienteId: req.usuario.id },
      include: { medico: true, hospital: true, servicio: true },
      orderBy: [{ fecha: "asc" }, { hora: "asc" }],
    });
    res.json(propias.map(({ medico, hospital, servicio, ...cita }) => ({
      ...cita,
      medicoNombre: medico.nombre,
      hospitalNombre: hospital.nombre,
      servicioNombre: servicio.nombre,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar citas" });
  }
});

router.put("/:id/cancelar", requiereAuth, requiereRol("PACIENTE"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: "Cita no encontrada" });
    const cita = await prisma.cita.findUnique({ where: { id } });
    if (!cita) return res.status(404).json({ error: "Cita no encontrada" });
    if (cita.pacienteId !== req.usuario.id) return res.status(403).json({ error: "No autorizado" });
    if (!["PENDIENTE", "CONFIRMADA"].includes(cita.estado)) {
      return res.status(400).json({ error: "Esta cita ya no se puede cancelar" });
    }
    const actualizada = await prisma.cita.update({ where: { id }, data: { estado: "CANCELADA" } });
    res.json(actualizada);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al cancelar la cita" });
  }
});

router.put("/:id/reprogramar", requiereAuth, requiereRol("PACIENTE"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: "Cita no encontrada" });
    const cita = await prisma.cita.findUnique({ where: { id } });
    if (!cita) return res.status(404).json({ error: "Cita no encontrada" });
    if (cita.pacienteId !== req.usuario.id) return res.status(403).json({ error: "No autorizado" });
    if (cita.estado === "CANCELADA" || cita.estado === "ATENDIDA") {
      return res.status(400).json({ error: "Esta cita no se puede reprogramar" });
    }
    const { fecha, hora } = req.body || {};
    if (!fechaValida(fecha) || minutos(hora) === null) {
      return res.status(400).json({ error: "fecha y hora válidas son requeridas" });
    }
    if (!fechaHoraFutura(fecha, hora)) {
      return res.status(400).json({ error: "La cita debe reprogramarse para una fecha y hora futuras" });
    }
    const validacion = await validarReserva({
      medicoId: cita.medicoId,
      hospitalId: cita.hospitalId,
      servicioId: cita.servicioId,
      fecha,
      hora,
      excluirCitaId: cita.id,
    });
    if (validacion.error) return res.status(validacion.status).json({ error: validacion.error });

    const actualizada = await prisma.$transaction(async (tx) => {
      const otrasCitas = await tx.cita.findMany({
        where: { medicoId: cita.medicoId, fecha, estado: { not: "CANCELADA" }, id: { not: cita.id } },
        select: { hora: true, servicio: { select: { duracionMin: true } } },
      });
      const inicio = minutos(hora);
      if (otrasCitas.some((item) => {
        const otroInicio = minutos(item.hora);
        return otroInicio !== null &&
          inicio < otroInicio + (item.servicio?.duracionMin || 30) &&
          inicio + validacion.servicio.duracionMin > otroInicio;
      })) return null;
      return tx.cita.update({
        where: { id: cita.id },
        data: { fecha, hora, fechaHora: new Date(`${fecha}T${hora}:00`) },
      });
    }, { isolationLevel: "Serializable" });
    if (!actualizada) return res.status(409).json({ error: "El nuevo horario ya está reservado" });
    res.json(actualizada);
  } catch (err) {
    console.error(err);
    if (err.code === "P2034" || err.code === "P2002") {
      return res.status(409).json({ error: "El nuevo horario acaba de ser reservado" });
    }
    res.status(500).json({ error: "Error al reprogramar la cita" });
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
      if (req.usuario.rol === "PERSONAL_ADMINISTRATIVO" && cita.hospitalId !== req.usuario.hospitalId) {
        return res.status(403).json({ error: "La cita pertenece a otro hospital" });
      }
      const transiciones = {
        PENDIENTE: ["CONFIRMADA", "CANCELADA"],
        CONFIRMADA: ["CANCELADA", "ATENDIDA"],
        CANCELADA: [],
        ATENDIDA: [],
      };
      if (cita.estado !== estado && !transiciones[cita.estado]?.includes(estado)) {
        return res.status(400).json({ error: `No se puede cambiar una cita ${cita.estado} a ${estado}` });
      }
      const actualizada = await prisma.cita.update({ where: { id }, data: { estado } });
      res.json(actualizada);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al cambiar el estado de la cita" });
    }
  }
);

router.get(
  "/proximas",
  requiereAuth,
  requiereRol("PACIENTE", "MEDICO", "PERSONAL_ADMINISTRATIVO", "ADMIN_SISTEMA"),
  async (req, res) => {
    try {
      const where = {
        fechaHora: { gte: new Date() },
        estado: { in: ["PENDIENTE", "CONFIRMADA"] },
        ...(req.usuario.rol === "PACIENTE" ? { pacienteId: req.usuario.id } : {}),
        ...(req.usuario.rol === "MEDICO" ? { medicoId: req.usuario.medicoId } : {}),
        ...(req.usuario.rol === "PERSONAL_ADMINISTRATIVO"
          ? { hospitalId: req.usuario.hospitalId }
          : {}),
      };
      if (
        req.usuario.rol === "MEDICO" && !req.usuario.medicoId ||
        req.usuario.rol === "PERSONAL_ADMINISTRATIVO" && !req.usuario.hospitalId
      ) {
        return res.status(403).json({ error: "La cuenta no tiene hospital o agenda asociada" });
      }
      const citas = await prisma.cita.findMany({
        where,
        include: {
          paciente: { select: { nombre: true } },
          medico: { select: { nombre: true } },
          hospital: { select: { nombre: true } },
          servicio: { select: { nombre: true } },
        },
        orderBy: { fechaHora: "asc" },
        take: 8,
      });
      res.json(citas.map(({ paciente, medico, hospital, servicio, ...cita }) => ({
        ...cita,
        pacienteNombre: paciente.nombre,
        medicoNombre: medico.nombre,
        hospitalNombre: hospital.nombre,
        servicioNombre: servicio.nombre,
      })));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al consultar próximas citas" });
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
    res.json(agenda.map(({ paciente, servicio, ...cita }) => ({
      ...cita,
      pacienteNombre: paciente.nombre,
      pacienteCorreo: paciente.correo,
      pacienteCedula: paciente.cedula,
      servicioNombre: servicio.nombre,
    })));
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
      if (fecha !== undefined && !fechaValida(fecha)) {
        return res.status(400).json({ error: "fecha debe tener formato YYYY-MM-DD" });
      }
      if (req.usuario.rol === "PERSONAL_ADMINISTRATIVO" && !req.usuario.hospitalId) {
        return res.status(403).json({ error: "La cuenta administrativa no está asociada a un hospital" });
      }
      const filtroHospital = req.usuario.rol === "PERSONAL_ADMINISTRATIVO"
        ? { hospitalId: req.usuario.hospitalId }
        : {};
      const citas = await prisma.cita.findMany({
        where: { ...filtroHospital, ...(fecha ? { fecha } : {}) },
        include: { paciente: true, medico: true, hospital: true, servicio: true },
        orderBy: [{ fecha: "asc" }, { hora: "asc" }],
      });
      res.json(citas.map(({ paciente, medico, hospital, servicio, ...cita }) => ({
        ...cita,
        pacienteNombre: paciente.nombre,
        medicoNombre: medico.nombre,
        hospitalNombre: hospital.nombre,
        servicioNombre: servicio.nombre,
      })));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al consultar citas" });
    }
  }
);

export default router;
