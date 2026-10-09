import { useNavigate } from "react-router-dom";
import { estaAutenticado, getUsuario, rutaSegunRol } from "../api/session.js";

export default function Home() {
  const navigate = useNavigate();

  function irAlSistema() {
    if (estaAutenticado()) {
      const usuario = getUsuario();
      navigate(rutaSegunRol(usuario?.rol));
    } else {
      navigate("/login");
    }
  }

  return (
    <div>
      <div className="hero">
        <h1>CLISENSA</h1>
        <p>
          Plataforma de citas médicas para una red de hospitales. Encuentra
          servicios, consulta horarios disponibles y gestiona tu atención en un
          solo lugar.
        </p>
        <button onClick={irAlSistema}>
          {estaAutenticado() ? "IR A MI PANEL" : "INICIAR SESION"}
        </button>
      </div>

      <div className="features">
        <div className="feature-card">
          <div className="icon">🗓️</div>
          <h3>Agenda en minutos</h3>
          <p>Elige especialidad, médico y horario disponible en tiempo real, sin traslapes.</p>
        </div>
        <div className="feature-card">
          <div className="icon">🔔</div>
          <h3>Próximas citas a la vista</h3>
          <p>Consulta tu agenda y recibe un correo cuando se registre una cita nueva.</p>
        </div>
        <div className="feature-card">
          <div className="icon">🩺</div>
          <h3>Agenda ordenada para el médico</h3>
          <p>Cada médico ve su agenda del día, sin depender de la agenda física.</p>
        </div>
      </div>

      <p className="footer-note">
        CLISENSA — Proyecto de la asignatura Diseño de Sistemas en Internet ·
        Grupo 5S3-SIS-S · Universidad Nacional de Ingeniería
      </p>
    </div>
  );
}
