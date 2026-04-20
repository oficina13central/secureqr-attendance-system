
import { personnelService } from './services/personnelService';
import { supabase } from './services/supabaseClient';

async function checkZamorano() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', '%Zamorano%');
    
    if (error) {
        console.error('Error fetching Zamorano:', error);
        return;
    }
    
    console.log('Zamorano profiles found:', data.length);
    data.forEach(p => console.log(`- ID: ${p.id}, Name: ${p.full_name}, Role: ${p.role}, Deleted: ${p.deleted_at}`));
}

checkZamorano();
