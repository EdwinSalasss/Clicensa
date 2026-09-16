import { useEffect, useState } from "react";
import NavBar from "../components/NavBar.jsx";
import { api } from "../api/client.js";
import { getUsuario } from "../api/session.js";

export default function MedicoPanel() {
  const usuario = getUsuario();
  const [fecha, setFecha] = useState("2026-09-16");
  const [agenda, setAgenda] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    api
      .agendaMedico(fecha)
      .then(setAgenda)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [fecha]);

  const confirmadas = agenda.filter((c) => c.estado === "confirmada").length;

  return (
    <div>
      <NavBar />
      <div className="panel">
        <h2>Agenda del Dia — {usuario?.nombre}</h2>
        <p className="subtitle">Consulta las citas agendadas contigo para la fecha seleccionada.</p>

        <label style={{ maxWidth: 220 }}>Fecha</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          style={{ maxWidth: 220 }}
        />

        <div className="card-grid">
          <div className="card">
            <h3>Citas del dia</h3>
            <div className="big">{agenda.length}</div>
          </div>
          <div className="card">
            <h3>Confirmadas</h3>
            <div className="big">{confirmadas}</div>
          </div>
        </div>

        {error && <p className="error">{error}</p>}
        {cargando ? (
          <p>Cargando...</p>
        ) : agenda.length === 0 ? (
          <p style={{ marginTop: 20 }}>No hay citas agendadas para esta fecha.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Paciente</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {agenda.map((c) => (
                <tr key={c.id}>
                  <td>{c.hora}</td>
                  <td>{c.pacienteNombre}</td>
                  <td><span className={`badge ${c.estado}`}>{c.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
