"""Recognise what an appliance is doing from its power alone.

This is rule-based on purpose: every decision can be explained. The laptop's
battery level is NOT read, so "charging finished" is an estimate from the
power pattern. All thresholds can be changed in the settings.
"""
from datetime import datetime

LABELS = {
    "unknown": "Waiting for data",
    "off": "Off or unplugged",
    "sleep": "Asleep (a few watts)",
    "high": "Charging or in heavy use",
    "idle": "On, idle",
    "full_idle": "Charging finished, still on (estimate from power)",
    "standby": "Standby",
    "on": "On",
    "cooling": "Cooling down",
}

DEFAULT_THRESHOLDS = {
    "off_w": 0.5,
    "sleep_w": 5.0,
    "charge_w": 25.0,
    "after_charge_memory_s": 3600,
    "projector_standby_w": 5.0,
    "projector_on_w": 100.0,
    "debounce_n": 3,
    "max_gap_s": 120,
    "vacancy_s": 120,
    "assumed_avoidable_hours_per_day": 10,
}


class StateTracker:
    def __init__(self, kind: str):
        self.kind = kind
        self.state = "unknown"
        self.since: datetime | None = None
        self._last_high: datetime | None = None
        self._cand: str | None = None
        self._count = 0

    def _classify(self, ts: datetime, p: float, th: dict) -> str:
        if self.kind == "laptop":
            if p < th["off_w"]:
                return "off"
            if p < th["sleep_w"]:
                return "sleep"
            if p >= th["charge_w"]:
                self._last_high = ts
                return "high"
            if self._last_high and (ts - self._last_high).total_seconds() <= th["after_charge_memory_s"]:
                return "full_idle"
            return "idle"
        if self.kind == "projector":
            if p >= th["projector_on_w"]:
                return "on"
            if p > th["projector_standby_w"]:
                return "cooling"
            return "standby"
        return "off" if p < th["off_w"] else "on"

    def update(self, ts: datetime, power_w: float, th: dict) -> bool:
        """Feed one reading. Returns True when the state changed."""
        new = self._classify(ts, power_w, th)
        if self.state == "unknown":
            self.state, self.since = new, ts
            return True
        if new == self.state:
            self._cand, self._count = None, 0
            return False
        if self._cand == new:
            self._count += 1
        else:
            self._cand, self._count = new, 1
        if self._count >= int(th.get("debounce_n", 3)):
            self.state, self.since = new, ts
            self._cand, self._count = None, 0
            return True
        return False

    @property
    def label(self) -> str:
        return LABELS.get(self.state, self.state)

    def wasting_power(self) -> bool:
        """True when this state, in an empty room, counts as avoidable use."""
        if self.kind == "laptop":
            return self.state in ("high", "idle", "full_idle")
        if self.kind == "projector":
            return self.state == "on"
        return self.state == "on"
