import { AttendanceRecord, FraudReport } from '../types';
import { attendanceService } from './attendanceService';
import { auditService } from './auditService';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
// Usamos v1beta ya que es la que soporta los modelos 1.5 Flash y Pro actualmente
const GEMINI_BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models`;

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

      const callGemini = async (model: string) => {
        const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 2048,
            }
          })
        });
        return response;
      };

      // Intentar primero con gemini-1.5-flash
      let response = await callGemini('gemini-1.5-flash');
      
      // Si falla con 404, intentar con gemini-pro (el alias más compatible para v1/v1beta)
      if (response.status === 404) {
        console.warn('gemini-1.5-flash no encontrado (404), intentando fallback con gemini-pro...');
        response = await callGemini('gemini-pro');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Gemini API Error details:', errorData);
        throw new Error(`Error en la comunicación con Gemini: ${response.status} ${errorData.error?.message || ''}`);
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
      console.error('Error en el análisis de fraude:', error);
      
      const isMissingKey = error.message === 'API_KEY_NOT_CONFIGURED';
      const keySnippet = GEMINI_API_KEY && GEMINI_API_KEY !== 'PLACEHOLDER_API_KEY' 
        ? `${GEMINI_API_KEY.substring(0, 4)}... (Cargada)` 
        : 'No detectada / Placeholder';

      return {
        risk_level: 'bajo',
        summary: isMissingKey 
          ? 'Error: API Key de Gemini no detectada.' 
          : `Error de Diagnóstico: ${error.message}`,
        anomalies: [
          `Estado de Key: ${keySnippet}`,
          `Detalle del error: ${error.message || 'Error desconocido'}`
        ],
        recommendations: [
          'Si está en VERCEL: Agregue VITE_GEMINI_API_KEY en Settings > Environment Variables.',
          'Si está LOCAL: Reinicie el servidor (npm run dev) para cargar .env.local.',
          'Verifique que la "Generative Language API" esté habilitada en Google Cloud para esta Key.'
        ]
      };
    }
  }
};
