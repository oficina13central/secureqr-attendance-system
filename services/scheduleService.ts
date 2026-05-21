import { supabase } from './supabaseClient';

export interface ShiftSegment {
    start: string;
    end: string;
}

export type ShiftType = 'continuous' | 'split' | 'double' | 'off' | 'vacation' | 'medical' | 'compensatory' | 'suspension';

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

    async getAllSchedulesInRange(startDate: string, endDate?: string): Promise<ShiftData[]> {
        let allSchedules: ShiftData[] = [];
        let page = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
            let query = supabase
                .from('schedules')
                .select('*')
                .gte('date', startDate)
                .range(page * limit, (page + 1) * limit - 1);
            
            if (endDate) {
                query = query.lte('date', endDate);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching paginated schedules:', error);
                break;
            }

            if (data && data.length > 0) {
                allSchedules = [...allSchedules, ...data];
                page++;
                if (data.length < limit) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }
        return allSchedules;
    },

    async save(shifts: ShiftData | ShiftData[]): Promise<(ShiftData | null)[] | ShiftData | null> {
        const shiftsToSave = Array.isArray(shifts) ? shifts : [shifts];
        const { data, error } = await supabase
            .from('schedules')
            .upsert(shiftsToSave)
            .select();

        if (error) {
            console.error('Error saving schedule(s):', error);
            throw error;
        }

        if (!data || data.length !== shiftsToSave.length) {
            throw new Error('No se pudo confirmar el guardado del cronograma.');
        }

        return Array.isArray(shifts) ? data : data[0];
    }
};
