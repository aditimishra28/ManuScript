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
  Maximize,
  ArrowRight,
  X
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
  
  const [defectImage, setDefectImage] = useState<string | null>(null);
  const [goldenImage, setGoldenImage] = useState<string | null>(null);
  const [loadingVisual, setLoadingVisual] = useState<string | null>(null); 
  const [repairStepImages, setRepairStepImages] = useState<Record<number, string>>({});

  const [userImage, setUserImage] = useState<string | null>(null); 
  const [visionResult, setVisionResult] = useState<VisionResult | null>(null);
  const [isAnalyzingVision, setIsAnalyzingVision] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgDims, setImgDims] = useState({ width: 0, height: 0, top: 0, left: 0 });

  const [isRecording, setIsRecording] = useState(false);
  const [audioAnalysis, setAudioAnalysis] = useState<any>(null);
  const [isAnalysingAudio, setIsAnalysingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [machineAlerts, setMachineAlerts] = useState<Alert[]>([]);
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

  const loadData = async () => {
    const l = await db.getMachineLogs(machine.id);
    setLogs(l);
    const a = await db.alerts.where('machineId').equals(machine.id).reverse().sortBy('timestamp');
    setMachineAlerts(a);
  };

  useEffect(() => {
    loadData();
  }, [machine.id]);

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
      
      // Use explicit visual cues from the reasoning model if available, otherwise fallback to diagnosis
      const defectPrompt = structuredPlan.visualDefectCues || structuredPlan.diagnosis;
      const goldenPrompt = structuredPlan.visualGoldenCues || structuredPlan.diagnosis;

      const dImg = await generateVisualSimulation(machineCtx, defectPrompt, 'defect_current');
      setDefectImage(dImg);
      setLoadingVisual('golden');
      const gImg = await generateVisualSimulation(machineCtx, goldenPrompt, 'golden_sample');
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = async () => {
          const base64String = (reader.result as string).split(',')[1];
          const fullDataUrl = reader.result as string;
          setUserImage(fullDataUrl);
          setVisionResult(null); 
          
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

  const handleImageLoad = () => {
      if (imgRef.current) {
          const { clientWidth, clientHeight, naturalWidth, naturalHeight } = imgRef.current;
          const containerRatio = clientWidth / clientHeight;
          const imageRatio = naturalWidth / naturalHeight;
          let renderWidth, renderHeight, top, left;
          if (imageRatio > containerRatio) {
              renderWidth = clientWidth;
              renderHeight = clientWidth / imageRatio;
              top = (clientHeight - renderHeight) / 2;
              left = 0;
          } else {
              renderHeight = clientHeight;
              renderWidth = clientHeight * imageRatio;
              left = (clientWidth - renderWidth) / 2;
              top = 0;
          }
          setImgDims({ width: renderWidth, height: renderHeight, top, left });
      }
  };

  useEffect(() => {
    const handleResize = () => {
        if (imgRef.current) handleImageLoad();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [userImage]);

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

  const renderRepairAssistant = () => (
      <div className="mt-6 border-t border-gray-200 dark:border-navy-800 pt-6 animate-in fade-in slide-in-from-bottom-6">
          <h3 className="text-xl font-bold text-blue-950 dark:text-white mb-6 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-gray-500" /> 
              AI Repair Assistant
          </h3>
        
          <div className="relative mb-12 p-6 rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-navy-900 dark:to-navy-950 border border-gray-200 dark:border-navy-800 shadow-xl overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent"></div>
              
              <div className="flex flex-col md:flex-row justify-between items-end mb-8 relative z-10">
                  <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 rounded bg-blue-50 dark:bg-navy-800 border border-blue-100 dark:border-navy-700 text-blue-800 dark:text-blue-200 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> HERO FEATURE
                        </span>
                        <span className="text-xs text-gray-500 font-mono">GEMINI IMAGE GENERATION</span>
                      </div>
                      <h4 className="text-2xl font-bold text-blue-950 dark:text-white flex items-center gap-2">
                          Generative Simulation Lab
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-slate-300 mt-2 max-w-2xl leading-relaxed">
                          Visualize the potential internal state of the machine. These are <strong>AI-generated digital twins</strong> based on real-time sensor telemetry, designed to train operators on what to look for before opening the chassis.
                      </p>
                  </div>
                  <div className="flex gap-2 mt-4 md:mt-0">
                        {!defectImage ? (
                            <button 
                                onClick={generateDefectVisuals}
                                disabled={!!loadingVisual}
                                className="bg-blue-950 hover:bg-blue-900 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-navy-950 px-8 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-900/10 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
                            >
                                {loadingVisual === 'defect' || loadingVisual === 'golden' ? <Loader2 className="w-5 h-5 animate-spin" /> : <BrainCircuit className="w-5 h-5" />}
                                Generate Failure Simulation
                            </button>
                        ) : (
                            <button 
                                onClick={generateDefectVisuals}
                                disabled={!!loadingVisual}
                                className="bg-white dark:bg-navy-800 hover:bg-gray-50 dark:hover:bg-navy-700 text-blue-950 dark:text-white px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 border border-gray-200 dark:border-navy-700 transition-colors"
                            >
                                <RefreshCw className="w-3 h-3" /> Regenerate Models
                            </button>
                        )}
                  </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
                  <div className={`aspect-video bg-black rounded-xl overflow-hidden border-2 relative group transition-all duration-500 ${defectImage ? 'border-rose-500/60 shadow-[0_0_50px_rgba(244,63,94,0.2)]' : 'border-gray-200 dark:border-navy-800'}`}>
                      {defectImage ? (
                          <img src={defectImage} alt="Defect Simulation" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 space-y-4 bg-white dark:bg-navy-900">
                              <div className="w-16 h-16 rounded-full bg-gray-50 dark:bg-navy-800 border border-gray-200 dark:border-navy-700 flex items-center justify-center">
                                  <AlertTriangle className="w-8 h-8 opacity-20" />
                              </div>
                              <span className="text-xs uppercase tracking-widest font-bold opacity-50">Waiting for Generation</span>
                          </div>
                      )}
                      <div className="absolute top-0 left-0 w-full p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start">
                          <div className="bg-rose-500/20 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold text-rose-400 border border-rose-500/40 uppercase tracking-wider flex items-center gap-2 shadow-lg">
                               <AlertTriangle className="w-3 h-3" /> Predicted Failure
                          </div>
                      </div>
                      <div className="absolute bottom-0 w-full bg-gradient-to-t from-black via-black/90 to-transparent p-6 pt-12 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                          <p className="text-rose-200 text-sm font-medium leading-tight">{structuredPlan?.visualDefectCues || structuredPlan?.diagnosis || "Diagnosis Pending..."}</p>
                          <p className="text-[10px] text-rose-400/70 mt-1 uppercase tracking-wider">AI Confidence: 94%</p>
                      </div>
                  </div>

                  <div className={`aspect-video bg-black rounded-xl overflow-hidden border-2 relative group transition-all duration-500 ${goldenImage ? 'border-emerald-500/60 shadow-[0_0_50px_rgba(16,185,129,0.2)]' : 'border-gray-200 dark:border-navy-800'}`}>
                       {goldenImage ? (
                          <img src={goldenImage} alt="Golden Simulation" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 space-y-4 bg-white dark:bg-navy-900">
                              <div className="w-16 h-16 rounded-full bg-gray-50 dark:bg-navy-800 border border-gray-200 dark:border-navy-700 flex items-center justify-center">
                                  <CheckCircle2 className="w-8 h-8 opacity-20" />
                              </div>
                              <span className="text-xs uppercase tracking-widest font-bold opacity-50">Waiting for Generation</span>
                          </div>
                      )}
                      <div className="absolute top-0 left-0 w-full p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start">
                          <div className="bg-emerald-500/20 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-400 border border-emerald-500/40 uppercase tracking-wider flex items-center gap-2 shadow-lg">
                               <CheckCircle2 className="w-3 h-3" /> Golden Sample
                          </div>
                      </div>
                       <div className="absolute bottom-0 w-full bg-gradient-to-t from-black via-black/90 to-transparent p-6 pt-12 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                          <p className="text-emerald-200 text-sm font-medium leading-tight">{structuredPlan?.visualGoldenCues || "Reference Standard (OEM)"}</p>
                          <p className="text-[10px] text-emerald-400/70 mt-1 uppercase tracking-wider">Target Condition</p>
                      </div>
                  </div>
              </div>
          </div>

          <div className="bg-white dark:bg-navy-950 rounded-xl border border-gray-200 dark:border-navy-800 p-6 mb-8 relative overflow-hidden group shadow-sm">
                <div className="absolute top-0 right-0 p-3 bg-gray-50 dark:bg-navy-900 rounded-bl-xl border-b border-l border-gray-200 dark:border-navy-800 text-gray-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <Zap className="w-3 h-3 fill-current" /> Grounded Analysis
                </div>
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                        <h4 className="font-semibold text-blue-950 dark:text-white flex items-center gap-2">
                            <Camera className="w-5 h-5 text-gray-500" />
                            Visual Verification (Grounding)
                        </h4>
                        <p className="text-sm text-gray-500 mt-2">
                            Capture a photo of the affected component. Gemini will spatially analyze the image to pinpoint the defect source on the real object, eliminating generation errors.
                        </p>
                        
                        <div className="mt-6 flex gap-3">
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-blue-950 hover:bg-blue-900 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-navy-950 px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-900/10 transition-all active:scale-95"
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

                    <div className="flex-1 bg-black rounded-lg border border-gray-800 relative min-h-[300px] flex items-center justify-center overflow-hidden">
                        {userImage ? (
                            <div className="relative w-full h-full flex items-center justify-center">
                                <img 
                                    ref={imgRef}
                                    src={userImage} 
                                    alt="User Upload" 
                                    className="w-full h-full object-contain max-h-[400px]" 
                                    onLoad={handleImageLoad}
                                />
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
                            <div className="text-center text-gray-500 p-8 border-2 border-dashed border-gray-700 rounded-lg">
                                <ScanEye className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <span className="text-sm">No Image Uploaded</span>
                            </div>
                        )}
                        {isAnalyzingVision && (
                            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-30">
                                <Loader2 className="w-10 h-10 text-white animate-spin mb-3" />
                                <span className="text-sm text-white font-bold tracking-wide">Analysing Spatial Data...</span>
                            </div>
                        )}
                    </div>
                </div>

                {visionResult && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-800 rounded-lg animate-in fade-in slide-in-from-top-2">
                        <h5 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1 flex items-center gap-2">
                            {visionResult.issueDetected ? <AlertTriangle className="w-3 h-3 text-rose-500" /> : <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                            Vision Analysis Result
                        </h5>
                        <p className="text-sm text-gray-700 dark:text-slate-200 leading-relaxed font-medium">{visionResult.analysis}</p>
                    </div>
                )}
          </div>

          <div className="space-y-4">
              <h4 className="font-semibold text-blue-950 dark:text-white flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-gray-500" />
                  Actionable Maintenance Plan
              </h4>
              <div className="space-y-3">
                  {structuredPlan.repairSteps?.map((step: string, idx: number) => (
                      <div key={idx} className="bg-white dark:bg-navy-950 border border-gray-200 dark:border-navy-800 rounded-lg overflow-hidden shadow-sm">
                          <div className="p-4 flex gap-4 items-start">
                              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-navy-900 text-gray-500 flex items-center justify-center font-bold text-sm border border-gray-200 dark:border-navy-800 shrink-0 mt-0.5">
                                  {idx + 1}
                              </div>
                              <div className="flex-1">
                                  <p className="text-gray-700 dark:text-slate-200 text-sm leading-relaxed">{step}</p>
                                  <div className="mt-3">
                                      {!repairStepImages[idx] ? (
                                          <button 
                                            onClick={() => generateStepVisual(idx, step)}
                                            disabled={!!loadingVisual}
                                            className="text-xs text-gray-500 hover:text-blue-950 dark:hover:text-white flex items-center gap-1.5 py-1 px-2 hover:bg-gray-100 dark:hover:bg-navy-900 rounded transition-colors"
                                          >
                                              {loadingVisual === `step-${idx}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                                              View Technique Diagram
                                          </button>
                                      ) : (
                                          <div className="mt-2 relative rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 max-w-md group">
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
         <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
             <div className="xl:col-span-2">
                <LiveCharts data={machine.history} color="#f43f5e" dataKey="vibration" label="Vibration Analysis" unit="mm/s" threshold={historicalStats?.vibration.limit} />
             </div>
             <div className="bg-white dark:bg-navy-950 rounded-lg border border-gray-200 dark:border-navy-800 p-4 flex flex-col items-center justify-center relative overflow-hidden shadow-sm">
                 <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2 z-10">Asset Health Score</h3>
                 <div className="relative z-10">
                     <svg className="w-32 h-32 transform -rotate-90">
                         <circle cx="64" cy="64" r="56" stroke="#e5e7eb" strokeWidth="12" fill="transparent" className="dark:stroke-navy-800" />
                         <circle cx="64" cy="64" r="56" stroke={healthScore > 80 ? '#10b981' : healthScore > 50 ? '#f59e0b' : '#f43f5e'} strokeWidth="12" fill="transparent" strokeDasharray={351} strokeDashoffset={351 - (351 * healthScore) / 100} className="transition-all duration-1000 ease-out" />
                     </svg>
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                         <div className="text-3xl font-bold text-blue-950 dark:text-white">{Math.round(healthScore)}</div>
                         <div className="text-[10px] text-gray-500">/ 100</div>
                     </div>
                 </div>
             </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LiveCharts data={machine.history} color="#f59e0b" dataKey="temperature" label="Thermal Core Temp" unit="°C" threshold={historicalStats?.temperature.limit} />
            <LiveCharts data={machine.history} color="#6366f1" dataKey="noise" label="Acoustic Decibels" unit="dB" threshold={historicalStats?.noise.limit} />
        </div>

         <div className="flex flex-col md:flex-row gap-4 mt-4">
             <button 
                onClick={handleRunDiagnostics}
                disabled={isAnalyzing}
                className="flex-1 bg-blue-950 hover:bg-blue-900 dark:bg-white dark:hover:bg-gray-200 disabled:bg-gray-300 dark:disabled:bg-slate-700 text-white dark:text-navy-950 disabled:text-gray-500 p-4 rounded-xl flex items-center justify-center gap-3 font-medium transition-all shadow-lg shadow-blue-900/10"
             >
                 {isAnalyzing ? (
                     <>
                        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
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
                    : 'bg-white dark:bg-navy-800 hover:bg-gray-50 dark:hover:bg-navy-700 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-navy-700'
                }`}
             >
                {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                {isRecording ? 'Stop Recording' : 'Analyze Audio Signature'}
             </button>
         </div>

         {isRecording && (
             <div className="h-24 bg-navy-950 rounded-xl border border-navy-800 overflow-hidden relative shadow-inner mt-4">
                 <canvas ref={canvasRef} className="w-full h-full" width={800} height={100} />
                 <div className="absolute top-3 right-3 text-[10px] font-bold text-rose-500 flex items-center gap-1.5 bg-rose-950/50 px-2 py-1 rounded-full border border-rose-500/20">
                     <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping"></div> LIVE MIC
                 </div>
             </div>
         )}

         {(aiInsight || structuredPlan) && (
             <div className="mt-4 bg-white/80 dark:bg-navy-900/80 backdrop-blur rounded-xl border border-gray-200 dark:border-navy-800 p-5 animate-in fade-in slide-in-from-bottom-4 shadow-xl">
                 <div className="flex items-start gap-4">
                     <div className="p-3 bg-blue-950 dark:bg-navy-700 rounded-xl text-white shrink-0 shadow-lg">
                         <Sparkles className="w-6 h-6" />
                     </div>
                     <div className="space-y-3 w-full">
                         <div>
                             <h4 className="font-bold text-blue-950 dark:text-white text-lg flex items-center gap-2">
                                Gemini Diagnostics Engine
                                <span className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-slate-300 rounded border border-gray-200 dark:border-navy-700">Gemini 3 Pro</span>
                             </h4>
                             <p className="text-gray-600 dark:text-slate-300 text-sm mt-2 leading-relaxed border-l-2 border-gray-200 dark:border-navy-700 pl-3">
                                 {structuredPlan?.diagnosis || aiInsight}
                             </p>
                         </div>
                     </div>
                 </div>
                 {structuredPlan?.repairSteps && renderRepairAssistant()}
             </div>
         )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-black w-full max-w-6xl h-[90vh] rounded-xl border border-gray-200 dark:border-navy-800 shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-navy-800 flex justify-between items-center bg-white dark:bg-navy-950">
          <div className="flex items-center gap-4">
             <div>
                <h2 className="text-xl font-bold text-blue-950 dark:text-white flex items-center gap-3">
                {machine.name}
                <span className={`text-xs px-2 py-1 rounded-full border ${
                    machine.status === MachineStatus.NORMAL ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-500 text-emerald-600 dark:text-emerald-400' :
                    machine.status === MachineStatus.WARNING ? 'bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-500 text-amber-600 dark:text-amber-400' :
                    'bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-500 text-rose-600 dark:text-rose-400'
                }`}>
                    {machine.status}
                </span>
                </h2>
                <p className="text-gray-500 dark:text-slate-400 text-xs mt-0.5 font-mono">{machine.id.toUpperCase()} • {machine.location}</p>
             </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-blue-950 dark:hover:text-white transition-colors">Close Panel</button>
        </div>

        <div className="flex border-b border-gray-200 dark:border-navy-800 bg-white dark:bg-navy-950 px-6">
            <button onClick={() => setActiveTab('live')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'live' ? 'border-blue-950 dark:border-white text-blue-950 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-200'}`}>
                <MonitorPlay className="w-4 h-4" /> Live Telemetry
            </button>
            <button onClick={() => setActiveTab('logbook')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'logbook' ? 'border-blue-950 dark:border-white text-blue-950 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-200'}`}>
                <ClipboardList className="w-4 h-4" /> Activity Timeline
            </button>
        </div>

        <div className="flex-1 overflow-hidden p-6 bg-white dark:bg-black">
            {activeTab === 'live' && renderLiveMonitor()}
            {activeTab === 'logbook' && <div>Logbook Component (UnifiedTimeline)</div>}
        </div>
      </div>
    </div>
  );
};

export default MachineModel;