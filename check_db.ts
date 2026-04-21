import { supabase } from './services/supabaseClient'; 
async function run() { 
  const {data} = await supabase.from('attendance_records').select('*').eq('date', '2026-04-21'); 
  console.log(JSON.stringify(data, null, 2)); 
} 
run();
