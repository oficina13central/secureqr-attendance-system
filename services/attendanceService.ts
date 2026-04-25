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

        // Infer split status if type is missing but there are multiple segments
        const scheduleType = activeSchedule?.type || 
                           ((activeSchedule?.segments?.length || 0) > 1 ? 'split' : 'continuous');

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

    async recordAbsence(employeeId: string, employeeName: string, date: string, status: 'ausente' | 'descanso' | 'vacaciones' | 'licencia_medica'): Promise<AttendanceRecord | null> {
        // Verificar si ya existe algún registro para este empleado en esta fecha
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
        const rules = await settingsService.getRules();
        console.log(`Starting syncPastAbsences for ${employees.length} employees...`);
        
        for (let i = 0; i <= 3; i++) {
            const checkDate = new Date();
            checkDate.setDate(today.getDate() - i);
            const dateStr = getLocalDateString(checkDate);

            if (dateStr <= '2026-04-19') continue;

            const { data: existingToday } = await supabase
                .from('attendance_records')
                .select('employee_id, employee_name, check_in')
                .eq('date', dateStr);

            for (const emp of employees) {
                const employeeRecords = (existingToday || []).filter(r => {
                    const recordEmployeeId = r.employee_id?.toLowerCase().trim();
                    const recordEmployeeName = r.employee_name?.toLowerCase().trim();
                    return recordEmployeeId === emp.id.toLowerCase().trim() || recordEmployeeName === emp.full_name.toLowerCase().trim();
                });
                const completedEntries = employeeRecords.filter(r => r.check_in !== null).length;

                const { data: schedule } = await supabase
                    .from('schedules')
                    .select('type, segments, date')
                    .eq('employee_id', emp.id)
                    .eq('date', dateStr)
                    .maybeSingle();

                let activeSchedule = schedule;
                if (!activeSchedule && emp.default_schedule) {
                    const metadata = emp.default_schedule.metadata;
                    if (!metadata?.valid_from || dateStr >= metadata.valid_from) {
                        const base = emp.default_schedule[checkDate.getDay().toString()];
                        if (base) activeSchedule = { type: base.type, segments: base.segments } as any;
                    }
                }

                if (!activeSchedule || activeSchedule.type === 'off') continue;

                if (i === 0) {
                    const shiftStartStr = activeSchedule.segments?.[0]?.start;
                    if (shiftStartStr) {
                        const [h, m] = shiftStartStr.split(':').map(Number);
                        const shiftStart = new Date(today);
                        shiftStart.setHours(h, m, 0, 0);
                        
                        const gracePeriod = rules.ausente_gracia || 120;
                        const minutesSinceStart = (today.getTime() - shiftStart.getTime()) / 60000;
                        
                        if (minutesSinceStart < gracePeriod) continue;
                    } else if (activeSchedule.type !== 'vacation' && activeSchedule.type !== 'medical') {
                        continue;
                    }
                }

                let status: 'ausente' | 'descanso' | 'vacaciones' | 'licencia_medica' | null = null;
                status = activeSchedule.type === 'vacation' ? 'vacaciones' : 
                         activeSchedule.type === 'medical' ? 'licencia_medica' : 'ausente';

                if (!status) continue;

                if (status !== 'ausente') {
                    if (employeeRecords.length === 0) {
                        await this.recordAbsence(emp.id, emp.full_name, dateStr, status);
                    }
                    continue;
                }

                const requiredEntries = Math.max(activeSchedule.segments?.length || 0, 1);
                const missingEntries = requiredEntries - employeeRecords.length;

                if (completedEntries >= requiredEntries || missingEntries <= 0) continue;

                for (let missingIndex = 0; missingIndex < missingEntries; missingIndex++) {
                    await this.recordAbsence(emp.id, emp.full_name, dateStr, status);
                }
            }
        }
        console.log(`Finished syncPastAbsences.`);
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
                    // Si es turno cortado y la entrada abierta es "vieja" (más de 3 horas), 
                    // permitimos una segunda entrada (segundo segmento).
                    const checkInTime = new Date(openRecord.check_in!).getTime();
                    const now = new Date().getTime();
                    const hoursSinceCheckIn = (now - checkInTime) / (1000 * 60 * 60);

                    // Inferimos tipo de turno para decidir si bloqueamos o no
                    const { data: scheduleData } = await supabase
                        .from('schedules')
                        .select('type, segments')
                        .eq('employee_id', resolvedId)
                        .eq('date', today)
                        .maybeSingle();
                    
                    let activeSchedule = scheduleData;
                    if (!activeSchedule) {
                        const { data: profile } = await supabase.from('profiles').select('default_schedule').eq('id', resolvedId).maybeSingle();
                        const base = profile?.default_schedule?.[new Date().getDay().toString()];
                        if (base) activeSchedule = { type: base.type, segments: base.segments };
                    }

                    const isSplitShift = activeSchedule?.type === 'split' || (activeSchedule?.segments?.length || 0) > 1;

                    if (isSplitShift && hoursSinceCheckIn > 3) {
                        // Es una segunda entrada legítima para un turno cortado
                        console.log(`Permitiendo segunda entrada para ${employeeName} (Turno Cortado detectado)`);
                    } else {
                        return { type: 'error', record: null, reason: 'already_checked_in' };
                    }
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
            throw err;
        }
    },

    async recalculateAttendance(employeeId: string, startDate: string, endDate: string, managerName: string): Promise<{ updated: number, errors: number }> {
        let updatedCount = 0;
        let errorCount = 0;
        try {
            // Fetch records to recalculate
            const { data: records, error: recordsError } = await supabase
                .from('attendance_records')
                .select('*')
                .eq('employee_id', employeeId)
                .gte('date', startDate)
                .lte('date', endDate);

            if (recordsError) throw recordsError;
            if (!records || records.length === 0) return { updated: 0, errors: 0 };

            // Fetch profile for data normalization
            const { data: profile } = await supabase
                .from('profiles')
                .select('id, full_name, dni, default_schedule')
                .eq('id', employeeId)
                .maybeSingle();
            
            if (!profile) return { updated: 0, errors: 0 };
            
            const empIdNormalized = profile.id.toLowerCase().trim();
            const empNameNormalized = (profile.full_name || '').toLowerCase().trim();
            const empDniNormalized = (profile.dni || '').trim();
            const defaultSchedule = profile.default_schedule;

            // Fetch all records for the period - AGGRESSIVE SEARCH (By UUID, Name or DNI)
            const { data: allRecords, error: fetchRecordsError } = await supabase
                .from('attendance_records')
                .select('*')
                .or(`employee_id.eq.${employeeId},employee_name.ilike.%${profile.full_name}%`)
                .gte('date', startDate)
                .lte('date', endDate);

            if (fetchRecordsError) throw fetchRecordsError;
            if (!allRecords || allRecords.length === 0) return { updated: 0, errors: 0 };

            // Fetch schedules for the period
            const { data: schedules, error: schedError } = await supabase
                .from('schedules')
                .select('date, type, segments, employee_id')
                .eq('employee_id', employeeId)
                .gte('date', startDate)
                .lte('date', endDate);

            if (schedError) throw schedError;

            const rules = await settingsService.getRules();

            // Agrupar registros por fecha para manejar correctamente los turnos cortados
            const recordsByDate: Record<string, AttendanceRecord[]> = {};
            allRecords.forEach(r => {
                const d = r.date.split('T')[0];
                if (!recordsByDate[d]) recordsByDate[d] = [];
                recordsByDate[d].push(r);
            });

            for (const recordDateStr in recordsByDate) {
                // Ordenar las fichadas del día cronológicamente
                const dailyRecs = recordsByDate[recordDateStr].sort((a, b) => 
                    (a.check_in || '').localeCompare(b.check_in || '')
                );

                // Buscar el schedule para este día (estrategia multi-llave)
                let activeSchedule = schedules?.find(s => {
                    const sId = (s.employee_id || '').toLowerCase().trim();
                    const sDate = (s.date || '').split('T')[0];
                    return sDate === recordDateStr && (
                        sId === empIdNormalized || 
                        sId === empNameNormalized || 
                        sId === empDniNormalized
                    );
                });
                
                if (!activeSchedule && defaultSchedule) {
                    const dateObj = new Date(`${recordDateStr}T12:00:00`);
                    const dow = dateObj.getDay().toString();
                    const base = defaultSchedule[dow];
                    if (base) {
                        activeSchedule = {
                            type: base.type,
                            segments: base.segments,
                            date: recordDateStr
                        } as any;
                    }
                }

                // Procesar cada registro del día
                for (let i = 0; i < dailyRecs.length; i++) {
                    const record = dailyRecs[i];
                    let newStatus = record.status;
                    let newMinutesLate = record.minutes_late;

                    if (activeSchedule) {
                        if (activeSchedule.type === 'off') {
                            newStatus = 'descanso';
                            newMinutesLate = 0;
                        } else if (activeSchedule.type === 'vacation') {
                            newStatus = 'vacaciones';
                            newMinutesLate = 0;
                        } else if (activeSchedule.type === 'medical') {
                            newStatus = 'licencia_medica';
                            newMinutesLate = 0;
                        } else if (record.check_in && activeSchedule.segments?.[i]) {
                            // Turno laboral: Calcular tardanza usando el segmento correspondiente al índice de la fichada
                            const checkInDate = new Date(record.check_in);
                            const segment = activeSchedule.segments[i];
                            const [sh, sm] = segment.start.split(':').map(Number);
                            
                            const checkInMins = checkInDate.getHours() * 60 + checkInDate.getMinutes();
                            const schedMins = sh * 60 + sm;
                            
                            let diffInMinutes = checkInMins - schedMins;
                            
                            // Lógica de turnos nocturnos
                            if (diffInMinutes < -600) diffInMinutes += 1440;

                            newMinutesLate = diffInMinutes > 0 ? diffInMinutes : 0;
                            if (newMinutesLate > rules.llego_tarde) newStatus = 'sin_presentismo';
                            else if (newMinutesLate > rules.en_horario) newStatus = 'tarde';
                            else newStatus = 'en_horario';
                        } else if (!record.check_in) {
                            // Sin fichada registrada
                            let shouldDelete = false;
                            
                            // Si es hoy, revisar si la ausencia fue prematura y debe ser borrada
                            const todayStr = getLocalDateString();
                            if (record.date === todayStr && activeSchedule.segments?.[0]) {
                                const [sh, sm] = activeSchedule.segments[0].start.split(':').map(Number);
                                const shiftStart = new Date();
                                shiftStart.setHours(sh, sm, 0, 0);
                                const minutesSinceStart = (Date.now() - shiftStart.getTime()) / 60000;
                                const gracePeriod = rules.ausente_gracia || 120;
                                
                                if (minutesSinceStart < gracePeriod) {
                                    shouldDelete = true;
                                }
                            }

                            if (shouldDelete) {
                                await supabase.from('attendance_records').delete().eq('id', record.id);
                                continue;
                            } else {
                                newStatus = 'ausente';
                                newMinutesLate = 0;
                            }
                        }
                    }

                    if (newStatus !== record.status || newMinutesLate !== record.minutes_late) {
                        const { error: updateError } = await supabase
                            .from('attendance_records')
                            .update({ 
                                status: newStatus, 
                                minutes_late: newMinutesLate
                            })
                            .eq('id', record.id);
                        
                        if (updateError) errorCount++;
                        else updatedCount++;
                    }
                }
            }

            // Skip audit logging for bulk recalculation to avoid DB errors
            return { updated: updatedCount, errors: errorCount };
        } catch (err) {
            console.error('Error in recalculateAttendance:', err);
            return { updated: updatedCount, errors: errorCount + 1 };
        }
    },

    async updateRecord(id: string, updates: Partial<AttendanceRecord>): Promise<boolean> {
        const { error } = await supabase
            .from('attendance_records')
            .update({
                ...updates
            })
            .eq('id', id);

        if (error) {
            console.error('Error updating attendance record:', error);
            return false;
        }
        return true;
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
            // Ignorar penalidades antes de la fecha de inicio oficial (20 de Abril 2026)
            if (record.date <= '2026-04-19') continue;

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
        if (finalScore >= 950) { category = 1; label = 'Clase 1 (Normal)'; color = 'bg-emerald-100 text-emerald-700 border-emerald-200'; }
        else if (finalScore >= 750) { category = 2; label = 'Clase 2 (Estable)'; color = 'bg-amber-100 text-amber-700 border-amber-300'; }
        else if (finalScore >= 500) { category = 3; label = 'Clase 3 (Regular)'; color = 'bg-orange-100 text-orange-700 border-orange-300'; }
        else if (finalScore >= 250) { category = 4; label = 'Clase 4 (Alerta)'; color = 'bg-rose-100 text-rose-700 border-rose-300'; }
        else { category = 5; label = 'Clase 5 (Crónica)'; color = 'bg-slate-800 text-rose-400 border-rose-900 shadow-inner'; }

        return { score: finalScore, category, label, color };
    }
};
