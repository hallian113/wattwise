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


def _find_frontend() -> Path:
    """The folder that holds dashboard.html: 'frontend' or 'dashboard', next to the backend folder."""
    for name in ("frontend", "dashboard"):
        folder = BASE.parent / name
        if (folder / "dashboard.html").exists():
            return folder
    return BASE.parent / "frontend"


FRONTEND_DIR = _find_frontend()
