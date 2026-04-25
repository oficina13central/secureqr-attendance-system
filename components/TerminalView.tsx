import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCcw, CheckCircle2, XCircle, ArrowLeft, ScanLine, ShieldAlert, Keyboard, X, Settings, LogOut } from 'lucide-react';
import jsQR from 'jsqr';
import { attendanceService } from '../services/attendanceService';
import { supabase } from '../services/supabaseClient';
import { offlineService } from '../services/offlineService';

interface TerminalViewProps {
  onExit: () => void;
  role?: string;
}

const TerminalView: React.FC<TerminalViewProps> = ({ onExit, role }) => {
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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [manualDni, setManualDni] = useState('');
  const [processingManual, setProcessingManual] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [cameraMode, setCameraMode] = useState<'user' | 'environment'>(
    (localStorage.getItem('terminal_camera_mode') as 'user' | 'environment') || 'environment'
  );

  const videoRef = useRef<HTMLVideoElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  
  // Robust PIN protection
  const [showPinPad, setShowPinPad] = useState(false);
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const TERMINAL_PIN = "0808";

  const getSuccessMessage = (type: 'in' | 'out', recordStatus?: string | null) => {
    if (type === 'out') {
      return { message: 'Salida Registrada', color: 'text-blue-300' };
    }

    if (recordStatus === 'en_horario') {
      return { message: 'En Horario', color: 'text-emerald-300' };
    }
    if (recordStatus === 'tarde') {
      return { message: 'Llegó Tarde', color: 'text-amber-300' };
    }
    if (recordStatus === 'sin_presentismo') {
      return { message: 'Perdió el Presentismo', color: 'text-red-400' };
    }

    return { message: 'Entrada Registrada', color: 'text-emerald-300' };
  };

  const getFailurePresentation = (reason?: string, invalidQr = false) => {
    if (invalidQr) {
      return {
        status: 'error' as const,
        message: 'QR no válido, revise su tarjeta',
      };
    }

    switch (reason) {
      case 'already_checked_in':
        return { status: 'duplicate' as const, message: 'Ya tenés una entrada abierta' };
      case 'no_open_record':
        return { status: 'error' as const, message: 'No tenés entrada registrada' };
      case 'off_day':
        return { status: 'error' as const, message: 'Tenés descanso asignado' };
      case 'vacation':
        return { status: 'error' as const, message: 'Estás de vacaciones' };
      case 'daily_limit_reached':
        return { status: 'duplicate' as const, message: 'Ya completaste los registros permitidos de hoy' };
      case 'user_not_found':
        return { status: 'error' as const, message: 'No se encontró un empleado válido' };
      case 'queued_offline':
        return { status: 'success' as const, message: 'Guardado Offline (Sin Internet)' };
      default:
        return { status: 'error' as const, message: 'Error al registrar' };
    }
  };

  const handlePinInput = (num: string) => {
    setPinError(false);
    if (inputPin.length < 4) {
      const newPin = inputPin + num;
      setInputPin(newPin);
      if (newPin.length === 4) {
        if (newPin === TERMINAL_PIN) {
          setShowPinPad(false);
          setShowLogoutConfirm(true);
          setInputPin('');
        } else {
          setPinError(true);
          setTimeout(() => setInputPin(''), 1000);
        }
      }
    }
  };

  const startSession = (mode: 'in' | 'out') => {
    setScanMode(mode);
    setSessionActive(true);
    setScanning(true);
    setStatus('idle');
    setCameraError(null);
  };

  const resetTerminal = () => {
    setSessionActive(false);
    setScanning(false);
    setStatus('idle');
    setShowManualModal(false);
    setManualDni('');
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
  };

  const handleSaveName = () => {
    const finalName = tempName.trim().toUpperCase() || 'PLANTA INDUSTRIAL NORTE';
    setTerminalName(finalName);
    localStorage.setItem('terminal_branch_name', finalName);
    setIsEditingName(false);
  };

  const toggleCamera = () => {
    const nextMode = cameraMode === 'environment' ? 'user' : 'environment';
    setCameraMode(nextMode);
    localStorage.setItem('terminal_camera_mode', nextMode);
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
          video: { facingMode: cameraMode }
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
  }, [scanning, cameraMode]);

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
          const successPresentation = getSuccessMessage(result.type, result.record?.status);
          setStatus('success');
          setLastUser(employeeName);
          setScanType(result.type);
          setAttendanceMsg(successPresentation.message);
          setMsgColor(successPresentation.color);
        } else if (result.reason === 'queued_offline') {
          const offlinePresentation = getFailurePresentation(result.reason);
          setStatus('success');
          setLastUser(employeeName);
          setScanType(scanMode || 'in'); 
          setAttendanceMsg(offlinePresentation.message);
          setMsgColor('text-amber-400');
          setPendingCount(offlineService.count);
        } else {
          const failurePresentation = getFailurePresentation(result.reason);
          setStatus(failurePresentation.status);
          setAttendanceMsg(failurePresentation.message);
        }
      } else {
        const invalidQrPresentation = getFailurePresentation(undefined, true);
        setStatus(invalidQrPresentation.status);
        setAttendanceMsg(invalidQrPresentation.message);
      }

      setTimeout(() => {
        setStatus('idle');
        setSessionActive(false);
        setScanning(false);
      }, 6000);
    } else {
      const invalidQrPresentation = getFailurePresentation(undefined, true);
      setStatus(invalidQrPresentation.status);
      setAttendanceMsg(invalidQrPresentation.message);
      setTimeout(() => {
        resetTerminal();
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
        const successPresentation = getSuccessMessage(result.type, result.record?.status);
        setStatus('success');
        setLastUser(employeeName);
        setScanType(result.type);
        setAttendanceMsg(successPresentation.message);
        setMsgColor(successPresentation.color);
        setShowManualModal(false);
        setManualDni('');
      } else {
        const failurePresentation = getFailurePresentation(result.reason);
        setStatus(failurePresentation.status);
        setAttendanceMsg(failurePresentation.message);
        setShowManualModal(false);
      }
    } catch (err) {
      console.error("Manual entry failed:", err);
      setStatus('error');
      setAttendanceMsg('Error al registrar');
    } finally {
      setProcessingManual(false);
      setTimeout(() => {
        resetTerminal();
      }, 6000);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950 text-white p-4 md:p-10 relative overflow-hidden safe-area-inset">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-slate-950 to-slate-950"></div>

      <div className="absolute top-4 left-4 md:top-8 md:left-8 flex items-center space-x-3 z-50">
        {!sessionActive && (
          <button
            onClick={() => setShowPinPad(true)}
            className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors bg-slate-900/80 px-4 py-2 rounded-full backdrop-blur-md border border-white/5 active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-bold text-xs uppercase tracking-widest">Salir Terminal</span>
          </button>
        )}

        {sessionActive && status === 'idle' && (
          <button
            onClick={resetTerminal}
            className="flex items-center space-x-2 text-white bg-slate-800 hover:bg-slate-700 transition-all px-5 py-2.5 rounded-full shadow-lg border border-slate-600 active:scale-95"
          >
            <X className="w-5 h-5" />
            <span className="font-bold text-xs uppercase tracking-widest">Cancelar</span>
          </button>
        )}
      </div>

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
          <h1 
            className="text-4xl md:text-6xl font-black tracking-tighter text-indigo-400 select-none cursor-default"
          >LECTOR DE ACCESO</h1>
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
              <div className="absolute top-6 left-6 z-30">
                <button
                  onClick={resetTerminal}
                  className="bg-slate-900/80 backdrop-blur-md text-white p-3 rounded-full border border-white/20 hover:bg-slate-800 transition-all shadow-xl active:scale-90"
                  title="Cancelar y Volver"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
              </div>

              <div className="absolute top-6 right-6 z-30">
                <button
                  onClick={toggleCamera}
                  className="bg-indigo-600/80 backdrop-blur-md text-white p-3 rounded-full border border-white/20 hover:bg-indigo-500 transition-all shadow-xl active:scale-90 flex items-center space-x-2"
                  title="Cambiar Cámara"
                >
                  <Camera className="w-6 h-6" />
                  <span className="text-[10px] font-black uppercase tracking-tight pr-1">
                    {cameraMode === 'environment' ? 'Frontal' : 'Trasera'}
                  </span>
                </button>
              </div>

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
                onClick={resetTerminal}
                className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-indigo-500 transition-all shadow-lg"
              >
                Volver al Menú
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
                <p className="text-red-300 font-bold">{attendanceMsg || 'QR no válido, revise su tarjeta'}</p>
                <p className="text-slate-400 mt-4 text-sm max-w-[250px]">
                  {attendanceMsg === 'No tenés entrada registrada'
                    ? 'Debe registrar su ingreso antes de poder marcar la salida.'
                    : attendanceMsg === 'Tenés descanso asignado' || attendanceMsg === 'Estás de vacaciones'
                    ? 'No podés registrar asistencia en tus días libres asignados.'
                    : attendanceMsg === 'QR no válido, revise su tarjeta'
                    ? 'El código leído no es válido o no corresponde a una credencial activa.'
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
                <p className="text-4xl font-black text-white mb-2 uppercase">
                  {attendanceMsg === 'Ya tenés una entrada abierta' ? 'AVISO' : 'LÍMITE ALCANZADO'}
                </p>
                <p className="text-amber-300 font-bold">{attendanceMsg || 'Ya completaste los registros permitidos de hoy'}</p>
                <p className="text-slate-400 mt-4 text-sm max-w-[250px]">
                  {attendanceMsg === 'Ya tenés una entrada abierta' 
                    ? 'Ya has registrado tu ingreso previamente hoy.' 
                    : 'Ya completaste todas las entradas permitidas para hoy.'}
                </p>
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
                onClick={resetTerminal} 
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
      {/* ── PIN PAD MODAL ── */}
      {showPinPad && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-[150] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-slate-900 w-full max-w-sm rounded-[3rem] p-8 border border-slate-800 shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
            <div className="text-center space-y-2">
              <ShieldAlert className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
              <h3 className="text-2xl font-black text-white uppercase tracking-tight">Acceso Restringido</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Ingrese su PIN de Seguridad</p>
            </div>

            <div className="flex justify-center space-x-4">
              {[0, 1, 2, 3].map((i) => (
                <div 
                  key={i} 
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${inputPin.length > i ? 'bg-indigo-500 border-indigo-500 scale-125' : 'bg-transparent border-slate-700'} ${pinError ? 'bg-red-500 border-red-500 animate-shake' : ''}`}
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <button
                  key={n}
                  onClick={() => handlePinInput(n.toString())}
                  className="h-16 bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 text-white font-black text-2xl rounded-2xl transition-all active:scale-90"
                >
                  {n}
                </button>
              ))}
              <button 
                onClick={() => setInputPin('')}
                className="h-16 bg-slate-800/50 text-slate-500 font-bold rounded-2xl border border-slate-800"
              >
                C
              </button>
              <button
                onClick={() => handlePinInput('0')}
                className="h-16 bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 text-white font-black text-2xl rounded-2xl transition-all active:scale-90"
              >
                0
              </button>
              <button 
                onClick={() => {
                  setShowPinPad(false);
                  setInputPin('');
                }}
                className="h-16 bg-red-900/20 text-red-500 font-black text-xs uppercase tracking-widest rounded-2xl border border-red-500/20"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOGOUT CONFIRMATION MODAL ── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-slate-900 w-full max-w-sm rounded-[3rem] p-10 border border-slate-800 shadow-2xl text-center space-y-10 animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.15)]">
              <LogOut className="w-12 h-12 text-red-500" />
            </div>
            
            <div className="space-y-4">
              <h3 className="text-3xl font-black text-white tracking-tight uppercase">Cerrar Sesión</h3>
              <p className="text-slate-400 font-medium leading-relaxed">
                ¿Está seguro de que desea cerrar la sesión en esta terminal? 
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={async () => {
                  const { authService } = await import('../services/authService');
                  await authService.signOut();
                  onExit();
                }}
                className="w-full py-5 bg-red-600 hover:bg-red-500 text-white rounded-3xl font-black text-sm transition-all shadow-xl shadow-red-600/20 active:scale-95 uppercase tracking-widest"
              >
                Confirmar Cierre de Sesión
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full py-4 bg-slate-800 text-slate-400 hover:text-white rounded-3xl font-bold text-xs transition-all uppercase tracking-widest"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TerminalView;
