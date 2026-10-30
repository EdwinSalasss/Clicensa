import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { requiereAuth, requiereRol } from "../middleware/auth.js";

const router = Router();

router.get("/servicios", async (req, res) => {
  try {
    const hospitalId = Number(req.query.hospitalId);
    if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
      return res.status(400).json({ error: "Selecciona un hospital válido." });
    }
    const servicios = await prisma.tipoServicio.findMany({
      where: { hospitalId },
      orderBy: { nombre: "asc" },
    });
    res.json(servicios);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar servicios" });
  }
});

router.post(
  "/servicios",
  requiereAuth,
  requiereRol("PERSONAL_ADMINISTRATIVO"),
  async (req, res) => {
    try {
      const { nombre, duracionMin, precio } = req.body || {};
      const parsedDuration = duracionMin;
      const parsedPrice = Number(precio);
      const precioValido =
        typeof precio === "number" &&
        Number.isFinite(parsedPrice) &&
        parsedPrice >= 0 &&
        parsedPrice <= 99_999_999.99 &&
        /^\d+(?:\.\d{1,2})?$/.test(String(precio));
      if (
        typeof nombre !== "string" ||
        !nombre.trim() ||
        nombre.trim().length > 100 ||
        typeof parsedDuration !== "number" ||
        !Number.isInteger(parsedDuration) ||
        parsedDuration < 5 ||
        parsedDuration % 5 !== 0 ||
        !precioValido
      ) {
        return res.status(400).json({ error: "Ingresa un nombre de hasta 100 caracteres, una duración en múltiplos de 5 minutos (mínimo 5) y un precio entre 0 y 99,999,999.99 con máximo 2 decimales." });
      }
      if (!req.usuario.hospitalId) {
        return res.status(403).json({ error: "La cuenta no está asociada a un hospital" });
      }

      const servicio = await prisma.tipoServicio.create({
        data: {
          hospitalId: req.usuario.hospitalId,
          nombre: nombre.trim(),
          duracionMin: parsedDuration,
          precio: parsedPrice,
        },
      });
      res.status(201).json(servicio);
    } catch (err) {
      if (err.code === "P2002") {
        return res.status(409).json({ error: "Ya existe un servicio con ese nombre en este hospital" });
      }
      console.error(err);
      res.status(500).json({ error: "Error al crear el servicio" });
    }
  }
);

export default router;
