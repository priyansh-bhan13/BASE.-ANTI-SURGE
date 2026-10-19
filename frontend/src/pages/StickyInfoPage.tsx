"use client";

import React, { useState } from "react";
import "./StickyInfoPage.css";

export interface StickyInfoPageProps {
  page?: "about" | "feedback";
  onNavigate?: (view: "landing" | "rider" | "drive" | "about" | "feedback" | "how-surge-works") => void;
  onSubmitFeedback?: (data: FormData) => Promise<void>;
}

export default function StickyInfoPage({
  page = "about",
  onNavigate,
  onSubmitFeedback,
}: StickyInfoPageProps) {
  const isFeedback = page === "feedback";
  const [status, setStatus] = useState<{ message: string; type: "idle" | "submitting" | "success" | "error" }>({
    message: "",
    type: "idle",
  });

  const handleNav = (view: "landing" | "rider" | "drive" | "about" | "feedback" | "how-surge-works") => (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(view);
    } else {
      const path = view === "landing" ? "/" : `/${view}`;
      window.history.pushState({}, "", path);
      window.location.pathname = path;
    }
  };

  const handleScrollToTop = (e: React.MouseEvent) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleScrollToContent = (e: React.MouseEvent) => {
    e.preventDefault();
    const content = document.getElementById("page-content");
    if (content) {
      content.scrollIntoView({ behavior: "smooth" });
    }
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setStatus({ message: "Sending your feedback...", type: "submitting" });

    try {
      if (typeof onSubmitFeedback === "function") {
        await onSubmitFeedback(formData);
      } else {
        // Default API submission handler to backend /api/feedback
        const payload = {
          name: formData.get("name")?.toString() || "",
          email: formData.get("email")?.toString() || "",
          feedback_type: formData.get("type")?.toString() || "suggestion",
          message: formData.get("message")?.toString() || "",
        };

        const response = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Submission failed with status ${response.status}`);
        }
      }

      form.reset();
      setStatus({
        message: "Thank you. Your feedback has been submitted.",
        type: "success",
      });
    } catch {
      setStatus({
        message: "Your feedback could not be submitted. Please try again.",
        type: "error",
      });
    }
  }

  const title = isFeedback ? "FEEDBACK" : "ABOUT";

  return (
    <div className="mono-sticky-page">
      {/* =========================================================================
          FOREGROUND LAYER: scrolls over the fixed footer beneath it
          ========================================================================= */}
      <main className="mono-front-layer" id="top">
        {/* Full-screen Minimalist Black Hero Section */}
        <section className="mono-hero">
          <nav className="mono-top-nav" aria-label="Main navigation">
            <button
              type="button"
              onClick={handleNav("landing")}
              className="mono-top-nav-logo"
            >
              BASE
            </button>

            <div className="mono-top-nav-links">
              <button
                type="button"
                onClick={handleNav("landing")}
              >
                HOME
              </button>
              <button
                type="button"
                onClick={handleNav("rider")}
              >
                RIDE
              </button>
              <button
                type="button"
                onClick={handleNav("drive")}
              >
                DRIVE
              </button>
              <button
                type="button"
                onClick={handleNav("about")}
                className={!isFeedback ? "active-link" : ""}
              >
                ABOUT
              </button>
              <button
                type="button"
                onClick={handleNav("feedback")}
                className={isFeedback ? "active-link" : ""}
              >
                FEEDBACK
              </button>
              <button
                type="button"
                onClick={handleNav("how-surge-works")}
              >
                HOW SURGE WORKS
              </button>
            </div>
          </nav>

          {/* Centered Large White SCROLL DOWN ↓ cue */}
          <a
            className="mono-scroll-cue"
            href="#page-content"
            onClick={handleScrollToContent}
            aria-label="Scroll down to page content"
          >
            <span>SCROLL DOWN</span>
            <span aria-hidden="true" className="mono-arrow">
              ↓
            </span>
          </a>

          <span className="mono-hero-index" aria-hidden="true">
            {isFeedback ? "02 / 02" : "01 / 02"}
          </span>
        </section>

        {/* Foreground Content Section */}
        <section
          className="mono-page-content"
          id="page-content"
          aria-labelledby="mono-page-title"
        >
          <div className="mono-content-container">
            {isFeedback ? (
              <>
                <p className="mono-eyebrow">YOUR VOICE MATTERS</p>

                <h1 id="mono-page-title">
                  Let&apos;s hear
                  <br />
                  from you.
                </h1>

                <p className="mono-description">
                  Have a suggestion, noticed pricing discrepancies, or want to share feedback
                  on our driver network? Leave a message below.
                </p>

                <form
                  className="mono-feedback-form"
                  onSubmit={handleSubmit}
                  noValidate={false}
                >
                  <label>
                    YOUR NAME
                    <input
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder="Name"
                    />
                  </label>

                  <label>
                    EMAIL ADDRESS *
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      required
                    />
                  </label>

                  <label>
                    FEEDBACK TYPE
                    <select name="type" defaultValue="suggestion">
                      <option value="suggestion">Suggestion</option>
                      <option value="pricing">Surge / Pricing Query</option>
                      <option value="driver">Driver & Vehicle Quality</option>
                      <option value="bug">Report an issue</option>
                      <option value="other">Other</option>
                    </select>
                  </label>

                  <label>
                    YOUR MESSAGE *
                    <textarea
                      name="message"
                      placeholder="Write your thoughts here..."
                      rows={5}
                      required
                    />
                  </label>

                  <button
                    type="submit"
                    className="mono-submit"
                    disabled={status.type === "submitting"}
                  >
                    <span>
                      {status.type === "submitting" ? "SENDING..." : "SEND FEEDBACK"}
                    </span>
                    <span aria-hidden="true">↗</span>
                  </button>

                  <p
                    className={`mono-form-status ${status.type}`}
                    role="status"
                    aria-live="polite"
                  >
                    {status.message}
                  </p>
                </form>
              </>
            ) : (
              <>
                <p className="mono-eyebrow">A LITTLE INTRODUCTION</p>

                <h1 id="mono-page-title">
                  Behind
                  <br />
                  the details.
                </h1>

                <p className="mono-description">
                  Base is Mumbai&apos;s algorithmic ride-hailing network built with mathematical surge protection.
                  We eliminate predatory fare spikes through transparent road-network distance metering and a guaranteed
                  1.0× surge ceiling across MMR.
                </p>

                <div className="mono-about-grid">
                  <article>
                    <span className="mono-number">01</span>
                    <h2>The Mechanism</h2>
                    <p>
                      Guaranteed Surge Ceiling 1.0×. While legacy aggregators multiply fares up to 3.5× during monsoon
                      downpours or evening rush in Mumbai, Base holds pricing at a transparent ₹24 / km flat rate calculated
                      strictly on actual OSRM road network geometry.
                    </p>
                  </article>

                  <article>
                    <span className="mono-number">02</span>
                    <h2>The Economic Model</h2>
                    <p>
                      Balanced driver incentives backed by the central Surge Shield Fund. Drivers receive guaranteed hourly
                      clearing and fair distance compensation, preventing arbitrary trip cancellations across MMR.
                    </p>
                  </article>

                  <article>
                    <span className="mono-number">03</span>
                    <h2>Get In Touch</h2>
                    <p>
                      Notice algorithmic anomalies, have route suggestions, or want to partner? Visit our feedback page
                      and help us build equitable urban mobility.
                    </p>
                    <button
                      type="button"
                      className="mono-inline-link"
                      onClick={handleNav("feedback")}
                    >
                      GO TO FEEDBACK ↗
                    </button>
                  </article>
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      {/* =========================================================================
          BACKGROUND LAYER: revealed as the foreground scrolls away
          ========================================================================= */}
      <footer className="mono-sticky-footer">
        <nav className="mono-footer-nav" aria-label="Footer navigation">
          <div className="mono-footer-links">
            <button type="button" onClick={handleNav("landing")}>
              Home
            </button>
            <button type="button" onClick={handleNav("rider")}>
              Ride
            </button>
            <button type="button" onClick={handleNav("drive")}>
              Drive
            </button>
            <button type="button" onClick={handleNav("about")}>
              About
            </button>
            <button type="button" onClick={handleNav("feedback")}>
              Feedback
            </button>
            <button type="button" onClick={handleNav("how-surge-works")}>
              How surge works
            </button>
            <button type="button" onClick={handleScrollToTop}>
              Back to top ↑
            </button>
          </div>

          <p className="mono-footer-note">
            MADE TO BE SIMPLE.
            <br />
            BUILT WITH INTENTION.
          </p>
        </nav>

        {/* Oversized Serif Wordmark extending beyond visible edges */}
        <div className="mono-footer-wordmark" aria-hidden="true">
          {title}
        </div>
      </footer>
    </div>
  );
}
