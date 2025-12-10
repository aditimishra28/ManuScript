import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { SensorReading } from '../types';

interface LiveChartsProps {
  data: SensorReading[];
  color: string;
  dataKey: keyof SensorReading;
  label: string;
  unit: string;
  threshold?: number;
}

export const LiveCharts: React.FC<LiveChartsProps> = ({ 
  data, 
  color, 
  dataKey, 
  label, 
  unit, 
  threshold 
}) => {
  
  // Format timestamp for X-Axis
  const formattedData = data.map(d => ({
    ...d,
    timeStr: new Date(d.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second:'2-digit' })
  }));

  return (
    <div className="w-full h-48 bg-slate-800/50 rounded-lg p-4 border border-slate-700">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-slate-300">{label}</h3>
        <span className="text-xs text-slate-500 font-mono">Live Stream</span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis 
            dataKey="timeStr" 
            stroke="#94a3b8" 
            fontSize={10} 
            tick={{fill: '#94a3b8'}}
            interval="preserveStartEnd"
          />
          <YAxis 
            stroke="#94a3b8" 
            fontSize={10} 
            tick={{fill: '#94a3b8'}}
            domain={['auto', 'auto']}
            width={30}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f1f5f9' }}
            itemStyle={{ color: color }}
            formatter={(value: number) => [`${value.toFixed(2)} ${unit}`, label]}
            labelStyle={{ color: '#94a3b8' }}
          />
          {threshold && (
             <ReferenceLine y={threshold} stroke="red" strokeDasharray="3 3" label={{ position: 'top',  value: 'Limit', fill: 'red', fontSize: 10 }} />
          )}
          <Line 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color} 
            strokeWidth={2} 
            dot={false} 
            animationDuration={300}
            isAnimationActive={false} // smoother for real-time
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};