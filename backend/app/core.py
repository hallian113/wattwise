"""Takes readings in, keeps the running totals, and builds what the dashboard shows."""
import copy
import threading
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from . import analytics, config, tariff as tf
from .states import DEFAULT_THRESHOLDS, LABELS, StateTracker

UTC = timezone.utc

DEFAULT_SETTINGS = {
    "tariff": tf.DEFAULT_TARIFF,
    "thresholds": DEFAULT_THRESHOLDS,
    "bill": {"cycle_start_date": None, "cycle_days": 30, "limit_units": 200, "last_month_units": None},
    "use_sim_clock": True,   # let the simulator drive the clock, so peak hours can be shown at any time of day
    "poll_ms": 2000,
}


def _merge(base: dict, patch: dict) -> dict:
    out = copy.deepcopy(base)
    for k, v in (patch or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


def hour_start(ts: datetime) -> datetime:
    return ts.astimezone(UTC).replace(minute=0, second=0, microsecond=0)


def num(payload: dict, key: str, default=None):
    v = payload.get(key, default)
    try:
        return None if v is None else float(v)
    except (TypeError, ValueError):
        return default


class Core:
    def __init__(self, store):
        self.store = store
        self.tz = ZoneInfo(config.LOCAL_TZ)
        self.lock = threading.RLock()
        self._settings = None
        self._settings_at = 0.0
        self._appl = {}
        self._appl_at = 0.0
        self.last = {}          # (source, socket) -> (ts, power_w, wall)
        self.trackers = {}      # (source, socket) -> StateTracker
        self.presence_ts = {}   # (source, room) -> last time presence was true
        self.first_room_ts = {}
        self.latest_ts = {}     # source -> newest reading time
        self.last_wall = {}     # source -> wall clock of the newest reading
        self.time_scale = {}    # source -> sim seconds per real second
        self.alerted = set()

    # ------------------------------------------------------------------ settings
    def settings(self) -> dict:
        now = datetime.now(UTC).timestamp()
        if self._settings is None or now - self._settings_at > 3:
            merged = copy.deepcopy(DEFAULT_SETTINGS)
            for key in DEFAULT_SETTINGS:
                stored = self.store.get_setting(key)
                if stored is not None:
                    merged[key] = _merge(merged[key], stored) if isinstance(merged[key], dict) else stored
            self._settings, self._settings_at = merged, now
        return self._settings

    def update_settings(self, patch: dict) -> dict:
        allowed = set(DEFAULT_SETTINGS)
        for key, val in patch.items():
            if key not in allowed:
                raise ValueError(f"unknown setting: {key}")
            current = self.settings()[key]
            new = _merge(current, val) if isinstance(current, dict) else val
            self.store.set_setting(key, new)
        self._settings = None
        return self.settings()

    def appliances(self) -> dict:
        now = datetime.now(UTC).timestamp()
        if now - self._appl_at > 2 or not self._appl:
            self._appl = {a["socket"]: a for a in self.store.appliances()}
            self._appl_at = now
        return self._appl

    def invalidate_appliances(self):
        self._appl_at = 0.0

    # ------------------------------------------------------------------ ingest
    def _reading_time(self, source: str, payload: dict, wall: datetime) -> datetime:
        if source == "sim" and self.settings().get("use_sim_clock") and "ts" in payload:
            try:
                return datetime.fromtimestamp(float(payload["ts"]), tz=UTC)
            except (TypeError, ValueError, OverflowError, OSError):
                pass
        return wall

    def handle_power(self, source: str, device: str, socket: str, payload: dict, wall: datetime | None = None) -> bool:
        wall = wall or datetime.now(UTC)
        w, seq = num(payload, "w"), num(payload, "seq")
        if w is None or seq is None or source not in ("real", "sim"):
            return False
        ts = self._reading_time(source, payload, wall)
        with self.lock:
            apps = self.appliances()
            if socket not in apps:
                self.store.add_appliance(socket, "Room 1", f"Socket {socket}", "other")
                self.invalidate_appliances()
                apps = self.appliances()
            inserted = self.store.add_power(ts, source, device, socket, int(seq), num(payload, "v"), num(payload, "a"), w,
                                            num(payload, "wh"), num(payload, "pf"), num(payload, "hz"), bool(payload.get("buffered")))
            if not inserted:
                return False            # a re-sent reading: already counted
            th = self.settings()["thresholds"]
            key = (source, socket)
            prev = self.last.get(key)
            if prev is None or ts > prev[0]:
                if prev is not None:
                    wh = analytics.trapezoid_wh(prev[1], w, (ts - prev[0]).total_seconds(), th["max_gap_s"])
                    if wh is not None:
                        middle = prev[0] + (ts - prev[0]) / 2     # the hour the interval mostly belongs to
                        self.store.add_energy(hour_start(middle), socket, source, wh, (ts - prev[0]).total_seconds())
                        self.store.add_session_wh(socket, source, ts, wh)
                    wall_dt = (wall - prev[2]).total_seconds()
                    if wall_dt > 0.05:
                        scale = max(0.2, min(300.0, (ts - prev[0]).total_seconds() / wall_dt))
                        old = self.time_scale.get(source, scale)
                        self.time_scale[source] = 0.7 * old + 0.3 * scale
                self.last[key] = (ts, w, wall)
            if ts >= self.latest_ts.get(source, ts):
                self.latest_ts[source] = ts
                self.last_wall[source] = wall
            app = apps[socket]
            tr = self.trackers.get(key)
            if tr is None or tr.kind != app["kind"]:
                tr = self.trackers[key] = StateTracker(app["kind"])
            if tr.update(ts, w, th):
                self.store.add_event(ts, "state_change", f"{app['name']}: {tr.label}", app["room"], socket,
                                     {"state": tr.state, "power_w": w})
        return True

    def handle_sensors(self, source: str, device: str, room: str, payload: dict, wall: datetime | None = None) -> bool:
        wall = wall or datetime.now(UTC)
        seq = num(payload, "seq")
        if seq is None or source not in ("real", "sim"):
            return False
        ts = self._reading_time(source, payload, wall)
        presence = payload.get("presence")
        presence = None if presence is None else bool(presence)
        door = payload.get("door")
        with self.lock:
            ok = self.store.add_room_reading(ts, source, device, room, int(seq), presence, num(payload, "lux"),
                                             num(payload, "temp"), num(payload, "hum"), None if door is None else bool(door))
            if not ok:
                return False
            self.first_room_ts.setdefault((source, room), ts)
            if presence:
                key = (source, room)
                if ts > self.presence_ts.get(key, ts - timedelta(seconds=1)):
                    self.presence_ts[key] = ts
            if ts >= self.latest_ts.get(source, ts):
                self.latest_ts[source] = ts
                self.last_wall[source] = wall
        return True

    # ------------------------------------------------------------------ clock
    def _clock(self):
        """(source, as_of) for the data being shown."""
        latest = self.store.latest_power_ts()
        if not latest:
            return None, None
        source = latest["source"]
        if source == "sim" and self.settings().get("use_sim_clock"):
            return source, max(latest["ts"], self.latest_ts.get("sim", latest["ts"]))
        return source, datetime.now(UTC)

    def _vacant_for(self, source: str, room: str, as_of: datetime):
        latest = self.store.latest_room(room, source)
        if not latest or latest["presence"] is None:
            return None
        if latest["presence"]:
            return 0.0
        ref = self.presence_ts.get((source, room)) or self.store.last_presence_true(room, source) \
            or self.first_room_ts.get((source, room)) or self.store.first_room_ts(room, source)
        return max(0.0, (as_of - ref).total_seconds()) if ref else None

    # ------------------------------------------------------------------ what the dashboard reads
    def live(self) -> dict:
        source, as_of = self._clock()
        if source is None:
            return {"status": "no_data", "message": "No readings yet. Start the simulator or switch on the box."}
        cfg = self.settings()
        apps = self.appliances()
        local_as_of = as_of.astimezone(self.tz)
        day_start = tf.local_day_start(local_as_of)
        d0, d1 = day_start.astimezone(UTC), tf.next_day(local_as_of).astimezone(UTC)
        if source in self.last_wall:
            wall_age = (datetime.now(UTC) - self.last_wall[source]).total_seconds()
        elif source == "real":
            wall_age = (datetime.now(UTC) - as_of_row_ts).total_seconds() if (as_of_row_ts := self.store.latest_power_ts()["ts"]) else 9999
        else:
            wall_age = 9999.0   # nothing has arrived since the backend started
        sockets = []
        for row in self.store.latest_power(source):
            app = apps.get(row["socket"], {"name": f"Socket {row['socket']}", "kind": "other", "room": "Room 1", "measured": True, "rated_w": None})
            tr = self.trackers.get((source, row["socket"]))
            sess = self.store.get_session(row["socket"], source)
            today = sum(r[1] for r in self.store.hourly(source, d0, d1, row["socket"]))
            sockets.append({
                "socket": row["socket"], "appliance": app["name"], "kind": app["kind"], "room": app["room"],
                "label": "measured" if app["measured"] else "estimate",
                "power_w": row["power_w"], "voltage": row["voltage"], "current_a": row["current_a"], "pf": row["pf"],
                "state": tr.state if tr else "unknown", "state_label": tr.label if tr else LABELS["unknown"],
                "state_since": tr.since.isoformat() if tr and tr.since else None,
                "session_wh": float(sess["wh"]) if sess else 0.0,
                "session_started": sess["started_at"].isoformat() if sess else None,
                "today_wh": today, "reading_ts": row["ts"].isoformat(),
            })
        rooms = {}
        for name in sorted({s["room"] for s in sockets} | set(self.store.rooms_seen(source))):
            r = self.store.latest_room(name, source)
            rooms[name] = {
                "room": name,
                "presence": r["presence"] if r else None,
                "vacant_for_s": self._vacant_for(source, name, as_of),
                "lux": r["lux"] if r else None, "temp_c": r["temp_c"] if r else None,
                "humidity": r["humidity"] if r else None, "door_open": r["door_open"] if r else None,
            }
        flags = self._flags(source, as_of, sockets, rooms, cfg)
        total_w = sum(s["power_w"] for s in sockets)
        return {
            "status": "ok", "source": source, "as_of": as_of.isoformat(),
            "as_of_local": local_as_of.strftime("%d %b %Y, %H:%M:%S"),
            "reading_age_s": round(wall_age, 1), "online": wall_age < 15,
            "time_scale": round(self.time_scale.get(source, 1.0), 2) if source == "sim" else 1.0,
            "total_w": total_w, "sockets": sockets, "rooms": list(rooms.values()), "flags": flags,
            "poll_ms": cfg["poll_ms"],
        }

    def _flags(self, source, as_of, sockets, rooms, cfg) -> list:
        th, tariff = cfg["thresholds"], cfg["tariff"]
        flags, active = [], set()
        for s in sockets:
            tr = self.trackers.get((source, s["socket"]))
            room = rooms.get(s["room"])
            if not tr or not room or room["vacant_for_s"] is None:
                continue
            if tr.wasting_power() and room["vacant_for_s"] >= th["vacancy_s"]:
                key = (source, s["socket"])
                active.add(key)
                mins = room["vacant_for_s"] / 60
                units_now = s["power_w"] * room["vacant_for_s"] / 3600 / 1000
                monthly_units = s["power_w"] * th["assumed_avoidable_hours_per_day"] * 30 / 1000
                flag = {
                    "type": "left_on_empty_room", "socket": s["socket"], "room": s["room"], "appliance": s["appliance"],
                    "state": s["state"], "vacant_for_s": room["vacant_for_s"], "power_w": s["power_w"],
                    "units_so_far": units_now, "monthly_units": monthly_units,
                    "monthly_pkr": monthly_units * tariff["flat_rate"],
                    "message": f"{s['appliance']} has been on in an empty {s['room']} for {mins:.0f} min.",
                }
                flags.append(flag)
                if key not in self.alerted:
                    self.alerted.add(key)
                    self.store.add_event(as_of, "alert", flag["message"], s["room"], s["socket"],
                                         {"power_w": s["power_w"], "monthly_units": monthly_units})
        self.alerted &= active | {k for k in self.alerted if k[0] != source}
        return flags

    def suggestions(self, live: dict, summary: dict) -> list:
        out = []
        for f in live.get("flags", []):
            kind = next((s["kind"] for s in live["sockets"] if s["socket"] == f["socket"]), "other")
            if kind == "projector":
                action = "Turn it off with its remote. Cut the socket only after it has cooled down and shows standby."
            elif kind == "laptop":
                action = "Sleep it or unplug it when the room is empty. A battery charge limit also helps."
            else:
                action = "Switch it off when the room is empty."
            out.append({"severity": "warn", "title": f["message"],
                        "detail": f"{action} If this happens about 10 hours a day, it adds up to about {f['monthly_units']:.1f} units a month (about Rs {f['monthly_pkr']:.0f}).",
                        "units_per_month": f["monthly_units"], "pkr_per_month": f["monthly_pkr"]})
        if summary.get("total_units", 0) > 0.05 and summary.get("peak_share", 0) >= 0.5:
            out.append({"severity": "info", "title": f"{summary['peak_share']*100:.0f}% of today's units fell in the peak window.",
                        "detail": "Moving flexible use out of the peak lowers the cost per unit.", "units_per_month": None, "pkr_per_month": None})
        proj = summary.get("projection") or {}
        if proj.get("available") and proj.get("status") in ("near", "over"):
            out.append({"severity": "warn", "title": "You are close to your slab limit." if proj["status"] == "near" else "You are over your slab limit.",
                        "detail": f"Estimated {proj['estimated_units_so_far']:.0f} of {proj['limit_units']:.0f} units so far; projected {proj['projected_units']:.0f} by the end of the cycle.",
                        "units_per_month": None, "pkr_per_month": None})
        if not out:
            out.append({"severity": "ok", "title": "Nothing to fix right now.", "detail": "No avoidable use detected.", "units_per_month": None, "pkr_per_month": None})
        return out

    def summary(self) -> dict:
        source, as_of = self._clock()
        if source is None:
            return {"status": "no_data"}
        cfg = self.settings()
        tariff, bill = cfg["tariff"], cfg["bill"]
        local = as_of.astimezone(self.tz)
        d0 = tf.local_day_start(local)
        rows = self.store.hourly(source, d0.astimezone(UTC), tf.next_day(local).astimezone(UTC))
        today = analytics.summarize(rows, self.tz, tariff, local)
        try:
            cstart = date.fromisoformat(bill["cycle_start_date"]) if bill.get("cycle_start_date") else local.date().replace(day=1)
        except ValueError:
            cstart = local.date().replace(day=1)
        c0 = datetime(cstart.year, cstart.month, cstart.day, tzinfo=self.tz)
        cycle_rows = self.store.hourly(source, c0.astimezone(UTC), tf.next_day(local).astimezone(UTC))
        measured_cycle = sum(r[1] for r in cycle_rows) / 1000.0
        days_elapsed = max(0.0, (local - c0).total_seconds() / 86400)
        projection = analytics.project_cycle(measured_cycle, days_elapsed, bill)
        projection["cycle_start_date"] = cstart.isoformat()
        out = {"status": "ok", "source": source, "as_of_local": local.strftime("%d %b %Y, %H:%M"),
               "tariff_note": tariff.get("note"), "rates": {"peak": tariff["peak_rate"], "offpeak": tariff["offpeak_rate"]},
               "projection": projection, **today}
        return out

    def history(self, minutes: float = 10, socket: str | None = None, max_points: int = 300) -> dict:
        source, as_of = self._clock()
        if source is None:
            return {"points": []}
        if socket is None:
            latest = self.store.latest_power(source)
            if not latest:
                return {"points": []}
            socket = latest[0]["socket"]
        scale = self.time_scale.get(source, 1.0) if source == "sim" else 1.0
        rows = self.store.history(socket, source, as_of - timedelta(minutes=minutes * max(1.0, scale)), limit=5000)
        step = max(1, len(rows) // max_points)
        pts = [{"t": r["ts"].isoformat(), "w": round(r["power_w"], 2)} for r in rows[::step]]
        return {"socket": socket, "source": source, "points": pts, "time_scale": scale}

    def reset_session(self) -> int:
        source, as_of = self._clock()
        if source is None:
            return 0
        n = 0
        for row in self.store.latest_power(source):
            self.store.reset_session(row["socket"], source, as_of)
            n += 1
        return n

    def accuracy(self) -> list:
        """Compare our integrated energy with the meter's own counter (1 Wh steps)."""
        source, as_of = self._clock()
        if source is None:
            return []
        out = []
        for row in self.store.latest_power(source):
            sess = self.store.get_session(row["socket"], source)
            if not sess:
                continue
            c = self.store.meter_counter_delta(row["socket"], source, sess["started_at"])
            if not c or c["n"] < 2 or c["first"] is None:
                continue
            counter = float(c["last"]) - float(c["first"])
            ours = float(sess["wh"])
            out.append({"socket": row["socket"], "our_wh": round(ours, 3), "meter_counter_wh": round(counter, 3),
                        "difference_wh": round(ours - counter, 3),
                        "note": "The meter counter moves in steps of 1 Wh, so differences below about 1 Wh are normal."})
        return out
