import React, { useState, useEffect } from 'react';
import { Shield, ShieldCheck, Briefcase, User, Info, Plus, Save, X, Check, Loader2, Trash2 } from 'lucide-react';
import { roleService } from '../services/roleService';
import { supabase } from '../services/supabaseClient';
import { Role, Permission } from '../types';

const RoleManager: React.FC = () => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null); // Role ID being saved
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [fetchedRoles, fetchedPermissions] = await Promise.all([
            roleService.getAllRoles(),
            roleService.getAllPermissions()
        ]);

        // Fetch permissions for each role
        const rolesWithPerms = await Promise.all(fetchedRoles.map(async (role) => {
            const perms = await roleService.getRolePermissions(role.id);
            return { ...role, permissions: perms };
        }));

        setRoles(rolesWithPerms);
        setPermissions(fetchedPermissions);
        setLoading(false);
    };

    const handleCreateRole = async () => {
        setIsAdding(true);
        try {
            const newRoleId = `rol_${Math.random().toString(36).substr(2, 5)}`;
            const newRole: Role = {
                id: newRoleId,
                name: 'Nuevo Rol',
                description: 'Descripción del nuevo rol...',
                permissions: []
            };
            await roleService.createRole({ name: newRole.name, description: newRole.description });
            await loadData();
        } catch (err) {
            console.error('Error creating role:', err);
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteRole = async (id: string) => {
        if (['superusuario', 'administrador', 'encargado', 'empleado'].includes(id)) {
            alert('No se pueden eliminar los roles base del sistema.');
            return;
        }

        if (window.confirm('¿Está seguro de eliminar este rol? Los usuarios asignados podrían perder acceso.')) {
            try {
                const { error } = await supabase.from('roles').delete().eq('id', id);
                if (error) throw error;
                await loadData();
            } catch (err) {
                console.error('Error deleting role:', err);
            }
        }
    };

    const handleSaveRole = async (role: Role) => {
        setSaving(role.id);
        try {
            await roleService.updateRole(role.id, { name: role.name, description: role.description });
            if (role.permissions) {
                await roleService.updateRolePermissions(role.id, role.permissions);
            }
            await loadData();
        } catch (err) {
            console.error('Error saving role:', err);
        } finally {
            setSaving(null);
        }
    };

    const togglePermission = (roleId: string, permissionId: string) => {
        setRoles(prev => prev.map(r => {
            if (r.id !== roleId) return r;
            const currentPerms = r.permissions || [];
            const newPerms = currentPerms.includes(permissionId)
                ? currentPerms.filter(id => id !== permissionId)
                : [...currentPerms, permissionId];
            return { ...r, permissions: newPerms };
        }));
    };

    const getIconForRole = (id: string) => {
        switch (id) {
            case 'superusuario': return ShieldCheck;
            case 'administrador': return Shield;
            case 'encargado': return Briefcase;
            default: return User;
        }
    };

    const getColorForRole = (id: string) => {
        switch (id) {
            case 'superusuario': return 'text-purple-600 bg-purple-50';
            case 'administrador': return 'text-indigo-600 bg-indigo-50';
            case 'encargado': return 'text-amber-600 bg-amber-50';
            default: return 'text-emerald-600 bg-emerald-50';
        }
    };

    if (loading) return <div className="py-12 text-center text-slate-400 animate-pulse font-medium">Cargando jerarquía de roles...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <header className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                        <Shield className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800">Jerarquía de Roles</h3>
                        <p className="text-xs text-slate-500 font-medium">Define los permisos y niveles de acceso de forma dinámica.</p>
                    </div>
                </div>

                <button
                    onClick={handleCreateRole}
                    disabled={isAdding}
                    className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
                >
                    {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    <span>Nuevo Rol</span>
                </button>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {roles.map(role => {
                    const Icon = getIconForRole(role.id);
                    const colorClass = getColorForRole(role.id);
                    const isSaving = saving === role.id;

                    return (
                        <div key={role.id} className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm hover:shadow-md transition-all group flex flex-col">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center space-x-4">
                                    <div className={`p-4 rounded-2xl ${colorClass}`}>
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <input
                                            className="font-black text-slate-800 text-lg bg-transparent border-none p-0 focus:ring-0 w-full"
                                            value={role.name}
                                            onChange={(e) => setRoles(prev => prev.map(r => r.id === role.id ? { ...r, name: e.target.value } : r))}
                                        />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">{role.id}</span>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {!['superusuario', 'administrador', 'encargado', 'empleado'].includes(role.id) && (
                                        <button
                                            onClick={() => handleDeleteRole(role.id)}
                                            className="p-3 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                                            title="Eliminar Rol"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleSaveRole(role)}
                                        disabled={isSaving}
                                        className={`p-3 rounded-xl transition-all ${isSaving ? 'bg-indigo-50 text-indigo-400' : 'bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'}`}
                                        title="Guardar Cambios"
                                    >
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <textarea
                                className="text-sm text-slate-600 mb-8 leading-relaxed font-medium bg-slate-50 border-none rounded-2xl p-4 w-full focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                                value={role.description}
                                onChange={(e) => setRoles(prev => prev.map(r => r.id === role.id ? { ...r, description: e.target.value } : r))}
                            />

                            <div className="space-y-4 flex-1">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center mb-4">
                                    <Info className="w-3 h-3 mr-2 text-indigo-400" />
                                    Matriz de Permisos
                                </h5>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                                    {permissions.map(perm => {
                                        const isGranted = role.permissions?.includes(perm.id);
                                        return (
                                            <label
                                                key={perm.id}
                                                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group/perm ${isGranted ? 'bg-indigo-50/50 border-indigo-100 text-indigo-700' : 'bg-white border-slate-100 text-slate-400 grayscale'}`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black leading-tight">{perm.name}</span>
                                                    <span className="text-[8px] font-bold opacity-50 uppercase tracking-tighter">{perm.category}</span>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={isGranted}
                                                    onChange={() => togglePermission(role.id, perm.id)}
                                                />
                                                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${isGranted ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200 group-hover/perm:border-indigo-300'}`}>
                                                    {isGranted && <Check className="w-3 h-3 text-white" />}
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>

                                {/* Botón de Guardado Prominente */}
                                <div className="pt-6 border-t border-slate-50">
                                    <button
                                        onClick={() => handleSaveRole(role)}
                                        disabled={isSaving}
                                        className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center space-x-3 shadow-xl ${
                                            isSaving 
                                                ? 'bg-slate-100 text-slate-400 cursor-wait' 
                                                : saving === null && role.permissions?.length !== (roles.find(r => r.id === role.id)?.permissions?.length) // simplified check
                                                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20 active:scale-95'
                                                  : 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-emerald-500/20 active:scale-95'
                                        }`}
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Guardando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4" />
                                                <span>Guardar Cambios</span>
                                            </>
                                        )}
                                    </button>
                                    
                                    {/* Success Message Fallback (Client Feedback) */}
                                    {!isSaving && saving === null && (
                                        <p className="text-center text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-3 animate-bounce">
                                            ✓ Configuración disponible para este rol
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="p-6 bg-slate-900 border border-slate-800 rounded-[2.5rem] mt-4 flex items-center space-x-6 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
                <div className="p-4 bg-indigo-500/20 rounded-2xl">
                    <ShieldCheck className="w-8 h-8 text-indigo-400" />
                </div>
                <div>
                    <p className="text-sm font-bold">Control Dinámico de Seguridad</p>
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-1">
                        Los cambios en los permisos afectan en tiempo real a todos los usuarios con el rol modificado.
                        Asegúrese de guardar cada tarjeta individualmente después de realizar cambios.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RoleManager;
