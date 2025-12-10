import { Machine, MachineStatus, Alert, SensorReading } from '../types';
import { db } from './db';
import { generateMaintenancePlan } from './geminiService';
import { validateSensorReading, validateMachine, sanitizeString } from './securityLayer';

// -- Types for WebSocket Messages --
type TelemetryMessage = {
  type: 'TELEMETRY';
  payload: {
    machineId: string;
    reading: SensorReading;
    status: MachineStatus;
  };
};

type AlertMessage = {
  type: 'ALERT';
  payload: Alert;
};

type InitMessage = {
  type: 'INIT';
  payload: {
    machines: Machine[];
    recentAlerts: Alert[];
  };
};

type WSMessage = TelemetryMessage | AlertMessage | InitMessage;

// Updated Listener Signature to include Connection Status
type PipelineListener = (
    machines: Machine[], 
    alerts: Alert[], 
    isLive: boolean
) => void;

// -- Fallback Simulation Helpers --
const generateFallbackReading = (timestamp: number, status: MachineStatus): SensorReading => {
  const t = timestamp / 1000;
  const baseVib = status === MachineStatus.NORMAL ? 2.5 : status === MachineStatus.WARNING ? 5.5 : 8.5;
  const baseTemp = status === MachineStatus.NORMAL ? 65 : status === MachineStatus.WARNING ? 78 : 95;
  
  return {
    timestamp,
    vibration: Math.max(0, baseVib + (Math.sin(t * 2) * 0.5)),
    temperature: Math.max(20, baseTemp + (Math.sin(t * 0.1) * 2)),
    noise: Math.max(40, 70 + (Math.abs(Math.sin(t * 0.5)) * 5)),
    rpm: 1200 + (Math.sin(t) * 10),
    powerUsage: 45 + (Math.cos(t) * 2)
  };
};

class ManufacturingPipeline {
  private machines: Machine[] = [];
  private alerts: Alert[] = [];
  private listeners: PipelineListener[] = [];
  
  // WebSocket State
  private ws: WebSocket | null = null;
  private wsUrl: string = process.env.REACT_APP_WS_URL || 'ws://localhost:8080';
  private isConnected = false;
  private reconnectInterval: any = null;

  // Fallback Simulation State
  private simulationInterval: any = null;
  private readonly MAX_UI_HISTORY = 50;

  constructor() {
    this.machines = []; 
  }

  public async start() {
    console.log("Starting Pipeline...");
    
    // 1. Try to load initial state from local DB (Cache)
    try {
      this.machines = await db.getAllMachinesWithLatestHistory();
      this.alerts = await db.alerts.orderBy('timestamp').reverse().limit(50).toArray();
      this.notify();
    } catch (e) {
      console.warn("Failed to load local DB cache", e);
    }

    // 2. Attempt WebSocket Connection
    this.connectWebSocket();
  }

