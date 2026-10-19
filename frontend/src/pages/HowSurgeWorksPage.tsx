"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useReducedMotion } from "motion/react";
import {
  ShieldCheck,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Crosshair,
  Terminal,
  Calculator,
  MapPin,
} from "lucide-react";
import { GatewayTransition } from "@/components/ui/gateway-transition";
import { BaseNavbar } from "@/components/ui/BaseNavbar";
import {
  SurgeNetworkCanvas,
  DriverNodeData,
} from "@/components/how-surge-works/SurgeNetworkCanvas";
import { cn } from "@/lib/utils";

export interface HowSurgeWorksPageProps {
  onNavigateToRide?: () => void;
  onNavigateToDrive?: () => void;
  onNavigateToAbout?: () => void;
  onNavigateToFeedback?: () => void;
  onNavigateToLanding?: () => void;
}

export function HowSurgeWorksPage({
  onNavigateToRide,
  onNavigateToDrive,
  onNavigateToAbout,
  onNavigateToFeedback,
  onNavigateToLanding,
}: HowSurgeWorksPageProps) {
  const shouldReduceMotion = useReducedMotion();

  // Gateway Transition State
  const [showGateway, setShowGateway] = useState(true);

  // Simulation State Machine
  // 0: Normal conditions (400 online, ₹180)
  // 1: Sudden drop (50 online, ₹480 proposed)
  // 2: Anomaly detection running (scanning beam)
  // 3: Fare protection outcome illustrated (₹180 protected)
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0);
  const [driverCount, setDriverCount] = useState<number>(400);
  const [isAnimatingCount, setIsAnimatingCount] = useState<boolean>(false);
  const [selectedDriver, setSelectedDriver] = useState<DriverNodeData | null>(null);

  // Live Backend State
  const [backendStatus, setBackendStatus] = useState<"checking" | "connected" | "offline">("checking");
  const [backendFeedback, setBackendFeedback] = useState<string | null>(null);

  const animCancelRef = useRef<boolean>(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check live backend connectivity on mount
  useEffect(() => {
    let mounted = true;
    fetch("/api/operator/audit_log?limit=1")
      .then((res) => {
        if (mounted) {
          if (res.ok) setBackendStatus("connected");
          else setBackendStatus("offline");
        }
      })
      .catch(() => {
        if (mounted) setBackendStatus("offline");
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      animCancelRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Smoothly animate driver count
  const animateCountTo = useCallback(
    (target: number, duration: number = 1400, onDone?: () => void) => {
      animCancelRef.current = false;
      setIsAnimatingCount(true);
      const startCount = driverCount;
      const startTime = performance.now();

      if (shouldReduceMotion) {
        setDriverCount(target);
        setIsAnimatingCount(false);
        onDone?.();
        return;
      }

      function tick(now: number) {
        if (animCancelRef.current) {
          setIsAnimatingCount(false);
          return;
        }

        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        // Cubic ease-out
        const ease = 1 - Math.pow(1 - progress, 3);
        const currentVal = Math.round(startCount + (target - startCount) * ease);

        setDriverCount(currentVal);

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          setDriverCount(target);
          setIsAnimatingCount(false);
          onDone?.();
        }
      }

      requestAnimationFrame(tick);
    },
    [driverCount, shouldReduceMotion]
  );

  // Action 1: Simulate Driver Shortage
  const handleSimulateShortage = () => {
    if (phase !== 0 || isAnimatingCount) return;
    setPhase(1);
    animateCountTo(50, 1450);
  };

  // Action 2: Run Anomaly Detection
  const handleRunAnomalyDetection = () => {
    if (phase !== 1 || isAnimatingCount) return;
    setPhase(2);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const delay = shouldReduceMotion ? 200 : 2200;
    timeoutRef.current = setTimeout(() => {
      setPhase(3);
    }, delay);
  };

  // Action 3: Reset Simulation
  const handleResetSimulation = () => {
    animCancelRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsAnimatingCount(false);
    setPhase(0);
    setDriverCount(400);
    setBackendFeedback(null);
  };

  // Optional: Trigger live backend operator attack simulation
  const handleTriggerBackendAttack = async () => {
    try {
      setBackendFeedback("Sending trigger to live backend ProtectionEngine...");
      const res = await fetch("/api/operator/simulate_attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setBackendFeedback(
          `Live backend window opened! Dropped ${data.dropped_drivers} drivers, injected ${data.requests_created} requests into Zone BKC.`
        );
        handleSimulateShortage();
      } else {
        setBackendFeedback("Backend responded with error: " + res.status);
      }
    } catch {
      setBackendFeedback("Could not connect to live backend. Operating in simulated offline mode.");
    }
  };

  const getStatusLabel = () => {
    switch (phase) {
      case 0:
        return "Network stable";
      case 1:
        return "Availability anomaly";
      case 2:
        return "Anomaly flagged";
      case 3:
        return "Fare protection demo";
    }
  };

  const getProposedFare = () => {
    return phase === 1 ? "₹480" : "₹180";
  };

  return (
    <div className="min-h-screen bg-white text-[#080808] font-sans antialiased selection:bg-[#080808] selection:text-white pb-24">
      {/* =========================================================================
          Phase 3 Gateway Flow & Decryption Overlay
          ========================================================================= */}
      {showGateway && (
        <GatewayTransition
          active={showGateway}
          onComplete={() => setShowGateway(false)}
        />
      )}

      {/* =========================================================================
          Top Shared BASE Navigation (Animated Sliding-Pill BaseNavbar)
          ========================================================================= */}
      <BaseNavbar
        variant="light"
        activeRoute="how-surge-works"
        onNavigate={(dest) => {
          if (dest === "landing") {
            if (onNavigateToLanding) onNavigateToLanding();
            else {
              window.history.pushState({}, "", "/");
              window.dispatchEvent(new PopStateEvent("popstate"));
            }
            return;
          }
          if (dest === "rider" && onNavigateToRide) {
            onNavigateToRide();
            return;
          }
          if (dest === "drive" && onNavigateToDrive) {
            onNavigateToDrive();
            return;
          }
          if (dest === "about" && onNavigateToAbout) {
            onNavigateToAbout();
            return;
          }
          if (dest === "feedback" && onNavigateToFeedback) {
            onNavigateToFeedback();
            return;
          }
          const path = `/${dest}`;
          window.history.pushState({}, "", path);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }}
      />

      {/* =========================================================================
          Main Editorial Content
          ========================================================================= */}
      <main className="max-w-7xl mx-auto px-6 py-8 md:py-12">
        {/* =========================================================================
            Section 1: Hero Section (Clean Editorial Typography - No Boxed Text)
            ========================================================================= */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center pb-14 border-b border-neutral-200">
          <div className="lg:col-span-6">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-sans font-bold uppercase tracking-[0.16em] text-neutral-700 mb-4">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>BASE / SURGE PROTECTION</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-950 leading-[1.04] mb-5 font-sans">
              What if the shortage <br className="hidden sm:inline" />
              isn't real?
            </h1>

            <p className="text-lg sm:text-xl text-neutral-600 leading-relaxed font-normal mb-8 max-w-xl font-sans">
              When driver availability suddenly drops, prices can climb. Explore
              how BASE flags artificial availability anomalies before an unsupported
              multiplier is applied to Mumbai riders.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <a
                href="#simulation"
                className="inline-flex items-center justify-center gap-2.5 px-7 py-4 bg-[#080808] text-white font-sans font-bold text-sm tracking-[0.14em] uppercase hover:bg-neutral-800 transition-all cursor-pointer shadow-xs"
              >
                <span>Explore the simulation</span>
                <ArrowRight size={16} />
              </a>

              <span className="font-sans text-xs sm:text-[13px] font-bold text-neutral-500 uppercase tracking-widest">
                SCENARIO 001 · BOM AIRPORT ZONE
              </span>
            </div>
          </div>

          {/* Hero Visual Panel */}
          <div className="lg:col-span-6">
            <div className="relative h-[260px] sm:h-[280px] bg-[#0c0f0d] border border-neutral-800 overflow-hidden shadow-sm">
              <SurgeNetworkCanvas
                driverCount={driverCount}
                phase={phase}
                isHero={true}
              />

              <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between pointer-events-none">
                <div>
                  <div className="font-sans text-[10px] font-semibold text-neutral-400 tracking-[0.12em] uppercase mb-0.5">
                    MUMBAI AIRPORT / ZONE A
                  </div>
                  <div className="text-white text-sm font-semibold flex items-center gap-2 font-sans uppercase tracking-wide">
                    <span
                      className={cn(
                        "inline-block h-2 w-2 rounded-full",
                        phase === 1 ? "bg-amber-400 animate-pulse" : "bg-[#36c78a]"
                      )}
                    />
                    {getStatusLabel()}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[9px] text-neutral-400 tracking-wider uppercase font-sans font-semibold">
                    PROPOSED FARE
                  </div>
                  <div className="text-white text-lg font-bold font-sans">
                    {getProposedFare()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            Section 2: Unified Interactive Driver Network Simulation
            (Clean Editorial Typography - No Clunky Boxes Behind Text!)
            ========================================================================= */}
        <section id="simulation" className="pt-10 pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 8-Columns: Interactive Radar Simulation Console */}
            <div className="lg:col-span-8 border border-neutral-200 bg-white shadow-sm">
              {/* Sleek Integrated Telemetry Strip (NO clunky boxed backgrounds) */}
              <div className="p-4 sm:p-5 border-b border-neutral-200 bg-neutral-50/60 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full shrink-0",
                      phase === 1
                        ? "bg-rose-500 animate-pulse"
                        : phase === 2
                        ? "bg-amber-400 animate-ping"
                        : "bg-[#36c78a]"
                    )}
                  />
                  <div>
                    <span className="font-sans font-bold text-sm uppercase tracking-wide text-black block leading-none">
                      {getStatusLabel()}
                    </span>
                    <span className="text-neutral-500 font-sans text-[10px] font-medium tracking-wider mt-0.5 block uppercase">
                      MUMBAI AIRPORT · ZONE A
                    </span>
                  </div>
                </div>

                {/* Clean Editorial Metrics (hairline dividers, zero clunky box backgrounds) */}
                <div className="flex items-center gap-5 text-sm font-sans">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] uppercase font-sans font-semibold text-neutral-400 tracking-wider">Drivers:</span>
                    <strong className="font-sans font-bold text-base text-neutral-900 leading-none">
                      {driverCount}
                    </strong>
                    <span className="text-[10px] text-neutral-400 font-sans">/ 400</span>
                  </div>

                  <div className="h-3.5 w-px bg-neutral-300" />

                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] uppercase font-sans font-semibold text-neutral-400 tracking-wider">Demand:</span>
                    <strong className="font-sans font-bold text-base text-neutral-900 leading-none">
                      1.0×
                    </strong>
                  </div>

                  <div className="h-3.5 w-px bg-neutral-300" />

                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] uppercase font-sans font-semibold text-neutral-400 tracking-wider">Fare:</span>
                    <strong
                      className={cn(
                        "font-sans font-bold text-base leading-none transition-colors",
                        phase === 1 ? "text-amber-700" : phase === 3 ? "text-emerald-700" : "text-neutral-900"
                      )}
                    >
                      {getProposedFare()}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Clickable Radar Map Canvas */}
              <div className="relative h-[360px] sm:h-[420px] bg-[#0c0f0d] overflow-hidden">
                <SurgeNetworkCanvas
                  driverCount={driverCount}
                  phase={phase}
                  isHero={false}
                  selectedDriver={selectedDriver}
                  onSelectDriver={(drv) => setSelectedDriver(drv)}
                />

                {/* Corner Radar Prompt */}
                <div className="absolute bottom-3 right-3 z-10 pointer-events-none bg-black/80 border border-neutral-700 px-3 py-1.5 text-[10px] font-sans text-neutral-200 flex items-center gap-2">
                  <Crosshair size={11} className="text-emerald-400" />
                  <span>CLICK RADAR MAP TO INSPECT ANY DRIVER</span>
                </div>
              </div>

              {/* Clean Integrated Action Deck (All buttons use Headline Font Hanken Grotesk) */}
              <div className="p-4 sm:p-5 bg-white border-t border-neutral-200">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  {/* Action Buttons with Hanken Grotesk */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSimulateShortage}
                      disabled={phase !== 0 || isAnimatingCount}
                      className="px-5 py-3 bg-[#080808] text-white font-sans font-semibold text-xs tracking-[0.12em] uppercase hover:bg-neutral-800 disabled:opacity-35 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
                    >
                      Simulate driver shortage ↗
                    </button>

                    <button
                      type="button"
                      onClick={handleRunAnomalyDetection}
                      disabled={phase !== 1 || isAnimatingCount}
                      className="px-5 py-3 bg-white border border-neutral-300 text-neutral-900 font-sans font-semibold text-xs tracking-[0.12em] uppercase hover:border-black disabled:opacity-35 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                    >
                      Run anomaly detection
                    </button>

                    <button
                      type="button"
                      onClick={handleResetSimulation}
                      className="px-4 py-3 bg-white border border-neutral-300 text-neutral-700 font-sans font-semibold text-xs tracking-[0.1em] uppercase hover:text-black hover:border-black transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      title="Reset 400 drivers, ₹180 fare and buttons"
                    >
                      <RotateCcw size={13} />
                      Reset
                    </button>
                  </div>

                  {/* Clean Editorial Timeline (Zero Box Backgrounds) */}
                  <div className="flex items-center gap-2 sm:gap-3 text-xs font-sans font-semibold uppercase tracking-wider">
                    <span
                      className={cn(
                        "transition-colors pb-1 border-b-2",
                        phase === 0 ? "text-black border-black" : "text-neutral-400 border-transparent hover:text-neutral-700"
                      )}
                    >
                      01. Normal
                    </span>
                    <span className="text-neutral-300 select-none">/</span>
                    <span
                      className={cn(
                        "transition-colors pb-1 border-b-2",
                        phase === 1 ? "text-rose-600 border-rose-600" : "text-neutral-400 border-transparent hover:text-neutral-700"
                      )}
                    >
                      02. Shortage
                    </span>
                    <span className="text-neutral-300 select-none">/</span>
                    <span
                      className={cn(
                        "transition-colors pb-1 border-b-2",
                        phase === 2 ? "text-amber-600 border-amber-600" : "text-neutral-400 border-transparent hover:text-neutral-700"
                      )}
                    >
                      03. Scan
                    </span>
                    <span className="text-neutral-300 select-none">/</span>
                    <span
                      className={cn(
                        "transition-colors pb-1 border-b-2",
                        phase === 3 ? "text-emerald-700 border-emerald-600" : "text-neutral-400 border-transparent hover:text-neutral-700"
                      )}
                    >
                      04. Protected
                    </span>
                  </div>
                </div>

                {/* Inline Simulation Result Banner (Clean Editorial, No Clunky Boxes) */}
                {phase >= 2 && (
                  <div
                    className={cn(
                      "p-4 border transition-all animate-in fade-in duration-200 mt-2",
                      phase === 2
                        ? "border-amber-300 bg-amber-50/50"
                        : "border-emerald-300 bg-emerald-50/50"
                    )}
                    role="status"
                    aria-live="polite"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5 font-sans text-xs font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        {phase === 2 ? (
                          <>
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <span className="text-amber-900">
                              ANOMALY FLAGGED · DEMO EVALUATION
                            </span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span className="text-emerald-900">
                              SURGE SHIELD APPLIED · POLICY VERIFIED
                            </span>
                          </>
                        )}
                      </div>

                      {phase === 3 && (
                        <span className="text-[11px] font-sans font-semibold text-emerald-700 uppercase tracking-wider">
                          • RIDER SHIELDED
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-neutral-700 leading-relaxed font-sans">
                      {phase === 2
                        ? "Supply collapse of -87.5% (400 → 50) detected while passenger demand stayed steady. Anomaly signal flagged for pricing policy evaluation."
                        : "For this demonstration, the unsupported ₹480 price spike is rejected. The protected rate of ₹180 applies, shielding the rider from a ₹300 unverified surge."}
                    </p>

                    {/* Fare Calculation Comparison Strip (Hairline dividers, no heavy boxes) */}
                    {phase === 3 && (
                      <div className="mt-3 pt-3 border-t border-emerald-200 grid grid-cols-3 gap-3 font-sans text-center divide-x divide-emerald-200">
                        <div className="px-2">
                          <span className="text-[10px] uppercase text-neutral-500 block font-sans font-semibold tracking-wider">Legacy Platform Surge</span>
                          <span className="text-base font-bold text-rose-700 line-through">₹480</span>
                        </div>
                        <div className="px-2">
                          <span className="text-[10px] uppercase text-emerald-800 block font-sans font-semibold tracking-wider">BASE Protected Fare</span>
                          <span className="text-base font-bold text-emerald-900">₹180</span>
                        </div>
                        <div className="px-2">
                          <span className="text-[10px] uppercase text-neutral-500 block font-sans font-semibold tracking-wider">Rider Saved</span>
                          <span className="text-base font-bold text-neutral-900">₹300</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right 4-Columns: Clicked Driver Telemetry Inspector + How BASE Investigates */}
            <div className="lg:col-span-4 space-y-6">
              {/* Clicked Driver Inspection Card (Interactive Telemetry - Clean Editorial) */}
              <div className="border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                  <div className="flex items-center gap-1.5 font-sans font-semibold text-xs uppercase tracking-wider text-neutral-700">
                    <Navigation size={13} className="text-emerald-600" />
                    <span>DRIVER TELEMETRY INSPECTOR</span>
                  </div>
                  <span className="text-[10px] font-sans font-semibold tracking-wider text-neutral-400 uppercase">
                    LIVE RADAR
                  </span>
                </div>

                {selectedDriver ? (
                  <div className="pt-4 font-sans text-xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                      <div>
                        <span className="text-[10px] font-sans font-semibold text-neutral-400 block uppercase tracking-wider">Driver</span>
                        <strong className="text-sm font-bold text-black font-sans">{selectedDriver.name}</strong>
                        <span className="text-[10px] font-sans text-neutral-500 block">{selectedDriver.id}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-sans font-semibold text-neutral-400 block uppercase tracking-wider">Rating</span>
                        <span className="text-emerald-700 font-sans font-bold text-xs tracking-wide">
                          {selectedDriver.rating}
                        </span>
                      </div>
                    </div>

                    <div className="py-2 border-b border-neutral-100 space-y-0.5">
                      <span className="text-[10px] font-sans uppercase font-semibold text-neutral-400 block tracking-wider">Vehicle</span>
                      <div className="font-semibold text-neutral-900 text-xs">{selectedDriver.vehicle}</div>
                    </div>

                    <div className="py-2 border-b border-neutral-100 space-y-1">
                      <span className="text-[10px] font-sans uppercase font-semibold text-neutral-400 block tracking-wider">Verified GPS Location</span>
                      <div className="font-semibold text-neutral-900 text-xs flex items-start gap-1.5">
                        <MapPin size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                        <span>{selectedDriver.locationName}</span>
                      </div>
                      <div className="text-[10px] font-sans text-neutral-500 pt-0.5 flex justify-between">
                        <span>{selectedDriver.lat}°N, {selectedDriver.lng}°E</span>
                        <span className="font-semibold text-neutral-800">{selectedDriver.distToTerminalMeters}m to T2</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-1">
                      <span className="text-neutral-500 font-sans">Heartbeat: {selectedDriver.heartbeatSec}s ago</span>
                      <span className="text-emerald-700 font-sans font-semibold uppercase tracking-wider">• GPS Lock Active</span>
                    </div>
                  </div>
                ) : (
                  <div className="pt-5 pb-3 text-center">
                    <div className="h-10 w-10 mx-auto mb-2 rounded-full border border-dashed border-neutral-300 flex items-center justify-center text-neutral-400">
                      <Crosshair size={18} />
                    </div>
                    <strong className="text-xs font-semibold text-neutral-800 block mb-1 font-sans">
                      No Driver Selected
                    </strong>
                    <p className="text-[11px] text-neutral-500 leading-relaxed max-w-xs mx-auto mb-3 font-sans">
                      Click any point on the airport radar map to inspect their vehicle, location, and distance.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const demo = {
                          id: "driver_1001",
                          name: "Aarav Sharma",
                          phone: "+91 98201 11001",
                          vehicle: "Standard Sedan · Dzire (MH-02-EE-4921)",
                          vehicleType: "sedan" as const,
                          locationName: "Terminal 2 Departures Flyover (P4 Level)",
                          lat: 19.0886,
                          lng: 72.8679,
                          distToTerminalMeters: 280,
                          rating: "4.94 ★",
                          status: "online" as const,
                          heartbeatSec: 0.8,
                          nodeIndex: 0,
                        };
                        setSelectedDriver(demo);
                      }}
                      className="px-3.5 py-2 border border-neutral-300 font-sans font-semibold text-xs uppercase tracking-wider text-neutral-800 hover:border-black cursor-pointer transition-colors"
                    >
                      Inspect Sample Driver
                    </button>
                  </div>
                )}
              </div>

              {/* How BASE Investigates (Phase 7) */}
              <div className="border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="font-sans text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.14em] mb-2">
                  HOW BASE INVESTIGATES
                </div>
                <h3 className="text-xl font-medium tracking-tight text-black mb-4 leading-tight font-sans">
                  Real signals. <br />
                  Smarter decisions.
                </h3>

                <div className="space-y-4 text-xs font-sans">
                  <div className="pt-3 border-t border-neutral-100">
                    <h4 className="font-sans text-[11px] uppercase font-bold text-neutral-900 mb-0.5 tracking-wider">
                      01 / Multi-Signal Verification
                    </h4>
                    <p className="text-neutral-600 leading-relaxed text-[11px]">
                      Cross-references driver availability velocity against actual flight arrivals, ambient demand, and weather patterns.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-neutral-100">
                    <h4 className="font-sans text-[11px] uppercase font-bold text-neutral-900 mb-0.5 tracking-wider">
                      02 / Anomaly Trigger
                    </h4>
                    <p className="text-neutral-600 leading-relaxed text-[11px]">
                      A sudden supply drop while passenger requests stay normal is flagged as a review signal before applying price multipliers.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-neutral-100">
                    <h4 className="font-sans text-[11px] uppercase font-bold text-neutral-900 mb-0.5 tracking-wider">
                      03 / Reference Rate Freezing
                    </h4>
                    <p className="text-neutral-600 leading-relaxed text-[11px]">
                      If the supply drop is unsupported, fares remain protected at the 1.0x baseline reference tariff.
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-neutral-200">
                  <button
                    type="button"
                    onClick={onNavigateToRide}
                    className="w-full py-3 bg-black text-white font-sans font-semibold text-xs uppercase tracking-[0.12em] hover:bg-neutral-800 transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Book with Surge Guard</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            Section 2B: Filling the Space Beneath the Simulation
            (Telemetry Audit Log + Itemized Tariff Ledger + Zone Network Heatmap)
            ========================================================================= */}
        <section className="pt-4 pb-14 border-t border-neutral-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-8">
            {/* Live Algorithm Audit Decision Stream */}
            <div className="lg:col-span-6 border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-neutral-700" />
                  <span className="font-sans font-bold text-xs uppercase tracking-wider text-black">
                    Live Algorithmic Decision Log
                  </span>
                </div>
                <span className="font-sans font-semibold text-[10px] tracking-widest text-neutral-400 uppercase">
                  AUDIT TRAIL
                </span>
              </div>

              <div className="space-y-3 font-sans text-xs">
                <div className="p-3 bg-neutral-50 border-l-2 border-neutral-400">
                  <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5 font-sans font-semibold">
                    <span>EVENT #001 · CLUSTER_STABLE</span>
                    <span>16:50:10 IST</span>
                  </div>
                  <p className="text-neutral-800 text-[11px] leading-snug">
                    400 driver telemetry beacons active across Sahar & Western Express Highway corridor. Demand factor: 1.0×.
                  </p>
                </div>

                <div
                  className={cn(
                    "p-3 border-l-2 transition-all",
                    phase >= 1
                      ? "bg-rose-50/70 border-rose-500 text-rose-950"
                      : "bg-neutral-50/50 border-neutral-200 opacity-40 text-neutral-400"
                  )}
                >
                  <div className="flex justify-between text-[10px] mb-0.5 font-sans font-semibold">
                    <span className="font-bold">EVENT #002 · COLLAPSE_TRIGGER</span>
                    <span>16:51:14 IST</span>
                  </div>
                  <p className="text-[11px] leading-snug">
                    Availability velocity dropped -87.5% (400 → 50 drivers in 180s). Unverified price surge of ₹480 proposed by legacy dispatch logic.
                  </p>
                </div>

                <div
                  className={cn(
                    "p-3 border-l-2 transition-all",
                    phase >= 2
                      ? "bg-amber-50/70 border-amber-500 text-amber-950"
                      : "bg-neutral-50/50 border-neutral-200 opacity-40 text-neutral-400"
                  )}
                >
                  <div className="flex justify-between text-[10px] mb-0.5 font-sans font-semibold">
                    <span className="font-bold">EVENT #003 · SIGNAL_VERIFICATION</span>
                    <span>16:51:16 IST</span>
                  </div>
                  <p className="text-[11px] leading-snug">
                    Cross-verification executed: CSMIA flight schedules on-time, zero weather obstruction, booking volume flat at 1.0× baseline. Anomaly verified.
                  </p>
                </div>

                <div
                  className={cn(
                    "p-3 border-l-2 transition-all",
                    phase >= 3
                      ? "bg-emerald-50/80 border-emerald-600 text-emerald-950"
                      : "bg-neutral-50/50 border-neutral-200 opacity-40 text-neutral-400"
                  )}
                >
                  <div className="flex justify-between text-[10px] mb-0.5 font-sans font-semibold">
                    <span className="font-bold">EVENT #004 · FARE_SHIELD_LOCKED</span>
                    <span>16:51:18 IST</span>
                  </div>
                  <p className="text-[11px] leading-snug">
                    Surge ceiling locked at 1.0× reference tariff. Artificial price spike of ₹300.00 suppressed. Rider billed protected fare of ₹180.00.
                  </p>
                </div>
              </div>
            </div>

            {/* Itemized Fare Protection Breakdown Ledger */}
            <div className="lg:col-span-6 border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
                <div className="flex items-center gap-2">
                  <Calculator size={14} className="text-neutral-700" />
                  <span className="font-sans font-bold text-xs uppercase tracking-wider text-black">
                    Transparent Tariff Breakdown
                  </span>
                </div>
                <span className="font-sans font-semibold text-[10px] tracking-widest text-neutral-400 uppercase">
                  MUMBAI AIRPORT ROUTE
                </span>
              </div>

              <div className="space-y-2.5 text-xs font-sans">
                <div className="flex justify-between py-1 border-b border-neutral-100">
                  <span className="text-neutral-600">Base Dispatch Tariff</span>
                  <span className="font-sans font-semibold text-neutral-900">₹50.00</span>
                </div>

                <div className="flex justify-between py-1 border-b border-neutral-100">
                  <span className="text-neutral-600">Road Distance (5.62 km @ ₹15.00/km)</span>
                  <span className="font-sans font-semibold text-neutral-900">₹84.30</span>
                </div>

                <div className="flex justify-between py-1 border-b border-neutral-100">
                  <span className="text-neutral-600">Trip Duration (18.3 min @ ₹2.50/min)</span>
                  <span className="font-sans font-semibold text-neutral-900">₹45.75</span>
                </div>

                <div className="flex justify-between py-1 border-b border-neutral-100">
                  <span className="text-neutral-600">Airport Terminal Facility Fee</span>
                  <span className="font-sans font-semibold text-neutral-900">₹20.00</span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-neutral-200 text-neutral-500 font-sans text-[11px]">
                  <span>Ordinary Legacy Surge Attempt (2.67×)</span>
                  <span className={cn(phase === 1 ? "text-rose-700 font-bold" : "line-through")}>
                    +₹300.00
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-neutral-200 text-emerald-800 font-sans text-[11px]">
                  <span>BASE Surge Shield Multiplier Offset</span>
                  <span className="font-bold">-₹300.00</span>
                </div>

                <div className="flex justify-between pt-2 text-sm font-bold text-black items-center">
                  <span className="font-sans uppercase tracking-wider">FINAL PROTECTED FARE</span>
                  <span className="font-sans font-bold text-xl text-emerald-800">
                    {phase === 1 ? "₹480.00 (Proposed)" : "₹180.00 (Protected)"}
                  </span>
                </div>

                <p className="text-[10px] font-sans text-neutral-400 pt-2 leading-relaxed">
                  * Factual calculation based on Mumbai Airport T2 corridor. Under BASE policy, riders never pay unverified surge pricing.
                </p>
              </div>
            </div>
          </div>

          {/* Mumbai Airport Mobility Corridor Telemetry Matrix (Fills space beneath simulation completely!) */}
          <div className="border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutral-100 mb-5">
              <div>
                <span className="font-sans font-bold text-[13.5px] uppercase tracking-wider text-black block">
                  Mumbai Airport Zone A · Corridor Health Matrix
                </span>
                <span className="font-sans text-[12.5px] text-neutral-500">
                  Real-time beacon telemetry across Chhatrapati Shivaji Maharaj International Airport (CSMIA)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-sans text-[12.5px] font-semibold uppercase tracking-wider text-neutral-700">
                  All 4 Corridors Protected
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans text-xs">
              {/* Corridor 1 */}
              <div className="p-4 border border-neutral-100 bg-neutral-50/50">
                <div className="flex justify-between items-center text-[11.5px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  <span>CORRIDOR 01</span>
                  <span className="text-emerald-700">STABLE</span>
                </div>
                <div className="font-bold text-[15.5px] text-black mb-1">T2 International Departures</div>
                <div className="text-neutral-500 text-[12.5px] mb-2.5">Elevated P4 Dropoff Ramp</div>
                <div className="flex justify-between text-[12.5px] pt-2 border-t border-neutral-200">
                  <span className="text-neutral-500">Active Supply:</span>
                  <span className="font-bold text-black">{phase === 1 ? "18 Drivers" : "140 Drivers"}</span>
                </div>
                <div className="flex justify-between text-[12.5px] pt-1">
                  <span className="text-neutral-500">Protection:</span>
                  <span className="font-bold text-emerald-700">1.0× Reference</span>
                </div>
              </div>

              {/* Corridor 2 */}
              <div className="p-4 border border-neutral-100 bg-neutral-50/50">
                <div className="flex justify-between items-center text-[11.5px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  <span>CORRIDOR 02</span>
                  <span className="text-emerald-700">STABLE</span>
                </div>
                <div className="font-bold text-[15.5px] text-black mb-1">T1 Domestic Terminal</div>
                <div className="text-neutral-500 text-[12.5px] mb-2.5">Santacruz Domestic Forecourt</div>
                <div className="flex justify-between text-[12.5px] pt-2 border-t border-neutral-200">
                  <span className="text-neutral-500">Active Supply:</span>
                  <span className="font-bold text-black">{phase === 1 ? "14 Drivers" : "110 Drivers"}</span>
                </div>
                <div className="flex justify-between text-[12.5px] pt-1">
                  <span className="text-neutral-500">Protection:</span>
                  <span className="font-bold text-emerald-700">1.0× Reference</span>
                </div>
              </div>

              {/* Corridor 3 */}
              <div className="p-4 border border-neutral-100 bg-neutral-50/50">
                <div className="flex justify-between items-center text-[11.5px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  <span>CORRIDOR 03</span>
                  <span className="text-emerald-700">STABLE</span>
                </div>
                <div className="font-bold text-[15.5px] text-black mb-1">Western Express Highway</div>
                <div className="text-neutral-500 text-[12.5px] mb-2.5">Sahar Elevated Access Flyover</div>
                <div className="flex justify-between text-[12.5px] pt-2 border-t border-neutral-200">
                  <span className="text-neutral-500">Active Supply:</span>
                  <span className="font-bold text-black">{phase === 1 ? "12 Drivers" : "95 Drivers"}</span>
                </div>
                <div className="flex justify-between text-[12.5px] pt-1">
                  <span className="text-neutral-500">Protection:</span>
                  <span className="font-bold text-emerald-700">1.0× Reference</span>
                </div>
              </div>

              {/* Corridor 4 */}
              <div className="p-4 border border-neutral-100 bg-neutral-50/50">
                <div className="flex justify-between items-center text-[11.5px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  <span>CORRIDOR 04</span>
                  <span className="text-emerald-700">STABLE</span>
                </div>
                <div className="font-bold text-[15.5px] text-black mb-1">Cargo & Transit Ring</div>
                <div className="text-neutral-500 text-[12.5px] mb-2.5">Air Cargo Complex / Marol Hub</div>
                <div className="flex justify-between text-[12.5px] pt-2 border-t border-neutral-200">
                  <span className="text-neutral-500">Active Supply:</span>
                  <span className="font-bold text-black">{phase === 1 ? "6 Drivers" : "55 Drivers"}</span>
                </div>
                <div className="flex justify-between text-[12.5px] pt-1">
                  <span className="text-neutral-500">Protection:</span>
                  <span className="font-bold text-emerald-700">1.0× Reference</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            Section 3: Traditional Dynamic Surge vs BASE Protected Architecture
            ========================================================================= */}
        <section id="principles" className="pt-8 pb-14 border-t border-neutral-200">
          <div className="max-w-3xl mb-6">
            <div className="font-sans text-[11.5px] text-neutral-500 uppercase tracking-widest mb-1.5 font-medium">
              SYSTEM ARCHITECTURE COMPARISON
            </div>
            <h3 className="text-[26.5px] font-semibold tracking-tight text-neutral-950 font-sans leading-snug">
              Why algorithmic protection matters.
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-neutral-200 text-left text-[13.5px] font-sans">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 font-sans text-[11.5px] uppercase tracking-wider text-neutral-500">
                  <th className="p-4 border-r border-neutral-200">System Dimension</th>
                  <th className="p-4 border-r border-neutral-200">Legacy Hailing Platforms</th>
                  <th className="p-4 bg-emerald-50/50 text-emerald-950">BASE Surge-Price Protection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-neutral-700">
                <tr>
                  <td className="p-4 font-sans font-semibold text-neutral-900 border-r border-neutral-200">
                    Supply Drop Handling
                  </td>
                  <td className="p-4 border-r border-neutral-200 leading-relaxed">
                    Immediately multiplies price multiplier regardless of drop pattern.
                  </td>
                  <td className="p-4 font-semibold text-emerald-900 bg-emerald-50/30 leading-relaxed">
                    Cross-references drop velocity against ambient airport demand.
                  </td>
                </tr>
                <tr>
                  <td className="p-4 font-sans font-semibold text-neutral-900 border-r border-neutral-200">
                    Demand Verification
                  </td>
                  <td className="p-4 border-r border-neutral-200 leading-relaxed">
                    App opens and search queries artificially trigger surging.
                  </td>
                  <td className="p-4 font-semibold text-emerald-900 bg-emerald-50/30 leading-relaxed">
                    Confirms verified booking requests and departure timetables.
                  </td>
                </tr>
                <tr>
                  <td className="p-4 font-sans font-semibold text-neutral-900 border-r border-neutral-200">
                    Shortage Window Capping
                  </td>
                  <td className="p-4 border-r border-neutral-200 leading-relaxed">
                    Unbounded escalation (fares can reach 3.5x–5.0x).
                  </td>
                  <td className="p-4 font-semibold text-emerald-900 bg-emerald-50/30 leading-relaxed">
                    Freezes fare at reference rate (1.0x) during active investigation window.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* =========================================================================
          Sticky Floating Telemetry & Control Bar (Headline font on all buttons!)
          ========================================================================= */}
      <aside aria-label="Persistent Simulation Controls" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[94%] max-w-4xl bg-black/95 text-white backdrop-blur-md border border-neutral-700 px-5 py-3 shadow-2xl flex flex-wrap items-center justify-between gap-4 font-sans text-xs">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full shrink-0",
              phase === 1
                ? "bg-rose-500 animate-pulse"
                : phase === 2
                ? "bg-amber-400 animate-ping"
                : "bg-emerald-400"
            )}
          />
          <span className="text-xs uppercase font-semibold tracking-wider text-neutral-200 font-sans">
            {getStatusLabel()}
          </span>
          <span className="text-neutral-600 font-sans">|</span>
          <span className="text-neutral-400 font-sans text-xs uppercase tracking-wider">
            DRIVERS: <strong className="text-white font-sans text-xs">{driverCount}</strong>
          </span>
          <span className="text-neutral-600 font-sans">|</span>
          <span className="text-neutral-400 font-sans text-xs uppercase tracking-wider">
            FARE:{" "}
            <strong
              className={cn(
                "font-sans text-xs font-bold",
                phase === 1
                  ? "text-rose-400"
                  : phase === 3
                  ? "text-emerald-400"
                  : "text-white"
              )}
            >
              {getProposedFare()}
            </strong>
          </span>
          {phase === 3 && (
            <span className="hidden sm:inline-flex items-center gap-1 text-emerald-400 text-xs font-sans font-semibold uppercase tracking-wider">
              • ₹300 SHIELDED
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {phase === 0 && (
            <button
              type="button"
              onClick={handleSimulateShortage}
              disabled={isAnimatingCount}
              className="px-4 py-1.5 bg-white text-black font-sans font-semibold text-xs tracking-wider uppercase hover:bg-neutral-200 cursor-pointer transition-colors shadow-sm"
            >
              Simulate Shortage
            </button>
          )}

          {phase === 1 && (
            <button
              type="button"
              onClick={handleRunAnomalyDetection}
              disabled={isAnimatingCount}
              className="px-4 py-1.5 bg-emerald-500 text-black font-sans font-semibold text-xs tracking-wider uppercase hover:bg-emerald-400 cursor-pointer transition-colors shadow-sm"
            >
              Run Anomaly Detection
            </button>
          )}

          <button
            type="button"
            onClick={handleResetSimulation}
            className="px-3 py-1.5 border border-neutral-600 text-neutral-200 font-sans font-semibold text-xs tracking-wider uppercase hover:text-white hover:border-neutral-400 cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw size={11} />
            Reset
          </button>
        </div>
      </aside>

      {/* =========================================================================
          Editorial Footer
          ========================================================================= */}
      <footer className="border-t border-neutral-200 bg-white py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500 font-sans">
          <div className="flex items-center gap-3">
            <span className="font-bold text-base text-black font-sans">Base</span>
            <span className="font-sans text-[10px] text-neutral-400">/ HOW SURGE WORKS</span>
            <span className="h-3 w-px bg-neutral-300" />
            <span>MUMBAI MMR FLEET ARCHITECTURE</span>
          </div>

          <div className="flex items-center gap-5 font-sans font-medium text-xs">
            <button type="button" onClick={onNavigateToRide} className="hover:text-black cursor-pointer font-sans">
              RIDE
            </button>
            <button type="button" onClick={onNavigateToDrive} className="hover:text-black cursor-pointer font-sans">
              DRIVE
            </button>
            <button type="button" onClick={onNavigateToAbout} className="hover:text-black cursor-pointer font-sans">
              ABOUT
            </button>
            <button type="button" onClick={onNavigateToFeedback} className="hover:text-black cursor-pointer font-sans">
              FEEDBACK
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default HowSurgeWorksPage;
