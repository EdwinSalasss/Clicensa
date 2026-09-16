import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client.js";
import { rutaSegunRol } from "../api/session.js";

export default function Login() {
  const [correo, setCorreo] = useState("paciente@demo.com");
  const [password, setPassword] = useState("1234");
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
        <label>Correo electronico</label>
        <input value={correo} onChange={(e) => setCorreo(e.target.value)} type="email" required />
        <label>Contrasena</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        <button type="submit" className="block" disabled={cargando}>
          {cargando ? "Ingresando..." : "INGRESAR"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}

      <div style={{ marginTop: 20, fontSize: 12, color: "#5C6B73", lineHeight: 1.6 }}>
        <strong>Cuentas de prueba:</strong><br />
        Paciente: paciente@demo.com / 1234<br />
        Medico: medico@demo.com / 1234<br />
        Administrativo: admin@demo.com / 1234
      </div>
    </div>
  );
}
