import React, { useState } from 'react';
import { Shield, Lock, Factory, Server, Key, Info } from 'lucide-react';

interface AuthScreenProps {
  onLogin: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('demo@sentinai.cloud');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Simple local check for demo purposes
    if (email === 'demo@sentinai.cloud' && password === 'demo123') {
        onLogin();
    } else {
        setError('Invalid demo credentials. Try demo@sentinai.cloud / demo123');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-slate-950 to-slate-950"></div>
      
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-lg shadow-2xl p-8 relative z-10">
        
        <div className="flex items-center gap-3 mb-8 border-b border-slate-800 pb-6">
            <div className="p-2 bg-indigo-500 rounded-lg">
                <Factory className="w-6 h-6 text-white" />
            </div>
            <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Sentin<span className="text-indigo-500">AI</span> Enterprise</h1>
                <p className="text-slate-500 text-xs">Client-Side Simulation Environment</p>
            </div>
        </div>

        <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded mb-6 flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-200">
                <strong>Demo Mode:</strong> This environment uses deterministic physics engines to simulate IoT telemetry. No real machinery is connected.
            </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
            <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Operator ID</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Shield className="h-4 w-4 text-slate-500" />
                    </div>
                    <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded block pl-10 p-2.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors placeholder:text-slate-700"
                    />
                </div>
            </div>
            
            <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Access Key</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Key className="h-4 w-4 text-slate-500" />
                    </div>
                    <input 
                        type="password" 
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded block pl-10 p-2.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors placeholder:text-slate-700"
                    />
                </div>
            </div>

            {error && <p className="text-rose-400 text-xs">{error}</p>}

            <button 
                type="submit" 
                className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded text-sm px-5 py-3 transition-colors flex justify-center items-center gap-2"
            >
               <Lock className="w-4 h-4" /> Launch Simulation
            </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <p className="text-[10px] text-slate-600">
                Session ID: {Math.random().toString(36).substring(7).toUpperCase()} <br/>
                Data persistence is local to this browser instance.
            </p>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;