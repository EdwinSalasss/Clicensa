import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function cuenta({ nombre, correo, rol, passwordHash, hospitalId, medicoId }) {
  return prisma.usuario.upsert({
    where: { correo },
    update: { nombre, rol, hospitalId, medicoId, activadoEn: new Date() },
    create: {
      nombre,
      correo,
      rol,
      hospitalId,
      medicoId,
      password: passwordHash,
      activadoEn: new Date(),
    },
  });
}

async function main() {
  const demoPasswordHash = await bcrypt.hash("1234", 12);
  const hospital = await prisma.hospital.findFirst({ where: { nombre: "Centro Médico Nueva Esperanza" } })
    || await prisma.hospital.create({
      data: {
        nombre: "Centro Médico Nueva Esperanza",
        direccion: "Managua, Nicaragua",
        telefono: "+505 0000 0000",
      },
    });

  const adminCorreo = (process.env.ADMIN_SISTEMA_EMAIL || "sistema@demo.com").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_SISTEMA_PASSWORD || "1234";
  if (adminPassword.length < 8 && adminPassword !== "1234") {
    throw new Error("ADMIN_SISTEMA_PASSWORD debe tener al menos 8 caracteres.");
  }
  await prisma.usuario.upsert({
    where: { correo: adminCorreo },
    update: { nombre: "Administrador del Sistema", rol: "ADMIN_SISTEMA", hospitalId: null, medicoId: null },
    create: {
      nombre: "Administrador del Sistema",
      correo: adminCorreo,
      password: await bcrypt.hash(adminPassword, 12),
      rol: "ADMIN_SISTEMA",
      activadoEn: new Date(),
    },
  });

  const catalogoMedicos = [
    { nombre: "Dra. P. Ramos", especialidad: "Medicina General", licenciaMedica: "DEMO-MED-001", correo: "medico@demo.com" },
    { nombre: "Dr. J. Fuentes", especialidad: "Pediatria", licenciaMedica: "DEMO-MED-002" },
    { nombre: "Dra. L. Torres", especialidad: "Ginecologia", licenciaMedica: "DEMO-MED-003" },
  ];
  const medicos = [];

  for (const item of catalogoMedicos) {
    let medico = await prisma.medico.findFirst({
      where: { nombre: item.nombre, hospitalId: hospital.id },
    });
    if (medico) {
      medico = await prisma.medico.update({
        where: { id: medico.id },
        data: { especialidad: item.especialidad },
      });
    } else {
      medico = await prisma.medico.create({
        data: { nombre: item.nombre, especialidad: item.especialidad, hospitalId: hospital.id },
      });
    }
    medicos.push(medico);

    const correo = item.correo || `medico${medico.id}@demo.com`;
    const doctor = await cuenta({
      nombre: item.nombre,
      correo,
      rol: "MEDICO",
      passwordHash: demoPasswordHash,
      hospitalId: hospital.id,
      medicoId: medico.id,
    });
    await prisma.perfilMedico.upsert({
      where: { usuarioId: doctor.id },
      update: {
        medicoId: medico.id,
        nombreCompleto: item.nombre,
        licenciaMedica: item.licenciaMedica,
        especialidad: item.especialidad,
      },
      create: {
        usuarioId: doctor.id,
        medicoId: medico.id,
        nombreCompleto: item.nombre,
        licenciaMedica: item.licenciaMedica,
        especialidad: item.especialidad,
      },
    });

    const bloques = [1, 2, 3, 4, 5].map((diaSemana) => ({
      medicoId: medico.id,
      diaSemana,
      horaInicio: "08:00",
      horaFin: "12:00",
    }));
    if (!(await prisma.horarioDisponibilidad.count({ where: { medicoId: medico.id } }))) {
      await prisma.horarioDisponibilidad.createMany({ data: bloques });
    }
  }

  await cuenta({
    nombre: "Ana Paciente",
    correo: "paciente@demo.com",
    rol: "PACIENTE",
    passwordHash: demoPasswordHash,
    hospitalId: null,
    medicoId: null,
  });
  await cuenta({
    nombre: "Admin Recepcion",
    correo: "admin@demo.com",
    rol: "PERSONAL_ADMINISTRATIVO",
    passwordHash: demoPasswordHash,
    hospitalId: hospital.id,
    medicoId: null,
  });

  for (const { nombre, duracionMin, precio } of [
    { nombre: "Consulta General", duracionMin: 30, precio: 20 },
    { nombre: "Pediatría", duracionMin: 30, precio: 25 },
    { nombre: "Ginecología", duracionMin: 45, precio: 35 },
  ]) {
    await prisma.tipoServicio.upsert({
      where: { hospitalId_nombre: { hospitalId: hospital.id, nombre } },
      update: { duracionMin, precio },
      create: { hospitalId: hospital.id, nombre, duracionMin, precio },
    });
  }

  console.log("Datos iniciales listos. No se eliminaron registros existentes.");
  console.log(`Administrador del sistema: ${adminCorreo} / ${adminPassword}`);
  console.log("Cuentas de demostración: paciente@demo.com, medico@demo.com y admin@demo.com / 1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
