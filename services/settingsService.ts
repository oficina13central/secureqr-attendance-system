import { supabase } from './supabaseClient';

export interface AttendanceRules {
    en_horario: number;
    llego_tarde: number;
    max_mensual: number;
    ausente_gracia: number;
}

export const settingsService = {
    async getRules(): Promise<AttendanceRules> {
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'attendance_rules')
            .single();

        if (error || !data) {
            console.error('Error fetching settings:', error);
            return { en_horario: 5, llego_tarde: 30, max_mensual: 15, ausente_gracia: 120 };
        }
        return { ...data.value, ausente_gracia: data.value.ausente_gracia || 120 };
    },

    async updateRules(rules: AttendanceRules): Promise<boolean> {
        const { error } = await supabase
            .from('system_settings')
            .update({ value: rules, updated_at: new Date().toISOString() })
            .eq('key', 'attendance_rules');

        if (error) {
            console.error('Error updating settings:', error);
            return false;
        }
        return true;
    }
};
