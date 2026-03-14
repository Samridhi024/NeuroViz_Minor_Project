import React from 'react';
import SensorMap from './SensorMap';
import { Zap, Heart, Info, BookOpen, Sun, Moon, Coffee } from 'lucide-react';

const PatientView = ({ data }) => {
  if (!data) return null;

  // Normalizing the inputs from our new backend structure
  const asymmetry = data.asymmetry_score || 0;
  const focusScore = data.features?.['T7_DominantFreq'] || 0;
  // Use Alpha Power instead of Std (since Std is now always 1.0 due to Z-score)
  const alphaIntensity = data.features?.['T7_Alpha'] || 0; 

  const getWellnessSummary = () => {
    // DEFAULT: Balanced State
    let title = "Your Brain is Balanced";
    let summary = "Right now, your brain waves are in a steady, resting state. You aren't over-stressed, but you aren't super excited either. It's a great time for routine tasks or light reading.";
    let icon = <Sun className="text-warning" size={32} />;

    // 1. APPROACH STATE (Focused/Happy)
    // Lowered threshold to 0.05 because Z-scores are subtle
    if (asymmetry > 0.05 && focusScore > 10) {
      title = "You are in the 'Zone'!";
      summary = "Your left brain is highly active! This means you are feeling 'Engaged' and 'Ready.' Your brain is perfectly primed for solving problems, learning something new, or having a deep conversation.";
      icon = <Zap className="text-primary" size={32} />;
    } 
    // 2. WITHDRAWAL STATE (Stress/Fatigue)
    else if (asymmetry < -0.05) {
      title = "Time for a Mental Break";
      summary = "We notice your right-frontal brain activity is taking the lead. This usually happens when we feel a bit overwhelmed or mentally fatigued. Try a 2-minute breathing exercise to reset.";
      icon = <Moon className="text-info" size={32} />;
    } 
    // 3. RELAXATION STATE (High Alpha)
    else if (alphaIntensity > 1.2) {
        title = "Deeply Relaxed";
        summary = "Strong Alpha rhythms detected! You are in a very calm state, similar to light meditation. This is the ideal state for creative visualization or recovery.";
        icon = <Coffee className="text-secondary" size={32} />;
    }
    return { title, summary, icon };
  };

  const wellness = getWellnessSummary();

  return (
    <div className="row g-4">
      {/* 3D Brain Visual */}
      <div className="col-lg-7 col-12">
        <SensorMap />
      </div>

      <div className="col-lg-5 col-12 d-flex flex-column gap-3">
        {/* Quick Stats Grid */}
        <div className="row g-3">
            <div className="col-6">
                <div className="card border-0 shadow-sm rounded-4 p-3 bg-white text-center">
                    <Heart size={24} className={asymmetry > 0 ? "text-success mx-auto mb-2" : "text-danger mx-auto mb-2"} />
                    <small className="text-muted d-block">Emotional State</small>
                    <span className="fw-bold">{asymmetry > 0.05 ? "Engaged" : asymmetry < -0.05 ? "Stressed" : "Neutral"}</span>
                </div>
            </div>
            <div className="col-6">
                <div className="card border-0 shadow-sm rounded-4 p-3 bg-white text-center">
                    <Zap size={24} className="text-warning mx-auto mb-2" />
                    <small className="text-muted d-block">Mental Speed</small>
                    <span className="fw-bold">{focusScore.toFixed(1)} Hz</span>
                </div>
            </div>
        </div>

        {/* STATIC SUMMARY BOX */}
        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white border-start border-4 border-primary">
          <div className="d-flex align-items-center gap-3 mb-3">
            <div className="p-2 bg-light rounded-3">
                {wellness.icon}
            </div>
            <h5 className="fw-bold mb-0 text-dark">{wellness.title}</h5>
          </div>
          
          <div className="p-3 rounded-3 bg-light border-0">
            <p className="text-dark mb-0 leading-relaxed" style={{ fontSize: '1.05rem', lineHeight: '1.6' }}>
                <BookOpen size={18} className="me-2 text-primary mb-1" />
                {wellness.summary}
            </p>
          </div>

          <div className="mt-3 d-flex align-items-center gap-2 text-muted small">
            <Info size={14} />
            <span>Based on <strong>Frontal Alpha Asymmetry (FAA)</strong> processing.</span>
          </div>
        </div>

        {/* PROGRESS GAUGE */}
        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
          <h6 className="fw-bold text-muted text-uppercase small mb-3">Mental Load Indicator</h6>
          <div className="progress" style={{height: '20px', borderRadius: '10px', backgroundColor: '#f0f0f0'}}>
            <div 
              className={`progress-bar ${asymmetry < -0.05 ? 'bg-danger' : 'bg-success'}`} 
              style={{
                width: `${Math.min(100, Math.max(10, (focusScore * 4)))}%`,
                transition: 'width 1s ease-in-out'
              }}
            ></div>
          </div>
          <div className="d-flex justify-content-between mt-2 small text-muted">
            <span>Low Engagement</span>
            <span>High Engagement</span>
          </div>
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
