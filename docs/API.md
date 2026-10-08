# WattWise API (FYP-I)

Contract between **backend** (FastAPI) and **dashboard** (HTML/CSS/JS).
If code and this file disagree, this file is right and the code must be fixed.
Change this file **before** changing the code, and add a line to the Changelog.

---

## General

| Item | Value |
|---|---|
| Base URL (local) | `http://localhost:8000/api` |
| Base URL (same Wi-Fi) | `http://<backend-laptop-IP>:8000/api` |
| Live docs | `http://<host>:8000/docs` |
| Format | JSON, UTF-8 |
| Time | ISO 8601, e.g. `2026-10-15T14:30:00+05:00` |
| Units | power W, energy kWh, voltage V, current A, temp °C, light lux, cost PKR |

### Authentication

Every endpoint except `POST /auth/login` needs this header:

```
Authorization: Bearer <access_token>
```

### Error format

```json
{ "detail": "Room not found" }
```

| Code | Meaning |
|---|---|
| 400 | Bad request (wrong field or value) |
| 401 | Not logged in, or token expired |
| 404 | Not found |
| 422 | Validation error (FastAPI default) |
| 500 | Server error |

### IDs used in the prototype

| Rooms | Appliances (examples) |
|---|---|
| `lounge` | `lounge_light1`, `lounge_fan1` |
| `bedroom` | `bedroom_light1`, `bedroom_fan1` |
| `bathroom` | `bathroom_light1` |

### Allowed values

| Field | Values |
|---|---|
| `occupancy` | `occupied`, `vacant`, `unconfirmed` |
| `state` | `ON`, `OFF` |
| `door` | `open`, `closed` |
| `changed_by` | `user`, `system` |
| `sensor_health` | `ok`, `degraded`, `offline` |

---

## 1. Login

`POST /api/auth/login`

Request:
```json
{ "email": "talha@example.com", "password": "secret" }
```

Response 200:
```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "bearer",
  "user": { "id": 1, "name": "Talha Waheed", "email": "talha@example.com" }
}
```

Errors: 401 wrong email or password.

---

## 2. Current user

`GET /api/auth/me`

Response 200:
```json
{ "id": 1, "name": "Talha Waheed", "email": "talha@example.com" }
```

Errors: 401.

---

## 3. List rooms

`GET /api/rooms`

Response 200:
```json
[
  { "id": "lounge",   "name": "Lounge",   "node_online": true },
  { "id": "bedroom",  "name": "Bedroom",  "node_online": true },
  { "id": "bathroom", "name": "Bathroom", "node_online": false }
]
```

---

## 4. Room status

`GET /api/rooms/{room_id}/status`

Response 200:
```json
{
  "room": "lounge",
  "occupancy": "vacant",
  "vacant_since_min": 15,
  "door": "closed",
  "light_lux": 420,
  "temp_c": 29.5,
  "humidity_pct": 61,
  "time_context": "weekday_afternoon",
  "sensor_health": "ok",
  "appliances": [
    { "id": "lounge_light1", "name": "Light 1", "state": "ON",  "power_w": 18.2 },
    { "id": "lounge_fan1",   "name": "Fan 1",   "state": "OFF", "power_w": 0.0 }
  ],
  "updated_at": "2026-10-15T14:30:00+05:00"
}
```

Notes:
- `vacant_since_min` is `null` unless `occupancy` is `vacant`.

Errors: 404 room not found.

---

## 5. List appliances

`GET /api/appliances`

Optional query: `?room_id=lounge`

Response 200:
```json
[
  {
    "id": "lounge_light1",
    "name": "Light 1",
    "room": "lounge",
    "state": "ON",
    "power_w": 18.2,
    "essential": false,
    "last_changed_at": "2026-10-15T13:10:00+05:00",
    "changed_by": "user"
  }
]
```

Notes:
- `essential: true` means the system must never switch it OFF automatically.

---

## 6. Control appliance

`POST /api/appliances/{appliance_id}/control`

Request:
```json
{ "state": "OFF" }
```

Response 200:
```json
{
  "id": "lounge_light1",
  "state": "OFF",
  "changed_by": "user",
  "override_until": "2026-10-15T15:00:00+05:00"
}
```

Notes:
- A manual change creates an override. Until `override_until`, the system will not change this appliance automatically.

Errors: 400 invalid state, 404 appliance not found.

---

## 7. Energy analytics

`GET /api/analytics/energy`

| Query | Required | Example |
|---|---|---|
| `from` | yes | `2026-10-01` |
| `to` | yes | `2026-10-15` |
| `group_by` | no, default `day` | `hour` or `day` |
| `room_id` | no, default all rooms | `lounge` |

Response 200:
```json
{
  "from": "2026-10-01",
  "to": "2026-10-15",
  "group_by": "day",
  "room_id": null,
  "total_kwh": 42.6,
  "series": [
    { "t": "2026-10-01", "kwh": 2.9 },
    { "t": "2026-10-02", "kwh": 3.1 }
  ]
}
```

Errors: 400 bad dates, or `from` is after `to`.

---

## 8. Cost analytics

`GET /api/analytics/cost`

Query: `from`, `to` (required, same as above)

Response 200:
```json
{
  "from": "2026-10-01",
  "to": "2026-10-15",
  "total_kwh": 42.6,
  "estimated_cost_pkr": 1874.4,
  "tariff_name": "configured_residential",
  "by_room": [
    { "room": "lounge",   "kwh": 21.0, "cost_pkr": 924.0 },
    { "room": "bedroom",  "kwh": 17.4, "cost_pkr": 765.6 },
    { "room": "bathroom", "kwh": 4.2,  "cost_pkr": 184.8 }
  ],
  "by_appliance": [
    { "id": "lounge_fan1", "kwh": 12.5, "share_pct": 29.3 }
  ]
}
```

Notes:
- Tariff rates come from backend settings, not from the dashboard.

---

## 9. Live updates (WebSocket)

`WS ws://<host>:8000/ws/live?token=<access_token>`

The server pushes messages. Every message has a `type`:

Room status changed (same body as section 4):
```json
{ "type": "room_status", "data": { "room": "lounge", "occupancy": "occupied" } }
```

Appliance changed:
```json
{
  "type": "appliance_state",
  "data": { "id": "lounge_light1", "state": "OFF", "changed_by": "system" }
}
```

Node online or offline:
```json
{ "type": "node_status", "data": { "room": "bathroom", "node_online": false } }
```

Notes:
- `room_status` may send only the changed fields. The dashboard should merge them into what it already has.

---

## Planned for FYP-II (not built yet)

- `GET /api/appliances/{id}/history`
- `GET /api/analytics/waste`
- `GET /api/analytics/whatif`
- `GET /api/analytics/sustainability`
- `GET /api/safety/status`
- `GET /api/alerts`, `POST /api/alerts/{id}/ack`
- `GET /api/logs/decisions`
- `GET /api/settings`, `PUT /api/settings`

---

## Changelog

- 2026-10-08: First version, 9 FYP-I endpoints.