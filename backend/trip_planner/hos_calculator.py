"""
FMCSA Hours of Service (HOS) Calculation Engine
Property-carrying vehicles, 70hr/8day rule
"""
import math
from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime, timedelta


# HOS Constants
MAX_DRIVING_HOURS = 11.0          # Max driving per shift
MAX_WINDOW_HOURS = 14.0           # 14-hour driving window
MIN_OFF_DUTY_HOURS = 10.0         # Required off-duty before next shift
BREAK_REQUIRED_AFTER = 8.0        # 30-min break required after 8 cumulative drive hours
BREAK_DURATION = 0.5              # 30 minutes
MAX_CYCLE_HOURS = 70.0            # 70-hour/8-day cycle
FUEL_STOP_INTERVAL_MILES = 1000.0 # Fuel every 1000 miles
PICKUP_DROPOFF_HOURS = 1.0        # 1 hour for pickup and dropoff
AVERAGE_SPEED_MPH = 55.0          # Average truck speed


@dataclass
class Stop:
    name: str
    stop_type: str          # 'start', 'pickup', 'fuel', 'rest', 'dropoff', 'break'
    location: str
    lat: float
    lon: float
    arrival_time: float     # hours from trip start
    departure_time: float   # hours from trip start
    duration_hours: float
    miles_from_prev: float = 0.0
    cumulative_miles: float = 0.0
    notes: str = ""


@dataclass
class DayLog:
    day_number: int
    date_offset_days: int
    off_duty_periods: List[tuple] = field(default_factory=list)    # (start_hr, end_hr)
    sleeper_periods: List[tuple] = field(default_factory=list)     # (start_hr, end_hr)
    driving_periods: List[tuple] = field(default_factory=list)     # (start_hr, end_hr)
    on_duty_periods: List[tuple] = field(default_factory=list)     # (start_hr, end_hr)
    remarks: List[dict] = field(default_factory=list)              # {time, location, note}
    total_off_duty: float = 0.0
    total_sleeper: float = 0.0
    total_driving: float = 0.0
    total_on_duty: float = 0.0
    from_location: str = ""
    to_location: str = ""


@dataclass
class TripPlan:
    stops: List[Stop] = field(default_factory=list)
    day_logs: List[DayLog] = field(default_factory=list)
    total_miles: float = 0.0
    total_trip_hours: float = 0.0
    total_driving_hours: float = 0.0
    total_days: int = 0
    route_coords: List[List[float]] = field(default_factory=list)


def haversine_miles(lat1, lon1, lat2, lon2):
    """Calculate distance between two lat/lon points in miles."""
    R = 3958.8  # Earth radius in miles
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def interpolate_location(start_lat, start_lon, end_lat, end_lon, fraction):
    """Linearly interpolate between two coordinates."""
    lat = start_lat + (end_lat - start_lat) * fraction
    lon = start_lon + (end_lon - start_lon) * fraction
    return lat, lon


