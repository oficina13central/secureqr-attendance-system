import React, { useState, useEffect } from 'react';
import { History, ShieldAlert, User, Calendar, Info } from 'lucide-react';
import { AuditLog } from '../types';
import { auditService } from '../services/auditService';

const AuditView: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            const data = await auditService.getAll();
            setLogs(data);
            setLoading(false);
        };
        fetchLogs();
    }, []);

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
            <header className="space-y-1">
                <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center">
                    Logs de <span className="ml-2 text-indigo-600">Auditoría</span>
                </h2>
                <p className="text-slate-500 font-medium">Historial de cambios manuales y acciones críticas del sistema.</p>
            </header>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Fecha y Hora</th>
                                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Responsable</th>
                                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Empleado</th>
                                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Acción</th>
                                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Motivo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-10 text-center text-slate-400 font-medium">Cargando registros...</td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-10 text-center text-slate-400 font-medium">No hay logs registrados todavía.</td>
                                </tr>
                            ) : logs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 py-4">
                                        <div className="flex items-center space-x-2 text-slate-500">
                                            <Calendar className="w-4 h-4" />
                                            <span className="text-sm font-bold">{new Date(log.timestamp).toLocaleString()}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4">
                                        <div className="flex items-center space-x-2">
                                            <ShieldAlert className="w-4 h-4 text-indigo-500" />
                                            <span className="text-sm font-black text-slate-700">{log.manager_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4">
                                        <div className="flex items-center space-x-2">
                                            <User className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm font-medium text-slate-600">{log.employee_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4">
                                        <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-black uppercase tracking-wider border border-amber-200">
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-8 py-4">
                                        <div className="flex items-center space-x-2 text-slate-500">
                                            <Info className="w-4 h-4" />
                                            <span className="text-sm italic">{log.reason}</span>
                                        </div>
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

export default AuditView;
