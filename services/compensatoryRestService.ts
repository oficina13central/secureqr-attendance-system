import { supabase } from './supabaseClient';
import { CompensatoryRestLog, Holiday } from '../types';

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

  // Holiday Management
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

  /**
   * AUTOMATIC CREDIT LOGIC (Rule of Gold)
   * 1. Checks if the shift qualifies as "Restricted Day Work" (Sunday or Holiday)
   * 2. Applies the 3h margin for Sat-Sun/Eve-Holiday transitions
   * 3. Applies the 19:00 exception
   */
  async processAutomaticCredit(
    employeeId: string, 
    date: string, 
    shiftType: string, 
    segments: any[], 
    managerName: string = 'System Auto'
  ): Promise<void> {
    if (shiftType === 'off' || shiftType === 'compensatory' || shiftType === 'suspension') return;

    // JORNALEROS EXCEPTION: They don't accumulate rest days as they are paid daily
    const { data: emp } = await supabase.from('profiles').select('employment_type').eq('id', employeeId).single();
    if (emp?.employment_type === 'jornalero') return;

    const holidays = await this.getHolidays();
    const holidayDates = holidays.map(h => h.date);
    
    const d = new Date(date + 'T12:00:00'); // Central time to avoid TZ issues
    const isSunday = d.getDay() === 0;
    const isHoliday = holidayDates.includes(date);

    if (!isSunday && !isHoliday) {
      // Check if it's a Saturday/Eve shift that ends 3h into a Restricted Day
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      const isNextDayRestricted = nextDay.getDay() === 0 || holidayDates.includes(nextDayStr);

      if (isNextDayRestricted && segments && segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        if (lastSegment.end) {
          const [h, m] = lastSegment.end.split(':').map(Number);
          // If ends at 03:00 or later, it qualifies for the 3h margin rule
          if (h >= 3 || (h === 0 && m === 0 && false)) { // h=0 is midnight, handled by 24h logic if needed
             // Special case for midnight: if end < start, it's next day
             const [sh] = lastSegment.start.split(':').map(Number);
             if (h < sh || h >= 3) {
               await this.addLog({
                 employee_id: employeeId,
                 amount: 1,
                 type: 'credit',
                 reason: `Crédito automático: Jornada nocturna hacia ${isNextDayRestricted ? 'Domingo/Feriado' : 'descanso'}`,
                 manager_name: managerName
               });
             }
          }
        }
      }
      return;
    }

    // It IS a Restricted Day (Sunday or Holiday)
    if (segments && segments.length > 0) {
      const firstSegment = segments[0];
      const [sh] = firstSegment.start.split(':').map(Number);

      // Exception: If starts after 19:00, no credit
      if (sh >= 19) return;

      await this.addLog({
        employee_id: employeeId,
        amount: 1,
        type: 'credit',
        reason: `Crédito automático: Trabajo en ${isHoliday ? 'Feriado' : 'Domingo'} (${date})`,
        manager_name: managerName
      });
    }
  },

  // Manual Adjustments & Payments
  async payRestDays(employeeId: string, amount: number, managerName: string, reason: string): Promise<boolean> {
    return this.addLog({
      employee_id: employeeId,
      amount: -Math.abs(amount),
      type: 'payment',
      reason: reason || 'Liquidación de francos compensatorios',
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
