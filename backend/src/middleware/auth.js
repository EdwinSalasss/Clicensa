import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "clisensa_dev_secret_change_me";

export function firmarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol,
      medicoId: usuario.medicoId || null,
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

export function requiereAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token invalido o expirado" });
  }
}

// Uso: requiereRol("medico"), requiereRol("administrativo", "medico"), etc.
export function requiereRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: "No tiene permisos para esta accion" });
    }
    next();
  };
}
