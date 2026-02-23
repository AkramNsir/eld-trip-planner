import React from 'react';
import './StopsList.css';

const TYPE_CONFIG = {
  start: { label: 'START', color: '#f5820a', icon: '🚛', bg: 'rgba(245,130,10,0.1)' },
  pickup: { label: 'PICKUP', color: '#1d8cf8', icon: '📦', bg: 'rgba(29,140,248,0.1)' },
  dropoff: { label: 'DROPOFF', color: '#00c48c', icon: '🏁', bg: 'rgba(0,196,140,0.1)' },
  fuel: { label: 'FUEL (ON DUTY)', color: '#ffd32a', icon: '⛽', bg: 'rgba(255,211,42,0.1)' },
  rest: { label: '10-HR REST', color: '#a855f7', icon: '🛏', bg: 'rgba(168,85,247,0.1)' },
  break: { label: '30-MIN BREAK', color: '#fb923c', icon: '☕', bg: 'rgba(251,146,60,0.1)' },
};

function StopsList({ stops, compact }) {
  if (compact) {
    return (
      <div className="stops-sidebar">
        <div className="stops-sidebar-header">STOP TIMELINE</div>
        <div className="stops-sidebar-list">
          {stops.map((stop, i) => {
            const cfg = TYPE_CONFIG[stop.type] || { label: stop.type, color: '#888', icon: '•', bg: '#1a2d3e' };
            return (
              <div key={i} className="sidebar-stop">
                <div className="sidebar-stop-icon" style={{ color: cfg.color }}>{cfg.icon}</div>
                <div className="sidebar-stop-info">
                  <div className="sidebar-stop-type" style={{ color: cfg.color }}>{cfg.label}</div>
                  <div className="sidebar-stop-loc">{stop.location}</div>
                  <div className="sidebar-stop-time">{stop.arrival_time_str}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="stops-list">
      <h3 className="stops-list-title">FULL TRIP TIMELINE</h3>
      <div className="stops-table">
        <div className="stops-header-row">
          <span>#</span>
          <span>TYPE</span>
          <span>LOCATION</span>
          <span>ARRIVE</span>
          <span>DEPART</span>
          <span>DURATION</span>
          <span>MILES</span>
          <span>ODOMETER</span>
          <span>NOTES</span>
        </div>
        {stops.map((stop, i) => {
          const cfg = TYPE_CONFIG[stop.type] || { label: stop.type.toUpperCase(), color: '#888', icon: '•', bg: '#1a2d3e' };
          return (
            <div key={i} className="stop-row" style={{ borderLeftColor: cfg.color }}>
              <span className="stop-num">{i + 1}</span>
              <span>
                <span className="stop-type-badge" style={{ color: cfg.color, background: cfg.bg }}>
                  {cfg.icon} {cfg.label}
                </span>
              </span>
              <span className="stop-location">{stop.location}</span>
              <span className="stop-time">{stop.arrival_time_str}</span>
              <span className="stop-time">{stop.departure_time_str}</span>
              <span className="stop-dur">
                {stop.duration_hours === 0 ? '—' :
                  stop.duration_hours < 1
                    ? `${Math.round(stop.duration_hours * 60)} min`
                    : `${stop.duration_hours.toFixed(1)} hrs`
                }
              </span>
              <span className="stop-miles">
                {stop.miles_from_prev > 0 ? `+${stop.miles_from_prev.toFixed(0)}` : '—'}
              </span>
              <span className="stop-odo">
                {stop.cumulative_miles > 0 ? stop.cumulative_miles.toFixed(0) : '—'}
              </span>
              <span className="stop-notes">{stop.notes}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default StopsList;
