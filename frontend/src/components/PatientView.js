import React from 'react';
import SensorMap from './SensorMap';
import { Zap, Heart, Info, BookOpen, Sun, Moon, Coffee } from 'lucide-react';

const PatientView = ({ data }) => {
  if (!data) return null;

  // ─── Data Extraction ───────────────────────────────────────────────────────
  const asymmetry = data.asymmetry_score || 0;
  const focusScore = data.features?.['T7_DominantFreq'] || 0;
  const alphaIntensity = data.features?.['T7_Alpha'] || 0; 

  // ─── Wellness Logic (Thresholds for Z-Score Data) ──────────────────────────
  const getWellnessSummary = () => {
    if (asymmetry > 0.02) {
      return {
        title: "You are in the 'Zone'!",
        summary: "Your brain shows high approach motivation! You are feeling 'Engaged' and 'Proactive.' This is the perfect state for creative problem solving or focused learning.",
        icon: <Zap className="text-primary" size={32} />,
        statusText: "Engaged",
        colorClass: "text-primary",
        borderClass: "border-primary"
      };
    } 
    else if (asymmetry < -0.02) {
      return {
        title: "Time for a Mental Break",
        summary: "We notice a slight shift toward right-frontal dominance. This usually happens when the brain feels overwhelmed. A quick 2-minute breathing exercise could help reset your focus.",
        icon: <Moon className="text-info" size={32} />,
        statusText: "Reflective",
        colorClass: "text-info",
        borderClass: "border-info"
      };
    } 
    else if (alphaIntensity > 1.1) {
        return {
          title: "Deeply Relaxed",
          summary: "Strong Alpha rhythms detected! Your mind is in a very calm, resting state—similar to light meditation. This is ideal for recovery and visualization.",
          icon: <Coffee className="text-secondary" size={32} />,
          statusText: "Relaxed",
          colorClass: "text-secondary",
          borderClass: "border-secondary"
        };
    }
    return {
      title: "Your Brain is Balanced",
      summary: "Your brain waves are in a steady, resting state. You aren't over-stressed, but you aren't over-exerted either. It's a great time for routine tasks or light reading.",
      icon: <Sun className="text-warning" size={32} />,
      statusText: "Neutral",
      colorClass: "text-warning",
      borderClass: "border-warning"
    };
  };

  const wellness = getWellnessSummary();

  // ─── Dynamic Progress Math ────────────────────────────────────────────────
  // This ensures the bar moves based on the "Engaged" dataset
  const baseSpeed = (focusScore - 7) * 8;      
  const engagementBoost = asymmetry * 150;    
  const mentalLoadPct = Math.min(95, Math.max(10, baseSpeed + engagementBoost + 35));

  return (
    <div className="row g-4 fade-in">
      <div className="col-lg-7 col-12">
        <SensorMap data={data} />
      </div>

      <div className="col-lg-5 col-12 d-flex flex-column gap-3">
        {/* Quick Stats Grid */}
        <div className="row g-3">
            <div className="col-6">
                <div className="card border-0 shadow-sm rounded-4 p-3 bg-white text-center">
                    <Heart size={24} className={`${wellness.colorClass} mx-auto mb-2`} />
                    <small className="text-muted d-block small fw-bold">EMOTIONAL BIAS</small>
                    <span className="fw-bold">{wellness.statusText}</span>
                </div>
            </div>
            <div className="col-6">
                <div className="card border-0 shadow-sm rounded-4 p-3 bg-white text-center">
                    <Zap size={24} className="text-warning mx-auto mb-2" />
                    <small className="text-muted d-block small fw-bold">MENTAL SPEED</small>
                    <span className="fw-bold">{focusScore.toFixed(1)} Hz</span>
                </div>
            </div>
        </div>

        {/* Dynamic Summary Box */}
        <div className={`card border-0 shadow-sm rounded-4 p-4 bg-white border-start border-4 ${wellness.borderClass}`}>
          <div className="d-flex align-items-center gap-3 mb-3">
            <div className="p-2 bg-light rounded-3">
                {wellness.icon}
            </div>
            <h5 className="fw-bold mb-0 text-dark">{wellness.title}</h5>
          </div>
          
          <div className="p-3 rounded-4 bg-light border-0">
            <p className="text-dark mb-0 leading-relaxed" style={{ fontSize: '1rem', lineHeight: '1.6' }}>
                <BookOpen size={18} className="me-2 text-primary mb-1" />
                {wellness.summary}
            </p>
          </div>
        </div>

        {/* ─── Static Progress Gauge (No Animation) ─── */}
        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="fw-bold text-muted text-uppercase small mb-0">Cognitive Engagement</h6>
            <span className={`badge ${asymmetry > 0.02 ? 'bg-primary' : 'bg-light text-dark'}`}>
                {Math.round(mentalLoadPct)}%
            </span>
          </div>
          
          <div className="progress" style={{height: '14px', borderRadius: '10px', backgroundColor: '#f0f0f0'}}>
            <div 
              className={`progress-bar ${asymmetry > 0.02 ? 'bg-primary' : 'bg-info'}`} 
              style={{
                width: `${mentalLoadPct}%`,
                transition: 'width 0.5s ease' // Standard simple transition
              }}
            ></div>
          </div>
          
          <div className="d-flex justify-content-between mt-2 small text-muted fw-medium">
            <span>Relaxed</span>
            <span className={asymmetry > 0.02 ? "text-primary fw-bold" : ""}>Active / Engaged</span>
          </div>
        </div>

        <div className="mt-auto d-flex align-items-center gap-2 text-muted small px-2">
            <Info size={14} />
            <span>FAA Score: <strong>{asymmetry.toFixed(4)}</strong></span>
        </div>
      </div>
    </div>
  );
};

