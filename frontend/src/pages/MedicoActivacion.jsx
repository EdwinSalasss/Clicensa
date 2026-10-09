import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";

export default function MedicoActivacion() {
  const [params] = useSearchParams();
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [biografia, setBiografia] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();
  const token = params.get("token");

  async function activar(event) {
    event.preventDefault();
    setError("");
    if (!token) {
      setError("El enlace de activación no contiene un token válido.");
      return;
    }
    setCargando(true);
    try {
      const resultado = await api.actualizarPerfilMedico(
        { nombreCompleto, biografia, fotoUrl: fotoUrl || null, password },
        token
      );
      localStorage.setItem("clisensa_token", resultado.token);
      localStorage.setItem("clisensa_usuario", JSON.stringify(resultado.usuario));
      navigate("/medico", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="container">
      <h1>Completa tu perfil médico</h1>
      <p className="subtitle">Define tu contraseña y activa el acceso a CLISENSA.</p>
      <form onSubmit={activar}>
        <label htmlFor="nombre-completo">NOMBRE COMPLETO</label>
        <input id="nombre-completo" value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} required />
        <label htmlFor="biografia-activacion">BIOGRAFÍA</label>
        <textarea id="biografia-activacion" rows="4" value={biografia} onChange={(e) => setBiografia(e.target.value)} />
        <label htmlFor="foto-activacion">URL DE FOTO</label>
        <input id="foto-activacion" type="url" value={fotoUrl} onChange={(e) => setFotoUrl(e.target.value)} placeholder="https://" />
        <label htmlFor="password-activacion">CONTRASEÑA (MÍNIMO 8 CARACTERES)</label>
        <input id="password-activacion" type="password" minLength="8" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="secondary block" type="submit" disabled={cargando}>{cargando ? "ACTIVANDO..." : "ACTIVAR CUENTA"}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
    </main>
  );
}
