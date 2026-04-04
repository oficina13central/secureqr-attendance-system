import React, { useState } from 'react';
import {
  Users,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  BarChart3,
  LogOut,
  ScanLine,
  Settings,
  History,
  UserCog,
  Menu,
  ChevronLeft,
  Database,
  CreditCard
} from 'lucide-react';
import TerminalView from './components/TerminalView';
import AdminDashboard from './components/AdminDashboard';
import ScheduleView from './components/ScheduleView';
import PersonnelView from './components/PersonnelView';
import AuditView from './components/AuditView';
import PersonnelAudit from './components/PersonnelAudit';
import SettingsView from './components/SettingsView';
import FraudAnalysis from './components/FraudAnalysis';
import AttendanceCalendarView from './components/AttendanceCalendarView';
import UserManagementView from './components/UserManagementView';
import MyCredentialView from './components/MyCredentialView';
import { Profile } from './types';
import { personnelService } from './services/personnelService';
import { authService } from './services/authService';
import { supabase } from './services/supabaseClient';
import Login from './components/Login';
import { Session } from '@supabase/supabase-js';

type AdminSubView = 'dashboard' | 'audit_personnel' | 'schedule' | 'personnel' | 'audit' | 'settings' | 'fraud' | 'users' | 'my_credential' | 'terminal';