export default PatientView;

// import React from 'react';
// import SensorMap from './SensorMap';
// import { Zap, Heart, Info, BookOpen, Sun, Moon, Coffee } from 'lucide-react';

// const PatientView = ({ data }) => {
//   if (!data) return null;

//   // ─── Data Extraction ───────────────────────────────────────────────────────
//   const asymmetry = data.asymmetry_score || 0;
//   const focusScore = data.features?.['T7_DominantFreq'] || 0;
//   const alphaIntensity = data.features?.['T7_Alpha'] || 0; 

//   // ─── Wellness Logic (Recalibrated for Z-Scores) ───────────────────────────
//   const getWellnessSummary = () => {
//     // 1. HIGH ENGAGEMENT / APPROACH (Left-Frontal Dominance)
//     // Lowered to 0.02 to detect subtle positive shifts in normalized data
//     if (asymmetry > 0.02) {
//       return {
//         title: "You are in the 'Zone'!",
//         summary: "Your brain shows high approach motivation! You are feeling 'Engaged' and 'Proactive.' This is the perfect state for creative problem solving or focused learning.",
//         icon: <Zap className="text-primary" size={32} />,
//         borderClass: "border-primary"
//       };
//     } 
    
//     // 2. STRESS / WITHDRAWAL (Right-Frontal Dominance)
//     // Threshold set to -0.02 to catch early signs of mental fatigue
//     else if (asymmetry < -0.02) {
//       return {
//         title: "Time for a Mental Break",
//         summary: "We notice a slight shift toward right-frontal dominance. This usually happens when the brain feels overwhelmed. A quick 2-minute breathing exercise could help reset your focus.",
//         icon: <Moon className="text-info" size={32} />,
//         borderClass: "border-info"
//       };
//     } 

//     // 3. DEEP RELAXATION (High Alpha Power)
//     // Since data is Z-scored, an intensity > 1.1 indicates alpha is the dominant rhythm
//     else if (alphaIntensity > 1.1) {
//         return {
//           title: "Deeply Relaxed",
//           summary: "Strong Alpha rhythms detected! Your mind is in a very calm, resting state—similar to light meditation. This is ideal for recovery and visualization.",
//           icon: <Coffee className="text-secondary" size={32} />,
//           borderClass: "border-secondary"
//         };
//     }

//     // 4. BALANCED (Fallback)
//     return {
//       title: "Your Brain is Balanced",
//       summary: "Your brain waves are in a steady, resting state. You aren't over-stressed, but you aren't over-exerted either. It's a great time for routine tasks or light reading.",
//       icon: <Sun className="text-warning" size={32} />,
//       borderClass: "border-warning"
//     };
//   };

//   const wellness = getWellnessSummary();

//   // ─── Dynamic Progress Math ────────────────────────────────────────────────
//   // Mapping Focus Score (usually 8-14Hz) to a 0-100% scale for the gauge
//   const mentalLoadPct = Math.min(100, Math.max(10, (focusScore - 7) * 15));

