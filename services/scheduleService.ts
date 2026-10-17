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
 * Normaliza la configuración de un día para garantizar que los segmentos coincidan con el tipo de turno.
 * Evita que turnos 'continuous' conserven un segundo segmento residual (ej. 16:00-20:00) de un turno 'split' previo.
 */
export function sanitizeScheduleDayConfig(dayConfig: any): ScheduleDayConfig {
    if (!dayConfig || typeof dayConfig !== 'object') {
        return { type: 'off', segments: [] };
    }
    const type: ShiftType = dayConfig.type || 'off';
    const rawSegments: ShiftSegment[] = Array.isArray(dayConfig.segments) ? dayConfig.segments : [];

    if (type === 'continuous') {
        const first = rawSegments[0] || { start: '08:00', end: '16:00' };
        return {
            type: 'continuous',
            segments: [{ start: first.start || '08:00', end: first.end || '16:00' }]
        };
    }

    if (type === 'split' || type === 'double') {
        const first = rawSegments[0] || { start: '08:00', end: '12:00' };
        const second = rawSegments[1] || { start: '16:00', end: '20:00' };
        return {
            type,
            segments: [
                { start: first.start || '08:00', end: first.end || '12:00' },
                { start: second.start || '16:00', end: second.end || '20:00' }
            ]
        };
    }

    return {
        type,
        segments: []
    };
}

