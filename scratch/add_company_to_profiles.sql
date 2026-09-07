-- ==========================================================================
-- AGREGAR COLUMNA 'company' A PROFILES (Panadería vs Bar Miles)
-- ==========================================================================
-- Ejecuta este script en el SQL Editor de Supabase:

-- 1. Agregar columna company si no existe
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company TEXT DEFAULT 'ayres';

-- 2. Marcar al personal del Bar Miles con company = 'bar_miles'
UPDATE public.profiles 
SET company = 'bar_miles' 
WHERE email ILIKE '%@bar.%' 
   OR email ILIKE '%miles%' 
   OR dni IN (
     '39356158', '40697509', '38364969', '28965845', '25542399',
     '32853360', '38589782', '38489782', '36584606', '41446534',
     '42122073', '38742112', '36994221', '25857435', '36041627',
     '39140977', '39731647', '45665387', '37916910', '20530641',
     '32493380', '44376552', '46400649', '45962618', '45960076',
     '45275372', '33168277', '45332857', '45730775'
   );

-- 3. Marcar a todo el personal restante con company = 'ayres' (Panadería)
UPDATE public.profiles 
SET company = 'ayres' 
WHERE company IS NULL;
