import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { requiereAuth, requiereRol } from "../middleware/auth.js";

const router = Router();

function fechaValida(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const fechaUtc = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(fechaUtc.getTime()) && fechaUtc.toISOString().slice(0, 10) === fecha;
}

// ---------- PACIENTE ----------

// POST /api/citas   { medicoId, fecha, hora }
router.post("/", requiereAuth, requiereRol("paciente"), async (req, res) => {
  try {
    const { medicoId, fecha, hora } = req.body || {};
    const pacienteId = req.usuario.id;

    if (
      !Number.isInteger(Number(medicoId)) ||
      Number(medicoId) <= 0 ||
      typeof fecha !== "string" ||
      typeof hora !== "string" ||
      !fecha ||
      !hora
    ) {
      return res.status(400).json({ error: "medicoId, fecha y hora son requeridos" });
    }

    const medicoIdNum = Number(medicoId);
    if (!fechaValida(fecha)) {
      return res.status(400).json({ error: "fecha debe tener formato YYYY-MM-DD" });
    }
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
      return res.status(400).json({ error: "hora debe tener formato HH:mm" });
    }

    const horarioValido = await prisma.horarioBase.findFirst({
      where: { medicoId: medicoIdNum, hora },
    });
    if (!horarioValido) {
      return res.status(400).json({ error: "El horario solicitado no existe para ese medico" });
    }

    const yaOcupado = await prisma.cita.findFirst({
      where: {
        medicoId: medicoIdNum,
        fecha,
        hora,
        estado: { not: "cancelada" },
      },
    });
    if (yaOcupado) {
      return res.status(409).json({ error: "El horario ya fue reservado" });
    }

    const nueva = await prisma.cita.create({
      data: { pacienteId, medicoId: medicoIdNum, fecha, hora },
    });
    res.status(201).json(nueva);
  } catch (err) {
    console.error(err);
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "El horario ya fue reservado" });
    }
    res.status(500).json({ error: "Error al crear la cita" });
  }
});

// GET /api/citas  (citas del paciente autenticado)
router.get("/", requiereAuth, requiereRol("paciente"), async (req, res) => {
  try {
    const propias = await prisma.cita.findMany({
      where: { pacienteId: req.usuario.id },
      include: { medico: true },
      orderBy: [{ fecha: "asc" }, { hora: "asc" }],
    });

    const resultado = propias.map(({ medico, ...c }) => ({
      ...c,
      medicoNombre: medico.nombre,
    }));
    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar citas" });
  }
});

// PUT /api/citas/:id/cancelar  (paciente cancela su propia cita)
router.put("/:id/cancelar", requiereAuth, requiereRol("paciente"), async (req, res) => {
  try {
    const citaId = Number(req.params.id);
    if (!Number.isInteger(citaId) || citaId <= 0) {
      return res.status(404).json({ error: "Cita no encontrada" });
    }
    const cita = await prisma.cita.findUnique({ where: { id: citaId } });
    if (!cita) return res.status(404).json({ error: "Cita no encontrada" });
    if (cita.pacienteId !== req.usuario.id) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const actualizada = await prisma.cita.update({
      where: { id: cita.id },
      data: { estado: "cancelada" },
    });
    res.json(actualizada);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al cancelar la cita" });
  }
});

// PUT /api/citas/:id/reprogramar  (paciente reprograma su propia cita)
router.put("/:id/reprogramar", requiereAuth, requiereRol("paciente"), async (req, res) => {
  try {
    const citaId = Number(req.params.id);
    if (!Number.isInteger(citaId) || citaId <= 0) {
      return res.status(404).json({ error: "Cita no encontrada" });
    }
    const cita = await prisma.cita.findUnique({
      where: { id: citaId },
    });
    if (!cita) return res.status(404).json({ error: "Cita no encontrada" });
    if (cita.pacienteId !== req.usuario.id) {
      return res.status(403).json({ error: "No autorizado" });
    }
    if (cita.estado === "cancelada") {
      return res.status(400).json({ error: "No se puede reprogramar una cita cancelada" });
    }

    const { fecha, hora } = req.body || {};
    if (typeof fecha !== "string" || !fecha || typeof hora !== "string" || !hora) {
      return res.status(400).json({ error: "fecha y hora son requeridos" });
    }
    if (!fechaValida(fecha)) {
      return res.status(400).json({ error: "fecha debe tener formato YYYY-MM-DD" });
    }
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
      return res.status(400).json({ error: "hora debe tener formato HH:mm" });
    }

    const horarioValido = await prisma.horarioBase.findFirst({
      where: { medicoId: cita.medicoId, hora },
    });
    if (!horarioValido) {
      return res.status(400).json({ error: "El horario solicitado no existe para ese medico" });
    }

    const yaOcupado = await prisma.cita.findFirst({
      where: {
        id: { not: cita.id },
        medicoId: cita.medicoId,
        fecha,
        hora,
        estado: { not: "cancelada" },
      },
    });
    if (yaOcupado) {
      return res.status(409).json({ error: "El nuevo horario ya esta reservado" });
    }

    const actualizada = await prisma.cita.update({
      where: { id: cita.id },
      data: { fecha, hora },
    });
    res.json(actualizada);
  } catch (err) {
    console.error(err);
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "El nuevo horario ya esta reservado" });
    }
    res.status(500).json({ error: "Error al reprogramar la cita" });
  }
});

// ---------- MEDICO ----------

// GET /api/citas/medico?fecha=2026-09-16  (agenda del dia del medico autenticado)
router.get("/medico", requiereAuth, requiereRol("medico"), async (req, res) => {
  try {
    const { fecha } = req.query;
    if (typeof fecha !== "string" || !fechaValida(fecha)) {
      return res.status(400).json({ error: "fecha debe tener formato YYYY-MM-DD" });
    }
    if (!req.usuario.medicoId) {
      return res.status(400).json({ error: "Este usuario no tiene un medicoId asociado" });
    }

    const agenda = await prisma.cita.findMany({
      where: { medicoId: req.usuario.medicoId, fecha },
      include: { paciente: true },
      orderBy: { hora: "asc" },
    });

    const resultado = agenda.map(({ paciente, ...c }) => ({
      ...c,
      pacienteNombre: paciente.nombre,
    }));
    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar la agenda" });
  }
});

// ---------- ADMINISTRATIVO ----------

// GET /api/citas/todas?fecha=2026-09-16  (vista global para reportes/administracion)
router.get("/todas", requiereAuth, requiereRol("administrativo"), async (req, res) => {
  try {
    const { fecha } = req.query;
    if (fecha !== undefined && (typeof fecha !== "string" || !fechaValida(fecha))) {
      return res.status(400).json({ error: "fecha debe tener formato YYYY-MM-DD" });
    }
    const citas = await prisma.cita.findMany({
      where: fecha ? { fecha } : undefined,
      include: { paciente: true, medico: true },
      orderBy: [{ fecha: "asc" }, { hora: "asc" }],
    });

    const resultado = citas.map(({ paciente, medico, ...c }) => ({
      ...c,
      pacienteNombre: paciente.nombre,
      medicoNombre: medico.nombre,
    }));
    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar citas" });
  }
});

export default router;
