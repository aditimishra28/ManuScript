import { Machine, MachineStatus, Alert, SensorReading } from '../types';

// -- Mock Data Generators (Simulating IoT Devices) --

const generateInitialMachines = (): Machine[] => {
  return [
    {
      id: 'm1',
      name: 'CNC Milling Station A',
      type: 'CNC Mill',
      location: 'Sector 4',
      status: MachineStatus.NORMAL,
      lastMaintenance: '2023-10-15',
      imageUrl: 'https://picsum.photos/800/600?random=1',
      history: [],
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
      history: [],
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
      history: [],
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
      history: [],
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
  
  // Base values vary by status to simulate faults
  let baseVib = status === MachineStatus.NORMAL ? 2.5 : status === MachineStatus.WARNING ? 5.5 : 8.5;
  let baseTemp = status === MachineStatus.NORMAL ? 65 : status === MachineStatus.WARNING ? 78 : 95;
  let baseNoise = status === MachineStatus.NORMAL ? 70 : 92;

  // Add random fluctuation (noise)
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

// -- Pipeline Class --

type PipelineListener = (machines: Machine[], alerts: Alert[]) => void;

class ManufacturingPipeline {
  private machines: Machine[] = [];
  private alerts: Alert[] = [];
  private listeners: PipelineListener[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly MAX_HISTORY = 50;

  constructor() {
    this.machines = generateInitialMachines();
  }

  // Start the simulation loop
  public start() {
    if (this.intervalId) return;
    console.log("Starting Manufacturing Pipeline...");
    this.intervalId = setInterval(() => this.tick(), 2000);
  }

  // Stop the simulation loop
  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("Stopping Manufacturing Pipeline...");
    }
  }

  // Subscribe to updates (Observer Pattern)
  public subscribe(listener: PipelineListener) {
    this.listeners.push(listener);
    // Send immediate initial state
    listener(this.machines, this.alerts);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notify all listeners of state changes
  private notify() {
    const safeMachines = [...this.machines];
    const safeAlerts = [...this.alerts];
    this.listeners.forEach(l => l(safeMachines, safeAlerts));
  }

  // Register a new machine dynamically
  public registerMachine(machineData: Partial<Machine>) {
      const newMachine: Machine = {
          id: `m${Date.now().toString().slice(-4)}`,
          name: machineData.name || 'Unknown Machine',
          type: machineData.type || 'Generic',
          location: machineData.location || 'Warehouse',
          status: MachineStatus.NORMAL,
          lastMaintenance: new Date().toISOString().split('T')[0],
          imageUrl: `https://picsum.photos/800/600?random=${Math.floor(Math.random() * 100)}`,
          history: [],
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

      this.machines.push(newMachine);
      this.notify();
      return newMachine;
  }

  // The "Backend" Tick: Ingest, Analyze, Update
  private tick() {
    const updatedMachines = this.machines.map(machine => {
      // 1. Ingest Data
      const lastReading = machine.history.length > 0 ? machine.history[machine.history.length - 1] : null;
      const newReading = generateReading(lastReading, machine.status);
      
      // 2. Pattern Analysis & Anomaly Detection
      const analysis = this.detectAnomalies(machine, newReading);
      
      // 3. State Update
      const newHistory = [...machine.history, newReading].slice(-this.MAX_HISTORY);

      // 4. Alert Generation
      if (analysis.newAlert) {
          this.addAlert(analysis.newAlert);
      }

      return {
        ...machine,
        history: newHistory,
        status: analysis.status
      };
    });

    this.machines = updatedMachines;
    this.notify();
  }

  // Rule-based Anomaly Detection Engine
  private detectAnomalies(machine: Machine, reading: SensorReading): { status: MachineStatus, newAlert?: Alert } {
      let newStatus = machine.status;
      let newAlert: Alert | undefined;

      // Random Chaos Monkey: Randomly degrade healthy machines (Simulation Logic)
      if (machine.status === MachineStatus.NORMAL && Math.random() > 0.995) {
         newStatus = MachineStatus.WARNING;
      }

      // Transition Logic
      if (machine.status === MachineStatus.WARNING) {
          // If readings spike, go Critical
          if (reading.temperature > 85 || reading.vibration > 7) {
              newStatus = MachineStatus.CRITICAL;
          } 
          // Self-correction chance
          else if (Math.random() > 0.95) {
              newStatus = MachineStatus.NORMAL;
          }
      }

      // Critical Checks - Triggers Alert
      if (newStatus === MachineStatus.CRITICAL) {
          // Only generate alert if we just entered this state or if it's a new severe spike
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

  // Alert Manager
  private addAlert(alert: Alert) {
      // Deduplication: Don't spam alerts for the same machine within 10 seconds
      const recentAlert = this.alerts.find(a => 
          a.machineId === alert.machineId && 
          (Date.now() - a.timestamp) < 10000
      );

      if (!recentAlert) {
          this.alerts = [alert, ...this.alerts].slice(0, 50); // Keep last 50
      }
  }
}

// Singleton Instance
export const pipeline = new ManufacturingPipeline();