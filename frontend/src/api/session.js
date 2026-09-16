export function getUsuario() {
  try {
    return JSON.parse(localStorage.getItem("clisensa_usuario"));
  } catch {
    return null;
  }
}

export function estaAutenticado() {
  return Boolean(localStorage.getItem("clisensa_token"));
}

export function cerrarSesion() {
  localStorage.removeItem("clisensa_token");
  localStorage.removeItem("clisensa_usuario");
}

// A que panel debe ir cada rol despues de iniciar sesion
export function rutaSegunRol(rol) {
  if (rol === "paciente") return "/paciente/agendar";
  if (rol === "medico") return "/medico";
  if (rol === "administrativo") return "/admin";
  return "/";
}
