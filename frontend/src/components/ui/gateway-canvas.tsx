"use client";

import React, { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export interface GatewayCanvasProps {
  className?: string;
  /** Symmetrical path density multiplier */
  density?: number;
  /** Speed multiplier for moving particles */
  speed?: number;
  /** When true, contracts or collapses paths toward the focal convergence point */
  collapsing?: boolean;
  /** Mode: 'dark' (default black gateway) or 'light' (subtle editorial hero) */
  mode?: "dark" | "light";
  /** Optional opacity multiplier */
  opacity?: number;
}

interface PathDefinition {
  isLeft: boolean;
  startYRatio: number;
  curveTightness: number;
  particles: {
    t: number;
    speed: number;
    size: number;
    alpha: number;
  }[];
}

/**
 * GatewayCanvas
 *
 * High-performance HTML5 Canvas rendering symmetrical dotted Bezier curves
 * converging to a central gateway horizon, with glowing traveling particles.
 */
export function GatewayCanvas({
  className,
  density = 1,
  speed = 1,
  collapsing = false,
  mode = "dark",
  opacity = 1,
}: GatewayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const collapseProgressRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = 0;
    let height = 0;

    const isLight = mode === "light";
    const baseColor = isLight ? "20, 24, 22" : "255, 255, 255";

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width || window.innerWidth;
      height = rect.height || window.innerHeight;
      canvas.width = Math.max(1, width * dpr);
      canvas.height = Math.max(1, height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    // Generate symmetrical paths
    const pathCount = Math.max(36, Math.round(96 * density));
    const paths: PathDefinition[] = [];

    for (let i = 0; i < pathCount; i++) {
      const isLeft = i % 2 === 0;
      // Distribute starting Y along the left and right borders (-20% to 120%)
      const startYRatio = -0.2 + (i / pathCount) * 1.4;
      const particleCount = 2 + (i % 2);

      const particles = [];
      for (let p = 0; p < particleCount; p++) {
        particles.push({
          t: Math.random(),
          speed: (0.0016 + Math.random() * 0.0028) * (shouldReduceMotion ? 0 : speed),
          size: 2.2 + Math.random() * 2.2,
          alpha: 0.6 + Math.random() * 0.4,
        });
      }

      paths.push({
        isLeft,
        startYRatio,
        curveTightness: 0.42 + (i % 6) * 0.08,
        particles,
      });
    }

    // Cubic Bezier interpolation
    function getBezierPoint(
      t: number,
      p0: { x: number; y: number },
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      p3: { x: number; y: number }
    ) {
      const u = 1 - t;
      const tt = t * t;
      const uu = u * u;
      const uuu = uu * u;
      const ttt = tt * t;

      return {
        x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
        y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
      };
    }

    let lastTime = performance.now();

    const render = (time: number) => {
      const delta = Math.min(50, time - lastTime);
      lastTime = time;

      // Handle collapse animation when transitioning out
      if (collapsing) {
        collapseProgressRef.current = Math.min(1, collapseProgressRef.current + delta * 0.0025);
      } else {
        collapseProgressRef.current = Math.max(0, collapseProgressRef.current - delta * 0.003);
      }

      const collapse = collapseProgressRef.current;
      const currentOpacity = opacity * (1 - collapse * 0.7);

      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      // Focal waist gap (narrows down as it approaches center)
      const waistHeight = Math.max(3, 16 * (1 - collapse));

      paths.forEach((path) => {
        const startY = path.startYRatio * height;
        const p0 = {
          x: path.isLeft ? 0 : width,
          y: startY + (centerY - startY) * (collapse * 0.45),
        };

        // Inward curvature points
        const pull = path.curveTightness;
        const p1 = {
          x: path.isLeft ? centerX * pull : width - centerX * pull,
          y: startY + (centerY - startY) * 0.28,
        };

        const p2 = {
          x: path.isLeft ? centerX * 0.84 : width - centerX * 0.84,
          y: centerY + (path.isLeft ? -waistHeight : waistHeight) * 0.45,
        };

        const p3 = {
          x: centerX + (path.isLeft ? -2 : 2),
          y: centerY,
        };

        // Draw dotted flowing curve with crisp, prominent visibility
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);

        ctx.strokeStyle = `rgba(${baseColor}, ${0.52 * currentOpacity})`;
        ctx.lineWidth = 1.35;
        ctx.setLineDash([2, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw traveling particles
        path.particles.forEach((p) => {
          if (!shouldReduceMotion) {
            p.t += p.speed * (delta / 16.66);
            if (p.t > 1) {
              p.t = 0;
            }
          }

          const pos = getBezierPoint(p.t, p0, p1, p2, p3);

          // Alpha brightens near convergence
          const distToCenter = Math.hypot(pos.x - centerX, pos.y - centerY);
          const maxDist = Math.hypot(centerX, centerY);
          const centerGlow = Math.max(0.4, 1 - distToCenter / (maxDist * 0.55));

          const particleAlpha = Math.min(1, p.alpha * currentOpacity * centerGlow);

          const sz = p.size;
          // Core bright particle
          ctx.fillStyle = `rgba(${baseColor}, ${particleAlpha})`;
          ctx.fillRect(pos.x - sz / 2, pos.y - sz / 2, sz, sz);

          // Soft glowing aura around particles
          if (!isLight) {
            ctx.fillStyle = `rgba(255, 255, 255, ${particleAlpha * 0.35})`;
            ctx.fillRect(pos.x - sz, pos.y - sz, sz * 2, sz * 2);
          }
        });
      });

      // Focal convergence singularity
      const focalRadius = (1 - collapse) * 3;
      if (focalRadius > 0.5) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, focalRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${baseColor}, ${0.9 * currentOpacity})`;
        ctx.fill();

        // Subtle radial bloom at gateway waist
        const glowRadius = focalRadius * 5;
        const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius);
        grad.addColorStop(0, `rgba(${baseColor}, ${0.5 * currentOpacity})`);
        grad.addColorStop(1, `rgba(${baseColor}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, [density, speed, collapsing, mode, opacity, shouldReduceMotion]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("pointer-events-none block h-full w-full", className)}
      aria-hidden="true"
    />
  );
}

export default GatewayCanvas;
