import React from 'react';
import { Machine, MachineStatus } from '../types';
import { Activity, Thermometer, Radio, Cpu } from 'lucide-react';

interface MachineCardProps {
  machine: Machine;
  onClick: (machine: Machine) => void;
}

const getStatusColor = (status: MachineStatus) => {
  switch (status) {
    case MachineStatus.NORMAL: return 'bg-emerald-500';
    case MachineStatus.WARNING: return 'bg-amber-500';
    case MachineStatus.CRITICAL: return 'bg-rose-500';
    default: return 'bg-gray-500';
  }
};

const getStatusBorder = (status: MachineStatus) => {
  switch (status) {
    case MachineStatus.NORMAL: return 'border-gray-200 dark:border-navy-800 hover:border-emerald-500/50';
    case MachineStatus.WARNING: return 'border-amber-200 dark:border-amber-500/50 hover:border-amber-500';
    case MachineStatus.CRITICAL: return 'border-rose-200 dark:border-rose-500/50 hover:border-rose-500';
    default: return 'border-gray-200 dark:border-navy-800 hover:border-blue-400 dark:hover:border-blue-500';
  }
};

export const MachineCard: React.FC<MachineCardProps> = React.memo(({ machine, onClick }) => {
  const latest = machine.history.length > 0 ? machine.history[machine.history.length - 1] : null;

  return (
    <div 
        onClick={() => onClick(machine)}
        className={`group bg-white dark:bg-navy-950 border rounded-xl p-5 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg flex flex-col shadow-sm ${getStatusBorder(machine.status)}`}
    >
        {/* HEADER */}
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white border border-gray-100 dark:border-navy-700 dark:bg-navy-800 rounded-lg group-hover:bg-blue-50 dark:group-hover:bg-navy-700 group-hover:text-blue-900 dark:group-hover:text-white transition-colors group-hover:border-blue-100">
                    <Cpu className="w-6 h-6 text-gray-500 dark:text-slate-400" />
                </div>
                <div>
                    <h3 className="font-bold text-blue-950 dark:text-white text-base group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors truncate max-w-[140px]">
                        {machine.name}
                    </h3>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{machine.type} • {machine.location}</p>
                </div>
            </div>
            <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                machine.status === MachineStatus.NORMAL ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/50 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400' :
                machine.status === MachineStatus.WARNING ? 'bg-amber-50 border-amber-100 dark:bg-amber-950/50 dark:border-amber-500/30 text-amber-600 dark:text-amber-400' :
                'bg-rose-50 border-rose-100 dark:bg-rose-950/50 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 animate-pulse'
            }`}>
                {machine.status}
            </div>
        </div>

        {/* METRICS */}
        <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-white dark:bg-navy-900 p-2 rounded border border-gray-100 dark:border-navy-800 group-hover:border-blue-100 dark:group-hover:border-navy-700 transition-colors text-center shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                <div className="text-[9px] text-gray-500 uppercase font-bold mb-1 flex justify-center items-center gap-1">
                    <Activity className="w-3 h-3" /> Vib
                </div>
                <div className={`text-sm font-mono font-medium ${latest && latest.vibration > 6 ? 'text-rose-500 dark:text-rose-400' : 'text-gray-700 dark:text-slate-200'}`}>
                    {latest?.vibration?.toFixed(2) || '--'}
                </div>
            </div>
            <div className="bg-white dark:bg-navy-900 p-2 rounded border border-gray-100 dark:border-navy-800 group-hover:border-blue-100 dark:group-hover:border-navy-700 transition-colors text-center shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                <div className="text-[9px] text-gray-500 uppercase font-bold mb-1 flex justify-center items-center gap-1">
                    <Thermometer className="w-3 h-3" /> Temp
                </div>
                <div className={`text-sm font-mono font-medium ${latest && latest.temperature > 85 ? 'text-rose-500 dark:text-rose-400' : 'text-gray-700 dark:text-slate-200'}`}>
                    {latest?.temperature?.toFixed(1) || '--'}
                </div>
            </div>
            <div className="bg-white dark:bg-navy-900 p-2 rounded border border-gray-100 dark:border-navy-800 group-hover:border-blue-100 dark:group-hover:border-navy-700 transition-colors text-center shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                <div className="text-[9px] text-gray-500 uppercase font-bold mb-1 flex justify-center items-center gap-1">
                    <Radio className="w-3 h-3" /> dB
                </div>
                <div className="text-sm font-mono font-medium text-gray-700 dark:text-slate-200">
                    {latest?.noise?.toFixed(0) || '--'}
                </div>
            </div>
        </div>
        
        {/* FOOTER */}
        <div className="mt-auto pt-3 border-t border-gray-100 dark:border-navy-800 flex justify-between items-center text-[10px] text-gray-500">
             <span>Last Update: {latest ? new Date(latest.timestamp).toLocaleTimeString() : 'N/A'}</span>
             <span className="group-hover:text-blue-900 dark:group-hover:text-white transition-colors font-medium">Detailed View &rarr;</span>
        </div>
    </div>
  );
}, (prev, next) => {
    return prev.machine.history === next.machine.history && prev.machine.status === next.machine.status;
});