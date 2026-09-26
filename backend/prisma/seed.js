// Puebla PostgreSQL con los mismos datos de demo que tenia data/seed.js
// Uso: npm run db:seed

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Sembrando datos de demo...");

  // Limpia en orden por las relaciones (citas -> horarios -> usuarios/medicos)
  await prisma.cita.deleteMany();
  await prisma.horarioBase.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.medico.deleteMany();

  const medicoRamos = await prisma.medico.create({
    data: { nombre: "Dra. P. Ramos", especialidad: "Medicina General" },
  });
  const medicoFuentes = await prisma.medico.create({
    data: { nombre: "Dr. J. Fuentes", especialidad: "Pediatria" },
  });
  const medicoTorres = await prisma.medico.create({
    data: { nombre: "Dra. L. Torres", especialidad: "Ginecologia" },
  });

  const horariosPorMedico = {
    [medicoRamos.id]: ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30"],
    [medicoFuentes.id]: ["09:00", "09:30", "10:00", "10:30"],
    [medicoTorres.id]: ["08:00", "08:30", "11:00", "11:30"],
  };

  for (const [medicoId, horas] of Object.entries(horariosPorMedico)) {
    await prisma.horarioBase.createMany({
      data: horas.map((hora) => ({ medicoId: Number(medicoId), hora })),
    });
  }

  const passwordHash = await bcrypt.hash("1234", 10);

  await prisma.usuario.create({
    data: {
      nombre: "Ana Paciente",
      correo: "paciente@demo.com",
      password: passwordHash,
      rol: "paciente",
    },
  });

  await prisma.usuario.create({
    data: {
      nombre: "Dra. P. Ramos",
      correo: "medico@demo.com",
      password: passwordHash,
      rol: "medico",
      medicoId: medicoRamos.id,
    },
  });

  await prisma.usuario.create({
    data: {
      nombre: "Admin Recepcion",
      correo: "admin@demo.com",
      password: passwordHash,
      rol: "administrativo",
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
