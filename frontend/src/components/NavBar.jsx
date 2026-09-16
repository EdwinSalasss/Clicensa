import { NavLink, useNavigate } from "react-router-dom";
import { getUsuario, cerrarSesion } from "../api/session.js";

const TABS_POR_ROL = {
  paciente: [
    { to: "/paciente/agendar", label: "Agendar Cita" },
    { to: "/paciente/historial", label: "Historial de Citas" },
  ],
  medico: [{ to: "/medico", label: "Agenda del Dia" }],
  administrativo: [{ to: "/admin", label: "Panel Administrativo" }],
};

export default function NavBar() {
  const usuario = getUsuario();
  const navigate = useNavigate();
  const tabs = usuario ? TABS_POR_ROL[usuario.rol] || [] : [];

  function salir() {
    cerrarSesion();
    navigate("/");
  }

  return (
    <div className="navbar">
      <div className="brand">CLISENSA</div>
      <div className="tabs">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      <div className="userbox">
        <span>{usuario ? `${usuario.nombre} · ${usuario.rol}` : ""}</span>
        <button className="logout" onClick={salir}>Cerrar sesion</button>
      </div>
    </div>
  );
}
