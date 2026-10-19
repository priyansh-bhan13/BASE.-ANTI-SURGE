"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Menu, X, ArrowRight } from "lucide-react";

export type NavDestination =
  | "landing"
  | "rider"
  | "drive"
  | "about"
  | "feedback"
  | "how-surge-works"
  | "safety"
  | "login"
  | "signup";

export interface BaseNavbarProps {
  activeRoute?: NavDestination;
  onNavigate?: (destination: NavDestination) => void;
  variant?: "dark" | "light";
  className?: string;
}

interface NavItem {
  id: "rider" | "drive" | "about" | "feedback" | "how-surge-works" | "safety";
  label: string;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "rider", label: "Ride" },
  { id: "drive", label: "Drive" },
  { id: "about", label: "About" },
  { id: "feedback", label: "Feedback" },
  {
    id: "how-surge-works",
    label: "How surge works",
    badge: "EXPLORER",
  },
  { id: "safety", label: "Safety" },
];

export function BaseNavbar({
  activeRoute = "landing",
  onNavigate,
  variant = "dark",
  className = "",
}: BaseNavbarProps) {
  const shouldReduceMotion = useReducedMotion();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLElement | null>>({});

  const [cursorStyle, setCursorStyle] = useState<{
    left: number;
    width: number;
    opacity: number;
  }>({ left: 0, width: 0, opacity: 0 });

  // Measure and align sliding indicator to a specific item
  const updateCursorToKey = useCallback((key: string | null) => {
    if (!key) {
      setCursorStyle((prev) => ({ ...prev, opacity: 0 }));
      return;
    }
    const el = tabRefs.current[key];
    const container = containerRef.current;
    if (el && container) {
      const elRect = el.getBoundingClientRect();
      const contRect = container.getBoundingClientRect();
      setCursorStyle({
        left: elRect.left - contRect.left,
        width: elRect.width,
        opacity: 1,
      });
    } else {
      setCursorStyle((prev) => ({ ...prev, opacity: 0 }));
    }
  }, []);

  // Sync cursor when activeRoute changes, fonts load, or window resizes
  useEffect(() => {
    const activeKey =
      NAV_ITEMS.some((i) => i.id === activeRoute) ? activeRoute : null;
    
    // Give browser microtask to render DOM dimensions
    const timeout = setTimeout(() => {
      updateCursorToKey(activeKey);
    }, 40);

    const handleResize = () => {
      updateCursorToKey(hoveredKey || activeKey);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", handleResize);
    };
  }, [activeRoute, hoveredKey, updateCursorToKey]);

  // Handle ESC key for mobile menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  // Central navigation trigger
  const handleItemClick = (destination: NavDestination, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setMobileMenuOpen(false);

    if (onNavigate) {
      onNavigate(destination);
      return;
    }

    if (destination === "safety") {
      const safetyEl = document.getElementById("safety");
      if (safetyEl) {
        safetyEl.scrollIntoView({ behavior: "smooth" });
      } else {
        window.location.hash = "#safety";
      }
      return;
    }

    const path = destination === "landing" ? "/" : `/${destination}`;
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const isDark = variant === "dark";

  return (
    <header
      className={`sticky top-0 z-40 w-full transition-colors ${
        isDark
          ? "border-b border-neutral-800 bg-black text-white"
          : "border-b border-neutral-200/90 bg-white/95 backdrop-blur-md text-black"
      } ${className}`}
    >
      <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
        {/* ===================================================================
            LEFT BRAND GROUP: BASE Wordmark + SURGE GUARD Badge
            =================================================================== */}
        <div className="flex items-center gap-8">
          <a
            href="/"
            onClick={(e) => handleItemClick("landing", e)}
            className="flex items-center gap-2 font-extrabold text-[22px] tracking-[-0.04em] focus:outline-none focus:ring-1 focus:ring-white transition-opacity hover:opacity-90 cursor-pointer"
            aria-label="BASE Homepage"
          >
            <span>Base</span>
            <span
              className={`text-[10px] uppercase font-sans font-semibold tracking-widest px-2 py-0.5 border ${
                isDark
                  ? "bg-white/10 text-neutral-300 border-white/20"
                  : "bg-black text-white border-black"
              }`}
            >
              Surge Guard
            </span>
          </a>

          {/* ===================================================================
              DESKTOP CENTER NAV: Sliding Indicator Navigation
              =================================================================== */}
          <nav
            aria-label="Main Navigation"
            className="hidden lg:flex items-center"
          >
            <div
              ref={containerRef}
              onMouseLeave={() => {
                setHoveredKey(null);
                const activeKey = NAV_ITEMS.some((i) => i.id === activeRoute)
                  ? activeRoute
                  : null;
                updateCursorToKey(activeKey);
              }}
              className={`relative flex items-center p-1 rounded-none border transition-colors ${
                isDark
                  ? "bg-neutral-900 border-neutral-800 shadow-inner"
                  : "bg-neutral-100 border-neutral-300 shadow-inner"
              }`}
            >
              {/* Animated Sliding Cursor Box (Framer Motion spring)
                  High-contrast: Solid WHITE when background is black,
                  Solid BLACK when background is white. */}
              <motion.div
                className={`absolute top-1 bottom-1 rounded-none pointer-events-none z-0 ${
                  isDark
                    ? "bg-white text-black shadow-xs"
                    : "bg-black text-white shadow-xs"
                }`}
                initial={false}
                animate={{
                  left: cursorStyle.left,
                  width: cursorStyle.width,
                  opacity: cursorStyle.opacity,
                }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 480, damping: 36 }
                }
              />

              {NAV_ITEMS.map((item) => {
                const isActive = activeRoute === item.id;
                const isHovered = hoveredKey === item.id;
                const isSelected = isHovered || (isActive && hoveredKey === null);

                return (
                  <button
                    key={item.id}
                    ref={(el) => {
                      tabRefs.current[item.id] = el;
                    }}
                    type="button"
                    onClick={(e) => handleItemClick(item.id, e)}
                    onMouseEnter={() => {
                      setHoveredKey(item.id);
                      updateCursorToKey(item.id);
                    }}
                    onFocus={() => {
                      setHoveredKey(item.id);
                      updateCursorToKey(item.id);
                    }}
                    className={`relative z-10 flex items-center gap-2 px-4 py-2 text-[13px] sm:text-sm font-sans uppercase tracking-[0.08em] rounded-none transition-colors duration-150 cursor-pointer focus:outline-none ${
                      isSelected
                        ? isDark
                          ? "text-black font-extrabold"
                          : "text-white font-extrabold"
                        : isDark
                        ? "text-neutral-400 font-semibold hover:text-white"
                        : "text-neutral-700 font-semibold hover:text-black"
                    }`}
                  >
                    <span>{item.label}</span>

                    {/* Associated EXPLORER Badge for How Surge Works */}
                    {item.badge && (
                      <span
                        className={`text-[10px] font-sans font-bold tracking-wider px-2 py-0.5 border rounded-none transition-colors ${
                          isSelected
                            ? isDark
                              ? "text-emerald-950 bg-emerald-200 border-emerald-400"
                              : "text-emerald-300 bg-emerald-950 border-emerald-600"
                            : isDark
                            ? "text-emerald-400 bg-emerald-950/70 border-emerald-800"
                            : "text-emerald-700 bg-emerald-50 border-emerald-300"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>

        {/* ===================================================================
            RIGHT AUTH ACTIONS: Log In & Sign Up
            =================================================================== */}
        <div className="hidden sm:flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => handleItemClick("login", e)}
            className={`text-sm font-sans font-bold uppercase tracking-wider px-4 py-2 transition-colors cursor-pointer border rounded-none ${
              activeRoute === "login"
                ? isDark
                  ? "bg-white text-black border-white"
                  : "bg-black text-white border-black"
                : isDark
                ? "text-neutral-300 hover:text-white border-transparent hover:border-neutral-800 hover:bg-neutral-900"
                : "text-neutral-700 hover:text-black border-transparent hover:border-neutral-200 hover:bg-neutral-100"
            }`}
          >
            Log in
          </button>

          <button
            type="button"
            onClick={(e) => handleItemClick("signup", e)}
            className={`text-sm font-sans font-bold uppercase tracking-wider px-5 py-2.5 transition-all cursor-pointer shadow-xs rounded-none ${
              activeRoute === "signup"
                ? isDark
                  ? "bg-white text-black ring-2 ring-white/50"
                  : "bg-black text-white ring-2 ring-black/50"
                : isDark
                ? "bg-white text-black hover:bg-neutral-200"
                : "bg-black text-white hover:bg-neutral-800"
            }`}
          >
            Sign up
          </button>
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className={`p-2 transition-colors focus:outline-none cursor-pointer border rounded-none ${
              isDark
                ? "text-white border-neutral-800 hover:bg-neutral-900"
                : "text-black border-neutral-300 hover:bg-neutral-100"
            }`}
            aria-label={mobileMenuOpen ? "Close menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* ===================================================================
          MOBILE NAVIGATION DRAWER
          =================================================================== */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className={`lg:hidden border-t overflow-hidden ${
              isDark
                ? "border-neutral-800 bg-black text-white"
                : "border-neutral-200 bg-white text-black"
            }`}
          >
            <div className="px-6 py-5 space-y-2">
              {NAV_ITEMS.map((item) => {
                const isActive = activeRoute === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(e) => handleItemClick(item.id, e)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-sm font-sans uppercase tracking-wider transition-colors cursor-pointer text-left rounded-none ${
                      isActive
                        ? isDark
                          ? "bg-white text-black font-extrabold"
                          : "bg-black text-white font-extrabold"
                        : isDark
                        ? "text-neutral-400 hover:text-white hover:bg-neutral-900 font-semibold"
                        : "text-neutral-700 hover:text-black hover:bg-neutral-100 font-semibold"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.badge ? (
                      <span
                        className={`text-[10px] font-sans font-bold tracking-wider px-2 py-0.5 border rounded-none ${
                          isActive
                            ? isDark
                              ? "text-emerald-950 bg-emerald-200 border-emerald-400"
                              : "text-emerald-300 bg-emerald-950 border-emerald-600"
                            : isDark
                            ? "text-emerald-400 bg-emerald-950/70 border-emerald-800"
                            : "text-emerald-700 bg-emerald-50 border-emerald-300"
                        }`}
                      >
                        {item.badge}
                      </span>
                    ) : (
                      <ArrowRight size={14} className="opacity-40" />
                    )}
                  </button>
                );
              })}

              <div
                className={`pt-3 border-t my-3 grid grid-cols-2 gap-3 ${
                  isDark ? "border-neutral-800" : "border-neutral-200"
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => handleItemClick("login", e)}
                  className={`w-full py-2.5 text-sm font-sans font-bold uppercase tracking-wider text-center border cursor-pointer transition-colors rounded-none ${
                    activeRoute === "login"
                      ? isDark
                        ? "bg-white text-black border-white"
                        : "bg-black text-white border-black"
                      : isDark
                      ? "border-neutral-700 text-white hover:bg-neutral-900"
                      : "border-neutral-300 text-black hover:bg-neutral-50"
                  }`}
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={(e) => handleItemClick("signup", e)}
                  className={`w-full py-2.5 text-sm font-sans font-bold uppercase tracking-wider text-center cursor-pointer transition-colors rounded-none ${
                    isDark
                      ? "bg-white text-black hover:bg-neutral-200"
                      : "bg-black text-white hover:bg-neutral-800"
                  }`}
                >
                  Sign up
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
