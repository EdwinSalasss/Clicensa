import { Router } from "express";
import { medicos } from "../data/seed.js";

const router = Router();

// GET /api/medicos?especialidad=Medicina General
router.get("/", (req, res) => {
  const { especialidad } = req.query;
  const resultado = especialidad
    ? medicos.filter((m) =>
        m.especialidad.toLowerCase().includes(especialidad.toLowerCase())
      )
    : medicos;
  res.json(resultado);
});

export default router;
