"""
Simulation Clock for testing time-dependent ride-hailing algorithms without waiting.
Allows the background scheduler, verification windows, and 15-minute timeouts to be stepped forward instantly.
"""
import time
from datetime import datetime, timezone
from typing import Optional

class SimulationClock:
    def __init__(self):
        self._offset_seconds: float = 0.0
        self._is_frozen: bool = False
        self._frozen_timestamp: Optional[float] = None

    def now_ts(self) -> float:
        """Current epoch timestamp respecting any injected simulation offset."""
        if self._is_frozen and self._frozen_timestamp is not None:
            return self._frozen_timestamp
        return time.time() + self._offset_seconds

    def now_iso(self) -> str:
        """ISO 8601 formatted timestamp string."""
        return datetime.fromtimestamp(self.now_ts(), tz=timezone.utc).isoformat()

    def advance_seconds(self, seconds: float) -> float:
        """Advance the simulated clock by N seconds."""
        if self._is_frozen and self._frozen_timestamp is not None:
            self._frozen_timestamp += seconds
            return self._frozen_timestamp
        self._offset_seconds += seconds
        return self.now_ts()

    def advance_minutes(self, minutes: float) -> float:
        """Advance the simulated clock by N minutes."""
        return self.advance_seconds(minutes * 60.0)

    def reset_to_realtime(self) -> float:
        """Reset the clock back to real system time."""
        self._offset_seconds = 0.0
        self._is_frozen = False
        self._frozen_timestamp = None
        return self.now_ts()

    def get_status(self) -> dict:
        current_ts = self.now_ts()
        dt = datetime.fromtimestamp(current_ts, tz=timezone.utc)
        return {
            "epoch": current_ts,
            "iso": dt.isoformat(),
            "formatted": dt.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "offset_seconds": self._offset_seconds,
            "offset_minutes": round(self._offset_seconds / 60.0, 1),
            "is_frozen": self._is_frozen,
        }

# Global singleton clock
clock = SimulationClock()