def calculate_trip(
    current_lat: float, current_lon: float, current_location_name: str,
    pickup_lat: float, pickup_lon: float, pickup_location_name: str,
    dropoff_lat: float, dropoff_lon: float, dropoff_location_name: str,
    cycle_hours_used: float
) -> dict:
    """
    Main trip calculation function implementing full HOS logic.
    Returns a dict with stops, day logs, and summary.
    """
    # Segment distances
    dist_to_pickup = haversine_miles(current_lat, current_lon, pickup_lat, pickup_lon)
    dist_pickup_to_dropoff = haversine_miles(pickup_lat, pickup_lon, dropoff_lat, dropoff_lon)
    total_miles = dist_to_pickup + dist_pickup_to_dropoff

    stops = []
    events = []  # (trip_hour, event_type, location_name, lat, lon, duration, miles_from_prev, notes)

    # --- Build timeline of events ---
    clock = 0.0        # hours since trip start
    cumulative_miles = 0.0
    drive_since_break = 0.0
    window_start = 0.0
    shift_drive_hours = 0.0
    cycle_hours = cycle_hours_used
    next_fuel_at_miles = FUEL_STOP_INTERVAL_MILES  # first fuel stop

    # Start
    events.append({
        'time': 0.0, 'type': 'start', 'location': current_location_name,
        'lat': current_lat, 'lon': current_lon, 'duration': 0.0,
        'miles_from_prev': 0.0, 'cumulative_miles': 0.0,
        'notes': 'Begin trip'
    })

    def drive_segment(from_lat, from_lon, to_lat, to_lon, seg_dist, seg_name_from, seg_name_to,
                      nonlocal_clock, nonlocal_miles, nonlocal_drive_since_break,
                      nonlocal_window_start, nonlocal_shift_drive, nonlocal_cycle,
                      nonlocal_next_fuel):
        """Drive a segment with full HOS compliance, inserting breaks/rests as needed."""
        # These are passed in and returned (Python workaround for closures)
        clk = nonlocal_clock
        miles = nonlocal_miles
        dsb = nonlocal_drive_since_break
        ws = nonlocal_window_start
        sdr = nonlocal_shift_drive
        cyc = nonlocal_cycle
        nf = nonlocal_next_fuel

        remaining_dist = seg_dist
        cur_lat, cur_lon = from_lat, from_lon
        cur_loc = seg_name_from

        seg_events = []

        MAX_ITERATIONS = 500  # safety cap — a real trip never needs more than this
        iterations = 0

        while remaining_dist > 0.1:
            iterations += 1
            if iterations > MAX_ITERATIONS:
                # Should never happen, but prevents infinite loop / MemoryError
                raise ValueError(
                    f"Trip calculation exceeded {MAX_ITERATIONS} iterations. "
                    f"Remaining distance: {remaining_dist:.1f} mi. "
                    f"This may indicate an extremely long trip or a logic error."
                )

            # How far can we drive right now?
            window_remaining = max(0.0, (ws + MAX_WINDOW_HOURS) - clk)
            drive_limit_remaining = max(0.0, MAX_DRIVING_HOURS - sdr)
            break_limit = max(0.0, BREAK_REQUIRED_AFTER - dsb)
            cycle_drive_remaining = max(0.0, MAX_CYCLE_HOURS - cyc)

            # Hours until next fuel
            miles_to_fuel = nf - miles

            # Maximum we can drive before any kind of mandatory stop
            max_drive_now = min(window_remaining, drive_limit_remaining, break_limit, cycle_drive_remaining)
            max_miles_now = max_drive_now * AVERAGE_SPEED_MPH

            # --- CYCLE EXHAUSTED: need a 34-hr restart to reset the cycle ---
            if cycle_drive_remaining <= 0.01:
                RESTART_HOURS = 34.0
                seg_events.append({
                    'time': clk, 'type': 'rest', 'location': cur_loc,
                    'lat': cur_lat, 'lon': cur_lon, 'duration': RESTART_HOURS,
                    'miles_from_prev': 0.0, 'cumulative_miles': miles,
                    'notes': '34-hr cycle restart (70-hr/8-day limit reached — full reset)'
                })
                clk += RESTART_HOURS
                dsb = 0.0
                sdr = 0.0
                ws = clk
                cyc = 0.0  # 34-hr restart resets the entire 70-hr cycle clock
                continue

            # --- WINDOW OR DRIVE LIMIT: need a 10-hr rest ---
            if max_drive_now <= 0.01:
                seg_events.append({
                    'time': clk, 'type': 'rest', 'location': cur_loc,
                    'lat': cur_lat, 'lon': cur_lon, 'duration': MIN_OFF_DUTY_HOURS,
                    'miles_from_prev': 0.0, 'cumulative_miles': miles,
                    'notes': '10-hr off-duty rest (shift reset)'
                })
                clk += MIN_OFF_DUTY_HOURS
                dsb = 0.0
                sdr = 0.0
                ws = clk
                continue

            # --- FUEL STOP comes before HOS limit and before destination ---
            if 0 < miles_to_fuel <= max_miles_now and miles_to_fuel <= remaining_dist:
                drive_hours = miles_to_fuel / AVERAGE_SPEED_MPH
                fraction = min(miles_to_fuel / remaining_dist, 1.0)
                new_lat, new_lon = interpolate_location(cur_lat, cur_lon, to_lat, to_lon, fraction)
                clk += drive_hours
                miles += miles_to_fuel
                dsb += drive_hours
                sdr += drive_hours
                cyc += drive_hours
                remaining_dist -= miles_to_fuel

                seg_events.append({
                    'time': clk, 'type': 'fuel', 'location': f'Fuel Stop near {seg_name_to}',
                    'lat': new_lat, 'lon': new_lon, 'duration': 0.5,
                    'miles_from_prev': miles_to_fuel, 'cumulative_miles': miles,
                    'notes': f'Fuel stop at {int(miles)} mi (on-duty not driving)'
                })
                clk += 0.5
                cyc += 0.5   # fueling counts as on-duty toward cycle
                nf = miles + FUEL_STOP_INTERVAL_MILES
                cur_lat, cur_lon = new_lat, new_lon
                cur_loc = 'Fuel Stop'

            # --- HOS LIMIT hit before destination ---
            elif max_miles_now < remaining_dist:
                drive_hours = max_drive_now
                actual_miles = drive_hours * AVERAGE_SPEED_MPH

                # Guard: if we can't move meaningfully, force a rest
                if actual_miles < 0.1:
                    seg_events.append({
                        'time': clk, 'type': 'rest', 'location': cur_loc,
                        'lat': cur_lat, 'lon': cur_lon, 'duration': MIN_OFF_DUTY_HOURS,
                        'miles_from_prev': 0.0, 'cumulative_miles': miles,
                        'notes': '10-hr off-duty rest (shift reset)'
                    })
                    clk += MIN_OFF_DUTY_HOURS
                    dsb = 0.0
                    sdr = 0.0
                    ws = clk
                    continue

                fraction = min(actual_miles / remaining_dist, 1.0)
                new_lat, new_lon = interpolate_location(cur_lat, cur_lon, to_lat, to_lon, fraction)
                clk += drive_hours
                miles += actual_miles
                dsb += drive_hours
                sdr += drive_hours
                cyc += drive_hours
                remaining_dist -= actual_miles
                cur_lat, cur_lon = new_lat, new_lon

                # Determine what kind of stop is needed
                need_break = (break_limit <= drive_limit_remaining and
                              break_limit <= window_remaining and
                              sdr < MAX_DRIVING_HOURS)
                if need_break:
                    seg_events.append({
                        'time': clk, 'type': 'break', 'location': cur_loc,
                        'lat': cur_lat, 'lon': cur_lon, 'duration': BREAK_DURATION,
                        'miles_from_prev': actual_miles, 'cumulative_miles': miles,
                        'notes': '30-min mandatory break (8-hr drive rule)'
                    })
                    clk += BREAK_DURATION
                    dsb = 0.0
                else:
                    seg_events.append({
                        'time': clk, 'type': 'rest', 'location': cur_loc,
                        'lat': cur_lat, 'lon': cur_lon, 'duration': MIN_OFF_DUTY_HOURS,
                        'miles_from_prev': actual_miles, 'cumulative_miles': miles,
                        'notes': '10-hr off-duty rest'
                    })
                    clk += MIN_OFF_DUTY_HOURS
                    dsb = 0.0
                    sdr = 0.0
                    ws = clk

            # --- Clear path to destination ---
            else:
                drive_hours = remaining_dist / AVERAGE_SPEED_MPH
                clk += drive_hours
                miles += remaining_dist
                dsb += drive_hours
                sdr += drive_hours
                cyc += drive_hours
                remaining_dist = 0.0

        return seg_events, clk, miles, dsb, ws, sdr, cyc, nf

    # Drive segment 1: current -> pickup
    seg1_events, clock, cumulative_miles, drive_since_break, window_start, shift_drive_hours, cycle_hours, next_fuel_at_miles = \
        drive_segment(
            current_lat, current_lon, pickup_lat, pickup_lon,
            dist_to_pickup, current_location_name, pickup_location_name,
            clock, cumulative_miles, drive_since_break, window_start,
            shift_drive_hours, cycle_hours, next_fuel_at_miles
        )
    events.extend(seg1_events)

    # Pickup stop (1 hour on-duty)
    events.append({
        'time': clock, 'type': 'pickup', 'location': pickup_location_name,
        'lat': pickup_lat, 'lon': pickup_lon, 'duration': PICKUP_DROPOFF_HOURS,
        'miles_from_prev': dist_to_pickup if not seg1_events else 0,
        'cumulative_miles': cumulative_miles,
        'notes': 'Loading / pickup (1 hr on-duty)'
    })
    clock += PICKUP_DROPOFF_HOURS
    cycle_hours += PICKUP_DROPOFF_HOURS
    # Check if window is exceeded after pickup on-duty
    if clock >= window_start + MAX_WINDOW_HOURS:
        events.append({
            'time': clock, 'type': 'rest', 'location': pickup_location_name,
            'lat': pickup_lat, 'lon': pickup_lon, 'duration': MIN_OFF_DUTY_HOURS,
            'miles_from_prev': 0.0, 'cumulative_miles': cumulative_miles,
            'notes': '10-hr rest after pickup (14-hr window reached)'
        })
        clock += MIN_OFF_DUTY_HOURS
        drive_since_break = 0.0
        shift_drive_hours = 0.0
        window_start = clock

    # Drive segment 2: pickup -> dropoff
    seg2_events, clock, cumulative_miles, drive_since_break, window_start, shift_drive_hours, cycle_hours, next_fuel_at_miles = \
        drive_segment(
            pickup_lat, pickup_lon, dropoff_lat, dropoff_lon,
            dist_pickup_to_dropoff, pickup_location_name, dropoff_location_name,
            clock, cumulative_miles, drive_since_break, window_start,
            shift_drive_hours, cycle_hours, next_fuel_at_miles
        )
    events.extend(seg2_events)

    # Dropoff stop
    events.append({
        'time': clock, 'type': 'dropoff', 'location': dropoff_location_name,
        'lat': dropoff_lat, 'lon': dropoff_lon, 'duration': PICKUP_DROPOFF_HOURS,
        'miles_from_prev': 0.0, 'cumulative_miles': cumulative_miles,
        'notes': 'Unloading / dropoff (1 hr on-duty)'
    })

    # Sort and fix miles_from_prev
    events_sorted = events
    for i in range(1, len(events_sorted)):
        if events_sorted[i]['miles_from_prev'] == 0 and events_sorted[i]['type'] not in ('rest', 'break'):
            prev_miles = events_sorted[i-1].get('cumulative_miles', 0)
            events_sorted[i]['miles_from_prev'] = events_sorted[i]['cumulative_miles'] - prev_miles

    # Convert events to Stop objects
    stop_list = []
    for i, ev in enumerate(events_sorted):
        stop_list.append(Stop(
            name=ev['location'],
            stop_type=ev['type'],
            location=ev['location'],
            lat=ev['lat'],
            lon=ev['lon'],
            arrival_time=ev['time'],
            departure_time=ev['time'] + ev['duration'],
            duration_hours=ev['duration'],
            miles_from_prev=ev.get('miles_from_prev', 0),
            cumulative_miles=ev.get('cumulative_miles', 0),
            notes=ev.get('notes', '')
        ))

    # --- Build Day Logs ---
    total_trip_hours = clock + PICKUP_DROPOFF_HOURS
    total_days = math.ceil(total_trip_hours / 24) + 1
    day_logs = build_day_logs(stop_list, total_days, current_location_name, dropoff_location_name)

    # Route waypoints for map
    route_coords = [
        [current_lat, current_lon],
        [pickup_lat, pickup_lon],
        [dropoff_lat, dropoff_lon]
    ]
    # Add intermediate stop coords
    for s in stop_list:
        if s.stop_type in ('fuel', 'rest', 'break'):
            route_coords.insert(-1, [s.lat, s.lon])

    total_driving = sum(
        (s.duration_hours for s in stop_list if s.stop_type == 'driving'), 0
    )

    return {
        'stops': [stop_to_dict(s) for s in stop_list],
        'day_logs': [log_to_dict(d) for d in day_logs],
        'summary': {
            'total_miles': round(total_miles, 1),
            'total_trip_hours': round(total_trip_hours, 2),
            'total_days': len(day_logs),
            'cycle_hours_remaining': round(MAX_CYCLE_HOURS - cycle_hours_used - cycle_hours + cycle_hours_used, 1),
            'route_coords': route_coords,
        }
    }


