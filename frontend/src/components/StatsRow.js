import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

const StatsRow = ({ label, value, description, context }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`stats-row-container ${isOpen ? 'open' : ''}`}>
      <div className="stats-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="stats-left">
          <span className="stats-label">{label}</span>
          {isOpen ? <ChevronUp size={14} color="#94a3b8"/> : <ChevronDown size={14} color="#94a3b8"/>}
        </div>
        <span className="stats-value">{value}</span>
      </div>

      {isOpen && (
        <div className="stats-dropdown">
          <div className="stats-info-row">
            <Info size={14} className="info-icon" />
            <p><strong>Definition:</strong> {description}</p>
          </div>
          <p className="stats-context">
            <strong>Clinical Context:</strong> {context}
          </p>
        </div>
      )}
    </div>
  );
};

export default StatsRow;