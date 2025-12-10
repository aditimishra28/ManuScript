import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  MonitorPlay,
  ClipboardList,
  Cpu,
  Edit,
  Save,
  X,
  Scan,
  Eye,
  ImageIcon,
  Flame,
  FileText,
  Sparkles,
  Wifi
} from 'lucide-react';
import { analyzeMachineHealth, generateMaintenancePlan, generateVisualSimulation } from '../services/geminiService';

interface MachineModelProps {
  machine: Machine;
  onClose: () => void;
}

type Tab = 'live' | 'config' | 'history';
type SimulationMode = 'none' | 'failure' | 'thermal' | 'diagram';

const MachineModel: React.FC<MachineModelProps> = ({ machine, onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>('live');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [structuredPlan, setStructuredPlan] = useState<any>(null);
  
  // Image Generation State
  const [simulatedImage, setSimulatedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [simulationMode, setSimulationMode] = useState<SimulationMode>('none');
  const [manualSimulationPrompt, setManualSimulationPrompt] = useState("Cracked shaft coupling");

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

  // Dynamic Thresholds State
  const [useDynamicThresholds, setUseDynamicThresholds] = useState(false);
  
  // Calculate dynamic thresholds based on history (Mean + 2 StdDev)
  const historicalStats = useMemo(() => {
    if (machine.history.length < 5) return null;
    
    const calculateStat = (key: keyof SensorReading) => {
        const values = machine.history.map(h => h[key]);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        return { mean, stdDev, limit: mean + (2 * stdDev) };
    };

    return {
        vibration: calculateStat('vibration'),
        temperature: calculateStat('temperature'),
        noise: calculateStat('noise')
    };
  }, [machine.history]);

  // AR Inspection State (Formerly "Camera")
  const [isARInspectionMode, setIsARInspectionMode] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Manage Camera Stream only for AR Inspection
  useEffect(() => {
    let stream: MediaStream | null = null;
    let isMounted = true;

    if (isARInspectionMode) {
      setCameraError(null); 
      const startCamera = async () => {
        try {
          setIsCameraLoading(true);
          // Default to environment facing camera if available (it's an inspection tool)
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 } }
          });
          
          if (!isMounted) {
            mediaStream.getTracks().forEach(track => track.stop());
            return;
          }

          stream = mediaStream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setIsCameraLoading(false);
        } catch (err: any) {
          if (!isMounted) return;
          console.error("Error accessing camera:", err);
          setCameraError("Camera access denied or unavailable.");
          setIsCameraLoading(false);
        }
      };
      startCamera();
    } 

    return () => {
      isMounted = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [isARInspectionMode]);

  // Reset form when machine changes
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

  const latestReading = machine.history[machine.history.length - 1];

  const handleRunDiagnostics = async () => {
    setIsAnalyzing(true);
    setAiInsight(null);
    setStructuredPlan(null);
    
    const thresholds = useDynamicThresholds && historicalStats ? {
        vibration: historicalStats.vibration.limit,
        temperature: historicalStats.temperature.limit,
        noise: historicalStats.noise.limit
    } : undefined;

    // Use local heuristics FIRST, then call Gemini if needed
    setTimeout(async () => {
        const result = await analyzeMachineHealth(machine, machine.history, thresholds);
        setAiInsight(result);
        
        // If critical, get a plan
        if (machine.status === MachineStatus.CRITICAL || machine.status === MachineStatus.WARNING) {
            const plan = await generateMaintenancePlan("Abnormal sensor readings detected", machine.name);
            setStructuredPlan(plan);
        }
        setIsAnalyzing(false);
    }, 100); 
  };
  
  const handleGenerateImage = async (mode: 'failure' | 'thermal' | 'diagram') => {
      // Use the diagnosed issue OR the manual prompt if no issue is detected
      const issue = structuredPlan?.diagnosis || manualSimulationPrompt;
      
      setIsGeneratingImage(true);
      setSimulationMode(mode);
      setSimulatedImage(null);
      
      const img = await generateVisualSimulation(
          machine.type, 
          issue, 
          mode
      );
      
      setSimulatedImage(img);
      setIsGeneratingImage(false);
  };

  const validateAndSaveConfig = () => {
    setIsEditing(false);
    // In real app, save to backend
  };

  const handleInputChange = (field: string, value: string) => {
      setConfigForm(prev => ({...prev, [field]: value}));
  };

  const renderLiveMonitor = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-y-auto pr-2">
       {/* Left Column: Stats & Digital Twin */}
       <div className="space-y-6">
            
            {/* Visual Feed Container */}
            <div className="bg-black rounded-lg border border-slate-700 overflow-hidden relative group shadow-lg min-h-[250px]">
              
              {/* Header Overlay */}
              <div className="absolute top-2 left-2 z-20 flex gap-2">
                 <div className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 font-bold ${isARInspectionMode ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 border border-slate-600'}`}>
                    {isARInspectionMode ? <Scan className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                    {isARInspectionMode ? 'AR INSPECTION' : 'DIGITAL TWIN'}
                 </div>
              </div>
              
              <div className="absolute top-2 right-2 z-20">
                <button 
                  onClick={() => setIsARInspectionMode(!isARInspectionMode)}
                  className={`text-[10px] px-2 py-1 rounded border transition-colors flex items-center gap-1 backdrop-blur-sm h-[26px] ${
                      isARInspectionMode 
                      ? 'bg-rose-900/80 border-rose-600 text-rose-100 hover:bg-rose-800' 
                      : 'bg-indigo-900/80 border-indigo-500 text-indigo-100 hover:bg-indigo-800'
                  }`}
                >
                  {isARInspectionMode ? <X className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {isARInspectionMode ? "Exit Inspection" : "Start AR Inspection"}
                </button>
              </div>

              {/* Viewport Content */}
              {isARInspectionMode ? (
                <>
                    {isCameraLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
                            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}
                    {cameraError ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 p-6 text-center">
                            <AlertTriangle className="w-8 h-8 text-rose-500 mb-2" />
                            <p className="text-xs text-slate-400">{cameraError}</p>
                        </div>
                    ) : (
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-64 object-cover" />
                    )}
                    {/* AR Overlay - Only in AR Mode */}
                    {!cameraError && (
                        <div className="absolute inset-0 border-2 border-indigo-500/30 m-4 rounded pointer-events-none overflow-hidden">
                             {/* Scanning Line Animation */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-[scan_3s_ease-in-out_infinite]"></div>
                            
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border-2 border-white/30 rounded-lg flex items-center justify-center">
                                <div className="w-1 h-1 bg-white rounded-full"></div>
                            </div>
                            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur px-2 py-1 text-[10px] text-white flex items-center gap-2 border-l-2 border-indigo-500">
                                <Scan className="w-3 h-3 text-indigo-400 animate-pulse" />
                                <span>Target Locked: {machine.type} (99%)</span>
                            </div>
                        </div>
                    )}
                    <style>{`
                        @keyframes scan {
                            0% { top: 0%; opacity: 0; }
                            10% { opacity: 1; }
                            90% { opacity: 1; }
                            100% { top: 100%; opacity: 0; }
                        }
                    `}</style>
                </>
              ) : (
                <>
                    <img 
                        src={machine.imageUrl} 
                        alt="Machine Twin" 
                        className="w-full h-64 object-cover opacity-60"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                         <div className="w-24 h-24 border border-indigo-500/20 rounded-full flex items-center justify-center animate-pulse">
                             <div className="w-20 h-20 border border-indigo-500/40 rounded-full"></div>
                         </div>
                         <div className="mt-4 bg-slate-900/80 px-3 py-1 rounded text-xs text-indigo-300 border border-indigo-500/30">
                            Receiving Telemetry
                         </div>
                    </div>
                </>
              )}
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
                threshold={useDynamicThresholds && historicalStats ? historicalStats.vibration.limit : 6.0} 
            />
            <LiveCharts 
                data={machine.history} 
                dataKey="temperature" 
                color="#f43f5e" 
                label="Thermal Sensor" 
                unit="°C" 
                threshold={useDynamicThresholds && historicalStats ? historicalStats.temperature.limit : 85}
            />
            <LiveCharts 
                data={machine.history} 
                dataKey="noise" 
                color="#3b82f6" 
                label="Acoustic Emissions" 
                unit="dB" 
                threshold={useDynamicThresholds && historicalStats ? historicalStats.noise.limit : 90}
            />
          </div>

          {/* Right Column: AI Diagnostics & Visual Lab */}
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
                        <p className="text-slate-500 text-xs">Comparing against historical baselines...</p>
                    </div>
                ) : aiInsight ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Analysis Text */}
                        <div className="bg-indigo-950/30 border border-indigo-500/30 p-4 rounded-lg">
                            <h4 className="text-indigo-400 text-sm font-semibold mb-2 uppercase tracking-wider">Analysis Result</h4>
                            <p className="text-slate-300 text-sm leading-relaxed">
                                {aiInsight}
                            </p>
                        </div>
                        
                        {/* Maintenance Plan (If Warning/Critical) */}
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
                        
                        {/* Visual Simulation Lab - ALWAYS VISIBLE if analysis done */}
                        <div className="bg-slate-900 border border-slate-700 p-4 rounded-lg space-y-3 mt-4">
                            <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2">
                                <h5 className="text-[10px] text-slate-400 uppercase tracking-widest font-bold flex items-center gap-2">
                                    <Sparkles className="w-3 h-3 text-indigo-400" />
                                    Visual Simulation Lab
                                </h5>
                                <span className="text-[9px] bg-indigo-900/50 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded">Generative AI</span>
                            </div>
                            
                            {isGeneratingImage ? (
                                <div className="h-48 bg-black rounded border border-indigo-500/30 flex flex-col items-center justify-center gap-2">
                                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-xs text-indigo-300 animate-pulse">Generating Simulation...</span>
                                </div>
                            ) : simulatedImage ? (
                                <div className="space-y-2 animate-in fade-in">
                                    <div className="relative group">
                                        <img src={simulatedImage} alt="AI Simulation" className="w-full h-48 object-cover rounded border border-slate-600" />
                                        <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded text-[10px] text-white uppercase border border-white/20">
                                            {simulationMode === 'thermal' ? 'Synthetic Thermal Map' : simulationMode === 'diagram' ? 'Tech Blueprint' : 'Failure Simulation'}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setSimulatedImage(null)}
                                        className="text-xs text-slate-400 hover:text-white underline w-full text-center"
                                    >
                                        Clear Simulation
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {/* If no Critical plan, allow manual scenario entry */}
                                    {!structuredPlan && (
                                        <div className="bg-slate-950 p-2 rounded border border-slate-800">
                                            <label className="text-[10px] text-slate-500 block mb-1">Hypothetical Scenario (Demo)</label>
                                            <input 
                                                value={manualSimulationPrompt}
                                                onChange={(e) => setManualSimulationPrompt(e.target.value)}
                                                className="w-full bg-transparent border-none text-xs text-white focus:ring-0 p-0 placeholder-slate-600"
                                                placeholder="e.g. Broken valve stem..."
                                            />
                                        </div>
                                    )}
                                    
                                    <div className="grid grid-cols-3 gap-2">
                                        <button 
                                            onClick={() => handleGenerateImage('thermal')}
                                            className="flex flex-col items-center justify-center gap-1 p-2 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors"
                                        >
                                            <Flame className="w-4 h-4 text-orange-500" />
                                            <span className="text-[9px] text-slate-300">Heatmap</span>
                                        </button>
                                        <button 
                                            onClick={() => handleGenerateImage('failure')}
                                            className="flex flex-col items-center justify-center gap-1 p-2 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors"
                                        >
                                            <ImageIcon className="w-4 h-4 text-rose-500" />
                                            <span className="text-[9px] text-slate-300">Damage</span>
                                        </button>
                                        <button 
                                            onClick={() => handleGenerateImage('diagram')}
                                            className="flex flex-col items-center justify-center gap-1 p-2 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors"
                                        >
                                            <FileText className="w-4 h-4 text-blue-500" />
                                            <span className="text-[9px] text-slate-300">Blueprint</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2">
                        <BrainCircuit className="w-12 h-12 opacity-20" />
                        <p className="text-sm">Ready to analyze sensor streams.</p>
                        <p className="text-xs text-slate-600 max-w-[200px] text-center">Gemini 2.5 is only invoked for anomaly explanation to conserve tokens.</p>
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
                        </>
                    ) : (
                        <div className="text-white font-mono">{configForm.modelNumber || 'N/A'}</div>
                    )}
                </div>
                 <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <div className="text-slate-500 text-xs uppercase mb-1">Serial Number</div>
                    <div className="text-white font-mono text-sm">{configForm.serialNumber || 'N/A'}</div>
                </div>
            </div>

            <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
                 <h4 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-slate-400" /> System Information
                 </h4>
                 <div className="space-y-3">
                    <div className="flex justify-between text-sm items-center py-1 border-b border-slate-700/50">
                        <span className="text-slate-500">Firmware Version</span>
                         <span className="text-emerald-400 font-mono text-xs bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-500/20">{configForm.firmwareVersion || 'v1.0.0'}</span>
                    </div>
                 </div>
            </div>
        </div>
    </div>
  );

  const renderHistory = () => (
    <div className="h-full flex flex-col">
        <div className="flex-1 overflow-auto bg-slate-800 rounded-lg border border-slate-700">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-950 text-slate-400 sticky top-0">
                    <tr>
                        <th className="px-4 py-3 font-medium">Timestamp</th>
                        <th className="px-4 py-3 font-medium">Vibration (mm/s)</th>
                        <th className="px-4 py-3 font-medium">Temp (°C)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                    {[...machine.history].reverse().map((reading) => (
                        <tr key={reading.timestamp} className="hover:bg-slate-700/50 transition-colors">
                            <td className="px-4 py-3 font-mono text-slate-400">
                                {new Date(reading.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-200">
                                {reading.vibration.toFixed(3)}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-200">
                                {reading.temperature.toFixed(2)}
                            </td>
                        </tr>
                    ))}
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
          
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            Close Panel
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-700 bg-slate-900 px-6">
            <button onClick={() => setActiveTab('live')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'live' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                <MonitorPlay className="w-4 h-4" /> Live Telemetry
            </button>
            <button onClick={() => setActiveTab('config')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'config' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                <Settings className="w-4 h-4" /> Specs
            </button>
            <button onClick={() => setActiveTab('history')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'history' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                <ClipboardList className="w-4 h-4" /> Logs
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