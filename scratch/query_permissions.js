import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env.local from parent directory
const envContent = fs.readFileSync('../.env.local', 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseKey = keyMatch ? keyMatch[1].trim() : '';

console.log("Supabase URL:", supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: rolePerms, error } = await supabase
    .from('role_permissions')
    .select('*');
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Role Permissions:", rolePerms);
  }
}
run();
