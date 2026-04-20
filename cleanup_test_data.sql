-- ==========================================================
-- SCRIPT DE LIMPIEZA PARA INICIO DE OPERACIÓN REAL
-- ==========================================================
-- Instrucciones: 
-- 1. Ve al Dashboard de Supabase (https://supabase.com/dashboard).
-- 2. Selecciona tu proyecto.
-- 3. Ve a la sección "SQL Editor" en el menú lateral.
-- 4. Crea un "New Query".
-- 5. Pega y ejecuta el siguiente código:

-- 1. Eliminar todos los fichajes (asistencias)
DELETE FROM public.attendance_records;

-- 2. Eliminar los logs de auditoría (registros de cambios de prueba)
DELETE FROM public.audit_logs;

-- 3. Eliminar los reportes de 'Auditoría Automática' (análisis de IA de prueba)
DELETE FROM public.fraud_reports;

-- ==========================================================
-- CONFIRMACIÓN DE SEGURIDAD:
-- NO se tocan las tablas: profiles, schedules, sectors, 
-- roles, permissions, role_permissions ni system_settings.
-- ==========================================================
