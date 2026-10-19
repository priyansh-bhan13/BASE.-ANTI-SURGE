"""
SQLite Database connection and initialization for Surge-Price Protection.
"""
import sqlite3
import json
import os
from typing import Dict, Any, List, Optional
from backend.simulation_clock import clock

DB_PATH = os.path.join(os.path.dirname(__file__), "surge_ride.db")

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    c = conn.cursor()

    # Drivers table
    c.execute("""
    CREATE TABLE IF NOT EXISTS drivers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        vehicle_type TEXT DEFAULT 'car',
        status TEXT DEFAULT 'offline',
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        zone_id TEXT NOT NULL,
        last_heartbeat REAL NOT NULL,
        is_test_driver INTEGER DEFAULT 0
    )
    """)

    # Users (Riders) table
    c.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        role TEXT DEFAULT 'rider'
    )
    """)

    # Fare Quotes table
    c.execute("""
    CREATE TABLE IF NOT EXISTS fare_quotes (
        id TEXT PRIMARY KEY,
        zone_id TEXT NOT NULL,
        pickup_lat REAL NOT NULL,
        pickup_lng REAL NOT NULL,
        dropoff_lat REAL NOT NULL,
        dropoff_lng REAL NOT NULL,
        distance_km REAL NOT NULL,
        duration_min REAL NOT NULL,
        base_fare REAL NOT NULL,
        ordinary_multiplier REAL NOT NULL,
        applied_multiplier REAL NOT NULL,
        reference_multiplier REAL NOT NULL,
        is_protected INTEGER DEFAULT 0,
        subsidy_amount REAL DEFAULT 0.0,
        final_fare REAL NOT NULL,
        breakdown_json TEXT NOT NULL,
        created_at REAL NOT NULL,
        expires_at REAL NOT NULL
    )
    """)

    # Ride requests table
    c.execute("""
    CREATE TABLE IF NOT EXISTS ride_requests (
        id TEXT PRIMARY KEY,
        rider_id TEXT NOT NULL,
        rider_name TEXT NOT NULL,
        rider_phone TEXT NOT NULL,
        quote_id TEXT NOT NULL,
        pickup_lat REAL NOT NULL,
        pickup_lng REAL NOT NULL,
        dropoff_lat REAL NOT NULL,
        dropoff_lng REAL NOT NULL,
        pickup_address TEXT,
        dropoff_address TEXT,
        pickup_zone_id TEXT NOT NULL,
        final_fare REAL NOT NULL,
        surge_multiplier REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        offered_driver_id TEXT,
        assigned_driver_id TEXT,
        declined_drivers TEXT DEFAULT '[]',
        offer_expires_at REAL,
        created_at REAL NOT NULL,
        updated_at REAL NOT NULL
    )
    """)

    # Zone History (per-minute snapshot for trend analysis)
    c.execute("""
    CREATE TABLE IF NOT EXISTS zone_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        zone_id TEXT NOT NULL,
        minute_ts REAL NOT NULL,
        available_drivers INTEGER NOT NULL,
        requests_count INTEGER NOT NULL,
        ordinary_multiplier REAL NOT NULL,
        protected_multiplier REAL NOT NULL,
        state TEXT NOT NULL
    )
    """)

    # Protection Windows table
    c.execute("""
    CREATE TABLE IF NOT EXISTS protection_windows (
        id TEXT PRIMARY KEY,
        zone_id TEXT NOT NULL,
        state TEXT NOT NULL,
        reference_multiplier REAL NOT NULL,
        ordinary_multiplier_at_trigger REAL NOT NULL,
        peak_drivers_5m INTEGER NOT NULL,
        drop_pct REAL NOT NULL,
        opened_at REAL NOT NULL,
        closed_at REAL,
        last_assessment_at REAL NOT NULL,
        consecutive_genuine_checks INTEGER DEFAULT 0,
        verdict TEXT DEFAULT 'Uncertain',
        reason TEXT,
        release_cap_time REAL NOT NULL,
        cooldown_until REAL DEFAULT 0.0
    )
    """)

    # Audit Log table
    c.execute("""
    CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        zone_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        state TEXT NOT NULL,
        ordinary_multiplier REAL NOT NULL,
        applied_multiplier REAL NOT NULL,
        reason TEXT NOT NULL,
        metadata_json TEXT DEFAULT '{}',
        created_at REAL NOT NULL
    )
    """)

    # System Configuration table (Key-Value store)
    c.execute("""
    CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """)

    # Set default system config values if missing
    defaults = {
        "demo_mode": "true",                # Demo mode default (low threshold)
        "demo_min_peak_drivers": "4",       # 4 drivers in demo mode
        "prod_min_peak_drivers": "10",      # 10 drivers in strict mode
        "drop_threshold_pct": "0.50",       # 50% drop
        "trigger_surge_min": "1.50",        # 1.5x minimum potential surge
        "trigger_surge_delta": "0.30",      # or 0.3x delta in 5m
        "window_cap_minutes": "15",         # 15 min maximum uncertain cap
        "cooldown_minutes": "6",            # 6 min cooldown after release
        "traffic_condition": "normal",      # 'normal' or 'worse_than_normal'
    }

    # Feedback table
    c.execute("""
    CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT NOT NULL,
        feedback_type TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at REAL NOT NULL
    )
    """)

    # Driver Applications table
    c.execute("""
    CREATE TABLE IF NOT EXISTS driver_applications (
        id TEXT PRIMARY KEY,
        application_ref TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        operating_zone TEXT NOT NULL,
        licence_number TEXT NOT NULL,
        licence_expiry TEXT NOT NULL,
        vehicle_category TEXT NOT NULL,
        ownership_status TEXT NOT NULL,
        vehicle_reg_number TEXT NOT NULL,
        status TEXT DEFAULT 'received',
        consent_given INTEGER NOT NULL,
        created_at REAL NOT NULL,
        updated_at REAL NOT NULL
    )
    """)

    conn.commit()
    conn.close()

def log_audit(
    zone_id: str,
    event_type: str,
    state: str,
    ordinary_multiplier: float,
    applied_multiplier: float,
    reason: str,
    metadata: Optional[Dict[str, Any]] = None
):
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
    INSERT INTO audit_log (zone_id, event_type, state, ordinary_multiplier, applied_multiplier, reason, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        zone_id,
        event_type,
        state,
        round(ordinary_multiplier, 2),
        round(applied_multiplier, 2),
        reason,
        json.dumps(metadata or {}),
        clock.now_ts()
    ))
    conn.commit()
    conn.close()

def get_config(key: str, default: str = "") -> str:
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT value FROM system_config WHERE key = ?", (key,))
    row = c.fetchone()
    conn.close()
    return row["value"] if row else default

def set_config(key: str, value: str):
    conn = get_connection()
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
    conn.close()
