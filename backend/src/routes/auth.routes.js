import { Router } from "express";
import { usuarios } from "../data/seed.js";
import { firmarToken } from "../middleware/auth.js";

const router = Router();

// POST /api/auth/login  { correo, password }
router.post("/login", (req, res) => {
  const { correo, password } = req.body || {};
  const usuario = usuarios.find(
    (u) => u.correo === correo && u.password === password
  );
  if (!usuario) {
    return res.status(401).json({ error: "Credenciales invalidas" });
  }
  const token = firmarToken(usuario);
  res.json({
    token,
    usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
  });
});

export default router;
