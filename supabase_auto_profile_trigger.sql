-- ============================================================
-- TRIGGER: Auto-crear perfil cuando un usuario se registra
-- ============================================================
-- PROBLEMA QUE RESUELVE:
--   Cuando un usuario se registra desde la app, Supabase crea
--   el auth.user pero el INSERT a profiles falla porque el
--   usuario aun no tiene sesion activa (RLS bloquea el acceso).
--
-- SOLUCION:
--   Este trigger se ejecuta con SECURITY DEFINER (permisos de
--   superusuario) y crea el perfil automaticamente, sin depender
--   del cliente. Asi el perfil SIEMPRE se crea.
--
-- INSTRUCCIONES:
--   1. Ir a Supabase -> SQL Editor
--   2. Pegar TODO este contenido y hacer clic en "Run"
--   3. Listo! Todos los registros futuros crearan su perfil.
-- ============================================================


-- Paso 1: Crear la funcion que crea el perfil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_dni       TEXT;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario');
  v_dni       := NEW.raw_user_meta_data->>'dni';

  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    dni,
    role,
    is_approved,
    is_employee,
    qr_token
  )
  VALUES (
    NEW.id,
    v_full_name,
    NEW.email,
    v_dni,
    'empleado',
    FALSE,
    TRUE,
    'SECURE_USER:' || REPLACE(v_full_name, ' ', '_') || '_' || NEW.id
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;


-- Paso 2: Eliminar el trigger anterior si existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;


-- Paso 3: Crear el trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- POLITICA RLS: permitir acceso completo a usuarios autenticados
-- ============================================================
DROP POLICY IF EXISTS "auth_all_profiles" ON public.profiles;

CREATE POLICY "auth_all_profiles"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- RECUPERAR el usuario Milesbar que ya esta registrado pero
-- no tiene perfil (ejecutar solo si el SELECT devuelve vacio)
-- ============================================================

-- Primero verificar si tiene perfil:
-- SELECT * FROM profiles WHERE email = 'miles.rvbar@gmail.com';

-- Si no tiene perfil, ejecutar esto:
INSERT INTO public.profiles (id, full_name, email, role, is_approved, is_employee, qr_token)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'full_name', 'Milesbar') as full_name,
  email,
  'empleado',
  FALSE,
  TRUE,
  'SECURE_USER:Milesbar_' || id
FROM auth.users
WHERE email = 'miles.rvbar@gmail.com'
  AND id NOT IN (SELECT id FROM public.profiles WHERE id IS NOT NULL)
ON CONFLICT (id) DO NOTHING;

-- Confirmar el email del usuario (para que pueda iniciar sesion)
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
WHERE email = 'miles.rvbar@gmail.com';

-- Ver resultado final
SELECT 
  u.email,
  u.email_confirmed_at IS NOT NULL as email_confirmado,
  p.full_name,
  p.is_approved,
  p.role
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'miles.rvbar@gmail.com';
