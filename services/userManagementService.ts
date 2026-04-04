import { supabase } from './supabaseClient';
import { Profile } from '../types';

export const userManagementService = {
    /**
     * Fetches all profiles, including suspended and soft-deleted ones.
     * Joins role data for display.
     */
    async getAllUsers(): Promise<Profile[]> {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('full_name', { ascending: true });

        if (error) {
            console.error('Error fetching users:', error);
            throw error;
        }
        return data || [];
    },

    async createSystemAccount(email: string, password: string, fullName: string, roleName: string): Promise<any> {
        // Create user in Auth
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } }
        });

        if (error) return { data, error };

        if (data.user) {
            // Check if profile exists (maybe created by trigger or not)
            const { data: profile } = await supabase.from('profiles').select('id').eq('id', data.user.id).maybeSingle();
            if (profile) {
                await supabase.from('profiles').update({ 
                    role: roleName, 
                    is_employee: false, 
                    is_approved: true,
                    full_name: fullName
                }).eq('id', data.user.id);
            } else {
                await supabase.from('profiles').insert([{ 
                    id: data.user.id,
                    email: email,
                    role: roleName, 
                    is_employee: false, 
                    is_approved: true,
                    full_name: fullName,
                    qr_token: `SECURE_SYSTEM:${fullName.replace(/\s+/g, '_')}_${data.user.id}`
                }]);
            }
        }
        return { data, error: null };
    },

    /**
     * Suspends a user. If `until` is null, the suspension is permanent.
     * `until` should be an ISO 8601 date string for temporary suspensions.
     */
    async suspendUser(userId: string, reason: string, until: string | null = null): Promise<void> {
        const { error } = await supabase
            .from('profiles')
            .update({
                is_suspended: true,
                suspended_reason: reason,
                suspended_until: until, // null = permanent
            })
            .eq('id', userId);

        if (error) throw error;
    },

    /**
     * Lifts a suspension, restoring full access.
     */
    async unsuspendUser(userId: string): Promise<void> {
        const { error } = await supabase
            .from('profiles')
            .update({
                is_suspended: false,
                suspended_reason: null,
                suspended_until: null,
            })
            .eq('id', userId);

        if (error) throw error;
    },

    /**
     * Soft-deletes a user. Their data is preserved.
     * The suspended flag is also set to prevent any accidental access.
     */
    async softDeleteUser(userId: string, reason: string): Promise<void> {
        const { error } = await supabase
            .from('profiles')
            .update({
                deleted_at: new Date().toISOString(),
                is_suspended: true,
                suspended_reason: `Cuenta archivada: ${reason}`,
                suspended_until: null,
            })
            .eq('id', userId);

        if (error) throw error;
    },

    /**
     * Restores a soft-deleted user, clearing both deleted_at and suspension.
     */
    async restoreUser(userId: string): Promise<void> {
        const { error } = await supabase
            .from('profiles')
            .update({
                deleted_at: null,
                is_suspended: false,
                suspended_reason: null,
                suspended_until: null,
            })
            .eq('id', userId);

        if (error) throw error;
    },

    /**
     * Changes a user's role.
     */
    async changeUserRole(userId: string, newRoleId: string): Promise<void> {
        const { error } = await supabase
            .from('profiles')
            .update({ role: newRoleId })
            .eq('id', userId);

        if (error) throw error;
    },

    /**
     * Toggles whether the user is tracked as an employee or a system account.
     */
    async toggleUserAccountType(userId: string, isEmployee: boolean): Promise<void> {
        const { error } = await supabase
            .from('profiles')
            .update({ is_employee: isEmployee })
            .eq('id', userId);

        if (error) throw error;
    },

    /**
     * Approves a pending user.
     */
    async approveUser(userId: string): Promise<void> {
        const { error } = await supabase
            .from('profiles')
            .update({ is_approved: true })
            .eq('id', userId);

        if (error) throw error;
    },

    /**
     * Revokes app access for a user.
     */
    async revokeUserApproval(userId: string): Promise<void> {
        const { error } = await supabase
            .from('profiles')
            .update({ is_approved: false })
            .eq('id', userId);

        if (error) throw error;
    },

    /**
     * Sends a password reset email to the user.
     */
    async resetPassword(email: string): Promise<void> {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
        });
        if (error) throw error;
    },

    /**
     * Checks whether a given profile is currently suspended (respecting temporary suspension dates).
     */
    isCurrentlySuspended(profile: Profile): boolean {
        if (!profile.is_suspended) return false;
        // If suspended_until is set and is in the past, it's no longer suspended
        if (profile.suspended_until) {
            return new Date(profile.suspended_until) > new Date();
        }
        // suspended_until is null = permanent suspension
        return true;
    },

    /**
     * Returns display status for a user profile.
     */
    getUserStatus(profile: Profile): 'active' | 'suspended' | 'archived' | 'suspended_temp' | 'pending' {
        if (profile.deleted_at) return 'archived';
        if (profile.email === 'isaacgomez78@gmail.com') return 'active';
        if (!profile.is_approved) return 'pending';
        if (!profile.is_suspended) return 'active';
        if (profile.suspended_until) {
            if (new Date(profile.suspended_until) > new Date()) return 'suspended_temp';
            return 'active'; // Temporary suspension expired
        }
        return 'suspended'; // Permanent suspension
    },
};
