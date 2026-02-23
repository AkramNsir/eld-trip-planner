import React, { useState, useRef } from 'react';
import './TripForm.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

function LocationInput({ label, placeholder, value, onChange, required }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const debounceRef = useRef(null);

  const handleChange = (e) => {
    const val = e.target.value;
    onChange({ text: val, lat: null, lon: null });

    clearTimeout(debounceRef.current);
    if (val.length < 3) { setSuggestions([]); return; }

    debounceRef.current = setTimeout(async () => {
      try {
        const resp = await fetch(`${API_BASE}/geocode/?q=${encodeURIComponent(val)}`);
        if (!resp.ok) return;
        const data = await resp.json();
        setSuggestions(data.results || []);
        setShowSugg(true);
      } catch (e) { /* silently fail */ }
    }, 400);
  };

  const selectSuggestion = (s) => {
    // Extract a clean display name (city, state)
    const parts = s.name.split(',');
    const shortName = parts.slice(0, 2).join(',').trim();
    onChange({ text: shortName, lat: s.lat, lon: s.lon });
    setSuggestions([]);
    setShowSugg(false);
  };

  return (
    <div className="location-input-wrap">
      <label className="input-label">{label}</label>
      <div className="input-container">
        <input
          className="text-input"
          type="text"
          placeholder={placeholder}
          value={value.text}
          onChange={handleChange}
          onBlur={() => setTimeout(() => setShowSugg(false), 200)}
          onFocus={() => suggestions.length > 0 && setShowSugg(true)}
          required={required}
          autoComplete="off"
        />
        {value.lat && (
          <span className="coord-badge">
            {value.lat.toFixed(3)}, {value.lon.toFixed(3)}
          </span>
        )}
        {showSugg && suggestions.length > 0 && (
          <ul className="suggestions">
            {suggestions.slice(0, 5).map((s, i) => (
              <li key={i} onMouseDown={() => selectSuggestion(s)}>
                <span className="sugg-icon">📍</span>
                <span className="sugg-text">
                  {s.name.split(',').slice(0, 3).join(',')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TripForm({ onSubmit, loading }) {
  const [form, setForm] = useState({
    currentLocation: { text: '', lat: null, lon: null },
    pickupLocation: { text: '', lat: null, lon: null },
    dropoffLocation: { text: '', lat: null, lon: null },
    cycleHoursUsed: '',
  });

  const [validationError, setValidationError] = useState('');

  const setLocation = (key) => (val) => {
    setForm(f => ({ ...f, [key]: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError('');

    const { currentLocation, pickupLocation, dropoffLocation, cycleHoursUsed } = form;

    if (!currentLocation.lat || !pickupLocation.lat || !dropoffLocation.lat) {
      setValidationError('Please select locations from the dropdown suggestions to get coordinates.');
      return;
    }

    const cycle = parseFloat(cycleHoursUsed);
    if (isNaN(cycle) || cycle < 0 || cycle > 70) {
      setValidationError('Cycle hours must be between 0 and 70.');
      return;
    }

    onSubmit({
      current_lat: currentLocation.lat,
      current_lon: currentLocation.lon,
      current_location: currentLocation.text,
      pickup_lat: pickupLocation.lat,
      pickup_lon: pickupLocation.lon,
      pickup_location: pickupLocation.text,
      dropoff_lat: dropoffLocation.lat,
      dropoff_lon: dropoffLocation.lon,
      dropoff_location: dropoffLocation.text,
      cycle_hours_used: cycle,
    });
  };

  // Example trips for quick testing
  const loadExample = (example) => {
    const examples = {
      short: {
        currentLocation: { text: 'Chicago, IL', lat: 41.8781, lon: -87.6298 },
        pickupLocation: { text: 'Indianapolis, IN', lat: 39.7684, lon: -86.1581 },
        dropoffLocation: { text: 'Columbus, OH', lat: 39.9612, lon: -82.9988 },
        cycleHoursUsed: '20',
      },
      long: {
        currentLocation: { text: 'Los Angeles, CA', lat: 34.0522, lon: -118.2437 },
        pickupLocation: { text: 'Phoenix, AZ', lat: 33.4484, lon: -112.0740 },
        dropoffLocation: { text: 'Dallas, TX', lat: 32.7767, lon: -96.7970 },
        cycleHoursUsed: '35',
      },
      crosscountry: {
        currentLocation: { text: 'Seattle, WA', lat: 47.6062, lon: -122.3321 },
        pickupLocation: { text: 'Portland, OR', lat: 45.5051, lon: -122.6750 },
        dropoffLocation: { text: 'New York, NY', lat: 40.7128, lon: -74.0060 },
        cycleHoursUsed: '10',
      },
    };
    setForm({ ...examples[example] });
  };

  return (
    <form className="trip-form" onSubmit={handleSubmit}>
      <div className="form-card">
        <div className="form-card-header">
          <h3>TRIP DETAILS</h3>
          <div className="example-btns">
            <span className="example-label">Quick load:</span>
            <button type="button" className="example-btn" onClick={() => loadExample('short')}>Short</button>
            <button type="button" className="example-btn" onClick={() => loadExample('long')}>Medium</button>
            <button type="button" className="example-btn" onClick={() => loadExample('crosscountry')}>Cross-Country</button>
          </div>
        </div>

        <div className="form-grid">
          <LocationInput
            label="CURRENT LOCATION"
            placeholder="e.g. Chicago, IL"
            value={form.currentLocation}
            onChange={setLocation('currentLocation')}
            required
          />
          <LocationInput
            label="PICKUP LOCATION"
            placeholder="e.g. Indianapolis, IN"
            value={form.pickupLocation}
            onChange={setLocation('pickupLocation')}
            required
          />
          <LocationInput
            label="DROPOFF LOCATION"
            placeholder="e.g. Columbus, OH"
            value={form.dropoffLocation}
            onChange={setLocation('dropoffLocation')}
            required
          />

          <div className="cycle-input-wrap">
            <label className="input-label">CURRENT CYCLE USED (HRS)</label>
            <div className="input-container">
              <input
                className="text-input"
                type="number"
                min="0"
                max="70"
                step="0.5"
                placeholder="0–70 hours"
                value={form.cycleHoursUsed}
                onChange={e => setForm(f => ({ ...f, cycleHoursUsed: e.target.value }))}
                required
              />
              <div className="cycle-hint">
                <div className="cycle-bar">
                  <div
                    className="cycle-fill"
                    style={{ width: `${Math.min((parseFloat(form.cycleHoursUsed) || 0) / 70 * 100, 100)}%` }}
                  />
                </div>
                <span className="cycle-remaining">
                  {form.cycleHoursUsed ? `${(70 - parseFloat(form.cycleHoursUsed)).toFixed(1)} hrs remaining` : '70 hrs max (8-day)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {validationError && (
          <div className="validation-error">
            <span>⚠</span> {validationError}
          </div>
        )}

        <div className="assumptions-box">
          <h4>BUILT-IN ASSUMPTIONS</h4>
          <div className="assumptions-grid">
            <span>✓ Property-carrying CMV</span>
            <span>✓ 70 hrs / 8-day cycle</span>
            <span>✓ 11-hr driving limit</span>
            <span>✓ 14-hr driving window</span>
            <span>✓ 10-hr off-duty rest</span>
            <span>✓ 30-min break @ 8 hrs</span>
            <span>✓ Fuel every 1,000 mi</span>
            <span>✓ 1 hr pickup + dropoff</span>
            <span>✓ Avg speed 55 mph</span>
            <span>✓ No adverse conditions</span>
          </div>
        </div>

        <button className="submit-btn" type="submit" disabled={loading}>
          {loading ? (
            <span className="loading-content">
              <span className="spinner" />
              CALCULATING ROUTE...
            </span>
          ) : (
            <span>PLAN TRIP →</span>
          )}
        </button>
      </div>
    </form>
  );
}

export default TripForm;
