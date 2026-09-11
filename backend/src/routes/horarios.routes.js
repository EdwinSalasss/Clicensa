import { Router } from "express";
import { horariosBase, citas } from "../data/seed.js";

const router = Router();

// GET /api/horarios/disponibles?medicoId=1&fecha=2026-09-16
router.get("/disponibles", (req, res) => {
  const medicoId = Number(req.query.medicoId);
  const { fecha } = req.query;

  if (!medicoId || !fecha) {
    return res
      .status(400)
      .json({ error: "medicoId y fecha son requeridos" });
  }

  const base = horariosBase[medicoId] || [];
  const ocupados = citas
    .filter(
      (c) =>
        c.medicoId === medicoId && c.fecha === fecha && c.estado !== "cancelada"
    )
    .map((c) => c.hora);

  const disponibles = base.filter((h) => !ocupados.includes(h));
  res.json({ medicoId, fecha, disponibles });
});

export default router;
