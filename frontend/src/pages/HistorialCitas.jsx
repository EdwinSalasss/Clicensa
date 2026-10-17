import { useEffect, useState } from "react";
import NavBar from "../components/NavBar.jsx";
import AvailabilityCalendar from "../components/AvailabilityCalendar.jsx";
import { api } from "../api/client.js";

function hoyLocal() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
}

function rangoDelMes(mes) {
  const [anio, numeroMes] = mes.split("-").map(Number);
  return {
    desde: `${mes}-01`,
    hasta: `${mes}-${String(new Date(Date.UTC(anio, numeroMes, 0)).getUTCDate()).padStart(2, "0")}`,
  };
}

export default function HistorialCitas() {
  const [citas, setCitas] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const [mesEdicion, setMesEdicion] = useState(() => hoyLocal().slice(0, 7));
  const [fechaEditada, setFechaEditada] = useState("");
  const [horaEditada, setHoraEditada] = useState("");
  const [disponibilidadEdicion, setDisponibilidadEdicion] = useState({});
  const [cargandoDisponibilidad, setCargandoDisponibilidad] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const citaEditando = citas.find((cita) => cita.id === editandoId);
  const horariosEditados = fechaEditada ? disponibilidadEdicion[fechaEditada] || [] : [];

  function cargar() {
    setCargando(true);
    api
      .misCitas()
      .then(setCitas)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []);

  useEffect(() => {
    if (!citaEditando) return undefined;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflowAnterior; };
  }, [editandoId]);

  useEffect(() => {
    let vigente = true;
    if (!citaEditando) {
      setDisponibilidadEdicion({});
      setCargandoDisponibilidad(false);
      return () => { vigente = false; };
    }
    setCargandoDisponibilidad(true);
    setDisponibilidadEdicion({});
    const { desde, hasta } = rangoDelMes(mesEdicion);
    api.horariosCalendario(citaEditando.medicoId, citaEditando.servicioId, desde, hasta)
      .then((resultado) => {
        if (vigente) {
          setDisponibilidadEdicion(Object.fromEntries(
            resultado.dias.map((dia) => [dia.fecha, dia.disponibles])
          ));
          setError("");
        }
      })
      .catch((err) => {
        if (vigente) setError(err.message);
      })
      .finally(() => {
        if (vigente) setCargandoDisponibilidad(false);
      });
    return () => { vigente = false; };
  }, [editandoId, mesEdicion, citaEditando?.medicoId, citaEditando?.servicioId]);

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
    setMesEdicion(hoyLocal().slice(0, 7));
    setFechaEditada("");
    setHoraEditada("");
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setFechaEditada("");
    setHoraEditada("");
    setDisponibilidadEdicion({});
  }

  function cambiarMesEdicion(mes) {
    setMesEdicion(mes);
    setFechaEditada("");
    setHoraEditada("");
  }

  async function guardarReprogramacion(id) {
    setError("");
    setGuardando(true);
    try {
      if (!fechaEditada || !horariosEditados.includes(horaEditada)) {
        throw new Error("Selecciona un día y una hora disponible.");
      }
      await api.reprogramarCita(id, fechaEditada, horaEditada);
      cancelarEdicion();
      setMensaje("Solicitud enviada al médico. La cita conservará su horario actual hasta que el médico la apruebe.");
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

        {mensaje && <p className="success" role="status">{mensaje}</p>}
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
                    {c.fecha}
                  </td>
                  <td>{c.hora}</td>
                  <td>{c.hospitalNombre || "—"}</td>
                  <td>{c.servicioNombre || "Consulta"}</td>
                  <td>{c.medicoNombre}</td>
                  <td>
                    <span className={`badge ${c.reprogramacionPendiente ? "pendiente" : c.estado.toLowerCase()}`}>
                      {c.reprogramacionPendiente ? "REPROGRAMACIÓN PENDIENTE" : c.estado}
                    </span>
                    {c.reprogramacionPendiente && (
                      <small className="table-secondary">
                        Solicitada para {c.fechaReprogramacion} · {c.horaReprogramacion}
                      </small>
                    )}
                    {c.estadoReprogramacion === "RECHAZADA" && (
                      <small className="table-secondary">El médico rechazó el último horario propuesto.</small>
                    )}
                  </td>
                  <td>
                    {["PENDIENTE", "CONFIRMADA", "pendiente", "confirmada"].includes(c.estado) && (
                      <div className="acciones-inline">
                        {!c.reprogramacionPendiente && <button className="ghost" onClick={() => iniciarEdicion(c)}>Cambiar fecha u hora</button>}
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
        {citaEditando && (
          <div
            className="reschedule-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !guardando) cancelarEdicion();
            }}
          >
            <section
              className="reschedule-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="reschedule-title"
            >
              <div className="reschedule-dialog-heading">
                <div>
                  <span className="eyebrow">CAMBIO DE CITA</span>
                  <h3 id="reschedule-title">Elige un nuevo horario</h3>
                  <p className="muted">
                    Médico: {citaEditando.medicoNombre} · Cita actual: {citaEditando.fecha} a las {citaEditando.hora}
                  </p>
                </div>
                <button
                  className="icon-button reschedule-close"
                  type="button"
                  onClick={cancelarEdicion}
                  disabled={guardando}
                  aria-label="Cerrar selección de horario"
                >
                  ×
                </button>
              </div>
              {error && <p className="error" role="alert">{error}</p>}
              <AvailabilityCalendar
                mes={mesEdicion}
                fechaSeleccionada={fechaEditada}
                minimo={hoyLocal()}
                disponibilidad={disponibilidadEdicion}
                cargando={cargandoDisponibilidad}
                onCambiarMes={cambiarMesEdicion}
                onSeleccionarFecha={(fecha) => {
                  setFechaEditada(fecha);
                  setHoraEditada("");
                }}
              />
              {fechaEditada && (
                <section className="time-picker" aria-label="Horarios disponibles para reprogramar">
                  <div className="time-picker-heading">
                    <span className="time-picker-step">2</span>
                    <div>
                      <h4>Elige la hora</h4>
                      <p>Solo se muestran horas realmente disponibles para el {fechaEditada}.</p>
                    </div>
                  </div>
                  <div className="slots">
                    {horariosEditados.map((slot) => (
                      <button
                        type="button"
                        key={slot}
                        className={`slot time-slot ${horaEditada === slot ? "selected" : ""}`}
                        aria-pressed={horaEditada === slot}
                        onClick={() => setHoraEditada(slot)}
                      >
                        <span aria-hidden="true">◷</span>{slot}
                      </button>
                    ))}
                    {!cargandoDisponibilidad && horariosEditados.length === 0 && (
                      <p className="muted">No hay horarios libres este día. Selecciona otro día resaltado.</p>
                    )}
                  </div>
                  {horaEditada && (
                    <p className="selected-time" role="status">
                      Nuevo horario: <strong>{fechaEditada} · {horaEditada}</strong>
                    </p>
                  )}
                </section>
              )}
              <div className="button-row reschedule-actions">
                <button className="ghost" type="button" onClick={cancelarEdicion} disabled={guardando}>Cancelar</button>
                <button
                  type="button"
                  onClick={() => guardarReprogramacion(citaEditando.id)}
                  disabled={guardando || !fechaEditada || !horariosEditados.includes(horaEditada)}
                >
                  {guardando ? "ENVIANDO SOLICITUD..." : "SOLICITAR CAMBIO"}
                </button>
              </div>
              <p className="field-hint">Tu horario actual no cambiará hasta que el médico apruebe esta solicitud.</p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
