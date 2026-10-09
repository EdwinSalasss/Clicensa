import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function fechaHabilFutura(diasDesdeHoy) {
  const fecha = new Date();
  fecha.setUTCHours(0, 0, 0, 0);
  fecha.setUTCDate(fecha.getUTCDate() + diasDesdeHoy);
  while (fecha.getUTCDay() === 0 || fecha.getUTCDay() === 6) {
    fecha.setUTCDate(fecha.getUTCDate() + 1);
  }
  return fecha.toISOString().slice(0, 10);
}

async function main() {
  console.log("Sincronizando datos de demostración sin borrar citas...");
  const hospital = await prisma.hospital.findFirst({
    where: { nombre: "Centro Médico Nueva Esperanza" },
  }) || await prisma.hospital.create({
    data: {
      nombre: "Centro Médico Nueva Esperanza",
      direccion: "Managua, Nicaragua",
      telefono: "+505 0000 0000",
    },
  });

  const adminCorreo = (process.env.ADMIN_SISTEMA_EMAIL || "sistema@demo.com").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_SISTEMA_PASSWORD || "1234";
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.ADMIN_SISTEMA_EMAIL || !process.env.ADMIN_SISTEMA_PASSWORD ||
      adminPassword.length < 12)
  ) {
    throw new Error("En producción configura ADMIN_SISTEMA_EMAIL y una ADMIN_SISTEMA_PASSWORD de al menos 12 caracteres.");
  }
  if (adminPassword.length < 8 && adminPassword !== "1234") {
    throw new Error("ADMIN_SISTEMA_PASSWORD debe tener al menos 8 caracteres.");
  }
  await prisma.usuario.upsert({
    where: { correo: adminCorreo },
    create: {
      nombre: "Administrador del Sistema",
      correo: adminCorreo,
      password: await bcrypt.hash(adminPassword, 12),
      rol: "ADMIN_SISTEMA",
      activadoEn: new Date(),
    },
    update: {
      nombre: "Administrador del Sistema",
      rol: "ADMIN_SISTEMA",
      medicoId: null,
      hospitalId: null,
      activadoEn: new Date(),
    },
  });

  const passwordHash = await bcrypt.hash("1234", 10);
  const medicosDemo = [
    {
      nombre: "Dra. P. Ramos",
      especialidad: "Medicina General",
      licencia: "DEMO-MED-001",
      correo: "medico@demo.com",
      horarioBase: ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30"],
      servicio: "Consulta General",
    },
    {
      nombre: "Dr. J. Fuentes",
      especialidad: "Pediatria",
      licencia: "DEMO-MED-002",
      correo: "medico2@demo.com",
      horarioBase: ["09:00", "09:30", "10:00", "10:30"],
      servicio: "Pediatría",
    },
    {
      nombre: "Dra. L. Torres",
      especialidad: "Ginecologia",
      licencia: "DEMO-MED-003",
      correo: "medico3@demo.com",
      horarioBase: ["08:00", "08:30", "11:00", "11:30"],
      servicio: "Ginecología",
    },
  ];

  for (const item of medicosDemo) {
    let medico = await prisma.medico.findFirst({
      where: { nombre: item.nombre, especialidad: item.especialidad },
    });
    medico = medico
      ? await prisma.medico.update({
          where: { id: medico.id },
          data: { hospitalId: hospital.id },
        })
      : await prisma.medico.create({
          data: { nombre: item.nombre, especialidad: item.especialidad, hospitalId: hospital.id },
        });

    for (const hora of item.horarioBase) {
      await prisma.horarioBase.upsert({
        where: { medicoId_hora: { medicoId: medico.id, hora } },
        create: { medicoId: medico.id, hora },
        update: {},
      });
    }
    const disponibilidad = [1, 2, 3, 4, 5].map((diaSemana) => ({
      medicoId: medico.id,
      diaSemana,
      horaInicio: "08:00",
      horaFin: "12:00",
    }));
    if (!(await prisma.horarioDisponibilidad.count({ where: { medicoId: medico.id } }))) {
      await prisma.horarioDisponibilidad.createMany({ data: disponibilidad });
    }

    const usuario = await prisma.usuario.upsert({
      where: { correo: item.correo },
      create: {
        nombre: item.nombre,
        correo: item.correo,
        password: passwordHash,
        rol: "MEDICO",
        medicoId: medico.id,
        hospitalId: hospital.id,
        activadoEn: new Date(),
      },
      update: {
        nombre: item.nombre,
        password: passwordHash,
        rol: "MEDICO",
        medicoId: medico.id,
        hospitalId: hospital.id,
        activadoEn: new Date(),
      },
    });
    await prisma.perfilMedico.upsert({
      where: { usuarioId: usuario.id },
      create: {
        usuarioId: usuario.id,
        medicoId: medico.id,
        nombreCompleto: item.nombre,
        licenciaMedica: item.licencia,
        especialidad: item.especialidad,
      },
      update: {
        medicoId: medico.id,
        nombreCompleto: item.nombre,
        licenciaMedica: item.licencia,
        especialidad: item.especialidad,
      },
    });
    await prisma.tipoServicio.upsert({
      where: { hospitalId_nombre: { hospitalId: hospital.id, nombre: item.servicio } },
      create: { hospitalId: hospital.id, nombre: item.servicio, duracionMin: 30, precio: 0 },
      update: { duracionMin: 30 },
    });
  }

  await prisma.usuario.upsert({
    where: { correo: "paciente@demo.com" },
    create: {
      nombre: "Ana Paciente",
      correo: "paciente@demo.com",
      password: passwordHash,
      rol: "PACIENTE",
      cedula: "DEMO-PAC-001",
      activadoEn: new Date(),
    },
    update: {
      nombre: "Ana Paciente",
      password: passwordHash,
      rol: "PACIENTE",
      cedula: "DEMO-PAC-001",
    },
  });

  const pacientesDemo = [
    { nombre: "María López", correo: "maria.lopez@demo.com", cedula: "DEMO-PAC-002" },
    { nombre: "José Pérez", correo: "jose.perez@demo.com", cedula: "DEMO-PAC-003" },
    { nombre: "Lucía Gómez", correo: "lucia.gomez@demo.com", cedula: "DEMO-PAC-004" },
  ];
  for (const paciente of pacientesDemo) {
    await prisma.usuario.upsert({
      where: { correo: paciente.correo },
      create: {
        ...paciente,
        password: passwordHash,
        rol: "PACIENTE",
        activadoEn: new Date(),
      },
      update: {
        ...paciente,
        password: passwordHash,
        rol: "PACIENTE",
        activadoEn: new Date(),
      },
    });
  }

  const segundoHospital = await prisma.hospital.findFirst({
    where: { nombre: "Clínica Familiar Las Colinas" },
  }) || await prisma.hospital.create({
    data: {
      nombre: "Clínica Familiar Las Colinas",
      direccion: "Managua, Nicaragua",
      telefono: "+505 2222 2222",
    },
  });
  await prisma.usuario.upsert({
    where: { correo: "admin.colinas@demo.com" },
    create: {
      nombre: "Administración Las Colinas",
      correo: "admin.colinas@demo.com",
      password: passwordHash,
      rol: "PERSONAL_ADMINISTRATIVO",
      hospitalId: segundoHospital.id,
      activadoEn: new Date(),
    },
    update: {
      nombre: "Administración Las Colinas",
      password: passwordHash,
      rol: "PERSONAL_ADMINISTRATIVO",
      medicoId: null,
      hospitalId: segundoHospital.id,
      activadoEn: new Date(),
    },
  });

  let segundoMedico = await prisma.medico.findFirst({
    where: { nombre: "Dr. M. Herrera", especialidad: "Medicina Familiar" },
  });
  segundoMedico = segundoMedico
    ? await prisma.medico.update({
        where: { id: segundoMedico.id },
        data: { hospitalId: segundoHospital.id },
      })
    : await prisma.medico.create({
        data: {
          nombre: "Dr. M. Herrera",
          especialidad: "Medicina Familiar",
          hospitalId: segundoHospital.id,
        },
      });
  for (const hora of ["08:00", "08:30", "09:00", "09:30", "10:00"]) {
    await prisma.horarioBase.upsert({
      where: { medicoId_hora: { medicoId: segundoMedico.id, hora } },
      create: { medicoId: segundoMedico.id, hora },
      update: {},
    });
  }
  if (!(await prisma.horarioDisponibilidad.count({ where: { medicoId: segundoMedico.id } }))) {
    await prisma.horarioDisponibilidad.createMany({
      data: [1, 2, 3, 4, 5].map((diaSemana) => ({
        medicoId: segundoMedico.id,
        diaSemana,
        horaInicio: "08:00",
        horaFin: "12:00",
      })),
    });
  }
  const usuarioSegundoMedico = await prisma.usuario.upsert({
    where: { correo: "medico4@demo.com" },
    create: {
      nombre: segundoMedico.nombre,
      correo: "medico4@demo.com",
      password: passwordHash,
      rol: "MEDICO",
      medicoId: segundoMedico.id,
      hospitalId: segundoHospital.id,
      activadoEn: new Date(),
    },
    update: {
      nombre: segundoMedico.nombre,
      password: passwordHash,
      rol: "MEDICO",
      medicoId: segundoMedico.id,
      hospitalId: segundoHospital.id,
      activadoEn: new Date(),
    },
  });
  await prisma.perfilMedico.upsert({
    where: { usuarioId: usuarioSegundoMedico.id },
    create: {
      usuarioId: usuarioSegundoMedico.id,
      medicoId: segundoMedico.id,
      nombreCompleto: segundoMedico.nombre,
      licenciaMedica: "DEMO-MED-004",
      especialidad: segundoMedico.especialidad,
    },
    update: {
      medicoId: segundoMedico.id,
      nombreCompleto: segundoMedico.nombre,
      licenciaMedica: "DEMO-MED-004",
      especialidad: segundoMedico.especialidad,
    },
  });
  const servicioSegundoHospital = await prisma.tipoServicio.upsert({
    where: {
      hospitalId_nombre: {
        hospitalId: segundoHospital.id,
        nombre: "Consulta Familiar",
      },
    },
    create: {
      hospitalId: segundoHospital.id,
      nombre: "Consulta Familiar",
      duracionMin: 30,
      precio: 0,
    },
    update: { duracionMin: 30 },
  });

  const citasDemo = [
    {
      pacienteCorreo: "maria.lopez@demo.com",
      medicoId: (await prisma.medico.findFirst({
        where: { nombre: "Dra. P. Ramos", especialidad: "Medicina General" },
      })).id,
      hospitalId: hospital.id,
      servicioId: (await prisma.tipoServicio.findFirst({
        where: { hospitalId: hospital.id, nombre: "Consulta General" },
      })).id,
      fecha: fechaHabilFutura(2),
      hora: "09:00",
    },
    {
      pacienteCorreo: "jose.perez@demo.com",
      medicoId: segundoMedico.id,
      hospitalId: segundoHospital.id,
      servicioId: servicioSegundoHospital.id,
      fecha: fechaHabilFutura(3),
      hora: "10:00",
    },
  ];
  for (const cita of citasDemo) {
    const paciente = await prisma.usuario.findUnique({
      where: { correo: cita.pacienteCorreo },
    });
    const citaExistente = await prisma.cita.findFirst({
      where: {
        pacienteId: paciente.id,
        medicoId: cita.medicoId,
      },
    });
    if (citaExistente) continue;
    const horarioOcupado = await prisma.cita.findFirst({
      where: {
        medicoId: cita.medicoId,
        fecha: cita.fecha,
        hora: cita.hora,
        estado: { in: ["PENDIENTE", "CONFIRMADA"] },
      },
    });
    if (horarioOcupado) continue;
    await prisma.cita.create({
      data: {
        pacienteId: paciente.id,
        medicoId: cita.medicoId,
        hospitalId: cita.hospitalId,
        servicioId: cita.servicioId,
        fecha: cita.fecha,
        hora: cita.hora,
        fechaHora: new Date(`${cita.fecha}T${cita.hora}:00.000Z`),
        estado: "PENDIENTE",
      },
    });
  }

  await prisma.usuario.upsert({
    where: { correo: "admin@demo.com" },
    create: {
      nombre: "Admin Recepcion",
      correo: "admin@demo.com",
      password: passwordHash,
      rol: "PERSONAL_ADMINISTRATIVO",
      hospitalId: hospital.id,
      activadoEn: new Date(),
    },
    update: {
      nombre: "Admin Recepcion",
      password: passwordHash,
      rol: "PERSONAL_ADMINISTRATIVO",
      medicoId: null,
      hospitalId: hospital.id,
      activadoEn: new Date(),
    },
  });

  console.log("Listo. Ninguna cita existente fue eliminada.");
  console.log(`Administrador del sistema configurado: ${adminCorreo}`);
  console.log("Cuentas de demostración cargadas. Consulta las credenciales locales en README.md.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
