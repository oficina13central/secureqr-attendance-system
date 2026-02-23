-- Script para limpiar registros duplicados en attendance_records
-- Este script identifica y elimina registros duplicados manteniendo solo el más reciente

-- PASO 1: Identificar duplicados (ejecutar primero para revisar)
-- Muestra todos los registros duplicados agrupados por employee_id y date
SELECT 
    employee_id,
    employee_name,
    date,
    COUNT(*) as total_registros,
    STRING_AGG(id, ', ') as ids_duplicados
FROM attendance_records
WHERE employee_id IS NOT NULL
GROUP BY employee_id, date
HAVING COUNT(*) > 1
ORDER BY date DESC, employee_name;

-- PASO 2: Eliminar duplicados manteniendo el más reciente
-- Este query elimina todos los duplicados excepto el registro con el ID más reciente
WITH duplicates AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (
            PARTITION BY employee_id, date 
            ORDER BY 
                CASE WHEN check_in IS NOT NULL THEN 0 ELSE 1 END,  -- Priorizar registros con check_in
                check_in DESC NULLS LAST,  -- Luego por hora de entrada más reciente
                id DESC  -- Finalmente por ID más reciente
        ) as row_num
    FROM attendance_records
    WHERE employee_id IS NOT NULL
)
DELETE FROM attendance_records
WHERE id IN (
    SELECT id 
    FROM duplicates 
    WHERE row_num > 1
);

-- PASO 3: Verificar que no queden duplicados
SELECT 
    employee_id,
    employee_name,
    date,
    COUNT(*) as total_registros
FROM attendance_records
WHERE employee_id IS NOT NULL
GROUP BY employee_id, date
HAVING COUNT(*) > 1;

-- PASO 4 (OPCIONAL): Limpiar registros huérfanos (sin employee_id válido)
-- ADVERTENCIA: Solo ejecutar si estás seguro de que estos registros no son necesarios
-- SELECT id, employee_name, date, check_in, status
-- FROM attendance_records
-- WHERE employee_id IS NULL OR employee_id NOT IN (SELECT id FROM profiles);

-- Para eliminar registros huérfanos (descomentar si es necesario):
-- DELETE FROM attendance_records
-- WHERE employee_id IS NULL OR employee_id NOT IN (SELECT id FROM profiles);
