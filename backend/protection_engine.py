"""
Surge Protection Window Engine.
Handles trigger detection, state machine, multi-signal verification,
audit logging, and subsidy tracking.
"""
import uuid
import statistics
from typing import Dict, Any, List, Optional, Tuple
from backend.simulation_clock import clock
from backend.database import get_connection, log_audit, get_config
from backend.pricing import calculate_ordinary_surge
from backend.zones import ZONES

class ProtectionEngine:
    """
    State Machine States:
    - Normal: No active shortage protection window. Ordinary pricing applies.
    - Protected: Protection window active. Fares capped at pre-shortage reference multiplier.
    - Blocked: Verification found evidence of artificial shortage/manipulation; surge stays blocked.
    - Uncertain: Inconclusive signals or unreliable heartbeats; pre-shortage fare remains protected.
    - Releasing: 15-minute cap reached or shortage cleared; gradual ramp down to normal pricing.
    - Released: Protection window closed; entering 6-minute cooldown.
    """

    @staticmethod
    def get_zone_available_drivers(zone_id: str) -> List[dict]:
        """Get list of active online, non-busy drivers in a zone with fresh heartbeats."""
        conn = get_connection()
        c = conn.cursor()
        c.execute("""
        SELECT * FROM drivers 
        WHERE zone_id = ? AND status = 'online'
        """, (zone_id,))
        rows = [dict(r) for r in c.fetchall()]
        conn.close()
        return rows

    @staticmethod
    def get_recent_zone_history(zone_id: str, minutes: int = 10) -> List[dict]:
        """Retrieve recent minute snapshots for the zone."""
        conn = get_connection()
        c = conn.cursor()
        threshold_ts = clock.now_ts() - (minutes * 60.0)
        c.execute("""
        SELECT * FROM zone_history 
        WHERE zone_id = ? AND minute_ts >= ?
        ORDER BY minute_ts ASC
        """, (zone_id, threshold_ts))
        rows = [dict(r) for r in c.fetchall()]
        conn.close()
        return rows

    @staticmethod
    def get_active_window(zone_id: str) -> Optional[dict]:
        """Fetch current open protection window for a zone if one exists."""
        conn = get_connection()
        c = conn.cursor()
        c.execute("""
        SELECT * FROM protection_windows 
        WHERE zone_id = ? AND state != 'Released'
        ORDER BY opened_at DESC LIMIT 1
        """, (zone_id,))
        row = c.fetchone()
        conn.close()
        return dict(row) if row else None

    @staticmethod
    def get_last_closed_window(zone_id: str) -> Optional[dict]:
        """Fetch the most recently closed window to check cooldown."""
        conn = get_connection()
        c = conn.cursor()
        c.execute("""
        SELECT * FROM protection_windows 
        WHERE zone_id = ? AND state = 'Released'
        ORDER BY closed_at DESC LIMIT 1
        """, (zone_id,))
        row = c.fetchone()
        conn.close()
        return dict(row) if row else None

    @classmethod
    def evaluate_zone_trigger(cls, zone_id: str, current_ordinary_mult: float, current_drivers_count: int) -> bool:
        """
        Trigger Condition:
        Open the window when BOTH are true at the same minute:
        1. Available drivers fell by > 50% within 5 minutes, measured against the peak in that window.
           Peak must be >= 10 drivers (or >= demo_min_peak_drivers if demo mode).
        2. Potential surge exists: multiplier >= 1.5x, OR up by >= 0.3x within 5 min.
        Also verifies cooldown (6 min wait after previous release).
        """
        # Check active window
        active = cls.get_active_window(zone_id)
        if active:
            return False  # Already open

        # Check cooldown
        last_closed = cls.get_last_closed_window(zone_id)
        if last_closed and last_closed.get("cooldown_until"):
            if clock.now_ts() < last_closed["cooldown_until"]:
                return False  # In cooldown

        # Check configuration
        demo_mode = get_config("demo_mode", "true").lower() == "true"
        min_peak = int(get_config("demo_min_peak_drivers", "4") if demo_mode else get_config("prod_min_peak_drivers", "10"))
        drop_threshold = float(get_config("drop_threshold_pct", "0.50"))
        surge_min = float(get_config("trigger_surge_min", "1.50"))
        surge_delta = float(get_config("trigger_surge_delta", "0.30"))

        history = cls.get_recent_zone_history(zone_id, minutes=5)
        # Include current minute
        driver_counts = [h["available_drivers"] for h in history] + [current_drivers_count]
        multipliers = [h["ordinary_multiplier"] for h in history] + [current_ordinary_mult]

        peak_drivers = max(driver_counts) if driver_counts else current_drivers_count
        min_drivers_5m = min(driver_counts) if driver_counts else current_drivers_count
        earliest_mult = multipliers[0] if multipliers else 1.0
        mult_jump = current_ordinary_mult - earliest_mult

        # Condition 1: Peak check and > 50% drop
        if peak_drivers < min_peak:
            return False

        drop_pct = (peak_drivers - current_drivers_count) / peak_drivers
        if drop_pct <= drop_threshold:
            return False

        # Condition 2: Potential surge exists
        has_potential_surge = (current_ordinary_mult >= surge_min) or (mult_jump >= surge_delta)
        if not has_potential_surge:
            return False

        # BOTH conditions met! Open window!
        cls.open_protection_window(zone_id, current_ordinary_mult, peak_drivers, drop_pct, history)
        return True

    @classmethod
    def open_protection_window(
        cls,
        zone_id: str,
        current_ordinary_mult: float,
        peak_drivers: int,
        drop_pct: float,
        history: List[dict]
    ):
        """
        Opens the Surge Protection Window:
        - Reference multiplier = median multiplier from the minutes before the drop, floored at 1.0x.
        - Sets state to 'Protected'
        - Sets 15-minute cap timestamp
        - Logs audit event
        """
        now = clock.now_ts()
        pre_drop_mults = [h["ordinary_multiplier"] for h in history] if history else [1.0]
        if not pre_drop_mults:
            pre_drop_mults = [1.0]
        
        reference_multiplier = max(1.0, round(statistics.median(pre_drop_mults), 2))
        window_cap_minutes = float(get_config("window_cap_minutes", "15"))
        release_cap_time = now + (window_cap_minutes * 60.0)

        window_id = f"pw_{zone_id}_{int(now)}"
        conn = get_connection()
        c = conn.cursor()
        c.execute("""
        INSERT INTO protection_windows (
            id, zone_id, state, reference_multiplier, ordinary_multiplier_at_trigger,
            peak_drivers_5m, drop_pct, opened_at, last_assessment_at,
            consecutive_genuine_checks, verdict, reason, release_cap_time, cooldown_until
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'Uncertain', ?, ?, 0.0)
        """, (
            window_id, zone_id, "Protected", reference_multiplier, current_ordinary_mult,
            peak_drivers, drop_pct, now, now,
            f"Triggered: Drivers fell by {int(drop_pct*100)}% from peak {peak_drivers}. Potential surge {current_ordinary_mult}x.",
            release_cap_time
        ))
        conn.commit()
        conn.close()

        log_audit(
            zone_id=zone_id,
            event_type="TRIGGER_OPEN",
            state="Protected",
            ordinary_multiplier=current_ordinary_mult,
            applied_multiplier=reference_multiplier,
            reason=f"Suspicious driver collapse: availability fell {int(drop_pct*100)}% (peak: {peak_drivers} -> {peak_drivers - int(peak_drivers * drop_pct)}). Ordinary surge jumped to {current_ordinary_mult}x.",
            metadata={
                "window_id": window_id,
                "peak_drivers_5m": peak_drivers,
                "drop_pct": round(drop_pct, 2),
                "reference_multiplier": reference_multiplier,
                "release_cap_minutes": window_cap_minutes,
            }
        )

    @classmethod
    def verify_signals(cls, zone_id: str, window: dict) -> Dict[str, Any]:
        """
        Combine 5 signals into verification score:
        1. Request volume: requests rise (+1.5) vs flat/falling (-2.0)
        2. Driver movement: vanished (+1.0) vs appear in nearby zone (-2.5)
        3. Recovery after fare rises: fast rebound (-1.0 warning) vs slow/no return (+1.0)
        4. Traffic & road conditions: worse (+1.0) vs normal (0.0)
        5. Data reliability (GATE!): stale/broken heartbeats -> force to Uncertain
        """
        now = clock.now_ts()
        conn = get_connection()
        c = conn.cursor()

        # Signal 1: Request Volume
        # Compare requests in current window vs before window
        opened_at = window["opened_at"]
        c.execute("SELECT COUNT(*) FROM ride_requests WHERE pickup_zone_id = ? AND created_at >= ?", (zone_id, opened_at))
        requests_during = c.fetchone()[0]
        
        c.execute("SELECT COUNT(*) FROM ride_requests WHERE pickup_zone_id = ? AND created_at >= ? AND created_at < ?", (
            zone_id, opened_at - 300, opened_at
        ))
        requests_before = c.fetchone()[0]

        if requests_during > (requests_before * 1.2) or requests_during >= 3:
            s1_score = +1.5
            s1_detail = f"Requests rising ({requests_during} in window vs {requests_before} prior) - points to genuine demand"
            s1_type = "genuine"
        else:
            s1_score = -2.0
            s1_detail = f"Requests flat/falling ({requests_during} in window vs {requests_before} prior) - suspicious"
            s1_type = "suspicious"

        # Signal 2: Driver Movement
        # Did drivers go offline or appear in neighboring zones?
        neighbors = ZONES.get(zone_id, {}).get("neighbors", [])
        placeholders = ",".join("?" for _ in neighbors) if neighbors else "''"
        query = f"SELECT COUNT(*) FROM drivers WHERE zone_id IN ({placeholders}) AND status = 'online' AND last_heartbeat >= ?"
        c.execute(query, (*neighbors, now - 60))
        neighbor_drivers_active = c.fetchone()[0] if neighbors else 0

        # Check if drivers logged out recently vs moved
        c.execute("SELECT COUNT(*) FROM drivers WHERE zone_id = ? AND status = 'offline'", (zone_id,))
        offline_in_zone = c.fetchone()[0]

        if neighbor_drivers_active >= 3:
            s2_score = -2.5
            s2_detail = f"{neighbor_drivers_active} drivers active in adjacent zones {neighbors} - points to gaming/relocation"
            s2_type = "suspicious"
        else:
            s2_score = +1.0
            s2_detail = f"No unusual clustering in adjacent zones ({offline_in_zone} offline in zone) - genuine exit"
            s2_type = "genuine"

        # Signal 3: Recovery after fare rises (Lowest weight, warning only)
        c.execute("SELECT COUNT(*) FROM drivers WHERE zone_id = ? AND status = 'online'", (zone_id,))
        current_online = c.fetchone()[0]
        peak = window["peak_drivers_5m"]
        recovery_pct = current_online / max(1, peak)

        if recovery_pct >= 0.8:
            s3_score = -1.0
            s3_detail = f"Fast rebound: {int(recovery_pct*100)}% drivers returned once price surged - suspicious warning"
            s3_type = "suspicious"
        else:
            s3_score = +1.0
            s3_detail = f"Slow/no return ({int(recovery_pct*100)}% returned) - consistent with real shortage"
            s3_type = "genuine"

        # Signal 4: Traffic / Road conditions
        traffic_mode = get_config("traffic_condition", "normal")
        if traffic_mode == "worse_than_normal":
            s4_score = +1.0
            s4_detail = "Severe congestion/rain reported in zone (+1.0 genuine)"
            s4_type = "genuine"
        else:
            s4_score = 0.0
            s4_detail = "Traffic flow normal for time of day (0.0 neutral)"
            s4_type = "neutral"

        # Signal 5: Data Reliability (GATE)
        # Check active & test driver heartbeats
        c.execute("SELECT COUNT(*), MAX(last_heartbeat), MIN(last_heartbeat) FROM drivers WHERE zone_id = ? AND status = 'online'", (zone_id,))
        hb_row = c.fetchone()
        online_count = hb_row[0]
        min_hb = hb_row[2] or now

        # Stale threshold: if any driver hasn't sent heartbeat in > 20s
        is_stale = (online_count > 0) and ((now - min_hb) > 20.0)
        conn.close()

        if is_stale:
            s5_gate_passed = False
            s5_detail = f"Heartbeats stale (oldest heartbeat {int(now - min_hb)}s ago) - GATE FAILED"
        else:
            s5_gate_passed = True
            s5_detail = f"Driver heartbeats fresh (<20s latency) - GATE PASSED"

        total_score = round(s1_score + s2_score + s3_score + s4_score, 2)

        return {
            "s1_request_volume": {"score": s1_score, "type": s1_type, "detail": s1_detail},
            "s2_driver_movement": {"score": s2_score, "type": s2_type, "detail": s2_detail},
            "s3_recovery_speed": {"score": s3_score, "type": s3_type, "detail": s3_detail},
            "s4_traffic_conditions": {"score": s4_score, "type": s4_type, "detail": s4_detail},
            "s5_data_reliability": {"gate_passed": s5_gate_passed, "detail": s5_detail},
            "total_score": total_score,
        }

    @classmethod
    def reassess_active_window(cls, zone_id: str, current_ordinary_mult: float) -> dict:
        """
        Reassess after 1 minute, then every minute:
        Outcomes:
        - Suspicious (score <= -1.5): Surge increase stays blocked. State = 'Blocked'.
        - Uncertain (gate failed or score between -1.5 and +2.0): Pre-shortage fare stays protected. State = 'Uncertain'.
        - Genuine (score >= +2.0 confirmed on 2 checks in a row): Normal pricing recalculated before booking.
        - Shortage clears on its own: Price steps back to normal over about 2 minutes.
        - 15-minute cap reached while still uncertain: Gradual release, flagged for human review.
        """
        now = clock.now_ts()
        window = cls.get_active_window(zone_id)
        if not window:
            return {"status": "no_active_window"}

        signals = cls.verify_signals(zone_id, window)
        gate_passed = signals["s5_data_reliability"]["gate_passed"]
        total_score = signals["total_score"]
        window_duration_min = (now - window["opened_at"]) / 60.0

        conn = get_connection()
        c = conn.cursor()

        new_state = window["state"]
        verdict = window["verdict"]
        consecutive_genuine = window["consecutive_genuine_checks"]
        reason = ""
        cooldown_until = 0.0

        # Check 15-minute cap first
        if now >= window["release_cap_time"]:
            new_state = "Released"
            verdict = "Released (15m Cap Timeout)"
            reason = "15-minute cap reached without conclusive proof. Gradual release initiated. Zone flagged for human review."
            cooldown_min = float(get_config("cooldown_minutes", "6"))
            cooldown_until = now + (cooldown_min * 60.0)

            c.execute("""
            UPDATE protection_windows 
            SET state = ?, verdict = ?, reason = ?, closed_at = ?, cooldown_until = ?, last_assessment_at = ?
            WHERE id = ?
            """, (new_state, verdict, reason, now, cooldown_until, now, window["id"]))
            conn.commit()
            conn.close()

            log_audit(
                zone_id=zone_id,
                event_type="RELEASE_CAP",
                state=new_state,
                ordinary_multiplier=current_ordinary_mult,
                applied_multiplier=current_ordinary_mult,
                reason=reason,
                metadata={"signals": signals, "duration_minutes": round(window_duration_min, 1)}
            )
            return {"window_id": window["id"], "state": new_state, "verdict": verdict, "reason": reason, "signals": signals}

        # Check if shortage cleared on its own
        current_drivers = len(cls.get_zone_available_drivers(zone_id))
        if current_drivers >= window["peak_drivers_5m"]:
            new_state = "Released"
            verdict = "Cleared Naturally"
            reason = f"Shortage resolved on its own: driver availability recovered to {current_drivers} (peak was {window['peak_drivers_5m']})."
            cooldown_min = float(get_config("cooldown_minutes", "6"))
            cooldown_until = now + (cooldown_min * 60.0)

            c.execute("""
            UPDATE protection_windows 
            SET state = ?, verdict = ?, reason = ?, closed_at = ?, cooldown_until = ?, last_assessment_at = ?
            WHERE id = ?
            """, (new_state, verdict, reason, now, cooldown_until, now, window["id"]))
            conn.commit()
            conn.close()

            log_audit(
                zone_id=zone_id,
                event_type="RELEASE_NATURAL",
                state=new_state,
                ordinary_multiplier=current_ordinary_mult,
                applied_multiplier=current_ordinary_mult,
                reason=reason,
                metadata={"signals": signals}
            )
            return {"window_id": window["id"], "state": new_state, "verdict": verdict, "reason": reason, "signals": signals}

        # Verification scoring evaluation
        if not gate_passed:
            verdict = "Uncertain"
            new_state = "Uncertain"
            reason = "Heartbeats stale or unreliable. Data reliability gate failed; pre-shortage fare remains protected."
            consecutive_genuine = 0
        elif total_score <= -1.5:
            verdict = "Suspicious"
            new_state = "Blocked"
            reason = f"Manipulation suspected (Score: {total_score} <= -1.5). Surge increase blocked."
            consecutive_genuine = 0
        elif total_score >= 2.0:
            consecutive_genuine += 1
            if consecutive_genuine >= 2:
                # Confirmed on 2 checks in a row!
                new_state = "Released"
                verdict = "Confirmed Genuine"
                reason = f"Confirmed Genuine shortage on 2 consecutive checks (Score: {total_score}). Normal market pricing restored."
                cooldown_min = float(get_config("cooldown_minutes", "6"))
                cooldown_until = now + (cooldown_min * 60.0)
            else:
                new_state = "Protected"
                verdict = "Genuine (Check 1 of 2)"
                reason = f"Score {total_score} indicates genuine demand surge; awaiting 2nd consecutive verification."
        else:
            # In the uncertain gap (-1.5 < score < 2.0)
            verdict = "Uncertain"
            new_state = "Uncertain"
            reason = f"Inconclusive signals (Score: {total_score} within [-1.5, +2.0]). Pre-shortage reference fare protected."
            consecutive_genuine = 0

        closed_at = now if new_state == "Released" else None

        c.execute("""
        UPDATE protection_windows 
        SET state = ?, verdict = ?, reason = ?, consecutive_genuine_checks = ?, 
            last_assessment_at = ?, closed_at = ?, cooldown_until = ?
        WHERE id = ?
        """, (new_state, verdict, reason, consecutive_genuine, now, closed_at, cooldown_until, window["id"]))
        conn.commit()
        conn.close()

        log_audit(
            zone_id=zone_id,
            event_type="RELEASE_GENUINE" if new_state == "Released" else "ASSESSMENT",
            state=new_state,
            ordinary_multiplier=current_ordinary_mult,
            applied_multiplier=current_ordinary_mult if new_state == "Released" else window["reference_multiplier"],
            reason=reason,
            metadata={"signals": signals, "consecutive_genuine": consecutive_genuine}
        )

        return {
            "window_id": window["id"],
            "state": new_state,
            "verdict": verdict,
            "reason": reason,
            "signals": signals,
            "consecutive_genuine": consecutive_genuine,
            "reference_multiplier": window["reference_multiplier"],
        }

    @classmethod
    def get_effective_multiplier(cls, zone_id: str, ordinary_multiplier: float) -> Tuple[float, bool, Optional[dict]]:
        """
        Determines the multiplier charged to riders:
        Rule: the multiplier charged is the lower of the reference and the current ordinary multiplier.
        Rider never pays more than ordinary pricing would charge.
        Returns: (effective_multiplier, is_protected, active_window_dict)
        """
        window = cls.get_active_window(zone_id)
        if not window:
            return ordinary_multiplier, False, None

        ref = window["reference_multiplier"]
        # Rule: lower of reference and ordinary multiplier
        effective = min(ref, ordinary_multiplier)
        is_protected = (effective < ordinary_multiplier)
        return effective, is_protected, window
