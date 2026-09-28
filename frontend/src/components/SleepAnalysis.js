import React, { useMemo, useState } from 'react';
import axios from 'axios';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock3,
  FileText,
  MoonStar,
  RefreshCw,
  ShieldCheck,
  Upload
} from 'lucide-react';

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000';

/*
  Research context calculated from the expert annotations
  of normal subjects n1, n2 and n3.

  This is not a clinical normal range and is not used by the model.
*/
const PILOT_NORMAL_CONTEXT = {
  subjectCount: 3,
  expertCapEpochFraction: 1094 / 2019
};

const formatNumber = (value, digits = 4) =>
  Number.isFinite(Number(value))
    ? Number(value).toFixed(digits)
    : 'Unavailable';

const formatPercent = (value, digits = 1) =>
  Number.isFinite(Number(value))
    ? `${(Number(value) * 100).toFixed(digits)}%`
    : 'Unavailable';

const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';

  if (bytes >= 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  }

  if (bytes >= 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
};

const buildSignalPoints = (signal) => {
  const times = signal?.time_seconds || [];
  const values = signal?.values || [];
  const pointCount = Math.min(times.length, values.length);

  return Array.from({ length: pointCount }, (_, index) => ({
    time: Number(times[index]),
    amplitude: Number(values[index])
  }));
};

