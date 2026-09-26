-- Impide que dos solicitudes concurrentes reserven el mismo horario activo.
-- Las citas canceladas no bloquean el horario.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "citas"
    WHERE "estado" = 'confirmada'
    GROUP BY "medicoId", "fecha", "hora"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Hay citas confirmadas duplicadas por médico, fecha y hora. Revísalas antes de aplicar la restricción.';
  END IF;
END
$$;

CREATE UNIQUE INDEX "citas_medico_fecha_hora_confirmada_key"
ON "citas" ("medicoId", "fecha", "hora")
WHERE "estado" = 'confirmada';