  public stop() {
    console.log("Stopping Pipeline...");
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectInterval) clearInterval(this.reconnectInterval);
    this.stopFallbackSimulation();
  }

  public subscribe(listener: PipelineListener) {
    this.listeners.push(listener);
    // Send current state immediately
    listener(this.machines, this.alerts, this.isConnected);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public registerMachine(machineData: Partial<Machine>) {
    console.log("Registering machine via API...", machineData);
    
    // SECURITY: Sanitize inputs from UI wizard
    const rawMachine = {
      id: `m${Date.now()}`,
      name: machineData.name || 'New Machine',
      type: machineData.type || 'Generic',
      location: machineData.location || 'Unknown',
      status: MachineStatus.NORMAL,
      lastMaintenance: new Date().toISOString(),
      history: [],
      imageUrl: 'https://picsum.photos/800/600',
      ...machineData
    };

    const validatedMachine = validateMachine(rawMachine);
    if (!validatedMachine) {
        console.error("Security Block: Invalid machine data rejected.");
        return;
    }

    this.machines.push(validatedMachine);
    this.notify();

    if (this.isConnected && this.ws) {
        this.ws.send(JSON.stringify({ type: 'REGISTER_MACHINE', payload: validatedMachine }));
    }
  }

  private notify() {
    const safeMachines = [...this.machines];
    const safeAlerts = [...this.alerts];
    this.listeners.forEach(l => l(safeMachines, safeAlerts, this.isConnected));
  }

  // -- WebSocket Logic --

  private connectWebSocket() {
    if (this.ws) return;
    
    try {
        this.ws = new WebSocket(this.wsUrl);
    } catch (error) {
        // Immediate failure (e.g. invalid syntax or offline)
        this.isConnected = false;
        this.startFallbackSimulation();
        return;
    }

    this.ws.onopen = () => {
      console.log("✅ WebSocket Connected: Real-time stream active.");
      this.isConnected = true;
      this.stopFallbackSimulation(); // CRITICAL: Stop fake data if real data is flowing
      this.notify();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (e) {
        console.error("Failed to parse WS message");
      }
    };

    this.ws.onclose = () => {
      if (this.isConnected) {
        console.warn("⚠️ WebSocket Disconnected. Switching to Offline Mode.");
      }
      this.isConnected = false;
      this.ws = null;
      this.startFallbackSimulation(); 
      this.notify();
      this.scheduleReconnect();
    };

    this.ws.onerror = (event) => {
       // Handled by onclose
    };
  }

  private scheduleReconnect() {
    if (this.reconnectInterval) return;
    this.reconnectInterval = setInterval(() => {
      this.connectWebSocket();
    }, 5000);
  }

  private handleMessage(msg: WSMessage) {
    switch (msg.type) {
      case 'INIT':
        // SECURITY: Validate bulk load
        const validMachines = msg.payload.machines.map(validateMachine).filter(m => m !== null) as Machine[];
        this.machines = validMachines;
        this.alerts = msg.payload.recentAlerts; // Should also sanitize alerts
        this.notify();
        break;

      case 'TELEMETRY':
        // SECURITY: Validate Reading Payload
        const validReading = validateSensorReading(msg.payload.reading);
        const safeId = sanitizeString(msg.payload.machineId);
        
        if (validReading && safeId) {
            this.updateMachineState(safeId, validReading, msg.payload.status);
        }
        break;

      case 'ALERT':
        this.handleNewAlert(msg.payload);
        break;
    }
  }

  private updateMachineState(id: string, reading: SensorReading, status: MachineStatus) {
    const machineIndex = this.machines.findIndex(m => m.id === id);
    if (machineIndex === -1) return;

    const machine = this.machines[machineIndex];
    const newHistory = [...machine.history, reading].slice(-this.MAX_UI_HISTORY);

    this.machines[machineIndex] = {
      ...machine,
      status,
      history: newHistory
    };

    // Async: Persist to local IndexedDB for offline cache
    // Note: We might want to tag these as "simulated" in the DB if isConnected is false,
    // but for now, we just store raw data.
    db.logReadings([{ ...reading, machineId: id }]).catch(() => {});
    if (machine.status !== status) {
        db.updateMachineStatus(id, status);
    }

    this.notify();
  }

  private handleNewAlert(alert: Alert) {
    // SECURITY: Sanitize incoming alert strings to prevent XSS in the Alerts Table
    const safeAlert: Alert = {
        ...alert,
        machineName: sanitizeString(alert.machineName),
        message: sanitizeString(alert.message),
        severity: alert.severity // Enum does not need sanitization if typed correctly, but TS helps here
    };

    this.alerts = [safeAlert, ...this.alerts].slice(0, 50);
    db.logAlert(safeAlert);
    this.notify();

    if (safeAlert.severity === 'high' && !safeAlert.message.includes('[AI')) {
       generateMaintenancePlan(safeAlert.message, safeAlert.machineName).then(plan => {
           console.log("AI Analysis Generated:", plan);
       });
    }
  }

  // -- Fallback Simulation (For Demo/Offline) --

  private startFallbackSimulation() {
    if (this.simulationInterval) return;
    // console.log(">> Starting Client-Side Simulation (Offline Fallback)");
    
    // Ensure we have at least dummy machines if DB was empty
    if (this.machines.length === 0) {
        this.machines = [
        {
          id: 'm1',
          name: 'CNC Milling Unit A',
          type: 'CNC Mill',
          location: 'Sector 1',
          status: MachineStatus.NORMAL,
          lastMaintenance: '2023-11-15',
          history: [],
          imageUrl: 'https://images.unsplash.com/photo-1565439398533-315185985834?q=80&w=1000&auto=format&fit=crop',
          modelNumber: 'HAAS-VF2',
          serialNumber: 'SN-8821-441'
        },
        {
          id: 'm2',
          name: 'Hydraulic Press B',
          type: 'Press',
          location: 'Sector 2',
          status: MachineStatus.NORMAL,
          lastMaintenance: '2023-10-01',
          history: [],
          imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=1000&auto=format&fit=crop',
           modelNumber: 'HYD-500T',
          serialNumber: 'SN-9922-112'
        },
        {
          id: 'm3',
          name: 'Robotic Arm C',
          type: 'Robot',
          location: 'Assembly Line',
          status: MachineStatus.WARNING,
          lastMaintenance: '2023-12-05',
          history: [],
          imageUrl: 'https://plus.unsplash.com/premium_photo-1661962495669-d72424626bd2?q=80&w=1000&auto=format&fit=crop',
           modelNumber: 'KUKA-KR6',
          serialNumber: 'SN-7733-991'
        }
       ];
       this.notify();
    }

    this.simulationInterval = setInterval(() => {
      const now = Date.now();
      
      this.machines.forEach((machine, index) => {
        const reading = generateFallbackReading(now, machine.status);
        
        // Simple logic to flip status occasionally for demo
        let status = machine.status;
        if (Math.random() > 0.99) status = MachineStatus.WARNING;
        if (Math.random() > 0.998) status = MachineStatus.CRITICAL;
        if (Math.random() > 0.96 && status !== MachineStatus.NORMAL) status = MachineStatus.NORMAL;

        this.updateMachineState(machine.id, reading, status);

        if (status === MachineStatus.CRITICAL && machine.status !== MachineStatus.CRITICAL) {
             const alert: Alert = {
                 id: `al-${now}`,
                 machineId: machine.id,
                 machineName: machine.name,
                 timestamp: now,
                 severity: 'high',
                 message: 'Critical anomaly detected in sensor readings.',
                 value: reading.temperature
             };
             this.handleNewAlert(alert);
        }
      });
    }, 2000);
  }

  private stopFallbackSimulation() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }
}

export const pipeline = new ManufacturingPipeline();