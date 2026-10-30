import { useEffect, useState } from "react";
import NavBar from "../components/NavBar.jsx";
import { api } from "../api/client.js";
import { leerImagenComoDataUrl } from "../api/image.js";

const hospitalVacio = { nombre: "", direccion: "", telefono: "", logoUrl: "" };
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

  useEffect(() => { cargarHospitales(); }, []);

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

  async function seleccionarLogo(event) {
    const archivo = event.target.files?.[0];
    if (!archivo) return;
    setError("");
    try {
      const logoUrl = await leerImagenComoDataUrl(archivo);
      setHospital((actual) => ({ ...actual, logoUrl }));
      event.target.value = "";
    } catch (err) {
      setError(err.message);
      event.target.value = "";
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
              <input id="hospital-nombre" value={hospital.nombre} onChange={(e) => setHospital({ ...hospital, nombre: e.target.value })} maxLength="120" pattern=".*\S.*" title="Ingresa un nombre que no esté vacío ni contenga solo espacios." required />
              <label htmlFor="hospital-direccion">DIRECCIÓN</label>
              <input id="hospital-direccion" value={hospital.direccion} onChange={(e) => setHospital({ ...hospital, direccion: e.target.value })} maxLength="240" pattern=".*\S.*" title="Ingresa una dirección que no esté vacía ni contenga solo espacios." required />
              <label htmlFor="hospital-telefono">TELÉFONO</label>
              <input id="hospital-telefono" type="tel" inputMode="tel" pattern="(?=(?:\D*\d){7,15}\D*$)\+?(?:\d|\x28)[\d\x20\x28\x29\x2d]*(?:\d|\x29)" title="Escribe entre 7 y 15 dígitos; puedes usar +, espacios, guiones o paréntesis." maxLength="25" value={hospital.telefono} onChange={(e) => setHospital({ ...hospital, telefono: e.target.value })} required />
              <p className="field-hint">Incluye entre 7 y 15 dígitos. Puedes agregar el código del país, espacios, guiones o paréntesis.</p>
              <label htmlFor="hospital-logo">LOGO DEL HOSPITAL · URL</label>
              <input id="hospital-logo" type="url" pattern="https?://.+" title="Usa una dirección que comience con http:// o https://." maxLength="2048" value={hospital.logoUrl.startsWith("data:") ? "" : hospital.logoUrl} onChange={(e) => setHospital({ ...hospital, logoUrl: e.target.value })} placeholder="https://ejemplo.com/logo.png" />
              <label htmlFor="hospital-logo-archivo">O SELECCIONA UN ARCHIVO DE LOGO</label>
              <input id="hospital-logo-archivo" type="file" accept="image/png,image/jpeg,image/webp" onChange={seleccionarLogo} />
              <p className="field-hint">Opcional. PNG, JPEG o WebP de hasta 512 KB, o un enlace directo.</p>
              {hospital.logoUrl && <img className="hospital-logo-preview" src={hospital.logoUrl} alt="Vista previa del logo" />}
              {hospital.logoUrl && <button className="ghost" type="button" onClick={() => setHospital((actual) => ({ ...actual, logoUrl: "" }))}>Quitar logo</button>}
              <button className="block" type="submit">Crear hospital</button>
            </form>
          </section>
          <section className="card">
            <h3>Asignar administrador hospitalario</h3>
            <form onSubmit={crearPersonal}>
              <label>SEDE DEL ADMINISTRADOR</label>
              <div className="hospital-picker compact-picker" role="radiogroup" aria-label="Seleccionar sede del administrador">
                {hospitales.map((item) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={personal.hospitalId === String(item.id)}
                    className={`hospital-choice ${personal.hospitalId === String(item.id) ? "selected" : ""}`}
                    key={item.id}
                    onClick={() => setPersonal({ ...personal, hospitalId: String(item.id) })}
                  >
                    {item.logoUrl
                      ? <img className="hospital-logo" src={item.logoUrl} alt="" />
                      : <span className="hospital-logo logo-placeholder" aria-hidden="true">{item.nombre.charAt(0)}</span>}
                    <span className="hospital-choice-copy"><strong>{item.nombre}</strong><small>{item.direccion}</small></span>
                    <span className="choice-check" aria-hidden="true">{personal.hospitalId === String(item.id) ? "✓" : ""}</span>
                  </button>
                ))}
              </div>
              {!hospitales.length && <p className="muted">Primero registra un hospital.</p>}
              <label htmlFor="personal-nombre">NOMBRE COMPLETO</label>
              <input id="personal-nombre" value={personal.nombre} onChange={(e) => setPersonal({ ...personal, nombre: e.target.value })} maxLength="120" pattern=".*\S.*" title="Ingresa un nombre que no esté vacío ni contenga solo espacios." required />
              <label htmlFor="personal-correo">CORREO</label>
              <input id="personal-correo" type="email" maxLength="254" value={personal.correo} onChange={(e) => setPersonal({ ...personal, correo: e.target.value })} required />
              <label htmlFor="personal-password">CONTRASEÑA INICIAL</label>
              <input id="personal-password" type="password" minLength="8" maxLength="72" autoComplete="new-password" value={personal.password} onChange={(e) => setPersonal({ ...personal, password: e.target.value })} title="Usa al menos 8 caracteres y evita superar 72 bytes." required />
              <button className="secondary block" type="submit" disabled={!personal.hospitalId}>Crear cuenta administrativa</button>
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
                  <div className="hospital-item-heading">
                    {item.logoUrl
                      ? <img className="hospital-logo" src={item.logoUrl} alt="" />
                      : <span className="hospital-logo logo-placeholder" aria-hidden="true">{item.nombre.charAt(0)}</span>}
                    <strong>{item.nombre}</strong>
                  </div>
                  <span>{item.direccion}</span><span>{item.telefono}</span>
                </article>
              ))}
            </div>
          ) : <p>Aún no hay hospitales registrados.</p>}
        </section>
      </main>
    </>
  );
}
