import { supabase } from './supabaseClient';

export interface Sector {
    id: string;
    name: string;
    description?: string;
    created_at: string;
}

export const sectorService = {
    async getAll(): Promise<Sector[]> {
        const { data, error } = await supabase
            .from('sectors')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching sectors:', error);
            return [];
        }
        return data || [];
    },

    async create(sector: Omit<Sector, 'id' | 'created_at'>): Promise<Sector | null> {
        const newSector = {
            ...sector,
            id: crypto.randomUUID(),
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('sectors')
            .insert([newSector])
            .select()
            .single();

        if (error) {
            console.error('Error creating sector:', error);
            return null;
        }
        return data;
    },

    async update(id: string, sector: Partial<Sector>): Promise<Sector | null> {
        const { data, error } = await supabase
            .from('sectors')
            .update(sector)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating sector:', error);
            return null;
        }
        return data;
    },

    async delete(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('sectors')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting sector:', error);
            return false;
        }
        return true;
    }
};
