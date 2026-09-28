import React from "react";
import SensorMap from "./SensorMap";
import { CHANNEL_COLORS } from "./eegData";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Activity,
  Brain,
  CheckCircle2,
  FileCheck2,
  Info,
  Radio,
  ShieldCheck,
  TriangleAlert,
  Waves,
} from "lucide-react";

const DOMINANT_FREQUENCY_SUFFIX = "_DominantFreq";

const FEATURE_SUFFIXES = [
  "_Mean",
  "_Std",
  "_Min",
  "_Max",
  "_Alpha",
  DOMINANT_FREQUENCY_SUFFIX,
];

const formatNumber = (value, digits = 1) => {
  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? numericValue.toFixed(digits)
    : "Not available";
};

/*
  Find channels inside the returned feature object.
  This works even when the channels are in a different order.
*/
const extractChannels = (features = {}) => {
  const channels = new Set();

  Object.keys(features).forEach((featureName) => {
    const suffix = FEATURE_SUFFIXES.find((item) =>
      featureName.endsWith(item)
    );

    if (suffix) {
      channels.add(
        featureName.slice(0, -suffix.length)
      );
    }
  });

  return Array.from(channels);
};

/*
  Find graph channel names from raw_graph and clean_graph.
*/
const getGraphChannels = (
  rawGraph = [],
  cleanGraph = [],
  fallbackChannels = []
) => {
  const names = new Set();

  const firstRawRow = rawGraph[0] || {};
  const firstCleanRow = cleanGraph[0] || {};

  [firstRawRow, firstCleanRow].forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (
        key !== "time" &&
        Number.isFinite(Number(row[key]))
      ) {
        names.add(key);
      }
    });
  });

  fallbackChannels.forEach((channel) => {
    names.add(channel);
  });

  // Do not overcrowd the patient graph.
  return Array.from(names).slice(0, 6);
};

/*
  Show only a short, readable part of the signal.
  A large recording would otherwise look too crowded.
*/
const buildReadablePreview = (
  rows = [],
  seconds = 8,
  maxPoints = 450
) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const firstTime = Number(rows[0]?.time);
  const hasValidTime = Number.isFinite(firstTime);

  const visibleRows = hasValidTime
    ? rows.filter((row) => {
        const currentTime = Number(row.time);

        return (
          Number.isFinite(currentTime) &&
          currentTime <= firstTime + seconds
        );
      })
    : rows;

  const source =
    visibleRows.length > 0 ? visibleRows : rows;

  const step = Math.max(
    1,
    Math.ceil(source.length / maxPoints)
  );

  return source.filter(
    (_, index) => index % step === 0
  );
};

/*
  Find one dominant-frequency value.
*/
const findDominantFrequency = (
  features = {},
  channels = []
) => {
  const preferredOrder = [
    "F3",
    "F4",
    "T7",
    "F8",
    "Cz",
    "P4",
    ...channels,
  ];

  const checked = new Set();

  for (const channel of preferredOrder) {
    if (checked.has(channel)) {
      continue;
    }

    checked.add(channel);

    const value = Number(
      features[
        `${channel}${DOMINANT_FREQUENCY_SUFFIX}`
      ]
    );

    if (Number.isFinite(value)) {
      return {
        channel,
        value,
      };
    }
  }

  const fallbackKey = Object.keys(features).find(
    (key) =>
      key.endsWith(
        DOMINANT_FREQUENCY_SUFFIX
      ) &&
      Number.isFinite(Number(features[key]))
  );

  if (!fallbackKey) {
    return null;
  }

  return {
    channel: fallbackKey.slice(
      0,
      -DOMINANT_FREQUENCY_SUFFIX.length
    ),
    value: Number(features[fallbackKey]),
  };
};

