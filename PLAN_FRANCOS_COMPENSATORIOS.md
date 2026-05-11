# Plan de reconstruccion: francos compensatorios

## Estado actual observado

El repositorio no tiene un plan funcional especifico para francos compensatorios. La documentacion general menciona cronogramas, asistencia y configuracion, pero no define una regla contable completa ni el contrato de base de datos para el modulo.

La logica actual esta repartida en:

- `components/ScheduleView.tsx`: muestra saldos, dispara una sincronizacion automatica al abrir el cronograma y registra usos manuales.
- `services/compensatoryRestService.ts`: intenta acreditar automaticamente por domingos/feriados y sincroniza el saldo desde el ledger.
- `components/EmployeeFileModal.tsx`: muestra movimientos y permite ajustes manuales.
- `components/SettingsView.tsx`: habilita/deshabilita el modulo.
- `database_schema.sql`: esta desactualizado para este modulo; no documenta `compensatory_rest_ledger`, `compensatory_rest_balance` ni todos los tipos actuales de cronograma.

## Problema de fondo

El credito de francos compensatorios hoy depende de que alguien abra la vista de Cronogramas. Eso vuelve al calculo fragil:

- Si no se abre la semana correcta, no se concilia.
- Si el efecto de React no corre o queda bloqueado por su llave interna, no acredita.
- Si hay muchas fichadas, cruces de identidad o fechas con formatos diferentes, puede fallar en silencio.
- Si ya existe un movimiento pero el saldo guardado no coincide, la UI puede seguir mostrando un saldo viejo.
- No hay una pantalla o rutina administrativa que diga: "estos empleados trabajaron domingo/feriado, estos cobraron credito, estos quedaron pendientes y por que".

## Regla funcional propuesta

Un empleado efectivo suma 1 franco compensatorio cuando:

1. Tiene turno laboral asignado para un domingo o feriado, ya sea por cronograma explicito o plantilla base.
2. El dia ya paso.
3. Tiene al menos una fichada real de entrada (`check_in`) en ese dia.
4. No es jornalero.
5. No esta en descanso, franco compensatorio, suspension, vacaciones o licencia.
6. No existe ya un credito automatico para ese empleado y esa fecha.

No debe sumar credito si:

- Tenia turno asignado pero no marco entrada.
- El turno del domingo/feriado empieza a las 19:00 o mas tarde, porque contabilmente corresponde a la jornada del dia siguiente.
- Estaba asignado como descanso, vacaciones, licencia, suspension o franco compensatorio.
- Es jornalero.
- La fecha aun no paso.
- Ya se acredito antes esa misma fecha.

Regla de consumo de Franco C.:

- Asignar un Franco C. a una fecha futura no debe descontar saldo en el momento de la carga.
- El descuento se aplica cuando la fecha del Franco C. llega o ya paso.
- Si existiera un movimiento de uso cargado prematuramente para una fecha futura, el saldo efectivo debe ignorarlo hasta que llegue esa fecha.

Regla nocturna especial:

- Si el turno empieza el sabado desde las 19:00 y termina el domingo, corresponde 1 franco compensatorio porque parte de la jornada cae en domingo.
- La misma regla aplica para la noche previa a un feriado.

## Arquitectura propuesta

Crear un motor unico de conciliacion de francos compensatorios en el servicio, independiente de la UI.

### 1. Resolver dias elegibles

Crear una funcion que reciba un rango de fechas y construya los turnos efectivos por empleado:

- Primero usa `schedules` explicitamente cargados.
- Si no hay schedule explicito, usa `profiles.default_schedule`.
- Normaliza la fecha a `YYYY-MM-DD`.
- Excluye tipos no laborales.

### 2. Resolver evidencia de trabajo

Crear una funcion que consulte fichadas reales por rango y empleado:

- Buscar por `employee_id` como fuente principal.
- Tener fallback por DNI o nombre solo para registros historicos inconsistentes.
- Requerir `check_in IS NOT NULL`.
- Normalizar fechas por `substring(0, 10)`.
- Paginar resultados.

### 3. Conciliar credito

Crear una funcion idempotente:

`reconcileCompensatoryCredits(startDate, endDate, managerName)`

Debe:

- Evaluar todos los empleados efectivos.
- Detectar domingos y feriados del rango.
- Determinar si corresponde credito.
- Insertar en `compensatory_rest_ledger` solo si no existe movimiento automatico para empleado+fecha.
- Recalcular `profiles.compensatory_rest_balance` desde el ledger.
- Devolver un resumen: creados, ya existentes, omitidos y motivos.

### 4. Agregar una accion administrativa visible

En Cronogramas o Ajustes:

- Boton "Recalcular francos del periodo".
- Mostrar resumen claro:
  - Acreditados.
  - Ya acreditados.
  - Sin fichada.
  - Sin turno laboral.
  - Jornalero.
  - Error de datos.

Esto evita depender de un efecto automatico invisible.

### 5. Mantener sincronizacion automatica, pero como apoyo

El `useEffect` de `ScheduleView` puede quedar, pero debe llamar al nuevo conciliador por rango. No debe contener reglas propias ni ser la unica forma de acreditar.

### 6. Actualizar contrato de base de datos

Agregar migracion/documentacion para:

- `profiles.compensatory_rest_balance`.
- `compensatory_rest_ledger`.
- Tipos actuales de `schedules`: `continuous`, `split`, `off`, `vacation`, `medical`, `compensatory`, `suspension`.
- Tipos actuales de `attendance_records.status`.
- Indice o restriccion recomendada para evitar credito automatico duplicado por empleado y fecha.

## Orden de trabajo sugerido

1. Documentar y confirmar la regla funcional con casos reales.
2. Crear pruebas unitarias o de servicio para la conciliacion.
3. Implementar el motor `reconcileCompensatoryCredits`.
4. Reemplazar la sincronizacion invisible de `ScheduleView` por llamada al motor.
5. Agregar boton manual de recalculo con resumen.
6. Actualizar schema/migracion.
7. Validar con el caso `10/05/2026`:
   - Isaac Gomez.
   - Todos los empleados con turno laboral domingo.
   - Empleados con domingo asignado pero sin fichada.
   - Empleados con descanso/vacaciones/licencia.
   - Jornaleros.

## Criterio de aceptacion

Para la semana `10/05/2026 - 16/05/2026`:

- Todo empleado efectivo que trabajo y marco entrada el domingo `10/05/2026` debe tener un movimiento `+1` en ledger.
- Todo empleado con turno domingo pero sin `check_in` debe quedar listado como omitido por "sin fichada".
- El saldo mostrado en Cronogramas debe coincidir con la suma del ledger.
- Ejecutar el recalculo dos veces no debe duplicar creditos.
