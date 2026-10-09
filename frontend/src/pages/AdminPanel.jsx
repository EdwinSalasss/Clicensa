import { useEffect, useState } from "react";
import NavBar from "../components/NavBar.jsx";
import { api } from "../api/client.js";
import { getUsuario } from "../api/session.js";

const servicioVacio = { nombre: "", duracionMin: 30, precio: "" };
const medicoVacio = { licenciaMedica: "", correo: "", especialidad: "" };
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

export default function AdminPanel() {
  const usuario = getUsuario();
  const [fecha, setFecha] = useState(today);
  const [servicios, setServicios] = useState([]);
  const [medicos, setMedicos] = useState([]);
  const [citas, setCitas] = useState([]);
  const [nuevoServicio, setNuevoServicio] = useState(servicioVacio);
  const [nuevoMedico, setNuevoMedico] = useState(medicoVacio);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    if (!usuario?.hospitalId) {
      setError("La cuenta administrativa no está asociada a un hospital. Vuelve a iniciar sesión.");
      setCargando(false);
      return;
    }
    setCargando(true);
    setError("");
    try {
      const [listaServicios, listaMedicos, listaCitas] = await Promise.all([
        api.servicios(usuario.hospitalId),
        api.medicos(null, usuario.hospitalId),
        api.citasTodas(fecha),
      ]);
      setServicios(listaServicios);
      setMedicos(listaMedicos);
      setCitas(listaCitas);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, [fecha, usuario?.hospitalId]);

  async function crearServicio(event) {
    event.preventDefault();
    setError("");
    setMensaje("");
    try {
      const servicio = await api.crearServicio({
        ...nuevoServicio,
        duracionMin: Number(nuevoServicio.duracionMin),
        precio: Number(nuevoServicio.precio),
      });
      setNuevoServicio(servicioVacio);
      setMensaje(`Servicio ${servicio.nombre} agregado al catálogo.`);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function invitarMedico(event) {
    event.preventDefault();
    setError("");
    setMensaje("");
    try {
      const resultado = await api.invitarMedico(nuevoMedico);
      setNuevoMedico(medicoVacio);
      setMensaje(`Invitación enviada a ${resultado.medico.correo}.`);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function cambiarEstado(id, estado) {
    setError("");
    try {
      await api.cambiarEstadoCita(id, estado);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <NavBar />
      <main className="panel">
        <h2>Panel administrativo del hospital</h2>
        <p className="subtitle">Gestiona los servicios, médicos y citas de tu centro de salud.</p>
        {mensaje && <p className="success" role="status">{mensaje}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="management-grid">
          <section className="card">
            <h3>Catálogo de servicios</h3>
            <form onSubmit={crearServicio}>
              <label htmlFor="servicio-nombre">NOMBRE DEL SERVICIO</label>
              <input id="servicio-nombre" value={nuevoServicio.nombre} onChange={(e) => setNuevoServicio({ ...nuevoServicio, nombre: e.target.value })} required />
              <label htmlFor="servicio-duracion">DURACIÓN (MINUTOS)</label>
              <input id="servicio-duracion" type="number" min="5" step="5" value={nuevoServicio.duracionMin} onChange={(e) => setNuevoServicio({ ...nuevoServicio, duracionMin: e.target.value })} required />
              <label htmlFor="servicio-precio">PRECIO</label>
              <input id="servicio-precio" type="number" min="0" step="0.01" value={nuevoServicio.precio} onChange={(e) => setNuevoServicio({ ...nuevoServicio, precio: e.target.value })} required />
              <button className="secondary block" type="submit">Agregar servicio</button>
            </form>
            {servicios.length ? (
              <ul className="catalog-list">
                {servicios.map((servicio) => (
                  <li key={servicio.id}><span>{servicio.nombre} · {servicio.duracionMin} min</span><strong>{Number(servicio.precio).toFixed(2)}</strong></li>
                ))}
              </ul>
            ) : <p className="muted">Todavía no hay servicios.</p>}
          </section>
          <section className="card">
            <h3>Gestión de médicos</h3>
            <form onSubmit={invitarMedico}>
              <label htmlFor="medico-licencia">CÉDULA / LICENCIA MÉDICA</label>
              <input id="medico-licencia" value={nuevoMedico.licenciaMedica} onChange={(e) => setNuevoMedico({ ...nuevoMedico, licenciaMedica: e.target.value })} required />
              <label htmlFor="medico-correo">CORREO</label>
              <input id="medico-correo" type="email" value={nuevoMedico.correo} onChange={(e) => setNuevoMedico({ ...nuevoMedico, correo: e.target.value })} required />
              <label htmlFor="medico-especialidad">ESPECIALIDAD</label>
              <input id="medico-especialidad" value={nuevoMedico.especialidad} onChange={(e) => setNuevoMedico({ ...nuevoMedico, especialidad: e.target.value })} required />
              <button className="block" type="submit">+ NUEVO MÉDICO · ENVIAR INVITACIÓN</button>
            </form>
            {medicos.length ? (
              <ul className="catalog-list">
                {medicos.map((medico) => <li key={medico.id}><span>{medico.nombre}</span><strong>{medico.especialidad}</strong></li>)}
              </ul>
            ) : <p className="muted">Aún no hay médicos para este hospital.</p>}
          </section>
        </div>
        <section className="card appointments">
          <div className="section-heading">
            <div><h3>Agenda del hospital</h3><p className="muted">Consulta y administra las citas de tu sede.</p></div>
            <label className="date-field" htmlFor="fecha-citas">FECHA
              <input id="fecha-citas" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </label>
          </div>
          {cargando ? <p>Cargando...</p> : citas.length === 0 ? <p>No hay citas registradas para esta fecha.</p> : (
            <div className="table-scroll">
              <table>
                <thead><tr><th>Hora</th><th>Paciente</th><th>Médico</th><th>Servicio</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {citas.map((cita) => (
                    <tr key={cita.id}>
                      <td>{cita.hora}</td><td>{cita.pacienteNombre}</td><td>{cita.medicoNombre}</td>
                      <td>{cita.servicioNombre}</td>
                      <td><span className={`badge ${cita.estado.toLowerCase()}`}>{cita.estado}</span></td>
                      <td className="table-actions">
                        {cita.estado === "PENDIENTE" && <button className="small-button secondary" onClick={() => cambiarEstado(cita.id, "CONFIRMADA")}>Confirmar</button>}
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
