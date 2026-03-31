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
        if (profile.is_approved === false) return 'pending';
        if (!profile.is_suspended) return 'active';
        if (profile.suspended_until) {
            if (new Date(profile.suspended_until) > new Date()) return 'suspended_temp';
            return 'active'; // Temporary suspension expired
        }
        return 'suspended'; // Permanent suspension
    },
};
