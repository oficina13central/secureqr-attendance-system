import React, { useState, useEffect } from 'react';
import { Settings, Save, Clock, ShieldAlert, CheckCircle2, AlertCircle, Layers, Shield } from 'lucide-react';
import { settingsService, AttendanceRules } from '../services/settingsService';
import { auditService } from '../services/auditService';
import SectorManager from './SectorManager';
import RoleManager from './RoleManager';
import { Profile } from '../types';

interface SettingsViewProps {
    currentUser: Profile;
}

type TabType = 'rules' | 'sectors' | 'roles';

const SettingsView: React.FC<SettingsViewProps> = ({ currentUser }) => {
    const [activeTab, setActiveTab] = useState<TabType>('rules');
    const [rules, setRules] = useState<AttendanceRules>({
        en_horario: 5,
        llego_tarde: 30,
        max_mensual: 15
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            const data = await settingsService.getRules();
            setRules(data);
            setLoading(false);
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        const success = await settingsService.updateRules(rules);
        if (success) {
            setMessage({ text: 'Configuración guardada correctamente.', type: 'success' });
            await auditService.logAction({
                manager_name: currentUser.full_name,
                employee_name: 'SISTEMA',
                action: 'Cambio de Reglas',
                old_value: 'N/A',
                new_value: JSON.stringify(rules),
                reason: 'Ajuste de parámetros de asistencia'
            });
        } else {
            setMessage({ text: 'Error al guardar la configuración.', type: 'error' });
        }
        setSaving(false);
        setTimeout(() => setMessage(null), 3000);
    };

    if (loading) return <div className="p-8 text-center text-slate-400 font-medium">Cargando ajustes...</div>;

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center">
                        Configuración <span className="ml-2 text-indigo-600">Maestra</span>
                    </h2>
                    <p className="text-slate-500 font-medium">Gestión de reglas, sectores y permisos del sistema.</p>
                </div>

                <div className="flex p-1 bg-slate-100 rounded-2xl self-start lg:self-center">
                    {[
                        { id: 'rules', label: 'Reglas', icon: Settings, permission: 'MANAGE_RULES' },
                        { id: 'sectors', label: 'Sectores', icon: Layers, permission: 'MANAGE_SECTORS' },
                        { id: 'roles', label: 'Roles', icon: Shield, permission: 'MANAGE_ROLES' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <tab.icon className="w-4 h-4" />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </header>

            {/* Tab Content */}
            <div className="max-w-5xl">
                {activeTab === 'rules' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Rules Card */}
                            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 space-y-6">
                                <div className="flex items-center space-x-3 mb-2">
                                    <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                                        <Clock className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-black text-slate-800">Umbrales de Tiempo</h3>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Margen de Gracia (En Horario)</label>
                                        <div className="flex items-center space-x-3">
                                            <input
                                                type="number"
                                                value={rules.en_horario}
                                                onChange={e => setRules({ ...rules, en_horario: parseInt(e.target.value) })}
                                                className="w-24 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                            <span className="text-sm font-bold text-slate-500">Minutos</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Límite para Tardanza</label>
                                        <div className="flex items-center space-x-3">
                                            <input
                                                type="number"
                                                value={rules.llego_tarde}
                                                onChange={e => setRules({ ...rules, llego_tarde: parseInt(e.target.value) })}
                                                className="w-24 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                            <span className="text-sm font-bold text-slate-500">Minutos</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Control Card */}
                            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 space-y-6">
                                <div className="flex items-center space-x-3 mb-2">
                                    <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
                                        <ShieldAlert className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-black text-slate-800">Control Mensual</h3>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Máximo de Minutos mes</label>
                                        <div className="flex items-center space-x-3">
                                            <input
                                                type="number"
                                                value={rules.max_mensual}
                                                onChange={e => setRules({ ...rules, max_mensual: parseInt(e.target.value) })}
                                                className="w-24 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                            <span className="text-sm font-bold text-slate-500">Minutos</span>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start space-x-3">
                                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                        <p className="text-xs text-amber-800 leading-relaxed font-medium">
                                            Si un empleado suma más de <strong>{rules.max_mensual} minutos</strong> tarde en el mes, el sistema alertará automáticamente.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4">
                            {message && (
                                <div className={`flex items-center space-x-2 px-6 py-3 rounded-2xl animate-in slide-in-from-left-4 ${message.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span className="font-bold text-sm">{message.text}</span>
                                </div>
                            )}
                            <div />
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center space-x-3 px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] font-bold text-lg shadow-xl shadow-indigo-500/30 transition-all active:scale-95"
                            >
                                {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save className="w-5 h-5" />}
                                <span>Guardar Configuración</span>
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'sectors' && <div className="animate-in fade-in slide-in-from-bottom-2"><SectorManager /></div>}
                {activeTab === 'roles' && <div className="animate-in fade-in slide-in-from-bottom-2"><RoleManager /></div>}
            </div>
        </div>
    );
};

export default SettingsView;
