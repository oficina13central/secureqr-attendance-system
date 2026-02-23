import { supabase } from '../services/supabaseClient';

/**
 * Script para limpiar registros duplicados en attendance_records
 * Mantiene solo el registro más reciente para cada employee_id + date
 */

interface DuplicateReport {
    employee_id: string;
    employee_name: string;
    date: string;
    total_registros: number;
    ids_duplicados: string;
}

export async function findDuplicates(): Promise<DuplicateReport[]> {
    console.log('🔍 Buscando registros duplicados...');

    const { data, error } = await supabase.rpc('find_duplicate_attendance_records');

    if (error) {
        console.error('Error buscando duplicados:', error);
        // Fallback: buscar duplicados manualmente
        const { data: allRecords } = await supabase
            .from('attendance_records')
            .select('*')
            .not('employee_id', 'is', null)
            .order('date', { ascending: false });

        if (!allRecords) return [];

        // Agrupar por employee_id + date
        const grouped = new Map<string, any[]>();
        allRecords.forEach(record => {
            const key = `${record.employee_id}_${record.date}`;
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key)!.push(record);
        });

        // Filtrar solo los que tienen duplicados
        const duplicates: DuplicateReport[] = [];
        grouped.forEach((records, key) => {
            if (records.length > 1) {
                duplicates.push({
                    employee_id: records[0].employee_id,
                    employee_name: records[0].employee_name,
                    date: records[0].date,
                    total_registros: records.length,
                    ids_duplicados: records.map(r => r.id).join(', ')
                });
            }
        });

        return duplicates;
    }

    return data || [];
}

export async function cleanupDuplicates(): Promise<{ deleted: number; errors: string[] }> {
    console.log('🧹 Iniciando limpieza de duplicados...');

    let deletedCount = 0;
    const errors: string[] = [];

    try {
        // Obtener todos los registros
        const { data: allRecords, error: fetchError } = await supabase
            .from('attendance_records')
            .select('*')
            .not('employee_id', 'is', null)
            .order('date', { ascending: false });

        if (fetchError) {
            throw fetchError;
        }

        if (!allRecords || allRecords.length === 0) {
            console.log('✅ No hay registros para procesar');
            return { deleted: 0, errors: [] };
        }

        // Agrupar por employee_id + date
        const grouped = new Map<string, any[]>();
        allRecords.forEach(record => {
            const key = `${record.employee_id}_${record.date}`;
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key)!.push(record);
        });

        // Para cada grupo con duplicados, mantener solo el más reciente
        for (const [key, records] of grouped.entries()) {
            if (records.length > 1) {
                // Ordenar por prioridad:
                // 1. Registros con check_in (no null)
                // 2. check_in más reciente
                // 3. ID más reciente
                records.sort((a, b) => {
                    // Priorizar registros con check_in
                    if (a.check_in && !b.check_in) return -1;
                    if (!a.check_in && b.check_in) return 1;

                    // Si ambos tienen check_in, comparar por hora
                    if (a.check_in && b.check_in) {
                        const timeA = new Date(a.check_in).getTime();
                        const timeB = new Date(b.check_in).getTime();
                        if (timeA !== timeB) return timeB - timeA; // Más reciente primero
                    }

                    // Finalmente por ID
                    return b.id.localeCompare(a.id);
                });

                // Mantener el primero (más reciente), eliminar el resto
                const toKeep = records[0];
                const toDelete = records.slice(1);

                console.log(`📌 Manteniendo: ${toKeep.employee_name} - ${toKeep.date} (${toKeep.id})`);
                console.log(`🗑️  Eliminando ${toDelete.length} duplicado(s)...`);

                for (const record of toDelete) {
                    const { error: deleteError } = await supabase
                        .from('attendance_records')
                        .delete()
                        .eq('id', record.id);

                    if (deleteError) {
                        errors.push(`Error eliminando ${record.id}: ${deleteError.message}`);
                        console.error(`❌ Error eliminando ${record.id}:`, deleteError);
                    } else {
                        deletedCount++;
                        console.log(`   ✓ Eliminado: ${record.id}`);
                    }
                }
            }
        }

        console.log(`\n✅ Limpieza completada: ${deletedCount} registros eliminados`);
        if (errors.length > 0) {
            console.log(`⚠️  ${errors.length} errores encontrados`);
        }

    } catch (error: any) {
        console.error('❌ Error durante la limpieza:', error);
        errors.push(error.message);
    }

    return { deleted: deletedCount, errors };
}

export async function runCleanup() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  LIMPIEZA DE REGISTROS DUPLICADOS');
    console.log('═══════════════════════════════════════════════════\n');

    // Paso 1: Encontrar duplicados
    const duplicates = await findDuplicates();

    if (duplicates.length === 0) {
        console.log('✅ No se encontraron registros duplicados');
        return;
    }

    console.log(`\n⚠️  Se encontraron ${duplicates.length} grupos de registros duplicados:\n`);
    duplicates.forEach(dup => {
        console.log(`  • ${dup.employee_name} - ${dup.date}: ${dup.total_registros} registros`);
        console.log(`    IDs: ${dup.ids_duplicados}\n`);
    });

    // Paso 2: Limpiar duplicados
    console.log('\n🧹 Procediendo con la limpieza...\n');
    const result = await cleanupDuplicates();

    // Paso 3: Verificar
    console.log('\n🔍 Verificando...');
    const remainingDuplicates = await findDuplicates();

    if (remainingDuplicates.length === 0) {
        console.log('✅ ¡Limpieza exitosa! No quedan duplicados.');
    } else {
        console.log(`⚠️  Aún quedan ${remainingDuplicates.length} grupos duplicados`);
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log(`  RESUMEN: ${result.deleted} registros eliminados`);
    if (result.errors.length > 0) {
        console.log(`  ERRORES: ${result.errors.length}`);
    }
    console.log('═══════════════════════════════════════════════════\n');

    return result;
}
