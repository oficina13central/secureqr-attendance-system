-- Legajo laboral completo: datos laborales y vencimientos documentales.
-- Ejecutar en Supabase SQL Editor. Es compatible con datos existentes.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS hire_date TEXT,
ADD COLUMN IF NOT EXISTS contract_type TEXT,
ADD COLUMN IF NOT EXISTS job_position TEXT,
ADD COLUMN IF NOT EXISTS job_category TEXT,
ADD COLUMN IF NOT EXISTS cuil TEXT,
ADD COLUMN IF NOT EXISTS birth_date TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS marital_status TEXT,
ADD COLUMN IF NOT EXISTS nationality TEXT;

ALTER TABLE public.employee_documents
ADD COLUMN IF NOT EXISTS expires_at TEXT,
ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT false;

ALTER TABLE public.employee_documents
DROP CONSTRAINT IF EXISTS employee_documents_type_check;

ALTER TABLE public.employee_documents
ADD CONSTRAINT employee_documents_type_check
CHECK (type IN (
  'medical',
  'medical_exam',
  'epp_delivery',
  'suspension',
  'identity',
  'contract',
  'certificate',
  'training',
  'other'
));

CREATE INDEX IF NOT EXISTS idx_profiles_labor_sector ON public.profiles(sector_id);
CREATE INDEX IF NOT EXISTS idx_profiles_hire_date ON public.profiles(hire_date);
CREATE INDEX IF NOT EXISTS idx_employee_documents_expires_at ON public.employee_documents(expires_at);
CREATE INDEX IF NOT EXISTS idx_employee_documents_type ON public.employee_documents(type);
