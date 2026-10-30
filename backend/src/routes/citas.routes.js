import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { requiereAuth, requiereRol } from "../middleware/auth.js";
import { correoConfigurado, enviarCorreo } from "../services/email.js";
import { marcarCitasVencidas } from "../services/appointmentStatus.js";
import { fechaHoraFutura, fechaValida, minutos } from "../services/dateTime.js";

const router = Router();
const ESTADOS_VALIDOS = ["CONFIRMADA", "CANCELADA", "ATENDIDA"];
const ESTADOS_QUE_RESERVAN_HORARIO = ["PENDIENTE", "CONFIRMADA"];

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
      subject: cita.estado === "CONFIRMADA"
        ? `Cita confirmada en ${hospital.nombre}`
        : `Solicitud de cita médica en ${hospital.nombre}`,
      html: cita.estado === "CONFIRMADA"
        ? `<p>Hola ${escapeHtml(paciente.nombre)}, el médico ${escapeHtml(medico.nombre)} confirmó tu cita para el ${escapeHtml(cita.fecha)} a las ${escapeHtml(cita.hora)}.</p>`
        : `<p>Hola ${escapeHtml(paciente.nombre)}, recibimos tu solicitud de cita con ${escapeHtml(medico.nombre)} para el ${escapeHtml(cita.fecha)} a las ${escapeHtml(cita.hora)}. El médico debe confirmarla.</p>`,
    });
    return { enviada: true };
  } catch (err) {
    console.error("No se pudo enviar la notificación de la cita:", err);
    return { enviada: false, motivo: "fallo_proveedor" };
  }
}

async function enviarAvisoCorreo({ to, subject, html, descripcion }) {
  if (!correoConfigurado()) {
    console.warn(`Notificación de ${descripcion} no enviada: configura RESEND_API_KEY y EMAIL_FROM.`);
    return { enviada: false, motivo: "correo_no_configurado" };
  }
  try {
    await enviarCorreo({ to, subject, html });
    return { enviada: true };
  } catch (err) {
    console.error(`No se pudo enviar la notificación de ${descripcion}:`, err);
    return { enviada: false, motivo: "fallo_proveedor" };
  }
}

