import NavBar from "../components/NavBar.jsx";
import { getUsuario } from "../api/session.js";

const NOMBRES_ROL = {
  paciente: "Paciente",
  medico: "Médico",
  administrativo: "Administrativo",
};

export default function Perfil() {
  const usuario = getUsuario();

  return (
    <div>
      <NavBar />
      <div className="panel">
        <h2>Mi perfil</h2>
        <p className="subtitle">Información de la cuenta autenticada.</p>
        {!usuario ? (
          <p className="error">No se pudo cargar la información del usuario.</p>
        ) : (
          <div className="card">
            <p><strong>Nombre:</strong> {usuario.nombre}</p>
            <p><strong>Correo:</strong> {usuario.correo || "No disponible"}</p>
            <p><strong>Rol:</strong> {NOMBRES_ROL[usuario.rol] || usuario.rol}</p>
          </div>
        )}
      </div>
    </div>
  );
}
