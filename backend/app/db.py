"""All SQL lives here, so the rest of the code never builds a query."""
from datetime import datetime

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from . import config


class Store:
    def __init__(self, url: str = config.DATABASE_URL):
        self.pool = ConnectionPool(url, min_size=1, max_size=6, open=False, kwargs={"row_factory": dict_row})

    # ------------------------------------------------------------------ lifecycle
    def open(self):
        self.pool.open(wait=True, timeout=10)
        self.init_schema()

    def close(self):
        self.pool.close()

    def init_schema(self):
        sql = config.SCHEMA_PATH.read_text(encoding="utf8")
        with self.pool.connection() as conn:
            conn.execute(sql)

    def _q(self, sql, params=(), one=False):
        with self.pool.connection() as conn:
            cur = conn.execute(sql, params)
            if cur.description is None:
                return None
            return cur.fetchone() if one else cur.fetchall()

    # ------------------------------------------------------------------ settings
    def get_setting(self, key: str, default=None):
        row = self._q("SELECT value FROM settings WHERE key = %s", (key,), one=True)
        return row["value"] if row else default

    def set_setting(self, key: str, value):
        self._q("INSERT INTO settings (key, value) VALUES (%s, %s) "
                "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", (key, Jsonb(value)))

    # ------------------------------------------------------------------ appliances and rooms
    def appliances(self):
        return self._q("SELECT a.socket, a.name, a.kind, a.rated_w, a.measured, r.name AS room "
                       "FROM appliances a JOIN rooms r ON r.id = a.room_id ORDER BY a.socket")

    def update_appliance(self, socket: str, name=None, kind=None, rated_w=None, room=None, measured=None):
        if room:
            self._q("INSERT INTO rooms (name) VALUES (%s) ON CONFLICT (name) DO NOTHING", (room,))
            self._q("UPDATE appliances SET room_id = (SELECT id FROM rooms WHERE name = %s) WHERE socket = %s", (room, socket))
        for col, val in (("name", name), ("kind", kind), ("rated_w", rated_w), ("measured", measured)):
            if val is not None:
                self._q(f"UPDATE appliances SET {col} = %s WHERE socket = %s", (val, socket))

    def add_appliance(self, socket: str, room: str, name: str, kind: str = "other"):
        self._q("INSERT INTO rooms (name) VALUES (%s) ON CONFLICT (name) DO NOTHING", (room,))
        self._q("INSERT INTO appliances (room_id, name, kind, socket) "
                "SELECT id, %s, %s, %s FROM rooms WHERE name = %s ON CONFLICT (socket) DO NOTHING",
                (name, kind, socket, room))

    # ------------------------------------------------------------------ ingest
    def add_power(self, ts, source, device_id, socket, seq, voltage, current_a, power_w, energy_wh, pf, freq, buffered=False) -> bool:
        row = self._q(
            "INSERT INTO power_readings (ts, source, device_id, socket, seq, voltage, current_a, power_w, energy_wh, pf, freq, buffered) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
            "ON CONFLICT (device_id, socket, seq) DO NOTHING RETURNING id",
            (ts, source, device_id, socket, seq, voltage, current_a, power_w, energy_wh, pf, freq, buffered), one=True)
        return row is not None

    def add_room_reading(self, ts, source, device_id, room, seq, presence, lux, temp_c, humidity, door_open) -> bool:
        row = self._q(
            "INSERT INTO room_readings (ts, source, device_id, room, seq, presence, lux, temp_c, humidity, door_open) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (device_id, room, seq) DO NOTHING RETURNING id",
            (ts, source, device_id, room, seq, presence, lux, temp_c, humidity, door_open), one=True)
        return row is not None

    def add_energy(self, hour_start: datetime, socket: str, source: str, wh: float, seconds: float = 0.0):
        self._q("INSERT INTO energy_hourly (hour_start, socket, source, wh, seconds) VALUES (%s,%s,%s,%s,%s) "
                "ON CONFLICT (hour_start, socket, source) DO UPDATE "
                "SET wh = energy_hourly.wh + EXCLUDED.wh, seconds = energy_hourly.seconds + EXCLUDED.seconds",
                (hour_start, socket, source, wh, seconds))

    def add_session_wh(self, socket: str, source: str, ts: datetime, wh: float):
        self._q("INSERT INTO sessions (socket, source, started_at, wh) VALUES (%s,%s,%s,0) "
                "ON CONFLICT (socket, source) WHERE ended_at IS NULL DO NOTHING", (socket, source, ts))
        self._q("UPDATE sessions SET wh = wh + %s WHERE socket = %s AND source = %s AND ended_at IS NULL",
                (wh, socket, source))

    def get_session(self, socket: str, source: str):
        return self._q("SELECT started_at, wh FROM sessions WHERE socket = %s AND source = %s AND ended_at IS NULL",
                       (socket, source), one=True)

    def reset_session(self, socket: str, source: str, ts: datetime):
        self._q("UPDATE sessions SET ended_at = %s WHERE socket = %s AND source = %s AND ended_at IS NULL", (ts, socket, source))
        self._q("INSERT INTO sessions (socket, source, started_at, wh) VALUES (%s,%s,%s,0)", (socket, source, ts))

    def add_event(self, ts, kind: str, message: str, room=None, socket=None, detail=None):
        self._q("INSERT INTO events (ts, kind, room, socket, message, detail) VALUES (%s,%s,%s,%s,%s,%s)",
                (ts, kind, room, socket, message, Jsonb(detail) if detail is not None else None))

    # ------------------------------------------------------------------ reads
    def events(self, limit: int = 30):
        return self._q("SELECT ts, kind, room, socket, message FROM events ORDER BY ts DESC, id DESC LIMIT %s", (limit,))

    def latest_power_ts(self):
        """Most recently ARRIVED reading of any socket: decides whether to show real or simulated data.

        Ordered by id (arrival), not by ts, so a simulator running on a clock ahead of real time
        can never hide the real box.
        """
        return self._q("SELECT ts, source FROM power_readings ORDER BY id DESC LIMIT 1", one=True)

    def latest_power(self, source: str):
        return self._q("SELECT DISTINCT ON (socket) socket, ts, device_id, voltage, current_a, power_w, energy_wh, pf, freq, source "
                       "FROM power_readings WHERE source = %s ORDER BY socket, ts DESC, id DESC", (source,))

    def latest_room(self, room: str, source: str):
        return self._q("SELECT ts, presence, lux, temp_c, humidity, door_open, source FROM room_readings "
                       "WHERE room = %s AND source = %s ORDER BY ts DESC, id DESC LIMIT 1", (room, source), one=True)

    def last_presence_true(self, room: str, source: str):
        row = self._q("SELECT max(ts) AS ts FROM room_readings WHERE room = %s AND source = %s AND presence", (room, source), one=True)
        return row["ts"] if row else None

    def first_room_ts(self, room: str, source: str):
        row = self._q("SELECT min(ts) AS ts FROM room_readings WHERE room = %s AND source = %s", (room, source), one=True)
        return row["ts"] if row else None

    def rooms_seen(self, source: str):
        rows = self._q("SELECT DISTINCT room FROM room_readings WHERE source = %s ORDER BY room", (source,))
        return [r["room"] for r in rows]

    def history(self, socket: str, source: str, since: datetime, limit: int = 600):
        rows = self._q("SELECT ts, power_w FROM power_readings WHERE socket = %s AND source = %s AND ts >= %s "
                       "ORDER BY ts DESC LIMIT %s", (socket, source, since, limit))
        return list(reversed(rows))

    def hourly(self, source: str, start: datetime, end: datetime, socket: str | None = None):
        """[(hour_start, wh, seconds_of_data)]. For all sockets the energy is added and the seconds are the longest."""
        if socket:
            rows = self._q("SELECT hour_start, wh, seconds FROM energy_hourly WHERE source = %s AND socket = %s "
                           "AND hour_start >= %s AND hour_start < %s ORDER BY hour_start", (source, socket, start, end))
        else:
            rows = self._q("SELECT hour_start, sum(wh) AS wh, max(seconds) AS seconds FROM energy_hourly WHERE source = %s "
                           "AND hour_start >= %s AND hour_start < %s GROUP BY hour_start ORDER BY hour_start", (source, start, end))
        return [(r["hour_start"], float(r["wh"]), float(r["seconds"])) for r in rows]

    def meter_counter_delta(self, socket: str, source: str, since: datetime):
        """Change of the meter's own energy counter since `since` (for the accuracy check)."""
        return self._q("SELECT min(energy_wh) AS first, max(energy_wh) AS last, count(*) AS n FROM power_readings "
                       "WHERE socket = %s AND source = %s AND ts >= %s AND energy_wh IS NOT NULL", (socket, source, since), one=True)

    def counts(self):
        return {t: self._q(f"SELECT count(*) AS n FROM {t}", one=True)["n"]
                for t in ("power_readings", "room_readings", "energy_hourly", "events")}
