import { cerrarSesion } from "./session.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function getToken() {
  return localStorage.getItem("clisensa_token");
}

function fetchApi(url, options) {
  return fetch(url, options).catch((error) => {
    if (error.name === "AbortError") {
      throw new Error("La solicitud tardó demasiado. Inténtalo nuevamente.");
    }
    throw new Error("No se pudo conectar con CLISENSA. Verifica tu conexión e inténtalo nuevamente.");
  });
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetchApi(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  let data;
  try {
    data = await res.json();
  } catch {
    if (res.ok) throw new Error("El servidor devolvió una respuesta no válida. Inténtalo nuevamente.");
    data = {};
  }
  if (res.status === 401 && token && !path.startsWith("/auth/login")) {
    cerrarSesion();
    window.dispatchEvent(new Event("clisensa:session-expired"));
  }
  if (!res.ok) {
    const mensajesPorEstado = {
      400: "Revisa los datos ingresados e inténtalo nuevamente.",
      401: "Tu sesión venció. Inicia sesión nuevamente.",
      403: "No tienes permiso para realizar esta acción.",
      404: "No se encontró la información solicitada.",
      409: "La información ya existe o cambió. Revisa los datos e inténtalo nuevamente.",
      413: "La información enviada supera el tamaño permitido.",
      429: "Hay demasiadas solicitudes. Espera un momento e inténtalo nuevamente.",
      500: "Ocurrió un error en el servidor. Inténtalo nuevamente más tarde.",
      502: "El servidor no pudo completar la solicitud. Inténtalo nuevamente.",
      503: "El servicio no está disponible en este momento. Inténtalo más tarde.",
    };
    const errorDelServidor = typeof data.error === "string" ? data.error : "";
    throw new Error(errorDelServidor || mensajesPorEstado[res.status] || "No se pudo completar la solicitud. Inténtalo nuevamente.");
  }
  return data;
}

export const api = {
  login: (correo, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ correo, password }) }),
  registrar: (nombre, correo, password, cedula) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ nombre, correo, password, cedula }),
    }),
  miPerfil: () => request("/auth/perfil"),
  actualizarPerfil: (datos) =>
    request("/auth/perfil", { method: "PUT", body: JSON.stringify(datos) }),

  hospitales: () => request("/hospitales"),
  crearHospital: (datos) =>
    request("/admin/hospitales", { method: "POST", body: JSON.stringify(datos) }),
  crearPersonal: (datos) =>
    request("/admin/personal", { method: "POST", body: JSON.stringify(datos) }),
  servicios: (hospitalId) => request(`/hospital/servicios?hospitalId=${hospitalId}`),
  crearServicio: (datos) =>
    request("/hospital/servicios", { method: "POST", body: JSON.stringify(datos) }),
  invitarMedico: (datos) =>
    request("/medicos/invitar", { method: "POST", body: JSON.stringify(datos) }),
  medicosAdministracion: () => request("/medicos/administracion"),
  actualizarEstadoMedico: (medicoId, activo) =>
    request(`/medicos/${medicoId}/estado`, {
      method: "PATCH",
      body: JSON.stringify({ activo }),
    }),
  medicos: (especialidad, hospitalId, filtros = {}) => {
    const params = new URLSearchParams();
    if (especialidad) params.set("especialidad", especialidad);
    if (hospitalId) params.set("hospitalId", hospitalId);
    if (filtros.soloDisponibles) {
      params.set("soloDisponibles", "true");
      params.set("servicioId", filtros.servicioId);
      params.set("fecha", filtros.fecha);
    }
    if (filtros.soloActivos) params.set("soloActivos", "true");
    return request(`/medicos${params.size ? `?${params}` : ""}`);
  },

  horariosDisponibles: (medicoId, fecha, servicioId) => {
    const params = new URLSearchParams({ medicoId, fecha });
    if (servicioId) params.set("servicioId", servicioId);
    return request(`/horarios/disponibles?${params}`);
  },
  horariosCalendario: (medicoId, servicioId, desde, hasta) => {
    const params = new URLSearchParams({ medicoId, servicioId, desde, hasta });
    return request(`/horarios/calendario?${params}`);
  },
  miDisponibilidad: () => request("/horarios"),
  guardarDisponibilidad: (disponibilidad) =>
    request("/horarios", { method: "POST", body: JSON.stringify({ disponibilidad }) }),
  miPerfilMedico: () => request("/medicos/perfil"),
  actualizarPerfilMedico: (datos, token) =>
    request("/medicos/perfil", {
      method: "PUT",
      body: JSON.stringify(datos),
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    }),

  // Paciente
  crearCita: (datos, fecha, hora) => {
    const payload = typeof datos === "object" ? datos : { medicoId: datos, fecha, hora };
    return request("/citas", { method: "POST", body: JSON.stringify(payload) });
  },
  misCitas: () => request("/citas"),
  cancelarCita: (id) => request(`/citas/${id}/cancelar`, { method: "PUT" }),
  reprogramarCita: (id, fecha, hora) =>
    request(`/citas/${id}/reprogramar`, {
      method: "PUT",
      body: JSON.stringify({ fecha, hora }),
    }),
  resolverReprogramacion: (id, aprobar) =>
    request(`/citas/${id}/reprogramacion/decision`, {
      method: "PUT",
      body: JSON.stringify({ aprobar }),
    }),
  solicitudesReprogramacion: () => request("/citas/solicitudes-reprogramacion"),

  // Medico
  agendaMedico: (fecha) => request(`/citas/medico?fecha=${fecha}`),
  cambiarEstadoCita: (id, estado) =>
    request(`/citas/${id}/estado`, { method: "PUT", body: JSON.stringify({ estado }) }),
  proximasCitas: () => request("/citas/proximas"),
  reporteCitas: (desde, hasta) => {
    const params = new URLSearchParams({ desde, hasta });
    return request(`/reportes?${params}`);
  },

  // Administrativo
  citasTodas: (fecha) => request(`/citas/todas${fecha ? `?fecha=${fecha}` : ""}`),
  crearMedico: (nombre, especialidad) =>
    request("/medicos", {
      method: "POST",
      body: JSON.stringify({ nombre, especialidad }),
    }),
  agregarHorario: (medicoId, hora) =>
    request(`/medicos/${medicoId}/horarios`, {
      method: "POST",
      body: JSON.stringify({ hora }),
    }),
  quitarHorario: (medicoId, horarioId) =>
    request(`/medicos/${medicoId}/horarios/${horarioId}`, { method: "DELETE" }),
};
