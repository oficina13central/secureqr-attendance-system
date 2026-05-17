import { supabase } from './supabaseClient';
import { auditService } from './auditService';
import { HrRequest, HrRequestStatus, HrRequestType, Profile } from '../types';

type CreateHrRequestInput = {
  employee_id: string;
  employee_name: string;
  sector_id?: string | null;
  request_type: HrRequestType;
  target_date: string;
  end_date?: string | null;
  attendance_record_id?: string | null;
  requested_check_in?: string | null;
  requested_check_out?: string | null;
  reason: string;
  attachment_url?: string | null;
  requested_by_id?: string | null;
  requested_by_name: string;
};

type ResolveRequestInput = {
  request: HrRequest;
  resolver: Profile;
  comment?: string;
};

const normalizeDate = (value: string) => value.substring(0, 10);

const toDateTime = (date: string, time?: string | null) => {
  if (!time) return null;
  return `${normalizeDate(date)}T${time}:00`;
};

const getAttendanceCorrectionSummary = (request: HrRequest) => {
  const parts = [];
  if (request.requested_check_in) parts.push(`Entrada ${request.requested_check_in}`);
  if (request.requested_check_out) parts.push(`Salida ${request.requested_check_out}`);
  return parts.length > 0 ? parts.join(' / ') : 'Sin horario solicitado';
};

const applyAttendanceCorrection = async (request: HrRequest, resolverName: string) => {
  const checkIn = toDateTime(request.target_date, request.requested_check_in);
  const checkOut = toDateTime(request.target_date, request.requested_check_out);
  const manualReason = `Correccion aprobada por RRHH: ${request.reason}`;

  let recordId = request.attendance_record_id || null;

  if (!recordId) {
    const { data } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('employee_id', request.employee_id)
      .eq('date', normalizeDate(request.target_date))
      .order('check_in', { ascending: true })
      .limit(1);
    recordId = data?.[0]?.id || null;
  }

  if (recordId) {
    const updates: Record<string, string | number | null> = {
      status: 'manual',
      minutes_late: 0,
      manual_reason: manualReason
    };
    if (request.requested_check_in) updates.check_in = checkIn;
    if (request.requested_check_out) updates.check_out = checkOut;

    const { error } = await supabase
      .from('attendance_records')
      .update(updates)
      .eq('id', recordId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('attendance_records')
    .insert([{
      id: crypto.randomUUID(),
      employee_id: request.employee_id,
      employee_name: request.employee_name,
      date: normalizeDate(request.target_date),
      check_in: checkIn,
      check_out: checkOut,
      status: 'manual',
      minutes_late: 0,
      manual_reason: `${manualReason} (${resolverName})`
    }]);
  if (error) throw error;
};

const applyAbsenceJustification = async (request: HrRequest, resolverName: string) => {
  const date = normalizeDate(request.target_date);
  const manualReason = `Ausencia justificada por RRHH: ${request.reason} (${resolverName})`;

  const { data: records, error: fetchError } = await supabase
    .from('attendance_records')
    .select('id')
    .eq('employee_id', request.employee_id)
    .eq('date', date)
    .limit(1);

  if (fetchError && fetchError.code !== '42703') throw fetchError;
  const recordId = records?.[0]?.id;

  if (recordId) {
    const { error } = await supabase
      .from('attendance_records')
      .update({
        status: 'ausente_justificada',
        minutes_late: 0,
        manual_reason: manualReason
      })
      .eq('id', recordId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('attendance_records')
    .insert([{
      id: crypto.randomUUID(),
      employee_id: request.employee_id,
      employee_name: request.employee_name,
      date,
      check_in: null,
      check_out: null,
      status: 'ausente_justificada',
      minutes_late: 0,
      manual_reason: manualReason
    }]);
  if (error) throw error;
};

const resolveRequest = async (
  { request, resolver, comment }: ResolveRequestInput,
  status: Extract<HrRequestStatus, 'approved' | 'rejected'>
) => {
  const now = new Date().toISOString();

  if (status === 'approved') {
    if (request.request_type === 'attendance_correction') {
      await applyAttendanceCorrection(request, resolver.full_name);
    } else if (request.request_type === 'absence_justification') {
      await applyAbsenceJustification(request, resolver.full_name);
    }
  }

  const { data, error } = await supabase
    .from('hr_requests')
    .update({
      status,
      resolved_by_id: resolver.id,
      resolved_by_name: resolver.full_name,
      resolution_comment: comment || null,
      resolved_at: now,
      applied_at: status === 'approved' ? now : null,
      updated_at: now
    })
    .eq('id', request.id)
    .select()
    .single();

  if (error) throw error;

  await auditService.logAction({
    manager_name: resolver.full_name,
    employee_name: request.employee_name,
    action: status === 'approved' ? 'Aprobacion Solicitud RRHH' : 'Rechazo Solicitud RRHH',
    old_value: request.status,
    new_value: status,
    reason: `${getRequestTypeLabel(request.request_type)} ${request.target_date}. ${comment || request.reason}`
  });

  return data as HrRequest;
};

export const getRequestTypeLabel = (type: HrRequestType) => {
  if (type === 'attendance_correction') return 'Correccion de fichada';
  if (type === 'absence_justification') return 'Justificacion de ausencia';
  if (type === 'vacation_request') return 'Vacaciones';
  return 'Licencia medica';
};

export const hrRequestService = {
  async getAll(): Promise<HrRequest[]> {
    const { data, error } = await supabase
      .from('hr_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching HR requests:', error);
      throw error;
    }

    return data || [];
  },

  async create(input: CreateHrRequestInput): Promise<HrRequest> {
    const now = new Date().toISOString();
    const request = {
      id: crypto.randomUUID(),
      ...input,
      status: 'pending' as const,
      target_date: normalizeDate(input.target_date),
      created_at: now,
      updated_at: now
    };

    const { data, error } = await supabase
      .from('hr_requests')
      .insert([request])
      .select()
      .single();

    if (error) throw error;
    return data as HrRequest;
  },

  approve(input: ResolveRequestInput) {
    return resolveRequest(input, 'approved');
  },

  reject(input: ResolveRequestInput) {
    return resolveRequest(input, 'rejected');
  }
};