/*
  Create a patient-friendly alpha-comparison explanation.
*/
const getAlphaSummary = ({
  hasFAA,
  asymmetry,
  faaDetails,
}) => {
  if (!hasFAA) {
    return {
      title:
        "A side-to-side comparison was not available",
      summary:
        "The uploaded recording did not contain a supported left and right channel pair for this comparison. Other EEG measurements may still be available.",
      badge: "Unavailable",
      color: "secondary",
    };
  }

  if (
    faaDetails &&
    !faaDetails.standard_frontal_pair
  ) {
    return {
      title:
        "An extra side-to-side comparison was completed",
      summary:
        "The program compared two available electrode signals. The usual forehead pair was not present, so this result is kept only as an experimental measurement. It cannot tell whether the person was relaxed, stressed, focused, healthy or unwell.",
      badge: "Research only",
      color: "warning",
    };
  }

  if (asymmetry > 0.02) {
    return {
      title:
        "A small side-to-side difference was measured",
      summary:
        "The two forehead signals did not have exactly the same alpha activity. This is simply a comparison between two EEG signals. It is not a score for mood, focus, stress or health.",
      badge: "Difference found",
      color: "primary",
    };
  }

  if (asymmetry < -0.02) {
    return {
      title:
        "A small side-to-side difference was measured",
      summary:
        "The two forehead signals did not have exactly the same alpha activity. This is simply a comparison between two EEG signals. It is not evidence of stress, illness or a particular emotional state.",
      badge: "Difference found",
      color: "info",
    };
  }

  return {
    title:
      "The two alpha measurements were quite similar",
    summary:
      "Only a small difference was measured between the two alpha-power values. This result alone cannot determine an emotional, wellness or medical condition.",
    badge: "Small difference",
    color: "secondary",
  };
};

