"""
FastAPI Backend Application for Surge-Price Protected Ride Hailing.
Provides REST endpoints, WebSockets, background tasks, and static file serving.
"""
import os
import json
import uuid
import asyncio
from typing import Dict, List, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.database import (
    init_db, get_connection, log_audit, get_config, set_config
)
from backend.simulation_clock import clock
from backend.zones import (
    ZONES, find_zone_for_coordinates, estimate_road_distance_km,
    estimate_trip_duration_min, haversine_distance_km
)
from backend.pricing import calculate_ordinary_surge, calculate_fare_breakdown
from backend.protection_engine import ProtectionEngine
from backend.models import (
    QuoteRequest, RideBookingRequest, DriverRegisterRequest,
    DriverHeartbeatRequest, DriverOfferResponse, TripActionRequest,
    ConfigUpdateRequest, ClockAdvanceRequest, DriverApplicationRequest
)

app = FastAPI(title="Surge-Price Protection Ride-Hailing API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active WebSocket connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        dead_conns = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead_conns.append(connection)
        for d in dead_conns:
            self.disconnect(d)

manager = ConnectionManager()
last_minute_cycle_ts = 0.0

@app.on_event("startup")
async def startup_event():
    init_db()
    # Seed initial test drivers if table is empty
    seed_initial_drivers_if_needed()
    # Start background heartbeat & matching loop
    asyncio.create_task(background_orchestrator_loop())

def seed_initial_drivers_if_needed():
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM drivers")
    count = c.fetchone()[0]
    conn.close()
    if count == 0:
        seed_sample_drivers(count_per_zone=5)

def seed_sample_drivers(count_per_zone: int = 5):
    """Seed sample drivers across zones with realistic Mumbai positions."""
    conn = get_connection()
    c = conn.cursor()
    now = clock.now_ts()
    
    driver_specs = [
        {"name": "Aarav Sharma", "phone": "+91 98201 11001", "vehicle": "car", "zone": "bkc", "lat": 19.0660, "lng": 72.8680},
        {"name": "Rohan Patel", "phone": "+91 98201 11002", "vehicle": "car", "zone": "bkc", "lat": 19.0645, "lng": 72.8710},
        {"name": "Vikram Singh", "phone": "+91 98201 11003", "vehicle": "rickshaw", "zone": "bkc", "lat": 19.0675, "lng": 72.8650},
        {"name": "Rajesh Gupta", "phone": "+91 98201 11004", "vehicle": "suv", "zone": "bkc", "lat": 19.0620, "lng": 72.8730},
        {"name": "Suresh Yadav", "phone": "+91 98201 11005", "vehicle": "car", "zone": "bkc", "lat": 19.0690, "lng": 72.8670},
        {"name": "Sunil Nair", "phone": "+91 98201 11006", "vehicle": "rickshaw", "zone": "bandra_west", "lat": 19.0590, "lng": 72.8310},
        {"name": "Amit Deshmukh", "phone": "+91 98201 11007", "vehicle": "car", "zone": "bandra_west", "lat": 19.0610, "lng": 72.8280},
        {"name": "Pooja Mehta", "phone": "+91 98201 11008", "vehicle": "car", "zone": "bandra_west", "lat": 19.0550, "lng": 72.8340},
        {"name": "Ganesh Kadam", "phone": "+91 98201 11009", "vehicle": "rickshaw", "zone": "khar", "lat": 19.0710, "lng": 72.8350},
        {"name": "Karan Malhotra", "phone": "+91 98201 11010", "vehicle": "car", "zone": "santacruz", "lat": 19.0830, "lng": 72.8590},
        {"name": "Mohammed Ansari", "phone": "+91 98201 11011", "vehicle": "rickshaw", "zone": "kurla", "lat": 19.0690, "lng": 72.8820},
    ]

    for d in driver_specs:
        did = f"driver_{d['phone'][-4:]}"
        c.execute("""
        INSERT OR REPLACE INTO drivers (id, name, phone, vehicle_type, status, lat, lng, zone_id, last_heartbeat, is_test_driver)
        VALUES (?, ?, ?, ?, 'online', ?, ?, ?, ?, 1)
        """, (did, d["name"], d["phone"], d["vehicle"], d["lat"], d["lng"], d["zone"], now))

    conn.commit()
    conn.close()

# ----------------- Core Evaluation & Matching -----------------

def run_minute_evaluation_cycle():
    """
    Every minute, per zone:
    1. Count requests & available drivers.
    2. Compute ordinary surge multiplier (smoothed and capped at 3.0x).
    3. Evaluate trigger or reassess active protection window.
    4. Save snapshot in zone_history.
    """
    global last_minute_cycle_ts
    now = clock.now_ts()
    last_minute_cycle_ts = now
    conn = get_connection()
    c = conn.cursor()

    for zone_id in ZONES.keys():
        # Available drivers
        c.execute("SELECT COUNT(*) FROM drivers WHERE zone_id = ? AND status = 'online'", (zone_id,))
        avail_drivers = c.fetchone()[0]

        # Recent requests in zone (last 5 min)
        c.execute("SELECT COUNT(*) FROM ride_requests WHERE pickup_zone_id = ? AND created_at >= ?", (zone_id, now - 300))
        recent_requests = c.fetchone()[0]

        # Previous multiplier
        c.execute("SELECT ordinary_multiplier FROM zone_history WHERE zone_id = ? ORDER BY minute_ts DESC LIMIT 1", (zone_id,))
        prev_row = c.fetchone()
        prev_mult = prev_row[0] if prev_row else 1.0

        # Calculate new ordinary surge
        ord_mult = calculate_ordinary_surge(recent_requests, avail_drivers, prev_mult)

        # Check existing window
        active_window = ProtectionEngine.get_active_window(zone_id)
        if active_window:
            result = ProtectionEngine.reassess_active_window(zone_id, ord_mult)
            state = result.get("state", active_window["state"])
            effective_mult = active_window["reference_multiplier"] if state in ["Protected", "Blocked", "Uncertain"] else ord_mult
        else:
            triggered = ProtectionEngine.evaluate_zone_trigger(zone_id, ord_mult, avail_drivers)
            if triggered:
                state = "Protected"
                active_now = ProtectionEngine.get_active_window(zone_id)
                effective_mult = active_now["reference_multiplier"] if active_now else ord_mult
            else:
                state = "Normal"
                effective_mult = ord_mult

        # Store in zone_history
        c.execute("""
        INSERT INTO zone_history (zone_id, minute_ts, available_drivers, requests_count, ordinary_multiplier, protected_multiplier, state)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (zone_id, now, avail_drivers, recent_requests, ord_mult, effective_mult, state))

    conn.commit()
    conn.close()

def match_pending_requests():
    """
    Pick nearest online, idle driver within radius for pending ride requests.
    Offers ride with a 15-second timer.
    """
    now = clock.now_ts()
    conn = get_connection()
    c = conn.cursor()

    # Find pending requests or expired offers
    c.execute("SELECT * FROM ride_requests WHERE status IN ('pending', 'offered')")
    requests = [dict(r) for r in c.fetchall()]

    for req in requests:
        # Check offer expiry
        if req["status"] == "offered":
            if req.get("offer_expires_at") and now > req["offer_expires_at"]:
                # Declined / Timed out
                declined = json.loads(req.get("declined_drivers") or "[]")
                if req.get("offered_driver_id") and req["offered_driver_id"] not in declined:
                    declined.append(req["offered_driver_id"])
                
                c.execute("""
                UPDATE ride_requests 
                SET status = 'pending', offered_driver_id = NULL, offer_expires_at = NULL, 
                    declined_drivers = ?, updated_at = ?
                WHERE id = ?
                """, (json.dumps(declined), now, req["id"]))
                req["status"] = "pending"
                req["declined_drivers"] = json.dumps(declined)
                req["offered_driver_id"] = None

        # Offer to nearest driver
        if req["status"] == "pending":
            declined = json.loads(req.get("declined_drivers") or "[]")
            c.execute("SELECT * FROM drivers WHERE status = 'online'")
            available_drivers = [dict(d) for d in c.fetchall() if d["id"] not in declined]

            if available_drivers:
                # Find nearest
                def dist_to_pickup(drv):
                    return haversine_distance_km(drv["lat"], drv["lng"], req["pickup_lat"], req["pickup_lng"])

                nearest_driver = min(available_drivers, key=dist_to_pickup)
                offer_expires = now + 15.0  # 15 second timer per spec

                c.execute("""
                UPDATE ride_requests 
                SET status = 'offered', offered_driver_id = ?, offer_expires_at = ?, updated_at = ?
                WHERE id = ?
                """, (nearest_driver["id"], offer_expires, now, req["id"]))

    conn.commit()
    conn.close()

async def background_orchestrator_loop():
    """Async scheduler running background tasks and WebSocket broadcasts."""
    global last_minute_cycle_ts
    while True:
        try:
            now = clock.now_ts()
            # Run matching every loop
            match_pending_requests()

            # Run minute evaluation if >= 60 seconds elapsed
            if now - last_minute_cycle_ts >= 60.0:
                run_minute_evaluation_cycle()

            # Broadcast live state to UI
            await broadcast_live_state()
        except Exception as e:
            # Silent catch to prevent background task failure
            pass
        await asyncio.sleep(2)

async def broadcast_live_state():
    """Broadcast current live state snapshot to all connected WebSocket clients."""
    if not manager.active_connections:
        return
    state_payload = get_full_system_overview()
    await manager.broadcast({"type": "SYSTEM_UPDATE", "data": state_payload})

def get_full_system_overview() -> dict:
    conn = get_connection()
    c = conn.cursor()

    # Zone states & stats
    zones_data = {}
    total_held_back_subsidy = 0.0

    # Total subsidy held back across all quotes
    c.execute("SELECT SUM(subsidy_amount) FROM fare_quotes WHERE is_protected = 1")
    sum_row = c.fetchone()
    total_held_back_subsidy = round(sum_row[0] or 0.0, 2)

    for zid, zcfg in ZONES.items():
        # Available drivers
        c.execute("SELECT COUNT(*) FROM drivers WHERE zone_id = ? AND status = 'online'", (zid,))
        current_drivers = c.fetchone()[0]

        # 5-minute peak drivers
        c.execute("""
        SELECT MAX(available_drivers) FROM zone_history 
        WHERE zone_id = ? AND minute_ts >= ?
        """, (zid, clock.now_ts() - 300))
        peak_row = c.fetchone()
        peak_5m = max(current_drivers, peak_row[0] or current_drivers)

        # Multipliers
        c.execute("SELECT ordinary_multiplier, protected_multiplier, state FROM zone_history WHERE zone_id = ? ORDER BY minute_ts DESC LIMIT 1", (zid,))
        last_hist = c.fetchone()
        ord_mult = last_hist[0] if last_hist else 1.0
        prot_mult = last_hist[1] if last_hist else 1.0
        state = last_hist[2] if last_hist else "Normal"

        active_window = ProtectionEngine.get_active_window(zid)
        signals = None
        if active_window:
            state = active_window["state"]
            ref_mult = active_window["reference_multiplier"]
            prot_mult = min(ref_mult, ord_mult)
            signals = ProtectionEngine.verify_signals(zid, active_window)
        else:
            ref_mult = 1.0

        zones_data[zid] = {
            "id": zid,
            "name": zcfg["name"],
            "center": zcfg["center"],
            "bounds": zcfg["bounds"],
            "color": zcfg["color"],
            "current_drivers": current_drivers,
            "peak_drivers_5m": peak_5m,
            "drop_pct": round((peak_5m - current_drivers) / max(1, peak_5m), 2),
            "ordinary_multiplier": ord_mult,
            "protected_multiplier": prot_mult,
            "reference_multiplier": ref_mult,
            "state": state,
            "has_active_window": bool(active_window),
            "active_window": active_window,
            "signals": signals,
        }

    # All active drivers
    c.execute("SELECT * FROM drivers")
    drivers = [dict(r) for r in c.fetchall()]

    # Active requests
    c.execute("SELECT * FROM ride_requests WHERE status != 'completed' AND status != 'cancelled' ORDER BY created_at DESC")
    active_requests = [dict(r) for r in c.fetchall()]

    conn.close()

    demo_mode = get_config("demo_mode", "true").lower() == "true"
    traffic = get_config("traffic_condition", "normal")

    return {
        "clock": clock.get_status(),
        "zones": zones_data,
        "drivers": drivers,
        "active_requests": active_requests,
        "total_subsidy_held_back": total_held_back_subsidy,
        "config": {
            "demo_mode": demo_mode,
            "traffic_condition": traffic,
            "min_peak_threshold": 4 if demo_mode else 10,
        }
    }

# ----------------- REST Endpoints -----------------

@app.get("/api/overview")
def api_get_overview():
    return get_full_system_overview()

@app.get("/api/zones")
def api_get_zones():
    return {"zones": ZONES}

@app.get("/api/config")
def api_get_config():
    return {
        "demo_mode": get_config("demo_mode", "true").lower() == "true",
        "traffic_condition": get_config("traffic_condition", "normal"),
        "demo_min_peak_drivers": int(get_config("demo_min_peak_drivers", "4")),
        "prod_min_peak_drivers": int(get_config("prod_min_peak_drivers", "10")),
    }

@app.post("/api/config/update")
def api_update_config(req: ConfigUpdateRequest):
    if req.demo_mode is not None:
        set_config("demo_mode", "true" if req.demo_mode else "false")
    if req.traffic_condition is not None:
        set_config("traffic_condition", req.traffic_condition)
    if req.demo_min_peak_drivers is not None:
        set_config("demo_min_peak_drivers", str(req.demo_min_peak_drivers))
    if req.prod_min_peak_drivers is not None:
        set_config("prod_min_peak_drivers", str(req.prod_min_peak_drivers))
    return {"status": "ok", "config": api_get_config()}

@app.post("/api/clock/advance")
def api_advance_clock(req: ClockAdvanceRequest):
    if req.seconds is not None:
        clock.advance_seconds(req.seconds)
    elif req.minutes is not None:
        clock.advance_minutes(req.minutes)
    # Run an immediate evaluation cycle to reflect the new time
    run_minute_evaluation_cycle()
    match_pending_requests()
    return {"status": "advanced", "clock": clock.get_status()}

@app.post("/api/clock/reset")
def api_reset_clock():
    clock.reset_to_realtime()
    run_minute_evaluation_cycle()
    return {"status": "reset", "clock": clock.get_status()}

# ----------------- Rider Endpoints -----------------

@app.post("/api/rider/quote")
def api_rider_quote(req: QuoteRequest):
    """
    Rider flow step 3:
    Calculate distance, estimated duration, ordinary surge multiplier,
    and applied multiplier (bounded by pre-shortage reference if protected).
    Generates a binding fare quote with subsidy tracking.
    """
    zone_id = find_zone_for_coordinates(req.pickup_lat, req.pickup_lng)
    dist_km = estimate_road_distance_km(req.pickup_lat, req.pickup_lng, req.dropoff_lat, req.dropoff_lng)
    dur_min = estimate_trip_duration_min(dist_km)

    # Get ordinary surge
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT ordinary_multiplier FROM zone_history WHERE zone_id = ? ORDER BY minute_ts DESC LIMIT 1", (zone_id,))
    row = c.fetchone()
    ordinary_multiplier = row[0] if row else 1.0

    # Surge protection window lookup
    applied_multiplier, is_protected, active_window = ProtectionEngine.get_effective_multiplier(zone_id, ordinary_multiplier)
    reference_multiplier = active_window["reference_multiplier"] if active_window else ordinary_multiplier

    # Fare breakdown
    fare_info = calculate_fare_breakdown(dist_km, dur_min, applied_multiplier)
    final_fare = fare_info["final_fare"]

    # Calculate what ordinary fare would have been without protection
    ordinary_fare_info = calculate_fare_breakdown(dist_km, dur_min, ordinary_multiplier)
    ordinary_fare = ordinary_fare_info["final_fare"]
    subsidy_amount = max(0.0, round(ordinary_fare - final_fare, 2))

    quote_id = f"quote_{uuid.uuid4().hex[:10]}"
    now = clock.now_ts()
    expires_at = now + (10 * 60)  # Quote valid for 10 minutes

    c.execute("""
    INSERT INTO fare_quotes (
        id, zone_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
        distance_km, duration_min, base_fare, ordinary_multiplier,
        applied_multiplier, reference_multiplier, is_protected, subsidy_amount,
        final_fare, breakdown_json, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        quote_id, zone_id, req.pickup_lat, req.pickup_lng, req.dropoff_lat, req.dropoff_lng,
        dist_km, dur_min, fare_info["base_fare"], ordinary_multiplier,
        applied_multiplier, reference_multiplier, 1 if is_protected else 0, subsidy_amount,
        final_fare, json.dumps(fare_info), now, expires_at
    ))
    conn.commit()
    conn.close()

    # Log audit if fare was overridden silently by protection window
    if is_protected:
        log_audit(
            zone_id=zone_id,
            event_type="FARE_OVERRIDE",
            state=active_window["state"] if active_window else "Protected",
            ordinary_multiplier=ordinary_multiplier,
            applied_multiplier=applied_multiplier,
            reason=f"Silent fare protection applied. Ordinary multiplier {ordinary_multiplier}x capped at reference {applied_multiplier}x. Rider saved ₹{subsidy_amount}.",
            metadata={"quote_id": quote_id, "subsidy_amount": subsidy_amount, "final_fare": final_fare}
        )

    return {
        "quote_id": quote_id,
        "zone_id": zone_id,
        "zone_name": ZONES.get(zone_id, {}).get("name", zone_id),
        "distance_km": dist_km,
        "duration_min": dur_min,
        "fare": final_fare,
        "surge_multiplier": applied_multiplier,
        "ordinary_multiplier": ordinary_multiplier,
        "is_protected": is_protected,
        "subsidy_amount": subsidy_amount,
        "breakdown": fare_info,
        "expires_at": expires_at,
    }

@app.post("/api/rider/book")
def api_rider_book(req: RideBookingRequest):
    """
    Rider flow step 4:
    Request the ride using the bound quote. Initiates driver matching.
    """
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM fare_quotes WHERE id = ?", (req.quote_id,))
    quote = c.fetchone()
    if not quote:
        conn.close()
        raise HTTPException(status_code=404, detail="Fare quote expired or not found")
    quote = dict(quote)

    request_id = f"ride_{uuid.uuid4().hex[:8]}"
    now = clock.now_ts()

    c.execute("""
    INSERT INTO ride_requests (
        id, rider_id, rider_name, rider_phone, quote_id,
        pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
        pickup_address, dropoff_address, pickup_zone_id,
        final_fare, surge_multiplier, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    """, (
        request_id, f"rider_{req.rider_phone[-4:]}", req.rider_name, req.rider_phone,
        req.quote_id, quote["pickup_lat"], quote["pickup_lng"], quote["dropoff_lat"], quote["dropoff_lng"],
        "Pickup Point", "Drop-off Destination", quote["zone_id"],
        quote["final_fare"], quote["applied_multiplier"], now, now
    ))
    conn.commit()
    conn.close()

    # Trigger immediate match attempt
    match_pending_requests()

    return {
        "request_id": request_id,
        "status": "pending",
        "fare": quote["final_fare"],
        "surge_multiplier": quote["applied_multiplier"],
        "pickup_zone_id": quote["zone_id"],
    }

@app.get("/api/rider/ride/{request_id}")
def api_rider_get_ride(request_id: str):
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM ride_requests WHERE id = ?", (request_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Ride not found")
    ride = dict(row)

    driver_info = None
    if ride.get("assigned_driver_id"):
        c.execute("SELECT id, name, phone, vehicle_type, lat, lng FROM drivers WHERE id = ?", (ride["assigned_driver_id"],))
        d_row = c.fetchone()
        if d_row:
            driver_info = dict(d_row)

    conn.close()
    return {"ride": ride, "driver": driver_info}

