const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function getToken() {
  return localStorage.getItem("clisensa_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error en la solicitud");
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
  medicos: (especialidad, hospitalId) => {
    const params = new URLSearchParams();
    if (especialidad) params.set("especialidad", especialidad);
    if (hospitalId) params.set("hospitalId", hospitalId);
    return request(`/medicos${params.size ? `?${params}` : ""}`);
  },

  horariosDisponibles: (medicoId, fecha, servicioId) => {
    const params = new URLSearchParams({ medicoId, fecha });
    if (servicioId) params.set("servicioId", servicioId);
    return request(`/horarios/disponibles?${params}`);
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

  // Medico
  agendaMedico: (fecha) => request(`/citas/medico?fecha=${fecha}`),
  cambiarEstadoCita: (id, estado) =>
    request(`/citas/${id}/estado`, { method: "PUT", body: JSON.stringify({ estado }) }),
  proximasCitas: () => request("/citas/proximas"),

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
