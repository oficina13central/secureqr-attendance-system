
import React, { useState, useMemo } from 'react';
import {
  Search,
  Download,
  AlertTriangle,
  MoreVertical,
  CheckCircle,
  Clock,
  UserX,
  ShieldCheck,
  QrCode,
  Copy,
  Check,
  BrainCircuit
} from 'lucide-react';
import { AttendanceRecord, Profile } from '../types';
import { attendanceService } from '../services/attendanceService';
import { personnelService } from '../services/personnelService';
import { settingsService, AttendanceRules } from '../services/settingsService';
import { sectorService, Sector } from '../services/sectorService';
import { getLocalDateString } from '../utils/dateUtils';

const AdminDashboard: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [rules, setRules] = useState<AttendanceRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  React.useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const [recordsRes, employeesRes, rulesRes, sectorsRes] = await Promise.allSettled([
          attendanceService.getAll(),
          personnelService.getAll(),
          settingsService.getRules(),
          sectorService.getAll()
        ]);

        if (recordsRes.status === 'fulfilled') setRecords(recordsRes.value as AttendanceRecord[]);
        if (employeesRes.status === 'fulfilled') setEmployees(employeesRes.value as Profile[]);
        if (rulesRes.status === 'fulfilled') setRules(rulesRes.value as AttendanceRules);
        if (sectorsRes.status === 'fulfilled') setSectors(sectorsRes.value as Sector[]);

        // Sync absences in background
        if (employeesRes.status === 'fulfilled' && employeesRes.value) {
           attendanceService.syncPastAbsences(employeesRes.value as Profile[]).then(() => {
             attendanceService.getAll().then(setRecords).catch(e => console.error(e));
           }).catch(e => console.error(e));
        }
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDashboardData();
  }, []);

  const getSectorForEmployee = (employeeName: string) => {
    const emp = employees.find(e => e.full_name === employeeName);
    if (!emp) return 'Sin Sector';
    return sectors.find(s => s.id === emp.sector_id)?.name || emp.sector_id || 'Sin Sector';
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const getCumulativeMinutes = (employeeId: string) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    return records
      .filter(r => {
        const d = new Date(r.date);
        const emp = employees.find(e => e.id === employeeId);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear && r.employee_name === emp?.full_name;
      })
      .reduce((sum, r) => sum + (r.minutes_late || 0), 0);
  };

  const filteredRecords = useMemo(() => {
    const today = getLocalDateString();
    return records
      .filter(r => r.date === today)
      .filter(r => {
        const search = searchTerm.toLowerCase();
        const sector = getSectorForEmployee(r.employee_name).toLowerCase();
        return r.employee_name.toLowerCase().includes(search) || sector.includes(search);
      });
  }, [records, searchTerm, employees, sectors]);

  const stats = useMemo(() => {
    const today = getLocalDateString();
    const todayRecs = records.filter(r => r.date === today);
    return {
      presentes: todayRecs.filter(r => ['en_horario', 'tarde', 'presente', 'manual'].includes(r.status)).length,
      tardes: todayRecs.filter(r => r.status === 'tarde').length,
      ausentes: todayRecs.filter(r => r.status === 'ausente' || r.status === 'sin_presentismo').length
    };
  }, [records]);

  const testToken = "SECURE_USER:Juan_Perez_7782";

  const copyTestToken = () => {
    navigator.clipboard.writeText(testToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportMonthly = () => {
    const today = new Date();
    const headers = ["Empleado", "Sector", "Última Entrada", "Minutos Tarde Acumulados", "Estatus"];
    const rows = filteredRecords.map(r => [
      r.employee_name,
      getSectorForEmployee(r.employee_name),
      formatTime(r.check_in),
      0, // Placeholder for simplicity now
      r.status === 'sin_presentismo' ? 'Perdió el Presentismo' : r.status
    ]);

    const csvContent = [headers.join(";"), ...rows.map(row => row.join(";"))].join("\n");
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Dashboard_Reporte_${getLocalDateString()}.csv`;
    link.click();
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight flex items-center">
            Control de <span className="ml-2 text-indigo-600">Asistencias</span>
          </h2>
          <p className="text-slate-500 font-medium">Panel de control y monitoreo en tiempo real.</p>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('change-view', { detail: 'audit_personnel' }))}
            className="flex items-center space-x-2 px-6 py-3 bg-white text-slate-700 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-slate-50 transition-all border border-slate-200 shadow-sm active:scale-95"
          >
            <Clock className="w-4 h-4 text-indigo-500" />
            <span>Auditoría</span>
          </button>
        </div>
      </header>

      {/* Test QR Utility */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-white rounded-2xl shadow-sm border border-indigo-100">
            <QrCode className="w-8 h-8 text-indigo-600" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800">Token de Prueba</h4>
            <p className="text-sm text-slate-500">Usa este código para probar el escaneo de QR.</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 bg-white px-4 py-3 rounded-xl border border-indigo-200 shadow-sm">
          <code className="text-xs font-mono text-indigo-700">{testToken}</code>
          <button onClick={copyTestToken} className="ml-4 p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400">
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Presentes', value: stats.presentes, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Tardanzas', value: stats.tardes, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'Ausencias', value: stats.ausentes, icon: UserX, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Integridad', value: '98%', icon: ShieldCheck, color: 'text-indigo-500', bg: 'bg-indigo-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center space-x-5">
            <div className={`p-4 rounded-2xl ${stat.bg}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{stat.label}</p>
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
              placeholder="Buscar empleado o sector..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold"
            />
          </div>
          <button onClick={handleExportMonthly} className="flex items-center space-x-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-all">
            <Download className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase">Empleado</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase">Entrada</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase">Salida</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase text-center">Estatus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={4} className="px-8 py-10 text-center text-slate-400">Cargando...</td></tr>
              ) : filteredRecords.length === 0 ? (
                <tr><td colSpan={4} className="px-8 py-10 text-center text-slate-400">Sin registros hoy.</td></tr>
              ) : filteredRecords.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-8 py-6">
                    <div>
                      <span className="block font-black text-slate-700">{r.employee_name}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">{getSectorForEmployee(r.employee_name)}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 font-bold text-slate-600">{formatTime(r.check_in)}</td>
                  <td className="px-8 py-6 font-bold text-slate-600">{formatTime(r.check_out)}</td>
                  <td className="px-8 py-6 text-center">
                    <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                      (r.status === 'en_horario' || r.status === 'presente') ? 'bg-emerald-100 text-emerald-700' :
                      r.status === 'tarde' ? 'bg-amber-100 text-amber-700' :
                      r.status === 'sin_presentismo' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {r.status === 'sin_presentismo' ? 'Perdió el Presentismo' : r.status.replace('_', ' ')}
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
