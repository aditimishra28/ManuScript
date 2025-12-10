import React, { useState } from 'react';
import { Factory, Wifi, CheckCircle, ArrowRight, ShieldCheck, Database, Server, X } from 'lucide-react';
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

  const handleNext = () => {
      if (step === 2) {
          // Simulate Pairing Process
          setIsLoading(true);
          setTimeout(() => {
              setIsLoading(false);
              setStep(3);
          }, 2000);
      } else {
          setStep(prev => prev + 1);
      }
  };

  const handleFinish = () => {
      // Add to pipeline
      pipeline.registerMachine({
          name: formData.name,
          type: formData.type,
          location: formData.location,
          serialNumber: formData.serialNumber,
          networkIp: `10.0.0.${Math.floor(Math.random() * 255)}`
      });
      onComplete();
  };

  const renderStepIndicator = () => (
      <div className="flex justify-between items-center mb-8 px-4">
          {[1, 2, 3].map((s) => (
              <div key={s} className="flex flex-col items-center z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-500 ${
                      step >= s 
                      ? 'bg-indigo-600 border-indigo-600 text-white' 
                      : 'bg-slate-900 border-slate-700 text-slate-500'
                  }`}>
                      {step > s ? <CheckCircle className="w-5 h-5" /> : s}
                  </div>
                  <div className="text-[10px] mt-2 font-medium text-slate-400 uppercase tracking-wider">
                      {s === 1 ? 'Profile' : s === 2 ? 'Pairing' : 'Verify'}
                  </div>
              </div>
          ))}
          {/* Progress Bar Line */}
          <div className="absolute top-[86px] left-[15%] right-[15%] h-0.5 bg-slate-800 -z-0">
             <div 
                className="h-full bg-indigo-600 transition-all duration-500" 
                style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
             />
          </div>
      </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col relative">
         
         <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
             <h2 className="text-xl font-bold text-white flex items-center gap-2">
                 <Factory className="w-5 h-5 text-indigo-500" /> 
                 Register New Asset
             </h2>
             <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
         </div>

         <div className="p-8 relative">
             {renderStepIndicator()}

             <div className="mt-6 min-h-[250px]">
                 
                 {/* STEP 1: ASSET DETAILS */}
                 {step === 1 && (
                     <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                         <div>
                             <label className="block text-xs font-medium text-slate-400 mb-1">Machine Name</label>
                             <input 
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                placeholder="e.g. Injection Molder B2"
                                className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                             />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Asset Type</label>
                                <select 
                                    value={formData.type}
                                    onChange={e => setFormData({...formData, type: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm text-white focus:border-indigo-500 outline-none"
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
                                <label className="block text-xs font-medium text-slate-400 mb-1">Location / Zone</label>
                                <input 
                                    value={formData.location}
                                    onChange={e => setFormData({...formData, location: e.target.value})}
                                    placeholder="e.g. Sector 7"
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm text-white focus:border-indigo-500 outline-none"
                                />
                            </div>
                         </div>
                     </div>
                 )}

                 {/* STEP 2: PAIRING */}
                 {step === 2 && (
                     <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                         {isLoading ? (
                             <div className="flex flex-col items-center justify-center h-[200px] text-center space-y-4">
                                 <div className="relative">
                                     <div className="w-16 h-16 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin"></div>
                                     <Wifi className="w-6 h-6 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                                 </div>
                                 <div>
                                     <h3 className="text-white font-medium">Handshaking with Device...</h3>
                                     <p className="text-sm text-slate-500">Exchanging crypto-keys and verifying hardware signature.</p>
                                 </div>
                             </div>
                         ) : (
                             <>
                                <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-4 flex gap-3">
                                    <Server className="w-6 h-6 text-indigo-400 shrink-0" />
                                    <div className="text-sm text-indigo-200">
                                        Enter the 16-digit serial number found on the machine's controller unit to initiate secure pairing.
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Hardware Serial Number</label>
                                    <input 
                                        value={formData.serialNumber}
                                        onChange={e => setFormData({...formData, serialNumber: e.target.value})}
                                        placeholder="SN-XXXX-XXXX-XXXX"
                                        className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm text-white font-mono uppercase tracking-widest focus:border-indigo-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Secure Pairing Key (Optional)</label>
                                    <input 
                                        type="password"
                                        placeholder="•••• •••• ••••"
                                        className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm text-white focus:border-indigo-500 outline-none"
                                    />
                                </div>
                             </>
                         )}
                     </div>
                 )}

                 {/* STEP 3: VERIFICATION */}
                 {step === 3 && (
                     <div className="flex flex-col items-center justify-center h-[250px] text-center space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                         <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                             <ShieldCheck className="w-10 h-10 text-emerald-500" />
                         </div>
                         <div>
                             <h3 className="text-xl font-bold text-white">Asset Verified & Secured</h3>
                             <p className="text-slate-400 mt-2 max-w-xs mx-auto">
                                 The machine <strong>{formData.name}</strong> has been successfully registered to the pipeline. Telemetry stream is active.
                             </p>
                         </div>
                         <div className="flex gap-4 text-xs text-slate-500">
                             <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" /> Camera Linked</span>
                             <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" /> Sensors Calibrated</span>
                         </div>
                     </div>
                 )}
             </div>

             <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-800">
                 {step < 3 && (
                     <button 
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                     >
                         Cancel
                     </button>
                 )}
                 
                 {step < 3 ? (
                     <button 
                        onClick={handleNext}
                        disabled={step === 1 && !formData.name}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                         {step === 2 ? 'Establish Connection' : 'Next Step'} <ArrowRight className="w-4 h-4" />
                     </button>
                 ) : (
                     <button 
                        onClick={handleFinish}
                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-emerald-500/20"
                     >
                         Go to Dashboard
                     </button>
                 )}
             </div>

         </div>

      </div>
    </div>
  );
};

export default MachineWizard;