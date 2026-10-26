import React, { useState, useEffect } from 'react';
import { Monitor, Plus, Trash2, Edit2, Check, X, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { userManagementService } from '../services/userManagementService';
import { settingsService, AttendanceRules } from '../services/settingsService';
import { attendanceService } from '../services/attendanceService';
import { auditService } from '../services/auditService';
import { Profile } from '../types';

interface TerminalManagerProps {
    currentUser: Profile;
}

const TerminalManager: React.FC<TerminalManagerProps> = ({ currentUser }) => {
    const [terminalAccounts, setTerminalAccounts] = useState<Profile[]>([]);
    const [rules, setRules] = useState<AttendanceRules | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingCatalog, setSavingCatalog] = useState(false);

    // Edit account name state
    const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
    const [editingAccountName, setEditingAccountName] = useState('');
    const [alsoUpdateHistory, setAlsoUpdateHistory] = useState(true);

    // Catalog state
    const [newTerminalName, setNewTerminalName] = useState('');
    const [editingCatalogIndex, setEditingCatalogIndex] = useState<number | null>(null);
    const [editingCatalogValue, setEditingCatalogValue] = useState('');

    // Bulk rename in attendance records state
    const [oldRecordTerminal, setOldRecordTerminal] = useState('PLANTA INDUSTRIAL NORTE');
    const [newRecordTerminal, setNewRecordTerminal] = useState('');
    const [renamingRecords, setRenamingRecords] = useState(false);

    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const showFeedback = (text: string, type: 'success' | 'error') => {
        setMessage({ text, type });
        setTimeout(() => setMessage(null), 4000);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [allUsers, currentRules] = await Promise.all([
                userManagementService.getAllUsers(),
                settingsService.getRules()
            ]);
            const terminals = allUsers.filter(u => !u.deleted_at && (u.role === 'terminal' || u.is_employee === false));
            setTerminalAccounts(terminals);
            setRules(currentRules);
        } catch (err) {
            console.error('Error loading terminals:', err);
            showFeedback('Error al cargar la configuración de terminales', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSaveAccountName = async (account: Profile) => {
        const cleanName = editingAccountName.trim().toUpperCase();
        if (!cleanName) {
            showFeedback('El nombre de la terminal no puede estar vacío', 'error');
            return;
        }

        try {
            const oldName = account.full_name;
            await userManagementService.updateUserName(account.id, cleanName);

            let updatedRecords = 0;
            if (alsoUpdateHistory && oldName && oldName.toUpperCase() !== cleanName) {
                updatedRecords = await attendanceService.renameTerminalInRecords(oldName, cleanName);
            }

            await auditService.logAction({
                manager_name: currentUser.full_name,
                employee_name: cleanName,
                action: 'Renombrado de Terminal',
                old_value: oldName,
                new_value: cleanName,
                reason: `Configuración de nombre de terminal por Superusuario${updatedRecords > 0 ? ` (${updatedRecords} fichadas actualizadas)` : ''}`
            });

            // Si también está en el catálogo o no está, asegurarnos de sumarla al catálogo para selección rápida
            if (rules) {
                const currentList = rules.terminal_names || [];
                if (!currentList.includes(cleanName)) {
                    const updatedRules: AttendanceRules = {
                        ...rules,
                        terminal_names: [...currentList, cleanName]
                    };
                    await settingsService.updateRules(updatedRules);
                    setRules(updatedRules);
                }
            }

            setEditingAccountId(null);
            showFeedback(
                updatedRecords > 0
                    ? `Terminal renombrada a "${cleanName}" (${updatedRecords} fichadas actualizadas)`
                    : `Terminal renombrada a "${cleanName}"`,
                'success'
            );
            loadData();
        } catch (err) {
            console.error(err);
            showFeedback('Error al actualizar el nombre de la terminal', 'error');
        }
    };

    const handleAddCatalogTerminal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rules) return;
        const clean = newTerminalName.trim().toUpperCase();
        if (!clean) return;

        const currentList = rules.terminal_names || [];
        if (currentList.includes(clean)) {
            showFeedback('Ese nombre de terminal ya existe en el listado', 'error');
            return;
        }

        setSavingCatalog(true);
        const updatedRules: AttendanceRules = {
            ...rules,
            terminal_names: [...currentList, clean]
        };
        const ok = await settingsService.updateRules(updatedRules);
        setSavingCatalog(false);

        if (ok) {
            setRules(updatedRules);
            setNewTerminalName('');
            showFeedback(`Terminal "${clean}" agregada al catálogo`, 'success');
        } else {
            showFeedback('No se pudo guardar en la configuración', 'error');
        }
    };

    const handleSaveCatalogEdit = async (index: number) => {
        if (!rules) return;
        const clean = editingCatalogValue.trim().toUpperCase();
        if (!clean) return;

        const currentList = [...(rules.terminal_names || [])];
        const previousName = currentList[index];
        currentList[index] = clean;

        setSavingCatalog(true);
        const updatedRules: AttendanceRules = {
            ...rules,
            terminal_names: currentList,
            default_terminal_name: rules.default_terminal_name === previousName ? clean : rules.default_terminal_name
        };
        const ok = await settingsService.updateRules(updatedRules);
        setSavingCatalog(false);

        if (ok) {
            setRules(updatedRules);
            setEditingCatalogIndex(null);
            showFeedback(`Nombre actualizado a "${clean}"`, 'success');
        } else {
            showFeedback('Error al actualizar el catálogo', 'error');
        }
    };

    const handleDeleteCatalogTerminal = async (nameToDelete: string) => {
        if (!rules) return;
        const currentList = (rules.terminal_names || []).filter(n => n !== nameToDelete);
        setSavingCatalog(true);
        const updatedRules: AttendanceRules = {
            ...rules,
            terminal_names: currentList
        };
        const ok = await settingsService.updateRules(updatedRules);
        setSavingCatalog(false);

        if (ok) {
            setRules(updatedRules);
            showFeedback(`Terminal "${nameToDelete}" quitada del listado`, 'success');
        }
    };

    const handleSaveDefaultName = async (defaultName: string) => {
        if (!rules) return;
        const clean = defaultName.trim().toUpperCase() || 'TERMINAL PRINCIPAL';
        setSavingCatalog(true);
        const updatedRules: AttendanceRules = {
            ...rules,
            default_terminal_name: clean
        };
        const ok = await settingsService.updateRules(updatedRules);
        setSavingCatalog(false);
        if (ok) {
            setRules(updatedRules);
            // Si este navegador tenía el placeholder viejo, lo actualizamos también
            const localCurrent = localStorage.getItem('terminal_branch_name');
            if (!localCurrent || localCurrent === 'PLANTA INDUSTRIAL NORTE') {
                localStorage.setItem('terminal_branch_name', clean);
            }
            showFeedback(`Nombre por defecto actualizado a "${clean}"`, 'success');
        } else {
            showFeedback('Error al guardar el nombre por defecto', 'error');
        }
    };

    const handleBulkRenameRecords = async (e: React.FormEvent) => {
        e.preventDefault();
        const fromName = oldRecordTerminal.trim();
        const toName = newRecordTerminal.trim().toUpperCase();
        if (!fromName || !toName) {
            showFeedback('Complete ambos nombres para actualizar las fichadas', 'error');
            return;
        }

        setRenamingRecords(true);
        try {
            const count = await attendanceService.renameTerminalInRecords(fromName, toName);
            await auditService.logAction({
                manager_name: currentUser.full_name,
                employee_name: 'REGISTROS DE ASISTENCIA',
                action: 'Corrección Masiva de Terminal',
                old_value: fromName.toUpperCase(),
                new_value: toName,
                reason: `Se actualizaron ${count} fichadas históricas`
            });
            showFeedback(
                count > 0
                    ? `Se actualizaron ${count} fichada(s) de "${fromName.toUpperCase()}" a "${toName}"`
                    : `No se encontraron fichadas con el nombre "${fromName.toUpperCase()}"`,
                count > 0 ? 'success' : 'error'
            );
            if (count > 0) setNewRecordTerminal('');
        } catch (err) {
            console.error(err);
            showFeedback('Error al renombrar fichadas históricas', 'error');
        } finally {
            setRenamingRecords(false);
        }
    };

    if (loading) {
        return <div className="py-12 text-center text-slate-400 animate-pulse font-medium">Cargando terminales...</div>;
    }

    return (
        <div className="space-y-8">
            {message && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                    <span className="font-bold text-sm">{message.text}</span>
                </div>
            )}

            {/* 1. Cuentas de Terminal Activas */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3">
                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                            <Monitor className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800">Cuentas de Terminal y Sistema</h3>
                            <p className="text-xs text-slate-500 font-medium">
                                El nombre que definas aquí para cada cuenta de terminal se aplicará automáticamente cuando esa cuenta inicie sesión.
                            </p>
                        </div>
                    </div>
                </div>

                {terminalAccounts.length === 0 ? (
                    <div className="py-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl text-center text-slate-400">
                        <p className="font-bold text-sm">No hay cuentas con rol Terminal registradas.</p>
                        <p className="text-xs mt-1">Puedes crear cuentas para cada dispositivo desde la sección <strong>Usuarios → Nueva Cuenta de Sistema</strong>.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {terminalAccounts.map(acc => (
                            <div key={acc.id} className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center space-x-4">
                                    <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                                        <Monitor className="w-5 h-5" />
                                    </div>
                                    <div className="space-y-0.5">
                                        {editingAccountId === acc.id ? (
                                            <div className="space-y-2">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={editingAccountName}
                                                    onChange={e => setEditingAccountName(e.target.value)}
                                                    placeholder="Ej: SUCURSAL CENTRO"
                                                    className="px-3 py-2 bg-white border border-indigo-300 rounded-xl text-sm font-black uppercase text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                                <label className="flex items-center space-x-2 text-[11px] font-bold text-slate-500 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={alsoUpdateHistory}
                                                        onChange={e => setAlsoUpdateHistory(e.target.checked)}
                                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <span>Actualizar también fichadas anteriores de esta terminal</span>
                                                </label>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-black text-slate-800 uppercase">{acc.full_name}</h4>
                                                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                                                        {acc.role}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 font-bold">{acc.email}</p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2 self-end sm:self-center">
                                    {editingAccountId === acc.id ? (
                                        <>
                                            <button
                                                onClick={() => handleSaveAccountName(acc)}
                                                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 transition-all flex items-center space-x-1"
                                            >
                                                <Check className="w-4 h-4" />
                                                <span>Guardar</span>
                                            </button>
                                            <button
                                                onClick={() => setEditingAccountId(null)}
                                                className="p-2 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300 transition-all"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                setEditingAccountId(acc.id);
                                                setEditingAccountName(acc.full_name);
                                                setAlsoUpdateHistory(true);
                                            }}
                                            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 shadow-sm"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                            <span>Cambiar Nombre</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 2. Catálogo de Nombres de Terminales y Nombre por Defecto */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 space-y-6">
                <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-800">Catálogo de Terminales / Sucursales</h3>
                    <p className="text-xs text-slate-500 font-medium">
                        Define la lista de nombres de terminales disponibles para asignar a cualquier dispositivo y el nombre por defecto cuando una terminal aún no fue identificada.
                    </p>
                </div>

                {/* Nombre por defecto */}
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Nombre por Defecto (Fallback)
                        </label>
                        <p className="text-xs text-slate-500">
                            Se usa únicamente si un dispositivo abre el Modo Terminal sin tener cuenta de terminal ni nombre asignado.
                        </p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <input
                            type="text"
                            value={rules?.default_terminal_name || ''}
                            onChange={e => rules && setRules({ ...rules, default_terminal_name: e.target.value.toUpperCase() })}
                            placeholder="TERMINAL PRINCIPAL"
                            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                            onClick={() => rules && handleSaveDefaultName(rules.default_terminal_name || 'TERMINAL PRINCIPAL')}
                            disabled={savingCatalog}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
                        >
                            Guardar
                        </button>
                    </div>
                </div>

                {/* Agregar nombre al catálogo */}
                <form onSubmit={handleAddCatalogTerminal} className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="text"
                        value={newTerminalName}
                        onChange={e => setNewTerminalName(e.target.value)}
                        placeholder="Agregar nombre de terminal (ej: SUCURSAL CENTRO, PLANTA SUR, ADMINISTRACIÓN...)"
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                        type="submit"
                        disabled={savingCatalog || !newTerminalName.trim()}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-2 shadow-lg shadow-indigo-500/20"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Agregar Terminal</span>
                    </button>
                </form>

                {/* Lista del catálogo */}
                {(rules?.terminal_names || []).length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(rules?.terminal_names || []).map((tName, idx) => (
                            <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between gap-2">
                                {editingCatalogIndex === idx ? (
                                    <div className="flex items-center gap-2 flex-1">
                                        <input
                                            autoFocus
                                            type="text"
                                            value={editingCatalogValue}
                                            onChange={e => setEditingCatalogValue(e.target.value)}
                                            className="flex-1 px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-black uppercase text-slate-800 outline-none"
                                        />
                                        <button onClick={() => handleSaveCatalogEdit(idx)} className="p-1.5 bg-emerald-600 text-white rounded-lg"><Check className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => setEditingCatalogIndex(null)} className="p-1.5 bg-slate-200 text-slate-600 rounded-lg"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                ) : (
                                    <>
                                        <span className="font-black text-xs text-slate-700 uppercase tracking-wider">{tName}</span>
                                        <div className="flex items-center space-x-1">
                                            <button
                                                onClick={() => {
                                                    setEditingCatalogIndex(idx);
                                                    setEditingCatalogValue(tName);
                                                }}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                                                title="Editar nombre"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCatalogTerminal(tName)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all"
                                                title="Eliminar del listado"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 3. Corregir nombre de terminal en fichadas registradas */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 space-y-6">
                <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-800">Corregir Nombre en Fichadas Registradas</h3>
                    <p className="text-xs text-slate-500 font-medium">
                        Si algunas fichadas quedaron registradas como <strong>"PLANTA INDUSTRIAL NORTE"</strong> (valor por defecto anterior), puedes reemplazarlas aquí por el nombre real de la terminal.
                    </p>
                </div>

                <form onSubmit={handleBulkRenameRecords} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre Actual en Fichadas</label>
                        <input
                            type="text"
                            value={oldRecordTerminal}
                            onChange={e => setOldRecordTerminal(e.target.value)}
                            placeholder="PLANTA INDUSTRIAL NORTE"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nuevo Nombre de Terminal</label>
                        <input
                            type="text"
                            list="catalog-terminals-list"
                            value={newRecordTerminal}
                            onChange={e => setNewRecordTerminal(e.target.value)}
                            placeholder="Ej: SUCURSAL CENTRO"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <datalist id="catalog-terminals-list">
                            {(rules?.terminal_names || []).map((name, i) => (
                                <option key={i} value={name} />
                            ))}
                            {terminalAccounts.map(acc => (
                                <option key={acc.id} value={acc.full_name.toUpperCase()} />
                            ))}
                        </datalist>
                    </div>
                    <button
                        type="submit"
                        disabled={renamingRecords || !oldRecordTerminal.trim() || !newRecordTerminal.trim()}
                        className="px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-2 h-[42px]"
                    >
                        {renamingRecords ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        <span>Reemplazar en Historial</span>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default TerminalManager;
