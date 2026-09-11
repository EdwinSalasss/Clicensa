import { Router } from "express";
import { citas, crearCita, horariosBase } from "../data/seed.js";
import { requiereAuth } from "../middleware/auth.js";

const router = Router();

// POST /api/citas   { medicoId, fecha, hora }  (requiere estar autenticado)
router.post("/", requiereAuth, (req, res) => {
  const { medicoId, fecha, hora } = req.body || {};
  const pacienteId = req.usuario.id;

  if (!medicoId || !fecha || !hora) {
    return res
      .status(400)
      .json({ error: "medicoId, fecha y hora son requeridos" });
  }

  const base = horariosBase[medicoId] || [];
  if (!base.includes(hora)) {
    return res
      .status(400)
      .json({ error: "El horario solicitado no existe para ese medico" });
  }

  const yaOcupado = citas.some(
    (c) =>
      c.medicoId === Number(medicoId) &&
      c.fecha === fecha &&
      c.hora === hora &&
      c.estado !== "cancelada"
  );
  if (yaOcupado) {
    return res.status(409).json({ error: "El horario ya fue reservado" });
  }

  const nueva = crearCita({ pacienteId, medicoId: Number(medicoId), fecha, hora });
  res.status(201).json(nueva);
});

// GET /api/citas  (citas del paciente autenticado)
router.get("/", requiereAuth, (req, res) => {
  const propias = citas.filter((c) => c.pacienteId === req.usuario.id);
  res.json(propias);
});

// PUT /api/citas/:id/cancelar
router.put("/:id/cancelar", requiereAuth, (req, res) => {
  const cita = citas.find((c) => c.id === Number(req.params.id));
  if (!cita) return res.status(404).json({ error: "Cita no encontrada" });
  if (cita.pacienteId !== req.usuario.id) {
    return res.status(403).json({ error: "No autorizado" });
  }
  cita.estado = "cancelada";
  res.json(cita);
});

export default router;
