import React, { useState, useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Phone,
  MessageSquare,
  Share2,
  Star,
  X,
  CreditCard,
  Wallet,
  Smartphone,
  Banknote,
  Navigation,
  Sparkles,
} from "lucide-react";
import {
  RideBookingForm,
  RideDetails,
  calculateDistance,
  findCoords,
} from "@/components/ui/ride-booking-form";
import { FloatingPathsBackground } from "@/components/ui/floating-paths";
import UnderlineToBackground from "@/components/fancy/text/underline-to-background";

const RIDE_HERO_IMAGE =
  "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=1200&q=80";

type BookingStep =
  | "set-trip"
  | "choose-ride"
  | "payment"
  | "finding-driver"
  | "driver-assigned"
  | "trip-in-progress"
  | "receipt";

export interface BookingFlowProps {
  initialPickup?: string;
  initialDestination?: string;
  initialStep?: BookingStep;
  city?: string;
  onBackToLanding: () => void;
}

interface VehicleOption {
  id: string;
  name: string;
  icon: string;
  capacity: number;
  eta: string;
  multiplier: number;
  ordinarySurge: number;
  protectedSurge: number;
  description: string;
}

const VEHICLES: VehicleOption[] = [
  {
    id: "moto",
    name: "Moto",
    icon: "🏍️",
    capacity: 1,
    eta: "2 min away",
    multiplier: 0.6,
    ordinarySurge: 2.2,
    protectedSurge: 1.0,
    description: "Fast, solo city zip",
  },
  {
    id: "auto",
    name: "Auto",
    icon: "🛺",
    capacity: 3,
    eta: "3 min away",
    multiplier: 0.75,
    ordinarySurge: 2.2,
    protectedSurge: 1.0,
    description: "No bargaining, direct drop",
  },
  {
    id: "basego",
    name: "BaseGo",
    icon: "🚗",
    capacity: 4,
    eta: "4 min away",
    multiplier: 1.0, // Fixed ₹24/km
    ordinarySurge: 2.2,
    protectedSurge: 1.0,
    description: "Everyday comfortable AC ride",
  },
  {
    id: "premier",
    name: "Premier",
    icon: "🚙",
    capacity: 4,
    eta: "5 min away",
    multiplier: 1.35,
    ordinarySurge: 2.2,
    protectedSurge: 1.0,
    description: "Top-rated drivers, premium sedans",
  },
  {
    id: "xl",
    name: "Base XL",
    icon: "🚐",
    capacity: 6,
    eta: "7 min away",
    multiplier: 1.75,
    ordinarySurge: 2.2,
    protectedSurge: 1.0,
    description: "Spacious SUVs for groups & luggage",
  },
];

