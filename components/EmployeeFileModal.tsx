import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  History, 
  FileText, 
  Camera, 
  Plus, 
  CreditCard, 
  Save, 
  AlertCircle,
  ShieldAlert,
  Clock,
  User,
  Search,
  UploadCloud,
  ChevronRight
} from 'lucide-react';
import { compensatoryRestService } from '../services/compensatoryRestService';
import { attendanceService } from '../services/attendanceService';
import { auditService } from '../services/auditService';
import { supabase } from '../services/supabaseClient';
import { Profile, CompensatoryRestLog, AttendanceRecord, EmployeeDocument } from '../types';

interface EmployeeFileModalProps {
  employeeId: string;
  managerName: string;
  managerRole?: string;
  onClose: () => void;
}

const EmployeeFileModal: React.FC<EmployeeFileModalProps> = ({ employeeId, managerName, managerRole = 'encargado', onClose }) => {
  const [employee, setEmployee] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'francos' | 'docs' | 'audit'>('stats');
  const [loading, setLoading] = useState(true);
  
  // Date Range for stats
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Data states
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, lateMinutes: 0, medical: 0, suspension: 0 });
  const [restLogs, setRestLogs] = useState<CompensatoryRestLog[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [scoring, setScoring] = useState<{score: number, label: string, color: string} | null>(null);
  
  // Actions states
  const [amount, setAmount] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (managerRole === 'encargado') {
      setActiveTab('francos');
    }
    fetchInitialData();
  }, [employeeId]);

  useEffect(() => {
    if (employeeId && dateRange.start && dateRange.end) {
      fetchStats();
    }
  }, [employeeId, dateRange]);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: empData } = await supabase.from('profiles').select('*').eq('id', employeeId).single();
    setEmployee(empData);
    
    const [logs, docs, score] = await Promise.all([
      compensatoryRestService.getLogs(employeeId),
      supabase.from('employee_documents').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false }),
      attendanceService.calculateScoring(employeeId)
    ]);
    
    setRestLogs(logs);
    setDocuments(docs.data || []);
    setScoring(score);
    setLoading(false);
  };

  const fetchStats = async () => {
    const records = await attendanceService.getAll();
    const empRecords = records.filter(r => 
      r.employee_id === employeeId && 
      r.date >= dateRange.start && 
      r.date <= dateRange.end
    );

    const s = {
      present: empRecords.filter(r => ['presente', 'en_horario', 'manual'].includes(r.status)).length,
      absent: empRecords.filter(r => r.status === 'ausente').length,
      late: empRecords.filter(r => r.status === 'tarde' || r.status === 'sin_presentismo').length,
      lateMinutes: empRecords.reduce((acc, r) => acc + (r.minutes_late || 0), 0),
      medical: empRecords.filter(r => r.status === 'licencia_medica').length,
      suspension: empRecords.filter(r => r.status === 'suspendido').length,
    };
    setStats(s);
  };

  const handleRestAction = async (type: 'credit' | 'payment' | 'adjustment') => {
    if (!reason.trim()) return alert('Indica un motivo');
    setSaving(true);
    let success = false;
    
    if (type === 'credit') {
      success = await compensatoryRestService.addLog({ employee_id: employeeId, amount: Math.abs(amount), type: 'credit', reason, manager_name: managerName });
    } else if (type === 'payment') {
      success = await compensatoryRestService.payRestDays(employeeId, amount, managerName, reason);
    } else if (type === 'adjustment') {
      success = await compensatoryRestService.adjustBalance(employeeId, amount, managerName, reason);
    }

    if (success) {
      setReason(''); setAmount(1);
      const updatedLogs = await compensatoryRestService.getLogs(employeeId);
      setRestLogs(updatedLogs);
      // Update local employee balance
      const balance = await compensatoryRestService.getBalance(employeeId);
      setEmployee(prev => prev ? { ...prev, compensatory_rest_balance: balance } : null);
    }
    setSaving(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${employeeId}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('employee-documents')
      .upload(fileName, file);

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('employee-documents').getPublicUrl(fileName);
      await supabase.from('employee_documents').insert([{
        employee_id: employeeId,
        type: 'other',
        file_url: publicUrl,
        file_name: file.name,
        description: reason || 'Documento cargado'
      }]);
      
      const { data: newDocs } = await supabase.from('employee_documents').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false });
      setDocuments(newDocs || []);
      setReason('');
    }
    setUploading(false);
  };

  if (!employee) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[3rem] w-full max-w-5xl h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 text-white">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-[2rem] bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-center overflow-hidden shadow-2xl">
                {employee.photo_url ? (
                  <img src={employee.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-white/50" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md">Legajo Digital</span>
                  <span className="px-3 py-1 bg-emerald-400/20 text-emerald-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-400/30">Activo</span>
                </div>
                <h2 className="text-4xl font-black tracking-tight">{employee.full_name}</h2>
                <div className="flex items-center gap-4 mt-2 text-indigo-100 font-bold text-sm">
                  <span className="flex items-center gap-1"><FileText className="w-4 h-4" /> DNI: {employee.dni}</span>
                  <span className="w-1 h-1 bg-white/30 rounded-full" />
                  <span>{employee.role?.toUpperCase()}</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-4">
              <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-all">
                <X className="w-8 h-8 text-white" />
              </button>
            <div className="flex items-center gap-3">
              {scoring && managerRole !== 'encargado' && (
                <div className={`backdrop-blur-xl p-4 rounded-3xl border text-right min-w-[140px] shadow-xl ${scoring.color}`}>
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-70">Scoring Actual</p>
                  <p className="text-4xl font-black">{scoring.score}</p>
                  <p className="text-[8px] font-black uppercase tracking-tighter mt-1 opacity-80">{scoring.label}</p>
                </div>
              )}
              <div className="bg-white/10 backdrop-blur-xl p-4 rounded-3xl border border-white/20 text-right min-w-[140px]">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70 text-white">Saldo de Francos</p>
                <p className="text-4xl font-black text-white">{employee.compensatory_rest_balance || 0} <span className="text-sm opacity-50 text-white/50">Días</span></p>
              </div>
            </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 px-8 bg-slate-50/50">
          {[
            { id: 'stats', label: 'Estadísticas', icon: TrendingUp, hidden: managerRole === 'encargado' },
            { id: 'francos', label: 'Banco de Francos', icon: CreditCard },
            { id: 'docs', label: 'Documentos/Fotos', icon: Camera, hidden: managerRole === 'encargado' },
          ].filter(t => !t.hidden).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-5 text-xs font-black uppercase tracking-widest transition-all border-b-4 ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
          
          {activeTab === 'stats' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              {/* Range Selector */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="w-6 h-6 text-indigo-600" />
                  <span className="font-black text-slate-700 uppercase text-xs tracking-widest">Rango de Análisis</span>
                </div>
                <div className="flex items-center gap-4">
                  <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-600 focus:outline-none focus:ring-2 ring-indigo-500/20" />
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                  <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-600 focus:outline-none focus:ring-2 ring-indigo-500/20" />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Asistencias', val: stats.present, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Ausencias', val: stats.absent, color: 'text-rose-600', bg: 'bg-rose-50' },
                  { label: 'Tardanzas', val: stats.late, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Minutos Tarde', val: stats.lateMinutes, color: 'text-orange-600', bg: 'bg-orange-50' },
                  { label: 'L. Médicas', val: stats.medical, color: 'text-sky-600', bg: 'bg-sky-50' },
                  { label: 'Suspensiones', val: stats.suspension, color: 'text-slate-700', bg: 'bg-slate-100' },
                ].map(s => (
                  <div key={s.label} className={`p-6 rounded-[2rem] border border-slate-100 ${s.bg} flex flex-col items-center justify-center text-center`}>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{s.label}</p>
                    <p className={`text-3xl font-black ${s.color}`}>{s.val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'francos' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-2">
              {managerRole !== 'encargado' ? (
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                    <h3 className="text-xl font-black text-slate-800">Carga / Ajuste</h3>
                    <div className="space-y-4">
                      <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-2xl text-center" />
                      <textarea placeholder="Motivo (ej: Domingos trabajados Marzo)" value={reason} onChange={e => setReason(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm h-24" />
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleRestAction('credit')} disabled={saving} className="py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 shadow-lg shadow-emerald-500/20">Sumar Día</button>
                        <button onClick={() => handleRestAction('payment')} disabled={saving} className="py-4 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-600 shadow-lg shadow-amber-500/20">Liquidar Pago</button>
                      </div>
                      <button onClick={() => handleRestAction('adjustment')} disabled={saving} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black">Ajuste Manual Saldo</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="lg:col-span-1">
                  <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100">
                    <p className="text-xs font-bold text-indigo-700 leading-relaxed">
                      Como <strong>Encargado/a</strong>, tienes acceso de solo lectura a este saldo. Contacta a un Administrador para realizar ajustes manuales.
                    </p>
                  </div>
                </div>
              )}
              
              <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className="p-8 border-b border-slate-50 flex items-center gap-3">
                  <History className="w-6 h-6 text-indigo-600" />
                  <h3 className="text-xl font-black text-slate-800">Movimientos Recientes</h3>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto max-h-[400px]">
                  {restLogs.map(log => (
                    <div key={log.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${log.amount > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                          {log.amount > 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-black text-slate-700 text-sm leading-tight">{log.reason}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                            {new Date(log.created_at).toLocaleDateString()} • Por: {log.manager_name}
                          </p>
                        </div>
                      </div>
                      <div className={`text-xl font-black ${log.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {log.amount > 0 ? `+${log.amount}` : log.amount}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'docs' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Upload Card */}
                <div className="bg-white p-8 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center gap-4 hover:border-indigo-300 transition-all group">
                  <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-all">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="font-black text-slate-700">Subir Documento</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Fotos de certificados o sanciones</p>
                  </div>
                  <input type="file" onChange={handleFileUpload} className="hidden" id="file-upload" />
                  <label htmlFor="file-upload" className="cursor-pointer px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-500/20">
                    {uploading ? 'Subiendo...' : 'Seleccionar Archivo'}
                  </label>
                </div>

                {/* Docs Gallery */}
                {documents.map(doc => (
                  <div key={doc.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden group">
                    <div className="aspect-video bg-slate-200 overflow-hidden relative">
                      <img src={doc.file_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                        <a href={doc.file_url} target="_blank" className="px-4 py-2 bg-white text-slate-800 rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl">Ver Completo</a>
                      </div>
                    </div>
                    <div className="p-6">
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">{new Date(doc.created_at).toLocaleDateString()}</p>
                      <p className="font-black text-slate-700 truncate">{doc.file_name}</p>
                      <p className="text-xs text-slate-400 font-medium mt-1">{doc.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center px-12">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">SecureQR HR Management • Confidential</p>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Sincronizado con Supabase Cloud</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EmployeeFileModal;
