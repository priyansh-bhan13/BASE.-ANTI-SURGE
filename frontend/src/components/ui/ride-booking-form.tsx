"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import {
  MapPin,
  Send,
  Plus,
  Calendar,
  Clock,
  ArrowRight,
  Crosshair,
  ArrowUpDown,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Car,
  RotateCw,
} from "lucide-react";
import {
  searchLocations,
  reverseGeocode,
  getDrivingRoute,
  LocationSuggestion,
  RouteResult,
  RATE_PER_KM,
  calculateFare,
} from "@/services/geocoding";
import { SweepSurface } from "@/components/ui/sweep-surface";

export interface SelectedLocation {
  name: string;
  lat: number;
  lon: number;
}

export interface RideDetails {
  pickup: string;
  dropoff: string;
  date: string;
  time: string;
  distanceKm?: number;
  fare?: number;
  vehicleId?: string;
  ratePerKm?: number;
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(1.5, Math.round(R * c * 10) / 10);
}

export function findCoords(name: string, _fallbackCity = "Mumbai, IN") {
  return { lat: 19.0657, lon: 72.8682, lng: 72.8682, matchedName: name };
}

export interface RideBookingFormProps extends React.HTMLAttributes<HTMLDivElement> {
  imageUrl?: string;
  city?: string;
  initialPickup?: string;
  initialDropoff?: string;
  selectedVehicleId?: string;
  onVehicleChange?: (id: string) => void;
  onSearch?: (details: RideDetails) => void;
  onRouteCalculated?: (result: {
    pickup: SelectedLocation;
    dropoff: SelectedLocation;
    route: RouteResult;
    fare: number;
    scheduleTime?: string;
  }) => void;
  className?: string;
}

