import { AttendanceRecord, FraudReport } from '../types';
import { attendanceService } from './attendanceService';
import { auditService } from './auditService';

// Sanitización de la API Key (elimina espacios accidentales de Vercel)
const RAW_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_API_KEY = RAW_KEY.trim();

const GEMINI_BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models`;
const GEMINI_STABLE_URL = `https://generativelanguage.googleapis.com/v1/models`;

export const fraudService = {
  async listAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${GEMINI_BASE_URL}?key=${GEMINI_API_KEY}`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.models?.map((m: any) => m.name.replace('models/', '')) || [];
    } catch {
      return [];
    }
  },

  async analyzeRecentAttendance(): Promise<FraudReport> {
    try {
      const [records, auditLogs] = await Promise.all([
        attendanceService.getAll(),
        auditService.getAll()
      ]);
      
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

      // Intentar primero con gemini-flash-latest (alias estable para el tier gratuito)
      let response = await callGemini('gemini-flash-latest');
      
      // Si falla, intentar con gemini-pro-latest como fallback robusto
      if (response.status === 404 || response.status === 429) {
        console.warn('Falla con flash, intentando fallback con gemini-pro-latest...');
        response = await callGemini('gemini-pro-latest');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || 'Error desconocido';
        const models = await this.listAvailableModels();
        
        throw new Error(`[${response.status}] ${errorMsg} | Modelos disponibles: ${models.join(', ') || 'Ninguno'}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error('La IA no devolvió texto. Revise su cuota.');
      }
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('Respuesta cruda de Gemini:', text);
        throw new Error('Formato de respuesta inválido (No JSON)');
      }

      return JSON.parse(jsonMatch[0]) as FraudReport;

    } catch (error: any) {
      console.error('Error de diagnóstico profundo:', error);
      
      const isMissingKey = !GEMINI_API_KEY || GEMINI_API_KEY === 'PLACEHOLDER_API_KEY';
      const keySnippet = GEMINI_API_KEY ? `${GEMINI_API_KEY.substring(0, 6)}...` : 'Nula';

      return {
        risk_level: 'bajo',
        summary: isMissingKey 
          ? 'Error: API Key de Gemini no detectada o vacía.' 
          : `Diagnóstico: ${error.message}`,
        anomalies: [
          `Key Detectada: ${keySnippet}`,
          `Origen del error: ${error.message}`
        ],
        recommendations: [
          'VERCEL: Settings > Environment Variables > VITE_GEMINI_API_KEY (sin espacios!).',
          'GOOGLE: Asegúrese de que la Generative Language API esté HABILITADA.',
          'Consulte los modelos listados arriba en el mensaje de error.'
        ]
      };
    }
  }
};
