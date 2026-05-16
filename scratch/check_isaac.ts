import { supabase } from '../services/supabaseClient';

async function checkIsaac() {
    const employeeId = 'f5459d33-b52b-4b30-9f83-87cd20311c14';
    const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', employeeId)
        .lt('date', '2026-04-20')
        .order('date', { ascending: true });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Records for Isaac Gomez before 2026-04-20:');
    console.log(JSON.stringify(data, null, 2));
}

checkIsaac();
