"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { GatewayCanvas } from "./gateway-canvas";
import { SpecialText } from "./special-text";
import { cn } from "@/lib/utils";

export interface GatewayTransitionProps {
  /** Callback fired when transition concludes or is skipped */
  onComplete?: () => void;
  /** Whether the gateway is requested to run */
  active?: boolean;
  /** Force instant skip */
  forceSkip?: boolean;
}

type Stage = "initial" | "scramble" | "settled" | "collapsing" | "finished";

/**
 * GatewayTransition
 *
 * Full-screen cinematic entrance sequence for the BASE "How Surge Works" route:
 * 1. Viewport-filling near-black canvas with prominently visible flowing dotted paths & particles.
 * 2. Glitchy, tactile scramble typography revealing:
 *      BASE / PRICING SYSTEM
 *      HOW SURGE WORKS
 * 3. Smooth central convergence pull & opacity dissolve revealing the editorial white page.
 * 4. Keyboard (Escape) & click "SKIP INTRO" controls.
 * 5. Full prefers-reduced-motion support.
 */
export function GatewayTransition({
  onComplete,
  active = true,
  forceSkip = false,
}: GatewayTransitionProps) {
  const shouldReduceMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>(
    shouldReduceMotion || forceSkip ? "finished" : "initial"
  );
  const [isOverlayVisible, setIsOverlayVisible] = useState(
    !shouldReduceMotion && !forceSkip && active
  );
  const hasTriggeredCompleteRef = useRef(false);

  const handleFinish = useCallback(() => {
    if (hasTriggeredCompleteRef.current) return;
    hasTriggeredCompleteRef.current = true;
    setStage("finished");
    setIsOverlayVisible(false);
    onComplete?.();
  }, [onComplete]);

  // Handle immediate skip
  const handleSkip = useCallback(() => {
    handleFinish();
  }, [handleFinish]);

  // Listen for Escape key
  useEffect(() => {
    if (stage === "finished") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleSkip();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stage, handleSkip]);

  // Automated sequence progression
  useEffect(() => {
    if (shouldReduceMotion || forceSkip || !active) {
      handleFinish();
      return;
    }

    // Step 1: Initial flow starts immediately. After 300ms, start scramble
    const t1 = setTimeout(() => {
      setStage("scramble");
    }, 320);

    // Step 2: Main title settles around 2200ms
    const t2 = setTimeout(() => {
      setStage("settled");
    }, 2250);

    // Step 3: Hold settled state so user can appreciate the gateway and resolved typography (~3200ms)
    const t3 = setTimeout(() => {
      setStage("collapsing");
    }, 3200);

    // Step 4: Overlay dissolves completely (~3800ms total)
    const t4 = setTimeout(() => {
      handleFinish();
    }, 3850);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [active, forceSkip, shouldReduceMotion, handleFinish]);

  if (!isOverlayVisible) {
    return null;
  }

  const isCollapsing = stage === "collapsing";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How Surge Works gateway transition"
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050606] text-white transition-opacity duration-700 ease-out",
        isCollapsing ? "opacity-0 pointer-events-none" : "opacity-100"
      )}
      style={{
        transitionDuration: "650ms",
      }}
    >
      {/* Background Symmetrical Dotted Flow Canvas */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <GatewayCanvas
          mode="dark"
          density={1.25}
          speed={1.2}
          collapsing={isCollapsing}
          opacity={1.0}
        />
        {/* Soft, minimal radial center blend so dotted paths remain fully visible */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(5,6,6,0.35) 0%, rgba(5,6,6,0.05) 50%, rgba(5,6,6,0.6) 100%)",
          }}
        />
      </div>

      {/* Center Decryption Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-xl mx-auto select-none">
        {/* Technical Eyebrow */}
        <div className="mb-4 inline-flex items-center gap-2 font-sans font-semibold text-[11px] uppercase tracking-[0.18em] text-white/90">
          <span className="inline-block h-1.5 w-1.5 bg-white rounded-none animate-pulse" />
          <SpecialText
            active={stage === "scramble" || stage === "settled" || stage === "collapsing"}
            duration={1100}
            speed={38}
            tabular
          >
            BASE / PRICING SYSTEM
          </SpecialText>
        </div>

        {/* Primary Decryption Headline */}
        <h1 className="font-sans font-medium text-4xl sm:text-5xl md:text-6xl tracking-[-0.05em] uppercase text-white leading-none mb-4">
          <SpecialText
            active={stage === "scramble" || stage === "settled" || stage === "collapsing"}
            delay={160}
            duration={1600}
            speed={40}
            tabular
          >
            HOW SURGE WORKS
          </SpecialText>
        </h1>

        {/* Small System Protocol Label */}
        <div className="font-sans font-semibold text-[10px] text-neutral-400 tracking-[0.14em] uppercase">
          MULTI-SIGNAL VERIFICATION PROTOCOL · MUMBAI METRO
        </div>
      </div>

      {/* Top Right Skip Button */}
      <div className="absolute top-6 right-6 z-20">
        <button
          type="button"
          onClick={handleSkip}
          className="group flex items-center gap-2.5 border border-white/30 bg-black/80 backdrop-blur-md px-4 py-2 font-sans font-semibold text-xs uppercase tracking-[0.12em] text-white hover:border-white focus:outline-none focus:ring-2 focus:ring-white cursor-pointer transition-all shadow-lg"
          aria-label="Skip introduction animation (Press Escape)"
        >
          <span>Skip intro</span>
          <span className="text-[10px] text-neutral-400 group-hover:text-neutral-200 font-sans font-semibold">
            [ESC]
          </span>
        </button>
      </div>

      {/* Bottom Progress Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 text-[10px] font-sans font-semibold text-neutral-400 tracking-wider">
        <span>INITIALIZING NETWORK MODEL</span>
        <span className="inline-block h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping" />
        <span className="text-neutral-300">DEMO SCENARIO 001</span>
      </div>
    </div>
  );
}

export default GatewayTransition;
