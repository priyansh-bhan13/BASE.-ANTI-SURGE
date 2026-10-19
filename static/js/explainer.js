/**
 * Explainer Page Module: "How Surge Pricing Can Be Gamed"
 * Includes Interactive Walkthrough with Live Numbers,
 * Interactive 4-Outcome Matrix, and Verification Signal Visualizer.
 */

window.ExplainerApp = {
  timelineStep: 0,
  timelineData: [
    {
      minute: "00:00",
      drivers: 12,
      requests: 4,
      ordinarySurge: 1.0,
      protectedSurge: 1.0,
      status: "Normal",
      decision: "Baseline market equilibrium. Available supply comfortably meets rider demand.",
      signals: { s1: 0, s2: 0, s3: 0, s4: 0, s5: "OK" }
    },
    {
      minute: "00:02",
      drivers: 4, // 66% drop from 12!
      requests: 6,
      ordinarySurge: 1.9,
      protectedSurge: 1.0,
      status: "Protected (Triggered)",
      decision: "TRIGGER FIRED: Drivers dropped by 66% (>50%) from peak 12. Potential surge reaches 1.9x. Protection Window opens at 1.0x reference.",
      signals: { s1: -2.0, s2: -2.5, s3: 0, s4: 0, s5: "OK" }
    },
    {
      minute: "00:03",
      drivers: 4,
      requests: 5,
      ordinarySurge: 2.2,
      protectedSurge: 1.0,
      status: "Blocked",
      decision: "MINUTE 1 REASSESSMENT: Verification score is -2.5 (Suspicious: requests flat, missing drivers detected in adjacent zone). Surge stays BLOCKED.",
      signals: { s1: -2.0, s2: -2.5, s3: 0, s4: 0, s5: "OK" }
    },
    {
      minute: "00:04",
      drivers: 11, // Sudden rebound!
      requests: 5,
      ordinarySurge: 1.4,
      protectedSurge: 1.0,
      status: "Blocked (Fast Rebound Warning)",
      decision: "MINUTE 2 REASSESSMENT: Sudden rapid return of drivers (+1.0 penalty). Confirms opportunistic manipulation.",
      signals: { s1: -2.0, s2: -2.5, s3: -1.0, s4: 0, s5: "OK" }
    },
    {
      minute: "00:05",
      drivers: 12,
      requests: 4,
      ordinarySurge: 1.0,
      protectedSurge: 1.0,
      status: "Released (Naturally Cleared)",
      decision: "Shortage resolved naturally as driver supply restored to 12. 6-minute cooldown engaged.",
      signals: { s1: 0, s2: 0, s3: 0, s4: 0, s5: "OK" }
    }
  ],

  init() {
    this.bindEvents();
    this.renderTimelineStep(0);
  },

  renderTimelineStep(index) {
    this.timelineStep = index;
    const item = this.timelineData[index];
    if (!item) return;

    const minEl = document.getElementById('ex-sim-minute');
    const drvEl = document.getElementById('ex-sim-drivers');
    const reqEl = document.getElementById('ex-sim-requests');
    const ordEl = document.getElementById('ex-sim-ord-mult');
    const protEl = document.getElementById('ex-sim-prot-mult');
    const badgeEl = document.getElementById('ex-sim-status-badge');
    const descEl = document.getElementById('ex-sim-decision-text');

    if (minEl) minEl.innerText = item.minute;
    if (drvEl) drvEl.innerText = `${item.drivers} drivers`;
    if (reqEl) reqEl.innerText = `${item.requests} rides`;
    if (ordEl) ordEl.innerText = `${item.ordinarySurge}x`;
    if (protEl) protEl.innerText = `${item.protectedSurge}x`;
    if (descEl) descEl.innerText = item.decision;

    if (badgeEl) {
      badgeEl.innerText = item.status;
      badgeEl.className = `status-badge ${item.status.includes('Protected') ? 'Protected' : (item.status.includes('Blocked') ? 'Blocked' : 'Normal')}`;
    }

    // Step dots
    document.querySelectorAll('.timeline-step-btn').forEach((btn, idx) => {
      btn.classList.toggle('active', idx === index);
    });
  },

  bindEvents() {
    document.querySelectorAll('.timeline-step-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        this.renderTimelineStep(idx);
      });
    });

    const nextBtn = document.getElementById('ex-btn-next-step');
    const prevBtn = document.getElementById('ex-btn-prev-step');

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const nextIdx = (this.timelineStep + 1) % this.timelineData.length;
        this.renderTimelineStep(nextIdx);
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        const prevIdx = (this.timelineStep - 1 + this.timelineData.length) % this.timelineData.length;
        this.renderTimelineStep(prevIdx);
      });
    }
  }
};
