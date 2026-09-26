import { Router } from "express";
import { prisma } from "../db/prisma.js";

const router = Router();

// GET /api/medicos?especialidad=Medicina General
router.get("/", async (req, res) => {
  try {
    const { especialidad } = req.query;
    const medicos = await prisma.medico.findMany({
      where: especialidad
        ? { especialidad: { contains: especialidad, mode: "insensitive" } }
        : undefined,
      orderBy: { nombre: "asc" },
    });
    res.json(medicos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar medicos" });
  }
});

export default router;
