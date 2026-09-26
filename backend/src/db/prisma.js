import { PrismaClient } from "@prisma/client";

// Un solo cliente Prisma reutilizado en toda la app (evita agotar
// las conexiones de PostgreSQL en desarrollo con --watch).
export const prisma = new PrismaClient();
