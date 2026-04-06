
import React, { useState } from 'react';
import {
    Users,
    Plus,
    Search,
    MoreVertical,
    CreditCard,
    Printer,
    X,
    Check,
    UserPlus,
    Pencil,
    Download,
    CalendarDays,
    Save
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { Profile } from '../types';
import { personnelService } from '../services/personnelService';
import { auditService } from '../services/auditService';
import { sectorService, Sector } from '../services/sectorService';
import { roleService } from '../services/roleService';
import { attendanceService } from '../services/attendanceService';
import { Role } from '../types';

interface PersonnelViewProps {
    employees: Profile[];
    setEmployees: React.Dispatch<React.SetStateAction<Profile[]>>;
    currentUser: Profile;
}

const PersonnelView: React.FC<PersonnelViewProps> = ({ employees, setEmployees, currentUser }) => {
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showCardModal, setShowCardModal] = useState<Profile | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<boolean>(false);
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [scoringData, setScoringData] = useState<Record<string, {score: number, category: number, label: string, color: string}>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClass, setSelectedClass] = useState<string>('all');
    const [showScheduleModal, setShowScheduleModal] = useState<Profile | null>(null);
    const [scheduleForm, setScheduleForm] = useState<Record<string, any>>({});

    // Helper: get all sector IDs this user can manage (own sector + managed_sectors)
    const getAccessibleSectorIds = (user: Profile): string[] => {
        const ids = new Set<string>();
        if (user.sector_id) ids.add(user.sector_id);
        (user.managed_sectors || []).forEach(id => ids.add(id));
        return Array.from(ids);
    };

    React.useEffect(() => {
        const fetchData = async () => {
            const [fetchedSectors, fetchedRoles] = await Promise.all([
                sectorService.getAll(),
                roleService.getAllRoles()
            ]);
            setSectors(fetchedSectors);
            setRoles(fetchedRoles);
        };
        fetchData();
    }, []);

    React.useEffect(() => {
        const fetchScores = async () => {
            if (employees.length === 0) return;
            const scoresMap: Record<string, any> = {};
            await Promise.all(employees.map(async (emp) => {
                const s = await attendanceService.calculateScoring(emp.id);
                scoresMap[emp.id] = s;
            }));
            setScoringData(scoresMap);
        };
        fetchScores();
    }, [employees]);

    const filteredEmployees = React.useMemo(() => {
        let list = employees;

        // Apply security filter for managers
        if (currentUser.role === 'encargado') {
            const mySectorIds = new Set<string>();
            if (currentUser.sector_id) mySectorIds.add(currentUser.sector_id);
            (currentUser.managed_sectors || []).forEach(id => mySectorIds.add(id));
            list = list.filter(e => mySectorIds.has(e.sector_id || 'General'));
        }

        return list.filter(emp => {
            const sectorName = sectors.find(s => s.id === emp.sector_id)?.name || emp.sector_id || 'General';
            const matchesSearch = emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                sectorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (emp.dni && emp.dni.includes(searchTerm));
            
            const scoreCategory = scoringData[emp.id]?.category?.toString() || '1';
            const matchesClass = selectedClass === 'all' || scoreCategory === selectedClass;
            
            return matchesSearch && matchesClass;
        });
    }, [employees, searchTerm, selectedClass, sectors, scoringData, currentUser]);

    // Initial Data is now passed via props from App.tsx

    const [formData, setFormData] = useState<Partial<Profile>>({
        id: '',
        full_name: '',
        email: '',
        dni: '',
        role: 'encargado',
        sector_id: '',
        managed_sectors: []
    });

    // Toggle a sector in the managed_sectors array of formData
    const toggleManagedSector = (sectorId: string) => {
        const current = formData.managed_sectors || [];
        const updated = current.includes(sectorId)
            ? current.filter(id => id !== sectorId)
            : [...current, sectorId];
        setFormData({ ...formData, managed_sectors: updated });
    };

    // Check if a role name suggests manager-level access
    const isManagerRole = (roleId: string): boolean => {
        const roleData = roles.find(r => r.id === roleId);
        if (!roleData) return false;
        const name = roleData.name.toLowerCase();
        return name.includes('encargado') || name.includes('administrador') || name.includes('supervisor') || name.includes('superusuario');
    };

    const openAddModal = () => {
        setIsEditing(false);
        setFormData({ full_name: '', email: '', dni: '', role: 'encargado', sector_id: '', managed_sectors: [] });
        setError(null);
        setSuccess(false);
        setShowModal(true);
    };

    const openEditModal = (employee: Profile) => {
        setIsEditing(true);
        setFormData({ ...employee, managed_sectors: employee.managed_sectors || [] });
        setError(null);
        setSuccess(false);
        setShowModal(true);
    };

    const openScheduleModal = (employee: Profile) => {
        const defaultSched = employee.default_schedule || {
            '1': { type: 'continuous', segments: [{ start: '08:00', end: '16:00' }] },
            '2': { type: 'continuous', segments: [{ start: '08:00', end: '16:00' }] },
            '3': { type: 'continuous', segments: [{ start: '08:00', end: '16:00' }] },
            '4': { type: 'continuous', segments: [{ start: '08:00', end: '16:00' }] },
            '5': { type: 'continuous', segments: [{ start: '08:00', end: '16:00' }] },
            '6': { type: 'off', segments: [] },
            '0': { type: 'off', segments: [] }
        };
        setScheduleForm(defaultSched);
        setShowScheduleModal(employee);
    };

    const handleSaveSchedule = async () => {
        if (!showScheduleModal) return;
        try {
            const result = await personnelService.update(showScheduleModal.id, { default_schedule: scheduleForm });
            if (result) {
                setEmployees(employees.map(emp => emp.id === showScheduleModal.id ? result : emp));
                setShowScheduleModal(null);
                await auditService.logAction({
                    manager_name: currentUser.full_name,
                    employee_name: showScheduleModal.full_name,
                    action: 'Actualización Horario Base',
                    old_value: 'N/A',
                    new_value: 'Plantilla Modificada',
                    reason: 'Actualización de plantilla semanal'
                });
            } else {
                alert('Error al guardar horario base');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleSaveEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        try {
            if (isEditing && formData.id) {
                // Update existing — only include columns that exist in the DB, exclude joined fields like 'roles'
                const updatedProfile: Record<string, any> = {
                    full_name: formData.full_name!,
                    email: formData.email || '',
                    dni: formData.dni || '',
                    role: formData.role as string,
                    sector_id: formData.sector_id || null,
                    managed_sectors: isManagerRole(formData.role || '') ? (formData.managed_sectors || []) : [],
                    qr_token: `SECURE_USER:${formData.full_name?.replace(/\s+/g, '_')}_${formData.id}`
                };

                const result = await personnelService.update(formData.id, updatedProfile);
                if (result) {
                    setEmployees(employees.map(emp => emp.id === formData.id ? result : emp));
                    setSuccess(true);
                } 
            } else {
                // Create new
                const newProfile: Omit<Profile, 'id'> = {
                    full_name: formData.full_name || 'Nuevo Empleado',
                    email: formData.email || '',
                    dni: formData.dni || '',
                    role: formData.role as string,
                    sector_id: formData.sector_id || 'General',
                    managed_sectors: isManagerRole(formData.role || '') ? (formData.managed_sectors || []) : [],
                    qr_token: `SECURE_USER:${formData.full_name?.replace(/\s+/g, '_')}_PENDING`
                };

                const result = await personnelService.create(newProfile);
                if (result) {
                    // Update QR token with actual ID
                    const finalToken = `SECURE_USER:${result.full_name?.replace(/\s+/g, '_')}_${result.id}`;
                    const finalResult = await personnelService.update(result.id, { qr_token: finalToken });
                    const savedResult = finalResult || result;

                    setEmployees([...employees, savedResult]);
                    setSuccess(true);

                    // Log to Audit
                    await auditService.logAction({
                        manager_name: currentUser.full_name,
                        employee_name: savedResult.full_name,
                        action: 'Alta de Empleado',
                        old_value: 'N/A',
                        new_value: savedResult.role,
                        reason: 'Nuevo ingreso registrado'
                    });
                }
            }

            setTimeout(() => {
                setShowModal(false);
                setSuccess(false);
            }, 1000);
        } catch (err: any) {
            console.error(err);
            setError(`Error Supabase: ${err.message || 'Error de comunicación con el servidor'}`);
        }
    };

    const handleDeleteEmployee = async (id: string) => {
        const employeeToDelete = employees.find(e => e.id === id);
        if (window.confirm(`¿Está seguro de eliminar a ${employeeToDelete?.full_name}?`)) {
            const success = await personnelService.delete(id);
            if (success) {
                setEmployees(employees.filter(emp => emp.id !== id));

                // Log to Audit
                if (employeeToDelete) {
                    await auditService.logAction({
                        manager_name: currentUser.full_name,
                        employee_name: employeeToDelete.full_name,
                        action: 'Baja de Empleado',
                        old_value: employeeToDelete.role,
                        new_value: 'Eliminado',
                        reason: 'Eliminación manual'
                    });
                }
            }
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDownload = async () => {
        const node = document.getElementById('printable-badge');
        if (node) {
            try {
                const dataUrl = await toPng(node, {
                    quality: 0.95,
                    pixelRatio: 3, // Higher quality for download
                    backgroundColor: '#ffffff'
                });
                const link = document.createElement('a');
                link.download = `credencial-${showCardModal?.full_name.replace(/\s+/g, '-')}.png`;
                link.href = dataUrl;
                link.click();
            } catch (error) {
                console.error('Error generando la imagen:', error);
            }
        }
    };

    const handleExportList = () => {
        // Ordenar primero por Sector y luego por Nombre
        const sorted = [...filteredEmployees].sort((a, b) => {
            const sectorA = (sectors.find(s => s.id === a.sector_id)?.name || a.sector_id || 'General').toLowerCase();
            const sectorB = (sectors.find(s => s.id === b.sector_id)?.name || b.sector_id || 'General').toLowerCase();
            
            if (sectorA < sectorB) return -1;
            if (sectorA > sectorB) return 1;
            
            if (a.full_name.toLowerCase() < b.full_name.toLowerCase()) return -1;
            if (a.full_name.toLowerCase() > b.full_name.toLowerCase()) return 1;
            return 0;
        });

        const headers = ["Nombre", "DNI", "Rol", "Sector", "Clasificacion", "Puntos"];
        const rows = sorted.map(emp => {
            const roleName = roles.find(r => r.id === emp.role)?.name || emp.role;
            const sectorName = sectors.find(s => s.id === emp.sector_id)?.name || emp.sector_id || 'General';
            const scoreData = scoringData[emp.id];
            
            return [
                emp.full_name,
                emp.dni || '-',
                roleName,
                sectorName,
                scoreData ? scoreData.label : 'Sin Datos',
                scoreData ? scoreData.score : '-'
            ];
        });

        const csvContent = [
            headers.join(";"),
            ...rows.map(row => row.join(";"))
        ].join("\n");

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Directorio_Personal_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 print:hidden">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center">
                        Gestión de <span className="ml-2 text-indigo-600">Personal</span>
                    </h2>
                    <p className="text-slate-500 font-medium">Directorio de empleados y emisión de credenciales.</p>
                </div>

                <div className="flex items-center space-x-3">
                    <button
                        onClick={handleExportList}
                        className="flex items-center space-x-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all active:scale-95"
                    >
                        <Download className="w-5 h-5 text-slate-400" />
                        <span className="hidden sm:inline">Exportar Lista</span>
                    </button>
                    <button
                        onClick={openAddModal}
                        className="flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all active:scale-95"
                    >
                        <UserPlus className="w-5 h-5" />
                        <span>Nuevo Ingreso</span>
                    </button>
                </div>
            </header>

            {/* Directory Table */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden print:hidden">
                <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, DNI o sector..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 pl-12 pr-4 py-3 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:outline-none text-sm font-medium text-slate-700 placeholder-slate-400 transition-all cursor-text text-left"
                            style={{ WebkitAppearance: 'none' }}
                        />
                    </div>
                    <div className="relative w-full sm:w-auto">
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="w-full sm:w-auto bg-slate-50 border border-slate-100 pr-10 pl-6 py-3 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:outline-none text-sm font-bold text-slate-700 transition-all cursor-pointer appearance-none"
                            style={{ minWidth: '220px' }}
                        >
                            <option value="all">Todos los Scorings</option>
                            <option value="1">🟢 Clase 1 (Perfecta)</option>
                            <option value="2">🟡 Clase 2 (Mejorable)</option>
                            <option value="3">🟠 Clase 3 (Deficiente)</option>
                            <option value="4">🔴 Clase 4 (Crónico)</option>
                            <option value="5">🌑 Clase 5 (Irrecuperable)</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Nombre</th>
                                <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">DNI</th>
                                <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Rol</th>
                                <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Sector</th>
                                <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Scoring</th>
                                <th className="px-8 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredEmployees.map((emp) => (
                                <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-8 py-4">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600">
                                                {emp.full_name.charAt(0)}
                                            </div>
                                            <span className="font-bold text-slate-700">{emp.full_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4 text-sm font-medium text-slate-500">
                                        {emp.dni || '---'}
                                    </td>
                                    <td className="px-8 py-4">
                                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 uppercase tracking-wider">
                                            {roles.find(r => r.id === emp.role)?.name || emp.role}
                                        </span>
                                    </td>
                                    <td className="px-8 py-4 text-sm font-medium text-slate-500">
                                        {sectors.find(s => s.id === emp.sector_id)?.name || emp.sector_id || 'General'}
                                    </td>
                                    <td className="px-8 py-4">
                                        {scoringData[emp.id] ? (
                                            <div className={`inline-flex items-center px-3 py-1.5 rounded-xl border ${scoringData[emp.id].color}`}>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">{scoringData[emp.id].label}</span>
                                                    <span className="text-xs font-bold mt-1 opacity-90">{scoringData[emp.id].score} pts</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-24 h-10 bg-slate-100 animate-pulse rounded-xl"></div>
                                        )}
                                    </td>
                                    <td className="px-8 py-4 text-right">
                                        <div className="flex items-center justify-end space-x-3">
                                            <button
                                                onClick={() => openEditModal(emp)}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteEmployee(emp.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Eliminar"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => openScheduleModal(emp)}
                                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                title="Horario Habitual (Plantilla)"
                                            >
                                                <CalendarDays className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setShowCardModal(emp)}
                                                className="text-indigo-600 hover:text-indigo-800 font-bold text-xs uppercase tracking-wider flex items-center space-x-1"
                                            >
                                                <CreditCard className="w-4 h-4 mr-1" />
                                                Ver Carnet
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Employee Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
                    <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-300 flex flex-col" style={{ maxHeight: '90vh' }}>
                        
                        {/* Fixed Header */}
                        <div className="flex justify-between items-center px-8 pt-7 pb-4 border-b border-slate-100 flex-shrink-0">
                            <h3 className="text-2xl font-black text-slate-800">{isEditing ? 'Editar Empleado' : 'Nuevo Empleado'}</h3>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>

                        {/* Scrollable Body */}
                        <div className="overflow-y-auto flex-1 px-8 py-5">
                            {error && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-bold animate-in slide-in-from-top-2">
                                    <div className="flex items-center space-x-2">
                                        <X className="w-5 h-5" />
                                        <span>{error}</span>
                                    </div>
                                </div>
                            )}

                            {success && (
                                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl text-sm font-bold animate-in slide-in-from-top-2">
                                    <div className="flex items-center space-x-2">
                                        <Check className="w-5 h-5" />
                                        <span>{isEditing ? 'Empleado actualizado' : 'Empleado registrado correctamente'}</span>
                                    </div>
                                </div>
                            )}

                            <form id="employee-form" onSubmit={handleSaveEmployee} className="space-y-4">
                                {/* Nombre y DNI en grid de 2 columnas */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nombre Completo</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.full_name}
                                            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
                                            placeholder="Ej. Ana García"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">DNI</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.dni}
                                            onChange={e => setFormData({ ...formData, dni: e.target.value.replace(/\D/g, '') })}
                                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
                                            placeholder="Ej. 12345678"
                                        />
                                    </div>
                                </div>

                                {/* Sector y Rol en grid de 2 columnas */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sector / Área</label>
                                        <select
                                            required
                                            value={formData.sector_id}
                                            onChange={e => setFormData({ ...formData, sector_id: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
                                        >
                                            <option value="">Seleccionar...</option>
                                            {sectors
                                                .filter(s => {
                                                    if (currentUser.role === 'administrador' || currentUser.role === 'superusuario') return true;
                                                    const mySectorIds = getAccessibleSectorIds(currentUser);
                                                    return mySectorIds.includes(s.id);
                                                })
                                                .map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Rol</label>
                                        <select
                                            value={formData.role}
                                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
                                        >
                                            <option value="">Seleccionar...</option>
                                            {roles.map(r => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Panel de sectores adicionales */}
                                {isManagerRole(formData.role || '') && sectors.length > 0 && (
                                    <div className="space-y-2 pt-1">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sectores a Cargo (Adicionales)</label>
                                            <span className="text-[10px] text-indigo-500 font-bold bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg">
                                                {(formData.managed_sectors || []).length} seleccionados
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1 bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto">
                                            {sectors.filter(s => s.id !== formData.sector_id).map(sector => {
                                                const isChecked = (formData.managed_sectors || []).includes(sector.id);
                                                return (
                                                    <label key={sector.id} className={`flex items-center space-x-3 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${isChecked ? 'bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold' : 'hover:bg-white text-slate-600 font-medium border border-transparent'}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => toggleManagedSector(sector.id)}
                                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 flex-shrink-0"
                                                        />
                                                        <span>{sector.name}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        <p className="text-[10px] text-slate-400 italic">Sector principal asignado arriba. Aquí marque los sectores extra.</p>
                                    </div>
                                )}
                            </form>
                        </div>

                        {/* Fixed Footer with Save Button */}
                        <div className="px-8 py-5 border-t border-slate-100 flex-shrink-0 bg-slate-50/80 rounded-b-[2rem]">
                            <button
                                type="submit"
                                form="employee-form"
                                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-base shadow-lg shadow-indigo-500/30 transition-all active:scale-95"
                            >
                                {isEditing ? 'Guardar Cambios' : 'Registrar Empleado'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ID Card / Carnet Modal */}
            {showCardModal && (
                <div
                    className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-pointer"
                    onClick={() => setShowCardModal(null)}
                >
                    <div
                        className="bg-transparent w-full max-w-2xl flex flex-col items-center cursor-default"
                        onClick={e => e.stopPropagation()}
                    >

                        {/* The Badge Itself - Redesigned to horizontal ID-1 Standard (85.6mm x 53.98mm) */}
                        <div
                            id="printable-badge"
                            className="bg-white rounded-2xl shadow-2xl overflow-hidden relative flex flex-col print:shadow-none print:border print:border-slate-200"
                            style={{
                                width: '500px',
                                height: '315px', // Approx 1.58 ratio
                                minWidth: '500px',
                                minHeight: '315px'
                            }}
                        >

                            {/* Header Block - Centered Name */}
                            <div className="flex flex-col items-center pt-8 px-10 text-center">
                                <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight leading-none mb-2 mt-4">
                                    {showCardModal.full_name}
                                </h2>
                                <p className="text-sm font-bold text-[#2D6A4F] tracking-[0.3em] uppercase opacity-70">
                                    Credencial de Acceso
                                </p>
                            </div>

                            {/* Main Content (QR) */}
                            <div className="flex flex-col items-center justify-center flex-1 -mt-10">
                                <div className="bg-[#52B788] p-3 rounded-lg shadow-sm">
                                    <div className="bg-white p-1">
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${showCardModal.qr_token}&bgcolor=ffffff&color=2D6A4F`}
                                            alt="QR Access Code"
                                            className="w-28 h-28 object-contain"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Decorative Waves at Bottom */}
                            <div className="absolute bottom-0 left-0 w-full h-16 overflow-hidden pointer-events-none">
                                <svg viewBox="0 0 500 150" preserveAspectRatio="none" className="w-full h-full">
                                    <path
                                        d="M-10,130 C150,110 250,150 510,90 L510,160 L-10,160 Z"
                                        fill="#2D6A4F"
                                        className="opacity-90"
                                    />
                                    <path
                                        d="M-10,140 C100,100 350,160 510,120 L510,160 L-10,160 Z"
                                        fill="#40916C"
                                        className="opacity-60"
                                    />
                                    <path
                                        d="M-10,150 C180,120 400,160 510,140 L510,160 L-10,160 Z"
                                        fill="#52B788"
                                        className="opacity-40"
                                    />
                                </svg>
                            </div>
                        </div>

                        <div className="mt-8 flex items-center space-x-4 print:hidden">
                            <button
                                onClick={() => setShowCardModal(null)}
                                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold backdrop-blur-sm transition-colors"
                            >
                                Cerrar
                            </button>
                            <button
                                onClick={handlePrint}
                                className="px-6 py-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-white font-bold backdrop-blur-sm transition-colors flex items-center space-x-2"
                            >
                                <Printer className="w-5 h-5" />
                                <span>Imprimir</span>
                            </button>
                            <button
                                onClick={handleDownload}
                                className="px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold shadow-lg shadow-emerald-500/30 transition-all flex items-center space-x-2"
                            >
                                <Download className="w-5 h-5" />
                                <span>Descargar PNG</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Default Schedule Modal */}
            {showScheduleModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
                    <div className="bg-white rounded-[2rem] w-full max-w-3xl shadow-2xl animate-in fade-in zoom-in flex flex-col" style={{ maxHeight: '90vh' }}>
                        <div className="flex justify-between items-center px-8 pt-7 pb-4 border-b border-slate-100 flex-shrink-0">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800">Horario Habitual</h3>
                                <p className="text-sm font-medium text-slate-500">{showScheduleModal.full_name} • Plantilla Base</p>
                            </div>
                            <button onClick={() => setShowScheduleModal(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1 px-8 py-5 space-y-4">
                            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-start gap-3">
                                <CalendarDays className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-indigo-800">
                                    Este es el horario estándar que se asignará automáticamente todos los días. 
                                    Si una semana tiene un turno diferente, modifica directamente el Cronograma Semanal y la excepción sobreescribirá esta plantilla.
                                </p>
                            </div>
                            
                            <div className="space-y-4">
                                {[
                                    { k: '1', l: 'Lunes' }, { k: '2', l: 'Martes' }, { k: '3', l: 'Miércoles' },
                                    { k: '4', l: 'Jueves' }, { k: '5', l: 'Viernes' }, { k: '6', l: 'Sábado' }, { k: '0', l: 'Domingo' }
                                ].map(day => {
                                    const dState = scheduleForm[day.k] || { type: 'off', segments: [] };
                                    
                                    return (
                                        <div key={day.k} className="flex gap-4 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                                            <div className="w-24 font-bold text-slate-700 text-sm pl-2">{day.l}</div>
                                            <select
                                                value={dState.type}
                                                onChange={e => {
                                                    const newType = e.target.value;
                                                    let newSegs = dState.segments;
                                                    if (newType === 'continuous' && (!newSegs || newSegs.length === 0)) newSegs = [{ start: '08:00', end: '16:00' }];
                                                    if (newType === 'split' && (!newSegs || newSegs.length < 2)) newSegs = [{ start: '08:00', end: '12:00' }, { start: '16:00', end: '20:00' }];
                                                    if (newType === 'off') newSegs = [];
                                                    setScheduleForm({ ...scheduleForm, [day.k]: { type: newType, segments: newSegs } });
                                                }}
                                                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none w-36 focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="continuous">Corrido</option>
                                                <option value="split">Cortado</option>
                                                <option value="off">Descanso / Libre</option>
                                            </select>
                                            
                                            <div className="flex-1 flex gap-2">
                                                {dState.type === 'continuous' && (
                                                    <div className="flex gap-2 items-center">
                                                        <input 
                                                            type="time" 
                                                            value={dState.segments[0]?.start || '08:00'} 
                                                            onChange={e => {
                                                                const s = [...(dState.segments || [{start:'08:00',end:'16:00'}])];
                                                                if (!s[0]) s[0] = {start:'08:00', end:'16:00'};
                                                                s[0].start = e.target.value;
                                                                setScheduleForm({ ...scheduleForm, [day.k]: { type: 'continuous', segments: s } });
                                                            }}
                                                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold w-24" 
                                                        />
                                                        <span className="text-slate-400 font-bold">-</span>
                                                        <input 
                                                            type="time" 
                                                            value={dState.segments[0]?.end || '16:00'} 
                                                            onChange={e => {
                                                                const s = [...(dState.segments || [{start:'08:00',end:'16:00'}])];
                                                                if (!s[0]) s[0] = {start:'08:00', end:'16:00'};
                                                                s[0].end = e.target.value;
                                                                setScheduleForm({ ...scheduleForm, [day.k]: { type: 'continuous', segments: s } });
                                                            }}
                                                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold w-24" 
                                                        />
                                                    </div>
                                                )}
                                                {dState.type === 'split' && (
                                                    <div className="flex gap-4 items-center">
                                                        <div className="flex gap-1 items-center bg-white p-1 rounded-lg border border-slate-200">
                                                            <input type="time" value={dState.segments[0]?.start || '08:00'} onChange={e => {
                                                                const s=[...(dState.segments||[])]; if(!s[0]) s[0]={start:'08:00',end:'12:00'}; s[0].start=e.target.value;
                                                                setScheduleForm({...scheduleForm, [day.k]: {type:'split', segments:s}});
                                                            }} className="w-20 text-xs font-bold px-1" />
                                                            <span className="text-slate-400">-</span>
                                                            <input type="time" value={dState.segments[0]?.end || '12:00'} onChange={e => {
                                                                const s=[...(dState.segments||[])]; if(!s[0]) s[0]={start:'08:00',end:'12:00'}; s[0].end=e.target.value;
                                                                setScheduleForm({...scheduleForm, [day.k]: {type:'split', segments:s}});
                                                            }} className="w-20 text-xs font-bold px-1" />
                                                        </div>
                                                        <div className="flex gap-1 items-center bg-white p-1 rounded-lg border border-slate-200">
                                                            <input type="time" value={dState.segments[1]?.start || '16:00'} onChange={e => {
                                                                const s=[...(dState.segments||[])]; if(!s[1]) s[1]={start:'16:00',end:'20:00'}; s[1].start=e.target.value;
                                                                setScheduleForm({...scheduleForm, [day.k]: {type:'split', segments:s}});
                                                            }} className="w-20 text-xs font-bold px-1" />
                                                            <span className="text-slate-400">-</span>
                                                            <input type="time" value={dState.segments[1]?.end || '20:00'} onChange={e => {
                                                                const s=[...(dState.segments||[])]; if(!s[1]) s[1]={start:'16:00',end:'20:00'}; s[1].end=e.target.value;
                                                                setScheduleForm({...scheduleForm, [day.k]: {type:'split', segments:s}});
                                                            }} className="w-20 text-xs font-bold px-1" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="px-8 py-5 border-t border-slate-100 flex-shrink-0 bg-slate-50/80 rounded-b-[2rem]">
                            <button
                                onClick={handleSaveSchedule}
                                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-base shadow-lg shadow-emerald-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Save className="w-5 h-5"/> Guardar Plantilla de Horario
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Styles */}
            <style>{`
        @media print {
          @page {
            size: portrait;
            margin: 0;
          }
          body * {
            visibility: hidden;
          }
          #printable-badge, #printable-badge * {
            visibility: visible;
          }
          #printable-badge {
            position: absolute;
            left: 0;
            top: 0;
            margin: 10mm; /* Small margin from edge of paper */
            width: 85.6mm !important;
            height: 53.98mm !important;
            min-width: 85.6mm !important;
            min-height: 53.98mm !important;
            box-shadow: none !important;
            border: 1px solid #eee !important;
            border-radius: 3.18mm !important; /* CR80 standard radius is ~3.18mm */
            transform: none !important;
          }
          /* Adjust font sizes for actual print size */
          #printable-badge h2 {
            font-size: 14pt !important;
          }
          #printable-badge p {
            font-size: 8pt !important;
          }
          #printable-badge img {
            width: 25mm !important;
            height: 25mm !important;
          }
        }
      `}</style>
        </div>
    );
};

export default PersonnelView;
