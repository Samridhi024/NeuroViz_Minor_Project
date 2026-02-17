// File: src/components/Sidebar.js
import React from 'react';
import { LayoutDashboard, FileText, Settings, Brain, LogOut } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, disableResults }) => {
  return (
    <div className="d-flex flex-column p-4 h-100 bg-white shadow-sm sidebar-container">
      <div className="d-flex align-items-center gap-2 mb-5 px-2">
        <div className="bg-primary bg-opacity-10 p-2 rounded-3">
            <Brain size={28} className="text-primary" />
        </div>
        <span className="fw-bold fs-4 text-dark tracking-tight">NeuroViz</span>
      </div>
      
      {/* MENU */}
      <ul className="nav nav-pills flex-column gap-2">
        <li className="nav-item">
          <button 
            className={`nav-link d-flex align-items-center gap-3 w-100 ${activeTab === 'dashboard' ? 'active shadow-sm' : 'text-secondary'}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={20}/> 
            <span className="fw-medium">Dashboard</span>
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link d-flex align-items-center gap-3 w-100 ${activeTab === 'results' ? 'active shadow-sm' : 'text-secondary'}`}
            onClick={() => setActiveTab('results')}
            disabled={disableResults}
            style={{ opacity: disableResults ? 0.6 : 1, cursor: disableResults ? 'not-allowed' : 'pointer' }}
          >
            <FileText size={20}/> 
            <span className="fw-medium">Test Results</span>
          </button>
        </li>
        <li className="nav-item">
          <button className="nav-link d-flex align-items-center gap-3 w-100 text-secondary">
            <Settings size={20}/> 
            <span className="fw-medium">Settings</span>
          </button>
        </li>
      </ul>

      {/* FOOTER */}
      <div className="mt-auto pt-4 border-top">
        <button className="nav-link d-flex align-items-center gap-3 w-100 text-danger hover-bg-danger-subtle rounded-3 px-3 py-2">
          <LogOut size={20}/> 
          <span className="fw-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;