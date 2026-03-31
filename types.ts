
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
  sector_id?: string;
  dni?: string;
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
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: 'en_horario' | 'tarde' | 'ausente' | 'manual' | 'sin_presentismo' | 'pendiente' | 'descanso' | 'vacaciones';
  minutes_late: number;
  manual_reason?: string;
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