export const RideBookingForm = React.forwardRef<HTMLDivElement, RideBookingFormProps>(
  (
    {
      className,
      imageUrl: _imageUrl,
      city: _city,
      initialPickup,
      initialDropoff,
      onSearch,
      onRouteCalculated,
      ...props
    },
    ref
  ) => {
    // Location text and coordinates
    const [pickupText, setPickupText] = React.useState(initialPickup || "Bandra Kurla Complex (BKC), Mumbai");
    const [pickupCoords, setPickupCoords] = React.useState<SelectedLocation | null>({
      name: initialPickup || "Bandra Kurla Complex (BKC), Mumbai",
      lat: 19.0657,
      lon: 72.8682,
    });

    const [dropoffText, setDropoffText] = React.useState(initialDropoff || "Chhatrapati Shivaji Maharaj Airport (BOM), Mumbai");
    const [dropoffCoords, setDropoffCoords] = React.useState<SelectedLocation | null>({
      name: initialDropoff || "Chhatrapati Shivaji Maharaj Airport (BOM), Mumbai",
      lat: 19.0896,
      lon: 72.8656,
    });

    // Active input for suggestions dropdown
    const [activeInput, setActiveInput] = React.useState<"pickup" | "dropoff" | null>(null);

    // Suggestions state
    const [suggestions, setSuggestions] = React.useState<LocationSuggestion[]>([]);
    const [isSearching, setIsSearching] = React.useState(false);
    const [searchError, setSearchError] = React.useState<string | null>(null);

    // Geolocation loading state
    const [isLocating, setIsLocating] = React.useState(false);
    const [locationError, setLocationError] = React.useState<string | null>(null);

    // Schedule options
    const [rideType, setRideType] = React.useState<"now" | "schedule">("now");
    const todayStr = React.useMemo(() => new Date().toISOString().split("T")[0], []);
    const [scheduledDate, setScheduledDate] = React.useState(todayStr);
    const [scheduledTime, setScheduledTime] = React.useState("14:30");
    const [scheduleError, setScheduleError] = React.useState<string | null>(null);

    // Route calculation state
    const [isCalculatingRoute, setIsCalculatingRoute] = React.useState(false);
    const [routeResult, setRouteResult] = React.useState<RouteResult | null>(null);
    const [routeError, setRouteError] = React.useState<string | null>(null);

    // Abort controller for debounced searches
    const searchAbortRef = React.useRef<AbortController | null>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    React.useEffect(() => {
      const handleOutsideClick = (e: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
          setActiveInput(null);
        }
      };
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, []);

    // Debounced location search via Nominatim
    React.useEffect(() => {
      if (!activeInput) {
        setSuggestions([]);
        return;
      }

      const query = activeInput === "pickup" ? pickupText : dropoffText;
      if (!query || query.trim().length < 2) {
        setSuggestions([]);
        setIsSearching(false);
        setSearchError(null);
        return;
      }

      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }

      const controller = new AbortController();
      searchAbortRef.current = controller;
      setIsSearching(true);
      setSearchError(null);

      const timer = setTimeout(async () => {
        try {
          const results = await searchLocations(query, controller.signal);
          setSuggestions(results);
          setIsSearching(false);
        } catch (err: any) {
          if (err.name !== "AbortError") {
            setSearchError("Unable to fetch suggestions. Check network connection.");
            setIsSearching(false);
          }
        }
      }, 350);

      return () => {
        clearTimeout(timer);
        controller.abort();
      };
    }, [pickupText, dropoffText, activeInput]);

    // Handle pickup text change - clear coords if modified
    const handlePickupChange = (value: string) => {
      setPickupText(value);
      setPickupCoords(null);
      setRouteResult(null);
      setRouteError(null);
      setActiveInput("pickup");
    };

    // Handle dropoff text change - clear coords if modified
    const handleDropoffChange = (value: string) => {
      setDropoffText(value);
      setDropoffCoords(null);
      setRouteResult(null);
      setRouteError(null);
      setActiveInput("dropoff");
    };

    // Handle suggestion selection
    const handleSelectSuggestion = (item: LocationSuggestion) => {
      const selected: SelectedLocation = {
        name: item.displayName,
        lat: item.lat,
        lon: item.lon,
      };

      if (activeInput === "pickup") {
        setPickupText(item.name || item.displayName.split(",")[0]);
        setPickupCoords(selected);
      } else {
        setDropoffText(item.name || item.displayName.split(",")[0]);
        setDropoffCoords(selected);
      }

      setActiveInput(null);
      setSuggestions([]);
      setRouteResult(null);
      setRouteError(null);
    };

    // Swap pickup and destination
    const handleSwapLocations = () => {
      const tempText = pickupText;
      const tempCoords = pickupCoords;

      setPickupText(dropoffText);
      setPickupCoords(dropoffCoords);

      setDropoffText(tempText);
      setDropoffCoords(tempCoords);

      setRouteResult(null);
      setRouteError(null);
    };

    // Use browser current location
    const handleUseCurrentLocation = () => {
      if (!navigator.geolocation) {
        setLocationError("Geolocation is not supported by your browser.");
        return;
      }

      setIsLocating(true);
      setLocationError(null);

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const result = await reverseGeocode(latitude, longitude);
            setPickupText(result.name || result.displayName.split(",")[0]);
            setPickupCoords({
              name: result.displayName,
              lat: latitude,
              lon: longitude,
            });
            setRouteResult(null);
            setRouteError(null);
          } catch (_err: any) {
            setLocationError("Could not resolve address from GPS coordinates.");
          } finally {
            setIsLocating(false);
          }
        },
        (error) => {
          setIsLocating(false);
          if (error.code === error.PERMISSION_DENIED) {
            setLocationError("Location permission denied. Please enter pickup manually.");
          } else {
            setLocationError("Location unavailable. Please enter pickup manually.");
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    // Validate schedule date and time
    const validateSchedule = (): boolean => {
      if (rideType === "now") return true;

      const now = new Date();
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);

      if (isNaN(scheduledDateTime.getTime())) {
        setScheduleError("Please choose a valid date and time.");
        return false;
      }

      if (scheduledDateTime < now) {
        setScheduleError("Scheduled pickup cannot be in the past.");
        return false;
      }

      setScheduleError(null);
      return true;
    };

    // Calculate real route and fare at ₹24/km
    const handleCalculatePrices = async (e: React.FormEvent) => {
      e.preventDefault();

      if (!pickupCoords) {
        setRouteError("Please select a verified pickup location from suggestions.");
        return;
      }

      if (!dropoffCoords) {
        setRouteError("Please select a verified destination from suggestions.");
        return;
      }

      if (!validateSchedule()) {
        return;
      }

      setIsCalculatingRoute(true);
      setRouteError(null);

      try {
        const route = await getDrivingRoute(
          { lat: pickupCoords.lat, lon: pickupCoords.lon },
          { lat: dropoffCoords.lat, lon: dropoffCoords.lon }
        );

        setRouteResult(route);
        const fare = calculateFare(route.distanceKm);

        if (onRouteCalculated) {
          onRouteCalculated({
            pickup: pickupCoords,
            dropoff: dropoffCoords,
            route,
            fare,
            scheduleTime:
              rideType === "schedule"
                ? `${scheduledDate} at ${scheduledTime}`
                : "Now",
          });
        }

        if (onSearch) {
          onSearch({
            pickup: pickupText,
            dropoff: dropoffText,
            date: scheduledDate,
            time: scheduledTime,
            distanceKm: route.distanceKm,
            fare,
          });
        }
      } catch (err: any) {
        setRouteError(err.message || "Failed to calculate driving route. Please retry.");
      } finally {
        setIsCalculatingRoute(false);
      }
    };

    // Estimated fare
    const calculatedFare = routeResult ? calculateFare(routeResult.distanceKm) : null;
    const surgingFare = calculatedFare ? Math.round(calculatedFare * 2.2) : null;
    const surgeSavings = calculatedFare && surgingFare ? surgingFare - calculatedFare : null;

    return (
      <div
        className={cn("w-full bg-transparent text-black", className)}
        ref={ref}
        {...props}
      >
        <div className="p-6 sm:p-8 border border-neutral-200 bg-white">
          {/* Header Title & Surge Badge */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-neutral-200/80 pb-4">
            <div>
              <span className="text-[11px] font-sans font-semibold uppercase tracking-[0.12em] text-neutral-500 block mb-1">
                Rider Console • Mumbai
              </span>
              <h1 className="text-[34px] sm:text-[38px] font-[700] tracking-[-0.035em] text-black leading-[1.1]">
                Book a Ride
              </h1>
            </div>
            <SweepSurface
              as="span"
              variant="light"
              className="px-3.5 py-1.5 text-[11px] font-sans font-semibold tracking-[0.08em] uppercase self-start sm:self-auto"
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 bg-black"
              />
              Flat ₹{RATE_PER_KM} / km tariff
            </SweepSurface>
          </div>

          <form onSubmit={handleCalculatePrices} className="space-y-5">
            {/* Ride Type Selector (Ride now vs Schedule) */}
            <div className="flex border border-neutral-200/80 bg-neutral-100/60 p-1">
              <button
                type="button"
                onClick={() => {
                  setRideType("now");
                  setScheduleError(null);
                }}
                className={cn(
                  "flex-1 py-2 text-[13px] font-[600] tracking-[0.06em] uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
                  rideType === "now"
                    ? "bg-black text-white"
                    : "text-neutral-600 hover:text-black"
                )}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Ride now</span>
              </button>
              <button
                type="button"
                onClick={() => setRideType("schedule")}
                className={cn(
                  "flex-1 py-2 text-[13px] font-[600] tracking-[0.06em] uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
                  rideType === "schedule"
                    ? "bg-black text-white"
                    : "text-neutral-600 hover:text-black"
                )}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Schedule a ride</span>
              </button>
            </div>

            {/* Scheduled Date and Time Fields */}
            {rideType === "schedule" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-2 gap-3 p-3 bg-neutral-50 border border-neutral-200"
              >
                <div>
                  <label className="block text-[10px] font-sans font-semibold uppercase text-neutral-500 mb-1">
                    Pickup Date
                  </label>
                  <input
                    type="date"
                    min={todayStr}
                    value={scheduledDate}
                    onChange={(e) => {
                      setScheduledDate(e.target.value);
                      setScheduleError(null);
                    }}
                    className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs font-sans font-medium text-black focus:outline-none focus:border-black"
                    aria-label="Schedule Date"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-semibold uppercase text-neutral-500 mb-1">
                    Pickup Time
                  </label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => {
                      setScheduledTime(e.target.value);
                      setScheduleError(null);
                    }}
                    className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs font-sans font-medium text-black focus:outline-none focus:border-black"
                    aria-label="Schedule Time"
                  />
                </div>
                {scheduleError && (
                  <div className="col-span-2 text-[11px] font-sans font-medium text-red-600 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{scheduleError}</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* Locations Container with Connecting Line */}
            <div className="relative bg-neutral-50 p-4 border border-neutral-200" ref={dropdownRef}>
              {/* Connecting line */}
              <div className="absolute left-[27px] top-[40px] bottom-[40px] w-px border-l border-dashed border-neutral-400 pointer-events-none" />

              {/* Pickup Location Input */}
              <div className="relative flex items-center mb-3">
                <div className="z-10 bg-black text-white p-1.5 border border-black shrink-0">
                  <MapPin className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="w-full relative ml-3">
                  <input
                    type="text"
                    placeholder="Enter pickup locality, landmark or address"
                    value={pickupText}
                    onFocus={() => setActiveInput("pickup")}
                    onChange={(e) => handlePickupChange(e.target.value)}
                    className="w-full pr-10 py-2.5 bg-transparent text-[16px] font-[500] text-black placeholder:text-neutral-400 focus:outline-none border-b border-neutral-300 focus:border-black transition-colors"
                    aria-label="Pickup location"
                  />
                  <button
                    type="button"
                    title="Use my current location"
                    onClick={handleUseCurrentLocation}
                    disabled={isLocating}
                    className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 text-neutral-500 hover:text-black disabled:opacity-50 transition-colors"
                  >
                    {isLocating ? (
                      <Loader2 className="h-4 w-4 animate-spin text-black" />
                    ) : (
                      <Crosshair className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Swap Button Divider */}
              <div className="relative flex items-center justify-between my-2 pl-9 pr-2">
                <div className="h-px bg-neutral-200 flex-1" />
                <button
                  type="button"
                  title="Swap pickup and destination"
                  onClick={handleSwapLocations}
                  className="mx-3 p-1 bg-white border border-neutral-300 hover:border-black text-neutral-600 hover:text-black transition-colors"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
                <div className="h-px bg-neutral-200 flex-1" />
              </div>

              {/* Dropoff Location Input */}
              <div className="relative flex items-center mt-3">
                <div className="z-10 bg-white text-black p-1.5 border border-black shrink-0">
                  <Plus className="h-3.5 w-3.5 text-black" />
                </div>
                <div className="w-full relative ml-3">
                  <input
                    type="text"
                    placeholder="Enter destination / drop-off location"
                    value={dropoffText}
                    onFocus={() => setActiveInput("dropoff")}
                    onChange={(e) => handleDropoffChange(e.target.value)}
                    className="w-full pr-10 py-2.5 bg-transparent text-[16px] font-[500] text-black placeholder:text-neutral-400 focus:outline-none border-b border-neutral-300 focus:border-black transition-colors"
                    aria-label="Dropoff destination"
                  />
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400">
                    <Send className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>

              {/* Real-time Location Suggestions Dropdown */}
              <AnimatePresence>
                {activeInput && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="mt-3 pt-3 border-t border-neutral-200 max-h-60 overflow-y-auto"
                  >
                    <div className="flex items-center justify-between text-[10px] font-sans font-semibold uppercase text-neutral-500 mb-2">
                      <span>OpenStreetMap Location Suggestions</span>
                      {isSearching && (
                        <span className="flex items-center gap-1 text-black font-semibold">
                          <Loader2 className="w-3 h-3 animate-spin" /> Searching...
                        </span>
                      )}
                    </div>

                    {searchError && (
                      <div className="p-2 text-xs text-red-600 bg-red-50 border border-red-200 font-sans font-medium mb-2">
                        {searchError}
                      </div>
                    )}

                    {!isSearching && suggestions.length === 0 && (
                      <div className="p-3 text-xs text-neutral-500 font-sans text-center bg-white border border-neutral-200">
                        Type at least 2 characters to search addresses & landmarks
                      </div>
                    )}

                    {suggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectSuggestion(item)}
                        className="w-full text-left p-2.5 hover:bg-neutral-100 border-b border-neutral-100 last:border-b-0 transition-colors flex items-start gap-2 text-black cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5 text-neutral-600 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold truncate text-black">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-neutral-500 truncate font-sans">
                            {item.locality || item.displayName}
                          </div>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Geolocation Error Alert */}
            {locationError && (
              <div className="p-2.5 bg-neutral-100 border border-neutral-300 text-xs font-sans font-medium text-neutral-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-black shrink-0" />
                <span>{locationError}</span>
              </div>
            )}

            {/* Ride Category: BASE Standard */}
            <div className="p-3 bg-neutral-50 border border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-black text-white flex items-center justify-center">
                  <Car className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-[600] text-black uppercase tracking-wider">
                    BASE Standard
                  </div>
                  <div className="text-[11px] text-neutral-500 font-sans">
                    Air-conditioned sedan • Verified drivers
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-sans font-bold text-black block">
                  ₹{RATE_PER_KM} / km
                </span>
                <span className="text-[10px] font-sans font-semibold text-neutral-500">
                  Fixed base tariff
                </span>
              </div>
            </div>

            {/* Route & Calculation Error Alert */}
            {routeError && (
              <div className="p-3 bg-neutral-100 border border-neutral-300 text-xs font-sans font-medium text-neutral-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-black shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span>{routeError}</span>
                </div>
                <button
                  type="submit"
                  className="text-[11px] underline uppercase font-bold text-black"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Live Calculated Driving Distance & Fare Results */}
            {routeResult && calculatedFare !== null && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-neutral-50 border border-black space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                  <span className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                    Driving Route Computed
                  </span>
                  <span className="text-[11px] font-sans font-medium text-neutral-600">
                    Via OSRM Driving Engine
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-sans">
                  <div>
                    <span className="text-neutral-500 block">Driving Distance:</span>
                    <span className="font-bold text-black text-sm">{routeResult.distanceKm} km</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Journey Duration:</span>
                    <span className="font-bold text-black text-sm">{routeResult.durationMin} mins</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Base Tariff Rate:</span>
                    <span className="font-bold text-black">₹{RATE_PER_KM} / km</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Surge Competitor:</span>
                    <span className="line-through text-neutral-400">₹{surgingFare}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-200 flex items-baseline justify-between">
                  <div>
                    <span className="text-xs uppercase font-bold text-black block">
                      Estimated Ride Fare
                    </span>
                    <span className="text-[11px] text-neutral-500 font-sans">
                      {routeResult.distanceKm} km × ₹{RATE_PER_KM} / km
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-black font-sans">
                      ₹{calculatedFare}
                    </span>
                    {surgeSavings && (
                      <span className="block text-[10px] font-sans text-neutral-600 font-bold">
                        Surge saved ₹{surgeSavings} (1.0× fixed)
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-neutral-400 font-sans pt-1">
                  Route data © OpenStreetMap contributors
                </div>
              </motion.div>
            )}

            {/* Primary Action Button: See prices with SweepSurface */}
            <SweepSurface
              as="button"
              type="submit"
              variant="dark"
              disabled={isCalculatingRoute}
              className="w-full py-3.5 text-[14px] font-[600] tracking-[0.12em] uppercase cursor-pointer"
            >
              {isCalculatingRoute ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Calculating Driving Route...</span>
                </>
              ) : routeResult ? (
                <>
                  <span>Recalculate Route • ₹{calculatedFare}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>See prices</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </SweepSurface>
          </form>
        </div>
      </div>
    );
  }
);

RideBookingForm.displayName = "RideBookingForm";

export default RideBookingForm;
