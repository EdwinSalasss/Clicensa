import { prisma } from "../db/prisma.js";

const ESTADOS_ACTIVOS = ["PENDIENTE", "CONFIRMADA"];

export async function marcarCitasVencidas(filtro = {}, cliente = prisma, ahora = new Date()) {
  const where = {
    ...filtro,
    fechaHora: { lt: ahora },
    estado: { in: ESTADOS_ACTIVOS },
  };
  const citas = await cliente.cita.findMany({
    where,
    select: {
      id: true,
      fechaHora: true,
      servicio: { select: { duracionMin: true } },
    },
  });
  const ahoraMs = ahora.getTime();
  const vencidas = citas
    .filter((cita) => cita.fechaHora.getTime() + (cita.servicio?.duracionMin || 30) * 60_000 <= ahoraMs)
    .map((cita) => cita.id);
  if (vencidas.length) {
    await cliente.cita.updateMany({
      where: {
        id: { in: vencidas },
        ...where,
      },
      data: { estado: "VENCIDA" },
    });
  }
}
