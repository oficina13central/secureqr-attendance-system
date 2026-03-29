import { AttendanceRecord, FraudReport } from '../types';
import { attendanceService } from './attendanceService';
import { auditService } from './auditService';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

export const fraudService = {
  async analyzeRecentAttendance(): Promise<FraudReport> {
    try {
      const [records, auditLogs] = await Promise.all([
        attendanceService.getAll(),
        auditService.getAll()
      ]);
      
      // Tomar los últimos 100 registros de asistencia y 50 logs de auditoría
      const recentRecords = records.slice(0, 100);
      const recentLogs = auditLogs.slice(0, 50);

      const prompt = `
        Analiza detalladamente los siguientes datos cruzados de la empresa y detecta posibles patrones de fraude, favoritismos o anomalías severas.
        Debes prestar especial atención a correlaciones sospechosas (ej: un encargado modificando manualmente de forma constante el cronograma o asistencias de un empleado específico, justificativos repetitivos, marcas simultáneas, etc).
        
        [REGISTROS DE ASISTENCIA RECIENTES]
        ${JSON.stringify(recentRecords, null, 2)}

        [REGISTRO DE AUDITORÍA (MODIFICACIONES MANUALES POSIBLES)]
        ${JSON.stringify(recentLogs, null, 2)}
        
        Analiza a fondo la relación estructural entre quién modifica algo y quién asiste o falta. Responde ÚNICAMENTE en formato JSON estricto con la siguiente estructura:
        {
          "risk_level": "bajo" | "medio" | "alto",
          "summary": "Resumen ejecutivo del análisis (menciona si hay actividad inusual de encargados)",
          "anomalies": ["Lista de anomalías detectadas. Sé muy específico sobre fechas, nombres de infractor, o encargado involucrado en modificaciones."],
          "recommendations": ["Lista de recomendaciones para el administrador (ej. bloquear edición de ciertos usuarios, investigar a tal persona, etc.)"]
        }
      `;

      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error('Error en la comunicación con Gemini');
      }

      const data = await response.json();
      const text = data.candidates[0].content.parts[0].text;
      
      // Limpiar el markdown si Gemini lo incluye
      const jsonStr = text.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonStr) as FraudReport;

    } catch (error) {
      console.error('Error en el análisis de fraude cruzado:', error);
      return {
        risk_level: 'bajo',
        summary: 'No se pudo realizar el análisis de IA en este momento.',
        anomalies: ['Error de conexión cruzada con el servicio de IA y los registros de auditoría'],
        recommendations: ['Verifique su conexión a internet y la configuración de la API Key.']
      };
    }
  }
};
