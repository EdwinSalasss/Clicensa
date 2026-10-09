import { useEffect, useState } from "react";
import NavBar from "../components/NavBar.jsx";
import { api } from "../api/client.js";
import { leerImagenComoDataUrl } from "../api/image.js";
import { getUsuario } from "../api/session.js";

const NOMBRES_ROL = {
  ADMIN_SISTEMA: "Administrador del sistema",
  PERSONAL_ADMINISTRATIVO: "Personal administrativo",
  PACIENTE: "Paciente",
  MEDICO: "Médico",
  paciente: "Paciente",
  medico: "Médico",
  administrativo: "Administrativo",
};

export default function Perfil() {
  const [form, setForm] = useState({
    nombre: "",
    correo: "",
    cedula: "",
    fotoUrl: "",
    passwordActual: "",
    password: "",
  });
  const [usuario, setUsuario] = useState(getUsuario());
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vigente = true;
    api.miPerfil()
      .then((perfil) => {
        if (!vigente) return;
        setUsuario(perfil);
        setForm((actual) => ({
          ...actual,
          nombre: perfil.nombre || "",
          correo: perfil.correo || "",
          cedula: perfil.cedula || "",
          fotoUrl: perfil.fotoUrl || "",
        }));
        localStorage.setItem("clisensa_usuario", JSON.stringify(perfil));
      })
      .catch((err) => { if (vigente) setError(err.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, []);

  async function guardar(event) {
    event.preventDefault();
    setError("");
    setMensaje("");
    setGuardando(true);
    try {
      const resultado = await api.actualizarPerfil({
        nombre: form.nombre,
        correo: form.correo,
        ...(usuario?.rol === "PACIENTE" || usuario?.rol === "paciente"
          ? { cedula: form.cedula }
          : {}),
        fotoUrl: form.fotoUrl || null,
        ...(form.password ? {
          password: form.password,
          passwordActual: form.passwordActual,
        } : {}),
      });
      setUsuario(resultado.usuario);
      localStorage.setItem("clisensa_usuario", JSON.stringify(resultado.usuario));
      setForm((actual) => ({ ...actual, password: "", passwordActual: "" }));
      setMensaje("Tu perfil se actualizó correctamente.");
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function seleccionarFoto(event) {
    const archivo = event.target.files?.[0];
    if (!archivo) return;
    setError("");
    try {
      const fotoUrl = await leerImagenComoDataUrl(archivo);
      setForm((actual) => ({ ...actual, fotoUrl }));
      event.target.value = "";
    } catch (err) {
      setError(err.message);
      event.target.value = "";
    }
  }

  const esPaciente = usuario?.rol === "PACIENTE" || usuario?.rol === "paciente";

  return (
    <>
      <NavBar />
      <main className="panel">
        <header className="page-heading">
          <div>
            <span className="eyebrow">CUENTA PERSONAL</span>
            <h2>Mi perfil</h2>
            <p className="subtitle">Mantén actualizados tus datos y tu imagen de perfil.</p>
          </div>
        </header>
        {error && <p className="error" role="alert">{error}</p>}
        {mensaje && <p className="success" role="status">{mensaje}</p>}
        {cargando ? <p className="muted">Cargando tu perfil…</p> : usuario ? (
          <div className="profile-layout">
            <section className="card profile-overview">
              {form.fotoUrl ? (
                <img className="profile-avatar" src={form.fotoUrl} alt={`Foto de ${form.nombre}`} />
              ) : (
                <div className="profile-avatar avatar-placeholder" aria-hidden="true">
                  {form.nombre.trim().charAt(0).toUpperCase() || "U"}
                </div>
              )}
              <h3>{form.nombre || usuario.nombre}</h3>
              <p className="muted">{NOMBRES_ROL[usuario.rol] || usuario.rol}</p>
              <p className="muted">{usuario.correo}</p>
            </section>
            <section className="card profile-form-card">
              <form onSubmit={guardar}>
                <div className="form-row">
                  <div>
                    <label htmlFor="perfil-nombre">NOMBRE COMPLETO</label>
                    <input id="perfil-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required autoComplete="name" />
                  </div>
                  <div>
                    <label htmlFor="perfil-correo">CORREO ELECTRÓNICO</label>
                    <input id="perfil-correo" type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} required autoComplete="email" />
                  </div>
                </div>
                {esPaciente && (
                  <div>
                    <label htmlFor="perfil-cedula">CÉDULA</label>
                    <input id="perfil-cedula" value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} required autoComplete="off" />
                  </div>
                )}
                <label htmlFor="perfil-foto">IMAGEN DE PERFIL · URL</label>
                <input id="perfil-foto" type="url" value={form.fotoUrl.startsWith("data:") ? "" : form.fotoUrl} onChange={(e) => setForm({ ...form, fotoUrl: e.target.value })} placeholder="https://ejemplo.com/mi-foto.jpg" />
                <label htmlFor="perfil-archivo">O SELECCIONA UNA IMAGEN</label>
                <input id="perfil-archivo" type="file" accept="image/png,image/jpeg,image/webp" onChange={seleccionarFoto} />
                <p className="field-hint">Acepta PNG, JPEG o WebP de hasta 512 KB. Puedes dejar ambos campos vacíos para quitar la imagen.</p>
                {form.fotoUrl && <button className="ghost" type="button" onClick={() => setForm((actual) => ({ ...actual, fotoUrl: "" }))}>Quitar imagen</button>}
                <div className="form-row">
                  <div>
                    <label htmlFor="perfil-password-actual">CONTRASEÑA ACTUAL</label>
                    <input id="perfil-password-actual" type="password" value={form.passwordActual} onChange={(e) => setForm({ ...form, passwordActual: e.target.value })} autoComplete="current-password" />
                  </div>
                  <div>
                    <label htmlFor="perfil-password">NUEVA CONTRASEÑA</label>
                    <input id="perfil-password" type="password" minLength="8" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
                  </div>
                </div>
                <button className="button-primary" type="submit" disabled={guardando}>
                  {guardando ? "Guardando cambios…" : "Guardar cambios"}
                </button>
              </form>
            </section>
          </div>
        ) : <p className="error">No se pudo cargar la información del usuario.</p>}
      </main>
    </>
  );
}
