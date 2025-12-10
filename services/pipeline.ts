import { Machine, MachineStatus, Alert, SensorReading } from '../types';
import { db, MachineRecord, SensorReadingRecord } from './db';

// -- Mock Data Generators --

const generateInitialMachines = (): MachineRecord[] => {
  return [
    {
      id: 'm1',
      name: 'CNC Milling Station A',
      type: 'CNC Mill',
      location: 'Sector 4',
      status: MachineStatus.NORMAL,
      lastMaintenance: '2023-10-15',
      imageUrl: 'https://picsum.photos/800/600?random=1',
      modelNumber: 'CNC-X5000-PRO',
      serialNumber: 'SN-78234912',
      firmwareVersion: 'v4.2.1',
      networkIp: '192.168.1.104',
      installDate: '2021-03-12',
      maxRpm: 15000,
      powerRating: 25,
      maintenanceInterval: 1000,
      operatingHours: 8450,
      lastCalibration: '2023-12-01'
    },
    {
      id: 'm2',
      name: 'Hydraulic Press 500T',
      type: 'Press',
      location: 'Sector 2',
      status: MachineStatus.WARNING,
      lastMaintenance: '2023-09-20',
      imageUrl: 'https://picsum.photos/800/600?random=2',
      modelNumber: 'HYD-P500-T',
      serialNumber: 'SN-99283711',
      firmwareVersion: 'v2.0.5',
      networkIp: '192.168.1.112',
      installDate: '2020-08-05',
      maxRpm: 1500,
      powerRating: 55,
      maintenanceInterval: 500,
      operatingHours: 12400,
      lastCalibration: '2023-08-15'
    },
    {
      id: 'm3',
      name: 'Robotic Arm Assembly',
      type: 'Robotics',
      location: 'Sector 1',
      status: MachineStatus.NORMAL,
      lastMaintenance: '2023-11-01',
      imageUrl: 'https://picsum.photos/800/600?random=3',
      modelNumber: 'ROBO-KUKA-V2',
      serialNumber: 'SN-44512399',
      firmwareVersion: 'v5.1.0-beta',
      networkIp: '192.168.1.108',
      installDate: '2022-01-15',
      maxRpm: 0,
      powerRating: 12,
      maintenanceInterval: 2000,
      operatingHours: 4200,
      lastCalibration: '2024-01-10'
    },
    {
      id: 'm4',
      name: 'Conveyor Motor System',
      type: 'Conveyor',
      location: 'Logistics',
      status: MachineStatus.NORMAL,
      lastMaintenance: '2023-08-10',
      imageUrl: 'https://picsum.photos/800/600?random=4',
      modelNumber: 'CONV-M200-S',
      serialNumber: 'SN-11223344',
      firmwareVersion: 'v1.4.2',
      networkIp: '192.168.1.120',
      installDate: '2019-11-22',
      maxRpm: 3000,
      powerRating: 15,
      maintenanceInterval: 750,
      operatingHours: 18900,
      lastCalibration: '2023-06-30'
    }
  ];
};

const generateReading = (prev: SensorReading | null, status: MachineStatus): SensorReading => {
  const now = Date.now();
  
  let baseVib = status === MachineStatus.NORMAL ? 2.5 : status === MachineStatus.WARNING ? 5.5 : 8.5;
  let baseTemp = status === MachineStatus.NORMAL ? 65 : status === MachineStatus.WARNING ? 78 : 95;
  let baseNoise = status === MachineStatus.NORMAL ? 70 : 92;

  const vibration = Math.max(0, baseVib + (Math.random() - 0.5) * 2);
  const temperature = Math.max(20, baseTemp + (Math.random() - 0.5) * 5);
  const noise = Math.max(40, baseNoise + (Math.random() - 0.5) * 10);
  const rpm = 1200 + (Math.random() - 0.5) * 50;
  const powerUsage = 45 + (Math.random() - 0.5) * 2;

  return {
    timestamp: now,
    vibration,
    temperature,
    noise,
    rpm,
    powerUsage
  };
};

type PipelineListener = (machines: Machine[], alerts: Alert[]) => void;

class ManufacturingPipeline {
  private machines: Machine[] = []; // In-memory cache for UI
  private alerts: Alert[] = [];
  private listeners: PipelineListener[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly MAX_UI_HISTORY = 50;
  private isInitialized = false;

  constructor() {
    // We defer initialization to start()
  }

  // Initialize DB and load state
  private async initialize() {
      if (this.isInitialized) return;
      
      // 1. Seed DB if empty
      await db.initializeWithDefaults(generateInitialMachines());

      // 2. Load alerts
      this.alerts = await db.alerts.orderBy('timestamp').reverse().limit(50).toArray();

      // 3. Hydrate in-memory machine state
      this.machines = await db.getAllMachinesWithLatestHistory();
      
      this.isInitialized = true;
      this.notify();
  }

  public async start() {
    if (this.intervalId) return;
    
    console.log("Initializing Pipeline & Database Connection...");
    await this.initialize();
    
    console.log("Starting Manufacturing Pipeline...");
    this.intervalId = setInterval(() => this.tick(), 2000);
    
    // Prune data every minute to keep things clean
    setInterval(() => db.pruneOldData(), 60000);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("Stopping Manufacturing Pipeline...");
    }
  }

