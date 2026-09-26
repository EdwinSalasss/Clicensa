import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { requiereAuth, requiereRol } from "../middleware/auth.js";

const router = Router();

// GET /api/medicos?especialidad=Medicina General
router.get("/", async (req, res) => {
  try {
    const { especialidad } = req.query;
    if (especialidad !== undefined && typeof especialidad !== "string") {
      return res.status(400).json({ error: "especialidad debe ser texto" });
    }
    const medicos = await prisma.medico.findMany({
      where: especialidad
        ? { especialidad: { contains: especialidad, mode: "insensitive" } }
        : undefined,
      orderBy: { nombre: "asc" },
      include: { horarios: { orderBy: { hora: "asc" } } },
    });
    res.json(medicos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar medicos" });
  }
});

router.post("/", requiereAuth, requiereRol("administrativo"), async (req, res) => {
  try {
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
      data: { nombre: nombre.trim(), especialidad: especialidad.trim() },
    });
    res.status(201).json(medico);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear medico" });
  }
});

router.post("/:id/horarios", requiereAuth, requiereRol("administrativo"), async (req, res) => {
  try {
    const medicoId = Number(req.params.id);
    const { hora } = req.body || {};
    if (!Number.isInteger(medicoId) || medicoId <= 0) {
      return res.status(404).json({ error: "Medico no encontrado" });
    }

    const medico = await prisma.medico.findUnique({ where: { id: medicoId } });
    if (!medico) return res.status(404).json({ error: "Medico no encontrado" });
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
  requiereRol("administrativo"),
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

      await prisma.horarioBase.delete({ where: { id: horarioId } });
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al eliminar horario" });
    }
  }
);

export default router;
