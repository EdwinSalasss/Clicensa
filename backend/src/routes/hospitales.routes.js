import { Router } from "express";
import { prisma } from "../db/prisma.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const hospitales = await prisma.hospital.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, direccion: true, telefono: true, logoUrl: true },
    });
    res.json(hospitales);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar hospitales" });
  }
});

export default router;
