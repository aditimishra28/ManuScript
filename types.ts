export enum MachineStatus {
  NORMAL = 'NORMAL',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  OFFLINE = 'OFFLINE'
}

export interface SensorReading {
  timestamp: number;
  vibration: number; // mm/s
  temperature: number; // Celsius
  noise: number; // dB
  rpm: number;
  powerUsage: number; // kW
}

export interface Machine {
  id: string;
  name: string;
  type: string;
  location: string;
  status: MachineStatus;
  lastMaintenance: string;
  history: SensorReading[];
  imageUrl: string;
  // Configuration & Specs
  modelNumber?: string;
  installDate?: string;
  maxRpm?: number;
  powerRating?: number; // kW
  maintenanceInterval?: number; // hours
  operatingHours?: number;
}

export interface Alert {
  id: string;
  machineId: string;
  machineName: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
  message: string;
  sensorType?: string;
  value?: number;
}

export interface GeminiAnalysisResult {
  diagnosis: string;
  recommendation: string;
  urgency: 'Low' | 'Medium' | 'High' | 'Immediate';
}