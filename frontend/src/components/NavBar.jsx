import { NavLink, useNavigate } from "react-router-dom";
import { getUsuario, cerrarSesion } from "../api/session.js";

const TABS_POR_ROL = {
  PACIENTE: [
    { to: "/paciente/agendar", label: "Agendar Cita" },
    { to: "/paciente/historial", label: "Historial de Citas" },
  ],
  MEDICO: [{ to: "/medico", label: "Agenda y disponibilidad" }],
  PERSONAL_ADMINISTRATIVO: [{ to: "/admin", label: "Panel del hospital" }],
  ADMIN_SISTEMA: [{ to: "/sistema", label: "Administrar hospitales" }],
  paciente: [
    { to: "/paciente/agendar", label: "Agendar Cita" },
    { to: "/paciente/historial", label: "Historial de Citas" },
  ],
  medico: [{ to: "/medico", label: "Agenda y disponibilidad" }],
  administrativo: [{ to: "/admin", label: "Panel del hospital" }],
};

export default function NavBar() {
  const usuario = getUsuario();
  const navigate = useNavigate();
  const tabs = usuario ? TABS_POR_ROL[usuario.rol] || [] : [];
  const roleName = {
    PACIENTE: "Paciente",
    MEDICO: "Médico",
    PERSONAL_ADMINISTRATIVO: "Personal administrativo",
    ADMIN_SISTEMA: "Administrador del sistema",
    paciente: "Paciente",
    medico: "Médico",
    administrativo: "Personal administrativo",
  }[usuario?.rol] || "";

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
        <span>{usuario ? `${usuario.nombre} · ${roleName}` : ""}</span>
        <button className="logout" onClick={salir}>Cerrar sesion</button>
      </div>
    </div>
  );
}
