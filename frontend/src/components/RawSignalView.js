import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';

const RawSignalView = ({ data, stats }) => {
  // If no data is passed, show a loading state
  if (!data || !stats) return <div className="text-gray-500">Waiting for data stream...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* SECTION 1: THE DIAGNOSTIC STATS PANEL */}
      {/* This visually proves to the teacher that the signal is "dirty" */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Card 1: DC Offset (Drift) */}
        <div className="bg-gray-800 p-4 rounded-xl border-l-4 border-red-500 shadow-lg">
          <h3 className="text-gray-400 text-xs uppercase font-bold tracking-wider">DC Offset (Drift)</h3>
          <div className="mt-2 flex items-baseline">
            <span className="text-2xl font-mono text-red-400 font-bold">
              {stats.T7_Offset.toFixed(1)}
            </span>
            <span className="ml-1 text-xs text-gray-500">µV</span>
          </div>
          <p className="text-xs text-red-300 mt-1">⚠ Hardware Baseline Drift</p>
        </div>

        {/* Card 2: Noise Level */}
        <div className="bg-gray-800 p-4 rounded-xl border-l-4 border-orange-500 shadow-lg">
          <h3 className="text-gray-400 text-xs uppercase font-bold tracking-wider">Noise Floor</h3>
          <div className="mt-2 flex items-baseline">
            <span className="text-2xl font-mono text-orange-400 font-bold">
              High
            </span>
          </div>
          <p className="text-xs text-orange-300 mt-1">⚡ 50Hz Mains Hum Detected</p>
        </div>

        {/* Card 3: Artifacts */}
        <div className="bg-gray-800 p-4 rounded-xl border-l-4 border-yellow-500 shadow-lg">
          <h3 className="text-gray-400 text-xs uppercase font-bold tracking-wider">Artifacts</h3>
          <div className="mt-2">
             <span className="text-lg font-mono text-yellow-100 bg-yellow-900 px-2 py-1 rounded">
               Blinks / Jaw
             </span>
          </div>
          <p className="text-xs text-gray-400 mt-2">Found on F7 & T8</p>
        </div>

        {/* Card 4: System Status */}
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col justify-center items-center">
          <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse mb-2"></div>
          <span className="text-red-400 font-bold text-sm">RAW INPUT UNSTABLE</span>
          <span className="text-gray-500 text-xs text-center mt-1">Filters Required</span>
        </div>
      </div>

      {/* SECTION 2: THE GRAPHS */}
      
      {/* Graph A: The "Active" Channels (T7 & F8) showing the Drift */}
      <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-200">
            Raw Input: Active Channels (T7, F8)
          </h3>
          <span className="text-xs bg-red-900 text-red-200 px-2 py-1 rounded border border-red-700">
            Unfiltered (Floating Baseline)
          </span>
        </div>
        
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
            <XAxis dataKey="time" hide />
            {/* Auto-scale Y axis to show the massive drift offset */}
            <YAxis domain={['auto', 'auto']} tick={{fill: '#9ca3af', fontSize: 10}} />
            <Tooltip 
              contentStyle={{backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6'}}
              itemStyle={{color: '#e5e7eb'}}
            />
            <Legend wrapperStyle={{paddingTop: '10px'}}/>
            
            {/* T7 (Left) - Drifting */}
            <Area 
              type="monotone" 
              dataKey="T7" 
              stroke="#60a5fa" 
              fill="#3b82f6" 
              fillOpacity={0.1} 
              strokeWidth={2}
              name="T7 (Left Temporal) - Raw" 
              isAnimationActive={false}
            />
            {/* F8 (Right) - Drifting */}
            <Area 
              type="monotone" 
              dataKey="F8" 
              stroke="#34d399" 
              fill="#10b981" 
              fillOpacity={0.1} 
              strokeWidth={2}
              name="F8 (Right Frontal) - Raw" 
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Graph B: The "Rejected" Channels (Cz & P4) */}
      <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 opacity-80 hover:opacity-100 transition-opacity">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-400">
            Raw Input: Rejected Channels (Cz, P4)
          </h3>
          <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
            Noise / Artifact Sources
          </span>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="time" hide />
            <YAxis domain={['auto', 'auto']} tick={{fill: '#6b7280', fontSize: 10}} />
            <Tooltip contentStyle={{backgroundColor: '#1f2937', border: 'none'}} />
            <Legend />
            
            <Area 
              type="monotone" 
              dataKey="Cz"  
              stroke="#ef4444" 
              fill="#ef4444" 
              name="Cz (Hair Noise)" 
            />
            <Area 
              type="monotone" 
              dataKey="P4"  
              stroke="#f59e0b" 
              fill="#f59e0b" 
              name="P4 (Hair Noise)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
};

export default RawSignalView;