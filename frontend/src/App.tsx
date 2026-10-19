import React, { useState, useEffect } from "react";
import { ArcRevealHero } from "@/components/ui/arc-preloader-hero";
import { BaseNavbar, NavDestination } from "@/components/ui/BaseNavbar";
import RiderBookingPage from "@/pages/RiderBookingPage";
import DrivePage from "@/pages/DrivePage";
import StickyInfoPage from "@/pages/StickyInfoPage";
import HowSurgeWorksPage from "@/pages/HowSurgeWorksPage";
import { AuthDemoPage } from "@/pages/AuthDemoPage";
import {
  Clock,
  ArrowRight,
  ShieldCheck,
  Crosshair,
  Calendar,
  TrendingDown,
  UserCheck,
} from "lucide-react";

const RIDE_GREETINGS = [
  { text: "Predictable." },
  { text: "Protected." },
  { text: "Transparent." },
  { text: "Always 1.0x." },
  { text: "Base." },
];

export type AppView = "landing" | "rider" | "drive" | "about" | "feedback" | "how-surge-works" | "login" | "signup";

function getRouteView(): AppView {
  if (typeof window === "undefined") return "landing";
  const p = window.location.pathname.toLowerCase();
  const h = window.location.hash.toLowerCase();
  if (p === "/rider" || p === "/ride" || h === "#rider" || h === "#ride") return "rider";
  if (p === "/drive" || h === "#drive") return "drive";
  if (p === "/about" || h === "#about") return "about";
  if (p === "/feedback" || h === "#feedback") return "feedback";
  if (p === "/how-surge-works" || p === "/howsurgeworks" || h === "#how-surge-works" || h === "#howsurgeworks") return "how-surge-works";
  if (p === "/login" || h === "#login") return "login";
  if (p === "/signup" || h === "#signup") return "signup";
  return "landing";
}

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>(getRouteView);
  const [pickup, setPickup] = useState("Bandra Kurla Complex (BKC), Mumbai");
  const [destination, setDestination] = useState("Chhatrapati Shivaji Maharaj International Airport (BOM)");
  const [rideTime, setRideTime] = useState<"now" | "schedule">("now");
  const [selectedCategory, setSelectedCategory] = useState<"ride" | "drive">("ride");

  useEffect(() => {
    const syncView = () => {
      setCurrentView(getRouteView());
    };
    window.addEventListener("popstate", syncView);
    window.addEventListener("hashchange", syncView);
    syncView();
    return () => {
      window.removeEventListener("popstate", syncView);
      window.removeEventListener("hashchange", syncView);
    };
  }, []);

  const navigateToView = (view: NavDestination | AppView) => {
    if (view === "safety") {
      if (currentView !== "landing") {
        window.history.pushState({}, "", "/#safety");
        setCurrentView("landing");
        setTimeout(() => {
          document.getElementById("safety")?.scrollIntoView({ behavior: "smooth" });
        }, 80);
      } else {
        document.getElementById("safety")?.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }

    const path = view === "landing" ? "/" : `/${view}`;
    window.history.pushState({}, "", path);
    setCurrentView(view as AppView);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  const navigateToRider = () => navigateToView("rider");
  const navigateToDrive = () => navigateToView("drive");
  const navigateToLanding = () => navigateToView("landing");
  const navigateToAbout = () => navigateToView("about");
  const navigateToFeedback = () => navigateToView("feedback");
  const navigateToHowSurgeWorks = () => navigateToView("how-surge-works");

  const handleFeedbackSubmit = async (formData: FormData): Promise<void> => {
    const payload = {
      name: formData.get("name")?.toString() || "",
      email: formData.get("email")?.toString() || "",
      feedback_type: formData.get("type")?.toString() || "suggestion",
      message: formData.get("message")?.toString() || "",
    };

    let backendReceived = false;
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        backendReceived = true;
      } else {
        throw new Error(`Server returned status ${res.status}`);
      }
    } catch (err: any) {
      if (err.message && err.message.includes("Server returned")) {
        throw err;
      }
      // If server is not running or network request cannot connect, save locally
      try {
        const stored = JSON.parse(localStorage.getItem("base_feedback_entries") || "[]");
        stored.push({
          ...payload,
          id: "fb_" + Date.now(),
          timestamp: new Date().toISOString(),
          localOnly: true,
        });
        localStorage.setItem("base_feedback_entries", JSON.stringify(stored));
      } catch {
        throw new Error("Unable to save feedback");
      }
    }
  };

  const popularLocations = [
    { name: "BKC Commercial Hub", area: "Bandra East" },
    { name: "Bandra West Station", area: "Linking Road" },
    { name: "Mumbai Airport T2", area: "Sahar, Andheri" },
    { name: "Jio World Drive", area: "BKC" },
  ];

  if (currentView === "rider") {
    return (
      <RiderBookingPage
        onBackToLanding={navigateToLanding}
        onNavigate={navigateToView}
      />
    );
  }

  if (currentView === "drive") {
    return (
      <DrivePage
        onBackToLanding={navigateToLanding}
        onNavigateToRide={navigateToRider}
        onNavigateToAbout={navigateToAbout}
        onNavigateToFeedback={navigateToFeedback}
        onNavigateToHowSurgeWorks={navigateToHowSurgeWorks}
      />
    );
  }

  if (currentView === "about") {
    return (
      <StickyInfoPage
        page="about"
        onNavigate={navigateToView}
      />
    );
  }

  if (currentView === "feedback") {
    return (
      <StickyInfoPage
        page="feedback"
        onNavigate={navigateToView}
        onSubmitFeedback={handleFeedbackSubmit}
      />
    );
  }

  if (currentView === "how-surge-works") {
    return (
      <HowSurgeWorksPage
        onNavigateToRide={navigateToRider}
        onNavigateToDrive={navigateToDrive}
        onNavigateToAbout={navigateToAbout}
        onNavigateToFeedback={navigateToFeedback}
        onNavigateToLanding={navigateToLanding}
      />
    );
  }

  if (currentView === "login" || currentView === "signup") {
    return (
      <AuthDemoPage
        initialMode={currentView}
        onNavigate={navigateToView}
      />
    );
  }

  return (
    <ArcRevealHero
      greetings={RIDE_GREETINGS}
      className="bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
    >
      {/* =========================================================================
          Top Navigation Bar (Animated Sliding-Pill BaseNavbar)
          ========================================================================= */}
      <BaseNavbar
        variant="dark"
        activeRoute="landing"
        onNavigate={navigateToView}
      />

      {/* =========================================================================
          Hero Section with Uber "Where to?" Search Box
          ========================================================================= */}
      <section className="relative overflow-hidden pt-14 pb-24 md:pt-20 md:pb-32 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Uber-like Booking Card */}
          <div className="lg:col-span-6 z-10">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-xs sm:text-sm font-sans font-bold uppercase tracking-[0.1em] text-neutral-800 dark:text-neutral-200 mb-6">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Guaranteed Surge-Price Protection Active
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-[76px] font-extrabold tracking-[-0.03em] text-neutral-950 dark:text-white leading-[1.02] mb-6 font-sans">
              Go anywhere. <br />
              Never pay manipulated fares.
            </h1>
            <p className="text-xl sm:text-2xl text-neutral-600 dark:text-neutral-300 font-normal mb-8 max-w-xl leading-relaxed">
              Base uses algorithmic multi-signal verification to shield riders from artificial shortage price spikes across Mumbai.
            </p>

            {/* Uber Search Card */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-5 mb-5">
                <button
                  type="button"
                  onClick={() => setRideTime("now")}
                  className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider px-4 py-2.5 transition-colors cursor-pointer ${
                    rideTime === "now"
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Pickup now
                </button>
                <button
                  type="button"
                  onClick={() => setRideTime("schedule")}
                  className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider px-4 py-2.5 transition-colors cursor-pointer ${
                    rideTime === "schedule"
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white"
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Schedule for later
                </button>
              </div>

              {/* Pickup Input */}
              <div className="relative mb-4">
                <div className="absolute left-4 top-4 w-2.5 h-2.5 bg-black dark:bg-white rounded-none" />
                <input
                  type="text"
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  placeholder="Enter pickup location"
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 pl-11 pr-12 py-3.5 text-base text-neutral-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                />
                <button
                  title="Use current location"
                  className="absolute right-3.5 top-3.5 text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
                >
                  <Crosshair className="w-5 h-5" />
                </button>
              </div>

              {/* Destination Input */}
              <div className="relative mb-6">
                <div className="absolute left-4 top-4 w-2.5 h-2.5 border-2 border-black dark:border-white rounded-none" />
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Where to?"
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 pl-11 pr-4 py-3.5 text-base text-neutral-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                />
              </div>

              {/* Quick Preset Pills */}
              <div className="flex flex-wrap gap-2.5 mb-7">
                <span className="text-xs sm:text-sm font-sans font-bold text-neutral-500 uppercase self-center mr-1">Quick:</span>
                {popularLocations.map((loc) => (
                  <button
                    key={loc.name}
                    type="button"
                    onClick={() => setDestination(loc.name)}
                    className="text-xs sm:text-sm font-medium border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 hover:border-black dark:hover:border-white px-3.5 py-1.5 text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer"
                  >
                    {loc.name}
                  </button>
                ))}
              </div>

              {/* See Prices CTA Button */}
              <button
                type="button"
                onClick={navigateToRider}
                className="w-full flex items-center justify-center gap-3 bg-black hover:bg-neutral-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 font-bold text-base uppercase tracking-wider py-4 sm:py-4.5 transition-colors cursor-pointer"
              >
                <span>See prices</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Right Column: Visual Product Showcase */}
          <div className="lg:col-span-6 relative">
            <div className="relative border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-neutral-100 dark:bg-neutral-900 aspect-[4/3] group">
              <img
                src="https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1200&q=80"
                alt="City ride passenger"
                className="w-full h-full object-cover grayscale contrast-125 transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* Overlay Interactive Badge */}
              <div className="absolute bottom-6 left-6 right-6 p-5 bg-black/90 text-white border border-white/20 backdrop-blur-md">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-emerald-400 animate-pulse" />
                    <span className="text-xs sm:text-sm font-sans font-bold uppercase tracking-wider text-emerald-400">Real-Time Protection</span>
                  </div>
                  <span className="text-xs sm:text-sm font-sans font-bold text-neutral-300">Zone: BKC</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-base sm:text-lg font-semibold">Bandra Kurla Complex &rarr; Airport T2</div>
                    <div className="text-sm text-neutral-300 font-sans font-medium">11.4 km • 24 min</div>
                  </div>
                  <div className="text-right font-sans">
                    <span className="text-sm line-through text-neutral-400 mr-2.5 font-medium">₹480 (2.2×)</span>
                    <span className="text-2xl sm:text-3xl font-black text-white">₹218</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* =========================================================================
          Feature 1: Price-Protected Rides Highlight
          ========================================================================= */}
      <section className="py-24 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-14 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-sans font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-4">
                <TrendingDown className="w-4 h-4" />
                Algorithmic Integrity
              </div>
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-950 dark:text-white leading-[1.08] mb-6">
                Why pay for manufactured shortages?
              </h2>
              <p className="text-lg sm:text-xl text-neutral-600 dark:text-neutral-400 font-normal leading-relaxed mb-8">
                On typical ride apps, when groups of drivers toggle offline together outside office hubs, the algorithm responds with a sudden surge price jump. Base actively detects coordinated supply drops and locks your fare at the standard base price.
              </p>
              
              <ul className="space-y-5 mb-8">
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-black dark:bg-white text-white dark:text-black flex items-center justify-center text-xs font-sans font-bold mt-1">
                    1
                  </div>
                  <div>
                    <strong className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white block">Pre-Shortage Benchmark Freeze</strong>
                    <span className="text-base text-neutral-600 dark:text-neutral-400 font-normal">
                      Your quote is held steady at 1.0× while our background engine verifies zone supply authenticity.
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-black dark:bg-white text-white dark:text-black flex items-center justify-center text-xs font-sans font-bold mt-1">
                    2
                  </div>
                  <div>
                    <strong className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white block">5-Signal Algorithmic Verification</strong>
                    <span className="text-base text-neutral-600 dark:text-neutral-400 font-normal">
                      Synthesizes ride volume, vehicle geolocations, traffic density, and telemetry heartbeat gates.
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-black dark:bg-white text-white dark:text-black flex items-center justify-center text-xs font-sans font-bold mt-1">
                    3
                  </div>
                  <div>
                    <strong className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white block">Transparent Fare Receipts</strong>
                    <span className="text-base text-neutral-600 dark:text-neutral-400 font-normal">
                      See exactly how many rupees you were protected from overpaying on every single booking.
                    </span>
                  </div>
                </li>
              </ul>

              <button
                type="button"
                onClick={navigateToHowSurgeWorks}
                className="inline-flex items-center gap-2 text-base font-bold uppercase tracking-wider text-black dark:text-white hover:underline underline-offset-4 cursor-pointer text-left"
              >
                Learn how the math works &rarr;
              </button>
            </div>

            {/* Comparison Visual Card */}
            <div className="border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-black p-8 sm:p-10">
              <div className="text-xs sm:text-sm font-sans font-bold uppercase tracking-wider text-neutral-500 mb-6 border-b border-neutral-200 dark:border-neutral-800 pb-3">
                Live Fare Comparison • Mumbai BKC
              </div>

              <div className="space-y-6">
                {/* Traditional Platform */}
                <div className="p-5 border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-base font-semibold text-neutral-700 dark:text-neutral-300">Other Ride Apps</span>
                    <span className="text-xs sm:text-sm font-sans font-bold uppercase bg-red-100 dark:bg-red-900/80 text-red-700 dark:text-red-300 px-2.5 py-1">
                      2.2× Surge Unchecked
                    </span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-extrabold font-sans text-neutral-900 dark:text-white">₹520</div>
                  <div className="text-sm text-neutral-500 mt-1.5">Passenger pays unverified shortage premium</div>
                </div>

                {/* Base Protected Platform */}
                <div className="p-5 border-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 relative">
                  <div className="absolute top-0 right-0 bg-emerald-600 text-white font-sans font-bold text-xs uppercase tracking-wider px-3 py-1">
                    Protected
                  </div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-base font-bold text-neutral-900 dark:text-white">Base Ride</span>
                    <span className="text-xs sm:text-sm font-sans font-bold uppercase bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 px-2.5 py-1">
                      1.0× Stable Rate
                    </span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-extrabold font-sans text-emerald-700 dark:text-emerald-300">₹235</div>
                  <div className="text-sm text-emerald-800 dark:text-emerald-400 mt-1.5 font-medium">
                    You save ₹285 from artificial price spike
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          Feature 2: Ride Fleet Options (Moto, Auto, UberGo, Premier, XL)
          ========================================================================= */}
      <section className="py-24 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-14">
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-950 dark:text-white mb-3">
              Every ride, engineered for reliability
            </h2>
            <p className="text-lg sm:text-xl text-neutral-600 dark:text-neutral-400 font-normal">
              Choose from a versatile fleet across Mumbai with zero dynamic price manipulation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {[
              { name: "Moto", icon: "🏍️", desc: "Affordable solo travel", eta: "2 min", price: "₹45" },
              { name: "Auto", icon: "🛺", desc: "Quick city transits", eta: "3 min", price: "₹75" },
              { name: "BaseGo", icon: "🚗", desc: "Everyday comfortable sedans", eta: "4 min", price: "₹140" },
              { name: "Premier", icon: "🚙", desc: "Top-rated drivers & cars", eta: "5 min", price: "₹220" },
              { name: "XL", icon: "🚐", desc: "Spacious rides for up to 6", eta: "7 min", price: "₹310" },
            ].map((v) => (
              <div
                key={v.name}
                className="border border-neutral-300 dark:border-neutral-800 p-6 sm:p-7 flex flex-col justify-between hover:border-black dark:hover:border-white transition-colors bg-neutral-50/50 dark:bg-neutral-900/50"
              >
                <div>
                  <div className="text-4xl sm:text-5xl mb-4">{v.icon}</div>
                  <h3 className="font-extrabold text-xl text-neutral-900 dark:text-white mb-1.5">{v.name}</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 font-normal mb-4">{v.desc}</p>
                </div>
                <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 flex justify-between items-baseline">
                  <span className="text-xs sm:text-sm font-sans font-bold text-neutral-500 uppercase">{v.eta} ETA</span>
                  <span className="font-extrabold font-sans text-xl sm:text-2xl text-neutral-900 dark:text-white">{v.price}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          Feature 3: Drive & Partner Integrity
          ========================================================================= */}
      <section className="py-24 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div className="order-2 lg:order-1">
            <div className="border border-neutral-200 dark:border-neutral-800 overflow-hidden aspect-[4/3]">
              <img
                src="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=1200&q=80"
                alt="Driver partner"
                className="w-full h-full object-cover grayscale contrast-125"
              />
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-sans font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-4">
              <UserCheck className="w-4 h-4" />
              Driver Partner Hub
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-950 dark:text-white leading-[1.08] mb-6">
              Drive with transparency. Earn with pride.
            </h2>
            <p className="text-lg sm:text-xl text-neutral-600 dark:text-neutral-400 font-normal leading-relaxed mb-6">
              Base rewards honest driver presence. When legitimate surges occur (such as sudden monsoons or late-night airport arrivals), drivers receive full, legitimate premium earnings without needing to coordinate artificial blackouts.
            </p>
            <div className="space-y-3.5 mb-8 text-base text-neutral-800 dark:text-neutral-200">
              <div className="flex items-center gap-2.5">
                <span className="text-emerald-500 font-bold">✓</span> Instant payouts with transparent platform fee deduction
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-emerald-500 font-bold">✓</span> Verified demand bonus incentives for entering high-traffic zones
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-emerald-500 font-bold">✓</span> No arbitrary deactivations — decisions backed by auditable data
              </div>
            </div>
            <a
              href="/drive"
              onClick={(e) => {
                e.preventDefault();
                navigateToDrive();
              }}
              className="inline-flex items-center gap-3 bg-black text-white dark:bg-white dark:text-black font-bold text-base uppercase tracking-wider px-8 py-4 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
            >
              <span>Explore Driver Hub</span>
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>

      {/* =========================================================================
          Feature 4: Safety & Security
          ========================================================================= */}
      <section id="safety" className="py-24 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-xl mb-14">
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-950 dark:text-white mb-3">
              Built with safety at the core
            </h2>
            <p className="text-lg sm:text-xl text-neutral-600 dark:text-neutral-400 font-normal">
              Every trip is monitored, verified, and backed by multiple layers of security.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="border border-neutral-300 dark:border-neutral-800 p-8 sm:p-9">
              <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center font-sans font-extrabold text-sm mb-6 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-800">
                OTP
              </div>
              <h3 className="font-extrabold text-xl text-neutral-950 dark:text-white mb-2.5">4-Digit PIN Verification</h3>
              <p className="text-base text-neutral-600 dark:text-neutral-400 font-normal leading-relaxed">
                Ensure you're stepping into the right car. The driver cannot begin the trip until they enter your personal 4-digit code.
              </p>
            </div>

            <div className="border border-neutral-300 dark:border-neutral-800 p-8 sm:p-9">
              <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center font-sans font-extrabold text-sm mb-6 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-800">
                GPS
              </div>
              <h3 className="font-extrabold text-xl text-neutral-950 dark:text-white mb-2.5">Live Trip Sharing</h3>
              <p className="text-base text-neutral-600 dark:text-neutral-400 font-normal leading-relaxed">
                Share your live route coordinates and estimated arrival time with friends or family in a single tap.
              </p>
            </div>

            <div className="border border-neutral-300 dark:border-neutral-800 p-8 sm:p-9">
              <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center font-sans font-extrabold text-sm mb-6 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-800">
                SOS
              </div>
              <h3 className="font-extrabold text-xl text-neutral-950 dark:text-white mb-2.5">24/7 Emergency Assistance</h3>
              <p className="text-base text-neutral-600 dark:text-neutral-400 font-normal leading-relaxed">
                One-touch access to local emergency services and the dedicated Base incident response team.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          City Coverage Section (Mumbai Zones)
          ========================================================================= */}
      <section className="py-20 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
            <div>
              <span className="text-xs sm:text-sm font-sans font-bold uppercase tracking-wider text-neutral-500">Service Coverage</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-950 dark:text-white mt-1.5">
                Active Mumbai Protection Zones
              </h2>
            </div>
            <span className="text-sm font-sans font-bold text-emerald-600 dark:text-emerald-400 mt-2 md:mt-0">
              ● All 6 Zones Operational
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { name: "Bandra Kurla Complex", code: "BKC", status: "Protected" },
              { name: "Bandra West", code: "BDW", status: "Protected" },
              { name: "Bandra East", code: "BDE", status: "Protected" },
              { name: "Kurla West", code: "KRL", status: "Protected" },
              { name: "Santacruz", code: "SCZ", status: "Protected" },
              { name: "Airport (BOM)", code: "AIR", status: "Protected" },
            ].map((zone) => (
              <div
                key={zone.code}
                className="border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-black p-5"
              >
                <div className="text-xs font-sans font-bold text-neutral-400 uppercase tracking-widest">{zone.code}</div>
                <div className="font-bold text-base text-neutral-900 dark:text-white mt-1.5">{zone.name}</div>
                <div className="text-xs font-sans font-bold text-emerald-600 dark:text-emerald-400 mt-2.5">Active</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          Footer
          ========================================================================= */}
      <footer className="bg-black text-white py-16 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 border-b border-neutral-800 pb-12 mb-8">
          <div>
            <div className="text-2xl font-bold tracking-tighter mb-4">Base</div>
            <p className="text-neutral-400 text-xs font-light leading-relaxed mb-4">
              Ride-hailing platform built with mathematical surge protection. Guaranteed fair market clearing without artificial price gouging.
            </p>
            <div className="text-xs font-sans text-neutral-500">© 2026 Base Technologies Inc.</div>
          </div>

          <div>
            <h4 className="font-bold text-sm tracking-wider uppercase mb-4 text-neutral-300">Company</h4>
            <ul className="space-y-2 text-sm text-neutral-400 font-light">
              <li>
                <button
                  type="button"
                  onClick={navigateToAbout}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  About Us
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={navigateToFeedback}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Feedback & Support
                </button>
              </li>
              <li><a href="#careers" className="hover:text-white transition-colors">Careers</a></li>
              <li><a href="#news" className="hover:text-white transition-colors">Newsroom</a></li>
              <li>
                <button
                  type="button"
                  onClick={navigateToHowSurgeWorks}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Algorithmic Paper
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm tracking-wider uppercase mb-4 text-neutral-300">Products</h4>
            <ul className="space-y-2 text-sm text-neutral-400 font-light">
              <li>
                <button
                  type="button"
                  onClick={navigateToRider}
                  className="hover:text-white transition-colors"
                >
                  Ride
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={navigateToDrive}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Drive with BASE
                </button>
              </li>
              <li><a href="/trips" className="hover:text-white transition-colors">Trip History</a></li>
              <li><a href="/operator" className="hover:text-white transition-colors">Surge Audit Monitor</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm tracking-wider uppercase mb-4 text-neutral-300">Mumbai Support</h4>
            <p className="text-xs text-neutral-400 font-light leading-relaxed mb-4">
              Operating 24/7 across MMR (Mumbai Metropolitan Region). Need help with a trip or pricing query?
            </p>
            <button
              type="button"
              onClick={navigateToFeedback}
              className="text-xs font-semibold uppercase tracking-wider border border-white/20 px-4 py-2 hover:bg-white hover:text-black transition-colors cursor-pointer"
            >
              Contact 24/7 Support
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center text-xs text-neutral-500 font-light">
          <div className="flex gap-6 mb-4 sm:mb-0">
            <a href="#privacy" className="hover:text-neutral-300 transition-colors">Privacy</a>
            <a href="#terms" className="hover:text-neutral-300 transition-colors">Terms</a>
            <a href="#security" className="hover:text-neutral-300 transition-colors">Security</a>
          </div>
          <div>Operating in compliance with Maharashtra Motor Vehicle Aggregator Guidelines.</div>
        </div>
      </footer>
    </ArcRevealHero>
  );
}
