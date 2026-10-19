"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export interface DriverNodeData {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  vehicleType: "sedan" | "rickshaw" | "suv" | "compact";
  locationName: string;
  lat: number;
  lng: number;
  distToTerminalMeters: number;
  rating: string;
  status: "online" | "offline" | "flagged";
  heartbeatSec: number;
  nodeIndex: number;
}

export interface SurgeNetworkCanvasProps {
  /** Active driver count (from 400 to 50) */
  driverCount: number;
  /** Current simulation phase:
   * 0 = Normal conditions (400 online, stable)
   * 1 = Shortage collapse (50 online, anomaly)
   * 2 = Anomaly scan running (green laser sweep)
   * 3 = Fare protected outcome (illustrative resolution)
   */
  phase: 0 | 1 | 2 | 3;
  className?: string;
  isHero?: boolean;
  selectedDriver?: DriverNodeData | null;
  onSelectDriver?: (driver: DriverNodeData | null) => void;
}

interface NodePoint {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  seed: number;
  r: number;
  phaseOffset: number;
  driver: DriverNodeData;
}

const DRIVER_NAMES = [
  "Aarav Sharma", "Rohan Patel", "Vikram Singh", "Rajesh Gupta", "Suresh Yadav",
  "Sunil Nair", "Amit Deshmukh", "Pooja Mehta", "Ganesh Kadam", "Karan Malhotra",
  "Mohammed Ansari", "Deepak Verma", "Sachin Jadhav", "Anand More", "Prakash Sawant",
  "Nitin Bhosale", "Rahul Gaikwad", "Santosh Kamble", "Vijay Shinde", "Manoj Patil",
  "Ashok Chavan", "Sanjay Thorat", "Pradeep Salvi", "Kishore Mane", "Ramesh Koli",
  "Dinesh Jadhav", "Mahesh Kulkarni", "Prashant Tawde", "Irfan Khan", "Zubair Shaikh"
];

const AIRPORT_LOCATIONS = [
  "Terminal 2 Departures Ramp (P4 Level)",
  "Terminal 2 Arrivals Bay 3 & Forecourt",
  "Terminal 1 Domestic Departures, Santacruz",
  "Sahar Elevated Access Flyover, Andheri East",
  "Air Cargo Complex Road / North Perimeter",
  "Vile Parle East Airport Perimeter Gate 7",
  "Western Express Highway Sahar Underpass",
  "Marol Pipeline Airport Cargo Approach",
  "Hotel Transit Hub / Sahar Airport Road",
  "CSMIA Terminal 2 International Arrivals Bay 4",
  "Kalina Airfield Transit Ring Road",
  "Kurla-Andheri Link Airport Concourse",
  "Airport East Gate Security Checkpoint",
  "Vile Parle Airfield Fuel Station Concourse"
];

const VEHICLES = [
  { desc: "Standard Sedan · Dzire (MH-02-EE-4921)", type: "sedan" as const },
  { desc: "Standard Sedan · Etios (MH-03-DZ-1104)", type: "sedan" as const },
  { desc: "Standard Sedan · Aura (MH-01-CF-3392)", type: "sedan" as const },
  { desc: "Auto-Rickshaw · Bajaj RE (MH-02-RC-8819)", type: "rickshaw" as const },
  { desc: "Auto-Rickshaw · TVS King (MH-03-TC-5521)", type: "rickshaw" as const },
  { desc: "Premium SUV · Ertiga (MH-04-AB-3291)", type: "suv" as const },
  { desc: "Premium SUV · Innova Crysta (MH-02-XY-7710)", type: "suv" as const },
  { desc: "Compact Hatchback · WagonR (MH-02-BT-9140)", type: "compact" as const },
  { desc: "Compact Hatchback · Celerio (MH-03-MN-4281)", type: "compact" as const }
];

/**
 * Generates synthetic driver points with realistic Mumbai airport coordinates and telemetry
 */
