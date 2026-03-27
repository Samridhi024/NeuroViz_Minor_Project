import React from 'react';
import SensorMap from './SensorMap';
import { Zap, Heart, Info, BookOpen, Sun, Moon, Coffee } from 'lucide-react';

const PatientView = ({ data }) => {
  if (!data) return null;

  // Data Extraction 
  const asymmetry = data.asymmetry_score || 0;
  const focusScore = data.features?.['T7_DominantFreq'] || 0;
  const alphaIntensity = data.features?.['T7_Alpha'] || 0; 

  // Wellness Logic (Thresholds for Z-Score Data) 
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

  // Dynamic Progress Math 
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
                transition: 'width 0.5s ease' 
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


