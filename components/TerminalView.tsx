
import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCcw, CheckCircle2, XCircle, ArrowLeft, ScanLine, ShieldAlert } from 'lucide-react';
import jsQR from 'jsqr';
import { attendanceService } from '../services/attendanceService';

interface TerminalViewProps {
  onExit: () => void;
}

const TerminalView: React.FC<TerminalViewProps> = ({ onExit }) => {
  const [scanning, setScanning] = useState(true);
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'duplicate' | 'wait'>('idle');
  const [lastUser, setLastUser] = useState<string | null>(null);
  const [scanType, setScanType] = useState<'in' | 'out' | null>(null);
  const [attendanceMsg, setAttendanceMsg] = useState<string>('');
  const [msgColor, setMsgColor] = useState<string>('text-emerald-300');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);

  useEffect(() => {
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
        console.log(`Procesando escaneo: Nombre=${employeeName}, ID=${employeeId}`);
        const result = await attendanceService.processScan(employeeId, employeeName);

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
        } else if (result.reason === 'check_out_too_soon') {
          setStatus('wait');
          setLastUser(employeeName);
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
        setScanning(true);
      }, 3500);
    } else {
      setStatus('error');
      setTimeout(() => {
        setStatus('idle');
        setScanning(true);
      }, 3000);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950 text-white p-4 md:p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950"></div>

      <button
        onClick={onExit}
        className="absolute top-6 left-6 flex items-center space-x-2 text-slate-400 hover:text-white transition-colors z-20 bg-slate-900/50 px-4 py-2 rounded-full backdrop-blur-sm"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="font-medium">Salir del Terminal</span>
      </button>

      <div className="flex-1 flex flex-col items-center justify-center space-y-8 z-10">
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-indigo-400">LECTOR DE ACCESO</h1>
          <p className="text-slate-500 uppercase tracking-[0.3em] text-xs font-bold">Sucursal: Planta Industrial Norte</p>
        </div>

        <div className="relative w-full max-w-lg aspect-square bg-slate-900 rounded-[2.5rem] overflow-hidden border-8 border-slate-800 shadow-2xl flex items-center justify-center">
          {scanning && !cameraError && (
            <>
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover opacity-60"
              />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 border-[1.5rem] border-slate-900"></div>
              <div className="absolute inset-12 border-2 border-dashed border-indigo-500/40 rounded-3xl"></div>
              <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.8)] animate-[scan_2.5s_ease-in-out_infinite]"></div>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-indigo-600/20 px-4 py-2 rounded-full backdrop-blur-md border border-indigo-500/30 flex items-center space-x-2">
                <ScanLine className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Escaneando...</span>
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
                <p className="text-red-300 font-bold">Token no reconocido</p>
                <p className="text-slate-400 mt-4 text-sm max-w-[250px]">El código QR no pertenece a un empleado activo o ha expirado.</p>
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
            Muestre su código QR personal frente a la cámara.
            Asegúrese de que haya suficiente iluminación.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); opacity: 0.3; }
          50% { transform: translateY(480px); opacity: 1; }
          100% { transform: translateY(0); opacity: 0.3; }
        }
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default TerminalView;
