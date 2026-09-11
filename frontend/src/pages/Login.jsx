import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";

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
      navigate("/agendar");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="container">
      <h1>CLISENSA</h1>
      <p>Sistema de Gestion de Citas Medicas</p>
      <form onSubmit={onSubmit}>
        <label>Correo electronico</label>
        <input value={correo} onChange={(e) => setCorreo(e.target.value)} type="email" required />
        <label>Contrasena</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        <button type="submit" disabled={cargando}>
          {cargando ? "Ingresando..." : "INGRESAR"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      <p style={{ fontSize: 12, color: "#5C6B73", marginTop: 16 }}>
        Cuenta demo: paciente@demo.com / 1234
      </p>
    </div>
  );
}
