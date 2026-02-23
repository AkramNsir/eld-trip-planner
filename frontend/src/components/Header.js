import React from 'react';
import './Header.css';

function Header() {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="logo">
          <div className="logo-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="1" y="18" width="30" height="10" rx="2" stroke="#f5820a" strokeWidth="1.5"/>
              <rect x="19" y="8" width="12" height="10" rx="1.5" stroke="#f5820a" strokeWidth="1.5"/>
              <circle cx="7" cy="28" r="3" fill="none" stroke="#f5820a" strokeWidth="1.5"/>
              <circle cx="25" cy="28" r="3" fill="none" stroke="#f5820a" strokeWidth="1.5"/>
              <line x1="1" y1="18" x2="19" y2="18" stroke="#f5820a" strokeWidth="1.5"/>
            </svg>
          </div>
          <div className="logo-text">
            <span className="logo-main">ELD<span className="logo-accent">PLANNER</span></span>
            <span className="logo-sub">FMCSA HOS COMPLIANT</span>
          </div>
        </div>
        <nav className="header-nav">
          <span className="nav-item active">TRIP PLANNER</span>
          <a className="nav-item" href="https://www.fmcsa.dot.gov/regulations/hours-of-service" target="_blank" rel="noreferrer">HOS REGULATIONS</a>
        </nav>
      </div>
    </header>
  );
}

export default Header;
