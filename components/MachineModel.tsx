import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Machine, MachineStatus, SensorReading, LogEntry, Alert } from '../types';
import { LiveCharts } from './LiveCharts';
import { db } from '../services/db';
import { SecurityContext } from '../services/securityLayer';
import { 
  BrainCircuit, 
  AlertTriangle, 
  Settings,
  MonitorPlay,
  ClipboardList,
  Sparkles,
  AlertOctagon,
  Mic,
  Square,
  AudioWaveform,
  Loader2,
  Wrench,
  ScanEye,
  CheckCircle2,
  Image as ImageIcon,
  RefreshCw,
  Camera,
  Upload,
  Zap,
  Maximize
} from 'lucide-react';
import { 
  analyzeMachineHealth, 
  generateMaintenancePlan, 
  generateVisualSimulation,
  analyzeAudioSignature,
  transcribeAudioLog,
  analyzeAttachedImage
} from '../services/geminiService';

interface MachineModelProps {
  machine: Machine;
  onClose: () => void;
}

type Tab = 'live' | 'config' | 'logbook';

interface VisionResult {
    analysis: string;
    issueDetected: boolean;
    boundingBox: number[] | null; // [ymin, xmin, ymax, xmax] 0-1000
}

const MachineModel: React.FC<MachineModelProps> = ({ machine, onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>('live');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [structuredPlan, setStructuredPlan] = useState<any>(null);
  const user = SecurityContext.getUser();
  
  // -- Visual Repair Assistant State --
  const [defectImage, setDefectImage] = useState<string | null>(null);
  const [goldenImage, setGoldenImage] = useState<string | null>(null);
  const [loadingVisual, setLoadingVisual] = useState<string | null>(null); // 'defect' | 'golden' | 'step-{i}'
  const [repairStepImages, setRepairStepImages] = useState<Record<number, string>>({});

  // -- Multimodal Visual Inspection State (User Upload) --
  const [userImage, setUserImage] = useState<string | null>(null); // Base64
  const [visionResult, setVisionResult] = useState<VisionResult | null>(null);
  const [isAnalyzingVision, setIsAnalyzingVision] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Ref for calculating exact image dimensions for bounding box
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgDims, setImgDims] = useState({ width: 0, height: 0, top: 0, left: 0 });

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
  
  // Configuration Edit State
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

  // Cleanup
  useEffect(() => {
    return () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };
  }, []);

  // Fetch Data
  const loadData = async () => {
    const l = await db.getMachineLogs(machine.id);
    setLogs(l);
    const a = await db.alerts.where('machineId').equals(machine.id).reverse().sortBy('timestamp');
    setMachineAlerts(a);
  };

  useEffect(() => {
    loadData();
  }, [machine.id]);

  // Calculate Health Score
  const healthScore = useMemo(() => {
      let score = 100;
      if (machine.status === MachineStatus.WARNING) score -= 20;
      if (machine.status === MachineStatus.CRITICAL) score -= 50;
      const recentAlerts = machineAlerts.filter(a => Date.now() - a.timestamp < 24 * 60 * 60 * 1000);
      score -= (recentAlerts.length * 5);
      const lastReading = machine.history[machine.history.length - 1];
      if (lastReading && lastReading.vibration > 5) score -= 10;
      return Math.max(0, score);
  }, [machine.status, machineAlerts, machine.history]);

  // -- Actions --

  const getMachineContext = () => {
      return `${machine.type} ${machine.modelNumber ? `(Model ${machine.modelNumber})` : ''}`;
  };

  const handleRunDiagnostics = async () => {
    setIsAnalyzing(true);
    setAiInsight(null);
    setStructuredPlan(null);
    setDefectImage(null);
    setGoldenImage(null);
    setRepairStepImages({});
    setVisionResult(null);
    setUserImage(null);
    
    const thresholds = useDynamicThresholds && historicalStats ? {
        vibration: historicalStats.vibration.limit,
        temperature: historicalStats.temperature.limit,
        noise: historicalStats.noise.limit
    } : undefined;

    setTimeout(async () => {
        const result = await analyzeMachineHealth(machine, machine.history, logs, thresholds);
        setAiInsight(result);
        
        const plan = await generateMaintenancePlan(result, machine.name);
        setStructuredPlan(plan);
        setIsAnalyzing(false);
    }, 100); 
  };

  const generateDefectVisuals = async () => {
      if (!structuredPlan?.diagnosis) return;
      
      const machineCtx = getMachineContext();

      setLoadingVisual('defect');
      const dImg = await generateVisualSimulation(machineCtx, structuredPlan.diagnosis, 'defect_current');
      setDefectImage(dImg);
      
      setLoadingVisual('golden');
      const gImg = await generateVisualSimulation(machineCtx, structuredPlan.diagnosis, 'golden_sample');
      setGoldenImage(gImg);
      
      setLoadingVisual(null);
  };

  const generateStepVisual = async (index: number, stepText: string) => {
      setLoadingVisual(`step-${index}`);
      const machineCtx = getMachineContext();
      const img = await generateVisualSimulation(machineCtx, structuredPlan.diagnosis, 'repair_step', stepText);
      if (img) {
          setRepairStepImages(prev => ({...prev, [index]: img}));
      }
      setLoadingVisual(null);
  };

  // -- Image Upload Logic --
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onloadend = async () => {
          const base64String = (reader.result as string).split(',')[1];
          const fullDataUrl = reader.result as string;
          setUserImage(fullDataUrl);
          setVisionResult(null); // Reset previous result
          
          if (structuredPlan?.diagnosis) {
              setIsAnalyzingVision(true);
              const result = await analyzeAttachedImage(
                  machine.name, 
                  base64String, 
                  file.type, 
                  structuredPlan.diagnosis
              );
              setVisionResult(result);
              setIsAnalyzingVision(false);
          }
      };
      reader.readAsDataURL(file);
  };

  // Helper to get image coordinates relative to the rendered size (handling object-contain)
  const handleImageLoad = () => {
      if (imgRef.current) {
          const { clientWidth, clientHeight, naturalWidth, naturalHeight } = imgRef.current;
          // Calculate the aspect ratios
          const containerRatio = clientWidth / clientHeight;
          const imageRatio = naturalWidth / naturalHeight;

          let renderWidth, renderHeight, top, left;

          if (imageRatio > containerRatio) {
              // Image is wider than container (constrained by width)
              renderWidth = clientWidth;
              renderHeight = clientWidth / imageRatio;
              top = (clientHeight - renderHeight) / 2;
              left = 0;
          } else {
              // Image is taller than container (constrained by height)
              renderHeight = clientHeight;
              renderWidth = clientHeight * imageRatio;
              left = (clientWidth - renderWidth) / 2;
              top = 0;
          }

          setImgDims({ width: renderWidth, height: renderHeight, top, left });
      }
  };

  // Resize observer to update box if window resizes
  useEffect(() => {
    const handleResize = () => {
        if (imgRef.current) handleImageLoad();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [userImage]);


  // ... (Audio Logic) ...
  const getSupportedMimeType = () => {
    if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
    return '';
  };

  const startRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: getSupportedMimeType() || undefined });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        
        // Visualizer Setup
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const draw = () => {
            if (!canvasRef.current) return;
            const ctx = canvasRef.current.getContext('2d');
            if (!ctx) return;
            animationFrameRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            const barWidth = (canvasRef.current.width / bufferLength) * 2.5;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 2;
                ctx.fillStyle = `rgb(${barHeight + 100}, 99, 241)`;
                ctx.fillRect(x, canvasRef.current.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        };
        draw();

        mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            const blob = new Blob(audioChunksRef.current, { type: getSupportedMimeType() || 'audio/webm' });
            // Analyze
            setIsAnalysingAudio(true);
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = (reader.result as string).split(',')[1];
                const res = await analyzeAudioSignature(machine.type, base64);
                setAudioAnalysis(res);
                setIsAnalysingAudio(false);
                if (res.classification) {
                     db.addLogEntry({
                         machineId: machine.id, timestamp: Date.now(), author: "Audio AI",
                         content: `Audio Scan: ${res.classification}`, type: 'audio_analysis', meta: res
                     });
                     loadData();
                }
            };
            reader.readAsDataURL(blob);
        };
        mediaRecorder.start();
        setIsRecording(true);
      } catch (e) { alert("Mic Error"); }
  };
  const stopRecording = () => mediaRecorderRef.current?.stop();

  // -- RENDERERS --

  const renderRepairAssistant = () => (
      <div className="mt-6 border-t border-slate-800 pt-6 animate-in fade-in slide-in-from-bottom-6">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-indigo-400" /> 
              AI Repair Assistant
          </h3>
        
          {/* 0. MULTIMODAL INSPECTION (PIVOT CORE) */}
          <div className="bg-slate-950 rounded-xl border border-indigo-500/30 p-6 mb-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 bg-indigo-600/10 rounded-bl-xl border-b border-l border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <Zap className="w-3 h-3 fill-current" /> Grounded Analysis
                </div>
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                        <h4 className="font-semibold text-white flex items-center gap-2">
                            <Camera className="w-5 h-5 text-indigo-400" />
                            Visual Verification (Anti-Hallucination)
                        </h4>
                        <p className="text-sm text-slate-400 mt-2">
                            Capture a photo of the affected component. Gemini will spatially analyze the image to pinpoint the defect source on the real object, eliminating generation errors.
                        </p>
                        
                        <div className="mt-6 flex gap-3">
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                            >
                                <Upload className="w-4 h-4" /> Upload / Capture Photo
                            </button>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*"
                                onChange={handleImageUpload}
                            />
                        </div>
                    </div>

                    <div className="flex-1 bg-black rounded-lg border border-slate-800 relative min-h-[300px] flex items-center justify-center overflow-hidden">
                        {userImage ? (
                            <div className="relative w-full h-full flex items-center justify-center">
                                {/* Use object-contain but allow measuring */}
                                <img 
                                    ref={imgRef}
                                    src={userImage} 
                                    alt="User Upload" 
                                    className="w-full h-full object-contain max-h-[400px]" 
                                    onLoad={handleImageLoad}
                                />
                                
                                {/* Bounding Box Overlay - Positioned exactly over the rendered image pixels */}
                                {visionResult?.boundingBox && imgDims.width > 0 && (
                                    <div 
                                        className="absolute border-2 border-rose-500 bg-rose-500/10 animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.5)] z-20"
                                        style={{
                                            top: imgDims.top + (visionResult.boundingBox[0] / 1000) * imgDims.height,
                                            left: imgDims.left + (visionResult.boundingBox[1] / 1000) * imgDims.width,
                                            height: ((visionResult.boundingBox[2] - visionResult.boundingBox[0]) / 1000) * imgDims.height,
                                            width: ((visionResult.boundingBox[3] - visionResult.boundingBox[1]) / 1000) * imgDims.width
                                        }}
                                    >
                                        <div className="absolute -top-7 left-0 bg-rose-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" /> DEFECT SOURCE
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center text-slate-600 p-8 border-2 border-dashed border-slate-800 rounded-lg">
                                <ScanEye className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <span className="text-sm">No Image Uploaded</span>
                            </div>
                        )}
                        
                        {isAnalyzingVision && (
                            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-30">
                                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
                                <span className="text-sm text-indigo-300 font-bold tracking-wide">Analysing Spatial Data...</span>
                            </div>
                        )}
                    </div>
                </div>

                {visionResult && (
                    <div className="mt-4 p-4 bg-indigo-950/30 border border-indigo-500/30 rounded-lg animate-in fade-in slide-in-from-top-2">
                        <h5 className="text-xs font-bold text-indigo-400 uppercase mb-1 flex items-center gap-2">
                            {visionResult.issueDetected ? <AlertTriangle className="w-3 h-3 text-rose-500" /> : <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                            Vision Analysis Result
                        </h5>
                        <p className="text-sm text-indigo-100 leading-relaxed font-medium">{visionResult.analysis}</p>
                    </div>
                )}
          </div>

          {/* 1. HERO ELEMENT: AI GENERATED SIMULATION */}
          <div className="relative mb-12">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 blur-3xl -z-10"></div>
              
              <div className="flex justify-between items-end mb-6">
                  <div>
                      <h4 className="text-lg font-bold text-white flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-purple-400" />
                          Generative Simulation Lab
                      </h4>
                      <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                          Visualize the potential internal state of the machine. These are <strong>AI-generated references</strong> based on sensor telemetry, designed to train operators on what to look for before opening the chassis.
                      </p>
                  </div>
                  <div className="flex gap-2">
                        {!defectImage ? (
                            <button 
                                onClick={generateDefectVisuals}
                                disabled={!!loadingVisual}
                                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-purple-500/25 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {loadingVisual === 'defect' || loadingVisual === 'golden' ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                                Generate Simulation
                            </button>
                        ) : (
                            <button 
                                onClick={generateDefectVisuals}
                                disabled={!!loadingVisual}
                                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 border border-slate-700 transition-colors"
                            >
                                <RefreshCw className="w-3 h-3" /> Regenerate
                            </button>
                        )}
                  </div>
              </div>

              {/* HERO VISUALIZATION AREA */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Defect View */}
                  <div className={`aspect-video bg-black rounded-xl overflow-hidden border-2 relative group transition-all duration-500 ${defectImage ? 'border-rose-500/40 shadow-[0_0_30px_rgba(244,63,94,0.15)]' : 'border-slate-800'}`}>
                      {defectImage ? (
                          <img src={defectImage} alt="Defect Simulation" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 space-y-3">
                              <AlertTriangle className="w-12 h-12 opacity-20" />
                              <span className="text-xs uppercase tracking-widest font-bold">Waiting for Generation</span>
                          </div>
                      )}
                      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-3 py-1 rounded text-xs font-bold text-rose-400 border border-rose-500/30 uppercase tracking-wider flex items-center gap-2">
                           <AlertTriangle className="w-3 h-3" /> Predicted Failure State
                      </div>
                      <div className="absolute bottom-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent p-6 pt-12 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                          <p className="text-rose-200 text-sm font-medium">{structuredPlan?.diagnosis || "Diagnosis Pending..."}</p>
                      </div>
                  </div>

                  {/* Golden View */}
                  <div className={`aspect-video bg-black rounded-xl overflow-hidden border-2 relative group transition-all duration-500 ${goldenImage ? 'border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.15)]' : 'border-slate-800'}`}>
                       {goldenImage ? (
                          <img src={goldenImage} alt="Golden Simulation" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 space-y-3">
                              <CheckCircle2 className="w-12 h-12 opacity-20" />
                              <span className="text-xs uppercase tracking-widest font-bold">Waiting for Generation</span>
                          </div>
                      )}
                      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-3 py-1 rounded text-xs font-bold text-emerald-400 border border-emerald-500/30 uppercase tracking-wider flex items-center gap-2">
                           <CheckCircle2 className="w-3 h-3" /> Factory Specification
                      </div>
                       <div className="absolute bottom-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent p-6 pt-12 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                          <p className="text-emerald-200 text-sm font-medium">Reference Standard (OEM)</p>
                      </div>
                  </div>
              </div>
          </div>

          {/* 2. STEP-BY-STEP REPAIR GUIDE */}
          <div className="space-y-4">
              <h4 className="font-semibold text-white flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-indigo-400" />
                  Actionable Maintenance Plan
              </h4>
              <div className="space-y-3">
                  {structuredPlan.repairSteps?.map((step: string, idx: number) => (
                      <div key={idx} className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                          <div className="p-4 flex gap-4 items-start">
                              <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-bold text-sm border border-slate-700 shrink-0 mt-0.5">
                                  {idx + 1}
                              </div>
                              <div className="flex-1">
                                  <p className="text-slate-200 text-sm leading-relaxed">{step}</p>
                                  
                                  {/* Visual Generation for this step */}
                                  <div className="mt-3">
                                      {!repairStepImages[idx] ? (
                                          <button 
                                            onClick={() => generateStepVisual(idx, step)}
                                            disabled={!!loadingVisual}
                                            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 py-1 px-2 hover:bg-indigo-500/10 rounded transition-colors"
                                          >
                                              {loadingVisual === `step-${idx}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                                              View Technique Diagram
                                          </button>
                                      ) : (
                                          <div className="mt-2 relative rounded-lg overflow-hidden border border-indigo-500/30 max-w-md group">
                                              <img src={repairStepImages[idx]} className="w-full h-48 object-cover" />
                                              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-[10px] text-white rounded backdrop-blur border border-white/10">
                                                  AI Technical Diagram
                                              </div>
                                              <button 
                                                 onClick={() => generateStepVisual(idx, step)}
                                                 className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/80 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                 title="Regenerate"
                                              >
                                                  <RefreshCw className="w-3 h-3" />
                                              </button>
                                          </div>
                                      )}
                                  </div>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>
  );

  const renderLiveMonitor = () => (
    <div className="grid grid-cols-1 gap-4 h-full overflow-y-auto pr-2 pb-20">
         {/* ... (Existing Charts) ... */}
         <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
             <div className="xl:col-span-2">
                <LiveCharts data={machine.history} color="#f43f5e" dataKey="vibration" label="Vibration Analysis" unit="mm/s" threshold={historicalStats?.vibration.limit} />
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
             </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LiveCharts data={machine.history} color="#f59e0b" dataKey="temperature" label="Thermal Core Temp" unit="°C" threshold={historicalStats?.temperature.limit} />
            <LiveCharts data={machine.history} color="#6366f1" dataKey="noise" label="Acoustic Decibels" unit="dB" threshold={historicalStats?.noise.limit} />
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
                onClick={isRecording ? () => { setIsRecording(false); stopRecording(); } : startRecording}
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

         {isRecording && (
             <div className="h-24 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden relative shadow-inner mt-4">
                 <canvas ref={canvasRef} className="w-full h-full" width={800} height={100} />
                 <div className="absolute top-3 right-3 text-[10px] font-bold text-rose-500 flex items-center gap-1.5 bg-rose-950/50 px-2 py-1 rounded-full border border-rose-500/20">
                     <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping"></div> LIVE MIC
                 </div>
             </div>
         )}

         {/* Diagnosis Result */}
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
                     </div>
                 </div>
                 
                 {/* REPAIR ASSISTANT */}
                 {structuredPlan?.repairSteps && renderRepairAssistant()}
             </div>
         )}
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
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">Close Panel</button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-700 bg-slate-900 px-6">
            <button onClick={() => setActiveTab('live')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'live' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                <MonitorPlay className="w-4 h-4" /> Live Telemetry
            </button>
            <button onClick={() => setActiveTab('logbook')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'logbook' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                <ClipboardList className="w-4 h-4" /> Activity Timeline
            </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden p-6 bg-slate-900/50">
            {activeTab === 'live' && renderLiveMonitor()}
            {activeTab === 'logbook' && <div>Logbook Component (UnifiedTimeline)</div>}
        </div>
      </div>
    </div>
  );
};

export default MachineModel;