import Dexie, { Table } from 'dexie';
import { Machine, SensorReading, Alert, MachineStatus } from '../types';

// We extend SensorReading to include machineId for relational queries
export interface SensorReadingRecord extends SensorReading {
  id?: number; // Auto-incrementing primary key
  machineId: string;
}

export interface MachineRecord extends Omit<Machine, 'history'> {
    // We don't store the full history array in the machine table to keep it lightweight.
    // History is queried from the 'readings' table.
}

class SentinAIDatabase extends Dexie {
  machines!: Table<MachineRecord, string>;
  readings!: Table<SensorReadingRecord, number>;
  alerts!: Table<Alert, string>;

  constructor() {
    super('SentinAIDB');
    
    // Fix: Cast 'this' to any to avoid TS error "Property 'version' does not exist on type 'SentinAIDatabase'"
    (this as any).version(1).stores({
      machines: 'id, status, type', // Primary Key: id, Indexes: status, type
      readings: '++id, machineId, timestamp, [machineId+timestamp]', // Optimized for time-series queries
      alerts: 'id, machineId, timestamp, severity' // Indexes for filtering alerts
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

      // Efficiently fetch only the latest readings for this machine
      const history = await this.readings
        .where('[machineId+timestamp]')
        .between([id, Dexie.minKey], [id, Dexie.maxKey])
        .reverse()
        .limit(limit)
        .toArray();

      // Reverse back to chronological order for charts
      return {
          ...machineRecord,
          history: history.reverse()
      };
  }

  async getAllMachinesWithLatestHistory(): Promise<Machine[]> {
      const machineRecords = await this.machines.toArray();
      
      // Parallel fetch for performance
      const fullMachines = await Promise.all(machineRecords.map(async (m) => {
          const history = await this.readings
            .where('[machineId+timestamp]')
            .between([m.id, Dexie.minKey], [m.id, Dexie.maxKey])
            .reverse()
            .limit(50) // Keep the UI light
            .toArray();
          
          return {
              ...m,
              history: history.reverse()
          };
      }));

      return fullMachines;
  }

  async logReadings(readings: SensorReadingRecord[]) {
      await this.readings.bulkAdd(readings);
  }

  async logAlert(alert: Alert) {
      await this.alerts.put(alert);
  }

  async updateMachineStatus(id: string, status: MachineStatus) {
      await this.machines.update(id, { status });
  }

  // -- Maintenance --
  
  // Clean up data older than 24 hours to prevent browser storage quotas from filling up
  async pruneOldData() {
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      await this.readings.where('timestamp').below(oneDayAgo).delete();
  }
}

export const db = new SentinAIDatabase();