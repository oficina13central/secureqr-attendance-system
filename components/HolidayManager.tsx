import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Plus, Trash2, CalendarDays, CheckCircle2, AlertCircle } from 'lucide-react';
import { compensatoryRestService } from '../services/compensatoryRestService';
import { Holiday } from '../types';

const HolidayManager: React.FC = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    setLoading(true);
    const data = await compensatoryRestService.getHolidays();
    setHolidays(data);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newHoliday.date || !newHoliday.name) {
      setMessage({ text: 'Por favor, completa fecha y nombre.', type: 'error' });
      return;
    }

    setSaving(true);
    const success = await compensatoryRestService.addHoliday(newHoliday.date, newHoliday.name);
    if (success) {
      setMessage({ text: 'Feriado agregado correctamente.', type: 'success' });
      setNewHoliday({ date: '', name: '' });
      await fetchHolidays();
    } else {
      setMessage({ text: 'Error al agregar feriado. Tal vez ya existe.', type: 'error' });
    }
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDelete = async (id: string, date: string) => {
    // Verificar si hay créditos automáticos generados para este feriado
    const credits = await compensatoryRestService.getAutomaticCreditsForDate(date);
    
    let confirmMsg = '¿Estás seguro de eliminar este feriado?';
    if (credits.length > 0) {
      confirmMsg = `Este feriado ya generó ${credits.length} crédito(s) automático(s) de franco compensatorio.\n\n¿Desea eliminar el feriado Y revertir esos créditos?\n\n• Aceptar = Elimina feriado + revierte créditos\n• Cancelar = No hace nada`;
    }

    if (!confirm(confirmMsg)) return;

    setSaving(true);
    try {
      // Si hay créditos, revertirlos primero
      if (credits.length > 0) {
        const reversed = await compensatoryRestService.reverseAutomaticCreditsForDate(date);
        if (reversed > 0) {
          setMessage({ text: `Se revirtieron ${reversed} crédito(s) automático(s).`, type: 'success' });
        }
      }

      // Luego eliminar el feriado
      const success = await compensatoryRestService.deleteHoliday(id);
      if (success) {
        await fetchHolidays();
        setMessage({ text: credits.length > 0
          ? `Feriado eliminado y ${credits.length} crédito(s) revertido(s) correctamente.`
          : 'Feriado eliminado correctamente.', type: 'success' });
      } else {
        setMessage({ text: 'Error al eliminar el feriado.', type: 'error' });
      }
    } catch (err) {
      console.error('Error deleting holiday:', err);
      setMessage({ text: 'Error inesperado al procesar la eliminación.', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Form Card */}
        <div className="lg:col-span-1 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 space-y-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-3 bg-violet-50 rounded-2xl text-violet-600">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-slate-800">Nuevo Feriado</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Fecha</label>
              <input
                type="date"
                value={newHoliday.date}
                onChange={e => setNewHoliday({ ...newHoliday, date: e.target.value })}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Nombre del Feriado</label>
              <input
                type="text"
                placeholder="Ej: Día de la Independencia"
                value={newHoliday.name}
                onChange={e => setNewHoliday({ ...newHoliday, name: e.target.value })}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all"
              />
            </div>

            <button
              onClick={handleAdd}
              disabled={saving}
              className="w-full py-5 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-black text-lg shadow-lg shadow-violet-500/20 transition-all flex items-center justify-center gap-2"
            >
              {saving ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Plus className="w-6 h-6" />}
              Agregar Feriado
            </button>
            
            {message && (
              <div className={`flex items-center space-x-2 p-4 rounded-xl animate-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span className="font-bold text-xs">{message.text}</span>
              </div>
            )}
          </div>
        </div>

        {/* List Card */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-slate-50 rounded-2xl text-slate-400">
                <CalendarDays className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Calendario Oficial</h3>
            </div>
            <span className="px-4 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-widest">
              {holidays.length} Días Registrados
            </span>
          </div>

          <div className="p-4 flex-1 overflow-y-auto max-h-[400px]">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
              </div>
            ) : holidays.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-slate-400 font-bold italic uppercase tracking-widest text-xs">No hay feriados cargados</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {holidays.map(holiday => (
                  <div key={holiday.id} className="group bg-slate-50/50 hover:bg-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between transition-all hover:shadow-md">
                    <div>
                      <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest mb-1">
                        {new Date(holiday.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                      <p className="font-black text-slate-700 leading-tight">{holiday.name}</p>
                    </div>
                    <button 
                      onClick={() => handleDelete(holiday.id, holiday.date)}
                      className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-6 bg-slate-50 border-t border-slate-100">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <AlertCircle className="w-3 h-3" /> Los días marcados aquí generarán créditos automáticos según la "Regla de Oro"
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default HolidayManager;
