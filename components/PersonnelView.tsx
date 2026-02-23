
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
    Download
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { Profile } from '../types';
import { personnelService } from '../services/personnelService';
import { auditService } from '../services/auditService';
import { sectorService, Sector } from '../services/sectorService';
import { roleService } from '../services/roleService';
import { Role } from '../types';

interface PersonnelViewProps {
    employees: Profile[];
    setEmployees: React.Dispatch<React.SetStateAction<Profile[]>>;
}

const PersonnelView: React.FC<PersonnelViewProps> = ({ employees, setEmployees }) => {
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showCardModal, setShowCardModal] = useState<Profile | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<boolean>(false);
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);

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

    // Initial Data is now passed via props from App.tsx

    const [formData, setFormData] = useState<Partial<Profile>>({
        id: '',
        full_name: '',
        email: '',
        role: 'encargado',
        sector_id: ''
    });

    const openAddModal = () => {
        setIsEditing(false);
        setFormData({ full_name: '', email: '', role: 'encargado', sector_id: '' });
        setError(null);
        setSuccess(false);
        setShowModal(true);
    };

    const openEditModal = (employee: Profile) => {
        setIsEditing(true);
        setFormData({ ...employee });
        setError(null);
        setSuccess(false);
        setShowModal(true);
    };

    const handleSaveEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        try {
            if (isEditing && formData.id) {
                // Update existing
                const updatedProfile = {
                    full_name: formData.full_name!,
                    email: formData.email || '',
                    role: formData.role as string,
                    sector_id: formData.sector_id,
                    qr_token: `SECURE_USER:${formData.full_name?.replace(/\s+/g, '_')}_${formData.id}`
                };

                const result = await personnelService.update(formData.id, updatedProfile);
                if (result) {
                    setEmployees(employees.map(emp => emp.id === formData.id ? result : emp));
                    setSuccess(true);
                } else {
                    setError('Error al actualizar el empleado. Intente de nuevo.');
                    return;
                }
            } else {
                // Create new
                const newProfile: Omit<Profile, 'id'> = {
                    full_name: formData.full_name || 'Nuevo Empleado',
                    email: formData.email || '',
                    role: formData.role as string,
                    sector_id: formData.sector_id || 'General',
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
                        manager_name: 'Admin',
                        employee_name: savedResult.full_name,
                        action: 'Alta de Empleado',
                        old_value: 'N/A',
                        new_value: savedResult.role,
                        reason: 'Nuevo ingreso registrado'
                    });
                } else {
                    setError('Error al crear el empleado. Verifique la conexión con la base de datos.');
                    return;
                }
            }

            setTimeout(() => {
                setShowModal(false);
                setSuccess(false);
            }, 1000);
        } catch (err) {
            console.error(err);
            setError('Error de comunicación con el servidor.');
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
                        manager_name: 'Admin',
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
                <div className="p-6 border-b border-slate-50 flex items-center space-x-4">
                    <Search className="w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o sector..."
                        className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-700 placeholder-slate-400"
                    />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Nombre</th>
                                <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Rol</th>
                                <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Sector</th>
                                <th className="px-8 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {employees.map((emp) => (
                                <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-8 py-4">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600">
                                                {emp.full_name.charAt(0)}
                                            </div>
                                            <span className="font-bold text-slate-700">{emp.full_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4">
                                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 uppercase tracking-wider">
                                            {roles.find(r => r.id === emp.role)?.name || emp.role}
                                        </span>
                                    </td>
                                    <td className="px-8 py-4 text-sm font-medium text-slate-500">
                                        {sectors.find(s => s.id === emp.sector_id)?.name || emp.sector_id || 'General'}
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
                    <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-8 animate-in fade-in zoom-in duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-slate-800">{isEditing ? 'Editar Empleado' : 'Nuevo Empleado'}</h3>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-bold animate-in slide-in-from-top-2">
                                <div className="flex items-center space-x-2">
                                    <X className="w-5 h-5" />
                                    <span>{error}</span>
                                </div>
                            </div>
                        )}

                        {success && (
                            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl text-sm font-bold animate-in slide-in-from-top-2">
                                <div className="flex items-center space-x-2">
                                    <Check className="w-5 h-5" />
                                    <span>{isEditing ? 'Empleado actualizado' : 'Empleado registrado correctamente'}</span>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSaveEmployee} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nombre Completo</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.full_name}
                                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                    placeholder="Ej. Ana García"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sector / Área</label>
                                <select
                                    required
                                    value={formData.sector_id}
                                    onChange={e => setFormData({ ...formData, sector_id: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                >
                                    <option value="">Seleccionar Sector...</option>
                                    {sectors.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Rol</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                >
                                    <option value="">Seleccionar Rol...</option>
                                    {roles.map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>

                            <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/30 transition-all">
                                {isEditing ? 'Guardar Cambios' : 'Registrar Empleado'}
                            </button>
                        </form>
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
