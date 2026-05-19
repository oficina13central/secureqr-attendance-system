
// export type UserRole = 'empleado' | 'encargado' | 'administrador' | 'superusuario'; // Legacy static roles

export interface Permission {
  id: string;
  name: string;
  category: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions?: string[]; // Array of permission IDs
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string; // Dynamic role ID
  employment_type?: 'efectivo' | 'jornalero';
  hire_date?: string | null;
  contract_type?: string | null;
  job_position?: string | null;
  job_category?: string | null;
  sector_id?: string;
  dni?: string;
  cuil?: string | null;
  birth_date?: string | null;
  address?: string | null;
  phone?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  marital_status?: string | null;
  nationality?: string | null;
  photo_url?: string;
  qr_token?: string;
  roles?: Role; // Joined data
  managed_sectors?: string[]; // IDs de sectores adicionales que este encargado controla
  // User management fields
  is_approved?: boolean;
  is_suspended?: boolean;
  suspended_until?: string | null;  // ISO date string, null = permanent
  suspended_reason?: string;
  deleted_at?: string | null;       // ISO date string, null = active
  is_employee?: boolean;            // Differentiate system accounts from personnel
  default_schedule?: Record<string, any>; // '0'-'6' for Sun-Sat, plus optional metadata
  compensatory_rest_balance?: number;
}

export interface DailyShift {
  type: 'continuous' | 'split' | 'off';
  segments: { start: string; end: string }[];
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: 'en_horario' | 'tarde' | 'ausente' | 'ausente_justificada' | 'manual' | 'sin_presentismo' | 'pendiente' | 'descanso' | 'vacaciones' | 'licencia_medica' | 'presente' | 'compensatorio' | 'suspendido';
  minutes_late: number;
  manual_reason?: string;
  assigned_time?: string;
}

export interface AuditLog {
  id: string;
  manager_name: string;
  employee_name: string;
  action: string;
  old_value: string;
  new_value: string;
  reason: string;
  timestamp: string;
}

export interface FraudReport {
  risk_level: 'bajo' | 'medio' | 'alto';
  summary: string;
  anomalies: string[];
  recommendations: string[];
}

export interface CompensatoryRestLog {
  id: string;
  employee_id: string;
  amount: number;
  type: 'credit' | 'usage' | 'payment' | 'adjustment';
  reason: string;
  manager_name: string;
  created_at: string;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  type: 'medical' | 'suspension' | 'identity' | 'contract' | 'certificate' | 'training' | 'other';
  file_url: string;
  file_name: string;
  description: string;
  expires_at?: string | null;
  is_required?: boolean | null;
  created_at: string;
}

export type HrRequestType = 'attendance_correction' | 'absence_justification' | 'vacation_request' | 'medical_leave_request';
export type HrRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface HrRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  sector_id?: string | null;
  request_type: HrRequestType;
  status: HrRequestStatus;
  target_date: string;
  end_date?: string | null;
  attendance_record_id?: string | null;
  requested_check_in?: string | null;
  requested_check_out?: string | null;
  reason: string;
  attachment_url?: string | null;
  requested_by_id?: string | null;
  requested_by_name: string;
  resolved_by_id?: string | null;
  resolved_by_name?: string | null;
  resolution_comment?: string | null;
  resolved_at?: string | null;
  applied_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}
