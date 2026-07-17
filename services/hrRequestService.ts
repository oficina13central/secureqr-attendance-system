import { supabase } from './supabaseClient';
import { auditService } from './auditService';
import { attendanceService } from './attendanceService';
import { scheduleService, ShiftData, ShiftType } from './scheduleService';
import { HrRequest, HrRequestStatus, HrRequestType, Profile } from '../types';

type CreateHrRequestInput = {
  id?: string;
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

type EditResolutionInput = {
  request: HrRequest;
  newStatus: Extract<HrRequestStatus, 'approved' | 'rejected' | 'pending'>;
  resolver: Profile;
  comment?: string;
};

const normalizeDate = (value: string) => value.substring(0, 10);
const ATTACHMENTS_BUCKET = 'hr-request-attachments';

const toDateTime = (date: string, time?: string | null) => {
  if (!time) return null;
  return `${normalizeDate(date)}T${time}:00-03:00`;
};

const addDaysToDateString = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().substring(0, 10);
};

const getDatesInRange = (startDate: string, endDate?: string | null) => {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate || startDate);
  const dates: string[] = [];
  let current = start;

  while (current <= end) {
    dates.push(current);
    current = addDaysToDateString(current, 1);
  }

  return dates;
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

const applyLeaveRequest = async (request: HrRequest, resolverName: string) => {
  const shiftType: ShiftType = request.request_type === 'vacation_request' ? 'vacation' : 'medical';
  const dates = getDatesInRange(request.target_date, request.end_date);
  const now = new Date().toISOString();

  const shifts: ShiftData[] = dates.map(date => ({
    id: `${request.employee_id}_${date}`,
    employee_id: request.employee_id,
    date,
    type: shiftType,
    segments: [],
    last_modified_by: resolverName,
    last_modified_at: now
  }));

  const saved = await scheduleService.save(shifts);
  const savedArray = Array.isArray(saved) ? saved : [saved];
  if (savedArray.length === 0 || savedArray.some(item => !item)) {
    throw new Error('No se pudo guardar el cronograma aprobado');
  }

  await attendanceService.recalculateAttendance(
    request.employee_id,
    dates[0],
    dates[dates.length - 1],
    resolverName
  );
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
    } else if (request.request_type === 'vacation_request' || request.request_type === 'medical_leave_request') {
      await applyLeaveRequest(request, resolver.full_name);
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
    reason: `${getRequestTypeLabel(request.request_type)} ${request.target_date}${request.end_date ? ` al ${request.end_date}` : ''}. ${comment || request.reason}`
  });

  return data as HrRequest;
};

export const getRequestTypeLabel = (type: HrRequestType) => {
  if (type === 'attendance_correction') return 'Correccion de fichada';
  if (type === 'absence_justification') return 'Justificacion de ausencia';
  if (type === 'vacation_request') return 'Vacaciones';
  return 'Licencia medica';
};

export const canAccessHrRequest = (
  request: Pick<HrRequest, 'employee_id' | 'sector_id' | 'requested_by_id'>,
  user: Profile
) => {
  if (user.role === 'administrador' || user.role === 'superusuario') return true;
  if (user.role === 'encargado') {
    const sectorIds = new Set([user.sector_id, ...(user.managed_sectors || [])].filter(Boolean));
    return !!request.sector_id && sectorIds.has(request.sector_id);
  }
  return request.employee_id === user.id || request.requested_by_id === user.id;
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

  async countPendingForUser(user: Profile): Promise<number> {
    const { data, error } = await supabase
      .from('hr_requests')
      .select('employee_id, sector_id, requested_by_id')
      .eq('status', 'pending');

    if (error) {
      console.error('Error counting pending HR requests:', error);
      return 0;
    }

    return (data || []).filter(request => canAccessHrRequest(request as any, user)).length;
  },

  async uploadAttachment(file: File, requestId: string): Promise<string> {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'file';
    const safeName = file.name
      .replace(/\.[^/.]+$/, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 60) || 'comprobante';
    const path = `${requestId}/${Date.now()}-${safeName}.${extension}`;

    const { error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;
    return path;
  },

  async getAttachmentUrl(pathOrUrl: string): Promise<string> {
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

    const { data, error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrl(pathOrUrl, 60 * 10);

    if (error) throw error;
    return data.signedUrl;
  },

  async create(input: CreateHrRequestInput): Promise<HrRequest> {
    const now = new Date().toISOString();
    const request = {
      ...input,
      id: input.id || crypto.randomUUID(),
      status: 'pending' as const,
      target_date: normalizeDate(input.target_date),
      end_date: input.end_date ? normalizeDate(input.end_date) : null,
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
  },

  async editResolution({ request, newStatus, resolver, comment }: EditResolutionInput): Promise<HrRequest> {
    const now = new Date().toISOString();

    // If changing to approved, apply the corresponding effects
    if (newStatus === 'approved') {
      if (request.request_type === 'attendance_correction') {
        await applyAttendanceCorrection(request, resolver.full_name);
      } else if (request.request_type === 'absence_justification') {
        await applyAbsenceJustification(request, resolver.full_name);
      } else if (request.request_type === 'vacation_request' || request.request_type === 'medical_leave_request') {
        await applyLeaveRequest(request, resolver.full_name);
      }
    }

    const updates: Record<string, any> = {
      status: newStatus,
      resolved_by_id: resolver.id,
      resolved_by_name: resolver.full_name,
      resolution_comment: comment || null,
      resolved_at: newStatus === 'pending' ? null : now,
      applied_at: newStatus === 'approved' ? now : null,
      updated_at: now
    };

    const { data, error } = await supabase
      .from('hr_requests')
      .update(updates)
      .eq('id', request.id)
      .select()
      .single();

    if (error) throw error;

    await auditService.logAction({
      manager_name: resolver.full_name,
      employee_name: request.employee_name,
      action: 'Edicion Resolucion RRHH',
      old_value: request.status,
      new_value: newStatus,
      reason: `${getRequestTypeLabel(request.request_type)} ${request.target_date}. ${comment || 'Sin comentario'}`
    });

    return data as HrRequest;
  }
};
