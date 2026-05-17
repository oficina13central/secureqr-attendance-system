-- Solicitudes RRHH: correcciones de fichada y justificaciones de ausencia.
-- Ejecutar en Supabase SQL Editor antes de usar la pantalla "Solicitudes RRHH".

CREATE TABLE IF NOT EXISTS public.hr_requests (
  id TEXT PRIMARY KEY,
  employee_id UUID REFERENCES public.profiles(id),
  employee_name TEXT NOT NULL,
  sector_id TEXT REFERENCES public.sectors(id),
  request_type TEXT NOT NULL CHECK (request_type IN ('attendance_correction', 'absence_justification', 'vacation_request', 'medical_leave_request')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  target_date TEXT NOT NULL,
  end_date TEXT,
  attendance_record_id TEXT REFERENCES public.attendance_records(id),
  requested_check_in TEXT,
  requested_check_out TEXT,
  reason TEXT NOT NULL,
  attachment_url TEXT,
  requested_by_id UUID REFERENCES public.profiles(id),
  requested_by_name TEXT NOT NULL,
  resolved_by_id UUID REFERENCES public.profiles(id),
  resolved_by_name TEXT,
  resolution_comment TEXT,
  resolved_at TEXT,
  applied_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_hr_requests_status ON public.hr_requests(status);
CREATE INDEX IF NOT EXISTS idx_hr_requests_employee_date ON public.hr_requests(employee_id, target_date);
CREATE INDEX IF NOT EXISTS idx_hr_requests_type ON public.hr_requests(request_type);

ALTER TABLE public.hr_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_hr_requests" ON public.hr_requests;
CREATE POLICY "auth_all_hr_requests" ON public.hr_requests
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

INSERT INTO public.permissions (id, name, category)
VALUES ('MANAGE_HR_REQUESTS', 'Gestionar solicitudes RRHH', 'RRHH')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
VALUES
  ('superusuario', 'MANAGE_HR_REQUESTS'),
  ('administrador', 'MANAGE_HR_REQUESTS')
ON CONFLICT DO NOTHING;

ALTER TABLE public.attendance_records
DROP CONSTRAINT IF EXISTS attendance_records_status_check;

ALTER TABLE public.attendance_records
ADD CONSTRAINT attendance_records_status_check
CHECK (status IN (
  'presente',
  'en_horario',
  'tarde',
  'ausente',
  'ausente_justificada',
  'manual',
  'sin_presentismo',
  'pendiente',
  'descanso',
  'vacaciones',
  'licencia_medica',
  'compensatorio',
  'suspendido'
));
