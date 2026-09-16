import { useEffect, useState } from "react";
import NavBar from "../components/NavBar.jsx";
import { api } from "../api/client.js";

export default function HistorialCitas() {
  const [citas, setCitas] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

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
    try {
      await api.cancelarCita(id);
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <NavBar />
      <div className="panel">
        <h2>Historial de Citas</h2>
        <p className="subtitle">Consulta tus citas agendadas, confirmadas y canceladas.</p>

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
                <th>Medico</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {citas.map((c) => (
                <tr key={c.id}>
                  <td>{c.fecha}</td>
                  <td>{c.hora}</td>
                  <td>{c.medicoNombre}</td>
                  <td><span className={`badge ${c.estado}`}>{c.estado}</span></td>
                  <td>
                    {c.estado === "confirmada" && (
                      <button className="danger" onClick={() => cancelar(c.id)}>
                        Cancelar
                      </button>
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
