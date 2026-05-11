import { supabase } from './supabaseClient';
import { CompensatoryRestLog, Holiday, Profile } from '../types';
import { getLocalDateString } from '../utils/dateUtils';

const hasDatePassed = (date: string): boolean => date < getLocalDateString();

type CompRestShift = {
  employee_id: string;
  date: string;
  type: string;
  segments: any[];
};

export type CompRestSkipReason =
  | 'future_date'
  | 'jornalero'
  | 'not_sunday_or_holiday'
  | 'no_work_shift'
  | 'no_attendance'
  | 'night_shift_not_eligible'
  | 'error';

export type CompRestReconcileDetail = {
  employee_id: string;
  employee_name: string;
  date: string;
  status: 'created' | 'existing' | 'skipped' | 'error';
  reason: string;
};

export type CompRestReconcileSummary = {
  created: number;
  existing: number;
  skipped: Record<CompRestSkipReason, number>;
  errors: number;
  details: CompRestReconcileDetail[];
};

const workShiftTypes = new Set(['continuous', 'split']);

const createEmptySummary = (): CompRestReconcileSummary => ({
  created: 0,
  existing: 0,
  skipped: {
    future_date: 0,
    jornalero: 0,
    not_sunday_or_holiday: 0,
    no_work_shift: 0,
    no_attendance: 0,
    night_shift_not_eligible: 0,
    error: 0
  },
  errors: 0,
  details: []
});

const normalizeIdentity = (value?: string | null): string =>
  (value || '').toLowerCase().trim().replace(/\s+/g, ' ');

const normalizeDate = (value?: string | null): string => (value || '').substring(0, 10);

const addDaysToDateString = (date: string, days: number): string => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
};

const getDatesInRange = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const current = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);

  while (current <= end) {
    dates.push(getLocalDateString(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

const isSundayOrHoliday = (date: string, holidayDates: Set<string>): boolean => {
  const d = new Date(`${date}T12:00:00`);
  return d.getDay() === 0 || holidayDates.has(date);
};

const isNightShiftIntoRestrictedDay = (shift: CompRestShift, creditDate: string): boolean => {
  if (!shift.segments || shift.segments.length === 0) return false;
  const lastSegment = shift.segments[shift.segments.length - 1];
  if (!lastSegment?.start || !lastSegment?.end) return false;

  const [startHour] = lastSegment.start.split(':').map(Number);
  const [endHour] = lastSegment.end.split(':').map(Number);
  if (Number.isNaN(startHour) || Number.isNaN(endHour)) return false;

  return addDaysToDateString(shift.date, 1) === creditDate && startHour >= 19 && endHour < startHour;
};

const getShiftCreditDate = (shift: CompRestShift, holidayDates: Set<string>): string | null => {
  const shiftDate = normalizeDate(shift.date);
  if (!workShiftTypes.has(shift.type) || !shift.segments || shift.segments.length === 0) return null;

  if (isSundayOrHoliday(shiftDate, holidayDates)) {
    const firstSegment = shift.segments[0];
    const [startHour] = (firstSegment?.start || '').split(':').map(Number);
    if (Number.isNaN(startHour) || startHour >= 19) return null;
    return shiftDate;
  }

  const nextDate = addDaysToDateString(shiftDate, 1);
  if (!isSundayOrHoliday(nextDate, holidayDates)) return null;
  return isNightShiftIntoRestrictedDay(shift, nextDate) ? nextDate : null;
};

const matchesEmployee = (
  record: { employee_id?: string | null; employee_name?: string | null },
  employee: Pick<Profile, 'id' | 'full_name' | 'dni'>
): boolean => {
  const validIds = new Set(
    [employee.id, employee.dni]
      .map(normalizeIdentity)
      .filter(Boolean)
  );
  return validIds.has(normalizeIdentity(record.employee_id)) ||
    normalizeIdentity(record.employee_name) === normalizeIdentity(employee.full_name);
};

const fetchPaged = async <T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  label: string
): Promise<T[]> => {
  const rows: T[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await buildQuery(page * pageSize, (page + 1) * pageSize - 1);
    if (error) {
      console.error(`Error fetching ${label}:`, error);
      throw error;
    }

    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    page++;
  }

  return rows;
};

const syncBalanceFromLedger = async (employeeId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('compensatory_rest_ledger')
    .select('amount')
    .eq('employee_id', employeeId);

  if (error) {
    console.error('Error fetching compensatory rest ledger balance:', error);
    return false;
  }

  const balance = (data || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ compensatory_rest_balance: balance })
    .eq('id', employeeId);

  if (updateError) {
    console.error('Error syncing compensatory rest balance:', updateError);
    return false;
  }

  return true;
};

const hasWorkedOnDate = async (
  employeeId: string,
  employeeName: string | null | undefined,
  employeeDni: string | null | undefined,
  date: string
): Promise<boolean> => {
  const nextDate = new Date(`${date}T12:00:00`);
  nextDate.setDate(nextDate.getDate() + 1);
  const nextDateStr = getLocalDateString(nextDate);

  const validIds = new Set(
    [employeeId, employeeDni]
      .map(normalizeIdentity)
      .filter(Boolean)
  );
  const normalizedName = normalizeIdentity(employeeName);

  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('date, employee_id, employee_name')
      .gte('date', date)
      .lt('date', nextDateStr)
      .not('check_in', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error checking compensatory rest attendance evidence:', error);
      return false;
    }

    const hasMatch = (data || []).some(record =>
      record.date?.substring(0, 10) === date &&
      (
        validIds.has(normalizeIdentity(record.employee_id)) ||
        normalizeIdentity(record.employee_name) === normalizedName
      )
    );

    if (hasMatch) return true;
    if (!data || data.length < pageSize) return false;
    page++;
  }
};

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

  if (data && data.length > 0) return syncBalanceFromLedger(employeeId);

  const { error } = await supabase
    .from('compensatory_rest_ledger')
    .insert([{
      employee_id: employeeId,
      amount: 1,
      type: 'credit',
      reason,
      manager_name: managerName
    }]);

  if (error) {
    console.error('Error creating automatic compensatory rest credit:', error);
    return false;
  }

  return syncBalanceFromLedger(employeeId);
};

