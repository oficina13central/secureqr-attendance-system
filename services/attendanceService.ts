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

        let activeSchedule = scheduleData;
        
        if (!activeSchedule) {
            const { data: profile } = await supabase.from('profiles').select('default_schedule').eq('id', employeeId).maybeSingle();
            if (profile?.default_schedule) {
                const metadata = profile.default_schedule.metadata;
                if (!metadata?.valid_from || date >= metadata.valid_from) {
                    const base = profile.default_schedule[now.getDay().toString()];
                    if (base) {
                        activeSchedule = { type: base.type, segments: base.segments };
                    }
                }
            }
        }

        const scheduleType = activeSchedule?.type || 'continuous';

        if (scheduleType === 'off') throw new Error('off_day');
        if (scheduleType === 'vacation') throw new Error('vacation');

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

        if (activeSchedule && activeSchedule.segments && activeSchedule.segments.length > 0) {
            const segmentIndex = validEntriesCount;
            const targetSegment = activeSchedule.segments[segmentIndex] || activeSchedule.segments[0];
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

                    let activeSchedule = schedule;
                    if (!activeSchedule && emp.default_schedule) {
                        const metadata = emp.default_schedule.metadata;
                        if (!metadata?.valid_from || dateStr >= metadata.valid_from) {
                            const base = emp.default_schedule[checkDate.getDay().toString()];
                            if (base) activeSchedule = { type: base.type } as any;
                        }
                    }

                    let status: 'ausente' | 'descanso' | 'vacaciones' | null = null;
                    if (activeSchedule) {
                        status = activeSchedule.type === 'off' ? 'descanso' : 
                                 activeSchedule.type === 'vacation' ? 'vacaciones' : 'ausente';
                    }
                    if (status) await this.recordAbsence(emp.id, emp.full_name, dateStr, status as any);
                }
            }
        }
    },

    async resolveEmployeeId(id: string, name: string): Promise<string | null> {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(id)) {
            const { data: exists } = await supabase.from('profiles').select('id').eq('id', id).maybeSingle();
            if (exists) return id;
        }
        if (id && id !== 'PENDING') {
            const { data: byDni } = await supabase.from('profiles').select('id').eq('dni', id).maybeSingle();
            if (byDni) return byDni.id;
        }
        const { data } = await supabase.from('profiles').select('id').ilike('full_name', name).maybeSingle();
        return data?.id || null;
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
            const resolvedId = await this.resolveEmployeeId(employeeId, employeeName);
            if (!resolvedId) return { type: 'error', record: null, reason: 'user_not_found' };

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
            if (err.message === 'off_day') return { type: 'error', record: null, reason: 'off_day' };
            if (err.message === 'vacation') return { type: 'error', record: null, reason: 'vacation' };
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
            // Obtener reglas y perfil primero
            const [rules, { data: profile }] = await Promise.all([
                settingsService.getRules(),
                supabase.from('profiles').select('full_name, default_schedule').eq('id', employeeId).maybeSingle()
            ]);
            
            const defaultSchedule = profile?.default_schedule;
            
            // Obtener todos los registros y cronogramas del periodo
            const { data: records, error: recordsError } = await supabase
                .from('attendance_records')
                .select('*')
                .eq('employee_id', employeeId)
                .gte('date', startDate)
                .lte('date', endDate);

            if (recordsError) throw recordsError;

            const { data: schedules, error: schedError } = await supabase
                .from('schedules')
                .select('date, type, segments')
                .eq('employee_id', employeeId)
                .gte('date', startDate)
                .lte('date', endDate);

            if (schedError) throw schedError;

            // Generar lista de fechas
            const start = new Date(`${startDate}T12:00:00`);
            const end = new Date(`${endDate}T12:00:00`);
            const dates: string[] = [];
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                dates.push(getLocalDateString(new Date(d)));
            }

            for (const dateStr of dates) {
                const dateObj = new Date(`${dateStr}T12:00:00`);
                let schedule = schedules?.find(s => s.date === dateStr);
                
                if (!schedule && defaultSchedule) {
                    const metadata = defaultSchedule.metadata;
                    if (!metadata?.valid_from || dateStr >= metadata.valid_from) {
                        const base = defaultSchedule[dateObj.getDay().toString()];
                        if (base) schedule = { date: dateStr, type: base.type, segments: base.segments } as any;
                    }
                }

                if (!schedule) continue;

                const dayRecords = records?.filter(r => r.date === dateStr) || [];
                
                if (dayRecords.length === 0) {
                    // No hay registro, crear uno de Ausente/Descanso/Vacaciones
                    // Solo si la fecha es en el pasado o hoy
                    if (dateStr <= getLocalDateString()) {
                        const status = schedule.type === 'off' ? 'descanso' : 
                                     schedule.type === 'vacation' ? 'vacaciones' : 'ausente';
                        
                        const { error: insertError } = await supabase
                            .from('attendance_records')
                            .insert([{
                                id: crypto.randomUUID(),
                                employee_id: employeeId,
                                employee_name: profile?.full_name || 'Empleado',
                                date: dateStr,
                                check_in: null,
                                check_out: null,
                                status: status,
                                minutes_late: 0
                            }]);
                        
                        if (insertError) errorCount++;
                        else updatedCount++;
                    }
                } else {
                    // Hay registros, actualizar si no son manuales
                    for (const record of dayRecords) {
                        if (record.status === 'manual') continue;

                        let newStatus = record.status;
                        let newMinutesLate = record.minutes_late;

                        if (record.check_in && schedule.segments && schedule.segments.length > 0) {
                            const checkInDate = new Date(record.check_in);
                            const firstSegment = schedule.segments[0];
                            const [schedHours, schedMins] = firstSegment.start.split(':').map(Number);
                            
                            // Ajustar fecha del cronograma al día del registro
                            const scheduledTime = new Date(checkInDate);
                            scheduledTime.setHours(schedHours, schedMins, 0, 0);
                            
                            // Lógica básica para turnos nocturnos: si la marca es antes de las 6 AM y el turno empieza tarde noche
                            // podríamos estar ante una marca del turno que empezó el día anterior.
                            // Pero para recálculo mensual simplificamos: comparamos con el horario del día del registro.
                            
                            const diffInMinutes = Math.floor((checkInDate.getTime() - scheduledTime.getTime()) / (1000 * 60));
                            
                            // Si la diferencia es muy grande negativa (ej: entró a las 00:05 para un turno de las 22:00 del día anterior)
                            // el record.date debería ser el del día que empezó el turno. 
                            // Aquí asumimos que el record.date es correcto.
                            
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
                }
            }

            await auditService.logAction({
                manager_name: managerName,
                employee_name: profile?.full_name || 'Empleado Desconocido',
                action: 'Recálculo de Asistencia',
                old_value: 'N/A',
                new_value: `Periodo: ${startDate} al ${endDate}`,
                reason: 'Ajuste masivo por cambio de cronograma'
            });

            return { updated: updatedCount, errors: errorCount };
        } catch (err) {
            console.error('Error en recalculateAttendance:', err);
            return { updated: updatedCount, errors: 1 };
        }
    },

    async calculateScoring(employeeId: string): Promise<{ score: number, category: number, label: string, color: string }> {
        const now = new Date();
        const pastDate = new Date();
        pastDate.setDate(now.getDate() - 90);
        const startDate = getLocalDateString(pastDate);
        const endDate = getLocalDateString(now);

        const { data: records, error } = await supabase
            .from('attendance_records')
            .select('date, status, minutes_late')
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
                medicalPenalty += (20 * weight); // Descuento base por licencia médica
            } else {
                let penalty = record.status === 'ausente' ? 250 : record.status === 'sin_presentismo' ? 100 : 20;

                // Penalización acumulativa por minutos
                if ((record.status === 'tarde' || record.status === 'sin_presentismo') && record.minutes_late) {
                    penalty += record.minutes_late; // 1 punto extra por cada minuto de retraso
                }

                totalPenalty += (penalty * weight);
            }
        }

        if (medicalPenalty > 100) {
            medicalPenalty = 100;
        }

        totalPenalty += medicalPenalty;

        finalScore = Math.max(0, Math.min(999, 999 - Math.round(totalPenalty)));
        let category = 1, label = '', color = '';
        if (finalScore === 999) { category = 0; label = 'Clase 0 (Altamente Puntual)'; color = 'bg-indigo-100 text-indigo-700 border-indigo-200'; }
        else if (finalScore >= 950) { category = 1; label = 'Clase 1 (Excelente)'; color = 'bg-emerald-100 text-emerald-700 border-emerald-200'; }
        else if (finalScore >= 750) { category = 2; label = 'Clase 2 (Estable)'; color = 'bg-amber-100 text-amber-700 border-amber-300'; }
        else if (finalScore >= 500) { category = 3; label = 'Clase 3 (Regular)'; color = 'bg-orange-100 text-orange-700 border-orange-300'; }
        else if (finalScore >= 250) { category = 4; label = 'Clase 4 (Alerta)'; color = 'bg-rose-100 text-rose-700 border-rose-300'; }
        else { category = 5; label = 'Clase 5 (Crónica)'; color = 'bg-slate-800 text-rose-400 border-rose-900 shadow-inner'; }

        return { score: finalScore, category, label, color };
    }
};