//   return (
//     <div className="row g-4 fade-in">
//       {/* 3D Brain Visual */}
//       <div className="col-lg-7 col-12">
//         <SensorMap />
//       </div>

//       <div className="col-lg-5 col-12 d-flex flex-column gap-3">
//         {/* Quick Stats Grid */}
//         <div className="row g-3">
//             <div className="col-6">
//                 <div className="card border-0 shadow-sm rounded-4 p-3 bg-white text-center">
//                     <Heart size={24} className={asymmetry > 0 ? "text-success mx-auto mb-2" : "text-danger mx-auto mb-2"} />
//                     <small className="text-muted d-block small fw-bold">EMOTIONAL BIAS</small>
//                     <span className="fw-bold">{asymmetry > 0.02 ? "Engaged" : asymmetry < -0.02 ? "Reflective" : "Neutral"}</span>
//                 </div>
//             </div>
//             <div className="col-6">
//                 <div className="card border-0 shadow-sm rounded-4 p-3 bg-white text-center">
//                     <Zap size={24} className="text-warning mx-auto mb-2" />
//                     <small className="text-muted d-block small fw-bold">MENTAL SPEED</small>
//                     <span className="fw-bold">{focusScore.toFixed(1)} Hz</span>
//                 </div>
//             </div>
//         </div>

//         {/* DYNAMIC SUMMARY BOX */}
//         <div className={`card border-0 shadow-sm rounded-4 p-4 bg-white border-start border-4 ${wellness.borderClass}`}>
//           <div className="d-flex align-items-center gap-3 mb-3">
//             <div className="p-2 bg-light rounded-3">
//                 {wellness.icon}
//             </div>
//             <h5 className="fw-bold mb-0 text-dark">{wellness.title}</h5>
//           </div>
          
//           <div className="p-3 rounded-4 bg-light border-0">
//             <p className="text-dark mb-0 leading-relaxed" style={{ fontSize: '1rem', lineHeight: '1.6' }}>
//                 <BookOpen size={18} className="me-2 text-primary mb-1" />
//                 {wellness.summary}
//             </p>
//           </div>

//           <div className="mt-3 d-flex align-items-center gap-2 text-muted small">
//             <Info size={14} />
//             <span>Analysis based on <strong>Frontal Alpha Asymmetry (FAA)</strong>.</span>
//           </div>
//         </div>

//         {/* DYNAMIC PROGRESS GAUGE */}
//         <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
//           <div className="d-flex justify-content-between align-items-center mb-3">
//             <h6 className="fw-bold text-muted text-uppercase small mb-0">Cognitive Load</h6>
//             <span className="badge bg-light text-dark">{Math.round(mentalLoadPct)}%</span>
//           </div>
//           <div className="progress" style={{height: '12px', borderRadius: '10px', backgroundColor: '#f0f0f0'}}>
//             <div 
//               className={`progress-bar ${asymmetry < -0.02 ? 'bg-info' : 'bg-primary'}`} 
//               style={{
//                 width: `${mentalLoadPct}%`,
//                 transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)'
//               }}
//             ></div>
//           </div>
//           <div className="d-flex justify-content-between mt-2 small text-muted">
//             <span>Relaxed (Alpha)</span>
//             <span>Active (Beta)</span>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default PatientView;

// import React from 'react';
// import SensorMap from './SensorMap';
// import { Zap, Heart, Info, BookOpen, Sun, Moon, Coffee } from 'lucide-react';

// const PatientView = ({ data }) => {
//   if (!data) return null;

//   // Normalizing the inputs from our new backend structure
//   const asymmetry = data.asymmetry_score || 0;
//   const focusScore = data.features?.['T7_DominantFreq'] || 0;
//   // Use Alpha Power instead of Std (since Std is now always 1.0 due to Z-score)
//   const alphaIntensity = data.features?.['T7_Alpha'] || 0; 

//   const getWellnessSummary = () => {
//     // DEFAULT: Balanced State
//     let title = "Your Brain is Balanced";
//     let summary = "Right now, your brain waves are in a steady, resting state. You aren't over-stressed, but you aren't super excited either. It's a great time for routine tasks or light reading.";
//     let icon = <Sun className="text-warning" size={32} />;

