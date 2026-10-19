/**
 * Rider App Module
 * Implements:
 * 1. Name & phone simple login.
 * 2. Interactive Leaflet map (Bandra / BKC default) with tap-to-set pickup & drop-off.
 * 3. Real-time Fare estimate, distance, and duration.
 * 4. Silent surge protection (looks normal, quotes pre-shortage reference).
 * 5. Ride request & lifecycle: 'finding driver' -> 'driver on the way' -> 'in trip' -> 'trip ended'.
 */

window.RiderApp = {
  map: null,
  pickupMarker: null,
  dropoffMarker: null,
  routePolyline: null,
  driverMarker: null,

  // Selected Points (defaults: BKC to Bandra West Linking Rd)
  pickup: { lat: 19.0657, lng: 72.8686, address: "BKC Complex, Mumbai" },
  dropoff: { lat: 19.0596, lng: 72.8295, address: "Linking Road, Bandra West" },
  clickMode: 'pickup', // toggles between setting pickup and dropoff

  currentQuote: null,
  activeRide: null,
  selectedVehicle: 'car',

  init() {
    this.initMap();
    this.bindEvents();
    this.requestQuote();
  },

  initMap() {
    const mapContainer = document.getElementById('rider-map');
    if (!mapContainer) return;

    // Centered on BKC / Bandra, Mumbai
    this.map = L.map('rider-map', {
      zoomControl: true,
    }).setView([19.0630, 72.8490], 13);

    // OpenStreetMap clean tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap'
    }).addTo(this.map);

    // Click handler on map
    this.map.on('click', (e) => {
      this.handleMapClick(e.latlng);
    });

    this.renderMarkersAndRoute();
  },

  handleMapClick(latlng) {
    if (this.activeRide && this.activeRide.status !== 'completed') {
      return; // Cannot change points while active ride in progress
    }

    if (this.clickMode === 'pickup') {
      this.pickup = {
        lat: Number(latlng.lat.toFixed(5)),
        lng: Number(latlng.lng.toFixed(5)),
        address: `Custom Pickup (${latlng.lat.toFixed(3)}, ${latlng.lng.toFixed(3)})`
      };
      this.clickMode = 'dropoff';
      this.updateAddressInputs();
    } else {
      this.dropoff = {
        lat: Number(latlng.lat.toFixed(5)),
        lng: Number(latlng.lng.toFixed(5)),
        address: `Custom Drop-off (${latlng.lat.toFixed(3)}, ${latlng.lng.toFixed(3)})`
      };
      this.clickMode = 'pickup';
      this.updateAddressInputs();
    }

    this.renderMarkersAndRoute();
    this.requestQuote();
  },

  renderMarkersAndRoute() {
    if (!this.map) return;

    // Remove existing
    if (this.pickupMarker) this.map.removeLayer(this.pickupMarker);
    if (this.dropoffMarker) this.map.removeLayer(this.dropoffMarker);
    if (this.routePolyline) this.map.removeLayer(this.routePolyline);

    // Pickup Icon (Black square with white border)
    const pickupIcon = L.divIcon({
      className: 'custom-pin-pickup',
      html: '<div style="width:14px;height:14px;background:#0A0A0A;border:2px solid #FFFFFF;outline:1px solid #0A0A0A;"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    // Dropoff Icon (White square with black border)
    const dropoffIcon = L.divIcon({
      className: 'custom-pin-dropoff',
      html: '<div style="width:14px;height:14px;background:#FFFFFF;border:2px solid #0A0A0A;"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    this.pickupMarker = L.marker([this.pickup.lat, this.pickup.lng], { icon: pickupIcon }).addTo(this.map);
    this.dropoffMarker = L.marker([this.dropoff.lat, this.dropoff.lng], { icon: dropoffIcon }).addTo(this.map);

    // Simple connecting route line
    this.routePolyline = L.polyline([
      [this.pickup.lat, this.pickup.lng],
      [this.dropoff.lat, this.dropoff.lng]
    ], {
      color: '#000000',
      weight: 4,
      opacity: 0.85,
      dashArray: '8, 8'
    }).addTo(this.map);

    this.map.fitBounds([
      [this.pickup.lat, this.pickup.lng],
      [this.dropoff.lat, this.dropoff.lng]
    ], { padding: [50, 50] });
  },

  updateAddressInputs() {
    const pickupInput = document.getElementById('rider-pickup-label');
    const dropoffInput = document.getElementById('rider-dropoff-label');
    if (pickupInput) pickupInput.innerText = this.pickup.address;
    if (dropoffInput) dropoffInput.innerText = this.dropoff.address;
  },

  async requestQuote() {
    try {
      const resp = await fetch('/api/rider/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup_lat: this.pickup.lat,
          pickup_lng: this.pickup.lng,
          dropoff_lat: this.dropoff.lat,
          dropoff_lng: this.dropoff.lng,
          pickup_address: this.pickup.address,
          dropoff_address: this.dropoff.address,
        })
      });
      const data = await resp.json();
      this.currentQuote = data;
      this.renderQuoteUI(data);
    } catch (e) {
      console.error('Failed to get fare quote', e);
    }
  },

  renderQuoteUI(quote) {
    const fareElem = document.getElementById('rider-fare-amount');
    const distElem = document.getElementById('rider-quote-distance');
    const timeElem = document.getElementById('rider-quote-time');
    const zoneElem = document.getElementById('rider-quote-zone');
    const bookBtn = document.getElementById('rider-btn-book');

    if (fareElem) fareElem.innerText = `₹${quote.fare}`;
    if (distElem) distElem.innerText = `${quote.distance_km} km`;
    if (timeElem) timeElem.innerText = `${quote.duration_min} min`;
    if (zoneElem) zoneElem.innerText = quote.zone_name;

    // Update vehicle choices
    const vCar = document.getElementById('fare-opt-car');
    const vAuto = document.getElementById('fare-opt-auto');
    const vSuv = document.getElementById('fare-opt-suv');

    if (vCar) vCar.innerText = `₹${quote.fare}`;
    if (vAuto) vAuto.innerText = `₹${Math.max(50, Math.round(quote.fare * 0.65))}`;
    if (vSuv) vSuv.innerText = `₹${Math.round(quote.fare * 1.35)}`;

    if (bookBtn && (!this.activeRide || this.activeRide.status === 'completed')) {
      bookBtn.disabled = false;
      bookBtn.innerHTML = `Request Ride &nbsp; <span style="font-size:18px;">&rarr;</span>`;
    }
  },

  async bookRide() {
    if (!this.currentQuote) return;
    const name = document.getElementById('rider-name-input')?.value || "Priyansh";
    const phone = document.getElementById('rider-phone-input')?.value || "+91 98765 43210";

    const bookBtn = document.getElementById('rider-btn-book');
    if (bookBtn) {
      bookBtn.disabled = true;
      bookBtn.innerText = "Finding driver...";
    }

    try {
      const resp = await fetch('/api/rider/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote_id: this.currentQuote.quote_id,
          rider_name: name,
          rider_phone: phone
        })
      });
      const data = await resp.json();
      this.activeRide = {
        id: data.request_id,
        status: data.status,
        fare: data.fare,
        surge_multiplier: data.surge_multiplier
      };
      this.renderRideStatusCard('finding');
    } catch (e) {
      console.error('Failed to book ride', e);
      if (bookBtn) {
        bookBtn.disabled = false;
        bookBtn.innerText = "Request Ride &nbsp; &rarr;";
      }
    }
  },

  onSystemUpdate(systemData) {
    if (!this.activeRide) return;

    // Look for our active ride in system requests
    const match = (systemData.active_requests || []).find(r => r.id === this.activeRide.id);
    if (match) {
      this.activeRide = match;
      this.renderRideStatusCard(match.status, match);
    } else {
      // Check if ride was completed
      if (this.activeRide.status === 'in_trip' || this.activeRide.status === 'arrived') {
        this.fetchLatestRideStatus();
      }
    }
  },

  async fetchLatestRideStatus() {
    if (!this.activeRide) return;
    try {
      const resp = await fetch(`/api/rider/ride/${this.activeRide.id}`);
      const data = await resp.json();
      this.activeRide = data.ride;
      this.renderRideStatusCard(data.ride.status, data.ride, data.driver);
    } catch (e) {
      console.error('Error fetching ride status', e);
    }
  },

  renderRideStatusCard(status, rideDetails = null, driverDetails = null) {
    const bookingPanel = document.getElementById('rider-booking-panel');
    const statusPanel = document.getElementById('rider-status-panel');
    const statusTitle = document.getElementById('rider-status-title');
    const statusDesc = document.getElementById('rider-status-desc');
    const driverRow = document.getElementById('rider-driver-contact-row');

    if (!statusPanel) return;

    if (status === 'finding' || status === 'pending' || status === 'offered') {
      bookingPanel.style.display = 'none';
      statusPanel.style.display = 'block';
      statusTitle.innerText = "Finding your driver";
      statusDesc.innerText = "Matching with nearest available vehicle in Mumbai...";
      if (driverRow) driverRow.style.display = 'none';
    } else if (status === 'accepted') {
      bookingPanel.style.display = 'none';
      statusPanel.style.display = 'block';
      statusTitle.innerText = "Driver on the way";
      statusDesc.innerText = "Your driver is heading to pickup. Arriving in ~3 mins.";
      if (driverRow) driverRow.style.display = 'flex';
      this.updateDriverInfo(driverDetails);
    } else if (status === 'arrived') {
      bookingPanel.style.display = 'none';
      statusPanel.style.display = 'block';
      statusTitle.innerText = "Driver has arrived!";
      statusDesc.innerText = "Please meet your driver at the pickup location.";
      if (driverRow) driverRow.style.display = 'flex';
    } else if (status === 'in_trip') {
      bookingPanel.style.display = 'none';
      statusPanel.style.display = 'block';
      statusTitle.innerText = "In Trip";
      statusDesc.innerText = "Heading to your destination. Sit back and relax.";
      if (driverRow) driverRow.style.display = 'flex';
    } else if (status === 'completed') {
      bookingPanel.style.display = 'none';
      statusPanel.style.display = 'block';
      statusTitle.innerText = "Trip Completed";
      statusDesc.innerText = `Final Fare: ₹${rideDetails ? rideDetails.final_fare : this.activeRide.fare}`;
      if (driverRow) driverRow.style.display = 'none';
      
      const resetBtn = document.getElementById('rider-btn-reset');
      if (resetBtn) resetBtn.style.display = 'block';
    }
  },

  updateDriverInfo(driver) {
    if (!driver) return;
    const nameEl = document.getElementById('rider-driver-name');
    const vehicleEl = document.getElementById('rider-driver-vehicle');
    if (nameEl) nameEl.innerText = driver.name || "Aarav Sharma";
    if (vehicleEl) vehicleEl.innerText = `${(driver.vehicle_type || 'car').toUpperCase()} • MH 02 BK 4092`;
  },

  resetBooking() {
    this.activeRide = null;
    const bookingPanel = document.getElementById('rider-booking-panel');
    const statusPanel = document.getElementById('rider-status-panel');
    const resetBtn = document.getElementById('rider-btn-reset');

    if (bookingPanel) bookingPanel.style.display = 'block';
    if (statusPanel) statusPanel.style.display = 'none';
    if (resetBtn) resetBtn.style.display = 'none';

    this.requestQuote();
  },

  bindEvents() {
    const bookBtn = document.getElementById('rider-btn-book');
    if (bookBtn) {
      bookBtn.addEventListener('click', () => this.bookRide());
    }

    const resetBtn = document.getElementById('rider-btn-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetBooking());
    }

    // Preset location buttons
    document.querySelectorAll('.preset-loc-btn').forEach(b => {
      b.addEventListener('click', () => {
        const target = b.dataset.loc;
        if (target === 'bkc_to_bandra') {
          this.pickup = { lat: 19.0657, lng: 72.8686, address: "BKC Complex, Mumbai" };
          this.dropoff = { lat: 19.0596, lng: 72.8295, address: "Linking Road, Bandra West" };
        } else if (target === 'bandra_to_khar') {
          this.pickup = { lat: 19.0596, lng: 72.8295, address: "Linking Road, Bandra West" };
          this.dropoff = { lat: 19.0700, lng: 72.8340, address: "Khar West, Mumbai" };
        }
        this.updateAddressInputs();
        this.renderMarkersAndRoute();
        this.requestQuote();
      });
    });

    // Vehicle selection cards
    document.querySelectorAll('.vehicle-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.vehicle-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedVehicle = card.dataset.vehicle;
      });
    });
  }
};
