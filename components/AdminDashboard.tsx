
import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  AlertTriangle,
  PlusCircle,
  MoreVertical,
  CheckCircle,
  Clock,
  UserX,
  ShieldCheck,
  QrCode,
  Copy,
  Check
} from 'lucide-react';
import { FraudReport, AttendanceRecord, Profile } from '../types';
import { attendanceService } from '../services/attendanceService';
import { personnelService } from '../services/personnelService';
import { settingsService, AttendanceRules } from '../services/settingsService';
import { scheduleService, ShiftData } from '../services/scheduleService';
import { sectorService, Sector } from '../services/sectorService';
import { getLocalDateString } from '../utils/dateUtils';

const AdminDashboard: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<Record<string, ShiftData>>({});
  const [rules, setRules] = useState<AttendanceRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [sectors, setSectors] = useState<Sector[]>([]);

  React.useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const today = getLocalDateString();

        // Fetch everything independently to avoid one failing the rest
        const [recordsRes, statsRes, employeesRes, rulesRes, schedulesRes, sectorsRes] = await Promise.allSettled([
          attendanceService.getAll(),
          attendanceService.getTodayStats(),
          personnelService.getAll(),
          settingsService.getRules(),
          scheduleService.getByWeek(today, today),
          sectorService.getAll()
        ]);

        if (recordsRes.status === 'fulfilled') setRecords(recordsRes.value);
        if (employeesRes.status === 'fulfilled') setEmployees(employeesRes.value);
        if (rulesRes.status === 'fulfilled') setRules(rulesRes.value);
        if (sectorsRes.status === 'fulfilled') setSectors(sectorsRes.value);

        if (schedulesRes.status === 'fulfilled') {
          const scheduleMap = schedulesRes.value.reduce((acc, s) => {
            acc[s.employee_id] = s;
            return acc;
          }, {} as Record<string, ShiftData>);
          setTodaySchedules(scheduleMap);
        }

        if (employeesRes.status === 'fulfilled') {
          attendanceService.syncPastAbsences(employeesRes.value).then(() => {
            attendanceService.getAll().then(setRecords);
          });
        }
      } catch (err) {
        console.error('Error crítico cargando Dashboard:', err);
      } finally {
        // Garantizar que deje de cargar
        setTimeout(() => setLoading(false), 500);
      }
    };
    loadDashboardData();
  }, []);

  const getFullDayStatus = useMemo(() => {
    const today = getLocalDateString();
    const now = new Date();
    const isSunday = now.getDay() === 0;

    return employees.map(emp => {
      // Priorizar el registro que tenga una hora de entrada real sobre un placeholder (ausente/pendiente/descanso)
      const dayRecords = records.filter(r => r.employee_name === emp.full_name && r.date === today);
      const record = dayRecords.find(r => r.check_in !== null) || dayRecords[0];

      const schedule = todaySchedules[emp.id];

      if (record) return record;

      // No record: Determine if Pendiente, Ausente or Descanso
      let status: 'ausente' | 'descanso' | 'pendiente' = 'ausente';

      if (schedule) {
        if (schedule.type === 'off') {
          status = 'descanso';
        } else if (schedule.segments && schedule.segments.length > 0) {
          // Tomamos el primer segmento para determinar si ya debería haber llegado
          const firstSegment = schedule.segments[0];
          const [hours, minutes] = firstSegment.start.split(':').map(Number);

          const startTime = new Date(now);
          startTime.setHours(hours, minutes, 0, 0);

          if (now < startTime) {
            status = 'pendiente';
          } else {
            status = 'ausente';
          }
        }
      } else if (isSunday) {
        status = 'descanso';
      }

      return {
        id: `virtual_${emp.id}`,
        employee_name: emp.full_name,
        date: today,
        check_in: null,
        check_out: null,
        status: status,
        minutes_late: 0
      } as AttendanceRecord;
    });
  }, [employees, records, todaySchedules]);

  // Recalculate stats based on combined view
  const displayStats = useMemo(() => {
    const today = getLocalDateString();
    const todaysCombined = getFullDayStatus.filter(r => r.date === today);

    return {
      presentes: todaysCombined.filter(r => r.status === 'en_horario' || r.status === 'presente' || r.status === 'manual' || r.status === 'sin_presentismo' || r.status === 'tarde').length,
      tardes: todaysCombined.filter(r => r.status === 'tarde').length,
      ausentes: todaysCombined.filter(r => r.status === 'ausente').length
    };
  }, [getFullDayStatus]);

  const getCumulativeMinutes = (employeeId: string) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Asumiendo que el employeeId está disponible en el registro de asistencia. 
    // Si no, buscaremos por nombre como fallback seguro para este demo.
    return records
      .filter(r => {
        const d = new Date(r.date);
        // Filtrar por mes actual y por nombre/id de empleado
        const isSameMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        // Buscamos coincidencia de nombre si no hay ID directo en el objeto (nuestra interfaz tiene employee_name)
        const emp = employees.find(e => e.id === employeeId);
        return isSameMonth && r.employee_name === emp?.full_name;
      })
      .reduce((sum, r) => sum + (r.minutes_late || 0), 0);
  };

  const getSectorForEmployee = (employeeName: string) => {
    const emp = employees.find(e => e.full_name === employeeName);
    if (!emp) return 'Sin Sector';

    // Resolve robustly
    return sectors.find(s => s.id === emp.sector_id)?.name ||
      sectors.find(s => s.name === emp.sector_id)?.name ||
      emp.sector_id || 'Sin Sector';
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const testToken = "SECURE_USER:Juan_Perez_7782";



  const copyTestToken = () => {
    navigator.clipboard.writeText(testToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight flex items-center">
            Control de <span className="ml-2 text-indigo-600">Asistencias</span>
          </h2>
          <p className="text-slate-500 font-medium">Control biométrico y auditoría IA descentralizada.</p>
        </div>

        <div className="flex items-center space-x-3">
          {/* AI Button Removed */}
        </div>
      </header>

      {/* Test QR Utility */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-white rounded-2xl shadow-sm border border-indigo-100">
            <QrCode className="w-8 h-8 text-indigo-600" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800">Utilidad de Pruebas</h4>
            <p className="text-sm text-slate-500">Use este token para generar un QR de prueba o péguelo en una app de generación de QR.</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 bg-white px-4 py-3 rounded-xl border border-indigo-200 shadow-sm w-full md:w-auto overflow-hidden">
          <code className="text-xs font-mono text-indigo-700 truncate">{testToken}</code>
          <button
            onClick={copyTestToken}
            className="ml-4 p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-indigo-600"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Presentes hoy', value: displayStats.presentes.toString(), icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Tardanzas', value: displayStats.tardes.toString(), icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'Ausencias', value: displayStats.ausentes.toString(), icon: UserX, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Integridad', value: '98%', icon: ShieldCheck, color: 'text-indigo-500', bg: 'bg-indigo-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex items-center space-x-5 group">
            <div className={`p-4 rounded-2xl ${stat.bg} group-hover:scale-110 transition-transform`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">{stat.label}</p>
              <p className="text-3xl font-black text-slate-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>



      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filtro rápido por empleado o sector..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
            />
          </div>
          <div className="flex items-center space-x-3">
            <button className="flex items-center space-x-2 px-6 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-50 transition-all shadow-sm">
              <Filter className="w-4 h-4" />
              <span>Filtros Avanzados</span>
            </button>
            <button className="flex items-center space-x-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-600 transition-all shadow-lg">
              <Download className="w-4 h-4" />
              <span>Reporte Mensual</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Empleado</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Registro</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Check-in</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Check-out</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Minutos Mes</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Estatus</th>
                <th className="px-8 py-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-8 py-10 text-center text-slate-400 font-medium">Cargando datos...</td>
                </tr>
              ) : getFullDayStatus.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-8 py-10 text-center text-slate-400 font-medium">No hay registros de asistencia para mostrar.</td>
                </tr>
              ) : getFullDayStatus.map((record) => (
                <tr key={record.id} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center font-black text-indigo-600 text-lg shadow-sm">
                        {record.employee_name.charAt(0)}
                      </div>
                      <div>
                        <span className="block font-black text-slate-700 text-lg leading-tight">{record.employee_name}</span>
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{getSectorForEmployee(record.employee_name)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-sm font-bold text-slate-500">{record.date}</span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${record.check_in ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                      <span className="text-sm font-black text-slate-800">{formatTime(record.check_in)}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-sm font-black text-slate-800">{formatTime(record.check_out)}</td>
                  <td className="px-8 py-6">
                    {(() => {
                      // Necesitamos el ID del empleado para calcular el acumulado
                      const emp = employees.find(e => e.full_name === record.employee_name);
                      if (!emp) return <span className="text-slate-300">--</span>;

                      const cumulative = getCumulativeMinutes(emp.id);
                      const isOverLimit = rules && cumulative > rules.max_mensual;

                      return (
                        <div className="flex flex-col">
                          <span className={`text-sm font-black ${isOverLimit ? 'text-red-500' : 'text-slate-700'}`}>
                            {cumulative} min
                          </span>
                          {isOverLimit && (
                            <span className="text-[9px] font-black text-red-400 uppercase animate-pulse">Excedido</span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${(record.status === 'en_horario' || record.status === 'presente') ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                      record.status === 'tarde' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                        record.status === 'sin_presentismo' ? 'bg-red-100 text-red-700 border border-red-200' :
                          record.status === 'manual' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                            record.status === 'descanso' ? 'bg-slate-100 text-slate-500 border border-slate-200' :
                              record.status === 'pendiente' ? 'bg-indigo-50 text-indigo-400 border border-indigo-100' :
                                'bg-red-50 text-red-600 border border-red-100' // Para 'ausente' u otros
                      }`}>
                      {record.status === 'sin_presentismo' ? 'Sin Presentismo' :
                        (record.status === 'en_horario' || record.status === 'presente') ? 'En Horario' :
                          record.status.charAt(0).toUpperCase() + record.status.slice(1).replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button className="p-3 rounded-xl opacity-0 group-hover:opacity-100 hover:bg-white hover:shadow-sm transition-all text-slate-400 hover:text-indigo-600">
                      <MoreVertical className="w-5 h-5" />
                    </button>
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
