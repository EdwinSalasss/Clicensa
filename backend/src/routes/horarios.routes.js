import { Router } from "express";
import { prisma } from "../db/prisma.js";

const router = Router();

// GET /api/horarios/disponibles?medicoId=1&fecha=2026-09-16
router.get("/disponibles", async (req, res) => {
  try {
    const medicoId = Number(req.query.medicoId);
    const { fecha } = req.query;

    if (!medicoId || !fecha) {
      return res.status(400).json({ error: "medicoId y fecha son requeridos" });
    }

    const base = await prisma.horarioBase.findMany({
      where: { medicoId },
      orderBy: { hora: "asc" },
    });

    const citasDelDia = await prisma.cita.findMany({
      where: {
        medicoId,
        fecha,
        estado: { not: "cancelada" },
      },
      select: { hora: true },
    });

    const ocupados = new Set(citasDelDia.map((c) => c.hora));
    const disponibles = base.map((h) => h.hora).filter((hora) => !ocupados.has(hora));

    res.json({ medicoId, fecha, disponibles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar horarios disponibles" });
  }
});

export default router;
