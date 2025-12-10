import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  AlertOctagon, 
  LayoutDashboard, 
  Settings, 
  Cpu, 
  Search, 
  Bell,
  Menu,
  Factory
} from 'lucide-react';
import { Machine, MachineStatus, Alert, SensorReading } from './types';
import MachineModel from './components/MachineModel';

// -- Mock Data Generators --

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
      // Config
      modelNumber: 'CNC-X5000-PRO',
      installDate: '2021-03-12',
      maxRpm: 15000,
      powerRating: 25,
      maintenanceInterval: 1000,
      operatingHours: 8450
    },
    {
      id: 'm2',
      name: 'Hydraulic Press 500T',
      type: 'Press',
      location: 'Sector 2',
      status: MachineStatus.WARNING, // Start with a warning for demo
      lastMaintenance: '2023-09-20',
      imageUrl: 'https://picsum.photos/800/600?random=2',
      history: [],
      // Config
      modelNumber: 'HYD-P500-T',
      installDate: '2020-08-05',
      maxRpm: 1500,
      powerRating: 55,
      maintenanceInterval: 500,
      operatingHours: 12400
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
      // Config
      modelNumber: 'ROBO-KUKA-V2',
      installDate: '2022-01-15',
      maxRpm: 0,
      powerRating: 12,
      maintenanceInterval: 2000,
      operatingHours: 4200
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
       // Config
      modelNumber: 'CONV-M200-S',
      installDate: '2019-11-22',
      maxRpm: 3000,
      powerRating: 15,
      maintenanceInterval: 750,
      operatingHours: 18900
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

const MAX_HISTORY = 30;

// -- Main Component --

const App = () => {
  const [machines, setMachines] = useState<Machine[]>(generateInitialMachines());
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // Simulation Loop
  useEffect(() => {
    const interval = setInterval(() => {
      setMachines(prevMachines => {
        return prevMachines.map(machine => {
          // 1. Generate new reading
          const lastReading = machine.history.length > 0 ? machine.history[machine.history.length - 1] : null;
          const newReading = generateReading(lastReading, machine.status);
          
          // 2. Update History
          const newHistory = [...machine.history, newReading].slice(-MAX_HISTORY);

          // 3. Simple Threshold Logic for Status Transition (Simulation)
          // In a real app, this might be more complex or driven by the backend
          let newStatus = machine.status;
          
          // Randomly trigger issues for demo purposes on specific machines if they are normal
          if (machine.status === MachineStatus.NORMAL && Math.random() > 0.98) {
             // 2% chance to degrade to warning per tick
             newStatus = MachineStatus.WARNING;
          }

          // If in Warning, small chance to go critical or back to normal (simulated fluctuation)
          if (machine.status === MachineStatus.WARNING) {
             if (newReading.temperature > 85 || newReading.vibration > 7) {
                 newStatus = MachineStatus.CRITICAL;
             } else if (Math.random() > 0.95) {
                 newStatus = MachineStatus.NORMAL; // Self-corrected?
             }
          }

          return { ...machine, history: newHistory, status: newStatus };
        });
      });
    }, 2000); // 2 seconds tick

    return () => clearInterval(interval);
  }, []);

  // Alert Generation based on machine state changes
  useEffect(() => {
    machines.forEach(m => {
        const lastReading = m.history[m.history.length - 1];
        if (!lastReading) return;

        if (m.status === MachineStatus.CRITICAL) {
            // Check if alert already exists recently
            const existing = alerts.find(a => a.machineId === m.id && Date.now() - a.timestamp < 10000);
            if (!existing) {
                const newAlert: Alert = {
                    id: Math.random().toString(36).substr(2, 9),
                    machineId: m.id,
                    machineName: m.name,
                    timestamp: Date.now(),
                    severity: 'high',
                    message: `Critical anomaly detected: ${lastReading.vibration > 6 ? 'High Vibration' : 'Overheating'}`,
                    value: lastReading.vibration > 6 ? lastReading.vibration : lastReading.temperature
                };
                setAlerts(prev => [newAlert, ...prev].slice(0, 50)); // Keep last 50
            }
        }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machines]); // Check whenever machines update

  const getStatusColor = (status: MachineStatus) => {
    switch (status) {
      case MachineStatus.NORMAL: return 'bg-emerald-500';
      case MachineStatus.WARNING: return 'bg-amber-500';
      case MachineStatus.CRITICAL: return 'bg-rose-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-slate-900 border-r border-slate-800 flex flex-col z-20`}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
           <Factory className="w-8 h-8 text-indigo-500 shrink-0" />
           {isSidebarOpen && <span className="font-bold text-xl tracking-tight text-white">Sentin<span className="text-indigo-500">AI</span></span>}
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
           <button className="flex items-center gap-3 w-full p-3 rounded-lg bg-indigo-600/10 text-indigo-400 border border-indigo-600/20">
              <LayoutDashboard className="w-5 h-5" />
              {isSidebarOpen && <span className="font-medium">Dashboard</span>}
           </button>
           <button className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
              <AlertOctagon className="w-5 h-5" />
              {isSidebarOpen && <span className="font-medium">Alerts</span>}
           </button>
           <button className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
              <Cpu className="w-5 h-5" />
              {isSidebarOpen && <span className="font-medium">Machines</span>}
           </button>
           <button className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
              <Settings className="w-5 h-5" />
              {isSidebarOpen && <span className="font-medium">Settings</span>}
           </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-xs">
                    OP
                </div>
                {isSidebarOpen && (
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-white">Operator A.</span>
                        <span className="text-xs text-slate-500">Floor Manager</span>
                    </div>
                )}
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Top Header */}
        <header className="h-16 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 z-10">
           <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
              <Menu className="w-5 h-5" />
           </button>

           <div className="flex items-center gap-6">
              <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                 <input 
                    type="text" 
                    placeholder="Search Machine ID..." 
                    className="bg-slate-950 border border-slate-800 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 w-64 transition-all"
                 />
              </div>
              <div className="relative">
                 <Bell className="w-5 h-5 text-slate-400 hover:text-white cursor-pointer" />
                 {alerts.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold animate-pulse">
                        {alerts.length}
                    </span>
                 )}
              </div>
           </div>
        </header>

        {/* Dashboard Grid */}
        <div className="flex-1 overflow-y-auto p-6">
            
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
                    <h3 className="text-slate-400 text-sm font-medium">Total Machines</h3>
                    <div className="text-3xl font-bold text-white mt-2">{machines.length}</div>
                    <div className="text-emerald-500 text-xs mt-2 flex items-center gap-1">
                        <Activity className="w-3 h-3" /> 100% Online
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
                    <h3 className="text-slate-400 text-sm font-medium">Critical Issues</h3>
                    <div className="text-3xl font-bold text-white mt-2">
                        {machines.filter(m => m.status === MachineStatus.CRITICAL).length}
                    </div>
                    <div className="text-rose-500 text-xs mt-2">Requires Attention</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
                    <h3 className="text-slate-400 text-sm font-medium">Avg Efficiency</h3>
                    <div className="text-3xl font-bold text-white mt-2">94.2%</div>
                    <div className="text-slate-500 text-xs mt-2">Target: 92%</div>
                </div>
                 <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
                    <h3 className="text-slate-400 text-sm font-medium">Power Usage</h3>
                    <div className="text-3xl font-bold text-white mt-2">452 <span className="text-lg text-slate-500 font-normal">kW</span></div>
                    <div className="text-amber-500 text-xs mt-2">+2.4% vs last hour</div>
                </div>
            </div>

            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                Floor Overview 
                <span className="text-xs font-normal text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                    Updating Live
                </span>
            </h2>

            {/* Machine Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {machines.map(machine => {
                    const latest = machine.history[machine.history.length - 1];
                    return (
                        <div 
                            key={machine.id}
                            onClick={() => setSelectedMachine(machine)}
                            className={`group bg-slate-900 border rounded-xl p-5 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl ${
                                machine.status === MachineStatus.CRITICAL ? 'border-rose-500/50 shadow-rose-500/10' :
                                machine.status === MachineStatus.WARNING ? 'border-amber-500/50 shadow-amber-500/10' :
                                'border-slate-800 hover:border-indigo-500/50'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-lg text-white group-hover:text-indigo-400 transition-colors">{machine.name}</h3>
                                    <p className="text-xs text-slate-500">{machine.type} • {machine.location}</p>
                                </div>
                                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                    machine.status === MachineStatus.NORMAL ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-400' :
                                    machine.status === MachineStatus.WARNING ? 'bg-amber-950/50 border-amber-500/30 text-amber-400' :
                                    'bg-rose-950/50 border-rose-500/30 text-rose-400 animate-pulse'
                                }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(machine.status)}`} />
                                    {machine.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mb-4">
                                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                                    <div className="text-[10px] text-slate-500 uppercase">Vibration</div>
                                    <div className={`text-sm font-mono font-medium ${latest?.vibration > 6 ? 'text-rose-400' : 'text-slate-200'}`}>
                                        {latest?.vibration.toFixed(2)} mm/s
                                    </div>
                                </div>
                                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                                    <div className="text-[10px] text-slate-500 uppercase">Temp</div>
                                    <div className={`text-sm font-mono font-medium ${latest?.temperature > 85 ? 'text-rose-400' : 'text-slate-200'}`}>
                                        {latest?.temperature.toFixed(1)} °C
                                    </div>
                                </div>
                                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                                    <div className="text-[10px] text-slate-500 uppercase">Noise</div>
                                    <div className="text-sm font-mono font-medium text-slate-200">
                                        {latest?.noise.toFixed(0)} dB
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-800 pt-3">
                                <span>Maintained: {machine.lastMaintenance}</span>
                                <span className="text-indigo-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                    View Analytics &rarr;
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Recent Alerts Table */}
            <div className="mt-8 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="font-semibold text-white">Live Alert Log</h3>
                    <button className="text-xs text-indigo-400 hover:text-indigo-300">View All History</button>
                </div>
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-950 text-slate-500">
                        <tr>
                            <th className="px-6 py-3 font-medium">Time</th>
                            <th className="px-6 py-3 font-medium">Machine</th>
                            <th className="px-6 py-3 font-medium">Severity</th>
                            <th className="px-6 py-3 font-medium">Message</th>
                            <th className="px-6 py-3 font-medium">Value</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {alerts.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                    No active alerts. Systems normal.
                                </td>
                            </tr>
                        ) : (
                            alerts.slice(0, 5).map(alert => (
                                <tr key={alert.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                                        {new Date(alert.timestamp).toLocaleTimeString()}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-200">
                                        {alert.machineName}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                            alert.severity === 'high' ? 'bg-rose-500/20 text-rose-400' : 
                                            alert.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                                        }`}>
                                            {alert.severity}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-300">
                                        {alert.message}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-slate-400">
                                        {alert.value?.toFixed(2)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

        </div>
      </main>

      {/* Detail Modal / Overlay */}
      {selectedMachine && (
        <MachineModel 
            machine={selectedMachine} 
            onClose={() => setSelectedMachine(null)} 
        />
      )}

    </div>
  );
};

export default App;