import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import swaggerUi from "swagger-ui-express";
import yaml from "js-yaml";
import { prisma } from "./db/prisma.js";

import authRoutes from "./routes/auth.routes.js";
import medicosRoutes from "./routes/medicos.routes.js";
import horariosRoutes from "./routes/horarios.routes.js";
import citasRoutes from "./routes/citas.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import hospitalRoutes from "./routes/hospital.routes.js";
import hospitalesRoutes from "./routes/hospitales.routes.js";

const app = express();
const PORT = process.env.PORT || 4000;
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === "*")
) {
  throw new Error("En producción configura CORS_ORIGIN con el origen exacto del frontend.");
}
const openapiPath = path.resolve(
  fileURLToPath(new URL("../openapi.yaml", import.meta.url))
);
const openapiSpec = yaml.load(
  fs.readFileSync(openapiPath, "utf8")
);

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", servicio: "CLISENSA API", version: "0.5.0", baseDatos: "conectada" });
  } catch (err) {
    console.error("Healthcheck: PostgreSQL no está disponible.", err);
    res.status(503).json({ status: "degradado", servicio: "CLISENSA API", baseDatos: "no disponible" });
  }
});

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.get("/api/openapi.json", (_req, res) => res.json(openapiSpec));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/hospital", hospitalRoutes);
app.use("/api/hospitales", hospitalesRoutes);
app.use("/api/medicos", medicosRoutes);
app.use("/api/horarios", horariosRoutes);
app.use("/api/citas", citasRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

app.use((err, _req, res, _next) => {
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "El cuerpo de la solicitud supera el límite de 1 MB" });
  }
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "El cuerpo JSON de la solicitud no es válido" });
  }
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(PORT, () => {
  console.log(`CLISENSA API escuchando en http://localhost:${PORT}`);
  console.log(`Prueba de vida: http://localhost:${PORT}/api/health`);
});