function generatePoints(count: number, isHero: boolean = false): NodePoint[] {
  const points: NodePoint[] = [];
  const rand = (min: number, max: number) => min + Math.random() * (max - min);

  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    // Gaussian-like density towards airport terminal ring
    const radius = Math.sqrt(Math.random());
    const x = 0.5 + Math.cos(angle) * radius * (isHero ? 0.44 : 0.42);
    const y = 0.52 + Math.sin(angle) * radius * (isHero ? 0.35 : 0.34);

    const name = DRIVER_NAMES[i % DRIVER_NAMES.length];
    const loc = AIRPORT_LOCATIONS[i % AIRPORT_LOCATIONS.length];
    const veh = VEHICLES[i % VEHICLES.length];
    const distMeters = Math.round(180 + radius * 1400);

    const driver: DriverNodeData = {
      id: `driver_${1000 + (i % 900)}`,
      name,
      phone: `+91 98201 ${11000 + (i % 900)}`,
      vehicle: veh.desc,
      vehicleType: veh.type,
      locationName: loc,
      lat: Number((19.0886 + (y - 0.52) * 0.04).toFixed(5)),
      lng: Number((72.8679 + (x - 0.5) * 0.05).toFixed(5)),
      distToTerminalMeters: distMeters,
      rating: `${(4.8 + (i % 20) * 0.01).toFixed(2)} ★`,
      status: "online",
      heartbeatSec: Number((0.6 + (i % 15) * 0.1).toFixed(1)),
      nodeIndex: i,
    };

    points.push({
      x,
      y,
      seed: Math.random(),
      r: rand(1.3, 2.3),
      phaseOffset: rand(0, Math.PI * 2),
      driver,
    });
  }
  return points;
}

