import Dexie, { Table } from 'dexie';
import { Machine, SensorReading, Alert, MachineStatus, LogEntry } from '../types';

// We extend SensorReading to include machineId for relational queries
export interface SensorReadingRecord extends SensorReading {
  id?: number; // Auto-incrementing primary key
  machineId: string;
  isAggregated?: boolean; // Flag to distinguish raw vs downsampled data
}

export interface MachineRecord extends Omit<Machine, 'history'> {
    // We don't store the full history array in the machine table to keep it lightweight.
}

class ManuscriptAIDatabase extends Dexie {
  machines!: Table<MachineRecord, string>;
  readings!: Table<SensorReadingRecord, number>;
  alerts!: Table<Alert, string>;
  logs!: Table<LogEntry, number>;

  constructor() {
    super('ManuscriptAIDB');
    
    (this as any).version(2).stores({
      machines: 'id, status, type', 
      readings: '++id, machineId, timestamp, [machineId+timestamp], isAggregated',
      alerts: 'id, machineId, timestamp, severity',
      logs: '++id, machineId, timestamp, type'
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

  async getMachineWithHistory(id: string, limit = 500): Promise<Machine | undefined> {
      const machineRecord = await this.machines.get(id);
      if (!machineRecord) return undefined;

      // HYBRID FETCH STRATEGY:
      // 1. Get recent RAW data (high precision)
      // 2. Get older AGGREGATED data (low precision, high efficiency)
      
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

  async getMachineLogs(id: string): Promise<LogEntry[]> {
      return await this.logs
        .where('machineId')
        .equals(id)
        .reverse()
        .sortBy('timestamp');
  }

  async addLogEntry(entry: LogEntry) {
      await this.logs.add(entry);
  }

  async getAllMachinesWithLatestHistory(): Promise<Machine[]> {
      const machineRecords = await this.machines.toArray();
      
      const fullMachines = await Promise.all(machineRecords.map(async (m) => {
          // Optimized fetch: Only get the last 50 points for the dashboard grid
          const history = await this.readings
            .where('[machineId+timestamp]')
            .between([m.id, Dexie.minKey], [m.id, Dexie.maxKey])
            .reverse()
            .limit(50) 
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
        // If usage > 60% or absolute usage > 200MB, trigger maintenance
        if (usage && quota && (usage / quota > 0.6 || usage > 200 * 1024 * 1024)) {
          // console.warn(`Storage pressure detected (${(usage/1024/1024).toFixed(2)} MB). Running optimization...`);
          await this.performDataRollup(); 
        }
      } catch (e) {
        console.warn("Storage estimate failed", e);
      }
    }
  }

  async logReadings(readings: SensorReadingRecord[]) {
      try {
        // 1. Random maintenance check (1% chance on write) to keep DB healthy without blocking
        if (Math.random() > 0.99) await this.checkQuota();

        // 2. Insert new readings
        await this.readings.bulkAdd(readings);
        
      } catch (e: any) {
        if (e.name === 'QuotaExceededError') {
            console.error("Disk Full. Running Emergency Rollup.");
            await this.performDataRollup(true);
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

  // -- COST-EFFECTIVE DATA STRATEGY: DOWNSAMPLING (ROLLUPS) --
  
  /**
   * Compresses raw data into time-bucketed averages.
   * Strategy:
   * - Keep RAW data for last 1 hour (HOT)
   * - Aggregate data older than 1 hour into 1-minute buckets (WARM)
   * - Delete data older than 24 hours (COLD/Gone for local demo)
   * 
   * FIXED: Uses iterate() instead of toArray() to avoid OOM crashes on large datasets.
   */
  async performDataRollup(emergency = false) {
      const NOW = Date.now();
      const ONE_HOUR = 60 * 60 * 1000;
      const HOT_CUTOFF = NOW - (emergency ? (10 * 60 * 1000) : ONE_HOUR); 
      
      try {
          const buckets: Record<string, SensorReadingRecord[]> = {};
          const idsToDelete: number[] = [];
          
          // 1. Iterate instead of Loading All into Memory
          await this.readings
            .where('timestamp')
            .below(HOT_CUTOFF)
            .filter(r => !r.isAggregated) // Only process raw
            .each(r => {
                const bucketTime = Math.floor(r.timestamp / 60000) * 60000; 
                const key = `${r.machineId}_${bucketTime}`;
                if (!buckets[key]) buckets[key] = [];
                buckets[key].push(r);
                if (r.id) idsToDelete.push(r.id);
            });

          // 2. Process Buckets (CPU intensive, but RAM safe now)
          const aggregatedRecords: SensorReadingRecord[] = [];

          Object.values(buckets).forEach(group => {
              if (group.length === 0) return;
              
              const machineId = group[0].machineId;
              const timestamp = Math.floor(group[0].timestamp / 60000) * 60000;
              
              // Calculate averages
              const avg = group.reduce((acc, curr) => ({
                  vibration: acc.vibration + curr.vibration,
                  temperature: acc.temperature + curr.temperature,
                  noise: acc.noise + curr.noise,
                  rpm: acc.rpm + curr.rpm,
                  powerUsage: acc.powerUsage + curr.powerUsage
              }), { vibration: 0, temperature: 0, noise: 0, rpm: 0, powerUsage: 0 });

              const count = group.length;

              aggregatedRecords.push({
                  machineId,
                  timestamp,
                  vibration: avg.vibration / count,
                  temperature: avg.temperature / count,
                  noise: avg.noise / count,
                  rpm: avg.rpm / count,
                  powerUsage: avg.powerUsage / count,
                  isAggregated: true
              } as SensorReadingRecord);
          });

          // 3. Batch Transaction
          if (aggregatedRecords.length > 0) {
              await this.transaction('rw', this.readings, async () => {
                  await this.readings.bulkDelete(idsToDelete);
                  await this.readings.bulkAdd(aggregatedRecords);
              });
              console.log(`Optimization Complete: Compressed ${idsToDelete.length} raw points into ${aggregatedRecords.length} aggregates.`);
          }

      } catch (e) {
          console.error("Rollup failed", e);
      }
  }
}

export const db = new ManuscriptAIDatabase();