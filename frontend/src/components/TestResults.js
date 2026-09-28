import React from 'react';
import StatsRow from './StatsRow';
import TestResultSummary from './TestResultSummary';
import { getChannelColor } from './eegData';

const TestResults = ({ data }) => {
  if (!data) return null;

  const channels = Array.isArray(data.available_channels) && data.available_channels.length
    ? data.available_channels
    : [...new Set(
        Object.keys(data.features || {})
          .filter((key) => key !== 'Alpha_Asymmetry' && key.includes('_'))
          .map((key) => key.substring(0, key.indexOf('_')))
      )];

  const faaAvailable = data.faa_details?.mode !== 'unavailable';

  const STATS_INFO = {
    'Mean (Z-score)': { desc: 'Average normalized amplitude.', ctx: 'Expected near 0 after Z-score normalization.' },
    'Max (Z-score)': { desc: 'Largest normalized positive sample.', ctx: 'Measured in standard deviations, not microvolts.' },
    'Min (Z-score)': { desc: 'Largest normalized negative sample.', ctx: 'Measured in standard deviations, not microvolts.' },
    'Std Dev (Z-score)': { desc: 'Normalized signal standard deviation.', ctx: 'Expected near 1 after Z-score normalization.' },
    'Wavelet Energy': { desc: 'Sum of squared db4 wavelet coefficients.', ctx: 'Compare only recordings processed with the same duration and pipeline.' },
    'Dominant Freq': { desc: 'Strongest component in the 2–40 Hz legacy range.', ctx: 'A descriptive signal feature, not a diagnosis.' },
    'Delta Power': { desc: 'Welch PSD power from 0.5–4 Hz.', ctx: 'Calculated from the normalized signal.' },
    'Theta Power': { desc: 'Welch PSD power from 4–8 Hz.', ctx: 'Calculated from the normalized signal.' },
    'Alpha Power': { desc: 'Welch PSD power from 8–12 Hz.', ctx: 'Used for FAA only when a supported pair exists.' },
    'Beta Power': { desc: 'Welch PSD power from 13–30 Hz.', ctx: 'Calculated from the normalized signal.' },
    'Gamma Power': { desc: 'Welch PSD power from 30–45 Hz.', ctx: 'Can be sensitive to muscle activity.' },
  };

  const formatNumber = (value, digits = 4) => (
    Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : 'Unavailable'
  );

  const getChannelStats = (channel) => {
    const features = data.features || {};
    const waveletEnergy = Number(features[`${channel}_WaveletEnergy`]);
    return [
      { key: 'Mean (Z-score)', val: formatNumber(features[`${channel}_Mean`], 2) },
      { key: 'Max (Z-score)', val: formatNumber(features[`${channel}_Max`], 2) },
      { key: 'Min (Z-score)', val: formatNumber(features[`${channel}_Min`], 2) },
      { key: 'Std Dev (Z-score)', val: formatNumber(features[`${channel}_Std`], 2) },
      { key: 'Wavelet Energy', val: Number.isFinite(waveletEnergy) ? `${(waveletEnergy / 1000).toFixed(2)}k` : 'Unavailable' },
      { key: 'Dominant Freq', val: Number.isFinite(Number(features[`${channel}_DominantFreq`])) ? `${Number(features[`${channel}_DominantFreq`]).toFixed(1)} Hz` : 'Unavailable' },
      { key: 'Delta Power', val: formatNumber(features[`${channel}_Delta`]) },
      { key: 'Theta Power', val: formatNumber(features[`${channel}_Theta`]) },
      { key: 'Alpha Power', val: formatNumber(features[`${channel}_Alpha`]) },
      { key: 'Beta Power', val: formatNumber(features[`${channel}_Beta`]) },
      { key: 'Gamma Power', val: formatNumber(features[`${channel}_Gamma`]) },
    ];
  };

  return (
    <div className="row g-4 fade-in">
      {faaAvailable ? (
        <div className="col-12"><TestResultSummary data={data} /></div>
      ) : (
        <div className="col-12">
          <div className="card border-0 shadow-sm rounded-4 p-4">
            <h4 className="fw-bold mb-2">General EEG Signal Results</h4>
            <p className="text-muted mb-0">
              {channels.length} real EEG derivation{channels.length === 1 ? '' : 's'} were detected,
              filtered and measured. FAA is not shown because this file does not contain
              an exact F3/F4 or T7/F8 pair. Bipolar labels such as F4-C4 are not substituted for F4.
            </p>
          </div>
        </div>
      )}

      {data.faa_details && (
        <div className="col-12">
          <div className="card border-0 shadow-sm rounded-4 p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
              <div>
                <h6 className="fw-bold mb-1">FAA Measurement Details</h6>
                <p className="text-muted small mb-0">{data.faa_details.quality_note}</p>
              </div>
              <div className="d-flex flex-wrap gap-2">
                <span className="badge bg-light text-dark border">Pair: {data.faa_details.pair_label}</span>
                <span className={`badge ${
                  data.faa_details.mode === 'unavailable'
                    ? 'bg-secondary'
                    : data.faa_details.standard_frontal_pair
                      ? 'bg-success'
                      : 'bg-warning text-dark'
                }`}>
                  {data.faa_details.mode === 'unavailable'
                    ? 'FAA unavailable'
                    : data.faa_details.standard_frontal_pair
                      ? 'Standard frontal FAA'
                      : 'Experimental fallback'}
                </span>
              </div>
            </div>
            <small className="text-muted mt-3">{data.faa_details.usage}</small>
          </div>
        </div>
      )}

      {channels.map((channel) => (
        <div className="col-md-6 col-xl-4" key={channel}>
          <div className="card border-0 shadow-sm rounded-4 p-4 h-100">
            <h5 className="fw-bold mb-4" style={{ color: getChannelColor(channel) }}>
              Channel {channel}
            </h5>
            <div className="d-flex flex-column gap-3">
              {getChannelStats(channel).map((item) => (
                <StatsRow
                  key={item.key}
                  label={item.key}
                  value={item.val}
                  description={STATS_INFO[item.key]?.desc}
                  context={STATS_INFO[item.key]?.ctx}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TestResults;
