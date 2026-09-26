// Carga en PostgreSQL los datos de demostración y conserva las citas existentes.
// Uso: npm run db:seed

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Sincronizando datos de demo sin borrar citas...");

  const asegurarMedico = async (nombre, especialidad) => {
    const existente = await prisma.medico.findFirst({ where: { nombre, especialidad } });
    return existente || prisma.medico.create({ data: { nombre, especialidad } });
  };

  const medicoRamos = await asegurarMedico("Dra. P. Ramos", "Medicina General");
  const medicoFuentes = await asegurarMedico("Dr. J. Fuentes", "Pediatria");
  const medicoTorres = await asegurarMedico("Dra. L. Torres", "Ginecologia");

  const horariosPorMedico = {
    [medicoRamos.id]: ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30"],
    [medicoFuentes.id]: ["09:00", "09:30", "10:00", "10:30"],
    [medicoTorres.id]: ["08:00", "08:30", "11:00", "11:30"],
  };

  for (const [medicoId, horas] of Object.entries(horariosPorMedico)) {
    for (const hora of horas) {
      await prisma.horarioBase.upsert({
        where: { medicoId_hora: { medicoId: Number(medicoId), hora } },
        create: { medicoId: Number(medicoId), hora },
        update: {},
      });
    }
  }

  const passwordHash = await bcrypt.hash("1234", 10);

  await prisma.usuario.upsert({
    where: { correo: "paciente@demo.com" },
    create: {
      nombre: "Ana Paciente",
      correo: "paciente@demo.com",
      password: passwordHash,
      rol: "paciente",
    },
    update: { nombre: "Ana Paciente", password: passwordHash, rol: "paciente", medicoId: null },
  });

  await prisma.usuario.upsert({
    where: { correo: "medico@demo.com" },
    create: {
      nombre: "Dra. P. Ramos",
      correo: "medico@demo.com",
      password: passwordHash,
      rol: "medico",
      medicoId: medicoRamos.id,
    },
    update: {
      nombre: "Dra. P. Ramos",
      password: passwordHash,
      rol: "medico",
      medicoId: medicoRamos.id,
    },
  });

  await prisma.usuario.upsert({
    where: { correo: "admin@demo.com" },
    create: {
      nombre: "Admin Recepcion",
      correo: "admin@demo.com",
      password: passwordHash,
      rol: "administrativo",
    },
    update: {
      nombre: "Admin Recepcion",
      password: passwordHash,
      rol: "administrativo",
      medicoId: null,
    },
  });

  console.log("Listo. Usuarios de prueba (password para todos: 1234):");
  console.log("  paciente@demo.com  (rol paciente)");
  console.log("  medico@demo.com    (rol medico)");
  console.log("  admin@demo.com     (rol administrativo)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
