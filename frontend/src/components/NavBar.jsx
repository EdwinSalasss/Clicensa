import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { getUsuario, cerrarSesion } from "../api/session.js";

const TABS_POR_ROL = {
  PACIENTE: [
    { to: "/paciente/agendar", label: "Agendar Cita" },
    { to: "/paciente/historial", label: "Historial de Citas" },
  ],
  MEDICO: [{ to: "/medico", label: "Agenda y disponibilidad" }],
  PERSONAL_ADMINISTRATIVO: [
    { to: "/admin", label: "Panel del hospital" },
    { to: "/admin/medicos", label: "Médicos y horarios" },
  ],
  ADMIN_SISTEMA: [{ to: "/sistema", label: "Administrar hospitales" }],
  paciente: [
    { to: "/paciente/agendar", label: "Agendar Cita" },
    { to: "/paciente/historial", label: "Historial de Citas" },
  ],
  medico: [{ to: "/medico", label: "Agenda del Dia" }],
  administrativo: [
    { to: "/admin", label: "Panel Administrativo" },
    { to: "/admin/medicos", label: "Médicos y Horarios" },
  ],
};

export default function NavBar() {
  const usuario = getUsuario();
  const navigate = useNavigate();
  const location = useLocation();
  const tabs = usuario ? TABS_POR_ROL[usuario.rol] || [] : [];
  const [temaOscuro, setTemaOscuro] = useState(
    () => localStorage.getItem("clisensa_theme") === "dark"
  );
  const [notificaciones, setNotificaciones] = useState([]);
  const [mostrarNotificaciones, setMostrarNotificaciones] = useState(false);
  const [errorNotificaciones, setErrorNotificaciones] = useState("");
  const nombreRol = {
    PACIENTE: "Paciente",
    MEDICO: "Médico",
    PERSONAL_ADMINISTRATIVO: "Personal administrativo",
    ADMIN_SISTEMA: "Administrador del sistema",
    paciente: "Paciente",
    medico: "Médico",
    administrativo: "Administrativo",
  }[usuario?.rol] || usuario?.rol;

  function salir() {
    cerrarSesion();
    navigate("/");
  }

  async function cargarNotificaciones() {
    if (!usuario) return;
    try {
      setNotificaciones(await api.proximasCitas());
      setErrorNotificaciones("");
    } catch (err) {
      setErrorNotificaciones(err.message);
    }
  }

  useEffect(() => {
    document.documentElement.dataset.theme = temaOscuro ? "dark" : "light";
    localStorage.setItem("clisensa_theme", temaOscuro ? "dark" : "light");
  }, [temaOscuro]);

  useEffect(() => {
    let vigente = true;
    if (usuario) {
      api.proximasCitas().then((citas) => {
        if (vigente) {
          setNotificaciones(citas);
          setErrorNotificaciones("");
        }
      }).catch((err) => {
        if (vigente) setErrorNotificaciones(err.message);
      });
    }
    return () => { vigente = false; };
  }, [location.pathname]);

  const rutaCitas = usuario?.rol === "PACIENTE" || usuario?.rol === "paciente"
    ? "/paciente/historial"
    : usuario?.rol === "MEDICO" || usuario?.rol === "medico"
      ? "/medico"
      : usuario?.rol === "ADMIN_SISTEMA" ? "/sistema" : "/admin";

  return (
    <div className="navbar">
      <Link className="brand" to={usuario ? rutaCitas : "/"}>CLISENSA</Link>
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
        {usuario && (
          <div className="notification-wrap">
            <button
              className="icon-button notification-button"
              type="button"
              onClick={() => {
                setMostrarNotificaciones((visible) => !visible);
                cargarNotificaciones();
              }}
              aria-label={`Próximas citas: ${notificaciones.length}`}
              aria-expanded={mostrarNotificaciones}
            >
              <span aria-hidden="true">🔔</span>
              <span>Próximas citas</span>
              {notificaciones.length > 0 && <span className="notification-count">{notificaciones.length}</span>}
            </button>
            {mostrarNotificaciones && (
              <section className="notification-popover" aria-label="Notificaciones de citas">
                <div className="notification-heading">
                  <div><strong>Próximas citas</strong><span>{notificaciones.length} en agenda</span></div>
                  <button className="icon-button close-notifications" type="button" onClick={() => setMostrarNotificaciones(false)} aria-label="Cerrar notificaciones">×</button>
                </div>
                {errorNotificaciones ? (
                  <p className="error notification-error">{errorNotificaciones}</p>
                ) : notificaciones.length ? (
                  <ul className="notification-list">
                    {notificaciones.map((cita) => (
                      <li key={cita.id}>
                        <Link to={rutaCitas} onClick={() => setMostrarNotificaciones(false)}>
                          <strong>{cita.fecha} · {cita.hora}</strong>
                          <span>{usuario.rol === "PACIENTE" || usuario.rol === "paciente" ? cita.medicoNombre : cita.pacienteNombre}</span>
                          <small>{cita.servicioNombre} · {cita.hospitalNombre}</small>
                          <em className={`badge ${cita.estado.toLowerCase()}`}>{cita.estado}</em>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : <p className="muted notification-empty">No tienes citas próximas.</p>}
                <Link className="notification-footer" to={rutaCitas} onClick={() => setMostrarNotificaciones(false)}>Ver agenda completa</Link>
              </section>
            )}
          </div>
        )}
        <button
          className="icon-button theme-toggle"
          type="button"
          onClick={() => setTemaOscuro((actual) => !actual)}
          aria-label={temaOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          title={temaOscuro ? "Modo claro" : "Modo oscuro"}
        >
          <span aria-hidden="true">{temaOscuro ? "☀" : "◐"}</span>
          <span className="theme-toggle-label">{temaOscuro ? "Claro" : "Oscuro"}</span>
        </button>
        {usuario && (
          <Link className="user-link" to="/perfil">
            {usuario.fotoUrl && <img className="navbar-avatar" src={usuario.fotoUrl} alt="" />}
            {usuario.nombre} · {nombreRol}
          </Link>
        )}
        <button className="logout" onClick={salir}>Cerrar sesion</button>
      </div>
    </div>
  );
}
