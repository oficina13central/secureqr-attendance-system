import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
    console.log("Starting cleanup of false absences...");
    
    const { data, error } = await supabase
        .from('attendance_records')
        .delete()
        .eq('status', 'ausente')
        .gte('date', '2026-04-01')
        .lte('date', '2026-04-19');

    if (error) {
        console.error("Error during cleanup:", error);
    } else {
        console.log("Cleanup successful. Deleted records between 2026-04-01 and 2026-04-19.");
    }
}

cleanup();
