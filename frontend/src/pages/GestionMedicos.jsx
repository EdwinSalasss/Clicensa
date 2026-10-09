import { useCallback, useEffect, useState } from "react";
import NavBar from "../components/NavBar.jsx";
import { api } from "../api/client.js";
import { getUsuario } from "../api/session.js";

const ESPECIALIDADES = [
  { valor: "Medicina General", etiqueta: "Medicina General" },
  { valor: "Pediatria", etiqueta: "Pediatría" },
  { valor: "Ginecologia", etiqueta: "Ginecología" },
];

export default function GestionMedicos() {
  const usuario = getUsuario();
  const hospitalId = usuario?.hospitalId;
  const [medicos, setMedicos] = useState([]);
  const [nombre, setNombre] = useState("");
  const [especialidad, setEspecialidad] = useState("Medicina General");
  const [horas, setHoras] = useState({});
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargarMedicos = useCallback(() => {
    setError("");
    setCargando(true);
    api
      .medicos(null, hospitalId)
      .then(setMedicos)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [hospitalId]);

  useEffect(() => {
    cargarMedicos();
  }, [cargarMedicos]);

  async function crearMedico(e) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      await api.crearMedico(nombre, especialidad);
      setNombre("");
      cargarMedicos();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function agregarHorario(e, medicoId) {
    e.preventDefault();
    const hora = horas[medicoId] || "";
    setError("");
    setGuardando(true);
    try {
      await api.agregarHorario(medicoId, hora);
      setHoras((actuales) => ({ ...actuales, [medicoId]: "" }));
      cargarMedicos();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function quitarHorario(medicoId, horarioId) {
    setError("");
    setGuardando(true);
    try {
      await api.quitarHorario(medicoId, horarioId);
      cargarMedicos();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <NavBar />
      <div className="panel">
        <h2>Gestión de Médicos y Horarios</h2>
        <p className="subtitle">Administra el personal médico y sus horarios disponibles.</p>

        <div className="card">
          <h3>Nuevo médico</h3>
          <form onSubmit={crearMedico}>
            <label htmlFor="medico-nombre">Nombre</label>
            <input
              id="medico-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
            <label htmlFor="medico-especialidad">Especialidad</label>
            <select
              id="medico-especialidad"
              value={especialidad}
              onChange={(e) => setEspecialidad(e.target.value)}
            >
              {ESPECIALIDADES.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>
              ))}
            </select>
            <button type="submit" disabled={guardando}>
              {guardando ? "Guardando..." : "Agregar médico"}
            </button>
          </form>
        </div>

        {error && <p className="error">{error}</p>}
        {cargando ? (
          <p>Cargando...</p>
        ) : medicos.length === 0 ? (
          <p>No hay médicos registrados.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Especialidad</th>
                <th>Horarios</th>
                <th>Agregar horario</th>
              </tr>
            </thead>
            <tbody>
              {medicos.map((medico) => (
                <tr key={medico.id}>
                  <td>{medico.nombre}</td>
                  <td>{medico.especialidad}</td>
                  <td>
                    <div className="horarios-lista">
                      {(medico.horarios || []).map((horario) => (
                        <span className="horario-chip" key={horario.id}>
                          {horario.hora}
                          <button
                            type="button"
                            aria-label={`Quitar horario ${horario.hora} de ${medico.nombre}`}
                            title="Quitar horario"
                            disabled={guardando}
                            onClick={() => quitarHorario(medico.id, horario.id)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <form
                      className="acciones-inline"
                      onSubmit={(e) => agregarHorario(e, medico.id)}
                    >
                      <input
                        type="text"
                        value={horas[medico.id] || ""}
                        onChange={(e) =>
                          setHoras((actuales) => ({
                            ...actuales,
                            [medico.id]: e.target.value,
                          }))
                        }
                        placeholder="HH:mm"
                        aria-label={`Nuevo horario para ${medico.nombre}`}
                        pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]"
                        required
                      />
                      <button type="submit" disabled={guardando}>
                        Agregar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
