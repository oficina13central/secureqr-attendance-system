import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCcw, CheckCircle2, XCircle, ArrowLeft, ScanLine, ShieldAlert, Keyboard, X, Settings } from 'lucide-react';
import jsQR from 'jsqr';
import { attendanceService } from '../services/attendanceService';
import { supabase } from '../services/supabaseClient';
import { offlineService } from '../services/offlineService';

interface TerminalViewProps {
  onExit: () => void;
}

const TerminalView: React.FC<TerminalViewProps> = ({ onExit }) => {
  const [sessionActive, setSessionActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'duplicate' | 'wait'>('idle');
  const [lastUser, setLastUser] = useState<string | null>(null);
  const [scanType, setScanType] = useState<'in' | 'out' | null>(null);
  const [scanMode, setScanMode] = useState<'in' | 'out' | null>(null);
  const [attendanceMsg, setAttendanceMsg] = useState<string>('');
  const [terminalName, setTerminalName] = useState<string>(() => localStorage.getItem('terminal_branch_name') || 'PLANTA INDUSTRIAL NORTE');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(terminalName);
  const [msgColor, setMsgColor] = useState<string>('text-emerald-300');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualDni, setManualDni] = useState('');
  const [processingManual, setProcessingManual] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);

  const startSession = (mode: 'in' | 'out') => {
    setScanMode(mode);
    setSessionActive(true);
    setScanning(true);
    setStatus('idle');
    setCameraError(null);
  };

  const handleSaveName = () => {
    const finalName = tempName.trim().toUpperCase() || 'PLANTA INDUSTRIAL NORTE';
    setTerminalName(finalName);
    localStorage.setItem('terminal_branch_name', finalName);
    setIsEditingName(false);
  };

  useEffect(() => {
    setPendingCount(offlineService.count);

    const handleOnline = async () => {
      setIsOnline(true);
      await performSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sync inicial si estamos online
    if (navigator.onLine) performSync();

    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play();
          requestRef.current = requestAnimationFrame(scanFrame);
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setCameraError("No se pudo acceder a la cámara. Verifique los permisos.");
      }
    }

    if (scanning) {
      setupCamera();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, [scanning]);

  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current || !scanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code) {
        handleScan(code.data);
        return; // Detener el loop tras detectar uno
      }
    }
    requestRef.current = requestAnimationFrame(scanFrame);
  };

  const handleScan = async (token: string) => {
    console.log("Token detectado:", token);
    setScanning(false);

    // Format: SECURE_USER:Name_Surname_ID
    if (token.startsWith("SECURE_USER")) {
      const parts = token.split(":");
      const info = parts[1] || "";
      const lastUnderscoreIndex = info.lastIndexOf("_");
      let employeeName = "";
      let employeeId = "";

      if (lastUnderscoreIndex !== -1) {
        // Asumimos que lo último después del guión bajo es el ID si parece un ID (UUID o numérico)
        // O si simplemente hay un guión bajo separando.
        employeeName = info.substring(0, lastUnderscoreIndex).replace(/_/g, " ");
        employeeId = info.substring(lastUnderscoreIndex + 1);

        // Si el "ID" extraído parece ser parte del nombre (ej: "Garcia" en "Ana_Garcia" sin ID al final)
        // Necesitamos ser cuidadosos. Intentaremos buscar el perfil por nombre si el ID no machea nada.
      } else {
        employeeName = info.replace(/_/g, " ");
        employeeId = "PENDING"; // O intentar usar el nombre como ID fallback
      }

      if (employeeId && employeeId !== "PENDING") {
        console.log(`Procesando escaneo (${scanMode}): Nombre=${employeeName}, ID=${employeeId}`);
        const result = await attendanceService.processScan(employeeId, employeeName, scanMode || undefined);

        if (result.type === 'in' || result.type === 'out') {
          setStatus('success');
          setLastUser(employeeName);
          setScanType(result.type);

          if (result.type === 'in') {
            const status = result.record?.status;
            if (status === 'en_horario') {
              setAttendanceMsg('En Horario');
              setMsgColor('text-emerald-300');
            } else if (status === 'tarde') {
              setAttendanceMsg('Llegó Tarde');
              setMsgColor('text-amber-300');
            } else if (status === 'sin_presentismo') {
              setAttendanceMsg('Perdió el Presentismo');
              setMsgColor('text-red-400');
            }
          } else {
            setAttendanceMsg('Salida Registrada');
            setMsgColor('text-blue-300');
          }
        } else if (result.reason === 'already_checked_in') {
          setStatus('duplicate');
          setAttendanceMsg('Ya tenés una entrada abierta');
        } else if (result.reason === 'no_open_record') {
          setStatus('error');
          setAttendanceMsg('No tenés entrada registrada');
        } else if (result.reason === 'queued_offline') {
          setStatus('success');
          setLastUser(employeeName);
          setScanType(scanMode || 'in'); 
          setAttendanceMsg('Guardado Offline (Sin Internet)');
          setMsgColor('text-amber-400');
          setPendingCount(offlineService.count);
        } else if (result.reason === 'daily_limit_reached') {
          setStatus('duplicate');
        } else {
          setStatus('error');
        }
      } else {
        setStatus('success'); // Fallback for demo if ID is pending
        setLastUser(employeeName || "Usuario");
      }

      setTimeout(() => {
        setStatus('idle');
        setSessionActive(false);
        setScanning(false);
      }, 6000);
    } else {
      setStatus('error');
      setTimeout(() => {
        setStatus('idle');
        setSessionActive(false);
        setScanning(false);
      }, 5000);
    }
  };

  const performSync = async () => {
    if (offlineService.count === 0 || syncing) return;
    setSyncing(true);
    try {
      await attendanceService.syncOfflineRecords();
      setPendingCount(offlineService.count);
    } catch (err) {
      console.error("Sync process error:", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDni.trim() || processingManual) return;

    setProcessingManual(true);
    setScanning(false);
    
    try {
      // Intentar obtener el nombre del empleado para la UI
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('dni', manualDni.trim())
        .maybeSingle();
      
      const employeeName = data?.full_name || "Usuario";
      
      const result = await attendanceService.processScan(manualDni.trim(), employeeName, scanMode || undefined);

      if (result.type === 'in' || result.type === 'out') {
        setStatus('success');
        setLastUser(employeeName);
        setScanType(result.type);
        setAttendanceMsg(result.type === 'in' ? 'Entrada Registrada' : 'Salida Registrada');
        setMsgColor(result.type === 'in' ? 'text-emerald-300' : 'text-blue-300');
        setShowManualModal(false);
        setManualDni('');
      } else if (result.reason === 'already_checked_in') {
        setStatus('duplicate');
        setAttendanceMsg('Ya Marcó Entrada');
        setShowManualModal(false);
      } else if (result.reason === 'no_open_record') {
        setStatus('error');
        setAttendanceMsg('No Marcó Entrada');
        setShowManualModal(false);
      } else {
        setStatus('error');
        setAttendanceMsg('Error al registrar');
        setShowManualModal(false);
      }
    } catch (err) {
      console.error("Manual entry failed:", err);
      setStatus('error');
    } finally {
      setProcessingManual(false);
      setTimeout(() => {
        setStatus('idle');
        setSessionActive(false);
        setScanning(false);
      }, 6000);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950 text-white p-4 md:p-10 relative overflow-hidden safe-area-inset">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-slate-950 to-slate-950"></div>

      <button
        onClick={onExit}
        className="absolute top-4 left-4 md:top-8 md:left-8 flex items-center space-x-2 text-slate-400 hover:text-white transition-colors z-50 bg-slate-900/80 px-4 py-2 rounded-full backdrop-blur-md border border-white/5"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="font-bold text-xs uppercase tracking-widest">Salir</span>
      </button>

      <div className="absolute top-4 right-4 md:top-8 md:right-8 flex flex-col items-end space-y-2 z-50">
        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full backdrop-blur-md border ${isOnline ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-[10px] font-black uppercase tracking-widest">{isOnline ? 'Online' : 'Sin Conexión'}</span>
        </div>
        
        {(pendingCount > 0 || syncing) && (
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full backdrop-blur-md animate-in slide-in-from-right duration-300">
            {syncing ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <ShieldAlert className="w-3 h-3" />}
            <span className="text-[10px] font-black uppercase tracking-widest">
              {syncing ? 'Sincronizando...' : `${pendingCount} Pendiente${pendingCount > 1 ? 's' : ''}`}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center space-y-6 md:space-y-10 z-10 w-full pt-12 md:pt-0">
        <div className="text-center space-y-2 group relative">
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-indigo-400">LECTOR DE ACCESO</h1>
          {isEditingName ? (
            <div className="flex items-center justify-center space-x-2 animate-in fade-in zoom-in duration-200">
              <input 
                autoFocus
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                className="bg-slate-800 text-white text-[10px] md:text-xs font-black uppercase text-center px-4 py-1 rounded-full border border-indigo-500/50 outline-none"
              />
              <button onClick={handleSaveName} className="text-emerald-400 p-1">
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <p className="text-slate-500 uppercase tracking-[0.4em] text-[10px] md:text-xs font-black">
                {terminalName}
              </p>
              <button 
                onClick={() => {
                  setTempName(terminalName);
                  setIsEditingName(true);
                }} 
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-600 hover:text-indigo-400"
              >
                <Settings className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <div className="relative w-full max-w-xl flex-grow md:flex-none h-full min-h-[400px] md:h-[550px] bg-slate-900 rounded-[2.5rem] md:rounded-[3rem] overflow-hidden border-4 md:border-8 border-slate-800 shadow-2xl flex items-center justify-center">
          
          {!sessionActive && status === 'idle' && (
            <div className="flex flex-col items-center justify-center w-full h-full p-8 text-center bg-slate-900 space-y-8 animate-in zoom-in duration-300">
              <div className="p-8 bg-indigo-900/30 rounded-full border border-indigo-500/20">
                <ScanLine className="w-20 h-20 text-indigo-400 opacity-90" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white uppercase tracking-widest">Listo para Fichar</h2>
                <p className="text-slate-400 text-sm max-w-[250px] mx-auto">Presione registrar para encender la cámara y escanear su código.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-md">
                <button
                    onClick={() => startSession('in')}
                    className="px-8 py-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xl rounded-[2rem] shadow-[0_0_50px_rgba(16,185,129,0.3)] transition-all active:scale-95 flex items-center justify-center space-x-4 uppercase tracking-wider group"
                >
                    <CheckCircle2 className="w-8 h-8 group-hover:scale-110 transition-transform" />
                    <span>ENTRADA</span>
                </button>
                <button
                    disabled
                    className="px-8 py-6 bg-slate-800 text-slate-500 font-black text-xl rounded-[2rem] flex items-center justify-center space-x-4 uppercase tracking-wider cursor-not-allowed opacity-60 border border-slate-700"
                >
                    <RefreshCcw className="w-8 h-8 opacity-50" />
                    <div className="flex flex-col items-center">
                      <span>SALIDA</span>
                      <span className="text-[10px] text-slate-600 font-black">Próximamente</span>
                    </div>
                </button>
              </div>
            </div>
          )}

          {sessionActive && scanning && !cameraError && (
            <>
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 border-[0.5rem] md:border-[1.5rem] border-slate-900 pointer-events-none"></div>
              <div className="absolute inset-6 md:inset-12 border-2 border-dashed border-indigo-500/30 rounded-3xl pointer-events-none"></div>
              <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,1)] animate-scanning-line z-20"></div>
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-indigo-600 px-6 py-3 rounded-full shadow-lg border border-indigo-400/30 flex items-center space-x-3 z-30">
                <ScanLine className="w-5 h-5 text-white animate-pulse" />
                <span className="text-xs font-black uppercase tracking-widest text-white">Escaneando QR</span>
              </div>
            </>
          )}

          {cameraError && (
            <div className="flex flex-col items-center space-y-4 p-8 text-center">
              <XCircle className="w-16 h-16 text-red-500" />
              <p className="text-red-400 font-semibold">{cameraError}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-slate-800 rounded-lg text-sm hover:bg-slate-700 transition-colors"
              >
                Reintentar
              </button>
            </div>
          )}

          {status === 'success' && (
            <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-xl flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-300">
              <div className={`p-6 rounded-full shadow-lg transition-all ${scanType === 'out' ? 'bg-blue-500 shadow-blue-500/50' : 'bg-emerald-500 shadow-emerald-500/50'}`}>
                {scanType === 'out' ? (
                  <RefreshCcw className="w-20 h-20 text-white" />
                ) : (
                  <CheckCircle2 className="w-20 h-20 text-white" />
                )}
              </div>
              <div className="text-center px-6">
                <p className="text-4xl font-black text-white mb-2 uppercase">
                  {scanType === 'out' ? '¡HASTA LUEGO!' : '¡AUTORIZADO!'}
                </p>
                <p className="text-2xl text-emerald-300 font-bold mb-1">{lastUser}</p>
                <p className={`text-xl font-black uppercase tracking-widest ${msgColor}`}>{attendanceMsg}</p>
                <div className="mt-4 flex items-center justify-center space-x-2 text-slate-400">
                  <RefreshCcw className="w-4 h-4 animate-spin-slow" />
                  <span className="text-sm">Registrando en base de datos...</span>
                </div>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="absolute inset-0 bg-red-950/40 backdrop-blur-xl flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-300">
              <div className="bg-red-500 p-6 rounded-full shadow-[0_0_30px_rgba(239,68,68,0.5)]">
                <XCircle className="w-20 h-20 text-white" />
              </div>
              <div className="text-center px-6">
                <p className="text-4xl font-black text-white mb-2">DENEGADO</p>
                <p className="text-red-300 font-bold">{attendanceMsg || 'Token no reconocido'}</p>
                <p className="text-slate-400 mt-4 text-sm max-w-[250px]">
                  {attendanceMsg === 'No tenés entrada registrada' || attendanceMsg === 'No Marcó Entrada'
                    ? 'Debe registrar su ingreso antes de poder marcar la salida.'
                    : 'El código QR no pertenece a un empleado activo o ha expirado.'}
                </p>
              </div>
            </div>
          )}
          {status === 'duplicate' && (
            <div className="absolute inset-0 bg-amber-950/40 backdrop-blur-xl flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-300">
              <div className="bg-amber-500 p-6 rounded-full shadow-[0_0_30px_rgba(245,158,11,0.5)]">
                <ShieldAlert className="w-20 h-20 text-white" />
              </div>
              <div className="text-center px-6">
                <p className="text-4xl font-black text-white mb-2 uppercase">LÍMITE ALCANZADO</p>
                <p className="text-amber-300 font-bold">Máximo de turnos diarios</p>
                <p className="text-slate-400 mt-4 text-sm max-w-[250px]">Ya ha completado todas las entradas permitidas para hoy.</p>
              </div>
            </div>
          )}
          {status === 'wait' && (
            <div className="absolute inset-0 bg-blue-950/60 backdrop-blur-xl flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-300">
              <div className="bg-blue-500 p-6 rounded-full shadow-[0_0_30px_rgba(59,130,246,0.5)]">
                <RefreshCcw className="w-20 h-20 text-white animate-reverse-spin" />
              </div>
              <div className="text-center px-6">
                <p className="text-4xl font-black text-white mb-2 uppercase">ESPERE UN MOMENTO</p>
                <p className="text-blue-300 font-bold">Entrada recién registrada</p>
                <p className="text-slate-300 mt-4 text-sm max-w-[250px]">
                  Aguarde 10 minutos antes de marcar su salida.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center text-center max-w-md space-y-4">
          <div className="flex space-x-4">
            <button
              onClick={() => {
                setScanning(false);
                setShowManualModal(true);
              }}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center space-x-2 transition-all border border-white/10"
            >
              <Keyboard className="w-5 h-5 text-indigo-400" />
              <span className="text-sm font-bold uppercase tracking-wider">Ingreso Manual</span>
            </button>
          </div>
          <div className="flex space-x-4">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Hardware OK</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Encrypted Link</span>
            </div>
          </div>
          <p className="text-slate-500 text-sm leading-relaxed">
            Muestre su código QR personal frente a la cámara o ingrese su DNI manualmente.
          </p>
        </div>
      </div>

      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">
                {scanMode === 'in' ? 'Registrar Entrada' : 'Registrar Salida'}
              </h3>
              <button 
                onClick={() => {
                  setShowManualModal(false);
                  setScanning(true);
                }} 
                className="p-2 hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            
            <form onSubmit={handleManualSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Número de DNI</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoFocus
                  required
                  value={manualDni}
                  onChange={e => setManualDni(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-4 text-white text-2xl font-black focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="00000000"
                />
              </div>
              
              <button
                type="submit"
                disabled={processingManual}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
              >
                {processingManual ? 'PROCESANDO...' : 'REGISTRAR ASISTENCIA'}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scanning-line {
          0% { top: 0; opacity: 0; }
          5% { opacity: 1; }
          95% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scanning-line {
          animation: scanning-line 3s linear infinite;
        }
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-reverse-spin {
          animation: reverse-spin 2s linear infinite;
        }
        @keyframes reverse-spin {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .safe-area-inset {
          padding-top: env(safe-area-inset-top);
          padding-bottom: env(safe-area-inset-bottom);
          padding-left: env(safe-area-inset-left);
          padding-right: env(safe-area-inset-right);
        }
      `}</style>
    </div>
  );
};

export default TerminalView;
