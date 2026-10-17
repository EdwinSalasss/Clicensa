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

export default function AgendarCita() {
  const [hospitales, setHospitales] = useState([]);
  const [hospitalId, setHospitalId] = useState("");
  const [servicios, setServicios] = useState([]);
  const [servicioId, setServicioId] = useState("");
  const [medicos, setMedicos] = useState([]);
  const [medicoId, setMedicoId] = useState("");
  const [fecha, setFecha] = useState("");
  const [mesCalendario, setMesCalendario] = useState(() => hoyLocal().slice(0, 7));
  const [disponibilidadMes, setDisponibilidadMes] = useState({});
  const [cargandoCalendario, setCargandoCalendario] = useState(false);
  const [hora, setHora] = useState("");
  const [paso, setPaso] = useState(1);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    api.hospitales().then(setHospitales).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    let vigente = true;
    setServicios([]);
    setServicioId("");
    setMedicos([]);
    setMedicoId("");
    setFecha("");
    setHora("");
    if (hospitalId) {
      api.servicios(hospitalId).then((items) => {
        if (vigente) setServicios(items);
      }).catch((err) => {
        if (vigente) setError(err.message);
      });
    }
    return () => { vigente = false; };
  }, [hospitalId]);

  useEffect(() => {
    let vigente = true;
    setMedicos([]);
    setMedicoId("");
    setFecha("");
    setHora("");
    setDisponibilidadMes({});
    if (!hospitalId || !servicioId) {
      return () => { vigente = false; };
    }
    api.medicos(null, hospitalId, { soloActivos: true }).then((items) => {
      if (vigente) setMedicos(items);
    }).catch((err) => {
      if (vigente) setError(err.message);
    });
    return () => { vigente = false; };
  }, [hospitalId, servicioId]);

  useEffect(() => {
    let vigente = true;
    if (!medicoId || !servicioId) {
      setDisponibilidadMes({});
      setCargandoCalendario(false);
      return () => { vigente = false; };
    }
    setCargandoCalendario(true);
    setDisponibilidadMes({});
    const { desde, hasta } = rangoDelMes(mesCalendario);
    api.horariosCalendario(medicoId, servicioId, desde, hasta)
      .then((resultado) => {
        if (vigente) {
          setDisponibilidadMes(Object.fromEntries(
            resultado.dias.map((dia) => [dia.fecha, dia.disponibles])
          ));
          setError("");
        }
      })
      .catch((err) => {
        if (vigente) setError(err.message);
      })
      .finally(() => {
        if (vigente) setCargandoCalendario(false);
      });
    return () => { vigente = false; };
  }, [medicoId, servicioId, mesCalendario]);

  const slots = fecha ? disponibilidadMes[fecha] || [] : [];
  const hospitalSeleccionado = hospitales.find((item) => String(item.id) === hospitalId);
  const servicioSeleccionado = servicios.find((item) => String(item.id) === servicioId);
  const medicoSeleccionado = medicos.find((item) => String(item.id) === medicoId);

  async function confirmar() {
    setError("");
    setMensaje("");
    setCargando(true);
    try {
      const cita = await api.crearCita({
        hospitalId: Number(hospitalId),
        servicioId: Number(servicioId),
        medicoId: Number(medicoId),
        fecha,
        hora,
      });
      const aviso = cita.notificacion?.enviada
        ? " Se envió el aviso por correo."
        : " La cita quedó registrada, pero la notificación por correo no está disponible.";
      setMensaje(`Cita solicitada para el ${cita.fecha} a las ${cita.hora}.${aviso}`);
      setPaso(1);
      setHora("");
      setFecha("");
      setMedicoId("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  function cambiarMes(mes) {
    setMesCalendario(mes);
    setFecha("");
    setHora("");
  }

  function seleccionarMedico(id) {
    setMedicoId(id);
    setFecha("");
    setHora("");
  }


  return (
    <>
      <NavBar />
      <main className="panel booking-panel">
        <h2>Agendar cita médica</h2>
        <p className="subtitle">Selecciona un hospital, servicio y horario disponible.</p>
        <div className="step-indicator" aria-label={`Paso ${paso} de 3`}>
          {[1, 2, 3].map((numero) => <span key={numero} className={paso >= numero ? "current" : ""}>Paso {numero}</span>)}
        </div>
        {mensaje && <p className="success" role="status">{mensaje}</p>}
        {error && <p className="error" role="alert">{error}</p>}

        {paso === 1 && (
          <section className="card">
            <h3>Elige tu centro médico</h3>
            <div className="hospital-picker" role="radiogroup" aria-label="Seleccionar hospital">
              {hospitales.map((hospital) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={hospitalId === String(hospital.id)}
                  key={hospital.id}
                  className={`hospital-choice ${hospitalId === String(hospital.id) ? "selected" : ""}`}
                  onClick={() => setHospitalId(String(hospital.id))}
                >
                  {hospital.logoUrl
                    ? <img className="hospital-logo" src={hospital.logoUrl} alt="" />
                    : <span className="hospital-logo logo-placeholder" aria-hidden="true">{hospital.nombre.charAt(0)}</span>}
                  <span className="hospital-choice-copy">
                    <strong>{hospital.nombre}</strong>
                    <small>{hospital.direccion}</small>
                  </span>
                  <span className="choice-check" aria-hidden="true">{hospitalId === String(hospital.id) ? "✓" : ""}</span>
                </button>
              ))}
              {!hospitales.length && <p className="muted">No hay hospitales disponibles en este momento.</p>}
            </div>
            <label htmlFor="servicio">TIPO DE SERVICIO</label>
            <select id="servicio" value={servicioId} onChange={(e) => setServicioId(e.target.value)} disabled={!hospitalId} required>
              <option value="">Seleccione un servicio</option>
              {servicios.map((servicio) => <option value={servicio.id} key={servicio.id}>{servicio.nombre} · {servicio.duracionMin} min · {Number(servicio.precio).toFixed(2)}</option>)}
            </select>
            {hospitalId && servicios.length === 0 && <p className="muted">Este hospital aún no ha publicado servicios.</p>}
            <button className="block" disabled={!hospitalId || !servicioId} onClick={() => { setError(""); setPaso(2); }}>CONTINUAR</button>
          </section>
        )}

        {paso === 2 && (
          <section className="card">
            <h3>Elige médico y horario</h3>
            <label htmlFor="medico">MÉDICO</label>
            <select id="medico" value={medicoId} onChange={(e) => seleccionarMedico(e.target.value)} required>
              <option value="">Seleccione un médico</option>
              {medicos.map((medico) => <option value={medico.id} key={medico.id}>{medico.nombre} · {medico.especialidad}</option>)}
            </select>
            {hospitalId && servicioId && medicos.length === 0 && (
              <p className="muted">Este hospital no tiene médicos activos para atender en este momento.</p>
            )}
            {medicoId && (
              <>
                <AvailabilityCalendar
                  mes={mesCalendario}
                  fechaSeleccionada={fecha}
                  minimo={hoyLocal()}
                  disponibilidad={disponibilidadMes}
                  cargando={cargandoCalendario}
                  onCambiarMes={cambiarMes}
                  onSeleccionarFecha={(seleccionada) => { setFecha(seleccionada); setHora(""); }}
                />
                {fecha && (
                  <section className="time-picker" aria-label="Seleccionar horario disponible">
                    <div className="time-picker-heading">
                      <span className="time-picker-step">2</span>
                      <div>
                        <h4>Ahora elige una hora</h4>
                        <p>Horarios disponibles para el {fecha}</p>
                      </div>
                    </div>
                    <div className="slots">
                      {slots.map((slot) => (
                        <button
                          type="button"
                          key={slot}
                          className={`slot time-slot ${hora === slot ? "selected" : ""}`}
                          aria-pressed={hora === slot}
                          onClick={() => setHora(slot)}
                        >
                          <span aria-hidden="true">◷</span>{slot}
                        </button>
                      ))}
                      {!slots.length && <p className="muted">Este día ya no tiene horarios libres. Elige otra fecha disponible.</p>}
                    </div>
                    {hora && <p className="selected-time" role="status">Hora seleccionada: <strong>{hora}</strong></p>}
                  </section>
                )}
              </>
            )}
            <div className="button-row">
              <button className="ghost" onClick={() => setPaso(1)}>ATRÁS</button>
              <button disabled={!medicoId || !fecha || !slots.includes(hora)} onClick={() => { setError(""); setPaso(3); }}>REVISAR CITA</button>
            </div>
          </section>
        )}

        {paso === 3 && (
          <section className="card">
            <h3>Confirma los datos</h3>
            <dl className="appointment-summary">
              <div><dt>Hospital</dt><dd>{hospitalSeleccionado?.nombre}</dd></div>
              <div><dt>Servicio</dt><dd>{servicioSeleccionado?.nombre}</dd></div>
              <div><dt>Médico</dt><dd>{medicoSeleccionado?.nombre} · {medicoSeleccionado?.especialidad}</dd></div>
              <div><dt>Fecha y hora</dt><dd>{fecha} · {hora}</dd></div>
              <div><dt>Precio</dt><dd>{servicioSeleccionado && Number(servicioSeleccionado.precio).toFixed(2)}</dd></div>
            </dl>
            <div className="button-row">
              <button className="ghost" disabled={cargando} onClick={() => setPaso(2)}>ATRÁS</button>
              <button className="secondary" disabled={cargando} onClick={confirmar}>{cargando ? "GUARDANDO..." : "CONFIRMAR CITA"}</button>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
