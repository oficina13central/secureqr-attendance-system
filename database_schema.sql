-- Database Schema based on types.ts

CREATE TABLE IF NOT EXISTS sectors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL
);

-- New Role and Permission tables
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Updated profiles table (using profiles instead of users for Supabase Auth consistency)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  dni TEXT UNIQUE,
  role TEXT REFERENCES roles(id),
  sector_id TEXT REFERENCES sectors(id),
  photo_url TEXT,
  qr_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- User management fields
  is_approved BOOLEAN DEFAULT FALSE,
  is_suspended BOOLEAN DEFAULT FALSE,
  suspended_until TIMESTAMP WITH TIME ZONE DEFAULT NULL, -- NULL = permanent
  suspended_reason TEXT DEFAULT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL       -- NULL = active
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  employee_id UUID REFERENCES profiles(id),
  employee_name TEXT NOT NULL,
  date TEXT NOT NULL,
  check_in TEXT,
  check_out TEXT,
  status TEXT CHECK(status IN ('presente', 'en_horario', 'tarde', 'ausente', 'manual', 'sin_presentismo', 'pendiente', 'descanso', 'vacaciones', 'licencia_medica')) NOT NULL,
  minutes_late INTEGER DEFAULT 0,
  manual_reason TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  manager_name TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  timestamp TEXT NOT NULL
);


CREATE TABLE IF NOT EXISTS fraud_reports (
  id TEXT PRIMARY KEY,
  risk_level TEXT CHECK(risk_level IN ('bajo', 'medio', 'alto')) NOT NULL,
  summary TEXT,
  anomalies TEXT, -- JSON string
  recommendations TEXT -- JSON string
);

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT CHECK(type IN ('continuous', 'split', 'off', 'vacation', 'medical')) NOT NULL,
  segments JSONB NOT NULL,
  last_modified_by TEXT,
  last_modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initial Data
INSERT INTO permissions (id, name, category) VALUES
('MANAGE_RULES', 'Configuración de reglas', 'Sistema'),
('MANAGE_SECTORS', 'Gestión de sectores', 'Empresa'),
('MANAGE_ROLES', 'Gestión de roles y permisos', 'Sistema'),
('MANAGE_USERS', 'Administración de usuarios', 'Sistema'),
('VIEW_AUDIT_LOGS', 'Ver logs de sistema', 'Auditoría'),
('VIEW_PERSONNEL_AUDIT', 'Auditoría de personal completa', 'Auditoría'),
('MANAGE_PERSONNEL', 'Gestión de personal global', 'Personal'),
('MANAGE_SCHEDULES', 'Gestión de cronogramas global', 'Cronogramas'),
('VIEW_SECTOR_PERSONNEL', 'Ver personal de su sector', 'Personal'),
('MANAGE_SECTOR_SCHEDULES', 'Gestionar cronogramas de su sector', 'Cronogramas'),
('MANUAL_ATTENDANCE', 'Marcación manual', 'Asistencia'),
('SCAN_QR', 'Escaneo de QR', 'Terminal'),
('VIEW_DASHBOARD', 'Ver panel general', 'Auditoría'),
('MANAGE_SETTINGS', 'Acceso a ajustes', 'Sistema'),
('SELF_VIEW', 'Ver credencial propia (QR)', 'Personal')
ON CONFLICT (id) DO NOTHING;

INSERT INTO roles (id, name, description) VALUES
('superusuario', 'Superusuario', 'Acceso total al sistema'),
('administrador', 'Administrador', 'Gestión administrativa global'),
('encargado', 'Encargado', 'Gestión operativa de sector'),
('empleado', 'Empleado', 'Solo marcación y consulta básica'),
('terminal', 'Terminal de Acceso', 'Dispositivo dedicado exclusivamente para fichada')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO system_settings (key, value) 
VALUES ('attendance_rules', '{"en_horario": 5, "llego_tarde": 30, "max_mensual": 15}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Role Permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
('terminal', 'SCAN_QR'),
('encargado', 'SELF_VIEW')
ON CONFLICT DO NOTHING;