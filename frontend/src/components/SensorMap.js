import React, { Suspense } from "react";
import { Brain } from "lucide-react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei"; 
import BrainModel from "./BrainModel";
import { SENSOR_DATA } from "./eegData";

const SensorMap = () => {
  return (
    <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
          <Brain size={20} className="text-primary" />
          3D Sensor Topography
        </h5>
        <span className="badge bg-light text-muted border">Interactive</span>
      </div>

      {/* 3D Canvas */}
      <div className="d-flex justify-content-center align-items-center rounded-3 overflow-hidden shadow-inner" style={{ minHeight: "300px", background: "#111827" }}>
        
        {/* FIX: Moved the camera WAY back (from Z:15 to Z:100) so the giant brain fits on load! */}
        <Canvas camera={{ position: [0, 5, 100], fov: 45 }} style={{ height: 300, width: "100%" }}>
          
          <ambientLight intensity={0.3} />
          <directionalLight position={[-10, 10, 10]} intensity={1.5} />
          <directionalLight position={[10, -5, -10]} intensity={0.5} color="#9ca3af" />
          <Environment preset="city" />
          
          <Suspense fallback={null}>
            <BrainModel sensors={SENSOR_DATA} />
          </Suspense>
          
          {/* enableZoom={true} still lets you zoom in and out with the scroll wheel */}
          <OrbitControls enableZoom={true} enablePan={false} autoRotate={true} autoRotateSpeed={1.0} />
        </Canvas>
      </div>

      {/* Legend with CUSTOM Colors Applied */}
      <div className="mt-4 text-center">
        <p className="text-muted small mb-2 fw-bold text-uppercase tracking-wider">Active Channels (Used)</p>
        <div className="mb-3">
            <span className="badge me-2 px-3 py-2 shadow-sm" style={{ backgroundColor: "#2a00c2", color: "white", fontSize: "12px" }}>
            T7 (Logic)
            </span>
            <span className="badge me-2 px-3 py-2 shadow-sm" style={{ backgroundColor: "#00670a", color: "white", fontSize: "12px" }}>
            F8 (Emotion)
            </span>
        </div>
        
        <p className="text-muted small mt-2 mb-2 fw-bold text-uppercase tracking-wider">Rejected Channels (Hair Impedance)</p>
        <div>
            <span className="badge me-2 px-3 py-2 shadow-sm" style={{ backgroundColor: "#8f0505", color: "white", fontSize: "12px" }}>
            Cz (Vertex)
            </span>
            <span className="badge px-3 py-2 shadow-sm" style={{ backgroundColor: "#ff0000", color: "white", fontSize: "12px" }}>
            P4 (Parietal)
            </span>
        </div>
      </div>
    </div>
  );
};

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
//         <Canvas camera={{ position: [0, 5, 15], fov: 50 }} style={{ height: 300, width: "100%" }}>
          
//           <ambientLight intensity={0.3} />
//           <directionalLight position={[-10, 10, 10]} intensity={1.5} />
//           <directionalLight position={[10, -5, -10]} intensity={0.5} color="#9ca3af" />
//           <Environment preset="city" />
          
//           <Suspense fallback={null}>
//             <BrainModel sensors={SENSOR_DATA} />
//           </Suspense>
          
//           <OrbitControls enableZoom={true} enablePan={false} autoRotate={true} autoRotateSpeed={1.0} />
//         </Canvas>
//       </div>

//       {/* Legend (Properly formatted and active) */}
//       <div className="mt-4 text-center">
//         <p className="text-muted small mb-2 fw-bold text-uppercase tracking-wider">Active Channels (Used)</p>
//         <div className="mb-3">
//             <span className="badge bg-primary bg-opacity-10 text-primary border border-primary me-2 px-3 py-2 shadow-sm">
//             T7 (Logic)
//             </span>
//             <span className="badge bg-success bg-opacity-10 text-success border border-success me-2 px-3 py-2 shadow-sm">
//             F8 (Emotion)
//             </span>
//         </div>
        