export function SurgeNetworkCanvas({
  driverCount,
  phase,
  className,
  isHero = false,
  selectedDriver,
  onSelectDriver,
}: SurgeNetworkCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const scanProgressRef = useRef(0);
  const [hoveredDriver, setHoveredDriver] = useState<DriverNodeData | null>(null);

  const points = useMemo(
    () => generatePoints(isHero ? 180 : 400, isHero),
    [isHero]
  );

  // Active indices based on driver count
  const { activeIndices } = useMemo(() => {
    const totalPoints = points.length;
    const activeCount = Math.max(1, Math.round((driverCount / 400) * totalPoints));
    const sorted = points
      .map((p, idx) => ({ p, idx }))
      .sort((a, b) => a.p.seed - b.p.seed);
    const set = new Set(sorted.slice(0, activeCount).map((s) => s.idx));
    return { activeIndices: set };
  }, [points, driverCount]);

  // Click & hover hit-testing on Canvas
  const handlePointerInteraction = (
    e: React.MouseEvent<HTMLCanvasElement>,
    isClick: boolean
  ) => {
    if (isHero) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let closestDist = Infinity;
    let closestNode: NodePoint | null = null;

    // Search active driver nodes
    for (let i = 0; i < points.length; i++) {
      if (!activeIndices.has(i)) continue;
      const pt = points[i];
      const px = pt.x * rect.width;
      const py = pt.y * rect.height;
      const d = Math.hypot(mouseX - px, mouseY - py);

      if (d < closestDist) {
        closestDist = d;
        closestNode = pt;
      }
    }

    // Hover threshold: within 22px
    if (closestNode && closestDist < 26) {
      const drv = closestNode.driver;
      if (isClick) {
        onSelectDriver?.(drv);
      } else {
        setHoveredDriver(drv);
      }
    } else {
      if (isClick) {
        // If clicked on empty space, select nearest driver anyway
        if (closestNode) {
          onSelectDriver?.(closestNode.driver);
        }
      } else {
        setHoveredDriver(null);
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = 0;
    let height = 0;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width || 600;
      height = rect.height || 340;
      canvas.width = Math.max(1, width * dpr);
      canvas.height = Math.max(1, height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const totalPoints = points.length;
    let lastTime = performance.now();

    const render = (time: number) => {
      const delta = Math.min(50, time - lastTime);
      lastTime = time;

      // Update scan beam progress during phase 2
      if (phase === 2 && !shouldReduceMotion) {
        scanProgressRef.current = (scanProgressRef.current + delta * 0.00075) % 1;
      }

      ctx.clearRect(0, 0, width, height);

      // Deep Charcoal Radar Screen
      ctx.fillStyle = "#0c0f0d";
      ctx.fillRect(0, 0, width, height);

      // Radar Concentric Range Rings (BOM Terminal 2 centered)
      const centerX = width * 0.5;
      const centerY = height * 0.52;

      ctx.save();
      ctx.strokeStyle = "rgba(54, 199, 138, 0.05)";
      ctx.lineWidth = 1;
      for (let r = 1; r <= 4; r++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r * (Math.min(width, height) * 0.12), 0, Math.PI * 2);
        ctx.stroke();
      }

      // Compass Crosshairs
      ctx.strokeStyle = "rgba(230, 238, 232, 0.05)";
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - height * 0.45);
      ctx.lineTo(centerX, centerY + height * 0.45);
      ctx.moveTo(centerX - width * 0.45, centerY);
      ctx.lineTo(centerX + width * 0.45, centerY);
      ctx.stroke();

      // Schematic Runway Geometry
      ctx.strokeStyle = "rgba(230, 238, 232, 0.12)";
      ctx.beginPath();
      ctx.moveTo(width * 0.12, height * 0.1);
      ctx.lineTo(width * 0.42, height * 0.9);
      ctx.lineTo(width * 0.82, height * 0.72);
      ctx.moveTo(width * 0.08, height * 0.78);
      ctx.lineTo(width * 0.4, height * 0.27);
      ctx.lineTo(width * 0.93, height * 0.4);
      ctx.stroke();

      // Airport Zone Perimeter box
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = "rgba(230, 238, 232, 0.16)";
      ctx.strokeRect(width * 0.32, height * 0.34, width * 0.36, height * 0.28);
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(230, 238, 232, 0.4)";
      ctx.font = "600 10px 'Hanken Grotesk', sans-serif";
      ctx.fillText("CSMIA TERMINAL 2 · AIRPORT ZONE A", width * 0.33, height * 0.31);
      ctx.restore();

      const pos = points.map((p) => ({
        x: p.x * width,
        y: p.y * height,
      }));

      // Render Inter-node Network Connections
      const maxDistance = Math.min(width, height) * 0.14;
      for (let i = 0; i < totalPoints; i++) {
        if (!activeIndices.has(i)) continue;
        let connections = 0;

        for (let j = i + 1; j < totalPoints && connections < 3; j++) {
          if (!activeIndices.has(j)) continue;

          const dx = pos[i].x - pos[j].x;
          const dy = pos[i].y - pos[j].y;
          const dist = Math.hypot(dx, dy);

          if (dist < maxDistance && points[i].seed + points[j].seed < 1.2) {
            ctx.beginPath();
            ctx.moveTo(pos[i].x, pos[i].y);
            ctx.lineTo(pos[j].x, pos[j].y);

            // Flagged anomaly links in green
            const isAnomalyLink = (phase === 2 || phase === 3) && (i + j) % 11 === 0;
            if (isAnomalyLink) {
              ctx.strokeStyle = "rgba(54, 199, 138, 0.75)";
              ctx.lineWidth = 1.1;
            } else {
              const alpha = Math.max(0.02, 0.18 - dist / (maxDistance * 1.1));
              ctx.strokeStyle = `rgba(220, 230, 223, ${alpha})`;
              ctx.lineWidth = 0.65;
            }

            ctx.stroke();
            connections++;
          }
        }
      }

      // Render Scanning Beam in Phase 2
      if (phase === 2 && !shouldReduceMotion) {
        const scanX = ((scanProgressRef.current * 1.3) - 0.15) * width;
        const grad = ctx.createLinearGradient(scanX - 35, 0, scanX + 35, 0);
        grad.addColorStop(0, "rgba(18, 168, 117, 0)");
        grad.addColorStop(0.5, "rgba(18, 168, 117, 0.22)");
        grad.addColorStop(1, "rgba(18, 168, 117, 0)");

        ctx.fillStyle = grad;
        ctx.fillRect(scanX - 35, 0, 70, height);

        ctx.strokeStyle = "rgba(54, 199, 138, 0.85)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(scanX, 0);
        ctx.lineTo(scanX, height);
        ctx.stroke();
      }

      // Render Nodes (Simulated Available Drivers)
      const targetedId = selectedDriver?.id || hoveredDriver?.id;

      points.forEach((p, i) => {
        if (!activeIndices.has(i)) return;
        const pt = pos[i];
        const pulse = shouldReduceMotion
          ? 1
          : Math.sin(time * 0.0018 + p.phaseOffset) * 0.45 + 0.55;

        const isFlagged = (phase === 2 || phase === 3) && i % 13 === 0;
        const isTargeted = p.driver.id === targetedId;

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, p.r + (isFlagged ? pulse * 0.8 : 0) + (isTargeted ? 1.5 : 0), 0, Math.PI * 2);

        if (isTargeted) {
          ctx.fillStyle = "#ffffff";
        } else if (isFlagged) {
          ctx.fillStyle = "#36c78a";
        } else {
          ctx.fillStyle = `rgba(242, 246, 243, ${0.5 + pulse * 0.45})`;
        }
        ctx.fill();

        // Pulsing radar ring for flagged anomalies
        if (isFlagged) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 6 + pulse * 2, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(54, 199, 138, 0.4)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Targeted / Selected Driver High-Visibility Reticle
        if (isTargeted) {
          // Double reticle
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 8 + pulse * 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = "#36c78a";
          ctx.lineWidth = 1.4;
          ctx.stroke();

          // Guide line from driver to terminal
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(centerX, centerY);
          ctx.strokeStyle = "rgba(54, 199, 138, 0.45)";
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      // Terminal Center Marker
      if (!isHero) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(centerX, centerY, 11, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#0c0f0d";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("✈", centerX, centerY);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, [driverCount, phase, isHero, shouldReduceMotion, points, activeIndices, selectedDriver, hoveredDriver]);

  return (
    <div ref={containerRef} className="relative h-full w-full select-none">
      <canvas
        ref={canvasRef}
        onMouseMove={(e) => handlePointerInteraction(e, false)}
        onMouseLeave={() => setHoveredDriver(null)}
        onClick={(e) => handlePointerInteraction(e, true)}
        className={cn(
          "block h-full w-full",
          !isHero && "cursor-crosshair",
          className
        )}
        role="img"
        aria-label="Interactive simulated driver network map across Mumbai Airport zone"
      />

      {/* Floating Interactive Hover Tooltip on Canvas */}
      {hoveredDriver && !isHero && (
        <div className="absolute top-12 left-4 pointer-events-none z-30 bg-black/85 backdrop-blur-md border border-neutral-700 p-2.5 shadow-xl text-left font-sans max-w-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between gap-2 text-[10px] text-neutral-400 mb-0.5">
            <span className="text-white font-bold">{hoveredDriver.id}</span>
            <span className="text-emerald-400 font-semibold">{hoveredDriver.rating}</span>
          </div>
          <div className="text-xs text-white font-sans font-semibold mb-1">
            {hoveredDriver.name}
          </div>
          <div className="text-[10px] text-neutral-300 leading-tight mb-1">
            {hoveredDriver.vehicle}
          </div>
          <div className="text-[9px] text-neutral-400 truncate flex items-center gap-1">
            <span className="text-emerald-400">📍</span>
            {hoveredDriver.locationName}
          </div>
          <div className="mt-1 pt-1 border-t border-neutral-800 text-[9px] text-neutral-500 flex justify-between">
            <span>{hoveredDriver.distToTerminalMeters}m to T2</span>
            <span>Click to lock & inspect</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default SurgeNetworkCanvas;
