import { supabase } from '../services/supabaseClient';

async function checkDates() {
    const { data, error } = await supabase
        .from('attendance_records')
        .select('date')
        .limit(10);
    
    if (error) {
        console.error(error);
        return;
    }
    
    console.log('Sample dates from DB:');
    console.log(data);
}

checkDates();
