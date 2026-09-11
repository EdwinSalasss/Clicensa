// Datos de ejemplo en memoria.
// NOTA: este es el "avance" funcional inicial. En la Fase 2 completa
// esto se reemplaza por PostgreSQL + un ORM (Prisma/Sequelize), tal
// como se definio en el diagrama de arquitectura (Figura 3, Fase 1).

export const usuarios = [
  { id: 1, nombre: "Ana Paciente", correo: "paciente@demo.com", password: "1234", rol: "paciente" },
  { id: 2, nombre: "Dra. P. Ramos", correo: "medico@demo.com", password: "1234", rol: "medico", medicoId: 1 },
  { id: 3, nombre: "Admin Recepcion", correo: "admin@demo.com", password: "1234", rol: "administrativo" },
];

export const medicos = [
  { id: 1, nombre: "Dra. P. Ramos", especialidad: "Medicina General" },
  { id: 2, nombre: "Dr. J. Fuentes", especialidad: "Pediatria" },
  { id: 3, nombre: "Dra. L. Torres", especialidad: "Ginecologia" },
];

// Horarios base por medico (hora de inicio en formato HH:mm)
export const horariosBase = {
  1: ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30"],
  2: ["09:00", "09:30", "10:00", "10:30"],
  3: ["08:00", "08:30", "11:00", "11:30"],
};

// Citas ya agendadas (se va llenando en memoria durante la ejecucion)
export const citas = [];
let nextCitaId = 1;

export function crearCita({ pacienteId, medicoId, fecha, hora }) {
  const nueva = {
    id: nextCitaId++,
    pacienteId,
    medicoId,
    fecha,
    hora,
    estado: "confirmada",
    creadaEn: new Date().toISOString(),
  };
  citas.push(nueva);
  return nueva;
}