const buildExistingAutomaticCreditSet = (logs: Array<{ employee_id: string; reason?: string | null }>) => {
  const set = new Set<string>();

  logs.forEach(log => {
    const reason = log.reason || '';
    if (!normalizeIdentity(reason).includes('automatic')) return;

    const match = reason.match(/\((\d{4}-\d{2}-\d{2})\)/);
    if (!match) return;

    set.add(`${log.employee_id}_${match[1]}`);
  });

  return set;
};

const addSkippedDetail = (
  summary: CompRestReconcileSummary,
  employee: Pick<Profile, 'id' | 'full_name'>,
  date: string,
  reason: CompRestSkipReason,
  label: string
) => {
  summary.skipped[reason]++;
  summary.details.push({
    employee_id: employee.id,
    employee_name: employee.full_name,
    date,
    status: reason === 'error' ? 'error' : 'skipped',
    reason: label
  });
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

    if (error) return false;
    return syncBalanceFromLedger(log.employee_id);
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
      .select('employment_type, full_name, dni')
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
        if (!(await hasWorkedOnDate(employeeId, emp?.full_name, emp?.dni, date))) return false;

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
    if (!(await hasWorkedOnDate(employeeId, emp?.full_name, emp?.dni, date))) return false;

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
    if (schedules.length === 0) return 0;

    const dates = schedules.map(s => normalizeDate(s.date)).filter(Boolean).sort();
    const summary = await this.reconcileCompensatoryCredits(
      dates[0],
      dates[dates.length - 1],
      managerName,
      schedules
    );

    return summary.created;
  },

  async reconcileCompensatoryCredits(
    startDate: string,
    endDate: string,
    managerName: string = 'System Auto',
    providedSchedules?: Array<{ employee_id: string; date: string; type: string; segments: any[] }>
  ): Promise<CompRestReconcileSummary> {
    const summary = createEmptySummary();
    const rangeDates = getDatesInRange(startDate, endDate);
    const previousDate = addDaysToDateString(startDate, -1);
    const evaluationDates = [previousDate, ...rangeDates];
    const rangeDateSet = new Set(rangeDates);

    try {
      const [employees, schedules, attendance, holidays, ledgerCredits] = await Promise.all([
        fetchPaged<Profile>(
          (from, to) => supabase
            .from('profiles')
            .select('id, full_name, dni, employment_type, default_schedule')
            .range(from, to),
          'profiles for compensatory rest reconciliation'
        ),
        providedSchedules
          ? Promise.resolve(providedSchedules as CompRestShift[])
          : fetchPaged<CompRestShift>(
              (from, to) => supabase
                .from('schedules')
                .select('employee_id, date, type, segments')
                .gte('date', previousDate)
                .lte('date', endDate)
                .range(from, to),
              'schedules for compensatory rest reconciliation'
            ),
        fetchPaged<{ date: string; employee_id: string | null; employee_name: string | null }>(
          (from, to) => supabase
            .from('attendance_records')
            .select('date, employee_id, employee_name')
            .gte('date', previousDate)
            .lt('date', addDaysToDateString(endDate, 1))
            .not('check_in', 'is', null)
            .range(from, to),
          'attendance evidence for compensatory rest reconciliation'
        ),
        fetchPaged<Holiday>(
          (from, to) => supabase
            .from('holidays')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate)
            .range(from, to),
          'holidays for compensatory rest reconciliation'
        ),
        fetchPaged<{ employee_id: string; reason: string | null }>(
          (from, to) => supabase
            .from('compensatory_rest_ledger')
            .select('employee_id, reason')
            .eq('amount', 1)
            .eq('type', 'credit')
            .range(from, to),
          'compensatory rest ledger credits'
        )
      ]);

      const scheduleMap = new Map<string, CompRestShift>();
      schedules.forEach(shift => {
        const date = normalizeDate(shift.date);
        if (!date || !evaluationDates.includes(date)) return;
        scheduleMap.set(`${shift.employee_id}_${date}`, { ...shift, date, segments: shift.segments || [] });
      });

      const holidayDates = new Set(holidays.map(h => normalizeDate(h.date)).filter(Boolean));
      const existingCredits = buildExistingAutomaticCreditSet(ledgerCredits);
      const affectedEmployees = new Set<string>();
      const attendanceByDate = new Map<string, typeof attendance>();
      attendance.forEach(record => {
        const date = normalizeDate(record.date);
        if (!evaluationDates.includes(date)) return;
        const bucket = attendanceByDate.get(date) || [];
        bucket.push(record);
        attendanceByDate.set(date, bucket);
      });

      for (const employee of employees) {
        for (const date of evaluationDates) {
          const explicitShift = scheduleMap.get(`${employee.id}_${date}`);
          const base = employee.default_schedule?.[new Date(`${date}T12:00:00`).getDay().toString()];
          const effectiveShift: CompRestShift | null = explicitShift
            ? { ...explicitShift, date, segments: explicitShift.segments || [] }
            : base
              ? { employee_id: employee.id, date, type: base.type, segments: base.segments || [] }
              : null;

          if (!effectiveShift) continue;

          const creditDate = getShiftCreditDate(effectiveShift, holidayDates);
          if (!creditDate || !rangeDateSet.has(creditDate)) continue;

          if (!hasDatePassed(creditDate)) {
            addSkippedDetail(summary, employee, creditDate, 'future_date', 'La fecha todavia no paso');
            continue;
          }

          if (employee.employment_type === 'jornalero') {
            addSkippedDetail(summary, employee, creditDate, 'jornalero', 'Empleado jornalero');
            continue;
          }

          if (!workShiftTypes.has(effectiveShift.type)) {
            addSkippedDetail(summary, employee, creditDate, 'no_work_shift', 'No tiene turno laboral elegible');
            continue;
          }

          const attendanceDate = isNightShiftIntoRestrictedDay(effectiveShift, creditDate) ? date : creditDate;
          const worked = (attendanceByDate.get(attendanceDate) || []).some(record => matchesEmployee(record, employee));
          if (!worked) {
            addSkippedDetail(summary, employee, creditDate, 'no_attendance', 'Sin fichada real de entrada');
            continue;
          }

          const key = `${employee.id}_${creditDate}`;
          if (existingCredits.has(key)) {
            summary.existing++;
            affectedEmployees.add(employee.id);
            summary.details.push({
              employee_id: employee.id,
              employee_name: employee.full_name,
              date: creditDate,
              status: 'existing',
              reason: 'Credito automatico ya existente'
            });
            continue;
          }

          const reason = `Credito automatico: Trabajo en ${holidayDates.has(creditDate) ? 'Feriado' : 'Domingo'} (${creditDate})`;
          const created = await addAutomaticCreditIfMissing(employee.id, creditDate, reason, managerName);
          if (created) {
            summary.created++;
            existingCredits.add(key);
            affectedEmployees.add(employee.id);
            summary.details.push({
              employee_id: employee.id,
              employee_name: employee.full_name,
              date: creditDate,
              status: 'created',
              reason: 'Credito automatico creado'
            });
          } else {
            summary.errors++;
            addSkippedDetail(summary, employee, creditDate, 'error', 'No se pudo crear el credito');
          }
        }
      }

      await Promise.all(Array.from(affectedEmployees).map(employeeId => syncBalanceFromLedger(employeeId)));
      return summary;
    } catch (error) {
      console.error('Error reconciling compensatory rest credits:', error);
      summary.errors++;
      summary.skipped.error++;
      return summary;
    }
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
