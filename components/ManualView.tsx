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
          
          <div className="mt-8 bg-rose-50 border border-rose-100 p-6 rounded-2xl flex flex-col md:flex-row items-center md:space-x-6 space-y-4 md:space-y-0 text-rose-900 shadow-sm print:border-black print:border-2">
             <div className="p-4 bg-white rounded-full shadow-sm shrink-0">
               <ShieldAlert className="w-8 h-8 text-rose-500" />
             </div>
             <div>
               <h4 className="text-lg font-black uppercase tracking-tight mb-1">Cierre de Sesión Seguro (Botón Oculto)</h4>
               <p className="text-sm font-medium leading-relaxed">
                 Para evitar que los empleados apaguen la terminal accidentalmente, el botón de "Cerrar Sesión" ha sido eliminado de la interfaz visual. Para poder cerrar la sesión, un administrador o encargado <strong>debe tocar/hacer clic 5 veces seguidas de forma muy rápida sobre el título principal que dice "LECTOR DE ACCESO"</strong> en la parte superior central de la pantalla. Esto desplegará la alerta confidencial para cerrar sesión.
               </p>
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

        <div className="grid grid-cols-1 gap-6">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-6 flex flex-col justify-center">
            <h3 className="text-lg font-black text-indigo-400 uppercase tracking-widest">Escala de Clasificación</h3>
            <div className="space-y-3 font-bold text-xs uppercase tracking-tighter">
              <div className="flex items-center space-x-3 text-indigo-300"><div className="w-2 h-2 rounded-full bg-current"></div><span>Clase 0: Elite (Puntaje Perfecto)</span></div>
              <div className="flex items-center space-x-3 text-emerald-400"><div className="w-2 h-2 rounded-full bg-current"></div><span>Clase 1: Excelente</span></div>
              <div className="flex items-center space-x-3 text-amber-400"><div className="w-2 h-2 rounded-full bg-current"></div><span>Clase 2: Estable</span></div>
              <div className="flex items-center space-x-3 text-orange-400"><div className="w-2 h-2 rounded-full bg-current"></div><span>Clase 3: Regular</span></div>
              <div className="flex items-center space-x-3 text-rose-500"><div className="w-2 h-2 rounded-full bg-current"></div><span>Clase 4: Alerta / Crónica</span></div>
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
                <p className="text-xs text-slate-500 mt-1 font-medium">Define el horario habitual (ej: L-V de 08:00 a 16:00). <strong className="text-slate-700">Importante:</strong> Su cálculo NO es retroactivo; aplica unicamente desde el momento en que se le es configurado en adelante.</p>
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

      {/* SECTION 5: AUDITORÍA Y DASHBOARD */}
      <section id="sec-5" className="space-y-6 scroll-mt-32 break-inside-avoid">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg text-lg font-black">5</div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Auditoría y Dashboard</h2>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm space-y-10">
          {/* Dashboard Intro */}
          <div className="space-y-4">
            <h3 className="text-2xl font-black text-slate-800 flex items-center">
               <History className="w-6 h-6 mr-3 text-indigo-600" />
               Panel de Mando Interactivo (Dashboard)
            </h3>
            <p className="text-slate-600 leading-relaxed font-medium">
              El Dashboard principal no es solo informativo, es interactivo. Las métricas resumen que observas (como "Presentes", "Ausentes" y "Llegadas Tarde") funcionan como filtros rápidos.
            </p>
            <div className="p-5 bg-indigo-50 rounded-2xl border-l-4 border-indigo-600 max-w-3xl">
              <span className="block font-black text-indigo-900 text-sm mb-1">💡 Tip Pro: Clic en las Estadísticas</span>
              <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                Al hacer clic en uno de los bloques de estadísticas en la parte superior (por ejemplo, <strong>"Llegadas Tarde hoy"</strong>), la tabla inferior se filtrará automáticamente para mostrarte en detalle y de inmediato quiénes son exactamente esas personas que desencadenaron la métrica.
              </p>
            </div>
          </div>
          
          <div className="pt-8 border-t border-slate-100 space-y-8">
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-slate-800 flex items-center">
                 <ShieldAlert className="w-6 h-6 mr-3 text-amber-500" />
                 Módulo de Auditoría de Personal
              </h3>
              <p className="text-slate-600 leading-relaxed font-medium max-w-4xl">
                Este módulo es el corazón analítico del control de presentismo. Contiene todas las herramientas necesarias para la supervisión diaria, ajuste de excepciones y la exportación y liquidación a fin de mes.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {/* 1. Vistas */}
               <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4 flex flex-col">
                  <h4 className="font-black text-indigo-900 uppercase tracking-widest text-xs flex items-center"><Calendar className="w-4 h-4 mr-2" /> Modos de Visualización</h4>
                  <ul className="space-y-3 text-sm text-slate-600 font-medium list-none">
                    <li className="flex items-start">
                      <ArrowRight className="w-4 h-4 mr-2 mt-1 shrink-0 text-indigo-400" />
                      <span><strong className="text-slate-800">Resumen Mensual:</strong> Tabla consolidada rápida útil para analizar quién llega tarde, ideal para exportación. Permite búsquedas por sector, alertas y scoring en tiempo real.</span>
                    </li>
                    <li className="flex items-start">
                      <ArrowRight className="w-4 h-4 mr-2 mt-1 shrink-0 text-indigo-400" />
                      <span><strong className="text-slate-800">Vista Calendario:</strong> Una grilla visual interactiva que expone el presentismo de todo el equipo, día por día en una hoja de ruta mensual, con colores semánticos intuitivos.</span>
                    </li>
                  </ul>
               </div>

               {/* 2. Recálculo */}
               <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4 flex flex-col">
                  <h4 className="font-black text-amber-700 uppercase tracking-widest text-xs flex items-center"><History className="w-4 h-4 mr-2" /> Recálculo Automático</h4>
                  <p className="text-sm text-slate-600 font-medium">
                    Si corriges el cronograma de un empleado o justificaste inasistencias pasadas, debes ubicar al usuario y presionar <strong>"Recalcular Periodo"</strong>. Esto obligará al sistema a:
                  </p>
                  <ul className="space-y-3 text-sm text-slate-600 font-medium list-none">
                    <li className="flex items-start">
                      <CheckCircle2 className="w-4 h-4 mr-2 mt-1 shrink-0 text-amber-500" />
                      <span>Re-evaluar si llegó tarde o ausente en el pasado en base a tu nuevo mapa de horario.</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle2 className="w-4 h-4 mr-2 mt-1 shrink-0 text-amber-500" />
                      <span>Volver a actualizar en fracciones de segundo la suma final y su <strong>estado de Scoring</strong> dinámico en pantalla.</span>
                    </li>
                  </ul>
               </div>

               {/* 3. Gestión y Modificación */}
               <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4 flex flex-col">
                  <h4 className="font-black text-emerald-800 uppercase tracking-widest text-xs flex items-center"><ShieldCheck className="w-4 h-4 mr-2" /> Control y Edición Fina</h4>
                  <ul className="space-y-3 text-sm text-slate-600 font-medium list-none">
                    <li className="flex items-start">
                      <ArrowRight className="w-4 h-4 mr-2 mt-0.5 shrink-0 text-emerald-500" />
                      <span><strong className="text-slate-800">Inferencia de Faltas:</strong> El sistema cruza automáticamente los días sin marcar contra el cronograma asignado, generando un "ausente" sin interacción humana.</span>
                    </li>
                    <li className="flex items-start">
                      <ArrowRight className="w-4 h-4 mr-2 mt-0.5 shrink-0 text-emerald-500" />
                      <span><strong className="text-slate-800">Edición Detallada:</strong> Con el botón "Ver Detalle" puedes justificar fechas pasadas (licencias, vacaciones) además de poder extraer el CSV minucioso de ese único empleado.</span>
                    </li>
                  </ul>
               </div>
            </div>
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
                { p: "Cierre de Sesión en Terminal", c: "Botón CERRAR SESION oculto por seguridad", s: "Presione rápidamente 5 veces el título principal 'LECTOR DE ACCESO' para poder salir." },
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
          /* Force visibility and clear floats/overflows on parent containers */
          html, body { 
            height: auto !important; 
            overflow: visible !important; 
            margin: 0 !important; 
            padding: 0 !important;
            background: white !important;
          }
          
          /* Hide sidebar and toggle components that might exist in the DOM */
          aside, nav, button, .print\\:hidden { 
            display: none !important; 
          }
          
          /* Reset the main container constraints */
          main, .min-h-screen, .flex, .overflow-auto, .overflow-hidden {
            display: block !important;
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
            position: static !important;
            min-height: 0 !important;
          }

          /* Content specific styles */
          h1, h2, h3, h4 { 
            color: black !important; 
            page-break-after: avoid; 
          }
          p, span, td, div { 
            color: #333 !important; 
          }
          .break-inside-avoid { 
            page-break-inside: avoid; 
          }
          section { 
            margin-bottom: 2.5rem !important;
            page-break-inside: avoid;
          }
          
          /* Remove background colors and shadows for better print ink usage */
          .bg-slate-900, .bg-indigo-600 {
            background-color: #f8fafc !important; /* light slate */
            color: black !important;
            border: 1px solid #e2e8f0 !important;
          }
          .shadow-sm, .shadow-md, .shadow-xl, .shadow-2xl {
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ManualView;