  public subscribe(listener: PipelineListener) {
    this.listeners.push(listener);
    // If we have data, send immediately, otherwise wait for init
    if (this.isInitialized) {
        listener(this.machines, this.alerts);
    }
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    const safeMachines = [...this.machines];
    const safeAlerts = [...this.alerts];
    this.listeners.forEach(l => l(safeMachines, safeAlerts));
  }

  public async registerMachine(machineData: Partial<Machine>) {
      const newMachineRecord: MachineRecord = {
          id: `m${Date.now().toString().slice(-4)}`,
          name: machineData.name || 'Unknown Machine',
          type: machineData.type || 'Generic',
          location: machineData.location || 'Warehouse',
          status: MachineStatus.NORMAL,
          lastMaintenance: new Date().toISOString().split('T')[0],
          imageUrl: `https://picsum.photos/800/600?random=${Math.floor(Math.random() * 100)}`,
          modelNumber: machineData.modelNumber || 'GEN-001',
          serialNumber: machineData.serialNumber || `SN-${Math.floor(Math.random() * 1000000)}`,
          firmwareVersion: 'v1.0.0',
          networkIp: machineData.networkIp || '192.168.1.200',
          installDate: new Date().toISOString().split('T')[0],
          maxRpm: 5000,
          powerRating: 20,
          maintenanceInterval: 1000,
          operatingHours: 0,
          lastCalibration: new Date().toISOString().split('T')[0]
      };

      // Persist to DB
      await db.machines.add(newMachineRecord);

      // Add to memory state
      this.machines.push({ ...newMachineRecord, history: [] });
      this.notify();
      
      return newMachineRecord;
  }

  // The "Backend" Tick
  private async tick() {
    if (!this.isInitialized) return;

    const readingsToLog: SensorReadingRecord[] = [];
    const alertsToLog: Alert[] = [];
    
    const updatedMachines = this.machines.map(machine => {
      // 1. Ingest Data
      const lastReading = machine.history.length > 0 ? machine.history[machine.history.length - 1] : null;
      const newReading = generateReading(lastReading, machine.status);
      
      // Stage for DB Write
      readingsToLog.push({ ...newReading, machineId: machine.id });

      // 2. Pattern Analysis
      const analysis = this.detectAnomalies(machine, newReading);
      
      // 3. State Update
      const newHistory = [...machine.history, newReading].slice(-this.MAX_UI_HISTORY);

      if (analysis.newAlert) {
          alertsToLog.push(analysis.newAlert);
          this.addAlert(analysis.newAlert);
      }
      
      // If status changed, update DB
      if (machine.status !== analysis.status) {
          db.updateMachineStatus(machine.id, analysis.status);
      }

      return {
        ...machine,
        history: newHistory,
        status: analysis.status
      };
    });

    // Bulk write to DB for performance
    if (readingsToLog.length > 0) {
        db.logReadings(readingsToLog).catch(e => console.error("DB Write Error", e));
    }
    
    if (alertsToLog.length > 0) {
        Promise.all(alertsToLog.map(a => db.logAlert(a)));
    }

    this.machines = updatedMachines;
    this.notify();
  }

  private detectAnomalies(machine: Machine, reading: SensorReading): { status: MachineStatus, newAlert?: Alert } {
      let newStatus = machine.status;
      let newAlert: Alert | undefined;

      if (machine.status === MachineStatus.NORMAL && Math.random() > 0.995) {
         newStatus = MachineStatus.WARNING;
      }

      if (machine.status === MachineStatus.WARNING) {
          if (reading.temperature > 85 || reading.vibration > 7) {
              newStatus = MachineStatus.CRITICAL;
          } 
          else if (Math.random() > 0.95) {
              newStatus = MachineStatus.NORMAL;
          }
      }

      if (newStatus === MachineStatus.CRITICAL) {
          const isFreshCritical = machine.status !== MachineStatus.CRITICAL;
          
          if (isFreshCritical) {
              newAlert = {
                  id: Math.random().toString(36).substr(2, 9),
                  machineId: machine.id,
                  machineName: machine.name,
                  timestamp: Date.now(),
                  severity: 'high',
                  message: `Critical failure imminent: ${reading.vibration > 6 ? 'Excessive Vibration' : 'Overheating Detected'}`,
                  value: reading.vibration > 6 ? reading.vibration : reading.temperature,
                  sensorType: reading.vibration > 6 ? 'Vibration' : 'Temperature'
              };
          }
      }

      return { status: newStatus, newAlert };
  }

  private addAlert(alert: Alert) {
      const recentAlert = this.alerts.find(a => 
          a.machineId === alert.machineId && 
          (Date.now() - a.timestamp) < 10000
      );

      if (!recentAlert) {
          this.alerts = [alert, ...this.alerts].slice(0, 50);
      }
  }
}

export const pipeline = new ManufacturingPipeline();