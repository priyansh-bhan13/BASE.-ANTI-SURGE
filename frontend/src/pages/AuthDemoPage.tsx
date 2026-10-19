"use client";

import React, { useState } from "react";
import { BaseNavbar } from "@/components/ui/BaseNavbar";
import { Eye, EyeOff, ShieldCheck, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import { SweepSurface } from "@/components/ui/sweep-surface";

export interface AuthDemoPageProps {
  initialMode?: "login" | "signup";
  onNavigate: (view: "landing" | "rider" | "drive" | "about" | "feedback" | "how-surge-works" | "safety" | "login" | "signup") => void;
}

export function AuthDemoPage({ initialMode = "login", onNavigate }: AuthDemoPageProps) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form Fields
  const [identifier, setIdentifier] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const validateLogin = () => {
    const errs: Record<string, string> = {};
    if (!identifier.trim()) {
      errs.identifier = "Please enter your email or 10-digit mobile number";
    } else {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim());
      const isPhone = /^[6-9]\d{9}$/.test(identifier.trim().replace(/\D/g, ""));
      if (!isEmail && !isPhone) {
        errs.identifier = "Enter a valid email address or 10-digit Indian mobile number";
      }
    }

    if (!password) {
      errs.password = "Password is required";
    } else if (password.length < 6) {
      errs.password = "Password must be at least 6 characters";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateSignup = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) {
      errs.fullName = "Full name is required";
    }

    if (!email.trim()) {
      errs.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Please enter a valid email address";
    }

    if (!phone.trim()) {
      errs.phone = "Mobile number is required";
    } else if (!/^[6-9]\d{9}$/.test(phone.trim().replace(/\D/g, ""))) {
      errs.phone = "Enter a valid 10-digit Indian mobile number";
    }

    if (!password) {
      errs.password = "Password is required";
    } else if (password.length < 8) {
      errs.password = "Password must be at least 8 characters";
    }

    if (!confirmPassword) {
      errs.confirmPassword = "Confirm your password";
    } else if (confirmPassword !== password) {
      errs.confirmPassword = "Passwords do not match";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = mode === "login" ? validateLogin() : validateSignup();
    if (isValid) {
      setIsSubmitted(true);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setErrors({});
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col font-sans">
      {/* Integrated Unified BASE Navbar */}
      <BaseNavbar
        variant="light"
        activeRoute={mode}
        onNavigate={onNavigate}
      />

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md bg-white border border-neutral-300 p-8 shadow-sm">
          {/* Header Eyebrow */}
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-[11px] font-sans font-semibold uppercase tracking-wider text-neutral-600">
                BASE ACCOUNT DEMO
              </span>
            </div>
            <span className="text-[10px] font-sans uppercase font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 border border-neutral-200">
              PROTOTYPE
            </span>
          </div>

          {isSubmitted ? (
            /* Clear Demonstration-only Result State */
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-300 mx-auto flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-black">
                {mode === "login" ? "Login Simulated" : "Demo Account Created"}
              </h2>
              <div className="p-3 bg-neutral-100 border border-neutral-200 text-xs font-sans text-neutral-600 leading-relaxed text-left">
                <strong>Demonstration Notice:</strong> This is a design verification screen. No live credentials were saved or sent to any server. You can explore protected rides or partner workflows immediately.
              </div>

              <div className="pt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate("rider")}
                  className="w-full py-3 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Proceed to Ride Booking</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full py-2.5 border border-neutral-300 text-neutral-700 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  Test Another Input
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-extrabold tracking-tight text-black mb-2">
                {mode === "login" ? "Sign in to Base" : "Create an account"}
              </h1>
              <p className="text-xs text-neutral-500 font-light mb-6">
                {mode === "login"
                  ? "Access surge-protected rides and booking history in Mumbai."
                  : "Join riders across Mumbai enjoying mathematically verified surge protection."}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "login" ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                        Email or Mobile Number
                      </label>
                      <input
                        type="text"
                        value={identifier}
                        onChange={(e) => {
                          setIdentifier(e.target.value);
                          if (errors.identifier) setErrors((prev) => ({ ...prev, identifier: "" }));
                        }}
                        placeholder="name@example.com or 9820012345"
                        className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-300 focus:outline-none focus:border-black transition-colors"
                      />
                      {errors.identifier && (
                        <p className="text-[11px] text-red-600 font-medium mt-1">
                          {errors.identifier}
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-700">
                          Password
                        </label>
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (errors.password) setErrors((prev) => ({ ...prev, password: "" }));
                          }}
                          placeholder="Enter your password"
                          className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-300 focus:outline-none focus:border-black transition-colors pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black cursor-pointer"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-[11px] text-red-600 font-medium mt-1">
                          {errors.password}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: "" }));
                        }}
                        placeholder="Rohan Sharma"
                        className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-300 focus:outline-none focus:border-black transition-colors"
                      />
                      {errors.fullName && (
                        <p className="text-[11px] text-red-600 font-medium mt-1">
                          {errors.fullName}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                        }}
                        placeholder="rohan@example.com"
                        className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-300 focus:outline-none focus:border-black transition-colors"
                      />
                      {errors.email && (
                        <p className="text-[11px] text-red-600 font-medium mt-1">
                          {errors.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                        Mobile Number
                      </label>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 bg-neutral-100 border border-r-0 border-neutral-300 text-xs font-bold text-neutral-600">
                          +91
                        </span>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value);
                            if (errors.phone) setErrors((prev) => ({ ...prev, phone: "" }));
                          }}
                          placeholder="9820012345"
                          className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-300 focus:outline-none focus:border-black transition-colors"
                        />
                      </div>
                      {errors.phone && (
                        <p className="text-[11px] text-red-600 font-medium mt-1">
                          {errors.phone}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (errors.password) setErrors((prev) => ({ ...prev, password: "" }));
                          }}
                          placeholder="Minimum 8 characters"
                          className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-300 focus:outline-none focus:border-black transition-colors pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black cursor-pointer"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-[11px] text-red-600 font-medium mt-1">
                          {errors.password}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            if (errors.confirmPassword)
                              setErrors((prev) => ({ ...prev, confirmPassword: "" }));
                          }}
                          placeholder="Re-enter your password"
                          className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-300 focus:outline-none focus:border-black transition-colors pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black cursor-pointer"
                          aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <p className="text-[11px] text-red-600 font-medium mt-1">
                          {errors.confirmPassword}
                        </p>
                      )}
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  className="w-full py-3.5 bg-black hover:bg-neutral-800 text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer mt-2"
                >
                  {mode === "login" ? "Sign In" : "Create Demo Account"}
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-neutral-200 text-center">
                {mode === "login" ? (
                  <p className="text-xs text-neutral-500">
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signup");
                        setErrors({});
                      }}
                      className="font-bold text-black hover:underline cursor-pointer"
                    >
                      Sign up
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-neutral-500">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("login");
                        setErrors({});
                      }}
                      className="font-bold text-black hover:underline cursor-pointer"
                    >
                      Log in
                    </button>
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-neutral-200 bg-white py-6 px-6 text-xs text-neutral-500 text-center">
        © 2026 Base Technologies Inc. • Demonstration Authentication Portal
      </footer>
    </div>
  );
}
