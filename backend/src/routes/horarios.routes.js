import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { requiereAuth, requiereRol } from "../middleware/auth.js";
import {
  obtenerCalendarioDisponibilidad,
  obtenerHorariosDisponibles,
} from "../services/availability.js";
import { marcarCitasVencidas } from "../services/appointmentStatus.js";
import { fechaHoraFutura, fechaValida, minutos } from "../services/dateTime.js";

const router = Router();

router.get("/", requiereAuth, requiereRol("MEDICO"), async (req, res) => {
  try {
    if (!req.usuario.medicoId) return res.status(400).json({ error: "La cuenta no tiene un médico asociado" });
    const disponibilidad = await prisma.horarioDisponibilidad.findMany({
      where: { medicoId: req.usuario.medicoId },
      orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
    });
    res.json({ disponibilidad });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar la disponibilidad" });
  }
});

router.get("/disponibles", async (req, res) => {
  try {
    const medicoId = Number(req.query.medicoId);
    const { fecha } = req.query;
    const servicioId = req.query.servicioId === undefined ? null : Number(req.query.servicioId);
    if (!Number.isInteger(medicoId) || medicoId <= 0 || !fechaValida(fecha)) {
      return res.status(400).json({ error: "medicoId y una fecha válida (YYYY-MM-DD) son requeridos" });
    }
    if (servicioId !== null && (!Number.isInteger(servicioId) || servicioId <= 0)) {
      return res.status(400).json({ error: "servicioId debe ser un entero positivo" });
    }
    const medico = await prisma.medico.findUnique({
      where: { id: medicoId },
      include: {
        disponibilidad: true,
        usuario: { select: { activo: true, activadoEn: true } },
      },
    });
    if (!medico) return res.status(404).json({ error: "Médico no encontrado" });
    if (!medico.usuario?.activo || !medico.usuario.activadoEn) {
      return res.status(403).json({ error: "El médico no está activo para recibir citas" });
    }
    const servicio = servicioId
      ? await prisma.tipoServicio.findUnique({ where: { id: servicioId } })
      : await prisma.tipoServicio.findFirst({
          where: { hospitalId: medico.hospitalId },
          orderBy: { id: "asc" },
        });
    if (!servicio || servicio.hospitalId !== medico.hospitalId) {
      return res.status(400).json({ error: "El servicio no pertenece al hospital del médico" });
    }
    await marcarCitasVencidas({ medicoId });
    const disponibles = await obtenerHorariosDisponibles(prisma, medico, fecha, servicio.id);
    res.json({ medicoId, fecha, disponibles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar horarios disponibles" });
  }
});

router.get("/calendario", async (req, res) => {
  try {
    const medicoId = Number(req.query.medicoId);
    const servicioId = Number(req.query.servicioId);
    const { desde, hasta } = req.query;
    if (
      !Number.isInteger(medicoId) || medicoId <= 0 ||
      !Number.isInteger(servicioId) || servicioId <= 0 ||
      !fechaValida(desde) || !fechaValida(hasta)
    ) {
      return res.status(400).json({
        error: "medicoId, servicioId y un rango válido (desde/hasta en YYYY-MM-DD) son requeridos",
      });
    }
    const dias = (new Date(`${hasta}T00:00:00.000Z`) - new Date(`${desde}T00:00:00.000Z`)) / 86_400_000;
    if (dias < 0 || dias > 30) {
      return res.status(400).json({ error: "El calendario debe abarcar entre 1 y 31 días" });
    }

    const [medico, servicio] = await Promise.all([
      prisma.medico.findUnique({
        where: { id: medicoId },
        include: {
          disponibilidad: true,
          usuario: { select: { activo: true, activadoEn: true } },
        },
      }),
      prisma.tipoServicio.findUnique({ where: { id: servicioId } }),
    ]);
    if (!medico) return res.status(404).json({ error: "Médico no encontrado" });
    if (!servicio || servicio.hospitalId !== medico.hospitalId) {
      return res.status(400).json({ error: "El servicio no pertenece al hospital del médico" });
    }
    if (!medico.usuario?.activo || !medico.usuario.activadoEn) {
      return res.status(403).json({ error: "El médico seleccionado todavía no ha activado su cuenta" });
    }

    await marcarCitasVencidas({ medicoId });
    const diasDisponibilidad = await obtenerCalendarioDisponibilidad(
      prisma,
      medico,
      servicio,
      desde,
      hasta
    );
    res.json({ medicoId, servicioId, desde, hasta, dias: diasDisponibilidad });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar disponibilidad del calendario" });
  }
});

router.post("/", requiereAuth, requiereRol("MEDICO"), async (req, res) => {
  try {
    if (!req.usuario.medicoId) return res.status(400).json({ error: "La cuenta no tiene un médico asociado" });
    const { disponibilidad } = req.body || {};
    if (!Array.isArray(disponibilidad)) {
      return res.status(400).json({ error: "disponibilidad debe ser una lista de bloques semanales" });
    }
    const validos = disponibilidad.every((bloque) =>
      Number.isInteger(bloque?.diaSemana) &&
      bloque.diaSemana >= 0 &&
      bloque.diaSemana <= 6 &&
      minutos(bloque.horaInicio) !== null &&
      minutos(bloque.horaFin) !== null &&
      minutos(bloque.horaInicio) < minutos(bloque.horaFin)
    );
    if (!validos) return res.status(400).json({ error: "Cada bloque requiere día (0-6) y horas válidas con fin posterior al inicio" });
    const porDia = new Map();
    for (const bloque of disponibilidad) {
      const dia = porDia.get(bloque.diaSemana) || [];
      dia.push({ inicio: minutos(bloque.horaInicio), fin: minutos(bloque.horaFin) });
      porDia.set(bloque.diaSemana, dia);
    }
    for (const bloques of porDia.values()) {
      bloques.sort((a, b) => a.inicio - b.inicio);
      if (bloques.some((bloque, index) => index > 0 && bloque.inicio < bloques[index - 1].fin)) {
        return res.status(400).json({ error: "Los bloques del mismo día no pueden traslaparse" });
      }
    }
    const medico = await prisma.medico.findUnique({ where: { id: req.usuario.medicoId } });
    if (!medico) return res.status(404).json({ error: "Perfil médico no encontrado" });
    const resultado = await prisma.$transaction(async (tx) => {
      await tx.horarioDisponibilidad.deleteMany({ where: { medicoId: medico.id } });
      await tx.horarioBase.deleteMany({ where: { medicoId: medico.id } });
      if (disponibilidad.length) {
        await tx.horarioDisponibilidad.createMany({
          data: disponibilidad.map(({ diaSemana, horaInicio, horaFin }) => ({
            medicoId: medico.id, diaSemana, horaInicio, horaFin,
          })),
        });
      }
      return tx.horarioDisponibilidad.findMany({
        where: { medicoId: medico.id },
        orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
      });
    });
    res.json({ disponibilidad: resultado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al guardar la disponibilidad semanal" });
  }
});

export default router;
