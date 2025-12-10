import React, { useState } from 'react';
import { Shield, Lock, Factory, Server, Key } from 'lucide-react';

interface AuthScreenProps {
  onLogin: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gateway, setGateway] = useState('us-east-1.sentinai.cloud');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    
    // Simulate network handshake only (much faster than before)
    setTimeout(() => {
        setIsConnecting(false);
        onLogin();
    }, 800);
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
                <p className="text-slate-500 text-xs">IIoT Fleet Manager v2.4.1</p>
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
                        placeholder="id@corp.local" 
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
                        placeholder="••••••••••••" 
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Gateway Endpoint</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Server className="h-4 w-4 text-slate-500" />
                    </div>
                    <select 
                        value={gateway}
                        onChange={(e) => setGateway(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded block pl-10 p-2.5 focus:border-indigo-500 outline-none appearance-none cursor-pointer"
                    >
                        <option value="us-east-1.sentinai.cloud">US-East-1 (Ohio) - MQTT/WSS</option>
                        <option value="eu-west-1.sentinai.cloud">EU-West-1 (Ireland) - MQTT/WSS</option>
                        <option value="ap-northeast.sentinai.cloud">AP-Northeast (Tokyo) - MQTT/WSS</option>
                    </select>
                </div>
            </div>

            <button 
                type="submit" 
                disabled={isConnecting}
                className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded text-sm px-5 py-3 transition-colors flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {isConnecting ? (
                    <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Handshaking...
                    </>
                ) : (
                    <>
                        <Lock className="w-4 h-4" /> Connect to Gateway
                    </>
                )}
            </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <p className="text-[10px] text-slate-600">
                Client Session ID: {Math.random().toString(36).substring(7).toUpperCase()} <br/>
                Authorized use only. All telemetry is logged.
            </p>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;