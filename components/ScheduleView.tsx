import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Save,
  X,
  AlertTriangle,
  History,
  Lock,
  Unlock,
  Printer,
  Download,
  Search,
  CreditCard,
  CheckCircle2
} from 'lucide-react';
import JSZip from 'jszip';
import { AttendanceRecord, Profile } from '../types';
import { scheduleService, ShiftData, ShiftType, ShiftSegment } from '../services/scheduleService';
import { auditService } from '../services/auditService';
import { sectorService, Sector } from '../services/sectorService';
import { getLocalDateString } from '../utils/dateUtils';
import { compensatoryRestService, CompRestReconcileSummary } from '../services/compensatoryRestService';
import { settingsService } from '../services/settingsService';
import { attendanceService } from '../services/attendanceService';
import { personnelService } from '../services/personnelService';
import EmployeeFileModal from './EmployeeFileModal';
import { WorldCupPitch } from './WorldCupPitch';

interface ScheduleViewProps {
  employees?: Profile[];
  setEmployees?: React.Dispatch<React.SetStateAction<Profile[]>>;
  currentUser?: Profile;
}

const defaultEmployees: Profile[] = [];
const defaultUser = { full_name: 'Guest', role: 'invitado', sector_id: '' } as unknown as Profile;
const SCHEDULE_VIEW_STATE_KEY = 'secureqr_schedule_view_state';

type ScheduleViewStoredState = {
  weekStart?: string;
  searchTerm?: string;
  selectedSector?: string;
  selectedEmploymentType?: 'all' | 'efectivo' | 'jornalero';
};

