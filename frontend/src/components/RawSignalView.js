import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const RawSignalView = ({ data, stats, features }) => {
  if (!data || data.length === 0) return <div className="p-4 text-center">Loading Raw Monitor...</div>;

  const channels = Object.keys(data[0]).filter(key => key !== 'time');

  const getChannelColor = (ch) => {
    const colors = { T7: "#67a1ff", F8: "#4dd5a8", Cz: "#f77373", P4: "#f7be5a" };
    return colors[ch] || "#6b7280";
  };

  return (
    <div className="row g-4">
      {/* SECTION 1: GLOBAL STAT CARD */}
      <div className="col-md-6">
        <div className="card border-0 shadow-sm rounded-4 p-3 bg-light text-dark border-start border-4 border-primary">
          <h6 className="text-muted small fw-bold mb-1">DATA SOURCE</h6>
          <h5 className="fw-bold mb-0 text-truncate">{stats?.File || "Active Stream"}</h5>
        </div>
      </div>

      {/* SECTION 2: SEPARATE INDEPENDENT GRAPHS */}
      <div className="col-12">
        <div className="d-flex flex-column gap-3">
          {channels.map((ch) => (
            <div key={ch} className="card border-0 shadow-sm rounded-4 p-3 bg-white">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <span className="badge rounded-pill px-3" style={{backgroundColor: getChannelColor(ch)}}>
                    CHANNEL: {ch}
                  </span>
                  <p className="text-muted small mb-0 mt-1" style={{fontSize: '0.7rem'}}>Unfiltered Hardware Voltage</p>
                </div>

                {/* DYNAMIC STATS FOR THIS SPECIFIC CHANNEL */}
                <div className="d-flex gap-3 text-end font-monospace" style={{fontSize: '0.75rem'}}>
                  <div>
                    <span className="text-muted d-block">MEAN</span>
                    <span className="fw-bold">{features?.[`${ch}_Mean`]?.toFixed(3) || "0.000"}</span>
                  </div>
                  <div>
                    <span className="text-muted d-block">STD DEV</span>
                    <span className="fw-bold text-primary">{features?.[`${ch}_Std`]?.toFixed(3) || "0.000"}</span>
                  </div>
                  <div>
                    <span className="text-muted d-block">MIN/MAX</span>
                    <span className="fw-bold text-danger">
                       {features?.[`${ch}_Min`]?.toFixed(1) || "0"}/{features?.[`${ch}_Max`]?.toFixed(1) || "0"}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ width: '100%', height: 160 }}>
                <ResponsiveContainer>
                  <AreaChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="time" hide />
                    <YAxis domain={['auto', 'auto']} tick={{fontSize: 9}} width={35} />
                    <Tooltip 
                      contentStyle={{borderRadius: '8px', border: 'none', fontSize: '12px'}}
                      labelStyle={{display: 'none'}}
                    />
                    <Area 
                      type="monotone" 
                      dataKey={ch} 
                      stroke={getChannelColor(ch)} 
                      fill={getChannelColor(ch)} 
                      fillOpacity={0.05} 
                      strokeWidth={1.5}
                      isAnimationActive={false} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RawSignalView;

