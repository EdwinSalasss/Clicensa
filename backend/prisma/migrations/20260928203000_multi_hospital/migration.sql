CREATE TABLE "hospitales" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hospitales_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "usuarios" ADD COLUMN "hospitalId" INTEGER;
ALTER TABLE "usuarios" ADD COLUMN "cedula" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "activadoEn" TIMESTAMP(3);
UPDATE "usuarios" SET "activadoEn" = CURRENT_TIMESTAMP;
ALTER TABLE "medicos" ADD COLUMN "hospitalId" INTEGER;
ALTER TABLE "citas" ADD COLUMN "hospitalId" INTEGER;
ALTER TABLE "citas" ADD COLUMN "servicioId" INTEGER;
ALTER TABLE "citas" ADD COLUMN "fechaHora" TIMESTAMP(3);

INSERT INTO "hospitales" ("nombre", "direccion", "telefono")
SELECT 'Centro Médico Nueva Esperanza', 'Managua, Nicaragua', '+505 0000 0000'
WHERE NOT EXISTS (
    SELECT 1 FROM "hospitales" WHERE "nombre" = 'Centro Médico Nueva Esperanza'
);

UPDATE "medicos"
SET "hospitalId" = (
    SELECT "id" FROM "hospitales"
    WHERE "nombre" = 'Centro Médico Nueva Esperanza'
    ORDER BY "id" LIMIT 1
)
WHERE "hospitalId" IS NULL;

UPDATE "usuarios"
SET "hospitalId" = (
    SELECT "id" FROM "hospitales"
    WHERE "nombre" = 'Centro Médico Nueva Esperanza'
    ORDER BY "id" LIMIT 1
)
WHERE "rol" = 'administrativo' AND "hospitalId" IS NULL;

UPDATE "usuarios"
SET "hospitalId" = "medicos"."hospitalId"
FROM "medicos"
WHERE "usuarios"."medicoId" = "medicos"."id" AND "usuarios"."hospitalId" IS NULL;

CREATE TABLE "perfiles_medicos" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "medicoId" INTEGER NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "licenciaMedica" TEXT NOT NULL,
    "especialidad" TEXT NOT NULL,
    "biografia" TEXT NOT NULL DEFAULT '',
    "fotoUrl" TEXT,
    CONSTRAINT "perfiles_medicos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tipos_servicio" (
    "id" SERIAL NOT NULL,
    "hospitalId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "duracionMin" INTEGER NOT NULL DEFAULT 30,
    "precio" DECIMAL(10,2) NOT NULL,
    CONSTRAINT "tipos_servicio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "horarios_disponibilidad" (
    "id" SERIAL NOT NULL,
    "medicoId" INTEGER NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    CONSTRAINT "horarios_disponibilidad_pkey" PRIMARY KEY ("id")
);

INSERT INTO "tipos_servicio" ("hospitalId", "nombre", "duracionMin", "precio")
SELECT "id", 'Consulta General', 30, 0
FROM "hospitales"
WHERE "nombre" = 'Centro Médico Nueva Esperanza'
  AND NOT EXISTS (
      SELECT 1 FROM "tipos_servicio"
      WHERE "hospitalId" = "hospitales"."id" AND "nombre" = 'Consulta General'
  );

UPDATE "citas"
SET "hospitalId" = "medicos"."hospitalId"
FROM "medicos"
WHERE "citas"."medicoId" = "medicos"."id" AND "citas"."hospitalId" IS NULL;

UPDATE "citas"
SET "servicioId" = (
    SELECT "id" FROM "tipos_servicio"
    WHERE "hospitalId" = "citas"."hospitalId" AND "nombre" = 'Consulta General'
    ORDER BY "id" LIMIT 1
)
WHERE "servicioId" IS NULL;

UPDATE "citas"
SET "fechaHora" = ("fecha" || ' ' || "hora")::TIMESTAMP(3)
WHERE "fechaHora" IS NULL;

ALTER TABLE "citas" ALTER COLUMN "hospitalId" SET NOT NULL;
ALTER TABLE "citas" ALTER COLUMN "servicioId" SET NOT NULL;
ALTER TABLE "citas" ALTER COLUMN "fechaHora" SET NOT NULL;

CREATE UNIQUE INDEX "usuarios_cedula_key" ON "usuarios"("cedula");
CREATE INDEX "usuarios_hospitalId_rol_idx" ON "usuarios"("hospitalId", "rol");
CREATE INDEX "medicos_hospitalId_idx" ON "medicos"("hospitalId");
CREATE UNIQUE INDEX "perfiles_medicos_usuarioId_key" ON "perfiles_medicos"("usuarioId");
CREATE UNIQUE INDEX "perfiles_medicos_medicoId_key" ON "perfiles_medicos"("medicoId");
CREATE UNIQUE INDEX "perfiles_medicos_licenciaMedica_key" ON "perfiles_medicos"("licenciaMedica");
CREATE UNIQUE INDEX "tipos_servicio_hospitalId_nombre_key" ON "tipos_servicio"("hospitalId", "nombre");
CREATE INDEX "horarios_disponibilidad_medicoId_diaSemana_idx" ON "horarios_disponibilidad"("medicoId", "diaSemana");
CREATE INDEX "citas_hospitalId_fecha_idx" ON "citas"("hospitalId", "fecha");

ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_hospitalId_fkey"
    FOREIGN KEY ("hospitalId") REFERENCES "hospitales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "medicos" ADD CONSTRAINT "medicos_hospitalId_fkey"
    FOREIGN KEY ("hospitalId") REFERENCES "hospitales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "citas" ADD CONSTRAINT "citas_hospitalId_fkey"
    FOREIGN KEY ("hospitalId") REFERENCES "hospitales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "citas" ADD CONSTRAINT "citas_servicioId_fkey"
    FOREIGN KEY ("servicioId") REFERENCES "tipos_servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "perfiles_medicos" ADD CONSTRAINT "perfiles_medicos_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "perfiles_medicos" ADD CONSTRAINT "perfiles_medicos_medicoId_fkey"
    FOREIGN KEY ("medicoId") REFERENCES "medicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tipos_servicio" ADD CONSTRAINT "tipos_servicio_hospitalId_fkey"
    FOREIGN KEY ("hospitalId") REFERENCES "hospitales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "horarios_disponibilidad" ADD CONSTRAINT "horarios_disponibilidad_medicoId_fkey"
    FOREIGN KEY ("medicoId") REFERENCES "medicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "perfiles_medicos" ("usuarioId", "medicoId", "nombreCompleto", "licenciaMedica", "especialidad")
SELECT u."id", m."id", m."nombre", 'MIGRACION-' || m."id"::TEXT, m."especialidad"
FROM "usuarios" u
JOIN "medicos" m ON m."id" = u."medicoId";

DROP INDEX IF EXISTS "citas_medico_fecha_hora_confirmada_key";
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "citas"
    WHERE "estado" IN ('confirmada', 'pendiente')
    GROUP BY "medicoId", "fecha", "hora"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Hay citas activas duplicadas por médico, fecha y hora. Revísalas antes de aplicar la restricción.';
  END IF;
END
$$;

CREATE UNIQUE INDEX "citas_medico_fecha_hora_confirmada_key"
ON "citas" ("medicoId", "fecha", "hora")
WHERE "estado" IN ('confirmada', 'pendiente');
