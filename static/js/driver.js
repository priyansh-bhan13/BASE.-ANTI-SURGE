/**
 * Driver App Module
 * Implements:
 * 1. Sign in and toggle Online / Offline.
 * 2. 5-second automatic location & heartbeat timer.
 * 3. Receive ride offers with a 15-second countdown timer, accept / decline.
 * 4. Trip progression: Navigate to pickup -> Arrived -> Start Trip -> End Trip.
 */

window.DriverApp = {
  activeDriverId: 'driver_1001', // Aarav Sharma by default
  isOnline: true,
  heartbeatInterval: null,
  offerCountdownInterval: null,
  currentOffer: null,
  activeTrip: null,
  map: null,
  driverMarker: null,

  init() {
    this.initMap();
    this.bindEvents();
    this.startHeartbeatLoop();
  },

  initMap() {
    const mapContainer = document.getElementById('driver-map');
    if (!mapContainer) return;

    this.map = L.map('driver-map', { zoomControl: false }).setView([19.0660, 72.8680], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap'
    }).addTo(this.map);

    const carIcon = L.divIcon({
      className: 'driver-car-marker',
      html: '<div style="background:#0A0A0A;color:#FAFAFA;border:1px solid #FAFAFA;outline:1px solid #0A0A0A;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:13px;">🚗</div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    this.driverMarker = L.marker([19.0660, 72.8680], { icon: carIcon }).addTo(this.map);
  },

  startHeartbeatLoop() {
    // 5-second location & heartbeat as required by spec
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 5000);
    this.sendHeartbeat();
  },

  async sendHeartbeat() {
    if (!this.activeDriverId) return;
    try {
      // Simulate minor drift/movement around BKC
      const currentPos = this.driverMarker ? this.driverMarker.getLatLng() : { lat: 19.0660, lng: 72.8680 };
      const jitterLat = currentPos.lat + (Math.random() - 0.5) * 0.0003;
      const jitterLng = currentPos.lng + (Math.random() - 0.5) * 0.0003;

      if (this.driverMarker) {
        this.driverMarker.setLatLng([jitterLat, jitterLng]);
      }

      await fetch('/api/driver/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: this.activeDriverId,
          lat: jitterLat,
          lng: jitterLng,
          status: this.isOnline ? 'online' : 'offline'
        })
      });

      // Update UI heartbeat indicator
      const hbIndicator = document.getElementById('driver-heartbeat-status');
      if (hbIndicator) {
        hbIndicator.innerText = `Heartbeat: Live (every 5s)`;
        hbIndicator.style.color = this.isOnline ? 'var(--base-green)' : 'var(--base-gray-600)';
      }
    } catch (e) {
      console.error('Error sending driver heartbeat', e);
    }
  },

  async toggleOnlineStatus(online) {
    this.isOnline = online;
    const statusStr = online ? 'online' : 'offline';
    try {
      await fetch(`/api/driver/toggle_status?driver_id=${this.activeDriverId}&status=${statusStr}`, {
        method: 'POST'
      });
      const badge = document.getElementById('driver-status-badge');
      if (badge) {
        badge.innerText = online ? 'YOU ARE ONLINE' : 'YOU ARE OFFLINE';
        badge.className = `status-badge ${online ? 'Normal' : 'Blocked'}`;
      }
      this.sendHeartbeat();
    } catch (e) {
      console.error('Error toggling driver status', e);
    }
  },

  onSystemUpdate(systemData) {
    if (!this.isOnline) return;

    // Check if there is an offer for this driver
    this.checkForOffers();

    // Check active trip status
    if (this.activeTrip) {
      const match = (systemData.active_requests || []).find(r => r.id === this.activeTrip.id);
      if (match) {
        this.activeTrip = match;
        this.renderTripControls(match.status);
      }
    }
  },

  async checkForOffers() {
    if (!this.activeDriverId || !this.isOnline || this.activeTrip) return;
    try {
      const resp = await fetch(`/api/driver/offer/${this.activeDriverId}`);
      const data = await resp.json();
      if (data.has_offer) {
        this.showOffer(data.offer);
      } else {
        if (this.currentOffer && !this.activeTrip) {
          this.dismissOffer();
        }
      }
    } catch (e) {
      console.error('Error checking for offers', e);
    }
  },

  showOffer(offer) {
    if (this.currentOffer && this.currentOffer.request_id === offer.request_id) {
      return; // already showing
    }

    this.currentOffer = offer;
    const offerModal = document.getElementById('driver-offer-card');
    const fareEl = document.getElementById('driver-offer-fare');
    const riderEl = document.getElementById('driver-offer-rider');
    const surgeEl = document.getElementById('driver-offer-surge');
    const timerBar = document.getElementById('driver-offer-timer-bar');

    if (offerModal) offerModal.style.display = 'block';
    if (fareEl) fareEl.innerText = `₹${offer.fare}`;
    if (riderEl) riderEl.innerText = `Passenger: ${offer.rider_name}`;
    if (surgeEl) surgeEl.innerText = `${offer.surge_multiplier}x Surge`;

    // 15-second countdown
    let remaining = offer.time_remaining_sec || 15;
    if (this.offerCountdownInterval) clearInterval(this.offerCountdownInterval);

    this.offerCountdownInterval = setInterval(() => {
      remaining -= 0.5;
      const pct = Math.max(0, (remaining / 15) * 100);
      if (timerBar) timerBar.style.width = `${pct}%`;
      const timeNum = document.getElementById('driver-offer-seconds');
      if (timeNum) timeNum.innerText = `${Math.ceil(remaining)}s`;

      if (remaining <= 0) {
        clearInterval(this.offerCountdownInterval);
        this.respondToOffer(false); // auto decline on timeout
      }
    }, 500);
  },

  dismissOffer() {
    this.currentOffer = null;
    if (this.offerCountdownInterval) clearInterval(this.offerCountdownInterval);
    const offerModal = document.getElementById('driver-offer-card');
    if (offerModal) offerModal.style.display = 'none';
  },

  async respondToOffer(accepted) {
    if (!this.currentOffer) return;
    const reqId = this.currentOffer.request_id;
    this.dismissOffer();

    try {
      const resp = await fetch('/api/driver/respond_offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: reqId,
          driver_id: this.activeDriverId,
          accepted: accepted
        })
      });
      const data = await resp.json();
      if (accepted && data.status === 'accepted') {
        this.activeTrip = { id: reqId, status: 'accepted' };
        this.renderTripControls('accepted');
      }
    } catch (e) {
      console.error('Error responding to offer', e);
    }
  },

  async performTripAction(action) {
    if (!this.activeTrip) return;
    try {
      await fetch('/api/driver/trip_action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: this.activeTrip.id,
          driver_id: this.activeDriverId,
          action: action
        })
      });

      if (action === 'complete_trip') {
        this.activeTrip = null;
        this.renderTripControls('completed');
      } else {
        const nextStatus = action === 'arrived' ? 'arrived' : (action === 'start_trip' ? 'in_trip' : 'accepted');
        this.renderTripControls(nextStatus);
      }
    } catch (e) {
      console.error('Error performing trip action', e);
    }
  },

  renderTripControls(status) {
    const tripPanel = document.getElementById('driver-trip-panel');
    const actionBtn = document.getElementById('driver-btn-trip-action');
    const tripDesc = document.getElementById('driver-trip-desc');

    if (!tripPanel || !actionBtn) return;

    if (!this.activeTrip || status === 'completed') {
      tripPanel.style.display = 'none';
      return;
    }

    tripPanel.style.display = 'block';

    if (status === 'accepted') {
      tripDesc.innerText = "Heading to Passenger Pickup Point";
      actionBtn.innerText = "Arrived at Pickup";
      actionBtn.onclick = () => this.performTripAction('arrived');
    } else if (status === 'arrived') {
      tripDesc.innerText = "Waiting for Passenger to board";
      actionBtn.innerText = "Start Trip";
      actionBtn.onclick = () => this.performTripAction('start_trip');
    } else if (status === 'in_trip') {
      tripDesc.innerText = "Driving to Destination with Passenger";
      actionBtn.innerText = "Complete Trip & Collect Fare";
      actionBtn.onclick = () => this.performTripAction('complete_trip');
    }
  },

  bindEvents() {
    const toggle = document.getElementById('driver-online-switch');
    if (toggle) {
      toggle.addEventListener('change', (e) => {
        this.toggleOnlineStatus(e.target.checked);
      });
    }

    const acceptBtn = document.getElementById('driver-btn-accept');
    const declineBtn = document.getElementById('driver-btn-decline');

    if (acceptBtn) acceptBtn.addEventListener('click', () => this.respondToOffer(true));
    if (declineBtn) declineBtn.addEventListener('click', () => this.respondToOffer(false));

    // Driver selector dropdown
    const driverSelect = document.getElementById('driver-account-select');
    if (driverSelect) {
      driverSelect.addEventListener('change', (e) => {
        this.activeDriverId = e.target.value;
        const nameText = driverSelect.options[driverSelect.selectedIndex].text;
        const nameHeader = document.getElementById('driver-profile-name');
        if (nameHeader) nameHeader.innerText = nameText;
        this.sendHeartbeat();
      });
    }
  }
};
