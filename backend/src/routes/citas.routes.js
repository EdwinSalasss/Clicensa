import { Router } from "express";
import {
  citas,
  crearCita,
  horariosBase,
  nombrePaciente,
  nombreMedico,
} from "../data/seed.js";
import { requiereAuth, requiereRol } from "../middleware/auth.js";

const router = Router();

// ---------- PACIENTE ----------

// POST /api/citas   { medicoId, fecha, hora }
router.post("/", requiereAuth, requiereRol("paciente"), (req, res) => {
  const { medicoId, fecha, hora } = req.body || {};
  const pacienteId = req.usuario.id;

  if (!medicoId || !fecha || !hora) {
    return res.status(400).json({ error: "medicoId, fecha y hora son requeridos" });
  }

  const base = horariosBase[medicoId] || [];
  if (!base.includes(hora)) {
    return res.status(400).json({ error: "El horario solicitado no existe para ese medico" });
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
router.get("/", requiereAuth, requiereRol("paciente"), (req, res) => {
  const propias = citas
    .filter((c) => c.pacienteId === req.usuario.id)
    .map((c) => ({ ...c, medicoNombre: nombreMedico(c.medicoId) }));
  res.json(propias);
});

// PUT /api/citas/:id/cancelar  (paciente cancela su propia cita)
router.put("/:id/cancelar", requiereAuth, requiereRol("paciente"), (req, res) => {
  const cita = citas.find((c) => c.id === Number(req.params.id));
  if (!cita) return res.status(404).json({ error: "Cita no encontrada" });
  if (cita.pacienteId !== req.usuario.id) {
    return res.status(403).json({ error: "No autorizado" });
  }
  cita.estado = "cancelada";
  res.json(cita);
});

// ---------- MEDICO ----------

// GET /api/citas/medico?fecha=2026-09-16  (agenda del dia del medico autenticado)
router.get("/medico", requiereAuth, requiereRol("medico"), (req, res) => {
  const { fecha } = req.query;
  if (!fecha) return res.status(400).json({ error: "fecha es requerida" });
  if (!req.usuario.medicoId) {
    return res.status(400).json({ error: "Este usuario no tiene un medicoId asociado" });
  }

  const agenda = citas
    .filter((c) => c.medicoId === req.usuario.medicoId && c.fecha === fecha)
    .sort((a, b) => a.hora.localeCompare(b.hora))
    .map((c) => ({ ...c, pacienteNombre: nombrePaciente(c.pacienteId) }));

  res.json(agenda);
});

// ---------- ADMINISTRATIVO ----------

// GET /api/citas/todas?fecha=2026-09-16  (vista global para reportes/administracion)
router.get("/todas", requiereAuth, requiereRol("administrativo"), (req, res) => {
  const { fecha } = req.query;
  const filtradas = (fecha ? citas.filter((c) => c.fecha === fecha) : citas)
    .map((c) => ({
      ...c,
      pacienteNombre: nombrePaciente(c.pacienteId),
      medicoNombre: nombreMedico(c.medicoId),
    }))
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  res.json(filtradas);
});

export default router;
