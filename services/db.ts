import Dexie, { Table } from 'dexie';
import { Machine, SensorReading, Alert, MachineStatus } from '../types';

// We extend SensorReading to include machineId for relational queries
export interface SensorReadingRecord extends SensorReading {
  id?: number; // Auto-incrementing primary key
  machineId: string;
}

export interface MachineRecord extends Omit<Machine, 'history'> {
    // We don't store the full history array in the machine table to keep it lightweight.
}

class SentinAIDatabase extends Dexie {
  machines!: Table<MachineRecord, string>;
  readings!: Table<SensorReadingRecord, number>;
  alerts!: Table<Alert, string>;

  // Configurable limits to prevent browser crash
  private readonly MAX_HISTORY_ITEMS_PER_MACHINE = 2000; 

  constructor() {
    super('SentinAIDB');
    
    (this as any).version(1).stores({
      machines: 'id, status, type', 
      readings: '++id, machineId, timestamp, [machineId+timestamp]',
      alerts: 'id, machineId, timestamp, severity'
    });
  }

  // -- Data Access Layer --

  async initializeWithDefaults(defaultMachines: MachineRecord[]) {
    const count = await this.machines.count();
    if (count === 0) {
        await this.machines.bulkAdd(defaultMachines);
        console.log("Database seeded with default machines.");
    }
  }

  async getMachineWithHistory(id: string, limit = 50): Promise<Machine | undefined> {
      const machineRecord = await this.machines.get(id);
      if (!machineRecord) return undefined;

      const history = await this.readings
        .where('[machineId+timestamp]')
        .between([id, Dexie.minKey], [id, Dexie.maxKey])
        .reverse()
        .limit(limit)
        .toArray();

      return {
          ...machineRecord,
          history: history.reverse()
      };
  }

  async getAllMachinesWithLatestHistory(): Promise<Machine[]> {
      const machineRecords = await this.machines.toArray();
      
      const fullMachines = await Promise.all(machineRecords.map(async (m) => {
          const history = await this.readings
            .where('[machineId+timestamp]')
            .between([m.id, Dexie.minKey], [m.id, Dexie.maxKey])
            .reverse()
            .limit(50) // Keep the UI light, only load 50 points initially
            .toArray();
          
          return {
              ...m,
              history: history.reverse()
          };
      }));

      return fullMachines;
  }

  async checkQuota() {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const { usage, quota } = await navigator.storage.estimate();
        // If usage > 80% or absolute usage > 500MB, prune
        if (usage && quota && (usage / quota > 0.8 || usage > 500 * 1024 * 1024)) {
          console.warn(`Storage usage high (${(usage/1024/1024).toFixed(2)} MB). Pruning...`);
          await this.pruneOldData(true); 
        }
      } catch (e) {
        console.warn("Storage estimate failed", e);
      }
    }
  }

  async logReadings(readings: SensorReadingRecord[]) {
      try {
        // 1. Check Quota occasionally (random sampling to avoid overhead every tick)
        if (Math.random() > 0.95) await this.checkQuota();

        // 2. Insert new readings
        await this.readings.bulkAdd(readings);

        // 3. Per-Machine Safety Cap (FIFO)
        // This is expensive, so we only run it occasionally or if we detect pressure
        // For a high-performance system, this logic should be in a Web Worker
        
      } catch (e: any) {
        if (e.name === 'QuotaExceededError') {
            console.error("Disk Full. Dropping sensor frames.");
            await this.pruneOldData(true);
        } else {
            console.error("DB Write Error", e);
        }
      }
  }

  async logAlert(alert: Alert) {
      try {
        await this.alerts.put(alert);
      } catch (e) {
          console.error("Failed to log alert", e);
      }
  }

  async updateMachineStatus(id: string, status: MachineStatus) {
      await this.machines.update(id, { status });
  }

  // -- Maintenance --
  
  async pruneOldData(aggressive = false) {
      // Standard: Keep 4 hours. Aggressive: Keep 30 minutes.
      const timeWindow = aggressive ? (30 * 60 * 1000) : (4 * 60 * 60 * 1000);
      const cutOff = Date.now() - timeWindow;
      
      try {
        const deleteCount = await this.readings.where('timestamp').below(cutOff).delete();
        console.log(`Pruned ${deleteCount} old records.`);
      } catch (e) {
          console.error("Prune failed", e);
      }
  }
}

export const db = new SentinAIDatabase();