//         <p className="text-muted small mt-2 mb-2 fw-bold text-uppercase tracking-wider">Rejected Channels (Hair Impedance)</p>
//         <div>
//             <span className="badge bg-danger bg-opacity-10 text-danger border border-danger me-2 px-3 py-2 shadow-sm">
//             Cz (Vertex)
//             </span>
//             <span className="badge bg-danger bg-opacity-10 text-danger border border-danger px-3 py-2 shadow-sm">
//             P4 (Parietal)
//             </span>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default SensorMap;

// import React, { Suspense } from "react";
// import { Brain } from "lucide-react";
// import { Canvas } from "@react-three/fiber";
// import { OrbitControls } from "@react-three/drei";
// import BrainModel from "./BrainModel";
// import { SENSOR_DATA } from "./eegData";

// const SensorMap = () => {
//   return (
//     <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
//       <div className="d-flex justify-content-between align-items-center mb-3">
//         <h5 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
//           <Brain size={20} className="text-primary" />
//           3D Sensor Topography
//         </h5>
//       </div>

//       <div className="d-flex justify-content-center align-items-center rounded-3 overflow-hidden shadow-inner" style={{ minHeight: "300px", background: "#111827" }}>
//         <Canvas camera={{ position: [0, 5, 15], fov: 50 }} style={{ height: 300, width: "100%" }}>
//           {/* THESE LIGHTS MAKE THE MODEL VISIBLE */}
//           <ambientLight intensity={2.0} />
//           <directionalLight position={[10, 10, 10]} intensity={2.5} />
//           <directionalLight position={[-10, -10, -10]} intensity={1.0} />
          
//           <Suspense fallback={null}>
//             <BrainModel sensors={SENSOR_DATA} />
//           </Suspense>
          
//           <OrbitControls enableZoom={true} enablePan={false} autoRotate={true} autoRotateSpeed={1.0} />
//         </Canvas>
//       </div>
//     </div>
//   );
// };

// export default SensorMap;

// // File: src/components/SensorMap.js
// import React, { Suspense } from "react";
// import { Brain } from "lucide-react";
// import { Canvas } from "@react-three/fiber";
// import { OrbitControls } from "@react-three/drei";
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

//       {/* 3D Canvas Container */}
//       <div
//         className="d-flex justify-content-center align-items-center rounded-3 overflow-hidden shadow-inner"
//         style={{ minHeight: "300px", background: "#111827" }} // Dark gray background
//       >
//         <Canvas 
//           camera={{ position: [0, 8, 15], fov: 50 }} 
//           style={{ height: 300, width: "100%" }}
//         >
//           <ambientLight intensity={0.5} />
//           <pointLight position={[10, 10, 10]} intensity={1.5} />
//           <pointLight position={[-10, -10, -10]} intensity={0.5} />
          
//           {/* Suspense is required while the 3D model loads */}
//           <Suspense fallback={null}>
//             <BrainModel sensors={SENSOR_DATA} />
//           </Suspense>
          
//           {/* Allows user to drag and rotate the brain */}
//           <OrbitControls 
//             enableZoom={true} 
//             enablePan={false}
//             autoRotate={true} 
//             autoRotateSpeed={1.0} 
//           />
//         </Canvas>
//       </div>

//       {/* Legend */}
//       <div className="mt-3 text-center">
//         <p className="text-muted small mb-2 fw-bold">Active Channels (Used)</p>
//         <span className="badge bg-primary bg-opacity-10 text-primary border border-primary me-2 px-3 py-2">
//           T7 (Logic)
//         </span>
//         <span className="badge bg-success bg-opacity-10 text-success border border-success me-2 px-3 py-2">
//           F8 (Emotion)
//         </span>
        
//         <p className="text-muted small mt-3 mb-2 fw-bold">Rejected Channels (Hair Impedance)</p>
//         <span className="badge bg-danger bg-opacity-10 text-danger border border-danger me-2 px-3 py-2">
//           Cz (Vertex)
//         </span>
//         <span className="badge bg-danger bg-opacity-10 text-danger border border-danger px-3 py-2">
//           P4 (Parietal)
//         </span>
//       </div>
//     </div>
//   );
// };

// export default SensorMap;