async function validarReserva({ medicoId, hospitalId, servicioId, fecha, hora, excluirCitaId }) {
  const [medico, servicio] = await Promise.all([
    prisma.medico.findUnique({
      where: { id: medicoId },
      include: {
        disponibilidad: true,
        usuario: { select: { id: true, correo: true, activo: true, activadoEn: true } },
      },
    }),
    prisma.tipoServicio.findUnique({ where: { id: servicioId } }),
  ]);
  if (!medico) return { error: "Médico no encontrado", status: 404 };
  if (!medico.usuario?.activo || !medico.usuario.activadoEn) {
    return { error: "El médico no está activo para recibir citas", status: 403 };
  }
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

  const filtroExclusion = excluirCitaId ? { id: { not: excluirCitaId } } : {};
  const [citasExistentes, solicitudesExistentes] = await Promise.all([
    prisma.cita.findMany({
      where: {
        medicoId,
        fecha,
        estado: { in: ESTADOS_QUE_RESERVAN_HORARIO },
        ...filtroExclusion,
      },
      select: { hora: true, servicio: { select: { duracionMin: true } } },
    }),
    prisma.cita.findMany({
      where: {
        medicoId,
        fechaReprogramacion: fecha,
        estadoReprogramacion: "PENDIENTE",
        ...filtroExclusion,
      },
      select: {
        horaReprogramacion: true,
        servicio: { select: { duracionMin: true } },
      },
    }),
  ]);
  const ocupaciones = [
    ...citasExistentes.map((cita) => ({
      hora: cita.hora,
      duracion: cita.servicio?.duracionMin || 30,
    })),
    ...solicitudesExistentes.map((solicitud) => ({
      hora: solicitud.horaReprogramacion,
      duracion: solicitud.servicio?.duracionMin || 30,
    })),
  ];
  const seTraslapa = ocupaciones.some(({ hora: horaOcupada, duracion }) => {
    const inicioExistente = minutos(horaOcupada);
    return inicioExistente !== null &&
      inicio < inicioExistente + duracion &&
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
      return res.status(400).json({ error: "Selecciona un médico y proporciona una fecha y hora válidas (HH:mm)." });
    }
    if (!Number.isInteger(clinicId) || clinicId <= 0) {
      return res.status(400).json({ error: "Selecciona un hospital válido." });
    }
    if (!fechaHoraFutura(fecha, hora)) {
      return res.status(400).json({ error: "La cita debe programarse para una fecha y hora futuras" });
    }
    if (servicioIdNum !== null && (!Number.isInteger(servicioIdNum) || servicioIdNum <= 0)) {
      return res.status(400).json({ error: "Selecciona un servicio válido." });
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
          return res.status(400).json({ error: "Selecciona un paciente válido." });
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
        return res.status(400).json({ error: "Busca al paciente por correo electrónico o cédula." });
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
    if (
      req.usuario.rol === "PACIENTE" &&
      !validacion.medico.usuario?.correo
    ) {
      return res.status(400).json({ error: "El médico seleccionado todavía no tiene una cuenta activa" });
    }

    let nueva;
    try {
      nueva = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "usuarios" WHERE "medicoId" = ${medicoIdNum} FOR UPDATE`;
        const cuentaMedico = await tx.usuario.findFirst({
          where: {
            medicoId: medicoIdNum,
            activo: true,
            activadoEn: { not: null },
          },
          select: { id: true },
        });
        if (!cuentaMedico) return { error: "El médico fue desactivado; seleccione otro médico." };

        const [otrasCitas, solicitudes] = await Promise.all([
          tx.cita.findMany({
            where: {
              medicoId: medicoIdNum,
              fecha,
              estado: { in: ESTADOS_QUE_RESERVAN_HORARIO },
            },
            select: { hora: true, servicio: { select: { duracionMin: true } } },
          }),
          tx.cita.findMany({
            where: {
              medicoId: medicoIdNum,
              fechaReprogramacion: fecha,
              estadoReprogramacion: "PENDIENTE",
            },
            select: {
              horaReprogramacion: true,
              servicio: { select: { duracionMin: true } },
            },
          }),
        ]);
        const inicio = minutos(hora);
        const ocupaciones = [
          ...otrasCitas.map((cita) => ({ hora: cita.hora, duracion: cita.servicio?.duracionMin || 30 })),
          ...solicitudes.map((solicitud) => ({
            hora: solicitud.horaReprogramacion,
            duracion: solicitud.servicio?.duracionMin || 30,
          })),
        ];
        if (ocupaciones.some(({ hora: horaOcupada, duracion }) => {
          const otroInicio = minutos(horaOcupada);
          return otroInicio !== null &&
            inicio < otroInicio + duracion &&
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
            estado: req.usuario.rol === "MEDICO" ? "CONFIRMADA" : "PENDIENTE",
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
    if (nueva?.error) return res.status(403).json({ error: nueva.error });
    if (!nueva) return res.status(409).json({ error: "El horario ya fue reservado" });

    const notificacion = await enviarAvisoCita(nueva, paciente, validacion.medico, nueva.hospital);
    const notificacionMedico = req.usuario.rol === "PACIENTE"
      ? await enviarAvisoCorreo({
          to: validacion.medico.usuario.correo,
          subject: "Nueva solicitud de cita médica",
          html: `<p>Tienes una nueva solicitud de cita de ${escapeHtml(paciente.nombre)} para el ${escapeHtml(fecha)} a las ${escapeHtml(hora)}.</p><p>Servicio: ${escapeHtml(validacion.servicio.nombre)}. Ingresa a tu agenda para confirmarla o gestionarla.</p>`,
          descripcion: "solicitud de cita al médico",
        })
      : undefined;
    res.status(201).json({ ...nueva, notificacion, ...(notificacionMedico ? { notificacionMedico } : {}) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear la cita" });
  }
});

router.get("/", requiereAuth, requiereRol("PACIENTE"), async (req, res) => {
  try {
    await marcarCitasVencidas({ pacienteId: req.usuario.id });
    const propias = await prisma.cita.findMany({
      where: { pacienteId: req.usuario.id },
      include: { medico: true, hospital: true, servicio: true },
      orderBy: [{ fecha: "asc" }, { hora: "asc" }],
    });
    res.json(propias.map(({ medico, hospital, servicio, ...cita }) => ({
      ...cita,
      reprogramacionPendiente: cita.estadoReprogramacion === "PENDIENTE",
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
    const actualizada = await prisma.cita.update({
      where: { id },
      data: {
        estado: "CANCELADA",
        fechaReprogramacion: null,
        horaReprogramacion: null,
        estadoReprogramacion: null,
        solicitadaReprogramacionEn: null,
        resueltaReprogramacionEn: null,
      },
    });
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
    await marcarCitasVencidas({ pacienteId: req.usuario.id });
    const citaVigente = await prisma.cita.findUnique({ where: { id } });
    if (!citaVigente) return res.status(404).json({ error: "Cita no encontrada" });
    if (!ESTADOS_QUE_RESERVAN_HORARIO.includes(citaVigente.estado)) {
      return res.status(400).json({ error: "Esta cita no se puede reprogramar" });
    }
    if (citaVigente.estadoReprogramacion === "PENDIENTE") {
      return res.status(409).json({ error: "Ya hay una solicitud de reprogramación pendiente para esta cita" });
    }
    const { fecha, hora } = req.body || {};
    if (!fechaValida(fecha) || minutos(hora) === null) {
      return res.status(400).json({ error: "fecha y hora válidas son requeridas" });
    }
    if (!fechaHoraFutura(fecha, hora)) {
      return res.status(400).json({ error: "La cita debe reprogramarse para una fecha y hora futuras" });
    }
    if (citaVigente.fecha === fecha && citaVigente.hora === hora) {
      return res.status(400).json({ error: "Seleccione un horario distinto al horario actual" });
    }
    const validacion = await validarReserva({
      medicoId: citaVigente.medicoId,
      hospitalId: citaVigente.hospitalId,
      servicioId: citaVigente.servicioId,
      fecha,
      hora,
      excluirCitaId: citaVigente.id,
    });
    if (validacion.error) return res.status(validacion.status).json({ error: validacion.error });

    let actualizada;
    try {
      actualizada = await prisma.$transaction(async (tx) => {
        const [otrasCitas, solicitudes] = await Promise.all([
          tx.cita.findMany({
            where: {
              medicoId: citaVigente.medicoId,
              fecha,
              estado: { in: ESTADOS_QUE_RESERVAN_HORARIO },
              id: { not: citaVigente.id },
            },
            select: { hora: true, servicio: { select: { duracionMin: true } } },
          }),
          tx.cita.findMany({
            where: {
              medicoId: citaVigente.medicoId,
              fechaReprogramacion: fecha,
              estadoReprogramacion: "PENDIENTE",
              id: { not: citaVigente.id },
            },
            select: {
              horaReprogramacion: true,
              servicio: { select: { duracionMin: true } },
            },
          }),
        ]);
        const inicio = minutos(hora);
        const ocupaciones = [
          ...otrasCitas.map((item) => ({ hora: item.hora, duracion: item.servicio?.duracionMin || 30 })),
          ...solicitudes.map((item) => ({
            hora: item.horaReprogramacion,
            duracion: item.servicio?.duracionMin || 30,
          })),
        ];
        if (ocupaciones.some(({ hora: horaOcupada, duracion }) => {
          const otroInicio = minutos(horaOcupada);
          return otroInicio !== null &&
            inicio < otroInicio + duracion &&
            inicio + validacion.servicio.duracionMin > otroInicio;
        })) return null;
        return tx.cita.update({
          where: { id: citaVigente.id },
          data: {
            fechaReprogramacion: fecha,
            horaReprogramacion: hora,
            estadoReprogramacion: "PENDIENTE",
            solicitadaReprogramacionEn: new Date(),
            resueltaReprogramacionEn: null,
          },
        });
      }, { isolationLevel: "Serializable" });
    } catch (err) {
      if (err.code === "P2034" || err.code === "P2002") {
        return res.status(409).json({ error: "El nuevo horario acaba de ser solicitado por otra cita" });
      }
      throw err;
    }
    if (!actualizada) return res.status(409).json({ error: "El nuevo horario ya está reservado" });
    const medico = await prisma.medico.findUnique({
      where: { id: citaVigente.medicoId },
      include: { usuario: { select: { correo: true } } },
    });
    const notificacion = medico?.usuario?.correo
      ? await enviarAvisoCorreo({
          to: medico.usuario.correo,
          subject: "Solicitud de reprogramación de cita",
          html: `<p>El paciente solicita cambiar su cita al ${escapeHtml(fecha)} a las ${escapeHtml(hora)}.</p><p>Revisa la solicitud en tu agenda médica.</p>`,
          descripcion: "solicitud de reprogramación al médico",
        })
      : { enviada: false, motivo: "medico_sin_cuenta" };
    res.json({ ...actualizada, notificacion });
  } catch (err) {
    console.error(err);
    if (err.code === "P2034" || err.code === "P2002") {
      return res.status(409).json({ error: "El nuevo horario acaba de ser reservado" });
    }
    res.status(500).json({ error: "Error al reprogramar la cita" });
  }
});

router.get(
  "/solicitudes-reprogramacion",
  requiereAuth,
  requiereRol("MEDICO"),
  async (req, res) => {
    try {
      if (!req.usuario.medicoId) {
        return res.status(403).json({ error: "La cuenta no tiene una agenda médica asociada" });
      }
      const solicitudes = await prisma.cita.findMany({
        where: { medicoId: req.usuario.medicoId, estadoReprogramacion: "PENDIENTE" },
        include: {
          paciente: { select: { nombre: true, correo: true } },
          servicio: { select: { nombre: true } },
          hospital: { select: { nombre: true } },
        },
        orderBy: [{ solicitadaReprogramacionEn: "asc" }, { id: "asc" }],
      });
      res.json(solicitudes.map(({ paciente, servicio, hospital, ...cita }) => ({
        ...cita,
        pacienteNombre: paciente.nombre,
        pacienteCorreo: paciente.correo,
        servicioNombre: servicio.nombre,
        hospitalNombre: hospital.nombre,
      })));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al consultar solicitudes de reprogramación" });
    }
  }
);

router.put(
  "/:id/reprogramacion/decision",
  requiereAuth,
  requiereRol("MEDICO"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { aprobar } = req.body || {};
      if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: "Cita no encontrada" });
      if (typeof aprobar !== "boolean") {
        return res.status(400).json({ error: "Indica si apruebas o rechazas la solicitud de cambio." });
      }
      const cita = await prisma.cita.findUnique({
        where: { id },
        include: {
          paciente: { select: { nombre: true, correo: true } },
          servicio: { select: { nombre: true, duracionMin: true } },
        },
      });
      if (!cita) return res.status(404).json({ error: "Cita no encontrada" });
      if (cita.medicoId !== req.usuario.medicoId) {
        return res.status(403).json({ error: "Solo el médico asignado puede resolver esta solicitud" });
      }
      if (cita.estadoReprogramacion !== "PENDIENTE") {
        return res.status(409).json({ error: "La solicitud ya fue resuelta o no existe" });
      }
      if (!cita.fechaReprogramacion || !cita.horaReprogramacion) {
        return res.status(409).json({ error: "La solicitud no tiene un horario válido" });
      }
      if (aprobar) {
        if (!fechaHoraFutura(cita.fechaReprogramacion, cita.horaReprogramacion)) {
          return res.status(400).json({ error: "El horario propuesto ya pasó y no se puede aprobar" });
        }
        const validacion = await validarReserva({
          medicoId: cita.medicoId,
          hospitalId: cita.hospitalId,
          servicioId: cita.servicioId,
          fecha: cita.fechaReprogramacion,
          hora: cita.horaReprogramacion,
          excluirCitaId: cita.id,
        });
        if (validacion.error) return res.status(validacion.status).json({ error: validacion.error });
      }

      let actualizada;
      try {
        actualizada = await prisma.$transaction(async (tx) => {
          if (aprobar) {
            const [ocupadas, solicitudes] = await Promise.all([
              tx.cita.findMany({
                where: {
                  medicoId: cita.medicoId,
                  fecha: cita.fechaReprogramacion,
                  estado: { in: ESTADOS_QUE_RESERVAN_HORARIO },
                  id: { not: cita.id },
                },
                select: { hora: true, servicio: { select: { duracionMin: true } } },
              }),
              tx.cita.findMany({
                where: {
                  medicoId: cita.medicoId,
                  fechaReprogramacion: cita.fechaReprogramacion,
                  estadoReprogramacion: "PENDIENTE",
                  id: { not: cita.id },
                },
                select: {
                  horaReprogramacion: true,
                  servicio: { select: { duracionMin: true } },
                },
              }),
            ]);
            const inicio = minutos(cita.horaReprogramacion);
            const conflictos = [
              ...ocupadas.map((item) => ({ hora: item.hora, duracion: item.servicio?.duracionMin || 30 })),
              ...solicitudes.map((item) => ({
                hora: item.horaReprogramacion,
                duracion: item.servicio?.duracionMin || 30,
              })),
            ].some(({ hora, duracion }) => {
              const otroInicio = minutos(hora);
              return otroInicio !== null &&
                inicio < otroInicio + duracion &&
                inicio + cita.servicio.duracionMin > otroInicio;
            });
            if (conflictos) {
              throw Object.assign(new Error("El horario solicitado ya fue ocupado"), { code: "SLOT_CONFLICT" });
            }
            return tx.cita.update({
              where: { id },
              data: {
                fecha: cita.fechaReprogramacion,
                hora: cita.horaReprogramacion,
                fechaHora: new Date(`${cita.fechaReprogramacion}T${cita.horaReprogramacion}:00`),
                estado: "CONFIRMADA",
                estadoReprogramacion: "APROBADA",
                resueltaReprogramacionEn: new Date(),
              },
            });
          }
          return tx.cita.update({
            where: { id },
            data: {
              estadoReprogramacion: "RECHAZADA",
              resueltaReprogramacionEn: new Date(),
            },
          });
        }, { isolationLevel: "Serializable" });
      } catch (err) {
        if (err.code === "SLOT_CONFLICT" || err.code === "P2034" || err.code === "P2002") {
          return res.status(409).json({ error: "El horario solicitado ya no está disponible; no se aplicó el cambio." });
        }
        throw err;
      }
      await marcarCitasVencidas({
        ...(req.usuario.rol === "MEDICO"
          ? { medicoId: req.usuario.medicoId }
          : { hospitalId: req.usuario.hospitalId }),
      });
      const notificacion = await enviarAvisoCorreo({
        to: cita.paciente.correo,
        subject: aprobar ? "Tu solicitud de reprogramación fue aprobada" : "Tu solicitud de reprogramación fue rechazada",
        html: aprobar
          ? `<p>El médico aprobó tu cita para el ${escapeHtml(actualizada.fecha)} a las ${escapeHtml(actualizada.hora)}.</p>`
          : `<p>El médico no aprobó el cambio solicitado. Tu cita permanece para el ${escapeHtml(cita.fecha)} a las ${escapeHtml(cita.hora)}.</p>`,
        descripcion: "decisión de reprogramación al paciente",
      });
      res.json({ ...actualizada, notificacion });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al resolver la solicitud de reprogramación" });
    }
  }
);

router.put(
  "/:id/estado",
  requiereAuth,
  requiereRol("MEDICO", "PERSONAL_ADMINISTRATIVO"),
  async (req, res) => {
    try {
      await marcarCitasVencidas(
        req.usuario.rol === "MEDICO"
          ? { medicoId: req.usuario.medicoId }
          : { hospitalId: req.usuario.hospitalId }
      );
      const estado = typeof req.body?.estado === "string" ? req.body.estado.toUpperCase() : "";
      if (!ESTADOS_VALIDOS.includes(estado)) {
        return res.status(400).json({ error: "Selecciona un estado permitido: confirmada, cancelada o atendida." });
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
      if (req.usuario.rol === "PERSONAL_ADMINISTRATIVO" && estado !== "CANCELADA") {
        return res.status(403).json({ error: "Solo el médico asignado puede confirmar o marcar como atendida esta cita" });
      }
      const transiciones = {
        PENDIENTE: ["CONFIRMADA", "CANCELADA"],
        CONFIRMADA: ["CANCELADA", "ATENDIDA"],
        VENCIDA: ["CANCELADA", "ATENDIDA"],
        CANCELADA: [],
        ATENDIDA: [],
      };
      if (cita.estado !== estado && !transiciones[cita.estado]?.includes(estado)) {
        return res.status(400).json({ error: `No se puede cambiar una cita ${cita.estado} a ${estado}` });
      }
      const actualizada = await prisma.cita.update({
        where: { id },
        data: {
          estado,
          ...(estado === "CANCELADA" ? {
            fechaReprogramacion: null,
            horaReprogramacion: null,
            estadoReprogramacion: null,
            solicitadaReprogramacionEn: null,
            resueltaReprogramacionEn: null,
          } : {}),
        },
      });
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
  requiereRol("PACIENTE", "MEDICO"),
  async (req, res) => {
    try {
      await marcarCitasVencidas(
        req.usuario.rol === "PACIENTE"
          ? { pacienteId: req.usuario.id }
          : { medicoId: req.usuario.medicoId }
      );
      if (req.usuario.rol === "MEDICO" && !req.usuario.medicoId) {
        return res.status(403).json({ error: "La cuenta no tiene una agenda asociada" });
      }
      const where = {
        ...(req.usuario.rol === "PACIENTE"
          ? { pacienteId: req.usuario.id }
          : { medicoId: req.usuario.medicoId }),
        OR: [
          {
            fechaHora: { gte: new Date() },
            estado: { in: ESTADOS_QUE_RESERVAN_HORARIO },
          },
          { estadoReprogramacion: "PENDIENTE" },
        ],
      };
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
        reprogramacionPendiente: cita.estadoReprogramacion === "PENDIENTE",
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
    await marcarCitasVencidas({ medicoId: req.usuario.medicoId });
    const { fecha } = req.query;
    if (!fechaValida(fecha)) return res.status(400).json({ error: "Selecciona una fecha válida con formato AAAA-MM-DD." });
    if (!req.usuario.medicoId) return res.status(403).json({ error: "La cuenta no tiene una agenda asociada" });
    const agenda = await prisma.cita.findMany({
      where: { medicoId: req.usuario.medicoId, fecha },
      include: { paciente: true, servicio: true },
      orderBy: { hora: "asc" },
    });
    res.json(agenda.map(({ paciente, servicio, ...cita }) => ({
      ...cita,
      reprogramacionPendiente: cita.estadoReprogramacion === "PENDIENTE",
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
      await marcarCitasVencidas(
        req.usuario.rol === "PERSONAL_ADMINISTRATIVO"
          ? { hospitalId: req.usuario.hospitalId }
          : {}
      );
      const { fecha } = req.query;
      if (fecha !== undefined && !fechaValida(fecha)) {
        return res.status(400).json({ error: "La fecha debe usar el formato AAAA-MM-DD." });
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
