import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { requiereAuth, requiereRol } from "../middleware/auth.js";
import { fechaValida } from "../services/dateTime.js";
import { crearResumenCitas } from "../services/reporting.js";

const router = Router();

router.get(
  "/",
  requiereAuth,
  requiereRol("PERSONAL_ADMINISTRATIVO", "MEDICO"),
  async (req, res) => {
    try {
      const { desde, hasta } = req.query;
      if (!fechaValida(desde) || !fechaValida(hasta)) {
        return res.status(400).json({ error: "Indica las fechas de inicio y fin con formato AAAA-MM-DD." });
      }
      const dias = (
        new Date(`${hasta}T00:00:00.000Z`) -
        new Date(`${desde}T00:00:00.000Z`)
      ) / 86_400_000;
      if (dias < 0 || dias > 365) {
        return res.status(400).json({ error: "El rango debe abarcar entre 1 y 366 días" });
      }

      let scope;
      if (req.usuario.rol === "PERSONAL_ADMINISTRATIVO") {
        if (!req.usuario.hospitalId) {
          return res.status(403).json({ error: "La cuenta administrativa no está asociada a un hospital" });
        }
        scope = { hospitalId: req.usuario.hospitalId };
      } else {
        if (!req.usuario.medicoId) {
          return res.status(403).json({ error: "La cuenta no tiene un médico asociado" });
        }
        scope = { medicoId: req.usuario.medicoId };
      }

      const citas = await prisma.cita.findMany({
        where: {
          ...scope,
          fecha: { gte: desde, lte: hasta },
        },
        select: {
          id: true,
          fecha: true,
          hora: true,
          estado: true,
          paciente: { select: { nombre: true } },
          medico: { select: { nombre: true } },
          servicio: { select: { nombre: true, precio: true } },
        },
        orderBy: [{ fecha: "asc" }, { hora: "asc" }],
      });

      res.json({
        desde,
        hasta,
        ...crearResumenCitas(citas),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al generar el reporte de citas" });
    }
  }
);

export default router;
