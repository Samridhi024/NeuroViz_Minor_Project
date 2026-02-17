import React from 'react';
import { ClipboardList, CheckCircle, AlertTriangle, Activity } from 'lucide-react';

const TestResultSummary = ({ data }) => {
  if (!data) return null;

  const f8_std = data.features['F8_Std'] || 0;
  const asymmetry = data.asymmetry_score || 0;
  const dom_freq = data.features['T7_DominantFreq'] || 0;

  let blinkStatus = "Stable Gaze";
  if (f8_std > 20) blinkStatus = "High Ocular Activity";
  else if (f8_std > 10) blinkStatus = "Moderate Blinking";

  let moodStatus = "Neutral / Balanced";
  if (asymmetry > 0.1) moodStatus = "Positive Approach (Left-Brain)";
  else if (asymmetry < -0.1) moodStatus = "Withdrawal (Right-Brain)";

  let alertStatus = "Drowsy / Deep Relaxation";
  if (dom_freq > 12) alertStatus = "Active / Alert (Beta)";
  else if (dom_freq >= 8) alertStatus = "Relaxed (Alpha)";

  const getSummaryText = () => {
    if (f8_std > 20 && asymmetry < 0) {
      return "Subject indicates signs of restlessness or fatigue, characterized by frequent ocular artifacts (blinking) and right-hemispheric dominance. Suggest a short break.";
    }
    if (asymmetry > 0 && dom_freq >= 8) {
      return "Subject is in a highly functional state. Alpha asymmetry indicates positive engagement (Approach behavior), supported by a stable Alpha rhythm suggesting relaxed focus.";
    }
    return "Subject shows a baseline resting state. Neural rhythms are within normal ranges, though occasional ocular artifacts were detected in the frontal lobe.";
  };

  return (
    <div className="summary-card">
      <div className="summary-header">
        <div className="summary-icon-box">
          <ClipboardList size={24} color="#2563eb" />
        </div>
        <div>
          <h3>Clinical Interpretation</h3>
          <p className="summary-date">Automated Report • {new Date().toLocaleDateString()}</p>
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
        <span><strong>Rx:</strong> {f8_std > 15 ? "Reduce movement artifacts. Ensure subject is seated." : "Continue monitoring trends."}</span>
      </div>
    </div>
  );
};

export default TestResultSummary;