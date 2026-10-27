"""WattWise backend. Run with:  uvicorn app.main:app --port 8000"""
import logging
from contextlib import asynccontextmanager

from fastapi import Body, FastAPI, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel

from . import config
from .core import Core
from .db import Store
from .mqtt_ingest import MqttIngest

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

store = Store()
core = Core(store)
ingest = MqttIngest(core, config.MQTT_HOST, config.MQTT_PORT)


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.open()
    ingest.start()
    yield
    ingest.stop()
    store.close()


app = FastAPI(title="WattWise", version="0.30", lifespan=lifespan)


class ApplianceUpdate(BaseModel):
    socket: str
    name: str | None = None
    kind: str | None = None
    rated_w: float | None = None
    room: str | None = None
    measured: bool | None = None


@app.get("/")
def root():
    return RedirectResponse("/dashboard")


@app.get("/dashboard")
def dashboard():
    page = config.FRONTEND_DIR / "dashboard.html"
    if not page.exists():
        raise HTTPException(404, "dashboard.html not found")
    return FileResponse(page)


@app.get("/api/health")
def health():
    return {"ok": True, "mqtt_connected": ingest.connected, "messages_received": ingest.received, "rows": store.counts()}


@app.get("/api/live")
def live():
    return core.live()


@app.get("/api/summary")
def summary():
    s = core.summary()
    if s.get("status") == "ok":
        s["suggestions"] = core.suggestions(core.live(), s)
    return s


@app.get("/api/history")
def history(minutes: float = 10, socket: str | None = None):
    return core.history(minutes, socket)


@app.get("/api/events")
def events(limit: int = 30):
    return [{"ts": e["ts"].isoformat(), "kind": e["kind"], "room": e["room"], "socket": e["socket"], "message": e["message"]}
            for e in store.events(min(limit, 200))]


@app.get("/api/accuracy")
def accuracy():
    return core.accuracy()


@app.get("/api/settings")
def get_settings():
    return {"settings": core.settings(), "appliances": list(core.appliances().values())}


@app.post("/api/settings")
def post_settings(patch: dict = Body(...)):
    try:
        return core.update_settings(patch)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/api/appliance")
def post_appliance(a: ApplianceUpdate):
    if a.kind and a.kind not in ("laptop", "projector", "bulb", "fan", "tv", "ac", "heater", "other"):
        raise HTTPException(400, "unknown kind")
    store.update_appliance(a.socket, a.name, a.kind, a.rated_w, a.room, a.measured)
    core.invalidate_appliances()
    return list(core.appliances().values())


@app.post("/api/session/reset")
def reset_session():
    return {"reset": core.reset_session()}
