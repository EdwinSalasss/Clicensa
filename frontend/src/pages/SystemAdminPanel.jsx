import { useEffect, useState } from "react";
import NavBar from "../components/NavBar.jsx";
import { api } from "../api/client.js";

const hospitalVacio = { nombre: "", direccion: "", telefono: "" };
const personalVacio = { hospitalId: "", nombre: "", correo: "", password: "" };

export default function SystemAdminPanel() {
  const [hospital, setHospital] = useState(hospitalVacio);
  const [personal, setPersonal] = useState(personalVacio);
  const [hospitales, setHospitales] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  async function cargarHospitales() {
    try {
      setHospitales(await api.hospitales());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    cargarHospitales();
  }, []);

  async function crearHospital(event) {
    event.preventDefault();
    setError("");
    setMensaje("");
    try {
      const creado = await api.crearHospital(hospital);
      setHospital(hospitalVacio);
      setPersonal((prev) => ({ ...prev, hospitalId: String(creado.id) }));
      setMensaje(`Hospital ${creado.nombre} creado.`);
      await cargarHospitales();
    } catch (err) {
      setError(err.message);
    }
  }

  async function crearPersonal(event) {
    event.preventDefault();
    setError("");
    setMensaje("");
    try {
      const creado = await api.crearPersonal({ ...personal, hospitalId: Number(personal.hospitalId) });
      setPersonal(personalVacio);
      setMensaje(`Cuenta administrativa creada para ${creado.correo}.`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <NavBar />
      <main className="panel">
        <h2>Administración del sistema</h2>
        <p className="subtitle">Crea hospitales y asigna personal administrativo a cada sede.</p>

        <div className="management-grid">
          <section className="card">
            <h3>Registrar hospital</h3>
            <form onSubmit={crearHospital}>
              <label htmlFor="hospital-nombre">NOMBRE</label>
              <input id="hospital-nombre" value={hospital.nombre} onChange={(e) => setHospital({ ...hospital, nombre: e.target.value })} required />
              <label htmlFor="hospital-direccion">DIRECCIÓN</label>
              <input id="hospital-direccion" value={hospital.direccion} onChange={(e) => setHospital({ ...hospital, direccion: e.target.value })} required />
              <label htmlFor="hospital-telefono">TELÉFONO</label>
              <input id="hospital-telefono" value={hospital.telefono} onChange={(e) => setHospital({ ...hospital, telefono: e.target.value })} required />
              <button className="block" type="submit">Crear hospital</button>
            </form>
          </section>

          <section className="card">
            <h3>Asignar administrador hospitalario</h3>
            <form onSubmit={crearPersonal}>
              <label htmlFor="personal-hospital">HOSPITAL</label>
              <select id="personal-hospital" value={personal.hospitalId} onChange={(e) => setPersonal({ ...personal, hospitalId: e.target.value })} required>
                <option value="">Seleccione un hospital</option>
                {hospitales.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select>
              <label htmlFor="personal-nombre">NOMBRE COMPLETO</label>
              <input id="personal-nombre" value={personal.nombre} onChange={(e) => setPersonal({ ...personal, nombre: e.target.value })} required />
              <label htmlFor="personal-correo">CORREO</label>
              <input id="personal-correo" type="email" value={personal.correo} onChange={(e) => setPersonal({ ...personal, correo: e.target.value })} required />
              <label htmlFor="personal-password">CONTRASEÑA INICIAL</label>
              <input id="personal-password" type="password" minLength="8" value={personal.password} onChange={(e) => setPersonal({ ...personal, password: e.target.value })} required />
              <button className="secondary block" type="submit">Crear cuenta administrativa</button>
            </form>
          </section>
        </div>

        {mensaje && <p className="success" role="status">{mensaje}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <section className="card">
          <h3>Hospitales registrados ({hospitales.length})</h3>
          {hospitales.length ? (
            <div className="hospital-list">
              {hospitales.map((item) => (
                <article className="hospital-item" key={item.id}>
                  <strong>{item.nombre}</strong>
                  <span>{item.direccion}</span>
                  <span>{item.telefono}</span>
                </article>
              ))}
            </div>
          ) : <p>Aún no hay hospitales registrados.</p>}
        </section>
      </main>
    </>
  );
}
