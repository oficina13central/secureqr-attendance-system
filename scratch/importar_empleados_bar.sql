-- Ajustes necesarios para importar empleados sin cuenta de login propia
INSERT INTO public.roles (id, name, description)
VALUES
  ('superusuario', 'Superusuario', 'Acceso total al sistema'),
  ('administrador', 'Administrador/a', 'Gestion administrativa global'),
  ('encargado', 'Encargado/a', 'Gestion operativa de sector'),
  ('empleado', 'Empleado/a', 'Solo marcacion y consulta basica'),
  ('terminal', 'Terminal de Acceso', 'Dispositivo dedicado exclusivamente para fichada')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hire_date TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contract_type TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_position TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_category TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cuil TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS marital_status TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS managed_sectors TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS compensatory_rest_balance INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.employee_documents (
  id TEXT PRIMARY KEY,
  employee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  description TEXT NOT NULL,
  expires_at TEXT,
  is_required BOOLEAN DEFAULT false,
  created_at TEXT NOT NULL
);

ALTER TABLE public.employee_documents DROP CONSTRAINT IF EXISTS employee_documents_type_check;
ALTER TABLE public.employee_documents ADD CONSTRAINT employee_documents_type_check CHECK (type IN ('medical','medical_exam','epp_delivery','suspension','identity','contract','certificate','training','other'));

