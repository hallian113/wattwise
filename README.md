# WattWise: 30% starter

Backend, simulator and live dashboard for the 30% evaluation. Everything here runs **without any hardware**: the simulator sends the same MQTT messages that the measurement box will send later.

**Roman Urdu mein khulasa:** `backend\setup.bat` ek baar chalayein, `backend\.env` mein PostgreSQL ka password likhein, phir `start_backend.bat` aur `start_simulator.bat` chalayein, aur browser mein `http://localhost:8000/dashboard` kholein.

## What works today (tested)

| Part | Status |
|---|---|
| MQTT in, PostgreSQL storage, duplicate readings ignored | Works, tested with a real broker and database |
| Running units (power × time), per hour, per session | Works. Gaps longer than 2 minutes are not counted |
| Peak and off-peak split with a seasonal window, cost in PKR | Works. Rates are **examples**, edit them in Settings |
| Month projection from the two bill numbers, slab status | Works. The ±12% range is a rule of thumb |
| Appliance states: laptop (charging, finished, idle, sleep, off) and projector (standby, on, cooling) | Works, rule-based, from power only |
| "On in an empty room" alert and suggestion in units and rupees | Works |
| Dashboard (live watts, units, room status, chart, events, settings) | Works, checked against the live backend |
| Accuracy check: our units against the meter's own counter | Works |
| ESP32 firmware, PZEM reading, relay, real room sensors | **Not written yet** |
| Machine learning, TV, AC, pump | After 30% |

## Folder layout

```
wattwise/
  backend/
    app/            main.py (API), core.py (logic), db.py (SQL), states.py, analytics.py, tariff.py, mqtt_ingest.py
    simulator/      simulate.py
    tests/          test_logic.py, test_api.py
    schema.sql      database tables (the app also creates them on start)
    reset_data.sql  clears readings between demonstrations
    setup.bat  start_backend.bat  start_simulator.bat
  frontend/         dashboard.html (one file, no internet needed)
```

## Setup on Windows (once)

1. Install **PostgreSQL** (with pgAdmin) and **Mosquitto**, and make sure the Mosquitto service is running. You already did this.
2. In pgAdmin make sure a database named `wattwise` exists.
3. Put the project in `D:\wattwise` (the `backend` and `frontend` folders side by side).
4. Double-click `backend\setup.bat`. It creates a virtual environment and installs the packages.
5. Open `backend\.env` in Notepad and set the password:
   `DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/wattwise`
   (Use the password you gave the `postgres` user when you installed PostgreSQL.)

## Run the demo (two windows)

1. Double-click `backend\start_backend.bat`. Wait for "Application startup complete".
2. Double-click `backend\start_simulator.bat`.
3. Open **http://localhost:8000/dashboard** in a browser.

Useful simulator options (put them after the script name):

| Option | Meaning |
|---|---|
| `--scenario laptop` (default) | charging, finished but still on, owner leaves, sleep, unplugged |
| `--scenario projector` | standby, on, owner leaves, cooling down, standby |
| `--scenario bulb` or `--scenario fan` | steady loads |
| `--speed 20` | 20 simulated seconds per real second: a whole cycle in about 40 seconds |
| `--start 18:30` | simulated time of day, so you can show the evening peak at any hour |

In **Settings** on the dashboard you can: choose what is plugged into socket A (laptop or projector), type the two bill numbers (last month's units and the slab limit), edit the tariff, and change how long a room must be empty before the warning appears (default 120 s; use 60 s for a short demo).

The peak window for each month is in `backend\app\tariff.py` (`DEFAULT_TARIFF`, example values). Change it there to match your distribution company, or send a new `peak_windows` to `/api/settings`.

Between demonstrations, run `backend\reset_data.sql` in pgAdmin (Query Tool on the `wattwise` database) to start from zero.

## What the dashboard numbers mean

* **Live power** and **Units since start**: from the meter. Between two readings the last digits move by an estimate and are corrected at the next reading. **Start a new session** zeroes the counter.
* **State chip** (for example "Charging finished, still on"): an **estimate from the power pattern**. The laptop's battery level is not read.
* **measured / estimate** labels: measured means a meter reads it. Anything not on a meter is shown as not tracked.
* **Today**: units, cost, and the peak and off-peak split. Peak hours are not extra units; they are units that cost more per unit.
* **This cycle**: a projection from last month's units (the rest of the house) plus what this box measured. It slightly over-states the rest of the house, because last month's total also contains the appliances measured here.
* In simulated runs the clock is the simulator's clock and the badge says **Simulated data**. Real and simulated readings are never mixed.

## MQTT message format (for the ESP32 firmware)

The box publishes two kinds of message. Use `real` as the source.

```
Topic   wattwise/real/<device-id>/<socket>/power            for example wattwise/real/esp-box-1/A/power
Payload {"seq": 12345, "v": 221.3, "a": 0.21, "w": 46.5, "wh": 118, "pf": 0.62, "hz": 50.0}

Topic   wattwise/real/<device-id>/<room-slug>/sensors       for example wattwise/real/esp-box-1/room1/sensors
Payload {"seq": 12345, "room": "Room 1", "presence": true, "lux": 280, "temp": 28.1, "hum": 47, "door": false}
```

| Field | From | Note |
|---|---|---|
| `seq` | the ESP32 | A whole number that always goes up, **and must not restart from 0 after a reboot** (use a counter kept in flash, or the uptime plus a boot counter). A repeated `seq` is treated as a duplicate and ignored |
| `v` `a` `w` `pf` `hz` | PZEM voltage, current, power, power factor, frequency | volts, amps, watts |
| `wh` | PZEM energy counter | watt-hours; used only for the accuracy check |
| `presence` `lux` `temp` `hum` `door` | LD2410, BH1750, BME280, reed switch | `presence` and `door` are true or false |

Publish every **1 to 2 seconds**. For real readings the backend uses **its own clock**; device timestamps are used only for simulated data. Buffering while Wi-Fi is down comes later.

**Broker for the ESP32:** by default Mosquitto accepts only connections from the same computer. For the ESP32 you must add a listener to `mosquitto.conf` (for example `listener 1883` and `allow_anonymous true`, on a trusted network only) and restart the service. The simulator and the backend do not need this.

## Tests

```
cd backend
venv\Scripts\activate
pytest tests -q                       (12 logic tests, always run)
set WATTWISE_RUN_API_TEST=1 && pytest tests\test_api.py -q
```

The API test writes a few rows with a date in the year 2100 and deletes them afterwards. It needs PostgreSQL and Mosquitto running and the backend **stopped**.

## Troubleshooting

| Problem | Likely cause |
|---|---|
| Backend stops with a connection error at start | PostgreSQL is not running, or the password in `.env` is wrong |
| Dashboard says "No connection to the backend" | `start_backend.bat` is not running |
| Dashboard stays on "Waiting for data" | The simulator is not running, or Mosquitto is stopped. Check `http://localhost:8000/api/health`: `mqtt_connected` should be true and `messages_received` should grow |
| "No new reading for N s" | The simulator or the box stopped publishing |
| Peak share is always 0 | The simulated time is outside the peak window. Start with `--start 18:30` (the example window for October is 6 to 10 pm) |

## Next steps (matching the plan)

1. Order the hardware (PZEM, ESP32-S3, LD2410, BME280, BH1750, reed switch, 5 V module, enclosure, fuse, socket).
2. Firmware: read the PZEM and the sensors and publish the two messages above. The backend will accept them unchanged.
3. Calibrate the state thresholds on your own laptop and projector (Settings and `backend/app/states.py`).
4. Have an electrician build or check the mains side of the box.
