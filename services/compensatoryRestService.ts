import { supabase } from './supabaseClient';
import { CompensatoryRestLog, Holiday, Profile } from '../types';
import { getLocalDateString } from '../utils/dateUtils';
import { resolveDefaultScheduleForDate, sanitizeScheduleDayConfig } from './scheduleService';

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

const workShiftTypes = new Set(['continuous', 'split', 'double', 'half']);

const getShiftCreditAmount = (shift: Pick<CompRestShift, 'type'>): number =>
  shift.type === 'half' ? 0.5 : 1;

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

const normalizeSearchText = (value?: string | null): string =>
  normalizeIdentity(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeDate = (value?: string | null): string => (value || '').substring(0, 10);

const extractDateFromReason = (reason?: string | null): string | null => {
  const match = (reason || '').match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

const getEffectiveLedgerAmount = (row: { amount?: number | string | null; type?: string | null; reason?: string | null }): number => {
  const reasonStr = row.reason || '';
  const tagMatch = reasonStr.match(/\[MONTO:\s*(-?\d+(?:\.\d+)?)\]/i);
  if (tagMatch) {
    const parsed = Number(tagMatch[1]);
    if (!Number.isNaN(parsed)) return parsed;
  }

  const numericAmount = Number(row.amount);
  if (!Number.isNaN(numericAmount) && numericAmount !== 0) {
    return numericAmount;
  }

  const normalizedReason = normalizeSearchText(reasonStr);
  if (
    normalizedReason.includes('medio franco') ||
    normalizedReason.includes('medio descanso') ||
    normalizedReason.includes('medio turno')
  ) {
    if (row.type === 'usage' || row.type === 'payment') return -0.5;
    if (row.type === 'credit' || row.type === 'adjustment') return 0.5;
  }

  return Number.isNaN(numericAmount) ? 0 : numericAmount;
};

const stripLedgerMetaReason = (reason?: string | null): string =>
  (reason || '').replace(/\s*\[MONTO:\s*-?\d+(?:\.\d+)?\]/gi, '').trim();

const insertLedgerRowResilient = async (
  log: Omit<CompensatoryRestLog, 'id' | 'created_at'>
): Promise<boolean> => {
  const { error } = await supabase
    .from('compensatory_rest_ledger')
    .insert([log]);

  if (!error) return true;

  if (!Number.isInteger(log.amount)) {
    const fallbackLog = {
      ...log,
      amount: 0,
      reason: `${log.reason} [MONTO: ${log.amount}]`
    };
    const { error: fallbackError } = await supabase
      .from('compensatory_rest_ledger')
      .insert([fallbackLog]);

    if (!fallbackError) return true;
    console.error('Error inserting compensatory rest ledger row (fallback):', fallbackError);
    return false;
  }

  console.error('Error inserting compensatory rest ledger row:', error);
  return false;
};

const getAutomaticCreditDateFromReason = (reason?: string | null): string | null => {
  const normalizedReason = normalizeSearchText(reason);
  if (!normalizedReason.includes('credito automatico')) return null;
  return extractDateFromReason(reason);
};

const getCompensatoryUsageDateFromReason = (reason?: string | null): string | null => {
  const normalizedReason = normalizeSearchText(reason);
  if (!normalizedReason.includes('franco compensatorio') && !normalizedReason.includes('medio descanso')) return null;
  if (!normalizedReason.includes('uso de') && !normalizedReason.includes('cancelacion de')) return null;
  return extractDateFromReason(reason);
};

const isCompensatoryUsageCancellation = (row: { type?: string | null; reason?: string | null }): boolean => {
  if (row.type !== 'adjustment') return false;
  const normalizedReason = normalizeSearchText(row.reason);
  return normalizedReason.includes('cancelacion de franco compensatorio') ||
    normalizedReason.includes('cancelacion de medio franco compensatorio') ||
    normalizedReason.includes('cancelacion de medio descanso');
};

const isCompensatoryUsage = (row: { type?: string | null; reason?: string | null }): boolean => {
  if (row.type !== 'usage') return false;
  const normalizedReason = normalizeSearchText(row.reason);
  return normalizedReason.includes('uso de franco compensatorio') ||
    normalizedReason.includes('uso de medio franco compensatorio') ||
    normalizedReason.includes('uso de medio descanso');
};

const shouldCountLedgerRow = (row: { type?: string | null; reason?: string | null }): boolean => {
  const compUsageDate = getCompensatoryUsageDateFromReason(row.reason);
  if (compUsageDate && compUsageDate > getLocalDateString()) return false;
  if (isCompensatoryUsage(row) || isCompensatoryUsageCancellation(row)) return false;
  return true;
};

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

  return addDaysToDateString(shift.date, 1) === creditDate && startHour >= 19 && (endHour < startHour || endHour >= 3);
};

const getShiftCreditDate = (shift: CompRestShift, holidayDates: Set<string>): string | null => {
  const shiftDate = normalizeDate(shift.date);
  if (!workShiftTypes.has(shift.type) || !shift.segments || shift.segments.length === 0) return null;

  const firstSegment = shift.segments[0];
  const [startHour] = (firstSegment?.start || '').split(':').map(Number);
  if (Number.isNaN(startHour)) return null;

  if (startHour >= 19) {
    const nextDate = addDaysToDateString(shiftDate, 1);
    if (isSundayOrHoliday(nextDate, holidayDates) && isNightShiftIntoRestrictedDay(shift, nextDate)) {
      return nextDate;
    }
    return null;
  } else {
    if (isSundayOrHoliday(shiftDate, holidayDates)) {
      return shiftDate;
    }
    return null;
  }
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

const calculateEffectiveBalanceFromRows = (
  rows: Array<{ amount?: number | string | null; type?: string | null; reason?: string | null; created_at?: string | null }>
): number => {
  const today = getLocalDateString();
  const automaticCreditsByDate = new Map<string, { amount: number; created_at: string }>();
  const usageStateByDate = new Map<string, { used: boolean; amount: number; created_at?: string | null }>();

  rows.forEach(row => {
    const usageDate = getCompensatoryUsageDateFromReason(row.reason);
    if (usageDate && usageDate <= today && (isCompensatoryUsage(row) || isCompensatoryUsageCancellation(row))) {
      const current = usageStateByDate.get(usageDate);
      const rowCreatedAt = row.created_at || '';
      const currentCreatedAt = current?.created_at || '';
      if (!current || rowCreatedAt >= currentCreatedAt) {
        const rawAmount = getEffectiveLedgerAmount(row);
        const normReason = normalizeSearchText(row.reason);
        const absAmount = Math.abs(rawAmount) || ((normReason.includes('medio franco') || normReason.includes('medio descanso')) ? 0.5 : 1);
        usageStateByDate.set(usageDate, {
          used: isCompensatoryUsage(row),
          amount: -absAmount,
          created_at: row.created_at
        });
      }
      return;
    }

    const amount = getEffectiveLedgerAmount(row);
    const automaticCreditDate = amount > 0 && row.type === 'credit'
      ? getAutomaticCreditDateFromReason(row.reason)
      : null;

    if (automaticCreditDate) {
      const current = automaticCreditsByDate.get(automaticCreditDate);
      const rowCreatedAt = row.created_at || '';
      if (!current || rowCreatedAt >= current.created_at) {
        automaticCreditsByDate.set(automaticCreditDate, { amount, created_at: rowCreatedAt });
      }
    }
  });

  const nonAutoCreditBalance = rows.reduce((sum, row) => {
    if (!shouldCountLedgerRow(row)) return sum;

    const amount = getEffectiveLedgerAmount(row);
    const automaticCreditDate = amount > 0 && row.type === 'credit'
      ? getAutomaticCreditDateFromReason(row.reason)
      : null;

    if (automaticCreditDate) {
      return sum;
    }

    return sum + amount;
  }, 0);

  const automaticCreditTotal = Array.from(automaticCreditsByDate.values())
    .reduce((sum, item) => sum + item.amount, 0);

  const effectiveCompensatoryUsageTotal = Array.from(usageStateByDate.values())
    .reduce((sum, state) => state.used ? sum + state.amount : sum, 0);

  return Math.round((nonAutoCreditBalance + automaticCreditTotal + effectiveCompensatoryUsageTotal) * 100) / 100;
};

const syncBalanceFromLedger = async (employeeId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('compensatory_rest_ledger')
    .select('amount, type, reason, created_at')
    .eq('employee_id', employeeId);

  if (error) {
    console.error('Error fetching compensatory rest ledger balance:', error);
    return false;
  }

  const effectiveBalance = calculateEffectiveBalanceFromRows(data || []);
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ compensatory_rest_balance: effectiveBalance })
    .eq('id', employeeId);

  if (updateError) {
    if (!Number.isInteger(effectiveBalance)) {
      const { error: fallbackUpdateError } = await supabase
        .from('profiles')
        .update({ compensatory_rest_balance: Math.trunc(effectiveBalance) })
        .eq('id', employeeId);

      if (!fallbackUpdateError) return true;
    }
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
  const nextDateStr = addDaysToDateString(date, 1);
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
  managerName: string,
  creditAmount: number = 1
): Promise<boolean> => {
  const { data } = await supabase
    .from('compensatory_rest_ledger')
    .select('id, amount, type, reason, created_at')
    .eq('employee_id', employeeId)
    .eq('type', 'credit')
    .ilike('reason', `%${date}%`)
    .order('created_at', { ascending: false });

  const matchingLogs = (data || []).filter(log => getAutomaticCreditDateFromReason(log.reason) === date);
  if (matchingLogs.length > 0) {
    const latestAmount = getEffectiveLedgerAmount(matchingLogs[0]);
    if (Math.abs(latestAmount - creditAmount) < 0.001) {
      return syncBalanceFromLedger(employeeId);
    }
  }

  const inserted = await insertLedgerRowResilient({
    employee_id: employeeId,
    amount: creditAmount,
    type: 'credit',
    reason,
    manager_name: managerName
  });

  if (!inserted) return false;

  return syncBalanceFromLedger(employeeId);
};

const getCompensatoryUsageStateForDate = async (
  employeeId: string,
  date: string
): Promise<{ status: 'used' | 'cancelled'; amount: number } | null> => {
  const { data, error } = await supabase
    .from('compensatory_rest_ledger')
    .select('amount, type, reason, created_at')
    .eq('employee_id', employeeId)
    .ilike('reason', `%${date}%`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error checking compensatory rest usage state:', error);
    return null;
  }

  for (const row of data || []) {
    if (getCompensatoryUsageDateFromReason(row.reason) !== date) continue;
    const rawAmount = getEffectiveLedgerAmount(row);
    const normReason = normalizeSearchText(row.reason);
    const absAmount = Math.abs(rawAmount) || ((normReason.includes('medio franco') || normReason.includes('medio descanso')) ? 0.5 : 1);
    if (isCompensatoryUsage(row)) return { status: 'used', amount: absAmount };
    if (isCompensatoryUsageCancellation(row)) return { status: 'cancelled', amount: absAmount };
  }

  return null;
};

const buildExistingAutomaticCreditMap = (
  logs: Array<{ employee_id: string; amount?: number | string | null; type?: string | null; reason?: string | null; created_at?: string | null }>
) => {
  const map = new Map<string, { amount: number; created_at: string }>();

  logs.forEach(log => {
    const date = getAutomaticCreditDateFromReason(log.reason);
    if (!date) return;

    const key = `${log.employee_id}_${date}`;
    const createdAt = log.created_at || '';
    const existing = map.get(key);
    if (!existing || createdAt >= existing.created_at) {
      map.set(key, {
        amount: getEffectiveLedgerAmount({ ...log, type: log.type || 'credit' }),
        created_at: createdAt
      });
    }
  });

  return map;
};

const filterDuplicateAutomaticCreditLogs = (logs: CompensatoryRestLog[]): CompensatoryRestLog[] => {
  const seenAutomaticCredits = new Set<string>();
  const latestCompensatoryUsageByDate = new Map<string, CompensatoryRestLog>();
  const today = getLocalDateString();

  const normalizedLogs = logs.map(log => ({
    ...log,
    amount: getEffectiveLedgerAmount(log),
    reason: stripLedgerMetaReason(log.reason)
  }));

  normalizedLogs.forEach(log => {
    const usageDate = getCompensatoryUsageDateFromReason(log.reason);
    if (!usageDate || usageDate > today) return;
    if (!isCompensatoryUsage(log) && !isCompensatoryUsageCancellation(log)) return;

    const key = `${log.employee_id}_${usageDate}`;
    const current = latestCompensatoryUsageByDate.get(key);
    if (!current || (log.created_at || '') > (current.created_at || '')) {
      latestCompensatoryUsageByDate.set(key, log);
    }
  });

  return normalizedLogs.filter(log => {
    const usageDate = getCompensatoryUsageDateFromReason(log.reason);
    if (usageDate) {
      if (usageDate > today) return false;
      if (isCompensatoryUsage(log) || isCompensatoryUsageCancellation(log)) {
        const key = `${log.employee_id}_${usageDate}`;
        return latestCompensatoryUsageByDate.get(key)?.id === log.id;
      }
    }

    const amount = Number(log.amount) || 0;
    const automaticCreditDate = amount > 0 && log.type === 'credit'
      ? getAutomaticCreditDateFromReason(log.reason)
      : null;

    if (!automaticCreditDate) return true;

    const key = `${log.employee_id}_${automaticCreditDate}`;
    if (seenAutomaticCredits.has(key)) return false;
    seenAutomaticCredits.add(key);
    return true;
  });
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
  async enrichProfilesWithLedgerBalance(profiles: Profile[]): Promise<Profile[]> {
    if (!profiles || profiles.length === 0) return profiles;
    try {
      const { data: ledgerRows, error } = await supabase
        .from('compensatory_rest_ledger')
        .select('employee_id, amount, type, reason, created_at');

      if (error || !ledgerRows || ledgerRows.length === 0) return profiles;

      const rowsByEmployee = new Map<string, typeof ledgerRows>();
      ledgerRows.forEach(row => {
        if (!row.employee_id) return;
        const list = rowsByEmployee.get(row.employee_id) || [];
        list.push(row);
        rowsByEmployee.set(row.employee_id, list);
      });

      return profiles.map(profile => {
        const empRows = rowsByEmployee.get(profile.id);
        if (!empRows || empRows.length === 0) return profile;
        return {
          ...profile,
          compensatory_rest_balance: calculateEffectiveBalanceFromRows(empRows)
        };
      });
    } catch {
      return profiles;
    }
  },

  async getBalance(employeeId: string): Promise<number> {
    const { data: ledgerRows, error: ledgerError } = await supabase
      .from('compensatory_rest_ledger')
      .select('amount, type, reason, created_at')
      .eq('employee_id', employeeId);

    if (!ledgerError && ledgerRows && ledgerRows.length > 0) {
      return calculateEffectiveBalanceFromRows(ledgerRows);
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('compensatory_rest_balance')
      .eq('id', employeeId)
      .single();

    if (error) return 0;
    return Number(data.compensatory_rest_balance) || 0;
  },

  async getLogs(employeeId: string): Promise<CompensatoryRestLog[]> {
    const { data } = await supabase
      .from('compensatory_rest_ledger')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    return filterDuplicateAutomaticCreditLogs(data || []);
  },

  async addLog(log: Omit<CompensatoryRestLog, 'id' | 'created_at'>): Promise<boolean> {
    const ok = await insertLedgerRowResilient(log);
    if (!ok) return false;
    return syncBalanceFromLedger(log.employee_id);
  },

  async addCompensatoryUsageIfDue(
    employeeId: string,
    date: string,
    managerName: string = 'System Auto',
    usageAmount: number = 1
  ): Promise<boolean> {
    if (date > getLocalDateString()) {
      await syncBalanceFromLedger(employeeId);
      return false;
    }

    const normalizedDeduction = Math.abs(usageAmount) === 0.5 ? 0.5 : 1;
    const currentState = await getCompensatoryUsageStateForDate(employeeId, date);
    if (currentState?.status === 'used' && Math.abs(currentState.amount - normalizedDeduction) < 0.001) {
      await syncBalanceFromLedger(employeeId);
      return false;
    }

    const isHalf = normalizedDeduction === 0.5;
    return this.addLog({
      employee_id: employeeId,
      amount: -normalizedDeduction,
      type: 'usage',
      reason: isHalf
        ? `Uso de medio franco compensatorio el día ${date}`
        : `Uso de franco compensatorio el día ${date}`,
      manager_name: managerName
    });
  },

  async reverseCompensatoryUsageIfApplied(
    employeeId: string,
    date: string,
    managerName: string = 'System Auto'
  ): Promise<boolean> {
    const usageState = await getCompensatoryUsageStateForDate(employeeId, date);
    if (!usageState || usageState.status !== 'used') {
      await syncBalanceFromLedger(employeeId);
      return false;
    }

    const restoreAmount = usageState.amount === 0.5 ? 0.5 : 1;
    const isHalf = restoreAmount === 0.5;
    return this.addLog({
      employee_id: employeeId,
      amount: restoreAmount,
      type: 'adjustment',
      reason: isHalf
        ? `Cancelación de medio franco compensatorio del día ${date}`
        : `Cancelación de franco compensatorio del día ${date}`,
      manager_name: managerName
    });
  },

  async getHolidays(): Promise<Holiday[]> {
    const { data } = await supabase
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
    const sanitized = sanitizeScheduleDayConfig({ type: shiftType as any, segments });
    const resolvedType = sanitized.type;
    if (
      resolvedType === 'off' ||
      resolvedType === 'compensatory' ||
      resolvedType === 'half_compensatory' ||
      resolvedType === 'suspension'
    ) {
      return false;
    }

    const { data: emp } = await supabase
      .from('profiles')
      .select('employment_type, full_name, dni')
      .eq('id', employeeId)
      .single();
    if (emp?.employment_type === 'jornalero') return false;

    const holidays = await this.getHolidays();
    const holidayDates = new Set(holidays.map(h => h.date));

    const shift: CompRestShift = {
      employee_id: employeeId,
      date,
      type: resolvedType,
      segments: sanitized.segments
    };
    const creditDate = getShiftCreditDate(shift, holidayDates);

    if (!creditDate || !hasDatePassed(creditDate)) return false;

    if (!(await hasWorkedOnDate(employeeId, emp?.full_name, emp?.dni, date))) return false;

    const isCreditHoliday = holidayDates.has(creditDate);
    const isNightShift = creditDate !== date;
    const creditAmount = getShiftCreditAmount(shift);
    const isHalfShift = creditAmount === 0.5;

    let reason = '';
    if (isNightShift) {
      reason = `Credito automatico: ${isHalfShift ? 'Medio turno nocturno' : 'Jornada nocturna'} hacia ${isCreditHoliday ? 'Feriado' : 'Domingo'} (${creditDate})`;
    } else {
      reason = `Credito automatico: ${isHalfShift ? 'Medio turno' : 'Trabajo'} en ${isCreditHoliday ? 'Feriado' : 'Domingo'} (${creditDate})`;
    }

    return addAutomaticCreditIfMissing(employeeId, creditDate, reason, managerName, creditAmount);
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
        fetchPaged<{ employee_id: string; amount: number | null; type: string | null; reason: string | null; created_at: string | null }>(
          (from, to) => supabase
            .from('compensatory_rest_ledger')
            .select('employee_id, amount, type, reason, created_at')
            .eq('type', 'credit')
            .range(from, to),
          'compensatory rest ledger credits'
        )
      ]);

      const scheduleMap = new Map<string, CompRestShift>();
      schedules.forEach(shift => {
        const date = normalizeDate(shift.date);
        if (!date || !evaluationDates.includes(date)) return;
        const sanitized = sanitizeScheduleDayConfig({ type: shift.type as any, segments: shift.segments });
        scheduleMap.set(`${shift.employee_id}_${date}`, {
          ...shift,
          date,
          type: sanitized.type,
          segments: sanitized.segments
        });
      });

      const holidayDates = new Set(holidays.map(h => normalizeDate(h.date)).filter(Boolean));
      const existingCredits = buildExistingAutomaticCreditMap(ledgerCredits);
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
          const base = resolveDefaultScheduleForDate(employee.default_schedule, date);
          const effectiveShift: CompRestShift | null = explicitShift
            ? { ...explicitShift, date, segments: explicitShift.segments || [] }
            : base
              ? { employee_id: employee.id, date, type: base.type, segments: base.segments || [] }
              : null;

          if (!effectiveShift) continue;

          if (effectiveShift.type === 'compensatory' || effectiveShift.type === 'half_compensatory') {
            const usageAmount = effectiveShift.type === 'half_compensatory' ? 0.5 : 1;
            const used = await this.addCompensatoryUsageIfDue(employee.id, date, managerName, usageAmount);
            if (used || date <= getLocalDateString()) affectedEmployees.add(employee.id);
            continue;
          }

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

          const creditAmount = getShiftCreditAmount(effectiveShift);
          const isHalfShift = creditAmount === 0.5;
          const key = `${employee.id}_${creditDate}`;
          const existingCredit = existingCredits.get(key);
          if (existingCredit && Math.abs(existingCredit.amount - creditAmount) < 0.001) {
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

          const reason = `Credito automatico: ${isHalfShift ? 'Medio turno' : 'Trabajo'} en ${holidayDates.has(creditDate) ? 'Feriado' : 'Domingo'} (${creditDate})`;
          const created = await addAutomaticCreditIfMissing(employee.id, creditDate, reason, managerName, creditAmount);
          if (created) {
            summary.created++;
            existingCredits.set(key, { amount: creditAmount, created_at: new Date().toISOString() });
            affectedEmployees.add(employee.id);
            summary.details.push({
              employee_id: employee.id,
              employee_name: employee.full_name,
              date: creditDate,
              status: 'created',
              reason: isHalfShift ? 'Credito automatico (+0.5) creado' : 'Credito automatico creado'
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

  async getAutomaticCreditsForDate(date: string): Promise<{ id: string; employee_id: string }[]> {
    const { data, error } = await supabase
      .from('compensatory_rest_ledger')
      .select('id, employee_id, reason')
      .eq('type', 'credit')
      .ilike('reason', `%${date}%`);

    if (error || !data) return [];
    return data.filter(log => getAutomaticCreditDateFromReason(log.reason) === date);
  },

  async reverseAutomaticCreditsForDate(date: string): Promise<number> {
    const credits = await this.getAutomaticCreditsForDate(date);
    if (credits.length === 0) return 0;

    const affectedEmployees = new Set<string>();

    for (const credit of credits) {
      const { error } = await supabase
        .from('compensatory_rest_ledger')
        .delete()
        .eq('id', credit.id);

      if (!error) {
        affectedEmployees.add(credit.employee_id);
      }
    }

    // Recalcular saldos de todos los empleados afectados
    await Promise.all(
      Array.from(affectedEmployees).map(employeeId => syncBalanceFromLedger(employeeId))
    );

    return credits.length;
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
    const diff = Math.round((finalBalance - current) * 100) / 100;
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
