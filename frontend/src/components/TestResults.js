// File: src/components/TestResults.js
import React from 'react';
import TestResultSummary from './TestResultSummary';
import StatsRow from './StatsRow';

const TestResults = ({ data }) => {
  if (!data) return null;

  //Dropdowns
  const STATS_INFO = {
    'Mean': { desc: "Average voltage amplitude.", ctx: "Should be near 0 µV." },
    'Max': { desc: "Peak positive voltage.", ctx: "Values >100µV often indicate blinks." },
    'Min': { desc: "Lowest negative voltage.", ctx: "Deep negative spikes in F8 are blinks." },
    'Std Dev': { desc: "Signal variability/noise level.", ctx: "High (>15) = Active/Blinking." },
    'Energy': { desc: "Total spectral power (Wavelet db4).", ctx: "Spikes correlate with events." },
    'Dominant Freq': { desc: "Strongest frequency component.", ctx: "Alpha (8-12Hz) = Relaxed." }
  };

  const getChannelStats = (channel) => {
    return [
      { key: 'Mean', val: data.features[`${channel}_Mean`]?.toFixed(2) },
      { key: 'Max', val: data.features[`${channel}_Max`]?.toFixed(2) },
      { key: 'Min', val: data.features[`${channel}_Min`]?.toFixed(2) },
      { key: 'Std Dev', val: data.features[`${channel}_Std`]?.toFixed(2) },
      { key: 'Energy', val: (data.features[`${channel}_WaveletEnergy`] / 1000)?.toFixed(0) + 'k' },
      { key: 'Dominant Freq', val: data.features[`${channel}_DominantFreq`]?.toFixed(1) + ' Hz' },
    ];
  };

  return (
    <div className="row g-4 fade-in">
      <div className="col-12">
        <TestResultSummary data={data} />
      </div>

      <div className="col-md-6">
        <div className="card border-0 shadow-sm rounded-4 p-4 h-100">
          <h5 className="text-primary fw-bold mb-4">Left Hemisphere (T7)</h5>
          <div className="d-flex flex-column gap-3">
            {getChannelStats('T7').map((item, idx) => (
              <StatsRow key={idx} label={item.key} value={item.val} description={STATS_INFO[item.key]?.desc} context={STATS_INFO[item.key]?.ctx}/>
            ))}
          </div>
        </div>
      </div>

      <div className="col-md-6">
        <div className="card border-0 shadow-sm rounded-4 p-4 h-100">
          <h5 className="text-success fw-bold mb-4">Right Hemisphere (F8)</h5>
          <div className="d-flex flex-column gap-3">
            {getChannelStats('F8').map((item, idx) => (
              <StatsRow key={idx} label={item.key} value={item.val} description={STATS_INFO[item.key]?.desc} context={STATS_INFO[item.key]?.ctx}/>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestResults;