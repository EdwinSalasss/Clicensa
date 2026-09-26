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
  registrar: (nombre, correo, password) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ nombre, correo, password }),
    }),

  medicos: (especialidad) =>
    request(`/medicos${especialidad ? `?especialidad=${encodeURIComponent(especialidad)}` : ""}`),

  horariosDisponibles: (medicoId, fecha) =>
    request(`/horarios/disponibles?medicoId=${medicoId}&fecha=${fecha}`),

  // Paciente
  crearCita: (medicoId, fecha, hora) =>
    request("/citas", { method: "POST", body: JSON.stringify({ medicoId, fecha, hora }) }),
  misCitas: () => request("/citas"),
  cancelarCita: (id) => request(`/citas/${id}/cancelar`, { method: "PUT" }),
  reprogramarCita: (id, fecha, hora) =>
    request(`/citas/${id}/reprogramar`, {
      method: "PUT",
      body: JSON.stringify({ fecha, hora }),
    }),

  // Medico
  agendaMedico: (fecha) => request(`/citas/medico?fecha=${fecha}`),

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
