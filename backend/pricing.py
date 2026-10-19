"""
Pricing and fare calculation engine for ride-hailing with Surge-Price Protection.
"""
from typing import Dict, Any

# Standard Mumbai INR fare parameters
BASE_FARE = 50.0        # INR
PER_KM_RATE = 15.0      # INR / km
PER_MIN_RATE = 2.5      # INR / min
MINIMUM_FARE = 80.0     # INR
BOOKING_FEE = 20.0      # INR (NEVER surged)
MAX_SURGE_CAP = 3.0     # Max multiplier
NEUTRAL_RATIO = 1.0     # 1 request per driver = 1.0x surge

def calculate_ordinary_surge(
    requests_count: int,
    available_drivers_count: int,
    previous_multiplier: float = 1.0
) -> float:
    """
    Every minute, per zone, compute requests / available drivers.
    Above a neutral ratio, multiplier rises, capped at 3.0x and smoothed.
    """
    safe_drivers = max(1, available_drivers_count)
    ratio = requests_count / safe_drivers
    
    if ratio <= NEUTRAL_RATIO:
        raw_multiplier = 1.0
    else:
        # Each incremental 0.5 ratio above neutral raises surge by 0.3x
        raw_multiplier = 1.0 + (ratio - NEUTRAL_RATIO) * 0.6
    
    # Cap between 1.0x and 3.0x
    capped = max(1.0, min(MAX_SURGE_CAP, raw_multiplier))
    
    # Smoothing: 70% current raw/capped, 30% previous to prevent volatile spikes
    smoothed = (0.7 * capped) + (0.3 * previous_multiplier)
    return round(smoothed, 2)

def calculate_fare_breakdown(
    distance_km: float,
    duration_min: float,
    surge_multiplier: float
) -> Dict[str, Any]:
    """
    fare = max(minimum, (base + per_km * distance + per_min * time) * surge_multiplier) + booking_fee
    The booking fee is NEVER surged.
    """
    dist_cost = PER_KM_RATE * distance_km
    time_cost = PER_MIN_RATE * duration_min
    subtotal_base = BASE_FARE + dist_cost + time_cost
    
    surged_subtotal = subtotal_base * surge_multiplier
    effective_subtotal = max(MINIMUM_FARE, surged_subtotal)
    
    final_fare = round(effective_subtotal + BOOKING_FEE, 2)
    
    # Also calculate without surge (1.0x) for reference comparison
    un_surged_effective = max(MINIMUM_FARE, subtotal_base)
    un_surged_total = round(un_surged_effective + BOOKING_FEE, 2)
    
    return {
        "base_fare": BASE_FARE,
        "distance_km": round(distance_km, 2),
        "distance_cost": round(dist_cost, 2),
        "duration_min": round(duration_min, 1),
        "time_cost": round(time_cost, 2),
        "subtotal_pre_surge": round(subtotal_base, 2),
        "surge_multiplier": round(surge_multiplier, 2),
        "surged_subtotal": round(surged_subtotal, 2),
        "effective_subtotal": round(effective_subtotal, 2),
        "booking_fee": BOOKING_FEE,
        "final_fare": final_fare,
        "un_surged_total": un_surged_total,
    }
