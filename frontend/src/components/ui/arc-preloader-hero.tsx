"use client";

import * as React from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { cn } from "@/lib/utils";

/* ── types ───────────────────────────────────────────────────── */

export type ArcRevealGreeting = {
  /** Greeting text in the target script */
  text: string;
  /** Optional custom hold time in ms for this specific greeting */
  hold?: number;
  /** Optional `lang` attribute applied to the span */
  lang?: string;
};

export interface ArcRevealHeroProps {
  /** Greetings cycled before the horizon split. Defaults to all 5 BASE statements. */
  greetings?: ArcRevealGreeting[];
  /** How long each word is held on screen (ms). Default 1300ms for slow, calm, noticeable reading. */
  greetingHold?: number;
  /** Duration of the curved curtain reveal (ms). */
  revealDuration?: number;
  /** Outer `<section>` class. Receives the *post-reveal* surface. */
  className?: string;
  /** Class for the intro (pre-reveal) overlay surface. */
  introClassName?: string;
  /** Class for the cycled greeting `<span>`. */
  greetingClassName?: string;
  /** Class for the wrapper around `children` (the revealed content). */
  revealClassName?: string;
  /**
   * Optional `sessionStorage` key — when set, the intro plays only once per
   * session for the same key. Leave unset to replay on every mount.
   */
  storageKey?: string;
  /** Content shown after the curtain reveal (the "landing"). */
  children?: React.ReactNode;
}

/* ── defaults ────────────────────────────────────────────────── */

const DEFAULT_GREETINGS: ArcRevealGreeting[] = [
  { text: "Predictable.", hold: 1300 },
  { text: "Protected.", hold: 1300 },
  { text: "Transparent.", hold: 1300 },
  { text: "Always 1.0x.", hold: 1350 },
  { text: "Base.", hold: 1600 },
];

type Phase = "words" | "horizon" | "reveal" | "done";

/* ── component ───────────────────────────────────────────────── */

