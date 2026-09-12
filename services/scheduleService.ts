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

export interface ScheduleDayConfig {
    type: ShiftType;
    segments: ShiftSegment[];
}

export interface ScheduleHistoryEntry {
    valid_from?: string | null; // YYYY-MM-DD
    valid_until: string;        // YYYY-MM-DD
    schedule: Record<string, ScheduleDayConfig>; // '0'..'6'
    archived_at?: string;
}

export interface DefaultScheduleData {
    '0'?: ScheduleDayConfig;
    '1'?: ScheduleDayConfig;
    '2'?: ScheduleDayConfig;
    '3'?: ScheduleDayConfig;
    '4'?: ScheduleDayConfig;
    '5'?: ScheduleDayConfig;
    '6'?: ScheduleDayConfig;
    metadata?: {
        valid_from?: string;
        updated_at?: string;
    };
    history?: ScheduleHistoryEntry[];
    [key: string]: any;
}

/**
 * Normaliza una fecha (Date o string YYYY-MM-DD) y obtiene dateStr y dayOfWeek (0-6)
 */
export function normalizeDateAndDow(date: Date | string): { dateStr: string; dow: string } {
    if (typeof date === 'string') {
        const dateStr = date.substring(0, 10);
        const [y, m, d] = dateStr.split('-').map(Number);
        const targetDateObj = new Date(y, m - 1, d, 12, 0, 0);
        return { dateStr, dow: targetDateObj.getDay().toString() };
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return { dateStr: `${year}-${month}-${day}`, dow: date.getDay().toString() };
}

/**
 * Resuelve el horario base (habitual) que le correspondía al empleado para una fecha dada,
 * respetando el historial de cambios y fechas de vigencia.
 */
export function resolveDefaultScheduleForDate(
    defaultSchedule: any,
    date: Date | string
): ScheduleDayConfig | null {
    if (!defaultSchedule) return null;

    const { dateStr, dow } = normalizeDateAndDow(date);
    const currentValidFrom = defaultSchedule.metadata?.valid_from;

    // 1. Si no tiene fecha de vigencia o la fecha consultada es >= a la vigencia actual
    if (!currentValidFrom || dateStr >= currentValidFrom) {
        const base = defaultSchedule[dow];
        if (base) return { type: base.type, segments: base.segments || [] };
        return null;
    }

    // 2. La fecha es anterior a la vigencia actual: buscar en el historial
    const history: ScheduleHistoryEntry[] = Array.isArray(defaultSchedule.history) ? defaultSchedule.history : [];

    // Buscar entrada cuyo rango cubra dateStr
    const exactMatches = history.filter(h => {
        const matchUntil = !h.valid_until || dateStr <= h.valid_until;
        const matchFrom = !h.valid_from || dateStr >= h.valid_from;
        return matchUntil && matchFrom;
    });

    if (exactMatches.length > 0) {
        // Tomar la más cercana / reciente según valid_until
        exactMatches.sort((b, a) => (a.valid_until || '').localeCompare(b.valid_until || ''));
        const matched = exactMatches[0].schedule?.[dow];
        if (matched) return { type: matched.type, segments: matched.segments || [] };
    }

    // Si no hubo coincidencia exacta en rango pero hay historial, buscar el bloque histórico que abarque
    if (history.length > 0) {
        const sorted = [...history].sort((a, b) => (a.valid_until || '').localeCompare(b.valid_until || ''));
        const candidate = sorted.find(h => !h.valid_until || h.valid_until >= dateStr) || sorted[0];
        const matched = candidate?.schedule?.[dow];
        if (matched) return { type: matched.type, segments: matched.segments || [] };
    }

    // 3. Fallback para datos preexistentes que no tenían historial registrado
    const base = defaultSchedule[dow];
    if (base) return { type: base.type, segments: base.segments || [] };
    return null;
}

/**
 * Prepara el nuevo default_schedule archivando el horario previo en el historial
 * con fecha de finalización = día anterior a newValidFrom.
 */
export function buildUpdatedDefaultSchedule(
    currentSchedule: any,
    newDaysConfig: Record<string, ScheduleDayConfig>,
    newValidFrom: string
): DefaultScheduleData {
    const [y, m, d] = newValidFrom.split('-').map(Number);
    const prevDate = new Date(y, m - 1, d - 1, 12, 0, 0);
    const prevYear = prevDate.getFullYear();
    const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');
    const prevDay = String(prevDate.getDate()).padStart(2, '0');
    const validUntilStr = `${prevYear}-${prevMonth}-${prevDay}`;

    const existingHistory: ScheduleHistoryEntry[] = Array.isArray(currentSchedule?.history)
        ? [...currentSchedule.history]
        : [];

    // Extraer días del horario previo si existía
    const prevDays: Record<string, ScheduleDayConfig> = {};
    let hasPrevDays = false;
    ['0', '1', '2', '3', '4', '5', '6'].forEach(day => {
        if (currentSchedule?.[day]) {
            prevDays[day] = {
                type: currentSchedule[day].type,
                segments: currentSchedule[day].segments || []
            };
            hasPrevDays = true;
        }
    });

    if (hasPrevDays) {
        const prevValidFrom = currentSchedule?.metadata?.valid_from || null;
        if (!prevValidFrom || prevValidFrom < newValidFrom) {
            existingHistory.push({
                valid_from: prevValidFrom,
                valid_until: validUntilStr,
                schedule: prevDays,
                archived_at: new Date().toISOString()
            });
        }
    }

    // Ordenar historial por valid_until ascendente
    existingHistory.sort((a, b) => (a.valid_until || '').localeCompare(b.valid_until || ''));

    const result: DefaultScheduleData = {
        ...newDaysConfig,
        metadata: {
            valid_from: newValidFrom,
            updated_at: new Date().toISOString()
        },
        history: existingHistory
    };

    return result;
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
