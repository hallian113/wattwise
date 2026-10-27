"""End-to-end check: MQTT message in -> database -> API out.

This test writes a few rows into the database and deletes them afterwards, so
it only runs when you ask for it, with the backend server STOPPED:

    Windows (cmd):   set WATTWISE_RUN_API_TEST=1 && pytest tests\\test_api.py -q
    Windows (PowerShell):   $env:WATTWISE_RUN_API_TEST=1; pytest tests\\test_api.py -q

PostgreSQL and the Mosquitto broker must be running. Otherwise it is skipped.
"""
import json
import os
import socket
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt
import psycopg
import pytest
from fastapi.testclient import TestClient

from app import config


def _ready():
    if os.getenv("WATTWISE_RUN_API_TEST") != "1":
        return False
    try:
        psycopg.connect(config.DATABASE_URL, connect_timeout=2).close()
        socket.create_connection((config.MQTT_HOST, config.MQTT_PORT), 2).close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _ready(), reason="set WATTWISE_RUN_API_TEST=1 and start PostgreSQL and Mosquitto to run this test")

FAR = datetime(2100, 1, 1, tzinfo=timezone.utc)      # a date no real or simulated reading will ever have


def _cleanup():
    with psycopg.connect(config.DATABASE_URL) as conn:
        conn.execute("DELETE FROM power_readings WHERE ts >= %s", (FAR,))
        conn.execute("DELETE FROM room_readings WHERE ts >= %s", (FAR,))
        conn.execute("DELETE FROM energy_hourly WHERE hour_start >= %s", (FAR,))
        conn.execute("DELETE FROM sessions WHERE started_at >= %s", (FAR,))
        conn.execute("DELETE FROM events WHERE ts >= %s", (FAR,))


def test_reading_flows_through_to_the_dashboard_api():
    from app.main import app
    _cleanup()
    try:
        with TestClient(app) as client:
            pub = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="wattwise-test")
            pub.connect(config.MQTT_HOST, config.MQTT_PORT, 30)
            pub.loop_start()
            base_seq = int(time.time() * 1000)
            t0 = FAR.timestamp() + 3600 * 12
            for i in range(6):
                ts = t0 + i * 10
                pub.publish("wattwise/sim/test-dev/A/power", json.dumps(
                    {"seq": base_seq + i, "ts": ts, "v": 220, "a": 0.2, "w": 45, "wh": i, "pf": 0.6, "hz": 50}))
                pub.publish("wattwise/sim/test-dev/room1/sensors", json.dumps(
                    {"seq": base_seq + i, "ts": ts, "room": "Room 1", "presence": True, "lux": 300, "temp": 27, "hum": 45, "door": False}))
            pub.publish("wattwise/sim/test-dev/A/power", json.dumps({"seq": base_seq + 5, "ts": t0 + 50, "w": 45}))   # a duplicate
            time.sleep(2.5)
            pub.loop_stop()

            live = client.get("/api/live").json()
            assert live["status"] == "ok" and live["source"] == "sim"
            s = live["sockets"][0]
            assert s["power_w"] == pytest.approx(45)
            # 5 intervals of 10 s at 45 W = 0.625 Wh, and the duplicate must not add to it
            assert s["today_wh"] == pytest.approx(45 * 50 / 3600, rel=0.01)
            assert live["rooms"][0]["presence"] is True

            summary = client.get("/api/summary").json()
            assert summary["status"] == "ok" and summary["total_units"] > 0
            assert client.get("/api/health").json()["mqtt_connected"] is True
            assert client.get("/dashboard").status_code == 200
    finally:
        _cleanup()
