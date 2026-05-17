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
  CreditCard,
  BookOpen,
  RefreshCw,
  Download,
  ClipboardCheck
} from 'lucide-react';
import TerminalView from './components/TerminalView';
import AdminDashboard from './components/AdminDashboard';
import ScheduleView from './components/ScheduleView';
import PersonnelView from './components/PersonnelView';
import AuditView from './components/AuditView';
import PersonnelAudit from './components/PersonnelAudit';
import SettingsView from './components/SettingsView';
import FraudAnalysis from './components/FraudAnalysis';
import UserManagementView from './components/UserManagementView';
import MyCredentialView from './components/MyCredentialView';
import ManualView from './components/ManualView';
import HrRequestsView from './components/HrRequestsView';
import { Profile } from './types';
import { personnelService } from './services/personnelService';
import { authService } from './services/authService';
import { supabase } from './services/supabaseClient';
import Login from './components/Login';
import { Session } from '@supabase/supabase-js';

type AdminSubView = 'dashboard' | 'audit_personnel' | 'schedule' | 'personnel' | 'hr_requests' | 'audit' | 'settings' | 'fraud' | 'users' | 'my_credential' | 'terminal' | 'manual';
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};
type TerminalSessionSnapshot = {
  userId: string;
  fullName?: string;
  email?: string;
  savedAt: string;
};

const TERMINAL_SESSION_STORAGE_KEY = 'secureqr_terminal_session';