# ----------------- Driver Endpoints -----------------

@app.get("/api/driver/list")
def api_driver_list():
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM drivers ORDER BY is_test_driver ASC, id ASC")
    drivers = [dict(r) for r in c.fetchall()]
    conn.close()
    return {"drivers": drivers}

@app.post("/api/driver/register")
def api_driver_register(req: DriverRegisterRequest):
    did = f"driver_{uuid.uuid4().hex[:6]}"
    now = clock.now_ts()
    zone_cfg = ZONES.get(req.zone_id, ZONES["bkc"])
    lat = req.lat or zone_cfg["center"]["lat"]
    lng = req.lng or zone_cfg["center"]["lng"]

    conn = get_connection()
    c = conn.cursor()
    c.execute("""
    INSERT INTO drivers (id, name, phone, vehicle_type, status, lat, lng, zone_id, last_heartbeat, is_test_driver)
    VALUES (?, ?, ?, ?, 'online', ?, ?, ?, ?, ?)
    """, (did, req.name, req.phone, req.vehicle_type, lat, lng, req.zone_id, now, 1 if req.is_test_driver else 0))
    conn.commit()
    conn.close()
    return {"driver_id": did, "status": "online"}

@app.post("/api/driver/apply")
def api_driver_apply(req: DriverApplicationRequest):
    """
    Production-grade endpoint for BASE Driver recruitment applications.
    Validates Indian contact format, enforces consent, prevents duplicate submissions,
    and stores securely in SQLite database.
    """
    import re
    # Validate consent
    if not req.consent_given:
        raise HTTPException(status_code=400, detail="Explicit consent to terms and privacy notice is required")

    # Normalize phone: extract last 10 digits
    clean_phone = re.sub(r"[^\d]", "", req.phone)
    if len(clean_phone) >= 10:
        clean_phone = clean_phone[-10:]
    else:
        raise HTTPException(status_code=400, detail="Invalid phone number: 10-digit Indian mobile number required")

    if not re.match(r"^[6-9]\d{9}$", clean_phone):
        raise HTTPException(status_code=400, detail="Invalid Indian mobile number format")

    # Validate email
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", req.email):
        raise HTTPException(status_code=400, detail="Invalid email address format")

    # Normalize driving licence (e.g. MH02 2020 0012345)
    clean_licence = re.sub(r"[\s\-]", "", req.licence_number).upper()
    if len(clean_licence) < 8:
        raise HTTPException(status_code=400, detail="Invalid driving licence number format")

    # Normalize vehicle reg (e.g. MH02AB1234)
    clean_vehicle_reg = re.sub(r"[\s\-]", "", req.vehicle_reg_number).upper()

    conn = get_connection()
    c = conn.cursor()
    now = clock.now_ts()

    # Duplicate check: check if an application with same phone or licence submitted in last 24h
    c.execute("""
    SELECT application_ref, status, created_at FROM driver_applications
    WHERE (phone = ? OR licence_number = ?) AND created_at > ?
    ORDER BY created_at DESC LIMIT 1
    """, (clean_phone, clean_licence, now - 86400))
    existing = c.fetchone()
    if existing:
        conn.close()
        return {
            "status": "already_submitted",
            "application_ref": existing["application_ref"],
            "message": "An application with this phone or licence number was already received in the past 24 hours. Our Mumbai onboarding team will review it shortly.",
            "submitted_at": existing["created_at"],
            "duplicate_prevented": True
        }

    app_id = str(uuid.uuid4())
    app_ref = f"BASE-DRV-{uuid.uuid4().hex[:6].upper()}"

    c.execute("""
    INSERT INTO driver_applications (
        id, application_ref, full_name, phone, email, operating_zone,
        licence_number, licence_expiry, vehicle_category, ownership_status,
        vehicle_reg_number, status, consent_given, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', 1, ?, ?)
    """, (
        app_id, app_ref, req.full_name.strip(), clean_phone, req.email.strip().lower(),
        req.operating_zone, clean_licence, req.licence_expiry.strip(), req.vehicle_category,
        req.ownership_status, clean_vehicle_reg, now, now
    ))

    conn.commit()
    conn.close()

    # Log audit event for compliance
    log_audit(
        zone_id=req.operating_zone,
        event_type="DRIVER_APPLICATION_SUBMITTED",
        state="Normal",
        ordinary_multiplier=1.0,
        applied_multiplier=1.0,
        reason=f"New driver application {app_ref} received for {req.vehicle_category}",
        metadata={"application_ref": app_ref, "vehicle_category": req.vehicle_category}
    )

    return {
        "status": "success",
        "application_ref": app_ref,
        "message": "Application received. Thank you for applying to drive with BASE Mumbai. Our onboarding team will contact you within 24 hours.",
        "submitted_at": now
    }

