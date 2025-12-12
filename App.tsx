import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  AlertOctagon, 
  LayoutDashboard, 
  Settings, 
  Cpu, 
  Search, 
  Bell,
  Menu,
  Factory,
  Filter,
  Download,
  Shield,
  User,
  Plus,
  Info,
  Wifi,
  WifiOff,
  Lock,
  X,
  Moon,
  Sun
} from 'lucide-react';
import { Machine, MachineStatus, Alert } from './types';
import MachineModel from './components/MachineModel';
import MachineWizard from './components/MachineWizard';
import { pipeline } from './services/pipeline';
import { MachineCard } from './components/MachineCard';

// Asset Reference - Remote URL to ensure stability
const thumbnailImg = "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=100&h=100";

type ViewState = 'dashboard' | 'alerts' | 'machines' | 'settings';
type Theme = 'dark' | 'light';

const App = () => {
  // Theme State
  const [theme, setTheme] = useState<Theme>(() => {
      return (localStorage.getItem('theme') as Theme) || 'dark';
  });

  // App State
  const [machines, setMachines] = useState<Machine[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLiveConnection, setIsLiveConnection] = useState(false);
  
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  
  // UI State
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  
  // Modal State
  const [showWizard, setShowWizard] = useState(false);

  // User info state - Default to Admin/Operator since auth is removed
  const [currentUser, setCurrentUser] = useState({ name: 'Senior Operator', role: 'Admin' });

  // Apply Theme Effect
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
        root.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    } else {
        root.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => {
      setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Initialize Pipeline Subscription
  useEffect(() => {
      pipeline.start();
      const unsubscribe = pipeline.subscribe((updatedMachines, updatedAlerts, isLive) => {
          setMachines(updatedMachines);
          setAlerts(updatedAlerts);
          setIsLiveConnection(isLive);
          setSelectedMachine(currentSelection => {
              if (!currentSelection) return null;
              return updatedMachines.find(m => m.id === currentSelection.id) || currentSelection;
          });
      });
      return () => {
          unsubscribe();
          pipeline.stop();
      };
  }, []);

  // Handle Mobile Sidebar
  useEffect(() => {
      const handleResize = () => {
          if (window.innerWidth < 1024) {
              setSidebarOpen(false);
          } else {
              setSidebarOpen(true);
          }
      };
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  const filteredMachines = useMemo(() => {
    const lowerTerm = searchTerm.toLowerCase();
    return machines.filter(m => 
        m.name.toLowerCase().includes(lowerTerm) || 
        m.id.toLowerCase().includes(lowerTerm)
    );
  }, [machines, searchTerm]);

  const stats = useMemo(() => {
    const total = machines.length;
    const criticalCount = machines.filter(m => m.status === MachineStatus.CRITICAL).length;
    const warningCount = machines.filter(m => m.status === MachineStatus.WARNING).length;
    const offlineCount = machines.filter(m => m.status === MachineStatus.OFFLINE).length;
    
    // Dynamic Efficiency Calculation
    let calculatedEfficiency = 100;
    if (total > 0) {
        const penalty = (criticalCount * 30 + warningCount * 10 + offlineCount * 100) / total;
        calculatedEfficiency = Math.max(0, 100 - penalty);
    } else {
        calculatedEfficiency = 100;
    }

    const totalPower = machines.reduce((acc, m) => {
        const lastReading = m.history[m.history.length - 1];
        return acc + (lastReading?.powerUsage || 0);
    }, 0);

    return {
        total,
        critical: criticalCount,
        power: Math.round(totalPower),
        efficiency: calculatedEfficiency.toFixed(1)
    };
  }, [machines]);

  const renderStatsRow = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        <div className="bg-white dark:bg-navy-950 border border-gray-200 dark:border-navy-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-gray-500 dark:text-slate-400 text-sm font-medium">Total Machines</h3>
            <div className="text-3xl font-bold text-blue-950 dark:text-white mt-2">{stats.total}</div>
            <div className="text-emerald-600 dark:text-emerald-500 text-xs mt-2 flex items-center gap-1">
                <Activity className="w-3 h-3" /> 100% Online
            </div>
        </div>
        <div className="bg-white dark:bg-navy-950 border border-gray-200 dark:border-navy-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-gray-500 dark:text-slate-400 text-sm font-medium">Critical Issues</h3>
            <div className="text-3xl font-bold text-blue-950 dark:text-white mt-2">
                {stats.critical}
            </div>
            <div className={`text-xs mt-2 ${stats.critical > 0 ? 'text-rose-600 dark:text-rose-500 font-bold animate-pulse' : 'text-gray-500 dark:text-slate-500'}`}>
                {stats.critical > 0 ? 'Requires Immediate Attention' : 'Systems Nominal'}
            </div>
        </div>
        <div className="bg-white dark:bg-navy-950 border border-gray-200 dark:border-navy-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-gray-500 dark:text-slate-400 text-sm font-medium">Global Efficiency</h3>
            <div className="text-3xl font-bold text-blue-950 dark:text-white mt-2">{stats.efficiency}%</div>
            <div className="text-gray-500 dark:text-slate-500 text-xs mt-2">Target: 96%</div>
        </div>
            <div className="bg-white dark:bg-navy-950 border border-gray-200 dark:border-navy-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-gray-500 dark:text-slate-400 text-sm font-medium">Power Usage</h3>
            <div className="text-3xl font-bold text-blue-950 dark:text-white mt-2">{stats.power} <span className="text-lg text-gray-400 dark:text-slate-500 font-normal">kW</span></div>
            <div className="text-amber-600 dark:text-amber-500 text-xs mt-2">+2.4% vs last hour</div>
        </div>
    </div>
  );

  const renderMachineGrid = (machineList: Machine[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {machineList.map(machine => (
            <MachineCard 
                key={machine.id} 
                machine={machine} 
                onClick={setSelectedMachine} 
            />
        ))}
        <div 
            onClick={() => setShowWizard(true)}
            className="group bg-white dark:bg-navy-900/30 border border-gray-200 dark:border-navy-800 border-dashed rounded-xl p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-navy-900 hover:border-blue-400 dark:hover:border-blue-500 transition-all flex flex-col items-center justify-center min-h-[220px]"
        >
            <div className="w-16 h-16 rounded-full bg-gray-50 dark:bg-navy-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900 flex items-center justify-center transition-colors mb-4 border border-gray-100 dark:border-navy-700">
                <Plus className="w-8 h-8 text-gray-400 dark:text-slate-400 group-hover:text-blue-700 dark:group-hover:text-blue-300" />
            </div>
            <h3 className="font-semibold text-blue-950 dark:text-white">Add New Asset</h3>
            <p className="text-xs text-gray-500 mt-1">Configure & Pair Device</p>
        </div>
    </div>
  );

  const renderAlertsTable = (limit?: number) => {
    const displayAlerts = limit ? alerts.slice(0, limit) : alerts;
    return (
        <div className="bg-white dark:bg-navy-950 border border-gray-200 dark:border-navy-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-navy-800 flex justify-between items-center">
                <h3 className="font-semibold text-blue-950 dark:text-white">System Alert Log</h3>
                <div className="flex gap-2">
                    <button className="p-1.5 hover:bg-gray-50 dark:hover:bg-navy-800 rounded text-gray-500 dark:text-slate-400 border border-transparent hover:border-gray-200 dark:hover:border-navy-700">
                        <Filter className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 hover:bg-gray-50 dark:hover:bg-navy-800 rounded text-gray-500 dark:text-slate-400 border border-transparent hover:border-gray-200 dark:hover:border-navy-700">
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-navy-900 text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-navy-800">
                        <tr>
                            <th className="px-6 py-3 font-medium">Time</th>
                            <th className="px-6 py-3 font-medium">Machine</th>
                            <th className="px-6 py-3 font-medium">Severity</th>
                            <th className="px-6 py-3 font-medium">Message</th>
                            <th className="px-6 py-3 font-medium">Value</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-navy-800">
                        {displayAlerts.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                    No active alerts. Systems normal.
                                </td>
                            </tr>
                        ) : (
                            displayAlerts.map(alert => (
                                <tr key={alert.id} className="hover:bg-gray-50 dark:hover:bg-navy-900/50 transition-colors">
                                    <td className="px-6 py-4 text-gray-600 dark:text-slate-400 whitespace-nowrap">
                                        {new Date(alert.timestamp).toLocaleTimeString()}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-blue-950 dark:text-white">
                                        {alert.machineName}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                            alert.severity === 'high' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' : 
                                            alert.severity === 'medium' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                        }`}>
                                            {alert.severity}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-slate-300">
                                        {alert.message}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-gray-500 dark:text-slate-400">
                                        {alert.value?.toFixed(2)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {limit && alerts.length > limit && (
                <div className="p-3 text-center border-t border-gray-200 dark:border-navy-800">
                    <button 
                        onClick={() => setActiveView('alerts')}
                        className="text-xs text-blue-950 dark:text-blue-400 hover:text-blue-700 dark:hover:text-white font-bold uppercase"
                    >
                        View All {alerts.length} Alerts
                    </button>
                </div>
            )}
        </div>
    );
  };

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState; icon: any; label: string }) => (
    <button 
        onClick={() => {
            setActiveView(view);
            if (window.innerWidth < 1024) setSidebarOpen(false);
        }}
        className={`flex items-center gap-3 w-full p-3 rounded-lg transition-colors ${
            activeView === view 
            ? 'bg-blue-50 dark:bg-navy-800 text-blue-950 dark:text-white font-semibold' 
            : 'hover:bg-gray-100 dark:hover:bg-navy-900 text-gray-600 dark:text-slate-400'
        }`}
    >
        <Icon className="w-5 h-5" />
        {(isSidebarOpen || window.innerWidth < 1024) && <span>{label}</span>}
    </button>
  );

  return (
    <div className="flex h-screen bg-white dark:bg-black text-gray-900 dark:text-slate-200 overflow-hidden font-sans transition-colors duration-300">
      
      {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/20 z-20 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-30 bg-white dark:bg-navy-950 border-r border-gray-200 dark:border-navy-800 flex flex-col transition-all duration-300 ${
          isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0 lg:w-20'
      }`}>
        <div className="p-6 border-b border-gray-200 dark:border-navy-800 flex justify-between items-center">
           <div className="flex items-center gap-3">
               <img src={thumbnailImg} alt="ManuScript" className="w-8 h-8 shrink-0 rounded-lg" />
               {(isSidebarOpen) && (
                   <div>
                       <span className="font-bold text-xl tracking-tight text-blue-950 dark:text-white">ManuScript <span className="text-xs text-gray-400 font-normal">powered by google gemini</span></span>
                   </div>
               )}
           </div>
           <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400"><X className="w-6 h-6" /></button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
           <NavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
           <NavItem view="alerts" icon={AlertOctagon} label="Alerts" />
           <NavItem view="machines" icon={Cpu} label="Machines" />
           <NavItem view="settings" icon={Settings} label="Settings" />
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-navy-800">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-950 dark:bg-white flex items-center justify-center text-white dark:text-navy-950 font-bold text-xs uppercase shrink-0">
                    {currentUser.name.charAt(0)}
                </div>
                {isSidebarOpen && (
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-medium text-blue-950 dark:text-white truncate">{currentUser.name}</span>
                        <span className="text-xs text-gray-500">{currentUser.role} Session</span>
                    </div>
                )}
            </div>
        </div>
      </aside>

      <main className={`flex-1 flex flex-col overflow-hidden relative transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        
        <header className="h-16 bg-white/80 dark:bg-navy-950/80 backdrop-blur-md border-b border-gray-200 dark:border-navy-800 flex items-center justify-between px-6 z-10 sticky top-0">
           <div className="flex items-center gap-4">
               <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 dark:hover:bg-navy-800 rounded-lg text-gray-500 dark:text-slate-400">
                  <Menu className="w-5 h-5" />
               </button>
               <h1 className="text-lg font-semibold text-blue-950 dark:text-white capitalize truncate">{activeView}</h1>
           </div>

           <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-gray-50 dark:bg-navy-900 rounded-full border border-gray-200 dark:border-navy-700">
                  <Lock className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] text-gray-500 dark:text-slate-400">End-to-End Encrypted</span>
              </div>

              <div className="relative hidden sm:block">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 <input 
                    type="text" 
                    placeholder="Search ID..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-full pl-10 pr-4 py-2 text-sm text-blue-950 dark:text-white focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 w-48 xl:w-64 transition-all"
                 />
              </div>
              
              <div className="relative">
                 <button 
                    onClick={() => setNotificationsOpen(!isNotificationsOpen)}
                    className="relative p-1 rounded-full hover:bg-gray-100 dark:hover:bg-navy-800 transition-colors focus:outline-none"
                 >
                    <Bell className="w-5 h-5 text-gray-500 dark:text-slate-400 hover:text-blue-950 dark:hover:text-white" />
                    {alerts.length > 0 && (
                        <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold animate-pulse">
                            {alerts.length}
                        </span>
                    )}
                 </button>

                 {isNotificationsOpen && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setNotificationsOpen(false)}></div>
                        <div className="absolute top-10 right-0 w-80 bg-white dark:bg-navy-950 border border-gray-200 dark:border-navy-800 rounded-xl shadow-2xl z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-3 border-b border-gray-200 dark:border-navy-800 flex justify-between items-center bg-gray-50 dark:bg-navy-900">
                                <h3 className="font-semibold text-blue-950 dark:text-white text-sm">Notifications</h3>
                                <span className="text-xs text-gray-500">{alerts.length} Total</span>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto">
                                {alerts.length === 0 ? (
                                    <div className="p-6 text-center text-gray-500 text-sm">No new alerts</div>
                                ) : (
                                    alerts.slice(0, 5).map(alert => (
                                        <div key={alert.id} className="p-3 border-b border-gray-100 dark:border-navy-800/50 hover:bg-gray-50 dark:hover:bg-navy-900 transition-colors cursor-pointer" onClick={() => setActiveView('alerts')}>
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-medium text-gray-800 dark:text-slate-200 text-xs">{alert.machineName}</span>
                                                <span className="text-[10px] text-gray-500">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                                            </div>
                                            <p className="text-xs text-gray-600 dark:text-slate-400 line-clamp-2">{alert.message}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="p-2 bg-gray-50 dark:bg-navy-900 border-t border-gray-200 dark:border-navy-800 text-center">
                                <button 
                                    onClick={() => { setActiveView('alerts'); setNotificationsOpen(false); }}
                                    className="text-xs text-blue-950 dark:text-white hover:text-blue-700 dark:hover:text-blue-300 font-bold uppercase w-full py-1"
                                >
                                    View All Alerts
                                </button>
                            </div>
                        </div>
                      </>
                 )}
              </div>

              <button 
                onClick={() => setShowWizard(true)}
                className="bg-blue-950 dark:bg-white hover:bg-blue-900 dark:hover:bg-slate-200 text-white dark:text-navy-950 text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shadow-md"
              >
                  <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Machine</span>
              </button>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-white dark:bg-black">
            
            {activeView === 'dashboard' && (
                <div className="space-y-6">
                    {renderStatsRow()}
                    
                    <h2 className="text-xl font-semibold text-blue-950 dark:text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            Floor Overview 
                            {!isLiveConnection && (
                                <span className="text-xs font-bold text-amber-600 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 px-3 py-1 rounded border border-amber-200 dark:border-amber-500/50 flex items-center gap-2 animate-pulse">
                                    <WifiOff className="w-3 h-3" /> 
                                    DEMO SIMULATION MODE
                                </span>
                            )}
                            {isLiveConnection && (
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 rounded border border-emerald-200 dark:border-emerald-500/50 flex items-center gap-2">
                                    <Wifi className="w-3 h-3" /> 
                                    LIVE TELEMETRY
                                </span>
                            )}
                        </div>
                    </h2>
                    
                    {renderMachineGrid(filteredMachines)}
                    {renderAlertsTable(5)}
                </div>
            )}

            {activeView === 'machines' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-blue-950 dark:text-white">Machine Registry</h2>
                        <span className="text-gray-500 dark:text-slate-400 text-sm">{filteredMachines.length} Units Online</span>
                    </div>
                    {renderMachineGrid(filteredMachines)}
                </div>
            )}

            {activeView === 'alerts' && (
                <div className="space-y-6">
                     <h2 className="text-2xl font-bold text-blue-950 dark:text-white mb-4">System Alerts History</h2>
                     {renderAlertsTable()}
                </div>
            )}

            {activeView === 'settings' && (
                <div className="max-w-4xl mx-auto space-y-8">
                    <h2 className="text-2xl font-bold text-blue-950 dark:text-white">Platform Settings</h2>
                    
                    <div className="bg-white dark:bg-navy-950 border border-gray-200 dark:border-navy-800 rounded-xl p-6 flex justify-between items-center shadow-sm">
                        <div>
                            <h3 className="text-lg font-semibold text-blue-950 dark:text-white flex items-center gap-2">
                                {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-500" />}
                                Appearance
                            </h3>
                            <p className="text-gray-500 text-sm mt-1">
                                {theme === 'dark' ? 'Using Dark Industrial Theme' : 'Using Light Clinical Theme'}
                            </p>
                        </div>
                        <button 
                            onClick={toggleTheme}
                            className="bg-gray-100 dark:bg-navy-800 text-gray-900 dark:text-white px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-navy-700 hover:bg-gray-200 dark:hover:bg-navy-700 transition-colors"
                        >
                            Toggle Theme
                        </button>
                    </div>

                    <div className="bg-white dark:bg-navy-950 border border-gray-200 dark:border-navy-800 rounded-xl p-6 space-y-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-blue-950 dark:text-white flex items-center gap-2">
                            <User className="w-5 h-5 text-gray-500" /> User Profile
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-500 mb-1">Display Name</label>
                                <input type="text" value={currentUser.name} readOnly className="w-full bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded p-2 text-gray-900 dark:text-white cursor-default" />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-500 mb-1">Role</label>
                                <input type="text" value={currentUser.role} disabled className="w-full bg-gray-50/50 dark:bg-navy-900/50 border border-gray-200 dark:border-navy-800 rounded p-2 text-gray-400 dark:text-slate-500 cursor-not-allowed" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-navy-950 border border-gray-200 dark:border-navy-800 rounded-xl p-6 space-y-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-blue-950 dark:text-white flex items-center gap-2">
                            <Shield className="w-5 h-5 text-emerald-500" /> System Thresholds
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-navy-900 rounded border border-gray-200 dark:border-navy-800">
                                <div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">Global Vibration Warning</div>
                                    <div className="text-xs text-gray-500">Trigger warning when mm/s exceeds this value</div>
                                </div>
                                <input type="number" defaultValue={5.0} className="w-20 bg-white dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded p-1 text-center text-gray-900 dark:text-white" />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-navy-900 rounded border border-gray-200 dark:border-navy-800">
                                <div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">Global Temperature Warning</div>
                                    <div className="text-xs text-gray-500">Trigger warning when celsius exceeds this value</div>
                                </div>
                                <input type="number" defaultValue={85} className="w-20 bg-white dark:bg-navy-950 border border-gray-200 dark:border-navy-700 rounded p-1 text-center text-gray-900 dark:text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-navy-950 border border-gray-200 dark:border-navy-800 rounded-xl p-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-blue-950 dark:text-white flex items-center gap-2 mb-4">
                            <Settings className="w-5 h-5 text-gray-400" /> Notifications
                        </h3>
                        <div className="space-y-3">
                             <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 dark:border-navy-700 bg-gray-50 dark:bg-navy-900 text-gray-900 dark:text-white focus:ring-blue-500" />
                                <span className="text-sm text-gray-600 dark:text-slate-300">Email alerts for Critical status</span>
                             </label>
                             <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 dark:border-navy-700 bg-gray-50 dark:bg-navy-900 text-gray-900 dark:text-white focus:ring-blue-500" />
                                <span className="text-sm text-gray-600 dark:text-slate-300">SMS alerts for Critical status</span>
                             </label>
                        </div>
                    </div>
                </div>
            )}

        </div>
      </main>

      {selectedMachine && (
        <MachineModel 
            machine={selectedMachine} 
            onClose={() => setSelectedMachine(null)} 
        />
      )}

      {showWizard && (
          <MachineWizard 
            onClose={() => setShowWizard(false)}
            onComplete={() => setShowWizard(false)}
          />
      )}

    </div>
  );
};

export default App;