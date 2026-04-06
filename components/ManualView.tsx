import React from 'react';
import { 
  BookOpen, 
  Printer, 
  Users, 
  ShieldCheck, 
  ScanLine, 
  Clock, 
  Calendar, 
  History, 
  ShieldAlert,
  ArrowRight,
  Info,
  CheckCircle2,
  HelpCircle,
  ChevronRight
} from 'lucide-react';

const ManualView: React.FC = () => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-10 space-y-12 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 print:p-0 print:m-0 print:bg-white print:text-black">
      {/* Header section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-200 print:hidden">
        <div className="space-y-2">
          <div className="flex items-center space-x-3 text-indigo-600">
            <BookOpen className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Documentación Oficial</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tighter">
            Manual de <span className="text-indigo-600">Usuario</span>
          </h1>
          <p className="text-slate-500 font-medium max-w-2xl">
            Guía completa para administradores y encargados sobre el uso del sistema integral de asistencia SecureQR.
          </p>
        </div>
        <button 
          onClick={handlePrint}
          className="flex items-center space-x-3 px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-sm shadow-xl shadow-slate-900/20 transition-all active:scale-95 group"
        >
          <Printer className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          <span>IMPRIMIR PDF</span>
        </button>
      </header>

      {/* Print-only Header */}
      <div className="hidden print:block mb-8 text-center border-b-2 border-slate-950 pb-8">
        <h1 className="text-4xl font-black uppercase tracking-tighter">SecureQR Attendance System</h1>
        <p className="text-xl font-bold mt-2">Manual de Usuario Oficial</p>
        <p className="text-sm mt-1 text-slate-500 italic">Documentación generada el {new Date().toLocaleDateString()}</p>
      </div>

      {/* Quick Navigation Card */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:hidden">
        {[
          { id: 'sec-1', label: 'Introducción', icon: Info },
          { id: 'sec-2', label: 'Lector de Acceso', icon: ScanLine },
          { id: 'sec-3', label: 'Personal y Scoring', icon: Users },
          { id: 'sec-4', label: 'Horarios', icon: Calendar },
          { id: 'sec-5', label: 'Auditoría', icon: History },
          { id: 'sec-faq', label: 'Preguntas Frecuentes', icon: HelpCircle },
        ].map(item => (
          <a 
            key={item.id} 
            href={`#${item.id}`}
            className="flex items-center space-x-4 p-4 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 transition-all group"
          >
            <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
               <item.icon className="w-5 h-5 text-indigo-600" />
            </div>
            <span className="font-bold text-slate-700">{item.label}</span>
            <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
          </a>
        ))}
      </div>

      {/* SECTION 1: INTRO */}
      <section id="sec-1" className="space-y-6 scroll-mt-32 break-inside-avoid">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <span className="font-black text-lg">1</span>
          </div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Introducción y Acceso</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-4 h-full">
              <h3 className="text-xl font-black text-slate-800 flex items-center">
                <ShieldCheck className="w-5 h-5 mr-3 text-emerald-500" />
                Seguridad de Registro
              </h3>
              <p className="text-slate-600 leading-relaxed font-medium">
                Cuando un nuevo usuario se registra, su cuenta queda en **Estado Pendiente**. Un administrador con los permisos adecuados debe revisar el perfil y autorizar el acceso vinculando el DNI al legajo correspondiente.
              </p>
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                <p className="text-xs text-amber-800 font-bold leading-relaxed italic">
                  "El sistema previene el acceso duplicado validando que cada DNI sólo pueda estar vinculado a una cuenta activa."
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-900 rounded-[2rem] p-8 text-white space-y-6 shadow-2xl relative overflow-hidden h-full">
             <div className="absolute top-0 right-0 p-8 opacity-10">
                <ShieldCheck className="w-32 h-32" />
             </div>
             <h3 className="text-lg font-black uppercase tracking-widest text-indigo-400">Esquema de Aprobación</h3>
             <div className="space-y-4 relative z-10 font-bold text-xs">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full border-2 border-indigo-500 flex items-center justify-center">1</div>
                  <span>Registro de Usuario</span>
                </div>
                <div className="w-0.5 h-4 bg-indigo-500/30 ml-4"></div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full border-2 border-amber-500 flex items-center justify-center text-amber-400">2</div>
                  <span>Revisión Administrativa</span>
                </div>
                <div className="w-0.5 h-4 bg-indigo-500/30 ml-4"></div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">3</div>
                  <span>Acceso Activo + Vinculación DNI</span>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: TERMINAL */}
      <section id="sec-2" className="space-y-6 scroll-mt-32 break-inside-avoid">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg text-lg font-black">2</div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">El Lector de Acceso (Terminal)</h2>
        </div>

        <div className="bg-white rounded-[2.5rem] border-4 border-slate-100 p-8 md:p-12 shadow-sm space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-800">Modo de Operación</h3>
                <p className="text-slate-500 font-medium leading-relaxed">
                  El sistema detecta automáticamente si la terminal está conectada. En caso de corte de red, el sistema entra en **Modo Centinela (Offline)**.
                </p>
              </div>
              <ul className="space-y-4">
                {[
                  { title: "Escaneo QR", desc: "Uso de credencial digital o física impresa.", color: "text-indigo-600" },
                  { title: "Ingreso DNI", desc: "Teclado numérico para marcación directa en caso de falla de cámara.", color: "text-amber-500" },
                  { title: "Sync Automático", desc: "Las fichadas offline se suben en cuanto vuelve el internet.", color: "text-emerald-500" },
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start space-x-3">
                    <CheckCircle2 className={`w-5 h-5 shrink-0 ${item.color}`} />
                    <div>
                      <span className="block font-black text-slate-700 text-sm italic">{item.title}</span>
                      <span className="text-xs text-slate-400 font-medium">{item.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 flex flex-col items-center justify-center space-y-4">
              <div className="w-full flex justify-between px-4">
                 <div className="flex items-center space-x-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[8px] font-black uppercase text-slate-400">Terminal OK</span></div>
                 <div className="flex items-center space-x-1"><div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div><span className="text-[8px] font-black uppercase text-slate-400">Syncing</span></div>
              </div>
              <div className="w-48 h-48 bg-white rounded-2xl shadow-inner border border-slate-200 flex items-center justify-center relative overflow-hidden group">
                 <ScanLine className="w-20 h-20 text-indigo-600 opacity-20" />
                 <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/50 shadow-lg animate-bounce"></div>
                 <span className="absolute bottom-4 text-[10px] font-black text-slate-300">LISTO PARA ESCANEAR</span>
              </div>
              <div className="flex gap-2">
                 <div className="w-20 h-8 bg-emerald-500/10 rounded-lg border border-emerald-500/20 flex items-center justify-center text-[10px] font-black text-emerald-600">ENTRADA</div>
                 <div className="w-20 h-8 bg-slate-200 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-400">SALIDA</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: SCORING */}
      <section id="sec-3" className="space-y-6 scroll-mt-32 break-inside-avoid">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg text-lg font-black">3</div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Gestión de Personal y Scoring</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            <h3 className="text-xl font-black text-slate-800">Cálculo Dinámico de Scoring</h3>
            <p className="text-slate-600 leading-relaxed font-medium">
              El sistema evalúa el desempeño en una ventana de **90 días**. Las ausencias y tardanzas tienen un peso decreciente: lo ocurrido ayer afecta más que lo ocurrido hace dos meses.
            </p>
            
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center justify-around flex-wrap gap-4">
              {[
                { label: '0-30 días', peso: '1.0', color: 'text-rose-600', w: 'w-24' },
                { label: '30-60 días', peso: '0.6', color: 'text-amber-600', w: 'w-20' },
                { label: '60-90 días', peso: '0.3', color: 'text-indigo-600', w: 'w-16' },
              ].map((m, i) => (
                <div key={i} className="flex flex-col items-center space-y-2">
                  <div className={`${m.w} h-2 bg-slate-200 rounded-full overflow-hidden`}><div className={`h-full bg-indigo-500`} style={{ width: `${Number(m.peso)*100}%` }}></div></div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.label}</span>
                  <span className={`text-xs font-black ${m.color}`}>Peso {m.peso}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-6 flex flex-col justify-center">
            <h3 className="text-lg font-black text-indigo-400 uppercase tracking-widest">Escala de Clasificación</h3>
            <div className="space-y-3 font-bold text-xs uppercase tracking-tighter">
              <div className="flex items-center space-x-3 text-emerald-400"><div className="w-2 h-2 rounded-full bg-current"></div><span>Clase 1: Perfecta</span></div>
              <div className="flex items-center space-x-3 text-amber-400"><div className="w-2 h-2 rounded-full bg-current"></div><span>Clase 2: Mejorable</span></div>
              <div className="flex items-center space-x-3 text-orange-400"><div className="w-2 h-2 rounded-full bg-current"></div><span>Clase 3: Deficiente</span></div>
              <div className="flex items-center space-x-3 text-rose-500"><div className="w-2 h-2 rounded-full bg-current"></div><span>Clase 4: Crónica</span></div>
              <div className="flex items-center space-x-3 text-slate-500"><div className="w-2 h-2 rounded-full bg-current"></div><span>Clase 5: Irrecuperable</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: HORARIOS */}
      <section id="sec-4" className="space-y-6 scroll-mt-32 break-inside-avoid">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg text-lg font-black">4</div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Cronogramas de Trabajo</h2>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 text-indigo-600 mb-2">
              <Calendar className="w-5 h-5" />
              <h3 className="text-xl font-black text-slate-800">Plantillas vs. Excepciones</h3>
            </div>
            <p className="text-slate-600 leading-relaxed font-medium">
              El sistema utiliza un motor de herencia para determinar el horario de un empleado en un día específico.
            </p>
            <div className="space-y-4 mt-6">
              <div className="p-5 bg-slate-50 rounded-2xl border-l-4 border-indigo-600">
                <span className="block font-black text-slate-800 text-sm">1. Plantilla Base</span>
                <p className="text-xs text-slate-500 mt-1 font-medium">Define el horario habitual (ej: Lunes a Viernes de 08:00 a 16:00).</p>
              </div>
              <div className="p-5 bg-indigo-50 rounded-2xl border-l-4 border-indigo-200">
                <span className="block font-black text-indigo-800 text-sm">2. Excepción Semanal</span>
                <p className="text-xs text-indigo-600 mt-1 font-medium italic">Sobreescribe la plantilla base para fechas específicas (ej: Cambio de turno temporal).</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center p-8 bg-indigo-600 rounded-[2rem] text-white space-y-4">
             <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center shadow-inner">
                <Clock className="w-8 h-8" />
             </div>
             <p className="text-center text-sm font-bold uppercase tracking-[0.2em] leading-relaxed">
               Admite Turnos:<br/>
               <span className="text-indigo-200">CONTINUOS / CORTADOS / DESCANSOS</span>
             </p>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="sec-faq" className="space-y-8 scroll-mt-32 break-inside-avoid">
        <div className="text-center space-y-2">
          <h2 className="text-4xl font-black text-slate-800 tracking-tight flex items-center justify-center">
            <HelpCircle className="w-8 h-8 mr-4 text-indigo-600" />
            Preguntas Frecuentes
          </h2>
          <p className="text-slate-500 font-medium">Todo lo que necesitas saber sobre el día a día en SecureQR.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { 
              q: "¿Puedo imprimir el QR en una tarjeta física?", 
              a: "Sí. Los códigos son persistentes y están vinculados al DNI. Una vez impresos, sirven indefinidamente mientras el usuario esté activo." 
            },
            { 
              q: "¿Qué sucede si no hay internet en la planta?", 
              a: "La terminal entra en modo Offline. Guarda las fichadas localmente y las sincroniza con el servidor en cuanto recupere la conexión." 
            },
            { 
              q: "¿Cómo corregir una fichada olvidada?", 
              a: "Los administradores pueden usar la función 'Recalcular Periodo' o añadir registros manuales desde el módulo de Auditoría." 
            },
            { 
              q: "¿Puedo ver quién modificó un horario?", 
              a: "Sí. Cada cambio realizado por un administrador queda registrado en el Log de Auditoría (Sistema), permitiendo trazabilidad total." 
            }
          ].map((item, idx) => (
            <div key={idx} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4 hover:border-indigo-200 transition-colors">
              <h4 className="text-lg font-black text-slate-800">{item.q}</h4>
              <p className="text-slate-500 font-medium text-sm leading-relaxed italic">"{item.a}"</p>
            </div>
          ))}
        </div>
      </section>

      {/* Troubleshooting Table */}
      <section className="bg-slate-900 rounded-[3rem] p-8 md:p-12 text-white space-y-12 shadow-2xl break-inside-avoid mt-20">
        <div className="space-y-4">
          <h2 className="text-3xl font-black tracking-tight">Resolución de Problemas</h2>
          <p className="text-slate-400 font-medium">Guía rápida para incidencias comunes en terminales.</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left font-bold text-sm">
            <thead>
              <tr className="text-indigo-400 border-b border-white/5 uppercase tracking-widest text-[10px]">
                <th className="pb-4">Problema detectado</th>
                <th className="pb-4">Causa probable</th>
                <th className="pb-4">Procedimiento de solución</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                { p: "Cámara no activa", c: "Permisos denegados", s: "Permitir uso de cámara en el navegador." },
                { p: "Error 'Duplicate'", c: "Fichaje reciente", s: "Aguardar 10 min entre fichadas (evita duplicidad)." },
                { p: "Acceso Bloqueado", c: "Suspensión administrativa", s: "Consultar log de suspensión en módulo Usuarios." },
                { p: "QR no leído", c: "Baja luminosidad", s: "Subir el brillo del móvil o limpiar lente de cámara." },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-white/5 transition-colors group">
                  <td className="py-6 pr-4 flex items-center"><ShieldAlert className="w-4 h-4 mr-3 text-rose-500 opacity-0 group-hover:opacity-100" />{row.p}</td>
                  <td className="py-6 pr-4 text-slate-500 italic">"{row.c}"</td>
                  <td className="py-6 text-indigo-400">{row.s}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center pt-12 pb-20 space-y-4 print:pt-4 pt-10">
        <div className="flex items-center justify-center space-x-2 text-indigo-600">
           <ShieldCheck className="w-5 h-5" />
           <span className="font-black tracking-tighter">SECURE QR CONTROL</span>
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">Versión 2.0.4 • 2026</p>
      </footer>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white !important; }
          h1, h2, h3, h4 { color: black !important; page-break-after: avoid; }
          p { color: #333 !important; }
          .break-inside-avoid { page-break-inside: avoid; }
          section { margin-bottom: 2rem !important; }
        }
      `}</style>
    </div>
  );
};

export default ManualView;
