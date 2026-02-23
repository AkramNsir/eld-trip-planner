import React, { useState } from 'react';
import TripForm from './components/TripForm';
import TripResults from './components/TripResults';
import Header from './components/Header';
import './App.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

function App() {
  const [tripData, setTripData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cycleWarning, setCycleWarning] = useState(null);

  const handlePlanTrip = async (formData) => {
    setLoading(true);
    setError(null);
    setTripData(null);
    setCycleWarning(null);

    try {
      const response = await fetch(`${API_BASE}/plan-trip/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        // Hard cycle limit — special error with more detail
        if (data.cycle_warning && data.cycle_warning_type === 'hard_limit') {
          setError(data.message);
        } else {
          throw new Error(data.error || 'Failed to plan trip');
        }
        return;
      }

      // Soft cycle warning — trip planned but with a caveat
      if (data.cycle_warning && data.cycle_warning_type === 'soft_limit') {
        setCycleWarning(data.cycle_warning_message);
      }

      setTripData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTripData(null);
    setError(null);
    setCycleWarning(null);
  };

  return (
    <div className="app">
      <Header />
      <main className="main-content">
        {!tripData ? (
          <div className="form-section">
            <div className="hero-text">
              <h2 className="hero-title">HOS-COMPLIANT ROUTE PLANNER</h2>
              <p className="hero-subtitle">
                Enter your trip details to generate a compliant route with stops, rest periods, and ELD daily logs.
              </p>
              <div className="reg-badges">
                <span className="badge">70hr/8-day Rule</span>
                <span className="badge">11hr Drive Limit</span>
                <span className="badge">14hr Window</span>
                <span className="badge">30-min Break</span>
              </div>
            </div>
            <TripForm onSubmit={handlePlanTrip} loading={loading} />
            {error && (
              <div className="error-box">
                <span className="error-icon">⚠</span>
                <span>{error}</span>
              </div>
            )}
          </div>
        ) : (
          <TripResults data={tripData} onReset={handleReset} cycleWarning={cycleWarning} />
        )}
      </main>
      <footer className="app-footer">
        <p>Based on FMCSA 49 CFR Part 395 — Property Carrier HOS Regulations</p>
      </footer>
    </div>
  );
}

export default App;
