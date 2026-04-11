-- Habilitar Row-Level Security en todas las tablas sensibles
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Crear políticas de acceso: solo permitir a los usuarios autenticados de tu sistema
-- Esto evita que bots o curiosos extraigan o borren tus datos, 
-- pero permite que tu App (que ya exige inicio de sesión) siga funcionando sin problemas.
CREATE POLICY "auth_all_sectors" ON sectors FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_all_roles" ON roles FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_all_permissions" ON permissions FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_all_role_permissions" ON role_permissions FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_all_profiles" ON profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_all_attendance" ON attendance_records FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_all_audit_logs" ON audit_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_all_fraud" ON fraud_reports FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_all_schedules" ON schedules FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_all_settings" ON system_settings FOR ALL TO authenticated USING (true);
