/**
 * Main Application Controller
 * Handles Navigation Tabs, Split-screen view, WebSocket connection,
 * and Simulation Clock controls.
 */

const AppState = {
  currentTab: 'split', // default to split view so all 3 apps are visible side-by-side
  ws: null,
  systemData: null,
  activeCity: 'mumbai', // Mumbai Bandra/BKC default
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initClockControls();
  initWebSocket();
  
  // Initialize sub-apps
  if (window.RiderApp) RiderApp.init();
  if (window.DriverApp) DriverApp.init();
  if (window.OperatorApp) OperatorApp.init();
  if (window.ExplainerApp) ExplainerApp.init();
});

// Tab Switcher
function initTabs() {
  const tabBtns = document.querySelectorAll('.nav-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      switchTab(target);
    });
  });
}

function switchTab(tabId) {
  AppState.currentTab = tabId;
  
  // Update Buttons
  document.querySelectorAll('.nav-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });

  // Update Containers
  document.querySelectorAll('.view-container').forEach(c => {
    c.classList.remove('active');
  });

  const targetContainer = document.getElementById(`view-${tabId}`);
  if (targetContainer) {
    targetContainer.classList.add('active');
  }

  // Refresh maps when tab becomes visible
  setTimeout(() => {
    if (window.RiderApp && window.RiderApp.map) window.RiderApp.map.invalidateSize();
    if (window.DriverApp && window.DriverApp.map) window.DriverApp.map.invalidateSize();
    if (window.OperatorApp && window.OperatorApp.map) window.OperatorApp.map.invalidateSize();
  }, 200);
}

// WebSocket Connection
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/live`;

  function connect() {
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('✓ Connected to Surge Live WebSocket');
      const dot = document.getElementById('ws-live-indicator');
      if (dot) dot.style.backgroundColor = 'var(--base-green)';
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'INITIAL_STATE' || msg.type === 'SYSTEM_UPDATE') {
          AppState.systemData = msg.data;
          updateClockUI(msg.data.clock);
          if (window.OperatorApp) OperatorApp.onSystemUpdate(msg.data);
          if (window.DriverApp) DriverApp.onSystemUpdate(msg.data);
          if (window.RiderApp) RiderApp.onSystemUpdate(msg.data);
        }
      } catch (e) {
        console.error('Error parsing WebSocket message', e);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket closed. Reconnecting in 3s...');
      const dot = document.getElementById('ws-live-indicator');
      if (dot) dot.style.backgroundColor = 'var(--base-red)';
      setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error', err);
      ws.close();
    };

    AppState.ws = ws;
  }

  connect();
}

// Simulation Clock Controls
function initClockControls() {
  const btnAdv1m = document.getElementById('btn-adv-1m');
  const btnAdv5m = document.getElementById('btn-adv-5m');
  const btnReset = document.getElementById('btn-reset-clock');

  if (btnAdv1m) {
    btnAdv1m.addEventListener('click', async () => {
      await fetch('/api/clock/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: 1.0 })
      });
    });
  }

  if (btnAdv5m) {
    btnAdv5m.addEventListener('click', async () => {
      await fetch('/api/clock/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: 5.0 })
      });
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', async () => {
      await fetch('/api/clock/reset', { method: 'POST' });
    });
  }
}

function updateClockUI(clockInfo) {
  if (!clockInfo) return;
  const timeElem = document.getElementById('clock-display-time');
  const offsetElem = document.getElementById('clock-offset-badge');
  if (timeElem) {
    const d = new Date(clockInfo.epoch * 1000);
    timeElem.innerText = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  if (offsetElem) {
    if (clockInfo.offset_minutes > 0) {
      offsetElem.innerText = `+${clockInfo.offset_minutes}m simulated`;
      offsetElem.style.display = 'inline-block';
    } else {
      offsetElem.style.display = 'none';
    }
  }
}
