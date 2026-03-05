import React, { useState } from 'react';
import axios from 'axios';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, 
} from 'recharts';
import { Upload, CheckCircle, AlertTriangle} from 'lucide-react';

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

  // UPLOAD STATE 
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

  return (
    <div className="fade-in">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold mb-0">Analysis Results</h2>
          <p className="text-muted small mb-0">File: {data.raw_stats?.File || 'Session_Active'}</p>
        </div>
        <button onClick={handleNewAnalysis} className="btn btn-dark rounded-pill px-4 d-flex align-items-center gap-2">
          <Upload size={18} /> New Analysis
        </button>
      </div>

      {!showCleaned ? (
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h4 className="fw-bold text-danger mb-0 d-flex align-items-center gap-2">
              <AlertTriangle size={24} /> Raw Input Monitor
            </h4>
          </div>
          <RawSignalView data={data?.raw_graph} stats={data?.raw_stats} features={data.features} />
        </div>
      ) : (
        <div className="row g-4">
          <div className="col-lg-8 col-12">
            <div className="card border-0 shadow-sm rounded-4 p-4 h-100 bg-white">
              <h5 className="fw-bold mb-4 text-success d-flex align-items-center gap-2">
                <CheckCircle size={20}/> Live Signal Overview
              </h5>
              <div className="w-100 border rounded-3 bg-light" style={{ overflowX: 'auto', overflowY: 'hidden' }}>
                <div style={{ width: chartWidth, height: 350, backgroundColor: '#fff' }}>
                  <AreaChart 
                    width={typeof chartWidth === 'number' ? chartWidth : 1000} 
                    height={320} 
                    data={data?.clean_graph} 
                    margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/>
                    <XAxis dataKey="time" tick={{fontSize:12}} />
                    <YAxis domain={['auto', 'auto']} tick={{fontSize:12}} />
                    <Tooltip />
                    {visibleChannels.T7 && <Area type="monotone" dataKey="T7" stroke="#3b82f6" fillOpacity={0.1} fill="#3b82f6" isAnimationActive={false} />}
                    {visibleChannels.F8 && <Area type="monotone" dataKey="F8" stroke="#10b981" fillOpacity={0.1} fill="#10b981" isAnimationActive={false} />}
                  </AreaChart>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-4 col-12"><SensorMap /></div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