-- Empleados importados desde lista_personas.xlsx. sector_id queda NULL para asignarlo luego en la app.
INSERT INTO public.profiles (id, full_name, email, dni, cuil, birth_date, role, employment_type, sector_id, is_employee, is_approved, is_suspended, deleted_at, nationality, contract_type, qr_token) VALUES
('05c87df3-53c2-4925-8eea-f8818b6e98e3', 'Miguel Ignacio Cardozo', '39356158@bar.local', '39356158', '20393561581', '1995-09-28', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Miguel_Ignacio_Cardozo_05c87df3-53c2-4925-8eea-f8818b6e98e3'),
('36d2ed86-d60d-4e81-8284-f5bbebe6a81b', 'Marcos Leonel Manino', '40697509@bar.local', '40697509', '20406975097', '1996-01-02', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Marcos_Leonel_Manino_36d2ed86-d60d-4e81-8284-f5bbebe6a81b'),
('2550e2a2-5f84-454a-a0b4-e6b7f552cb6c', 'Eliana Gonzalez Argañaraz', '38364969@bar.local', '38364969', '27383649698', '1995-02-13', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Eliana_Gonzalez_Argañaraz_2550e2a2-5f84-454a-a0b4-e6b7f552cb6c'),
('5b5b6a8a-1be3-46a8-83df-a519b69390e2', 'Cristian Leonardo Palacio', '28965845@bar.local', '28965845', '23289658459', '1981-08-07', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Cristian_Leonardo_Palacio_5b5b6a8a-1be3-46a8-83df-a519b69390e2'),
('f907ee54-6093-4841-bd8c-d35743d067eb', 'Luis Eduardo Carrizo', '25542399@bar.local', '25542399', '20255423992', '1976-10-06', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Luis_Eduardo_Carrizo_f907ee54-6093-4841-bd8c-d35743d067eb'),
('47a426d7-2e7d-401e-a37b-7a381c1f4c68', 'Daniela Anahi Orrillo', '32853360@bar.local', '32853360', '27328533605', '1987-03-18', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Daniela_Anahi_Orrillo_47a426d7-2e7d-401e-a37b-7a381c1f4c68'),
('9b5335ed-4e4f-4ba3-8df3-46cd1aad2b95', 'Gomez Guechea Gaston Leonel', '38489782@bar.local', '38489782', '20385897828', '1994-12-20', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Gomez_Guechea_Gaston_Leonel_9b5335ed-4e4f-4ba3-8df3-46cd1aad2b95'),
('c2ab5f0e-efa0-4cbc-a670-90c2ff2cc2c7', 'Romina Dora Chavez', '33168277@bar.local', '33168277', '27331682778', '1989-01-25', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Romina_Dora_Chavez_c2ab5f0e-efa0-4cbc-a670-90c2ff2cc2c7'),
('8d2ca823-d438-4a57-a3f5-86b57500ad18', 'Silvia Mattiuzzi', '36584606@bar.local', '36584606', '27365846060', '1998-03-01', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Silvia_Mattiuzzi_8d2ca823-d438-4a57-a3f5-86b57500ad18'),
('4f95bfc3-f6c0-47d4-9fa7-ecfafc95119b', 'Enzo Matias Medina', '41446534@bar.local', '41446534', '20414465340', '1998-05-26', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Enzo_Matias_Medina_4f95bfc3-f6c0-47d4-9fa7-ecfafc95119b'),
('4210047b-96ce-49bf-bdbd-fac4fcb8b362', 'Micaela Belen Valenzuela', '42122073@bar.local', '42122073', '27421220730', '1999-08-24', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Micaela_Belen_Valenzuela_4210047b-96ce-49bf-bdbd-fac4fcb8b362'),
('0947c903-dbf3-4bb0-902a-f820948a75a9', 'Nicolas Nahuel Sandoval', '38742112@bar.local', '38742112', '20387421123', '1995-02-28', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Nicolas_Nahuel_Sandoval_0947c903-dbf3-4bb0-902a-f820948a75a9'),
('1fb44fa1-1b4a-4bba-8b8a-026328318a20', 'Marcelo Rodrigo Morales', '36994221@bar.local', '36994221', '20369942212', '1992-06-16', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Marcelo_Rodrigo_Morales_1fb44fa1-1b4a-4bba-8b8a-026328318a20'),
('bb092802-a303-4cc8-9a54-c53dd22c4d96', 'Rafael Esteban Diaz', '25857435@bar.local', '25857435', '20258574355', '1977-07-01', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Rafael_Esteban_Diaz_bb092802-a303-4cc8-9a54-c53dd22c4d96'),
('f02612db-7154-4741-81f5-0ac48fcfef1c', 'Nicolas Gabriel Fernandez', '36041627@bar.local', '36041627', '20360416276', '1990-12-18', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Nicolas_Gabriel_Fernandez_f02612db-7154-4741-81f5-0ac48fcfef1c'),
('c13efcad-b2e3-483e-8096-b3a4dfa460dc', 'Nicolas Adrian Mauricio Paz', '39140977@bar.local', '39140977', '20391409774', '1994-06-08', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Nicolas_Adrian_Mauricio_Paz_c13efcad-b2e3-483e-8096-b3a4dfa460dc'),
('c1eca263-b696-444c-81f3-67d503d272ab', 'Silvia Luciana Pallares', '39731647@bar.local', '39731647', '27397316470', '1996-01-08', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Silvia_Luciana_Pallares_c1eca263-b696-444c-81f3-67d503d272ab'),
('1d795457-2459-462f-a1c5-3a82fa12944b', 'Maximiliano Agustin Lopez', '45665387@bar.local', '45665387', '20456653872', '2005-03-15', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Maximiliano_Agustin_Lopez_1d795457-2459-462f-a1c5-3a82fa12944b'),
('157aa608-f897-44ff-a1fc-8ed29708f570', 'Jonathan Alejandro Lescano', '37916910@bar.local', '37916910', '20379169105', '1992-12-30', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Jonathan_Alejandro_Lescano_157aa608-f897-44ff-a1fc-8ed29708f570'),
('c8b1f31b-ee59-414a-8e67-2b4ccac2bc95', 'Jose Ignacio Chachagua', '20530641@bar.local', '20530641', '20205306413', '1969-03-20', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Jose_Ignacio_Chachagua_c8b1f31b-ee59-414a-8e67-2b4ccac2bc95'),
('dbc02cb4-2d4d-4691-b775-9fe00328e41f', 'Maria Paula Grondona', '32493380@bar.local', '32493380', '27324933803', '1987-02-26', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Maria_Paula_Grondona_dbc02cb4-2d4d-4691-b775-9fe00328e41f'),
('c289d08a-3c03-46b1-8b4f-9d8b8dd0ffa4', 'Victor Roberto Sanchez', '44376552@bar.local', '44376552', '20443765523', '1999-08-10', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Victor_Roberto_Sanchez_c289d08a-3c03-46b1-8b4f-9d8b8dd0ffa4'),
('42728b95-5acc-4700-8d22-0b849ef98d19', 'Juan Ignacio Cesar', '46400649@bar.local', '46400649', '20464006495', '2005-06-15', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Juan_Ignacio_Cesar_42728b95-5acc-4700-8d22-0b849ef98d19'),
('14aabbc1-a9f2-4bbe-8196-1fe0d25e6ea9', 'Ian Mauricio Biececi Heine', '45275372@bar.local', '45275372', '20452753724', '2004-04-23', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Ian_Mauricio_Biececi_Heine_14aabbc1-a9f2-4bbe-8196-1fe0d25e6ea9'),
('88891575-4e73-46b7-b764-6a7a3949464b', 'Ana Pawilenas', '45332857@bar.local', '45332857', '27453328576', '2004-08-09', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Ana_Pawilenas_88891575-4e73-46b7-b764-6a7a3949464b'),
('04767d4a-8955-47cc-98c5-48959676a787', 'Brisa Mansilla', '45730775@bar.local', '45730775', '27457307751', '2005-08-07', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Brisa_Mansilla_04767d4a-8955-47cc-98c5-48959676a787'),
('14661caa-bc27-4d9b-b363-f1ae02886fe1', 'Bruno Joaquin Medina', '45962618@bar.local', '45962618', '20459626183', '2005-12-09', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Bruno_Joaquin_Medina_14661caa-bc27-4d9b-b363-f1ae02886fe1'),
('77a1fb1d-210e-4c91-902e-2b25e4e12d1d', 'Mauricio Agüero', '45960076@bar.local', '45960076', '20459600761', '2005-11-18', 'empleado', 'efectivo', NULL, true, false, false, NULL, 'Argentina', 'permanent', 'SECURE_USER:Mauricio_Agüero_77a1fb1d-210e-4c91-902e-2b25e4e12d1d')
ON CONFLICT (dni) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  cuil = EXCLUDED.cuil,
  birth_date = EXCLUDED.birth_date,
  role = EXCLUDED.role,
  employment_type = EXCLUDED.employment_type,
  is_employee = true,
  deleted_at = NULL;
