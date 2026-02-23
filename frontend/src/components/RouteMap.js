import React, { useEffect, useRef, useState } from 'react';
import './RouteMap.css';

const STOP_COLORS = {
  start: '#f5820a',
  pickup: '#1d8cf8',
  dropoff: '#00c48c',
  fuel: '#ffd32a',
  rest: '#a855f7',
  break: '#fb923c',
  driving: '#64748b',
};

const STOP_LABELS = {
  start: 'Start',
  pickup: 'Pickup',
  dropoff: 'Dropoff',
  fuel: 'Fuel',
  rest: 'Rest',
  break: 'Break',
};

function RouteMap({ stops, routeCoords }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!window.L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => initMap();
      document.head.appendChild(script);
    } else {
      initMap();
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [stops]);

  const initMap = () => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const L = window.L;

    // Create map
    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    // Dark tile layer (CartoDB dark)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Add attribution small
    L.control.attribution({ prefix: '© CartoDB © OSM' }).addTo(map);

    // Draw route polyline
    const validCoords = stops
      .filter(s => s.lat && s.lon)
      .map(s => [s.lat, s.lon]);

    if (validCoords.length > 1) {
      L.polyline(validCoords, {
        color: '#f5820a',
        weight: 3,
        opacity: 0.8,
        dashArray: null,
      }).addTo(map);
    }

    // Add markers for each stop
    const importantStops = stops.filter(s => ['start', 'pickup', 'dropoff', 'fuel', 'rest', 'break'].includes(s.type));

    importantStops.forEach((stop, i) => {
      if (!stop.lat || !stop.lon) return;

      const color = STOP_COLORS[stop.type] || '#888';
      const icon = L.divIcon({
        className: '',
        html: `
          <div style="
            width: 28px; height: 28px; border-radius: 50%;
            background: ${color}; border: 2px solid rgba(255,255,255,0.8);
            display: flex; align-items: center; justify-content: center;
            font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.5);
            cursor: pointer; font-weight: bold; color: #000;
          ">
            ${getStopEmoji(stop.type)}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([stop.lat, stop.lon], { icon }).addTo(map);

      const popupContent = `
        <div style="
          background: #13202d; border: 1px solid #2a4a63; border-radius: 6px;
          padding: 10px 14px; color: #e8edf2; font-family: monospace; font-size: 12px;
          min-width: 200px;
        ">
          <div style="color: ${color}; font-weight: bold; margin-bottom: 6px; font-size: 13px;">
            ${STOP_LABELS[stop.type] || stop.type} — ${stop.location}
          </div>
          <div style="color: #8a9baa; margin-bottom: 4px;">
            Arrive: ${stop.arrival_time_str}
          </div>
          <div style="color: #8a9baa; margin-bottom: 4px;">
            Depart: ${stop.departure_time_str}
          </div>
          ${stop.cumulative_miles > 0 ? `<div style="color: #8a9baa;">Mile: ${stop.cumulative_miles.toFixed(0)}</div>` : ''}
          ${stop.notes ? `<div style="margin-top: 6px; color: #e8edf2;">${stop.notes}</div>` : ''}
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: 'custom-popup',
        closeButton: false,
      });
    });

    // Fit bounds
    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  };

  return (
    <div className="route-map-container">
      <div className="map-header">
        <span className="map-title">ROUTE MAP</span>
        <div className="map-legend">
          {Object.entries(STOP_LABELS).map(([type, label]) => (
            <span key={type} className="legend-item">
              <span className="legend-dot" style={{ background: STOP_COLORS[type] }} />
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="map-wrapper" ref={mapRef} />
    </div>
  );
}

function getStopEmoji(type) {
  const map = { start: '🚛', pickup: 'P', dropoff: 'D', fuel: 'F', rest: 'R', break: 'B' };
  return map[type] || '•';
}

export default RouteMap;
