import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Search,
  Send,
  User,
  XCircle
} from 'lucide-react';
import { Profile, HrRequest, HrRequestStatus, HrRequestType } from '../types';
import { hrRequestService, getRequestTypeLabel } from '../services/hrRequestService';
import { auditService } from '../services/auditService';

type HrRequestsViewProps = {
  employees: Profile[];
  currentUser: Profile;
};

const requestStatusLabel: Record<HrRequestStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada'
};

const requestStatusClass: Record<HrRequestStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200'
};

const requestTypes: Array<{ id: HrRequestType; label: string; disabled?: boolean }> = [
  { id: 'attendance_correction', label: 'Correccion de fichada' },
  { id: 'absence_justification', label: 'Justificacion de ausencia' },
  { id: 'vacation_request', label: 'Vacaciones', disabled: true },
  { id: 'medical_leave_request', label: 'Licencia medica', disabled: true }
];

const getToday = () => new Date().toISOString().substring(0, 10);

const HrRequestsView: React.FC<HrRequestsViewProps> = ({ employees, currentUser }) => {
  const [requests, setRequests] = useState<HrRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<HrRequestStatus | 'all'>('pending');
  const [typeFilter, setTypeFilter] = useState<HrRequestType | 'all'>('all');
  const [form, setForm] = useState({
    employeeId: '',
    requestType: 'attendance_correction' as HrRequestType,
    targetDate: getToday(),
    requestedCheckIn: '',
    requestedCheckOut: '',
    reason: ''
  });

  const canResolve = currentUser.role === 'administrador' || currentUser.role === 'superusuario';

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await hrRequestService.getAll();
      setRequests(data);
    } catch (error: any) {
      setMessage({
        text: `No se pudieron cargar solicitudes. Verifique que la tabla hr_requests exista en Supabase. ${error.message || ''}`,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    if (!form.employeeId && employees.length > 0) {
      setForm(prev => ({ ...prev, employeeId: employees[0].id }));
    }
  }, [employees, form.employeeId]);

  const selectedEmployee = employees.find(emp => emp.id === form.employeeId);

  const filteredRequests = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return requests.filter(request => {
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      const matchesType = typeFilter === 'all' || request.request_type === typeFilter;
      const matchesSearch = !search ||
        request.employee_name.toLowerCase().includes(search) ||
        request.reason.toLowerCase().includes(search) ||
        getRequestTypeLabel(request.request_type).toLowerCase().includes(search);

      return matchesStatus && matchesType && matchesSearch;
    });
  }, [requests, searchTerm, statusFilter, typeFilter]);

  const showFeedback = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    window.setTimeout(() => setMessage(null), 4500);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedEmployee) {
      showFeedback('Seleccione un empleado', 'error');
      return;
    }
    if (!form.reason.trim()) {
      showFeedback('Ingrese un motivo', 'error');
      return;
    }
    if (form.requestType === 'attendance_correction' && !form.requestedCheckIn && !form.requestedCheckOut) {
      showFeedback('Ingrese al menos una hora de entrada o salida', 'error');
      return;
    }

    setSaving(true);
    try {
      const created = await hrRequestService.create({
        employee_id: selectedEmployee.id,
        employee_name: selectedEmployee.full_name,
        sector_id: selectedEmployee.sector_id || null,
        request_type: form.requestType,
        target_date: form.targetDate,
        requested_check_in: form.requestType === 'attendance_correction' ? form.requestedCheckIn || null : null,
        requested_check_out: form.requestType === 'attendance_correction' ? form.requestedCheckOut || null : null,
        reason: form.reason.trim(),
        requested_by_id: currentUser.id,
        requested_by_name: currentUser.full_name
      });

      await auditService.logAction({
        manager_name: currentUser.full_name,
        employee_name: selectedEmployee.full_name,
        action: 'Creacion Solicitud RRHH',
        old_value: 'N/A',
        new_value: `${getRequestTypeLabel(created.request_type)} ${created.target_date}`,
        reason: created.reason
      });

      setRequests(prev => [created, ...prev]);
      setForm(prev => ({ ...prev, requestedCheckIn: '', requestedCheckOut: '', reason: '' }));
      showFeedback('Solicitud creada correctamente', 'success');
    } catch (error: any) {
      showFeedback(`Error al crear solicitud: ${error.message || 'intente nuevamente'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async (request: HrRequest, status: 'approved' | 'rejected') => {
    if (!canResolve || request.status !== 'pending') return;
    const comment = window.prompt(status === 'approved' ? 'Comentario de aprobacion' : 'Motivo de rechazo') || '';
    if (status === 'rejected' && !comment.trim()) {
      showFeedback('Para rechazar debe ingresar un motivo', 'error');
      return;
    }

    setActionId(request.id);
    try {
      const updated = status === 'approved'
        ? await hrRequestService.approve({ request, resolver: currentUser, comment })
        : await hrRequestService.reject({ request, resolver: currentUser, comment });

      setRequests(prev => prev.map(item => item.id === updated.id ? updated : item));
      showFeedback(status === 'approved' ? 'Solicitud aprobada y aplicada' : 'Solicitud rechazada', 'success');
    } catch (error: any) {
      showFeedback(`No se pudo resolver la solicitud: ${error.message || 'intente nuevamente'}`, 'error');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xl shadow-indigo-200">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase">Solicitudes RRHH</h1>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Correcciones y justificaciones con aprobacion</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar solicitud..."
              className="w-full sm:w-72 pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm font-bold text-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-sm"
            />
          </div>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as any)} className="px-4 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-black uppercase text-slate-600 shadow-sm">
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="approved">Aprobadas</option>
            <option value="rejected">Rechazadas</option>
            <option value="cancelled">Canceladas</option>
          </select>
          <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as any)} className="px-4 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-black uppercase text-slate-600 shadow-sm">
            <option value="all">Todos los tipos</option>
            <option value="attendance_correction">Correccion de fichada</option>
            <option value="absence_justification">Justificacion de ausencia</option>
          </select>
        </div>
      </header>

      {message && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 font-bold text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span>{message.text}</span>
        </div>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        <form onSubmit={handleCreate} className="bg-white border border-slate-100 rounded-[2rem] shadow-sm p-6 space-y-5 h-fit">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-indigo-600">Nueva solicitud</p>
            <h2 className="text-xl font-black text-slate-800">Carga controlada</h2>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Empleado</label>
            <select value={form.employeeId} onChange={event => setForm(prev => ({ ...prev, employeeId: event.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700">
              {employees.map(employee => (
                <option key={employee.id} value={employee.id}>{employee.full_name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</label>
            <select value={form.requestType} onChange={event => setForm(prev => ({ ...prev, requestType: event.target.value as HrRequestType }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700">
              {requestTypes.map(type => (
                <option key={type.id} value={type.id} disabled={type.disabled}>{type.label}{type.disabled ? ' (proxima etapa)' : ''}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</label>
            <input type="date" value={form.targetDate} onChange={event => setForm(prev => ({ ...prev, targetDate: event.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700" />
          </div>

          {form.requestType === 'attendance_correction' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entrada</label>
                <input type="time" value={form.requestedCheckIn} onChange={event => setForm(prev => ({ ...prev, requestedCheckIn: event.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Salida</label>
                <input type="time" value={form.requestedCheckOut} onChange={event => setForm(prev => ({ ...prev, requestedCheckOut: event.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivo</label>
            <textarea value={form.reason} onChange={event => setForm(prev => ({ ...prev, reason: event.target.value }))} rows={4} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 resize-none" placeholder="Detalle claro para auditoria..." />
          </div>

          <button disabled={saving} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2">
            <Send className="w-4 h-4" />
            <span>{saving ? 'Creando...' : 'Crear solicitud'}</span>
          </button>
        </form>

        <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Bandeja</p>
              <h2 className="text-xl font-black text-slate-800">{filteredRequests.length} solicitudes</h2>
            </div>
            {!canResolve && (
              <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-black uppercase tracking-widest">Solo carga/consulta</span>
            )}
          </div>

          {loading ? (
            <div className="p-10 text-center text-slate-400 font-bold">Cargando solicitudes...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-10 text-center text-slate-400 font-bold">No hay solicitudes para estos filtros.</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filteredRequests.map(request => (
                <article key={request.id} className="p-5 hover:bg-slate-50/60 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-3 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-3 py-1 rounded-xl border text-[10px] font-black uppercase tracking-widest ${requestStatusClass[request.status]}`}>
                          {requestStatusLabel[request.status]}
                        </span>
                        <span className="px-3 py-1 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-black uppercase tracking-widest">
                          {getRequestTypeLabel(request.request_type)}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{request.employee_name}</h3>
                        <div className="flex flex-wrap items-center gap-4 mt-1 text-xs font-bold text-slate-400">
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {request.target_date}</span>
                          <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {request.requested_by_name}</span>
                          {request.request_type === 'attendance_correction' && (
                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {request.requested_check_in || '--:--'} / {request.requested_check_out || '--:--'}</span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 font-medium leading-relaxed flex gap-2">
                        <FileText className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                        <span>{request.reason}</span>
                      </p>
                      {request.resolution_comment && (
                        <p className="text-xs text-slate-500 font-bold bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                          Resolucion: {request.resolution_comment}
                        </p>
                      )}
                    </div>

                    {canResolve && request.status === 'pending' && (
                      <div className="flex lg:flex-col gap-2 shrink-0">
                        <button onClick={() => handleResolve(request, 'approved')} disabled={actionId === request.id} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          Aprobar
                        </button>
                        <button onClick={() => handleResolve(request, 'rejected')} disabled={actionId === request.id} className="px-4 py-2.5 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 border border-red-100 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2">
                          <XCircle className="w-4 h-4" />
                          Rechazar
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default HrRequestsView;
