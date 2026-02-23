import React, { useState } from 'react';
import RouteMap from './RouteMap';
import StopsList from './StopsList';
import ELDLogSheet from './ELDLogSheet';
import './TripResults.css';

function TripResults({ data, onReset, cycleWarning }) {
  const [activeTab, setActiveTab] = useState('map');
  const [activeDay, setActiveDay] = useState(0);

  const { stops, day_logs, summary } = data;


  return (
    <div className="results-container">
      {/* Summary Bar */}
      <div className="summary-bar">
        <div className="summary-inner">
          <div className="summary-stat">
            <span className="stat-value">{summary.total_miles.toLocaleString()}</span>
            <span className="stat-label">TOTAL MILES</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-stat">
            <span className="stat-value">{summary.total_days}</span>
            <span className="stat-label">DAYS</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-stat">
            <span className="stat-value">{stops.filter(s => s.type === 'rest').length}</span>
            <span className="stat-label">REST STOPS</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-stat">
            <span className="stat-value">{stops.filter(s => s.type === 'fuel').length}</span>
            <span className="stat-label">FUEL STOPS</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-stat">
            <span className="stat-value">{summary.total_trip_hours.toFixed(1)}</span>
            <span className="stat-label">TOTAL HOURS</span>
          </div>
          <div className="reset-btn-wrap">
            <button className="reset-btn" onClick={onReset}>← NEW TRIP</button>
          </div>
        </div>
      </div>

      {/* Cycle Warning Banner */}
      {cycleWarning && (
        <div className="cycle-warning-banner">
          <span className="cycle-warning-icon">⚠</span>
          <div>
            <strong>70-Hour Cycle Warning</strong>
            <p>{cycleWarning}</p>
          </div>
        </div>
      )}

      {/* Tab Nav */}
      <div className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          <span className="tab-icon">🗺</span> ROUTE MAP
        </button>
        <button
          className={`tab-btn ${activeTab === 'stops' ? 'active' : ''}`}
          onClick={() => setActiveTab('stops')}
        >
          <span className="tab-icon">📋</span> STOP DETAILS
        </button>
        <button
          className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <span className="tab-icon">📝</span> ELD DAILY LOGS ({day_logs.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'map' && (
          <div className="map-tab">
            <RouteMap stops={stops} routeCoords={summary.route_coords} />
            <StopsList stops={stops} compact />
          </div>
        )}

        {activeTab === 'stops' && (
          <StopsList stops={stops} />
        )}

        {activeTab === 'logs' && (
          <div className="logs-tab">
            <div className="day-selector">
              {day_logs.map((log, i) => (
                <button
                  key={i}
                  className={`day-btn ${activeDay === i ? 'active' : ''}`}
                  onClick={() => setActiveDay(i)}
                >
                  DAY {log.day_number}
                  <span className="day-drive">{log.total_driving.toFixed(1)}h drive</span>
                </button>
              ))}
            </div>
            {day_logs[activeDay] && (
              <ELDLogSheet log={day_logs[activeDay]} dayIndex={activeDay} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TripResults;