@app.post("/api/driver/toggle_status")
def api_driver_toggle_status(driver_id: str, status: str):
    conn = get_connection()
    c = conn.cursor()
    now = clock.now_ts()
    c.execute("UPDATE drivers SET status = ?, last_heartbeat = ? WHERE id = ?", (status, now, driver_id))
    conn.commit()
    conn.close()
    return {"driver_id": driver_id, "status": status}

@app.post("/api/driver/heartbeat")
def api_driver_heartbeat(req: DriverHeartbeatRequest):
    """Driver flow step 1: 5-second location & heartbeat."""
    now = clock.now_ts()
    zone = req.zone_id or find_zone_for_coordinates(req.lat, req.lng)

    conn = get_connection()
    c = conn.cursor()
    if req.status:
        c.execute("""
        UPDATE drivers SET lat = ?, lng = ?, zone_id = ?, status = ?, last_heartbeat = ? WHERE id = ?
        """, (req.lat, req.lng, zone, req.status, now, req.driver_id))
    else:
        c.execute("""
        UPDATE drivers SET lat = ?, lng = ?, zone_id = ?, last_heartbeat = ? WHERE id = ?
        """, (req.lat, req.lng, zone, now, req.driver_id))
    conn.commit()
    conn.close()
    return {"status": "ok", "timestamp": now, "zone_id": zone}

