import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { getChannelColor } from './eegData';

const formatValue = (value, digits = 3) => (
  Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : 'Unavailable'
);

const RawSignalView = ({ data, stats, features, scope }) => {
  if (!data || data.length === 0) {
    return <div className="p-4 text-center">No raw signal preview is available.</div>;
  }

  const channels = Object.keys(data[0]).filter((key) => key !== 'time');

  const getChannelStats = (channel) => stats?.channels?.[channel] || {
    Mean: features?.[`${channel}_Mean`],
    Std: features?.[`${channel}_Std`],
    Min: features?.[`${channel}_Min`],
    Max: features?.[`${channel}_Max`],
  };

  return (
    <div className="row g-4">
      <div className="col-12">
        <div className="card border-0 shadow-sm rounded-4 p-3 bg-light text-dark border-start border-4 border-primary">
          <div className="d-flex flex-wrap justify-content-between gap-3">
            <div>
              <h6 className="text-muted small fw-bold mb-1">DATA SOURCE</h6>
              <h5 className="fw-bold mb-0 text-break">{stats?.File || 'Active Stream'}</h5>
            </div>
            <div className="text-md-end">
              <span className="badge bg-white text-dark border mb-1">{channels.length} EEG channel{channels.length === 1 ? '' : 's'}</span>
              <p className="small text-muted mb-0">
                {scope?.message || 'Uploaded signal preview'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="col-12">
        <div className="d-flex flex-column gap-3">
          {channels.map((channel) => {
            const channelStats = getChannelStats(channel);
            const color = getChannelColor(channel);

            return (
              <div key={channel} className="card border-0 shadow-sm rounded-4 p-3 bg-white">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-2">
                  <div>
                    <span className="badge rounded-pill px-3" style={{ backgroundColor: color }}>
                      CHANNEL: {channel}
                    </span>
                    <p className="text-muted small mb-0 mt-1" style={{ fontSize: '0.7rem' }}>
                      Unfiltered source signal • {stats?.Unit || 'source units'}
                    </p>
                  </div>

                  <div className="d-flex gap-3 text-end font-monospace" style={{ fontSize: '0.75rem' }}>
                    <div>
                      <span className="text-muted d-block">MEAN</span>
                      <span className="fw-bold">{formatValue(channelStats.Mean)}</span>
                    </div>
                    <div>
                      <span className="text-muted d-block">STD DEV</span>
                      <span className="fw-bold text-primary">{formatValue(channelStats.Std)}</span>
                    </div>
                    <div>
                      <span className="text-muted d-block">MIN / MAX</span>
                      <span className="fw-bold text-danger">
                        {formatValue(channelStats.Min, 1)} / {formatValue(channelStats.Max, 1)}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ width: '100%', height: 180 }}>
                  <ResponsiveContainer>
                    <AreaChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 9 }}
                        tickFormatter={(value) => `${Number(value).toFixed(0)}s`}
                      />
                      <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9 }} width={52} />
                      <Tooltip
                        labelFormatter={(value) => `${Number(value).toFixed(2)} seconds`}
                        formatter={(value) => [formatValue(value), `${channel} (${stats?.Unit || 'units'})`]}
                        contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px' }}
                      />
                      <Area
                        type="linear"
                        dataKey={channel}
                        stroke={color}
                        fill={color}
                        fillOpacity={0.06}
                        strokeWidth={1.25}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RawSignalView;
