"""
Mumbai Zone definitions and geographic utilities for Surge-Price Protection.
Focused on Bandra West, BKC, Khar, Santacruz, and Kurla.
"""
import math
from typing import Dict, List, Optional, Tuple

# Predefined Mumbai Zones (approx 1-1.5 km cells)
ZONES: Dict[str, dict] = {
    "bkc": {
        "id": "bkc",
        "name": "BKC (Bandra Kurla Complex)",
        "center": {"lat": 19.0657, "lng": 72.8686},
        "bounds": {
            "min_lat": 19.0580,
            "max_lat": 19.0735,
            "min_lng": 72.8600,
            "max_lng": 72.8770,
        },
        "color": "#276EF1",  # Uber Blue
        "neighbors": ["kurla", "santacruz", "bandra_west"],
    },
    "bandra_west": {
        "id": "bandra_west",
        "name": "Bandra West (Linking Rd)",
        "center": {"lat": 19.0596, "lng": 72.8295},
        "bounds": {
            "min_lat": 19.0480,
            "max_lat": 19.0700,
            "min_lng": 72.8200,
            "max_lng": 72.8420,
        },
        "color": "#0E8345",  # Green
        "neighbors": ["khar", "bkc"],
    },
    "khar": {
        "id": "khar",
        "name": "Khar West",
        "center": {"lat": 19.0700, "lng": 72.8340},
        "bounds": {
            "min_lat": 19.0650,
            "max_lat": 19.0780,
            "min_lng": 72.8250,
            "max_lng": 72.8450,
        },
        "color": "#9B51E0",  # Purple
        "neighbors": ["bandra_west", "santacruz"],
    },
    "santacruz": {
        "id": "santacruz",
        "name": "Santacruz East",
        "center": {"lat": 19.0820, "lng": 72.8570},
        "bounds": {
            "min_lat": 19.0730,
            "max_lat": 19.0910,
            "min_lng": 72.8450,
            "max_lng": 72.8690,
        },
        "color": "#FF6900",  # Orange
        "neighbors": ["khar", "bkc", "kurla"],
    },
    "kurla": {
        "id": "kurla",
        "name": "Kurla West",
        "center": {"lat": 19.0680, "lng": 72.8800},
        "bounds": {
            "min_lat": 19.0600,
            "max_lat": 19.0760,
            "min_lng": 72.8730,
            "max_lng": 72.8900,
        },
        "color": "#E11900",  # Red
        "neighbors": ["bkc", "santacruz"],
    },
}

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in km."""
    R = 6371.0  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def estimate_road_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Straight-line distance times road factor (1.35 for urban Mumbai)."""
    straight = haversine_distance_km(lat1, lon1, lat2, lon2)
    return max(0.5, round(straight * 1.35, 2))

def estimate_trip_duration_min(distance_km: float) -> float:
    """Estimate urban trip duration in minutes at avg 22 km/h plus 3 min buffer."""
    return max(3.0, round((distance_km / 22.0) * 60.0 + 3.0, 1))

def find_zone_for_coordinates(lat: float, lng: float) -> str:
    """Find matching zone id for lat/lng, falling back to nearest zone centroid."""
    for zid, zdata in ZONES.items():
        b = zdata["bounds"]
        if b["min_lat"] <= lat <= b["max_lat"] and b["min_lng"] <= lng <= b["max_lng"]:
            return zid
    
    # Nearest fallback
    nearest_id = "bkc"
    min_dist = float("inf")
    for zid, zdata in ZONES.items():
        c = zdata["center"]
        d = haversine_distance_km(lat, lng, c["lat"], c["lng"])
        if d < min_dist:
            min_dist = d
            nearest_id = zid
    return nearest_id
