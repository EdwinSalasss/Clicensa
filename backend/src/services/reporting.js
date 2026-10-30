const ESTADOS = ["PENDIENTE", "CONFIRMADA", "CANCELADA", "ATENDIDA", "VENCIDA"];

export function crearResumenCitas(citas) {
  const porEstado = Object.fromEntries(ESTADOS.map((estado) => [estado, 0]));
  let ingresosAtendidosCentavos = 0;
  let ingresosPendientesCentavos = 0;

  const filas = citas.map((cita) => {
    const precio = Number(cita.servicio.precio);
    const precioCentavos = Math.round(precio * 100);
    if (porEstado[cita.estado] !== undefined) porEstado[cita.estado] += 1;
    if (cita.estado === "ATENDIDA") ingresosAtendidosCentavos += precioCentavos;
    if (["PENDIENTE", "CONFIRMADA"].includes(cita.estado)) {
      ingresosPendientesCentavos += precioCentavos;
    }
    return {
      id: cita.id,
      fecha: cita.fecha,
      hora: cita.hora,
      paciente: cita.paciente.nombre,
      medico: cita.medico.nombre,
      servicio: cita.servicio.nombre,
      estado: cita.estado,
      precio,
    };
  });

  return {
    resumen: {
      totalCitas: citas.length,
      porEstado,
      ingresosAtendidos: ingresosAtendidosCentavos / 100,
      ingresosPendientes: ingresosPendientesCentavos / 100,
      ingresosPotenciales: (ingresosAtendidosCentavos + ingresosPendientesCentavos) / 100,
    },
    citas: filas,
  };
}
