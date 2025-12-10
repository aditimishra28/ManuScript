import React, { useState } from 'react';
import { Machine, MachineStatus, SensorReading } from '../types';
import { LiveCharts } from './LiveCharts';
import { 
  BrainCircuit, 
  AlertTriangle, 
  CheckCircle, 
  Thermometer, 
  Activity, 
  Volume2, 
  Video,
  Settings,
  History,
  MonitorPlay,
  ClipboardList,
  Calendar,
  Zap,
  Gauge
} from 'lucide-react';
import { analyzeMachineHealth, generateMaintenancePlan } from '../services/geminiService';

interface MachineModelProps {
  machine: Machine;
  onClose: () => void;
}

type Tab = 'live' | 'config' | 'history';

const MachineModel: React.FC<MachineModelProps> = ({ machine, onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>('live');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [structuredPlan, setStructuredPlan] = useState<any>(null);

  const handleRunDiagnostics = async () => {
    setIsAnalyzing(true);
    setAiInsight(null);
    setStructuredPlan(null);
    
    // Simulate thinking delay
    setTimeout(async () => {
        const result = await analyzeMachineHealth(machine, machine.history);
        setAiInsight(result);
        
        // If critical, generate a plan automatically
        if (machine.status === MachineStatus.CRITICAL || machine.status === MachineStatus.WARNING) {
            const plan = await generateMaintenancePlan("Abnormal sensor readings detected", machine.name);
            setStructuredPlan(plan);
        }
        
        setIsAnalyzing(false);
    }, 500);
  };

  const latestReading = machine.history[machine.history.length - 1];

  const renderLiveMonitor = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-y-auto pr-2">
       {/* Left Column: Stats & Camera */}
       <div className="space-y-6">
            
            {/* Camera Feed Simulation */}
            <div className="bg-black rounded-lg border border-slate-700 overflow-hidden relative group shadow-lg">
              <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded animate-pulse flex items-center gap-1 z-10">
                <div className="w-2 h-2 bg-white rounded-full"></div> LIVE
              </div>
              <img 
                src={machine.imageUrl} 
                alt="Machine Feed" 
                className="w-full h-64 object-cover opacity-80"
              />
              <div className="absolute inset-0 border-[4px] border-slate-800/0 hover:border-blue-500/30 transition-all pointer-events-none flex items-center justify-center">
                 <Video className="text-slate-600/20 w-16 h-16" />
              </div>
              
              {/* Augmented Reality Overlay Simulation */}
              <div className="absolute bottom-4 left-4 right-4 bg-slate-900/80 backdrop-blur-md p-3 rounded border border-slate-600 text-xs text-slate-300">
                <div className="flex justify-between">
                    <span>Alignment:</span>
                    <span className="text-emerald-400">99.8%</span>
                </div>
                <div className="flex justify-between">
                    <span>Thermal Signature:</span>
                    <span className={latestReading?.temperature > 80 ? "text-rose-400" : "text-emerald-400"}>
                        {latestReading?.temperature > 80 ? "Hot Spot Detected" : "Normal"}
                    </span>
                </div>
              </div>
            </div>

            {/* Current Metrics Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                 <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <Activity className="w-4 h-4" /> Vibration
                 </div>
                 <div className="text-2xl font-mono text-white">{latestReading?.vibration.toFixed(2)} <span className="text-sm text-slate-500">mm/s</span></div>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                 <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <Thermometer className="w-4 h-4" /> Temp
                 </div>
                 <div className="text-2xl font-mono text-white">{latestReading?.temperature.toFixed(1)} <span className="text-sm text-slate-500">°C</span></div>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                 <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <Volume2 className="w-4 h-4" /> Noise
                 </div>
                 <div className="text-2xl font-mono text-white">{latestReading?.noise.toFixed(1)} <span className="text-sm text-slate-500">dB</span></div>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                 <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <Activity className="w-4 h-4" /> RPM
                 </div>
                 <div className="text-2xl font-mono text-white">{Math.round(latestReading?.rpm)} <span className="text-sm text-slate-500">rev/m</span></div>
              </div>
            </div>

          </div>

          {/* Middle Column: Live Charts */}
          <div className="lg:col-span-1 space-y-4 flex flex-col">
            <LiveCharts 
                data={machine.history} 
                dataKey="vibration" 
                color="#f59e0b" 
                label="Vibration Analysis" 
                unit="mm/s"
                threshold={6.0} 
            />
            <LiveCharts 
                data={machine.history} 
                dataKey="temperature" 
                color="#f43f5e" 
                label="Thermal Sensor" 
                unit="°C" 
                threshold={85}
            />
            <LiveCharts 
                data={machine.history} 
                dataKey="noise" 
                color="#3b82f6" 
                label="Acoustic Emissions" 
                unit="dB" 
                threshold={90}
            />
          </div>

          {/* Right Column: AI Diagnostics */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                    <BrainCircuit className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Gemini Predictive Core</h3>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto mb-4 custom-scrollbar">
                {isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center h-40 space-y-3 animate-pulse">
                        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-indigo-300 text-sm">Processing telemetry streams...</p>
                        <p className="text-slate-500 text-xs">Analyzing patterns in vibration and thermal data</p>
                    </div>
                ) : aiInsight ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-indigo-950/30 border border-indigo-500/30 p-4 rounded-lg">
                            <h4 className="text-indigo-400 text-sm font-semibold mb-2 uppercase tracking-wider">Analysis Result</h4>
                            <p className="text-slate-300 text-sm leading-relaxed">
                                {aiInsight}
                            </p>
                        </div>
                        
                        {structuredPlan && (
                            <div className="bg-slate-900 border border-slate-700 p-4 rounded-lg space-y-3">
                                <div className="flex justify-between items-start">
                                    <h4 className="text-white font-medium">Action Plan</h4>
                                    <span className={`px-2 py-1 text-xs rounded uppercase font-bold ${
                                        structuredPlan.urgency === 'Immediate' ? 'bg-red-500 text-white' :
                                        structuredPlan.urgency === 'High' ? 'bg-orange-500 text-white' :
                                        'bg-blue-500 text-white'
                                    }`}>
                                        {structuredPlan.urgency} Priority
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="text-slate-400 text-xs block">Diagnosis</span>
                                            <span className="text-slate-200 text-sm">{structuredPlan.diagnosis}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="text-slate-400 text-xs block">Recommendation</span>
                                            <span className="text-slate-200 text-sm">{structuredPlan.recommendation}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2">
                        <BrainCircuit className="w-12 h-12 opacity-20" />
                        <p className="text-sm">Ready to analyze sensor streams.</p>
                    </div>
                )}
            </div>

            <button
                onClick={handleRunDiagnostics}
                disabled={isAnalyzing}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-lg font-medium shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
                {isAnalyzing ? 'Running Diagnostics...' : 'Run Gemini Analysis'}
            </button>
          </div>
    </div>
  );

  const renderConfig = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-4 h-full overflow-y-auto">
        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 pb-2 border-b border-slate-700">
                <Settings className="w-5 h-5 text-indigo-400" />
                Technical Specifications
            </h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <div className="text-slate-500 text-xs uppercase mb-1">Model Number</div>
                    <div className="text-white font-mono">{machine.modelNumber || 'N/A'}</div>
                </div>
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <div className="text-slate-500 text-xs uppercase mb-1">Installation Date</div>
                    <div className="text-white font-mono flex items-center gap-2">
                        <Calendar className="w-3 h-3" /> {machine.installDate || 'N/A'}
                    </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <div className="text-slate-500 text-xs uppercase mb-1">Power Rating</div>
                    <div className="text-white font-mono flex items-center gap-2">
                        <Zap className="w-3 h-3 text-yellow-500" /> {machine.powerRating ? `${machine.powerRating} kW` : 'N/A'}
                    </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <div className="text-slate-500 text-xs uppercase mb-1">Max RPM</div>
                    <div className="text-white font-mono flex items-center gap-2">
                        <Gauge className="w-3 h-3 text-red-400" /> {machine.maxRpm || 'N/A'}
                    </div>
                </div>
            </div>

            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                <h4 className="text-sm font-medium text-slate-300 mb-4">Operational Limits</h4>
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400">Vibration Warning Threshold</span>
                            <span className="text-amber-400">5.0 mm/s</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 w-[60%]"></div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400">Temperature Critical Limit</span>
                            <span className="text-rose-400">90°C</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500 w-[80%]"></div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400">Maintenance Cycle</span>
                            <span className="text-blue-400">Every {machine.maintenanceInterval || 500} hours</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 w-[45%]"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 pb-2 border-b border-slate-700">
                <ClipboardList className="w-5 h-5 text-indigo-400" />
                Maintenance Config
            </h3>
            
             <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-950 text-slate-400 text-xs uppercase">
                        <tr>
                            <th className="px-4 py-3 text-left">Parameter</th>
                            <th className="px-4 py-3 text-left">Set Point</th>
                            <th className="px-4 py-3 text-left">Tolerance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        <tr>
                            <td className="px-4 py-3 text-slate-300">Baseline Vibration</td>
                            <td className="px-4 py-3 text-slate-400">2.5 mm/s</td>
                            <td className="px-4 py-3 text-slate-400">± 0.5</td>
                        </tr>
                        <tr>
                            <td className="px-4 py-3 text-slate-300">Operating Temp</td>
                            <td className="px-4 py-3 text-slate-400">65°C</td>
                            <td className="px-4 py-3 text-slate-400">± 10°C</td>
                        </tr>
                        <tr>
                            <td className="px-4 py-3 text-slate-300">Oil Pressure</td>
                            <td className="px-4 py-3 text-slate-400">45 PSI</td>
                            <td className="px-4 py-3 text-slate-400">± 5 PSI</td>
                        </tr>
                         <tr>
                            <td className="px-4 py-3 text-slate-300">Input Voltage</td>
                            <td className="px-4 py-3 text-slate-400">480 V</td>
                            <td className="px-4 py-3 text-slate-400">± 5%</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-indigo-500/20 rounded shrink-0">
                        <History className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h4 className="text-indigo-300 font-medium mb-1">Total Operating Hours</h4>
                        <div className="text-2xl font-bold text-white mb-1">{machine.operatingHours?.toLocaleString() || '12,450'} <span className="text-sm font-normal text-slate-400">hrs</span></div>
                        <p className="text-xs text-slate-500">Since last major overhaul</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );

  const renderHistory = () => (
    <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-400" />
                Sensor Log History
            </h3>
            <button className="px-3 py-1.5 bg-slate-800 text-slate-300 text-sm rounded border border-slate-700 hover:bg-slate-700">
                Export CSV
            </button>
        </div>
        <div className="flex-1 overflow-auto bg-slate-800 rounded-lg border border-slate-700">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-950 text-slate-400 sticky top-0">
                    <tr>
                        <th className="px-4 py-3 font-medium">Timestamp</th>
                        <th className="px-4 py-3 font-medium">Vibration (mm/s)</th>
                        <th className="px-4 py-3 font-medium">Temp (°C)</th>
                        <th className="px-4 py-3 font-medium">Noise (dB)</th>
                        <th className="px-4 py-3 font-medium">RPM</th>
                        <th className="px-4 py-3 font-medium">Power (kW)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                    {/* Reverse copy to show newest first */}
                    {[...machine.history].reverse().map((reading) => (
                        <tr key={reading.timestamp} className="hover:bg-slate-700/50 transition-colors">
                            <td className="px-4 py-3 font-mono text-slate-400">
                                {new Date(reading.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}.{new Date(reading.timestamp).getMilliseconds()}
                            </td>
                            <td className={`px-4 py-3 font-mono ${reading.vibration > 6 ? 'text-rose-400 font-bold' : 'text-slate-200'}`}>
                                {reading.vibration.toFixed(3)}
                            </td>
                            <td className={`px-4 py-3 font-mono ${reading.temperature > 85 ? 'text-rose-400 font-bold' : 'text-slate-200'}`}>
                                {reading.temperature.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-200">
                                {reading.noise.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-200">
                                {Math.round(reading.rpm)}
                            </td>
                             <td className="px-4 py-3 font-mono text-slate-200">
                                {reading.powerUsage.toFixed(2)}
                            </td>
                        </tr>
                    ))}
                     {machine.history.length === 0 && (
                        <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                No logs recorded yet.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 w-full max-w-6xl h-[90vh] rounded-xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
          <div className="flex items-center gap-4">
             <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                {machine.name}
                <span className={`text-xs px-2 py-1 rounded-full border ${
                    machine.status === MachineStatus.NORMAL ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' :
                    machine.status === MachineStatus.WARNING ? 'bg-amber-500/20 border-amber-500 text-amber-400' :
                    'bg-rose-500/20 border-rose-500 text-rose-400'
                }`}>
                    {machine.status}
                </span>
                </h2>
                <p className="text-slate-400 text-xs mt-0.5 font-mono">{machine.id.toUpperCase()} • {machine.location}</p>
             </div>
          </div>
          
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            Close Panel
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-700 bg-slate-900 px-6">
            <button 
                onClick={() => setActiveTab('live')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'live' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
                <MonitorPlay className="w-4 h-4" /> Live Monitor
            </button>
            <button 
                 onClick={() => setActiveTab('config')}
                 className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'config' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
                <Settings className="w-4 h-4" /> Configuration
            </button>
            <button 
                 onClick={() => setActiveTab('history')}
                 className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'history' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
                <ClipboardList className="w-4 h-4" /> Sensor Logs
            </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden p-6 bg-slate-900/50">
            {activeTab === 'live' && renderLiveMonitor()}
            {activeTab === 'config' && renderConfig()}
            {activeTab === 'history' && renderHistory()}
        </div>

      </div>
    </div>
  );
};

export default MachineModel;