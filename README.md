# ELD Trip Planner — Full Stack App

A FMCSA Hours of Service (HOS) compliant trip planning application for interstate truck drivers.

**Built with:** Django REST API + React frontend

## Features

- **Location autocomplete** via OpenStreetMap Nominatim (free, no API key)
- **Interactive dark-themed map** showing route, stops, fuel/rest locations (Leaflet + CartoDB)
- **Full HOS calculation engine** implementing 49 CFR Part 395:
  - 11-hour driving limit
  - 14-hour driving window
  - 10-hour off-duty requirement
  - 30-minute break after 8 cumulative driving hours
  - 70-hour/8-day cycle enforcement
  - Automatic fuel stops every 1,000 miles
  - 1-hour pickup and dropoff
- **Official ELD Daily Log Sheets** drawn on HTML Canvas (downloadable as PNG)
- **Multiple days support** for long trips spanning multiple shifts

---

## Quick Start (Local Development)

### Prerequisites
- Python 3.10+
- Node.js 18+
- pip

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Start development server
python manage.py runserver
```

Backend runs at `http://localhost:8000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local
# (Edit .env.local if needed — defaults to localhost:8000)

# Start development server
npm start
```

Frontend runs at `http://localhost:3000`

---

## Deployment

### Backend — Railway (Free Tier)

1. Push code to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select the `backend` directory
4. Set environment variables:
   ```
   SECRET_KEY=your-random-secret-key-here
   DEBUG=False
   ```
5. Railway auto-detects the Procfile and runs gunicorn
6. Copy your Railway URL (e.g. `https://your-app.railway.app`)

### Frontend — Vercel

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Set **Root Directory** to `frontend`
4. Add environment variable:
   ```
   REACT_APP_API_URL=https://your-app.railway.app/api
   ```
5. Deploy!

---

## API Reference

### `POST /api/plan-trip/`

Plan a HOS-compliant trip.

**Request body:**
```json
{
  "current_lat": 41.8781,
  "current_lon": -87.6298,
  "current_location": "Chicago, IL",
  "pickup_lat": 39.7684,
  "pickup_lon": -86.1581,
  "pickup_location": "Indianapolis, IN",
  "dropoff_lat": 39.9612,
  "dropoff_lon": -82.9988,
  "dropoff_location": "Columbus, OH",
  "cycle_hours_used": 20
}
```

**Response:**
```json
{
  "stops": [...],        // Ordered list of stops with timing
  "day_logs": [...],     // Per-day ELD log data
  "summary": {
    "total_miles": 300.5,
    "total_trip_hours": 8.2,
    "total_days": 1,
    "route_coords": [[lat, lon], ...]
  }
}
```

### `GET /api/geocode/?q=chicago+il`

Geocode a location name using Nominatim.

### `GET /api/health/`

Health check endpoint.

---

## HOS Rules Implemented

| Rule | Value | Source |
|------|-------|--------|
| Max driving per shift | 11 hours | 49 CFR §395.3(a)(3) |
| Max duty window | 14 hours | 49 CFR §395.3(a)(2) |
| Min off-duty rest | 10 hours | 49 CFR §395.3(a)(1) |
| Mandatory break after | 8 cumulative drive hours | 49 CFR §395.3(a)(3)(ii) |
| Break duration | 30 minutes | 49 CFR §395.3(a)(3)(ii) |
| Cycle limit | 70 hours / 8 days | 49 CFR §395.3(b) |
| Fuel interval | 1,000 miles | App assumption |
| Pickup/Dropoff | 1 hour each | App assumption |
| Average speed | 55 mph | App assumption |

---

## Architecture

```
eldtrip/
├── backend/
│   ├── eldtrip_backend/      # Django project
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── trip_planner/         # Main Django app
│   │   ├── hos_calculator.py # Core HOS logic engine
│   │   ├── views.py          # REST API endpoints
│   │   └── urls.py
│   ├── manage.py
│   ├── requirements.txt
│   └── Procfile
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── App.js            # Main app + routing
    │   ├── components/
    │   │   ├── Header.js
    │   │   ├── TripForm.js   # Input form with geocoding
    │   │   ├── TripResults.js # Results container with tabs
    │   │   ├── RouteMap.js   # Leaflet map
    │   │   ├── StopsList.js  # Stop timeline table
    │   │   └── ELDLogSheet.js # Canvas-drawn daily logs
    │   └── index.css
    ├── package.json
    └── .env.example
```

---

## Disclaimer

This application is intended as a planning aid only. Drivers must comply with all applicable federal and state HOS regulations. Always verify your actual hours with your carrier's ELD system. This tool does not constitute legal or compliance advice.

Reference: [FMCSA Interstate Truck Driver's Guide to Hours of Service (April 2022)](https://www.fmcsa.dot.gov/regulations/hours-of-service)
