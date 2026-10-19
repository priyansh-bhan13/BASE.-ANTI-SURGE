"use client";

import React, { useState, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Car,
  FileCheck,
  AlertCircle,
  MapPin,
  RotateCw,
  Building2,
  Award,
  FileText,
  BadgeCheck,
} from "lucide-react";
import { SweepSurface } from "@/components/ui/sweep-surface";
import { BaseNavbar } from "@/components/ui/BaseNavbar";
import { FloatingPathsBackground } from "@/components/ui/floating-paths";
import UnderlineToBackground from "@/components/fancy/text/underline-to-background";
import {
  submitDriverApplication,
  validateApplicationForm,
  DriverApplicationFormData,
  ApplicationSubmissionResult,
  ValidationErrors,
} from "@/services/driverApplication";

export interface DrivePageProps {
  onBackToLanding: () => void;
  onNavigateToRide: () => void;
  onNavigateToAbout: () => void;
  onNavigateToFeedback: () => void;
  onNavigateToHowSurgeWorks?: () => void;
}

const MUMBAI_ZONES = [
  { id: "bkc", label: "Bandra Kurla Complex (BKC) & Central" },
  { id: "bandra_west", label: "Bandra West, Khar & Santa Cruz" },
  { id: "airport", label: "Mumbai Airport (T1 / T2) & Andheri" },
  { id: "south_mumbai", label: "South Mumbai (Nariman Pt, Fort, Colaba)" },
  { id: "western_suburbs", label: "Western Suburbs (Goregaon to Borivali)" },
  { id: "navi_mumbai", label: "Navi Mumbai & Vashi Corridor" },
];

const VEHICLE_CATEGORIES = [
  {
    id: "sedan",
    title: "BASE Standard Sedan",
    desc: "Commercial air-conditioned sedan (Dzire, Etios, Aura, Tigor)",
    tariff: "₹24 / km flat",
  },
  {
    id: "compact",
    title: "Compact / Hatchback",
    desc: "4-door AC commercial hatchback (WagonR, Celerio, i10)",
    tariff: "₹20 / km flat",
  },
  {
    id: "rickshaw",
    title: "Auto-Rickshaw",
    desc: "Commercial CNG auto-rickshaw with certified electronic meter",
    tariff: "Standard Mumbai RTO rate",
  },
  {
    id: "suv",
    title: "Premium SUV",
    desc: "6+ seater commercial utility (Ertiga, Innova, Carens)",
    tariff: "₹32 / km flat",
  },
];

/* =========================================================================
   ISOLATED DRIVER APPLICATION FORM COMPONENT
   Extracting the form into its own component prevents keystroke re-renders
   from diffing the entire 3500px page, BaseNavbar, or FloatingPaths SVG.
   ========================================================================= */
interface DriverApplicationFormSectionProps {
  onBackToLanding: () => void;
  formSectionRef: React.RefObject<HTMLDivElement | null>;
}

