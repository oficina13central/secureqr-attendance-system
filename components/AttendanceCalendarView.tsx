import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Printer,
  Info,
  X,
  AlertCircle,
  CheckCircle2,
  Clock3,
  UserX
} from 'lucide-react';
import { Profile, AttendanceRecord } from '../types';
import { scheduleService, ShiftData } from '../services/scheduleService';
import { attendanceService } from '../services/attendanceService';
import { sectorService } from '../services/sectorService';
import { getLocalDateString } from '../utils/dateUtils';

interface AttendanceCalendarViewProps {
  employees: Profile[];
  currentUser: { name: string; role: string; sector_id?: string };
}

// --- Date Helpers ---
const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // Subtract current day of week to jump to Sunday (0)
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

const AttendanceCalendarView: React.FC<AttendanceCalendarViewProps> = ({
  employees,
  currentUser
}) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));
  const [shifts, setShifts] = useState<Record<string, ShiftData>>({});
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord[]>>({});
  const [sectorMap, setSectorMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Modal State
  const [selectedRecord, setSelectedRecord] = useState<{ record: AttendanceRecord; shift?: ShiftData } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const startDate = formatDate(currentWeekStart);
      const endDate = formatDate(addDays(currentWeekStart, 6));

      const [shiftsData, attendanceData, sectorsData] = await Promise.all([
        scheduleService.getByWeek(startDate, endDate),
        attendanceService.getByDateRange(startDate, endDate),
        sectorService.getAll()
      ]);

      const shiftMap = shiftsData.reduce((acc, shift) => {
        acc[`${shift.employee_id}_${shift.date}`] = shift;
        return acc;
      }, {} as Record<string, ShiftData>);

      const attendanceMap = attendanceData.reduce((acc, record) => {
        const key = `${record.employee_id}_${record.date}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(record);
        return acc;
      }, {} as Record<string, AttendanceRecord[]>);

      const sMap: Record<string, string> = {};
      sectorsData.forEach(s => sMap[s.id] = s.name);

      setShifts(shiftMap);
      setAttendance(attendanceMap);
      setSectorMap(sMap);
      setLoading(false);
    };
    fetchData();
  }, [currentWeekStart]);

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
        days.push(addDays(currentWeekStart, i));
    }
    return days;
  }, [currentWeekStart]);

  const filteredEmployees = useMemo(() => {
    if (currentUser.role === 'encargado') {
      return employees.filter(e => e.sector_id === currentUser.sector_id);
    }
    return employees;
  }, [employees, currentUser]);

  const handlePrevWeek = () => setCurrentWeekStart(addDays(currentWeekStart, -7));
  const handleNextWeek = () => setCurrentWeekStart(addDays(currentWeekStart, 7));

  const renderStatusBadge = (records: AttendanceRecord[], shift?: ShiftData, isPast?: boolean, isToday?: boolean) => {
    if (records && records.length > 0) {
        // Find the "worst" status or most relevant
        const hasLate = records.some(r => r.status === 'tarde' || r.status === 'sin_presentismo');
        const hasOnTime = records.some(r => r.status === 'en_horario');
        
        if (hasLate) {
            const lateRecord = records.find(r => r.status === 'tarde' || r.status === 'sin_presentismo');
            return (
                <div 
                    onClick={(e) => {
                        e.stopPropagation();
                        if (lateRecord) setSelectedRecord({ record: lateRecord, shift });
                    }}
                    className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform"
                >
                    <span className="bg-amber-100 text-amber-700 border border-amber-200 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-sm">
                        <Clock3 className="w-3 h-3" /> Tarde
                    </span>
                    {lateRecord && lateRecord.minutes_late > 0 && (
                        <span className="text-[8px] font-bold text-amber-600 mt-1">+{lateRecord.minutes_late} min</span>
                    )}
                </div>
            );
        }
        
        if (hasOnTime) {
            return (
                <div className="flex flex-col items-center">
                    <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-sm">
                        <CheckCircle2 className="w-3 h-3" /> A Tiempo
                    </span>
                </div>
            );
        }

        // Other statuses (manual, etc)
        const record = records[0];
        if (record.status === 'ausente') {
            return (
                <div className="flex flex-col items-center">
                    <span className="bg-rose-100 text-rose-700 border border-rose-200 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-sm">
                        <UserX className="w-3 h-3" /> Ausente
                    </span>
                </div>
            );
        }
    }

    if (shift) {
        if (shift.type === 'off') {
            return (
                <div className="flex flex-col items-center opacity-60">
                    <span className="bg-slate-100 text-slate-400 border border-slate-200 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest">
                        Franco
                    </span>
                </div>
            );
        }
        if (shift.type === 'vacation') {
            return (
                <div className="flex flex-col items-center">
                    <span className="bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest shadow-sm">
                        Vacaciones
                    </span>
                </div>
            );
        }

        // If it's a work day but no record
        if (isPast) {
            // For today: only show 'Ausente' if shift start + grace period has passed
            if (isToday && shift.segments && shift.segments[0]?.start) {
                const now = new Date();
                const [h, m] = shift.segments[0].start.split(':').map(Number);
                const shiftStart = new Date();
                shiftStart.setHours(h, m, 0, 0);
                const gracePeriodMinutes = 120; // Default grace period
                const minutesSinceStart = (now.getTime() - shiftStart.getTime()) / 60000;
                
                // If the shift hasn't started yet or grace period hasn't elapsed, don't show absent
                if (minutesSinceStart < gracePeriodMinutes) {
                    return <span className="text-slate-200 text-[10px]">—</span>;
                }
            }

            return (
                <div className="flex flex-col items-center">
                    <span className="bg-rose-100 text-rose-700 border border-rose-200 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-sm">
                        <UserX className="w-3 h-3" /> Ausente
                    </span>
                </div>
            );
        }
    }

    return <span className="text-slate-200 text-[10px]">—</span>;
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center">
            Control de <span className="ml-2 text-indigo-600">Asistencia</span>
          </h2>
          <p className="text-slate-500 font-medium">
            Seguimiento de puntualidad y ausentismo.
          </p>
        </div>


        <div className="flex items-center space-x-3 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          <button onClick={handlePrevWeek} className="p-2 hover:bg-slate-50 rounded-xl transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
          <span className="px-4 text-xs font-black uppercase tracking-widest text-slate-500 min-w-[150px] text-center">
            {currentWeekStart.toLocaleDateString()} - {addDays(currentWeekStart, 6).toLocaleDateString()}
          </span>
          <button onClick={handleNextWeek} className="p-2 hover:bg-slate-50 rounded-xl transition-colors"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
        </div>
      </header>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-6 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 sticky left-0 bg-slate-50 z-10">Empleado</th>
                {weekDays.map(d => (
                  <th key={d.toISOString()} className="px-2 py-6 text-center border-b border-slate-100 min-w-[120px]">
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
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-sm">
                        {emp.full_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-700 text-sm whitespace-nowrap">{emp.full_name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{emp.sector_id ? (sectorMap[emp.sector_id] || emp.sector_id) : 'Sin Sector'}</p>
                      </div>
                    </div>
                  </td>
                  {weekDays.map(d => {
                    const dateKey = formatDate(d);
                    const today = new Date();
                    const todayStr = getLocalDateString(today);
                    const isToday = dateKey === todayStr;
                    const isPast = dateKey < todayStr || isToday; // Today counts as "past" but with shift-aware logic
                    const shiftKey = `${emp.id}_${dateKey}`;
                    const records = attendance[shiftKey] || [];
                    
                    // Resolve shift: first check overrides, then fallback to default_schedule
                    let shift = shifts[shiftKey];
                    if (!shift && emp.default_schedule) {
                      const dateObj = new Date(dateKey + 'T12:00:00');
                      if (!isNaN(dateObj.getTime())) {
                        const dow = dateObj.getDay().toString();
                        const base = emp.default_schedule[dow];
                        if (base) {
                          shift = base as any;
                        }
                      }
                    }

                    return (
                      <td key={dateKey} className="px-2 py-6 text-center border-l border-dashed border-slate-100 relative">
                        {renderStatusBadge(records, shift, isPast, isToday)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-8 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-50 rounded-2xl">
                    <Clock3 className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">Detalle de Tardanza</h3>
                  <p className="text-sm text-slate-500 font-medium">
                    {selectedRecord.record.employee_name}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-50 rounded-3xl p-6 space-y-4 border border-slate-100">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Fecha</span>
                  <span className="text-slate-800 font-black">{new Date(selectedRecord.record.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm border-t border-slate-200 pt-4">
                  <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Entrada Registrada</span>
                  <span className="text-slate-800 font-black">
                    {selectedRecord.record.check_in ? new Date(selectedRecord.record.check_in).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                </div>

                {selectedRecord.shift && selectedRecord.shift.segments && selectedRecord.shift.segments[0] && (
                    <div className="flex justify-between items-center text-sm border-t border-slate-200 pt-4 text-indigo-600">
                        <span className="font-bold uppercase tracking-widest text-[10px]">Horario Programado</span>
                        <span className="font-black">{selectedRecord.shift.segments[0].start} HS</span>
                    </div>
                )}

                <div className="flex justify-between items-center text-sm border-t border-slate-200 pt-4">
                  <span className="text-rose-500 font-bold uppercase tracking-widest text-[10px]">Retraso Total</span>
                  <div className="flex items-center gap-2">
                    <span className="text-rose-600 font-black text-lg">{selectedRecord.record.minutes_late} min</span>
                  </div>
                </div>
              </div>

              {selectedRecord.record.manual_reason && (
                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Nota / Observación</p>
                      <p className="text-sm text-indigo-700 font-medium italic">"{selectedRecord.record.manual_reason}"</p>
                  </div>
              )}

              <button 
                onClick={() => setSelectedRecord(null)}
                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <span>Cerrar Detalle</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceCalendarView;