def build_day_logs(stops: List[Stop], total_days: int, origin: str, destination: str) -> List[DayLog]:
    """
    Convert stop timeline into per-day ELD log entries.

    Key insight: stops only represent events (pickup, rest, fuel, etc).
    The TIME BETWEEN stops is driving time — we must reconstruct those
    driving intervals explicitly by looking at gaps between consecutive stops.
    """
    if not stops:
        return []

    # --- Step 1: Build a flat timeline of ALL intervals with their status ---
    # Each interval: (absolute_start, absolute_end, status)
    # status: 'driving' | 'sleeper' | 'off_duty' | 'on_duty'
    timeline = []

    # Map stop types to their duty status while stopped
    STOP_STATUS = {
        'rest':    'sleeper',   # 10-hr rest = sleeper berth
        'break':   'off_duty',  # 30-min break = off duty
        'fuel':    'on_duty',   # fueling = ON DUTY not driving (49 CFR §395.2)
        'pickup':  'on_duty',   # loading = on duty not driving
        'dropoff': 'on_duty',   # unloading = on duty not driving
        'start':   None,        # zero-duration, skip
    }

    for i, stop in enumerate(stops):
        # Driving gap: from previous stop's departure to this stop's arrival
        if i > 0:
            prev_dep = stops[i - 1].departure_time
            this_arr = stop.arrival_time
            if this_arr - prev_dep > 0.001:
                timeline.append((prev_dep, this_arr, 'driving'))

        # The stop itself
        status = STOP_STATUS.get(stop.stop_type)
        if status and stop.duration_hours > 0.001:
            timeline.append((stop.arrival_time, stop.departure_time, status))

    # Sort by start time
    timeline.sort(key=lambda x: x[0])

    # Find total trip end time
    trip_end = stops[-1].departure_time if stops else 0
    num_days = max(math.ceil(trip_end / 24) + 1, 1)

    # --- Step 2: Build per-day logs ---
    logs = []
    for day in range(num_days):
        day_start = day * 24.0
        day_end = day_start + 24.0

        dlog = DayLog(
            day_number=day + 1,
            date_offset_days=day
        )

        day_locations = []

        # Slice each timeline interval into this day's window
        for (abs_start, abs_end, status) in timeline:
            if abs_end <= day_start or abs_start >= day_end:
                continue

            overlap_start = max(abs_start, day_start)
            overlap_end   = min(abs_end,   day_end)
            local_start = round(overlap_start - day_start, 4)
            local_end   = round(overlap_end   - day_start, 4)

            if local_end <= local_start:
                continue

            duration = local_end - local_start

            if status == 'driving':
                dlog.driving_periods.append((local_start, local_end))
                dlog.total_driving += duration
            elif status == 'sleeper':
                dlog.sleeper_periods.append((local_start, local_end))
                dlog.total_sleeper += duration
            elif status == 'on_duty':
                dlog.on_duty_periods.append((local_start, local_end))
                dlog.total_on_duty += duration
            elif status == 'off_duty':
                dlog.off_duty_periods.append((local_start, local_end))
                dlog.total_off_duty += duration

        # Build remarks from stops that occur on this day
        for stop in stops:
            arr = stop.arrival_time
            if arr >= day_start and arr < day_end and stop.stop_type != 'start':
                local_arr = round(arr - day_start, 2)
                remark_text = {
                    'pickup':  'Pickup — begin loading',
                    'dropoff': 'Dropoff — begin unloading',
                    'fuel':    'Fuel stop',
                    'rest':    'Begin 10-hr rest (sleeper berth)',
                    'break':   '30-min mandatory break (8-hr drive rule)',
                }.get(stop.stop_type, stop.stop_type)
                dlog.remarks.append({
                    'hour': local_arr,
                    'location': stop.location,
                    'note': remark_text
                })
                day_locations.append(stop.location)
            # Also capture driving start remark (when driving begins on this day)
            if stop.stop_type == 'start' and arr >= day_start and arr < day_end:
                dlog.remarks.insert(0, {
                    'hour': round(arr - day_start, 2),
                    'location': stop.location,
                    'note': 'Begin trip — start driving'
                })
                day_locations.insert(0, stop.location)

        # --- Step 3: Fill remaining unaccounted time as off-duty ---
        # Collect all accounted periods and sort
        accounted = sorted(
            dlog.driving_periods + dlog.sleeper_periods +
            dlog.on_duty_periods + dlog.off_duty_periods,
            key=lambda x: x[0]
        )

        gaps = []
        cursor = 0.0
        for (s, e) in accounted:
            if s > cursor + 0.001:
                gaps.append((round(cursor, 4), round(s, 4)))
            cursor = max(cursor, e)
        if cursor < 23.999:
            gaps.append((round(cursor, 4), 24.0))

        for (gs, ge) in gaps:
            dlog.off_duty_periods.append((gs, ge))
            dlog.total_off_duty += (ge - gs)

        # Round all totals
        dlog.total_off_duty  = round(dlog.total_off_duty,  2)
        dlog.total_sleeper   = round(dlog.total_sleeper,   2)
        dlog.total_driving   = round(dlog.total_driving,   2)
        dlog.total_on_duty   = round(dlog.total_on_duty,   2)

        # From / To for the day header
        dlog.from_location = day_locations[0]  if day_locations else origin
        dlog.to_location   = day_locations[-1] if day_locations else destination

        logs.append(dlog)

    # Drop trailing days where nothing actually happened (all off-duty, no driving/on-duty/sleeper)
    # This happens when the trip ends mid-day and the generator overshoots by one day
    while logs and (
        logs[-1].total_driving == 0 and
        logs[-1].total_on_duty == 0 and
        logs[-1].total_sleeper == 0
    ):
        logs.pop()

    return logs


