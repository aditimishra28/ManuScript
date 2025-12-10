import React, { useState, useEffect } from 'react';
import { Shield, Lock, Fingerprint, Factory, CheckCircle } from 'lucide-react';

interface AuthScreenProps {
  onLogin: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoadingStep(0);
  };

  useEffect(() => {
    if (isLoading) {
      const timers = [
        setTimeout(() => setLoadingStep(1), 800), // Verifying Credentials
        setTimeout(() => setLoadingStep(2), 1600), // Biometric/2FA Check
        setTimeout(() => setLoadingStep(3), 2400), // Establishing Secure Tunnel
        setTimeout(() => {
            setIsLoading(false);
            onLogin();
        }, 3200)
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [isLoading, onLogin]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950"></div>
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>

      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8 relative z-10">
        
        <div className="flex flex-col items-center mb-8">
            <div className="p-3 bg-indigo-500/10 rounded-xl mb-4 border border-indigo-500/20">
                <Factory className="w-10 h-10 text-indigo-500" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Sentin<span className="text-indigo-500">AI</span> Manufacturing</h1>
            <p className="text-slate-400 text-sm mt-2">Secure Industrial IoT Portal</p>
        </div>

        {isLoading ? (
            <div className="space-y-6 py-4">
                <div className="space-y-4">
                    <div className={`flex items-center gap-3 transition-opacity duration-300 ${loadingStep >= 0 ? 'opacity-100' : 'opacity-0'}`}>
                        {loadingStep > 0 ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <div className="w-5 h-5 border-2 border-slate-600 border-t-indigo-500 rounded-full animate-spin" />}
                        <span className={`text-sm ${loadingStep > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>Verifying encrypted credentials...</span>
                    </div>
                    <div className={`flex items-center gap-3 transition-opacity duration-300 ${loadingStep >= 1 ? 'opacity-100' : 'opacity-0'}`}>
                         {loadingStep > 1 ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <div className="w-5 h-5 border-2 border-slate-600 border-t-indigo-500 rounded-full animate-spin" />}
                        <span className={`text-sm ${loadingStep > 1 ? 'text-emerald-400' : 'text-slate-300'}`}>Checking organization 2FA policy...</span>
                    </div>
                    <div className={`flex items-center gap-3 transition-opacity duration-300 ${loadingStep >= 2 ? 'opacity-100' : 'opacity-0'}`}>
                         {loadingStep > 2 ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <div className="w-5 h-5 border-2 border-slate-600 border-t-indigo-500 rounded-full animate-spin" />}
                        <span className={`text-sm ${loadingStep > 2 ? 'text-emerald-400' : 'text-slate-300'}`}>Establishing secure WebSocket tunnel...</span>
                    </div>
                </div>
                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${(loadingStep + 1) * 33}%` }}></div>
                </div>
            </div>
        ) : (
            <form onSubmit={handleLogin} className="space-y-5">
                <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Work Email</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Shield className="h-4 w-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                        </div>
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-lg block pl-10 p-2.5 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"
                            placeholder="operator@company.com" 
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Access Key / Password</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock className="h-4 w-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                        </div>
                        <input 
                            type="password" 
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-lg block pl-10 p-2.5 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"
                            placeholder="••••••••••••" 
                        />
                    </div>
                </div>

                <button 
                    type="submit" 
                    className="w-full flex justify-center items-center gap-2 text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20 font-medium rounded-lg text-sm px-5 py-3 transition-all transform active:scale-[0.98]"
                >
                    <Fingerprint className="w-5 h-5" />
                    Authenticate & Access Dashboard
                </button>
                
                <div className="flex items-center justify-between mt-4 text-xs text-slate-500 border-t border-slate-800 pt-4">
                     <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-emerald-500" /> AES-256 Encrypted</span>
                     <span className="hover:text-slate-300 cursor-pointer transition-colors">Forgot Key?</span>
                </div>
            </form>
        )}
      </div>
      
      <div className="mt-8 text-slate-600 text-xs text-center max-w-sm">
        By accessing this system, you agree to the corporate predictive maintenance data policy. All sensor data is processed via Google Gemini Cloud.
      </div>
    </div>
  );
};

export default AuthScreen;