//     // 1. APPROACH STATE (Focused/Happy)
//     // Lowered threshold to 0.05 because Z-scores are subtle
//     if (asymmetry > 0.05 && focusScore > 10) {
//       title = "You are in the 'Zone'!";
//       summary = "Your left brain is highly active! This means you are feeling 'Engaged' and 'Ready.' Your brain is perfectly primed for solving problems, learning something new, or having a deep conversation.";
//       icon = <Zap className="text-primary" size={32} />;
//     } 
//     // 2. WITHDRAWAL STATE (Stress/Fatigue)
//     else if (asymmetry < -0.05) {
//       title = "Time for a Mental Break";
//       summary = "We notice your right-frontal brain activity is taking the lead. This usually happens when we feel a bit overwhelmed or mentally fatigued. Try a 2-minute breathing exercise to reset.";
//       icon = <Moon className="text-info" size={32} />;
//     } 
//     // 3. RELAXATION STATE (High Alpha)
//     else if (alphaIntensity > 1.2) {
//         title = "Deeply Relaxed";
//         summary = "Strong Alpha rhythms detected! You are in a very calm state, similar to light meditation. This is the ideal state for creative visualization or recovery.";
//         icon = <Coffee className="text-secondary" size={32} />;
//     }
//     return { title, summary, icon };
//   };

//   const wellness = getWellnessSummary();

//   return (
//     <div className="row g-4">
//       {/* 3D Brain Visual */}
//       <div className="col-lg-7 col-12">
//         <SensorMap />
//       </div>

//       <div className="col-lg-5 col-12 d-flex flex-column gap-3">
//         {/* Quick Stats Grid */}
//         <div className="row g-3">
//             <div className="col-6">
//                 <div className="card border-0 shadow-sm rounded-4 p-3 bg-white text-center">
//                     <Heart size={24} className={asymmetry > 0 ? "text-success mx-auto mb-2" : "text-danger mx-auto mb-2"} />
//                     <small className="text-muted d-block">Emotional State</small>
//                     <span className="fw-bold">{asymmetry > 0.05 ? "Engaged" : asymmetry < -0.05 ? "Stressed" : "Neutral"}</span>
//                 </div>
//             </div>
//             <div className="col-6">
//                 <div className="card border-0 shadow-sm rounded-4 p-3 bg-white text-center">
//                     <Zap size={24} className="text-warning mx-auto mb-2" />
//                     <small className="text-muted d-block">Mental Speed</small>
//                     <span className="fw-bold">{focusScore.toFixed(1)} Hz</span>
//                 </div>
//             </div>
//         </div>

//         {/* STATIC SUMMARY BOX */}
//         <div className="card border-0 shadow-sm rounded-4 p-4 bg-white border-start border-4 border-primary">
//           <div className="d-flex align-items-center gap-3 mb-3">
//             <div className="p-2 bg-light rounded-3">
//                 {wellness.icon}
//             </div>
//             <h5 className="fw-bold mb-0 text-dark">{wellness.title}</h5>
//           </div>
          
//           <div className="p-3 rounded-3 bg-light border-0">
//             <p className="text-dark mb-0 leading-relaxed" style={{ fontSize: '1.05rem', lineHeight: '1.6' }}>
//                 <BookOpen size={18} className="me-2 text-primary mb-1" />
//                 {wellness.summary}
//             </p>
//           </div>

//           <div className="mt-3 d-flex align-items-center gap-2 text-muted small">
//             <Info size={14} />
//             <span>Based on <strong>Frontal Alpha Asymmetry (FAA)</strong> processing.</span>
//           </div>
//         </div>

//         {/* PROGRESS GAUGE */}
//         <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
//           <h6 className="fw-bold text-muted text-uppercase small mb-3">Mental Load Indicator</h6>
//           <div className="progress" style={{height: '20px', borderRadius: '10px', backgroundColor: '#f0f0f0'}}>
//             <div 
//               className={`progress-bar ${asymmetry < -0.05 ? 'bg-danger' : 'bg-success'}`} 
//               style={{
//                 width: `${Math.min(100, Math.max(10, (focusScore * 4)))}%`,
//                 transition: 'width 1s ease-in-out'
//               }}
//             ></div>
//           </div>
//           <div className="d-flex justify-content-between mt-2 small text-muted">
//             <span>Low Engagement</span>
//             <span>High Engagement</span>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default PatientView;

// import React from 'react';
// import SensorMap from './SensorMap';
// import { Zap, Heart, Info, BookOpen, Sun, Moon, Coffee } from 'lucide-react';

