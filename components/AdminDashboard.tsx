
import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Download,
  CheckCircle,
  Clock,
  UserX,
  ShieldCheck,
  Activity,
  CalendarCheck,
} from 'lucide-react';
import { AttendanceRecord, Profile } from '../types';
import { attendanceService } from '../services/attendanceService';
import { personnelService } from '../services/personnelService';
import { settingsService, AttendanceRules } from '../services/settingsService';
import { sectorService, Sector } from '../services/sectorService';
import { supabase } from '../services/supabaseClient';
import { scheduleService } from '../services/scheduleService';
import { getLocalDateString } from '../utils/dateUtils';

interface AdminDashboardProps {
  currentUser: Profile;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser }) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [schedules, setSchedules] = useState<any[]>([]); // Today's schedules
  const [rules, setRules] = useState<AttendanceRules | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'present' | 'late' | 'absent' | 'history_all' | 'history_late' | 'history_absent'>('all');

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const [recordsRes, employeesRes, sectorsRes, schedulesRes, rulesRes] = await Promise.allSettled([
          attendanceService.getAll(),
          personnelService.getAll(),
          sectorService.getAll(),
          scheduleService.getAllSchedulesInRange(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
          settingsService.getRules()
        ]);

        const fetchedRecords = recordsRes.status === 'fulfilled' ? (recordsRes.value as AttendanceRecord[]) : [];
        const fetchedEmployees = employeesRes.status === 'fulfilled' ? (employeesRes.value as Profile[]) : [];
        const fetchedSectors = sectorsRes.status === 'fulfilled' ? (sectorsRes.value as Sector[]) : [];
        const fetchedSchedules = (schedulesRes.status === 'fulfilled' && schedulesRes.value) 
          ? schedulesRes.value 
          : [];
        const fetchedRules = rulesRes.status === 'fulfilled' ? rulesRes.value : null;

        setEmployees(fetchedEmployees);
        setRecords(fetchedRecords);
        setSectors(fetchedSectors);
        setSchedules(fetchedSchedules);
        setRules(fetchedRules);

        // Sincronización de ausencias del pasado y hoy (si pasó el período de gracia)
        if (fetchedEmployees.length > 0) {
           attendanceService.syncPastAbsences(fetchedEmployees).then(async () => {
             // Después de sincronizar, recargamos registros y cronogramas para coherencia total
             const [updatedRecords, updatedSchedules] = await Promise.all([
               attendanceService.getAll(),
               scheduleService.getAllSchedulesInRange(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
             ]);
             setRecords(updatedRecords);
             if (updatedSchedules) setSchedules(updatedSchedules);
           }).catch(e => console.error('Error in sync:', e));
        }
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDashboardData();
  }, []);

  // ── OPTIMIZED LOOKUP: SCHEDULE MAP ──
  // Creamos un mapa indexado por employeeId_date para búsqueda O(1) ultra rápida y fiable
  // IMPORTANTE: Normalizamos los IDs a minúsculas para evitar discrepancias de formato
  const scheduleMap = useMemo(() => {
    const map = new Map<string, any>();
    schedules.forEach(s => {
      const dateKey = s.date.substring(0, 10);
      const empId = s.employee_id?.toLowerCase();
      if (empId) {
        map.set(`${empId}_${dateKey}`, s);
      }
    });
    return map;
  }, [schedules]);

  const getSectorForEmployee = (employeeName: string) => {
    const emp = employees.find(e => e.full_name === employeeName);
    if (!emp) return 'Sin Sector';
    return sectors.find(s => s.id === emp.sector_id)?.name || emp.sector_id || 'Sin Sector';
  };

  // Determine authorized sectors based on role and permissions
  const authorizedSectors = useMemo(() => {
    const perms = currentUser.roles?.permissions || [];
    const hasGlobalView = perms.includes('VIEW_DASHBOARD');
    
    if (hasGlobalView) return null; // Null means global access
    
    // Restricted to assigned sectors
    const userSectors = [currentUser.sector_id, ...(currentUser.managed_sectors || [])].filter(Boolean) as string[];
    return userSectors;
  }, [currentUser]);

  // Filter employees first so other memos use the restricted list
  const authorizedEmployees = useMemo(() => {
    if (!authorizedSectors) return employees;
    return employees.filter(emp => emp.sector_id && authorizedSectors.includes(emp.sector_id));
  }, [employees, authorizedSectors]);

  // Filter records based on authorized employees
  const authorizedRecords = useMemo(() => {
    let recs = records;
    if (authorizedSectors) {
      recs = recs.filter(record => {
        const emp = employees.find(e => e.full_name === record.employee_name);
        return emp && emp.sector_id && authorizedSectors.includes(emp.sector_id);
      });
    }
    // Filtramos las ausencias generadas en periodo de prueba (antes o en 19 de Abril)
    return recs.filter(r => !(r.status === 'ausente' && r.date <= '2026-04-19'));
  }, [records, employees, authorizedSectors]);

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  // ── HELPER: GET SCHEDULED SHIFT ──
  const getScheduledShiftForRecord = (record: { employee_id: string, date: string, employee_name?: string }) => {
    if (!record) return 'Sin Turno';
    const dateKey = record.date.substring(0, 10);
    
    // Normalizamos el ID del registro si existe
    const normalizedRecordId = record.employee_id?.toLowerCase();

    // 1. Intentamos encontrar el objeto de perfil completo para tener el ID consolidado
    // Redundancia: Buscamos por ID o por Nombre (normalizado)
    const emp = employees.find(e => 
      (normalizedRecordId && e.id.toLowerCase() === normalizedRecordId) || 
      (record.employee_name && e.full_name.trim().toLowerCase() === record.employee_name.trim().toLowerCase())
    );

    const empId = emp?.id?.toLowerCase() || normalizedRecordId;
    if (!empId) return 'Sin Turno';

    const compositeKey = `${empId}_${dateKey}`;

    // 2. Prioridad: Horario específico en mapa 'schedules'
    const shift = scheduleMap.get(compositeKey);
    if (shift) {
      if (shift.type === 'off') return 'Descanso';
      if (shift.type === 'vacation') return 'Vacaciones';
      if (shift.type === 'medical') return 'Licencia Médica';
      if (shift.segments?.[0]) {
        return shift.segments.map((s: any) => `${s.start}-${s.end}`).join(' / ');
      }
    }
    
    // 3. Fallback: Horario base (plantilla) del perfil encontrado
    if (emp && emp.default_schedule) {
      const [year, month, day] = dateKey.split('-').map(Number);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const dayOfWeek = new Date(year, month - 1, day).getDay().toString();
        const defShift = emp.default_schedule[dayOfWeek];
        if (defShift) {
          if (defShift.type === 'off') return 'Descanso';
          if (defShift.type === 'vacation') return 'Vacaciones';
          if (defShift.type === 'medical') return 'Licencia Médica';
          if (defShift.segments?.[0]) {
            return defShift.segments.map((s: any) => `${s.start}-${s.end}`).join(' / ');
          }
        }
      }
    }

    if (record.status === 'vacaciones') return 'Vacaciones';
    if (record.status === 'licencia_medica') return 'Licencia Médica';
    if (record.status === 'descanso') return 'Descanso';

    return 'Sin Turno';
  };

  // ── VIRTUAL ABSENCES DETECTION ──
  const realTimeAbsences = useMemo(() => {
    const today = getLocalDateString();
    const now = new Date();
    const [y, mm, dd] = today.split('-').map(Number);
    const todayNum = new Date(y, mm - 1, dd).getDay().toString();
    const recordedEmpIds = new Set(records.filter(r => r.date === today).map(r => r.employee_id.toLowerCase()));
    
    const virtualAbsences: any[] = [];
    const gracePeriod = rules?.ausente_gracia || 120;

    authorizedEmployees.forEach(emp => {
      const empId = emp.id.toLowerCase();
      if (recordedEmpIds.has(empId)) return;

      // Usamos el mismo mapa de búsqueda con IDs normalizados
      let shift = scheduleMap.get(`${empId}_${today}`);
      
      if (!shift && emp.default_schedule) {
        const metadata = emp.default_schedule.metadata;
        if (!metadata?.valid_from || today >= metadata.valid_from) {
          shift = emp.default_schedule[todayNum];
        }
      }

      if (shift) {
        if (shift.type === 'off') {
          virtualAbsences.push({
            employee_id: emp.id,
            employee_name: emp.full_name,
            date: today,
            status: 'descanso',
            check_in: null,
            check_out: null,
            minutes_late: 0
          });
        } else if (shift.type === 'vacation' || shift.type === 'medical') {
          virtualAbsences.push({
            employee_id: emp.id,
            employee_name: emp.full_name,
            date: today,
            status: shift.type === 'vacation' ? 'vacaciones' : 'licencia_medica',
            check_in: null,
            check_out: null,
            minutes_late: 0
          });
        } else {
          if (today <= '2026-04-19') return; // Evitar generar ausencias virtuales antes de la fecha de inicio

          // Es un turno normal (continuous / split)
          const shiftStartStr = shift.segments?.[0]?.start;
          if (shiftStartStr) {
            const [h, m] = shiftStartStr.split(':').map(Number);
            const shiftStart = new Date(y, mm - 1, dd, h, m);
            const minutesSinceStart = (now.getTime() - shiftStart.getTime()) / 60000;
            
            if (minutesSinceStart >= gracePeriod) {
              virtualAbsences.push({
                employee_id: emp.id,
                employee_name: emp.full_name,
                date: today,
                status: 'ausente',
                check_in: null,
                check_out: null,
                minutes_late: 0
              });
            }
          }
        }
      }
    });
    return virtualAbsences;
  }, [records, authorizedEmployees, rules, scheduleMap, schedules]);

  // ── RECORD CORRECTION FALLBACK ──
  // Si un registro "ausente" fue generado antes de que se asignaran vacaciones/licencias en el cronograma, 
  // esto corrige visualmente su estado en tiempo real.
  const correctedRecords = useMemo(() => {
    return authorizedRecords.map(r => {
      if (r.check_in) return r; // Si tiene fichada real, no intervenimos.

      const normalizedRecordId = r.employee_id?.toLowerCase();
      const emp = employees.find(e => 
        (normalizedRecordId && e.id.toLowerCase() === normalizedRecordId) || 
        (r.employee_name && e.full_name.trim().toLowerCase() === r.employee_name.trim().toLowerCase())
      );
      const empId = emp?.id?.toLowerCase() || normalizedRecordId;
      if (!empId) return r;

      const dateKey = r.date.substring(0, 10);
      let shift = scheduleMap.get(`${empId}_${dateKey}`);
      
      if (!shift && emp.default_schedule) {
        const [y, mm, dd] = dateKey.split('-').map(Number);
        if (!isNaN(y) && !isNaN(mm) && !isNaN(dd)) {
            const dayOfWeek = new Date(y, mm - 1, dd).getDay().toString();
            const defShift = emp.default_schedule[dayOfWeek];
            if (defShift) shift = defShift;
        }
      }
      
      if (shift) {
        if (shift.type === 'off') return { ...r, status: 'descanso' };
        if (shift.type === 'vacation') return { ...r, status: 'vacaciones' };
        if (shift.type === 'medical') return { ...r, status: 'licencia_medica' };
      }
      return r;
    });
  }, [authorizedRecords, scheduleMap, employees]);

  const filteredRecords = useMemo(() => {
    const today = getLocalDateString();
    let baseRecs: AttendanceRecord[] = [];

    if (activeFilter.startsWith('history')) {
      // 30 day history mode
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      baseRecs = correctedRecords.filter(r => new Date(r.date) >= thirtyDaysAgo);

      if (activeFilter === 'history_absent') {
        baseRecs = baseRecs.filter(r => r.status === 'ausente');
      } else if (activeFilter === 'history_late') {
        baseRecs = baseRecs.filter(r => r.status === 'tarde' || r.status === 'sin_presentismo');
      } else if (activeFilter === 'history_all') {
        baseRecs = baseRecs.filter(r => ['en_horario', 'presente', 'manual', 'tarde', 'sin_presentismo'].includes(r.status));
      }
    } else {
      // Today mode
      const todayRecs = correctedRecords.filter(r => r.date === today);
      baseRecs = [...todayRecs, ...realTimeAbsences];

      if (activeFilter === 'present') {
        baseRecs = baseRecs.filter(r => ['en_horario', 'tarde', 'presente', 'manual', 'sin_presentismo'].includes(r.status));
      } else if (activeFilter === 'late') {
        baseRecs = baseRecs.filter(r => r.status === 'tarde' || r.status === 'sin_presentismo');
      } else if (activeFilter === 'absent') {
        baseRecs = baseRecs.filter(r => r.status === 'ausente');
      } else if (activeFilter === 'off') {
        baseRecs = baseRecs.filter(r => r.status === 'descanso');
      } else if (activeFilter === 'vacation') {
        baseRecs = baseRecs.filter(r => r.status === 'vacaciones' || r.status === 'licencia_medica');
      }
    }

    return baseRecs.filter(r => {
      const search = searchTerm.toLowerCase();
      const sectorName = getSectorForEmployee(r.employee_name).toLowerCase();
      return r.employee_name.toLowerCase().includes(search) || sectorName.includes(search);
    });
  }, [authorizedRecords, realTimeAbsences, searchTerm, activeFilter, employees, sectors]);

  const stats = useMemo(() => {
    const today = getLocalDateString();
    const todayRecs = correctedRecords.filter(r => r.date === today);
    const allTodayRecords = [...todayRecs, ...realTimeAbsences];

    return {
      presentes: allTodayRecords.filter(r => ['en_horario', 'tarde', 'presente', 'manual', 'sin_presentismo'].includes(r.status)).length,
      tardes: allTodayRecords.filter(r => r.status === 'tarde' || r.status === 'sin_presentismo').length,
      ausentes: allTodayRecords.filter(r => r.status === 'ausente').length,
      descansos: allTodayRecords.filter(r => r.status === 'descanso').length,
      vacaciones: allTodayRecords.filter(r => r.status === 'vacaciones' || r.status === 'licencia_medica').length
    };
  }, [correctedRecords, realTimeAbsences]);

  // Heatmap Data Generation
  const heatmapData = useMemo(() => {
    const days: { date: string, count: number, month: number }[] = [];
    const today = new Date();
    // 365 days ago
    for (let i = 365; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = authorizedRecords.filter(r => r.date === dateStr && ['presente', 'tarde', 'en_horario', 'manual'].includes(r.status)).length;
      days.push({ date: dateStr, count, month: d.getMonth() });
    }

    const weeks: (typeof days[0] | null)[][] = [];
    let currentWeek: (typeof days[0] | null)[] = [];
    
    // pad to start on correct week day (Sunday = 0 in JS)
    const firstDayOffset = new Date(days[0].date).getDay();
    for(let i=0; i<firstDayOffset; i++) {
       currentWeek.push(null);
    }
    
    days.forEach(day => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });
    if (currentWeek.length > 0) {
      // pad the end to have 7 boxes
      while(currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }
    return weeks;
  }, [authorizedRecords]);

  const getHeatmapColor = (count: number) => {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800';
    if (count < 3) return 'bg-indigo-300';
    if (count < 6) return 'bg-indigo-400';
    if (count < 10) return 'bg-indigo-500';
    return 'bg-indigo-600';
  };

  // 30 Days Stats
  const thirtyDaysStats = useMemo(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const recentRecords = authorizedRecords.filter(r => new Date(r.date) >= thirtyDaysAgo);

    const presentes = recentRecords.filter(r => ['presente', 'en_horario', 'manual', 'tarde', 'sin_presentismo'].includes(r.status)).length;
    const tardanzas = recentRecords.filter(r => r.status === 'tarde' || r.status === 'sin_presentismo').length;
    const ausencias = recentRecords.filter(r => r.status === 'ausente').length;

    const total = presentes + tardanzas + ausencias;
    const puntualidad = total > 0 ? Math.round(((presentes) / total) * 100) : 0;

    return { presentes, tardanzas, ausencias, puntualidad };
  }, [authorizedRecords]);

  const handleExportMonthly = () => {
    const headers = ["Fecha", "Empleado", "Sector", "Turno", "Entrada", "Salida", "Estatus"];
    const rows = filteredRecords.map(r => [
      r.date,
      r.employee_name,
      getSectorForEmployee(r.employee_name),
      getScheduledShiftForRecord(r),
      formatTime(r.check_in),
      formatTime(r.check_out),
      r.status === 'sin_presentismo' ? 'Llegada Tarde' : r.status
    ]);

    const csvContent = [headers.join(";"), ...rows.map(row => row.join(";"))].join("\n");
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Reporte_${getLocalDateString()}.csv`;
    link.click();
  };

  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-700 bg-slate-50/50 min-h-screen">
      
      {/* 1. Top Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
        {[
          { id: 'present', label: 'Presentes', value: stats.presentes, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50', activeColor: 'ring-emerald-500 bg-emerald-100' },
          { id: 'late', label: 'Tardanzas', value: stats.tardes, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', activeColor: 'ring-amber-500 bg-amber-100' },
          { id: 'absent', label: 'Ausencias', value: stats.ausentes, icon: UserX, color: 'text-rose-500', bg: 'bg-rose-50', activeColor: 'ring-rose-500 bg-rose-100' },
          { id: 'off', label: 'Descansos', value: stats.descansos, icon: CalendarCheck, color: 'text-slate-500', bg: 'bg-slate-50', activeColor: 'ring-slate-500 bg-slate-100' },
          { id: 'vacation', label: 'Vacaciones/Lic.', value: stats.vacaciones, icon: ShieldCheck, color: 'text-sky-500', bg: 'bg-sky-50', activeColor: 'ring-sky-500 bg-sky-100' },
          { id: 'all', label: 'Totales', value: authorizedEmployees.length, icon: Activity, color: 'text-indigo-500', bg: 'bg-indigo-50', activeColor: 'ring-indigo-500 bg-indigo-100' },
        ].map((stat, i) => (
          <button 
            key={i} 
            onClick={() => setActiveFilter(activeFilter === stat.id ? 'all' : stat.id as any)}
            className={`bg-white px-3 md:px-4 py-3 md:py-4 rounded-2xl md:rounded-3xl border transition-all text-left flex flex-col items-start gap-2 lg:gap-3 hover:shadow-md active:scale-95 ${activeFilter === stat.id ? `ring-2 ${stat.activeColor} border-transparent` : 'border-slate-100 shadow-sm'}`}
          >
            <div className={`p-2 lg:p-3 rounded-xl lg:rounded-2xl shrink-0 ${stat.bg}`}>
              <stat.icon className={`w-4 h-4 lg:w-5 lg:h-5 ${stat.color}`} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-xl md:text-2xl font-black text-slate-800 leading-none mt-1">{stat.value}</p>
            </div>
          </button>
        ))}
      </div>

      {/* 2. Middle Section: Heatmap & 30-Day Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Heatmap (Activity Calendar) */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center space-x-3 mb-8">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <Activity className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Actividad de Asistencia</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Frecuencia de registros en los últimos meses</p>
            </div>
          </div>
          
          <div className="overflow-x-auto pb-4 custom-scrollbar">
            <div className="flex flex-col min-w-max">
              {/* Month Labels */}
              <div className="flex text-[10px] font-bold text-slate-400 mb-3 justify-between pr-4">
                {monthNames.map((m, i) => (
                  <span key={i} className="flex-1 min-w-[32px]">{m}</span>
                ))}
              </div>
              
              {/* Heatmap Grid */}
              <div className="flex gap-1.5">
                {heatmapData.map((week, wIndex) => (
                  <div key={wIndex} className="flex flex-col gap-1.5">
                    {week.map((day, dIndex) => (
                      <div 
                        key={dIndex} 
                        className={`w-[14px] h-[14px] md:w-[15px] md:h-[15px] rounded-sm transition-all hover:ring-2 hover:ring-indigo-300 hover:scale-110 cursor-pointer ${day ? getHeatmapColor(day.count) : 'bg-transparent'}`}
                        title={day ? `${day.count} asistencias el ${day.date}` : ''}
                      />
                    ))}
                  </div>
                ))}
              </div>
               
              {/* Heatmap Legend */}
              <div className="flex items-center justify-end mt-4 space-x-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                <span>Menos</span>
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded-sm bg-slate-100"></div>
                  <div className="w-3 h-3 rounded-sm bg-indigo-300"></div>
                  <div className="w-3 h-3 rounded-sm bg-indigo-400"></div>
                  <div className="w-3 h-3 rounded-sm bg-indigo-500"></div>
                  <div className="w-3 h-3 rounded-sm bg-indigo-600"></div>
                </div>
                <span>Más</span>
              </div>
            </div>
          </div>
        </div>

        {/* 30-Day Summary */}
        <div className="bg-[#131B2A] p-6 md:p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none"></div>
          <div>
            <h3 className="font-bold text-xl mb-1">Resumen 30 Días</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">Estadísticas de rendimiento global</p>
            
            <div className="space-y-4">
              <button 
                onClick={() => setActiveFilter('history_all')}
                className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${activeFilter === 'history_all' ? 'bg-indigo-500/20 ring-1 ring-indigo-500/50' : 'hover:bg-white/5'}`}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-1.5 rounded-full bg-emerald-500/10">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-300">En Horario</span>
                </div>
                <span className="font-black text-lg">{thirtyDaysStats.presentes}</span>
              </button>

              <button 
                onClick={() => setActiveFilter('history_late')}
                className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${activeFilter === 'history_late' ? 'bg-amber-500/20 ring-1 ring-amber-500/50' : 'hover:bg-white/5'}`}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-1.5 rounded-full bg-amber-500/10">
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-300">Tardanzas</span>
                </div>
                <span className="font-black text-lg">{thirtyDaysStats.tardanzas}</span>
              </button>

              <button 
                onClick={() => setActiveFilter('history_absent')}
                className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${activeFilter === 'history_absent' ? 'bg-rose-500/20 ring-1 ring-rose-500/50' : 'hover:bg-white/5'}`}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-1.5 rounded-full bg-rose-500/10">
                    <UserX className="w-4 h-4 text-rose-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-300">Ausencias</span>
                </div>
                <span className="font-black text-lg">{thirtyDaysStats.ausencias}</span>
              </button>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-700/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Puntualidad</span>
              <span className="text-sm font-black text-indigo-300">{thirtyDaysStats.puntualidad}%</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-400 rounded-full transition-all duration-1000 ease-out" 
                style={{ width: `${thirtyDaysStats.puntualidad}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom Data Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar empleado o sector..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50/50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold transition-all placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center space-x-4">
             {activeFilter !== 'all' && (
               <button 
                 onClick={() => setActiveFilter('all')}
                 className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100"
               >
                 Limpiar Filtro
               </button>
             )}
            <button onClick={handleExportMonthly} className="flex items-center space-x-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition-all shadow-md shadow-slate-900/10">
              <Download className="w-4 h-4" />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/30">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {activeFilter.startsWith('history') ? 'Fecha / Empleado' : 'Empleado'}
                </th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Turno Asignado</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Entrada</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Salida</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Estatus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={4} className="px-8 py-10 text-center text-slate-400 font-bold text-sm">Cargando datos...</td></tr>
              ) : filteredRecords.length === 0 ? (
                <tr><td colSpan={4} className="px-8 py-10 text-center text-slate-400 font-bold text-sm">Sin registros que coincidan con la búsqueda.</td></tr>
              ) : filteredRecords.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div>
                      {activeFilter.startsWith('history') && (
                        <span className="text-[9px] font-black text-indigo-500 uppercase tracking-tighter mb-1 block">
                          {new Date(r.date + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                      <span className="block font-black text-slate-700">{r.employee_name}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{getSectorForEmployee(r.employee_name)}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-tight">
                      {getScheduledShiftForRecord(r)}
                    </span>
                  </td>
                  <td className="px-8 py-5 font-bold text-slate-600 text-sm">{formatTime(r.check_in)}</td>
                  <td className="px-8 py-5 font-bold text-slate-600 text-sm">{formatTime(r.check_out)}</td>
                  <td className="px-8 py-5 text-right flex justify-end">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center shadow-sm border ${
                      (r.status === 'en_horario' || r.status === 'presente') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      r.status === 'tarde' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                      r.status === 'sin_presentismo' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                      'bg-slate-50 text-slate-500 border-slate-200'
                    }`}>
                      {r.status === 'en_horario' || r.status === 'presente' ? 'En Horario' :
                       r.status === 'sin_presentismo' ? 'Llegada Tarde' : 
                       r.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
