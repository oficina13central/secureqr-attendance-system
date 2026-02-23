import { supabase } from './supabaseClient';

export interface ShiftSegment {
    start: string;
    end: string;
}

export type ShiftType = 'continuous' | 'split' | 'off';

export interface ShiftData {
    id: string; // employeeId_dateIso
    employee_id: string;
    date: string; // YYYY-MM-DD
    type: ShiftType;
    segments: ShiftSegment[];
    last_modified_by: string;
    last_modified_at: string;
}

export const scheduleService = {
    async getByWeek(startDate: string, endDate: string): Promise<ShiftData[]> {
        const { data, error } = await supabase
            .from('schedules')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate);

        if (error) {
            console.error('Error fetching schedules:', error);
            return [];
        }
        return data || [];
    },

    async save(shift: ShiftData): Promise<ShiftData | null> {
        const { data, error } = await supabase
            .from('schedules')
            .upsert([shift])
            .select()
            .single();

        if (error) {
            console.error('Error saving schedule:', error);
            return null;
        }
        return data;
    }
};
