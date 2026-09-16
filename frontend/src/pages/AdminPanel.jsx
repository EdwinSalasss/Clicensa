import { useEffect, useState } from "react";
import NavBar from "../components/NavBar.jsx";
import { api } from "../api/client.js";

export default function AdminPanel() {
  const [fecha, setFecha] = useState("2026-09-16");
  const [citas, setCitas] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    api
      .citasTodas(fecha)
      .then(setCitas)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [fecha]);

  const confirmadas = citas.filter((c) => c.estado === "confirmada").length;
  const canceladas = citas.filter((c) => c.estado === "cancelada").length;

  return (
    <div>
      <NavBar />
      <div className="panel">
        <h2>Panel Administrativo</h2>
        <p className="subtitle">Vista global de citas del Centro Medico Nueva Esperanza.</p>

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
            <div className="big">{citas.length}</div>
          </div>
          <div className="card">
            <h3>Confirmadas</h3>
            <div className="big">{confirmadas}</div>
          </div>
          <div className="card">
            <h3>Canceladas</h3>
            <div className="big">{canceladas}</div>
          </div>
        </div>

        {error && <p className="error">{error}</p>}
        {cargando ? (
          <p>Cargando...</p>
        ) : citas.length === 0 ? (
          <p style={{ marginTop: 20 }}>No hay citas registradas para esta fecha.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Paciente</th>
                <th>Medico</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {citas.map((c) => (
                <tr key={c.id}>
                  <td>{c.hora}</td>
                  <td>{c.pacienteNombre}</td>
                  <td>{c.medicoNombre}</td>
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
