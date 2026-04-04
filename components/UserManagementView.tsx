import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Shield, ShieldAlert, UserX, UserCheck, 
  Search, Filter, MoreVertical, Key, Trash2, RotateCcw,
  Clock, AlertCircle, CheckCircle2, Loader2, Ban, ScanLine, Settings
} from 'lucide-react';
import { userManagementService } from '../services/userManagementService';
import { roleService } from '../services/roleService';
import { auditService } from '../services/auditService';
import { Profile, Role } from '../types';

interface UserManagementViewProps {
  currentUser: Profile;
}

const UserManagementView: React.FC<UserManagementViewProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // States for Modals/Dialogs
  const [showSuspendModal, setShowSuspendModal] = useState<Profile | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendUntil, setSuspendUntil] = useState('');
  const [isPermanent, setIsPermanent] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedUsers, fetchedRoles] = await Promise.all([
        userManagementService.getAllUsers(),
        roleService.getAllRoles()
      ]);
      setUsers(fetchedUsers);
      setRoles(fetchedRoles);
    } catch (err: any) {
      console.error("Error loading management data:", err);
      const errorMsg = err.message || 'Error de conexión con la base de datos';
      // Muestra un error persistente para que el usuario sepa si debe ejecutar el SQL
      setMessage({ 
        text: `Error: ${errorMsg}. Asegúrese de ejecutar el SQL del archivo database_schema.sql en Supabase.`, 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const showFeedback = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleUnsuspend = async (userId: string, userName: string) => {
    setActionLoading(userId);
    try {
      await userManagementService.unsuspendUser(userId);
      await auditService.logAction({
        manager_name: currentUser.full_name,
        employee_name: userName,
        action: 'Levantamiento de Suspensión',
        old_value: 'Suspendido',
        new_value: 'Activo',
        reason: 'Restauración manual de acceso'
      });
      showFeedback(`Cuenta de ${userName} reactivada`, 'success');
      loadData();
    } catch (err) {
      showFeedback('Error al reactivar cuenta', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmSuspend = async () => {
    if (!showSuspendModal) return;
    const user = showSuspendModal;
    
    if (!suspendReason.trim()) {
      showFeedback('Debe ingresar un motivo', 'error');
      return;
    }

    setActionLoading(user.id);
    try {
      const until = isPermanent ? null : suspendUntil;
      await userManagementService.suspendUser(user.id, suspendReason, until);
      
      await auditService.logAction({
        manager_name: currentUser.full_name,
        employee_name: user.full_name,
        action: isPermanent ? 'Suspensión Permanente' : 'Suspensión Temporal',
        old_value: 'Activo',
        new_value: `Suspendido hasta: ${until || 'Siempre'}`,
        reason: suspendReason
      });

      showFeedback(`Usuario ${user.full_name} suspendido`, 'success');
      setShowSuspendModal(null);
      setSuspendReason('');
      setSuspendUntil('');
      loadData();
    } catch (err) {
      showFeedback('Error al suspender usuario', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSoftDelete = async (user: Profile) => {
    const reason = window.prompt(`¿Por qué desea archivar la cuenta de ${user.full_name}?`);
    if (reason === null) return;
    if (!reason.trim()) {
      showFeedback('Debe especificar un motivo', 'error');
      return;
    }

    setActionLoading(user.id);
    try {
      await userManagementService.softDeleteUser(user.id, reason);
      await auditService.logAction({
        manager_name: currentUser.full_name,
        employee_name: user.full_name,
        action: 'Archivo de Cuenta (Soft Delete)',
        old_value: 'Activo',
        new_value: 'Archivado',
        reason: reason
      });
      showFeedback('Usuario archivado correctamente', 'success');
      loadData();
    } catch (err) {
      showFeedback('Error al archivar usuario', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (userId: string, userName: string) => {
    setActionLoading(userId);
    try {
      await userManagementService.approveUser(userId);
      await auditService.logAction({
        manager_name: currentUser.full_name,
        employee_name: userName,
        action: 'Aprobación de Cuenta',
        old_value: 'Pendiente',
        new_value: 'Autorizado',
        reason: 'Aprobación manual por administrador'
      });
      showFeedback(`Usuario ${userName} autorizado correctamente`, 'success');
      loadData();
    } catch (err) {
      showFeedback('Error al autorizar usuario', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (userId: string, userName: string) => {
    const confirm = window.confirm(`¿Está seguro de que desea REVOCAR el acceso a la app para ${userName}?`);
    if (!confirm) return;

    setActionLoading(userId);
    try {
      await userManagementService.revokeUserApproval(userId);
      await auditService.logAction({
        manager_name: currentUser.full_name,
        employee_name: userName,
        action: 'Revocación de Acceso',
        old_value: 'Autorizado',
        new_value: 'Pendiente',
        reason: 'Revocación manual por administrador'
      });
      showFeedback(`Acceso revocado para ${userName}`, 'success');
      loadData();
    } catch (err) {
      showFeedback('Error al revocar acceso', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestore = async (user: Profile) => {
    setActionLoading(user.id);
    try {
      await userManagementService.restoreUser(user.id);
      await auditService.logAction({
        manager_name: currentUser.full_name,
        employee_name: user.full_name,
        action: 'Restauración de Cuenta',
        old_value: 'Archivado',
        new_value: 'Activo',
        reason: 'Restauración manual'
      });
      showFeedback('Usuario restaurado correctamente', 'success');
      loadData();
    } catch (err) {
      showFeedback('Error al restaurar usuario', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangeRole = async (userId: string, userName: string, oldRoleId: string, newRoleId: string) => {
    if (oldRoleId === newRoleId) return;
    
    setActionLoading(userId);
    try {
      await userManagementService.changeUserRole(userId, newRoleId);
      await auditService.logAction({
        manager_name: currentUser.full_name,
        employee_name: userName,
        action: 'Cambio de Rol Administrativo',
        old_value: oldRoleId,
        new_value: newRoleId,
        reason: 'Asignación manual de jerarquía'
      });
      showFeedback('Rol actualizado con éxito', 'success');
      loadData();
    } catch (err) {
      showFeedback('Error al cambiar rol', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAccountType = async (user: Profile) => {
    const isCurrentlyEmployee = user.is_employee !== false;
    const action = isCurrentlyEmployee ? 'Convertir a Cuenta de Sistema' : 'Convertir a Cuenta Personal';
    const confirmMessage = isCurrentlyEmployee 
      ? `¿Convertir a ${user.full_name} en Cuenta de Sistema?\n\nDejará de aparecer en las grillas de personal, asistencias y cronogramas.`
      : `¿Convertir a ${user.full_name} en Cuenta Personal?\n\nAparecerá nuevamente en las grillas de personal y se le podrá asignar presentismo.`;

    if (!window.confirm(confirmMessage)) return;

    setActionLoading(user.id);
    try {
      await userManagementService.toggleUserAccountType(user.id, !isCurrentlyEmployee);
      await auditService.logAction({
        manager_name: currentUser.full_name,
        employee_name: user.full_name,
        action: 'Cambio de Tipo de Cuenta',
        old_value: isCurrentlyEmployee ? 'Personal' : 'Sistema',
        new_value: !isCurrentlyEmployee ? 'Personal' : 'Sistema',
        reason: 'Configuración de acceso'
      });
      showFeedback('Tipo de cuenta actualizado', 'success');
      loadData();
    } catch (err) {
      showFeedback('Error al actualizar tipo de cuenta', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (user: Profile) => {
    if (!window.confirm(`¿Enviar instrucciones para resetear contraseña a ${user.email}?`)) return;
    
    setActionLoading(user.id);
    try {
      await userManagementService.resetPassword(user.email);
      showFeedback('Correo de recuperación enviado', 'success');
    } catch (err) {
      showFeedback('Error al enviar correo', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    
    const status = userManagementService.getUserStatus(user);
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && status === 'active') ||
                         (filterStatus === 'suspended' && (status === 'suspended' || status === 'suspended_temp')) ||
                         (filterStatus === 'archived' && status === 'archived') ||
                         (filterStatus === 'pending' && status === 'pending');
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const isAdmin = currentUser.role === 'superusuario' || currentUser.role === 'administrador';

  if (!isAdmin && !currentUser.roles?.permissions?.includes('MANAGE_USERS')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-slate-800">
        <div className="max-w-md w-full bg-white rounded-[3rem] p-10 shadow-2xl text-center space-y-6">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-800">Acceso No Autorizado</h2>
          <p className="text-slate-500 font-medium">No tienes los privilegios necesarios para gestionar usuarios del sistema.</p>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('change-view', { detail: 'my_credential' }))}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm transition-all hover:bg-slate-800"
          >
            VOLVER AL INICIO
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center">
            Gestión de <span className="ml-2 text-indigo-600">Usuarios</span>
          </h2>
          <p className="text-slate-500 font-medium">Administra accesos, roles y el ciclo de vida de las cuentas.</p>
        </div>

        <div className="flex items-center space-x-3">
          {message && (
            <div className={`flex items-center space-x-2 px-6 py-3 rounded-2xl animate-in slide-in-from-right-4 ${message.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span className="font-bold text-sm">{message.text}</span>
            </div>
          )}
          <button 
            onClick={loadData}
            disabled={loading}
            className="p-3 bg-white text-slate-600 hover:text-indigo-600 rounded-2xl shadow-sm border border-slate-100 transition-all hover:bg-slate-50 disabled:opacity-50"
            title="Recargar Lista"
          >
            <RotateCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Buscar por nombre o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <select 
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todos los Roles</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Cualquier Estado</option>
            <option value="active">Activos</option>
            <option value="pending">Pendientes de Aprobación</option>
            <option value="suspended">Suspendidos</option>
            <option value="archived">Archivados</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
            <p className="text-slate-500 font-bold">Consolidando base de usuarios...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
            <UserX className="w-16 h-16 text-slate-200 mb-4" />
            <p className="text-slate-500 font-bold text-lg">No se encontraron usuarios</p>
            <p className="text-slate-400 text-sm">Prueba ajustando los filtros de búsqueda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuario</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rol del Sistema</th>
                  <th className="px-8 py-5 text-left text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Acceso App / Fichada</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredUsers.map(user => {
                  const status = userManagementService.getUserStatus(user);
                  const isS = actionLoading === user.id;

                  return (
                    <tr key={user.id} className={`group hover:bg-slate-50/80 transition-all ${user.deleted_at ? 'opacity-60' : ''}`}>
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm border ${
                            user.role === 'superusuario' ? 'bg-indigo-600 text-white border-indigo-700' :
                            user.role === 'administrador' ? 'bg-slate-800 text-white border-slate-900' :
                            'bg-white text-slate-700 border-slate-200'
                          }`}>
                            {user.photo_url ? (
                              <img src={user.photo_url} className="w-full h-full object-cover rounded-2xl" />
                            ) : user.full_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-black text-slate-800 flex items-center">
                              {user.full_name}
                              {user.id === currentUser.id && <span className="ml-2 px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase rounded-lg">Tú</span>}
                            </p>
                            <p className="text-xs text-slate-400 font-bold">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <select 
                          value={user.role}
                          disabled={user.id === currentUser.id || !!user.deleted_at || !!isS}
                          onChange={(e) => handleChangeRole(user.id, user.full_name, user.role, e.target.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider outline-none border transition-all ${
                            user.role === 'superusuario' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                            user.role === 'administrador' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                            'bg-slate-100 text-slate-600 border-slate-200'
                          } disabled:opacity-50`}
                        >
                          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex flex-col space-y-2">
                            {/* App Access Status */}
                            {status === 'active' && (
                                <span className="flex items-center space-x-2 text-emerald-600 font-bold text-[10px] uppercase">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span>App: Autorizado</span>
                                </span>
                            )}
                            {status === 'pending' && (
                                <span className="flex items-center space-x-2 text-amber-500 font-bold text-[10px] uppercase animate-pulse">
                                    <AlertCircle className="w-3 h-3" />
                                    <span>App: Pendiente</span>
                                </span>
                            )}
                            {(status === 'suspended' || status === 'suspended_temp') && (
                                <span className="flex items-center space-x-2 text-red-500 font-bold text-[10px] uppercase">
                                    <Ban className="w-3 h-3" />
                                    <span>App: Bloqueado</span>
                                </span>
                            )}
                            {status === 'archived' && (
                                <span className="flex items-center space-x-2 text-slate-400 font-bold text-[10px] uppercase">
                                    <UserX className="w-3 h-3" />
                                    <span>App: Archivado</span>
                                </span>
                            )}
                            
                            {/* QR/Attendance Status - Always active for personnel */}
                            <span className="flex items-center space-x-2 text-slate-400 font-bold text-[9px] uppercase border-t border-slate-100 pt-1">
                                <ScanLine className="w-2.5 h-2.5 text-indigo-400" />
                                <span>Fichada QR: Habilitada</span>
                            </span>

                            {/* Account Type Status */}
                            <span className={`flex items-center space-x-2 font-bold text-[9px] uppercase border-t border-slate-100 pt-1 ${user.is_employee === false ? 'text-indigo-600' : 'text-slate-500'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${user.is_employee === false ? 'bg-indigo-500' : 'bg-slate-400'}`} />
                                <span>Tipo: {user.is_employee === false ? 'Usuario Sistema' : 'Personal (Empleado)'}</span>
                            </span>
                          </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-end space-x-2">
                          {isS ? (
                             <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                          ) : user.id !== currentUser.id && (
                            <>
                              {status === 'pending' && (
                                <button 
                                  onClick={() => handleApprove(user.id, user.full_name)}
                                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all flex items-center space-x-1 shadow-lg shadow-indigo-500/20"
                                  title="Autorizar Acceso a la App"
                                >
                                  <UserCheck className="w-3 h-3" />
                                  <span>AUTORIZAR APP</span>
                                </button>
                              )}
                              {status === 'active' && (
                                <button 
                                  onClick={() => handleRevoke(user.id, user.full_name)}
                                  className="p-2.5 bg-slate-50 text-slate-400 hover:bg-orange-50 hover:text-orange-600 rounded-xl transition-all"
                                  title="Revocar Autorización de App"
                                >
                                  <ShieldAlert className="w-4 h-4" />
                                </button>
                              )}

                              {status === 'active' ? (
                                <button 
                                  onClick={() => setShowSuspendModal(user)}
                                  className="p-2.5 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"
                                  title="Suspender Acceso"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              ) : (status === 'suspended' || status === 'suspended_temp') && (
                                <button 
                                  onClick={() => handleUnsuspend(user.id, user.full_name)}
                                  className="p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-all"
                                  title="Reactivar Acceso"
                                >
                                  <UserCheck className="w-4 h-4" />
                                </button>
                              )}

                              {!user.deleted_at ? (
                                <>
                                  <button 
                                    onClick={() => handleToggleAccountType(user)}
                                    className={`p-2.5 rounded-xl transition-all ${user.is_employee === false ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-200'}`}
                                    title={user.is_employee === false ? "Cambiar a Cuenta de Personal" : "Cambiar a Cuenta de Sistema"}
                                  >
                                    <Settings className="w-4 h-4" />
                                  </button>

                                  <button 
                                    onClick={() => handleResetPassword(user)}
                                    className="p-2.5 bg-slate-50 text-slate-400 hover:bg-amber-50 hover:text-amber-600 rounded-xl transition-all"
                                    title="Resetear Contraseña"
                                  >
                                    <Key className="w-4 h-4" />
                                  </button>

                                  <button 
                                    onClick={() => handleSoftDelete(user)}
                                    className="p-2.5 bg-slate-50 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-xl transition-all"
                                    title="Archivar Cuenta (Soft Delete)"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <button 
                                  onClick={() => handleRestore(user)}
                                  className="p-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all"
                                  title="Restaurar Usuario"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-300">
            <div className="flex items-center space-x-4">
              <div className="p-4 bg-red-50 text-red-600 rounded-2xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800">Suspender de Acceso</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{showSuspendModal.full_name}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivo de Suspensión</label>
                <textarea 
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Ej: Incumplimiento grave de normas..."
                  className="w-full h-24 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>

              <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-2xl">
                <input 
                  type="checkbox"
                  id="permCheck"
                  checked={isPermanent}
                  onChange={(e) => setIsPermanent(e.target.checked)}
                  className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="permCheck" className="text-sm font-black text-slate-700 cursor-pointer">Suspensión Permanente</label>
              </div>

              {!isPermanent && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Válida Hasta</label>
                  <input 
                    type="date"
                    value={suspendUntil}
                    onChange={(e) => setSuspendUntil(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            <div className="flex space-x-3 pt-2">
              <button 
                onClick={() => setShowSuspendModal(null)}
                className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-sm transition-all"
              >
                CANCELAR
              </button>
              <button 
                onClick={handleConfirmSuspend}
                className="flex-[2] px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-red-600/20 transition-all active:scale-95"
              >
                CONFIRMAR BLOQUEO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] group-hover:bg-indigo-500/20 transition-all duration-700" />
        <div className="flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-8 relative">
          <div className="p-6 bg-indigo-500/20 rounded-3xl">
            <Shield className="w-10 h-10 text-indigo-400" />
          </div>
          <div className="space-y-2 flex-1 text-center md:text-left">
            <h4 className="text-xl font-black">Política de Integridad de Usuarios</h4>
            <p className="text-indigo-200/60 font-medium leading-relaxed text-sm max-w-3xl">
              El bloqueo de usuarios es una medida de seguridad que impide el acceso a la plataforma sin eliminar sus registros históricos. 
              Utilice el <strong>Archivo (Soft Delete)</strong> para ocultar usuarios que ya no pertenecen a la organización manteniendo su integridad de datos.
            </p>
          </div>
        </div>
      </div>
      <footer className="mt-8 px-6 py-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
        <span>Sistema de Gestión de Personal v2.1-Security</span>
        <span>Sincronizado: {new Date().toLocaleTimeString()}</span>
      </footer>
    </div>
  );
};

export default UserManagementView;