@app.get("/api/driver/offer/{driver_id}")
def api_driver_get_offer(driver_id: str):
    """Driver flow step 2: Receive ride offer with 15-second timer."""
    now = clock.now_ts()
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
    SELECT * FROM ride_requests 
    WHERE offered_driver_id = ? AND status = 'offered' AND offer_expires_at > ?
    LIMIT 1
    """, (driver_id, now))
    row = c.fetchone()
    conn.close()

    if not row:
        return {"has_offer": False}

    req = dict(row)
    time_left = max(0.0, round(req["offer_expires_at"] - now, 1))
    return {
        "has_offer": True,
        "offer": {
            "request_id": req["id"],
            "rider_name": req["rider_name"],
            "fare": req["final_fare"],
            "surge_multiplier": req["surge_multiplier"],
            "pickup_lat": req["pickup_lat"],
            "pickup_lng": req["pickup_lng"],
            "dropoff_lat": req["dropoff_lat"],
            "dropoff_lng": req["dropoff_lng"],
            "time_remaining_sec": time_left,
        }
    }

@app.post("/api/driver/respond_offer")
def api_driver_respond_offer(resp: DriverOfferResponse):
    """Driver flow step 2: Accept or decline ride offer."""
    now = clock.now_ts()
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM ride_requests WHERE id = ?", (resp.request_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Request not found")
    req = dict(row)

    if resp.accepted:
        # Accept offer
        c.execute("""
        UPDATE ride_requests 
        SET status = 'accepted', assigned_driver_id = ?, offered_driver_id = NULL, offer_expires_at = NULL, updated_at = ?
        WHERE id = ?
        """, (resp.driver_id, now, resp.request_id))
        c.execute("UPDATE drivers SET status = 'busy', last_heartbeat = ? WHERE id = ?", (now, resp.driver_id))
        conn.commit()
        conn.close()
        return {"status": "accepted", "request_id": resp.request_id}
    else:
        # Decline offer
        declined = json.loads(req.get("declined_drivers") or "[]")
        if resp.driver_id not in declined:
            declined.append(resp.driver_id)
        c.execute("""
        UPDATE ride_requests 
        SET status = 'pending', offered_driver_id = NULL, offer_expires_at = NULL, 
            declined_drivers = ?, updated_at = ?
        WHERE id = ?
        """, (json.dumps(declined), now, resp.request_id))
        conn.commit()
        conn.close()
        # Immediately attempt next nearest match
        match_pending_requests()
        return {"status": "declined"}

@app.post("/api/driver/trip_action")
def api_driver_trip_action(action_req: TripActionRequest):
    """Driver flow step 3: Navigate to pickup, start trip, end trip."""
    now = clock.now_ts()
    conn = get_connection()
    c = conn.cursor()

    if action_req.action == "arrived":
        c.execute("UPDATE ride_requests SET status = 'arrived', updated_at = ? WHERE id = ?", (now, action_req.request_id))
    elif action_req.action == "start_trip":
        c.execute("UPDATE ride_requests SET status = 'in_trip', updated_at = ? WHERE id = ?", (now, action_req.request_id))
    elif action_req.action == "complete_trip":
        c.execute("UPDATE ride_requests SET status = 'completed', updated_at = ? WHERE id = ?", (now, action_req.request_id))
        c.execute("UPDATE drivers SET status = 'online', last_heartbeat = ? WHERE id = ?", (now, action_req.driver_id))

    conn.commit()
    conn.close()
    return {"status": "ok", "action": action_req.action}

# ----------------- Operator & Admin Endpoints -----------------

@app.get("/api/operator/audit_log")
def api_operator_audit_log(limit: int = 50):
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,))
    logs = [dict(r) for r in c.fetchall()]
    conn.close()
    return {"audit_log": logs}

@app.post("/api/operator/bulk_logout")
def api_operator_bulk_logout(zone_id: Optional[str] = None):
    """
    Test control: logs out a set of test drivers at once
    to easily reproduce the driver shortage collapse.
    """
    conn = get_connection()
    c = conn.cursor()
    now = clock.now_ts()

    if zone_id:
        c.execute("UPDATE drivers SET status = 'offline', last_heartbeat = ? WHERE zone_id = ? AND is_test_driver = 1", (now, zone_id))
        count = c.rowcount
    else:
        c.execute("UPDATE drivers SET status = 'offline', last_heartbeat = ? WHERE is_test_driver = 1", (now,))
        count = c.rowcount

    conn.commit()
    conn.close()

    log_audit(
        zone_id=zone_id or "all_zones",
        event_type="BULK_LOGOUT",
        state="Normal",
        ordinary_multiplier=1.0,
        applied_multiplier=1.0,
        reason=f"Operator Test Control: Bulk logged out {count} test drivers.",
        metadata={"logged_out_count": count, "target_zone": zone_id}
    )

    # Immediately run evaluation cycle to trigger surge calculation
    run_minute_evaluation_cycle()

    return {"status": "ok", "logged_out_count": count}

@app.post("/api/operator/seed_drivers")
def api_operator_seed_drivers(count: int = 5):
    """Seed test drivers to restore availability."""
    seed_sample_drivers(count_per_zone=count)
    run_minute_evaluation_cycle()
    return {"status": "seeded"}

@app.post("/api/operator/simulate_attack")
def api_operator_simulate_attack(zone_id: str = "bkc"):
    """
    One-click scenario runner:
    1. Ensures 5 drivers are online in target zone (establishing peak).
    2. Immediately toggles 4 of them OFFLINE (>50% collapse).
    3. Generates 3 ride requests in the zone to create a high demand/supply ratio.
    4. Runs minute evaluation -> Instantly triggers the Surge Protection Window!
    """
    conn = get_connection()
    c = conn.cursor()
    now = clock.now_ts()

    # Step 1: Ensure baseline drivers in zone
    c.execute("UPDATE drivers SET status = 'online', last_heartbeat = ? WHERE zone_id = ?", (now, zone_id))
    conn.commit()

    # Record peak in zone_history
    c.execute("SELECT COUNT(*) FROM drivers WHERE zone_id = ? AND status = 'online'", (zone_id,))
    baseline_count = c.fetchone()[0]
    if baseline_count < 4:
        seed_sample_drivers(5)
        baseline_count = 5

    c.execute("""
    INSERT INTO zone_history (zone_id, minute_ts, available_drivers, requests_count, ordinary_multiplier, protected_multiplier, state)
    VALUES (?, ?, ?, 1, 1.0, 1.0, 'Normal')
    """, (zone_id, now - 60, baseline_count))
    conn.commit()

    # Step 2: Coordinated drop (>50% drivers go offline, leaving 1 driver)
    c.execute("SELECT id FROM drivers WHERE zone_id = ? AND status = 'online'", (zone_id,))
    online_ids = [r[0] for r in c.fetchall()]
    drivers_to_drop = online_ids[:-1] if len(online_ids) > 1 else online_ids  # leave at most 1 driver
    for did in drivers_to_drop:
        c.execute("UPDATE drivers SET status = 'offline', last_heartbeat = ? WHERE id = ?", (now, did))

    # Step 3: Inject sudden ride requests (5 requests to create severe demand/supply ratio)
    zcfg = ZONES.get(zone_id, ZONES["bkc"])
    for i in range(5):
        dummy_req_id = f"sim_req_{uuid.uuid4().hex[:6]}"
        c.execute("""
        INSERT INTO ride_requests (
            id, rider_id, rider_name, rider_phone, quote_id,
            pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
            pickup_address, dropoff_address, pickup_zone_id,
            final_fare, surge_multiplier, status, created_at, updated_at
        ) VALUES (?, 'sim_rider', 'Simulated Rider', '+91 99999 00000', 'sim_quote',
            ?, ?, ?, ?, 'BKC Complex', 'Bandra Terminus', ?,
            150.0, 2.0, 'pending', ?, ?)
        """, (
            dummy_req_id,
            zcfg["center"]["lat"] + (i * 0.002), zcfg["center"]["lng"] + (i * 0.002),
            zcfg["center"]["lat"] + 0.015, zcfg["center"]["lng"] + 0.015,
            zone_id, now, now
        ))

    conn.commit()
    conn.close()

    # Step 4: Run evaluation cycle!
    run_minute_evaluation_cycle()

    return {
        "status": "attack_simulated",
        "zone_id": zone_id,
        "dropped_drivers": len(drivers_to_drop),
        "requests_created": 3
    }

# ----------------- WebSockets -----------------

@app.websocket("/ws/live")
async def websocket_live_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial snapshot
        initial_data = get_full_system_overview()
        await websocket.send_json({"type": "INITIAL_STATE", "data": initial_data})
        while True:
            # Keep socket alive
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

@app.post("/api/feedback")
def api_submit_feedback(payload: Dict[str, Any]):
    name = str(payload.get("name") or "").strip()
    email = str(payload.get("email") or "").strip()
    feedback_type = str(payload.get("type") or payload.get("feedback_type") or "suggestion").strip()
    message = str(payload.get("message") or "").strip()
    if not email or not message:
        raise HTTPException(status_code=400, detail="Email and message are required")
    
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
    INSERT INTO feedback (id, name, email, feedback_type, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (str(uuid.uuid4()), name, email, feedback_type, message, clock.now_ts()))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Feedback received"}

# Serve Static Files
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def serve_index():
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "Surge Protection Ride App API running"}