const getStoredTerminalSession = (): TerminalSessionSnapshot | null => {
  try {
    const raw = localStorage.getItem(TERMINAL_SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveStoredTerminalSession = (profile: Profile) => {
  const snapshot: TerminalSessionSnapshot = {
    userId: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    savedAt: new Date().toISOString()
  };
  localStorage.setItem(TERMINAL_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
};

const clearStoredTerminalSession = () => {
  localStorage.removeItem(TERMINAL_SESSION_STORAGE_KEY);
};

const FloatingAppActions: React.FC<{
  canInstall: boolean;
  onInstall: () => void;
}> = ({ canInstall, onInstall }) => (
  <div className="fixed right-4 bottom-4 z-[90] flex flex-col gap-2">
    {canInstall && (
      <button
        type="button"
        onClick={onInstall}
        className="w-12 h-12 flex items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xl shadow-emerald-900/20 border border-white/20 hover:bg-emerald-700 active:scale-95 transition-all"
        title="Instalar app"
        aria-label="Instalar app"
      >
        <Download className="w-5 h-5" />
      </button>
    )}
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-900/20 border border-white/20 hover:bg-slate-800 active:scale-95 transition-all"
      title="Recargar"
      aria-label="Recargar"
    >
      <RefreshCw className="w-5 h-5" />
    </button>
  </div>
);

const TerminalSessionRecovery: React.FC<{
  terminalName?: string;
  isOnline: boolean;
  onRetry: () => void;
}> = ({ terminalName, isOnline, onRetry }) => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
    <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl text-center space-y-7">
      <div className="w-20 h-20 mx-auto rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
        <RefreshCw className="w-9 h-9 text-indigo-300 animate-spin" />
      </div>
      <div className="space-y-3">
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-indigo-300">Terminal persistente</p>
        <h1 className="text-2xl font-black tracking-tight">Reconectando sesion</h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          Esta terminal sigue vinculada a {terminalName || 'este dispositivo'}, pero la conexion no permitio confirmar la sesion. No se enviara al login mientras se recupera el enlace.
        </p>
      </div>
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border ${isOnline ? 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10' : 'text-red-300 border-red-500/20 bg-red-500/10'}`}>
        <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
        {isOnline ? 'Internet detectado' : 'Sin internet estable'}
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95"
      >
        Reintentar ahora
      </button>
    </div>
  </div>
);

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
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [terminalSessionSnapshot, setTerminalSessionSnapshot] = useState<TerminalSessionSnapshot | null>(() => getStoredTerminalSession());
  const [recoveringTerminalSession, setRecoveringTerminalSession] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => setInstallPrompt(null);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const recoverSession = React.useCallback(async () => {
    setLoadingAuth(true);
    const storedTerminalSession = getStoredTerminalSession();
    setTerminalSessionSnapshot(storedTerminalSession);

    try {
      const result = await authService.getSessionStatus();
      setSession(result.session);
      if (result.session) {
        setRecoveringTerminalSession(false);
        fetchProfile(result.session.user.id);
      } else if ((result.status === 'recovering' || !navigator.onLine) && storedTerminalSession) {
        setMainView('terminal');
        setRecoveringTerminalSession(true);
        setLoadingAuth(false);
      } else {
        setRecoveringTerminalSession(false);
        setLoadingAuth(false);
      }
    } catch (err) {
      console.error("Initial session check failed:", err);
      if (storedTerminalSession) {
        setMainView('terminal');
        setRecoveringTerminalSession(true);
      }
      setLoadingAuth(false);
    }
  }, []);

  React.useEffect(() => {
    recoverSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      
      if (event === 'PASSWORD_RECOVERY') {
        setShowPasswordResetModal(true);
      }

      if (session) {
        setRecoveringTerminalSession(false);
        fetchProfile(session.user.id);
      } else {
        const storedTerminalSession = getStoredTerminalSession();
        if (storedTerminalSession) {
          setTerminalSessionSnapshot(storedTerminalSession);
          setMainView('terminal');
          setRecoveringTerminalSession(true);
        } else {
          setCurrentUser(null);
          setRecoveringTerminalSession(false);
        }
        setLoadingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [recoverSession]);

  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (recoveringTerminalSession) {
        recoverSession();
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [recoverSession, recoveringTerminalSession]);

  React.useEffect(() => {
    if (!recoveringTerminalSession) return;
    const intervalId = window.setInterval(() => {
      recoverSession();
    }, 20000);
    return () => window.clearInterval(intervalId);
  }, [recoverSession, recoveringTerminalSession]);

  async function fetchProfile(userId: string, options: { showLoading?: boolean } = {}) {
    const showLoading = options.showLoading ?? !currentUser;
    if (showLoading) setLoadingAuth(true);
    try {
      const profile = await authService.getUserProfile(userId);
      setCurrentUser(profile);
      
      // Auto-redirección para el rol terminal
      if (profile?.role === 'terminal') {
        saveStoredTerminalSession(profile);
        setTerminalSessionSnapshot(getStoredTerminalSession());
        setRecoveringTerminalSession(false);
        setMainView('terminal');
      } else {
        clearStoredTerminalSession();
        setTerminalSessionSnapshot(null);
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      if (showLoading) setLoadingAuth(false);
    }
  }

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

 
  // 1. Definición global de permisos por vista
  const viewPermissions: Record<AdminSubView, string[]> = {
    'dashboard': ['VIEW_DASHBOARD'],
    'audit_personnel': ['VIEW_PERSONNEL_AUDIT'],
    'schedule': ['MANAGE_SCHEDULES', 'MANAGE_SECTOR_SCHEDULES'],
    'personnel': ['MANAGE_PERSONNEL', 'VIEW_SECTOR_PERSONNEL'],
    'hr_requests': ['MANAGE_PERSONNEL', 'VIEW_PERSONNEL_AUDIT', 'MANUAL_ATTENDANCE'],
    'audit': ['VIEW_AUDIT_LOGS'],
    'settings': ['MANAGE_SETTINGS'],
    'fraud': ['VIEW_AUDIT_LOGS'],
    'users': ['MANAGE_USERS'],
    'my_credential': ['SELF_VIEW', 'VIEW_DASHBOARD'],
    'terminal': ['MANAGE_TERMINAL'],
    'manual': ['VIEW_DASHBOARD']
  };

  const renderAdminView = () => {
    // 0. Seguridad extrema: si no hay usuario, no renderizamos nada administrativo
    if (!currentUser) return null;

    // 1. Roles y permisos básicos
    const isSuperUser = currentUser?.role === 'superusuario';
    // Mantenemos esta variable genérica para ciertas acciones UI
    const isAdminUser = currentUser?.role === 'superusuario' || currentUser?.role === 'administrador';
    
    // 2. Verificación de permiso para la vista actual
    const requiredPerms = viewPermissions[adminSubView];
    
    let hasAccess = false;
    if (adminSubView === 'settings') {
      hasAccess = isSuperUser;
    } else {
      // Priorizamos la matriz dinámica de permisos si existe
      const hasDynamicPermission = currentUser?.roles?.permissions && 
                                   Array.isArray(currentUser.roles?.permissions) &&
                                   requiredPerms?.some(p => currentUser.roles?.permissions?.includes(p));
      
      hasAccess = isSuperUser || !!hasDynamicPermission;
    }

    // 4. Redirección forzada si no tiene acceso
    if (!hasAccess && adminSubView !== 'my_credential') {
      // Si no tiene acceso a la vista actual, intentamos mostrar su credencial si tiene permiso
      if (currentUser?.roles?.permissions?.includes('SELF_VIEW')) {
        return <MyCredentialView user={currentUser} />;
      }
      // Si ni eso, mostramos su cronograma (segurización máxima)
      return <ScheduleView employees={employees} setEmployees={setEmployees} currentUser={currentUser || { full_name: 'Invitado', role: '' } as any} />;
    }

    // 5. Renderizado seguro de componentes
    switch (adminSubView) {
      case 'dashboard': return <AdminDashboard currentUser={currentUser!} />;
      case 'audit_personnel': return <PersonnelAudit employees={employees} currentUser={currentUser || { full_name: 'Invitado', role: '' } as any} />;
      case 'schedule': return <ScheduleView employees={employees} setEmployees={setEmployees} currentUser={currentUser || { full_name: 'Invitado', role: '' } as any} />;
      case 'personnel': return <PersonnelView employees={employees} setEmployees={setEmployees} currentUser={currentUser || { full_name: 'Invitado', role: '' } as any} />;
      case 'hr_requests': return <HrRequestsView employees={employees} currentUser={currentUser!} />;
      case 'audit': return <AuditView />;
      case 'settings': return <SettingsView currentUser={currentUser || { full_name: 'Invitado', role: '' } as any} />;
      case 'fraud': return <FraudAnalysis />;
      case 'users': return <UserManagementView currentUser={currentUser!} />;
      case 'my_credential': return <MyCredentialView user={currentUser!} />;
      case 'terminal': return (
        <div className="fixed inset-0 z-50 bg-slate-900 border-none">
          <TerminalView 
            onExit={() => isAdminUser ? setMainView('admin') : authService.signOut()} 
            role={currentUser?.role}
          />
        </div>
      );
      case 'manual': return <ManualView />;
      default: return <AdminDashboard currentUser={currentUser!} />;
    }
  };

  if (loadingAuth) {
    return (
      <>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-bold text-sm animate-pulse">Cargando sistema...</p>
          </div>
        </div>
        <FloatingAppActions canInstall={!!installPrompt} onInstall={handleInstallApp} />
      </>
    );
  }

  if (recoveringTerminalSession && !session) {
    return (
      <>
        <TerminalSessionRecovery
          terminalName={terminalSessionSnapshot?.fullName}
          isOnline={isOnline}
          onRetry={recoverSession}
        />
        <FloatingAppActions canInstall={!!installPrompt} onInstall={handleInstallApp} />
      </>
    );
  }

  if (!session) {
    return (
      <>
        <Login onLoginSuccess={setSession} />
        <FloatingAppActions canInstall={!!installPrompt} onInstall={handleInstallApp} />
      </>
    );
  }

  // Check for suspension
  if (currentUser?.is_suspended) {
    return (
      <>
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
      <FloatingAppActions canInstall={!!installPrompt} onInstall={handleInstallApp} />
      </>
    );
  }

  // Check for approval - ONLY isaacgomez78@gmail.com can bypass if state is messy
  if (currentUser?.is_approved === false && currentUser?.email !== 'isaacgomez78@gmail.com') {
    return (
      <>
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
      <FloatingAppActions canInstall={!!installPrompt} onInstall={handleInstallApp} />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden bg-slate-50 relative">
      {/* Mobile Header overlay for toggle */}
      {mainView === 'admin' && currentUser?.role !== 'terminal' && (
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
      {mainView === 'admin' && currentUser?.role !== 'terminal' && (
        <aside className={`bg-slate-900 text-white flex flex-col z-40 shadow-2xl transition-all duration-300 fixed md:relative h-full max-h-screen ${
          isSidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:w-0 md:p-0 md:opacity-0 overflow-hidden'
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
                { id: 'dashboard', label: 'Panel General', icon: BarChart3 },
                { id: 'my_credential', label: 'Mi Credencial (QR)', icon: CreditCard },
                { id: 'schedule', label: 'Cronogramas', icon: Calendar },
                { id: 'personnel', label: 'Personal', icon: Users },
                { id: 'hr_requests', label: 'Solicitudes RRHH', icon: ClipboardCheck },
                { id: 'audit', label: 'Logs de Sistema', icon: History },
                { id: 'audit_personnel', label: 'Auditoría de Personal', icon: Users },
                { id: 'fraud', label: 'Auditoría Automática', icon: ShieldCheck },
                { id: 'users', label: 'Usuarios', icon: UserCog },
                { id: 'settings', label: 'Ajustes', icon: Settings },
              ]
                .filter(item => {
                  const subViewId = item.id as AdminSubView;
                  
                  // Superusuario siempre ve todo
                  if (currentUser?.role === 'superusuario') return true;
                  
                  // Ajustes solo para superusuario
                  if (subViewId === 'settings') return false;

                  // 1. Verificación por matriz dinámica (Prioridad 1)
                  const requiredPerms = viewPermissions[subViewId] || [];
                  if (currentUser?.roles?.permissions && Array.isArray(currentUser.roles?.permissions)) {
                    if (requiredPerms.some(p => currentUser.roles?.permissions?.includes(p))) return true;
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
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all text-left ${
                      adminSubView === item.id 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    {React.createElement(item.icon, { className: `w-5 h-5 shrink-0 ${adminSubView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-white'}` })}
                    <span className="text-left">{item.label}</span>
                  </button>
                ))}
            </nav>

            {(currentUser?.role === 'administrador' || currentUser?.role === 'superusuario' || currentUser?.role === 'terminal') && (
              <div className="space-y-4">
                <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Utilidades</p>
                {currentUser?.role !== 'administrador' && (
                  <button
                    onClick={() => setMainView('terminal')}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3.5 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white border border-emerald-500/20 rounded-2xl text-xs font-black transition-all"
                  >
                    <ScanLine className="w-4 h-4" />
                    <span>MODO TERMINAL</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setAdminSubView('manual');
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-center space-x-2 px-4 py-3.5 border rounded-2xl text-xs font-black transition-all ${
                    adminSubView === 'manual'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20'
                      : 'bg-slate-800/30 hover:bg-slate-800 text-slate-400 hover:text-white border-slate-700/50'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>MANUAL DE USUARIO</span>
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
          }} role={currentUser?.role} />
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
      <FloatingAppActions canInstall={!!installPrompt} onInstall={handleInstallApp} />
    </div>
  );
};

export default App;
