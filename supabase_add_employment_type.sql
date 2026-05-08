ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS employment_type TEXT
CHECK (employment_type IN ('efectivo', 'jornalero'))
DEFAULT 'efectivo';

UPDATE profiles
SET employment_type = 'efectivo'
WHERE employment_type IS NULL;