function sanitizeShiftRow<T extends { type?: ShiftType; segments?: ShiftSegment[] }>(row: T): T {
    if (!row) return row;
    const clean = sanitizeScheduleDayConfig({ type: row.type, segments: row.segments });
    return { ...row, type: clean.type, segments: clean.segments };
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
        if (base) return sanitizeScheduleDayConfig(base);
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
        if (matched) return sanitizeScheduleDayConfig(matched);
    }

    // Si no hubo coincidencia exacta en rango pero hay historial, buscar el bloque histórico que abarque
    if (history.length > 0) {
        const sorted = [...history].sort((a, b) => (a.valid_until || '').localeCompare(b.valid_until || ''));
        const candidate = sorted.find(h => !h.valid_until || h.valid_until >= dateStr) || sorted[0];
        const matched = candidate?.schedule?.[dow];
        if (matched) return sanitizeScheduleDayConfig(matched);
    }

    // 3. Fallback solo para horarios legacy sin valid_from definido.
    // Si valid_from está definido y la fecha es anterior a él, el horario no existía aún → retornar null.
    // Esto evita que se generen ausencias automáticas para períodos previos a la asignación del horario.
    if (!currentValidFrom) {
        const base = defaultSchedule[dow];
        if (base) return sanitizeScheduleDayConfig(base);
    }
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

    const rawHistory: ScheduleHistoryEntry[] = Array.isArray(currentSchedule?.history)
        ? [...currentSchedule.history]
        : [];

    // Limpiar entradas de historial que queden superpuestas por la nueva fecha de vigencia
    // y sanitizar los días de cada entrada histórica
    const existingHistory: ScheduleHistoryEntry[] = rawHistory
        .filter(h => !h.valid_from || h.valid_from < newValidFrom)
        .map(h => {
            const cleanSched: Record<string, ScheduleDayConfig> = {};
            ['0', '1', '2', '3', '4', '5', '6'].forEach(day => {
                if (h.schedule?.[day]) {
                    cleanSched[day] = sanitizeScheduleDayConfig(h.schedule[day]);
                }
            });
            const cappedUntil = (!h.valid_until || h.valid_until >= newValidFrom) ? validUntilStr : h.valid_until;
            return {
                ...h,
                valid_until: cappedUntil,
                schedule: cleanSched
            };
        });

    // Extraer días del horario previo si existía (sanitizados)
    const prevDays: Record<string, ScheduleDayConfig> = {};
    let hasPrevDays = false;
    ['0', '1', '2', '3', '4', '5', '6'].forEach(day => {
        if (currentSchedule?.[day]) {
            prevDays[day] = sanitizeScheduleDayConfig(currentSchedule[day]);
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

    // Sanitizar nueva configuración de días 0..6
    const cleanNewDaysConfig: Record<string, ScheduleDayConfig> = {};
    ['0', '1', '2', '3', '4', '5', '6'].forEach(day => {
        cleanNewDaysConfig[day] = sanitizeScheduleDayConfig(newDaysConfig[day]);
    });

    const result: DefaultScheduleData = {
        ...cleanNewDaysConfig,
        metadata: {
            valid_from: newValidFrom,
            updated_at: new Date().toISOString()
        },
        history: existingHistory
    };

    return result;
}

/** Id canónico de una fila de `schedules`: `${employee_id}_${YYYY-MM-DD}` */
export const getCanonicalScheduleId = (employeeId: string, date: string) =>
    `${employeeId}_${(date || '').substring(0, 10)}`;

/**
 * Elige UNA fila de schedules para un empleado+fecha de forma consistente en toda la app.
 * Prioridad: 1) id canónico, 2) employee_id == UUID, 3) alias legacy (nombre/DNI).
 * Esto garantiza que el Cronograma, la Auditoría y la generación de ausencias vean el mismo horario.
 */
export function pickScheduleRow<T extends { id?: string; employee_id?: string; date?: string }>(
    rows: T[] | null | undefined,
    employeeId: string,
    date: string,
    aliases: (string | null | undefined)[] = []
): T | undefined {
    if (!rows || rows.length === 0) return undefined;
    const dateStr = (date || '').substring(0, 10);
    const idLow = (employeeId || '').toLowerCase().trim();
    const canonicalLow = getCanonicalScheduleId(idLow, dateStr);
    const sameDay = rows.filter(r => (r.date || '').substring(0, 10) === dateStr);

    const byCanonical = sameDay.find(r => (r.id || '').toLowerCase().trim() === canonicalLow);
    if (byCanonical) return sanitizeShiftRow(byCanonical as any) as T;

    const byId = sameDay.find(r => (r.employee_id || '').toLowerCase().trim() === idLow);
    if (byId) return sanitizeShiftRow(byId as any) as T;

    const aliasSet = new Set(aliases.map(a => (a || '').toLowerCase().trim()).filter(Boolean));
    if (aliasSet.size === 0) return undefined;
    const byAlias = sameDay.find(r => aliasSet.has((r.employee_id || '').toLowerCase().trim()));
    return byAlias ? (sanitizeShiftRow(byAlias as any) as T) : undefined;
}

export const scheduleService = {
    /** Obtiene el horario especial (override) de un empleado para una fecha, tolerando filas duplicadas. */
    async getForEmployeeDate(employeeId: string, date: string): Promise<{ type: ShiftType; segments: ShiftSegment[] } | null> {
        const { data, error } = await supabase
            .from('schedules')
            .select('id, employee_id, date, type, segments')
            .eq('employee_id', employeeId)
            .eq('date', date);
        if (error) {
            console.error('Error fetching schedule for employee/date:', error);
            return null;
        }
        const row = pickScheduleRow(data as any[], employeeId, date);
        return row ? sanitizeScheduleDayConfig({ type: row.type, segments: row.segments || [] }) : null;
    },

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
        return (data || []).map(row => sanitizeShiftRow(row));
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
                allSchedules = [...allSchedules, ...data.map(row => sanitizeShiftRow(row))];
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
        const rawList = Array.isArray(shifts) ? shifts : [shifts];
        const shiftsToSave = rawList.map(s => sanitizeShiftRow(s));
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

        // Limpiar filas "fantasma" del mismo empleado+fecha con id distinto (ej. tras migración de perfil)
        for (const s of shiftsToSave) {
            if (!s.employee_id || !s.date || !s.id) continue;
            const { error: cleanupError } = await supabase
                .from('schedules')
                .delete()
                .eq('employee_id', s.employee_id)
                .eq('date', s.date.substring(0, 10))
                .neq('id', s.id);
            if (cleanupError) console.warn('No se pudieron limpiar horarios duplicados:', cleanupError);
        }

        const sanitizedData = data.map(row => sanitizeShiftRow(row));
        return Array.isArray(shifts) ? sanitizedData : sanitizedData[0];
    },

    /**
     * Limpia las excepciones de turnos ordinarios ('continuous', 'split', 'double', 'off') en `schedules`
     * a partir de `fromDate` (inclusive) para que el nuevo Horario Habitual se refleje en el Cronograma,
     * preservando licencias/novedades especiales ('vacation', 'medical', 'compensatory', 'suspension').
     */
    async clearWorkShiftOverridesFromDate(employeeId: string, fromDate: string): Promise<void> {
        if (!employeeId || !fromDate) return;
        const { error } = await supabase
            .from('schedules')
            .delete()
            .eq('employee_id', employeeId)
            .gte('date', fromDate.substring(0, 10))
            .in('type', ['continuous', 'split', 'double', 'off']);
        if (error) {
            console.warn('Error limpiando overrides de turnos previos desde la fecha de vigencia:', error);
        }
    }
};
