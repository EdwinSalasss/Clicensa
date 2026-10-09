import { useEffect, useState } from "react";
import NavBar from "../components/NavBar.jsx";
import { api } from "../api/client.js";

export default function HistorialCitas() {
  const [citas, setCitas] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const [fechaEditada, setFechaEditada] = useState("");
  const [horaEditada, setHoraEditada] = useState("");
  const [guardando, setGuardando] = useState(false);

  function cargar() {
    setCargando(true);
    api
      .misCitas()
      .then(setCitas)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []);

  async function cancelar(id) {
    setError("");
    try {
      await api.cancelarCita(id);
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  function iniciarEdicion(cita) {
    setError("");
    setEditandoId(cita.id);
    setFechaEditada(cita.fecha);
    setHoraEditada(cita.hora);
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setFechaEditada("");
    setHoraEditada("");
  }

  async function guardarReprogramacion(id) {
    setError("");
    setGuardando(true);
    try {
      await api.reprogramarCita(id, fechaEditada, horaEditada);
      cancelarEdicion();
      cargar();
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
        <h2>Historial de Citas</h2>
        <p className="subtitle">Consulta tus citas pendientes, confirmadas, atendidas y canceladas.</p>

        {error && <p className="error">{error}</p>}
        {cargando ? (
          <p>Cargando...</p>
        ) : citas.length === 0 ? (
          <p>Todavia no tienes citas agendadas.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Hospital</th>
                <th>Servicio</th>
                <th>Medico</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {citas.map((c) => (
                <tr key={c.id}>
                  <td>
                    {editandoId === c.id ? (
                      <input
                        type="date"
                        value={fechaEditada}
                        onChange={(e) => setFechaEditada(e.target.value)}
                        aria-label="Nueva fecha"
                      />
                    ) : c.fecha}
                  </td>
                  <td>
                    {editandoId === c.id ? (
                      <input
                        type="text"
                        value={horaEditada}
                        onChange={(e) => setHoraEditada(e.target.value)}
                        placeholder="HH:mm"
                        aria-label="Nueva hora"
                      />
                    ) : c.hora}
                  </td>
                  <td>{c.hospitalNombre || "—"}</td>
                  <td>{c.servicioNombre || "Consulta"}</td>
                  <td>{c.medicoNombre}</td>
                  <td><span className={`badge ${c.estado.toLowerCase()}`}>{c.estado}</span></td>
                  <td>
                    {editandoId === c.id ? (
                      <div className="acciones-inline">
                        <button
                          className="secondary"
                          onClick={() => guardarReprogramacion(c.id)}
                          disabled={guardando || !fechaEditada || !horaEditada}
                        >
                          {guardando ? "Guardando..." : "Guardar"}
                        </button>
                        <button className="ghost" onClick={cancelarEdicion} disabled={guardando}>
                          Cancelar edición
                        </button>
                      </div>
                    ) : ["PENDIENTE", "CONFIRMADA", "pendiente", "confirmada"].includes(c.estado) && (
                      <div className="acciones-inline">
                        <button className="ghost" onClick={() => iniciarEdicion(c)}>
                          Reprogramar
                        </button>
                        <button className="danger" onClick={() => cancelar(c.id)}>
                          Cancelar
                        </button>
                      </div>
                    )}
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
