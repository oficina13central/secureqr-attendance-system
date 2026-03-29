import { AttendanceRecord, FraudReport } from '../types';
import { attendanceService } from './attendanceService';
import { auditService } from './auditService';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
// Usamos gemini-1.5-flash para máxima velocidad y estabilidad regional
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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

      if (!GEMINI_API_KEY || GEMINI_API_KEY === 'PLACEHOLDER_API_KEY') {
        throw new Error('API_KEY_NOT_CONFIGURED');
      }

      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.1, // Baja creatividad para resultados más exactos
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 2048,
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Gemini API Error details:', errorData);
        throw new Error(`Error en la comunicación con Gemini: ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error('No se recibió texto de la IA');
      }
      
      // Limpiar el markdown si Gemini lo incluye (regex más robusta)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se encontró un bloque JSON válido en la respuesta');
      }

      return JSON.parse(jsonMatch[0]) as FraudReport;

    } catch (error: any) {
      console.error('Error en el análisis de fraude cruzado:', error);
      
      const isMissingKey = error.message === 'API_KEY_NOT_CONFIGURED';

      return {
        risk_level: 'bajo',
        summary: isMissingKey 
          ? 'Análisis desactivado: No se ha configurado la API Key de Gemini.' 
          : 'No se pudo realizar el análisis de IA en este momento.',
        anomalies: isMissingKey 
          ? ['Configuración pendiente de VITE_GEMINI_API_KEY'] 
          : ['Error de conexión cruzada con el servicio de IA'],
        recommendations: isMissingKey 
          ? ['Obtenga una API Key gratuita en https://aistudio.google.com/ e instálela en su archivo .env.local'] 
          : ['Verifique su conexión a internet y el estado de la cuota de la API Key.']
      };
    }
  }
};
