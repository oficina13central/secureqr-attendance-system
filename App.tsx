import React, { useState } from 'react';
import {
  Users,
  Calendar,
  ShieldCheck,
  BarChart3,
  LogOut,
  ScanLine,
  Settings,
  History
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
import { Profile } from './types';
import { personnelService } from './services/personnelService';
import { authService } from './services/authService';
import { supabase } from './services/supabaseClient';
import Login from './components/Login';
import { Session } from '@supabase/supabase-js';

type AdminSubView = 'dashboard' | 'schedule' | 'personnel' | 'audit' | 'audit_personnel' | 'settings' | 'fraud';

const App: React.FC = () => {
  const [mainView, setMainView] = useState<'terminal' | 'admin'>('admin');
  const [adminSubView, setAdminSubView] = useState<AdminSubView>('dashboard');
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
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

  const renderAdminView = () => {
    // Si no tiene permisos para ver dashboard y no es admin/super, mostrar vista de empleado
    const hasDashboardAccess = currentUser?.role === 'superusuario' || currentUser?.role === 'administrador' || currentUser?.roles?.permissions?.includes('VIEW_DASHBOARD');

    if (!hasDashboardAccess && currentUser) {
      return (
        <div className="p-8 flex flex-col items-center justify-center h-full text-slate-500">
          <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center text-center max-w-md">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-xl font-black text-slate-800 mb-2">Acceso Limitado</h2>
            <p className="text-sm mb-6">Su cuenta de empleado está activa, pero no tiene permisos administrativos.</p>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-500">
              {currentUser.full_name}
            </p>
          </div>
        </div>
      );
    }

    switch (adminSubView) {
      case 'dashboard': return <AdminDashboard />;
      case 'audit_personnel': return <PersonnelAudit employees={employees} currentUser={currentUser || { full_name: 'Invitado', role: '' } as any} />;
      case 'schedule': return <ScheduleView employees={employees} currentUser={currentUser || { full_name: 'Invitado', role: '' } as any} />;
      case 'personnel': return <PersonnelView employees={employees} setEmployees={setEmployees} currentUser={currentUser || { full_name: 'Invitado', role: '' } as any} />;
      case 'audit': return <AuditView />;
      case 'settings': return <SettingsView currentUser={currentUser || { full_name: 'Invitado', role: '' } as any} />;
      case 'fraud': return <FraudAnalysis />;
      default: return <AdminDashboard />;
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

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden bg-slate-50">
      {/* Sidebar Navigation */}
      {mainView === 'admin' && (
        <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col p-4 space-y-8 z-30 shadow-2xl">
          <div className="flex items-center space-x-3 px-2">
            <div className="bg-indigo-500 p-2 rounded-xl shadow-lg shadow-indigo-500/30">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight">Control de Asistencias</span>
          </div>

          <nav className="flex-1 space-y-1">
            {[
              { id: 'dashboard', label: 'Panel General', icon: BarChart3, permission: 'VIEW_DASHBOARD' },
              { id: 'schedule', label: 'Cronogramas', icon: Calendar, permission: 'MANAGE_SCHEDULES' },
              { id: 'personnel', label: 'Personal', icon: Users, permission: 'MANAGE_PERSONNEL' },
              { id: 'audit', label: 'Logs de Sistema', icon: History, permission: 'VIEW_AUDIT_LOGS' },
              { id: 'audit_personnel', label: 'Auditoría de Personal', icon: Users, permission: 'VIEW_PERSONNEL_AUDIT' },
              { id: 'fraud', label: 'Análisis de Fraude', icon: ShieldCheck, permission: 'VIEW_AUDIT_LOGS' },
              { id: 'settings', label: 'Ajustes', icon: Settings, permission: 'MANAGE_SETTINGS' },
            ]
              .filter(item => {
                // Si es superusuario, ve todo
                if (currentUser?.role === 'superusuario') return true;
                // Si tiene lista de permisos explícita
                if (currentUser?.roles?.permissions && Array.isArray(currentUser.roles.permissions)) {
                  return currentUser.roles.permissions.includes(item.permission);
                }
                // Fallback básico por roles si no cargó permisos (e.g. durante migración o error)
                if (currentUser?.role === 'administrador') return true;
                // Empleados regulares solo ven cronograma? O nada? Por defecto nada de admin.
                return false;
              })
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => setAdminSubView(item.id as AdminSubView)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${adminSubView === item.id ? 'bg-indigo-600 shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                >
                  {React.createElement(item.icon, { className: "w-5 h-5" })}
                  <span>{item.label}</span>
                </button>
              ))}
          </nav>

          {(currentUser?.role === 'administrador' || currentUser?.role === 'superusuario' || currentUser?.role === 'encargado') && (
            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={() => setMainView('terminal')}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-black transition-all shadow-lg shadow-emerald-500/20"
              >
                <ScanLine className="w-5 h-5" />
                <span>MODO TERMINAL</span>
              </button>
            </div>
          )}

          <div className="flex items-center space-x-3 bg-slate-800/50 p-3 rounded-2xl relative group">
            <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center font-black text-white shadow-inner">
              {currentUser?.full_name?.charAt(0) || session?.user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold truncate">{currentUser?.full_name || session?.user?.email?.split('@')[0]}</p>
              <p className="text-[10px] text-indigo-400 uppercase tracking-widest font-black">
                {currentUser?.roles?.name || currentUser?.role || 'Sin Asignar'}
              </p>
            </div>
            <button
              onClick={() => {
                authService.signOut();
                setSession(null);
                setCurrentUser(null);
              }}
              className="absolute right-2 p-2 bg-slate-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 text-white"
              title="Cerrar Sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        {mainView === 'admin' ? (
          renderAdminView()
        ) : (
          <TerminalView onExit={() => setMainView('admin')} />
        )}
      </main>
    </div>
  );
};

export default App;
