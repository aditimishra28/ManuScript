import { Machine, MachineStatus, Alert, SensorReading } from '../types';
import { db } from './db';
import { generateMaintenancePlan, localHeuristicCheck } from './geminiService';
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

type PipelineListener = (
    machines: Machine[], 
    alerts: Alert[], 
    isLive: boolean
) => void;

class ManufacturingPipeline {
  private machines: Machine[] = [];
  private alerts: Alert[] = [];
  private listeners: PipelineListener[] = [];
  
  // WebSocket State
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectInterval: any = null;
  private pingInterval: any = null;

  // Fallback Simulation State
  private simulationInterval: any = null;
  private readonly MAX_UI_HISTORY = 50;

  constructor() {
    this.machines = []; 
  }

  private getWebSocketUrl(): string {
    // CTO NOTE: Dynamic Protocol Detection
    // This ensures the app works in Production (HTTPS -> WSS) and Local (HTTP -> WS) automatically.
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // If we are served from localhost/vite, we assume backend is on 8080.
    // If served from a domain, we assume backend is at the same domain/root.
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return `${protocol}//${window.location.hostname}:8080`;
    } else {
        return `${protocol}//${window.location.host}`;
    }
  }

  public async start() {
    console.log("[Pipeline] System Start Sequence Initiated...");
    
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
    console.log("[Pipeline] System Shutdown...");
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectInterval) clearInterval(this.reconnectInterval);
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.stopFallbackSimulation();
  }

  public subscribe(listener: PipelineListener) {
    this.listeners.push(listener);
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
    } else {
        // If offline, save to DB so it persists until next sync
        db.upsertMachine(validatedMachine.id, validatedMachine);
    }
  }

  private notify() {
    const safeMachines = [...this.machines];
    const safeAlerts = [...this.alerts];
    this.listeners.forEach(l => l(safeMachines, safeAlerts, this.isConnected));
  }

  // -- WebSocket Logic --

  private connectWebSocket() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    
    const url = this.getWebSocketUrl();
    console.log(`[Pipeline] Attempting Connection to ${url}`);

    try {
        this.ws = new WebSocket(url);
    } catch (error) {
        this.isConnected = false;
        this.startFallbackSimulation();
        return;
    }

    this.ws.onopen = () => {
      console.log("✅ WebSocket Connected: Real-time stream active.");
      this.isConnected = true;
      this.stopFallbackSimulation(); 
      this.notify();
      
      // Heartbeat
      if (this.pingInterval) clearInterval(this.pingInterval);
      this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) this.ws.send('ping');
      }, 30000);
    };

    this.ws.onmessage = (event) => {
      if (event.data === 'pong') return;
      try {
        const message: WSMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (e) {
        // console.error("Failed to parse WS message");
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
       // Error handled by onclose
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
        const validMachines = msg.payload.machines.map(validateMachine).filter(m => m !== null) as Machine[];
        // Merge logic: Don't overwrite local machines entirely if they exist, but update them
        this.machines = validMachines; 
        this.alerts = msg.payload.recentAlerts;
        this.notify();
        break;

      case 'TELEMETRY':
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

    db.logReadings([{ ...reading, machineId: id }]).catch(() => {});
    if (machine.status !== status) {
        db.updateMachineStatus(id, status);
    }

    this.notify();
  }

  private handleNewAlert(alert: Alert) {
    // SECURITY: Sanitize incoming alert strings
    const safeAlert: Alert = {
        ...alert,
        machineName: sanitizeString(alert.machineName),
        message: sanitizeString(alert.message),
        severity: alert.severity 
    };

    // Dedup: Don't add if identical alert exists in last 5 seconds
    const recentDupe = this.alerts.find(a => 
        a.machineId === safeAlert.machineId && 
        a.message === safeAlert.message && 
        (safeAlert.timestamp - a.timestamp) < 5000
    );

    if (!recentDupe) {
        this.alerts = [safeAlert, ...this.alerts].slice(0, 50);
        db.logAlert(safeAlert);
        this.notify();
    }

    // Trigger AI Diagnosis for severe alerts automatically
    if (safeAlert.severity === 'high' && !safeAlert.message.includes('[AI')) {
       // We let the UI handle the actual generation trigger to save tokens/costs
       // or implement a debounced trigger here.
    }
  }

  // -- Fallback Simulation (Offline Mode) --

  private startFallbackSimulation() {
    if (this.simulationInterval) return;
    
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
      
      this.machines.forEach((machine) => {
        // Base parameters based on status
        const baseVib = machine.status === MachineStatus.NORMAL ? 2.5 : machine.status === MachineStatus.WARNING ? 5.5 : 8.5;
        const baseTemp = machine.status === MachineStatus.NORMAL ? 65 : 85;
        const jitter = (Math.random() - 0.5) * 0.5;

        const reading: SensorReading = {
            timestamp: now,
            vibration: Math.max(0, baseVib + Math.sin(now/1000) + jitter),
            temperature: baseTemp + Math.cos(now/2000) * 2 + jitter,
            noise: 70 + Math.random() * 5,
            rpm: 1200 + Math.random() * 20,
            powerUsage: 45 + Math.random()
        };
        
        // Z-Score Simulation: The Local Heuristic Check
        const analysisResult = localHeuristicCheck([...machine.history, reading], undefined);
        let status = machine.status;

        if (analysisResult) {
            status = analysisResult.includes("CRITICAL") ? MachineStatus.CRITICAL : MachineStatus.WARNING;
            
            // Only alert if status *changed* or rare reminder
            if (machine.status !== status || Math.random() > 0.99) {
                const alert: Alert = {
                     id: `al-${now}-${machine.id}`,
                     machineId: machine.id,
                     machineName: machine.name,
                     timestamp: now,
                     severity: status === MachineStatus.CRITICAL ? 'high' : 'medium',
                     message: analysisResult,
                     value: reading.vibration
                 };
                 this.handleNewAlert(alert);
            }
        } 

        this.updateMachineState(machine.id, reading, status);
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