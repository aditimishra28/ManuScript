import React, { useState } from 'react';
import { Factory, Wifi, CheckCircle, ArrowRight, ShieldCheck, X, Sparkles, Loader2, Server } from 'lucide-react';
import { pipeline } from '../services/pipeline';

interface MachineWizardProps {
  onClose: () => void;
  onComplete: () => void;
}

const MachineWizard: React.FC<MachineWizardProps> = ({ onClose, onComplete }) => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
      name: '',
      type: 'CNC Mill',
      location: '',
      serialNumber: '',
      deviceKey: ''
  });

  const handleNext = async () => {
      if (step === 2) {
          setIsLoading(true);
          await new Promise(resolve => setTimeout(resolve, 1500));
          setIsLoading(false);
          setStep(3);
      } else {
          setStep(prev => prev + 1);
      }
  };

  const handleFinish = () => {
      pipeline.registerMachine({
          name: formData.name,
          type: formData.type,
          location: formData.location,
          serialNumber: formData.serialNumber,
          networkIp: `10.0.0.${Math.floor(Math.random() * 255)}`,
          imageUrl: 'https://picsum.photos/800/600'
      });
      onComplete();
  };

  const renderStepIndicator = () => (
      <div className="flex justify-between items-center mb-8 px-4 relative">
          {[1, 2, 3].map((s) => (
              <div key={s} className="flex flex-col items-center z-10 relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-500 ${
                      step >= s 
                      ? 'bg-white dark:bg-navy-950 border-blue-950 dark:border-white text-blue-950 dark:text-white' 
                      : 'bg-slate-100 dark:bg-navy-900 border-slate-300 dark:border-navy-700 text-slate-400 dark:text-slate-500'
                  } ${step > s ? 'bg-blue-950 dark:bg-white border-blue-950 dark:border-white text-white dark:text-navy-950' : ''}`}>
                      {step > s ? <CheckCircle className="w-5 h-5" /> : s}
                  </div>
                  <div className={`text-[10px] mt-2 font-medium uppercase tracking-wider ${step >= s ? 'text-blue-950 dark:text-white' : 'text-slate-500'}`}>
                      {s === 1 ? 'Profile' : s === 2 ? 'Pairing' : 'Verify'}
                  </div>
              </div>
          ))}
          <div className="absolute top-[15px] left-[10%] right-[10%] h-0.5 bg-slate-200 dark:bg-navy-800 -z-0">
             <div 
                className="h-full bg-blue-950 dark:bg-white transition-all duration-500" 
                style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
             />
          </div>
      </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-navy-950 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-navy-800 shadow-2xl overflow-hidden flex flex-col relative text-slate-900 dark:text-white">
         
         <div className="p-6 border-b border-slate-200 dark:border-navy-800 flex justify-between items-center bg-slate-50 dark:bg-navy-900/50">
             <h2 className="text-xl font-bold flex items-center gap-2 text-blue-950 dark:text-white">
                 <Factory className="w-5 h-5" /> 
                 Register New Asset
             </h2>
             <button onClick={onClose} className="text-slate-400 hover:text-blue-950 dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
         </div>

         <div className="p-8 relative">
             {renderStepIndicator()}

             <div className="mt-6 min-h-[280px]">
                 
                 {step === 1 && (
                     <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                         <div>
                             <label className="block text-xs font-medium text-slate-500 mb-1">Machine Name</label>
                             <input 
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                placeholder="e.g. Injection Molder B2"
                                className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-3 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                             />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Asset Type</label>
                                <select 
                                    value={formData.type}
                                    onChange={e => setFormData({...formData, type: e.target.value})}
                                    className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-3 text-sm text-slate-900 dark:text-white focus:border-blue-500 outline-none"
                                >
                                    <option>CNC Mill</option>
                                    <option>Lathe</option>
                                    <option>Hydraulic Press</option>
                                    <option>Robotic Arm</option>
                                    <option>Conveyor Belt</option>
                                    <option>Furnace</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Location / Zone</label>
                                <input 
                                    value={formData.location}
                                    onChange={e => setFormData({...formData, location: e.target.value})}
                                    placeholder="e.g. Sector 7G"
                                    className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-3 text-sm text-slate-900 dark:text-white focus:border-blue-500 outline-none"
                                />
                            </div>
                         </div>
                         <div>
                             <label className="block text-xs font-medium text-slate-500 mb-1">Serial Number</label>
                             <input 
                                value={formData.serialNumber}
                                onChange={e => setFormData({...formData, serialNumber: e.target.value})}
                                placeholder="Manufacturer S/N"
                                className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded p-3 text-sm text-slate-900 dark:text-white focus:border-blue-500 outline-none"
                             />
                         </div>
                     </div>
                 )}

                 {step === 2 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 text-center py-4">
                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center mx-auto mb-4 relative">
                            <Wifi className="w-8 h-8 text-blue-950 dark:text-white animate-pulse" />
                            <div className="absolute inset-0 rounded-full border border-blue-400 dark:border-blue-500 animate-ping opacity-50"></div>
                        </div>
                        <h3 className="text-lg font-semibold text-blue-950 dark:text-white">Device Discovery Mode</h3>
                        <p className="text-sm text-slate-500 max-w-xs mx-auto">
                            Enter the 6-digit pairing code from the HMI to initiate cryptographic handshake.
                        </p>
                        
                        <input 
                            value={formData.deviceKey}
                            onChange={e => setFormData({...formData, deviceKey: e.target.value})}
                            placeholder="000-000"
                            className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg p-4 text-2xl text-center text-blue-950 dark:text-white tracking-[0.5em] font-mono focus:border-blue-500 outline-none w-64 mx-auto block uppercase"
                            maxLength={7}
                        />

                        {isLoading && (
                            <div className="flex items-center justify-center gap-2 text-slate-500 text-sm mt-4">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Verifying Security Token...
                            </div>
                        )}
                    </div>
                 )}

                 {step === 3 && (
                     <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                         <div className="bg-slate-50 dark:bg-navy-900/50 rounded-xl border border-slate-200 dark:border-navy-800 p-4 flex gap-4">
                             <div className="w-16 h-16 rounded-lg bg-white dark:bg-navy-800 flex items-center justify-center border border-slate-200 dark:border-navy-700 shrink-0">
                                 <Server className="w-8 h-8 text-slate-400" />
                             </div>
                             <div>
                                 <h3 className="font-bold text-blue-950 dark:text-white text-lg">{formData.name}</h3>
                                 <div className="flex flex-wrap gap-2 mt-2">
                                     <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 rounded border border-slate-200 dark:border-navy-700">
                                        {formData.type}
                                     </span>
                                     <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 rounded border border-slate-200 dark:border-navy-700">
                                        {formData.location}
                                     </span>
                                 </div>
                                 <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                     <ShieldCheck className="w-3 h-3" /> Securely Paired via IoT Protocol
                                 </div>
                             </div>
                         </div>

                         <div className="p-4 bg-slate-100 dark:bg-navy-800/50 border border-slate-200 dark:border-navy-700 rounded-lg">
                             <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase flex items-center gap-2 mb-2">
                                 <Sparkles className="w-3 h-3" /> System Calibrated
                             </h4>
                             <p className="text-xs text-slate-500 dark:text-slate-400">
                                 Connection established. Telemetry stream is now active and being analyzed by the anomaly detection engine.
                             </p>
                         </div>
                     </div>
                 )}

             </div>

             <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-navy-800">
                 <button 
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-slate-500 hover:text-blue-950 dark:hover:text-white transition-colors"
                 >
                     Cancel
                 </button>
                 
                 <button 
                    onClick={step === 3 ? handleFinish : handleNext}
                    disabled={(step === 1 && !formData.name) || (step === 2 && formData.deviceKey.length < 3) || isLoading}
                    className="bg-blue-950 hover:bg-blue-900 dark:bg-white dark:hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-white dark:text-navy-950 px-6 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-lg shadow-blue-900/10 active:scale-95"
                 >
                     {step === 3 ? (
                         <>Complete Setup <CheckCircle className="w-4 h-4" /></>
                     ) : (
                         <>Next Step <ArrowRight className="w-4 h-4" /></>
                     )}
                 </button>
             </div>

         </div>

      </div>
    </div>
  );
};

export default MachineWizard;