# 📖 Guía Maestra del Proyecto: SecureQR Attendance System

Este documento actúa como la **memoria técnica y funcional** del proyecto. Su objetivo es proporcionar contexto completo a cualquier desarrollador o asistente de IA (como Antigravity) que trabaje en este repositorio en el futuro, independientemente de la máquina donde se encuentre.

---

## 🚀 Visión General
**SecureQR** es un sistema avanzado de control de asistencias diseñado para entornos corporativos con múltiples sectores. Utiliza tecnologas modernas para garantizar la seguridad, trazabilidad y facilidad de uso.

- **Stack**: React (Vite) + TypeScript + Tailwind CSS / Vanilla CSS.
- **Backend**: Supabase (PostgreSQL + Auth + Realtime).
- **Core**: Identificación mediante Tokens QR dinámicos y validación de geolocalización/terminal.

---

## 🏗️ Arquitectura y Lógica de Negocio

### 1. Gestión de Personal (Personnel)
- Los empleados se organizan por **Sectores**.
- Cada empleado tiene un **DNI**, **Email** y un **Rol** asignado.
- Soporte para **Encargados Multi-Sector**: Un manager puede supervisar su sector primario y una lista de sectores adicionales (`managed_sectors`).

### 2. Sistema de Cronogramas (Schedules)
- Implementación de turnos flexibles: **Continuos**, **Partidos**, **Franco** y **Vacaciones**.
- **Lógica de Vacaciones**: Asignación por rango de fechas que marca automáticamente todos los días intermedios.
- **Detección de Ausencias**: Una ausencia se marca solo si hay un turno programado y el empleado no registra entrada después de un periodo de gracia (configurable en Ajustes).

### 3. Asistencia y Reglas (Attendance)
Los estados de asistencia se calculan en base a umbrales configurables:
- **En Horario**: Margen de gracia inicial (ej: 5 min).
- **Tarde**: Exceso sobre el margen de gracia (ej: >5 min).
- **Ausente**: Superado el límite de tolerancia (ej: >120 min sin fichar).
- **Manual**: Registros corregidos por un administrador con motivo obligatorio.

### 4. Seguridad y Auditoría (Audit & User Management)
- **Logs de Sistema**: Cada acción administrativa (cambio de horario, edición de perfil, ajuste de reglas) queda registrada con: `Manager`, `Empleado afectado`, `Acción`, `Valor anterior`, `Valor nuevo` y `Motivo`.
- **Gestión de Cuentas**:
    - **Suspensión**: Bloqueo temporal (con fecha de expiración) o permanente del acceso.
    - **Soft Delete**: Los usuarios "eliminados" se archivan (`deleted_at`) para no perder el histórico de asistencias.
- **Recuperación de Clave**: Flujo integrado de recuperación vía email que abre un modal de nueva contraseña al regresar a la aplicación (`App.tsx` escucha el evento `PASSWORD_RECOVERY`).

### 5. Análisis de Fraude e IA
- Módulo que detecta anomalías en las marcaciones (ej: múltiples intentos fallidos, ubicaciones inusuales, patrones de tiempo sospechosos).
- Integración con **Google Gemini AI** para análisis predictivo (requiere `VITE_GEMINI_API_KEY`).
- Clasificación de riesgo: **Bajo**, **Medio**, **Alto**.

---

## 📱 Optimización para Dispositivos (Mobile & Tablet)
El **Modo Terminal** ha sido optimizado para su uso en tablets de recepción y celulares:
- **Layout Flexible**: El contenedor de cámara se adapta al alto de la pantalla.
- **Safe Area**: Configuración de márgenes para dispositivos con notch.
- **Animaciones`: Barra de escaneo dinámico basada en porcentajes (`top: 100%`).
- **Touch Targets`: Botones sobredimensionados para facilitar el fichaje con una sola mano.

---

## ☁️ Despliegue y Backup (Cloud Strategy)
- **GitHub**: Repositorio centralizado para el código. Se debe hacer `Push` después de cada sesión importante para no perder el historial de chat de Antigravity (que es local).
- **Vercel**: Hosting productivo automatizado. Conectado directamente a la rama `main` de GitHub.
- **Supabase**: Base de datos y Auth en la nube (seguro frente a fallos de hardware local).
- **Variables de Entorno**: Es vital configurar `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_GEMINI_API_KEY` en el panel de Vercel.

---

## 📋 Funcionalidades Implementadas (Historial)

1.  **Módulo de Usuarios**: Suspensión de cuentas y gestión de roles dinámica.
2.  **Calendario de Asistencia**: Vista visual de presentismo mensual por empleado.
3.  **DNI y Manual Entry**: Campo DNI en perfiles y posibilidad de cargar fichadas manualmente.
4.  **Vacaciones Progresivas**: Herramienta de asignación masiva de días de vacaciones.
5.  **Multi-Sector Management**: Refactorización para que los encargados controlen múltiples áreas.
6.  **Recuperación de Password**: Pantalla de "Acceso Bloqueado" y flujo de reset de clave.
7.  **Terminal Mobile-First**: Rediseño táctil completo del lector de accesos.

---

## 📝 Notas para el Futuro Desarrollo
- **Sincronización**: Al abrir este proyecto en una PC nueva, correr `git pull` y `npm install`.
- **Auditoría**: Siempre que se modifique un dato sensible, usar `auditService.logAction`.
- **Contexto**: Este documento es la fuente de verdad del proyecto. Leerlo antes de iniciar cualquier cambio estructural.

---
*Este documento fue generado por Antigravity en colaboración con el Administrador del proyecto (Isaac) para preservar el contexto histórico de la aplicación.*
