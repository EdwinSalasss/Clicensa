ALTER TYPE "EstadoCita" ADD VALUE 'vencida';

ALTER TABLE "citas"
  ADD COLUMN "fechaReprogramacion" TEXT,
  ADD COLUMN "horaReprogramacion" TEXT,
  ADD COLUMN "estadoReprogramacion" TEXT,
  ADD COLUMN "solicitadaReprogramacionEn" TIMESTAMP(3),
  ADD COLUMN "resueltaReprogramacionEn" TIMESTAMP(3);

ALTER TABLE "citas"
  ADD CONSTRAINT "citas_reprogramacion_solicitada_check"
  CHECK (
    ("estadoReprogramacion" IS NULL AND "fechaReprogramacion" IS NULL AND "horaReprogramacion" IS NULL)
    OR
    ("estadoReprogramacion" IN ('PENDIENTE', 'APROBADA', 'RECHAZADA')
      AND "fechaReprogramacion" IS NOT NULL AND "horaReprogramacion" IS NOT NULL)
  );

CREATE INDEX "citas_medico_fechaReprogramacion_estadoReprogramacion_idx"
  ON "citas" ("medicoId", "fechaReprogramacion", "estadoReprogramacion");

CREATE UNIQUE INDEX "citas_medico_reprogramacion_horario_pendiente_key"
  ON "citas" ("medicoId", "fechaReprogramacion", "horaReprogramacion")
  WHERE "estadoReprogramacion" = 'PENDIENTE';
