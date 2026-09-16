import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import medicosRoutes from "./routes/medicos.routes.js";
import horariosRoutes from "./routes/horarios.routes.js";
import citasRoutes from "./routes/citas.routes.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", servicio: "CLISENSA API", version: "0.2.0" });
});

app.use("/api/auth", authRoutes);
app.use("/api/medicos", medicosRoutes);
app.use("/api/horarios", horariosRoutes);
app.use("/api/citas", citasRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

app.listen(PORT, () => {
  console.log(`CLISENSA API escuchando en http://localhost:${PORT}`);
  console.log(`Prueba de vida: http://localhost:${PORT}/api/health`);
});
