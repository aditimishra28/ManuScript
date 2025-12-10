import React from 'react';
import { Machine, MachineStatus } from '../types';

interface MachineCardProps {
  machine: Machine;
  onClick: (machine: Machine) => void;
}

const getStatusColor = (status: MachineStatus) => {
  switch (status) {
    case MachineStatus.NORMAL: return 'bg-emerald-500';
    case MachineStatus.WARNING: return 'bg-amber-500';
    case MachineStatus.CRITICAL: return 'bg-rose-500';
    default: return 'bg-slate-500';
  }
};

export const MachineCard: React.FC<MachineCardProps> = React.memo(({ machine, onClick }) => {
  const latest = machine.history[machine.history.length - 1];

  return (
    <div 
        onClick={() => onClick(machine)}
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
                    {latest?.vibration.toFixed(2)} <span className="text-[10px] text-slate-600">mm/s</span>
                </div>
            </div>
            <div className="bg-slate-950 p-2 rounded border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">Temp</div>
                <div className={`text-sm font-mono font-medium ${latest?.temperature > 85 ? 'text-rose-400' : 'text-slate-200'}`}>
                    {latest?.temperature.toFixed(1)} <span className="text-[10px] text-slate-600">°C</span>
                </div>
            </div>
            <div className="bg-slate-950 p-2 rounded border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">Noise</div>
                <div className="text-sm font-mono font-medium text-slate-200">
                    {latest?.noise.toFixed(0)} <span className="text-[10px] text-slate-600">dB</span>
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
}, (prev, next) => {
    // Only re-render if status or specific readings change significantly to save performance
    // However, for the grid to look "live", we often want updates. 
    // We'll strict compare the history length to ensure we catch new ticks.
    return prev.machine.history === next.machine.history && prev.machine.status === next.machine.status;
});