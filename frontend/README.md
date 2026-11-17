# WattWise — Frontend

Plain **HTML + CSS + JavaScript** (no framework, no build step). Charts use the bundled Chart.js (`vendor/chart.umd.js`); the 3D house on the landing page uses the bundled three.js. Everything runs by opening the folder through any static web server.

> Ownership: this folder is **Sawera's** (UI/UX, dashboard, frontend JavaScript, API integration files, frontend testing). The FastAPI backend, MQTT, PostgreSQL and the ML models are **Talha's**. The ESP32 firmware comes later. Nothing in this folder implements backend, MQTT, database or firmware logic.

## Run it

```bash
cd frontend
python3 -m http.server 5500          # any static server works
# open http://localhost:5500          (landing page)  ->  "Explore WattWise"
```

* **Demo mode** (default): a deterministic in-browser simulation of a three-room home. Every number is simulated and labelled so. No backend needed.
* **Live mode**: every request goes through the API client to the FastAPI backend. Live mode **never** falls back to demo numbers: if the backend is unreachable you get an error panel with *Retry*; if an endpoint is not implemented yet you get a "backend endpoint not available yet" panel; if there are no readings you get "Waiting for sensor data".
* **Live + Mock API** (frontend testing): backend-shaped responses served by `js/api/mock-adapter.js`. Switch on with `?mock=ok` in the URL, `USE_MOCK_API` in `env.js`, or *Settings → System → API connection*. A persistent **MOCK API** bar is shown. Scenarios: `ok · empty · error · offline · notready · unauthorized · slow`.

## Connect to Talha's backend

1. Start the backend (default `http://localhost:8000`, routes under `/api`).
2. Point the frontend at it — either edit `env.js`:
   ```js
   window.WW_ENV = { API_BASE_URL: "http://localhost:8000", API_PREFIX: "/api", ... };
   ```
   or copy `.env.example` to `.env` and run `node scripts/generate-env.js` (writes `env.js`), or type the URL in *Settings → System → API connection* and press **Test connection**.
3. Allow the frontend origin in the backend's CORS settings.
4. Switch the header toggle to **Live**.
5. Open *Settings → System → Endpoint readiness* to see which endpoints are still missing, and read [`../docs/API_INTEGRATION.md`](../docs/API_INTEGRATION.md) for every request/response format.

`env.js` is public (it ships to the browser): never put passwords, tokens or API keys in it. Backend secrets stay in the backend's own `.env`.

## Folder structure

```
frontend/
├── index.html                  Landing page (project, features, team)
├── dashboard.html … settings.html, login.html     One HTML shell per page (17 app pages + sign-in)
├── env.js, .env.example, scripts/generate-env.js   Runtime configuration (see above)
├── css/
│   ├── app.css                 Design system: tokens, layout, cards, tables, charts, responsive rules (original)
│   ├── modules.css             Grouped navigation + styles for the module pages added in v3
│   └── landing.css             Landing page only
├── js/
│   ├── config.js               Central configuration (reads env.js)
│   ├── api/
│   │   ├── endpoints.js        Registry of all 52 endpoints: method, path, module, backend status, required response keys
│   │   ├── api-client.js       The ONLY place that calls fetch(): timeout, retry, auth token, normalised ApiError, contract check
│   │   ├── api-services.js     One function per backend operation, grouped by module (M1…M13)
│   │   └── mock-adapter.js     Backend-shaped mock responses + failure scenarios (frontend testing only)
│   ├── demo-service.js         Simulated home (rooms, appliances, occupancy, energy, tariff) for Demo mode
│   ├── demo/demo-modules.js    Simulated data for sensors, occupancy, context, waste, AI, weather, cost, what-if, sustainability
│   ├── live-service.js         Thin façade: legacy method names → api-services
│   ├── data-service.js         Routes every page request to Demo or Live (the pages never know which)
│   ├── core.js, tariff.js, icons.js, charts.js, layout.js, house3d.js    Shared helpers, tariff maths, icons, chart helpers, app shell
│   ├── utils/validators.js     Input validation (numbers, e-mail, URL, tariff slabs, what-if scenarios)
│   └── pages/                  One script per page (dashboard.js, sensors.js, weather.js, …)
├── assets/rooms/               Room photographs
└── vendor/                     chart.umd.js, three.min.js
```

Why not the suggested `modules/` + `utils/formatters.js` split? The project already organises code by *page* (`js/pages/`), formatters live in `core.js` (`WW.fmt`), and the pages share one global `WW` namespace loaded with plain `<script>` tags. Keeping that avoids a risky rewrite of working code; the new folders (`api/`, `demo/`, `utils/`) give each responsibility its own file.

## Pages and proposal modules

| Page | Module | Page | Module |
|---|---|---|---|
| Dashboard | M11 (+M2, M8 and M3 summary cards) | Weather & Safety | M8 |
| Rooms, Appliances | M2 | Energy Analytics | M2, M9 (incl. Cost & Tariff section) |
| Sensors | M1 | Savings | M9 (verified / estimated / potential) |
| Occupancy | M3 | What-If | M10 |
| Context Analysis | M4 | Sustainability | M13 |
| AI Insights | M5 | Reports | M9 |
| Waste Detection | M6 | Settings (API connection) | M12 |
| Automation (rules, schedules, **suggested actions**, log) | M7 | Login | M12 |

## Honesty rules built into the UI

* Demo data is always labelled (banner + *simulated* pills). Mock data is labelled by the **MOCK API** bar.
* Simulated savings are never tagged *verified*; estimates, potential and measured figures stay separate.
* No accuracy/MAE is shown for a model that is not trained; forecasts in Demo are labelled *simulated*.
* Weather, voltage and disconnection status are labelled simulated in Demo, and the UI states that WattWise does not replace breakers, fuses, surge protection or earthing.
* CO₂e uses an editable, clearly-flagged illustrative factor and never claims a reduction without verified savings; solar/storage are shown as "not connected / outside current scope".

## Add a page or endpoint

1. Endpoint: add one `add(...)` line in `js/api/endpoints.js` (required keys included), one function in `js/api/api-services.js`, one line in `js/live-service.js`, a handler in `js/api/mock-adapter.js` and a demo method in `js/demo/demo-modules.js`.
2. Page: copy a small page (e.g. `waste.html` + `js/pages/waste.js`), set `data-page`, add it to `NAV` in `js/layout.js`.
3. Run the tests.

## Tests

```bash
node tests/frontend/unit_api.test.js     # API client, registry, config, validators (no browser)
python3 tests/frontend/ui_e2e.py         # headless Chromium: pages, navigation, controls, states, responsive, numbers, contract
```
See `docs/TESTING_REPORT.md` for the last recorded run.
