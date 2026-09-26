import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { rutaSegunRol } from "../api/session.js";

export default function Registro() {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const { token, usuario } = await api.registrar(nombre, correo, password);
      localStorage.setItem("clisensa_token", token);
      localStorage.setItem("clisensa_usuario", JSON.stringify(usuario));
      navigate(rutaSegunRol(usuario.rol));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="container">
      <Link to="/login" style={{ fontSize: 13, color: "#2E75B6", textDecoration: "none" }}>
        ← Volver al inicio de sesión
      </Link>
      <h1>Crear cuenta</h1>
      <p className="subtitle">Registro de nuevo paciente</p>
      <form onSubmit={onSubmit}>
        <label htmlFor="nombre">Nombre completo</label>
        <input
          id="nombre"
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoComplete="name"
          required
        />
        <label htmlFor="correo">Correo electrónico</label>
        <input
          id="correo"
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          autoComplete="email"
          required
        />
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <button type="submit" className="block" disabled={cargando}>
          {cargando ? "Creando cuenta..." : "CREAR CUENTA"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
