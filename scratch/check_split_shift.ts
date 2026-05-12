
import { createClient } from '@supabase/supabase-client';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStuart() {
  const date = '2026-04-20';
  const name = 'STUART MARIA ISABEL';
  
  console.log(`Checking records for ${name} on ${date}...`);
  
  // 1. Find Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, default_schedule')
    .ilike('full_name', `%${name}%`)
    .maybeSingle();
    
  if (!profile) {
    console.error('Profile not found');
    return;
  }
  
  console.log('Profile ID:', profile.id);
  console.log('Default Schedule (Day 1 - Monday):', JSON.stringify(profile.default_schedule?.['1'], null, 2));

  // 2. Find Records
  const { data: records } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('date', date)
    .eq('employee_id', profile.id);
    
  console.log('Attendance Records found:', records?.length);
  records?.forEach(r => {
    console.log(`- ID: ${r.id}, In: ${r.check_in}, Out: ${r.check_out}, Status: ${r.status}`);
  });

  // 3. Find Specific Schedules
  const { data: schedules } = await supabase
    .from('schedules')
    .select('*')
    .eq('employee_id', profile.id)
    .eq('date', date);
    
  console.log('Specific Schedules found:', schedules?.length);
  schedules?.forEach(s => {
    console.log(`- Type: ${s.type}, Segments: ${JSON.stringify(s.segments)}`);
  });
}

checkStuart();
