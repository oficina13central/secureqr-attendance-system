import { supabase } from './supabaseClient';
import { Profile } from '../types';

export const personnelService = {
    async getAll(includeArchived = false): Promise<Profile[]> {
        let query = supabase
            .from('profiles')
            .select('*')
            .or('is_employee.eq.true,is_employee.is.null')
            .order('full_name', { ascending: true });

        if (!includeArchived) {
            query = query.is('deleted_at', null);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching profiles:', error);
            if (error.code === '42703') {
                let retryQuery = supabase.from('profiles').select('*').order('full_name', { ascending: true });
                if (!includeArchived) retryQuery = retryQuery.is('deleted_at', null);
                const retry = await retryQuery;
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

    async archive(id: string, reason: string): Promise<Profile | null> {
        return this.update(id, {
            deleted_at: new Date().toISOString(),
            is_suspended: true,
            suspended_until: null,
            suspended_reason: `Baja archivada: ${reason}`
        });
    },

    async restore(id: string): Promise<Profile | null> {
        return this.update(id, {
            deleted_at: null,
            is_suspended: false,
            suspended_until: null,
            suspended_reason: null
        });
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
