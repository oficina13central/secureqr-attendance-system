import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Layers, Check, X } from 'lucide-react';
import { sectorService, Sector } from '../services/sectorService';

const SectorManager: React.FC = () => {
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', description: '' });

    useEffect(() => {
        fetchSectors();
    }, []);

    const fetchSectors = async () => {
        setLoading(true);
        const data = await sectorService.getAll();
        setSectors(data);
        setLoading(false);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        const success = await sectorService.create(formData);
        if (success) {
            fetchSectors();
            setFormData({ name: '', description: '' });
            setIsAdding(false);
        }
    };

    const handleUpdate = async (id: string) => {
        const success = await sectorService.update(id, formData);
        if (success) {
            setEditingId(null);
            fetchSectors();
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('¿Estás seguro de eliminar este sector? Los empleados asociados podrían quedar sin sector.')) {
            const success = await sectorService.delete(id);
            if (success) fetchSectors();
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                        <Layers className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800">Sectores de la Empresa</h3>
                        <p className="text-xs text-slate-500 font-medium">Gestiona las áreas de trabajo de tu empresa.</p>
                    </div>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Nuevo Sector</span>
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4">
                {isAdding && (
                    <form onSubmit={handleCreate} className="bg-white border-2 border-dashed border-indigo-200 rounded-3xl p-6 flex flex-col md:flex-row items-end gap-4 animate-in zoom-in-95">
                        <div className="flex-1 space-y-2 w-full">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nombre del Sector</label>
                            <input
                                autoFocus
                                type="text"
                                placeholder="Ej: Pastelería, Ventas..."
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div className="flex-1 space-y-2 w-full">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Descripción (Opcional)</label>
                            <input
                                type="text"
                                placeholder="Breve detalle del área"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div className="flex space-x-2">
                            <button type="submit" className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"><Check className="w-5 h-5" /></button>
                            <button type="button" onClick={() => setIsAdding(false)} className="p-3 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200"><X className="w-5 h-5" /></button>
                        </div>
                    </form>
                )}

                {loading ? (
                    <div className="py-12 text-center text-slate-400 animate-pulse font-medium">Cargando sectores...</div>
                ) : sectors.length === 0 ? (
                    <div className="py-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] text-center text-slate-400">
                        <p className="font-bold">No hay sectores configurados.</p>
                        <p className="text-[10px] uppercase mt-1">Haga clic en 'Nuevo Sector' para comenzar.</p>
                    </div>
                ) : (
                    sectors.map(sector => (
                        <div key={sector.id} className="group bg-white border border-slate-100 rounded-2xl p-5 flex items-center justify-between hover:shadow-md transition-all">
                            <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors font-black">
                                    {sector.name.charAt(0)}
                                </div>
                                {editingId === sector.id ? (
                                    <div className="flex flex-col md:flex-row gap-2">
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold"
                                        />
                                        <input
                                            type="text"
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <h4 className="font-black text-slate-700">{sector.name}</h4>
                                        <p className="text-xs text-slate-400">{sector.description || 'Sin descripción'}</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center space-x-2">
                                {editingId === sector.id ? (
                                    <>
                                        <button onClick={() => handleUpdate(sector.id)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"><Check className="w-4 h-4" /></button>
                                        <button onClick={() => setEditingId(null)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100 transition-colors"><X className="w-4 h-4" /></button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => {
                                                setEditingId(sector.id);
                                                setFormData({ name: sector.name, description: sector.description || '' });
                                            }}
                                            className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(sector.id)}
                                            className="p-3 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default SectorManager;
