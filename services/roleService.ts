import { supabase } from './supabaseClient';
import { Role, Permission } from '../types';

export const roleService = {
    async getAllRoles(): Promise<Role[]> {
        const { data, error } = await supabase
            .from('roles')
            .select('*');

        if (error) {
            console.error('Error fetching roles:', error);
            return [];
        }
        return data || [];
    },

    async getAllPermissions(): Promise<Permission[]> {
        const { data, error } = await supabase
            .from('permissions')
            .select('*')
            .order('category', { ascending: true });

        if (error) {
            console.error('Error fetching permissions:', error);
            return [];
        }
        return data || [];
    },

    async getRolePermissions(roleId: string): Promise<string[]> {
        const { data, error } = await supabase
            .from('role_permissions')
            .select('permission_id')
            .eq('role_id', roleId);

        if (error) {
            console.error('Error fetching role permissions:', error);
            return [];
        }
        return data.map(rp => rp.permission_id);
    },

    async updateRolePermissions(roleId: string, permissionIds: string[]) {
        // Simple strategy: delete all and re-insert
        const { error: deleteError } = await supabase
            .from('role_permissions')
            .delete()
            .eq('role_id', roleId);

        if (deleteError) throw deleteError;

        if (permissionIds.length > 0) {
            const inserts = permissionIds.map(pid => ({
                role_id: roleId,
                permission_id: pid
            }));
            const { error: insertError } = await supabase
                .from('role_permissions')
                .insert(inserts);

            if (insertError) throw insertError;
        }
    },

    async createRole(role: Omit<Role, 'id'>) {
        const { data, error } = await supabase
            .from('roles')
            .insert([role])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateRole(id: string, role: Partial<Role>) {
        const { data, error } = await supabase
            .from('roles')
            .update(role)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};
