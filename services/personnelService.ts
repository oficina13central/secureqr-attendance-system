import { supabase } from './supabaseClient';
import { Profile } from '../types';

export const personnelService = {
    async getAll(): Promise<Profile[]> {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .or('is_employee.eq.true,is_employee.is.null') // Default true or null for personnel
            .order('full_name', { ascending: true });

        if (error) {
            console.error('Error fetching profiles:', error);
            // Si la columna is_employee no existe en DB aún (fallback)
            if (error.code === '42703') {
                const retry = await supabase.from('profiles').select('*').order('full_name', { ascending: true });
                return retry.data || [];
            }
            return [];
        }
        return data || [];
    },

    async create(profile: Omit<Profile, 'id'>): Promise<Profile | null> {
        const { data, error } = await supabase
            .from('profiles')
            .insert([{ ...profile, is_approved: false }])
            .select()
            .single();

        if (error) {
            console.error('Error creating profile:', error);
            throw new Error(`[${error.code}] ${error.message}`);
        }
        return data;
    },

    async update(id: string, profile: Partial<Profile>): Promise<Profile | null> {
        const { data, error } = await supabase
            .from('profiles')
            .update(profile)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating profile:', error.message, '| Code:', error.code, '| Details:', error.details, '| Hint:', error.hint);
            throw new Error(`[${error.code}] ${error.message} \n(Details: ${error.details || 'N/A'})`);
        }
        return data;
    },

    async delete(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting profile:', error);
            return false;
        }
        return true;
    }
};
