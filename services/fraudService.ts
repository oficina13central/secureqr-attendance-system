import { AttendanceRecord, FraudReport } from '../types';
import { attendanceService } from './attendanceService';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

export const fraudService = {
  async analyzeRecentAttendance(): Promise<FraudReport> {
    try {
      const records = await attendanceService.getAll();
      // Tomar los últimos 100 registros para el análisis
      const recentRecords = records.slice(0, 100);

      const prompt = `
        Analiza los siguientes registros de asistencia y detecta posibles patrones de fraude o anomalías.
        
        Registros:
        ${JSON.stringify(recentRecords, null, 2)}
        
        Responde ÚNICAMENTE en formato JSON con la siguiente estructura:
        {
          "risk_level": "bajo" | "medio" | "alto",
          "summary": "Resumen ejecutivo del análisis",
          "anomalies": ["Lista de anomalías detectadas"],
          "recommendations": ["Lista de recomendaciones para el administrador"]
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
      console.error('Error en el análisis de fraude:', error);
      return {
        risk_level: 'bajo',
        summary: 'No se pudo realizar el análisis de IA en este momento.',
        anomalies: ['Error de conexión con el servicio de IA'],
        recommendations: ['Verifique su conexión a internet y la configuración de la API Key.']
      };
    }
  }
};
