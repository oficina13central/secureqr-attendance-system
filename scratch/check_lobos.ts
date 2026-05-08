import { supabase } from './services/supabaseClient';

async function run() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('full_name', '%LOBO%');
  
  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }
  
  console.log('Profiles found:');
  console.log(JSON.stringify(data, null, 2));
}

run();
