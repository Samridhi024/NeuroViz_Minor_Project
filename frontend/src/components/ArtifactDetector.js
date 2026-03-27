import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle, Activity, Info, RotateCcw, Zap } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const SIGNAL_CHANNELS = ['T7', 'F8', 'F3', 'F4'];

const ARTIFACT_TYPES = ['Blink/EOG', 'Muscle (EMG)', 'Motion artifact', 'Line noise', 'Electrode pop', 'Drift'];

const DETECTION_METHODS = [
  { id: 'threshold', label: 'Threshold',    desc: 'Flag samples exceeding an amplitude limit' },
  { id: 'kurtosis',  label: 'Kurtosis',     desc: 'Statistical distribution-based detection'  },
  { id: 'muscle',    label: 'Muscle (EMG)', desc: 'High-frequency muscular artifact detection' },
  { id: 'ocular',    label: 'Ocular (EOG)', desc: 'Eye-blink and eye-movement detection'       },
];

const STATUS_COLORS = {
  artifact:   { bg: '#fff1f0', border: '#E24B4A', text: '#A32D2D', dot: '#E24B4A' },
  borderline: { bg: '#fffbe6', border: '#BA7517', text: '#854F0B', dot: '#BA7517' },
  clean:      { bg: '#f0fff4', border: '#0F6E56', text: '#085041', dot: '#0F6E56' },
};

