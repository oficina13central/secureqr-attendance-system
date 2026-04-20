
import { supabase } from '../services/supabaseClient';

async function cleanupDuplicates() {
    const today = '2026-04-20';
    console.log(`Checking for duplicates for ${today}...`);

    const { data: records, error } = await supabase
        .from('attendance_records')
        .select('id, employee_id, date, status, created_at')
        .eq('date', today);

    if (error) {
        console.error('Error fetching records:', error);
        return;
    }

    const seen = new Set();
    const toDelete = [];

    for (const r of records) {
        const key = `${r.employee_id}_${r.date}`;
        if (seen.has(key)) {
            toDelete.push(r.id);
        } else {
            seen.add(key);
        }
    }

    if (toDelete.length === 0) {
        console.log('No duplicates found today.');
        return;
    }

    console.log(`Found ${toDelete.length} duplicates to delete.`);
    for (const id of toDelete) {
        const { error: delError } = await supabase
            .from('attendance_records')
            .delete()
            .eq('id', id);
        
        if (delError) console.error(`Error deleting ${id}:`, delError);
        else console.log(`Deleted duplicate record ${id}`);
    }
}

cleanupDuplicates();
