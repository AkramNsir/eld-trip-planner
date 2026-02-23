import React, { useEffect, useRef } from 'react';
import './ELDLogSheet.css';

/**
 * Convert decimal hours to HH:MM format (e.g. 8.92 → "8:55", NOT "8.92")
 * Because 0.92 * 60 = 55 minutes, not 92 minutes.
 */
function decimalToHHMM(decHours) {
  const totalMinutes = Math.round(decHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/**
 * ELDLogSheet renders an official FMCSA Driver's Daily Log
 * using HTML Canvas — matching the standard paper log format.
 */
function ELDLogSheet({ log, dayIndex }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    drawLog();
  }, [log]); // eslint-disable-line react-hooks/exhaustive-deps

  const drawLog = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const W = canvas.width;
    const H = canvas.height;

    // Clear
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);

    // Colors
    const C = {
      black: '#0a0a0a',
      gray: '#888',
      lightGray: '#ddd',
      blue: '#1a3a6b',
      orange: '#d4550a',
      gridBg: '#f8f9fa',
      offDuty: '#4a90d9',
      sleeper: '#9b59b6',
      driving: '#27ae60',
      onDuty: '#e67e22',
    };

    // Fonts
    const FONT = 'Arial';

    // ===== HEADER =====
    // Title
    ctx.fillStyle = C.blue;
    ctx.font = `bold 16px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText("DRIVER'S DAILY LOG", 20, 28);

    ctx.font = `11px ${FONT}`;
    ctx.fillStyle = C.gray;
    ctx.fillText('(ONE CALENDAR DAY — 24 HOURS)', 20, 44);

    // Right side info
    ctx.textAlign = 'right';
    ctx.fillStyle = C.black;
    ctx.font = `10px ${FONT}`;
    ctx.fillText('Original — File at home terminal', W - 20, 20);
    ctx.fillText('Duplicate — Driver retains in his/her possession for 8 days', W - 20, 34);

    // Date line
    const today = new Date();
    today.setDate(today.getDate() + log.date_offset_days);
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const year = today.getFullYear();

    ctx.textAlign = 'left';
    ctx.fillStyle = C.black;
    ctx.font = `13px ${FONT}`;
    ctx.fillText(`${month}`, 20, 68);
    ctx.fillText(`${day}`, 80, 68);
    ctx.fillText(`${year}`, 140, 68);

    // Labels under date
    ctx.font = `9px ${FONT}`;
    ctx.fillStyle = C.gray;
    ctx.fillText('(Month)', 20, 78);
    ctx.fillText('(Day)', 80, 78);
    ctx.fillText('(Year)', 140, 78);

    // Horizontal rule
    ctx.strokeStyle = C.lightGray;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 85);
    ctx.lineTo(W - 20, 85);
    ctx.stroke();

    // From / To
    ctx.fillStyle = C.black;
    ctx.font = `bold 11px ${FONT}`;
    ctx.fillText('From:', 20, 100);
    ctx.font = `11px ${FONT}`;
    ctx.fillText(log.from_location || 'Origin', 65, 100);

    ctx.font = `bold 11px ${FONT}`;
    ctx.fillText('To:', 280, 100);
    ctx.font = `11px ${FONT}`;
    ctx.fillText(log.to_location || 'Destination', 305, 100);

    // Carrier info box
    ctx.strokeStyle = C.lightGray;
    ctx.strokeRect(20, 108, 200, 28);
    ctx.font = `10px ${FONT}`;
    ctx.fillStyle = C.gray;
    ctx.fillText('Name of Carrier or Carriers', 25, 122);
    ctx.fillStyle = C.black;
    ctx.font = `11px ${FONT}`;
    ctx.fillText('Driver Transportation Co.', 25, 132);

    ctx.strokeRect(230, 108, 180, 28);
    ctx.font = `10px ${FONT}`;
    ctx.fillStyle = C.gray;
    ctx.fillText('Home Terminal Address', 235, 122);

    ctx.strokeRect(420, 108, 200, 28);
    ctx.font = `10px ${FONT}`;
    ctx.fillText('Main Office Address', 425, 122);

    // Total Miles driving today
    ctx.strokeRect(W - 180, 58, 160, 28);
    ctx.font = `10px ${FONT}`;
    ctx.fillStyle = C.gray;
    ctx.fillText('Total Miles Driving Today', W - 175, 72);
    ctx.fillStyle = C.black;
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(log.total_driving * 55).toString(), W - 25, 82); // approx miles
    ctx.textAlign = 'left';

    // ===== GRAPH GRID =====
    const GRID_TOP = 160;
    const GRID_LEFT = 80;
    const GRID_RIGHT = W - 120;
    const GRID_W = GRID_RIGHT - GRID_LEFT;
    const ROW_H = 36;
    const ROWS = 4;
    const GRID_BOT = GRID_TOP + ROWS * ROW_H;

    const rowLabels = ['1. Off Duty', '2. Sleeper\n   Berth', '3. Driving', '4. On Duty\n   (Not Driving)'];
    const rowColors = [C.offDuty, C.sleeper, C.driving, C.onDuty];

    // Hours 0-24 mapped to grid
    const hourToX = (h) => GRID_LEFT + (h / 24) * GRID_W;

    // Background
    ctx.fillStyle = C.gridBg;
    ctx.fillRect(GRID_LEFT, GRID_TOP, GRID_W, ROWS * ROW_H);

    // Vertical hour lines
    for (let h = 0; h <= 24; h++) {
      const x = hourToX(h);
      ctx.strokeStyle = h % 6 === 0 ? '#999' : C.lightGray;
      ctx.lineWidth = h % 6 === 0 ? 1.5 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, GRID_TOP - 20);
      ctx.lineTo(x, GRID_BOT + 30);
      ctx.stroke();

      // Hour labels (midnight=0, 1,2,...,noon,1,...,11,midnight)
      if (h < 24) {
        ctx.fillStyle = '#555';
        ctx.font = `9px ${FONT}`;
        ctx.textAlign = 'center';
        const label = h === 0 ? 'Mid\nnight' : h === 12 ? 'Noon' : h > 12 ? String(h - 12) : String(h);
        ctx.fillText(label, x + GRID_W / 48, GRID_TOP - 6);
      }
    }

    // Row borders and labels
    for (let r = 0; r < ROWS; r++) {
      const rowY = GRID_TOP + r * ROW_H;
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(GRID_LEFT, rowY);
      ctx.lineTo(GRID_RIGHT, rowY);
      ctx.stroke();

      // Row label
      ctx.fillStyle = C.black;
      ctx.font = `10px ${FONT}`;
      ctx.textAlign = 'right';
      const labelLines = rowLabels[r].split('\n');
      labelLines.forEach((line, li) => {
        ctx.fillText(line, GRID_LEFT - 6, rowY + 14 + li * 12);
      });
    }

    // Bottom border of grid
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(GRID_LEFT, GRID_BOT);
    ctx.lineTo(GRID_RIGHT, GRID_BOT);
    ctx.stroke();

    // Draw filled segments for each duty status
    const drawPeriods = (periods, rowIndex, color) => {
      if (!periods || periods.length === 0) return;
      periods.forEach(([start, end]) => {
        if (end <= start) return;
        const x1 = hourToX(Math.max(0, start));
        const x2 = hourToX(Math.min(24, end));
        const y = GRID_TOP + rowIndex * ROW_H + 4;
        const h = ROW_H - 8;

        // Fill
        ctx.fillStyle = color + '33'; // semi-transparent
        ctx.fillRect(x1, y, x2 - x1, h);

        // Solid border line (thick top/bottom)
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x1, y, x2 - x1, h);

        // Center line (the "pen stroke" on official logs)
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, GRID_TOP + rowIndex * ROW_H + ROW_H / 2);
        ctx.lineTo(x2, GRID_TOP + rowIndex * ROW_H + ROW_H / 2);
        ctx.stroke();
      });
    };

    drawPeriods(log.off_duty_periods, 0, rowColors[0]);
    drawPeriods(log.sleeper_periods, 1, rowColors[1]);
    drawPeriods(log.driving_periods, 2, rowColors[2]);
    drawPeriods(log.on_duty_periods, 3, rowColors[3]);

    // Vertical connectors between rows (pen lifts)
    const allChanges = [];
    const addChanges = (periods, row) => {
      (periods || []).forEach(([s, e]) => {
        allChanges.push({ time: s, row });
        allChanges.push({ time: e, row });
      });
    };
    addChanges(log.off_duty_periods, 0);
    addChanges(log.sleeper_periods, 1);
    addChanges(log.driving_periods, 2);
    addChanges(log.on_duty_periods, 3);

    // Midnight and end labels
    ctx.fillStyle = '#555';
    ctx.font = `9px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('Mid-', GRID_LEFT, GRID_TOP - 14);
    ctx.fillText('night', GRID_LEFT, GRID_TOP - 5);
    ctx.fillText('Mid-', GRID_RIGHT, GRID_TOP - 14);
    ctx.fillText('night', GRID_RIGHT, GRID_TOP - 5);

    // Total hours column
    ctx.font = `bold 10px ${FONT}`;
    ctx.fillStyle = C.blue;
    ctx.textAlign = 'left';
    ctx.fillText('Total', GRID_RIGHT + 5, GRID_TOP + 14);
    ctx.fillText('Hours', GRID_RIGHT + 5, GRID_TOP + 26);

    const totals = [log.total_off_duty, log.total_sleeper, log.total_driving, log.total_on_duty];
    totals.forEach((t, i) => {
      ctx.font = `bold 12px ${FONT}`;
      ctx.fillStyle = rowColors[i];
      ctx.fillText(decimalToHHMM(t), GRID_RIGHT + 5, GRID_TOP + i * ROW_H + ROW_H / 2 + 4);
    });

    // Sum check
    const total = (log.total_off_duty + log.total_sleeper + log.total_driving + log.total_on_duty);
    ctx.font = `11px ${FONT}`;
    ctx.fillStyle = Math.abs(total - 24) < 0.5 ? '#27ae60' : '#e74c3c';
    ctx.fillText(`= ${decimalToHHMM(total)}`, GRID_RIGHT + 5, GRID_BOT + 16);
    ctx.font = `9px ${FONT}`;
    ctx.fillStyle = C.gray;
    ctx.fillText('(must = 24)', GRID_RIGHT + 5, GRID_BOT + 28);

    // ===== REMARKS =====
    const REMARKS_TOP = GRID_BOT + 50;
    ctx.fillStyle = C.black;
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('Remarks:', 20, REMARKS_TOP);

    ctx.strokeStyle = C.lightGray;
    ctx.strokeRect(20, REMARKS_TOP + 8, W - 40, 120);

    ctx.font = `10px ${FONT}`;
    ctx.fillStyle = C.gray;
    ctx.fillText('Enter name of place you reported and where released from work, and when/where each duty status change occurred.', 26, REMARKS_TOP + 22);
    ctx.fillText('Use home terminal time zone.', 26, REMARKS_TOP + 34);

    // Remarks entries
    if (log.remarks && log.remarks.length > 0) {
      log.remarks.forEach((remark, i) => {
        if (i > 6) return; // limit visible remarks
        const y = REMARKS_TOP + 46 + i * 12;
        const h = remark.hour;
        const hh = Math.floor(h) % 24;
        const mm = Math.round((h % 1) * 60);
        const ampm = hh < 12 ? 'AM' : 'PM';
        const h12 = hh % 12 || 12;
        const timeStr = `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;

        ctx.fillStyle = C.black;
        ctx.font = `bold 10px ${FONT}`;
        ctx.fillText(`${timeStr}`, 26, y);
        ctx.font = `10px ${FONT}`;
        ctx.fillStyle = C.blue;
        ctx.fillText(`${remark.location} — ${remark.note}`, 90, y);
      });
    }

    // ===== SHIPPING DOCS / RECAP =====
    const RECAP_TOP = REMARKS_TOP + 140;
    ctx.strokeStyle = C.lightGray;
    ctx.strokeRect(20, RECAP_TOP, 200, 50);
    ctx.font = `9px ${FONT}`;
    ctx.fillStyle = C.gray;
    ctx.fillText('Shipping Documents:', 26, RECAP_TOP + 14);
    ctx.fillText('DVL or Manifest No.:', 26, RECAP_TOP + 28);
    ctx.fillText('Shipper & Commodity:', 26, RECAP_TOP + 42);

    // Signature area
    ctx.strokeRect(230, RECAP_TOP, 250, 50);
    ctx.font = `9px ${FONT}`;
    ctx.fillText("Driver's Signature in Full", 235, RECAP_TOP + 14);
    ctx.strokeStyle = C.black;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(235, RECAP_TOP + 40);
    ctx.lineTo(470, RECAP_TOP + 40);
    ctx.stroke();

    // Recap table
    const RECAP2_TOP = RECAP_TOP + 60;
    ctx.font = `bold 10px ${FONT}`;
    ctx.fillStyle = C.blue;
    ctx.fillText('Recap: Complete at end of day', 20, RECAP2_TOP);

    // 70-hr/8-day table
    ctx.strokeStyle = C.lightGray;
    ctx.lineWidth = 1;
    ctx.strokeRect(20, RECAP2_TOP + 8, 300, 70);

    ctx.font = `bold 10px ${FONT}`;
    ctx.fillStyle = C.black;
    ctx.fillText('70 Hour / 8 Day', 26, RECAP2_TOP + 22);

    ctx.font = `9px ${FONT}`;
    ctx.fillStyle = C.gray;
    const recapRows = [
      `On duty hours today, Total lines 3 & 4: ${decimalToHHMM(log.total_driving + log.total_on_duty)}`,
      `A. Total hours on duty last 7 days: (see prior logs)`,
      `B. Total hours available tomorrow (70 - A): — hrs`,
      `C. Total hours including today (A + today): — hrs`,
    ];
    recapRows.forEach((row, i) => {
      ctx.fillText(row, 26, RECAP2_TOP + 36 + i * 11);
    });

    // Footer
    ctx.fillStyle = C.gray;
    ctx.font = `9px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('FMCSA Form — Property Carrier HOS Log — 49 CFR Part 395', W / 2, H - 14);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `ELD_Log_Day_${log.day_number}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="eld-sheet">
      <div className="eld-header">
        <h3 className="eld-title">ELD DAILY LOG — DAY {log.day_number}</h3>
        <div className="eld-header-right">
          <div className="eld-stats">
            <div className="eld-stat">
              <span className="eld-stat-val off-duty">{decimalToHHMM(log.total_off_duty)}</span>
              <span className="eld-stat-label">Off Duty</span>
            </div>
            <div className="eld-stat">
              <span className="eld-stat-val sleeper">{decimalToHHMM(log.total_sleeper)}</span>
              <span className="eld-stat-label">Sleeper</span>
            </div>
            <div className="eld-stat">
              <span className="eld-stat-val driving">{decimalToHHMM(log.total_driving)}</span>
              <span className="eld-stat-label">Driving</span>
            </div>
            <div className="eld-stat">
              <span className="eld-stat-val on-duty">{decimalToHHMM(log.total_on_duty)}</span>
              <span className="eld-stat-label">On Duty</span>
            </div>
          </div>
          <button className="download-btn" onClick={handleDownload}>⬇ Download PNG</button>
        </div>
      </div>

      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={920}
          height={560}
          className="eld-canvas"
        />
      </div>

      {/* Mobile fallback table */}
      <div className="eld-mobile-table">
        <h4>Daily Status Summary</h4>
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Periods</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="status-dot off-duty-dot" />Off Duty</td>
              <td>{(log.off_duty_periods || []).map(([s, e]) => `${s.toFixed(1)}-${e.toFixed(1)}`).join(', ')}</td>
              <td>{decimalToHHMM(log.total_off_duty)} hrs</td>
            </tr>
            <tr>
              <td><span className="status-dot sleeper-dot" />Sleeper Berth</td>
              <td>{(log.sleeper_periods || []).map(([s, e]) => `${s.toFixed(1)}-${e.toFixed(1)}`).join(', ')}</td>
              <td>{decimalToHHMM(log.total_sleeper)} hrs</td>
            </tr>
            <tr>
              <td><span className="status-dot driving-dot" />Driving</td>
              <td>{(log.driving_periods || []).map(([s, e]) => `${s.toFixed(1)}-${e.toFixed(1)}`).join(', ')}</td>
              <td>{decimalToHHMM(log.total_driving)} hrs</td>
            </tr>
            <tr>
              <td><span className="status-dot on-duty-dot" />On Duty (Not Driving)</td>
              <td>{(log.on_duty_periods || []).map(([s, e]) => `${s.toFixed(1)}-${e.toFixed(1)}`).join(', ')}</td>
              <td>{decimalToHHMM(log.total_on_duty)} hrs</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ELDLogSheet;
