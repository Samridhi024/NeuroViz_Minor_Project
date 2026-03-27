import React, { Suspense, useMemo } from "react";
import { Brain, Activity, ShieldCheck, AlertCircle } from "lucide-react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei"; 
import BrainModel from "./BrainModel";
import { SENSOR_DATA } from "./eegData"; 

const SensorMap = ({ data }) => {
  const sensorGroups = useMemo(() => {
    if (!data || !data.features) return { analytical: [], monitoring: [], missing: SENSOR_DATA };

    const detectedKeys = Object.keys(data.features).map(k => k.split('_')[0]);
    const uniqueDetected = [...new Set(detectedKeys)];

    // 1. ANALYTICAL: Used in FAA Calculations (Frontal/Temporal)
    const analyticalNames = ["T7", "F8", "F3", "F4"];
    
    // 2. MONITORING: Signal is active but ignored for Emotion scores (Vertex/Parietal)
    const monitoringNames = ["Cz", "P4"];

    return {
      analytical: SENSOR_DATA.filter(s => uniqueDetected.includes(s.name) && analyticalNames.includes(s.name)),
      monitoring: SENSOR_DATA.filter(s => uniqueDetected.includes(s.name) && monitoringNames.includes(s.name)),
      missing: SENSOR_DATA.filter(s => !uniqueDetected.includes(s.name))
    };
  }, [data]);

  const allActive = [...sensorGroups.analytical, ...sensorGroups.monitoring];

  return (
    <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
      {/* HEADER - USES 'Brain' ICON */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
          <Brain size={20} className="text-primary" />
          3D Live Sensor Map
        </h5>
        <span className={`badge border ${allActive.length > 0 ? 'bg-success-subtle text-success' : 'bg-light text-muted'}`}>
          {allActive.length} Active
        </span>
      </div>

      {/* 3D VIEW - USES 'Environment' */}
      <div className="d-flex justify-content-center align-items-center rounded-3 mb-4 overflow-hidden shadow-inner" style={{ minHeight: "300px", background: "#111827" }}>
        <Canvas camera={{ position: [0, 5, 100], fov: 45 }} style={{ height: 300, width: "100%" }}>
          <ambientLight intensity={0.4} />
          <Environment preset="city" /> 
          <Suspense fallback={null}>
            <BrainModel sensors={allActive} />
          </Suspense>
          <OrbitControls enableZoom={true} enablePan={false} autoRotate={true} autoRotateSpeed={0.5} />
        </Canvas>
      </div>

      {/* HIERARCHICAL LEGEND */}
      <div className="d-flex flex-column gap-3">
        {/* GROUP 1: ANALYTICAL */}
        <div>
          <p className="text-muted small mb-2 fw-bold text-uppercase d-flex align-items-center gap-1">
            <Activity size={14} className="text-primary" /> Core Analytical (Emotion)
          </p>
          <div className="d-flex flex-wrap gap-2">
            {sensorGroups.analytical.map(s => (
              <span key={s.name} className="badge shadow-sm px-3 py-2" style={{ backgroundColor: s.color, color: "white", fontSize: "12px" }}>
                {s.name}
              </span>
            ))}
          </div>
        </div>

        {/* GROUP 2: MONITORING */}
        <div className="pt-2 border-top">
          <p className="text-muted small mb-2 fw-bold text-uppercase d-flex align-items-center gap-1">
            <ShieldCheck size={14} className="text-success" /> Active Monitoring (Baseline)
          </p>
          <div className="d-flex flex-wrap gap-2">
            {sensorGroups.monitoring.map(s => (
              <span key={s.name} className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2" style={{ fontSize: "12px" }}>
                {s.name}
              </span>
            ))}
          </div>
        </div>

        {/* GROUP 3: MISSING */}
        {sensorGroups.missing.length > 0 && (
          <div className="pt-2 border-top">
            <p className="text-muted small mb-2 fw-bold text-uppercase d-flex align-items-center gap-1 opacity-50">
              <AlertCircle size={14} /> Hardware Offline
            </p>
            <div className="d-flex flex-wrap gap-2 opacity-50">
              {sensorGroups.missing.map(s => (
                <span key={s.name} className="badge bg-light text-muted border px-2 py-1" style={{ borderStyle: 'dashed', fontSize: "11px" }}>
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// CRITICAL FIX: The export must be at the end!
export default SensorMap;


// import React, { Suspense } from "react";
// import { Brain } from "lucide-react";
// import { Canvas } from "@react-three/fiber";
// import { OrbitControls, Environment } from "@react-three/drei"; 
// import BrainModel from "./BrainModel";
// import { SENSOR_DATA } from "./eegData";

// const SensorMap = () => {
//   return (
//     <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
//       {/* Header */}
//       <div className="d-flex justify-content-between align-items-center mb-3">
//         <h5 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
//           <Brain size={20} className="text-primary" />
//           3D Sensor Topography
//         </h5>
//         <span className="badge bg-light text-muted border">Interactive</span>
//       </div>

//       {/* 3D Canvas */}
//       <div className="d-flex justify-content-center align-items-center rounded-3 overflow-hidden shadow-inner" style={{ minHeight: "300px", background: "#111827" }}>
        
//         {/* FIX: Moved the camera WAY back (from Z:15 to Z:100) so the giant brain fits on load! */}
//         <Canvas camera={{ position: [0, 5, 100], fov: 45 }} style={{ height: 300, width: "100%" }}>
          
//           <ambientLight intensity={0.3} />
//           <directionalLight position={[-10, 10, 10]} intensity={1.5} />
//           <directionalLight position={[10, -5, -10]} intensity={0.5} color="#9ca3af" />
//           <Environment preset="city" />
          
//           <Suspense fallback={null}>
//             <BrainModel sensors={SENSOR_DATA} />
//           </Suspense>
          
//           {/* enableZoom={true} still lets you zoom in and out with the scroll wheel */}
//           <OrbitControls enableZoom={true} enablePan={false} autoRotate={true} autoRotateSpeed={1.0} />
//         </Canvas>
//       </div>

//       {/* Legend with CUSTOM Colors Applied */}
//       <div className="mt-4 text-center">
//         <p className="text-muted small mb-2 fw-bold text-uppercase tracking-wider">Active Channels (Used)</p>
//         <div className="mb-3">
//             <span className="badge me-2 px-3 py-2 shadow-sm" style={{ backgroundColor: "#7551f4", color: "white", fontSize: "12px" }}>
//             T7 (Logic)
//             </span>
//             <span className="badge me-2 px-3 py-2 shadow-sm" style={{ backgroundColor: "#3fa84a", color: "white", fontSize: "12px" }}>
//             F8 (Emotion)
//             </span>
//         </div>
        
//         <p className="text-muted small mt-2 mb-2 fw-bold text-uppercase tracking-wider">Rejected Channels (Hair Impedance)</p>
//         <div>
//             <span className="badge me-2 px-3 py-2 shadow-sm" style={{ backgroundColor: "#f45e5e", color: "white", fontSize: "12px" }}>
//             Cz (Vertex)
//             </span>
//             <span className="badge px-3 py-2 shadow-sm" style={{ backgroundColor: "#e0b528", color: "white", fontSize: "12px" }}>
//             P4 (Parietal)
//             </span>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default SensorMap;

