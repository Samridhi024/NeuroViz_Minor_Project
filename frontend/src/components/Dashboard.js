import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Label,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Upload,
} from "lucide-react";

import ArtifactDetector from "./ArtifactDetector";
import PatientView from "./PatientView";
import RawSignalView from "./RawSignalView";
import SensorMap from "./SensorMap";
import { getChannelColor } from "./eegData";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  "http://127.0.0.1:8000";

const Dashboard = ({
  data,
  onAnalysisComplete,
  showCleaned,
  userMode,
}) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const [visibleChannels, setVisibleChannels] =
    useState({});

  const [mappingRequest, setMappingRequest] =
    useState(null);

  const [manualMapping, setManualMapping] =
    useState({});

  const [uploadError, setUploadError] =
    useState("");

  // --------------------------------------------------
  // FIND AVAILABLE CHANNELS
  // --------------------------------------------------

  const availableChannels = useMemo(() => {
    if (
      Array.isArray(data?.available_channels) &&
      data.available_channels.length > 0
    ) {
      return data.available_channels;
    }

    const firstPoint = data?.clean_graph?.[0] || {};

    return Object.keys(firstPoint).filter(
      (key) => key !== "time"
    );
  }, [data]);

  // --------------------------------------------------
  // DISPLAY ONLY FIRST CHANNEL INITIALLY
  // --------------------------------------------------

  useEffect(() => {
    setVisibleChannels(
      Object.fromEntries(
        availableChannels.map((channel, index) => [
          channel,
          index === 0,
        ])
      )
    );
  }, [availableChannels]);

  // Eight pixels per displayed point.
  // Prevents the entire signal from being compressed.
  const cleanedChartWidth = Math.max(
    1400,
    (data?.clean_graph?.length || 0) * 8
  );

  // --------------------------------------------------
  // FILE HANDLING
  // --------------------------------------------------

  const handleFileChange = (event) => {
    setFile(event.target.files?.[0] || null);
    setMappingRequest(null);
    setManualMapping({});
    setUploadError("");
  };

  const toggleChannel = (channel) => {
    setVisibleChannels((previous) => ({
      ...previous,
      [channel]: !previous[channel],
    }));
  };

  const handleMappingChange = (
    channel,
    column
  ) => {
    setManualMapping((previous) => ({
      ...previous,
      [channel]: column,
    }));

    setUploadError("");
  };

  const handleNewAnalysis = () => {
    setFile(null);
    setMappingRequest(null);
    setManualMapping({});
    setUploadError("");

    onAnalysisComplete(null);
  };

  // --------------------------------------------------
  // UPLOAD EEG
  // --------------------------------------------------

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setUploadError("");

    const formData = new FormData();

    formData.append("file", file);

    if (mappingRequest) {
      const confirmedMapping =
        Object.fromEntries(
          Object.entries(manualMapping).filter(
            ([, column]) => column
          )
        );

      formData.append(
        "channel_mapping",
        JSON.stringify(confirmedMapping)
      );
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/analyze`,
        formData
      );

      setMappingRequest(null);

      onAnalysisComplete(response.data);
    } catch (error) {
      console.error(error);

      const detail =
        error.response?.data?.detail;

      if (
        error.response?.status === 422 &&
        detail?.code ===
          "CHANNEL_MAPPING_REQUIRED"
      ) {
        setMappingRequest(detail);
        setUploadError(detail.message);
      } else {
        setUploadError(
          typeof detail === "string"
            ? detail
            : "Analysis failed. Confirm that the backend is running and check its terminal."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // MANUAL CHANNEL MAPPING
  // --------------------------------------------------

  const mappingTargets = [
    "T7",
    "F8",
    "Cz",
    "P4",
    "F3",
    "F4",
  ];

  const selectedColumns =
    Object.values(manualMapping).filter(Boolean);

  const mappingReady = Boolean(
    manualMapping.T7 &&
      manualMapping.F8 &&
      manualMapping.T7 !== manualMapping.F8 &&
      new Set(selectedColumns).size ===
        selectedColumns.length
  );

  // --------------------------------------------------
  // UPLOAD SCREEN
  // --------------------------------------------------

  if (!data) {
    return (
      <div className="card border-0 shadow-sm rounded-4 p-5 text-center align-items-center mt-5 bg-white">
        <div className="bg-primary bg-opacity-10 rounded-circle p-4 mb-3">
          <Upload
            size={48}
            className="text-primary"
          />
        </div>

        <h3 className="fw-bold mb-2 text-dark">
          Analyze EEG Recording
        </h3>

        <p className="text-muted mb-4">
          TXT/CSV headset recordings and clinical
          EDF preview are supported.
        </p>

        <input
          type="file"
          id="file"
          className="d-none"
          accept=".edf,.txt,.csv"
          onChange={handleFileChange}
        />

        <label
          htmlFor="file"
          className="btn btn-outline-primary btn-lg px-5 rounded-pill shadow-sm mb-3"
        >
          {file ? file.name : "Select File"}
        </label>

        {uploadError && (
          <div className="alert alert-warning w-100 text-start">
            {uploadError}
          </div>
        )}

        {mappingRequest && (
          <div className="card border-warning bg-light w-100 p-4 mb-3 text-start">
            <h5 className="fw-bold mb-2">
              Confirm EEG Channel Mapping
            </h5>

            <p className="text-muted small mb-3">
              This TXT/CSV uses generic column names.
              T7 and F8 are required for the submitted
              two-channel workflow. Other channels are
              optional.
            </p>

            <div className="row g-3">
              {mappingTargets.map((channel) => (
                <div
                  className="col-md-6"
                  key={channel}
                >
                  <label className="form-label small fw-bold">
                    {channel}

                    {["T7", "F8"].includes(
                      channel
                    ) && (
                      <span className="text-danger">
                        *
                      </span>
                    )}
                  </label>

                  <select
                    className="form-select"
                    value={
                      manualMapping[channel] || ""
                    }
                    onChange={(event) =>
                      handleMappingChange(
                        channel,
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Not selected
                    </option>

                    {mappingRequest.available_columns.map(
                      (column) => (
                        <option
                          key={column}
                          value={column}
                          disabled={
                            selectedColumns.includes(
                              column
                            ) &&
                            manualMapping[channel] !==
                              column
                          }
                        >
                          {column.trim()}
                        </option>
                      )
                    )}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {file && (
          <button
            type="button"
            onClick={handleUpload}
            className="btn btn-primary btn-lg w-100 rounded-pill shadow"
            disabled={
              loading ||
              (mappingRequest && !mappingReady)
            }
          >
            {loading
              ? "Processing..."
              : mappingRequest
              ? "Analyze with Confirmed Mapping"
              : "Run Analysis"}
          </button>
        )}
      </div>
    );
  }

  // --------------------------------------------------
  // ANALYSIS VALUES
  // --------------------------------------------------

  const faaAvailable =
    data?.faa_details?.mode !== "unavailable";

  const referenceChannel =
    data?.raw_stats?.reference_channel ||
    availableChannels[0];

  // Patient view is available only if FAA exists.
  if (
    userMode === "patient" &&
    faaAvailable
  ) {
    return <PatientView data={data} />;
  }

  // --------------------------------------------------
  // CLINICIAN RESULTS
  // --------------------------------------------------

  return (
    <div className="fade-in">
      {/* HEADER */}

      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold mb-0 text-dark">
            Analysis Results
          </h2>

          <span className="text-muted small font-monospace">
            FILE:{" "}
            {data.raw_stats?.File ||
              "LOCAL_STREAM"}
          </span>
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

          New Analysis
        </button>
      </div>

      {/* ANALYSIS SCOPE */}

      {data.analysis_scope?.message && (
        <div className="alert alert-info border-0 shadow-sm rounded-4 mb-4">
          <strong>Analysis scope:</strong>{" "}
          {data.analysis_scope.message}
        </div>
      )}

      {/* CHANNEL MAPPING */}

      {data.channel_mapping?.channels && (
        <div className="alert alert-light border shadow-sm rounded-4 d-flex flex-wrap align-items-center gap-2 mb-4">
          <strong>
            Detected EEG channels:
          </strong>

          {Object.entries(
            data.channel_mapping.channels
          ).map(([channel, source]) => (
            <span
              className="badge bg-white text-dark border"
              key={channel}
            >
              {channel} ← {source.trim()}
            </span>
          ))}
        </div>
      )}

      {/* RAW VIEW */}

      {!showCleaned ? (
        <div className="row g-4">
          <div
            className={
              data.artifacts?.compatible === false
                ? "col-12"
                : "col-lg-8"
            }
          >
            <h4 className="fw-bold text-danger mb-4 d-flex align-items-center gap-2">
              <AlertTriangle size={24} />

              Raw Input Monitor
            </h4>

            <RawSignalView
              data={data.raw_graph}
              stats={data.raw_stats}
              features={data.features}
              scope={data.analysis_scope}
            />
          </div>

          {data.artifacts?.compatible !==
            false && (
            <div className="col-lg-4">
              <ArtifactDetector
                data={data}
                userMode={userMode}
              />
            </div>
          )}

          {data.artifacts?.compatible ===
            false && (
            <div className="col-12">
              <div className="alert alert-secondary rounded-4 mb-0">
                The submitted artifact detector
                requires exact T7 and F8 signals.
                It is unavailable for this clinical
                montage. The detected channels are
                still extracted, cleaned and
                measured normally.
              </div>
            </div>
          )}
        </div>
      ) : (
        // --------------------------------------------------
        // CLEANED SIGNAL VIEW
        // --------------------------------------------------

        <div className="row g-4">
          <div className="col-lg-8 col-12">
            <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h5 className="fw-bold mb-1 text-success d-flex align-items-center gap-2">
                    <CheckCircle size={20} />

                    Processed Signal Overview
                  </h5>

                  <p className="text-muted small mb-0">
                    Bandpass 0.5–45 Hz • optional
                    50 Hz notch • Z-score
                  </p>
                </div>

                {/* CHANNEL BUTTONS */}

                <div className="d-flex flex-wrap gap-1">
                  {availableChannels.map(
                    (channel) => (
                      <button
                        type="button"
                        key={channel}
                        className={`btn btn-sm ${
                          visibleChannels[channel]
                            ? "btn-white shadow-sm"
                            : "btn-light text-muted"
                        }`}
                        onClick={() =>
                          toggleChannel(channel)
                        }
                      >
                        <span
                          className="me-1"
                          style={{
                            color:
                              getChannelColor(
                                channel
                              ),
                          }}
                        >
                          ●
                        </span>

                        {channel}
                      </button>
                    )
                  )}
                </div>
              </div>

              <p className="small text-muted mb-2">
                One channel is displayed initially.
                Select another channel only when you
                want to compare them.
              </p>

              {/* WIDE SCROLLABLE GRAPH */}

              <div
                style={{
                  width: "100%",
                  height: 410,
                  overflowX: "auto",
                  overflowY: "hidden",
                  border:
                    "1px solid #e5e7eb",
                  borderRadius: 12,
                  background: "#ffffff",
                }}
              >
                <AreaChart
                  width={cleanedChartWidth}
                  height={390}
                  data={data.clean_graph}
                  margin={{
                    top: 10,
                    right: 30,
                    left: 15,
                    bottom: 40,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f3f4f6"
                  />

                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11 }}
                  >
                    <Label
                      value="Time (seconds)"
                      position="insideBottom"
                      offset={-18}
                    />
                  </XAxis>

                  <YAxis
                    domain={[-50, 50]}
                    tick={{ fontSize: 11 }}
                    width={55}
                  >
                    <Label
                      value="Amplitude (Z-score)"
                      angle={-90}
                      position="insideLeft"
                    />
                  </YAxis>

                  <Tooltip
                    labelFormatter={(value) =>
                      `${Number(value).toFixed(
                        2
                      )} seconds`
                    }
                    formatter={(
                      value,
                      name
                    ) => [
                      Number(value).toFixed(4),
                      name,
                    ]}
                    contentStyle={{
                      borderRadius: 10,
                      border: "none",
                      boxShadow:
                        "0 4px 12px rgba(0,0,0,0.12)",
                    }}
                  />

                  {availableChannels.map(
                    (channel) =>
                      visibleChannels[channel] && (
                        <Area
                          key={channel}
                          type="linear"
                          dataKey={channel}
                          stroke={getChannelColor(
                            channel
                          )}
                          fill={getChannelColor(
                            channel
                          )}
                          fillOpacity={0.04}
                          strokeWidth={1.5}
                          dot={false}
                          isAnimationActive={
                            false
                          }
                          name={channel}
                        />
                      )
                  )}
                </AreaChart>
              </div>

              <p className="text-muted small mt-2 mb-0">
                Scroll horizontally to inspect the
                separated signal points.
              </p>
            </div>
          </div>

          {/* SENSOR MAP */}

          <div className="col-lg-4 col-12">
            <SensorMap data={data} />
          </div>

          {/* PEAK AMPLITUDE */}

          <div className="col-md-6">
            <div className="card border-0 shadow-sm rounded-4 p-4 h-100 border-bottom border-4 border-primary">
              <h6 className="text-muted small text-uppercase fw-bold">
                Peak normalized amplitude (
                {referenceChannel})
              </h6>

              <h3 className="fw-bold mb-0">
                {Number.isFinite(
                  data.features?.[
                    `${referenceChannel}_Max`
                  ]
                )
                  ? data.features[
                      `${referenceChannel}_Max`
                    ].toFixed(2)
                  : "Unavailable"}
              </h3>
            </div>
          </div>

          {/* FAA */}

          <div className="col-md-6">
            <div className="card border-0 shadow-sm rounded-4 p-4 h-100 border-bottom border-4 border-success">
              <h6 className="text-muted small text-uppercase fw-bold">
                Frontal Alpha Asymmetry
              </h6>

              <h3 className="fw-bold mb-1">
                {Number.isFinite(
                  data.asymmetry_score
                )
                  ? data.asymmetry_score.toFixed(
                      3
                    )
                  : "Unavailable"}
              </h3>

              <small className="text-muted">
                {faaAvailable
                  ? data.faa_details
                      ?.quality_note
                  : "Needs exact F3/F4 or T7/F8 channels."}
              </small>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;