def stop_to_dict(s: Stop) -> dict:
    return {
        'name': s.name,
        'type': s.stop_type,
        'location': s.location,
        'lat': s.lat,
        'lon': s.lon,
        'arrival_time': round(s.arrival_time, 2),
        'departure_time': round(s.departure_time, 2),
        'duration_hours': round(s.duration_hours, 2),
        'miles_from_prev': round(s.miles_from_prev, 1),
        'cumulative_miles': round(s.cumulative_miles, 1),
        'notes': s.notes,
        'arrival_time_str': hours_to_time_str(s.arrival_time),
        'departure_time_str': hours_to_time_str(s.departure_time),
    }


def log_to_dict(d: DayLog) -> dict:
    return {
        'day_number': d.day_number,
        'date_offset_days': d.date_offset_days,
        'off_duty_periods': d.off_duty_periods,
        'sleeper_periods': d.sleeper_periods,
        'driving_periods': d.driving_periods,
        'on_duty_periods': d.on_duty_periods,
        'remarks': d.remarks,
        'total_off_duty': d.total_off_duty,
        'total_sleeper': d.total_sleeper,
        'total_driving': d.total_driving,
        'total_on_duty': d.total_on_duty,
        'from_location': d.from_location,
        'to_location': d.to_location,
    }


def hours_to_time_str(hours: float) -> str:
    """Convert decimal hours to readable time string (Day X, HH:MM)."""
    day = int(hours // 24) + 1
    h = int(hours % 24)
    m = int((hours % 1) * 60)
    ampm = 'AM' if h < 12 else 'PM'
    h12 = h % 12 or 12
    return f"Day {day}, {h12}:{m:02d} {ampm}"
