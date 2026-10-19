"""
Pydantic Schemas for Ride-Hailing & Surge Protection.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class QuoteRequest(BaseModel):
    pickup_lat: float
    pickup_lng: float
    dropoff_lat: float
    dropoff_lng: float
    pickup_address: Optional[str] = "Bandra Kurla Complex (BKC)"
    dropoff_address: Optional[str] = "Bandra West Station"

class RideBookingRequest(BaseModel):
    quote_id: str
    rider_name: str = "Priyansh"
    rider_phone: str = "+91 98765 43210"

class DriverRegisterRequest(BaseModel):
    name: str
    phone: str
    vehicle_type: str = "car"
    zone_id: str = "bkc"
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_test_driver: bool = True

class DriverHeartbeatRequest(BaseModel):
    driver_id: str
    lat: float
    lng: float
    zone_id: Optional[str] = None
    status: Optional[str] = None

class DriverOfferResponse(BaseModel):
    request_id: str
    driver_id: str
    accepted: bool

class TripActionRequest(BaseModel):
    request_id: str
    driver_id: str
    action: str  # 'arrived', 'start_trip', 'complete_trip'

class ConfigUpdateRequest(BaseModel):
    demo_mode: Optional[bool] = None
    traffic_condition: Optional[str] = None
    demo_min_peak_drivers: Optional[int] = None
    prod_min_peak_drivers: Optional[int] = None

class ClockAdvanceRequest(BaseModel):
    minutes: Optional[float] = 1.0
    seconds: Optional[float] = None

class DriverApplicationRequest(BaseModel):
    full_name: str = Field(..., min_length=3, max_length=100)
    phone: str = Field(..., min_length=10, max_length=20)
    email: str = Field(..., min_length=5, max_length=100)
    operating_zone: str = Field("bkc", max_length=50)
    licence_number: str = Field(..., min_length=5, max_length=30)
    licence_expiry: str = Field(..., min_length=4, max_length=20)
    vehicle_category: str = Field("sedan", max_length=30)
    ownership_status: str = Field("owner", max_length=30)
    vehicle_reg_number: str = Field(..., min_length=4, max_length=20)
    consent_given: bool = Field(..., description="Must explicitly agree to terms and privacy policy")

