import React, { useState, useMemo, useEffect } from 'react';
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
  Download
} from 'lucide-react';
import { Profile } from '../types';
import { scheduleService, ShiftData, ShiftType, ShiftSegment } from '../services/scheduleService';
import { auditService } from '../services/auditService';
import { sectorService, Sector } from '../services/sectorService';
import { getLocalDateString } from '../utils/dateUtils';

interface ScheduleViewProps {
  employees?: Profile[];
  currentUser?: Profile;
}

const defaultEmployees: Profile[] = [];
const defaultUser = { full_name: 'Guest', role: 'invitado', sector_id: '' } as unknown as Profile;

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
  currentUser = defaultUser
}) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));
  const [shifts, setShifts] = useState<Record<string, ShiftData>>({});
  const [sectorMap, setSectorMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchSectors = async () => {
      try {
        const s = await sectorService.getAll();
        const dict: Record<string, string> = {};
        s.forEach(sec => dict[sec.id] = sec.name);
        setSectorMap(dict);
      } catch (e) {}
    };
    fetchSectors();
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

  const [selectedSector, setSelectedSector] = useState<string>('all');

  const sectors = useMemo(() => {
    const unique = new Set(employees.map(e => e.sector_id || 'General'));
    return Array.from(unique);
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (selectedSector !== 'all') {
      list = list.filter(e => (e.sector_id || 'General') === selectedSector);
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
  }, [employees, currentUser, selectedSector]);

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(currentWeekStart, i));
    }
    return days;
  }, [currentWeekStart]);

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
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSave = async () => {
    if (!selectedTarget) return;

    const now = new Date();
    const targetDateStr = formatDate(selectedTarget.date);

    let startTimeStr = editForm.s1Start;
    if (!startTimeStr || editForm.type === 'vacation') startTimeStr = "23:59";

    const targetDateTime = new Date(`${targetDateStr}T${startTimeStr}`);

    if (now > targetDateTime) {
      if (currentUser.role !== 'administrador' && currentUser.role !== 'superusuario') {
        alert("No se puede modificar un horario que ya ha comenzado (Regla: Evitar amiguismos).");
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
      } else if (editForm.type === 'split') {
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
      const savedArray = Array.isArray(saved) ? saved : [saved];
      const newShiftsMap = { ...shifts };
      savedArray.forEach(s => { if (s) newShiftsMap[s.id] = s; });
      setShifts(newShiftsMap);

      await auditService.logAction({
        manager_name: currentUser.full_name || 'Admin',
        employee_name: selectedTarget.empName,
        action: editForm.type === 'vacation' ? 'Asignación de Vacaciones' : editForm.type === 'medical' ? 'Licencia Médica' : 'Cambio de Turno',
        old_value: 'N/A',
        new_value: (editForm.type === 'vacation' || editForm.type === 'medical')
          ? `Rango: ${editForm.startDate || targetDateStr} al ${editForm.endDate || targetDateStr}`
          : `${editForm.type}: ${editForm.s1Start}-${editForm.s1End} (Fecha: ${targetDateStr})`,
        reason: 'Modificación manual de cronograma'
      });
    }

    setIsModalOpen(false);
  };

  const renderCellContent = (empId: string, date: Date) => {
    const shift = shifts[`${empId}_${formatDate(date)}`];
    const employee = employees.find(e => e.id === empId);
    const isSunday = date.getDay() === 0;

    let activeShift = shift;
    let isBase = false;

    if (!activeShift && employee?.default_schedule) {
      const base = employee.default_schedule[date.getDay().toString()];
      if (base) {
        activeShift = { type: base.type, segments: base.segments } as any;
        isBase = true;
      }
    }

    if (!activeShift) {
      if (isSunday) {
        return (
          <div className="flex flex-col items-center">
            <span className="bg-slate-100 text-slate-400 border border-slate-200 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest">
              Descanso
            </span>
          </div>
        );
      }
      return <span className="text-slate-300 text-[10px]">—</span>;
    }

    const baseClass = isBase ? "opacity-40 border-dashed hover:opacity-80 transition-opacity" : "";

    if (activeShift.type === 'off') {
      return (
        <div className="flex flex-col items-center">
          <span className={`bg-slate-100 text-slate-400 border border-slate-200 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${baseClass}`}>
            Descanso
          </span>
        </div>
      );
    }

    if (activeShift.type === 'vacation' || activeShift.type === 'medical') {
      return (
        <div className="flex flex-col items-center">
          <span className={`${activeShift.type === 'vacation' ? "bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest shadow-sm" : "bg-red-100 text-red-700 border border-red-200 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest shadow-sm"} ${baseClass}`}>
            {activeShift.type === 'vacation' ? 'Vacaciones' : 'Licencia Médica'}
          </span>
        </div>
      );
    }

    if (activeShift.type === 'continuous') {
      return (
        <div className="flex flex-col items-center">
          <span className={`bg-amber-100 text-amber-700 border border-amber-200 px-2 py-1 rounded-md text-[10px] font-bold ${baseClass}`}>
            {activeShift.segments[0]?.start} - {activeShift.segments[0]?.end}
          </span>
        </div>
      );
    }
    if (activeShift.type === 'split') {
      return (
        <div className="flex flex-col gap-1 items-center">
          <span className={`bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md text-[9px] font-bold ${baseClass}`}>
            {activeShift.segments[0]?.start} - {activeShift.segments[0]?.end}
          </span>
          <span className={`bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md text-[9px] font-bold ${baseClass}`}>
            {activeShift.segments[1]?.start} - {activeShift.segments[1]?.end}
          </span>
        </div>
      );
    }
  };

  // Sector name for print header
  const sectorLabel = selectedSector === 'all'
    ? 'Todos los sectores'
    : (sectorMap[selectedSector] || selectedSector);

  const weekLabel = `${currentWeekStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – ${addDays(currentWeekStart, 6).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
      {/* ── PRINT-ONLY HEADER ── */}
      <div className="print-header" style={{ display: 'none' }}>
        <div className="print-header-top">
          <div>
            <span className="print-company">Control de Asistencias</span>
            <span className="print-doc">Cronograma Semanal</span>
          </div>
          <div className="print-meta">
            <span>{weekLabel}</span>
            <span>Sector: {sectorLabel}</span>
            <span>Impreso: {new Date().toLocaleDateString('es-ES')}</span>
          </div>
        </div>
      </div>

      {/* ── SCREEN HEADER ── */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 no-print">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center">
            Cronograma <span className="ml-2 text-indigo-600">Semanal</span>
          </h2>
          <p className="text-slate-500 font-medium">
            Planificación y asignación de turnos. {(currentUser.role === 'administrador' || currentUser.role === 'superusuario') ? 'Vista Global' : 'Tus sectores a cargo'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {((currentUser.role === 'administrador' || currentUser.role === 'superusuario') || (currentUser.role === 'encargado' && (currentUser.managed_sectors || []).length > 0)) && (
            <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sector:</span>
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 cursor-pointer"
              >
                <option value="all">Todos mis sectores</option>
                {sectors
                  .filter(s => sectorMap[s] !== undefined || s === 'General')
                  .filter(s => {
                    if (currentUser.role === 'administrador' || currentUser.role === 'superusuario') return true;
                    // Solo listar sectores a cargo
                    const mySectorIds = new Set<string>();
                    if (currentUser.sector_id) mySectorIds.add(currentUser.sector_id);
                    (currentUser.managed_sectors || []).forEach(id => mySectorIds.add(id));
                    return mySectorIds.has(s);
                  })
                  .map(s => <option key={s} value={s}>{sectorMap[s] || s}</option>)}
              </select>
            </div>
          )}

          <div className="flex items-center space-x-3 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
            <button onClick={handlePrevWeek} className="p-2 hover:bg-slate-50 rounded-xl transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
            <span className="px-4 text-xs font-black uppercase tracking-widest text-slate-500 min-w-[150px] text-center">
              {currentWeekStart.toLocaleDateString()} - {addDays(currentWeekStart, 6).toLocaleDateString()}
            </span>
            <button onClick={handleNextWeek} className="p-2 hover:bg-slate-50 rounded-xl transition-colors"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-600 transition-all shadow-lg no-print"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </header>

      {/* ── PRINT STYLES ── */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm 12mm;
          }

          /* Ocultar todo el DOM, mostrar solo header y tabla */
          body * { visibility: hidden; }
          .print-header,
          .print-header *,
          .schedule-table-wrapper,
          .schedule-table-wrapper * {
            visibility: visible;
          }

          /* FLUJO NORMAL: sin position fixed/absolute
             Así el navegador pagina automáticamente */
          .print-header {
            display: block !important;
            position: static !important;
            width: 100%;
            margin-bottom: 8px;
          }

          .schedule-table-wrapper {
            position: static !important;
            width: 100%;
            overflow: visible !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          /* Header de impresión */
          .print-header-top {
            display: flex !important;
            justify-content: space-between;
            align-items: flex-end;
            border-bottom: 2px solid #1e293b;
            padding-bottom: 5px;
            margin-bottom: 8px;
          }
          .print-company {
            display: block;
            font-size: 7pt;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.1em;
          }
          .print-doc {
            display: block;
            font-size: 14pt;
            font-weight: 700;
            color: #0f172a;
            line-height: 1.1;
          }
          .print-meta {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 2px;
            font-size: 7.5pt;
            color: #475569;
          }
          .print-meta span { display: block; }

          /* Tabla — flujo normal para paginación automática */
          .schedule-table-wrapper table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            font-size: 8pt !important;
          }

          /* thead se repite en cada página nueva */
          .schedule-table-wrapper thead {
            display: table-header-group !important;
          }

          .schedule-table-wrapper th {
            border: 1.5px solid #334155 !important;
            padding: 5px 4px !important;
            font-size: 8pt !important;
            font-weight: 700 !important;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            text-align: center;
            color: #0f172a;
            background: #ffffff !important;
          }
          .schedule-table-wrapper th:first-child {
            text-align: left;
            padding-left: 6px;
            width: 26%;
          }

          .schedule-table-wrapper td {
            border: 1.5px solid #334155 !important;
            padding: 4px 3px !important;
            font-size: 7.5pt !important;
            text-align: center;
            vertical-align: middle;
            background: #ffffff !important;
          }
          .schedule-table-wrapper td:first-child {
            text-align: left;
            padding-left: 6px;
          }

          /* Evitar que una fila se corte entre páginas */
          .schedule-table-wrapper tr {
            page-break-inside: avoid;
          }

          /* Badges: solo texto, sin fondo ni borde */
          .schedule-table-wrapper span {
            background: none !important;
            border: none !important;
            padding: 0 !important;
            font-size: 7pt !important;
            font-weight: 700 !important;
            color: #1e293b !important;
            box-shadow: none !important;
          }

          /* Ocultar avatares, botones y controles */
          .no-print,
          button, select, input,
          .fixed, header, nav {
            display: none !important;
          }
        }
      `}</style>

      {/* ── TABLE ── */}
      <div className="schedule-table-wrapper bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-6 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 sticky left-0 bg-slate-50 z-10">Empleado</th>
                {weekDays.map(d => (
                  <th key={d.toISOString()} className="px-2 py-6 text-center border-b border-slate-100 min-w-[100px]">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{d.toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                      <span className="text-xl font-black text-slate-700">{d.getDate()}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-slate-50/50 transition-colors border-r border-slate-50">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-sm no-print">
                        {emp.full_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-700 text-sm">{emp.full_name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{emp.role}</p>
                      </div>
                    </div>
                  </td>
                  {weekDays.map(d => {
                    const dateKey = formatDate(d);
                    const now = new Date();
                    const shiftStart = new Date(`${dateKey}T23:59:00`);
                    const isPast = now > shiftStart;
                    const shiftKey = `${emp.id}_${dateKey}`;

                    return (
                      <td
                        key={dateKey}
                        onClick={() => handleCellClick(emp, d)}
                        title={shifts[shiftKey] ? `Modificado por: ${shifts[shiftKey].last_modified_by} en ${new Date(shifts[shiftKey].last_modified_at).toLocaleString()}` : 'Sin asignar'}
                        className={`px-2 py-4 text-center cursor-pointer hover:bg-indigo-50 transition-colors border-l border-dashed border-slate-100 relative ${isPast ? 'opacity-70' : ''}`}
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

      {/* ── MODAL ── */}
      {isModalOpen && selectedTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-8 animate-in fade-in zoom-in duration-300">
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
              <div className="grid grid-cols-5 gap-2 p-1 bg-slate-100 rounded-xl">
                {(['continuous', 'split', 'off', 'vacation', 'medical'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setEditForm(prev => ({ ...prev, type: t }))}
                    className={`py-2 px-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all truncate ${editForm.type === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {t === 'continuous' ? 'Corrido' : t === 'split' ? 'Cortado' : t === 'off' ? 'Descanso' : t === 'vacation' ? 'Vacaciones' : 'Licencia Med.'}
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

              {editForm.type === 'split' && (
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

              <div className="pt-4 border-t border-slate-100">
                <button onClick={handleSave} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center space-x-2">
                  <Save className="w-5 h-5" />
                  <span>Guardar Cronograma</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleView;