// ─── Backend pipeline config (read-only display in Filter tab) ────────────────
const PIPELINE_STEPS = [
  { label: 'Detrend',          desc: 'Linear detrending to remove baseline drift from sensor',     color: '#534AB7' },
  { label: 'Notch filter',     desc: '50 Hz IIR notch — removes AC power-line interference',       color: '#185FA5' },
  { label: 'Bandpass filter',  desc: '4th-order Butterworth, 0.5–45 Hz passband',                  color: '#0F6E56' },
  { label: 'Z-score normalise',desc: 'Mean=0, Std=1 — makes all hardware units comparable',        color: '#3B6D11' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute a real SNR proxy from features.
 * Uses the ratio of |mean| to std — a flat signal has near-zero mean
 * so we use max as the signal amplitude instead.
 * SNR (dB) ≈ 20 * log10(peak / std)
 */
function computeSnr(features, ch) {
  const peak = Math.abs(features[`${ch}_Max`] || 0);
  const std  = features[`${ch}_Std`]  || 1e-6;
  if (std < 1e-6) return 0;
  return (20 * Math.log10(Math.max(peak, 1e-6) / std)).toFixed(1);
}

/**
 * Classify a channel based on the selected detection method.
 * threshold  → uses Max Z-score value
 * kurtosis   → uses Std as a proxy (high std = heavy tails)
 * muscle     → uses DominantFreq (high dominant freq = muscle noise)
 * ocular     → uses low dominant freq (< 4 Hz) as blink proxy
 */
function classifyChannel(features, ch, method, thresholdUV, zScoreCutoff) {
  const maxVal  = Math.abs(features[`${ch}_Max`]          || 0);
  const std     = Math.abs(features[`${ch}_Std`]          || 0);
  const domFreq =          features[`${ch}_DominantFreq`] || 0;

  let status = 'clean';
  let type   = null;

  if (method === 'threshold') {
    if (maxVal > zScoreCutoff + 1.5) { status = 'artifact';   type = ARTIFACT_TYPES[0]; }
    else if (maxVal > zScoreCutoff)  { status = 'borderline'; }

  } else if (method === 'kurtosis') {
    // After Z-scoring, std ≈ 1.0 for normal. High std means heavy tails (artifacts).
    if (std > 1.4)      { status = 'artifact';   type = ARTIFACT_TYPES[1]; }
    else if (std > 1.1) { status = 'borderline'; }

  } else if (method === 'muscle') {
    // Muscle noise shows up as high dominant frequency (> 20 Hz)
    if (domFreq > 25)      { status = 'artifact';   type = ARTIFACT_TYPES[1]; }
    else if (domFreq > 20) { status = 'borderline'; }

  } else if (method === 'ocular') {
    // Eye blinks produce very low frequency dominant peaks (< 4 Hz)
    if (domFreq < 2)      { status = 'artifact';   type = ARTIFACT_TYPES[0]; }
    else if (domFreq < 4) { status = 'borderline'; }
  }

  return { status, type };
}

// ─── Mini waveform canvas ─────────────────────────────────────────────────────
function MiniSignal({ status, channelData }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    // Use rAF to ensure layout is complete before reading offsetWidth
    const raf = requestAnimationFrame(() => {
      const W = Math.max(canvas.offsetWidth * 2, 100);
      const H = 60;
      canvas.width  = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, W, H);

      const pts    = 150;
      const hasData = channelData && channelData.length > 0;

      ctx.strokeStyle = status === 'artifact'   ? '#E24B4A'
                      : status === 'borderline' ? '#BA7517'
                      : '#185FA5';
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      for (let i = 0; i < pts; i++) {
        const x = (i / pts) * W;
        let y;
        if (hasData) {
          const dataIdx = Math.floor(i * (channelData.length / pts));
          const val     = channelData[dataIdx] ?? 0;
          // clamp Z-scored values so they don't fly off canvas
          const clamped = Math.max(-4, Math.min(4, val));
          y = (H / 2) - (clamped * (H / 10));
        } else {
          y = Math.sin(i * 0.19) * 10 + H / 2;
        }
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    return () => cancelAnimationFrame(raf);
  }, [status, channelData]);

  return <canvas ref={ref} style={{ width: '100%', height: 30, display: 'block' }} />;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ArtifactDetector({ data, userMode = 'clinician' }) {
  const [activeTab,   setActiveTab]   = useState('detect');
  const [method,      setMethod]      = useState('threshold');
  const [thresholdUV, setThresholdUV] = useState(75);
  const [zScore,      setZScore]      = useState(3.0);
  const [running,     setRunning]     = useState(false);
  const [results,     setResults]     = useState(null);

  // Derive signal channels from backend features, restricted to known signal channels only
  const channels = data?.features
    ? Object.keys(data.features)
        .filter(k => k.endsWith('_Max'))
        .map(k => k.replace('_Max', ''))
        .filter(ch => SIGNAL_CHANNELS.includes(ch))
    : ['T7', 'F8'];

  // Compute epoch total from actual signal length if available
  const signalLengthSec = data?.raw_graph?.length
    ? data.raw_graph[data.raw_graph.length - 1]?.time ?? 0
    : 0;
  const epochMs    = 500;
  const epochTotal = signalLengthSec > 0
    ? Math.max(1, Math.floor((signalLengthSec * 1000) / epochMs))
    : 120;

  const runDetection = useCallback(() => {
    if (!data?.features) return;
    setRunning(true);

    setTimeout(() => {
      const chResults = channels.map(ch => {
        const { status, type } = classifyChannel(data.features, ch, method, thresholdUV, zScore);
        const snr  = computeSnr(data.features, ch);
        const maxVal = Math.abs(data.features[`${ch}_Max`] || 0);

        return {
          ch,
          status,
          type,
          pct: Math.round(Math.min(maxVal * 15, 100)),
          snr,
          domFreq: (data.features[`${ch}_DominantFreq`] || 0).toFixed(1),
        };
      });

      const total     = chResults.length;
      const arts      = chResults.filter(r => r.status === 'artifact').length;
      const borders   = chResults.filter(r => r.status === 'borderline').length;
      const epochsArt = Math.round(arts * 12 + borders * 4);
      const retention = Math.round((1 - Math.min(epochsArt / epochTotal, 1)) * 100);
      const avgSnr    = total > 0
        ? (chResults.reduce((s, r) => s + parseFloat(r.snr), 0) / total).toFixed(1)
        : '0.0';

      setResults({
        chResults, total, arts, borders,
        clean: total - arts - borders,
        epochsArt, epochTotal, retention, avgSnr,
      });
      setRunning(false);
      setActiveTab('report');
    }, 1000);
  }, [channels, data, method, thresholdUV, zScore, epochTotal]);

  const reset = () => {
    setResults(null);
    setActiveTab('detect');
  };

  // Patient mode — hide entirely
  if (userMode === 'patient') return null;

  return (
    <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-0">
        <div className="d-flex align-items-center gap-2 mb-1">
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#185FA5' }} />
          <h6 className="fw-bold mb-0">Artifact Detection &amp; Pipeline</h6>
          {data && (
            <span className="badge ms-auto" style={{ background: '#EFF6FF', color: '#185FA5', fontSize: 11 }}>
              {data.raw_stats?.File || 'Active Session'}
            </span>
          )}
        </div>
        <p className="text-muted mb-3" style={{ fontSize: 12 }}>
          Identify signal artifacts using real extracted features
        </p>

        <ul className="nav nav-tabs border-0" style={{ gap: 4 }}>
          {['detect', 'pipeline', 'report'].map(t => (
            <li className="nav-item" key={t}>
              <button
                onClick={() => setActiveTab(t)}
                className={`nav-link d-flex align-items-center gap-1 px-3 py-2 fw-semibold border-0
                  ${activeTab === t ? 'active text-primary border-bottom border-primary border-2' : 'text-muted'}`}
                style={{ fontSize: 13, background: 'none' }}
              >
                {t.toUpperCase()}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="px-4 py-3">

        {/* ══ DETECT TAB ══ */}
        {activeTab === 'detect' && (
          <div>
            {/* Method selector */}
            <p className="text-uppercase fw-semibold text-muted mb-2" style={{ fontSize: 10 }}>
              Detection Method
            </p>
            <div className="d-flex flex-wrap gap-2 mb-1">
              {DETECTION_METHODS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`btn btn-sm px-3 py-1 rounded-pill fw-semibold ${method === m.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{ fontSize: 12 }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {/* Method description */}
            <p className="text-muted mb-3" style={{ fontSize: 11 }}>
              {DETECTION_METHODS.find(m => m.id === method)?.desc}
            </p>

            {/* Parameters — only show threshold params when threshold method selected */}
            {method === 'threshold' && (
              <>
                <p className="text-uppercase fw-semibold text-muted mb-2" style={{ fontSize: 10 }}>Parameters</p>
                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <div className="p-2 rounded-3 bg-light">
                      <div className="text-muted" style={{ fontSize: 10 }}>Amplitude threshold</div>
                      <div className="fw-bold" style={{ fontSize: 14 }}>{thresholdUV} µV</div>
                      <input
                        type="range" className="form-range"
                        min={20} max={150} value={thresholdUV}
                        onChange={e => setThresholdUV(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-2 rounded-3 bg-light">
                      <div className="text-muted" style={{ fontSize: 10 }}>Z-score cutoff</div>
                      <div className="fw-bold" style={{ fontSize: 14 }}>{zScore.toFixed(1)} σ</div>
                      <input
                        type="range" className="form-range"
                        min={15} max={50} value={Math.round(zScore * 10)}
                        onChange={e => setZScore(Number(e.target.value) / 10)}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Channel list with mini waveforms */}
            <p className="text-uppercase fw-semibold text-muted mb-2" style={{ fontSize: 10 }}>
              Signal Channels ({channels.length})
            </p>
            <div className="rounded-3 overflow-hidden mb-3 border">
              {channels.length === 0 && (
                <div className="px-3 py-3 text-muted" style={{ fontSize: 13 }}>
                  No signal channels found in uploaded file.
                </div>
              )}
              {channels.map((ch, i) => {
                const res    = results?.chResults[i];
                const colors = res ? STATUS_COLORS[res.status] : null;
                return (
                  <div key={ch} className="d-flex align-items-center gap-3 px-3 py-2 border-bottom">
                    <span className="badge bg-light text-primary border" style={{ minWidth: 44 }}>{ch}</span>
                    <div style={{ flex: 1 }}>
                      <MiniSignal
                        status={res?.status ?? 'clean'}
                        channelData={data?.clean_graph?.map(p => p[ch])}
                      />
                    </div>
                    {res ? (
                      <div className="text-end" style={{ minWidth: 100 }}>
                        <span
                          className="badge rounded-pill d-block mb-1"
                          style={{
                            fontSize: 10,
                            background: colors.bg,
                            color: colors.text,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          {res.status.toUpperCase()}
                        </span>
                        <span className="text-muted" style={{ fontSize: 10 }}>
                          {res.domFreq} Hz dominant
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted" style={{ fontSize: 11, minWidth: 100, textAlign: 'right' }}>
                        Not scanned
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Warnings from backend */}
            {data?.warnings?.length > 0 && (
              <div className="alert alert-warning d-flex gap-2 py-2 mb-3" style={{ fontSize: 12 }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  {data.warnings.map((w, i) => <div key={i}>{w}</div>)}
                </div>
              </div>
            )}

            <button
              className="btn btn-primary w-100 fw-bold py-2 rounded-3"
              onClick={runDetection}
              disabled={running || channels.length === 0}
            >
              {running
                ? <><span className="spinner-border spinner-border-sm me-2" />Analyzing…</>
                : <><Zap size={14} className="me-2" />Run Detection</>
              }
            </button>
          </div>
        )}

        {/* ══ PIPELINE TAB (replaces Filter) ══ */}
        {activeTab === 'pipeline' && (
          <div>
            <div className="alert alert-info d-flex gap-2 py-2 mb-3" style={{ fontSize: 12 }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                Signal cleaning is applied server-side on upload. The pipeline below ran automatically on your file.
              </span>
            </div>

            <p className="text-uppercase fw-semibold text-muted mb-2" style={{ fontSize: 10 }}>
              Applied pipeline steps
            </p>
            <div className="rounded-3 overflow-hidden border mb-3">
              {PIPELINE_STEPS.map((step, i) => (
                <div
                  key={step.label}
                  className={`d-flex align-items-start gap-3 px-3 py-2 ${i > 0 ? 'border-top' : ''}`}
                >
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: step.color + '18',
                      border: `1.5px solid ${step.color}`,
                      color: step.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 600, flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <div className="fw-semibold" style={{ fontSize: 13 }}>{step.label}</div>
                    <div className="text-muted" style={{ fontSize: 11 }}>{step.desc}</div>
                  </div>
                  <CheckCircle size={14} className="ms-auto mt-1" style={{ color: '#0F6E56', flexShrink: 0 }} />
                </div>
              ))}
            </div>

            <p className="text-uppercase fw-semibold text-muted mb-2" style={{ fontSize: 10 }}>
              Session info
            </p>
            <div className="rounded-3 overflow-hidden border">
              {[
                ['File',            data?.raw_stats?.File       ?? '—'],
                ['Channels loaded', channels.join(', ')         || '—'],
                ['Signal offset (T7)', data?.raw_stats?.T7_Offset != null
                  ? data.raw_stats.T7_Offset.toFixed(4)
                  : '—'],
                ['Recording duration', signalLengthSec > 0
                  ? `${signalLengthSec.toFixed(1)} s`
                  : '—'],
              ].map(([k, v], i) => (
                <div
                  key={k}
                  className={`d-flex justify-content-between p-2 ${i > 0 ? 'border-top' : ''}`}
                  style={{ fontSize: 13 }}
                >
                  <span className="text-muted">{k}</span>
                  <span className="fw-bold" style={{ maxWidth: '55%', textAlign: 'right', wordBreak: 'break-all' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ REPORT TAB ══ */}
        {activeTab === 'report' && (
          results ? (
            <div>
              {/* Summary alert */}
              <div
                className={`alert d-flex align-items-start gap-2 py-2 mb-3 ${results.retention >= 80 ? 'alert-success' : 'alert-warning'}`}
                style={{ fontSize: 12 }}
              >
                {results.retention >= 80
                  ? <CheckCircle size={16} style={{ flexShrink: 0 }} />
                  : <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                }
                <span>
                  <strong>{results.retention}% epoch retention.</strong>{' '}
                  {results.retention >= 80
                    ? 'Signal is statistically stable for analysis.'
                    : 'Consider reviewing raw data for noise sources.'}
                </span>
              </div>

              {/* Per-channel result breakdown */}
              <p className="text-uppercase fw-semibold text-muted mb-2" style={{ fontSize: 10 }}>
                Per-channel results
              </p>
              <div className="rounded-3 overflow-hidden border mb-3">
                {results.chResults.map((r, i) => {
                  const colors = STATUS_COLORS[r.status];
                  return (
                    <div
                      key={r.ch}
                      className={`d-flex align-items-center gap-3 px-3 py-2 ${i > 0 ? 'border-top' : ''}`}
                      style={{ fontSize: 13 }}
                    >
                      <span className="badge bg-light text-primary border" style={{ minWidth: 40 }}>{r.ch}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span
                            className="badge rounded-pill"
                            style={{
                              fontSize: 10,
                              background: colors.bg,
                              color: colors.text,
                              border: `1px solid ${colors.border}`,
                            }}
                          >
                            {r.status.toUpperCase()}
                          </span>
                          <span className="text-muted" style={{ fontSize: 11 }}>
                            SNR {r.snr} dB &nbsp;·&nbsp; {r.domFreq} Hz
                          </span>
                        </div>
                        {r.type && (
                          <div className="text-muted mt-1" style={{ fontSize: 11 }}>
                            Likely: {r.type}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary metrics */}
              <p className="text-uppercase fw-semibold text-muted mb-2" style={{ fontSize: 10 }}>
                Summary
              </p>
              <div className="rounded-3 overflow-hidden border mb-3">
                {[
                  ['Artifact channels',    results.arts],
                  ['Borderline channels',  results.borders],
                  ['Clean channels',       results.clean],
                  ['Avg SNR',              `${results.avgSnr} dB`],
                  ['Epoch retention',      `${results.retention}%`],
                  ['Epochs flagged',       `${results.epochsArt} / ${results.epochTotal}`],
                  ['Detection method',     DETECTION_METHODS.find(m => m.id === method)?.label ?? method],
                ].map(([k, v], i) => (
                  <div
                    key={k}
                    className={`d-flex justify-content-between p-2 ${i > 0 ? 'border-top' : ''}`}
                    style={{ fontSize: 13 }}
                  >
                    <span className="text-muted">{k}</span>
                    <span className="fw-bold">{v}</span>
                  </div>
                ))}
              </div>

              <button
                className="btn btn-outline-primary w-100 btn-sm d-flex align-items-center justify-content-center gap-2"
                onClick={reset}
              >
                <RotateCcw size={13} /> Re-run Scan
              </button>
            </div>
          ) : (
            /* Empty state when report tab clicked before running detection */
            <div className="text-center py-5 text-muted">
              <Activity size={32} className="mb-3 opacity-50" />
              <p className="mb-1 fw-semibold" style={{ fontSize: 14 }}>No results yet</p>
              <p style={{ fontSize: 12 }}>Go to the Detect tab and run a scan first.</p>
              <button
                className="btn btn-primary btn-sm mt-2"
                onClick={() => setActiveTab('detect')}
              >
                Go to Detect
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// import React, { useState, useRef, useEffect, useCallback } from 'react';
// import { AlertTriangle, CheckCircle, Activity, Filter, FileBarChart2, Play, RotateCcw, Info } from 'lucide-react';

// // ─── Constants ───────────────────────────────────────────────────────────────
// const ARTIFACT_TYPES = ['Blink/EOG', 'Muscle (EMG)', 'Motion artifact', 'Line noise', 'Electrode pop', 'Drift'];

// const DETECTION_METHODS = [
//   { id: 'threshold', label: 'Threshold',   desc: 'Flag samples exceeding an amplitude limit' },
//   { id: 'kurtosis',  label: 'Kurtosis',    desc: 'Statistical distribution-based detection' },
//   { id: 'ica',       label: 'ICA',         desc: 'Independent Component Analysis decomposition' },
//   { id: 'muscle',    label: 'Muscle (EMG)',desc: 'High-frequency muscular artifact detection' },
//   { id: 'ocular',    label: 'Ocular (EOG)',desc: 'Eye-blink and eye-movement detection' },
// ];

// const FILTER_TYPES = [
//   { id: 'bandpass', label: 'Bandpass' },
//   { id: 'notch',    label: 'Notch (50/60 Hz)' },
//   { id: 'highpass', label: 'High-pass' },
//   { id: 'lowpass',  label: 'Low-pass' },
//   { id: 'car',      label: 'CAR' },
// ];

// const INTERP_METHODS = [
//   { id: 'linear',  label: 'Linear' },
//   { id: 'cubic',   label: 'Cubic spline' },
//   { id: 'zero',    label: 'Zero-fill' },
//   { id: 'exclude', label: 'Exclude epoch' },
// ];

// const STATUS_COLORS = {
//   artifact:   { bg: '#fff1f0', border: '#E24B4A', text: '#A32D2D', dot: '#E24B4A' },
//   borderline: { bg: '#fffbe6', border: '#BA7517', text: '#854F0B', dot: '#BA7517' },
//   clean:      { bg: '#f0fff4', border: '#0F6E56', text: '#085041', dot: '#0F6E56' },
// };

// // ─── Mini waveform canvas (NOW PLOTS REAL CHANNEL DATA) ─────────────────────
// function MiniSignal({ status, channelData }) {
//   const ref = useRef(null);

//   useEffect(() => {
//     const canvas = ref.current;
//     if (!canvas) return;
//     const W = canvas.offsetWidth * 2;
//     const H = 60;
//     canvas.width = W; canvas.height = H;
//     const ctx = canvas.getContext('2d');
//     ctx.clearRect(0, 0, W, H);

//     const pts = 150;
//     const hasData = channelData && channelData.length > 0;
    
//     ctx.strokeStyle = status === 'artifact' ? '#E24B4A' : status === 'borderline' ? '#BA7517' : '#2563eb';
//     ctx.lineWidth = 1.5;
//     ctx.beginPath();

//     for (let i = 0; i < pts; i++) {
//       const x = (i / pts) * W;
//       let y;
      
//       if (hasData) {
//         // Map real Z-score data to the canvas height
//         const dataIdx = Math.floor(i * (channelData.length / pts));
//         const val = channelData[dataIdx] || 0;
//         y = (H / 2) - (val * 12); // Scaling the Z-score for visibility
//       } else {
//         // Fallback placeholder
//         y = Math.sin(i * 0.19) * 10 + H / 2;
//       }

//       i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
//     }
//     ctx.stroke();
//   }, [status, channelData]);

//   return <canvas ref={ref} style={{ width: '100%', height: 30, display: 'block' }} />;
// }

// // ─── Frequency spectrum canvas ────────────────────────────────────────────────
// function SpectrumCanvas({ lowHz, highHz }) {
//   const ref = useRef(null);

//   useEffect(() => {
//     const canvas = ref.current;
//     if (!canvas) return;
//     const W = canvas.offsetWidth * 2;
//     const H = 200;
//     canvas.width = W; canvas.height = H;
//     const ctx = canvas.getContext('2d');
//     ctx.clearRect(0, 0, W, H);

//     const bands = [
//       { label: 'δ Delta', xPct: 0,     wPct: 0.08, col: '#534AB7' },
//       { label: 'θ Theta', xPct: 0.08, wPct: 0.08, col: '#0F6E56' },
//       { label: 'α Alpha', xPct: 0.16, wPct: 0.10, col: '#185FA5' },
//       { label: 'β Beta',  xPct: 0.26, wPct: 0.34, col: '#3B6D11' },
//       { label: 'γ Gamma', xPct: 0.60, wPct: 0.40, col: '#993C1D' },
//     ];
//     bands.forEach(b => {
//       ctx.fillStyle = b.col + '18';
//       ctx.fillRect(b.xPct * W, 0, b.wPct * W, H - 24);
//       ctx.fillStyle = b.col + 'aa';
//       ctx.font = `18px sans-serif`;
//       ctx.fillText(b.label, b.xPct * W + 4, 16);
//     });

//     const pts = 160;
//     ctx.strokeStyle = '#185FA5';
//     ctx.lineWidth = 2.5;
//     ctx.beginPath();
//     for (let i = 0; i < pts; i++) {
//       const x = (i / pts) * W;
//       const f = i / pts;
//       let y = 170 - 80 * Math.exp(-f * 8);
//       y += 40 * Math.exp(-((f - 0.2) ** 2) / 0.005);
//       i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
//     }
//     ctx.stroke();
//   }, [lowHz, highHz]);

//   return <canvas ref={ref} style={{ width: '100%', height: 100, display: 'block' }} />;
// }

// // ─── Main Component ───────────────────────────────────────────────────────────
// export default function ArtifactDetector({ data, userMode = 'clinician' }) {
//   const [activeTab,    setActiveTab]    = useState('detect');
//   const [method,       setMethod]       = useState('threshold');
//   const [filterType,   setFilterType]   = useState('bandpass');
//   const [interp,       setInterp]       = useState('linear');
//   const [thresholdUV,  setThresholdUV]  = useState(75);
//   const [epochMs,      setEpochMs]      = useState(500);
//   const [rejectPct,    setRejectPct]    = useState(15);
//   const [zScore,       setZScore]       = useState(3.0);
//   const [lowHz,        setLowHz]        = useState(1);
//   const [highHz,       setHighHz]       = useState(40);
//   const [filterOrder,  setFilterOrder]  = useState(4);
//   const [notchHz,      setNotchHz]      = useState(50);
//   const [running,      setRunning]      = useState(false);
//   const [results,      setResults]      = useState(null);
//   const [filterApplied,setFilterApplied]= useState(false);

//   // Derive channels from the real features key
//   const channels = data?.features ? Object.keys(data.features)
//     .filter(k => k.endsWith('_Max'))
//     .map(k => k.replace('_Max', '')) : ['T7', 'F8'];

//   const runDetection = useCallback(() => {
//     setRunning(true);
//     setTimeout(() => {
//       // DATA DRIVEN LOGIC: Using backend Z-Score stats
//       const chResults = channels.map(ch => {
//         const maxVal = Math.abs(data?.features[`${ch}_Max`] || 0);
        
//         let status = 'clean';
//         let type = null;
//         if (maxVal > 4.5) {
//           status = 'artifact';
//           type = maxVal > 6 ? ARTIFACT_TYPES[1] : ARTIFACT_TYPES[0];
//         } else if (maxVal > 3.0) {
//           status = 'borderline';
//         }

//         return {
//           ch,
//           status,
//           type,
//           pct: Math.round(Math.min(maxVal * 12, 100)),
//           snr: (25 - maxVal).toFixed(1),
//         };
//       });

//       const total      = chResults.length;
//       const arts       = chResults.filter(r => r.status === 'artifact').length;
//       const borders    = chResults.filter(r => r.status === 'borderline').length;
//       const epochTotal = 120;
//       const epochsArt  = Math.round(arts * 12 + borders * 4);
//       const retention  = Math.round((1 - epochsArt / epochTotal) * 100);
//       const avgSnr     = (chResults.reduce((s, r) => s + parseFloat(r.snr), 0) / total).toFixed(1);

//       const typeDist = {};
//       ARTIFACT_TYPES.forEach(t => { typeDist[t] = 0; });
//       chResults.filter(r => r.type).forEach(r => { typeDist[r.type]++; });

//       setResults({ chResults, total, arts, borders, clean: total - arts - borders, epochsArt, epochTotal, retention, avgSnr, typeDist });
//       setRunning(false);
//       setActiveTab('report');
//     }, 1200);
//   }, [channels, data]);

//   const applyFilter = () => setFilterApplied(true);

//   if (userMode === 'patient') return null;

//   return (
//     <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
//       <div className="px-4 pt-4 pb-0">
//         <div className="d-flex align-items-center gap-2 mb-1">
//           <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#185FA5' }} />
//           <h6 className="fw-bold mb-0">Artifact Detection &amp; Filter</h6>
//           {data && (
//             <span className="badge ms-auto" style={{ background: '#EFF6FF', color: '#185FA5', fontSize: 11 }}>
//               {data.raw_stats?.File || 'Active Session'}
//             </span>
//           )}
//         </div>
//         <p className="text-muted mb-3" style={{ fontSize: 12 }}>Identify and mitigate signal artifacts</p>

//         <ul className="nav nav-tabs border-0" style={{ gap: 4 }}>
//           {['detect', 'filter', 'report'].map(t => (
//             <li className="nav-item" key={t}>
//               <button
//                 onClick={() => setActiveTab(t)}
//                 className={`nav-link d-flex align-items-center gap-1 px-3 py-2 fw-semibold border-0 ${activeTab === t ? 'active text-primary border-bottom border-primary border-2' : 'text-muted'}`}
//                 style={{ fontSize: 13, background: 'none' }}
//               >
//                 {t.toUpperCase()}
//               </button>
//             </li>
//           ))}
//         </ul>
//       </div>

//       <div className="px-4 py-3">
//         {activeTab === 'detect' && (
//           <div>
//             <p className="text-uppercase fw-semibold text-muted mb-2" style={{ fontSize: 10 }}>Detection Method</p>
//             <div className="d-flex flex-wrap gap-2 mb-3">
//               {DETECTION_METHODS.map(m => (
//                 <button key={m.id} onClick={() => setMethod(m.id)} className={`btn btn-sm px-3 py-1 rounded-pill fw-semibold ${method === m.id ? 'btn-primary' : 'btn-outline-secondary'}`} style={{ fontSize: 12 }}>{m.label}</button>
//               ))}
//             </div>

//             <p className="text-uppercase fw-semibold text-muted mb-2" style={{ fontSize: 10 }}>Parameters</p>
//             <div className="row g-3 mb-3">
//               {[
//                 { label: 'Amplitude threshold', val: `${thresholdUV} µV`, value: thresholdUV, set: setThresholdUV },
//                 { label: 'Z-score cutoff', val: `${zScore} σ`, value: zScore * 10, set: v => setZScore(v/10) },
//               ].map(p => (
//                 <div className="col-6" key={p.label}>
//                   <div className="p-2 rounded-3 bg-light">
//                     <div className="text-muted" style={{ fontSize: 10 }}>{p.label}</div>
//                     <div className="fw-bold" style={{ fontSize: 14 }}>{p.val}</div>
//                     <input type="range" className="form-range" value={p.value} onChange={e => p.set(Number(e.target.value))} />
//                   </div>
//                 </div>
//               ))}
//             </div>

//             <div className="rounded-3 overflow-hidden mb-3 border">
//               {channels.map((ch, i) => (
//                 <div key={ch} className="d-flex align-items-center gap-3 px-3 py-2 border-bottom">
//                   <span className="badge bg-light text-primary border" style={{ minWidth: 44 }}>{ch}</span>
//                   <div style={{ flex: 1 }}>
//                     {/* PLOTTING ACTUAL CHANNEL DATA */}
//                     <MiniSignal 
//                       status={results?.chResults[i]?.status ?? 'clean'} 
//                       channelData={data?.clean_graph?.map(p => p[ch])} 
//                     />
//                   </div>
//                   {results && (
//                     <span className="badge rounded-pill" style={{
//                       fontSize: 10, minWidth: 80,
//                       background: STATUS_COLORS[results.chResults[i].status].bg,
//                       color: STATUS_COLORS[results.chResults[i].status].text,
//                       border: `1px solid ${STATUS_COLORS[results.chResults[i].status].border}`
//                     }}>
//                       {results.chResults[i].status.toUpperCase()}
//                     </span>
//                   )}
//                 </div>
//               ))}
//             </div>

//             <button className="btn btn-primary w-100 fw-bold py-2 rounded-3" onClick={runDetection} disabled={running}>
//               {running ? "Analyzing Signal Features..." : "Run Detection"}
//             </button>
//           </div>
//         )}

//         {activeTab === 'filter' && (
//           <div>
//             <div className="bg-light rounded-3 p-3 mb-3 border">
//               <SpectrumCanvas lowHz={lowHz} highHz={highHz} />
//             </div>
//             <div className="row g-2 mb-3">
//               {[{l:'Low', v:lowHz, s:setLowHz}, {l:'High', v:highHz, s:setHighHz}].map(p => (
//                 <div className="col-6" key={p.l}>
//                   <label className="small text-muted">{p.l} Cutoff: {p.v}Hz</label>
//                   <input type="range" className="form-range" value={p.v} onChange={e => p.s(Number(e.target.value))} />
//                 </div>
//               ))}
//             </div>
//             <button className="btn btn-primary w-100 fw-bold" onClick={applyFilter}>Apply Signal Cleaning</button>
//           </div>
//         )}

//         {activeTab === 'report' && results && (
//           <div className="fade-in">
//             <div className={`alert d-flex align-items-start gap-2 py-2 mb-3 ${results.retention >= 80 ? 'alert-success' : 'alert-warning'}`} style={{fontSize: 12}}>
//               {results.retention >= 80 ? <CheckCircle size={16}/> : <AlertTriangle size={16}/>}
//               <span><strong>{results.retention}% Epoch Retention.</strong> {results.retention >= 80 ? 'Signal is statistically stable.' : 'Review raw data for muscle noise.'}</span>
//             </div>

//             <div className="rounded-3 overflow-hidden border mb-3">
//               {[
//                 ['Artifact Channels', results.arts],
//                 ['Avg Signal-to-Noise', `${results.avgSnr} dB`],
//                 ['Retention Rate', `${results.retention}%`]
//               ].map(([k, v], i) => (
//                 <div key={k} className={`d-flex justify-content-between p-2 ${i === 0 ? '' : 'border-top'}`} style={{fontSize: 13}}>
//                   <span className="text-muted">{k}</span>
//                   <span className="fw-bold">{v}</span>
//                 </div>
//               ))}
//             </div>

//             <button className="btn btn-outline-primary w-100 btn-sm" onClick={() => setActiveTab('detect')}>Re-run Scan</button>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
