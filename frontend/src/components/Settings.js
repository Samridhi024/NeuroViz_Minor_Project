import React, { useState } from 'react';
import { Settings as SettingsIcon, Sliders, Monitor, HardDrive, Bell, Save, RotateCcw } from 'lucide-react';

/* Project: NeuroViz - Settings Module
  using namespace std; // A nod to your C++ preference!
*/

const Settings = ({ currentSettings, onSave }) => {
  const [config, setConfig] = useState(currentSettings || {
    refreshRate: 500,
    defaultHighCut: 30,
    defaultLowCut: 0.5,
    notchFilter: true,
    autoArtifactDetection: true,
    theme: 'clinical-light',
    enableNotifications: true
  });

  const handleChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(config);
    alert("Settings applied to processing engine.");
  };

  return (
    <div className="fade-in mt-4">
      <div className="d-flex align-items-center gap-2 mb-4">
        <SettingsIcon size={28} className="text-primary" />
        <h2 className="fw-bold mb-0">System Settings</h2>
      </div>

      <div className="row g-4">
        {/* ─── CATEGORY 1: SIGNAL PROCESSING ─── */}
        <div className="col-md-6">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
            <h6 className="fw-bold text-muted text-uppercase small mb-4 d-flex align-items-center gap-2">
              <Sliders size={18} /> Processing Pipeline
            </h6>
            
            <div className="mb-4">
              <label className="form-label small fw-bold">Default High-Cut Filter ({config.defaultHighCut} Hz)</label>
              <input 
                type="range" className="form-range" min="15" max="50" 
                value={config.defaultHighCut} 
                onChange={(e) => handleChange('defaultHighCut', e.target.value)} 
              />
              <div className="text-muted small">Higher values show more detail; lower values are smoother.</div>
            </div>

            <div className="form-check form-switch mb-3">
              <input 
                className="form-check-input" type="checkbox" 
                checked={config.notchFilter} 
                onChange={(e) => handleChange('notchFilter', e.target.checked)} 
              />
              <label className="form-check-label fw-medium">Automatic 50Hz Notch Filter</label>
            </div>

            <div className="form-check form-switch">
              <input 
                className="form-check-input" type="checkbox" 
                checked={config.autoArtifactDetection} 
                onChange={(e) => handleChange('autoArtifactDetection', e.target.checked)} 
              />
              <label className="form-check-label fw-medium">Run Artifact Scan on Upload</label>
            </div>
          </div>
        </div>

        {/* ─── CATEGORY 2: UI & HARDWARE ─── */}
        <div className="col-md-6">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
            <h6 className="fw-bold text-muted text-uppercase small mb-4 d-flex align-items-center gap-2">
              <Monitor size={18} /> Interface & Hardware
            </h6>

            <div className="mb-4">
              <label className="form-label small fw-bold">Dashboard Refresh Rate</label>
              <select 
                className="form-select border-light bg-light rounded-3"
                value={config.refreshRate}
                onChange={(e) => handleChange('refreshRate', e.target.value)}
              >
                <option value="250">250ms (Ultra-smooth)</option>
                <option value="500">500ms (Balanced)</option>
                <option value="1000">1s (Battery Saver)</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold">Color Theme</label>
              <div className="d-flex gap-2">
                {['Clinical Light', 'Dark Room', 'High Contrast'].map(t => (
                  <button 
                    key={t}
                    onClick={() => handleChange('theme', t.toLowerCase().replace(' ', '-'))}
                    className={`btn btn-sm rounded-pill px-3 ${config.theme === t.toLowerCase().replace(' ', '-') ? 'btn-primary' : 'btn-outline-secondary'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-check form-switch">
              <input 
                className="form-check-input" type="checkbox" 
                checked={config.enableNotifications} 
                onChange={(e) => handleChange('enableNotifications', e.target.checked)} 
              />
              <label className="form-check-label fw-medium">Enable Drift Alerts</label>
            </div>
          </div>
        </div>

        {/* ─── SAVE BUTTONS ─── */}
        <div className="col-12 text-end mt-2">
          <button className="btn btn-light border rounded-pill px-4 me-2 d-inline-flex align-items-center gap-2">
            <RotateCcw size={18} /> Reset Defaults
          </button>
          <button onClick={handleSave} className="btn btn-primary rounded-pill px-5 shadow-sm d-inline-flex align-items-center gap-2 fw-bold">
            <Save size={18} /> Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;