import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  BrainCircuit, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Fingerprint
} from 'lucide-react';
import { fraudService } from '../services/fraudService';
import { FraudReport } from '../types';

const FraudAnalysis: React.FC = () => {
  const [report, setReport] = useState<FraudReport | null>(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    const result = await fraudService.analyzeRecentAttendance();
    setReport(result);
    setLoading(false);
  };

  // Eliminamos el autostart para dar control al usuario
  useEffect(() => {
    // Solo mostramos el estado inicial
  }, []);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'alto': return 'text-red-500 bg-red-50 border-red-100';
      case 'medio': return 'text-amber-500 bg-amber-50 border-amber-100';
      default: return 'text-emerald-500 bg-emerald-50 border-emerald-100';
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight flex items-center">
            Análisis de <span className="ml-2 text-indigo-600">Fraude IA</span>
          </h2>
          <p className="text-slate-500 font-medium">Detección de anomalías mediante inteligencia artificial generativa.</p>
        </div>

        <button
          onClick={runAnalysis}
          disabled={loading}
          className="flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Analizando...' : 'Nuevo Análisis'}</span>
        </button>
      </header>

      {loading ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-20 flex flex-col items-center justify-center space-y-6 text-center shadow-sm">
          <div className="relative">
            <div className="w-24 h-24 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <BrainCircuit className="w-10 h-10 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-800">Procesando Registros</h3>
            <p className="text-slate-500 max-w-sm">Gemini está analizando patrones de comportamiento y detectando inconsistencias...</p>
          </div>
        </div>
      ) : report ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Risk Card */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`p-4 rounded-2xl ${getRiskColor(report.risk_level)}`}>
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Nivel de Riesgo Global</p>
                    <h3 className={`text-3xl font-black uppercase ${report.risk_level === 'alto' ? 'text-red-600' : report.risk_level === 'medio' ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {report.risk_level}
                    </h3>
                  </div>
                </div>
                <div className="hidden md:block">
                  <Fingerprint className="w-12 h-12 text-slate-100" />
                </div>
              </div>

              <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                <p className="text-slate-700 font-medium leading-relaxed">
                  {report.summary}
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />
                  Anomalías Detectadas
                </h4>
                <div className="grid gap-3">
                  {report.anomalies.map((anomaly, i) => (
                    <div key={i} className="flex items-start space-x-3 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-indigo-100 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-indigo-400 mt-2 flex-shrink-0"></div>
                      <p className="text-sm font-bold text-slate-700">{anomaly}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations Side Bar */}
          <div className="space-y-8">
            <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-600/20 relative overflow-hidden group">
              <div className="relative z-10 space-y-6">
                <h4 className="text-sm font-black text-indigo-200 uppercase tracking-widest flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Recomendaciones
                </h4>
                <div className="space-y-4">
                  {report.recommendations.map((rec, i) => (
                    <div key={i} className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 group-hover:bg-white/20 transition-colors">
                      <p className="text-sm font-bold leading-snug">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
              <BrainCircuit className="w-40 h-40 text-white/5 absolute -bottom-10 -right-10 rotate-12" />
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Tendencia de Integridad</h4>
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                                <TrendingUp className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-bold text-slate-700">Auditados</span>
                        </div>
                        <span className="text-sm font-black text-slate-800">100%</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-red-100 rounded-lg text-red-600">
                                <TrendingDown className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-bold text-slate-700">Falsos Positivos</span>
                        </div>
                        <span className="text-sm font-black text-slate-800">1.2%</span>
                    </div>
                    <div className="pt-4 border-t border-slate-50">
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-indigo-600 h-full w-[94%]" />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 text-center">Precisión del Modelo: 94%</p>
                    </div>
                </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-20 flex flex-col items-center justify-center space-y-8 text-center shadow-sm max-w-2xl mx-auto mt-10 animate-in zoom-in duration-500">
          <div className="p-8 bg-indigo-50 rounded-full">
            <ShieldAlert className="w-16 h-16 text-indigo-400 opacity-60" />
          </div>
          <div className="space-y-4">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Listo para Auditar</h3>
            <p className="text-slate-500">
              El análisis cruzado de IA revisará los últimos 100 fichajes y los cambios manuales en el sistema para detectar inconsistencias. Pulse el botón para comenzar.
            </p>
          </div>
          <button
            onClick={runAnalysis}
            className="flex items-center space-x-3 px-10 py-5 bg-indigo-600 text-white rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/30 active:scale-95"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Comenzar Análisis IA</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default FraudAnalysis;
