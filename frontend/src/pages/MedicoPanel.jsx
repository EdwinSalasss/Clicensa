import { useEffect, useState } from "react";
import NavBar from "../components/NavBar.jsx";
import { api } from "../api/client.js";
import { getUsuario } from "../api/session.js";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const hoy = () => {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
};

export default function MedicoPanel() {
  const usuario = getUsuario();
  const [fecha, setFecha] = useState(hoy);
  const [agenda, setAgenda] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [disponibilidad, setDisponibilidad] = useState([]);
  const [bloque, setBloque] = useState({ diaSemana: "1", horaInicio: "08:00", horaFin: "12:00" });
  const [slots, setSlots] = useState([]);
  const [servicioId, setServicioId] = useState("");
  const [hora, setHora] = useState("");
  const [paciente, setPaciente] = useState("");
  const [tipoIdentificador, setTipoIdentificador] = useState("correo");
  const [biografia, setBiografia] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [passwordActual, setPasswordActual] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);

  async function cargarAgenda() {
    setCargando(true);
    try {
      setAgenda(await api.agendaMedico(fecha));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargarAgenda(); }, [fecha]);

  useEffect(() => {
    let vigente = true;
    async function cargarDatos() {
      try {
        const [actual, perfil, listaServicios] = await Promise.all([
          api.miDisponibilidad(),
          api.miPerfilMedico(),
          usuario?.hospitalId ? api.servicios(usuario.hospitalId) : Promise.resolve([]),
        ]);
        if (vigente) {
          setDisponibilidad(actual.disponibilidad);
          setBiografia(perfil.biografia || "");
          setFotoUrl(perfil.fotoUrl || "");
          setServicios(listaServicios);
        }
      } catch (err) {
        if (vigente) setError(err.message);
      }
    }
    cargarDatos();
    return () => { vigente = false; };
  }, [usuario?.hospitalId]);

  useEffect(() => {
    let vigente = true;
    setHora("");
    setSlots([]);
    if (usuario?.medicoId && servicioId && fecha) {
      api.horariosDisponibles(usuario.medicoId, fecha, servicioId)
        .then((resultado) => { if (vigente) setSlots(resultado.disponibles); })
        .catch((err) => { if (vigente) setError(err.message); });
    }
    return () => { vigente = false; };
  }, [usuario?.medicoId, servicioId, fecha]);

  function agregarBloque(event) {
    event.preventDefault();
    setError("");
    const nuevo = { diaSemana: Number(bloque.diaSemana), horaInicio: bloque.horaInicio, horaFin: bloque.horaFin };
    setDisponibilidad((prev) =>
      [...prev, nuevo].sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio))
    );
  }

  async function guardarDisponibilidad() {
    setError("");
    setMensaje("");
    try {
      const resultado = await api.guardarDisponibilidad(disponibilidad);
      setDisponibilidad(resultado.disponibilidad);
      setMensaje("Disponibilidad semanal actualizada.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function guardarPerfil(event) {
    event.preventDefault();
    setError("");
    setMensaje("");
    try {
      const resultado = await api.actualizarPerfilMedico({
        biografia,
        fotoUrl: fotoUrl || null,
        ...(password ? { password, passwordActual } : {}),
      });
      localStorage.setItem("clisensa_usuario", JSON.stringify({
        ...usuario,
        fotoUrl: resultado.perfil.fotoUrl,
      }));
      setPasswordActual("");
      setPassword("");
      setMensaje("Perfil actualizado.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function asignarCita(event) {
    event.preventDefault();
    setError("");
    setMensaje("");
    try {
      const cita = await api.crearCita({
        hospitalId: usuario.hospitalId,
        servicioId: Number(servicioId),
        medicoId: usuario.medicoId,
        fecha,
        hora,
        [tipoIdentificador]: paciente.trim(),
      });
      setMensaje(`Cita asignada para ${cita.fecha} a las ${cita.hora}.`);
      setPaciente("");
      setHora("");
      await cargarAgenda();
    } catch (err) {
      setError(err.message);
    }
  }

  async function cambiarEstado(id, estado) {
    setError("");
    try {
      await api.cambiarEstadoCita(id, estado);
      await cargarAgenda();
    } catch (err) {
      setError(err.message);
    }
  }

  const confirmadas = agenda.filter((cita) => cita.estado === "CONFIRMADA").length;

  return (
    <>
      <NavBar />
      <main className="panel">
        <h2>Agenda médica · {usuario?.nombre}</h2>
        <p className="subtitle">Administra tu perfil, disponibilidad semanal y citas del día.</p>
        {mensaje && <p className="success" role="status">{mensaje}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="card-grid">
          <div className="card"><h3>Citas del día</h3><div className="big">{agenda.length}</div></div>
          <div className="card"><h3>Confirmadas</h3><div className="big">{confirmadas}</div></div>
          <div className="card">
            <label htmlFor="fecha-medico">FECHA DE AGENDA</label>
            <input id="fecha-medico" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>
        <div className="management-grid">
          <section className="card">
            <h3>Mi perfil médico</h3>
            <form onSubmit={guardarPerfil}>
              <label htmlFor="biografia">BIOGRAFÍA</label>
              <textarea id="biografia" rows="4" value={biografia} onChange={(e) => setBiografia(e.target.value)} />
              <label htmlFor="foto-url">URL DE FOTO</label>
              <input id="foto-url" type="url" value={fotoUrl} onChange={(e) => setFotoUrl(e.target.value)} placeholder="https://" />
              <label htmlFor="password-actual-medico">CONTRASEÑA ACTUAL</label>
              <input id="password-actual-medico" type="password" value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} autoComplete="current-password" />
              <label htmlFor="password-medico">CAMBIAR CONTRASEÑA</label>
              <input id="password-medico" type="password" minLength="8" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              <button className="block" type="submit">Guardar perfil</button>
            </form>
          </section>
          <section className="card">
            <h3>Disponibilidad semanal</h3>
            <form onSubmit={agregarBloque}>
              <label htmlFor="dia-semana">DÍA</label>
              <select id="dia-semana" value={bloque.diaSemana} onChange={(e) => setBloque({ ...bloque, diaSemana: e.target.value })}>
                {DIAS.map((dia, index) => <option key={dia} value={index}>{dia}</option>)}
              </select>
              <div className="form-row">
                <div><label htmlFor="hora-inicio">DESDE</label><input id="hora-inicio" type="time" value={bloque.horaInicio} onChange={(e) => setBloque({ ...bloque, horaInicio: e.target.value })} required /></div>
                <div><label htmlFor="hora-fin">HASTA</label><input id="hora-fin" type="time" value={bloque.horaFin} onChange={(e) => setBloque({ ...bloque, horaFin: e.target.value })} required /></div>
              </div>
              <button className="ghost block" type="submit">Agregar bloque</button>
            </form>
            {disponibilidad.length ? (
              <ul className="catalog-list">
                {disponibilidad.map((item, index) => (
                  <li key={`${item.id || "nuevo"}-${index}`}>
                    <span>{DIAS[item.diaSemana]} · {item.horaInicio}–{item.horaFin}</span>
                    <button className="text-button" onClick={() => setDisponibilidad((prev) => prev.filter((_, i) => i !== index))}>Quitar</button>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">No has configurado bloques semanales.</p>}
            <button className="secondary block" onClick={guardarDisponibilidad}>Guardar disponibilidad</button>
          </section>
        </div>
        <section className="card direct-appointment">
          <h3>Asignar cita directa a un paciente</h3>
          <form className="direct-appointment-form" onSubmit={asignarCita}>
            <div>
              <label htmlFor="identificador-paciente">BUSCAR PACIENTE POR</label>
              <select id="identificador-paciente" value={tipoIdentificador} onChange={(e) => setTipoIdentificador(e.target.value)}>
                <option value="correo">Correo electrónico</option><option value="cedula">Cédula</option>
              </select>
              <input aria-label="Identificador del paciente" value={paciente} onChange={(e) => setPaciente(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="servicio-directo">SERVICIO</label>
              <select id="servicio-directo" value={servicioId} onChange={(e) => setServicioId(e.target.value)} required>
                <option value="">Seleccione servicio</option>
                {servicios.map((servicio) => <option key={servicio.id} value={servicio.id}>{servicio.nombre}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="hora-directa">HORARIO</label>
              <select id="hora-directa" value={hora} onChange={(e) => setHora(e.target.value)} required disabled={!servicioId}>
                <option value="">Seleccione hora</option>{slots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
              </select>
            </div>
            <button className="secondary" type="submit" disabled={!servicioId || !hora || !paciente.trim()}>Asignar cita</button>
          </form>
        </section>
        <section className="card appointments">
          <h3>Agenda del {fecha}</h3>
          {cargando ? <p>Cargando...</p> : agenda.length === 0 ? <p>No hay citas registradas para esta fecha.</p> : (
            <div className="table-scroll">
              <table>
                <thead><tr><th>Hora</th><th>Paciente</th><th>Contacto</th><th>Servicio</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {agenda.map((cita) => (
                    <tr key={cita.id}>
                      <td>{cita.hora}</td><td>{cita.pacienteNombre}</td><td>{cita.pacienteCorreo}</td>
                      <td>{cita.servicioNombre}</td>
                      <td><span className={`badge ${cita.estado.toLowerCase()}`}>{cita.estado}</span></td>
                      <td className="table-actions">
                        {cita.estado === "PENDIENTE" && <button className="small-button secondary" onClick={() => cambiarEstado(cita.id, "CONFIRMADA")}>Confirmar</button>}
                        {cita.estado === "CONFIRMADA" && <button className="small-button" onClick={() => cambiarEstado(cita.id, "ATENDIDA")}>Atendida</button>}
                        {["PENDIENTE", "CONFIRMADA"].includes(cita.estado) && <button className="small-button danger" onClick={() => cambiarEstado(cita.id, "CANCELADA")}>Cancelar</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