function DriverApplicationFormSection({
  onBackToLanding,
  formSectionRef,
}: DriverApplicationFormSectionProps) {
  const shouldReduceMotion = useReducedMotion();

  const [formData, setFormData] = useState<DriverApplicationFormData>({
    fullName: "",
    phone: "",
    email: "",
    operatingZone: "bkc",
    licenceNumber: "",
    licenceExpiry: "",
    vehicleCategory: "sedan",
    ownershipStatus: "owner",
    vehicleRegNumber: "",
    consentGiven: false,
  });

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<ApplicationSubmissionResult | null>(null);

  const handleChange = (
    field: keyof DriverApplicationFormData,
    value: any
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (serverError) setServerError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const errors = validateApplicationForm(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitDriverApplication(formData);
      setSubmissionResult(result);
      formSectionRef.current?.scrollIntoView({
        behavior: shouldReduceMotion ? "auto" : "smooth",
        block: "start",
      });
    } catch (err: any) {
      setServerError(
        err.message || "Unable to submit your application. Please verify your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmissionResult(null);
    setFormData({
      fullName: "",
      phone: "",
      email: "",
      operatingZone: "bkc",
      licenceNumber: "",
      licenceExpiry: "",
      vehicleCategory: "sedan",
      ownershipStatus: "owner",
      vehicleRegNumber: "",
      consentGiven: false,
    });
    setValidationErrors({});
    setServerError(null);
    formSectionRef.current?.scrollIntoView({
      behavior: shouldReduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <section
      ref={formSectionRef}
      id="apply"
      className="border-t border-neutral-200/90 py-20 px-6 bg-white scroll-mt-16"
    >
      <div className="max-w-4xl mx-auto">
        {/* Header Callout */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-[11px] font-sans uppercase tracking-[0.14em] text-neutral-500 block mb-2">
            Online Application
          </span>
          <h2 className="text-[34px] sm:text-[42px] font-extrabold tracking-[-0.04em] text-black leading-[1.08] mb-4">
            Ready to drive with BASE?
          </h2>
          <p className="text-[16px] text-neutral-600 leading-[1.6]">
            Tell us about yourself and your vehicle. Our Mumbai onboarding desk will review your details and guide you through the next steps within 24 hours.
          </p>
        </div>

        {/* Application Form Container */}
        <div className="border border-neutral-200 bg-white p-6 sm:p-10 shadow-sm">
          {submissionResult ? (
            /* ===========================================================
               SUCCESS / CONFIRMATION STATE
               =========================================================== */
            <div className="space-y-6 transition-opacity duration-300">
              <div className="p-6 bg-neutral-50 border border-black space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-black text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <span className="text-[11px] font-sans uppercase tracking-[0.1em] text-neutral-500 block">
                      Application Status: Received
                    </span>
                    <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-black">
                      {submissionResult.duplicatePrevented
                        ? "Application Already on File"
                        : "Application Successfully Received"}
                    </h3>
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
                  <div>
                    <span className="text-neutral-500 block">Application Reference:</span>
                    <span className="text-base font-bold text-black select-all">
                      {submissionResult.applicationRef}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Operating Zone:</span>
                    <span className="font-bold text-black uppercase">
                      {MUMBAI_ZONES.find((z) => z.id === formData.operatingZone)?.label || "Mumbai"}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Contact Phone:</span>
                    <span className="font-bold text-black">{formData.phone}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Vehicle Category:</span>
                    <span className="font-bold text-black uppercase">{formData.vehicleCategory}</span>
                  </div>
                </div>

                <p className="text-[14px] text-neutral-700 leading-[1.6] pt-2">
                  {submissionResult.message}
                </p>
              </div>

              {/* Next Steps Guidance */}
              <div className="p-6 border border-neutral-200 bg-white space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider text-black font-sans">
                  What Happens Next:
                </h4>
                <ol className="space-y-2 text-[14px] text-neutral-600 list-decimal list-inside">
                  <li>Our compliance officer will verify your commercial driving licence and vehicle details.</li>
                  <li>You will receive an SMS and email notification with an invitation to your selected Mumbai partner hub.</li>
                  <li>Bring your original documents and vehicle for a 15-minute quick safety inspection.</li>
                  <li>Receive your driver console login credentials to start accepting rides.</li>
                </ol>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="text-xs uppercase font-sans tracking-wider text-neutral-500 hover:text-black underline cursor-pointer"
                >
                  Submit another application
                </button>

                <SweepSurface
                  as="button"
                  variant="dark"
                  type="button"
                  onClick={onBackToLanding}
                  className="px-6 py-3 text-xs font-semibold tracking-[0.12em] uppercase cursor-pointer"
                >
                  Return to BASE Home
                </SweepSurface>
              </div>
            </div>
          ) : (
            /* ===========================================================
               ACTIVE APPLICATION FORM (Stable DOM, zero flickering)
               =========================================================== */
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Server Error Alert */}
              {serverError && (
                <div className="p-4 bg-red-50 border border-red-300 text-xs font-sans text-red-700 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <strong className="block font-bold">Submission Notice:</strong>
                    <span>{serverError}</span>
                  </div>
                </div>
              )}

              {/* FORM SECTION 1: PERSONAL DETAILS */}
              <div className="space-y-4">
                <div className="border-b border-neutral-200 pb-2 flex items-center justify-between">
                  <span className="text-xs font-sans uppercase tracking-[0.1em] font-bold text-black flex items-center gap-2">
                    <span className="w-5 h-5 bg-black text-white flex items-center justify-center text-[10px]">1</span>
                    Personal Details
                  </span>
                  <span className="text-[11px] font-sans text-neutral-400">All fields required</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-sans uppercase tracking-wider text-neutral-600 mb-1">
                      Full Legal Name
                    </label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => handleChange("fullName", e.target.value)}
                      placeholder="As printed on driving licence"
                      autoComplete="name"
                      className="w-full bg-neutral-50 border border-neutral-300 px-3.5 py-2.5 text-[15px] font-medium text-black placeholder:text-neutral-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors"
                    />
                    {validationErrors.fullName && (
                      <p className="text-[11px] font-sans text-red-600 mt-1">{validationErrors.fullName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-sans uppercase tracking-wider text-neutral-600 mb-1">
                      Mobile Number (10 Digits)
                    </label>
                    <div className="relative flex">
                      <span className="inline-flex items-center px-3 bg-neutral-100 border border-r-0 border-neutral-300 text-xs font-sans font-bold text-neutral-600">
                        +91
                      </span>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                        placeholder="98200 12345"
                        autoComplete="tel-national"
                        className="w-full bg-neutral-50 border border-neutral-300 px-3.5 py-2.5 text-[15px] font-medium text-black placeholder:text-neutral-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors"
                      />
                    </div>
                    {validationErrors.phone && (
                      <p className="text-[11px] font-sans text-red-600 mt-1">{validationErrors.phone}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-sans uppercase tracking-wider text-neutral-600 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      placeholder="driver@example.com"
                      autoComplete="email"
                      className="w-full bg-neutral-50 border border-neutral-300 px-3.5 py-2.5 text-[15px] font-medium text-black placeholder:text-neutral-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors"
                    />
                    {validationErrors.email && (
                      <p className="text-[11px] font-sans text-red-600 mt-1">{validationErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-sans uppercase tracking-wider text-neutral-600 mb-1">
                      Primary Operating Hub / Zone
                    </label>
                    <select
                      value={formData.operatingZone}
                      onChange={(e) => handleChange("operatingZone", e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-300 px-3 py-2.5 text-[14px] font-medium text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors cursor-pointer"
                    >
                      {MUMBAI_ZONES.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* FORM SECTION 2: DRIVING & VEHICLE DETAILS */}
              <div className="space-y-4">
                <div className="border-b border-neutral-200 pb-2 flex items-center justify-between">
                  <span className="text-xs font-sans uppercase tracking-[0.1em] font-bold text-black flex items-center gap-2">
                    <span className="w-5 h-5 bg-black text-white flex items-center justify-center text-[10px]">2</span>
                    Licence &amp; Vehicle Information
                  </span>
                  <span className="text-[11px] font-sans text-neutral-400">Maharashtra commercial fleet</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-sans uppercase tracking-wider text-neutral-600 mb-1">
                      Commercial Driving Licence (DL)
                    </label>
                    <input
                      type="text"
                      value={formData.licenceNumber}
                      onChange={(e) => handleChange("licenceNumber", e.target.value)}
                      placeholder="MH-02-2018-0098765"
                      className="w-full bg-neutral-50 border border-neutral-300 px-3.5 py-2.5 text-[15px] font-sans text-black placeholder:text-neutral-400 uppercase focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors"
                    />
                    {validationErrors.licenceNumber && (
                      <p className="text-[11px] font-sans text-red-600 mt-1">{validationErrors.licenceNumber}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-sans uppercase tracking-wider text-neutral-600 mb-1">
                      Licence Expiry Date
                    </label>
                    <input
                      type="date"
                      value={formData.licenceExpiry}
                      onChange={(e) => handleChange("licenceExpiry", e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-300 px-3.5 py-2.5 text-[14px] font-sans text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors cursor-pointer"
                    />
                    {validationErrors.licenceExpiry && (
                      <p className="text-[11px] font-sans text-red-600 mt-1">{validationErrors.licenceExpiry}</p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-sans uppercase tracking-wider text-neutral-600 mb-2">
                      Vehicle Category
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {VEHICLE_CATEGORIES.map((cat) => (
                        <label
                          key={cat.id}
                          className={`p-3.5 border cursor-pointer flex items-start justify-between transition-all duration-150 ${
                            formData.vehicleCategory === cat.id
                              ? "border-black bg-neutral-50 ring-1 ring-black"
                              : "border-neutral-200 bg-white hover:border-neutral-400"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              name="vehicleCategory"
                              value={cat.id}
                              checked={formData.vehicleCategory === cat.id}
                              onChange={(e) => handleChange("vehicleCategory", e.target.value)}
                              className="mt-1 accent-black h-4 w-4 cursor-pointer"
                            />
                            <div>
                              <div className="text-sm font-bold text-black">{cat.title}</div>
                              <div className="text-[12px] text-neutral-500 leading-snug">{cat.desc}</div>
                            </div>
                          </div>
                          <span className="text-[11px] font-sans font-bold text-black shrink-0 ml-2">
                            {cat.tariff}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-sans uppercase tracking-wider text-neutral-600 mb-1">
                      Vehicle Ownership Status
                    </label>
                    <select
                      value={formData.ownershipStatus}
                      onChange={(e) => handleChange("ownershipStatus", e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-300 px-3 py-2.5 text-[14px] font-medium text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors cursor-pointer"
                    >
                      <option value="owner">I own the commercial vehicle</option>
                      <option value="partner">I drive for a fleet partner / lease</option>
                      <option value="seeking">Seeking a BASE fleet vehicle</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-sans uppercase tracking-wider text-neutral-600 mb-1">
                      Vehicle Registration Number
                    </label>
                    <input
                      type="text"
                      value={formData.vehicleRegNumber}
                      onChange={(e) => handleChange("vehicleRegNumber", e.target.value)}
                      placeholder="MH 02 CZ 4421"
                      className="w-full bg-neutral-50 border border-neutral-300 px-3.5 py-2.5 text-[15px] font-sans text-black placeholder:text-neutral-400 uppercase focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors"
                    />
                    {validationErrors.vehicleRegNumber && (
                      <p className="text-[11px] font-sans text-red-600 mt-1">{validationErrors.vehicleRegNumber}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* FORM SECTION 3: DOCUMENTATION NOTICE */}
              <div className="p-4 bg-neutral-50 border border-neutral-200 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-black font-sans">
                  <FileText size={15} />
                  <span>Secure Verification Process</span>
                </div>
                <p className="text-[13px] text-neutral-600 leading-[1.6]">
                  To protect your sensitive identity documents, physical verification is conducted in-person at our Mumbai partner hubs, or via a secure single-use verification link sent directly to your verified phone number. Never share document originals over unverified channels.
                </p>
              </div>

              {/* FORM SECTION 4: REVIEW & CONSENT */}
              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.consentGiven}
                    onChange={(e) => handleChange("consentGiven", e.target.checked)}
                    className="mt-1 accent-black h-4 w-4 rounded-none cursor-pointer"
                  />
                  <span className="text-[13px] text-neutral-700 leading-relaxed">
                    I confirm that all details provided are accurate and true. I authorize BASE Technologies Inc. to verify my commercial driving credentials with transport authorities in accordance with the{" "}
                    <strong className="text-black font-semibold">BASE Driver Privacy Notice &amp; Terms</strong>.
                  </span>
                </label>
                {validationErrors.consentGiven && (
                  <p className="text-[11px] font-sans text-red-600">{validationErrors.consentGiven}</p>
                )}
              </div>

              {/* SUBMIT BUTTON */}
              <div className="pt-4 border-t border-neutral-200">
                <SweepSurface
                  as="button"
                  type="submit"
                  variant="dark"
                  disabled={isSubmitting}
                  className="w-full py-4 text-xs font-semibold tracking-[0.14em] uppercase flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Verifying &amp; Submitting Application...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Driver Application</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </SweepSurface>
                <div className="text-center mt-3 text-[11px] font-sans text-neutral-400">
                  Zero application fee • Mumbai Hub Response within 24 Hours
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
   MAIN DRIVE PAGE
   ========================================================================= */
export function DrivePage({
  onBackToLanding,
  onNavigateToRide,
  onNavigateToAbout,
  onNavigateToFeedback,
  onNavigateToHowSurgeWorks,
}: DrivePageProps) {
  const shouldReduceMotion = useReducedMotion();
  const formSectionRef = useRef<HTMLDivElement>(null);
  const howItWorksRef = useRef<HTMLDivElement>(null);

  const scrollToForm = () => {
    formSectionRef.current?.scrollIntoView({
      behavior: shouldReduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const scrollToHowItWorks = () => {
    howItWorksRef.current?.scrollIntoView({
      behavior: shouldReduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <div className="relative isolate min-h-screen bg-white text-black flex flex-col font-sans select-text">
      {/* =========================================================================
          GLOBAL ANIMATED NAVIGATION BAR
          ========================================================================= */}
      <BaseNavbar
        variant="light"
        activeRoute="drive"
        onNavigate={(dest) => {
          if (dest === "landing") {
            onBackToLanding();
            return;
          }
          if (dest === "rider") {
            onNavigateToRide();
            return;
          }
          if (dest === "about") {
            onNavigateToAbout();
            return;
          }
          if (dest === "feedback") {
            onNavigateToFeedback();
            return;
          }
          if (dest === "how-surge-works" && onNavigateToHowSurgeWorks) {
            onNavigateToHowSurgeWorks();
            return;
          }
          const path = `/${dest}`;
          window.history.pushState({}, "", path);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }}
      />

      {/* =========================================================================
          MAIN CONTENT AREA
          ========================================================================= */}
      <main className="relative z-10 flex-1 w-full">
        {/* =====================================================================
            SECTION A: DRIVE HERO
            ===================================================================== */}
        <section className="max-w-7xl mx-auto px-6 pt-16 pb-20 sm:pt-20 sm:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
            {/* Left Column: Existing Hero Content */}
            <div className="lg:col-span-7 max-w-2xl">
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-neutral-100 border border-neutral-300 text-xs sm:text-sm font-sans font-bold uppercase tracking-[0.12em] text-neutral-800 mb-6 shadow-xs">
                <span className="h-2 w-2 bg-emerald-500 inline-block" />
                BASE / DRIVER NETWORK • MUMBAI
              </div>

              {/* Main Headline */}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-[76px] font-extrabold tracking-[-0.04em] text-black leading-[1.02] mb-6">
                Your city. Your drive. <br />
                <span className="text-black">
                  Your{" "}
                  <UnderlineToBackground
                    targetTextColor="#FFFFFF"
                    className="text-black cursor-pointer inline-block"
                  >
                    terms.
                  </UnderlineToBackground>
                </span>
              </h1>

              {/* Supporting Copy */}
              <p className="text-xl sm:text-2xl leading-[1.6] text-neutral-600 max-w-2xl mb-10 font-normal">
                Join BASE and take the next step in your driving career. Built for Mumbai's professional commercial drivers with zero artificial surge commission deductions, transparent kilometre earnings, and verified dispatch.
              </p>

              {/* Hero Action CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-14">
                <SweepSurface
                  as="button"
                  variant="dark"
                  type="button"
                  onClick={scrollToForm}
                  className="min-h-[54px] sm:min-h-[58px] px-8 sm:px-10 py-4 text-[15px] sm:text-[16px] font-extrabold tracking-[0.14em] uppercase flex items-center justify-center gap-3.5 cursor-pointer shadow-sm hover:shadow-md transition-all"
                >
                  <span>Apply to drive</span>
                  <ArrowRight size={18} />
                </SweepSurface>

                <SweepSurface
                  as="button"
                  variant="light"
                  type="button"
                  onClick={scrollToHowItWorks}
                  className="min-h-[54px] sm:min-h-[58px] px-6 sm:px-8 py-4 text-xs sm:text-[13px] font-semibold tracking-[0.14em] uppercase flex items-center justify-center gap-2 cursor-pointer border border-neutral-300"
                >
                  <span>See how it works</span>
                  <span className="text-neutral-400 font-sans text-[11px]">↓</span>
                </SweepSurface>
              </div>

              {/* Verifiable Operational Fleet Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-8 border-t border-neutral-200/90 font-sans">
                <div>
                  <span className="text-neutral-500 block text-[11.5px] uppercase tracking-[0.1em] mb-1 font-medium">
                    Base Tariff
                  </span>
                  <span className="font-bold text-black text-[15.5px]">₹24 / km flat</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[11.5px] uppercase tracking-[0.1em] mb-1 font-medium">
                    Surge Shield
                  </span>
                  <span className="font-bold text-black text-[15.5px]">1.0× Fixed</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[11.5px] uppercase tracking-[0.1em] mb-1 font-medium">
                    Payout Cycle
                  </span>
                  <span className="font-bold text-black text-[15.5px]">Daily Direct Bank</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[11.5px] uppercase tracking-[0.1em] mb-1 font-medium">
                    City Zone
                  </span>
                  <span className="font-bold text-black text-[15.5px]">Mumbai MMR</span>
                </div>
              </div>
            </div>

            {/* Right Column: Driver Visual & Editorial Message */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-5 w-full"
            >
              <div className="relative group">
                {/* Main Editorial Photograph */}
                <div className="relative border border-neutral-200 overflow-hidden bg-neutral-100 aspect-[4/3] sm:aspect-[16/11] lg:aspect-[4/3] shadow-sm">
                  <img
                    src="/assets/mumbai-yellow-taxi-driver.jpg"
                    alt="Professional driver seated in a yellow-and-black Mumbai taxi"
                    className="w-full h-full object-cover object-[48%_38%] transition-transform duration-700 ease-out group-hover:scale-[1.025]"
                    loading="eager"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                </div>

                {/* Overlapping Restrained Editorial Message Panel */}
                <motion.div
                  initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.55,
                    delay: shouldReduceMotion ? 0 : 0.16,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="relative -mt-10 sm:-mt-12 mx-3 sm:mx-5 bg-white border border-neutral-200/90 p-5 sm:p-6 shadow-sm z-10"
                >
                  <div className="text-[10px] sm:text-[11px] font-sans font-semibold uppercase tracking-[0.14em] text-neutral-500 mb-1.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 bg-neutral-950 inline-block" />
                    BUILT AROUND THE DRIVER
                  </div>

                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-950 leading-snug mb-2">
                    The city moves because you do.
                  </h2>

                  <p className="text-xs sm:text-[13px] leading-relaxed text-neutral-600 font-normal">
                    Your work matters. Your time matters. BASE is building a more transparent driving experience for Mumbai's professional drivers.
                  </p>

                  <div className="border-t border-neutral-100 my-3" />

                  <div className="text-[10px] font-sans font-semibold uppercase tracking-[0.14em] text-neutral-400">
                    BASE / DRIVER NETWORK · MUMBAI
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* =====================================================================
            SECTIONS B THROUGH D: OPERATIONAL ADVANTAGES TO MUMBAI GUIDELINES
            Canvas with flowing FloatingPaths background
            ===================================================================== */}
        <div className="relative isolate overflow-hidden bg-neutral-50/30">
          {/* Flowing Floating Paths Background layer scoped to Section B through Section D */}
          <div className="pointer-events-none absolute inset-0 select-none z-0 overflow-hidden">
            <FloatingPathsBackground position={-1} className="opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-transparent to-white/80 pointer-events-none" />
          </div>

          {/* =====================================================================
              SECTION B: DRIVER BENEFITS (Operational Advantages)
              ===================================================================== */}
          <section className="relative z-10 border-t border-neutral-200/90 py-20 px-6">
            <div className="max-w-7xl mx-auto">
              <div className="max-w-xl mb-12">
                <span className="text-[11px] font-sans uppercase tracking-[0.14em] text-neutral-500 block mb-2">
                  Operational Advantages
                </span>
                <h2 className="text-[32px] sm:text-[38px] font-bold tracking-[-0.035em] text-black leading-[1.1]">
                  Why professional drivers choose BASE.
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Benefit 1 */}
                <div className="border border-neutral-200 bg-white/95 backdrop-blur-xs p-7 flex flex-col justify-between shadow-xs hover:border-black transition-colors">
                  <div>
                    <div className="w-9 h-9 bg-black text-white flex items-center justify-center mb-6">
                      <Award size={18} />
                    </div>
                    <h3 className="text-[17px] font-bold text-black mb-2.5 tracking-tight">
                      Transparent Tariff Rate
                    </h3>
                    <p className="text-[14px] text-neutral-600 leading-[1.6]">
                      No unpredictable surge commission deductions. You earn based on actual road kilometres driven at transparent rates with full receipt breakdown.
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-neutral-100 text-[11px] font-sans text-neutral-500">
                    Fixed ₹24/km Sedan Base
                  </div>
                </div>

                {/* Benefit 2 */}
                <div className="border border-neutral-200 bg-white/95 backdrop-blur-xs p-7 flex flex-col justify-between shadow-xs hover:border-black transition-colors">
                  <div>
                    <div className="w-9 h-9 bg-black text-white flex items-center justify-center mb-6">
                      <MapPin size={18} />
                    </div>
                    <h3 className="text-[17px] font-bold text-black mb-2.5 tracking-tight">
                      Real Road Geometry
                    </h3>
                    <p className="text-[14px] text-neutral-600 leading-[1.6]">
                      Fares calculated via OSRM street network data, measuring actual driving distances rather than artificial straight lines or inaccurate estimates.
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-neutral-100 text-[11px] font-sans text-neutral-500">
                    Precise Mumbai Map Engine
                  </div>
                </div>

                {/* Benefit 3 */}
                <div className="border border-neutral-200 bg-white/95 backdrop-blur-xs p-7 flex flex-col justify-between shadow-xs hover:border-black transition-colors">
                  <div>
                    <div className="w-9 h-9 bg-black text-white flex items-center justify-center mb-6">
                      <ShieldCheck size={18} />
                    </div>
                    <h3 className="text-[17px] font-bold text-black mb-2.5 tracking-tight">
                      Driver Protection &amp; Safety
                    </h3>
                    <p className="text-[14px] text-neutral-600 leading-[1.6]">
                      Every rider on BASE is phone and location verified. Dedicated 24/7 Mumbai operations line and emergency assistance built right into your dashboard.
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-neutral-100 text-[11px] font-sans text-neutral-500">
                    Emergency Support Included
                  </div>
                </div>

                {/* Benefit 4 */}
                <div className="border border-neutral-200 bg-white/95 backdrop-blur-xs p-7 flex flex-col justify-between shadow-xs hover:border-black transition-colors">
                  <div>
                    <div className="w-9 h-9 bg-black text-white flex items-center justify-center mb-6">
                      <Clock size={18} />
                    </div>
                    <h3 className="text-[17px] font-bold text-black mb-2.5 tracking-tight">
                      Fast Daily Settlements
                    </h3>
                    <p className="text-[14px] text-neutral-600 leading-[1.6]">
                      No waiting weeks for your hard-earned money. Automated daily settlement cycles directly to your registered Indian bank account.
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-neutral-100 text-[11px] font-sans text-neutral-500">
                    NEFT / IMPS Automated
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* =====================================================================
              SECTION C: ONBOARDING PROCESS (HOW IT WORKS)
              ===================================================================== */}
          <section
            ref={howItWorksRef}
            id="how-it-works"
            className="relative z-10 border-t border-neutral-200/90 py-20 px-6 scroll-mt-16 bg-white/40 backdrop-blur-[1px]"
          >
            <div className="max-w-7xl mx-auto">
              <div className="max-w-xl mb-14">
                <span className="text-[11px] font-sans uppercase tracking-[0.14em] text-neutral-500 block mb-2">
                  Fast Onboarding
                </span>
                <h2 className="text-[32px] sm:text-[38px] font-bold tracking-[-0.035em] text-black leading-[1.1]">
                  Simple 4-step onboarding journey.
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {/* Step 1 */}
                <div className="relative border-t-2 border-black pt-6 bg-white/80 backdrop-blur-xs p-6 border-x border-b border-neutral-200/80">
                  <span className="text-[12px] font-sans font-bold uppercase tracking-wider text-neutral-500 block mb-3">
                    01 / Application
                  </span>
                  <h3 className="text-[18px] font-bold text-black mb-2">
                    Apply Online
                  </h3>
                  <p className="text-[14px] text-neutral-600 leading-[1.6]">
                    Complete our quick online registration form below with your commercial driving licence and vehicle details. Takes less than 3 minutes.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="relative border-t-2 border-neutral-400 pt-6 bg-white/80 backdrop-blur-xs p-6 border-x border-b border-neutral-200/80">
                  <span className="text-[12px] font-sans font-bold uppercase tracking-wider text-neutral-500 block mb-3">
                    02 / Verification
                  </span>
                  <h3 className="text-[18px] font-bold text-black mb-2">
                    Document Review
                  </h3>
                  <p className="text-[14px] text-neutral-600 leading-[1.6]">
                    Our local operations desk reviews your RTO permit, commercial licence, and vehicle fitness certificates within 24 business hours.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="relative border-t-2 border-neutral-400 pt-6 bg-white/80 backdrop-blur-xs p-6 border-x border-b border-neutral-200/80">
                  <span className="text-[12px] font-sans font-bold uppercase tracking-wider text-neutral-500 block mb-3">
                    03 / Inspection
                  </span>
                  <h3 className="text-[18px] font-bold text-black mb-2">
                    Vehicle Inspection
                  </h3>
                  <p className="text-[14px] text-neutral-600 leading-[1.6]">
                    Brief in-person physical vehicle inspection at our Mumbai partner hubs (BKC or Andheri East) to verify safety and comfort standards.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="relative border-t-2 border-neutral-400 pt-6 bg-white/80 backdrop-blur-xs p-6 border-x border-b border-neutral-200/80">
                  <span className="text-[12px] font-sans font-bold uppercase tracking-wider text-neutral-500 block mb-3">
                    04 / Activation
                  </span>
                  <h3 className="text-[18px] font-bold text-black mb-2">
                    Start Driving
                  </h3>
                  <p className="text-[14px] text-neutral-600 leading-[1.6]">
                    Receive your driver console credentials, go online, and accept surge-protected ride requests across Mumbai with instant fare transparency.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* =====================================================================
              SECTION D: ELIGIBILITY & REQUIREMENTS
              ===================================================================== */}
          <section className="relative z-10 border-t border-neutral-200/90 py-20 px-6">
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-5">
                  <span className="text-[12.5px] font-sans uppercase tracking-[0.14em] text-neutral-500 block mb-2 font-medium">
                    Mumbai Guidelines
                  </span>
                  <h2 className="text-[35px] sm:text-[42px] font-bold tracking-[-0.035em] text-black leading-[1.1] mb-5">
                    Driver eligibility &amp; documentation.
                  </h2>
                  <p className="text-[16.5px] text-neutral-600 leading-[1.6] mb-8">
                    BASE upholds high standards of safety and regulatory compliance across Maharashtra. Check the standard requirements below before submitting your application.
                  </p>
                  <div className="p-5 border border-neutral-200 bg-white/95 backdrop-blur-xs space-y-2">
                    <div className="flex items-center gap-2 text-[13.5px] font-bold uppercase text-black font-sans">
                      <Building2 size={17} />
                      <span>Mumbai Partner Hubs</span>
                    </div>
                    <p className="text-[14.5px] text-neutral-600">
                      BKC Commercial Center • Andheri East Metro Terminal. Walk-in document support available Mon–Sat, 10 AM to 6 PM.
                    </p>
                  </div>
                </div>

                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="p-6 border border-neutral-200 bg-white/95 backdrop-blur-xs">
                    <div className="flex items-center gap-2 mb-3">
                      <BadgeCheck size={19} className="text-black" />
                      <h3 className="text-[18px] font-bold text-black">
                        Driver Criteria
                      </h3>
                    </div>
                    <ul className="space-y-2.5 text-[14.5px] text-neutral-600">
                      <li className="flex items-start gap-2">
                        <span className="font-sans text-black font-bold">•</span>
                        <span>Minimum 21 years of age.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-sans text-black font-bold">•</span>
                        <span>Valid Commercial Driving Licence (TR badge).</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-sans text-black font-bold">•</span>
                        <span>Minimum 1 year commercial driving experience.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-sans text-black font-bold">•</span>
                        <span>Clear background check with clean police record.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-6 border border-neutral-200 bg-white/95 backdrop-blur-xs">
                    <div className="flex items-center gap-2 mb-3">
                      <Car size={19} className="text-black" />
                      <h3 className="text-[18px] font-bold text-black">
                        Vehicle Criteria
                      </h3>
                    </div>
                    <ul className="space-y-2.5 text-[14.5px] text-neutral-600">
                      <li className="flex items-start gap-2">
                        <span className="font-sans text-black font-bold">•</span>
                        <span>Sedan, Hatchback, Auto-rickshaw, or SUV.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-sans text-black font-bold">•</span>
                        <span>Valid Maharashtra commercial yellow-plate registration.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-sans text-black font-bold">•</span>
                        <span>Functional air conditioning (cars) and clean interior.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-sans text-black font-bold">•</span>
                        <span>Valid RTO fitness certificate and road permit.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-6 border border-neutral-200 bg-white/95 backdrop-blur-xs sm:col-span-2">
                    <div className="flex items-center gap-2 mb-3">
                      <FileCheck size={19} className="text-black" />
                      <h3 className="text-[18px] font-bold text-black">
                        Required Documents for Inspection
                      </h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13.5px] font-sans text-neutral-700">
                      <div className="p-2.5 bg-neutral-50 border border-neutral-200">
                        1. PAN Card &amp; Aadhaar Card
                      </div>
                      <div className="p-2.5 bg-neutral-50 border border-neutral-200">
                        2. Commercial Driving Licence
                      </div>
                      <div className="p-2.5 bg-neutral-50 border border-neutral-200">
                        3. Vehicle RC Book &amp; Permit
                      </div>
                      <div className="p-2.5 bg-neutral-50 border border-neutral-200">
                        4. Commercial Insurance &amp; PUC
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* =====================================================================
            SECTION E & F: ISOLATED APPLICATION FORM COMPONENT
            ===================================================================== */}
        <DriverApplicationFormSection
          onBackToLanding={onBackToLanding}
          formSectionRef={formSectionRef}
        />
      </main>

      {/* =========================================================================
          SECTION H: REUSED UNIFIED BASE FOOTER
          ========================================================================= */}
      <footer className="relative z-10 border-t border-neutral-200 bg-white py-12 px-6 text-xs text-neutral-600 font-sans">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="font-extrabold text-lg text-black tracking-tight mb-2">BASE</div>
            <p className="text-neutral-500 font-sans text-xs leading-relaxed">
              Surge-shielded urban mobility platform built for Maharashtra with algorithmic fare integrity.
            </p>
          </div>
          <div>
            <span className="text-black font-bold uppercase tracking-wider block mb-2">Navigation</span>
            <ul className="space-y-1.5 text-neutral-500 font-sans">
              <li>
                <button type="button" onClick={onNavigateToRide} className="hover:text-black transition-colors cursor-pointer">
                  Ride Booking
                </button>
              </li>
              <li>
                <button type="button" onClick={scrollToForm} className="hover:text-black transition-colors cursor-pointer font-bold text-black">
                  Drive with BASE
                </button>
              </li>
              <li>
                <button type="button" onClick={onNavigateToAbout} className="hover:text-black transition-colors cursor-pointer">
                  About the Platform
                </button>
              </li>
              <li>
                <button type="button" onClick={onNavigateToFeedback} className="hover:text-black transition-colors cursor-pointer">
                  Feedback &amp; Inquiries
                </button>
              </li>
            </ul>
          </div>
          <div>
            <span className="text-black font-bold uppercase tracking-wider block mb-2">Mumbai Partner Hubs</span>
            <ul className="space-y-1.5 text-neutral-500 font-sans">
              <li>BKC Financial District Hub</li>
              <li>Andheri East Metro Hub</li>
              <li>Support: +91 22 4900 1200</li>
              <li>Email: fleet@base-ride.in</li>
            </ul>
          </div>
          <div>
            <span className="text-black font-bold uppercase tracking-wider block mb-2">Compliance</span>
            <ul className="space-y-1.5 text-neutral-500 font-sans">
              <li>Maharashtra RTO Standards</li>
              <li>Zero Surge Guarantee</li>
              <li>Commercial Yellow Plate Fleet</li>
              <li>Verified GPS Distance Metering</li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-neutral-400 text-[11px]">
          <div>© 2026 Base Technologies Inc. • Mumbai Fleet Operations</div>
          <div>All driver applications audited and stored under strict privacy compliance</div>
        </div>
      </footer>
    </div>
  );
}

export default DrivePage;
