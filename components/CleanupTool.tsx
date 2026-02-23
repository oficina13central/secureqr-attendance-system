import React, { useState } from 'react';
import { Trash2, Search, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { runCleanup, findDuplicates } from '../utils/cleanupDuplicates';

interface DuplicateReport {
    employee_id: string;
    employee_name: string;
    date: string;
    total_registros: number;
    ids_duplicados: string;
}

const CleanupTool: React.FC = () => {
    const [duplicates, setDuplicates] = useState<DuplicateReport[]>([]);
    const [loading, setLoading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState<{ deleted: number; errors: string[] } | null>(null);

    const handleScan = async () => {
        setScanning(true);
        setResult(null);
        try {
            const found = await findDuplicates();
            setDuplicates(found);
        } catch (error) {
            console.error('Error escaneando duplicados:', error);
        } finally {
            setScanning(false);
        }
    };

    const handleCleanup = async () => {
        if (!confirm(`¿Estás seguro de que deseas eliminar ${duplicates.length} grupos de registros duplicados?`)) {
            return;
        }

        setLoading(true);
        try {
            const cleanupResult = await runCleanup();
            setResult(cleanupResult);
            // Re-escanear después de limpiar
            const remaining = await findDuplicates();
            setDuplicates(remaining);
        } catch (error) {
            console.error('Error limpiando duplicados:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 space-y-6 max-w-4xl mx-auto">
            <header className="text-center space-y-2">
                <h2 className="text-3xl font-black text-slate-800 flex items-center justify-center gap-3">
                    <Trash2 className="w-8 h-8 text-red-500" />
                    Herramienta de Limpieza
                </h2>
                <p className="text-slate-500 font-medium">
                    Identifica y elimina registros duplicados de asistencia
                </p>
            </header>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                <div className="text-sm text-amber-800">
                    <p className="font-bold mb-2">⚠️ Advertencia</p>
                    <p>Esta herramienta eliminará permanentemente los registros duplicados. Se mantendrá solo el registro más reciente para cada empleado por fecha.</p>
                </div>
            </div>

            <div className="flex gap-4">
                <button
                    onClick={handleScan}
                    disabled={scanning}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                    <Search className="w-5 h-5" />
                    {scanning ? 'Escaneando...' : 'Escanear Duplicados'}
                </button>

                {duplicates.length > 0 && (
                    <button
                        onClick={handleCleanup}
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                        <Trash2 className="w-5 h-5" />
                        {loading ? 'Limpiando...' : `Limpiar ${duplicates.length} Grupos`}
                    </button>
                )}
            </div>

            {result && (
                <div className={`rounded-2xl p-6 flex items-start gap-4 ${result.errors.length > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                    <CheckCircle2 className={`w-6 h-6 flex-shrink-0 mt-1 ${result.errors.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
                    <div className="text-sm">
                        <p className="font-bold mb-2">Resultado de la Limpieza</p>
                        <p className="text-slate-700">
                            ✅ {result.deleted} registros eliminados
                        </p>
                        {result.errors.length > 0 && (
                            <p className="text-red-600 mt-2">
                                ❌ {result.errors.length} errores encontrados
                            </p>
                        )}
                    </div>
                </div>
            )}

            {duplicates.length > 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-6 bg-slate-50 border-b border-slate-200">
                        <h3 className="font-black text-slate-800 text-lg">
                            Registros Duplicados Encontrados ({duplicates.length})
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider">
                                        Empleado
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider">
                                        Fecha
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-black text-slate-500 uppercase tracking-wider">
                                        Total Registros
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider">
                                        IDs
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {duplicates.map((dup, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-sm font-bold text-slate-700">
                                            {dup.employee_name}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {dup.date}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-700">
                                                {dup.total_registros}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                                            {dup.ids_duplicados}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : scanning ? (
                <div className="text-center py-12 text-slate-400 animate-pulse">
                    Escaneando base de datos...
                </div>
            ) : (
                <div className="text-center py-12 text-slate-400">
                    Haz clic en "Escanear Duplicados" para comenzar
                </div>
            )}
        </div>
    );
};

export default CleanupTool;
