/* API endpoint registry — the single source of truth for every backend endpoint the frontend calls.
   status:  "prototype" = already present in the prototype backend that shipped with this project (backend/routes/api.py)
            "required"  = the frontend is READY for it, but Talha's FastAPI backend must implement it (see docs/API_INTEGRATION.md)
   required: top-level keys a successful response must contain (checked by api-client; a missing key becomes a clear "bad_response" error
             instead of a blank page, which makes integration problems easy to find).
   Paths are relative to API_BASE_URL + API_PREFIX (default "/api"); {name} segments are filled from `params`. */
window.WW = window.WW || {};
WW.api = WW.api || {};
(function (api) {
  const E = {};
  const add = (key, method, path, module, status, desc, required) => { E[key] = { key, method, path, module, status, desc, required: required || [] }; };

  /* ---- M12 system / auth ---- */
  add("system.health", "GET", "/health", "M12", "prototype", "Liveness probe used by Settings → System → API connection.", ["status"]);
  add("system.mode", "GET", "/mode", "M12", "prototype", "Backend facts: database, MQTT connected, hardware-control gate, last reading time.", []);
  add("auth.login", "POST", "/auth/login", "M12", "prototype", "Email + password → access token (only when AUTH_REQUIRED=true).", ["token"]);
  add("auth.register", "POST", "/auth/register", "M12", "prototype", "Create a dashboard user.", []);

  /* ---- M11 dashboard / M2 energy monitoring ---- */
  add("dashboard.get", "GET", "/dashboard", "M11", "prototype", "Home overview: totals, month, status, rooms, tariff, alerts, insights.", ["totals", "month", "rooms", "tariff"]);
  add("rooms.list", "GET", "/rooms", "M2", "prototype", "All rooms with energy, occupancy, connectivity (query: range, start, end).", ["rooms", "totals"]);
  add("rooms.get", "GET", "/rooms/{id}", "M2", "prototype", "One room in detail.", []);
  add("appliances.list", "GET", "/appliances", "M2", "prototype", "Appliances of one room with power/energy/cost (query: room_id, range).", ["appliances"]);
  add("appliances.control", "POST", "/appliances/{id}/control", "M7", "prototype", "Switch an appliance ON/OFF. Body {on}. Hardware only if allowed.", []);
  add("appliances.mode", "PUT", "/appliances/{id}/mode", "M7", "prototype", "Set Automatic/Manual mode. Body {mode: auto|manual}.", []);
  add("appliances.config", "PUT", "/appliances/{id}/config", "M2", "prototype", "Set rated watts. Body {rated_watts}.", []);
  add("devices.list", "GET", "/devices", "M12", "prototype", "Rooms, nodes and appliances (configuration view).", ["rooms"]);
  add("sockets.map", "PUT", "/sockets/{id}", "M2", "prototype", "Map a smart socket to an appliance. Body {appliance_id}.", []);
  add("energy.get", "GET", "/energy", "M2", "prototype", "Energy time series (query: range, room_id, appliance_id).", []);
  add("analytics.get", "GET", "/analytics", "M9", "prototype", "KPIs, trend, room/appliance split, peak split, forecast, history.", ["kpis", "trend", "peak"]);

  /* ---- M1 sensing ---- */
  add("sensors.status", "GET", "/sensors", "M1", "prototype", "Component connectivity per room (ESP32, PZEM, LD2410, PIR, BME280, BH1750, reed, relay).", ["rooms"]);
  add("sensors.readings", "GET", "/sensors/readings", "M1", "required", "Latest sensor values per room: temperature, humidity, lux, presence, door, with status + source.", ["rooms"]);
  add("sensors.history", "GET", "/sensors/history", "M1", "required", "Sensor history for one room (query: room, hours).", ["labels"]);

  /* ---- M3 occupancy & context ---- */
  add("occupancy.latest", "GET", "/occupancy", "M3", "prototype", "Raw latest occupancy per room (legacy prototype shape).", []);
  add("occupancy.overview", "GET", "/occupancy/overview", "M3", "required", "Occupied/vacant/uncertain per room, context, today's timeline, 7-day presence history.", ["rooms"]);

  /* ---- M4 context-aware analysis ---- */
  add("analysis.context", "GET", "/analysis/context", "M4", "required", "Justified/avoidable verdict + reason per running appliance, and energy-vs-context series.", ["items"]);

  /* ---- M5 AI / ML ---- */
  add("ai.forecastLegacy", "GET", "/forecast", "M5", "prototype", "Legacy 3-hour load forecast (prototype).", []);
  add("ai.overview", "GET", "/ai/overview", "M5", "required", "Model status, metrics vs baseline, dataset provenance (PRECON, REWDP).", ["loadModel", "occupancyModel"]);
  add("ai.forecast", "GET", "/ai/forecast", "M5", "required", "Hourly load forecast with confidence band + occupancy probabilities.", ["load", "occupancy"]);
  add("ai.history", "GET", "/ai/history", "M5", "required", "Past predictions vs actual values (query: limit).", ["rows"]);

  /* ---- M6 waste ---- */
  add("waste.get", "GET", "/waste", "M6", "required", "Waste events, appliance-wise waste, idle/standby loads, energy + PKR impact (query: range).", ["summary", "byAppliance", "events"]);

  /* ---- M7 automation ---- */
  add("automation.list", "GET", "/automation", "M7", "prototype", "Rules + schedules + execution note.", ["rules"]);
  add("automation.create", "POST", "/automation", "M7", "prototype", "Create a rule.", []);
  add("automation.update", "PUT", "/automation/{id}", "M7", "prototype", "Edit a rule.", []);
  add("automation.toggle", "POST", "/automation/{id}/toggle", "M7", "prototype", "Enable/disable a rule.", []);
  add("automation.remove", "DELETE", "/automation/{id}", "M7", "prototype", "Delete a rule.", []);
  add("automation.log", "GET", "/automation-log", "M7", "prototype", "Action history with reasons.", ["log"]);
  add("automation.suggestions", "GET", "/automation/suggestions", "M7", "required", "Suggested actions with reason and potential impact.", ["suggestions"]);
  add("automation.suggestionApply", "POST", "/automation/suggestions/{id}/apply", "M7", "required", "Apply a suggestion (goes through the same hardware-control gate as manual control).", []);
  add("automation.suggestionDismiss", "POST", "/automation/suggestions/{id}/dismiss", "M7", "required", "Dismiss / keep-as-is (manual override of the suggestion).", []);

  /* ---- M8 weather + electrical safety ---- */
  add("weather.get", "GET", "/weather", "M8", "required", "Weather advisory + voltage + safety response status + event history. (A working reference implementation exists in the WattWise.zip backend.)", ["state"]);

  /* ---- M9 cost analytics ---- */
  add("analytics.cost", "GET", "/analytics/cost", "M9", "required", "PKR cost by room/appliance, peak vs off-peak cost, slab position, projection, 30-day cost history (query: range).", ["byRoom", "byAppliance", "peak", "slabs"]);

  /* ---- Savings ---- */
  add("savings.get", "GET", "/savings", "M9", "prototype", "Verified / estimated / potential savings.", ["verified"]);
  add("savings.tagDay", "POST", "/savings/day", "M9", "prototype", "Tag a day baseline|optimized. Body {day, mode}.", []);

  /* ---- M10 what-if ---- */
  add("whatif.baseline", "GET", "/whatif/baseline", "M10", "required", "Baseline monthly profile per appliance + tariff needed to build scenarios.", ["appliances", "tariff"]);
  add("whatif.simulate", "POST", "/whatif/simulate", "M10", "required", "Estimate kWh/PKR for a scenario. Always an estimate.", ["baseline", "scenario", "delta"]);

  /* ---- M13 sustainability ---- */
  add("sustainability.get", "GET", "/sustainability", "M13", "required", "Efficiency indicators, CO2e estimates, net-zero readiness criteria, solar/storage readiness.", ["efficiency", "impact", "readiness"]);

  /* ---- alerts / reports / settings ---- */
  add("alerts.list", "GET", "/alerts", "M11", "prototype", "Alerts (query: severity, category).", ["alerts"]);
  add("alerts.readAll", "POST", "/alerts/read-all", "M11", "prototype", "Mark all read.", []);
  add("alerts.read", "POST", "/alerts/{id}/read", "M11", "prototype", "Mark one read.", []);
  add("alerts.clear", "DELETE", "/alerts", "M11", "prototype", "Clear all alerts.", []);
  add("reports.get", "GET", "/reports/{kind}", "M9", "prototype", "Report data (kind: daily|weekly|monthly|room|appliance|cost|savings; query: range, format=csv).", ["table"]);
  add("settings.general", "GET", "/settings/general", "M12", "prototype", "General settings.", []);
  add("settings.saveGeneral", "PUT", "/settings/general", "M12", "prototype", "Save general settings.", []);
  add("settings.tariff", "GET", "/settings/tariff", "M9", "prototype", "Tariff, slabs, TOU window, alert thresholds, billing numbers.", []);
  add("settings.saveTariff", "PUT", "/settings/tariff", "M9", "prototype", "Save tariff.", []);
  add("settings.estimate", "POST", "/settings/tariff/estimate", "M9", "prototype", "Estimate a bill for N units. Body {units}.", ["bill"]);

  api.endpoints = E;
  api.endpointList = () => Object.values(E);
  /* Build the path for an endpoint key: api.path("rooms.get", {id: "lounge"}) -> "/rooms/lounge" */
  api.path = (key, params = {}) => {
    const e = E[key]; if (!e) throw new Error(`Unknown endpoint key: ${key}`);
    return e.path.replace(/\{(\w+)\}/g, (_, n) => { if (params[n] === undefined || params[n] === null || params[n] === "") throw new Error(`Endpoint ${key} needs path parameter "${n}"`); return encodeURIComponent(params[n]); });
  };
})(WW.api);