const App: React.FC = () => {
  const [mainView, setMainView] = useState<'terminal' | 'admin'>('admin');
  const [adminSubView, setAdminSubView] = useState<AdminSubView>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  React.useEffect(() => {
    // Initial session check
    authService.getSession()
      .then(session => {
        setSession(session);
        if (session) {
          fetchProfile(session.user.id);
        } else {
          setLoadingAuth(false);
        }
      })
      .catch(err => {
        console.error("Initial session check failed:", err);
        setLoadingAuth(false);
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      
      if (event === 'PASSWORD_RECOVERY') {
        setShowPasswordResetModal(true);
      }

      if (session) {
        fetchProfile(session.user.id);
      } else {
        setCurrentUser(null);
        setLoadingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    setLoadingAuth(true);
    try {
      const profile = await authService.getUserProfile(userId);
      setCurrentUser(profile);
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setLoadingAuth(false);
    }
  };

  // Lifted State: Employees
  const [employees, setEmployees] = useState<Profile[]>([]);

  React.useEffect(() => {
    if (currentUser?.role === 'terminal') {
      setMainView('terminal');
    }
  }, [currentUser]);

  React.useEffect(() => {
    if (!session) return;
    const fetchEmployees = async () => {
      const data = await personnelService.getAll();
      setEmployees(data);
    };
    fetchEmployees();
  }, [session]);

  React.useEffect(() => {
    const handleChangeView = (e: any) => {
      const view = e.detail as AdminSubView;
      setAdminSubView(view);
    };
    window.addEventListener('change-view', handleChangeView);
    return () => window.removeEventListener('change-view', handleChangeView);
  }, []);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setResetError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setResettingPassword(true);
    setResetError('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setResetSuccess(true);
      setTimeout(() => {
        setShowPasswordResetModal(false);
        setResetSuccess(false);
        setNewPassword('');
      }, 3000);
    } catch (err: any) {
      setResetError(err.message || 'Error al actualizar la contraseña');
    } finally {
      setResettingPassword(false);
    }
  };

  React.useEffect(() => {
    if (isSidebarOpen && window.innerWidth < 768) {
      document.body.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
    }
  }, [isSidebarOpen]);

  const renderAdminView = () => {
    // 1. Roles y permisos básicos
    const isSuperUser = currentUser?.role === 'superusuario';
    // Mantenemos esta variable genérica para ciertas acciones UI
    const isAdminUser = currentUser?.role === 'superusuario' || currentUser?.role === 'administrador';
    
    // 2. Definición de permisos por vista
    const viewPermissions: Record<AdminSubView, string[]> = {
      'dashboard': ['VIEW_DASHBOARD'],
      'audit_personnel': ['VIEW_PERSONNEL_AUDIT'],
      'schedule': ['MANAGE_SCHEDULES', 'MANAGE_SECTOR_SCHEDULES'],
      'personnel': ['MANAGE_PERSONNEL', 'VIEW_SECTOR_PERSONNEL'],
      'audit': ['VIEW_AUDIT_LOGS'],
      'settings': ['MANAGE_SETTINGS'],
      'fraud': ['VIEW_AUDIT_LOGS'],
      'users': ['MANAGE_USERS'],
      'my_credential': ['SELF_VIEW', 'VIEW_DASHBOARD'],
      'terminal': ['MANAGE_TERMINAL']
    };

    // 3. Verificación de permiso para la vista actual
    const requiredPerms = viewPermissions[adminSubView];
    
    let hasAccess = false;
    if (adminSubView === 'settings') {
      hasAccess = isSuperUser;
    } else {
      hasAccess = isSuperUser || 
                  (currentUser?.role === 'encargado' && ['schedule', 'personnel', 'my_credential'].includes(adminSubView)) || 
                  (currentUser?.roles?.permissions && requiredPerms.some(p => currentUser.roles?.permissions?.includes(p)));
    }

    // 4. Redirección forzada si no tiene acceso
    if (!hasAccess && adminSubView !== 'my_credential') {
      // Si no tiene acceso a la vista actual, intentamos mostrar su credencial si tiene permiso
      if (currentUser?.roles?.permissions?.includes('SELF_VIEW')) {
        return <MyCredentialView user={currentUser} />;
      }
      // Si ni eso, mostramos su cronograma (segurización máxima)
      return <ScheduleView employees={employees} currentUser={currentUser || { full_name: 'Invitado', role: '' } as any} />;
    }

    // 5. Renderizado seguro de componentes
    switch (adminSubView) {
      case 'dashboard': return <AdminDashboard currentUser={currentUser!} />;
      case 'audit_personnel': return <PersonnelAudit employees={employees} currentUser={currentUser || { full_name: 'Invitado', role: '' } as any} />;
      case 'schedule': return <ScheduleView employees={employees} currentUser={currentUser || { full_name: 'Invitado', role: '' } as any} />;
      case 'personnel': return <PersonnelView employees={employees} setEmployees={setEmployees} currentUser={currentUser || { full_name: 'Invitado', role: '' } as any} />;
      case 'audit': return <AuditView />;
      case 'settings': return <SettingsView currentUser={currentUser || { full_name: 'Invitado', role: '' } as any} />;
      case 'fraud': return <FraudAnalysis />;
      case 'users': return <UserManagementView currentUser={currentUser!} />;
      case 'my_credential': return <MyCredentialView user={currentUser!} />;
      case 'terminal': return (
        <div className="fixed inset-0 z-50 bg-slate-900 border-none">
          <TerminalView onExit={() => isAdminUser ? setMainView('admin') : authService.signOut()} />
        </div>
      );
      default: return <AdminDashboard currentUser={currentUser!} />;
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-bold text-sm animate-pulse">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login onLoginSuccess={setSession} />;
  }

  // Check for suspension
  if (currentUser?.is_suspended) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white">
        <div className="max-w-md w-full bg-slate-800 rounded-[3rem] p-10 shadow-2xl border border-slate-700 text-center space-y-8 animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto border border-red-500/30">
            <ShieldAlert className="w-10 h-10 text-red-500" />
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-black tracking-tight">Acceso Bloqueado</h2>
            <p className="text-slate-400 font-medium leading-relaxed">
              Lo sentimos, <strong>{currentUser.full_name}</strong>. Su cuenta ha sido suspendida por la administración del sistema.
            </p>
            {currentUser.suspended_reason && (
              <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">Motivo informado:</p>
                <p className="text-sm text-red-400 font-bold italic">"{currentUser.suspended_reason}"</p>
              </div>
            )}
            {currentUser.suspended_until && (
              <p className="text-xs font-bold text-amber-500 bg-amber-500/10 py-2 px-4 rounded-xl inline-block border border-amber-500/20">
                Válido hasta: {new Date(currentUser.suspended_until).toLocaleDateString()}
              </p>
            )}
          </div>
          <button 
            onClick={() => authService.signOut()}
            className="w-full py-4 bg-slate-700 hover:bg-slate-600 rounded-2xl font-black text-sm transition-all flex items-center justify-center space-x-2"
          >
            <LogOut className="w-4 h-4" />
            <span>CERRAR SESIÓN</span>
          </button>
        </div>
      </div>
    );
  }

  // Check for approval - ONLY isaacgomez78@gmail.com can bypass if state is messy
  if (currentUser?.is_approved === false && currentUser?.email !== 'isaacgomez78@gmail.com') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-800">
        <div className="max-w-md w-full bg-white rounded-[3rem] p-10 shadow-2xl border border-slate-100 text-center space-y-8 animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
            <ShieldCheck className="w-10 h-10 text-amber-600" />
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-black tracking-tight text-slate-800">Acceso Pendiente</h2>
            <p className="text-slate-500 font-medium leading-relaxed">
              Hola, <strong>{currentUser.full_name}</strong>. Tu registro ha sido recibido correctamente.
            </p>
            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
              <p className="text-xs text-amber-700 font-bold leading-relaxed">
                Para garantizar la seguridad del sistema, un administrador debe autorizar tu cuenta antes de que puedas ingresar.
              </p>
            </div>
            <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">
              Por favor, contacta a tu supervisor para agilizar el proceso.
            </p>
          </div>
          <button 
            onClick={() => authService.signOut()}
            className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-sm transition-all flex items-center justify-center space-x-2"
          >
            <LogOut className="w-4 h-4" />
            <span>CERRAR SESIÓN</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden bg-slate-50 relative">
      {/* Mobile Header overlay for toggle */}
      {mainView === 'admin' && (
        <div className={`fixed top-4 z-[60] transition-all duration-500 ease-in-out ${isSidebarOpen ? 'left-[216px]' : 'left-4'}`}>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="flex items-center justify-center w-10 h-10 bg-white/90 backdrop-blur-md text-slate-800 hover:text-indigo-600 rounded-full shadow-xl border border-slate-200/50 transition-all hover:scale-105 active:scale-95 focus:outline-none group"
            title="Alternar Menú"
          >
            {isSidebarOpen ? (
              <ChevronLeft className="w-5 h-5 transition-transform duration-300" />
            ) : (
              <Menu className="w-5 h-5 transition-transform duration-300" />
            )}
          </button>
        </div>
      )}

      {/* Mobile Backdrop Overlay */}
      {mainView === 'admin' && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-30 md:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      {mainView === 'admin' && (
        <aside className={`bg-slate-900 text-white flex flex-col z-40 shadow-2xl transition-all duration-300 fixed md:relative h-full max-h-screen ${
          isSidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:w-0'
        }`}>
          {/* Sidebar Header */}
          <div className="flex items-center space-x-3 px-6 py-8">
            <div className="bg-indigo-500/20 p-2.5 rounded-2xl border border-indigo-500/30">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tighter leading-none">SECURE QR</span>
              <span className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">Control System</span>
            </div>
          </div>

          {/* Scrollable Navigation Area */}
          <div className="flex-1 overflow-y-auto px-4 space-y-8 pb-8 custom-scrollbar">
            <nav className="space-y-1.5">
              <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Menú Principal</p>
              {[
                { id: 'dashboard', label: 'Panel General', icon: BarChart3, permission: 'VIEW_DASHBOARD' },
                { id: 'my_credential', label: 'Mi Credencial (QR)', icon: CreditCard, permission: 'SELF_VIEW' },
                { id: 'schedule', label: 'Cronogramas', icon: Calendar, permission: 'MANAGE_SCHEDULES' },
                { id: 'personnel', label: 'Personal', icon: Users, permission: 'MANAGE_PERSONNEL' },
                { id: 'audit', label: 'Logs de Sistema', icon: History, permission: 'VIEW_AUDIT_LOGS' },
                { id: 'audit_personnel', label: 'Auditoría de Personal', icon: Users, permission: 'VIEW_PERSONNEL_AUDIT' },
                { id: 'fraud', label: 'Análisis de Fraude', icon: ShieldCheck, permission: 'VIEW_AUDIT_LOGS' },
                { id: 'users', label: 'Usuarios', icon: UserCog, permission: 'MANAGE_USERS' },
                { id: 'settings', label: 'Ajustes', icon: Settings, permission: 'MANAGE_SETTINGS' },
              ]
                .filter(item => {
                  if (item.id === 'settings') {
                    return currentUser?.role === 'superusuario';
                  }
                  if (currentUser?.role === 'superusuario') return true; // Superusuario siempre ve todo
                  
                  // Para los demás (incluido administrador), validamos su matriz dinámica o rol específico
                  if (currentUser?.roles?.permissions && Array.isArray(currentUser.roles.permissions)) {
                    return currentUser.roles.permissions.includes(item.permission);
                  }
                  
                  // Fallbacks legacy/seguridad
                  if (currentUser?.role === 'empleado') {
                    return ['my_credential', 'schedule'].includes(item.id);
                  }
                  if (currentUser?.role === 'encargado') {
                    return ['my_credential', 'schedule', 'personnel'].includes(item.id);
                  }
                  return false;
                })
                .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setAdminSubView(item.id as AdminSubView);
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                      adminSubView === item.id 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    {React.createElement(item.icon, { className: `w-5 h-5 ${adminSubView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-white'}` })}
                    <span>{item.label}</span>
                  </button>
                ))}
            </nav>

            {(currentUser?.role === 'administrador' || currentUser?.role === 'superusuario' || currentUser?.role === 'terminal') && (
              <div className="space-y-4">
                <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Utilidades</p>
                <button
                  onClick={() => setMainView('terminal')}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3.5 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white border border-emerald-500/20 rounded-2xl text-xs font-black transition-all"
                >
                  <ScanLine className="w-4 h-4" />
                  <span>MODO TERMINAL</span>
                </button>
              </div>
            )}
          </div>

          {/* User Profile Footer */}
          <div className="p-4 bg-slate-950/50 border-t border-slate-800/50 backdrop-blur-md">
            <div className="flex items-center space-x-3 bg-slate-800/30 p-3 rounded-2xl relative group border border-slate-700/30">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white shadow-lg border border-white/10 shrink-0">
                {currentUser?.full_name?.charAt(0) || session?.user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold truncate text-slate-100">{currentUser?.full_name || session?.user?.email?.split('@')[0]}</p>
                <p className="text-[9px] text-indigo-400 uppercase tracking-widest font-black truncate">
                  {currentUser?.roles?.name || currentUser?.role || 'Sin Asignar'}
                </p>
              </div>
              <button
                onClick={() => {
                  authService.signOut();
                  setSession(null);
                  setCurrentUser(null);
                }}
                className="p-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all duration-300 md:opacity-0 md:group-hover:opacity-100"
                title="Cerrar Sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        {mainView === 'admin' ? (
          renderAdminView()
        ) : (
          <TerminalView onExit={() => {
            if (currentUser?.role === 'terminal') {
              authService.signOut();
            } else {
              setMainView('admin');
            }
          }} />
        )}
      </main>
      {/* Password Reset Modal */}
      {showPasswordResetModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-slate-800">Nueva Contraseña</h3>
              <p className="text-sm text-slate-500 font-medium">Establece la nueva clave de acceso para tu cuenta.</p>
            </div>

            {resetSuccess ? (
              <div className="bg-emerald-50 text-emerald-700 p-6 rounded-2xl flex flex-col items-center space-y-3 animate-in fade-in zoom-in-95">
                <ShieldCheck className="w-10 h-10" />
                <p className="font-bold text-center">¡Contraseña actualizada con éxito!</p>
                <p className="text-xs opacity-60">Redirigiendo...</p>
              </div>
            ) : (
              <form onSubmit={handlePasswordUpdate} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nueva Contraseña</label>
                  <input 
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-lg font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  />
                  {resetError && <p className="text-xs text-red-500 font-bold px-1">{resetError}</p>}
                </div>

                <button 
                  type="submit"
                  disabled={resettingPassword}
                  className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {resettingPassword ? 'ACTUALIZANDO...' : 'GUARDAR CONTRASEÑA'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
