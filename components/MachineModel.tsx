import React, { useState, useEffect, useRef } from 'react';
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
  VideoOff,
  Settings,
  History,
  MonitorPlay,
  ClipboardList,
  Calendar,
  Zap,
  Gauge,
  Wifi,
  Cpu,
  Edit,
  Save,
  X
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

  // Configuration Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [configForm, setConfigForm] = useState({
    modelNumber: machine.modelNumber || '',
    serialNumber: machine.serialNumber || '',
    powerRating: machine.powerRating?.toString() || '',
    maxRpm: machine.maxRpm?.toString() || '',
    firmwareVersion: machine.firmwareVersion || '',
    networkIp: machine.networkIp || ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Manage Camera Stream
  useEffect(() => {
    let stream: MediaStream | null = null;

    if (isCameraActive) {
      const startCamera = async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Error accessing camera:", err);
          setIsCameraActive(false);
          alert("Could not access camera. Please check permissions.");
        }
      };
      startCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraActive]);


  // Reset form when machine changes or editing stops
  useEffect(() => {
    if (!isEditing) {
        setConfigForm({
            modelNumber: machine.modelNumber || '',
            serialNumber: machine.serialNumber || '',
            powerRating: machine.powerRating?.toString() || '',
            maxRpm: machine.maxRpm?.toString() || '',
            firmwareVersion: machine.firmwareVersion || '',
            networkIp: machine.networkIp || ''
        });
        setErrors({});
    }
  }, [machine, isEditing]);

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

  const validateAndSaveConfig = () => {
    const newErrors: Record<string, string> = {};
    
    // 1. Model & Serial Checks
    if (!configForm.modelNumber.trim()) newErrors.modelNumber = "Model Number is required";
    if (!configForm.serialNumber.trim()) newErrors.serialNumber = "Serial Number is required";

    // 2. Numeric Checks
    const power = parseFloat(configForm.powerRating);
    if (isNaN(power) || power <= 0) newErrors.powerRating = "Must be a positive number";

    const rpm = parseFloat(configForm.maxRpm);
    if (isNaN(rpm) || rpm <= 0) newErrors.maxRpm = "Must be a positive number";
    if (rpm > 50000) newErrors.maxRpm = "Exceeds safety limit (50k)";

    // 3. IP Address Check
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(configForm.networkIp)) {
        newErrors.networkIp = "Invalid IP Address format";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
        // Validation Passed
        setIsEditing(false);
        // In a real app, we would dispatch an update to the backend here
        // onUpdate(machine.id, configForm);
    }
  };

  const handleInputChange = (field: string, value: string) => {
      setConfigForm(prev => ({...prev, [field]: value}));
      // Clear error on change
      if (errors[field]) {
          setErrors(prev => {
              const next = {...prev};
              delete next[field];
              return next;
          });
      }
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
              
              <button 
                onClick={() => setIsCameraActive(!isCameraActive)}
                className="absolute top-2 right-2 z-20 bg-slate-900/80 hover:bg-slate-700 text-white text-[10px] px-2 py-1 rounded border border-slate-600 transition-colors flex items-center gap-1 backdrop-blur-sm"
              >
                {isCameraActive ? <VideoOff className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                {isCameraActive ? "Stop Cam" : "Connect Cam"}
              </button>

              {isCameraActive ? (
                <video 
                    ref={videoRef}
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-64 object-cover"
                />
              ) : (
                <>
                    <img 
                        src={machine.imageUrl} 
                        alt="Machine Feed" 
                        className="w-full h-64 object-cover opacity-80"
                    />
                    <div className="absolute inset-0 border-[4px] border-slate-800/0 hover:border-blue-500/30 transition-all pointer-events-none flex items-center justify-center">
                        <Video className="text-slate-600/20 w-16 h-16" />
                    </div>
                </>
              )}
              
              {/* Augmented Reality Overlay Simulation */}
              <div className="absolute bottom-4 left-4 right-4 bg-slate-900/80 backdrop-blur-md p-3 rounded border border-slate-600 text-xs text-slate-300 z-10">
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
            <div className="flex justify-between items-center pb-2 border-b border-slate-700">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-400" />
                    Technical Specifications
                </h3>
                
                {isEditing ? (
                    <div className="flex items-center gap-2">
                         <button 
                            onClick={validateAndSaveConfig}
                            className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded transition-colors"
                         >
                            <Save className="w-3 h-3" /> Save
                         </button>
                         <button 
                            onClick={() => setIsEditing(false)}
                            className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded transition-colors"
                         >
                            <X className="w-3 h-3" /> Cancel
                         </button>
                    </div>
                ) : (
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="text-xs flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded border border-slate-700 transition-colors"
                    >
                        <Edit className="w-3 h-3" /> Edit Mode
                    </button>
                )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                {/* Model Number */}
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <div className="text-slate-500 text-xs uppercase mb-1">Model Number</div>
                    {isEditing ? (
                        <>
                            <input 
                                value={configForm.modelNumber}
                                onChange={(e) => handleInputChange('modelNumber', e.target.value)}
                                className={`w-full bg-slate-900 border ${errors.modelNumber ? 'border-rose-500' : 'border-slate-600'} rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500`}
                            />
                            {errors.modelNumber && <p className="text-rose-500 text-[10px] mt-1">{errors.modelNumber}</p>}
                        </>
                    ) : (
                        <div className="text-white font-mono">{configForm.modelNumber || 'N/A'}</div>
                    )}
                </div>

                {/* Serial Number */}
                 <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <div className="text-slate-500 text-xs uppercase mb-1">Serial Number</div>
                    {isEditing ? (
                        <>
                            <input 
                                value={configForm.serialNumber}
                                onChange={(e) => handleInputChange('serialNumber', e.target.value)}
                                className={`w-full bg-slate-900 border ${errors.serialNumber ? 'border-rose-500' : 'border-slate-600'} rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500`}
                            />
                            {errors.serialNumber && <p className="text-rose-500 text-[10px] mt-1">{errors.serialNumber}</p>}
                        </>
                    ) : (
                        <div className="text-white font-mono text-sm">{configForm.serialNumber || 'N/A'}</div>
                    )}
                </div>

                {/* Power Rating */}
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <div className="text-slate-500 text-xs uppercase mb-1">Power Rating (kW)</div>
                    {isEditing ? (
                        <>
                            <input 
                                type="number"
                                value={configForm.powerRating}
                                onChange={(e) => handleInputChange('powerRating', e.target.value)}
                                className={`w-full bg-slate-900 border ${errors.powerRating ? 'border-rose-500' : 'border-slate-600'} rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500`}
                            />
                            {errors.powerRating && <p className="text-rose-500 text-[10px] mt-1">{errors.powerRating}</p>}
                        </>
                    ) : (
                        <div className="text-white font-mono flex items-center gap-2">
                            <Zap className="w-3 h-3 text-yellow-500" /> {configForm.powerRating || 'N/A'} kW
                        </div>
                    )}
                </div>

                {/* Max RPM */}
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <div className="text-slate-500 text-xs uppercase mb-1">Max RPM</div>
                    {isEditing ? (
                        <>
                            <input 
                                type="number"
                                value={configForm.maxRpm}
                                onChange={(e) => handleInputChange('maxRpm', e.target.value)}
                                className={`w-full bg-slate-900 border ${errors.maxRpm ? 'border-rose-500' : 'border-slate-600'} rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500`}
                            />
                            {errors.maxRpm && <p className="text-rose-500 text-[10px] mt-1">{errors.maxRpm}</p>}
                        </>
                    ) : (
                        <div className="text-white font-mono flex items-center gap-2">
                            <Gauge className="w-3 h-3 text-red-400" /> {configForm.maxRpm || 'N/A'}
                        </div>
                    )}
                </div>
            </div>

            {/* System Info Card */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
                 <h4 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-slate-400" /> System Information
                 </h4>
                 <div className="space-y-3">
                    <div className="flex justify-between text-sm items-center py-1 border-b border-slate-700/50">
                        <span className="text-slate-500">Firmware Version</span>
                        {isEditing ? (
                            <input 
                                value={configForm.firmwareVersion}
                                onChange={(e) => handleInputChange('firmwareVersion', e.target.value)}
                                className="w-32 bg-slate-900 border border-slate-600 rounded px-2 py-0.5 text-xs text-white text-right"
                            />
                        ) : (
                            <span className="text-emerald-400 font-mono text-xs bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-500/20">{configForm.firmwareVersion || 'v1.0.0'}</span>
                        )}
                    </div>
                    <div className="flex justify-between text-sm items-center py-1 border-b border-slate-700/50">
                        <span className="text-slate-500">Network IP (Local)</span>
                        {isEditing ? (
                             <div className="flex flex-col items-end">
                                <input 
                                    value={configForm.networkIp}
                                    onChange={(e) => handleInputChange('networkIp', e.target.value)}
                                    className={`w-32 bg-slate-900 border ${errors.networkIp ? 'border-rose-500' : 'border-slate-600'} rounded px-2 py-0.5 text-xs text-white text-right`}
                                />
                                {errors.networkIp && <span className="text-rose-500 text-[10px]">{errors.networkIp}</span>}
                             </div>
                        ) : (
                            <span className="text-slate-300 font-mono text-xs flex items-center gap-1">
                                <Wifi className="w-3 h-3 text-indigo-400" /> {configForm.networkIp || '192.168.0.0'}
                            </span>
                        )}
                    </div>
                    <div className="flex justify-between text-sm items-center py-1">
                        <span className="text-slate-500">Installation Date</span>
                        <span className="text-slate-300 text-xs flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {machine.installDate || 'N/A'}
                        </span>
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

             <div className="p-4 bg-emerald-900/10 border border-emerald-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded shrink-0">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h4 className="text-emerald-300 font-medium mb-1">Last Calibration</h4>
                        <div className="text-lg font-bold text-white mb-1">{machine.lastCalibration || 'N/A'}</div>
                        <p className="text-xs text-slate-500">Next scheduled: In 30 days</p>
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