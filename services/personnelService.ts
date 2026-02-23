import { supabase } from './supabaseClient';
import { Profile } from '../types';

export const personnelService = {
    async getAll(): Promise<Profile[]> {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('full_name', { ascending: true });

        if (error) {
            console.error('Error fetching profiles:', error);
            return [];
        }
        return data || [];
    },

    async create(profile: Omit<Profile, 'id'>): Promise<Profile | null> {
        const { data, error } = await supabase
            .from('profiles')
            .insert([profile])
            .select()
            .single();

        if (error) {
            console.error('Error creating profile:', error);
            return null;
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
            console.error('Error updating profile:', error);
            return null;
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