// const PatientView = ({ data }) => {
//   if (!data) return null;

//   const asymmetry = data.asymmetry_score || 0;
//   const focusScore = data.features['T7_DominantFreq'] || 0;
//   const stressLevel = data.features['F8_Std'] || 0;

//   const getWellnessSummary = () => {
//     let title = "Your Brain is Balanced";
//     let summary = "Right now, your brain waves are in a steady, resting state. You aren't over-stressed, but you aren't super excited either. It's a great time for routine tasks or light reading.";
//     let icon = <Sun className="text-warning" size={32} />;

//     if (asymmetry > 0.1 && focusScore > 10) {
//       title = "You are in the 'Zone'!";
//       summary = "Your left brain is highly active! This means you are feeling 'Approachable' and 'Ready.' Your brain is perfectly primed for solving problems, learning something new, or having a deep conversation.";
//       icon = <Zap className="text-primary" size={32} />;
//     } else if (asymmetry < -0.1) {
//       title = "Time for a Mental Break";
//       summary = "We notice your right brain is taking the lead. This usually happens when we feel a bit overwhelmed or withdrawn. Try closing your eyes for 2 minutes and taking five deep breaths to reset.";
//       icon = <Moon className="text-info" size={32} />;
//     } else if (stressLevel > 20) {
//         title = "High Mental Chatter";
//         summary = "There is a lot of 'noise' in your frontal signals. This might be because you're blinking a lot or moving your jaw. Try to relax your face and sit still to see your true brain rhythm.";
//         icon = <Coffee className="text-secondary" size={32} />;
//     }
//     return { title, summary, icon };
//   };

//   const wellness = getWellnessSummary();

//   return (
//     <div className="row g-4">
      
//       {/* 3D Brain Visual */}
//       <div className="col-lg-7 col-12">
//         <SensorMap />
//       </div>

//       <div className="col-lg-5 col-12 d-flex flex-column gap-3">
//         {/* Quick Stats Grid */}
//         <div className="row g-3">
//             <div className="col-6">
//                 <div className="card border-0 shadow-sm rounded-4 p-3 bg-white text-center">
//                     <Heart size={24} className="text-danger mx-auto mb-2" />
//                     <small className="text-muted d-block">Emotional State</small>
//                     <span className="fw-bold">{asymmetry > 0 ? "Positive" : "Reflective"}</span>
//                 </div>
//             </div>
//             <div className="col-6">
//                 <div className="card border-0 shadow-sm rounded-4 p-3 bg-white text-center">
//                     <Zap size={24} className="text-warning mx-auto mb-2" />
//                     <small className="text-muted d-block">Mental Speed</small>
//                     <span className="fw-bold">{focusScore.toFixed(1)} Hz</span>
//                 </div>
//             </div>
//         </div>

//         {/* STATIC SUMMARY BOX */}
//         <div className="card border-0 shadow-sm rounded-4 p-4 bg-white border-start border-4 border-primary">
//           <div className="d-flex align-items-center gap-3 mb-3">
//             <div className="p-2 bg-light rounded-3">
//                 {wellness.icon}
//             </div>
//             <h5 className="fw-bold mb-0 text-dark">{wellness.title}</h5>
//           </div>
          
//           <div className="p-3 rounded-3 bg-light border-0">
//             <p className="text-dark mb-0 leading-relaxed" style={{ fontSize: '1.05rem', lineHeight: '1.6' }}>
//                 <BookOpen size={18} className="me-2 text-primary mb-1" />
//                 {wellness.summary}
//             </p>
//           </div>

//           <div className="mt-3 d-flex align-items-center gap-2 text-muted small">
//             <Info size={14} />
//             <span>This summary is based on your <strong>Alpha-to-Beta</strong> wave ratio.</span>
//           </div>
//         </div>

//         {/* STATIC PROGRESS GAUGE */}
//         <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
//           <h6 className="fw-bold text-muted text-uppercase small mb-3">Your Relaxation Level</h6>
//           <div className="progress" style={{height: '20px', borderRadius: '10px'}}>
//             <div 
//               className="progress-bar bg-success" 
//               style={{width: `${Math.max(20, 100 - (focusScore * 5))}%`}}
//             ></div>
//           </div>
//           <div className="d-flex justify-content-between mt-2 small text-muted">
//             <span>Active</span>
//             <span>Relaxed</span>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default PatientView;