const getStoredScheduleViewState = (): ScheduleViewStoredState => {
  try {
    const raw = sessionStorage.getItem(SCHEDULE_VIEW_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatDate = (date: Date) => {
  return getLocalDateString(date);
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const ScheduleView: React.FC<ScheduleViewProps> = ({
  employees = defaultEmployees,
  setEmployees,
  currentUser = defaultUser
}) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const stored = getStoredScheduleViewState();
    return stored.weekStart ? new Date(`${stored.weekStart}T00:00:00`) : getStartOfWeek(new Date());
  });
  const [shifts, setShifts] = useState<Record<string, ShiftData>>({});
  const [sectorMap, setSectorMap] = useState<Record<string, string>>({});
  const [holidayMap, setHolidayMap] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState(() => getStoredScheduleViewState().searchTerm || '');
  const [isCompRestEnabled, setIsCompRestEnabled] = useState(false);
  const [isWorldCupMode, setIsWorldCupMode] = useState(false);
  const [selectedFileEmployeeId, setSelectedFileEmployeeId] = useState<string | null>(null);
  const [selectedEmploymentType, setSelectedEmploymentType] = useState<'all' | 'efectivo' | 'jornalero'>(() => getStoredScheduleViewState().selectedEmploymentType || 'all');
  const [saving, setSaving] = useState(false);
  const [reconcilingCompRest, setReconcilingCompRest] = useState(false);
  const [compRestSummary, setCompRestSummary] = useState<CompRestReconcileSummary | null>(null);
  const saveInProgressRef = useRef(false);
  const lastCompCreditSyncKeyRef = useRef<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const canReconcileCompRest = currentUser.role === 'administrador' || currentUser.role === 'superusuario';

  const getEmploymentTypeLabel = (type?: string) => type === 'jornalero' ? 'Jornalero' : 'Efectivo';

  useEffect(() => {
    const fetchSectors = async () => {
      const data = await sectorService.getAll();
      const map: Record<string, string> = {};
      data.forEach(s => map[s.id] = s.name);
      setSectorMap(map);
    };

    const checkMasterConfig = async () => {
      const rules = await settingsService.getRules();
      setIsCompRestEnabled(!!rules.enable_compensatory_rest);
    };

    const fetchHolidays = async () => {
      const data = await compensatoryRestService.getHolidays();
      const map: Record<string, string> = {};
      data.forEach(h => {
        map[h.date] = h.name;
      });
      setHolidayMap(map);
    };

    fetchSectors();
    checkMasterConfig();
    fetchHolidays();
  }, []);

  useEffect(() => {
    const fetchShifts = async () => {
      const startDate = formatDate(currentWeekStart);
      const endDate = formatDate(addDays(currentWeekStart, 6));
      const data = await scheduleService.getByWeek(startDate, endDate);
      const shiftMap = data.reduce((acc, shift) => {
        acc[shift.id] = shift;
        return acc;
      }, {} as Record<string, ShiftData>);
      setShifts(shiftMap);
    };
    fetchShifts();
  }, [currentWeekStart]);

  useEffect(() => {
    if (!isCompRestEnabled) return;

    const shiftCount = Object.keys(shifts).length;
    const startDate = formatDate(currentWeekStart);
    const endDate = formatDate(addDays(currentWeekStart, 6));
    const weekKey = `${startDate}_${endDate}_${shiftCount}`;
    if (lastCompCreditSyncKeyRef.current === weekKey) return;

    const syncMissingCompCredits = async () => {
      lastCompCreditSyncKeyRef.current = weekKey;
      const summary = await compensatoryRestService.reconcileCompensatoryCredits(
        startDate,
        endDate,
        currentUser.full_name || 'System Auto'
      );

      if ((summary.created > 0 || summary.existing > 0) && setEmployees) {
        const updatedEmployees = await personnelService.getAll();
        setEmployees(updatedEmployees);
      }
    };

    void syncMissingCompCredits();
  }, [currentWeekStart, currentUser.full_name, isCompRestEnabled, setEmployees, shifts]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<{ empId: string; date: Date; empName: string } | null>(null);
  const [editForm, setEditForm] = useState<{ type: ShiftType; s1Start: string; s1End: string; s2Start: string; s2End: string; startDate?: string; endDate?: string }>({
    type: 'continuous',
    s1Start: '08:00',
    s1End: '17:00',
    s2Start: '',
    s2End: '',
    startDate: '',
    endDate: ''
  });

  const [selectedSector, setSelectedSector] = useState<string>(() => getStoredScheduleViewState().selectedSector || 'all');

  useEffect(() => {
    const state: ScheduleViewStoredState = {
      weekStart: formatDate(currentWeekStart),
      searchTerm,
      selectedSector,
      selectedEmploymentType
    };
    sessionStorage.setItem(SCHEDULE_VIEW_STATE_KEY, JSON.stringify(state));
  }, [currentWeekStart, searchTerm, selectedSector, selectedEmploymentType]);

  const sectors = useMemo(() => {
    const unique = new Set(employees.map(e => e.sector_id || 'General'));
    return Array.from(unique);
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (selectedSector !== 'all') {
      list = list.filter(e => (e.sector_id || 'General') === selectedSector);
    }

    if (selectedEmploymentType !== 'all') {
      list = list.filter(e => (e.employment_type || 'efectivo') === selectedEmploymentType);
    }
    
    // Filtro por nombre
    if (searchTerm.trim()) {
      const terms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter(e => {
        const searchable = [
          e.full_name,
          getEmploymentTypeLabel(e.employment_type),
          sectorMap[e.sector_id || ''] || e.sector_id || 'General',
          e.dni || ''
        ].join(' ').toLowerCase();
        return terms.every(term => searchable.includes(term));
      });
    }

    if (currentUser.role === 'administrador' || currentUser.role === 'superusuario') return list;
    if (currentUser.role === 'encargado') {
      // Un encargado ve su sector principal y todos sus sectores adicionales
      const mySectorIds = new Set<string>();
      if (currentUser.sector_id) mySectorIds.add(currentUser.sector_id);
      (currentUser.managed_sectors || []).forEach(id => mySectorIds.add(id));
      
      return list.filter(e => mySectorIds.has(e.sector_id || 'General'));
    }
    return [];
  }, [employees, currentUser, selectedSector, selectedEmploymentType, searchTerm, sectorMap]);

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(currentWeekStart, i));
    }
    return days;
  }, [currentWeekStart]);

  const getSpecialDayInfo = (date: Date) => {
    const dateKey = formatDate(date);
    const holidayName = holidayMap[dateKey];
    if (holidayName) {
      return {
        isSpecial: true,
        label: 'Feriado',
        name: holidayName,
        headerClass: 'bg-rose-50 border-rose-100',
        cellClass: 'bg-rose-50/45 hover:bg-rose-100/70 border-l-rose-100',
        textClass: 'text-rose-600'
      };
    }

    if (date.getDay() === 0) {
      return {
        isSpecial: true,
        label: 'Domingo',
        name: 'Domingo',
        headerClass: 'bg-amber-50 border-amber-100',
        cellClass: 'bg-amber-50/45 hover:bg-amber-100/70 border-l-amber-100',
        textClass: 'text-amber-600'
      };
    }

    return {
      isSpecial: false,
      label: '',
      name: '',
      headerClass: '',
      cellClass: '',
      textClass: 'text-indigo-500'
    };
  };

  const handlePrevWeek = () => setCurrentWeekStart(addDays(currentWeekStart, -7));
  const handleNextWeek = () => setCurrentWeekStart(addDays(currentWeekStart, 7));

  const handleCellClick = (emp: Profile, date: Date) => {
    const isAuthorized = currentUser.role === 'administrador' || currentUser.role === 'encargado' || currentUser.role === 'superusuario';
    if (!isAuthorized) return;

    const dateKey = formatDate(date);
    const shiftKey = `${emp.id}_${dateKey}`;
    const existingShift = shifts[shiftKey];

    setSelectedTarget({ empId: emp.id, date: date, empName: emp.full_name });

    if (existingShift) {
      setEditForm({
        type: existingShift.type,
        s1Start: existingShift.segments[0]?.start || '',
        s1End: existingShift.segments[0]?.end || '',
        s2Start: existingShift.segments[1]?.start || '',
        s2End: existingShift.segments[1]?.end || ''
      });
    } else {
      setEditForm({
        type: 'continuous',
        s1Start: '08:00',
        s1End: '16:00',
        s2Start: '',
        s2End: '',
        startDate: dateKey,
        endDate: dateKey
      });
    }
    setIsModalOpen(true);
    setMessage(null);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReconcileCompRest = async () => {
    if (!isCompRestEnabled || !canReconcileCompRest || reconcilingCompRest) return;

    setReconcilingCompRest(true);
    setCompRestSummary(null);
    setMessage(null);

    const startDate = formatDate(currentWeekStart);
    const endDate = formatDate(addDays(currentWeekStart, 6));

    try {
      const summary = await compensatoryRestService.reconcileCompensatoryCredits(
        startDate,
        endDate,
        currentUser.full_name || 'Admin'
      );

      setCompRestSummary(summary);
      if (setEmployees) {
        const updatedEmployees = await personnelService.getAll();
        setEmployees(updatedEmployees);
      }

      setMessage({
        text: `Francos recalculados: ${summary.created} acreditados, ${summary.existing} existentes, ${Object.values(summary.skipped).reduce((sum, value) => sum + value, 0)} omitidos.`,
        type: summary.errors > 0 ? 'error' : 'success'
      });
    } catch (error: any) {
      console.error('Error reconciling compensatory rest credits:', error);
      setMessage({ text: `Error al recalcular francos: ${error.message || 'intente nuevamente'}`, type: 'error' });
    } finally {
      setReconcilingCompRest(false);
    }
  };

  const escapeXml = (value: unknown) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const getActiveShift = (emp: Profile, date: Date) => {
    const dateKey = formatDate(date);
    const explicitShift = shifts[`${emp.id}_${dateKey}`];

    let activeShift = explicitShift;
    if (!activeShift && emp.default_schedule) {
      const base = emp.default_schedule[date.getDay().toString()];
      if (base) activeShift = { type: base.type, segments: base.segments } as any;
    }

    return activeShift;
  };

  const getShiftText = (emp: Profile, date: Date) => {
    const activeShift = getActiveShift(emp, date);
    const isSunday = date.getDay() === 0;

    if (!activeShift) return isSunday ? 'Descanso' : '';
    if (activeShift.type === 'off') return 'Descanso';
    if (activeShift.type === 'compensatory') return 'Franco Comp.';
    if (activeShift.type === 'suspension') return 'Suspendido';
    if (activeShift.type === 'vacation') return 'Vacaciones';
    if (activeShift.type === 'medical') return 'Licencia Medica';
    if (activeShift.type === 'continuous') {
      return `${activeShift.segments?.[0]?.start || ''}-${activeShift.segments?.[0]?.end || ''}`;
    }
    if (activeShift.type === 'split' || activeShift.type === 'double') {
      return (activeShift.segments || []).map((s: any) => `${s.start}-${s.end}`).join(' / ');
    }
    return '';
  };

  const downloadXlsx = async (fileName: string, sheetName: string, rows: unknown[][], columnWidths: number[]) => {
    const colName = (index: number) => {
      let name = '';
      let n = index + 1;
      while (n > 0) {
        const rem = (n - 1) % 26;
        name = String.fromCharCode(65 + rem) + name;
        n = Math.floor((n - 1) / 26);
      }
      return name;
    };

    const sheetData = rows.map((row, rowIndex) => {
      const cells = row.map((value, colIndex) => {
        const ref = `${colName(colIndex)}${rowIndex + 1}`;
        return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
      }).join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    }).join('');

    const cols = columnWidths.map((width, index) =>
      `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
    ).join('');

    const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <cols>${cols}</cols>
  <sheetData>${sheetData}</sheetData>
</worksheet>`;

    const zip = new JSZip();
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.worksheet+xml"/>
</Types>`);
    zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
    zip.folder('xl')?.file('workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
    zip.folder('xl')?.folder('_rels')?.file('workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`);
    zip.folder('xl')?.folder('worksheets')?.file('sheet1.xml', worksheet);

    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleExportExcel = async () => {
    const weekLabel = `${currentWeekStart.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} al ${addDays(currentWeekStart, 6).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    const sectorLabel = selectedSector === 'all' ? 'Todos los Sectores' : (sectorMap[selectedSector] || selectedSector);

    const headers = [
      'Empleado',
      'Tipo',
      'Sector',
      ...weekDays.map(d => d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' }))
    ];

    const rows = filteredEmployees.map(emp => [
      emp.full_name,
      getEmploymentTypeLabel(emp.employment_type),
      sectorMap[emp.sector_id || ''] || emp.sector_id || 'General',
      ...weekDays.map(d => getShiftText(emp, d))
    ]);

    await downloadXlsx(
      `Cronograma_${formatDate(currentWeekStart)}_${formatDate(addDays(currentWeekStart, 6))}.xlsx`,
      'Cronograma',
      [
        ['Cronograma Semanal', weekLabel],
        ['Sector', sectorLabel],
        [],
        headers,
        ...rows
      ],
      [32, 14, 22, 18, 18, 18, 18, 18, 18, 18]
    );
  };

  const getSegmentHours = (segment: { start?: string; end?: string }) => {
    if (!segment.start || !segment.end) return 0;
    const [startHours, startMinutes] = segment.start.split(':').map(Number);
    const [endHours, endMinutes] = segment.end.split(':').map(Number);
    if ([startHours, startMinutes, endHours, endMinutes].some(Number.isNaN)) return 0;

    const startTotal = (startHours * 60) + startMinutes;
    let endTotal = (endHours * 60) + endMinutes;
    if (endTotal <= startTotal) endTotal += 24 * 60;
    return (endTotal - startTotal) / 60;
  };

  const getSegmentStartHour = (segment: { start?: string }) => {
    if (!segment.start) return 0;
    const [hour] = segment.start.split(':').map(Number);
    return Number.isNaN(hour) ? 0 : hour;
  };

  const isPayableDoubleShift = (type: ShiftType, segments: { start?: string; end?: string }[]) => {
    if (type === 'double') return true;
    return segments.length > 1 && segments.every(segment => getSegmentHours(segment) >= 7);
  };

  const getScheduledWorkSummary = (
    emp: Profile, 
    attendanceByEmployeeDate: Map<string, AttendanceRecord[]> = new Map(),
    extendedShiftsMap?: Map<string, ShiftData>
  ) => {
    let workedJornadas = 0;
    let weeklyHours = 0;

    const getShift = (date: Date) => {
      if (extendedShiftsMap) {
        const dateKey = formatDate(date);
        const explicit = extendedShiftsMap.get(`${emp.id}_${dateKey}`);
        if (explicit) return explicit;
        if (emp.default_schedule) {
          const base = emp.default_schedule[date.getDay().toString()];
          if (base) return { type: base.type, segments: base.segments } as any;
        }
        return undefined;
      }
      return getActiveShift(emp, date);
    };

    const getDayCalculation = (date: Date) => {
      const activeShift = getShift(date);
      if (!activeShift || activeShift.type === 'off' || activeShift.type === 'compensatory' || activeShift.type === 'suspension' || activeShift.type === 'vacation' || activeShift.type === 'medical') {
        return { isWorkingShift: false };
      }

      const dateKey = formatDate(date);
      const segments = activeShift.segments || [];
      if (segments.length === 0) return { isWorkingShift: false };

      const isDoubleForLiquidation = isPayableDoubleShift(activeShift.type, segments);
      const scheduledJornadas = isDoubleForLiquidation ? Math.min(segments.length, 2) : 1;

      // Base records for this date
      let dayRecords = [...(attendanceByEmployeeDate.get(`${emp.id}_${dateKey}`) || [])];

      // For double/split shifts that include a night segment (start >= 19:00):
      // an employee may check in after midnight → their record date is the NEXT day.
      // We look for early-morning records on the next day (check_in before 08:00)
      // and include them so the night segment is counted correctly.
      const hasNightSegment = isDoubleForLiquidation
        ? segments.some((segment: any) => getSegmentStartHour(segment) >= 19)
        : getSegmentStartHour(segments[0]) >= 19;
      const isMultiSegment = segments.length > 1;

      if (hasNightSegment) {
        const nextDay = addDays(date, 1);
        const nextDateKey = formatDate(nextDay);
        const nextDayRecords = attendanceByEmployeeDate.get(`${emp.id}_${nextDateKey}`) || [];
        const afterMidnightRecords = nextDayRecords.filter((r: any) => {
          if (!r.check_in) return false;
          const checkInHour = new Date(r.check_in).getHours();
          return checkInHour < 8; // before 08:00 → belongs to the night segment of this day
        });
        dayRecords = [...dayRecords, ...afterMidnightRecords];
      }

      const positiveRecords = dayRecords
        .filter(record => record.check_in && ['presente', 'en_horario', 'tarde', 'sin_presentismo', 'manual'].includes(record.status))
        .sort((a, b) => (a.check_in || '').localeCompare(b.check_in || ''));
      const now = new Date();
      const todayKey = formatDate(now);
      const totalScheduledHours = segments.reduce((sum: number, segment: any) => sum + getSegmentHours(segment), 0);
      const scheduledUnits = isDoubleForLiquidation
        ? segments.slice(0, scheduledJornadas)
        : [segments[0]];
      const payableUnits = scheduledUnits.reduce((units: { effectiveDate: Date; hours: number }[], segment: any, index: number) => {
        const segmentStart = new Date(date);
        const [startHours, startMinutes] = (segment.start || '00:00').split(':').map(Number);
        segmentStart.setHours(startHours || 0, startMinutes || 0, 0, 0);
        const isNightUnit = getSegmentStartHour(segment) >= 19;
        const paysNextWeek = date.getDay() === 6 && isNightUnit;
        const hasCheckInForUnit = isDoubleForLiquidation
          ? index < positiveRecords.length
          : positiveRecords.length > 0;
        const shouldPrepayFutureDayUnit = dateKey === todayKey && segmentStart > now && !isNightUnit;

        if (!hasCheckInForUnit && !shouldPrepayFutureDayUnit) return units;

        units.push({
          effectiveDate: addDays(date, paysNextWeek ? 1 : 0),
          hours: isDoubleForLiquidation ? getSegmentHours(segment) : totalScheduledHours
        });
        return units;
      }, []);
      const dayJornadas = payableUnits.length;
      const dayHours = payableUnits.reduce((sum, unit) => sum + unit.hours, 0);

      const hasCheckIn = dayRecords.some(r => !!r.check_in);
      const hasManualPresence = dayJornadas > 0;

      let isFutureShift = false;
      if (!hasCheckIn && !hasManualPresence) {
        const now = new Date();
        const shiftStart = new Date(date);
        if (segments[0].start) {
          const [startHours, startMinutes] = segments[0].start.split(':').map(Number);
          shiftStart.setHours(startHours, startMinutes, 0, 0);
        } else {
          shiftStart.setHours(23, 59, 59, 999);
        }
        if (shiftStart > now) {
          isFutureShift = true;
        }
      }

      // isNightShift = TRUE only for PURELY night shifts (single segment starting >= 19:00).
      // Multi-segment shifts (morning + night) count for the current day.
      let isNightShift = false;
      if (!isMultiSegment && segments[0].start) {
        const [startHour] = segments[0].start.split(':').map(Number);
        if (startHour >= 19) isNightShift = true;
      }

      const dayStatusLabel = dayRecords.reduce<string | null>((label, record) => {
        if (label || record.check_in) return label;
        if (record.status === 'ausente' || record.status === 'ausente_justificada') return 'Ausente';
        if (record.status === 'descanso') return 'Descanso';
        if (record.status === 'vacaciones') return 'Vacaciones';
        if (record.status === 'licencia_medica') return 'Licencia Medica';
        if (record.status === 'compensatorio') return 'Franco Comp.';
        if (record.status === 'suspendido') return 'Suspendido';
        return label;
      }, null);

      return {
        isWorkingShift: true,
        dayJornadas,
        dayHours,
        isFutureShift,
        isNightShift,
        payableUnits,
        scheduledDayHours: totalScheduledHours.toFixed(2).replace('.', ','),
        dayStatusLabel
      };
    };


    const getPayableUnitsForDate = (date: Date) => {
      const dateKey = formatDate(date);
      const previousDate = addDays(date, -1);
      return [previousDate, date].flatMap(sourceDate => {
        const calc = getDayCalculation(sourceDate);
        if (!calc.isWorkingShift || !calc.dayJornadas) return [];
        return (calc.payableUnits || []).filter(unit => formatDate(unit.effectiveDate) === dateKey);
      });
    };

    const daily = weekDays.map(date => {
      const activeShift = getShift(date);
      const calc = getDayCalculation(date);
      const payableUnitsForDate = getPayableUnitsForDate(date);
      
      if (!calc.isWorkingShift) {
        if (payableUnitsForDate.length > 0) {
          const payableHoursForDate = payableUnitsForDate.reduce((sum, unit) => sum + unit.hours, 0);
          return payableHoursForDate.toFixed(2).replace('.', ',');
        }
        const dayRecords = attendanceByEmployeeDate.get(`${emp.id}_${formatDate(date)}`) || [];
        const label = dayRecords.reduce<string | null>((l, r) => {
           if (l || r.check_in) return l;
           if (r.status === 'ausente' || r.status === 'ausente_justificada') return 'Ausente';
           if (r.status === 'descanso') return 'Descanso';
           if (r.status === 'vacaciones') return 'Vacaciones';
           if (r.status === 'licencia_medica') return 'Licencia Medica';
           if (r.status === 'compensatorio') return 'Franco Comp.';
           if (r.status === 'suspendido') return 'Suspendido';
           return l;
        }, null);

        if (!activeShift) return label || (date.getDay() === 0 ? 'Descanso' : '');
        if (activeShift.type === 'off') return 'Descanso';
        if (activeShift.type === 'compensatory') return 'Franco Comp.';
        if (activeShift.type === 'suspension') return 'Suspendido';
        if (activeShift.type === 'vacation') return 'Vacaciones';
        if (activeShift.type === 'medical') return 'Licencia Medica';
        return '';
      }

      if (calc.dayJornadas! <= 0) {
        return calc.dayStatusLabel || 'Ausente';
      }

      if (payableUnitsForDate.length === 0) return 'Semana sig.';
      
      const payableHoursForDate = payableUnitsForDate.reduce((sum, unit) => sum + unit.hours, 0);
      return payableHoursForDate.toFixed(2).replace('.', ',');
    });

    const startPrev = new Date(weekDays[0]);
    startPrev.setDate(startPrev.getDate() - 1);
    const evaluationDays = [startPrev, ...weekDays];
    
    evaluationDays.forEach(date => {
      const calc = getDayCalculation(date);
      if (!calc.isWorkingShift || !calc.dayJornadas) return;

      const payableUnits = calc.payableUnits || [];
      const payableUnitsInWeek = payableUnits.filter(unit => {
        const effectiveDateKey = formatDate(unit.effectiveDate);
        return weekDays.some(wd => formatDate(wd) === effectiveDateKey);
      });
      if (payableUnitsInWeek.length === 0) return;

      workedJornadas += payableUnitsInWeek.length;
      weeklyHours += payableUnitsInWeek.reduce((sum, unit) => sum + unit.hours, 0);
    });

    return { workedJornadas, weeklyHours, daily };
  };

  const handleExportWeeklySummaryExcel = async () => {
    const weekLabel = `${currentWeekStart.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} al ${addDays(currentWeekStart, 6).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    const sectorLabel = selectedSector === 'all' ? 'Todos los Sectores' : (sectorMap[selectedSector] || selectedSector);
    
    const startDate = formatDate(currentWeekStart);
    const endDate = formatDate(addDays(currentWeekStart, 6));
    
    const startPrev = addDays(currentWeekStart, -1);
    const extendedStartDate = formatDate(startPrev);
    
    const attendanceRecords = await attendanceService.getByDateRange(extendedStartDate, endDate);
    const extendedSchedules = await scheduleService.getByWeek(extendedStartDate, endDate);

    const attendanceByEmployeeDate = attendanceRecords.reduce((map, record) => {
      const key = `${record.employee_id}_${record.date.substring(0, 10)}`;
      const records = map.get(key) || [];
      records.push(record);
      map.set(key, records);
      return map;
    }, new Map<string, AttendanceRecord[]>());

    const extendedShiftsMap = extendedSchedules.reduce((map, shift) => {
      map.set(`${shift.employee_id}_${shift.date.substring(0, 10)}`, shift);
      return map;
    }, new Map<string, ShiftData>());

    const dayHeaders = weekDays.map(d => d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' }));
    const headers = [
      'Empleado',
      'Tipo',
      'Sector',
      'Jornadas trabajadas',
      'Horas semanales',
      ...dayHeaders
    ];

    const rows = filteredEmployees.map(emp => {
      const summary = getScheduledWorkSummary(emp, attendanceByEmployeeDate, extendedShiftsMap);
      return [
        emp.full_name,
        getEmploymentTypeLabel(emp.employment_type),
        sectorMap[emp.sector_id || ''] || emp.sector_id || 'General',
        summary.workedJornadas,
        summary.weeklyHours.toFixed(2).replace('.', ','),
        ...summary.daily
      ];
    });

    await downloadXlsx(
      `Resumen_Cronograma_${startDate}_${endDate}.xlsx`,
      'Resumen semanal',
      [
        ['Resumen semanal de cronograma', weekLabel],
        ['Sector', sectorLabel],
        [],
        headers,
        ...rows
      ],
      [32, 14, 22, 20, 18, 14, 14, 14, 14, 14, 14, 14]
    );
  };

  const handleSave = async () => {
    if (!selectedTarget || saveInProgressRef.current) return;
    saveInProgressRef.current = true;
    setSaving(true);
    setMessage(null);
    let savedSuccessfully = false;
    let createdCompCredit = false;
    let changedCompRestUsage = false;

    try {
      const now = new Date();
      const targetDateStr = formatDate(selectedTarget.date);

      // ── CONTROL DE SEGURIDAD RETROACTIVO PARA ENCARGADOS ──
      // Si el usuario no es administrador/superusuario, validamos si la jornada original ya comenzó.
      if (currentUser.role !== 'administrador' && currentUser.role !== 'superusuario') {
        const employee = employees.find(e => e.id === selectedTarget.empId);
        if (employee) {
          const originalShift = getActiveShift(employee, selectedTarget.date);
          if (originalShift && 
              originalShift.type !== 'off' && 
              originalShift.type !== 'vacation' && 
              originalShift.type !== 'medical' && 
              originalShift.type !== 'suspension') {
            const originalStartTimeStr = originalShift.segments?.[0]?.start;
            if (originalStartTimeStr) {
              const originalDateTime = new Date(`${targetDateStr}T${originalStartTimeStr}`);
              if (now > originalDateTime) {
                alert("No se puede modificar un horario de una jornada que ya ha comenzado por políticas de integridad del sistema. Por favor, contacte a un administrador para excepciones.");
                saveInProgressRef.current = false;
                setSaving(false);
                return;
              }
            }
          }
        }
      }

      let startTimeStr = editForm.s1Start;
      if (!startTimeStr || editForm.type === 'vacation') startTimeStr = "23:59";

      const targetDateTime = new Date(`${targetDateStr}T${startTimeStr}`);

      if (now > targetDateTime) {
        if (currentUser.role !== 'administrador' && currentUser.role !== 'superusuario') {
          alert("No se puede modificar un horario una vez iniciada la jornada por políticas de integridad del sistema. Por favor, contacte a un administrador para excepciones.");
          saveInProgressRef.current = false;
          setSaving(false);
          return;
        }
      }

      const shiftsToSave: ShiftData[] = [];

      if (editForm.type === 'vacation' || editForm.type === 'medical') {
        const startStr = editForm.startDate || targetDateStr;
        const endStr = editForm.endDate || startStr;

        const start = new Date(startStr + 'T00:00:00');
        const end = new Date(endStr + 'T00:00:00');

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dKey = formatDate(d);
          shiftsToSave.push({
            id: `${selectedTarget.empId}_${dKey}`,
            employee_id: selectedTarget.empId,
            date: dKey,
            type: editForm.type,
            segments: [],
            last_modified_by: currentUser.full_name || 'Admin',
            last_modified_at: new Date().toISOString()
          });
        }
      } else {
        const segments: ShiftSegment[] = [];
        if (editForm.type === 'continuous') {
          segments.push({ start: editForm.s1Start, end: editForm.s1End });
        } else if (editForm.type === 'split' || editForm.type === 'double') {
          segments.push({ start: editForm.s1Start, end: editForm.s1End });
          segments.push({ start: editForm.s2Start, end: editForm.s2End });
        }

        const shiftKey = `${selectedTarget.empId}_${targetDateStr}`;
        shiftsToSave.push({
          id: shiftKey,
          employee_id: selectedTarget.empId,
          date: targetDateStr,
          type: editForm.type,
          segments,
          last_modified_by: currentUser.full_name || 'Admin',
          last_modified_at: new Date().toISOString()
        });
      }

      const saved = await scheduleService.save(shiftsToSave);
      if (saved) {
        savedSuccessfully = true;
        // ── LOGICA DE FRANCOS COMPENSATORIOS (Solo si está habilitado) ──
        if (isCompRestEnabled) {
          const dateKey = formatDate(selectedTarget.date);
          const shiftKey = `${selectedTarget.empId}_${dateKey}`;
          const prevShift = shifts[shiftKey];

          // 1. Manejo de Consumo (-1)
          if (editForm.type === 'compensatory' && prevShift?.type !== 'compensatory') {
            changedCompRestUsage = await compensatoryRestService.addCompensatoryUsageIfDue(
              selectedTarget.empId,
              dateKey,
              currentUser.full_name || 'Admin'
            );
          } else if (prevShift?.type === 'compensatory' && editForm.type !== 'compensatory') {
            changedCompRestUsage = await compensatoryRestService.reverseCompensatoryUsageIfApplied(
              selectedTarget.empId,
              dateKey,
              currentUser.full_name || 'Admin'
            );
          }

          // 2. Manejo de Crédito Automático (+1) - Regla de Oro
          createdCompCredit = await compensatoryRestService.processAutomaticCredit(
            selectedTarget.empId,
            dateKey,
            editForm.type,
            editForm.type === 'split' || editForm.type === 'double' 
              ? [{ start: editForm.s1Start, end: editForm.s1End }, { start: editForm.s2Start, end: editForm.s2End }]
              : [{ start: editForm.s1Start, end: editForm.s1End }],
            currentUser.full_name || 'Admin'
          );
        }

        const savedArray = Array.isArray(saved) ? saved : [saved];
        const newShiftsMap = { ...shifts };
        savedArray.forEach(s => { if (s) newShiftsMap[s.id] = s; });
        setShifts(newShiftsMap);

        if ((createdCompCredit || changedCompRestUsage) && setEmployees) {
          const updatedEmployees = await personnelService.getAll();
          setEmployees(updatedEmployees);
        }

        await auditService.logAction({
          manager_name: currentUser.full_name || 'Admin',
          employee_name: selectedTarget.empName,
          action: editForm.type === 'vacation' ? 'Asignación de Vacaciones' : 
                  editForm.type === 'medical' ? 'Licencia Médica' : 
                  editForm.type === 'compensatory' ? 'Asignación Franco Comp.' :
                  editForm.type === 'suspension' ? 'Suspensión de Personal' : 'Cambio de Turno',
          old_value: 'N/A',
          new_value: (editForm.type === 'vacation' || editForm.type === 'medical')
            ? `Rango: ${editForm.startDate || targetDateStr} al ${editForm.endDate || targetDateStr}`
            : `${editForm.type}: ${editForm.s1Start}-${editForm.s1End} (Fecha: ${targetDateStr})`,
          reason: 'Modificación manual de cronograma'
        });

        // Recalcular asistencia para el rango modificado para corregir ausencias previas generadas automáticamente
        const startStr = editForm.type === 'vacation' || editForm.type === 'medical' ? (editForm.startDate || targetDateStr) : targetDateStr;
        const endStr = editForm.type === 'vacation' || editForm.type === 'medical' ? (editForm.endDate || targetDateStr) : targetDateStr;
        await attendanceService.recalculateAttendance(selectedTarget.empId, startStr, endStr, currentUser.full_name || 'Admin');
        
        setMessage({ text: 'Cronograma guardado con éxito', type: 'success' });
        setTimeout(() => {
          setIsModalOpen(false);
          setMessage(null);
        }, 1500);
      }
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      setMessage({ text: 'Error al guardar: ' + (error.message || 'Intente nuevamente'), type: 'error' });
    } finally {
      saveInProgressRef.current = false;
      setSaving(false);
    }
  };

  const renderCellContent = (empId: string, date: Date) => {
    const activeShift = getActiveShift(employees.find(e => e.id === empId)!, date);
    if (!activeShift) return null;

    let bgColor = 'bg-slate-50 border-slate-100 text-slate-400';
    let icon = <Clock className="w-3 h-3 mr-1" />;

    if (activeShift.type === 'off') {
      bgColor = 'bg-amber-50 border-amber-100 text-amber-600';
      icon = <History className="w-3 h-3 mr-1" />;
    } else if (activeShift.type === 'compensatory') {
      bgColor = 'bg-fuchsia-600 border-fuchsia-400 text-white shadow-md ring-2 ring-fuchsia-500/20';
      icon = <History className="w-3 h-3 mr-1" />;
    } else if (activeShift.type === 'suspension') {
      bgColor = 'bg-red-50 border-red-100 text-red-600';
      icon = <AlertTriangle className="w-3 h-3 mr-1" />;
    } else if (activeShift.type === 'vacation') {
      bgColor = 'bg-emerald-50 border-emerald-100 text-emerald-600';
      icon = <CalendarIcon className="w-3 h-3 mr-1" />;
    } else if (activeShift.type === 'medical') {
      bgColor = 'bg-rose-50 border-rose-100 text-rose-600';
      icon = <AlertTriangle className="w-3 h-3 mr-1" />;
    } else if (activeShift.type === 'double') {
      bgColor = 'bg-violet-600 border-violet-400 text-white shadow-md ring-2 ring-violet-500/20';
      icon = <Clock className="w-3 h-3 mr-1" />;
    } else {
      bgColor = 'bg-indigo-600 border-indigo-400 text-white shadow-sm';
    }

    return (
      <div className={`inline-flex items-center px-3 py-1.5 rounded-xl border text-[11px] font-bold uppercase tracking-normal antialiased transition-all ${bgColor}`}>
        {icon}
        {getShiftText(employees.find(e => e.id === empId)!, date)}
      </div>
    );
  };

  const weekLabel = `${currentWeekStart.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} al ${addDays(currentWeekStart, 6).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  const isCurrentWeek = formatDate(currentWeekStart) === formatDate(getStartOfWeek(new Date()));
  const weekSelectorLabel = isCurrentWeek ? 'Semana Actual' : weekLabel;
  const sectorLabel = selectedSector === 'all' ? 'Todos los Sectores' : (sectorMap[selectedSector] || selectedSector);

  return (
    <div className="flex flex-col h-full bg-slate-50/30 p-4 sm:p-8 space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      {/* ── HEADER ── */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 no-print">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-200">
              <CalendarIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight uppercase">Cronograma</h1>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">{weekLabel}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white rounded-2xl shadow-sm border border-slate-100 p-1">
            <button onClick={handlePrevWeek} className="p-2 hover:bg-slate-50 rounded-xl transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
            <div className="px-4 text-sm font-black text-slate-700 uppercase tracking-tight min-w-[140px] text-center">{weekSelectorLabel}</div>
            <button onClick={handleNextWeek} className="p-2 hover:bg-slate-50 rounded-xl transition-colors"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
          </div>

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o DNI..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 pr-6 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm min-w-[240px]"
            />
          </div>

          <select 
            value={selectedSector} 
            onChange={(e) => setSelectedSector(e.target.value)}
            className="px-6 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
          >
            <option value="all">TODOS LOS SECTORES</option>
            {sectors.map(s => <option key={s} value={s}>{sectorMap[s] || s}</option>)}
          </select>

          <select 
            value={selectedEmploymentType} 
            onChange={(e) => setSelectedEmploymentType(e.target.value as any)}
            className="px-6 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm uppercase"
          >
            <option value="all">TIPO DE EMPLEO (TODOS)</option>
            <option value="efectivo">Efectivo</option>
            <option value="jornalero">Jornalero</option>
          </select>

          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-6 py-3 bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-900 transition-all shadow-lg no-print"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-2 px-6 py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-lg no-print"
          >
            <Download className="w-4 h-4" />
            <span>Excel</span>
          </button>
          <button
            onClick={handleExportWeeklySummaryExcel}
            className="flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-lg no-print"
          >
            <Download className="w-4 h-4" />
            <span>Resumen Excel</span>
          </button>
          <button
            onClick={() => {
              if (!isWorldCupMode && selectedSector === 'all') {
                alert('Para ver el Modo Mundial, por favor seleccioná un sector específico primero.');
                return;
              }
              setIsWorldCupMode(!isWorldCupMode);
            }}
            className={`flex items-center space-x-2 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg no-print ${
              isWorldCupMode 
                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/30 ring-4 ring-amber-500/20' 
                : 'bg-green-600 hover:bg-green-700 text-white shadow-green-600/30'
            }`}
          >
            <span className="text-base leading-none">⚽</span>
            <span>{isWorldCupMode ? 'Ver Tabla' : 'Modo Mundial'}</span>
          </button>
          {isCompRestEnabled && canReconcileCompRest && (
            <button
              onClick={handleReconcileCompRest}
              disabled={reconcilingCompRest}
              className="flex items-center space-x-2 px-6 py-3 bg-violet-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-violet-700 disabled:opacity-60 disabled:cursor-wait transition-all shadow-lg no-print"
            >
              <History className="w-4 h-4" />
              <span>{reconcilingCompRest ? 'Recalculando...' : 'Recalcular Francos'}</span>
            </button>
          )}
        </div>
      </header>

      {compRestSummary && (
        <div className="no-print mb-4 bg-white border border-violet-100 rounded-2xl shadow-sm p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-black uppercase tracking-widest text-violet-600">Resumen de francos</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg">Acreditados: {compRestSummary.created}</span>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg">Ya existentes: {compRestSummary.existing}</span>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-lg">Sin fichada: {compRestSummary.skipped.no_attendance}</span>
            <span className="text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1 rounded-lg">Jornaleros: {compRestSummary.skipped.jornalero}</span>
            {compRestSummary.errors > 0 && (
              <span className="text-xs font-bold text-red-700 bg-red-50 px-3 py-1 rounded-lg">Errores: {compRestSummary.errors}</span>
            )}
          </div>
          {compRestSummary.details.length > 0 && (
            <p className="text-xs text-slate-500 font-medium">
              Ultimos movimientos: {compRestSummary.details.slice(0, 5).map(d => `${d.employee_name} ${d.date}: ${d.reason}`).join(' | ')}
            </p>
          )}
        </div>
      )}

      {/* ── PRINT STYLES ── */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm 12mm;
          }

          /* Forzar impresión de colores de fondo en la cancha */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Ocultar todo el DOM visualmente (visibility permite override en hijos) */
          body * { visibility: hidden !important; }

          /* Mostrar tabla normal y su header */
          .print-header,
          .print-header *,
          .schedule-table-wrapper,
          .schedule-table-wrapper * {
            visibility: visible !important;
          }
          .schedule-table-wrapper {
            position: static !important;
            width: 100% !important;
            overflow: visible !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          /* La cancha: visible + anclada al inicio de la hoja con position:fixed */
          .print-container,
          .print-container * {
            visibility: visible !important;
          }
          .print-container {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-height: 100vh !important;
            overflow: hidden !important;
            border-radius: 0 !important;
            border: none !important;
            box-shadow: none !important;
            z-index: 9999 !important;
          }

          /* Header de impresión - Minimalista Premium */
          .print-header-top {
            display: flex !important;
            justify-content: space-between;
            align-items: flex-end;
            border-bottom: 2px solid #0f172a; /* Negro profundo para elegancia */
            padding-bottom: 10px;
            margin-bottom: 12px;
          }
          .print-company {
            display: block;
            font-size: 8pt;
            font-weight: 800;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.15em;
          }
          .print-doc {
            display: block;
            font-size: 16pt;
            font-weight: 900;
            color: #0f172a;
            line-height: 1.1;
          }
          .print-meta {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 2px;
            font-size: 8pt;
            color: #475569;
            font-weight: 600;
          }

          /* Tabla - Limpia y de alto contraste */
          .schedule-table-wrapper table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            font-size: 8pt !important;
          }

          .schedule-table-wrapper thead {
            display: table-header-group !important;
          }

          .schedule-table-wrapper th {
            border: 1px solid #1e293b !important;
            padding: 8px 4px !important;
            font-size: 8pt !important;
            font-weight: 800 !important;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            text-align: center;
            color: #0f172a;
            background: #f8fafc !important; /* Gris ultra-claro para th */
          }
          .schedule-table-wrapper th:first-child {
            text-align: left;
            padding-left: 8px;
            width: 25%;
          }

          .schedule-table-wrapper td {
            border: 1px solid #1e293b !important;
            padding: 6px 4px !important;
            font-size: 8pt !important;
            text-align: center;
            vertical-align: middle;
            background: #ffffff !important;
          }
          .schedule-table-wrapper td:first-child {
            text-align: left;
            padding-left: 8px;
            font-weight: 800;
            color: #0f172a;
          }

          /* Evitar cortes de fila */
          .schedule-table-wrapper tr {
            page-break-inside: avoid;
          }

          /* Badges: Limpios, fondo gris muy suave */
          .schedule-table-wrapper span {
            background: #f1f5f9 !important;
            border: 1px solid #e2e8f0 !important;
            padding: 4px 6px !important;
            border-radius: 4px !important;
            font-size: 7.5pt !important;
            font-weight: 800 !important;
            color: #334155 !important;
            display: inline-block !important;
          }

          /* Ocultar elementos */
          .no-print,
          button, select, input,
          .fixed, header, nav, .absolute {
            display: none !important;
          }
        }
      `}</style>

      {/* ── TABLE OR PITCH ── */}
      {isWorldCupMode ? (
        <WorldCupPitch
          players={filteredEmployees.map(emp => {
            const weeklySchedule = weekDays.map(d => {
              const dayStr = d.toLocaleDateString('es-ES', { weekday: 'short' });
              const shortDay = dayStr.substring(0, 2);
              const shiftText = getShiftText(emp, d) || 'Descanso';
              
              // Acortar textos largos para que entren en la tarjeta
              let shift = shiftText;
              if (shift === 'Franco Comp.') shift = 'Franco';
              else if (shift === 'Vacaciones') shift = 'Vacas';
              else if (shift === 'Licencia Medica') shift = 'Medica';
              else if (shift === 'Suspendido') shift = 'Susp';
              
              return { day: shortDay, shift };
            });
            return {
              employee: emp,
              weeklySchedule
            };
          })}
          weekLabel={weekLabel}
          sectorName={sectorLabel}
        />
      ) : (
      <div className="schedule-table-wrapper bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[920px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="w-[190px] min-w-[190px] sm:w-[260px] sm:min-w-[260px] px-4 sm:px-6 py-5 sm:py-6 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 sticky left-0 bg-slate-50 z-10">Empleado</th>
                {weekDays.map(d => {
                  const specialDay = getSpecialDayInfo(d);
                  const holidayName = holidayMap[formatDate(d)];

                  return (
                    <th key={d.toISOString()} className={`px-2 py-5 sm:py-6 text-center border-b border-slate-100 min-w-[104px] ${specialDay.headerClass}`}>
                      <div className="flex flex-col items-center">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${specialDay.textClass}`}>{d.toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                        <span className="text-xl font-black text-slate-700">{d.getDate()}</span>
                        {specialDay.isSpecial && (
                          <span className={`mt-1 max-w-[92px] truncate rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-normal ${specialDay.textClass} bg-white/70`}>
                            {specialDay.label}
                          </span>
                        )}
                        {holidayName && (
                          <span className="mt-1 max-w-[92px] truncate text-[9px] font-bold text-rose-500 normal-case tracking-normal">
                            {holidayName}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="w-[190px] min-w-[190px] sm:w-[260px] sm:min-w-[260px] px-4 sm:px-6 py-4 sticky left-0 bg-white group-hover:bg-slate-50/50 transition-colors border-r border-slate-50">
                    <div 
                      className={`flex items-center space-x-2 sm:space-x-3 p-1 rounded-2xl transition-all ${
                        (currentUser.role === 'administrador' || currentUser.role === 'superusuario') 
                          ? 'hover:bg-indigo-50 cursor-pointer' 
                          : ''
                      }`}
                      onClick={() => {
                        const isAuthorized = currentUser.role === 'administrador' || currentUser.role === 'superusuario' || currentUser.role === 'encargado';
                        if (isAuthorized) {
                          setSelectedFileEmployeeId(emp.id);
                        }
                      }}
                    >
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-sm no-print shrink-0">
                        {emp.full_name.charAt(0)}
                      </div>
                        <div className="flex flex-col gap-1.5 mt-2">
                          <p className="font-bold text-slate-800 text-xs sm:text-sm leading-tight uppercase tracking-tight">{emp.full_name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest border-r border-slate-200 pr-2">
                              {emp.role === 'encargado' ? 'Encargado/a' : 'Personal'}
                            </span>
                            {isCompRestEnabled && (
                              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border shadow-sm transition-all ${
                                (emp.compensatory_rest_balance || 0) > 0 
                                  ? 'bg-indigo-600 border-indigo-400 text-white scale-105 ring-4 ring-indigo-500/10' 
                                  : 'bg-slate-50 border-slate-200 text-slate-500'
                              }`}>
                                <CreditCard className={`w-3 h-3 ${ (emp.compensatory_rest_balance || 0) > 0 ? 'text-indigo-200' : 'text-slate-400' }`} />
                                <span className="text-[10px] font-bold tracking-normal antialiased whitespace-nowrap">
                                  SALDO: <span className="text-xs font-black">{(emp.compensatory_rest_balance || 0)}</span>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                    </div>
                  </td>
                  {weekDays.map(d => {
                    const dateKey = formatDate(d);
                    const now = new Date();
                    const shiftStart = new Date(`${dateKey}T23:59:00`);
                    const isPast = now > shiftStart;
                    const shiftKey = `${emp.id}_${dateKey}`;
                    const specialDay = getSpecialDayInfo(d);

                    return (
                      <td
                        key={dateKey}
                        onClick={() => handleCellClick(emp, d)}
                        title={[
                          specialDay.isSpecial ? `${specialDay.label}: ${specialDay.name}` : '',
                          shifts[shiftKey] ? `Modificado por: ${shifts[shiftKey].last_modified_by} en ${new Date(shifts[shiftKey].last_modified_at).toLocaleString()}` : 'Sin asignar'
                        ].filter(Boolean).join(' | ')}
                        className={`px-2 py-4 text-center cursor-pointer hover:bg-indigo-50 transition-colors border-l border-dashed border-slate-100 relative ${specialDay.cellClass} ${isPast ? 'opacity-70' : ''}`}
                      >
                        {renderCellContent(emp.id, d)}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 pointer-events-none no-print">
                          {!isPast && <div className="bg-indigo-600 text-white p-1 rounded-full shadow-lg"><Clock className="w-3 h-3" /></div>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* ── MODAL ── */}
      {isModalOpen && selectedTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md sm:max-w-lg shadow-2xl p-8 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-800">Asignar Turno</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  {selectedTarget.empName} • {selectedTarget.date.toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-1.5 bg-slate-100/80 rounded-2xl">
                {(['continuous', 'split', 'double', 'off', 'compensatory', 'suspension', 'vacation', 'medical'] as const)
                  .filter(t => t !== 'medical' || currentUser.role !== 'encargado')
                  .map((t) => (
                  <button
                    key={t}
                    onClick={() => setEditForm(prev => ({ ...prev, type: t }))}
                    className={`py-3 px-2 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-normal antialiased transition-all ${
                      editForm.type === t 
                        ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                    }`}
                  >
                    {t === 'continuous' ? 'Corrido' : t === 'split' ? 'Cortado' : t === 'double' ? 'Doble' : t === 'off' ? 'Descanso' : t === 'compensatory' ? 'Franco C.' : t === 'suspension' ? 'Suspendido' : t === 'vacation' ? 'Vacaciones' : 'Licencia Med.'}
                  </button>
                ))}
              </div>

              {editForm.type === 'continuous' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Entrada</label>
                    <input type="time" value={editForm.s1Start} onChange={e => setEditForm({ ...editForm, s1Start: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Salida</label>
                    <input type="time" value={editForm.s1End} onChange={e => setEditForm({ ...editForm, s1End: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700" />
                  </div>
                </div>
              )}

              {(editForm.type === 'split' || editForm.type === 'double') && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Turno 1</span>
                    <div className="grid grid-cols-2 gap-4">
                      <input type="time" value={editForm.s1Start} onChange={e => setEditForm({ ...editForm, s1Start: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700" />
                      <input type="time" value={editForm.s1End} onChange={e => setEditForm({ ...editForm, s1End: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Turno 2</span>
                    <div className="grid grid-cols-2 gap-4">
                      <input type="time" value={editForm.s2Start} onChange={e => setEditForm({ ...editForm, s2Start: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700" />
                      <input type="time" value={editForm.s2End} onChange={e => setEditForm({ ...editForm, s2End: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700" />
                    </div>
                  </div>
                </div>
              )}

              {(editForm.type === 'vacation' || editForm.type === 'medical') && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Desde (Inicio)</label>
                      <input
                        type="date"
                        value={editForm.startDate}
                        onChange={e => setEditForm(prev => ({ ...prev, startDate: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Hasta (Fin)</label>
                      <input
                        type="date"
                        value={editForm.endDate}
                        onChange={e => setEditForm(prev => ({ ...prev, endDate: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                  </div>
                  <p className={`text-[10px] italic mt-1 p-3 rounded-lg border ${editForm.type === 'vacation' ? 'bg-emerald-50 text-slate-500 border-emerald-100' : 'bg-red-50 text-slate-500 border-red-100'}`}>
                    Se marcarán todos los días en el rango seleccionado como {editForm.type === 'vacation' ? 'vacaciones' : 'licencia médica'}.
                  </p>
                </div>
              )}

              {message && (
                <div className={`p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                  {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  <span className="font-bold text-sm">{message.text}</span>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100">
                <button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center space-x-2"
                >
                  {saving ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>Guardar Cronograma</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── LEGADO DIGITAL MODAL ── */}
      {selectedFileEmployeeId && (
        <EmployeeFileModal
          employeeId={selectedFileEmployeeId}
          managerName={currentUser.full_name || 'Admin'}
          managerRole={currentUser.role}
          onClose={() => setSelectedFileEmployeeId(null)}
        />
      )}
    </div>
  );
};

export default ScheduleView;
