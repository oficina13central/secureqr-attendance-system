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
  ChevronRight,
  FileText,
  Building2,
  Award,
  FileSpreadsheet,
  Layers,
  Smartphone,
  Check
} from 'lucide-react';

const ManualView: React.FC = () => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="manual-root" className="p-4 md:p-10 space-y-12 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 print:p-0 print:m-0 print:max-w-none print:space-y-6 print:bg-white print:text-slate-900">
      {/* Header section (web only) */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-200 no-print print:hidden">
        <div className="space-y-2">
          <div className="flex items-center space-x-3 text-emerald-700">
            <BookOpen className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Documentación y Guía Oficial</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-800 tracking-tighter">
            Manual de <span className="text-emerald-700">Usuario</span>
          </h1>
          <p className="text-slate-500 font-medium max-w-2xl text-sm md:text-base">
            Guía integral para administradores, encargados y colaboradores sobre el uso y las funcionalidades del sistema de control de asistencia.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handlePrint}
            className="flex items-center space-x-3 px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-sm shadow-xl shadow-slate-900/20 transition-all active:scale-95 group"
          >
            <Printer className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            <span>IMPRIMIR / PDF</span>
          </button>
        </div>
      </header>

      {/* Print-only Editorial Header */}
      <div className="hidden print:block mb-6 text-center border-b-2 border-slate-900 pb-5">
        <div className="flex items-center justify-center space-x-2 text-emerald-800 mb-1">
          <ShieldCheck className="w-6 h-6" />
          <span className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-700">SecureQR • Plataforma Institucional</span>
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-slate-950">Manual Operativo Oficial de Usuario</h1>
        <p className="text-sm font-bold mt-0.5 text-slate-700">Sistema Integral de Control de Asistencia, Cronogramas y Legajos</p>
        <p className="text-[10px] mt-1 text-slate-500 italic">Documentación técnica institucional • Impreso el {new Date().toLocaleDateString('es-AR')}</p>
      </div>

      {/* Quick Navigation Card (web only) */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 no-print print:hidden">
        {[
          { id: 'sec-1', label: '1. Introducción y Sistema', icon: Building2 },
          { id: 'sec-2', label: '2. Acceso y Roles', icon: ShieldCheck },
          { id: 'sec-3', label: '3. Terminal y Scanner', icon: ScanLine },
          { id: 'sec-4', label: '4. Personal y Carnets', icon: Users },
          { id: 'sec-5', label: '5. Scoring de Asistencia', icon: Award },
          { id: 'sec-6', label: '6. Horarios y Francos', icon: Calendar },
          { id: 'sec-7', label: '7. Auditoría y Liquidación', icon: History },
          { id: 'sec-8', label: '8. Legajos Digitales', icon: FileText },
          { id: 'sec-9', label: '9. Solicitudes RRHH', icon: Layers },
          { id: 'sec-10', label: '10. Fraude y Sistema', icon: ShieldAlert },
          { id: 'sec-11', label: '11. App PWA y Kiosco', icon: Smartphone },
          { id: 'sec-faq', label: '12. Preguntas Frecuentes', icon: HelpCircle },
        ].map(item => (
          <a 
            key={item.id} 
            href={`#${item.id}`}
            className="flex items-center space-x-3 p-3.5 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-100 transition-all group"
          >
            <div className="p-2.5 bg-white rounded-xl shadow-sm group-hover:scale-105 transition-transform text-emerald-700">
               <item.icon className="w-4 h-4" />
            </div>
            <span className="font-bold text-xs text-slate-700">{item.label}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 ml-auto" />
          </a>
        ))}
      </div>

      {/* SECTION 1: INTRODUCCION Y ARQUITECTURA */}
      <section id="sec-1" className="space-y-6 scroll-mt-24 print:space-y-3">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-emerald-800 rounded-2xl flex items-center justify-center text-white shadow-lg font-black text-lg">1</div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Introducción y Arquitectura del Sistema</h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium">Plataforma integral de control de asistencia, cronogramas y legajos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-3 text-emerald-800 font-black text-base">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
              <h3>Seguridad y Precisión en Tiempo Real</h3>
            </div>
            <p className="text-xs leading-relaxed text-slate-600 font-medium">
              SecureQR utiliza tecnología de tokens criptográficos persistentes vinculados al DNI del personal. Cada marcación es validada en milisegundos contra el cronograma asignado, garantizando que el registro sea presencial, exacto y plenamente auditable.
            </p>
            <ul className="space-y-2 text-xs text-slate-600 font-medium">
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>Tolerancia cero a duplicidad de fichadas en intervalos cortos.</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>Trazabilidad total de cada evento con fecha, hora y terminal.</span></li>
            </ul>
          </div>

          <div className="p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-3 text-slate-800 font-black text-base">
              <Building2 className="w-6 h-6 text-slate-700" />
              <h3>Entorno Dedicado y Autónomo</h3>
            </div>
            <p className="text-xs leading-relaxed text-slate-600 font-medium">
              La plataforma opera en una infraestructura en la nube de alta disponibilidad, con base de datos propia y parámetros adaptados a la estructura operativa de la empresa (sectores, turnos habituales, descansos y jerarquías).
            </p>
            <ul className="space-y-2 text-xs text-slate-600 font-medium">
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" /><span>Bases de datos aisladas e independientes para máxima confidencialidad.</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" /><span>Modo Centinela (Offline): continúa operando incluso ante cortes de internet.</span></li>
            </ul>
          </div>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200/80 p-5 rounded-2xl flex items-start gap-3 text-emerald-950">
          <Info className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed font-medium">
            <strong>Arquitectura autónoma:</strong> El sistema funciona con independencia total de cualquier otra organización, gestionando de forma exclusiva el personal, los cronogramas y la liquidación del establecimiento.
          </p>
        </div>
      </section>

      {/* SECTION 2: ACCESO Y ROLES */}
      <section id="sec-2" className="space-y-6 scroll-mt-24 print:space-y-3">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-emerald-800 rounded-2xl flex items-center justify-center text-white shadow-lg font-black text-lg">2</div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Acceso, Seguridad y Roles</h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium">Aprobación de cuentas, vinculación por DNI y jerarquía de permisos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4 break-inside-avoid">
            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Circuito de Aprobación de Usuarios
            </h3>
            <ol className="space-y-3 text-xs text-slate-600 font-medium list-decimal list-inside">
              <li><strong>Registro Inicial:</strong> El usuario se registra con su correo y contraseña.</li>
              <li><strong>Estado Pendiente:</strong> El acceso queda bloqueado preventivamente hasta la revisión.</li>
              <li><strong>Autorización Administrativa:</strong> Un administrador revisa el DNI, asigna el rol correspondiente y activa la cuenta.</li>
              <li><strong>Vinculación con Legajo:</strong> La cuenta se conecta automáticamente con el legajo del colaborador según su DNI.</li>
            </ol>
          </div>

          <div className="bg-slate-900 text-white print:bg-slate-50 print:text-slate-900 print:border print:border-slate-200 print:shadow-none p-6 rounded-[2rem] shadow-xl space-y-4 break-inside-avoid">
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 print:text-emerald-800">Jerarquía de Roles</h3>
            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 print:bg-white print:border-slate-200 print:text-slate-800">
                <span className="font-black text-emerald-300 print:text-emerald-800 uppercase">Superusuario:</span> Control irrestricto de configuración, base de datos y auditoría.
              </div>
              <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 print:bg-white print:border-slate-200 print:text-slate-800">
                <span className="font-black text-emerald-300 print:text-emerald-800 uppercase">Administrador:</span> Personal, cronogramas, auditoría de asistencia, recalculo y liquidación.
              </div>
              <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 print:bg-white print:border-slate-200 print:text-slate-800">
                <span className="font-black text-amber-300 print:text-amber-800 uppercase">Encargado:</span> Supervisión de sus sectores asignados, carga horaria y justificaciones.
              </div>
              <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 print:bg-white print:border-slate-200 print:text-slate-800">
                <span className="font-black text-blue-300 print:text-blue-800 uppercase">Empleado:</span> Consulta exclusiva de su credencial QR y sus horarios.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: MODO TERMINAL */}
      <section id="sec-3" className="space-y-6 scroll-mt-24 print:space-y-3">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-emerald-800 rounded-2xl flex items-center justify-center text-white shadow-lg font-black text-lg">3</div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">El Lector de Acceso (Terminal)</h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium">Modo kiosco, escaneo QR de alta velocidad, teclado DNI y modo offline</p>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-6 md:p-8 shadow-sm space-y-6 break-inside-avoid">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-800">Funcionalidades Principales</h3>
              <ul className="space-y-3 text-xs text-slate-600 font-medium">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span><strong>Escaneo QR Instantáneo:</strong> Detección en menos de 300 ms con cámara frontal, trasera o externa.</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span><strong>Ingreso Manual por DNI:</strong> Teclado numérico en pantalla para contingencias si el colaborador olvidó su credencial.</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span><strong>Protección Antiduplicado:</strong> Bloqueo automático de 10 minutos para evitar que se fiche dos veces el mismo evento.</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span><strong>Control de Descansos y Licencias:</strong> La terminal avisa y no genera asistencia estándar si la persona está de franco o vacaciones.</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span><strong>Modo Centinela (Offline):</strong> Si se corta internet, las fichadas se guardan de forma local en el dispositivo y se sincronizan solas cuando vuelve la red.</span></li>
              </ul>
            </div>

            <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl space-y-3 text-rose-950">
              <div className="flex items-center gap-2 text-rose-700 font-black text-sm uppercase">
                <ShieldAlert className="w-5 h-5" />
                <span>Salida Protegida por PIN Maestro</span>
              </div>
              <p className="text-xs leading-relaxed font-medium">
                Para que ningún colaborador pueda cerrar la terminal accidental o intencionalmente, el botón <strong>"Salir Terminal"</strong> (arriba a la izquierda) exige ingresar el <strong>PIN de seguridad de Administrador</strong> antes de volver al panel.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: PERSONAL Y CARNETS */}
      <section id="sec-4" className="space-y-6 scroll-mt-24 print:space-y-3">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-emerald-800 rounded-2xl flex items-center justify-center text-white shadow-lg font-black text-lg">4</div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Gestión de Personal y Credenciales</h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium">Legajos, modalidad de contratación y descarga masiva de credenciales en ZIP</p>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-6 md:p-8 shadow-sm space-y-6 break-inside-avoid">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <h4 className="font-black text-xs uppercase text-slate-700">1. Tipo de Personal</h4>
              <p className="text-xs text-slate-600 font-medium">
                Se define al colaborador como <strong>Efectivo</strong> (permanente; elegible para francos compensatorios por domingos/feriados) o <strong>Jornalero</strong>.
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <h4 className="font-black text-xs uppercase text-slate-700">2. Emisión de Credencial</h4>
              <p className="text-xs text-slate-600 font-medium">
                Cada colaborador posee un token QR único y persistente. El carnet se puede previsualizar en pantalla e imprimir directamente.
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <h4 className="font-black text-xs uppercase text-slate-700">3. Descarga Masiva ZIP</h4>
              <p className="text-xs text-slate-600 font-medium">
                Permite exportar en un solo archivo comprimido ZIP los carnets en PNG de todo el sector seleccionado para impresión en lote.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: SCORING DE ASISTENCIA */}
      <section id="sec-5" className="space-y-6 scroll-mt-24 print:space-y-3">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-emerald-800 rounded-2xl flex items-center justify-center text-white shadow-lg font-black text-lg">5</div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Sistema de Scoring (0 a 999 Puntos)</h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium">Evaluación matemática continua de puntualidad y conducta con decaimiento a 90 días</p>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-6 md:p-8 shadow-sm space-y-6 break-inside-avoid">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 bg-slate-900 text-white print:bg-slate-50 print:text-slate-900 print:border print:border-slate-200 print:shadow-none rounded-2xl space-y-3 break-inside-avoid">
              <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400 print:text-emerald-800">Escala de Clases</h4>
              <div className="space-y-1.5 text-xs font-bold">
                <p className="text-purple-300 print:text-purple-800">Clase 0 (990-999): Altamente Puntual</p>
                <p className="text-emerald-300 print:text-emerald-800">Clase 1 (950-989): Excelente</p>
                <p className="text-amber-300 print:text-amber-800">Clase 2 (750-949): Estable</p>
                <p className="text-orange-300 print:text-orange-800">Clase 3 (500-749): Regular</p>
                <p className="text-rose-400 print:text-rose-800">Clase 4 (250-499): Alerta</p>
                <p className="text-slate-400 print:text-slate-600">Clase 5 (0-249): Crónica</p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 break-inside-avoid">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">Descuentos por Infracción</h4>
              <div className="space-y-2 text-xs text-slate-600 font-medium">
                <p><strong>Llegada Tarde:</strong> -20 pts + 1 pt por minuto tarde</p>
                <p><strong>Sin Presentismo:</strong> -100 pts + 1 pt por minuto tarde</p>
                <p><strong>Ausencia Injustificada:</strong> -250 pts fijas</p>
                <p><strong>Licencia Médica:</strong> -20 pts (Tope 100 pts en periodo)</p>
              </div>
            </div>

            <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-3 break-inside-avoid">
              <h4 className="text-xs font-black uppercase tracking-widest text-emerald-800">Antigüedad (Ventana 90 Días)</h4>
              <div className="space-y-2 text-xs text-emerald-950 font-medium">
                <p><strong>Últimos 30 días:</strong> 100% del impacto</p>
                <p><strong>De 31 a 60 días:</strong> 60% del impacto</p>
                <p><strong>De 61 a 90 días:</strong> 30% del impacto</p>
                <p><strong>Más de 90 días:</strong> Caduca (sin descuento)</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: HORARIOS Y FRANCOS */}
      <section id="sec-6" className="space-y-6 scroll-mt-24 print:space-y-3">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-emerald-800 rounded-2xl flex items-center justify-center text-white shadow-lg font-black text-lg">6</div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Cronogramas y Francos Compensatorios</h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium">Plantillas base, turnos cortados, nocturnos y acreditación de francos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4 break-inside-avoid">
            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" />
              Tipos de Turnos Admitidos
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-600 font-medium">
              <li><strong>Turno Corrido:</strong> Una sola entrada y salida continua (ej. 06:00 a 14:00).</li>
              <li><strong>Turno Cortado:</strong> Dos tramos independientes en el día (ej. 08:00 a 12:00 y 16:30 a 20:30).</li>
              <li><strong>Turno Nocturno:</strong> Turnos que cruzan la medianoche; la salida se concilia con la jornada que inició la noche previa.</li>
              <li><strong>Descansos:</strong> Días libres programados en el calendario semanal.</li>
            </ul>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4 break-inside-avoid">
            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              Regla de Francos Compensatorios
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-600 font-medium">
              <li><strong>Acreditación (+1):</strong> El colaborador Efectivo que trabaje un domingo o feriado oficial con fichada real suma 1 franco compensatorio a su saldo.</li>
              <li><strong>Saldo Visible:</strong> Se consulta y gestiona desde la ficha del colaborador.</li>
              <li><strong>Consumo:</strong> Al asignar "Franco Compensatorio" en el cronograma, el saldo se debita únicamente al llegar o transcurrir la fecha.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* SECTION 7: AUDITORÍA Y LIQUIDACIÓN */}
      <section id="sec-7" className="space-y-6 scroll-mt-24 print:space-y-3">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-emerald-800 rounded-2xl flex items-center justify-center text-white shadow-lg font-black text-lg">7</div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Auditoría de Personal y Liquidación</h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium">Resumen mensual, vista calendario interactiva, recálculo y exportación a Excel</p>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-6 md:p-8 shadow-sm space-y-6 break-inside-avoid">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-600" />
                Herramientas de Control Diario
              </h4>
              <ul className="space-y-2 text-xs text-slate-600 font-medium">
                <li><strong>Botón "Recalcular Período":</strong> Si modificas un cronograma hacia el pasado, reprocesa las fichadas y elimina inasistencias prematuras.</li>
                <li><strong>Edición de Hora (✏️):</strong> Permite corregir una marca ante contingencias justificadas.</li>
                <li><strong>Anulación de Fichada (🗑️):</strong> Borra marcas erróneas que bloqueen la fichada correcta.</li>
                <li><strong>Cierre Manual de Jornada:</strong> Completa salidas olvidadas con la hora real de retiro.</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Liquidación de Sueldos
              </h4>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                El módulo de Auditoría consolida las horas trabajadas, minutos de tardanza y faltas de todo el mes. Con el botón de <strong>Exportar CSV / Excel</strong>, se obtiene una planilla lista para importar en el software contable o de liquidación de haberes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 8: LEGAJOS DIGITALES */}
      <section id="sec-8" className="space-y-6 scroll-mt-24 print:space-y-3">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-emerald-800 rounded-2xl flex items-center justify-center text-white shadow-lg font-black text-lg">8</div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Legajos Digitales y Documentación</h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium">Expediente único del colaborador, altas AFIP, certificados y sanciones</p>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-6 md:p-8 shadow-sm space-y-4 break-inside-avoid">
          <p className="text-xs md:text-sm text-slate-600 font-medium leading-relaxed">
            Cada colaborador cuenta con un <strong>Legajo Digital Centralizado</strong> que reúne:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-medium text-slate-700">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <strong className="block text-slate-800 font-black mb-1">Datos Laborales y Familiares:</strong>
              DNI, CUIL, domicilio, contacto de emergencia y modalidad de contratación.
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <strong className="block text-slate-800 font-black mb-1">Documentos y Certificados:</strong>
              Contrato, alta AFIP/ARCA, recibos de sueldo, libreta sanitaria y capacitaciones.
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <strong className="block text-slate-800 font-black mb-1">Historial Disciplinario:</strong>
              Registro de llamados de atención, apercibimientos por escrito y suspensiones con fecha.
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 9: SOLICITUDES RRHH */}
      <section id="sec-9" className="space-y-6 scroll-mt-24 print:space-y-3">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-emerald-800 rounded-2xl flex items-center justify-center text-white shadow-lg font-black text-lg">9</div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Solicitudes de RRHH (HrRequests)</h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium">Licencias médicas con certificado adjunto, vacaciones y permisos especiales</p>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-6 md:p-8 shadow-sm space-y-4 break-inside-avoid">
          <p className="text-xs md:text-sm text-slate-600 font-medium">
            Flujo formal para la carga y resolución de permisos:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium text-slate-700">
            <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100">
              <span className="font-black text-emerald-800 block mb-1">Tipos de Solicitudes:</span>
              Licencias médicas (con subida de foto del certificado médico), vacaciones programadas, solicitud de francos compensatorios y ausencias justificadas.
            </div>
            <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100">
              <span className="font-black text-emerald-800 block mb-1">Aprobación Automática a Cronograma:</span>
              Al ser aprobada por el supervisor, la solicitud impacta de forma automática en el cronograma semanal del colaborador, evitando que la terminal lo marque como ausente.
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 10: FRAUDE Y AUDITORIA */}
      <section id="sec-10" className="space-y-6 scroll-mt-24 print:space-y-3">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-emerald-800 rounded-2xl flex items-center justify-center text-white shadow-lg font-black text-lg">10</div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Auditoría del Sistema y Análisis de Fraude</h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium">Trazabilidad inmutable de cambios y detección de anomalías en fichadas</p>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-6 md:p-8 shadow-sm space-y-4 break-inside-avoid">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h4 className="font-black text-xs uppercase text-slate-700 flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-600" />
                Log de Auditoría (Audit Log)
              </h4>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Toda modificación horaria, cambio de rol o justificación queda registrada con el nombre del supervisor, fecha exacta, valor anterior, valor nuevo y el motivo justificado.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-black text-xs uppercase text-slate-700 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                Detección de Fraude
              </h4>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                El sistema detecta automáticamente marcaciones en tiempos imposibles (ej. dos registros en segundos desde lugares diferentes) y anomalías en el teclado manual.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 11: PWA Y TROUBLESHOOTING */}
      <section id="sec-11" className="space-y-6 scroll-mt-24 print:space-y-3">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-emerald-800 rounded-2xl flex items-center justify-center text-white shadow-lg font-black text-lg">11</div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Instalación PWA y Resolución de Problemas</h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium">Instalación en tabletas, celulares y guía de incidencias comunes</p>
          </div>
        </div>

        {/* Troubleshooting Table */}
        <div className="bg-slate-900 rounded-[2.5rem] p-6 md:p-10 text-white print:bg-white print:text-slate-900 print:border print:border-slate-200 print:shadow-none print:p-5 shadow-2xl space-y-4 break-inside-avoid">
          <h3 className="text-lg font-black tracking-tight text-emerald-400 print:text-emerald-800">Guía de Resolución de Incidencias</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold">
              <thead>
                <tr className="text-emerald-400 print:text-slate-800 border-b border-white/10 print:border-slate-300 uppercase tracking-widest text-[10px]">
                  <th className="pb-3 print:pb-2">Problema detectado</th>
                  <th className="pb-3 print:pb-2">Causa probable</th>
                  <th className="pb-3 print:pb-2">Procedimiento de solución</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 print:divide-slate-200">
                {[
                  { p: "Cámara no activa", c: "Permisos denegados en el navegador", s: "Clic en el candado de la barra de direcciones y habilitar Cámara." },
                  { p: "Cámara incorrecta", c: "Dispositivo con múltiples lentes", s: "Use el botón de cambio de cámara en la pantalla de escaneo." },
                  { p: "QR no leído", c: "Bajo brillo o código dañado", s: "Subir brillo de pantalla o usar 'Ingreso Manual' con DNI." },
                  { p: "Error 'Ya fichó'", c: "Doble marcación en <10 minutos", s: "Aguardar a que expire la ventana de protección antiduplicado." },
                  { p: "Acceso por PIN bloqueado", c: "Protección de modo terminal", s: "Ingresar el PIN maestro de seguridad de administrador." },
                  { p: "Fichadas en ámbar", c: "Corte de conexión a internet", s: "La terminal sigue operando offline y sincronizará sola al volver la red." },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-white/5 print:hover:bg-transparent transition-colors">
                    <td className="py-3.5 pr-4 text-white print:text-slate-900 print:py-2">{row.p}</td>
                    <td className="py-3.5 pr-4 text-slate-400 print:text-slate-600 italic font-medium print:py-2">{row.c}</td>
                    <td className="py-3.5 text-emerald-300 print:text-emerald-800 print:py-2">{row.s}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SECTION FAQ */}
      <section id="sec-faq" className="space-y-6 scroll-mt-24 print:space-y-3">
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-3">
            <HelpCircle className="w-7 h-7 text-emerald-700" />
            Preguntas Frecuentes
          </h2>
          <p className="text-xs md:text-sm text-slate-500 font-medium">Respuestas rápidas para el día a día operativo</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { 
              q: "¿Las credenciales impresas pierden vigencia?", 
              a: "No. El código QR está vinculado de forma persistente al DNI. Sirve indefinidamente mientras el colaborador continúe activo." 
            },
            { 
              q: "¿Qué pasa si se corta la luz o internet en el local?", 
              a: "La terminal entra en Modo Centinela (Offline). Continúa escaneando y registra las fichadas localmente; al regresar la red se sincronizan solas sin perderse datos." 
            },
            { 
              q: "¿Cómo corregir si un empleado olvidó fichar su salida?", 
              a: "Desde el módulo de Auditoría de Personal, el supervisor puede realizar un cierre manual ingresando la hora real de retiro." 
            },
            { 
              q: "¿Puedo auditar quién modificó un horario pasado?", 
              a: "Sí. Toda modificación horaria queda registrada con nombre del supervisor, fecha exacta y motivo en el módulo de Auditoría del Sistema." 
            }
          ].map((item, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-2 hover:border-emerald-200 transition-colors break-inside-avoid">
              <h4 className="font-black text-sm text-slate-800">{item.q}</h4>
              <p className="text-slate-600 font-medium text-xs leading-relaxed italic">"{item.a}"</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center pt-8 pb-16 space-y-3 print:pt-4 print:pb-4 border-t border-slate-200 print:border-slate-300 break-inside-avoid">
        <div className="flex items-center justify-center space-x-2 text-emerald-800">
           <ShieldCheck className="w-5 h-5" />
           <span className="font-black tracking-tight text-sm">SECUREQR • SISTEMA DE ASISTENCIAS</span>
        </div>
        <div className="flex flex-col items-center space-y-0.5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Documentación Operativa Oficial</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Versión 2.1.0 • 2026</p>
        </div>
      </footer>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: portrait;
            margin: 12mm 10mm;
          }

          html, body {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
          }

          aside, nav, button, .no-print, .print-hidden {
            display: none !important;
          }

          main, .min-h-screen, .flex, .overflow-auto, .overflow-hidden {
            display: block !important;
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
            position: static !important;
            min-height: 0 !important;
          }

          h1, h2, h3, h4 {
            color: #0f172a !important;
            page-break-after: avoid;
            break-after: avoid;
          }

          p, span, td, div {
            color: #1e293b;
          }

          section {
            margin-bottom: 1.25rem !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }

          .break-inside-avoid,
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .bg-slate-900 {
            background-color: #f8fafc !important;
            color: #0f172a !important;
            border: 1px solid #cbd5e1 !important;
          }

          .bg-slate-900 * {
            color: #0f172a !important;
          }

          .shadow-sm, .shadow-md, .shadow-xl, .shadow-2xl {
            box-shadow: none !important;
          }

          .rounded-\\[2\\.5rem\\],
          .rounded-\\[2rem\\] {
            border-radius: 12px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ManualView;
