import { supabase } from './supabaseClient';
import { CompensatoryRestLog, Holiday } from '../types';
import { getLocalDateString } from '../utils/dateUtils';

const hasDatePassed = (date: string): boolean => date < getLocalDateString();

const addAutomaticCreditIfMissing = async (
  employeeId: string,
  date: string,
  reason: string,
  managerName: string
): Promise<boolean> => {
  const { data } = await supabase
    .from('compensatory_rest_ledger')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('amount', 1)
    .eq('type', 'credit')
    .ilike('reason', `%(${date})`)
    .limit(1);

  if (data && data.length > 0) return false;

  const { error } = await supabase
    .from('compensatory_rest_ledger')
    .insert([{
      employee_id: employeeId,
      amount: 1,
      type: 'credit',
      reason,
      manager_name: managerName
    }]);

  return !error;
};

const hasWorkedOnDate = async (employeeId: string, date: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('date', date)
    .not('check_in', 'is', null)
    .limit(1);

  if (error) {
    console.error('Error checking compensatory rest attendance evidence:', error);
    return false;
  }

  return (data || []).length > 0;
};

export const compensatoryRestService = {
  async getBalance(employeeId: string): Promise<number> {
    const { data, error } = await supabase
      .from('profiles')
      .select('compensatory_rest_balance')
      .eq('id', employeeId)
      .single();

    if (error) return 0;
    return data.compensatory_rest_balance || 0;
  },

  async getLogs(employeeId: string): Promise<CompensatoryRestLog[]> {
    const { data, error } = await supabase
      .from('compensatory_rest_ledger')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    return data || [];
  },

  async addLog(log: Omit<CompensatoryRestLog, 'id' | 'created_at'>): Promise<boolean> {
    const { error } = await supabase
      .from('compensatory_rest_ledger')
      .insert([log]);

    return !error;
  },

  async getHolidays(): Promise<Holiday[]> {
    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .order('date', { ascending: true });
    return data || [];
  },

  async addHoliday(date: string, name: string): Promise<boolean> {
    const { error } = await supabase
      .from('holidays')
      .insert([{ date, name }]);
    return !error;
  },

  async deleteHoliday(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('holidays')
      .delete()
      .eq('id', id);
    return !error;
  },

  async processAutomaticCredit(
    employeeId: string,
    date: string,
    shiftType: string,
    segments: any[],
    managerName: string = 'System Auto'
  ): Promise<boolean> {
    if (shiftType === 'off' || shiftType === 'compensatory' || shiftType === 'suspension') return false;

    const { data: emp } = await supabase
      .from('profiles')
      .select('employment_type')
      .eq('id', employeeId)
      .single();
    if (emp?.employment_type === 'jornalero') return false;

    const holidays = await this.getHolidays();
    const holidayDates = holidays.map(h => h.date);

    const d = new Date(date + 'T12:00:00');
    const isSunday = d.getDay() === 0;
    const isHoliday = holidayDates.includes(date);

    if (!isSunday && !isHoliday) {
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);
      const nextDayStr = getLocalDateString(nextDay);
      const isNextDayRestricted = nextDay.getDay() === 0 || holidayDates.includes(nextDayStr);

      if (isNextDayRestricted && segments && segments.length > 0) {
        if (!hasDatePassed(nextDayStr)) return false;
        if (!(await hasWorkedOnDate(employeeId, date))) return false;

        const lastSegment = segments[segments.length - 1];
        if (lastSegment.end) {
          const [h] = lastSegment.end.split(':').map(Number);
          if (h >= 3) {
            const [sh] = lastSegment.start.split(':').map(Number);
            if (h < sh || h >= 3) {
              const reason = `Credito automatico: Jornada nocturna hacia ${isNextDayRestricted ? 'Domingo/Feriado' : 'descanso'} (${nextDayStr})`;
              return addAutomaticCreditIfMissing(employeeId, nextDayStr, reason, managerName);
            }
          }
        }
      }
      return false;
    }

    if (!hasDatePassed(date)) return false;
    if (!(await hasWorkedOnDate(employeeId, date))) return false;

    if (segments && segments.length > 0) {
      const firstSegment = segments[0];
      const [sh] = firstSegment.start.split(':').map(Number);

      if (sh >= 19) return false;

      const reason = `Credito automatico: Trabajo en ${isHoliday ? 'Feriado' : 'Domingo'} (${date})`;
      return addAutomaticCreditIfMissing(employeeId, date, reason, managerName);
    }

    return false;
  },

  async syncAutomaticCreditsForSchedules(
    schedules: Array<{ employee_id: string; date: string; type: string; segments: any[] }>,
    managerName: string = 'System Auto'
  ): Promise<number> {
    let created = 0;

    for (const schedule of schedules) {
      const didCreate = await this.processAutomaticCredit(
        schedule.employee_id,
        schedule.date,
        schedule.type,
        schedule.segments || [],
        managerName
      );

      if (didCreate) created++;
    }

    return created;
  },

  async payRestDays(employeeId: string, amount: number, managerName: string, reason: string): Promise<boolean> {
    return this.addLog({
      employee_id: employeeId,
      amount: -Math.abs(amount),
      type: 'payment',
      reason: reason || 'Liquidacion de francos compensatorios',
      manager_name: managerName
    });
  },

  async adjustBalance(employeeId: string, finalBalance: number, managerName: string, reason: string): Promise<boolean> {
    const current = await this.getBalance(employeeId);
    const diff = finalBalance - current;
    if (diff === 0) return true;

    return this.addLog({
      employee_id: employeeId,
      amount: diff,
      type: 'adjustment',
      reason: reason || 'Ajuste manual de saldo',
      manager_name: managerName
    });
  }
};
