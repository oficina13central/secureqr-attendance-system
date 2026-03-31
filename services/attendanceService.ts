import { supabase } from './supabaseClient';
import { AttendanceRecord, Profile } from '../types';
import { settingsService } from './settingsService';
import { auditService } from './auditService';
import { getLocalDateString } from '../utils/dateUtils';
import { offlineService } from './offlineService';

export const attendanceService = {
    async getByDate(date: string): Promise<AttendanceRecord[]> {
        const { data, error } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('date', date);

        if (error) {
            console.error('Error fetching attendance records:', error);
            return [];
        }
        return data || [];
    },

    async getByDateRange(startDate: string, endDate: string): Promise<AttendanceRecord[]> {
        const { data, error } = await supabase
            .from('attendance_records')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate);

        if (error) {
            console.error('Error fetching attendance records by range:', error);
            return [];
        }
        return data || [];
    },

    async getAll(): Promise<AttendanceRecord[]> {
        const { data, error } = await supabase
            .from('attendance_records')
            .select('*')
            .order('date', { ascending: false })
            .order('check_in', { ascending: false });

        if (error) {
            console.error('Error fetching all attendance records:', error);
            return [];
        }
        return data || [];
    },

    async getTodayStats(): Promise<{ presentes: number, tardes: number, ausentes: number }> {
        const today = getLocalDateString();
        const { data, error } = await supabase
            .from('attendance_records')
            .select('status')
            .eq('date', today);

        if (error) {
            console.error('Error fetching today stats:', error);
            return { presentes: 0, tardes: 0, ausentes: 0 };
        }

        const stats = (data || []).reduce((acc, curr) => {
            if (curr.status === 'en_horario' || curr.status === 'presente' || curr.status === 'manual' || curr.status === 'sin_presentismo') acc.presentes++;
            else if (curr.status === 'tarde') acc.tardes++;
            else if (curr.status === 'ausente') acc.ausentes++;
            return acc;
        }, { presentes: 0, tardes: 0, ausentes: 0 });

        return stats;
    },

    async recordCheckIn(employeeId: string, employeeName: string): Promise<AttendanceRecord | null> {
        const now = new Date();
        const nowIso = now.toISOString();
        const date = getLocalDateString(now);

        const { data: scheduleData } = await supabase
            .from('schedules')
            .select('type, segments')
            .eq('employee_id', employeeId)
            .eq('date', date)
            .single();

        const scheduleType = scheduleData?.type || 'continuous';

        const { data: existingToday, error: fetchError } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('date', date)
            .eq('employee_id', employeeId);

        if (fetchError) {
            console.error('Error fetching existing records:', fetchError);
            return null;
        }

        const validEntries = (existingToday || []).filter(r => r.check_in !== null);
        const validEntriesCount = validEntries.length;
        const placeholderRecord = (existingToday || []).find(r => r.check_in === null);

        if (scheduleType === 'continuous' && validEntriesCount >= 1) return null;
        if (scheduleType === 'split' && validEntriesCount >= 2) return null;

        let status: 'en_horario' | 'tarde' | 'sin_presentismo' = 'en_horario';
        let minutesLate = 0;
        const rules = await settingsService.getRules();

        if (scheduleData && scheduleData.segments && scheduleData.segments.length > 0) {
            const segmentIndex = validEntriesCount;
            const targetSegment = scheduleData.segments[segmentIndex] || scheduleData.segments[0];
            const scheduledStart = targetSegment.start;
            const [schedHours, schedMins] = scheduledStart.split(':').map(Number);
            const scheduledTime = new Date(now);
            scheduledTime.setHours(schedHours, schedMins, 0, 0);

            const diffInMinutes = Math.floor((now.getTime() - scheduledTime.getTime()) / (1000 * 60));
            minutesLate = diffInMinutes > 0 ? diffInMinutes : 0;

            if (minutesLate > rules.llego_tarde) status = 'sin_presentismo';
            else if (minutesLate > rules.en_horario) status = 'tarde';
            else status = 'en_horario';
        }

        if (placeholderRecord) {
            const { data, error } = await supabase
                .from('attendance_records')
                .update({
                    employee_id: employeeId,
                    employee_name: employeeName,
                    check_in: nowIso,
                    status: status,
                    minutes_late: minutesLate
                })
                .eq('id', placeholderRecord.id)
                .select()
                .single();
            if (error) return null;
            return data;
        } else {
            const { data, error } = await supabase
                .from('attendance_records')
                .insert([{
                    id: crypto.randomUUID(),
                    employee_id: employeeId,
                    employee_name: employeeName,
                    date: date,
                    check_in: nowIso,
                    status: status,
                    minutes_late: minutesLate
                }])
                .select()
                .single();
            if (error) return null;
            return data;
        }
    },

    async recordCheckOut(recordId: string): Promise<AttendanceRecord | null> {
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('attendance_records')
            .update({ check_out: now })
            .eq('id', recordId)
            .select()
            .single();
        if (error) return null;
        return data;
    },

    async recordAbsence(employeeId: string, employeeName: string, date: string, status: 'ausente' | 'descanso' | 'vacaciones'): Promise<AttendanceRecord | null> {
        const { data, error } = await supabase
            .from('attendance_records')
            .insert([{
                id: crypto.randomUUID(),
                employee_id: employeeId,
                employee_name: employeeName,
                date: date,
                check_in: null,
                check_out: null,
                status: status,
                minutes_late: 0
            }])
            .select()
            .single();
        if (error) return null;
        return data;
    },

    async syncPastAbsences(employees: Profile[]): Promise<void> {
        const today = new Date();
        for (let i = 1; i <= 3; i++) {
            const checkDate = new Date();
            checkDate.setDate(today.getDate() - i);
            const dateStr = getLocalDateString(checkDate);

            const { data: existingToday } = await supabase
                .from('attendance_records')
                .select('employee_id, employee_name')
                .eq('date', dateStr);

            const recordedEmpIds = new Set((existingToday || []).map(r => r.employee_id));
            const recordedNames = new Set((existingToday || []).map(r => r.employee_name));

            for (const emp of employees) {
                if (!recordedEmpIds.has(emp.id) && !recordedNames.has(emp.full_name)) {
                    const { data: schedule } = await supabase
                        .from('schedules')
                        .select('type')
                        .eq('employee_id', emp.id)
                        .eq('date', dateStr)
                        .single();

                    let status: 'ausente' | 'descanso' | 'vacaciones' | null = null;
                    if (schedule) {
                        status = schedule.type === 'off' ? 'descanso' : 
                                 schedule.type === 'vacation' ? 'vacaciones' : 'ausente';
                    }
                    if (status) await this.recordAbsence(emp.id, emp.full_name, dateStr, status as any);
                }
            }
        }
    },

    async resolveEmployeeId(id: string, name: string): Promise<{id: string, is_approved: boolean} | null> {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(id)) {
            const { data: exists } = await supabase.from('profiles').select('id, is_approved').eq('id', id).maybeSingle();
            if (exists) return { id, is_approved: exists.is_approved };
        }
        if (id && id !== 'PENDING') {
            const { data: byDni } = await supabase.from('profiles').select('id, is_approved').eq('dni', id).maybeSingle();
            if (byDni) return { id: byDni.id, is_approved: byDni.is_approved };
        }
        const { data } = await supabase.from('profiles').select('id, is_approved').ilike('full_name', name).maybeSingle();
        return data ? { id: data.id, is_approved: data.is_approved } : null;
    },

    async syncOfflineRecords(): Promise<{ success: number, failed: number }> {
        const queue = offlineService.getQueue();
        if (queue.length === 0) return { success: 0, failed: 0 };
        let successCount = 0;
        let failedCount = 0;
        for (const scan of queue) {
            try {
                const result = await this.processScan(scan.employeeId, scan.employeeName);
                if (result.type !== 'error') {
                    offlineService.removeScan(scan.id);
                    successCount++;
                } else {
                    failedCount++;
                }
            } catch (err) {
                failedCount++;
            }
        }
        return { success: successCount, failed: failedCount };
    },

    async processScan(employeeId: string, employeeName: string, enforcedMode?: 'in' | 'out'): Promise<{ type: 'in' | 'out' | 'error' | 'queued', record: AttendanceRecord | null, reason?: string }> {
        try {
            const resolved = await this.resolveEmployeeId(employeeId, employeeName);
            if (!resolved) return { type: 'error', record: null, reason: 'user_not_found' };
            if (resolved.is_approved === false) return { type: 'error', record: null, reason: 'not_approved' };
            
            const resolvedId = resolved.id;

            const today = getLocalDateString();
            
            // 1. Buscar si hay un registro abierto hoy
            const { data: openRecord, error: fetchError } = await supabase
                .from('attendance_records')
                .select('*')
                .eq('employee_id', resolvedId)
                .eq('date', today)
                .not('check_in', 'is', null)
                .is('check_out', null)
                .order('check_in', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (fetchError) throw fetchError;

            // MODO ENFORZADO: ENTRADA
            if (enforcedMode === 'in') {
                if (openRecord) {
                    return { type: 'error', record: null, reason: 'already_checked_in' };
                }
                const result = await this.recordCheckIn(resolvedId, employeeName);
                if (result) return { type: 'in', record: result, reason: 'check_in_success' };
                else return { type: 'error', record: null, reason: 'daily_limit_reached' };
            }

            // MODO ENFORZADO: SALIDA
            if (enforcedMode === 'out') {
                if (!openRecord) {
                    return { type: 'error', record: null, reason: 'no_open_record' };
                }
                const result = await this.recordCheckOut(openRecord.id);
                return { type: 'out', record: result, reason: 'check_out_success' };
            }

            // MODO AUTOMÁTICO (Fallback o Legacy)
            if (openRecord) {
                const result = await this.recordCheckOut(openRecord.id);
                return { type: 'out', record: result, reason: 'check_out_success' };
            } else {
                const result = await this.recordCheckIn(resolvedId, employeeName);
                if (result) return { type: 'in', record: result, reason: 'check_in_success' };
                else return { type: 'error', record: null, reason: 'daily_limit_reached' };
            }
        } catch (err: any) {
            console.error("Network error during scan:", err);
            if (err.message?.includes('fetch') || !navigator.onLine || err.status === 0 || err.code === 'PGRST100') {
                offlineService.queueScan(employeeId, employeeName);
                return { type: 'queued', record: null, reason: 'queued_offline' };
            }
            return { type: 'error', record: null, reason: 'server_error' };
        }
    },

    async recalculateAttendance(employeeId: string, startDate: string, endDate: string, managerName: string): Promise<{ updated: number, errors: number }> {
        let updatedCount = 0;
        let errorCount = 0;
        try {
            const { data: records, error: recordsError } = await supabase
                .from('attendance_records')
                .select('*')
                .eq('employee_id', employeeId)
                .gte('date', startDate)
                .lte('date', endDate)
                .not('status', 'eq', 'manual');

            if (recordsError) throw recordsError;
            if (!records || records.length === 0) return { updated: 0, errors: 0 };

            const { data: schedules, error: schedError } = await supabase
                .from('schedules')
                .select('date, type, segments')
                .eq('employee_id', employeeId)
                .gte('date', startDate)
                .lte('date', endDate);

            if (schedError) throw schedError;
            const rules = await settingsService.getRules();

            for (const record of records) {
                const schedule = schedules?.find(s => s.date === record.date);
                if (!schedule) continue;
                let newStatus = record.status;
                let newMinutesLate = record.minutes_late;

                if (record.check_in && schedule.segments && schedule.segments.length > 0) {
                    const checkInDate = new Date(record.check_in);
                    const firstSegment = schedule.segments[0];
                    const [schedHours, schedMins] = firstSegment.start.split(':').map(Number);
                    const scheduledTime = new Date(checkInDate);
                    scheduledTime.setHours(schedHours, schedMins, 0, 0);
                    const diffInMinutes = Math.floor((checkInDate.getTime() - scheduledTime.getTime()) / (1000 * 60));
                    newMinutesLate = diffInMinutes > 0 ? diffInMinutes : 0;
                    if (newMinutesLate > rules.llego_tarde) newStatus = 'sin_presentismo';
                    else if (newMinutesLate > rules.en_horario) newStatus = 'tarde';
                    else newStatus = 'en_horario';
                } else if (!record.check_in) {
                    newStatus = schedule.type === 'off' ? 'descanso' : 
                               schedule.type === 'vacation' ? 'vacaciones' : 'ausente';
                }

                if (newStatus !== record.status || newMinutesLate !== record.minutes_late) {
                    const { error: updateError } = await supabase
                        .from('attendance_records')
                        .update({ status: newStatus, minutes_late: newMinutesLate })
                        .eq('id', record.id);
                    if (updateError) errorCount++;
                    else updatedCount++;
                }
            }

            const { data: empData } = await supabase.from('profiles').select('full_name').eq('id', employeeId).single();
            await auditService.logAction({
                manager_name: managerName,
                employee_name: empData?.full_name || 'Empleado Desconocido',
                action: 'Recálculo de Asistencia',
                old_value: 'N/A',
                new_value: `Periodo: ${startDate} al ${endDate}`,
                reason: 'Ajuste masivo por cambio de cronograma'
            });

            return { updated: updatedCount, errors: errorCount };
        } catch (err) {
            return { updated: updatedCount, errors: 1 };
        }
    },

    async calculateVerazScore(employeeId: string): Promise<{ score: number, category: number, label: string, color: string }> {
        const now = new Date();
        const pastDate = new Date();
        pastDate.setDate(now.getDate() - 90);
        const startDate = getLocalDateString(pastDate);
        const endDate = getLocalDateString(now);

        const { data: records, error } = await supabase
            .from('attendance_records')
            .select('date, status')
            .eq('employee_id', employeeId)
            .gte('date', startDate)
            .lte('date', endDate);

        let finalScore = 999;
        if (error || !records || records.length === 0) return { score: 999, category: 1, label: 'Clase 1 (Normal)', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };

        let totalPenalty = 0;
        let medicalPenalty = 0;
        
        for (const record of records) {
            if (record.status === 'en_horario' || record.status === 'manual' || record.status === 'presente' || record.status === 'descanso' || record.status === 'vacaciones') continue;
            
            const rDate = new Date(`${record.date}T12:00:00`);
            const diffDays = Math.ceil(Math.abs(now.getTime() - rDate.getTime()) / (1000 * 60 * 60 * 24));
            let weight = diffDays <= 30 ? 1.0 : diffDays <= 60 ? 0.6 : diffDays <= 90 ? 0.3 : 0;
            if (weight === 0) continue;

            if (record.status === 'licencia_medica') {
                medicalPenalty += (10 * weight); // Descuento base por licencia médica (equivale a una llegada tarde)
            } else {
                let penalty = record.status === 'ausente' ? 50 : record.status === 'sin_presentismo' ? 20 : 10;
                totalPenalty += (penalty * weight);
            }
        }

        // Aplicar la Regla de "Tope por Evento" (Opción A) para licencias médicas
        // El máximo impacto negativo de una licencia será 50 puntos (el equivalente a 1 sola ausencia injustificada).
        if (medicalPenalty > 50) {
            medicalPenalty = 50;
        }

        totalPenalty += medicalPenalty;

        finalScore = Math.max(0, Math.min(999, 999 - Math.round(totalPenalty)));
        let category = 1, label = '', color = '';
        if (finalScore >= 850) { category = 1; label = 'Clase 1 (Asistencia Perfecta)'; color = 'bg-emerald-100 text-emerald-700 border-emerald-200'; }
        else if (finalScore >= 700) { category = 2; label = 'Clase 2 (Asistencia Mejorable)'; color = 'bg-amber-100 text-amber-700 border-amber-300'; }
        else if (finalScore >= 500) { category = 3; label = 'Clase 3 (Asistencia Deficiente)'; color = 'bg-orange-100 text-orange-700 border-orange-300'; }
        else if (finalScore >= 300) { category = 4; label = 'Clase 4 (Llegador tarde Crónico)'; color = 'bg-rose-100 text-rose-700 border-rose-300'; }
        else { category = 5; label = 'Clase 5 (Irrecuperable)'; color = 'bg-slate-800 text-rose-400 border-rose-900 shadow-inner'; }

        return { score: finalScore, category, label, color };
    }
};
