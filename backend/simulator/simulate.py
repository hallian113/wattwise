"""Simulator: publishes the same MQTT messages the measurement box will publish.

Examples
    python simulator/simulate.py --scenario laptop
    python simulator/simulate.py --scenario laptop --speed 20 --start 17:30     # evening peak, 20x faster
    python simulator/simulate.py --scenario projector --duration 120

--speed 1   scenario and clock run in real time.
--speed 20  one real second counts as 20 simulated seconds, so a whole charging
            cycle takes a minute and the units grow 20x faster.
Messages carry the simulated time (ts), and are marked source "sim", so they are
never mixed with real readings.
"""
import argparse
import json
import math
import os
import random
import sys
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import paho.mqtt.client as mqtt

LOOP_S = {"laptop": 720, "projector": 420, "bulb": 600, "fan": 600}


def laptop(t):
    """(power_w, presence) at scenario time t seconds."""
    present = t < 300
    if t < 5:
        p = 0.0
    elif t < 180:
        p = 45.0 - 5.0 * max(0.0, (t - 120) / 60)
    elif t < 240:
        p = 40.0 - 25.0 * (t - 180) / 60
    elif t < 600:
        p = 15.0
    elif t < 660:
        p = 2.0
    else:
        p = 0.0
    return p, present


def projector(t):
    present = t < 120
    if t < 10:
        p = 1.0
    elif t < 20:
        p = 280.0
    elif t < 300:
        p = 240.0
    elif t < 360:
        p = 35.0 - 15.0 * (t - 300) / 60
    else:
        p = 1.0
    return p, present


def bulb(t):
    return 100.0, (t % 300) < 180


def fan(t):
    return 48.0, (t % 300) < 150


SCENARIOS = {"laptop": laptop, "projector": projector, "bulb": bulb, "fan": fan}
PF = {"laptop": 0.6, "projector": 0.95, "bulb": 0.99, "fan": 0.85}


class Sim:
    def __init__(self, a):
        self.a = a
        self.rng = random.Random(a.seed)
        self.tz = ZoneInfo(a.tz)
        now = datetime.now(self.tz)
        if a.start:
            h, m = (int(x) for x in a.start.split(":"))
            now = now.replace(hour=h, minute=m, second=0, microsecond=0)
        self.clock = now.astimezone(timezone.utc)
        self.t = 0.0
        self.seq_p = int(time.time())
        self.seq_s = self.seq_p
        self.energy_wh = 0.0
        self.prev_p = None

    def tick(self, dt_sim):
        a = self.a
        self.clock += timedelta(seconds=dt_sim)
        self.t += dt_sim
        base, present = SCENARIOS[a.scenario](self.t % LOOP_S[a.scenario])
        p = max(0.0, base * (1 + self.rng.uniform(-0.02, 0.02))) if base > 3 else base
        if self.prev_p is not None:
            self.energy_wh += (self.prev_p + p) / 2 * dt_sim / 3600
        self.prev_p = p
        v = 220 + 2.0 * math.sin(self.t / 90) + self.rng.uniform(-0.5, 0.5)
        pf = PF[a.scenario] if p > 3 else 0.3
        i = p / (v * pf) if p > 0.3 else 0.0
        local_h = self.clock.astimezone(self.tz).hour
        lux = (320 if 7 <= local_h < 18 else 25) + self.rng.uniform(-8, 8)
        self.seq_p += 1
        self.seq_s += 1
        power = {"seq": self.seq_p, "ts": self.clock.timestamp(), "v": round(v, 1), "a": round(i, 3), "w": round(p, 1),
                 "wh": math.floor(self.energy_wh), "pf": round(pf, 2), "hz": round(50 + self.rng.uniform(-0.05, 0.05), 2)}
        sensors = {"seq": self.seq_s, "ts": self.clock.timestamp(), "room": a.room, "presence": present,
                   "lux": round(lux, 1), "temp": round(27 + 0.4 * math.sin(self.t / 300), 1), "hum": 45, "door": False}
        return power, sensors


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--scenario", choices=SCENARIOS, default="laptop")
    ap.add_argument("--host", default=os.getenv("MQTT_HOST", "localhost"))
    ap.add_argument("--port", type=int, default=int(os.getenv("MQTT_PORT", "1883")))
    ap.add_argument("--device", default="esp-sim-1")
    ap.add_argument("--socket", default="A")
    ap.add_argument("--room", default="Room 1")
    ap.add_argument("--interval", type=float, default=1.0, help="real seconds between messages")
    ap.add_argument("--speed", type=float, default=1.0, help="simulated seconds per real second")
    ap.add_argument("--start", default=None, help="simulated start time of day, for example 17:30")
    ap.add_argument("--tz", default=os.getenv("LOCAL_TZ", "Asia/Karachi"))
    ap.add_argument("--duration", type=float, default=0, help="stop after this many real seconds (0 = run until Ctrl+C)")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--dry-run", action="store_true", help="print messages instead of publishing")
    a = ap.parse_args()

    sim = Sim(a)
    client = None
    if not a.dry_run:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"sim-{a.device}")
        client.connect(a.host, a.port, 30)
        client.loop_start()
    slug = a.room.lower().replace(" ", "")
    tp = f"wattwise/sim/{a.device}/{a.socket}/power"
    ts_ = f"wattwise/sim/{a.device}/{slug}/sensors"
    print(f"Simulating '{a.scenario}' on socket {a.socket} in {a.room}, speed x{a.speed}. Ctrl+C to stop.")
    began = time.time()
    try:
        while True:
            power, sensors = sim.tick(a.interval * a.speed)
            if a.dry_run:
                print(json.dumps(power), json.dumps(sensors))
            else:
                client.publish(tp, json.dumps(power))
                client.publish(ts_, json.dumps(sensors))
            if a.duration and time.time() - began >= a.duration:
                break
            time.sleep(a.interval)
    except KeyboardInterrupt:
        pass
    if client:
        client.loop_stop()
        client.disconnect()
    print("Stopped.")


if __name__ == "__main__":
    sys.exit(main())
