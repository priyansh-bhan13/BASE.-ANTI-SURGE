"use client";

import React, { useEffect, useState, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export interface SpecialTextProps {
  /** The target text to resolve into */
  children: string;
  /** Whether the scramble animation is currently active/running */
  active?: boolean;
  /** Delay in milliseconds before starting scramble */
  delay?: number;
  /** Total duration of scramble for the whole text in milliseconds */
  duration?: number;
  /** Character flip speed in milliseconds */
  speed?: number;
  /** Character pool to draw scrambled glyphs from */
  charset?: string;
  /** Optional class name */
  className?: string;
  /** Called when the animation completes */
  onComplete?: () => void;
  /** Fallback accessible label */
  ariaLabel?: string;
  /** Retain font consistency without jarring font swaps */
  tabular?: boolean;
}

// Clean, symmetrical uppercase & numeric glyphs that don't cause chaotic layout vibrating
const SMOOTH_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * SpecialText / ScrambleText
 *
 * Implements a buttery-smooth, progressive left-to-right typography decryption reveal.
 * - Pure white text only (#FFFFFF) throughout all frames.
 * - Zero font-family hopping (no jarring monospace-to-sans pop).
 * - Cubic ease-out pacing for a fluid, premium motion feel.
 * - Per-character alpha settling so resolving glyphs land gracefully like silk.
 */
export function SpecialText({
  children,
  active = true,
  delay = 0,
  duration = 1500,
  speed = 48,
  charset = SMOOTH_CHARSET,
  className,
  onComplete,
  ariaLabel,
}: SpecialTextProps) {
  const targetText = children || "";
  const shouldReduceMotion = useReducedMotion();
  const [displayText, setDisplayText] = useState<string>(
    shouldReduceMotion ? targetText : ""
  );
  const [settledCount, setSettledCount] = useState<number>(
    shouldReduceMotion ? targetText.length : 0
  );
  const [isResolved, setIsResolved] = useState<boolean>(Boolean(shouldReduceMotion));
  const completedRef = useRef(false);

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayText(targetText);
      setSettledCount(targetText.length);
      setIsResolved(true);
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
      return;
    }

    if (!active) {
      setDisplayText(targetText);
      setSettledCount(targetText.length);
      setIsResolved(true);
      return;
    }

    completedRef.current = false;
    setIsResolved(false);

    const length = targetText.length;
    if (length === 0) {
      setIsResolved(true);
      onComplete?.();
      return;
    }

    let rafId: number;
    const startTime = performance.now() + delay;
    const chars = charset.split("");
    const getRandomChar = () => chars[Math.floor(Math.random() * chars.length)];

    let lastFlip = performance.now();
    // Cache current random trailing characters so they don't strobe at 60fps
    let currentRandoms: string[] = Array.from({ length }, () => getRandomChar());

    const tick = (now: number) => {
      if (now < startTime) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const elapsed = Math.max(0, now - startTime);
      const rawProgress = Math.min(1, elapsed / duration);

      // Smooth cubic-out easing for silky progressive settling
      const ease = 1 - Math.pow(1 - rawProgress, 2.8);
      const currentSettled = Math.min(length, Math.floor(ease * (length + 1)));
      setSettledCount(currentSettled);

      // Gentle flip cadence (e.g. every ~48ms) to avoid eye strain/jitter
      const shouldFlip = now - lastFlip >= speed;
      if (shouldFlip) {
        lastFlip = now;
        currentRandoms = currentRandoms.map((c, idx) =>
          idx >= currentSettled ? getRandomChar() : c
        );
      }

      if (rawProgress >= 1 || currentSettled >= length) {
        setDisplayText(targetText);
        setSettledCount(length);
        setIsResolved(true);
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.();
        }
        return;
      }

      // Compose frame in pure white text
      let frame = "";
      for (let i = 0; i < length; i++) {
        const targetChar = targetText[i];
        if (targetChar === " " || targetChar === "\n" || targetChar === "/" || targetChar === "-") {
          frame += targetChar;
        } else if (i < currentSettled) {
          frame += targetChar;
        } else {
          frame += currentRandoms[i] || getRandomChar();
        }
      }

      setDisplayText(frame);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [targetText, active, delay, duration, speed, charset, shouldReduceMotion]);

  // Per-character rendering for smooth progressive opacity and pure white text
  const length = targetText.length;

  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center justify-center select-none text-white",
        className
      )}
      aria-label={ariaLabel || targetText}
      role="text"
    >
      {isResolved ? (
        <span className="text-white">{targetText}</span>
      ) : (
        Array.from({ length }).map((_, i) => {
          const char = displayText[i] || targetText[i] || " ";
          const isSettled = i < settledCount;
          const isFrontier = i === settledCount;

          return (
            <span
              key={i}
              className={cn(
                "inline-block transition-opacity duration-150 text-white",
                isSettled
                  ? "opacity-100 font-semibold"
                  : isFrontier
                  ? "opacity-90 font-medium"
                  : "opacity-40 font-normal"
              )}
              style={{
                // Prevent layout shifts during character morphing
                minWidth: char === " " ? "0.35em" : undefined,
              }}
            >
              {char === " " ? "\u00A0" : char}
            </span>
          );
        })
      )}
    </span>
  );
}

export default SpecialText;
