import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  History, 
  FileText, 
  Camera, 
  Plus, 
  CreditCard, 
  Save, 
  AlertCircle,
  ShieldAlert,
  Clock,
  User,
  Search,
  UploadCloud,
  ChevronRight,
  Download,
  Briefcase,
  Building2
} from 'lucide-react';
import { compensatoryRestService } from '../services/compensatoryRestService';
import { attendanceService } from '../services/attendanceService';
import { auditService } from '../services/auditService';
import { supabase } from '../services/supabaseClient';
import { Profile, CompensatoryRestLog, AttendanceRecord, EmployeeDocument } from '../types';

interface EmployeeFileModalProps {
  employeeId: string;
  managerName: string;
  managerRole?: string;
  onClose: () => void;
}

interface LeaveRange {
  start: string;
  end: string;
  count: number;
}

const parseDateAtNoon = (date: string) => new Date(`${date}T12:00:00`);

const getNextDateKey = (date: string) => {
  const next = parseDateAtNoon(date);
  next.setDate(next.getDate() + 1);
  return next.toISOString().split('T')[0];
};

const formatDateLong = (date: string) =>
  parseDateAtNoon(date).toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

const formatLeaveRange = (range: LeaveRange) => {
  if (range.start === range.end) return formatDateLong(range.start);
  return `Desde ${formatDateLong(range.start)} hasta ${formatDateLong(range.end)}`;
};

const getEmploymentTypeLabel = (type?: string) => type === 'jornalero' ? 'Jornalero' : 'Efectivo';

const getContractTypeLabel = (type?: string | null) => {
  if (type === 'permanent') return 'Permanente';
  if (type === 'temporary') return 'Temporal';
  if (type === 'contractor') return 'Contratista';
  if (type === 'internship') return 'Pasantia';
  return 'Sin definir';
};

const getDocumentTypeLabel = (type?: string) => {
  if (type === 'medical') return 'Medico';
  if (type === 'suspension') return 'Disciplinario';
  if (type === 'identity') return 'Identidad';
  if (type === 'contract') return 'Contrato';
  if (type === 'certificate') return 'Certificado';
  if (type === 'training') return 'Capacitacion';
  return 'Otro';
};

const getTenureLabel = (hireDate?: string | null) => {
  if (!hireDate) return 'Sin fecha';
  const start = parseDateAtNoon(hireDate);
  const today = new Date();
  if (Number.isNaN(start.getTime()) || start > today) return 'Sin fecha';

  let years = today.getFullYear() - start.getFullYear();
  let months = today.getMonth() - start.getMonth();
  if (today.getDate() < start.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years <= 0 && months <= 0) return 'Menos de 1 mes';
  if (years <= 0) return `${months} mes${months !== 1 ? 'es' : ''}`;
  if (months <= 0) return `${years} ano${years !== 1 ? 's' : ''}`;
  return `${years} ano${years !== 1 ? 's' : ''}, ${months} mes${months !== 1 ? 'es' : ''}`;
};

const groupConsecutiveDates = (records: AttendanceRecord[]): LeaveRange[] => {
  const dates = Array.from(new Set(records.map(r => r.date))).sort((a, b) => a.localeCompare(b));
  if (dates.length === 0) return [];

  const ranges: LeaveRange[] = [];
  let start = dates[0];
  let end = dates[0];

  dates.slice(1).forEach(date => {
    if (date === getNextDateKey(end)) {
      end = date;
      return;
    }

    ranges.push({ start, end, count: datesBetween(start, end) });
    start = date;
    end = date;
  });

  ranges.push({ start, end, count: datesBetween(start, end) });
  return ranges;
};

const datesBetween = (start: string, end: string) => {
  const startTime = parseDateAtNoon(start).getTime();
  const endTime = parseDateAtNoon(end).getTime();
  return Math.round((endTime - startTime) / 86400000) + 1;
};

const countUniqueRecordDates = (records: AttendanceRecord[]) => new Set(records.map(r => r.date)).size;

const rangesOverlap = (range: LeaveRange, start: string, end: string) =>
  range.start <= end && range.end >= start;

const getLeaveRecordsForOverlappingRanges = (records: AttendanceRecord[], start: string, end: string) => {
  const ranges = groupConsecutiveDates(records).filter(range => rangesOverlap(range, start, end));
  if (ranges.length === 0) return [];

  return records.filter(record => ranges.some(range => record.date >= range.start && record.date <= range.end));
};

