import { useEffect, useState } from "react";
import NavBar from "../components/NavBar.jsx";
import { api } from "../api/client.js";

export default function AgendarCita() {
  const [especialidad, setEspecialidad] = useState("Medicina General");
  const [medicos, setMedicos] = useState([]);
  const [medicoId, setMedicoId] = useState("");
  const [fecha, setFecha] = useState("2026-09-16");
  const [slots, setSlots] = useState([]);
  const [horaSeleccionada, setHoraSeleccionada] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.medicos(especialidad).then(setMedicos).catch(() => setMedicos([]));
  }, [especialidad]);

  useEffect(() => {
    setHoraSeleccionada("");
    if (medicoId && fecha) {
      api
        .horariosDisponibles(medicoId, fecha)
        .then((r) => setSlots(r.disponibles))
        .catch(() => setSlots([]));
    }
  }, [medicoId, fecha]);

  async function confirmar() {
    setError("");
    setMensaje("");
    try {
      const cita = await api.crearCita(medicoId, fecha, horaSeleccionada);
      setMensaje(`Cita confirmada para el ${cita.fecha} a las ${cita.hora}.`);
      setSlots((prev) => prev.filter((h) => h !== horaSeleccionada));
      setHoraSeleccionada("");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <NavBar />
      <div className="panel">
        <div className="container wide" style={{ margin: "32px auto" }}>
          <h2>Agendar Cita Medica</h2>

          <label>1. Especialidad</label>
          <select value={especialidad} onChange={(e) => setEspecialidad(e.target.value)}>
            <option>Medicina General</option>
            <option>Pediatria</option>
            <option>Ginecologia</option>
          </select>

          <label>2. Medico</label>
          <select value={medicoId} onChange={(e) => setMedicoId(e.target.value)}>
            <option value="">Seleccione...</option>
            {medicos.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>

          <label>3. Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />

          {medicoId && (
            <>
              <label>4. Horario disponible</label>
              <div className="slots">
                {slots.length === 0 && <span style={{ fontSize: 13 }}>Sin horarios disponibles</span>}
                {slots.map((h) => (
                  <div
                    key={h}
                    className={`slot ${horaSeleccionada === h ? "selected" : ""}`}
                    onClick={() => setHoraSeleccionada(h)}
                  >
                    {h}
                  </div>
                ))}
              </div>
            </>
          )}

          <button className="secondary block" disabled={!horaSeleccionada} onClick={confirmar}>
            CONFIRMAR CITA
          </button>

          {mensaje && <p className="success">{mensaje}</p>}
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
