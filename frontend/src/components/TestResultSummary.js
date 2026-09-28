import React from 'react';
import { ClipboardList, CheckCircle, AlertTriangle, Activity } from 'lucide-react';

const TestResultSummary = ({ data }) => {
  if (!data) return null;

  const asymmetry = data.asymmetry_score || 0;
  const dom_freq = data.features['T7_DominantFreq'] || 0;
  const artifacts = data.artifacts || {};
  const isStandardFAA = Boolean(data.faa_details?.standard_frontal_pair);
  const hasArtifact = Boolean(artifacts.ocular_detected || artifacts.muscle_detected);

  const blinkStatus = artifacts.ocular_detected
    ? "Ocular Artifact Flag"
    : "No Major Ocular Artifact";

  let moodStatus = "FAA Near Balanced";
  if (!isStandardFAA) moodStatus = "Experimental Alpha Comparison";
  else if (asymmetry > 0.1) moodStatus = "Positive FAA Direction";
  else if (asymmetry < -0.1) moodStatus = "Negative FAA Direction";

  let alertStatus = "Delta-range Dominant";
  if (dom_freq >= 30) alertStatus = "Gamma-range Dominant";
  else if (dom_freq >= 13) alertStatus = "Beta-range Dominant";
  else if (dom_freq >= 8) alertStatus = "Alpha-range Dominant";
  else if (dom_freq >= 4) alertStatus = "Theta-range Dominant";

  const getSummaryText = () => {
    if (hasArtifact) {
      return "Threshold-level signal artifacts were detected. Review the affected channels before interpreting spectral or asymmetry features.";
    }
    if (!isStandardFAA) {
      return `No threshold-level artifacts were detected. The T7 dominant rhythm is ${dom_freq.toFixed(1)} Hz; the T7/F8 alpha comparison is experimental and is not standard frontal FAA.`;
    }
    return `No threshold-level artifacts were detected. The T7 dominant rhythm is ${dom_freq.toFixed(1)} Hz and the standard frontal FAA pair was available.`;
  };

  return (
    <div className="summary-card">
      <div className="summary-header">
        <div className="summary-icon-box">
          <ClipboardList size={24} color="#2563eb" />
        </div>
        <div>
          <h3>Clinical Interpretation</h3>
          <p className="summary-date">Research Prototype • {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div className="summary-body">
        <p className="summary-text">"{getSummaryText()}"</p>
        <div className="summary-tags">
          <div className="tag"><Activity size={14} /> {blinkStatus}</div>
          <div className="tag"><CheckCircle size={14} /> {moodStatus}</div>
          <div className="tag"><Activity size={14} /> {alertStatus}</div>
        </div>
      </div>

      <div className="recommendation-box">
        <AlertTriangle size={16} color="#d97706" />
        <span><strong>Note:</strong> {hasArtifact ? "Repeat or review the recording before drawing conclusions." : "No major threshold-level artifact was flagged."}</span>
      </div>
    </div>
  );
};

export default TestResultSummary;
