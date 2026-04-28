
export interface OfflineScan {
    id: string; // Internal sync ID
    employeeId: string;
    employeeName: string;
    timestamp: string; // ISO format
    type?: 'in' | 'out'; // Modo de fichada: entrada o salida
    mode?: 'in' | 'out'; // Modo enforzado por el operador (entrada/salida)
}

class OfflineService {
    private STORAGE_KEY = 'secureqr_offline_queue';

    getQueue(): OfflineScan[] {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        try {
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }

    saveQueue(queue: OfflineScan[]) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queue));
    }

    queueScan(employeeId: string, employeeName: string, mode?: 'in' | 'out'): OfflineScan {
        const queue = this.getQueue();
        const newScan: OfflineScan = {
            id: crypto.randomUUID(),
            employeeId,
            employeeName,
            timestamp: new Date().toISOString(),
            mode, // Guardamos el modo para reproducir la intención del operador al sincronizar
        };
        queue.push(newScan);
        this.saveQueue(queue);
        return newScan;
    }

    removeScan(id: string) {
        const queue = this.getQueue().filter(s => s.id !== id);
        this.saveQueue(queue);
    }

    clearQueue() {
        localStorage.removeItem(this.STORAGE_KEY);
    }

    get count(): number {
        return this.getQueue().length;
    }
}

export const offlineService = new OfflineService();
