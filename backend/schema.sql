-- WattWise 30%: PostgreSQL schema (safe to run more than once)

CREATE TABLE IF NOT EXISTS rooms (
    id   SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS appliances (
    id       SERIAL PRIMARY KEY,
    room_id  INTEGER NOT NULL REFERENCES rooms(id),
    name     TEXT NOT NULL,
    kind     TEXT NOT NULL DEFAULT 'other'
             CHECK (kind IN ('laptop','projector','bulb','fan','tv','ac','heater','other')),
    rated_w  DOUBLE PRECISION,
    socket   TEXT UNIQUE NOT NULL,          -- which output socket of the power box
    measured BOOLEAN NOT NULL DEFAULT TRUE  -- TRUE = read by a meter, FALSE = estimate
);

-- One row per meter reading. (device_id, socket, seq) is unique so that
-- readings re-sent after a Wi-Fi drop are never counted twice.
CREATE TABLE IF NOT EXISTS power_readings (
    id        BIGSERIAL PRIMARY KEY,
    ts        TIMESTAMPTZ NOT NULL,
    source    TEXT NOT NULL CHECK (source IN ('real','sim')),
    device_id TEXT NOT NULL,
    socket    TEXT NOT NULL,
    seq       BIGINT NOT NULL,
    voltage   REAL,
    current_a REAL,
    power_w   REAL NOT NULL,
    energy_wh REAL,                          -- the meter's own counter (for accuracy checks)
    pf        REAL,
    freq      REAL,
    buffered  BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (device_id, socket, seq)
);
CREATE INDEX IF NOT EXISTS idx_power_socket_ts ON power_readings (socket, ts DESC);

CREATE TABLE IF NOT EXISTS room_readings (
    id        BIGSERIAL PRIMARY KEY,
    ts        TIMESTAMPTZ NOT NULL,
    source    TEXT NOT NULL CHECK (source IN ('real','sim')),
    device_id TEXT NOT NULL,
    room      TEXT NOT NULL,
    seq       BIGINT NOT NULL,
    presence  BOOLEAN,
    lux       REAL,
    temp_c    REAL,
    humidity  REAL,
    door_open BOOLEAN,
    UNIQUE (device_id, room, seq)
);
CREATE INDEX IF NOT EXISTS idx_room_ts ON room_readings (room, ts DESC);

-- Energy added up per hour and socket. The dashboard reads units, cost and the
-- peak / off-peak split from here, so it never has to re-add thousands of rows.
CREATE TABLE IF NOT EXISTS energy_hourly (
    hour_start TIMESTAMPTZ NOT NULL,
    socket     TEXT NOT NULL,
    source     TEXT NOT NULL,
    wh         DOUBLE PRECISION NOT NULL DEFAULT 0,
    PRIMARY KEY (hour_start, socket, source)
);

-- "Units since start": one active session per socket and source.
CREATE TABLE IF NOT EXISTS sessions (
    id         SERIAL PRIMARY KEY,
    socket     TEXT NOT NULL,
    source     TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at   TIMESTAMPTZ,
    wh         DOUBLE PRECISION NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_session
    ON sessions (socket, source) WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS events (
    id      BIGSERIAL PRIMARY KEY,
    ts      TIMESTAMPTZ NOT NULL,
    kind    TEXT NOT NULL,                   -- state_change | alert | info
    room    TEXT,
    socket  TEXT,
    message TEXT NOT NULL,
    detail  JSONB
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events (ts DESC);

-- Tariff table, thresholds and the bill numbers live here as JSON.
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

-- Starting data: one room, one socket.
INSERT INTO rooms (name) VALUES ('Room 1') ON CONFLICT (name) DO NOTHING;
INSERT INTO appliances (room_id, name, kind, socket)
SELECT id, 'Laptop charger', 'laptop', 'A' FROM rooms WHERE name = 'Room 1'
ON CONFLICT (socket) DO NOTHING;
