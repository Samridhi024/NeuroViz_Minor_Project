import React, { useState } from 'react';
import axios from 'axios';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, Legend, Label 
} from 'recharts';
import { Upload, Activity, CheckCircle, AlertTriangle, Zap, Smile, Info } from 'lucide-react';

import RawSignalView from './RawSignalView';
import SensorMap from './SensorMap';
import PatientView from './PatientView';

const Dashboard = ({ data, onAnalysisComplete, showCleaned, userMode }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [visibleChannels, setVisibleChannels] = useState({ T7: true, F8: true });

  const handleFileChange = (e) => setFile(e.target.files[0]);
  const toggleChannel = (channel) => setVisibleChannels(prev => ({ ...prev, [channel]: !prev[channel] }));

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await axios.post("http://127.0.0.1:8000/analyze", formData);
      onAnalysisComplete(response.data); 
    } catch (err) {
      console.error(err);
      alert("Backend error. Is uvicorn running?");
    } finally {
      setLoading(false);
    }
  };

  if (!data) {
    return (
      <div className="card border-0 shadow-sm rounded-4 p-5 text-center align-items-center mt-5 fade-in bg-white">
        <div className="bg-primary bg-opacity-10 rounded-circle p-4 mb-3">
          <Upload size={48} className="text-primary"/>
        </div>
        <h3 className="fw-bold mb-2 text-dark">Upload Patient EEG Data</h3>
        <p className="text-muted mb-4">Drag and drop your .txt or .csv files here to begin analysis.</p>
        <input type="file" id="file" className="d-none" onChange={handleFileChange} />
        <label htmlFor="file" className="btn btn-primary btn-lg px-5 rounded-pill shadow-sm">
          {file ? file.name : "Select File"}
        </label>
        {file && (
          <button onClick={handleUpload} className="btn btn-dark mt-3 rounded-pill px-4" disabled={loading}>
            {loading ? "Processing..." : "Run Analysis"}
          </button>
        )}
      </div>
    );
  }

  // --- 1. PATIENT MODE VIEW ---
  // if (userMode === 'patient') {
  //   const asymmetry = data.asymmetry_score || 0;
  //   return (
  //     <div className="row g-4 fade-in">
  //       <div className="col-lg-7">
  //         <SensorMap />
  //       </div>
  //       <div className="col-lg-5">
  //         <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white text-center">
  //           <Smile size={48} className={asymmetry > 0 ? "text-success mx-auto" : "text-warning mx-auto"} />
  //           <h4 className="fw-bold mt-3">Your Mindset</h4>
  //           <p className="fs-5 mb-0">{asymmetry > 0 ? "Positive Engagement" : "Calm Reflection"}</p>
  //           <div className="progress mt-3" style={{height: '12px', borderRadius: '10px'}}>
  //             <div className="progress-bar bg-success" style={{width: `${Math.min(100, Math.abs(asymmetry * 200))}%`}}></div>
  //           </div>
  //         </div>
  //         <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
  //           <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
  //               <Info size={20} className="text-primary" /> Health Tip
  //           </h5>
  //           <p className="text-muted mb-0">
  //               {asymmetry > 0 
  //                 ? "Your brain shows great focus! This is a perfect time for learning or creative tasks." 
  //                 : "You are in a relaxed state. Consider some light meditation to maintain this balance."}
  //           </p>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // }
  if (userMode === 'patient') {
    return <PatientView data={data} />;
  }

  // --- 2. CLINICIAN MODE: RAW VIEW ---
  if (!showCleaned) {
    return (
      <div className="fade-in">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="fw-bold text-danger mb-0 d-flex align-items-center gap-2">
              <AlertTriangle size={24} /> Raw Input Monitor
            </h4>
            <p className="text-muted small mb-0">Hardware Baseline & Impedance Check</p>
          </div>
          <span className="badge bg-danger bg-opacity-10 text-danger px-3 py-2 rounded-pill">Filters Inactive</span>
        </div>
        <RawSignalView data={data.raw_graph} stats={data.raw_stats} />
      </div>
    );
  }

  // --- 3. CLINICIAN MODE: CLEANED VIEW ---
  const chartWidth = data.clean_graph ? Math.max(1000, data.clean_graph.length * 3) : "100%";

  return (
    <div className="row g-4 fade-in">
      <div className="col-lg-8 col-12">
        <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h5 className="fw-bold mb-1 text-success d-flex align-items-center gap-2">
                <CheckCircle size={20}/> Live Signal Overview
              </h5>
              <p className="text-muted small mb-0">Bandpass (0.5-50Hz) • Notch (50Hz) • Artifact Rejection</p>
            </div>
            <div className="bg-light p-1 rounded-3 d-flex gap-1">
              {['T7', 'F8'].map(ch => (
                <button 
                  key={ch}
                  className={`btn btn-sm fw-medium ${visibleChannels[ch] ? 'btn-white shadow-sm' : 'text-muted'}`} 
                  onClick={() => toggleChannel(ch)} 
                  style={{minWidth: 80}}
                >
                  <span className={ch === 'T7' ? "text-primary me-1" : "text-success me-1"}>●</span> {ch}
                </button>
              ))}
            </div>
          </div>

          <div className="w-100 border rounded-3 bg-light" style={{ overflowX: 'auto', overflowY: 'hidden' }}>
            <div style={{ width: chartWidth, height: 350, backgroundColor: '#fff' }}>
              <AreaChart width={typeof chartWidth === 'number' ? chartWidth : 1000} height={320} data={data.clean_graph} margin={{ top: 10, right: 30, left: 20, bottom: 30 }}>
                <defs>
                  <linearGradient id="colorT7" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                  <linearGradient id="colorF8" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/>
                <XAxis dataKey="time" tick={{fontSize:12, fill: '#9ca3af'}} tickCount={10} interval="preserveStartEnd"><Label value="Time (seconds)" offset={-5} position="insideBottom" style={{ fill: '#6b7280', fontSize: '12px' }} /></XAxis>
                <YAxis domain={['auto', 'auto']} tick={{fontSize:12, fill: '#9ca3af'}}><Label value="Amplitude (µV)" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: '#6b7280', fontSize: '12px' }} /></YAxis>
                <Tooltip contentStyle={{borderRadius: 12, border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}/>
                <Legend verticalAlign="top" height={36}/>
                {visibleChannels.T7 && <Area type="monotone" dataKey="T7" stroke="#3b82f6" strokeWidth={2} fill="url(#colorT7)" name="T7 (Left Logic)" isAnimationActive={false} />}
                {visibleChannels.F8 && <Area type="monotone" dataKey="F8" stroke="#10b981" strokeWidth={2} fill="url(#colorF8)" name="F8 (Right Emotion)" isAnimationActive={false} />}
              </AreaChart>
            </div>
          </div>
          <div className="text-center mt-2 text-muted small"><span className="fw-bold">↔ Scroll horizontally</span> to view full recording</div>
        </div>
      </div>

      <div className="col-lg-4 col-12"><SensorMap /></div>

      {/* METRIC CARDS */}
      <div className="col-md-4">
        <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
          <div className="d-flex align-items-center gap-3">
            <div className="p-3 bg-primary bg-opacity-10 rounded-3 text-primary"><Activity size={24}/></div>
            <div><h6 className="text-muted mb-0 small text-uppercase fw-bold">Peak Amplitude</h6><h3 className="fw-bold mb-0 text-dark">{data.features['F8_Max']?.toFixed(1)} <small className="fs-6 text-muted">µV</small></h3></div>
          </div>
        </div>
      </div>

      <div className="col-md-4">
        <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
          <div className="d-flex align-items-center gap-3">
            <div className={`p-3 rounded-3 ${data.asymmetry_score > 0 ? 'bg-success text-success' : 'bg-danger text-danger'} bg-opacity-10`}><Activity size={24}/></div>
            <div><h6 className="text-muted mb-0 small text-uppercase fw-bold">Alpha Asymmetry</h6><h3 className="fw-bold mb-0 text-dark">{data.asymmetry_score?.toFixed(3)}</h3><small className={data.asymmetry_score > 0 ? "text-success fw-bold" : "text-danger fw-bold"}>{data.asymmetry_score > 0 ? "Positive State" : "Withdrawal State"}</small></div>
          </div>
        </div>
      </div>

      <div className="col-md-4">
        <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
          <div className="d-flex align-items-center gap-3">
            <div className="p-3 bg-warning bg-opacity-10 rounded-3 text-warning"><Zap size={24}/></div>
            <div><h6 className="text-muted mb-0 small text-uppercase fw-bold">Signal Quality</h6><h3 className="fw-bold mb-0 text-dark">Excellent</h3><small className="text-muted">Filtered (Cz/P4 Rejected)</small></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

// import React, { useState } from 'react';
// import axios from 'axios';
// import { 
//   XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, Legend, Label 
// } from 'recharts';
// import { Upload, Activity, CheckCircle, AlertTriangle, Zap } from 'lucide-react';

// // Import your components
// import RawSignalView from './RawSignalView';
// import SensorMap from './SensorMap'; // <-- The 3D Brain Model

// const Dashboard = ({ data, onAnalysisComplete, showCleaned }) => {
//   const [file, setFile] = useState(null);
//   const [loading, setLoading] = useState(false);
  
//   // Toggles for individual lines in the Clean View
//   const [visibleChannels, setVisibleChannels] = useState({ T7: true, F8: true });

//   const handleFileChange = (e) => setFile(e.target.files[0]);

//   const toggleChannel = (channel) => {
//     setVisibleChannels(prev => ({ ...prev, [channel]: !prev[channel] }));
//   };

//   const handleUpload = async () => {
//     if (!file) return;
//     setLoading(true);
//     const formData = new FormData();
//     formData.append("file", file);
//     try {
//       const response = await axios.post("http://127.0.0.1:8000/analyze", formData);
//       onAnalysisComplete(response.data); 
//     } catch (err) {
//       console.error(err);
//       alert("Backend error. Is uvicorn running?");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // --- 1. UPLOAD SCREEN (If no data) ---
//   if (!data) {
//     return (
//       <div className="card border-0 shadow-sm rounded-4 p-5 text-center align-items-center mt-5 fade-in bg-white">
//         <div className="bg-primary bg-opacity-10 rounded-circle p-4 mb-3">
//           <Upload size={48} className="text-primary"/>
//         </div>
//         <h3 className="fw-bold mb-2 text-dark">Upload Patient EEG Data</h3>
//         <p className="text-muted mb-4">Drag and drop your .txt or .csv files here to begin analysis.</p>
//         <input type="file" id="file" className="d-none" onChange={handleFileChange} />
//         <label htmlFor="file" className="btn btn-primary btn-lg px-5 rounded-pill shadow-sm">
//           {file ? file.name : "Select File"}
//         </label>
//         {file && (
//           <button onClick={handleUpload} className="btn btn-dark mt-3 rounded-pill px-4" disabled={loading}>
//             {loading ? "Processing..." : "Run Analysis"}
//           </button>
//         )}
//       </div>
//     );
//   }

//   // --- 2. RAW SIGNAL VIEW (The "Before" State) ---
//   if (!showCleaned) {
//     return (
//         <div className="fade-in">
//             <div className="d-flex justify-content-between align-items-center mb-4">
//                 <div>
//                     <h4 className="fw-bold text-danger mb-0 d-flex align-items-center gap-2">
//                         <AlertTriangle size={24} /> Raw Input Monitor
//                     </h4>
//                     <p className="text-muted small mb-0">Hardware Baseline & Impedance Check</p>
//                 </div>
//                 <span className="badge bg-danger bg-opacity-10 text-danger px-3 py-2 rounded-pill">
//                     Filters Inactive
//                 </span>
//             </div>
//             {/* Render the Diagnostic Component */}
//             <RawSignalView data={data.raw_graph} stats={data.raw_stats} />
//         </div>
//     );
//   }

//   // --- 3. CLEANED DASHBOARD VIEW (The "After" State) ---
  
//   // Calculate Width for Horizontal Scrolling (3 pixels per data point)
//   const chartWidth = data.clean_graph ? Math.max(1000, data.clean_graph.length * 3) : "100%";

//   return (
//     <div className="row g-4 fade-in">
      
//       {/* SECTION A: THE WIDE SCROLLABLE GRAPH (Takes up 8 columns) */}
//       <div className="col-lg-8 col-12">
//         <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
          
//           {/* Graph Header */}
//           <div className="d-flex justify-content-between align-items-center mb-4">
//             <div>
//               <h5 className="fw-bold mb-1 text-success d-flex align-items-center gap-2">
//                   <CheckCircle size={20}/> Live Signal Overview
//               </h5>
//               <p className="text-muted small mb-0">Bandpass (0.5-50Hz) • Notch (50Hz) • Artifact Rejection</p>
//             </div>
            
//             {/* Channel Toggles */}
//             <div className="bg-light p-1 rounded-3 d-flex gap-1">
//               <button 
//                 className={`btn btn-sm fw-medium ${visibleChannels.T7 ? 'btn-white shadow-sm' : 'text-muted'}`} 
//                 onClick={() => toggleChannel('T7')} 
//                 style={{minWidth: 80}}
//               >
//                  <span className="text-primary me-1">●</span> T7
//               </button>
//               <button 
//                 className={`btn btn-sm fw-medium ${visibleChannels.F8 ? 'btn-white shadow-sm' : 'text-muted'}`} 
//                 onClick={() => toggleChannel('F8')} 
//                 style={{minWidth: 80}}
//               >
//                  <span className="text-success me-1">●</span> F8
//               </button>
//             </div>
//           </div>

//           {/* SCROLLABLE CONTAINER */}
//           <div className="w-100 border rounded-3 bg-light" style={{ overflowX: 'auto', overflowY: 'hidden' }}>
//             <div style={{ width: chartWidth, height: 350, backgroundColor: '#fff' }}>
//               <AreaChart 
//                 width={typeof chartWidth === 'number' ? chartWidth : 1000} 
//                 height={320} 
//                 data={data.clean_graph}
//                 margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
//               >
//                 <defs>
//                   <linearGradient id="colorT7" x1="0" y1="0" x2="0" y2="1">
//                     <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
//                     <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
//                   </linearGradient>
//                   <linearGradient id="colorF8" x1="0" y1="0" x2="0" y2="1">
//                     <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
//                     <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
//                   </linearGradient>
//                 </defs>
                
//                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/>
                
//                 <XAxis 
//                     dataKey="time" 
//                     tick={{fontSize:12, fill: '#9ca3af'}} 
//                     tickCount={10} 
//                     interval="preserveStartEnd"
//                 >
//                     <Label value="Time (seconds)" offset={-5} position="insideBottom" style={{ fill: '#6b7280', fontSize: '12px' }} />
//                 </XAxis>

//                 <YAxis domain={[-50, 50]} tick={{fontSize:12, fill: '#9ca3af'}}>
//                     <Label value="Amplitude (µV)" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: '#6b7280', fontSize: '12px' }} />
//                 </YAxis>

//                 <Tooltip contentStyle={{borderRadius: 12, border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}/>
//                 <Legend verticalAlign="top" height={36}/>
                
//                 {visibleChannels.T7 && (
//                     <Area 
//                         type="monotone" 
//                         dataKey="T7" 
//                         stroke="#3b82f6" 
//                         strokeWidth={2} 
//                         fill="url(#colorT7)" 
//                         name="T7 (Left Logic)"
//                         isAnimationActive={false} 
//                     />
//                 )}
//                 {visibleChannels.F8 && (
//                     <Area 
//                         type="monotone" 
//                         dataKey="F8" 
//                         stroke="#10b981" 
//                         strokeWidth={2} 
//                         fill="url(#colorF8)" 
//                         name="F8 (Right Emotion)"
//                         isAnimationActive={false}
//                     />
//                 )}
//               </AreaChart>
//             </div>
//           </div>
//           <div className="text-center mt-2 text-muted small">
//             <span className="fw-bold">↔ Scroll horizontally</span> to view full recording
//           </div>
//         </div>
//       </div>

//       {/* SECTION B: THE 3D BRAIN MODEL (Takes up 4 columns on the right) */}
//       <div className="col-lg-4 col-12">
//          <SensorMap />
//       </div>

//       {/* SECTION C: METRIC CARDS (Bottom Row) */}
//       <div className="col-md-4">
//         <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
//           <div className="d-flex align-items-center gap-3">
//               <div className="p-3 bg-primary bg-opacity-10 rounded-3 text-primary"><Activity size={24}/></div>
//               <div>
//                   <h6 className="text-muted mb-0 small text-uppercase fw-bold">Peak Amplitude</h6>
//                   <h3 className="fw-bold mb-0 text-dark">
//                       {data.features['F8_Max']?.toFixed(1)} <small className="fs-6 text-muted">µV</small>
//                   </h3>
//               </div>
//           </div>
//         </div>
//       </div>

//       <div className="col-md-4">
//         <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
//           <div className="d-flex align-items-center gap-3">
//               <div className={`p-3 rounded-3 ${data.asymmetry_score > 0 ? 'bg-success text-success' : 'bg-danger text-danger'} bg-opacity-10`}>
//                   <Activity size={24}/>
//               </div>
//               <div>
//                   <h6 className="text-muted mb-0 small text-uppercase fw-bold">Alpha Asymmetry</h6>
//                   <h3 className="fw-bold mb-0 text-dark">
//                       {data.asymmetry_score?.toFixed(3)}
//                   </h3>
//                   <small className={data.asymmetry_score > 0 ? "text-success fw-bold" : "text-danger fw-bold"}>
//                       {data.asymmetry_score > 0 ? "Positive State" : "Withdrawal State"}
//                   </small>
//               </div>
//           </div>
//         </div>
//       </div>

//       <div className="col-md-4">
//         <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
//           <div className="d-flex align-items-center gap-3">
//               <div className="p-3 bg-warning bg-opacity-10 rounded-3 text-warning"><Zap size={24}/></div>
//               <div>
//                   <h6 className="text-muted mb-0 small text-uppercase fw-bold">Signal Quality</h6>
//                   <h3 className="fw-bold mb-0 text-dark">Excellent</h3>
//                   <small className="text-muted">Filtered (Cz/P4 Rejected)</small>
//               </div>
//           </div>
//         </div>
//       </div>

//     </div>
//   );
// };

// export default Dashboard;

