import React, { useState, useEffect } from 'react';
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
  LogOut
} from 'lucide-react';
import { Machine, MachineStatus, Alert } from './types';
import MachineModel from './components/MachineModel';
import AuthScreen from './components/AuthScreen';
import MachineWizard from './components/MachineWizard';
import { pipeline } from './services/pipeline';

type ViewState = 'dashboard' | 'alerts' | 'machines' | 'settings';

const App = () => {
  // Auth State (persisted in session storage)
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
      return sessionStorage.getItem('sentinai_auth') === 'true';
  });
  
  // App State
  const [machines, setMachines] = useState<Machine[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [showWizard, setShowWizard] = useState(false);

  const handleLogin = () => {
      sessionStorage.setItem('sentinai_auth', 'true');
      setIsAuthenticated(true);
  };

  const handleLogout = () => {
      sessionStorage.removeItem('sentinai_auth');
      setIsAuthenticated(false);
      pipeline.stop();
  };

  // Initialize Pipeline Subscription
  useEffect(() => {
    if (isAuthenticated) {
        // Start the backend pipeline only after login
        pipeline.start();

        // Subscribe to real-time updates
        const unsubscribe = pipeline.subscribe((updatedMachines, updatedAlerts) => {
            setMachines(updatedMachines);
            setAlerts(updatedAlerts);
            
            // Update selected machine state live if modal is open
            setSelectedMachine(currentSelection => {
                if (!currentSelection) return null;
                return updatedMachines.find(m => m.id === currentSelection.id) || currentSelection;
            });
        });

        // Cleanup on unmount or logout
        return () => {
            unsubscribe();
            pipeline.stop();
        };
    }
  }, [isAuthenticated]);

  const getStatusColor = (status: MachineStatus) => {
    switch (status) {
      case MachineStatus.NORMAL: return 'bg-emerald-500';
      case MachineStatus.WARNING: return 'bg-amber-500';
      case MachineStatus.CRITICAL: return 'bg-rose-500';
      default: return 'bg-slate-500';
    }
  };

  const filteredMachines = machines.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // -- Render Helpers --

  const renderStatsRow = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-slate-400 text-sm font-medium">Total Machines</h3>
            <div className="text-3xl font-bold text-white mt-2">{machines.length}</div>
            <div className="text-emerald-500 text-xs mt-2 flex items-center gap-1">
                <Activity className="w-3 h-3" /> 100% Online
            </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-slate-400 text-sm font-medium">Critical Issues</h3>
            <div className="text-3xl font-bold text-white mt-2">
                {machines.filter(m => m.status === MachineStatus.CRITICAL).length}
            </div>
            <div className="text-rose-500 text-xs mt-2">Requires Attention</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-slate-400 text-sm font-medium">Avg Efficiency</h3>
            <div className="text-3xl font-bold text-white mt-2">94.2%</div>
            <div className="text-slate-500 text-xs mt-2">Target: 92%</div>
        </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-slate-400 text-sm font-medium">Power Usage</h3>
            <div className="text-3xl font-bold text-white mt-2">452 <span className="text-lg text-slate-500 font-normal">kW</span></div>
            <div className="text-amber-500 text-xs mt-2">+2.4% vs last hour</div>
        </div>
    </div>
  );

  const renderMachineGrid = (machineList: Machine[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {machineList.map(machine => {
            const latest = machine.history[machine.history.length - 1];
            return (
                <div 
                    key={machine.id}
                    onClick={() => setSelectedMachine(machine)}
                    className={`group bg-slate-900 border rounded-xl p-5 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl ${
                        machine.status === MachineStatus.CRITICAL ? 'border-rose-500/50 shadow-rose-500/10' :
                        machine.status === MachineStatus.WARNING ? 'border-amber-500/50 shadow-amber-500/10' :
                        'border-slate-800 hover:border-indigo-500/50'
                    }`}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="font-bold text-lg text-white group-hover:text-indigo-400 transition-colors">{machine.name}</h3>
                            <p className="text-xs text-slate-500">{machine.type} • {machine.location}</p>
                        </div>
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                            machine.status === MachineStatus.NORMAL ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-400' :
                            machine.status === MachineStatus.WARNING ? 'bg-amber-950/50 border-amber-500/30 text-amber-400' :
                            'bg-rose-950/50 border-rose-500/30 text-rose-400 animate-pulse'
                        }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(machine.status)}`} />
                            {machine.status}
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-slate-950 p-2 rounded border border-slate-800">
                            <div className="text-[10px] text-slate-500 uppercase">Vibration</div>
                            <div className={`text-sm font-mono font-medium ${latest?.vibration > 6 ? 'text-rose-400' : 'text-slate-200'}`}>
                                {latest?.vibration.toFixed(2)} mm/s
                            </div>
                        </div>
                        <div className="bg-slate-950 p-2 rounded border border-slate-800">
                            <div className="text-[10px] text-slate-500 uppercase">Temp</div>
                            <div className={`text-sm font-mono font-medium ${latest?.temperature > 85 ? 'text-rose-400' : 'text-slate-200'}`}>
                                {latest?.temperature.toFixed(1)} °C
                            </div>
                        </div>
                        <div className="bg-slate-950 p-2 rounded border border-slate-800">
                            <div className="text-[10px] text-slate-500 uppercase">Noise</div>
                            <div className="text-sm font-mono font-medium text-slate-200">
                                {latest?.noise.toFixed(0)} dB
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-800 pt-3">
                        <span>Maintained: {machine.lastMaintenance}</span>
                        <span className="text-indigo-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                            View Analytics &rarr;
                        </span>
                    </div>
                </div>
            );
        })}
        {/* Add Machine Card */}
        <div 
            onClick={() => setShowWizard(true)}
            className="group bg-slate-900/50 border border-slate-800 border-dashed rounded-xl p-5 cursor-pointer hover:bg-slate-800/80 hover:border-indigo-500/50 transition-all flex flex-col items-center justify-center min-h-[220px]"
        >
            <div className="w-16 h-16 rounded-full bg-slate-800 group-hover:bg-indigo-600/20 flex items-center justify-center transition-colors mb-4">
                <Plus className="w-8 h-8 text-slate-400 group-hover:text-indigo-500" />
            </div>
            <h3 className="font-semibold text-white">Add New Asset</h3>
            <p className="text-xs text-slate-500 mt-1">Configure & Pair Device</p>
        </div>
    </div>
  );

  const renderAlertsTable = (limit?: number) => {
    const displayAlerts = limit ? alerts.slice(0, limit) : alerts;
    
    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                <h3 className="font-semibold text-white">System Alert Log</h3>
                <div className="flex gap-2">
                    <button className="p-1.5 hover:bg-slate-800 rounded text-slate-400">
                        <Filter className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 hover:bg-slate-800 rounded text-slate-400">
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-950 text-slate-500">
                    <tr>
                        <th className="px-6 py-3 font-medium">Time</th>
                        <th className="px-6 py-3 font-medium">Machine</th>
                        <th className="px-6 py-3 font-medium">Severity</th>
                        <th className="px-6 py-3 font-medium">Message</th>
                        <th className="px-6 py-3 font-medium">Value</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {displayAlerts.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                No active alerts. Systems normal.
                            </td>
                        </tr>
                    ) : (
                        displayAlerts.map(alert => (
                            <tr key={alert.id} className="hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                                    {new Date(alert.timestamp).toLocaleTimeString()}
                                </td>
                                <td className="px-6 py-4 font-medium text-slate-200">
                                    {alert.machineName}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                        alert.severity === 'high' ? 'bg-rose-500/20 text-rose-400' : 
                                        alert.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                                    }`}>
                                        {alert.severity}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-slate-300">
                                    {alert.message}
                                </td>
                                <td className="px-6 py-4 font-mono text-slate-400">
                                    {alert.value?.toFixed(2)}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
            {limit && alerts.length > limit && (
                <div className="p-3 text-center border-t border-slate-800">
                    <button 
                        onClick={() => setActiveView('alerts')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
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
        onClick={() => setActiveView(view)}
        className={`flex items-center gap-3 w-full p-3 rounded-lg transition-colors ${
            activeView === view 
            ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20' 
            : 'hover:bg-slate-800 text-slate-400 border border-transparent'
        }`}
    >
        <Icon className="w-5 h-5" />
        {isSidebarOpen && <span className="font-medium">{label}</span>}
    </button>
  );

  // If not authenticated, show Auth Screen
  if (!isAuthenticated) {
      return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-slate-900 border-r border-slate-800 flex flex-col z-20`}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
           <Factory className="w-8 h-8 text-indigo-500 shrink-0" />
           {isSidebarOpen && <span className="font-bold text-xl tracking-tight text-white">Sentin<span className="text-indigo-500">AI</span></span>}
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
           <NavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
           <NavItem view="alerts" icon={AlertOctagon} label="Alerts" />
           <NavItem view="machines" icon={Cpu} label="Machines" />
           <NavItem view="settings" icon={Settings} label="Settings" />
        </nav>

        <div className="p-4 border-t border-slate-800">
            <button 
                onClick={handleLogout}
                className="flex items-center gap-3 w-full p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800/50 rounded-lg transition-colors mb-4"
            >
                <LogOut className="w-5 h-5" />
                {isSidebarOpen && <span className="text-sm">Sign Out</span>}
            </button>
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-xs">
                    OP
                </div>
                {isSidebarOpen && (
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-white">Operator A.</span>
                        <span className="text-xs text-slate-500">Floor Manager</span>
                    </div>
                )}
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Top Header */}
        <header className="h-16 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 z-10">
           <div className="flex items-center gap-4">
               <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
                  <Menu className="w-5 h-5" />
               </button>
               <h1 className="text-lg font-semibold text-white capitalize">{activeView}</h1>
           </div>

           <div className="flex items-center gap-6">
              <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                 <input 
                    type="text" 
                    placeholder="Search Machine ID..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 w-64 transition-all"
                 />
              </div>
              <div className="relative">
                 <Bell className="w-5 h-5 text-slate-400 hover:text-white cursor-pointer" />
                 {alerts.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold animate-pulse">
                        {alerts.length}
                    </span>
                 )}
              </div>
              <button 
                onClick={() => setShowWizard(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                  <Plus className="w-4 h-4" /> Add Machine
              </button>
           </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-y-auto p-6">
            
            {/* DASHBOARD VIEW */}
            {activeView === 'dashboard' && (
                <div className="space-y-6">
                    {renderStatsRow()}
                    
                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                        Floor Overview 
                        <span className="text-xs font-normal text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                            Live Pipeline Active
                        </span>
                    </h2>
                    
                    {renderMachineGrid(filteredMachines)}
                    {renderAlertsTable(5)}
                </div>
            )}

            {/* MACHINES VIEW */}
            {activeView === 'machines' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-white">Machine Registry</h2>
                        <span className="text-slate-400 text-sm">{filteredMachines.length} Units Online</span>
                    </div>
                    {renderMachineGrid(filteredMachines)}
                </div>
            )}

            {/* ALERTS VIEW */}
            {activeView === 'alerts' && (
                <div className="space-y-6">
                     <h2 className="text-2xl font-bold text-white mb-4">System Alerts History</h2>
                     {renderAlertsTable()}
                </div>
            )}

            {/* SETTINGS VIEW */}
            {activeView === 'settings' && (
                <div className="max-w-4xl mx-auto space-y-8">
                    <h2 className="text-2xl font-bold text-white">Platform Settings</h2>
                    
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <User className="w-5 h-5 text-indigo-400" /> User Profile
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Display Name</label>
                                <input type="text" defaultValue="Operator A." className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Role</label>
                                <input type="text" defaultValue="Floor Manager" disabled className="w-full bg-slate-950/50 border border-slate-800 rounded p-2 text-slate-500 cursor-not-allowed" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Shield className="w-5 h-5 text-emerald-400" /> System Thresholds
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-slate-950 rounded border border-slate-800">
                                <div>
                                    <div className="text-sm font-medium text-white">Global Vibration Warning</div>
                                    <div className="text-xs text-slate-500">Trigger warning when mm/s exceeds this value</div>
                                </div>
                                <input type="number" defaultValue={5.0} className="w-20 bg-slate-900 border border-slate-700 rounded p-1 text-center text-white" />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-slate-950 rounded border border-slate-800">
                                <div>
                                    <div className="text-sm font-medium text-white">Global Temperature Warning</div>
                                    <div className="text-xs text-slate-500">Trigger warning when celsius exceeds this value</div>
                                </div>
                                <input type="number" defaultValue={85} className="w-20 bg-slate-900 border border-slate-700 rounded p-1 text-center text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                            <Settings className="w-5 h-5 text-slate-400" /> Notifications
                        </h3>
                        <div className="space-y-3">
                             <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900" />
                                <span className="text-sm text-slate-300">Email alerts for Critical status</span>
                             </label>
                             <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900" />
                                <span className="text-sm text-slate-300">SMS alerts for Critical status</span>
                             </label>
                        </div>
                    </div>
                </div>
            )}

        </div>
      </main>

      {/* Modals */}
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