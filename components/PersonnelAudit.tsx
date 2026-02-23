import React, { useState, useEffect, useMemo } from 'react';
import {
    Users,
    Clock,
    UserX,
    AlertCircle,
    Download,
    ChevronLeft,
    ChevronRight,
    Search,
    CheckCircle2,
    XCircle
} from 'lucide-react';
import { AttendanceRecord, Profile } from '../types';
import { attendanceService } from '../services/attendanceService';
import { personnelService } from '../services/personnelService';
import { settingsService, AttendanceRules } from '../services/settingsService';
import { sectorService, Sector } from '../services/sectorService';

const PersonnelAudit: React.FC = () => {
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [employees, setEmployees] = useState<Profile[]>([]);
    const [rules, setRules] = useState<AttendanceRules | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
    const [sectors, setSectors] = useState<Sector[]>([]);

    // Filtros avanzados
    const [selectedSectorId, setSelectedSectorId] = useState<string>('all');
    const [showOnlyLate, setShowOnlyLate] = useState(false);
    const [showOnlyAbsences, setShowOnlyAbsences] = useState(false);
    const [showOnlyNoPresentismo, setShowOnlyNoPresentismo] = useState(false);

    // Estado para el mes y año seleccionado (por defecto el mes anterior)
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d;
    });

    const months = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const [fetchedRecords, fetchedEmployees, fetchedRules, fetchedSectors] = await Promise.all([
                attendanceService.getAll(),
                personnelService.getAll(),
                settingsService.getRules(),
                sectorService.getAll()
            ]);
            setRecords(fetchedRecords);
            setEmployees(fetchedEmployees);
            setRules(fetchedRules);
            setSectors(fetchedSectors);
            setLoading(false);
        };
        loadData();
    }, []);

    const changeMonth = (delta: number) => {
        setSelectedDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + delta);
            return newDate;
        });
    };

    const auditData = useMemo(() => {
        const targetMonth = selectedDate.getMonth();
        const targetYear = selectedDate.getFullYear();

        return employees.map(emp => {
            const monthRecords = records.filter(r => {
                const d = new Date(r.date);
                return d.getMonth() === targetMonth &&
                    d.getFullYear() === targetYear &&
                    r.employee_id === emp.id;
            });

            const totalLateMinutes = monthRecords.reduce((sum, r) => sum + (r.minutes_late || 0), 0);
            const absences = monthRecords.filter(r => r.status === 'ausente').length;
            const lostPresentismo = monthRecords.filter(r => r.status === 'sin_presentismo').length;
            const presents = monthRecords.filter(r => ['en_horario', 'tarde', 'manual', 'presente'].includes(r.status)).length;

            // Resolve sector name robustly (ID, Name match, or legacy string)
            const sectorName = sectors.find(s => s.id === emp.sector_id)?.name ||
                sectors.find(s => s.name === emp.sector_id)?.name ||
                emp.sector_id || 'Sin Sector';

            return {
                id: emp.id,
                name: emp.full_name,
                sector: sectorName,
                totalLateMinutes,
                absences,
                lostPresentismo,
                presents,
                compliance: monthRecords.length > 0 ? (presents / (presents + absences)) * 100 : 0,
                detailedRecords: monthRecords.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            };
        }).filter(data => {
            const matchesSearch = data.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                data.sector.toLowerCase().includes(searchTerm.toLowerCase());

            const employee = employees.find(e => e.id === data.id);
            const matchesSector = selectedSectorId === 'all' ||
                employee?.sector_id === selectedSectorId ||
                sectors.find(s => s.id === selectedSectorId)?.name === employee?.sector_id;

            const matchesIssue = (!showOnlyLate || data.totalLateMinutes > 0) &&
                (!showOnlyAbsences || data.absences > 0) &&
                (!showOnlyNoPresentismo || data.lostPresentismo > 0);

            return matchesSearch && matchesSector && matchesIssue;
        });
    }, [employees, records, selectedDate, searchTerm, selectedSectorId, showOnlyLate, showOnlyAbsences, showOnlyNoPresentismo, sectors]);

    const selectedEmployeeData = useMemo(() =>
        auditData.find(d => d.id === selectedEmployeeId),
        [auditData, selectedEmployeeId]
    );

    const formatTime = (isoString: string | null) => {
        if (!isoString) return '--:--';
        const date = new Date(isoString);
        return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    };

    const handleExportReport = () => {
        const headers = ["Empleado", "Sector", "Minutos Tarde", "Ausencias", "Sin Presentismo", "Eficiencia (%)"];
        const rows = auditData.map(d => [
            d.name,
            d.sector,
            d.totalLateMinutes,
            d.absences,
            d.lostPresentismo,
            Math.round(d.compliance)
        ]);

        // Excel compatibility: Use semicolon delimiter, add BOM and sep=; header
        const csvContent = [
            "sep=;",
            headers.join(";"),
            ...rows.map(row => row.join(";"))
        ].join("\n");

        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Reporte_Personal_${months[selectedDate.getMonth()]}_${selectedDate.getFullYear()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight flex items-center">
                        Auditoría de <span className="ml-2 text-indigo-600">Personal</span>
                    </h2>
                    <p className="text-slate-500 font-medium italic mt-1">Consolidado mensual de cumplimiento y presentismo.</p>
                </div>

                <div className="flex items-center space-x-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                    <button
                        onClick={() => changeMonth(-1)}
                        className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-indigo-600"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>

                    <div className="px-4 text-center min-w-[140px]">
                        <span className="block text-sm font-black text-slate-400 uppercase tracking-widest">{selectedDate.getFullYear()}</span>
                        <span className="block text-xl font-black text-indigo-600 leading-tight">{months[selectedDate.getMonth()]}</span>
                    </div>

                    <button
                        onClick={() => changeMonth(1)}
                        className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-indigo-600"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </div>
            </header>

            {/* Stats Summary Area */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center space-x-4 group hover:shadow-md transition-shadow">
                    <div className="p-4 bg-amber-50 rounded-2xl group-hover:scale-110 transition-transform">
                        <Clock className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Minutos Tarde</p>
                        <p className="text-2xl font-black text-slate-800">{auditData.reduce((sum, d) => sum + d.totalLateMinutes, 0)} min</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center space-x-4 group hover:shadow-md transition-shadow">
                    <div className="p-4 bg-red-50 rounded-2xl group-hover:scale-110 transition-transform">
                        <UserX className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Ausencias</p>
                        <p className="text-2xl font-black text-slate-800">{auditData.reduce((sum, d) => sum + d.absences, 0)}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center space-x-4 group hover:shadow-md transition-shadow">
                    <div className="p-4 bg-indigo-50 rounded-2xl group-hover:scale-110 transition-transform">
                        <AlertCircle className="w-6 h-6 text-indigo-500" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sin Presentismo</p>
                        <p className="text-2xl font-black text-slate-800">{auditData.reduce((sum, d) => sum + d.lostPresentismo, 0)} casos</p>
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col xl:flex-row xl:items-center gap-6">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o sector..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                            value={selectedSectorId}
                            onChange={(e) => setSelectedSectorId(e.target.value)}
                            className="pl-10 pr-8 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer"
                        >
                            <option value="all">Todos los Sectores</option>
                            {sectors.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center bg-slate-50 p-1 rounded-2xl border border-slate-100">
                        <button
                            onClick={() => setShowOnlyLate(!showOnlyLate)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${showOnlyLate ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Clock className={`w-3.5 h-3.5 inline mr-1.5 ${showOnlyLate ? 'text-white' : 'text-amber-500'}`} />
                            Tardanzas
                        </button>
                        <button
                            onClick={() => setShowOnlyAbsences(!showOnlyAbsences)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${showOnlyAbsences ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <UserX className={`w-3.5 h-3.5 inline mr-1.5 ${showOnlyAbsences ? 'text-white' : 'text-red-500'}`} />
                            Ausencias
                        </button>
                        <button
                            onClick={() => setShowOnlyNoPresentismo(!showOnlyNoPresentismo)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${showOnlyNoPresentismo ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <AlertCircle className={`w-3.5 h-3.5 inline mr-1.5 ${showOnlyNoPresentismo ? 'text-white' : 'text-indigo-400'}`} />
                            Sin Presentismo
                        </button>
                    </div>

                    {(searchTerm || selectedSectorId !== 'all' || showOnlyLate || showOnlyAbsences || showOnlyNoPresentismo) && (
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setSelectedSectorId('all');
                                setShowOnlyLate(false);
                                setShowOnlyAbsences(false);
                                setShowOnlyNoPresentismo(false);
                            }}
                            className="px-4 py-2 text-[10px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-50 rounded-xl transition-all"
                        >
                            Limpiar
                        </button>
                    )}
                </div>

                <button
                    onClick={handleExportReport}
                    className="flex items-center space-x-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-600 transition-all shadow-lg active:scale-95 ml-auto"
                >
                    <Download className="w-4 h-4" />
                    <span>Informe</span>
                </button>
            </div>

            {/* Main Table Area */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Empleado / Sector</th>
                                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em] text-center">Tardanza Total</th>
                                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em] text-center">Ausencias</th>
                                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em] text-center">Sin Presentismo</th>
                                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em] text-center">Cumplimiento</th>
                                <th className="px-8 py-5"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-10 text-center text-slate-400 font-medium animate-pulse">Generando reporte mensual...</td>
                                </tr>
                            ) : auditData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-10 text-center text-slate-400 font-medium">No hay datos para el período seleccionado.</td>
                                </tr>
                            ) : auditData.map((data) => (
                                <tr key={data.id} className="hover:bg-indigo-50/30 transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center font-black text-indigo-600 text-lg shadow-sm border border-white">
                                                {data.name.charAt(0)}
                                            </div>
                                            <div>
                                                <span className="block font-black text-slate-700 text-base leading-tight lowercase first-letter:uppercase">{data.name}</span>
                                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{data.sector}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <div className="inline-flex flex-col">
                                            <span className={`text-lg font-black ${data.totalLateMinutes > (rules?.max_mensual || 60) ? 'text-red-500' : 'text-slate-700'}`}>
                                                {data.totalLateMinutes} <small className="text-[10px] uppercase">min</small>
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <span className={`px-4 py-1.5 rounded-xl text-xs font-black border ${data.absences > 0 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                            {data.absences}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <span className={`px-4 py-1.5 rounded-xl text-xs font-black border ${data.lostPresentismo > 0 ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                            {data.lostPresentismo}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <div className="flex flex-col items-center">
                                            <div className="w-16 h-1 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
                                                <div
                                                    className={`h-full transition-all duration-1000 ${data.compliance > 90 ? 'bg-emerald-500' : data.compliance > 75 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                    style={{ width: `${data.compliance}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{Math.round(data.compliance)}% Eficiencia</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedEmployeeId(data.id);
                                            }}
                                            className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 transition-all active:scale-95"
                                        >
                                            Ver Detalle
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Modal */}
            {selectedEmployeeId && selectedEmployeeData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
                            <div>
                                <h3 className="text-2xl font-black lowercase first-letter:uppercase">{selectedEmployeeData.name}</h3>
                                <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest">Detalle Diario - {months[selectedDate.getMonth()]} {selectedDate.getFullYear()}</p>
                            </div>
                            <button
                                onClick={() => setSelectedEmployeeId(null)}
                                className="p-3 hover:bg-white/10 rounded-2xl transition-colors"
                            >
                                <XCircle className="w-8 h-8" />
                            </button>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto p-8">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Entrada</th>
                                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Retraso</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {selectedEmployeeData.detailedRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-slate-400 italic">No hay registros detallados para este mes.</td>
                                        </tr>
                                    ) : selectedEmployeeData.detailedRecords.map((record) => (
                                        <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-4 text-sm font-bold text-slate-600">{record.date}</td>
                                            <td className="py-4 text-sm font-black text-slate-800">{formatTime(record.check_in)}</td>
                                            <td className="py-4 text-center">
                                                <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${['en_horario', 'presente'].includes(record.status) ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    record.status === 'tarde' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                        record.status === 'ausente' ? 'bg-red-50 text-red-600 border-red-100' :
                                                            'bg-red-100 text-red-700 border-red-200' // sin presentismo
                                                    }`}>
                                                    {record.status === 'sin_presentismo' ? 'Sin Presentismo' : record.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="py-4 text-right text-sm font-black text-slate-700">
                                                {record.minutes_late > 0 ? `${record.minutes_late} min` : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setSelectedEmployeeId(null)}
                                className="px-8 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-slate-900/10"
                            >
                                Cerrar Detalle
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PersonnelAudit;
