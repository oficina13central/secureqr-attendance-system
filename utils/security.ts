
/**
 * Propuesta de Token Seguro:
 * Un simple texto plano es vulnerable a fotocopias o recreaciones manuales.
 * Estructura del Token: 
 * HMAC( SHA256 ( ID_EMPLEADO + FECHA_EXPIRACION + SALT_SECRETO ) )
 * 
 * Implementación recomendada:
 * 1. El QR contiene un JSON firmado (como un JWT minimalista).
 * 2. La terminal offline valida la firma con la Clave Pública.
 * 3. Se incluye un 'nonce' o timestamp para evitar ataques de replay (el QR debe renovarse cada X minutos si es digital).
 */

export function generateSecureQRToken(employeeId: string): string {
  // Simulación de generación de token robusto
  const timestamp = Date.now();
  const salt = "SECURE_SYSTEM_V1";
  const raw = `${employeeId}|${timestamp}|${salt}`;
  
  // En producción usaríamos crypto.subtle para HMAC
  return btoa(raw); // Ejemplo simple Base64 para propósitos de UI
}

export function validateQRToken(token: string): boolean {
  try {
    const decoded = atob(token);
    const [id, timestamp, salt] = decoded.split('|');
    
    // Validación de expiración (ej. el QR digital solo dura 5 min)
    const FIVE_MINUTES = 5 * 60 * 1000;
    if (Date.now() - parseInt(timestamp) > FIVE_MINUTES) {
      console.warn("Token expirado");
      // Si es carnet físico, ignoraríamos este check de tiempo corto.
    }
    
    return salt === "SECURE_SYSTEM_V1";
  } catch {
    return false;
  }
}
