import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Machine, MachineStatus, SensorReading, LogEntry, Alert } from '../types';
import { LiveCharts } from './LiveCharts';
import { db } from '../services/db';
import { SecurityContext } from '../services/securityLayer';
import { 
  BrainCircuit, 
  AlertTriangle, 
  CheckCircle, 
  Thermometer, 
  Activity, 
  Settings,
  MonitorPlay,
  ClipboardList,
  Cpu,
  Sparkles,
  AlertOctagon,
  Mic,
  Square,
  AudioWaveform,
  User,
  Loader2,
  BellRing,
  Layers,
  History,
  Lock,
  GraduationCap
} from 'lucide-react';
import { 
  analyzeMachineHealth, 
  generateMaintenancePlan, 
  generateVisualSimulation, 
  analyzeAudioSignature,
  transcribeAudioLog
} from '../services/geminiService';

interface MachineModelProps {
  machine: Machine;
  onClose: () => void;
}

type Tab = 'live' | 'config' | 'logbook' | 'history';
type GenLabMode = 'overview' | 'golden_sample' | 'consequence_sim' | 'loto_overlay' | 'ghost_view' | 'synthetic_training';

const MachineModel: React.FC<MachineModelProps> = ({ machine, onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>('live');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [structuredPlan, setStructuredPlan] = useState<any>(null);
  const user = SecurityContext.getUser();
  
  // -- Generative Lab State --
  const [labMode, setLabMode] = useState<GenLabMode>('overview');
  const [labLoading, setLabLoading] = useState(false);
  const [manualPrompt, setManualPrompt] = useState("Vibration anomaly in bearing housing");

  // Pain Point Images
  const [goldenImage, setGoldenImage] = useState<string | null>(null);
  const [consequenceImage, setConsequenceImage] = useState<string | null>(null);
  const [lotoImage, setLotoImage] = useState<string | null>(null);
  const [ghostImage, setGhostImage] = useState<string | null>(null);
  const [trainingImage, setTrainingImage] = useState<string | null>(null);
  const [trainingScenario, setTrainingScenario] = useState("Hydraulic fluid leakage");

  // -- Acoustic Diagnostic State --
  const [isRecording, setIsRecording] = useState(false);
  const [audioAnalysis, setAudioAnalysis] = useState<any>(null);
  const [isAnalysingAudio, setIsAnalysingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // -- Logbook & Timeline State --
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [machineAlerts, setMachineAlerts] = useState<Alert[]>([]);
  const [newLogText, setNewLogText] = useState("");
  const [isDictating, setIsDictating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const dictationRecorderRef = useRef<MediaRecorder | null>(null);
  const dictationChunksRef = useRef<Blob[]>([]);

  // Configuration Edit State
  const [configForm, setConfigForm] = useState({
    modelNumber: machine.modelNumber || '',
    serialNumber: machine.serialNumber || '',
    firmwareVersion: machine.firmwareVersion || ''
  });

  // Dynamic Thresholds State
  const [useDynamicThresholds, setUseDynamicThresholds] = useState(false);
  
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

  // -- COMPONENT LIFECYCLE CLEANUP (MEMORY LEAK FIX) --
  useEffect(() => {
    return () => {
        // Aggressively stop media streams and animation frames on unmount
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        // Stop all tracks in the stream to turn off the microphone light
        if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };
  }, []);

  // Fetch Data
  const loadData = async () => {
    const l = await db.getMachineLogs(machine.id);
    setLogs(l);
    
    // Fetch local alerts for this machine
    const a = await db.alerts.where('machineId').equals(machine.id).reverse().sortBy('timestamp');
    setMachineAlerts(a);
  };

  useEffect(() => {
    loadData();
  }, [machine.id]);

  // Compute Unified Timeline (Merge Logs & Alerts)
  const unifiedTimeline = useMemo(() => {
    const mixed = [
        ...logs.map(l => ({ ...l, entryType: 'LOG' })),
        ...machineAlerts.map(a => ({ ...a, entryType: 'ALERT', author: 'System', content: a.message }))
    ];
    // Sort descending
    return mixed.sort((a, b) => b.timestamp - a.timestamp);
  }, [logs, machineAlerts]);

  // Calculate Health Score (0-100)
  const healthScore = useMemo(() => {
      let score = 100;
      if (machine.status === MachineStatus.WARNING) score -= 20;
      if (machine.status === MachineStatus.CRITICAL) score -= 50;
      
      // Deduct for recent alerts
      const recentAlerts = machineAlerts.filter(a => Date.now() - a.timestamp < 24 * 60 * 60 * 1000);
      score -= (recentAlerts.length * 5);
      
      // Deduct for high vibes
      const lastReading = machine.history[machine.history.length - 1];
      if (lastReading && lastReading.vibration > 5) score -= 10;
      
      return Math.max(0, score);
  }, [machine.status, machineAlerts, machine.history]);

  const handleAddLog = async () => {
    if (!newLogText.trim()) return;
    const entry: LogEntry = {
      machineId: machine.id,
      timestamp: Date.now(),
      author: user.name,
      content: newLogText,
      type: 'human'
    };
    await db.addLogEntry(entry);
    setNewLogText("");
    loadData();
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, _) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Remove data url prefix
        resolve(result.split(',')[1]);
      };
      reader.readAsDataURL(blob);
    });
  };

  // Helper to get supported mime type
  const getSupportedMimeType = () => {
    if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
    return ''; // fallback
  };

  // -- SHAZAM FOR MACHINES (Acoustic Analysis) --
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Visualize Audio
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        animationFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.fillStyle = '#0f172a'; // Clear
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          barHeight = dataArray[i] / 2;
          ctx.fillStyle = `rgb(${barHeight + 100}, 99, 241)`; // Indigo color scale
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      };
      draw();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        stream.getTracks().forEach(track => track.stop());
        
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        await handleAudioAnalysis(audioBlob, mimeType || 'audio/webm');
      };

      mediaRecorder.start();
      setIsRecording(true);
      setAudioAnalysis(null);

      // Auto stop after 5 seconds for analysis
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          stopRecording();
        }
      }, 5000);

    } catch (err) {
      console.error("Mic Error:", err);
      alert("Microphone access denied. Please allow microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAudioAnalysis = async (blob: Blob, mimeType: string) => {
    setIsAnalysingAudio(true);
    try {
        const base64 = await blobToBase64(blob);
        const result = await analyzeAudioSignature(machine.type, base64, mimeType);
        setAudioAnalysis(result);
        
        // Save to log
        if (result && result.classification) {
            const entry: LogEntry = {
                machineId: machine.id,
                timestamp: Date.now(),
                author: "Gemini Audio Core",
                content: `Acoustic Scan detected: ${result.classification} (${result.confidence})`,
                type: 'audio_analysis',
                meta: result
            };
            await db.addLogEntry(entry);
            loadData();
        }
    } catch (e) {
        console.error(e);
    }
    setIsAnalysingAudio(false);
  };

  // -- VOICE DICTATION FOR LOGBOOK --
  const startDictation = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mimeType = getSupportedMimeType();
          const options = mimeType ? { mimeType } : undefined;
          const mediaRecorder = new MediaRecorder(stream, options);

          dictationRecorderRef.current = mediaRecorder;
          dictationChunksRef.current = [];

          mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) dictationChunksRef.current.push(e.data);
          };

          mediaRecorder.onstop = async () => {
              stream.getTracks().forEach(track => track.stop());
              setIsTranscribing(true);
              const audioBlob = new Blob(dictationChunksRef.current, { type: mimeType || 'audio/webm' });
              const base64 = await blobToBase64(audioBlob);
              const text = await transcribeAudioLog(base64, mimeType || 'audio/webm');
              
              if (text) {
                  setNewLogText(prev => prev + (prev ? " " : "") + text.trim());
              }
              setIsTranscribing(false);
          };

          mediaRecorder.start();
          setIsDictating(true);

      } catch (e) {
          console.error("Dictation Error", e);
          alert("Could not access microphone for dictation.");
      }
  };

  const stopDictation = () => {
      if (dictationRecorderRef.current) {
          dictationRecorderRef.current.stop();
          setIsDictating(false);
      }
  };

  const handleRunDiagnostics = async () => {
    setIsAnalyzing(true);
    setAiInsight(null);
    setStructuredPlan(null);
    
    // Reset Gen Lab
    setLabMode('overview');
    setGoldenImage(null);
    setConsequenceImage(null);
    setLotoImage(null);
    setGhostImage(null);
    setTrainingImage(null);

    const thresholds = useDynamicThresholds && historicalStats ? {
        vibration: historicalStats.vibration.limit,
        temperature: historicalStats.temperature.limit,
        noise: historicalStats.noise.limit
    } : undefined;

    setTimeout(async () => {
        // PASSED LOGS TO AI HERE -> Context Awareness
        const result = await analyzeMachineHealth(machine, machine.history, logs, thresholds);
        setAiInsight(result);
        
        if (machine.status === MachineStatus.CRITICAL || machine.status === MachineStatus.WARNING) {
            const plan = await generateMaintenancePlan("Abnormal sensor readings detected", machine.name);
            setStructuredPlan(plan);
        }
        setIsAnalyzing(false);
    }, 100); 
  };
  
  // -- GEN LAB HANDLERS --

  const getIssueContext = () => structuredPlan?.diagnosis || manualPrompt;

  const handleGoldenSample = async () => {
      setLabMode('golden_sample');
      if (!goldenImage) {
          setLabLoading(true);
          const img = await generateVisualSimulation(machine.type, getIssueContext(), 'golden_sample');
          setGoldenImage(img);
          setLabLoading(false);
      }
  };

  const handleConsequenceSim = async () => {
      setLabMode('consequence_sim');
      if (!consequenceImage) {
          setLabLoading(true);
          const img = await generateVisualSimulation(machine.type, getIssueContext(), 'consequence');
          setConsequenceImage(img);
          setLabLoading(false);
      }
  };

  const handleLotoOverlay = async () => {
      setLabMode('loto_overlay');
      if (!lotoImage) {
          setLabLoading(true);
          const img = await generateVisualSimulation(machine.type, getIssueContext(), 'loto_overlay');
          setLotoImage(img);
          setLabLoading(false);
      }
  };

  const handleGhostView = async () => {
      setLabMode('ghost_view');
      if (!ghostImage) {
          setLabLoading(true);
          const img = await generateVisualSimulation(machine.type, getIssueContext(), 'ghost_view');
          setGhostImage(img);
          setLabLoading(false);
      }
  };

  const handleSyntheticTraining = async () => {
      setLabMode('synthetic_training');
      setLabLoading(true);
      const img = await generateVisualSimulation(machine.type, trainingScenario, 'synthetic_training');
      setTrainingImage(img);
      setLabLoading(false);
  };


  // -- RENDERERS --

  const renderGenLab = () => {
      if (labLoading) {
          return (
            <div className="h-64 bg-black/30 rounded-xl border border-indigo-500/30 flex flex-col items-center justify-center gap-4 animate-pulse">
                <div className="relative">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <Sparkles className="w-6 h-6 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="text-center">
                    <h4 className="text-indigo-300 font-medium">Processing Industrial Physics...</h4>
                    <p className="text-slate-500 text-xs mt-1">Generating technical visualization</p>
                </div>
            </div>
          );
      }

      if (labMode === 'golden_sample') {
          return (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                  <div className="flex justify-between items-center mb-2">
                      <h4 className="text-indigo-400 font-bold flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" /> Golden Sample Comparator
                      </h4>
                      <button onClick={() => setLabMode('overview')} className="text-xs text-slate-500 hover:text-white">Back</button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 h-64">
                      <div className="relative bg-slate-800 rounded-xl border border-slate-700 overflow-hidden group">
                          <img src={machine.imageUrl} className="w-full h-full object-cover opacity-60 grayscale group-hover:grayscale-0 transition-all" />
                          <div className="absolute top-2 left-2 bg-slate-900/80 px-2 py-1 rounded text-xs text-slate-300 font-mono">CURRENT STATE</div>
                      </div>
                      <div className="relative bg-slate-950 rounded-xl border border-indigo-500/50 overflow-hidden shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                         {goldenImage ? (
                            <>
                                <img src={goldenImage} className="w-full h-full object-cover" />
                                <div className="absolute top-2 left-2 bg-emerald-500/90 text-black px-2 py-1 rounded text-xs font-bold">GOLDEN SAMPLE</div>
                            </>
                         ) : <div className="h-full flex items-center justify-center text-slate-500">Failed</div>}
                      </div>
                  </div>
                  <p className="text-xs text-slate-400 text-center">
                      Use the "Golden Sample" to visually verify if the current wear level exceeds manufacture tolerances.
                  </p>
              </div>
          );
      }

      if (labMode === 'consequence_sim') {
          return (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                  <div className="flex justify-between items-center mb-2">
                      <h4 className="text-amber-500 font-bold flex items-center gap-2">
                          <History className="w-4 h-4" /> Future Consequence Simulator
                      </h4>
                      <button onClick={() => setLabMode('overview')} className="text-xs text-slate-500 hover:text-white">Back</button>
                  </div>
                  <div className="bg-slate-950 rounded-xl border border-amber-900 overflow-hidden relative">
                       {consequenceImage ? (
                          <>
                            <img src={consequenceImage} alt="Consequence" className="w-full h-64 object-cover" />
                            <div className="absolute top-4 right-4 bg-amber-500 text-black px-3 py-1 rounded text-xs font-bold shadow-lg animate-pulse">
                                +48 HOURS (PREDICTED)
                            </div>
                            <div className="absolute bottom-0 w-full bg-black/80 backdrop-blur p-4 border-t border-amber-900/50">
                                <p className="text-xs text-amber-200">
                                    <span className="font-bold block mb-1">CATASTROPHIC FAILURE IMMINENT</span>
                                    Visualization of component failure if vibration alerts are ignored. Note the structural cracking and heat discoloration.
                                </p>
                            </div>
                          </>
                       ) : <div className="h-64 bg-slate-800 flex items-center justify-center">Generation Failed</div>}
                  </div>
              </div>
          );
      }

      if (labMode === 'loto_overlay') {
          return (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                  <div className="flex justify-between items-center mb-2">
                      <h4 className="text-rose-500 font-bold flex items-center gap-2">
                          <Lock className="w-4 h-4" /> Visual LOTO Overlay
                      </h4>
                      <button onClick={() => setLabMode('overview')} className="text-xs text-slate-500 hover:text-white">Back</button>
                  </div>
                  <div className="bg-slate-950 rounded-xl border border-rose-900 overflow-hidden relative">
                       {lotoImage ? (
                          <>
                            <img src={lotoImage} alt="LOTO" className="w-full h-64 object-cover" />
                            <div className="absolute top-4 left-4 bg-rose-600 text-white px-3 py-1 rounded text-xs font-bold shadow-lg flex items-center gap-2">
                                <Lock className="w-3 h-3" /> SAFETY ISOLATION POINTS
                            </div>
                            <div className="absolute bottom-0 w-full bg-black/80 backdrop-blur p-4 border-t border-rose-900/50">
                                <p className="text-xs text-rose-200">
                                    Apply physical locks to the highlighted valves and breakers before proceeding.
                                </p>
                            </div>
                          </>
                       ) : <div className="h-64 bg-slate-800 flex items-center justify-center">Generation Failed</div>}
                  </div>
              </div>
          );
      }

      if (labMode === 'ghost_view') {
          return (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                  <div className="flex justify-between items-center mb-2">
                      <h4 className="text-blue-400 font-bold flex items-center gap-2">
                          <Layers className="w-4 h-4" /> Ghost View Assembly Guide
                      </h4>
                      <button onClick={() => setLabMode('overview')} className="text-xs text-slate-500 hover:text-white">Back</button>
                  </div>
                  <div className="bg-slate-950 rounded-xl border border-blue-900 overflow-hidden relative">
                       {ghostImage ? (
                          <>
                            <img src={ghostImage} alt="Ghost View" className="w-full h-64 object-cover" />
                            <div className="absolute top-4 right-4 bg-blue-500/20 text-blue-300 border border-blue-500/50 px-3 py-1 rounded text-xs font-bold backdrop-blur">
                                X-RAY MODE: ON
                            </div>
                            <div className="absolute bottom-0 w-full bg-black/80 backdrop-blur p-4 border-t border-blue-900/50">
                                <p className="text-xs text-blue-200">
                                    Internal mounting points revealed. Locate the hidden clips highlighted in white before applying torque.
                                </p>
                            </div>
                          </>
                       ) : <div className="h-64 bg-slate-800 flex items-center justify-center">Generation Failed</div>}
                  </div>
              </div>
          );
      }

      if (labMode === 'synthetic_training') {
          return (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                  <div className="flex justify-between items-center mb-2">
                      <h4 className="text-emerald-400 font-bold flex items-center gap-2">
                          <GraduationCap className="w-4 h-4" /> Synthetic Training Dojo
                      </h4>
                      <button onClick={() => setLabMode('overview')} className="text-xs text-slate-500 hover:text-white">Back</button>
                  </div>
                  
                  <div className="space-y-2 mb-2">
                      <div className="flex gap-2">
                        <input 
                            type="text"
                            value={trainingScenario} 
                            onChange={(e) => setTrainingScenario(e.target.value)}
                            placeholder="Describe rare failure (e.g. 'pump cavitation')"
                            className="bg-slate-900 border border-slate-700 text-xs text-white rounded px-3 py-2 flex-1 focus:border-emerald-500 focus:outline-none"
                        />
                        <button 
                            onClick={handleSyntheticTraining}
                            disabled={!trainingScenario}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs px-4 py-2 rounded font-medium flex items-center gap-2"
                        >
                            <Sparkles className="w-3 h-3" /> Generate
                        </button>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {[
                            'Pump cavitation pitting', 
                            'Electrical arcing on busbar', 
                            'Hydraulic servo leakage', 
                            'Conveyor belt fraying'
                        ].map(preset => (
                            <button
                                key={preset}
                                onClick={() => setTrainingScenario(preset)}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-slate-400 hover:text-white transition-colors"
                            >
                                {preset}
                            </button>
                        ))}
                      </div>
                  </div>

                  <div className="bg-slate-950 rounded-xl border border-emerald-900 overflow-hidden relative">
                       {trainingImage ? (
                          <>
                            <img src={trainingImage} alt="Training" className="w-full h-56 object-cover" />
                            <div className="absolute bottom-0 w-full bg-black/80 backdrop-blur p-3 border-t border-emerald-900/50">
                                <p className="text-xs text-emerald-200">
                                    <span className="font-bold">Visual Training Aid:</span> {trainingScenario}. 
                                    Study this generated anomaly to recognize early signs in the field.
                                </p>
                            </div>
                          </>
                       ) : <div className="h-56 bg-slate-800 flex items-center justify-center text-slate-500 text-xs">Enter a scenario and click Generate</div>}
                  </div>
              </div>
          );
      }

      // Default: Overview Buttons - THE 5 PILLARS
      return (
        <div className="space-y-4 animate-in fade-in">
             <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <label className="text-[10px] text-slate-500 block mb-1">Context / Scenario (AI Input)</label>
                <div className="flex gap-2">
                    <input 
                        value={structuredPlan ? structuredPlan.diagnosis : manualPrompt}
                        onChange={(e) => setManualPrompt(e.target.value)}
                        readOnly={!!structuredPlan}
                        className={`w-full bg-transparent border-none text-xs text-white focus:ring-0 p-0 placeholder-slate-600 ${structuredPlan ? 'opacity-70 cursor-not-allowed' : ''}`}
                    />
                    {structuredPlan && <span className="text-[10px] text-emerald-500 font-bold whitespace-nowrap px-2">AI LOCKED</span>}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {/* 1. Golden Sample */}
                <button 
                    onClick={handleGoldenSample}
                    className="flex flex-col gap-2 p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500/50 rounded-lg transition-all group"
                >
                    <div className="flex items-center gap-2 text-indigo-400">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Golden Sample</span>
                    </div>
                    <div className="text-[10px] text-slate-500 text-left leading-tight">QA Comparator: Brand new vs. Current</div>
                </button>

                {/* 2. Consequence Sim */}
                <button 
                    onClick={handleConsequenceSim}
                    className="flex flex-col gap-2 p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/50 rounded-lg transition-all group"
                >
                     <div className="flex items-center gap-2 text-amber-500">
                        <History className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Future Risk</span>
                    </div>
                    <div className="text-[10px] text-slate-500 text-left leading-tight">Simulate failure if neglected (Motivation)</div>
                </button>

                {/* 3. Visual LOTO */}
                <button 
                    onClick={handleLotoOverlay}
                    className="flex flex-col gap-2 p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-rose-500/50 rounded-lg transition-all group"
                >
                    <div className="flex items-center gap-2 text-rose-500">
                        <Lock className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Visual LOTO</span>
                    </div>
                    <div className="text-[10px] text-slate-500 text-left leading-tight">Safety Overlay: Highlight Isolation Points</div>
                </button>

                {/* 4. Ghost View */}
                <button 
                    onClick={handleGhostView}
                    className="flex flex-col gap-2 p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500/50 rounded-lg transition-all group"
                >
                    <div className="flex items-center gap-2 text-blue-400">
                        <Layers className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Ghost View</span>
                    </div>
                    <div className="text-[10px] text-slate-500 text-left leading-tight">X-Ray Assembly Guide for Repairs</div>
                </button>

                {/* 5. Synthetic Training */}
                <button 
                    onClick={() => setLabMode('synthetic_training')}
                    className="flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/50 rounded-lg transition-all group col-span-2"
                >
                    <div className="p-2 bg-emerald-500/10 rounded group-hover:bg-emerald-500/20 text-emerald-400">
                        <GraduationCap className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                        <div className="text-xs font-bold text-slate-200 uppercase tracking-wide">Synthetic Training Dojo</div>
                        <div className="text-[10px] text-slate-500">Generate rare failure scenarios for onboarding</div>
                    </div>
                </button>
            </div>
        </div>
      );
  };

  const renderConfig = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-4 h-full overflow-y-auto">
        <div className="space-y-6">
            <div className="flex justify-between items-center pb-2 border-b border-slate-700">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-400" />
                    Technical Specifications
                </h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <div className="text-slate-500 text-xs uppercase mb-1">Model Number</div>
                    <div className="text-white font-mono">{configForm.modelNumber || 'N/A'}</div>
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

  const renderUnifiedTimeline = () => (
    <div className="h-full overflow-y-auto pr-2 pb-20 space-y-4">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-400" />
                Operational Log & System Events
            </h3>
            <span className="text-xs text-slate-500">{unifiedTimeline.length} Entries</span>
        </div>

        {/* Input Area */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-6">
            <div className="flex gap-2 mb-2">
                <div className="flex-1 relative">
                    <input 
                        type="text" 
                        value={newLogText}
                        onChange={(e) => setNewLogText(e.target.value)}
                        placeholder={isDictating ? "Listening..." : "Add operator note..."}
                        className={`w-full bg-slate-950 border ${isDictating ? 'border-rose-500 animate-pulse' : 'border-slate-700'} rounded-lg p-3 pl-4 text-sm text-white focus:border-indigo-500 outline-none transition-all`}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddLog()}
                    />
                    {isTranscribing && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                        </div>
                    )}
                </div>
                <button 
                    onClick={isDictating ? stopDictation : startDictation}
                    className={`p-3 rounded-lg border transition-all ${
                        isDictating 
                        ? 'bg-rose-500/20 border-rose-500 text-rose-400' 
                        : 'bg-slate-700 border-slate-600 text-slate-300 hover:text-white hover:bg-slate-600'
                    }`}
                    title="Voice Dictation"
                >
                    <Mic className={`w-5 h-5 ${isDictating ? 'animate-pulse' : ''}`} />
                </button>
                <button 
                    onClick={handleAddLog}
                    disabled={!newLogText.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-6 rounded-lg font-medium transition-colors"
                >
                    Log
                </button>
            </div>
            <p className="text-[10px] text-slate-500 pl-1">
                Voice notes are automatically transcribed and tagged with your ID.
            </p>
        </div>

        {/* Timeline */}
        <div className="space-y-6 relative before:absolute before:left-4 before:top-2 before:bottom-0 before:w-0.5 before:bg-slate-800">
            {unifiedTimeline.length === 0 && (
                <div className="text-center py-10 text-slate-500 text-sm italic">No history available.</div>
            )}
            
            {unifiedTimeline.map((item: any) => (
                <div key={`${item.entryType}-${item.id || item.timestamp}`} className="relative pl-10 group">
                    {/* Icon Bubble */}
                    <div className={`absolute left-0 top-1 w-8 h-8 rounded-full flex items-center justify-center border-4 border-slate-900 z-10 ${
                        item.entryType === 'ALERT' 
                        ? (item.severity === 'high' ? 'bg-rose-500 text-white' : item.severity === 'medium' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white')
                        : (item.type === 'audio_analysis' ? 'bg-purple-500 text-white' : 'bg-slate-700 text-slate-300')
                    }`}>
                        {item.entryType === 'ALERT' ? <AlertTriangle className="w-4 h-4" /> : 
                         item.type === 'audio_analysis' ? <AudioWaveform className="w-4 h-4" /> :
                         <User className="w-4 h-4" />}
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                             <div className="flex items-center gap-2">
                                 <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                                     item.entryType === 'ALERT' ? 'bg-rose-950 text-rose-400' : 'bg-indigo-950 text-indigo-400'
                                 }`}>
                                     {item.entryType === 'ALERT' ? 'SYSTEM ALERT' : item.author}
                                 </span>
                                 <span className="text-xs text-slate-500">{new Date(item.timestamp).toLocaleString()}</span>
                             </div>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed">
                            {item.content || item.message}
                        </p>
                        
                        {/* Audio Analysis Meta Display */}
                        {item.type === 'audio_analysis' && item.meta && (
                             <div className="mt-3 bg-slate-950 rounded p-3 border border-slate-800 flex items-center gap-4">
                                 <div className="p-2 bg-purple-500/10 rounded-full text-purple-400">
                                     <AudioWaveform className="w-5 h-5" />
                                 </div>
                                 <div>
                                     <div className="text-xs text-purple-300 font-bold">{item.meta.classification} ({item.meta.confidence})</div>
                                     <div className="text-[10px] text-slate-500">{item.meta.description}</div>
                                 </div>
                             </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    </div>
  );

  const renderLiveMonitor = () => (
    <div className="grid grid-cols-1 gap-4 h-full overflow-y-auto pr-2 pb-20">
         {/* Charts */}
         <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
             <div className="xl:col-span-2">
                <LiveCharts 
                    data={machine.history} 
                    color="#f43f5e" 
                    dataKey="vibration" 
                    label="Vibration Analysis" 
                    unit="mm/s" 
                    threshold={historicalStats?.vibration.limit} 
                />
             </div>
             {/* Health Score Gauge */}
             <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4 flex flex-col items-center justify-center relative overflow-hidden">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 z-10">Asset Health Score</h3>
                 <div className="relative z-10">
                     <svg className="w-32 h-32 transform -rotate-90">
                         <circle cx="64" cy="64" r="56" stroke="#1e293b" strokeWidth="12" fill="transparent" />
                         <circle cx="64" cy="64" r="56" stroke={healthScore > 80 ? '#10b981' : healthScore > 50 ? '#f59e0b' : '#f43f5e'} strokeWidth="12" fill="transparent" strokeDasharray={351} strokeDashoffset={351 - (351 * healthScore) / 100} className="transition-all duration-1000 ease-out" />
                     </svg>
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                         <div className="text-3xl font-bold text-white">{Math.round(healthScore)}</div>
                         <div className="text-[10px] text-slate-500">/ 100</div>
                     </div>
                 </div>
                 <div className="mt-2 text-xs text-slate-400 text-center max-w-[150px] z-10">
                    {healthScore > 80 ? 'Optimal Performance' : healthScore > 50 ? 'Maintenance Advised' : 'Critical Condition'}
                 </div>
                 {/* Background Glow */}
                 <div className={`absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t ${healthScore > 80 ? 'from-emerald-500/10' : healthScore > 50 ? 'from-amber-500/10' : 'from-rose-500/10'} to-transparent z-0`}></div>
             </div>
         </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LiveCharts 
                data={machine.history} 
                color="#f59e0b" 
                dataKey="temperature" 
                label="Thermal Core Temp" 
                unit="°C" 
                threshold={historicalStats?.temperature.limit} 
            />
            <LiveCharts 
                data={machine.history} 
                color="#6366f1" 
                dataKey="noise" 
                label="Acoustic Decibels" 
                unit="dB" 
                threshold={historicalStats?.noise.limit} 
            />
        </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <LiveCharts 
                data={machine.history} 
                color="#10b981" 
                dataKey="rpm" 
                label="Motor Speed" 
                unit="RPM" 
             />
             <LiveCharts 
                data={machine.history} 
                color="#0ea5e9" 
                dataKey="powerUsage" 
                label="Power Consumption" 
                unit="kW" 
             />
         </div>
         
         {/* Controls */}
         <div className="flex flex-col md:flex-row gap-4 mt-4">
             <button 
                onClick={handleRunDiagnostics}
                disabled={isAnalyzing}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white p-4 rounded-xl flex items-center justify-center gap-3 font-medium transition-all shadow-lg shadow-indigo-500/20"
             >
                 {isAnalyzing ? (
                     <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Processing Neural Analysis...
                     </>
                 ) : (
                     <>
                        <BrainCircuit className="w-5 h-5" /> Run AI Diagnostics
                     </>
                 )}
             </button>
             
             <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex-1 p-4 rounded-xl flex items-center justify-center gap-3 font-medium transition-all shadow-lg ${
                    isRecording 
                    ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse shadow-rose-500/20' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
             >
                {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                {isRecording ? 'Stop Recording' : 'Analyze Audio Signature'}
             </button>
         </div>

         {/* Audio Visualization Canvas */}
         {isRecording && (
             <div className="h-24 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden relative shadow-inner">
                 <canvas ref={canvasRef} className="w-full h-full" width={800} height={100} />
                 <div className="absolute top-3 right-3 text-[10px] font-bold text-rose-500 flex items-center gap-1.5 bg-rose-950/50 px-2 py-1 rounded-full border border-rose-500/20">
                     <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping"></div> LIVE MIC
                 </div>
             </div>
         )}

         {/* Analysis Results */}
         {(aiInsight || structuredPlan) && (
             <div className="mt-4 bg-slate-900/80 backdrop-blur rounded-xl border border-indigo-500/30 p-5 animate-in fade-in slide-in-from-bottom-4 shadow-2xl">
                 <div className="flex items-start gap-4">
                     <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shrink-0 shadow-lg shadow-indigo-500/20">
                         <Sparkles className="w-6 h-6" />
                     </div>
                     <div className="space-y-3 w-full">
                         <div>
                             <h4 className="font-bold text-white text-lg flex items-center gap-2">
                                Gemini Diagnostics Engine
                                <span className="text-[10px] px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">v2.5 Flash</span>
                             </h4>
                             <p className="text-slate-300 text-sm mt-2 leading-relaxed border-l-2 border-indigo-500/30 pl-3">
                                 {structuredPlan?.diagnosis || aiInsight}
                             </p>
                         </div>
                         
                         {structuredPlan && (
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                                 <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                                     <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Recommendation</div>
                                     <div className="text-sm text-emerald-400 font-medium">{structuredPlan.recommendation}</div>
                                 </div>
                                 <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                                     <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Urgency Level</div>
                                     <div className={`text-sm font-bold flex items-center gap-2 ${
                                         structuredPlan.urgency === 'Immediate' || structuredPlan.urgency === 'High' ? 'text-rose-500' : 'text-amber-500'
                                     }`}>
                                         {structuredPlan.urgency === 'Immediate' && <AlertOctagon className="w-4 h-4" />}
                                         {structuredPlan.urgency.toUpperCase()}
                                     </div>
                                 </div>
                             </div>
                         )}
                     </div>
                 </div>
             </div>
         )}
         
         {/* Audio Analysis Result */}
         {audioAnalysis && !isRecording && (
            <div className="mt-4 bg-slate-900/80 backdrop-blur rounded-xl border border-purple-500/30 p-5 animate-in fade-in slide-in-from-bottom-4">
                 <div className="flex items-start gap-4">
                     <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl text-white shrink-0 shadow-lg shadow-purple-500/20">
                         <AudioWaveform className="w-6 h-6" />
                     </div>
                     <div className="space-y-2 w-full">
                        <h4 className="font-bold text-white text-lg">Acoustic Signature Analysis</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-xs text-slate-500">Classification</div>
                                <div className="text-purple-300 font-medium">{audioAnalysis.classification}</div>
                            </div>
                            <div>
                                <div className="text-xs text-slate-500">Confidence</div>
                                <div className="text-purple-300 font-medium">{audioAnalysis.confidence}</div>
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-2 bg-black/20 p-2 rounded">{audioAnalysis.description}</p>
                     </div>
                 </div>
            </div>
         )}

         {/* GENERATIVE INDUSTRIAL LAB (MOUNTED HERE) */}
         <div className="mt-6 border-t border-slate-800 pt-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" /> Generative Industrial Lab
            </h3>
            {renderGenLab()}
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
            <button onClick={() => setActiveTab('logbook')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'logbook' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                <ClipboardList className="w-4 h-4" /> Activity Timeline
            </button>
            <button onClick={() => setActiveTab('config')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'config' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                <Settings className="w-4 h-4" /> Specs
            </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden p-6 bg-slate-900/50">
            {activeTab === 'live' && renderLiveMonitor()}
            {activeTab === 'logbook' && renderUnifiedTimeline()}
            {activeTab === 'config' && renderConfig()}
        </div>

      </div>
    </div>
  );
};

export default MachineModel;