const SleepSignalChart = ({ title, subtitle, points, color }) => (
  <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
    <div className="mb-3">
      <h6 className="fw-bold mb-1">{title}</h6>
      <small className="text-muted">{subtitle}</small>
    </div>

    <div className="sleep-chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={points}
          margin={{ top: 10, right: 24, left: 8, bottom: 16 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#e2e8f0"
          />

          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickFormatter={(value) => Number(value).toFixed(0)}
            label={{
              value: 'Time (seconds)',
              position: 'insideBottom',
              offset: -8
            }}
          />

          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            width={62}
            label={{
              value: 'Amplitude (µV)',
              angle: -90,
              position: 'insideLeft'
            }}
          />

          <Tooltip
            labelFormatter={(value) =>
              `${Number(value).toFixed(2)} seconds`
            }
            formatter={(value) => [
              `${Number(value).toFixed(3)} µV`,
              'Amplitude'
            ]}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #e2e8f0'
            }}
          />

          <Legend verticalAlign="top" height={30} />

          <Line
            type="monotone"
            dataKey="amplitude"
            name={title}
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const SleepAnalysis = ({ data, onAnalysisComplete }) => {
  const [edfFile, setEdfFile] = useState(null);
  const [annotationFile, setAnnotationFile] = useState(null);
  const [maxEpochs, setMaxEpochs] = useState(120);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  // Technical results are displayed first by default.
  const [resultView, setResultView] = useState('technical');

  const rawSignalPoints = useMemo(
    () => buildSignalPoints(data?.signal_preview?.raw_signal),
    [data]
  );

  const cleanedSignalPoints = useMemo(
    () => buildSignalPoints(data?.signal_preview?.cleaned_signal),
    [data]
  );

  const handleAnalyze = async () => {
    if (!edfFile || !annotationFile) {
      setError(
        'Select both the clinical EDF and its paired sleep-stage TXT file.'
      );
      return;
    }

    const formData = new FormData();

    formData.append('edf_file', edfFile);
    formData.append('annotation_file', annotationFile);
    formData.append('max_epochs', String(maxEpochs));
    formData.append('include_epoch_predictions', 'false');

    setLoading(true);
    setError('');
    setUploadProgress(0);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/analyze-sleep`,
        formData,
        {
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              setUploadProgress(
                Math.round(
                  (progressEvent.loaded * 100) / progressEvent.total
                )
              );
            }
          }
        }
      );

      onAnalysisComplete(response.data);
    } catch (requestError) {
      console.error(requestError);

      const detail = requestError.response?.data?.detail;

      setError(
        typeof detail === 'string'
          ? detail
          : 'Sleep analysis failed. Confirm that the backend is running and both files belong to the same recording.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleNewAnalysis = () => {
    setEdfFile(null);
    setAnnotationFile(null);
    setUploadProgress(0);
    setError('');
    setResultView('technical');
    onAnalysisComplete(null);
  };

  /*
    ---------------------------------------------------------
    FILE UPLOAD SCREEN
    ---------------------------------------------------------
  */

  if (!data) {
    return (
      <div className="fade-in">
        <div className="card border-0 shadow-sm rounded-4 p-4 p-lg-5 bg-white">
          <div className="d-flex flex-column flex-lg-row justify-content-between gap-4 mb-4">
            <div className="d-flex align-items-start gap-3">
              <div className="sleep-icon-box">
                <MoonStar size={30} />
              </div>

              <div>
                <h2 className="fw-bold mb-2">
                  Clinical Sleep Analysis
                </h2>

                <p className="text-muted mb-0">
                  Evaluate C4-A1 EEG activity in expert-scored N2
                  and N3 sleep epochs.
                </p>
              </div>
            </div>

            <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle align-self-start px-3 py-2 rounded-pill">
              Research prototype
            </span>
          </div>

          <div
            className="alert alert-info border-0 rounded-4 d-flex gap-3"
            role="alert"
          >
            <ShieldCheck
              size={22}
              className="flex-shrink-0 mt-1"
            />

            <div>
              <strong>Required input:</strong> a clinical EDF
              containing C4-A1 and its matching CAP Sleep
              Database-style TXT annotation. T7/F8 headset data
              is not compatible with this model.
            </div>
          </div>

          <div className="row g-4 my-1">
            <div className="col-lg-6">
              <div
                className={`sleep-file-card ${
                  edfFile ? 'selected' : ''
                }`}
              >
                <Upload size={28} className="text-primary" />

                <div className="flex-grow-1 overflow-hidden">
                  <h6 className="fw-bold mb-1">
                    Clinical EEG recording
                  </h6>

                  <p className="text-muted small mb-2 text-truncate">
                    {edfFile
                      ? `${edfFile.name} · ${formatFileSize(
                          edfFile.size
                        )}`
                      : 'Select an .edf file containing C4-A1'}
                  </p>

                  <input
                    id="sleep-edf-file"
                    type="file"
                    accept=".edf"
                    className="d-none"
                    onChange={(event) => {
                      setEdfFile(
                        event.target.files?.[0] || null
                      );
                      setError('');
                    }}
                  />

                  <label
                    htmlFor="sleep-edf-file"
                    className="btn btn-sm btn-outline-primary rounded-pill px-3"
                  >
                    {edfFile ? 'Change EDF' : 'Choose EDF'}
                  </label>
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div
                className={`sleep-file-card ${
                  annotationFile ? 'selected' : ''
                }`}
              >
                <FileText size={28} className="text-success" />

                <div className="flex-grow-1 overflow-hidden">
                  <h6 className="fw-bold mb-1">
                    Sleep-stage annotation
                  </h6>

                  <p className="text-muted small mb-2 text-truncate">
                    {annotationFile
                      ? `${annotationFile.name} · ${formatFileSize(
                          annotationFile.size
                        )}`
                      : 'Select the matching .txt annotation file'}
                  </p>

                  <input
                    id="sleep-annotation-file"
                    type="file"
                    accept=".txt,text/plain"
                    className="d-none"
                    onChange={(event) => {
                      setAnnotationFile(
                        event.target.files?.[0] || null
                      );
                      setError('');
                    }}
                  />

                  <label
                    htmlFor="sleep-annotation-file"
                    className="btn btn-sm btn-outline-success rounded-pill px-3"
                  >
                    {annotationFile
                      ? 'Change TXT'
                      : 'Choose TXT'}
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="row align-items-end g-3 mt-2">
            <div className="col-lg-4">
              <label
                htmlFor="sleep-max-epochs"
                className="form-label fw-bold small"
              >
                Maximum evenly distributed epochs
              </label>

              <select
                id="sleep-max-epochs"
                className="form-select"
                value={maxEpochs}
                disabled={loading}
                onChange={(event) =>
                  setMaxEpochs(Number(event.target.value))
                }
              >
                <option value={60}>60 epochs — fastest</option>
                <option value={120}>
                  120 epochs — recommended
                </option>
                <option value={240}>240 epochs</option>
                <option value={360}>360 epochs</option>
                <option value={600}>
                  600 epochs — slowest
                </option>
              </select>
            </div>

            <div className="col-lg-8">
              <button
                type="button"
                className="btn btn-primary btn-lg w-100 rounded-pill shadow-sm"
                disabled={
                  loading || !edfFile || !annotationFile
                }
                onClick={handleAnalyze}
              >
                {loading
                  ? uploadProgress < 100
                    ? `Uploading clinical recording… ${uploadProgress}%`
                    : 'Extracting EEG features and running the model…'
                  : 'Run Sleep Analysis'}
              </button>
            </div>
          </div>

          {loading && (
            <div
              className="progress mt-3 sleep-upload-progress"
              role="progressbar"
              aria-valuenow={uploadProgress}
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div
                className="progress-bar progress-bar-striped progress-bar-animated"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}

          {error && (
            <div
              className="alert alert-danger rounded-4 mt-4 mb-0 d-flex gap-2"
              role="alert"
            >
              <AlertTriangle
                size={20}
                className="flex-shrink-0"
              />

              <span>{error}</span>
            </div>
          )}

          <p className="text-muted small mt-4 mb-0">
            Uploaded files are processed temporarily by the
            backend. The result is a CAP A-like research score,
            not an official CAP rate, insomnia probability or
            medical diagnosis.
          </p>
        </div>
      </div>
    );
  }

  /*
    ---------------------------------------------------------
    RESULT DATA
    ---------------------------------------------------------
  */

  const analysis = data.analysis || {};
  const overall = analysis.overall || {};
  const recording = data.recording || {};
  const alignment = data.alignment || {};
  const model = data.model || {};
  const preview = data.signal_preview || {};
  const limitations = data.limitations || [];

  const acceptedEpochs = Number(
    analysis.evaluated_epochs || 0
  );

  const rejectedEpochs = Number(
    analysis.rejected_epochs || 0
  );

  const stages = ['N2', 'N3'];

  const n2Result = analysis.by_stage?.N2 || {};
  const n3Result = analysis.by_stage?.N3 || {};

  const overallFraction = Number(
    overall.predicted_cap_a_like_epoch_fraction || 0
  );

  const overallFlagged = Number(
    overall.predicted_cap_a_like_epochs ??
      (Number(
        n2Result.predicted_cap_a_like_epochs || 0
      ) +
        Number(
          n3Result.predicted_cap_a_like_epochs || 0
        ))
  );

  const n2Fraction = Number(
    n2Result.predicted_cap_a_like_epoch_fraction || 0
  );

  const n3Fraction = Number(
    n3Result.predicted_cap_a_like_epoch_fraction || 0
  );

  const stageDifference = Math.abs(
    n2Fraction - n3Fraction
  );

  const stageMessage =
    stageDifference < 0.03
      ? 'The pattern appeared at a similar rate in lighter N2 sleep and deeper N3 sleep.'
      : n2Fraction > n3Fraction
      ? 'The pattern appeared more often in lighter N2 sleep than in deeper N3 sleep. In the sampled sections, N2 therefore showed more brief sleep-instability-like activity.'
      : 'The pattern appeared more often in deeper N3 sleep than in lighter N2 sleep. In the sampled sections, N3 therefore showed more brief sleep-instability-like activity.';

  const qualityMessage =
    rejectedEpochs === 0
      ? 'All selected sections passed the automatic signal-quality checks.'
      : `${rejectedEpochs} selected section${
          rejectedEpochs === 1 ? '' : 's'
        } could not be used because of signal-quality problems.`;

  /*
    ---------------------------------------------------------
    RESULT SCREEN
    ---------------------------------------------------------
  */

  return (
    <div className="fade-in">
      {/* PAGE HEADER */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1">
            Sleep Analysis Results
          </h2>

          <p className="text-muted mb-0">
            {recording.edf_file || 'Clinical EDF'} ·{' '}
            {recording.channel || 'C4-A1'}
          </p>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          <div
            className="btn-group"
            role="group"
            aria-label="Choose result view"
          >
            <button
              type="button"
              className={`btn ${
                resultView === 'technical'
                  ? 'btn-primary'
                  : 'btn-outline-primary'
              }`}
              onClick={() => setResultView('technical')}
            >
              Technical Results
            </button>

            <button
              type="button"
              className={`btn ${
                resultView === 'simple'
                  ? 'btn-primary'
                  : 'btn-outline-primary'
              }`}
              onClick={() => setResultView('simple')}
            >
              Simple Explanation
            </button>
          </div>

          <button
            type="button"
            onClick={handleNewAnalysis}
            className="btn btn-white rounded-pill px-4 d-flex align-items-center gap-2"
          >
            <RefreshCw
              size={18}
              className="text-primary"
            />

            New Sleep Analysis
          </button>
        </div>
      </div>

      {/* RESEARCH WARNING */}
      <div
        className="alert alert-warning border-0 rounded-4 d-flex gap-3 shadow-sm"
        role="alert"
      >
        <AlertTriangle
          size={22}
          className="flex-shrink-0 mt-1"
        />

        <div>
          <strong>Research-only output.</strong> The score
          identifies EEG epochs that resemble expert-annotated
          CAP A-events in this small pilot dataset. It is not an
          official CAP rate, clinical probability,
          insomnia-risk score or diagnosis.
        </div>
      </div>

      {/* RESULTS HEADING */}
      <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
        <div>
          <span className="badge bg-primary-subtle text-primary mb-2">
            RESULTS
          </span>

          <h4 className="fw-bold mb-1">
            Measured result
          </h4>

          <p className="text-muted small mb-0">
            The numerical findings are shown before their
            interpretation.
          </p>
        </div>
      </div>

      {/* RESULT CARDS */}
      <div className="row g-4 mb-4">
        <div className="col-md-6 col-xl-3">
          <div className="sleep-metric-card sleep-metric-blue">
            <Activity size={23} />

            <div>
              <small>Mean model score</small>

              <h3>
                {formatNumber(
                  overall.mean_cap_like_score,
                  3
                )}
              </h3>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="sleep-metric-card sleep-metric-purple">
            <MoonStar size={23} />

            <div>
              <small>CAP A-like epochs</small>

              <h3>
                {formatPercent(
                  overall.predicted_cap_a_like_epoch_fraction
                )}
              </h3>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="sleep-metric-card sleep-metric-green">
            <CheckCircle size={23} />

            <div>
              <small>Evaluated epochs</small>
              <h3>{acceptedEpochs}</h3>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="sleep-metric-card sleep-metric-orange">
            <ShieldCheck size={23} />

            <div>
              <small>Quality rejections</small>
              <h3>{rejectedEpochs}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* SIMPLE VIEW */}
      {resultView === 'simple' && (
        <div
          className="card border-0 shadow-sm rounded-4 p-4 mb-4"
          style={{ background: '#eff6ff' }}
        >
          <span className="badge bg-primary align-self-start mb-2">
            EASY EXPLANATION
          </span>

          <h4 className="fw-bold mb-2">
            What do these results mean?
          </h4>

          <p className="text-muted mb-4">
            CAP A-like activity means the EEG briefly became
            more active during NREM sleep. These short changes
            can reflect moments when sleep becomes less stable,
            even if the person does not fully wake up. They can
            also occur naturally in normal sleep.
          </p>

          <div className="row g-3 mb-3">
            {/* HOW OFTEN */}
            <div className="col-lg-4">
              <div className="bg-white border rounded-4 p-3 h-100">
                <small className="text-primary fw-bold d-block mb-2">
                  HOW OFTEN?
                </small>

                <h5 className="fw-bold mb-2">
                  {overallFlagged} of {acceptedEpochs} sections
                </h5>

                <p className="mb-0 text-muted">
                  About {Math.round(overallFraction * 10)} out
                  of every 10 sampled N2/N3 sections showed a
                  CAP A-like pattern. This means the pattern was
                  intermittent and was not present throughout
                  every checked section.
                </p>
              </div>
            </div>

            {/* SLEEP STAGE COMPARISON */}
            <div className="col-lg-4">
              <div className="bg-white border rounded-4 p-3 h-100">
                <small className="text-primary fw-bold d-block mb-2">
                  WHICH SLEEP STAGE?
                </small>

                <div className="d-flex justify-content-between mb-2">
                  <span>N2 — lighter sleep</span>
                  <strong>
                    {formatPercent(n2Fraction)}
                  </strong>
                </div>

                <div
                  className="progress mb-3"
                  style={{ height: 8 }}
                >
                  <div
                    className="progress-bar"
                    style={{
                      width: `${Math.min(
                        n2Fraction * 100,
                        100
                      )}%`
                    }}
                  />
                </div>

                <div className="d-flex justify-content-between mb-2">
                  <span>N3 — deeper sleep</span>
                  <strong>
                    {formatPercent(n3Fraction)}
                  </strong>
                </div>

                <div
                  className="progress mb-3"
                  style={{ height: 8 }}
                >
                  <div
                    className="progress-bar bg-info"
                    style={{
                      width: `${Math.min(
                        n3Fraction * 100,
                        100
                      )}%`
                    }}
                  />
                </div>

                <p className="mb-0 text-muted">
                  {stageMessage}
                </p>
              </div>
            </div>

            {/* NORMAL-SLEEP CONTEXT */}
            <div className="col-lg-4">
              <div className="bg-white border rounded-4 p-3 h-100">
                <small className="text-primary fw-bold d-block mb-2">
                  NORMAL-SLEEP CONTEXT
                </small>

                <h5 className="fw-bold mb-2">
                  CAP A activity is not automatically abnormal
                </h5>

                <p className="mb-2 text-muted">
                  In the{' '}
                  {PILOT_NORMAL_CONTEXT.subjectCount} normal
                  recordings used during this pilot, expert
                  annotations marked CAP A-event overlap in
                  approximately{' '}
                  {formatPercent(
                    PILOT_NORMAL_CONTEXT.expertCapEpochFraction,
                    0
                  )}{' '}
                  of N2/N3 sections overall.
                </p>

                <p className="small mb-0 text-muted">
                  Your {formatPercent(overallFraction)} is a
                  model-predicted fraction, while the{' '}
                  {formatPercent(
                    PILOT_NORMAL_CONTEXT.expertCapEpochFraction,
                    0
                  )}{' '}
                  value is an expert-labelled research
                  reference. Because the methods differ and only
                  three normal people were available, this is
                  research context—not a clinical healthy range
                  or a direct better/worse comparison.
                </p>
              </div>
            </div>
          </div>

          {/* FINAL SIMPLE SUMMARY */}
          <div className="bg-white border rounded-4 p-3">
            <strong>Plain-language summary: </strong>

            The program found brief signs of less-settled sleep
            in {overallFlagged} of the {acceptedEpochs} sampled
            N2/N3 sections. {stageMessage} {qualityMessage} This
            result alone cannot confirm or rule out insomnia or
            any other sleep disorder.
          </div>
        </div>
      )}

      {/* TECHNICAL VIEW */}
      {resultView === 'technical' && (
        <>
          <div className="row g-4 mb-4">
            {/* STAGE TABLE */}
            <div className="col-xl-7">
              <div className="card border-0 shadow-sm rounded-4 p-4 h-100">
                <h5 className="fw-bold mb-1">
                  NREM stage comparison
                </h5>

                <p className="text-muted small mb-4">
                  Model summaries are calculated separately for
                  N2 and N3.
                </p>

                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Stage</th>
                        <th>Epochs</th>
                        <th>Mean score</th>
                        <th>Flagged epochs</th>
                        <th>Flagged fraction</th>
                      </tr>
                    </thead>

                    <tbody>
                      {stages.map((stage) => {
                        const stageResult =
                          analysis.by_stage?.[stage];

                        return (
                          <tr key={stage}>
                            <td>
                              <span className="badge bg-primary-subtle text-primary px-3 py-2">
                                {stage}
                              </span>
                            </td>

                            <td>
                              {stageResult?.evaluated_epochs ??
                                0}
                            </td>

                            <td>
                              {formatNumber(
                                stageResult?.mean_cap_like_score,
                                3
                              )}
                            </td>

                            <td>
                              {stageResult?.predicted_cap_a_like_epochs ??
                                0}
                            </td>

                            <td>
                              {formatPercent(
                                stageResult?.predicted_cap_a_like_epoch_fraction
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* RECORDING ALIGNMENT */}
            <div className="col-xl-5">
              <div className="card border-0 shadow-sm rounded-4 p-4 h-100">
                <h5 className="fw-bold mb-4 d-flex align-items-center gap-2">
                  <Clock3
                    size={20}
                    className="text-primary"
                  />

                  Recording alignment
                </h5>

                <dl className="row small mb-0 sleep-detail-list">
                  <dt className="col-7">
                    EDF start time
                  </dt>

                  <dd className="col-5 text-end">
                    {alignment.edf_start_time ||
                      'Unavailable'}
                  </dd>

                  <dt className="col-7">
                    Annotation start
                  </dt>

                  <dd className="col-5 text-end">
                    {alignment.annotation_start_time ||
                      'Unavailable'}
                  </dd>

                  <dt className="col-7">
                    Applied offset
                  </dt>

                  <dd className="col-5 text-end">
                    {formatNumber(
                      alignment.annotation_offset_seconds,
                      1
                    )}{' '}
                    s
                  </dd>

                  <dt className="col-7">
                    Candidate NREM epochs
                  </dt>

                  <dd className="col-5 text-end">
                    {analysis.candidate_nrem_epochs ?? 0}
                  </dd>

                  <dt className="col-7">
                    Selected epochs
                  </dt>

                  <dd className="col-5 text-end">
                    {analysis.selected_epochs ?? 0}
                  </dd>

                  <dt className="col-7">
                    Analysis coverage
                  </dt>

                  <dd className="col-5 text-end">
                    {analysis.partial_analysis
                      ? 'Even subset'
                      : 'All candidates'}
                  </dd>

                  <dt className="col-7">
                    Decision threshold
                  </dt>

                  <dd className="col-5 text-end">
                    {formatNumber(
                      model.decision_threshold,
                      2
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          {/* SIGNAL PREVIEW */}
          {preview.raw_signal &&
            preview.cleaned_signal && (
              <>
                <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
                  <div>
                    <h5 className="fw-bold mb-1">
                      Raw and cleaned C4-A1 preview
                    </h5>

                    <p className="text-muted small mb-0">
                      First accepted{' '}
                      {preview.sleep_stage || 'NREM'} epoch ·
                      Epoch {preview.epoch_index ?? '—'} · 30
                      seconds
                    </p>
                  </div>

                  <span className="badge bg-light text-dark border px-3 py-2">
                    Cleaning: 0.5–35 Hz, resampling and
                    available 50 Hz notch
                  </span>
                </div>

                <div className="row g-4 mb-4">
                  <div className="col-xl-6">
                    <SleepSignalChart
                      title="Raw C4-A1"
                      subtitle={`${formatNumber(
                        preview.raw_signal.sampling_rate,
                        0
                      )} Hz · microvolts`}
                      points={rawSignalPoints}
                      color="#ef4444"
                    />
                  </div>

                  <div className="col-xl-6">
                    <SleepSignalChart
                      title="Cleaned C4-A1"
                      subtitle={`${formatNumber(
                        preview.cleaned_signal.sampling_rate,
                        0
                      )} Hz · microvolts`}
                      points={cleanedSignalPoints}
                      color="#10b981"
                    />
                  </div>
                </div>
              </>
            )}

          {/* METHOD AND LIMITATIONS */}
          <div className="card border-0 shadow-sm rounded-4 p-4 mb-4">
            <h5 className="fw-bold mb-3">
              Method and limitations
            </h5>

            <div className="row g-4">
              <div className="col-lg-5">
                <div className="p-3 bg-light rounded-4 h-100 small">
                  <div className="d-flex justify-content-between py-2 border-bottom">
                    <span className="text-muted">
                      Channel
                    </span>

                    <strong>
                      {recording.channel || 'C4-A1'}
                    </strong>
                  </div>

                  <div className="d-flex justify-content-between py-2 border-bottom">
                    <span className="text-muted">
                      Feature count
                    </span>

                    <strong>
                      {model.feature_count ?? 40}
                    </strong>
                  </div>

                  <div className="d-flex justify-content-between py-2 border-bottom">
                    <span className="text-muted">
                      Model
                    </span>

                    <strong className="text-end ms-3">
                      {model.model_type ||
                        'Logistic regression pipeline'}
                    </strong>
                  </div>

                  <div className="d-flex justify-content-between py-2">
                    <span className="text-muted">
                      CAP labels used at inference
                    </span>

                    <strong>
                      {data.methodology
                        ?.cap_annotation_labels_used_for_prediction
                        ? 'Yes'
                        : 'No'}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="col-lg-7">
                {limitations.length > 0 ? (
                  <ul className="mb-0 ps-3">
                    {limitations.map((limitation) => (
                      <li
                        className="mb-2 text-muted"
                        key={limitation}
                      >
                        {limitation}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted mb-0">
                    This is a small research prototype trained
                    using limited independent subjects. Its
                    output must not be interpreted as a medical
                    diagnosis.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SleepAnalysis;