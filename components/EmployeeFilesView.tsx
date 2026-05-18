import React, { useMemo, useState } from 'react';
import { Briefcase, FileText, Search, User, Building2, CalendarDays } from 'lucide-react';
import { Profile } from '../types';
import EmployeeFileModal from './EmployeeFileModal';

type EmployeeFilesViewProps = {
  employees: Profile[];
  currentUser: Profile;
};

const getEmploymentTypeLabel = (type?: string) => type === 'jornalero' ? 'Jornalero' : 'Efectivo';

const getContractTypeLabel = (type?: string | null) => {
  if (type === 'permanent') return 'Permanente';
  if (type === 'temporary') return 'Temporal';
  if (type === 'contractor') return 'Contratista';
  if (type === 'internship') return 'Pasantia';
  return 'Sin definir';
};

const getTenureLabel = (hireDate?: string | null) => {
  if (!hireDate) return 'Sin fecha';
  const start = new Date(`${hireDate}T12:00:00`);
  const today = new Date();
  if (Number.isNaN(start.getTime()) || start > today) return 'Sin fecha';
  let years = today.getFullYear() - start.getFullYear();
  let months = today.getMonth() - start.getMonth();
  if (today.getDate() < start.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years <= 0 && months <= 0) return 'Menos de 1 mes';
  if (years <= 0) return `${months} mes${months !== 1 ? 'es' : ''}`;
  return `${years} ano${years !== 1 ? 's' : ''}`;
};

const EmployeeFilesView: React.FC<EmployeeFilesViewProps> = ({ employees, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmploymentType, setSelectedEmploymentType] = useState<'all' | 'efectivo' | 'jornalero'>('all');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const canManageGlobal = currentUser.role === 'superusuario' || currentUser.roles?.permissions?.includes('MANAGE_PERSONNEL');
  const accessibleSectorIds = useMemo(() => {
    const ids = new Set<string>();
    if (currentUser.sector_id) ids.add(currentUser.sector_id);
    (currentUser.managed_sectors || []).forEach(id => ids.add(id));
    return ids;
  }, [currentUser.managed_sectors, currentUser.sector_id]);

  const scopedEmployees = useMemo(() => {
    if (canManageGlobal) return employees;
    return employees.filter(employee => employee.sector_id && accessibleSectorIds.has(employee.sector_id));
  }, [accessibleSectorIds, canManageGlobal, employees]);

  const filteredEmployees = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return scopedEmployees.filter(employee => {
      const matchesType = selectedEmploymentType === 'all' || (employee.employment_type || 'efectivo') === selectedEmploymentType;
      const matchesSearch = !term ||
        employee.full_name.toLowerCase().includes(term) ||
        (employee.dni || '').includes(term) ||
        (employee.job_position || '').toLowerCase().includes(term) ||
        (employee.job_category || '').toLowerCase().includes(term);

      return matchesType && matchesSearch;
    });
  }, [scopedEmployees, searchTerm, selectedEmploymentType]);

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xl shadow-slate-300">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase">Legajos</h1>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Expedientes laborales y documentacion de RRHH</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar empleado, DNI, puesto..."
              className="w-full sm:w-80 pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm font-bold text-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-sm"
            />
          </div>
          <select
            value={selectedEmploymentType}
            onChange={event => setSelectedEmploymentType(event.target.value as any)}
            className="px-4 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-black uppercase text-slate-600 shadow-sm"
          >
            <option value="all">Todos los tipos</option>
            <option value="efectivo">Efectivo</option>
            <option value="jornalero">Jornalero</option>
          </select>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expedientes visibles</p>
          <p className="text-3xl font-black text-slate-800 mt-1">{filteredEmployees.length}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin fecha de ingreso</p>
          <p className="text-3xl font-black text-amber-600 mt-1">{filteredEmployees.filter(emp => !emp.hire_date).length}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin puesto/categoria</p>
          <p className="text-3xl font-black text-rose-600 mt-1">{filteredEmployees.filter(emp => !emp.job_position || !emp.job_category).length}</p>
        </div>
      </section>

      <section className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Bandeja de expedientes</p>
          <h2 className="text-xl font-black text-slate-800">Acceso directo a legajos laborales</h2>
        </div>

        {filteredEmployees.length === 0 ? (
          <div className="p-10 text-center text-slate-400 font-bold">No hay legajos para estos filtros.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredEmployees.map(employee => {
              const missingCount = [
                !employee.hire_date,
                !employee.job_position,
                !employee.job_category,
                !employee.contract_type
              ].filter(Boolean).length;

              return (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => setSelectedEmployeeId(employee.id)}
                  className="w-full p-5 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                        {employee.photo_url ? (
                          <img src={employee.photo_url} alt="" className="w-full h-full object-cover rounded-2xl" />
                        ) : (
                          <User className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-black text-slate-800 uppercase tracking-tight truncate">{employee.full_name}</h3>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs font-bold text-slate-400">
                          <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> DNI {employee.dni || 'N/A'}</span>
                          <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {employee.sector_id || 'Sin sector'}</span>
                          <span>{getEmploymentTypeLabel(employee.employment_type)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:min-w-[520px]">
                      <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ingreso</p>
                        <p className="text-xs font-black text-slate-700">{employee.hire_date || 'Sin fecha'}</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Antiguedad</p>
                        <p className="text-xs font-black text-slate-700">{getTenureLabel(employee.hire_date)}</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Puesto</p>
                        <p className="text-xs font-black text-slate-700 truncate">{employee.job_position || 'Sin puesto'}</p>
                      </div>
                      <div className={`${missingCount > 0 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'} border rounded-xl px-3 py-2`}>
                        <p className={`text-[8px] font-black uppercase tracking-widest ${missingCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>Estado</p>
                        <p className={`text-xs font-black ${missingCount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{missingCount > 0 ? `${missingCount} pendientes` : 'Completo'}</p>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedEmployeeId && (
        <EmployeeFileModal
          employeeId={selectedEmployeeId}
          managerName={currentUser.full_name || 'Admin'}
          managerRole={currentUser.role}
          onClose={() => setSelectedEmployeeId(null)}
        />
      )}
    </div>
  );
};

export default EmployeeFilesView;