const EmployeeFileModal: React.FC<EmployeeFileModalProps> = ({ employeeId, managerName, managerRole = 'encargado', onClose }) => {
  // Lógica robusta: Si es admin o super, NUNCA está restringido.
  const roleLower = managerRole.toLowerCase();
  const isAdmin = roleLower.includes('admin') || roleLower.includes('super');
  const isRestricted = roleLower.includes('encargado') && !isAdmin;
  
  const [employee, setEmployee] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'stats' | 'francos' | 'docs'>(!isRestricted ? 'profile' : 'francos');
  const [loading, setLoading] = useState(true);
  const [sectorName, setSectorName] = useState('Sin sector');
  
  // Date Range for stats
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Data states
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, lateMinutes: 0, vacation: 0, medical: 0, suspension: 0 });
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const [restLogs, setRestLogs] = useState<CompensatoryRestLog[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [scoring, setScoring] = useState<{score: number, label: string, color: string} | null>(null);
  
  // Actions states
  const [amount, setAmount] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [documentForm, setDocumentForm] = useState({
    type: 'other' as EmployeeDocument['type'],
    description: '',
    expires_at: '',
    is_required: false
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, [employeeId]);

  useEffect(() => {
    if (employeeId && dateRange.start && dateRange.end) {
      fetchStats();
    }
  }, [employeeId, dateRange, employee?.full_name]);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: empData } = await supabase.from('profiles').select('*').eq('id', employeeId).single();
    setEmployee(empData);
    if (empData?.sector_id) {
      const { data: sectorData } = await supabase.from('sectors').select('name').eq('id', empData.sector_id).maybeSingle();
      setSectorName(sectorData?.name || empData.sector_id || 'Sin sector');
    } else {
      setSectorName('Sin sector');
    }
    
    const [logs, docs, score] = await Promise.all([
      compensatoryRestService.getLogs(employeeId),
      supabase.from('employee_documents').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false }),
      attendanceService.calculateScoring(employeeId)
    ]);
    
    setRestLogs(logs);
    setDocuments(docs.data || []);
    setScoring(score);
    setLoading(false);
  };

  const fetchStats = async () => {
    // Query directa filtrada por empleado y rango — evita descargar toda la base
    const [attendanceRes, schedulesRes] = await Promise.all([
      supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date', { ascending: false }),
      supabase
        .from('schedules')
        .select('*')
        .eq('employee_id', employeeId)
        .in('type', ['vacation', 'medical'])
    ]);
    
    const empRecords = attendanceRes.data || [];
    const allLeaveSchedules = schedulesRes.data || [];
    const leaveSchedules = allLeaveSchedules.filter((shift: any) => shift.date >= dateRange.start && shift.date <= dateRange.end);
    const scheduleStatusByDate = new Map<string, 'vacaciones' | 'licencia_medica'>();
    leaveSchedules.forEach((shift: any) => {
      if (shift.type === 'vacation') scheduleStatusByDate.set(shift.date, 'vacaciones');
      if (shift.type === 'medical') scheduleStatusByDate.set(shift.date, 'licencia_medica');
    });

    const normalizedRecords = empRecords.filter(r => {
      const scheduledStatus = scheduleStatusByDate.get(r.date);
      return !scheduledStatus || !['ausente', 'pendiente'].includes(r.status);
    });

    const existingLeaveKeys = new Set(normalizedRecords.map(r => `${r.date}_${r.status}`));
    const scheduledLeaveRecords = leaveSchedules
      .map((shift: any) => {
        const status = shift.type === 'vacation' ? 'vacaciones' : shift.type === 'medical' ? 'licencia_medica' : null;
        if (!status || existingLeaveKeys.has(`${shift.date}_${status}`)) return null;
        return {
          id: `schedule-${shift.id || `${employeeId}-${shift.date}-${status}`}`,
          employee_id: employeeId,
          employee_name: employee?.full_name || '',
          date: shift.date,
          check_in: null,
          check_out: null,
          status,
          minutes_late: 0
        } as AttendanceRecord;
      })
      .filter(Boolean) as AttendanceRecord[];

    const allScheduledLeaveRecords = allLeaveSchedules
      .map((shift: any) => {
        const status = shift.type === 'vacation' ? 'vacaciones' : shift.type === 'medical' ? 'licencia_medica' : null;
        if (!status) return null;
        return {
          id: `schedule-full-${shift.id || `${employeeId}-${shift.date}-${status}`}`,
          employee_id: employeeId,
          employee_name: employee?.full_name || '',
          date: shift.date,
          check_in: null,
          check_out: null,
          status,
          minutes_late: 0
        } as AttendanceRecord;
      })
      .filter(Boolean) as AttendanceRecord[];

    const recordsForStats = [...normalizedRecords, ...scheduledLeaveRecords].sort((a, b) => b.date.localeCompare(a.date));
    const overlappingLeaveDetails = [
      ...getLeaveRecordsForOverlappingRanges(
        allScheduledLeaveRecords.filter(r => r.status === 'vacaciones'),
        dateRange.start,
        dateRange.end
      ),
      ...getLeaveRecordsForOverlappingRanges(
        allScheduledLeaveRecords.filter(r => r.status === 'licencia_medica'),
        dateRange.start,
        dateRange.end
      )
    ];
    const detailRecordsByKey = new Map<string, AttendanceRecord>();
    [...recordsForStats, ...overlappingLeaveDetails].forEach(record => {
      detailRecordsByKey.set(`${record.date}_${record.status}`, record);
    });
    setAllRecords(Array.from(detailRecordsByKey.values()).sort((a, b) => b.date.localeCompare(a.date)));

    const s = {
      present: recordsForStats.filter(r => ['presente', 'en_horario', 'manual'].includes(r.status)).length,
      absent: recordsForStats.filter(r => r.status === 'ausente').length,
      late: recordsForStats.filter(r => r.status === 'tarde' || r.status === 'sin_presentismo').length,
      lateMinutes: recordsForStats.reduce((acc, r) => acc + (r.minutes_late || 0), 0),
      vacation: countUniqueRecordDates(
        (overlappingLeaveDetails.some(r => r.status === 'vacaciones') ? overlappingLeaveDetails : recordsForStats)
          .filter(r => r.status === 'vacaciones')
      ),
      medical: countUniqueRecordDates(
        (overlappingLeaveDetails.some(r => r.status === 'licencia_medica') ? overlappingLeaveDetails : recordsForStats)
          .filter(r => r.status === 'licencia_medica')
      ),
      suspension: recordsForStats.filter(r => r.status === 'suspendido').length,
    };
    setStats(s);
  };

  const handleRestAction = async (type: 'credit' | 'payment' | 'adjustment') => {
    if (!reason.trim()) return alert('Indica un motivo');
    setSaving(true);
    let success = false;
    
    if (type === 'credit') {
      success = await compensatoryRestService.addLog({ employee_id: employeeId, amount: Math.abs(amount), type: 'credit', reason, manager_name: managerName });
    } else if (type === 'payment') {
      success = await compensatoryRestService.payRestDays(employeeId, amount, managerName, reason);
    } else if (type === 'adjustment') {
      success = await compensatoryRestService.adjustBalance(employeeId, amount, managerName, reason);
    }

    if (success) {
      setReason(''); setAmount(1);
      const updatedLogs = await compensatoryRestService.getLogs(employeeId);
      setRestLogs(updatedLogs);
      // Update local employee balance
      const balance = await compensatoryRestService.getBalance(employeeId);
      setEmployee(prev => prev ? { ...prev, compensatory_rest_balance: balance } : null);
    }
    setSaving(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${employeeId}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('employee-documents')
      .upload(fileName, file);

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('employee-documents').getPublicUrl(fileName);
      await supabase.from('employee_documents').insert([{
        employee_id: employeeId,
        type: documentForm.type,
        file_url: publicUrl,
        file_name: file.name,
        description: documentForm.description || reason || 'Documento cargado',
        expires_at: documentForm.expires_at || null,
        is_required: documentForm.is_required
      }]);
      
      const { data: newDocs } = await supabase.from('employee_documents').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false });
      setDocuments(newDocs || []);
      setReason('');
      setDocumentForm({ type: 'other', description: '', expires_at: '', is_required: false });
    }
    setUploading(false);
  };

  const handleExportPDF = async () => {
    if (!employee) return;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const margin = 18;
    let y = margin;

    // Header gradient block
    doc.setFillColor(79, 70, 229);
    doc.roundedRect(margin, y, pageW - margin * 2, 38, 5, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text('LEGAJO DIGITAL • SECUREQR HR MANAGEMENT', margin + 4, y + 7);
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text(employee.full_name.toUpperCase(), margin + 4, y + 18);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(`DNI: ${employee.dni || 'N/A'}  •  Rol: ${employee.role?.toUpperCase() || 'N/A'}`, margin + 4, y + 27);
    doc.text(`Fecha de exportación: ${new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, margin + 4, y + 33);
    if (scoring) {
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text(`SCORING: ${scoring.score}/999  |  ${scoring.label}`, pageW - margin - 4, y + 18, { align: 'right' });
    }
    doc.text(`FRANCOS: ${employee.compensatory_rest_balance || 0} jornadas`, pageW - margin - 4, y + 27, { align: 'right' });
    y += 48;

    // Labor profile
    doc.setTextColor(30, 30, 60);
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('DATOS LABORALES', margin, y); y += 7;
    const laborData = [
      ['Ingreso', employee.hire_date || 'Sin definir', 'Contratacion', getContractTypeLabel(employee.contract_type)],
      ['Tipo', getEmploymentTypeLabel(employee.employment_type), 'Sector', sectorName],
      ['Puesto', employee.job_position || 'Sin definir', 'Categoria', employee.job_category || 'Sin definir'],
    ];
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    laborData.forEach(([l1, v1, l2, v2]) => {
      doc.setFillColor(248, 250, 252); doc.roundedRect(margin, y, 82, 10, 2, 2, 'F');
      doc.setTextColor(100,116,139); doc.text(String(l1), margin + 3, y + 4);
      doc.setTextColor(30,41,59); doc.setFont('helvetica','bold'); doc.text(String(v1), margin + 78, y + 4, { align: 'right', maxWidth: 45 }); doc.setFont('helvetica','normal');
      doc.setFillColor(248, 250, 252); doc.roundedRect(margin + 88, y, 82, 10, 2, 2, 'F');
      doc.setTextColor(100,116,139); doc.text(String(l2), margin + 91, y + 4);
      doc.setTextColor(30,41,59); doc.setFont('helvetica','bold'); doc.text(String(v2), margin + 166, y + 4, { align: 'right', maxWidth: 45 }); doc.setFont('helvetica','normal');
      y += 12;
    });
    y += 4;

    // Stats section
    doc.setTextColor(30, 30, 60);
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(`• ESTADÍSTICAS (${dateRange.start} al ${dateRange.end})`, margin, y); y += 7;
    const statData = [
      ['Jornadas', stats.present, 'Ausencias', stats.absent],
      ['Tardanzas', stats.late, 'Minutos Tarde', stats.lateMinutes],
      ['Vacaciones', stats.vacation, 'Licencias Médicas', stats.medical],
      ['Suspensiones', stats.suspension, '', ''],
    ];
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    statData.forEach(([l1, v1, l2, v2]) => {
      doc.setFillColor(245, 245, 255); doc.roundedRect(margin, y, 82, 10, 2, 2, 'F');
      doc.setTextColor(80,80,120); doc.text(String(l1), margin + 3, y + 4);
      doc.setTextColor(30,30,60); doc.setFont('helvetica','bold'); doc.text(String(v1), margin + 78, y + 4, { align: 'right' }); doc.setFont('helvetica','normal');
      doc.setFillColor(245, 245, 255); doc.roundedRect(margin + 88, y, 82, 10, 2, 2, 'F');
      doc.setTextColor(80,80,120); doc.text(String(l2), margin + 91, y + 4);
      doc.setTextColor(30,30,60); doc.setFont('helvetica','bold'); doc.text(String(v2), margin + 166, y + 4, { align: 'right' }); doc.setFont('helvetica','normal');
      y += 12;
    });
    y += 4;

    // Vacation dates
    const vacations = allRecords.filter(r => r.status === 'vacaciones');
    const vacationRanges = groupConsecutiveDates(vacations);
    const vacationDays = vacationRanges.reduce((acc, range) => acc + range.count, 0);
    if (vacationRanges.length > 0) {
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(30,30,60);
      doc.text(`• DETALLE DE VACACIONES (${vacationDays})`, margin, y); y += 7;
      doc.setFontSize(8); doc.setFont('helvetica','normal');
      vacationRanges.slice(0, 20).forEach((range, i) => {
        const dateStr = formatLeaveRange(range);
        doc.setFillColor(i % 2 === 0 ? 240 : 235, i % 2 === 0 ? 253 : 247, i % 2 === 0 ? 244 : 240);
        doc.roundedRect(margin, y, pageW - margin * 2, 7, 1, 1, 'F');
        doc.setTextColor(20,100,70); doc.text(dateStr, margin + 3, y + 4.5);
        doc.setTextColor(10,140,90); doc.text(`VACACIONES${range.count > 1 ? ` - ${range.count} días` : ''}`, pageW - margin - 3, y + 4.5, { align: 'right' });
        y += 8;
        if (y > 270) { doc.addPage(); y = margin; }
      });
      if (vacationRanges.length > 20) { doc.setTextColor(100,100,100); doc.text(`... y ${vacationRanges.length - 20} períodos más`, margin, y); y += 6; }
      y += 4;
    }

    // Medical leave dates
    const medicalLeaves = allRecords.filter(r => r.status === 'licencia_medica');
    const medicalRanges = groupConsecutiveDates(medicalLeaves);
    const medicalDays = medicalRanges.reduce((acc, range) => acc + range.count, 0);
    if (medicalRanges.length > 0) {
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(30,30,60);
      doc.text(`• DETALLE DE LICENCIAS MÉDICAS (${medicalDays})`, margin, y); y += 7;
      doc.setFontSize(8); doc.setFont('helvetica','normal');
      medicalRanges.slice(0, 20).forEach((range, i) => {
        const dateStr = formatLeaveRange(range);
        doc.setFillColor(i % 2 === 0 ? 240 : 235, i % 2 === 0 ? 249 : 245, i % 2 === 0 ? 255 : 252);
        doc.roundedRect(margin, y, pageW - margin * 2, 7, 1, 1, 'F');
        doc.setTextColor(20,80,120); doc.text(dateStr, margin + 3, y + 4.5);
        doc.setTextColor(0,120,180); doc.text(`LICENCIA MÉDICA${range.count > 1 ? ` - ${range.count} días` : ''}`, pageW - margin - 3, y + 4.5, { align: 'right' });
        y += 8;
        if (y > 270) { doc.addPage(); y = margin; }
      });
      if (medicalRanges.length > 20) { doc.setTextColor(100,100,100); doc.text(`... y ${medicalRanges.length - 20} períodos más`, margin, y); y += 6; }
      y += 4;
    }

    // Absence dates
    const absences = allRecords.filter(r => r.status === 'ausente').sort((a,b) => b.date.localeCompare(a.date));
    if (absences.length > 0) {
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(30,30,60);
      doc.text(`• DETALLE DE AUSENCIAS (${absences.length})`, margin, y); y += 7;
      doc.setFontSize(8); doc.setFont('helvetica','normal');
      absences.slice(0, 20).forEach((r, i) => {
        const dateStr = new Date(r.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        doc.setFillColor(i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 245 : 245, i % 2 === 0 ? 245 : 255);
        doc.roundedRect(margin, y, pageW - margin * 2, 7, 1, 1, 'F');
        doc.setTextColor(60,30,30); doc.text(dateStr, margin + 3, y + 4.5);
        doc.setTextColor(150,30,30); doc.text('AUSENTE', pageW - margin - 3, y + 4.5, { align: 'right' });
        y += 8;
        if (y > 270) { doc.addPage(); y = margin; }
      });
      if (absences.length > 20) { doc.setTextColor(100,100,100); doc.text(`... y ${absences.length - 20} registros más`, margin, y); y += 6; }
      y += 4;
    }

    // Late dates
    const lates = allRecords.filter(r => ['tarde','sin_presentismo'].includes(r.status)).sort((a,b) => b.date.localeCompare(a.date));
    if (lates.length > 0) {
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(30,30,60);
      doc.text(`• DETALLE DE TARDANZAS (${lates.length})`, margin, y); y += 7;
      doc.setFontSize(8); doc.setFont('helvetica','normal');
      lates.slice(0, 15).forEach((r, i) => {
        const dateStr = new Date(r.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        doc.setFillColor(i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 251 : 248, i % 2 === 0 ? 235 : 230);
        doc.roundedRect(margin, y, pageW - margin * 2, 7, 1, 1, 'F');
        doc.setTextColor(60,50,10); doc.text(dateStr, margin + 3, y + 4.5);
        doc.setTextColor(150,100,10); doc.text(`${r.minutes_late || 0} min tarde`, pageW - margin - 3, y + 4.5, { align: 'right' });
        y += 8;
        if (y > 270) { doc.addPage(); y = margin; }
      });
      y += 4;
    }

    // Compensatory rest log
    if (restLogs.length > 0) {
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(30,30,60);
      doc.text(`• BANCO DE FRANCOS COMPENSATORIOS`, margin, y); y += 7;
      doc.setFontSize(8); doc.setFont('helvetica','normal');
      restLogs.slice(0, 15).forEach((log, i) => {
        doc.setFillColor(i % 2 === 0 ? 245 : 240, i % 2 === 0 ? 250 : 245, i % 2 === 0 ? 255 : 250);
        doc.roundedRect(margin, y, pageW - margin * 2, 7, 1, 1, 'F');
        doc.setTextColor(30,30,80); doc.text(log.reason || 'Sin motivo', margin + 3, y + 4.5);
        const sign = log.amount > 0 ? '+' : '';
        doc.setTextColor(log.amount > 0 ? 20 : 150, log.amount > 0 ? 120 : 20, 20);
        doc.text(`${sign}${log.amount} jornadas`, pageW - margin - 3, y + 4.5, { align: 'right' });
        y += 8;
        if (y > 270) { doc.addPage(); y = margin; }
      });
      y += 4;
    }

    // Footer
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 287, 210, 10, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont('helvetica','normal');
    doc.text('SECUREQR HR MANAGEMENT • DOCUMENTO CONFIDENCIAL', 105, 293, { align: 'center' });

    doc.save(`Legajo_${employee.full_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (!employee) return null;

  const todayKey = new Date().toISOString().substring(0, 10);
  const expiredDocuments = documents.filter(doc => doc.expires_at && doc.expires_at < todayKey);
  const expiringDocuments = documents.filter(doc => {
    if (!doc.expires_at || doc.expires_at < todayKey) return false;
    const diffDays = Math.ceil((parseDateAtNoon(doc.expires_at).getTime() - parseDateAtNoon(todayKey).getTime()) / 86400000);
    return diffDays <= 30;
  });
  const missingFields = [
    !employee.hire_date ? 'Fecha de ingreso' : null,
    !employee.job_position ? 'Puesto' : null,
    !employee.job_category ? 'Categoria' : null,
    !employee.contract_type ? 'Contratacion' : null,
    !employee.dni ? 'DNI' : null,
  ].filter(Boolean) as string[];
  const leaveRanges = groupConsecutiveDates(allRecords.filter(r => ['vacaciones', 'licencia_medica'].includes(r.status)));
  const disciplinaryDocuments = documents.filter(doc => doc.type === 'suspension');
  const timelineEvents = [
    employee.hire_date ? {
      date: employee.hire_date,
      title: 'Ingreso laboral',
      detail: `${getContractTypeLabel(employee.contract_type)} - ${sectorName}`,
      tone: 'emerald'
    } : null,
    ...leaveRanges.slice(0, 5).map(range => ({
      date: range.start,
      title: 'Licencia registrada',
      detail: `${formatLeaveRange(range)} (${range.count} dia${range.count !== 1 ? 's' : ''})`,
      tone: 'sky'
    })),
    ...disciplinaryDocuments.slice(0, 5).map(doc => ({
      date: doc.created_at.substring(0, 10),
      title: 'Registro disciplinario',
      detail: doc.description || doc.file_name,
      tone: 'rose'
    })),
    ...documents.slice(0, 5).map(doc => ({
      date: doc.created_at.substring(0, 10),
      title: `Documento: ${getDocumentTypeLabel(doc.type)}`,
      detail: doc.description || doc.file_name,
      tone: doc.expires_at && doc.expires_at < todayKey ? 'amber' : 'slate'
    }))
  ]
    .filter(Boolean)
    .sort((a: any, b: any) => b.date.localeCompare(a.date))
    .slice(0, 8) as Array<{ date: string; title: string; detail: string; tone: string }>;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[95vh] md:h-[92vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="bg-white border-b border-slate-200 p-4 md:p-7 text-slate-900 relative">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-all z-10 md:hidden">
            <X className="w-6 h-6 text-slate-500" />
          </button>

          <div className="flex flex-col xl:flex-row justify-between items-start gap-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6 w-full min-w-0">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                {employee.photo_url ? (
                  <img src={employee.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 md:w-12 md:h-12 text-slate-400" />
                )}
              </div>
              <div className="text-center md:text-left flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
                  <span className="px-2 py-1 bg-slate-100 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500">Expediente laboral</span>
                  <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-100">Activo</span>
                  {missingFields.length > 0 && (
                    <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-[9px] font-black uppercase tracking-widest border border-amber-100">
                      {missingFields.length} datos pendientes
                    </span>
                  )}
                </div>
                <h2 className="text-2xl md:text-4xl font-black tracking-tight truncate w-full text-slate-900">{employee.full_name}</h2>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 md:gap-4 mt-2 text-slate-500 font-bold text-xs md:text-sm">
                  <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> DNI: {employee.dni}</span>
                  <span className="hidden md:block w-1 h-1 bg-slate-300 rounded-full" />
                  <span>{employee.job_position || employee.role?.toUpperCase()}</span>
                  <span className="hidden md:block w-1 h-1 bg-slate-300 rounded-full" />
                  <span>{sectorName}</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-center xl:items-end gap-4 w-full xl:w-auto">
              <div className="hidden md:flex items-center gap-2">
                {!isRestricted && (
                  <button
                    onClick={handleExportPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 rounded-xl text-white text-xs font-black uppercase tracking-widest transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Exportar PDF
                  </button>
                )}
                <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-full transition-all">
                  <X className="w-7 h-7 text-slate-500" />
                </button>
              </div>

              {/* Mobile Export Button */}
              {!isRestricted && (
                <button
                  onClick={handleExportPDF}
                  className="md:hidden flex items-center justify-center gap-2 w-full px-4 py-3 bg-slate-900 hover:bg-slate-800 rounded-xl text-white text-xs font-black uppercase tracking-widest transition-all"
                >
                  <Download className="w-4 h-4" />
                  Exportar Reporte PDF
                </button>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 xl:flex xl:items-stretch gap-3 w-full xl:w-auto">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center xl:text-right min-w-[120px]">
                  <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-400">Antiguedad</p>
                  <p className="text-sm md:text-lg font-black text-slate-800 leading-tight mt-1">{getTenureLabel(employee.hire_date)}</p>
                </div>
                {scoring && managerRole !== 'encargado' && (
                  <div className={`p-3 rounded-xl border text-center xl:text-right min-w-[120px] ${scoring.color}`}>
                    <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest opacity-70">Scoring Actual</p>
                    <p className="text-xl md:text-2xl font-black">{scoring.score}</p>
                  </div>
                )}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center xl:text-right min-w-[120px]">
                  <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-400">Francos</p>
                  <p className="text-xl md:text-2xl font-black text-slate-800">{employee.compensatory_rest_balance || 0}</p>
                </div>
                <div className={`${expiredDocuments.length > 0 ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-700'} p-3 rounded-xl border text-center xl:text-right min-w-[120px]`}>
                  <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest opacity-70">Documentos</p>
                  <p className="text-xl md:text-2xl font-black">{expiredDocuments.length > 0 ? `${expiredDocuments.length} venc.` : documents.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 px-4 md:px-8 bg-slate-50/50 overflow-x-auto no-scrollbar">
          <div className="flex min-w-max">
            {[
              { id: 'profile', label: 'Legajo', icon: Briefcase, hidden: isRestricted },
              { id: 'stats', label: 'Asistencia', icon: TrendingUp, hidden: isRestricted },
              { id: 'francos', label: 'Francos', icon: CreditCard },
              { id: 'docs', label: 'Documentos', icon: Camera, hidden: isRestricted },
            ].filter(t => !t.hidden).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 md:px-6 py-4 md:py-5 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border-b-4 shrink-0 ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                <tab.icon className="w-3.5 h-3.5 md:w-4 md:h-4" /> {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/30">

          {activeTab === 'profile' && employee && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              {(missingFields.length > 0 || expiredDocuments.length > 0 || expiringDocuments.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {missingFields.length > 0 && (
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4">
                      <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Legajo incompleto</p>
                      <p className="text-sm font-bold text-amber-800 mt-1">{missingFields.join(', ')}</p>
                    </div>
                  )}
                  {expiredDocuments.length > 0 && (
                    <div className="bg-rose-50 border border-rose-100 rounded-2xl px-5 py-4">
                      <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest">Documentos vencidos</p>
                      <p className="text-sm font-bold text-rose-800 mt-1">{expiredDocuments.length} requieren revision</p>
                    </div>
                  )}
                  {expiringDocuments.length > 0 && (
                    <div className="bg-sky-50 border border-sky-100 rounded-2xl px-5 py-4">
                      <p className="text-[10px] font-black text-sky-700 uppercase tracking-widest">Por vencer</p>
                      <p className="text-sm font-bold text-sky-800 mt-1">{expiringDocuments.length} en los proximos 30 dias</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Briefcase className="w-6 h-6 text-slate-700" />
                    <div>
                      <h3 className="text-xl font-black text-slate-800">Datos laborales</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ficha principal del expediente</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      ['Nombre completo', employee.full_name],
                      ['DNI', employee.dni || 'Sin definir'],
                      ['Fecha de ingreso', employee.hire_date ? formatDateLong(employee.hire_date) : 'Sin definir'],
                      ['Tipo de contratacion', getContractTypeLabel(employee.contract_type)],
                      ['Tipo de personal', getEmploymentTypeLabel(employee.employment_type)],
                      ['Sector actual', sectorName],
                      ['Puesto', employee.job_position || 'Sin definir'],
                      ['Categoria', employee.job_category || 'Sin definir'],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                        <p className="text-sm font-black text-slate-700 mt-1">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Building2 className="w-6 h-6 text-slate-700" />
                    <div>
                      <h3 className="text-xl font-black text-slate-800">Resumen</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Estado laboral</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                      <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Estado</span>
                      <span className="text-xs font-black text-emerald-700">Activo</span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                      <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Antiguedad</span>
                      <span className="text-xs font-black text-slate-700">{getTenureLabel(employee.hire_date)}</span>
                    </div>
                    <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                      <span className="text-xs font-black text-indigo-700 uppercase tracking-widest">Documentos</span>
                      <span className="text-xs font-black text-indigo-700">{documents.length}</span>
                    </div>
                    <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                      <span className="text-xs font-black text-amber-700 uppercase tracking-widest">Vencidos</span>
                      <span className="text-xs font-black text-amber-700">
                        {expiredDocuments.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <Calendar className="w-5 h-5 text-sky-600" />
                    <h3 className="text-lg font-black text-slate-800">Historial de licencias</h3>
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {groupConsecutiveDates(allRecords.filter(r => ['vacaciones', 'licencia_medica'].includes(r.status))).length === 0 ? (
                      <p className="text-sm font-bold text-slate-400">Sin licencias registradas en el rango actual.</p>
                    ) : groupConsecutiveDates(allRecords.filter(r => ['vacaciones', 'licencia_medica'].includes(r.status))).map(range => (
                      <div key={`${range.start}_${range.end}`} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                        <p className="text-sm font-black text-slate-700">{formatLeaveRange(range)}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{range.count} dia{range.count !== 1 ? 's' : ''}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <ShieldAlert className="w-5 h-5 text-rose-600" />
                    <h3 className="text-lg font-black text-slate-800">Historial disciplinario</h3>
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {documents.filter(doc => doc.type === 'suspension').length === 0 ? (
                      <p className="text-sm font-bold text-slate-400">Sin antecedentes disciplinarios cargados.</p>
                    ) : documents.filter(doc => doc.type === 'suspension').map(doc => (
                      <a key={doc.id} href={doc.file_url} target="_blank" rel="noreferrer" className="block bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 hover:bg-rose-100">
                        <p className="text-sm font-black text-rose-700">{doc.description || doc.file_name}</p>
                        <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">{new Date(doc.created_at).toLocaleDateString()}</p>
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-6">
                  <History className="w-5 h-5 text-slate-700" />
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Linea de tiempo del legajo</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Eventos laborales, documentos, licencias y registros</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {timelineEvents.length === 0 ? (
                    <p className="text-sm font-bold text-slate-400">Todavia no hay eventos suficientes para mostrar.</p>
                  ) : timelineEvents.map((event, index) => (
                    <div key={`${event.date}_${event.title}_${index}`} className="grid grid-cols-[110px_1fr] gap-4">
                      <div className="text-right">
                        <p className="text-xs font-black text-slate-500">{event.date}</p>
                      </div>
                      <div className="relative pl-5 pb-4 border-l border-slate-200">
                        <span className={`absolute -left-1.5 top-1 w-3 h-3 rounded-full ${
                          event.tone === 'emerald' ? 'bg-emerald-500' :
                          event.tone === 'sky' ? 'bg-sky-500' :
                          event.tone === 'rose' ? 'bg-rose-500' :
                          event.tone === 'amber' ? 'bg-amber-500' :
                          'bg-slate-400'
                        }`} />
                        <p className="text-sm font-black text-slate-800">{event.title}</p>
                        <p className="text-xs font-bold text-slate-500 mt-1">{event.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'stats' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              {/* Range Selector */}
              <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <Calendar className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" />
                  <span className="font-black text-slate-700 uppercase text-[10px] md:text-xs tracking-widest">Rango de Análisis</span>
                </div>
                <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto justify-between md:justify-end">
                  <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="flex-1 md:flex-none px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs md:text-sm text-slate-600 focus:outline-none focus:ring-2 ring-indigo-500/20" />
                  <ChevronRight className="w-4 h-4 text-slate-300 hidden md:block" />
                  <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="flex-1 md:flex-none px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs md:text-sm text-slate-600 focus:outline-none focus:ring-2 ring-indigo-500/20" />
                </div>
              </div>

              {/* Stats Grid - Interactive */}
              {(() => {
                const statCards = [
                  { key: 'present', label: 'Jornadas', val: stats.present, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-400', statuses: ['presente','en_horario','manual'] },
                  { key: 'absent', label: 'Ausencias', val: stats.absent, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', ring: 'ring-rose-400', statuses: ['ausente'] },
                  { key: 'late', label: 'Tardanzas', val: stats.late, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', ring: 'ring-amber-400', statuses: ['tarde','sin_presentismo'] },
                  { key: 'lateMinutes', label: 'Min. Tarde', val: stats.lateMinutes, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', ring: 'ring-orange-400', statuses: ['tarde','sin_presentismo'] },
                  { key: 'vacation', label: 'Vacaciones', val: stats.vacation, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-400', statuses: ['vacaciones'] },
                  { key: 'medical', label: 'L. Médicas', val: stats.medical, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200', ring: 'ring-sky-400', statuses: ['licencia_medica'] },
                  { key: 'suspension', label: 'Suspensiones', val: stats.suspension, color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-300', ring: 'ring-slate-400', statuses: ['suspendido'] },
                ];
                const activeCard = statCards.find(c => c.key === selectedStat);
                const detailRecords = activeCard
                  ? allRecords.filter(r => activeCard.statuses.includes(r.status)).sort((a,b) => b.date.localeCompare(a.date))
                  : [];
                const shouldGroupDetail = activeCard?.key === 'vacation' || activeCard?.key === 'medical';
                const detailRanges = shouldGroupDetail ? groupConsecutiveDates(detailRecords) : [];
                const detailCount = shouldGroupDetail
                  ? detailRanges.reduce((acc, range) => acc + range.count, 0)
                  : detailRecords.length;
                const detailUnit = shouldGroupDetail ? 'día' : 'registro';
                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {statCards.map(s => (
                        <button
                          key={s.key}
                          onClick={() => setSelectedStat(selectedStat === s.key ? null : s.key)}
                          className={`p-6 rounded-[2rem] border-2 transition-all text-center cursor-pointer hover:scale-[1.03] active:scale-[0.98] ${
                            selectedStat === s.key
                              ? `${s.bg} ${s.border} ring-2 ${s.ring} shadow-lg`
                              : `${s.bg} border-slate-100 hover:${s.border}`
                          }`}
                        >
                          <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{s.label}</p>
                          <p className={`text-xl md:text-3xl font-black ${s.color}`}>{s.val}</p>
                          {s.val > 0 && <p className="text-[7px] md:text-[9px] font-bold text-slate-400 mt-1 uppercase">Tocar para detalle</p>}
                        </button>
                      ))}
                    </div>

                    {/* Detail drill-down panel */}
                    {selectedStat && activeCard && detailRecords.length > 0 && (
                      <div className={`rounded-[2rem] border-2 ${activeCard.border} ${activeCard.bg} overflow-hidden animate-in slide-in-from-top-2 duration-200`}>
                        <div className={`px-6 py-4 flex items-center justify-between border-b ${activeCard.border}`}>
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-black uppercase tracking-widest ${activeCard.color}`}>
                              {activeCard.label} — {detailCount} {detailUnit}{detailCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <button onClick={() => setSelectedStat(null)} className="text-slate-400 hover:text-slate-600 font-black text-lg leading-none">×</button>
                        </div>
                        <div className="max-h-48 overflow-y-auto divide-y divide-white/50">
                          {shouldGroupDetail ? detailRanges.map(range => (
                            <div key={`${range.start}_${range.end}`} className="flex items-center justify-between px-6 py-3">
                              <div>
                                <p className={`text-sm font-black ${activeCard.color}`}>
                                  {formatLeaveRange(range)}
                                </p>
                                {range.count > 1 && (
                                  <p className="text-xs font-bold text-slate-500">{range.count} días corridos</p>
                                )}
                              </div>
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${activeCard.bg} ${activeCard.color} border ${activeCard.border}`}>
                                {activeCard.label}
                              </span>
                            </div>
                          )) : detailRecords.map(r => (
                            <div key={r.id} className="flex items-center justify-between px-6 py-3">
                              <div>
                                <p className={`text-sm font-black ${activeCard.color}`}>
                                  {formatDateLong(r.date)}
                                </p>
                                {r.minutes_late > 0 && (
                                  <p className="text-xs font-bold text-slate-500">{r.minutes_late} minutos tarde</p>
                                )}
                              </div>
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${activeCard.bg} ${activeCard.color} border ${activeCard.border}`}>
                                {r.status.replace('_', ' ')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {activeTab === 'francos' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-2">
              {!isRestricted ? (
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                    <h3 className="text-xl font-black text-slate-800">Carga / Ajuste</h3>
                    <div className="space-y-4">
                      <input 
                        type="number" 
                        value={amount} 
                        onChange={e => setAmount(Number(e.target.value))} 
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-2xl text-center" 
                      />
                      <textarea placeholder="Motivo (ej: Domingos trabajados Marzo)" value={reason} onChange={e => setReason(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm h-24" />
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleRestAction('credit')} disabled={saving} className="py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 shadow-lg shadow-emerald-500/20">Sumar Jornada</button>
                        <button onClick={() => handleRestAction('payment')} disabled={saving} className="py-4 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-600 shadow-lg shadow-amber-500/20">Liquidar Pago</button>
                      </div>
                      <button onClick={() => handleRestAction('adjustment')} disabled={saving} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black">Ajuste Manual Saldo</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="lg:col-span-1">
                  <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100">
                    <p className="text-xs font-bold text-indigo-700 leading-relaxed">
                      Como <strong>Encargado/a</strong>, tienes acceso de solo lectura a este saldo. Contacta a un Administrador para realizar ajustes manuales.
                    </p>
                  </div>
                </div>
              )}
              
              <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className="p-8 border-b border-slate-50 flex items-center gap-3">
                  <History className="w-6 h-6 text-indigo-600" />
                  <h3 className="text-xl font-black text-slate-800">Movimientos Recientes</h3>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto max-h-[400px]">
                  {restLogs.map(log => (
                    <div key={log.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${log.amount > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                          {log.amount > 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-black text-slate-700 text-sm leading-tight">{log.reason}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                            {new Date(log.created_at).toLocaleDateString()} • Por: {log.manager_name}
                          </p>
                        </div>
                      </div>
                      <div className={`text-xl font-black ${log.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {log.amount > 0 ? `+${log.amount}` : log.amount}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'docs' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8">
                {/* Upload Card */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col text-center gap-4 h-fit">
                  <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-all">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="font-black text-slate-700">Subir Documento</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Contratos, certificados, sanciones o constancias</p>
                  </div>
                  <div className="w-full space-y-3 text-left">
                    <select
                      value={documentForm.type}
                      onChange={event => setDocumentForm(prev => ({ ...prev, type: event.target.value as EmployeeDocument['type'] }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700"
                    >
                      <option value="identity">{getDocumentTypeLabel('identity')}</option>
                      <option value="contract">{getDocumentTypeLabel('contract')}</option>
                      <option value="medical">{getDocumentTypeLabel('medical')}</option>
                      <option value="suspension">{getDocumentTypeLabel('suspension')}</option>
                      <option value="certificate">{getDocumentTypeLabel('certificate')}</option>
                      <option value="training">{getDocumentTypeLabel('training')}</option>
                      <option value="other">{getDocumentTypeLabel('other')}</option>
                    </select>
                    <input
                      type="text"
                      value={documentForm.description}
                      onChange={event => setDocumentForm(prev => ({ ...prev, description: event.target.value }))}
                      placeholder="Descripcion para auditoria"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700"
                    />
                    <input
                      type="date"
                      value={documentForm.expires_at}
                      onChange={event => setDocumentForm(prev => ({ ...prev, expires_at: event.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700"
                    />
                    <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
                      <input
                        type="checkbox"
                        checked={documentForm.is_required}
                        onChange={event => setDocumentForm(prev => ({ ...prev, is_required: event.target.checked }))}
                        className="w-4 h-4 rounded text-indigo-600"
                      />
                      Documento obligatorio
                    </label>
                  </div>
                  <input type="file" onChange={handleFileUpload} className="hidden" id="file-upload" />
                  <label htmlFor="file-upload" className="cursor-pointer px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-500/20">
                    {uploading ? 'Subiendo...' : 'Seleccionar Archivo'}
                  </label>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black text-slate-800">Matriz documental</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{documents.length} documentos cargados</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {expiredDocuments.length > 0 && (
                        <span className="px-3 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-black uppercase tracking-widest">{expiredDocuments.length} vencidos</span>
                      )}
                      {expiringDocuments.length > 0 && (
                        <span className="px-3 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-black uppercase tracking-widest">{expiringDocuments.length} por vencer</span>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {documents.length === 0 ? (
                      <div className="p-10 text-center text-slate-400 font-bold">No hay documentos cargados.</div>
                    ) : documents.map(doc => {
                      const isExpired = !!doc.expires_at && doc.expires_at < todayKey;
                      const isExpiring = !!doc.expires_at && !isExpired && Math.ceil((parseDateAtNoon(doc.expires_at).getTime() - parseDateAtNoon(todayKey).getTime()) / 86400000) <= 30;
                      return (
                        <div key={doc.id} className="p-5 hover:bg-slate-50 transition-colors">
                          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest">{getDocumentTypeLabel(doc.type)}</span>
                                {doc.is_required && (
                                  <span className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-black uppercase tracking-widest">Obligatorio</span>
                                )}
                                {isExpired ? (
                                  <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-100 text-[9px] font-black uppercase tracking-widest">Vencido</span>
                                ) : isExpiring ? (
                                  <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 text-[9px] font-black uppercase tracking-widest">Por vencer</span>
                                ) : (
                                  <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black uppercase tracking-widest">Vigente</span>
                                )}
                              </div>
                              <p className="font-black text-slate-800 truncate">{doc.description || doc.file_name}</p>
                              <p className="text-xs font-bold text-slate-400 mt-1 truncate">{doc.file_name}</p>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
                              <div className="text-left sm:text-right">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cargado</p>
                                <p className="text-xs font-black text-slate-700">{new Date(doc.created_at).toLocaleDateString()}</p>
                              </div>
                              <div className="text-left sm:text-right min-w-[90px]">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vencimiento</p>
                                <p className={`text-xs font-black ${isExpired ? 'text-rose-700' : isExpiring ? 'text-amber-700' : 'text-slate-700'}`}>{doc.expires_at || 'No aplica'}</p>
                              </div>
                              <a href={doc.file_url} target="_blank" rel="noreferrer" className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest text-center">
                                Ver
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-3 px-6 md:px-12">
          <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center md:text-left">SecureQR HR Management • Confidential</p>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-600" />
            <span className="text-[8px] md:text-[10px] font-black text-indigo-600 uppercase tracking-widest">Sincronizado con Supabase Cloud</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EmployeeFileModal;