export function ArcRevealHero({
  greetings = DEFAULT_GREETINGS,
  greetingHold = 1300,
  revealDuration = 1350,
  className,
  introClassName,
  greetingClassName,
  revealClassName,
  storageKey,
  children,
}: ArcRevealHeroProps) {
  const prefersReducedMotion = useReducedMotion();

  const [phase, setPhase] = React.useState<Phase>(
    prefersReducedMotion ? "done" : "words"
  );
  const [index, setIndex] = React.useState(0);
  const [horizonTriggered, setHorizonTriggered] = React.useState(false);

  // Drive the arc shape from a single 0→1 progress.
  // The curve is a quadratic bezier with fixed concavity translated upward over time:
  //   t=0 → chord at y=110 (off-screen below)  → no curtain visible
  //   t=1 → chord at y=-30 (off-screen above)  → full-screen curtain lifted
  const progress = useMotionValue(0);
  const arcPath = useTransform(progress, (p: number) => {
    const edge = 110 - p * 140;
    const control = edge + 25;
    return `M 0 ${edge} Q 50 ${control} 100 ${edge} L 100 110 L 0 110 Z`;
  });

  const skipIntro = React.useCallback(() => {
    setPhase("done");
    if (storageKey && typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(storageKey, "done");
      } catch {
        /* ignore */
      }
    }
  }, [storageKey]);

  // Handle Escape key to skip
  React.useEffect(() => {
    if (phase === "done") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skipIntro();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, skipIntro]);

  // Honor reduced-motion + session replay
  React.useEffect(() => {
    if (prefersReducedMotion) {
      setPhase("done");
      return;
    }
    if (storageKey && typeof window !== "undefined") {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("replay") === "1") {
          window.sessionStorage.removeItem(storageKey);
          return;
        }
        if (window.sessionStorage.getItem(storageKey) === "done") {
          setPhase("done");
        }
      } catch {
        /* ignore */
      }
    }
  }, [prefersReducedMotion, storageKey]);

  // Word Cycling (Slow, Smooth, Noticeable)
  React.useEffect(() => {
    if (prefersReducedMotion || phase !== "words") return;

    const isLastWord = index >= greetings.length - 1;
    const currentItem = greetings[index];
    const holdTime = currentItem?.hold || (isLastWord ? 1600 : greetingHold);

    if (isLastWord) {
      // Reached "Base." -> initiate the optical horizon line pulse
      const t = window.setTimeout(() => {
        setPhase("horizon");
        setHorizonTriggered(true);
      }, holdTime);
      return () => window.clearTimeout(t);
    }

    const t = window.setTimeout(() => {
      setIndex((i) => i + 1);
    }, holdTime);

    return () => window.clearTimeout(t);
  }, [phase, index, greetingHold, greetings, prefersReducedMotion]);

  // Horizon Split -> Curtain Lift Trigger
  React.useEffect(() => {
    if (phase !== "horizon") return;
    const t = window.setTimeout(() => {
      setPhase("reveal");
    }, 480);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Drive the buttery high-tension curtain lift
  React.useEffect(() => {
    if (phase !== "reveal") return;
    const controls = animate(progress, 1, {
      duration: revealDuration / 1000,
      ease: [0.85, 0, 0.15, 1], // High-tension luxury physical ease
      onComplete: () => {
        if (storageKey && typeof window !== "undefined") {
          try {
            window.sessionStorage.setItem(storageKey, "done");
          } catch {
            /* ignore */
          }
        }
        setPhase("done");
      },
    });
    return () => controls.stop();
  }, [phase, progress, revealDuration, storageKey]);

  const showOverlay = phase !== "done";
  const currentWord = greetings[Math.min(index, greetings.length - 1)];
  const isLastWord = index === greetings.length - 1;

  return (
    <section
      aria-label="Hero"
      className={cn(
        "relative isolate min-h-screen w-full overflow-hidden bg-background text-foreground",
        className,
      )}
    >
      {/* Revealed Children with subtle staggered float-in */}
      <div
        className={cn(
          "relative z-0 transition-all duration-700 ease-out",
          phase === "reveal" && "opacity-95 scale-[0.99] translate-y-2",
          phase === "done" && "opacity-100 scale-100 translate-y-0",
          revealClassName
        )}
      >
        {children}
      </div>

      <AnimatePresence>
        {showOverlay && (
          <motion.div
            key="horizon-reveal-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
              "fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050606] text-white overflow-hidden select-none",
              introClassName,
            )}
          >
            {/* Top Right Skip Button (Hanken Grotesk - NO progress bars) */}
            <div className="absolute top-6 right-6 z-40">
              <button
                type="button"
                onClick={skipIntro}
                className="group flex items-center gap-2 border border-white/20 bg-black/60 backdrop-blur-md px-3.5 py-1.5 font-sans font-semibold text-xs uppercase tracking-wider text-white hover:border-white focus:outline-none focus:ring-1 focus:ring-white cursor-pointer transition-all shadow-md"
                aria-label="Skip introduction animation (Press Escape)"
              >
                <span>Skip</span>
                <span className="text-[10px] text-neutral-400 group-hover:text-neutral-200 font-sans font-semibold">
                  [ESC]
                </span>
              </button>
            </div>

            {/* Central Narrative Typography: Slow, Smooth, Noticeable Masked Slide */}
            <div className="relative z-20 flex flex-col items-center justify-center px-6 text-center max-w-4xl mx-auto">
              <div className="overflow-hidden py-4 px-2 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {(phase === "words" || phase === "horizon") && currentWord && (
                    <motion.div
                      key={`${index}-${currentWord.text}`}
                      initial={{ y: "115%", opacity: 0 }}
                      animate={{
                        y: "0%",
                        opacity: 1,
                        scale: isLastWord && horizonTriggered ? 1.04 : 1,
                      }}
                      exit={{ y: "-115%", opacity: 0, filter: "blur(4px)" }}
                      transition={{
                        duration: 0.58,
                        ease: [0.16, 1, 0.3, 1], // Silky Apple/Linear cubic out
                      }}
                      className="relative inline-flex items-baseline justify-center"
                    >
                      <span
                        lang={currentWord.lang}
                        className={cn(
                          "font-sans font-medium text-5xl sm:text-7xl md:text-8xl tracking-tight text-white leading-none",
                          isLastWord && "font-semibold tracking-[-0.03em]",
                          greetingClassName,
                        )}
                      >
                        {currentWord.text}
                      </span>

                      {/* Period Soft Pulse Ring on "Base." */}
                      {isLastWord && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: [1, 2.2, 0], opacity: [0.8, 0.35, 0] }}
                          transition={{
                            duration: 1.1,
                            repeat: Infinity,
                            delay: 0.3,
                            ease: "easeOut",
                          }}
                          className="absolute right-0 bottom-1 sm:bottom-2 md:bottom-3 h-2 w-2 sm:h-3 sm:w-3 rounded-full bg-white pointer-events-none"
                        />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Minimal Editorial Sub-label under "Base." */}
              {isLastWord && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="font-sans font-semibold text-[11px] uppercase tracking-[0.22em] text-neutral-400 mt-2"
                >
                  SURGE-PROTECTED MOBILITY · MUMBAI
                </motion.div>
              )}
            </div>

            {/* Concept A: Precision Optical Horizon Hairline Beam */}
            <AnimatePresence>
              {(phase === "horizon" || phase === "reveal") && (
                <motion.div
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: [0, 1, 0.8] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-30 pointer-events-none h-px bg-gradient-to-r from-transparent via-white to-transparent"
                  style={{
                    boxShadow: "0 0 16px rgba(255, 255, 255, 0.85), 0 0 4px rgba(255, 255, 255, 0.95)",
                  }}
                />
              )}
            </AnimatePresence>

            {/* Rising Curved Architectural Curtain (High-Tension Liquid Lift) */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full z-10"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              <motion.path
                d={arcPath}
                style={{ fill: "#FFFFFF" }}
              />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default ArcRevealHero;
