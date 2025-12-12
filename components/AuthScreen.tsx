import React, { useState } from 'react';
import { Shield, Lock, Factory, Key, Mail, User, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { SecurityContext } from '../services/securityLayer';

// Asset Reference - Using remote high-res assets for reliability
const cardBg = "https://images.unsplash.com/photo-1558494949-ef526b0042a0?auto=format&fit=crop&q=80&w=2000";
const thumbnailImg = "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=100&h=100";

interface AuthScreenProps {
  onLogin: () => void;
}

type AuthMode = 'login' | 'signup';

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [formData, setFormData] = useState({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      rememberMe: false
  });

  const handleChange = (field: string, value: any) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      setError(''); // Clear error on typing
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSuccessMsg('');
      setIsLoading(true);

      // Simulate network delay for realism
      await new Promise(resolve => setTimeout(resolve, 800));

      if (mode === 'signup') {
          // Validation
          if (formData.password !== formData.confirmPassword) {
              setError("Passwords do not match");
              setIsLoading(false);
              return;
          }
          if (formData.password.length < 6) {
              setError("Password must be at least 6 characters");
              setIsLoading(false);
              return;
          }

          const result = SecurityContext.register(formData.email, formData.password, formData.name);
          if (result.success) {
              setSuccessMsg("Account created successfully. Logging you in...");
              // Auto login after signup
              setTimeout(() => {
                   SecurityContext.login(formData.email, formData.password, false);
                   onLogin();
              }, 1000);
          } else {
              setError(result.message || "Registration failed");
              setIsLoading(false);
          }
      } else {
          // Login Mode
          const result = SecurityContext.login(formData.email, formData.password, formData.rememberMe);
          if (result.success) {
              onLogin();
          } else {
              setError(result.message || "Authentication failed");
              setIsLoading(false);
          }
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black flex font-sans overflow-hidden relative transition-colors duration-300">
      
      {/* LEFT SIDE - Branding & Visuals (Hidden on small mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 bg-navy-950 dark:bg-black overflow-hidden text-white">
        
        {/* Featured Card Background */}
        <div className="absolute inset-0 z-0">
             <img src={cardBg} className="w-full h-full object-cover opacity-60" alt="Background" />
             <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/70 to-transparent"></div>
        </div>
        
        {/* Animated Background Mesh */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
             <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900 via-navy-950 to-black"></div>
             <div className="absolute -bottom-1/2 -left-1/2 w-full h-full border-[100px] border-blue-500/10 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10">
             <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg border border-white/10 bg-white/5">
                    <img src={thumbnailImg} className="w-full h-full object-cover" alt="Logo" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">ManuScript<span className="text-blue-400">.ai</span></h1>
                    <p className="text-[10px] text-blue-200 font-medium tracking-wider uppercase">Powered by Google Gemini</p>
                </div>
             </div>
             
             <div className="mt-20">
                <h2 className="text-4xl font-bold text-white mb-6 leading-tight">
                    Predictive Intelligence for <br/> 
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-blue-500">Mission Critical Assets</span>
                </h2>
                <p className="text-blue-100 text-lg max-w-md leading-relaxed">
                    Deploy Gemini-powered anomaly detection on your factory floor. 
                    Prevent downtime before it happens with real-time telemetry analysis.
                </p>
             </div>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-6 mt-12">
            <div className="bg-white/10 backdrop-blur border border-white/10 p-4 rounded-xl">
                <div className="text-2xl font-bold text-white mb-1">99.9%</div>
                <div className="text-xs text-blue-200 uppercase tracking-wide">Uptime Guaranteed</div>
            </div>
             <div className="bg-white/10 backdrop-blur border border-white/10 p-4 rounded-xl">
                <div className="text-2xl font-bold text-white mb-1">&lt; 50ms</div>
                <div className="text-xs text-blue-200 uppercase tracking-wide">Latency</div>
            </div>
        </div>

        <div className="relative z-10 text-xs text-blue-400 mt-auto">
            &copy; 2024 ManuScript.ai Industrial Solutions. Enterprise Edition v2.5
        </div>
      </div>

      {/* RIGHT SIDE - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative">
         <div className="absolute inset-0 bg-slate-100 dark:bg-black lg:hidden"></div>
         
         <div className="w-full max-w-md bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-2xl shadow-xl p-8 relative z-20">
            
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-blue-950 dark:text-white mb-2">
                    {mode === 'login' ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="text-slate-500 text-sm">
                    {mode === 'login' ? 'Enter your credentials to access the dashboard.' : 'Register your operator ID to begin monitoring.'}
                </p>
            </div>

            {error && (
                <div className="mb-6 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/20 rounded-lg p-3 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-rose-700 dark:text-rose-200">{error}</p>
                </div>
            )}

            {successMsg && (
                <div className="mb-6 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 rounded-lg p-3 flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-emerald-700 dark:text-emerald-200">{successMsg}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                
                {mode === 'signup' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="text"
                                required={mode === 'signup'}
                                placeholder="John Doe"
                                value={formData.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg py-2.5 pl-10 pr-4 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="email"
                            required
                            placeholder="operator@company.com"
                            value={formData.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg py-2.5 pl-10 pr-4 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
                    <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="password"
                            required
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={(e) => handleChange('password', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg py-2.5 pl-10 pr-4 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>
                </div>

                {mode === 'signup' && (
                     <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Confirm Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="password"
                                required={mode === 'signup'}
                                placeholder="••••••••"
                                value={formData.confirmPassword}
                                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                                className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg py-2.5 pl-10 pr-4 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                )}

                {mode === 'login' && (
                    <div className="flex items-center justify-between pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={formData.rememberMe}
                                onChange={(e) => handleChange('rememberMe', e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-slate-900 dark:text-white focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-500 select-none">Remember me</span>
                        </label>
                        <button type="button" className="text-xs text-slate-500 hover:text-blue-950 dark:hover:text-white">
                            Forgot Password?
                        </button>
                    </div>
                )}

                <button 
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-blue-950 dark:bg-white hover:bg-blue-900 dark:hover:bg-slate-200 text-white dark:text-navy-950 font-semibold rounded-lg py-3 mt-6 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <>
                           {mode === 'login' ? 'Sign In' : 'Create Account'} 
                           <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </form>

            <div className="mt-8 text-center border-t border-slate-200 dark:border-navy-800 pt-6">
                <p className="text-sm text-slate-500">
                    {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
                    <button 
                        onClick={() => {
                            setMode(mode === 'login' ? 'signup' : 'login');
                            setError('');
                            setSuccessMsg('');
                        }}
                        className="ml-2 text-blue-950 dark:text-white font-medium transition-colors"
                    >
                        {mode === 'login' ? 'Sign up' : 'Log in'}
                    </button>
                </p>
            </div>

         </div>
      </div>
    </div>
  );
};

export default AuthScreen;