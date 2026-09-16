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

  medicos: (especialidad) =>
    request(`/medicos${especialidad ? `?especialidad=${encodeURIComponent(especialidad)}` : ""}`),

  horariosDisponibles: (medicoId, fecha) =>
    request(`/horarios/disponibles?medicoId=${medicoId}&fecha=${fecha}`),

  // Paciente
  crearCita: (medicoId, fecha, hora) =>
    request("/citas", { method: "POST", body: JSON.stringify({ medicoId, fecha, hora }) }),
  misCitas: () => request("/citas"),
  cancelarCita: (id) => request(`/citas/${id}/cancelar`, { method: "PUT" }),

  // Medico
  agendaMedico: (fecha) => request(`/citas/medico?fecha=${fecha}`),

  // Administrativo
  citasTodas: (fecha) => request(`/citas/todas${fecha ? `?fecha=${fecha}` : ""}`),
};
