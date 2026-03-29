
import { auditService } from './services/auditService';
import { attendanceService } from './services/attendanceService';
import { supabase } from './services/supabaseClient';
import { getLocalDateString } from './utils/dateUtils';

async function seedFraudScenario() {
  console.log('--- Iniciando Simulación de Fraude ---');
  
  // 1. Obtener un empleado real o crear uno para el test
  const { data: profiles } = await supabase.from('profiles').select('id, full_name').limit(1);
  if (!profiles || profiles.length === 0) {
    console.error('No hay perfiles para simular fraudes.');
    return;
  }
  
  const emp = profiles[0];
  const today = getLocalDateString();
  const managerName = "Juan Encargado (Simulado)";

  console.log(`Simulando actividad sospechosa para: ${emp.full_name}`);

  // 2. Crear registros de auditoría sospechosos (Modificaciones masivas)
  const auditActions = [
    {
      manager_name: managerName,
      employee_name: emp.full_name,
      action: 'Modificación de Asistencia',
      old_value: 'tarde',
      new_value: 'en_horario',
      reason: 'Error de sistema (Genérico - SOSPECHOSO)'
    },
    {
      manager_name: managerName,
      employee_name: emp.full_name,
      action: 'Justificación Manual',
      old_value: 'ausente',
      new_value: 'descanso',
      reason: 'Pedido por el empleado (Sin comprobante - SOSPECHOSO)'
    },
    {
      manager_name: managerName,
      employee_name: emp.full_name,
      action: 'Cambio de Cronograma Retroactivo',
      old_value: 'continuous',
      new_value: 'off',
      reason: 'Ajuste de sector'
    }
  ];

  for (const action of auditActions) {
    await auditService.logAction(action);
    console.log(`Log de auditoría creado: ${action.action}`);
  }

  // 3. Crear registro de asistencia manual
  await supabase.from('attendance_records').insert([{
    id: crypto.randomUUID(),
    employee_id: emp.id,
    employee_name: emp.full_name,
    date: today,
    check_in: new Date().toISOString(),
    status: 'manual',
    minutes_late: 0,
    manual_reason: 'Marcado por Juan Encargado'
  }]);

  console.log('--- Simulación completada ---');
  console.log('Ahora podés pulsar en "NUEVO ANÁLISIS" en la app para ver el reporte de la IA.');
}

seedFraudScenario().catch(console.error);
