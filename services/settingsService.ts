import { supabase } from './supabaseClient';

export interface AttendanceRules {
    en_horario: number;
    llego_tarde: number;
    max_mensual: number;
    ausente_gracia: number;
    enable_compensatory_rest?: boolean;
    weekly_payroll_cutoff_time?: string;
}

const defaultRules: AttendanceRules = {
    en_horario: 5,
    llego_tarde: 30,
    max_mensual: 15,
    ausente_gracia: 120,
    enable_compensatory_rest: false,
    weekly_payroll_cutoff_time: '19:00'
};

export const settingsService = {
    async getRules(): Promise<AttendanceRules> {
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'attendance_rules')
            .single();

        if (error || !data) {
            console.error('Error fetching settings:', error);
            return defaultRules;
        }
        return {
            ...defaultRules,
            ...data.value,
            ausente_gracia: data.value.ausente_gracia || defaultRules.ausente_gracia,
            enable_compensatory_rest: !!data.value.enable_compensatory_rest,
            weekly_payroll_cutoff_time: data.value.weekly_payroll_cutoff_time || defaultRules.weekly_payroll_cutoff_time
        };
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
