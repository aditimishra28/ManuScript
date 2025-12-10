import React, { useState, useEffect } from 'react';
import { Machine, MachineStatus, SensorReading } from '../types';
import { LiveCharts } from './LiveCharts';
import { BrainCircuit, AlertTriangle, CheckCircle, Thermometer, Activity, Volume2, Video } from 'lucide-react';
import { analyzeMachineHealth, generateMaintenancePlan } from '../services/geminiService';

interface MachineDetailProps {
  machine: Machine;
  onClose: () => void;
}

const MachineDetail: React.FC<MachineDetailProps> = ({ machine, onClose }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [structuredPlan, setStructuredPlan] = useState<any>(null);

  // Auto-scroll to bottom of analysis or updates could be handled here
  
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 w-full max-w-6xl h-[90vh] rounded-xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              {machine.name}
              <span className={`text-xs px-2 py-1 rounded-full border ${
                machine.status === MachineStatus.NORMAL ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' :
                machine.status === MachineStatus.WARNING ? 'bg-amber-500/20 border-amber-500 text-amber-400' :
                'bg-rose-500/20 border-rose-500 text-rose-400'
              }`}>
                {machine.status}
              </span>
            </h2>
            <p className="text-slate-400 text-sm mt-1">{machine.type} • {machine.location}</p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            Close Panel
          </button>
        </div>

        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Stats & Camera */}
          <div className="space-y-6">
            
            {/* Camera Feed Simulation */}
            <div className="bg-black rounded-lg border border-slate-700 overflow-hidden relative group">
              <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded animate-pulse flex items-center gap-1">
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
          <div className="lg:col-span-1 space-y-4 flex flex-col h-full">
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
      </div>
    </div>
  );
};

export default MachineDetail;