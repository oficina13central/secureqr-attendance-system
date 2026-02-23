import { supabase } from './supabaseClient';
import { AuditLog } from '../types';

export const auditService = {
    async getAll(): Promise<AuditLog[]> {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) {
            console.error('Error fetching audit logs:', error);
            return [];
        }
        return data || [];
    },

    async logAction(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog | null> {
        const { data, error } = await supabase
            .from('audit_logs')
            .insert([log])
            .select()
            .single();

        if (error) {
            console.error('Error creating audit log:', error);
            return null;
        }
        return data;
    }
};
