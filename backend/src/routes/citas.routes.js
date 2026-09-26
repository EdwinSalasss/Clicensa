import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { requiereAuth, requiereRol } from "../middleware/auth.js";

const router = Router();

// ---------- PACIENTE ----------

// POST /api/citas   { medicoId, fecha, hora }
router.post("/", requiereAuth, requiereRol("paciente"), async (req, res) => {
  try {
    const { medicoId, fecha, hora } = req.body || {};
    const pacienteId = req.usuario.id;

    if (!medicoId || !fecha || !hora) {
      return res.status(400).json({ error: "medicoId, fecha y hora son requeridos" });
    }

    const medicoIdNum = Number(medicoId);

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
    const cita = await prisma.cita.findUnique({ where: { id: Number(req.params.id) } });
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

// ---------- MEDICO ----------

// GET /api/citas/medico?fecha=2026-09-16  (agenda del dia del medico autenticado)
router.get("/medico", requiereAuth, requiereRol("medico"), async (req, res) => {
  try {
    const { fecha } = req.query;
    if (!fecha) return res.status(400).json({ error: "fecha es requerida" });
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
