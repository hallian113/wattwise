"""Listens to the MQTT broker and hands every message to the core.

Topics (the same ones the ESP32 firmware and the simulator publish):
    wattwise/<source>/<device>/<socket>/power     one meter reading
    wattwise/<source>/<device>/<room>/sensors     one set of room-sensor readings
<source> is "real" for the box or "sim" for the simulator.
"""
import json
import logging

import paho.mqtt.client as mqtt

log = logging.getLogger("wattwise.mqtt")


class MqttIngest:
    def __init__(self, core, host: str, port: int):
        self.core, self.host, self.port = core, host, port
        self.connected = False
        self.received = 0
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="wattwise-backend")
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message
        self.client.reconnect_delay_set(min_delay=1, max_delay=10)

    def start(self):
        self.client.connect_async(self.host, self.port, keepalive=30)
        self.client.loop_start()

    def stop(self):
        self.client.loop_stop()
        self.client.disconnect()

    def _on_connect(self, client, userdata, flags, reason_code, properties):
        self.connected = not reason_code.is_failure
        log.info("MQTT connected: %s", reason_code)
        client.subscribe([("wattwise/+/+/+/power", 0), ("wattwise/+/+/+/sensors", 0)])

    def _on_disconnect(self, client, userdata, flags, reason_code, properties):
        self.connected = False
        log.warning("MQTT disconnected: %s", reason_code)

    def _on_message(self, client, userdata, msg):
        try:
            parts = msg.topic.split("/")
            if len(parts) != 5:
                return
            _, source, device, name, kind = parts
            payload = json.loads(msg.payload)
            if not isinstance(payload, dict):
                return
            self.received += 1
            if kind == "power":
                self.core.handle_power(source, device, name, payload)
            elif kind == "sensors":
                self.core.handle_sensors(source, device, str(payload.get("room", name)), payload)
        except Exception:
            log.exception("could not process %s", msg.topic)
