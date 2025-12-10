import { Machine, MachineStatus, Alert, SensorReading } from '../types';
import { db, MachineRecord, SensorReadingRecord } from './db';
import { generateMaintenancePlan } from './geminiService';

// -- Helper: Map Gemini Urgency to Alert Severity --
const mapUrgencyToSeverity = (urgency: string): 'low' | 'medium' | 'high' => {
  const u = urgency?.toLowerCase() || '';
  if (u === 'immediate' || u === 'high') return 'high';
  if (u === 'medium') return 'medium';
  return 'low';
};

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

// DETERMINISTIC PHYSICS ENGINE
// Use Sine waves based on Time to ensure all users see the same trends
// at the same moment, regardless of client-side simulation.
const generateReading = (prev: SensorReading | null, status: MachineStatus, timestamp: number): SensorReading => {
  // Use a fixed epoch for sync
  const t = timestamp / 1000; 

  // Base Targets based on Status
  const baseVib = status === MachineStatus.NORMAL ? 2.5 : status === MachineStatus.WARNING ? 5.5 : 8.5;
  const baseTemp = status === MachineStatus.NORMAL ? 65 : status === MachineStatus.WARNING ? 78 : 95;
  const baseNoise = status === MachineStatus.NORMAL ? 70 : 92;

  // Add deterministic wave functions (Machinery vibration pattern)
  // Math.sin(t) is deterministic. Math.random() is not.
  const vibNoise = (Math.sin(t * 2) * 0.5) + (Math.cos(t * 5) * 0.2); 
  const tempDrift = Math.sin(t * 0.1) * 2; // Slow temperature oscillation
  const noiseSpike = Math.abs(Math.sin(t * 0.5)) * 5;

  return {
    timestamp: timestamp,
    vibration: Math.max(0, baseVib + vibNoise),
    temperature: Math.max(20, baseTemp + tempDrift),
    noise: Math.max(40, baseNoise + noiseSpike),
    rpm: 1200 + (Math.sin(t) * 10),
    powerUsage: 45 + (Math.cos(t) * 2)
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
  
  // Hysteresis Tracking
  private statusCounters: Map<string, { count: number, status: MachineStatus }> = new Map();
  private lastTickTime: number = Date.now();

  constructor() {
    // We defer initialization to start()
  }

  // Initialize DB and load state
  private async initialize() {
      if (this.isInitialized) return;
      
      await db.initializeWithDefaults(generateInitialMachines());
      this.alerts = await db.alerts.orderBy('timestamp').reverse().limit(50).toArray();
      this.machines = await db.getAllMachinesWithLatestHistory();
      
      this.isInitialized = true;
      this.notify();
  }

  public async start() {
    if (this.intervalId) return;
    
    console.log("Initializing Pipeline & Database Connection...");
    await this.initialize();
    
    console.log("Starting Manufacturing Pipeline...");
    this.lastTickTime = Date.now();
    this.intervalId = setInterval(() => this.tick(), 2000);
    
    // Prune data every minute
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

      await db.machines.add(newMachineRecord);
      this.machines.push({ ...newMachineRecord, history: [] });
      this.notify();
      return newMachineRecord;
  }

  // The "Backend" Tick
  private async tick() {
    if (!this.isInitialized) return;

    const now = Date.now();
    const timeDelta = now - this.lastTickTime;
    
    const steps = Math.min(Math.floor(timeDelta / 2000), 10) || 1;
    
    this.lastTickTime = now;

    let updatedMachines = [...this.machines];
    const readingsToLog: SensorReadingRecord[] = [];
    const alertsToLog: Alert[] = [];

    // Loop for catch-up steps (if any)
    for (let i = 0; i < steps; i++) {
        // Calculate timestamp for this step
        const stepTime = now - ((steps - 1 - i) * 2000);

        updatedMachines = await Promise.all(updatedMachines.map(async (machine) => {
            const lastReading = machine.history.length > 0 ? machine.history[machine.history.length - 1] : null;
            
            // Generate Reading
            const newReading = generateReading(lastReading, machine.status, stepTime);
            readingsToLog.push({ ...newReading, machineId: machine.id });

            // Analyze
            const analysis = this.detectAnomalies(machine, newReading);
            
            // State Update
            const newHistory = [...machine.history, newReading].slice(-this.MAX_UI_HISTORY);
            
            // Only process alerts on the *last* step (Current Time) to avoid spamming alerts from the past
            const isLastStep = i === steps - 1;
            let finalAlert = (isLastStep) ? analysis.newAlert : undefined;

            // Alert Enrichment (Only if real-time)
            if (finalAlert) {
                if (machine.status !== MachineStatus.CRITICAL && analysis.status === MachineStatus.CRITICAL) {
                    try {
                        const plan = await generateMaintenancePlan(finalAlert.message, machine.name);
                        finalAlert.severity = mapUrgencyToSeverity(plan.urgency);
                        finalAlert.message = `${finalAlert.message}. [AI: ${plan.diagnosis}]`;
                    } catch (error) {
                        console.warn("AI Alert Enrichment failed.", error);
                    }
                }
                alertsToLog.push(finalAlert);
                this.addAlert(finalAlert);
            }
            
            if (isLastStep && machine.status !== analysis.status) {
                db.updateMachineStatus(machine.id, analysis.status);
            }

            return {
                ...machine,
                history: newHistory,
                status: isLastStep ? analysis.status : machine.status // Only update status on live tick
            };
        }));
    }

    if (readingsToLog.length > 0) {
        db.logReadings(readingsToLog).catch(e => console.error("DB Write Error", e));
    }
    
    if (alertsToLog.length > 0) {
        Promise.all(alertsToLog.map(a => db.logAlert(a)));
    }

    this.machines = updatedMachines;
    this.notify();
  }

  // Detect with Hysteresis (Debouncing)
  private detectAnomalies(machine: Machine, reading: SensorReading): { status: MachineStatus, newAlert?: Alert } {
      let proposedStatus = machine.status;
      let newAlert: Alert | undefined;

      // Logic: Determine what the status *should* be based on current frame
      if (reading.temperature > 85 || reading.vibration > 7) {
          proposedStatus = MachineStatus.CRITICAL;
      } else if (reading.temperature > 75 || reading.vibration > 5) {
          proposedStatus = MachineStatus.WARNING;
      } else {
          proposedStatus = MachineStatus.NORMAL;
      }
      
      // Random Failures (Simulation only) - Use Deterministic Randomness based on Minute of hour
      const currentMinute = new Date().getMinutes();
      // Fail machine 2 during minute 15 and 45 of every hour for demo purposes
      if (machine.id === 'm2' && (currentMinute === 15 || currentMinute === 45)) {
           proposedStatus = MachineStatus.WARNING;
      }

      // Hysteresis Check
      const tracker = this.statusCounters.get(machine.id) || { count: 0, status: machine.status };

      if (proposedStatus !== machine.status) {
          if (tracker.status === proposedStatus) {
              tracker.count++;
          } else {
              tracker.status = proposedStatus;
              tracker.count = 1;
          }
      } else {
          tracker.count = 0; // Reset if we match current status
      }
      
      this.statusCounters.set(machine.id, tracker);

      // Threshold: Needs 3 ticks (6 seconds) to change state
      if (tracker.count >= 3) {
           if (proposedStatus === MachineStatus.CRITICAL && machine.status !== MachineStatus.CRITICAL) {
              newAlert = {
                  id: Math.random().toString(36).substr(2, 9),
                  machineId: machine.id,
                  machineName: machine.name,
                  timestamp: reading.timestamp,
                  severity: 'high',
                  message: `Critical: ${reading.vibration > 7 ? 'Excessive Vibration' : 'Overheating'}`,
                  value: reading.vibration > 7 ? reading.vibration : reading.temperature,
                  sensorType: reading.vibration > 7 ? 'Vibration' : 'Temperature'
              };
           }
           // Reset counter after state change
           tracker.count = 0; 
           this.statusCounters.set(machine.id, tracker);
           return { status: proposedStatus, newAlert };
      }

      return { status: machine.status };
  }

  private addAlert(alert: Alert) {
      // Dedup alerts
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