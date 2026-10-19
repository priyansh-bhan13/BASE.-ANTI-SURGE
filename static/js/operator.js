/**
 * Operator Panel Module
 * Real-time Zone Grid, Surge Protection State Machine Visualizer,
 * 5 Verification Signals Inspector, Running Subsidy Tracker,
 * Audit Log Stream, and Admin Test Controls (Bulk Logout, Attack Simulator, Clock).
 */

window.OperatorApp = {
  map: null,
  zonePolygons: {},
  driverMarkers: [],

  init() {
    this.initMap();
    this.bindEvents();
    this.fetchAuditLog();
    this.loadConfig();
  },

  initMap() {
    const mapContainer = document.getElementById('operator-map');
    if (!mapContainer) return;

    this.map = L.map('operator-map', { zoomControl: true }).setView([19.0660, 72.8550], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap'
    }).addTo(this.map);

    this.renderZoneLayers();
  },

  renderZoneLayers() {
    if (!this.map) return;

    // Mumbai Zones bounding boxes
    const zoneBoundsData = {
      bkc: [[19.0580, 72.8600], [19.0735, 72.8770]],
      bandra_west: [[19.0480, 72.8200], [19.0700, 72.8420]],
      khar: [[19.0650, 72.8250], [19.0780, 72.8450]],
      santacruz: [[19.0730, 72.8450], [19.0910, 72.8690]],
      kurla: [[19.0600, 72.8730], [19.0760, 72.8900]]
    };

    for (const [zid, bounds] of Object.entries(zoneBoundsData)) {
      const rect = L.rectangle(bounds, {
        color: '#276EF1',
        weight: 2,
        fillOpacity: 0.15
      }).addTo(this.map);

      rect.bindTooltip(zid.toUpperCase(), { permanent: false, direction: 'center' });
      this.zonePolygons[zid] = rect;
    }
  },

  onSystemUpdate(data) {
    this.renderMetrics(data);
    this.renderZoneCards(data.zones);
    this.updateMapEntities(data);
    this.fetchAuditLog();
  },

  renderMetrics(data) {
    const subsidyEl = document.getElementById('op-metric-subsidy');
    if (subsidyEl) {
      subsidyEl.innerText = `₹${(data.total_subsidy_held_back || 0).toLocaleString()}`;
    }

    const totalDriversEl = document.getElementById('op-metric-total-drivers');
    if (totalDriversEl) {
      const onlineCount = (data.drivers || []).filter(d => d.status === 'online').length;
      totalDriversEl.innerText = `${onlineCount} / ${(data.drivers || []).length}`;
    }

    const activeWindowsCountEl = document.getElementById('op-metric-windows-count');
    if (activeWindowsCountEl) {
      const protectedZones = Object.values(data.zones || {}).filter(z => z.state !== 'Normal').length;
      activeWindowsCountEl.innerText = `${protectedZones} Protected`;
    }
  },

  renderZoneCards(zones) {
    const container = document.getElementById('op-zone-cards-container');
    if (!container || !zones) return;

    let html = '';
    for (const [zid, z] of Object.entries(zones)) {
      const stateClass = z.state;
      const isShortage = z.current_drivers < (z.peak_drivers_5m * 0.5);

      // Color mapping for polygon (StudioBlank Monochrome Palette)
      if (this.zonePolygons[zid]) {
        let polyColor = '#71717A'; // Normal
        if (z.state === 'Protected') polyColor = '#0A0A0A';
        else if (z.state === 'Blocked') polyColor = '#DC2626';
        else if (z.state === 'Uncertain') polyColor = '#CA8A04';
        else if (z.state === 'Releasing') polyColor = '#71717A';
        this.zonePolygons[zid].setStyle({ color: polyColor, fillColor: polyColor });
      }

      html += `
        <div class="zone-stat-card ${z.state !== 'Normal' ? 'alert-border' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <div>
              <h3 style="font-size:15px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">${z.name}</h3>
              <span style="font-size:11px; font-family:var(--font-mono); color:var(--color-info);">ZONE: ${zid}</span>
            </div>
            <span class="status-badge ${stateClass}">${z.state}</span>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:14px; background:var(--color-gray-100); padding:12px; border:1px solid var(--color-gray-200);">
            <div>
              <div style="font-size:11px; color:var(--color-info); text-transform:uppercase;">Drivers (Now / Peak)</div>
              <div style="font-size:18px; font-weight:700; font-family:var(--font-mono); ${isShortage ? 'color:var(--color-error);' : ''}">
                ${z.current_drivers} <span style="font-size:13px; font-weight:400; color:var(--color-info);">/ ${z.peak_drivers_5m}</span>
              </div>
            </div>
            <div>
              <div style="font-size:11px; color:var(--color-info); text-transform:uppercase;">Surge Multiplier</div>
              <div style="font-size:18px; font-weight:700; font-family:var(--font-mono);">
                ${z.protected_multiplier}x
                ${z.ordinary_multiplier > z.protected_multiplier ? 
                  `<span style="font-size:12px; text-decoration:line-through; color:var(--color-error); margin-left:4px;">${z.ordinary_multiplier}x</span>` : ''}
              </div>
            </div>
          </div>

          ${z.active_window ? `
            <div style="background:var(--surface-base); padding:12px; border:1px solid var(--color-primary); border-left:3px solid var(--color-primary); margin-bottom:12px; font-size:12px;">
              <div style="font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:var(--color-primary); margin-bottom:4px;">SURGE PROTECTION WINDOW OPEN</div>
              <div style="font-family:var(--font-mono);">Reference Multiplier: <strong>${z.reference_multiplier}x</strong></div>
              <div>Verdict: <strong>${z.active_window.verdict}</strong> (${z.active_window.consecutive_genuine_checks || 0}/2 checks)</div>
              <div style="margin-top:4px; font-size:11px; color:var(--color-info);">${z.active_window.reason || ''}</div>
            </div>
          ` : ''}

          ${z.signals ? `
            <div style="border-top:1px solid var(--color-gray-200); padding-top:8px;">
              <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--color-info); margin-bottom:6px;">Verification Signals</div>
              <div class="signal-row">
                <span>1. Request Volume</span>
                <span class="signal-score-badge ${z.signals.s1_request_volume.type}">${z.signals.s1_request_volume.score > 0 ? '+' : ''}${z.signals.s1_request_volume.score}</span>
              </div>
              <div class="signal-row">
                <span>2. Driver Movement</span>
                <span class="signal-score-badge ${z.signals.s2_driver_movement.type}">${z.signals.s2_driver_movement.score > 0 ? '+' : ''}${z.signals.s2_driver_movement.score}</span>
              </div>
              <div class="signal-row">
                <span>3. Price Recovery</span>
                <span class="signal-score-badge ${z.signals.s3_recovery_speed.type}">${z.signals.s3_recovery_speed.score > 0 ? '+' : ''}${z.signals.s3_recovery_speed.score}</span>
              </div>
              <div class="signal-row">
                <span>4. Road Conditions</span>
                <span class="signal-score-badge ${z.signals.s4_traffic_conditions.type}">${z.signals.s4_traffic_conditions.score > 0 ? '+' : ''}${z.signals.s4_traffic_conditions.score}</span>
              </div>
              <div class="signal-row">
                <span>5. Heartbeat Gate</span>
                <span class="signal-score-badge ${z.signals.s5_data_reliability.gate_passed ? 'genuine' : 'suspicious'}">${z.signals.s5_data_reliability.gate_passed ? 'PASSED' : 'STALE GATE'}</span>
              </div>
              <div style="display:flex; justify-content:space-between; margin-top:8px; font-weight:700; font-size:13px;">
                <span>Total Verification Score:</span>
                <span style="color:${z.signals.total_score >= 2.0 ? 'var(--base-green)' : (z.signals.total_score <= -1.5 ? 'var(--base-red)' : 'var(--base-orange)')};">
                  ${z.signals.total_score > 0 ? '+' : ''}${z.signals.total_score}
                </span>
              </div>
            </div>
          ` : ''}

          <div style="margin-top:12px; display:flex; gap:8px;">
            <button class="base-btn-secondary" style="font-size:11px; padding:6px 10px; width:100%; justify-content:center;" onclick="OperatorApp.bulkLogoutZone('${zid}')">
              Bulk Logout Drivers
            </button>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  },

  updateMapEntities(data) {
    if (!this.map) return;

    // Clear old driver markers
    this.driverMarkers.forEach(m => this.map.removeLayer(m));
    this.driverMarkers = [];

    // Render drivers
    (data.drivers || []).forEach(d => {
      const isOnline = d.status === 'online';
      const markerColor = isOnline ? '#0E8345' : '#888888';
      const icon = L.divIcon({
        className: 'operator-driver-marker',
        html: `<div style="background:${markerColor}; border:2px solid #fff; border-radius:50%; width:16px; height:16px; box-shadow:0 1px 4px rgba(0,0,0,0.4);" title="${d.name} (${d.status})"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      const m = L.marker([d.lat, d.lng], { icon: icon }).addTo(this.map);
      m.bindTooltip(`${d.name} • ${d.status.toUpperCase()}`);
      this.driverMarkers.push(m);
    });
  },

  async fetchAuditLog() {
    try {
      const resp = await fetch('/api/operator/audit_log?limit=30');
      const data = await resp.json();
      this.renderAuditLogTable(data.audit_log || []);
    } catch (e) {
      console.error('Error fetching audit log', e);
    }
  },

  renderAuditLogTable(logs) {
    const tbody = document.getElementById('op-audit-table-body');
    if (!tbody) return;

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--base-gray-600); padding:20px;">No audit records yet.</td></tr>`;
      return;
    }

    let rowsHtml = '';
    logs.forEach(l => {
      const dateStr = new Date(l.created_at * 1000).toLocaleTimeString();
      rowsHtml += `
        <tr>
          <td><span style="font-family:monospace; font-size:11px;">${dateStr}</span></td>
          <td><strong>${l.zone_id.toUpperCase()}</strong></td>
          <td><span class="status-badge ${l.state}">${l.event_type}</span></td>
          <td>${l.ordinary_multiplier}x</td>
          <td><strong>${l.applied_multiplier}x</strong></td>
          <td style="font-size:12px; color:var(--base-gray-700);">${l.reason}</td>
        </tr>
      `;
    });
    tbody.innerHTML = rowsHtml;
  },

  async bulkLogoutZone(zoneId) {
    try {
      const url = zoneId ? `/api/operator/bulk_logout?zone_id=${zoneId}` : '/api/operator/bulk_logout';
      const resp = await fetch(url, { method: 'POST' });
      const data = await resp.json();
      this.fetchAuditLog();
    } catch (e) {
      console.error('Error logging out drivers', e);
    }
  },

  async simulateAttack(zoneId = 'bkc') {
    const btn = document.getElementById('op-btn-attack-sim');
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Simulating Collapse...";
    }
    try {
      await fetch(`/api/operator/simulate_attack?zone_id=${zoneId}`, { method: 'POST' });
      this.fetchAuditLog();
    } catch (e) {
      console.error('Error simulating attack', e);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = "⚡ 1-Click Trigger: Coordinated Driver Spike";
      }
    }
  },

  async seedDrivers() {
    try {
      await fetch('/api/operator/seed_drivers?count=5', { method: 'POST' });
    } catch (e) {
      console.error('Error seeding drivers', e);
    }
  },

  async loadConfig() {
    try {
      const resp = await fetch('/api/config');
      const cfg = await resp.json();
      const demoSwitch = document.getElementById('op-config-demo-switch');
      const trafficSelect = document.getElementById('op-config-traffic-select');
      if (demoSwitch) demoSwitch.checked = cfg.demo_mode;
      if (trafficSelect) trafficSelect.value = cfg.traffic_condition;
    } catch (e) {
      console.error('Error loading config', e);
    }
  },

  async updateConfig() {
    const demoSwitch = document.getElementById('op-config-demo-switch');
    const trafficSelect = document.getElementById('op-config-traffic-select');
    try {
      await fetch('/api/config/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          demo_mode: demoSwitch ? demoSwitch.checked : true,
          traffic_condition: trafficSelect ? trafficSelect.value : 'normal'
        })
      });
    } catch (e) {
      console.error('Error updating config', e);
    }
  },

  bindEvents() {
    const attackBtn = document.getElementById('op-btn-attack-sim');
    if (attackBtn) attackBtn.addEventListener('click', () => this.simulateAttack('bkc'));

    const seedBtn = document.getElementById('op-btn-seed-drivers');
    if (seedBtn) seedBtn.addEventListener('click', () => this.seedDrivers());

    const bulkLogoutAllBtn = document.getElementById('op-btn-bulk-logout-all');
    if (bulkLogoutAllBtn) bulkLogoutAllBtn.addEventListener('click', () => this.bulkLogoutZone(null));

    const demoSwitch = document.getElementById('op-config-demo-switch');
    if (demoSwitch) demoSwitch.addEventListener('change', () => this.updateConfig());

    const trafficSelect = document.getElementById('op-config-traffic-select');
    if (trafficSelect) trafficSelect.addEventListener('change', () => this.updateConfig());
  }
};
