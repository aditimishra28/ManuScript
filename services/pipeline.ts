import { Machine, MachineStatus, Alert, SensorReading } from '../types';
import { db } from './db';
import { localHeuristicCheck } from './geminiService';
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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;

    if (!hostname) return 'ws://localhost:8080';

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${protocol}//${hostname}:8080`;
    } else {
        return `${protocol}//${window.location.host}`;
    }
  }

  public async start() {
    console.log("[Pipeline] System Start Sequence Initiated...");
    try {
      // Load initial state
      this.machines = await db.getAllMachinesWithLatestHistory();
      this.alerts = await db.alerts.orderBy('timestamp').reverse().limit(50).toArray();
      this.notify();
    } catch (e) {
      console.warn("Failed to load local DB cache", e);
    }
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
    // Initial call
    listener(this.machines, this.alerts, this.isConnected);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public registerMachine(machineData: Partial<Machine>) {
    console.log("Registering machine via API...", machineData);
    
    const rawMachine = {
      id: `m${Date.now()}`,
      name: sanitizeString(machineData.name || 'New Machine'),
      type: sanitizeString(machineData.type || 'Generic'),
      location: sanitizeString(machineData.location || 'Unknown'),
      status: MachineStatus.NORMAL,
      lastMaintenance: new Date().toISOString(),
      history: [],
      imageUrl: machineData.imageUrl || 'https://picsum.photos/800/600',
      modelNumber: machineData.modelNumber,
      serialNumber: machineData.serialNumber,
      networkIp: machineData.networkIp
    } as Machine;

    const machine = validateMachine(rawMachine);
    if (!machine) return;

    // Immutable Add
    this.machines = [...this.machines, machine];
    db.upsertMachine(machine.id, machine);
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'REGISTER_MACHINE', payload: machine }));
    } else {
        if (!this.isConnected) {
            this.startFallbackSimulation(); 
        }
    }
    this.notify();
  }

  private connectWebSocket() {
    if (this.ws) return;

    const url = this.getWebSocketUrl();
    console.log(`[Pipeline] Connecting to Industrial Bus: ${url}`);
    
    try {
        this.ws = new WebSocket(url);
        
        this.ws.onopen = () => {
            console.log("[Pipeline] WebSocket Connected");
            this.isConnected = true;
            this.stopFallbackSimulation();
            this.notify();
            if (this.reconnectInterval) {
                clearInterval(this.reconnectInterval);
                this.reconnectInterval = null;
            }
            
            this.pingInterval = setInterval(() => {
                if (this.ws?.readyState === WebSocket.OPEN) this.ws.send('ping');
            }, 30000);
        };

        this.ws.onclose = () => {
            console.log("[Pipeline] WebSocket Disconnected. Switching to Fallback Simulation.");
            this.isConnected = false;
            this.ws = null;
            if (this.pingInterval) clearInterval(this.pingInterval);
            this.startFallbackSimulation();
            this.notify();
            this.scheduleReconnect();
        };

        this.ws.onerror = (err) => {
            console.warn("[Pipeline] WS Error", err);
        };

        this.ws.onmessage = (event) => {
            if (event.data === 'pong') return;
            try {
                const message = JSON.parse(event.data) as WSMessage;
                this.handleMessage(message);
            } catch (e) {
                console.error("Failed to parse WS message", e);
            }
        };

    } catch (e) {
        console.error("WS Connection Failed", e);
        this.startFallbackSimulation();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectInterval) return;
    this.reconnectInterval = setInterval(() => {
        console.log("[Pipeline] Attempting Reconnect...");
        this.connectWebSocket();
    }, 5000);
  }

  private handleMessage(message: WSMessage) {
    switch (message.type) {
        case 'INIT':
            // Merge strategy
            this.machines = message.payload.machines.map(serverMachine => {
                const local = this.machines.find(m => m.id === serverMachine.id);
                return {
                    ...serverMachine,
                    history: local ? local.history : (serverMachine.history || [])
                };
            });
            this.alerts = message.payload.recentAlerts;
            break;
            
        case 'TELEMETRY':
             this.handleTelemetry(message.payload);
             break;
             
        case 'ALERT':
             this.handleAlert(message.payload);
             break;
    }
    this.notify();
  }

  private handleTelemetry(payload: { machineId: string; reading: SensorReading; status: MachineStatus }) {
      const machineIndex = this.machines.findIndex(m => m.id === payload.machineId);
      if (machineIndex !== -1) {
          // CRITICAL: Immutable Update Pattern for React
          const oldMachine = this.machines[machineIndex];
          
          const validatedReading = validateSensorReading(payload.reading);
          let newHistory = oldMachine.history;

          if (validatedReading) {
              // Create new array reference
              newHistory = [...oldMachine.history, validatedReading];
              if (newHistory.length > this.MAX_UI_HISTORY) {
                  newHistory = newHistory.slice(newHistory.length - this.MAX_UI_HISTORY);
              }
          }

          const newMachine = {
              ...oldMachine,
              history: newHistory,
              status: payload.status
          };

          // Update main array immutably
          const newMachinesList = [...this.machines];
          newMachinesList[machineIndex] = newMachine;
          this.machines = newMachinesList;
      }
  }

  private handleAlert(alert: Alert) {
      if (!this.alerts.some(a => a.id === alert.id)) {
          // Immutable Alert Update
          const newAlerts = [alert, ...this.alerts];
          if (newAlerts.length > 50) newAlerts.pop();
          this.alerts = newAlerts;
          
          if (alert.severity === 'high' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification(`CRITICAL: ${alert.machineName}`, { body: alert.message });
          }
      }
  }

  // --- FALLBACK SIMULATION ENGINE ---
  private startFallbackSimulation() {
      if (this.simulationInterval) return;
      console.log("[Pipeline] Starting Physics Simulation Engine...");
      
      // Seed if empty
      if (this.machines.length === 0) {
          const defaults: Machine[] = [
              { id: 'm1', name: 'CNC Mill - Axis X', type: 'CNC', location: 'Zone A', status: MachineStatus.NORMAL, lastMaintenance: new Date().toISOString(), imageUrl: 'https://images.unsplash.com/photo-1565439303660-84313daa4e85', history: [] },
              { id: 'm2', name: 'Hydraulic Press 4', type: 'Press', location: 'Zone B', status: MachineStatus.WARNING, lastMaintenance: new Date().toISOString(), imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158', history: [] },
              { id: 'm3', name: 'Robotic Arm L7', type: 'Robot', location: 'Zone C', status: MachineStatus.NORMAL, lastMaintenance: new Date().toISOString(), imageUrl: 'https://images.unsplash.com/photo-1531746790731-6c087fecd65a', history: [] },
              { id: 'm4', name: 'Conveyor Motor', type: 'Motor', location: 'Zone A', status: MachineStatus.CRITICAL, lastMaintenance: new Date().toISOString(), imageUrl: 'https://images.unsplash.com/photo-1581093458791-9f3c3900df4b', history: [] },
          ];
          this.machines = defaults;
          db.initializeWithDefaults(defaults);
      }

      this.simulationInterval = setInterval(() => {
          const now = Date.now();
          
          // CRITICAL: Immutable Simulation Updates
          let updatedMachines = [...this.machines];
          let updatedAlerts = this.alerts;

          updatedMachines = updatedMachines.map(machine => {
              const isCritical = machine.status === MachineStatus.CRITICAL;
              const isWarning = machine.status === MachineStatus.WARNING;
              
              const baseVib = isCritical ? 8.0 : isWarning ? 5.0 : 2.0;
              const baseTemp = isCritical ? 95 : isWarning ? 80 : 65;
              const baseNoise = isCritical ? 95 : 75;
              const baseProd = isCritical ? 40 : 120;

              const reading: SensorReading = {
                  timestamp: now,
                  vibration: baseVib + (Math.random() * 2) - 1,
                  temperature: baseTemp + (Math.sin(now / 10000) * 5) + (Math.random() * 2),
                  noise: baseNoise + (Math.random() * 10),
                  rpm: isCritical ? 0 : 1200 + (Math.random() * 50),
                  powerUsage: isCritical ? 10 : 45 + (Math.random() * 5),
                  productionRate: Math.max(0, baseProd + (Math.random() * 20) - 10)
              };

              let newHistory = [...machine.history, reading];
              if (newHistory.length > this.MAX_UI_HISTORY) {
                  newHistory = newHistory.slice(newHistory.length - this.MAX_UI_HISTORY);
              }

              // Background DB Log
              db.logReadings([{...reading, machineId: machine.id}]);

              // Heuristics
              const alertMsg = localHeuristicCheck(newHistory, null);
              if (alertMsg && Math.random() > 0.95) {
                  const alert: Alert = {
                      id: `sim-${now}-${machine.id}`,
                      machineId: machine.id,
                      machineName: machine.name,
                      timestamp: now,
                      severity: alertMsg.includes('CRITICAL') ? 'high' : 'medium',
                      message: alertMsg,
                      value: reading.vibration
                  };
                  // Immutable alert prepend
                  if (!updatedAlerts.some(a => a.id === alert.id)) {
                      updatedAlerts = [alert, ...updatedAlerts].slice(0, 50);
                  }
              }

              return {
                  ...machine,
                  history: newHistory
              };
          });

          this.machines = updatedMachines;
          this.alerts = updatedAlerts;
          this.notify();

      }, 2000);
  }

  private stopFallbackSimulation() {
      if (this.simulationInterval) {
          clearInterval(this.simulationInterval);
          this.simulationInterval = null;
      }
  }

  private notify() {
      this.listeners.forEach(l => l(this.machines, this.alerts, this.isConnected));
  }
}

export const pipeline = new ManufacturingPipeline();