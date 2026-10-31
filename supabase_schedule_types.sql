-- Actualiza los tipos validos de cronograma y soporte de medios francos (0.5).
-- Necesario para guardar turnos "Doble", "Medio Turno", "Medio Descanso", francos compensatorios y suspensiones.

ALTER TABLE schedules
DROP CONSTRAINT IF EXISTS schedules_type_check;

ALTER TABLE schedules
ADD CONSTRAINT schedules_type_check
CHECK (type IN (
  'continuous',
  'half',
  'split',
  'double',
  'off',
  'vacation',
  'medical',
  'compensatory',
  'half_compensatory',
  'suspension'
));

-- Permite saldos y movimientos de medio descanso (+0.5 / -0.5)
ALTER TABLE profiles
ALTER COLUMN compensatory_rest_balance TYPE NUMERIC(10, 2)
USING compensatory_rest_balance::NUMERIC(10, 2);

ALTER TABLE compensatory_rest_ledger
ALTER COLUMN amount TYPE NUMERIC(10, 2)
USING amount::NUMERIC(10, 2);
