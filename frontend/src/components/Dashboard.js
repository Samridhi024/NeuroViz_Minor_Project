import React, { useState } from 'react';
import axios from 'axios';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, Label
} from 'recharts';
import { Upload, Activity, CheckCircle, AlertTriangle, Zap, RefreshCw } from 'lucide-react';

import RawSignalView from './RawSignalView';
import SensorMap from './SensorMap';
import PatientView from './PatientView';

const Dashboard = ({ data, onAnalysisComplete, showCleaned, userMode }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [visibleChannels, setVisibleChannels] = useState({ T7: true, F8: true });

  const handleFileChange = (e) => setFile(e.target.files[0]);
  const toggleChannel = (channel) => setVisibleChannels(prev => ({ ...prev, [channel]: !prev[channel] }));

  const handleNewAnalysis = () => {
    setFile(null);
    onAnalysisComplete(null);
  };

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

  // --- 1. UPLOAD STATE ---
  if (!data) {
    return (
      <div className="card border-0 shadow-sm rounded-4 p-5 text-center align-items-center mt-5 bg-white">
        <div className="bg-primary bg-opacity-10 rounded-circle p-4 mb-3">
          <Upload size={48} className="text-primary"/>
        </div>
        <h3 className="fw-bold mb-2 text-dark">Analyze EEG Recording</h3>
        <p className="text-muted mb-4">Support for clinical .edf and local .txt/.csv files.</p>
        <input type="file" id="file" className="d-none" onChange={handleFileChange} />
        <label htmlFor="file" className="btn btn-outline-primary btn-lg px-5 rounded-pill shadow-sm mb-3">
          {file ? file.name : "Select File"}
        </label>
        {file && (
          <button onClick={handleUpload} className="btn btn-primary btn-lg w-100 rounded-pill shadow" disabled={loading}>
            {loading ? "Processing..." : "Run Real-time Analysis"}
          </button>
        )}
      </div>
    );
  }

  const chartWidth = data?.clean_graph ? Math.max(1000, data.clean_graph.length * 3) : "100%";

  if (userMode === 'patient') {
    return <PatientView data={data} />;
  }

  // --- 2. CLINICIAN DASHBOARD ---
  return (
    <div className="fade-in">
      {/* HEADER SECTION */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold mb-0">Analysis Results</h2>
          <div className="d-inline-flex align-items-center bg-light border border-light-subtle px-3 py-1 rounded-pill mt-1">
            <span className="text-muted small fw-medium font-monospace">
              FILE: {data.raw_stats?.File || "LOCAL_STREAM"}
            </span>
          </div>
        </div>
        <button onClick={handleNewAnalysis} className="btn btn-white border border-light-subtle shadow-sm rounded-pill px-4 d-flex align-items-center gap-2 text-muted fw-medium bg-white">
          <RefreshCw size={18} className="text-primary" /> New Analysis
        </button>
      </div>

      {!showCleaned ? (
        /* RAW VIEW */
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h4 className="fw-bold text-danger mb-0 d-flex align-items-center gap-2">
              <AlertTriangle size={24} /> Raw Input Monitor
            </h4>
            <span className="badge bg-secondary bg-opacity-10 text-secondary px-3 py-2 rounded-pill">Unfiltered Baseline</span>
          </div>
          <RawSignalView data={data?.raw_graph} stats={data?.raw_stats} features={data.features} />
        </div>
      ) : (
        /* CLEANED VIEW */
        <div className="row g-4">
          <div className="col-lg-8 col-12">
            <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                  <h5 className="fw-bold mb-1 text-success d-flex align-items-center gap-2">
                    <CheckCircle size={20}/> Processed Signal Overview
                  </h5>
                  <p className="text-muted small mb-0">Bandpass (0.5-45Hz) • Notch (50Hz) • Z-Score</p>
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
                  <AreaChart 
                    width={typeof chartWidth === 'number' ? chartWidth : 1000} 
                    height={320} 
                    data={data?.clean_graph} 
                    margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/>
                    <XAxis 
                      dataKey="time" 
                      tick={{fontSize:12, fill: '#9ca3af'}} 
                      height={50} // Added height to make room for the label
                    >
                      <Label 
                        value="Time (Seconds)" 
                        offset={0} 
                        position="insideBottom" 
                        style={{ fill: '#6b7280', fontSize: '14px', fontWeight: 'bold' }} 
                      />
                    </XAxis>

                    <YAxis 
                      domain={[-4, 4]} // Fixed range for Z-score normalization
                      tick={{fontSize:12, fill: '#9ca3af'}}
                      width={60} // Added width to make room for the label
                    >
                      <Label 
                        value="Amplitude (Z-Score)" 
                        angle={-90} 
                        position="insideLeft" 
                        style={{ textAnchor: 'middle', fill: '#6b7280', fontSize: '14px', fontWeight: 'bold' }} 
                      />
                    </YAxis>
                    <Tooltip />
                    {visibleChannels.T7 && <Area type="monotone" dataKey="T7" stroke="#3b82f6" strokeWidth={2} fillOpacity={0.1} fill="#3b82f6" name="T7 Channel" isAnimationActive={false} />}
                    {visibleChannels.F8 && <Area type="monotone" dataKey="F8" stroke="#10b981" strokeWidth={2} fillOpacity={0.1} fill="#10b981" name="F8 Channel" isAnimationActive={false} />}
                  </AreaChart>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-4 col-12"><SensorMap /></div>

          {/* RESTORED METRIC CARDS SECTION */}
          <div className="col-md-4">
            <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white border-bottom border-4 border-primary">
              <div className="d-flex align-items-center gap-3">
                <div className="p-3 bg-primary bg-opacity-10 rounded-3 text-primary"><Activity size={24}/></div>
                <div>
                  <h6 className="text-muted mb-0 small text-uppercase fw-bold">Peak Amplitude (F8)</h6>
                  <h3 className="fw-bold mb-0 text-dark">
                    {data.features?.['F8_Max']?.toFixed(1) || "0.0"} <small className="fs-6 text-muted">Rel.</small>
                  </h3>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-4">
            <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white border-bottom border-4 border-success">
              <div className="d-flex align-items-center gap-3">
                <div className={`p-3 rounded-3 ${data.asymmetry_score > 0 ? 'bg-success text-success' : 'bg-danger text-danger'} bg-opacity-10`}><Activity size={24}/></div>
                <div>
                  <h6 className="text-muted mb-0 small text-uppercase fw-bold">Alpha Asymmetry</h6>
                  <h3 className="fw-bold mb-0 text-dark">{data.asymmetry_score?.toFixed(3) || "0.000"}</h3>
                  <small className={data.asymmetry_score > 0 ? "text-success fw-bold" : "text-danger fw-bold"}>
                    {data.asymmetry_score > 0 ? "Approach Motivation" : "Withdrawal State"}
                  </small>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-4">
            <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white border-bottom border-4 border-warning">
              <div className="d-flex align-items-center gap-3">
                <div className="p-3 bg-warning bg-opacity-10 rounded-3 text-warning"><Zap size={24}/></div>
                <div>
                  <h6 className="text-muted mb-0 small text-uppercase fw-bold">Signal Health</h6>
                  <h3 className="fw-bold mb-0 text-dark">Stable</h3>
                  <small className="text-muted">Analyzed • Clean Output</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

// import React, { useState } from 'react';
// import axios from 'axios';
// import { 
//   XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, 
// } from 'recharts';
// import { Upload, CheckCircle, AlertTriangle} from 'lucide-react';

// import RawSignalView from './RawSignalView';
// import SensorMap from './SensorMap';
// import PatientView from './PatientView';

// const Dashboard = ({ data, onAnalysisComplete, showCleaned, userMode }) => {
//   const [file, setFile] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [visibleChannels, setVisibleChannels] = useState({ T7: true, F8: true });

//   const handleFileChange = (e) => setFile(e.target.files[0]);
//   const toggleChannel = (channel) => setVisibleChannels(prev => ({ ...prev, [channel]: !prev[channel] }));

//   const handleNewAnalysis = () => {
//     setFile(null);
//     onAnalysisComplete(null);
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

//   // UPLOAD STATE 
//   if (!data) {
//     return (
//       <div className="card border-0 shadow-sm rounded-4 p-5 text-center align-items-center mt-5 bg-white">
//         <div className="bg-primary bg-opacity-10 rounded-circle p-4 mb-3">
//           <Upload size={48} className="text-primary"/>
//         </div>
//         <h3 className="fw-bold mb-2 text-dark">Analyze EEG Recording</h3>
//         <p className="text-muted mb-4">Support for clinical .edf and local .txt/.csv files.</p>
//         <input type="file" id="file" className="d-none" onChange={handleFileChange} />
//         <label htmlFor="file" className="btn btn-outline-primary btn-lg px-5 rounded-pill shadow-sm mb-3">
//           {file ? file.name : "Select File"}
//         </label>
//         {file && (
//           <button onClick={handleUpload} className="btn btn-primary btn-lg w-100 rounded-pill shadow" disabled={loading}>
//             {loading ? "Processing..." : "Run Real-time Analysis"}
//           </button>
//         )}
//       </div>
//     );
//   }

//   const chartWidth = data?.clean_graph ? Math.max(1000, data.clean_graph.length * 3) : "100%";

//   if (userMode === 'patient') {
//     return <PatientView data={data} />;
//   }

//   return (
//     <div className="fade-in">
//       <div className="d-flex justify-content-between align-items-center mb-4">
//         <div>
//           <h2 className="fw-bold mb-0">Analysis Results</h2>
//           <p className="text-muted small mb-0">File: {data.raw_stats?.File || 'Session_Active'}</p>
//         </div>
//         <button onClick={handleNewAnalysis} className="btn btn-dark rounded-pill px-4 d-flex align-items-center gap-2">
//           <Upload size={18} /> New Analysis
//         </button>
//       </div>

//       {!showCleaned ? (
//         <div className="col-12">
//           <div className="d-flex justify-content-between align-items-center mb-4">
//             <h4 className="fw-bold text-danger mb-0 d-flex align-items-center gap-2">
//               <AlertTriangle size={24} /> Raw Input Monitor
//             </h4>
//           </div>
//           <RawSignalView data={data?.raw_graph} stats={data?.raw_stats} features={data.features} />
//         </div>
//       ) : (
//         <div className="row g-4">
//           <div className="col-lg-8 col-12">
//             <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
//               <h5 className="fw-bold mb-4 text-success d-flex align-items-center gap-2">
//                 <CheckCircle size={20}/> Live Signal Overview
//               </h5>
//               <div className="w-100 border rounded-3 bg-light" style={{ overflowX: 'auto', overflowY: 'hidden' }}>
//                 <div style={{ width: chartWidth, height: 350, backgroundColor: '#fff' }}>
//                   <AreaChart 
//                     width={typeof chartWidth === 'number' ? chartWidth : 1000} 
//                     height={320} 
//                     data={data?.clean_graph} 
//                     margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
//                   >
//                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/>
//                     <XAxis dataKey="time" tick={{fontSize:12}} />
//                     <YAxis domain={['auto', 'auto']} tick={{fontSize:12}} />
//                     <Tooltip />
//                     {visibleChannels.T7 && <Area type="monotone" dataKey="T7" stroke="#3b82f6" fillOpacity={0.1} fill="#3b82f6" isAnimationActive={false} />}
//                     {visibleChannels.F8 && <Area type="monotone" dataKey="F8" stroke="#10b981" fillOpacity={0.1} fill="#10b981" isAnimationActive={false} />}
//                   </AreaChart>
//                 </div>
//               </div>
//             </div>
//           </div>
//           <div className="col-lg-4 col-12"><SensorMap /></div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default Dashboard;
