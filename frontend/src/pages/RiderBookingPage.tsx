"use client";

import React from "react";
import { motion } from "motion/react";
import { ArrowLeft, ShieldCheck, MapPin } from "lucide-react";
import { BaseNavbar, NavDestination } from "@/components/ui/BaseNavbar";
import { SweepSurface } from "@/components/ui/sweep-surface";
import { RideBookingForm } from "@/components/ui/ride-booking-form";
import { FloatingPathsBackground } from "@/components/ui/floating-paths";
import UnderlineToBackground from "@/components/fancy/text/underline-to-background";
import { RATE_PER_KM } from "@/services/geocoding";

export interface RiderBookingPageProps {
  onBackToLanding: () => void;
  onNavigate?: (destination: NavDestination) => void;
}

export function RiderBookingPage({ onBackToLanding, onNavigate }: RiderBookingPageProps) {
  // Staggered word animation for the headline
  const headlineWords = "RIDES MADE EASIER WITH".split(" ");

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.5,
        staggerChildren: 0.09,
        delayChildren: 0.15,
      },
    },
  };

  const wordVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 120, damping: 20 },
    },
  };

  return (
    <div className="relative isolate min-h-screen bg-white text-black flex flex-col select-text">
      {/* =========================================================================
          GLOBAL FloatingPathsBackground — full-page decorative layer (z-0)
          Mounted at the rider-page root, behind header + both panels + footer.
          ========================================================================= */}
      <FloatingPathsBackground position={-1} />

      {/* =========================================================================
          GLOBAL ANIMATED NAVIGATION BAR (BASE Standard Pages)
          ========================================================================= */}
      <BaseNavbar
        variant="light"
        activeRoute="rider"
        onNavigate={(dest) => {
          if (dest === "landing") {
            onBackToLanding();
            return;
          }
          if (onNavigate) {
            onNavigate(dest);
            return;
          }
          const path = `/${dest}`;
          window.history.pushState({}, "", path);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }}
      />

      {/* Sub-bar showing contextual rider rate and zone information */}
      <div className="relative z-30 w-full border-b border-neutral-200 bg-neutral-50/80 backdrop-blur-xs px-6 py-3">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToLanding}
              className="p-0 border-0 bg-transparent cursor-pointer inline-flex items-center gap-2 text-neutral-700 hover:text-black font-semibold transition-colors"
              aria-label="Return to landing page"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              <span>Back to home</span>
            </button>
            <span className="text-neutral-300">|</span>
            <span className="font-sans font-bold uppercase tracking-wider text-neutral-500 text-xs">
              Direct Booking Terminal
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-neutral-300 text-xs sm:text-[13px] font-sans font-bold uppercase tracking-[0.08em] text-neutral-900 shadow-xs">
              <span aria-hidden="true" className="h-2 w-2 bg-emerald-500" />
              Surge Ceiling 1.0× · ₹{RATE_PER_KM} / km
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 text-xs sm:text-[13px] font-sans font-bold uppercase tracking-[0.08em] text-neutral-800 shadow-xs">
              <MapPin size={14} aria-hidden="true" />
              Mumbai, IN
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          Main Content: Balanced Two-Column Composition — foreground (z-10)
          LEFT SIDE: Ride Booking Panel
          RIGHT SIDE: BASE Branding
          ========================================================================= */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          
          {/* =====================================================================
              LEFT SIDE: Ride Booking Form (Primary interactive area)
              Solid white card sitting on top of the global floating paths layer.
              ===================================================================== */}
          <div className="lg:col-span-7 flex flex-col justify-start">
            <RideBookingForm />
          </div>

          {/* =====================================================================
              RIGHT SIDE: BASE Branding Content
              Solid white card sitting on top of the global floating paths layer.
              The gap between the two panels gives clear peeks of the floating paths.
              ===================================================================== */}
          <div className="lg:col-span-5 flex flex-col border border-neutral-200 bg-white overflow-hidden shadow-xs">
            <div className="flex-1 flex flex-col justify-between p-8 sm:p-10 min-h-[580px] lg:min-h-[660px]">
              {/* Top Meta Indicator: Base Protection Engine + Active 1.0x */}
              <div className="flex items-center justify-between gap-2">
                <SweepSurface
                  as="span"
                  variant="light"
                  className="px-4 py-2 text-xs sm:text-[13px] font-sans font-bold tracking-[0.08em] uppercase"
                >
                  <ShieldCheck size={16} aria-hidden="true" />
                  BASE PROTECTION ENGINE
                </SweepSurface>

                <span className="text-xs sm:text-[13px] font-sans uppercase tracking-[0.1em] text-neutral-600 font-bold">
                  Active 1.0×
                </span>
              </div>

              {/* Central Animated Headline: RIDES MADE EASIER WITH BASE */}
              <div className="py-8">
                <motion.h2
                  className="text-[42px] sm:text-[52px] lg:text-[60px] xl:text-[68px] font-extrabold tracking-[-0.04em] text-black flex flex-wrap items-baseline gap-x-3 gap-y-1 leading-[1.02] mb-6"
                  initial="hidden"
                  animate="visible"
                  variants={containerVariants}
                >
                  {headlineWords.map((word, idx) => (
                    <motion.span
                      key={idx}
                      variants={wordVariants}
                      className="inline-block text-black"
                    >
                      {word}
                    </motion.span>
                  ))}
                  <motion.span variants={wordVariants} className="inline-block">
                    <UnderlineToBackground
                      targetTextColor="#FFFFFF"
                      className="text-black cursor-pointer font-extrabold"
                    >
                      BASE
                    </UnderlineToBackground>
                  </motion.span>
                </motion.h2>

                <p className="text-[18px] sm:text-[20px] font-normal leading-[1.6] text-neutral-700 max-w-md">
                  Point-to-point route distance metering with zero artificial surge markup.
                  Every ride is calculated at a transparent <strong className="font-bold text-black">₹{RATE_PER_KM} per driving kilometre</strong> based on actual road network geometry.
                </p>
              </div>

              {/* Bottom Feature Badges in Restrained Monochrome */}
              <div className="pt-6 border-t border-neutral-200/80 grid grid-cols-2 gap-4 text-xs font-sans">
                <div>
                  <span className="text-neutral-500 block text-xs uppercase tracking-[0.08em] font-bold">Routing Accuracy</span>
                  <span className="font-extrabold text-black text-sm sm:text-base">OSRM Engine</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-xs uppercase tracking-[0.08em] font-bold">Fixed Tariff</span>
                  <span className="font-extrabold text-black text-sm sm:text-base">₹{RATE_PER_KM} / km flat</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* =========================================================================
          Footer — foreground (z-10)
          ========================================================================= */}
      <footer className="relative z-10 border-t border-neutral-200/80 bg-white/90 backdrop-blur-sm py-6 px-6 text-xs text-neutral-500 font-sans">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>© 2026 Base Technologies Inc. • Surge-Shielded Mobility</div>
          <div className="text-[11px] text-neutral-400">
            Geocoding &amp; routing via OpenStreetMap &amp; OSRM
          </div>
        </div>
      </footer>
    </div>
  );
}

export default RiderBookingPage;