/*
  Patient-friendly graph.
*/
const PatientSignalChart = ({
  title,
  subtitle,
  rows,
  channels,
  cleaned = false,
}) => {
  return (
    <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
      <div className="d-flex align-items-start gap-3 mb-3">
        <div
          className={`p-2 rounded-3 ${
            cleaned
              ? "bg-success-subtle text-success"
              : "bg-warning-subtle text-warning"
          }`}
        >
          {cleaned ? (
            <ShieldCheck size={22} />
          ) : (
            <Waves size={22} />
          )}
        </div>

        <div>
          <h5 className="fw-bold mb-1">
            {title}
          </h5>

          <p className="text-muted small mb-0">
            {subtitle}
          </p>
        </div>
      </div>

      {rows.length > 0 &&
      channels.length > 0 ? (
        <div
          style={{
            width: "100%",
            height: 250,
          }}
        >
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <LineChart
              data={rows}
              margin={{
                top: 8,
                right: 18,
                left: 0,
                bottom: 12,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e7eb"
              />

              <XAxis
                dataKey="time"
                tick={{
                  fontSize: 10,
                  fill: "#64748b",
                }}
                label={{
                  value: "Time",
                  position: "insideBottom",
                  offset: -8,
                }}
              />

              <YAxis
                width={45}
                tick={{
                  fontSize: 10,
                  fill: "#64748b",
                }}
                domain={["auto", "auto"]}
              />

              <Tooltip
                contentStyle={{
                  borderRadius: 10,
                  border:
                    "1px solid #e5e7eb",
                }}
                formatter={(value, name) => [
                  formatNumber(value, 3),
                  name,
                ]}
              />

              <Legend
                verticalAlign="top"
                height={30}
              />

              {channels.map((channel) => (
                <Line
                  key={channel}
                  type="linear"
                  dataKey={channel}
                  name={channel}
                  stroke={
                    CHANNEL_COLORS[channel] ||
                    "#64748b"
                  }
                  strokeWidth={1.25}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="p-4 bg-light rounded-3 text-muted small">
          A graph preview was not returned
          for this recording.
        </div>
      )}
    </div>
  );
};

const PatientView = ({ data }) => {
  if (!data) {
    return null;
  }

  const features = data.features || {};
  const faaDetails =
    data.faa_details || null;

  const rawAsymmetry =
    data.asymmetry_score;

  const hasFAA =
    rawAsymmetry !== null &&
    rawAsymmetry !== undefined &&
    Number.isFinite(
      Number(rawAsymmetry)
    );

  const asymmetry = hasFAA
    ? Number(rawAsymmetry)
    : null;

  const channels =
    extractChannels(features);

  const dominantFrequency =
    findDominantFrequency(
      features,
      channels
    );

  const alphaSummary =
    getAlphaSummary({
      hasFAA,
      asymmetry,
      faaDetails,
    });

  const featureCount =
    Object.keys(features).length;

  const sourceFile =
    data.raw_stats?.File ||
    data.stats?.File ||
    data.file_name ||
    data.filename ||
    "Uploaded EEG recording";

  const rawGraph =
    Array.isArray(data.raw_graph)
      ? data.raw_graph
      : [];

  const cleanGraph =
    Array.isArray(data.clean_graph)
      ? data.clean_graph
      : [];

  const graphChannels =
    getGraphChannels(
      rawGraph,
      cleanGraph,
      channels
    );

  const rawPreview =
    buildReadablePreview(rawGraph);

  const cleanPreview =
    buildReadablePreview(cleanGraph);

  return (
    <div className="fade-in">
      {/* MAIN RESULT BANNER */}
      <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white">
        <div className="d-flex flex-column flex-md-row justify-content-between gap-3">
          <div className="d-flex gap-3 align-items-start">
            <div className="p-3 rounded-4 bg-success-subtle text-success">
              <CheckCircle2 size={28} />
            </div>

            <div>
              <h4 className="fw-bold mb-1">
                Your EEG recording was processed
              </h4>

              <p
                className="text-muted mb-0"
                style={{
                  maxWidth: "760px",
                }}
              >
                NeuroViz found{" "}
                {channels.length ||
                  "the available"}{" "}
                recognised EEG
                {channels.length === 1
                  ? " channel"
                  : " channels"}{" "}
                and calculated general signal
                measurements. The sections below
                explain the results in simple
                language.
              </p>
            </div>
          </div>

          <span className="badge bg-light text-dark border align-self-start px-3 py-2">
            General EEG analysis
          </span>
        </div>
      </div>

      {/* SIMPLE STATUS CARDS */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4 p-3 h-100 bg-white">
            <FileCheck2
              size={22}
              className="text-success mb-2"
            />

            <small className="text-muted fw-bold text-uppercase">
              File processing
            </small>

            <div className="fw-bold mt-1">
              Completed
            </div>

            <small className="text-muted">
              The uploaded EEG file was read
              successfully.
            </small>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4 p-3 h-100 bg-white">
            <Radio
              size={22}
              className="text-primary mb-2"
            />

            <small className="text-muted fw-bold text-uppercase">
              Electrode signals found
            </small>

            <div className="fw-bold mt-1">
              {channels.length ||
                "Not reported"}
            </div>

            <small className="text-muted">
              Signals recognised inside the
              uploaded recording.
            </small>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4 p-3 h-100 bg-white">
            <Waves
              size={22}
              className="text-warning mb-2"
            />

            <small className="text-muted fw-bold text-uppercase">
              Main measured rhythm
            </small>

            <div className="fw-bold mt-1">
              {dominantFrequency
                ? `${formatNumber(
                    dominantFrequency.value
                  )} Hz`
                : "Not available"}
            </div>

            <small className="text-muted">
              {dominantFrequency
                ? `About ${formatNumber(
                    dominantFrequency.value
                  )} repeating waves per second on ${dominantFrequency.channel}.`
                : "No main rhythm value was returned."}
            </small>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4 p-3 h-100 bg-white">
            <ShieldCheck
              size={22}
              className="text-secondary mb-2"
            />

            <small className="text-muted fw-bold text-uppercase">
              Medical diagnosis
            </small>

            <div className="fw-bold mt-1">
              Not provided
            </div>

            <small className="text-muted">
              NeuroViz is an exploratory signal
              analysis tool.
            </small>
          </div>
        </div>
      </div>

      {/* SIMPLE FINDINGS */}
      <div className="row g-4 mb-4">
        <div className="col-lg-7">
          <div
            className={`card border-0 shadow-sm rounded-4 p-4 h-100 bg-white border-start border-4 border-${alphaSummary.color}`}
          >
            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
              <div className="d-flex align-items-center gap-2">
                <Activity
                  size={22}
                  className={`text-${alphaSummary.color}`}
                />

                <h5 className="fw-bold mb-0">
                  What did the program notice?
                </h5>
              </div>

              <span
                className={`badge bg-${alphaSummary.color}${
                  alphaSummary.color ===
                  "warning"
                    ? " text-dark"
                    : ""
                }`}
              >
                {alphaSummary.badge}
              </span>
            </div>

            <h6 className="fw-bold mb-2">
              {alphaSummary.title}
            </h6>

            <p
              className="text-muted mb-3"
              style={{
                lineHeight: 1.65,
              }}
            >
              {alphaSummary.summary}
            </p>

            <div className="p-3 rounded-3 bg-light d-flex gap-2 align-items-start">
              <Info
                size={18}
                className="text-primary flex-shrink-0 mt-1"
              />

              <div className="small text-dark">
                {dominantFrequency
                  ? `The strongest repeating pattern was approximately ${formatNumber(
                      dominantFrequency.value
                    )} waves per second on ${dominantFrequency.channel}. This describes the signal's speed; it is not a health score.`
                  : "A main-frequency measurement was not available for this recording."}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
            <h5 className="fw-bold mb-3">
              What was checked?
            </h5>

            {[
              "Which electrode signals were present in the uploaded file",
              "The signal's general range and variation",
              "Different types of repeating EEG activity",
              "The strongest repeating signal frequency",
              "A side-to-side comparison when a suitable pair was available",
              "Possible signs of movement or recording noise",
            ].map((item) => (
              <div
                key={item}
                className="d-flex gap-2 align-items-start mb-2"
              >
                <CheckCircle2
                  size={16}
                  className="text-success flex-shrink-0 mt-1"
                />

                <span className="small text-dark">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RAW AND CLEANED SIGNAL EXPLANATION */}
      <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white">
        <div className="mb-4">
          <h4 className="fw-bold mb-2">
            How to understand your EEG graphs
          </h4>

          <p className="text-muted mb-0">
            Each coloured line comes from an
            electrode placed at a different
            location. Moving from left to right
            shows time passing. Moving up or down
            shows the changing electrical signal
            strength. A wavy or uneven EEG line is
            normal because brain signals change
            many times every second.
          </p>

          <p className="small text-primary mt-2 mb-0">
            Note: The two graphs use different vertical scales. The raw graph has a much
            larger amplitude range, so its smaller changes appear compressed. The cleaned
            graph is normalized around zero, making its remaining EEG changes easier to see.
          </p>
        </div>

        <div className="row g-4 mb-4">
          <div className="col-xl-6">
            <PatientSignalChart
              title="Raw recording — before cleaning"
              subtitle="This is the signal exactly as it came from the uploaded file. It can contain brain activity together with blinking, movement, loose-electrode effects and electrical interference."
              rows={rawPreview}
              channels={graphChannels}
            />
          </div>

          <div className="col-xl-6">
            <PatientSignalChart
              title="Cleaned recording — after noise reduction"
              subtitle="This is the same recording after common unwanted noise was reduced. It is easier to analyse, but it should still look wavy rather than perfectly smooth or flat."
              rows={cleanPreview}
              channels={graphChannels}
              cleaned
            />
          </div>
        </div>

        <div className="row g-3">
          <div className="col-md-4">
            <div className="p-3 rounded-4 bg-light h-100">
              <h6 className="fw-bold mb-2">
                What changed?
              </h6>

              <p className="small text-muted mb-0">
                Cleaning reduces slow drifting,
                electrical hum and some sudden
                noise. It does not replace the
                original recording or create new
                brain activity.
              </p>
            </div>
          </div>

          <div className="col-md-4">
            <div className="p-3 rounded-4 bg-light h-100">
              <h6 className="fw-bold mb-2">
                Why are there still spikes?
              </h6>

              <p className="small text-muted mb-0">
                Real EEG is naturally irregular.
                Some peaks may be brain activity,
                while others may come from
                blinking, muscle movement or
                electrode contact. One spike alone
                does not show a disease.
              </p>
            </div>
          </div>

          <div className="col-md-4">
            <div className="p-3 rounded-4 bg-light h-100">
              <h6 className="fw-bold mb-2">
                Which graph is used?
              </h6>

              <p className="small text-muted mb-0">
                The cleaned signal is used for
                measurements because common noise
                has been reduced. The raw graph
                remains visible so the original
                input can still be checked.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* LIMITATION */}
      <div className="alert alert-warning border-0 rounded-4 p-4 d-flex gap-3 align-items-start mb-4">
        <TriangleAlert
          size={24}
          className="flex-shrink-0"
        />

        <div>
          <div className="fw-bold mb-1">
            Important limitation
          </div>

          <div>
            This general EEG result does not
            diagnose insomnia, depression,
            anxiety, palsy, epilepsy or another
            medical condition. EEG measurements
            can be affected by movement, electrode
            placement, signal quality and recording
            conditions. Medical interpretation
            requires a qualified professional.
          </div>
        </div>
      </div>

      {/* SENSOR MAP */}
      <div className="mb-4">
        <div className="d-flex align-items-center gap-2 mb-3">
          <Brain
            size={21}
            className="text-primary"
          />

          <div>
            <h5 className="fw-bold mb-0">
              Where were the signals recorded?
            </h5>

            <small className="text-muted">
              The coloured points show recognised
              electrode locations. The colours are
              used to separate the signals and are
              not health warnings.
            </small>
          </div>
        </div>

        <SensorMap data={data} />
      </div>

      {/* OPTIONAL TECHNICAL DETAILS */}
      <details className="card border-0 shadow-sm rounded-4 bg-white mb-4">
        <summary
          className="p-4 fw-bold"
          style={{
            cursor: "pointer",
          }}
        >
          View technical details
        </summary>

        <div className="px-4 pb-4">
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <tbody>
                <tr>
                  <th className="text-muted fw-medium">
                    Source file
                  </th>

                  <td>{sourceFile}</td>
                </tr>

                <tr>
                  <th className="text-muted fw-medium">
                    Detected channels
                  </th>

                  <td>
                    {channels.length
                      ? channels.join(", ")
                      : "Not reported"}
                  </td>
                </tr>

                <tr>
                  <th className="text-muted fw-medium">
                    Returned feature values
                  </th>

                  <td>{featureCount}</td>
                </tr>

                <tr>
                  <th className="text-muted fw-medium">
                    FAA score
                  </th>

                  <td>
                    {hasFAA
                      ? formatNumber(
                          asymmetry,
                          4
                        )
                      : "Not available"}
                  </td>
                </tr>

                <tr>
                  <th className="text-muted fw-medium">
                    FAA channel pair
                  </th>

                  <td>
                    {faaDetails?.pair_label ||
                      "Not reported"}
                  </td>
                </tr>

                <tr>
                  <th className="text-muted fw-medium">
                    FAA pair type
                  </th>

                  <td>
                    {faaDetails
                      ? faaDetails.standard_frontal_pair
                        ? "Standard frontal pair"
                        : "Experimental fallback pair"
                      : "Not reported"}
                  </td>
                </tr>

                <tr>
                  <th className="text-muted fw-medium">
                    Dominant frequency
                  </th>

                  <td>
                    {dominantFrequency
                      ? `${formatNumber(
                          dominantFrequency.value
                        )} Hz (${dominantFrequency.channel})`
                      : "Not available"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {faaDetails?.quality_note && (
            <div className="small text-muted mt-3">
              FAA note:{" "}
              {faaDetails.quality_note}
            </div>
          )}
        </div>
      </details>
    </div>
  );
};

export default PatientView;