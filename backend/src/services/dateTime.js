export function minutos(hora) {
  const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(hora || "");
  return match ? Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3)) : null;
}

export function fechaValida(fecha) {
  return typeof fecha === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
    !Number.isNaN(new Date(`${fecha}T00:00:00.000Z`).getTime()) &&
    new Date(`${fecha}T00:00:00.000Z`).toISOString().slice(0, 10) === fecha;
}

export function fechaHoraFutura(fecha, hora) {
  return new Date(`${fecha}T${hora}:00`).getTime() > Date.now();
}
