function minutos(hora) {
  const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(hora || "");
  return match ? Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3)) : null;
}

function fechaHoraFutura(fecha, hora) {
  return new Date(`${fecha}T${hora}:00`).getTime() > Date.now();
}

function calcularHorarios({ medico, servicio, fecha, ocupaciones, horariosLegacy }) {
  const diaSemana = new Date(`${fecha}T00:00:00.000Z`).getUTCDay();
  const bloques = medico.disponibilidad.filter((item) => item.diaSemana === diaSemana);
  const candidatos = new Set();
  for (const bloque of bloques) {
    const inicio = minutos(bloque.horaInicio);
    const fin = minutos(bloque.horaFin);
    if (inicio === null || fin === null) continue;
    for (let slot = inicio; slot + servicio.duracionMin <= fin; slot += servicio.duracionMin) {
      candidatos.add(`${String(Math.floor(slot / 60)).padStart(2, "0")}:${String(slot % 60).padStart(2, "0")}`);
    }
  }
  if (!medico.disponibilidad.length) {
    for (const horario of horariosLegacy) candidatos.add(horario.hora);
  }

  return [...candidatos].sort().filter((hora) => {
    const inicio = minutos(hora);
    return fechaHoraFutura(fecha, hora) && !ocupaciones.some((ocupacion) =>
      inicio < ocupacion.fin && inicio + servicio.duracionMin > ocupacion.inicio
    );
  });
}

function indexarOcupaciones(citas, solicitudes) {
  return [
    ...citas.map((cita) => ({
      fecha: cita.fecha,
      hora: cita.hora,
      duracion: cita.servicio?.duracionMin || 30,
    })),
    ...solicitudes.map((solicitud) => ({
      fecha: solicitud.fechaReprogramacion,
      hora: solicitud.horaReprogramacion,
      duracion: solicitud.servicio?.duracionMin || 30,
    })),
  ].reduce((porFecha, { fecha, hora, duracion }) => {
    const inicio = minutos(hora);
    if (inicio !== null) {
      const delDia = porFecha.get(fecha) || [];
      delDia.push({ inicio, fin: inicio + duracion });
      porFecha.set(fecha, delDia);
    }
    return porFecha;
  }, new Map());
}

export async function obtenerHorariosDisponibles(prisma, medico, fecha, servicioId) {
  const servicio = await prisma.tipoServicio.findUnique({ where: { id: servicioId } });
  if (!servicio || servicio.hospitalId !== medico.hospitalId) return [];

  const horariosLegacy = medico.disponibilidad.length
    ? []
    : await prisma.horarioBase.findMany({
        where: { medicoId: medico.id },
        orderBy: { hora: "asc" },
      });
  const [citas, solicitudes] = await Promise.all([
    prisma.cita.findMany({
      where: {
        medicoId: medico.id,
        fecha,
        estado: { in: ["PENDIENTE", "CONFIRMADA"] },
      },
      select: { fecha: true, hora: true, servicio: { select: { duracionMin: true } } },
    }),
    prisma.cita.findMany({
      where: {
        medicoId: medico.id,
        fechaReprogramacion: fecha,
        estadoReprogramacion: "PENDIENTE",
      },
      select: {
        fechaReprogramacion: true,
        horaReprogramacion: true,
        servicio: { select: { duracionMin: true } },
      },
    }),
  ]);
  const ocupacionesPorFecha = indexarOcupaciones(citas, solicitudes);
  return calcularHorarios({
    medico,
    servicio,
    fecha,
    ocupaciones: ocupacionesPorFecha.get(fecha) || [],
    horariosLegacy,
  });
}

export async function obtenerCalendarioDisponibilidad(prisma, medico, servicio, desde, hasta) {
  const inicioUtc = new Date(`${desde}T00:00:00.000Z`);
  const finUtc = new Date(`${hasta}T00:00:00.000Z`);
  const [horariosLegacy, citas, solicitudes] = await Promise.all([
    medico.disponibilidad.length
      ? Promise.resolve([])
      : prisma.horarioBase.findMany({
          where: { medicoId: medico.id },
          orderBy: { hora: "asc" },
        }),
    prisma.cita.findMany({
      where: {
        medicoId: medico.id,
        fecha: { gte: desde, lte: hasta },
        estado: { in: ["PENDIENTE", "CONFIRMADA"] },
      },
      select: { fecha: true, hora: true, servicio: { select: { duracionMin: true } } },
    }),
    prisma.cita.findMany({
      where: {
        medicoId: medico.id,
        fechaReprogramacion: { gte: desde, lte: hasta },
        estadoReprogramacion: "PENDIENTE",
      },
      select: {
        fechaReprogramacion: true,
        horaReprogramacion: true,
        servicio: { select: { duracionMin: true } },
      },
    }),
  ]);
  const ocupacionesPorFecha = indexarOcupaciones(citas, solicitudes);
  const calendario = [];

  for (const fecha = new Date(inicioUtc); fecha <= finUtc; fecha.setUTCDate(fecha.getUTCDate() + 1)) {
    const fechaIso = fecha.toISOString().slice(0, 10);
    calendario.push({
      fecha: fechaIso,
      disponibles: calcularHorarios({
        medico,
        servicio,
        fecha: fechaIso,
        ocupaciones: ocupacionesPorFecha.get(fechaIso) || [],
        horariosLegacy,
      }),
    });
  }
  return calendario;
}
