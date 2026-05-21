-- Actualiza los tipos validos de cronograma.
-- Necesario para guardar turnos "Doble", francos compensatorios y suspensiones.

ALTER TABLE schedules
DROP CONSTRAINT IF EXISTS schedules_type_check;

ALTER TABLE schedules
ADD CONSTRAINT schedules_type_check
CHECK (type IN (
  'continuous',
  'split',
  'double',
  'off',
  'vacation',
  'medical',
  'compensatory',
  'suspension'
));