export default function RideBookingFlow({
  initialPickup = "Bandra Kurla Complex (BKC)",
  initialDestination = "Chhatrapati Shivaji Maharaj Airport (BOM)",
  initialStep = "set-trip",
  city = "Chandigarh, IN",
  onBackToLanding,
}: BookingFlowProps) {
  const [step, setStep] = useState<BookingStep>(initialStep);
  const [pickup, setPickup] = useState(initialPickup);
  const [destination, setDestination] = useState(initialDestination);
  const [pickupCoords, setPickupCoords] = useState(() => findCoords(initialPickup, city));
  const [destCoords, setDestCoords] = useState(() => findCoords(initialDestination, city));
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleOption>(VEHICLES[2]); // BaseGo default
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "cash" | "card" | "wallet">("upi");
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [showProtectionModal, setShowProtectionModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [tip, setTip] = useState(30);
  const [driverOtp] = useState("4821");
  const [etaRemaining, setEtaRemaining] = useState(14); // minutes

  // Map state
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  // Rate calculation strictly based on simple ₹24/km
  const BASE_RATE_PER_KM = 24;

  const distanceKm = useMemo(() => {
    const d = calculateDistance(pickupCoords.lat, pickupCoords.lng, destCoords.lat, destCoords.lng);
    return d < 1.5 ? 9.4 : d;
  }, [pickupCoords, destCoords]);

  const durationMin = useMemo(() => {
    return Math.max(8, Math.round(distanceKm * 2.1));
  }, [distanceKm]);

  // Pricing based on 24 RS PER KM PRICE
  const baseKmFare = Math.round(distanceKm * BASE_RATE_PER_KM);
  const standardFare = Math.round(baseKmFare * selectedVehicle.multiplier);
  const rawSurgeMultiplier = selectedVehicle.ordinarySurge; // 2.2x
  const unprotectedFare = Math.round(standardFare * rawSurgeMultiplier);
  const surgeSavings = unprotectedFare - standardFare;
  const finalFare = promoApplied ? Math.max(standardFare - 50, 40) : standardFare;

  // Initialize and update Leaflet map when navigating through steps
  useEffect(() => {
    if (step === "set-trip") return;
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([pickupCoords.lat, pickupCoords.lng], 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      mapInstanceRef.current = map;
      requestAnimationFrame(() => {
        map.invalidateSize();
      });
    }

    const map = mapInstanceRef.current;

    // Remove prior route layers
    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
    }

    // Add crisp geometric markers for pickup and dropoff
    const pickupIcon = L.divIcon({
      className: "pickup-marker",
      html: '<div style="width:14px;height:14px;background:#000000;border:2px solid #FFFFFF;outline:1px solid #000000;"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    const dropoffIcon = L.divIcon({
      className: "dropoff-marker",
      html: '<div style="width:14px;height:14px;background:#FFFFFF;border:2px solid #000000;"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    L.marker([pickupCoords.lat, pickupCoords.lng], { icon: pickupIcon }).addTo(map);
    L.marker([destCoords.lat, destCoords.lng], { icon: dropoffIcon }).addTo(map);

    // Draw route polyline
    const route = L.polyline(
      [
        [pickupCoords.lat, pickupCoords.lng],
        [
          (pickupCoords.lat + destCoords.lat) / 2 + 0.004,
          (pickupCoords.lng + destCoords.lng) / 2 - 0.003,
        ],
        [destCoords.lat, destCoords.lng],
      ],
      {
        color: "#000000",
        weight: 4,
        opacity: 0.9,
        dashArray: "6, 6",
      }
    ).addTo(map);

    routePolylineRef.current = route;
    map.fitBounds(route.getBounds(), { padding: [50, 50] });
  }, [pickupCoords, destCoords, step]);

  // Handle Driver Approaching and In-Progress Simulation Transitions
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (step === "finding-driver") {
      timer = setTimeout(() => {
        setStep("driver-assigned");
      }, 3500);
    } else if (step === "driver-assigned") {
      timer = setTimeout(() => {
        setStep("trip-in-progress");
      }, 5000);
    } else if (step === "trip-in-progress") {
      const interval = setInterval(() => {
        setEtaRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setStep("receipt");
            return 0;
          }
          return prev - 1;
        });
      }, 1800);
      return () => clearInterval(interval);
    }

    return () => clearTimeout(timer);
  }, [step]);

  // Handle initial search from the RideBookingForm
  const handleBookingSearch = (details: RideDetails) => {
    setPickup(details.pickup);
    setDestination(details.dropoff);
    const pCoords = findCoords(details.pickup, city);
    const dCoords = findCoords(details.dropoff, city);
    setPickupCoords(pCoords);
    setDestCoords(dCoords);
    if (details.vehicleId) {
      const v = VEHICLES.find((item) => item.id === details.vehicleId);
      if (v) setSelectedVehicle(v);
    }
    setStep("choose-ride");
  };

  // Words for the animated right-side header
  const headlineWords = "RIDES MADE EASIER WITH".split(" ");

  const fadeInVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.4, staggerChildren: 0.08 },
    },
  };

  const wordVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  // =========================================================================
  // VIEW 1: INITIAL RIDERS BOOKING PAGE (REQUESTED SPECIFICATION)
  // Background: FloatingPathsBackground (White Base, Black Paths, Non-Overshadowing)
  // Left Side: Ride Booking Form with Several Vehicle Options & ₹24/km Real Location Data
  // Right Side: Animated "RIDES MADE EASIER WITH BASE" & Black/White Visual Showcase
  // =========================================================================
  if (step === "set-trip") {
    return (
      <div className="min-h-screen bg-white text-black flex flex-col font-sans">
        {/* Sleek Top Uber/Base Header */}
        <header className="border-b border-neutral-200 bg-black text-white px-6 py-4 flex items-center justify-between z-30 sticky top-0">
          <div className="flex items-center gap-4">
            <button
              onClick={onBackToLanding}
              className="flex items-center gap-2 text-xs font-sans uppercase tracking-wider text-neutral-400 hover:text-white transition-colors duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Landing</span>
            </button>
            <div className="h-4 w-px bg-neutral-800" />
            <span className="font-bold text-lg tracking-tight">Base</span>
            <span className="text-[10px] font-sans uppercase tracking-widest bg-white/10 text-white px-2 py-0.5 border border-white/20 hidden sm:inline-block">
              Surge Shield Active
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-sans text-white border border-neutral-700 bg-neutral-900 px-3 py-1">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="font-semibold text-emerald-400">Fixed Rate: ₹24 / km</span>
            </div>
            <button
              onClick={() => setShowProtectionModal(true)}
              className="text-xs text-neutral-400 hover:text-white underline underline-offset-4 hidden md:inline-block"
            >
              Surge Protection Guarantee
            </button>
          </div>
        </header>

        {/* FloatingPathsBackground: Pure white canvas, subtle black vector paths */}
        <FloatingPathsBackground
          position={-1}
          className="flex-1 w-full bg-white flex flex-col justify-start py-8 px-4 sm:px-6 lg:px-8"
        >
          <div className="max-w-7xl mx-auto w-full">
            
            {/* Top Showcase Banner with Text Animation on the Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-8">
              
              {/* Left Column: Ride Booking Form with Several Vehicle Options & ₹24/km Pricing */}
              <div className="lg:col-span-7">
                <RideBookingForm
                  imageUrl={RIDE_HERO_IMAGE}
                  city={city}
                  initialPickup={pickup}
                  initialDropoff={destination}
                  selectedVehicleId={selectedVehicle.id}
                  onVehicleChange={(id: string) => {
                    const found = VEHICLES.find((v) => v.id === id);
                    if (found) setSelectedVehicle(found);
                  }}
                  onSearch={handleBookingSearch}
                  className="p-0 max-w-none shadow-none"
                />
              </div>

              {/* Right Column: Animated Text "RIDES MADE EASIER WITH BASE" & Contrast Visuals */}
              <div className="lg:col-span-5 flex flex-col space-y-6">
                
                {/* Text Animation: UnderlineToBackground */}
                <div className="p-6 sm:p-8 bg-white border border-neutral-200">
                  <div className="text-[11px] font-sans uppercase tracking-widest text-neutral-500 mb-3 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-black" />
                    <span>Next-Gen Urban Mobility</span>
                  </div>

                  {/* Headline Animation with UnderlineToBackground */}
                  <motion.h2
                    className="text-3xl sm:text-4xl font-black tracking-tight text-black flex flex-wrap items-baseline gap-2 leading-tight"
                    initial="hidden"
                    animate="visible"
                    variants={fadeInVariants}
                  >
                    {headlineWords.map((word, index) => (
                      <motion.span
                        key={index}
                        variants={wordVariants}
                        className="inline-block"
                      >
                        {word}
                      </motion.span>
                    ))}
                    <motion.span variants={wordVariants} className="inline-block">
                      <UnderlineToBackground
                        targetTextColor="#FFFFFF"
                        className="cursor-pointer text-black"
                      >
                        BASE
                      </UnderlineToBackground>
                    </motion.span>
                  </motion.h2>

                  <p className="text-xs text-neutral-600 font-sans mt-3 leading-relaxed">
                    Hover over <span className="font-bold text-black underline">BASE</span> to witness zero-surge algorithmic stabilization in motion.
                  </p>
                </div>

                {/* Real-time Dynamic Route & Tariff Breakdown Card */}
                <div className="p-6 bg-white border border-neutral-200 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
                    <span className="text-xs font-bold uppercase tracking-wider text-black">
                      Live Metering Formula
                    </span>
                    <span className="text-xs font-sans text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 border border-emerald-200">
                      Standard: ₹24/km
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-sans">
                    <div className="flex justify-between items-center text-neutral-600">
                      <span>Pickup ➔ Destination</span>
                      <span className="font-bold text-black">{distanceKm} KM</span>
                    </div>
                    <div className="flex justify-between items-center text-neutral-600">
                      <span>Vehicle Selected</span>
                      <span className="font-bold text-black">{selectedVehicle.name} ({selectedVehicle.multiplier}× tariff)</span>
                    </div>
                    <div className="flex justify-between items-center text-neutral-600">
                      <span>Calculation</span>
                      <span>{distanceKm} km × ₹24/km × {selectedVehicle.multiplier}</span>
                    </div>
                    <div className="flex justify-between items-center text-neutral-600">
                      <span>Competitor Surging Rate</span>
                      <span className="line-through text-neutral-400">₹{unprotectedFare} (2.2× surge)</span>
                    </div>
                    <div className="pt-2 border-t border-neutral-200 flex justify-between items-baseline">
                      <span className="font-bold text-black text-sm">Protected Total</span>
                      <div className="text-right">
                        <span className="text-xl font-black text-black">₹{standardFare}</span>
                        <div className="text-[11px] text-emerald-600 font-semibold">
                          You save ₹{surgeSavings}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* High-Resolution Unsplash Mobility Showcase */}
                <div className="relative overflow-hidden border border-neutral-200 bg-black group h-48 sm:h-56">
                  <img
                    src="https://images.unsplash.com/photo-1506015391300-4802dc74de2e?auto=format&fit=crop&w=1200&q=80"
                    alt="City ride in modern vehicle"
                    className="w-full h-full object-cover grayscale contrast-125 opacity-75 group-hover:scale-105 group-hover:opacity-90 transition-all duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent p-5 flex flex-col justify-end text-white">
                    <div className="text-[10px] font-sans uppercase tracking-widest text-emerald-400 mb-1 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Contractual Price Lock</span>
                    </div>
                    <h4 className="text-base font-bold tracking-tight">
                      No sudden multiples during peak hours
                    </h4>
                    <p className="text-xs text-neutral-400 font-sans">
                      Real-time supply matching without multiplying rider fares.
                    </p>
                  </div>
                </div>

                {/* Three Core Guarantees in Minimalist Black & White */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-white border border-neutral-200 text-left">
                    <div className="text-xs font-bold text-black mb-1">0% Dynamic Surge</div>
                    <div className="text-[11px] text-neutral-600 font-sans">
                      No 2x or 3x multiplier spikes during rain or high demand.
                    </div>
                  </div>
                  <div className="p-3.5 bg-white border border-neutral-200 text-left">
                    <div className="text-xs font-bold text-black mb-1">24 Rs/KM Base</div>
                    <div className="text-[11px] text-neutral-600 font-sans">
                      Transparent distance billing verified against GPS path.
                    </div>
                  </div>
                  <div className="p-3.5 bg-white border border-neutral-200 text-left">
                    <div className="text-xs font-bold text-black mb-1">Direct Driver Pay</div>
                    <div className="text-[11px] text-neutral-600 font-sans">
                      Fair remuneration without exploitative platform cut.
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </FloatingPathsBackground>

        {/* Protection Explanation Modal */}
        {showProtectionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white border border-black max-w-md w-full p-6 text-black">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Base Surge Protection Guarantee</h3>
                <button
                  onClick={() => setShowProtectionModal(false)}
                  className="p-1 hover:bg-neutral-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-neutral-600 mb-4 font-sans">
                Conventional ride-hailing algorithms artificially multiply prices up to 3.5× during high demand. Base guarantees a transparent ₹24/km tariff with real-time driver allocation.
              </p>
              <div className="p-3 bg-neutral-100 border border-neutral-300 font-sans text-xs mb-4">
                <div>Standard Distance: {distanceKm} km</div>
                <div>Tariff: ₹24 / km</div>
                <div className="font-bold mt-1 text-emerald-700">Effective Surge Multiplier: 1.0× (Frozen)</div>
              </div>
              <button
                onClick={() => setShowProtectionModal(false)}
                className="w-full bg-black text-white py-2.5 font-bold text-xs uppercase tracking-wider"
              >
                Understood
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: PROGRESSIVE STEPS (Choose Ride, Payment, Finding Driver, Driver Assigned, etc.)
  // =========================================================================
  return (
    <div className="h-screen bg-white text-black flex flex-col font-sans overflow-hidden">
      {/* Top Header Bar */}
      <header className="border-b border-neutral-200 bg-black text-white px-6 py-3.5 flex items-center justify-between z-30">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setStep("set-trip")}
            className="flex items-center gap-2 text-xs font-sans uppercase tracking-wider text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Change Trip</span>
          </button>
          <div className="h-4 w-px bg-neutral-800" />
          <span className="font-bold text-lg tracking-tight">Base</span>
          <span className="text-[10px] font-sans uppercase tracking-widest bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 hidden sm:inline-block">
            Price Protected Ride
          </span>
        </div>

        {/* Surge Status Banner */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-sans text-emerald-400 bg-neutral-900 border border-neutral-800 px-3 py-1">
            <span className="w-2 h-2 bg-emerald-400 animate-pulse" />
            <span>Guaranteed ₹24/km (1.0× Locked)</span>
          </div>
          <button
            onClick={() => setShowProtectionModal(true)}
            className="text-xs text-neutral-400 hover:text-white underline underline-offset-4 hidden md:inline-block"
          >
            Why is my price stable?
          </button>
        </div>
      </header>

      {/* Main Content: Split Interactive Map & Progressive Booking Sidebar */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden relative min-h-0">
        
        {/* Left Side: Booking Sidebar Panels */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white border-r border-neutral-200 flex flex-col justify-between overflow-y-auto max-h-[calc(100vh-57px)] z-20">
          
          <div className="p-6">
            {/* SCREEN 2: CHOOSE RIDE & VEHICLE SELECTION */}
            {step === "choose-ride" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold tracking-tight text-black">
                    Available rides
                  </h2>
                  <button
                    onClick={() => setStep("set-trip")}
                    className="text-xs text-neutral-500 hover:text-black underline underline-offset-4 font-sans"
                  >
                    Edit Route
                  </button>
                </div>

                {/* Route Summary Pill */}
                <div className="p-3 bg-neutral-50 border border-neutral-200 mb-4 text-xs font-sans flex items-center justify-between">
                  <span className="truncate max-w-[200px] font-semibold">{destination}</span>
                  <span className="text-neutral-600 font-semibold">{distanceKm} km • {durationMin} min</span>
                </div>

                {/* High Demand Notice Banner */}
                <div className="p-3.5 bg-neutral-900 text-white border border-neutral-800 mb-4 flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <strong className="text-emerald-400 font-semibold block">Fixed Rate Shield Active</strong>
                    <span className="text-neutral-400">
                      Standard ₹24/km applied. Competitors surging at 2.2× waived.
                    </span>
                  </div>
                </div>

                {/* Vehicles List */}
                <div className="space-y-2 mb-6">
                  {VEHICLES.map((v) => {
                    const isSelected = selectedVehicle.id === v.id;
                    const vStdFare = Math.round(baseKmFare * v.multiplier);
                    const vUnprotected = Math.round(vStdFare * v.ordinarySurge);

                    return (
                      <div
                        key={v.id}
                        onClick={() => setSelectedVehicle(v)}
                        className={`p-3.5 border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? "border-black bg-neutral-50 ring-1 ring-black"
                            : "border-neutral-200 hover:border-black"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{v.icon}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-black">{v.name}</span>
                              <span className="text-[11px] text-neutral-500 font-sans">👥 {v.capacity}</span>
                            </div>
                            <div className="text-[11px] text-neutral-500 font-sans">{v.eta}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="flex items-baseline gap-1.5 justify-end">
                            <span className="text-xs line-through text-neutral-400 font-sans">
                              ₹{vUnprotected}
                            </span>
                            <span className="font-bold text-base font-sans text-black">
                              ₹{vStdFare}
                            </span>
                          </div>
                          <span className="text-[10px] font-sans text-emerald-600 font-semibold">
                            Save ₹{vUnprotected - vStdFare}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => setStep("payment")}
                  className="w-full bg-black text-white py-4 font-semibold text-sm uppercase tracking-wider hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Select {selectedVehicle.name} • ₹{standardFare}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* SCREEN 3: FARE BREAKDOWN & PAYMENT */}
            {step === "payment" && (
              <div>
                <button
                  onClick={() => setStep("choose-ride")}
                  className="text-xs font-sans uppercase tracking-wider text-neutral-500 hover:text-black flex items-center gap-1 mb-4"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to rides
                </button>

                <h2 className="text-xl font-bold tracking-tight text-black mb-4">
                  Fare & Payment
                </h2>

                {/* Detailed Fare Breakdown */}
                <div className="border border-neutral-200 p-4 mb-5 bg-neutral-50 text-xs font-sans space-y-2">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Tariff Rate ({selectedVehicle.name})</span>
                    <span>₹24/km × {selectedVehicle.multiplier}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Calculated Distance ({distanceKm} km)</span>
                    <span>₹{standardFare}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Estimated Duration ({durationMin} min)</span>
                    <span>Included</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Surge Protection Subsidy</span>
                    <span>-₹{surgeSavings} (2.2× waived)</span>
                  </div>
                  {promoApplied && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Promo Discount (SAVE50)</span>
                      <span>-₹50</span>
                    </div>
                  )}
                  <div className="border-t border-neutral-200 pt-2 flex justify-between font-bold text-sm text-black">
                    <span>Final Total</span>
                    <span>₹{finalFare}</span>
                  </div>
                </div>

                {/* Promo Code Box */}
                <div className="flex gap-2 mb-6">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Enter promo code (e.g. SAVE50)"
                    className="flex-1 bg-white border border-neutral-300 px-3 py-2 text-xs focus:outline-none focus:border-black uppercase font-sans"
                  />
                  <button
                    onClick={() => {
                      if (promoCode.trim()) setPromoApplied(true);
                    }}
                    className="px-4 py-2 bg-neutral-200 text-xs font-semibold uppercase hover:bg-neutral-300 transition-colors"
                  >
                    Apply
                  </button>
                </div>

                {/* Payment Methods */}
                <div className="mb-6">
                  <span className="text-[11px] font-sans text-neutral-400 uppercase tracking-wider block mb-2">
                    Payment Method
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "upi", label: "UPI / GPay", icon: Smartphone },
                      { id: "cash", label: "Cash on Trip", icon: Banknote },
                      { id: "wallet", label: "Base Wallet", icon: Wallet },
                      { id: "card", label: "Credit Card", icon: CreditCard },
                    ].map((pm) => {
                      const Icon = pm.icon;
                      const active = paymentMethod === pm.id;
                      return (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setPaymentMethod(pm.id as any)}
                          className={`p-3 border text-left flex items-center gap-2 transition-all ${
                            active
                              ? "border-black bg-neutral-100"
                              : "border-neutral-200 hover:border-black"
                          }`}
                        >
                          <Icon className="w-4 h-4 text-neutral-700" />
                          <span className="text-xs font-semibold">{pm.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Confirm Booking CTA */}
                <button
                  onClick={() => setStep("finding-driver")}
                  className="w-full bg-black text-white py-4 font-semibold text-sm uppercase tracking-wider hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Confirm Ride • ₹{finalFare}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* SCREEN 4: FINDING YOUR DRIVER (SEARCHING RADAR) */}
            {step === "finding-driver" && (
              <div className="text-center py-12">
                <div className="relative w-28 h-28 mx-auto mb-6 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-neutral-300 animate-ping opacity-30" />
                  <div className="absolute inset-2 rounded-full border border-black/40 animate-pulse" />
                  <div className="w-14 h-14 bg-black text-white rounded-full flex items-center justify-center shadow-lg">
                    <Navigation className="w-6 h-6 animate-spin text-white" />
                  </div>
                </div>
                <h3 className="text-xl font-bold tracking-tight mb-2">Connecting with driver</h3>
                <p className="text-xs text-neutral-500 font-sans mb-4">
                  Matching with closest verified driver near {pickup}...
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 text-xs font-sans text-emerald-700">
                  <ShieldCheck className="w-4 h-4" /> Locked at ₹{finalFare} (₹24/km guaranteed)
                </div>
              </div>
            )}

            {/* SCREEN 5: DRIVER ASSIGNED & APPROACHING */}
            {step === "driver-assigned" && (
              <div>
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-neutral-200">
                  <div>
                    <span className="text-[11px] font-sans uppercase text-emerald-600 font-semibold block">
                      Driver Arriving in 3 mins
                    </span>
                    <h3 className="text-lg font-bold">White Honda City</h3>
                    <span className="text-xs font-sans text-neutral-500">DL 01 AB 9042</span>
                  </div>
                  <div className="bg-black text-white px-3 py-2 text-center">
                    <div className="text-[10px] font-sans uppercase text-neutral-400">PIN</div>
                    <div className="text-lg font-sans font-bold tracking-wider">{driverOtp}</div>
                  </div>
                </div>

                {/* Driver Profile */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-neutral-200 border border-neutral-400 flex items-center justify-center text-lg font-bold">
                      RK
                    </div>
                    <div>
                      <div className="font-bold text-sm">Rajesh Kumar</div>
                      <div className="flex items-center gap-1 text-xs text-neutral-600 font-sans">
                        <Star className="w-3.5 h-3.5 fill-black text-black" />
                        <span>4.94 (2,410 trips)</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2.5 border border-neutral-300 hover:border-black">
                      <Phone className="w-4 h-4" />
                    </button>
                    <button className="p-2.5 border border-neutral-300 hover:border-black">
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-neutral-50 border border-neutral-200 text-xs font-sans flex justify-between items-center mb-6">
                  <span>Guaranteed Fare</span>
                  <span className="font-bold text-base">₹{finalFare}</span>
                </div>

                <button
                  onClick={() => setStep("trip-in-progress")}
                  className="w-full bg-black text-white py-3.5 font-semibold text-xs uppercase tracking-wider hover:bg-neutral-800 transition-colors"
                >
                  Simulate Trip Start
                </button>
              </div>
            )}

            {/* SCREEN 6: TRIP IN PROGRESS */}
            {step === "trip-in-progress" && (
              <div>
                <div className="mb-6">
                  <span className="text-[11px] font-sans uppercase text-emerald-600 font-semibold block">
                    Trip in Progress • On Time
                  </span>
                  <h3 className="text-2xl font-bold tracking-tight">
                    {etaRemaining} mins to arrival
                  </h3>
                  <p className="text-xs text-neutral-500 font-sans mt-1">
                    Dropping at: {destination}
                  </p>
                </div>

                <div className="p-4 bg-neutral-50 border border-neutral-200 mb-6 text-xs font-sans space-y-2">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Route Distance</span>
                    <span>{distanceKm} km</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Speed</span>
                    <span>38 km/h</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Protected Price</span>
                    <span>₹{finalFare}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="flex-1 border border-neutral-300 py-3 text-xs font-semibold uppercase flex items-center justify-center gap-1.5 hover:border-black">
                    <Share2 className="w-3.5 h-3.5" /> Share Trip
                  </button>
                  <button
                    onClick={() => setStep("receipt")}
                    className="flex-1 bg-black text-white py-3 text-xs font-semibold uppercase hover:bg-neutral-800"
                  >
                    Finish Ride
                  </button>
                </div>
              </div>
            )}

            {/* SCREEN 7: RECEIPT & RATING */}
            {step === "receipt" && (
              <div>
                <div className="text-center mb-6">
                  <CheckCircle2 className="w-12 h-12 text-black mx-auto mb-2" />
                  <h2 className="text-2xl font-bold tracking-tight">You've Arrived</h2>
                  <p className="text-xs text-neutral-500 font-sans">
                    Hope you enjoyed your surge-protected ride.
                  </p>
                </div>

                <div className="border border-neutral-200 p-4 mb-6 bg-neutral-50 text-xs font-sans space-y-2">
                  <div className="flex justify-between font-bold text-sm pb-2 border-b border-neutral-200">
                    <span>Total Paid</span>
                    <span>₹{finalFare + tip}</span>
                  </div>
                  <div className="flex justify-between text-neutral-500">
                    <span>Base Ride ({distanceKm} km @ ₹24/km)</span>
                    <span>₹{finalFare}</span>
                  </div>
                  <div className="flex justify-between text-neutral-500">
                    <span>Driver Tip</span>
                    <span>₹{tip}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-semibold pt-1">
                    <span>Surge Protection Savings</span>
                    <span>₹{surgeSavings}</span>
                  </div>
                </div>

                {/* Rating */}
                <div className="mb-6 text-center">
                  <span className="text-xs font-sans text-neutral-500 uppercase tracking-wider block mb-2">
                    Rate Rajesh Kumar
                  </span>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= rating ? "fill-black text-black" : "text-neutral-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setStep("set-trip");
                    onBackToLanding();
                  }}
                  className="w-full bg-black text-white py-4 font-semibold text-xs uppercase tracking-wider hover:bg-neutral-800 transition-colors"
                >
                  Book Another Ride
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Leaflet Interactive Route Map */}
        <div className="lg:col-span-7 xl:col-span-8 h-full w-full relative bg-neutral-100">
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Floating Route Info Badge */}
          <div className="absolute top-4 left-4 z-20 bg-white border border-neutral-200 p-3 shadow-md max-w-xs text-xs font-sans">
            <div className="font-bold text-black">{distanceKm} km route mapped</div>
            <div className="text-neutral-500">₹24/km tariff guaranteed by Base</div>
          </div>
        </div>

      </div>

      {/* Modal */}
      {showProtectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-black max-w-md w-full p-6 text-black">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Base Surge Protection Guarantee</h3>
              <button
                onClick={() => setShowProtectionModal(false)}
                className="p-1 hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-neutral-600 mb-4 font-sans">
              Conventional ride-hailing algorithms artificially multiply prices up to 3.5× during high demand. Base guarantees a transparent ₹24/km tariff with real-time driver allocation.
            </p>
            <div className="p-3 bg-neutral-100 border border-neutral-300 font-sans text-xs mb-4">
              <div>Standard Distance: {distanceKm} km</div>
              <div>Tariff: ₹24 / km</div>
              <div className="font-bold mt-1 text-emerald-700">Effective Surge Multiplier: 1.0× (Frozen)</div>
            </div>
            <button
              onClick={() => setShowProtectionModal(false)}
              className="w-full bg-black text-white py-2.5 font-bold text-xs uppercase tracking-wider"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
