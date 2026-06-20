import { createClient } from '@supabase/supabase-client';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: profile } = await supabase.from('profiles').select('*').ilike('full_name', '%trejo%');
  console.log("Profile:", profile);
  if (!profile || profile.length === 0) return;
  
  const id = profile[0].id;
  const { data: records } = await supabase.from('attendance_records').select('*').eq('employee_id', id).gte('date', '2026-05-17').lte('date', '2026-05-25').order('date');
  console.log("Records:", records);
}
check();
