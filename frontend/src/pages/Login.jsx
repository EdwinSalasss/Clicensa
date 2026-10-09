import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client.js";
import { rutaSegunRol } from "../api/session.js";

export default function Login() {
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
      const { token, usuario } = await api.login(correo, password);
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
      <Link to="/" style={{ fontSize: 13, color: "#2E75B6", textDecoration: "none" }}>
        ← Volver al inicio
      </Link>
      <h1>CLISENSA</h1>
      <p className="subtitle">Sistema de Gestion de Citas Medicas</p>
      <form onSubmit={onSubmit}>
        <label htmlFor="login-correo">Correo electronico</label>
        <input id="login-correo" value={correo} onChange={(e) => setCorreo(e.target.value)} type="email" autoComplete="username" required />
        <label htmlFor="login-password">Contrasena</label>
        <input id="login-password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required />
        <button type="submit" className="block" disabled={cargando}>
          {cargando ? "Ingresando..." : "INGRESAR"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}

      <p style={{ marginTop: 16, fontSize: 13 }}>
        <Link to="/registro">¿Es nuevo paciente? Crear cuenta</Link>
      </p>
    </div>
  );
}
