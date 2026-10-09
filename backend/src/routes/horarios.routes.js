import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { requiereAuth, requiereRol } from "../middleware/auth.js";

const router = Router();

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
      include: { disponibilidad: true },
    });
    if (!medico) return res.status(404).json({ error: "Médico no encontrado" });
    let duracionMin = 30;
    if (servicioId) {
      const servicio = await prisma.tipoServicio.findUnique({ where: { id: servicioId } });
      if (!servicio || servicio.hospitalId !== medico.hospitalId) {
        return res.status(400).json({ error: "El servicio no pertenece al hospital del médico" });
      }
      duracionMin = servicio.duracionMin;
    }
    const diaSemana = new Date(`${fecha}T00:00:00.000Z`).getUTCDay();
    const bloques = medico.disponibilidad.filter((item) => item.diaSemana === diaSemana);
    const horariosLegacy = medico.disponibilidad.length
      ? []
      : await prisma.horarioBase.findMany({ where: { medicoId }, orderBy: { hora: "asc" } });
    const citas = await prisma.cita.findMany({
      where: { medicoId, fecha, estado: { not: "CANCELADA" } },
      select: { hora: true, servicio: { select: { duracionMin: true } } },
    });
    const ocupaciones = citas.map((cita) => {
      const inicio = minutos(cita.hora);
      return inicio === null ? null : { inicio, fin: inicio + (cita.servicio?.duracionMin || 30) };
    }).filter(Boolean);
    const candidatos = new Set();
    for (const bloque of bloques) {
      const inicio = minutos(bloque.horaInicio);
      const fin = minutos(bloque.horaFin);
      if (inicio === null || fin === null) continue;
      for (let slot = inicio; slot + duracionMin <= fin; slot += duracionMin) {
        candidatos.add(`${String(Math.floor(slot / 60)).padStart(2, "0")}:${String(slot % 60).padStart(2, "0")}`);
      }
    }
    if (!medico.disponibilidad.length) {
      for (const horario of horariosLegacy) candidatos.add(horario.hora);
    }
    const disponibles = [...candidatos].sort().filter((hora) => {
      const inicio = minutos(hora);
      return fechaHoraFutura(fecha, hora) && !ocupaciones.some((ocupacion) =>
        inicio < ocupacion.fin && inicio + duracionMin > ocupacion.inicio
      );
    });
    res.json({ medicoId, fecha, disponibles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar horarios disponibles" });
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
