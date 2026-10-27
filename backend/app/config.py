"""Settings read from environment variables (or backend/.env)."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE = Path(__file__).resolve().parent.parent
load_dotenv(BASE / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://wattwise:wattwise@localhost:5432/wattwise")
MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
LOCAL_TZ = os.getenv("LOCAL_TZ", "Asia/Karachi")
SCHEMA_PATH = BASE / "schema.sql"
FRONTEND_DIR = BASE.parent / "frontend"
