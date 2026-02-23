import { supabase } from './supabaseClient';
import { AttendanceRecord, Profile } from '../types';
import { settingsService } from './settingsService';
import { getLocalDateString } from '../utils/dateUtils';

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

        // 1. Consultar el cronograma para el tipo de horario y hora de entrada
        const { data: scheduleData } = await supabase
            .from('schedules')
            .select('type, segments')
            .eq('employee_id', employeeId)
            .eq('date', date)
            .single();

        const scheduleType = scheduleData?.type || 'continuous';

        // 2. Obtener registros ya existentes hoy para validar límites y detectar placeholders
        // Usamos solo el ID ya que processScan garantiza que es válido.
        const { data: existingToday, error: fetchError } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('date', date)
            .eq('employee_id', employeeId);

        if (fetchError) {
            console.error('Error fetching existing records:', fetchError);
            return null;
        }

        console.log(`Búsqueda para ${employeeName} (${employeeId}):`, existingToday);

        // Priorizar el registro que coincide por ID, luego por nombre
        const validEntries = (existingToday || []).filter(r => r.check_in !== null);
        const validEntriesCount = validEntries.length;

        const placeholderRecord = (existingToday || []).find(r => r.check_in === null);

        console.log(`validEntriesCount: ${validEntriesCount}, placeholderRecord: ${placeholderRecord ? 'SÍ' : 'NO'}`);

        // 3. Validar duplicados según tipo de horario
        if (scheduleType === 'continuous' && validEntriesCount >= 1) {
            console.warn(`Check-in bloqueado: ${employeeName} ya tiene una entrada hoy.`);
            return null;
        }

        if (scheduleType === 'split' && validEntriesCount >= 2) {
            console.warn(`Check-in bloqueado: ${employeeName} ya tiene dos entradas hoy.`);
            return null;
        }

        // 4. Lógica de Detección de Tardanza y Presentismo (Dinámica)
        let status: 'en_horario' | 'tarde' | 'sin_presentismo' = 'en_horario';
        let minutesLate = 0;

        // Obtener reglas de la base de datos
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

            if (minutesLate > rules.llego_tarde) {
                status = 'sin_presentismo';
            } else if (minutesLate > rules.en_horario) {
                status = 'tarde';
            } else {
                status = 'en_horario';
            }
        }

        if (placeholderRecord) {
            // ACTUALIZAR Placeholder existente (y sincronizar ID/Nombre por si acaso)
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

            if (error) {
                console.error('Error updating placeholder record:', error);
                return null;
            }
            return data;
        } else {
            // INSERTAR nuevo registro
            const { data, error } = await supabase
                .from('attendance_records')
                .insert([
                    {
                        id: crypto.randomUUID(),
                        employee_id: employeeId,
                        employee_name: employeeName,
                        date: date,
                        check_in: nowIso,
                        status: status,
                        minutes_late: minutesLate
                    }
                ])
                .select()
                .single();

            if (error) {
                console.error('Error recording check-in:', error);
                return null;
            }
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

        if (error) {
            console.error('Error recording check-out:', error);
            return null;
        }
        return data;
    },

    async recordAbsence(employeeId: string, employeeName: string, date: string, status: 'ausente' | 'descanso'): Promise<AttendanceRecord | null> {
        const { data, error } = await supabase
            .from('attendance_records')
            .insert([
                {
                    id: crypto.randomUUID(),
                    employee_id: employeeId,
                    employee_name: employeeName,
                    date: date,
                    check_in: null,
                    check_out: null,
                    status: status,
                    minutes_late: 0
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error recording absence:', error);
            return null;
        }
        return data;
    },

    async syncPastAbsences(employees: Profile[]): Promise<void> {
        const today = new Date();
        // Revisar los últimos 3 días por simplicidad/performance en este demo
        for (let i = 1; i <= 3; i++) {
            const checkDate = new Date();
            checkDate.setDate(today.getDate() - i);
            const dateStr = getLocalDateString(checkDate);
            const isSunday = checkDate.getDay() === 0;

            // 1. Obtener registros existentes para esa fecha
            const { data: existingToday } = await supabase
                .from('attendance_records')
                .select('employee_id, employee_name')
                .eq('date', dateStr);

            const recordedEmpIds = new Set((existingToday || []).map(r => r.employee_id));
            const recordedNames = new Set((existingToday || []).map(r => r.employee_name));

            // 2. Para cada empleado que no tenga registro
            for (const emp of employees) {
                // Verificar por ID y por Nombre para evitar duplicados si la columna ID falló antes
                if (!recordedEmpIds.has(emp.id) && !recordedNames.has(emp.full_name)) {
                    // 3. Consultar horario para esa fecha
                    const { data: schedule } = await supabase
                        .from('schedules')
                        .select('type')
                        .eq('employee_id', emp.id)
                        .eq('date', dateStr)
                        .single();

                    let status: 'ausente' | 'descanso' | null = null;

                    if (schedule) {
                        status = schedule.type === 'off' ? 'descanso' : 'ausente';
                    } else if (isSunday) {
                        status = 'descanso';
                    } else {
                        status = 'ausente'; // Opcional: si no hay horario, ¿se considera ausente? 
                    }

                    if (status) {
                        await this.recordAbsence(emp.id, emp.full_name, dateStr, status);
                    }
                }
            }
        }
    },

    async resolveEmployeeId(id: string, name: string): Promise<string | null> {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        // 1. Si es un UUID válido, verificar que el usuario exista
        if (uuidRegex.test(id)) {
            const { data: exists } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', id)
                .maybeSingle();

            if (exists) return id;
            console.warn(`UUID ${id} no encontrado en perfiles. Intentando recuperar por nombre...`);
        }

        // 2. Si no es UUID o no se encontró, buscar por nombre (Case Insensitive)
        console.log(`Resolving by name: ${name}`);
        const { data } = await supabase
            .from('profiles')
            .select('id')
            .ilike('full_name', name)
            .maybeSingle();

        return data?.id || null;
    },

    async processScan(employeeId: string, employeeName: string): Promise<{ type: 'in' | 'out' | 'error', record: AttendanceRecord | null, reason?: string }> {
        const resolvedId = await this.resolveEmployeeId(employeeId, employeeName);

        if (!resolvedId) {
            console.error(`Could not resolve valid UUID for employee: ${employeeName}`);
            return { type: 'error', record: null, reason: 'user_not_found' };
        }

        const today = getLocalDateString();

        // 1. Buscar si hay un registro abierto hoy (con entrada pero sin salida)
        const { data: openRecord, error: fetchError } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('employee_id', resolvedId)
            .eq('date', today)
            .not('check_in', 'is', null) // Debe tener una entrada real
            .is('check_out', null)
            .order('check_in', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (fetchError) {
            console.error('Error searching open record:', fetchError);
            return { type: 'error', record: null, reason: 'server_error' };
        }

        if (openRecord) {
            // Verificar periodo de gracia: No permitir salida si pasaron menos de 10 minutos
            const checkInTime = new Date(openRecord.check_in!).getTime();
            const nowTime = new Date().getTime();
            const elapsedMinutes = (nowTime - checkInTime) / (1000 * 60);

            if (elapsedMinutes < 10) {
                console.warn(`Escaneo bloqueado: ${employeeName} intentó marcar salida demasiado pronto (${Math.round(elapsedMinutes)} min).`);
                return { type: 'error', record: null, reason: 'check_out_too_soon' };
            }

            // Registrar SALIDA
            const result = await this.recordCheckOut(openRecord.id);
            return { type: 'out', record: result, reason: 'check_out_success' };
        } else {
            // Intentar registrar ENTRADA
            // Usamos el ID resuelto
            const result = await this.recordCheckIn(resolvedId, employeeName);
            if (result) {
                return { type: 'in', record: result, reason: 'check_in_success' };
            } else {
                return { type: 'error', record: null, reason: 'daily_limit_reached' };
            }
        }
    }
};
