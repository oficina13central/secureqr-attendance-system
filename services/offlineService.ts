
export interface OfflineScan {
    id: string; // Internal sync ID
    employeeId: string;
    employeeName: string;
    timestamp: string; // ISO format
    type?: 'in' | 'out'; // Optional if we can determine it locally
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

    queueScan(employeeId: string, employeeName: string): OfflineScan {
        const queue = this.getQueue();
        const newScan: OfflineScan = {
            id: crypto.randomUUID(),
            employeeId,
            employeeName,
            timestamp: new Date().toISOString()
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
