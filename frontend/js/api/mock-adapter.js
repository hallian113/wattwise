/* Mock API adapter — for FRONTEND-ONLY testing of the Live code path (api-client → api-services → pages) without a backend.
   Switch on with  ?mock=ok  in the URL, USE_MOCK_API in env.js, or Settings → System → API connection.
   It answers every endpoint in endpoints.js with a backend-shaped payload built from the Demo simulation, always tagged
   source:"mock", and the app shows a "MOCK API" banner. It is NOT live data and NOT a backend.
   Scenarios:  ok · empty (no readings yet) · error (HTTP 500) · offline (network failure) · notready (new endpoints return 404)
               · unauthorized (HTTP 401) · slow (3 s latency). */
window.WW = window.WW || {};
WW.api = WW.api || {};
(function (api) {
  const C = WW.config, E = api.ApiError;
  const SCENARIOS = ["ok", "empty", "error", "offline", "notready", "unauthorized", "slow"];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const tag = (d) => (d && typeof d === "object" && !Array.isArray(d) ? { ...d, source: "mock", mock: true } : d);
  const rangeOf = (q) => (q && q.range ? { key: q.range, start: q.start, end: q.end } : { key: "today" });
  const D = () => WW.demo;

  /* key -> (req) => payload. Payloads come from the Demo simulation, so shapes match the documented contract. */
  const H = {
    "system.health": () => ({ status: "ok", mock: true }),
    "system.mode": () => ({ database: "mock (no database)", mqttEnabled: false, mqttConnected: false, hardwareControlAllowed: false, authRequired: false, lastReadingAt: null, note: "Mock API adapter — no backend is running." }),
    "auth.login": (r) => ({ token: "mock-token", user: { email: r.body.email } }),
    "auth.register": () => ({ ok: true }),
    "dashboard.get": () => D().getDashboard(),
    "rooms.list": (r) => D().getRooms(rangeOf(r.query)),
    "rooms.get": async (r) => { const d = await D().getRooms({ key: "today" }); return d.rooms.find((x) => x.id === r.params.id) || d; },
    "appliances.list": (r) => D().getAppliances(r.query.room_id, rangeOf(r.query)),
    "appliances.control": (r) => D().controlAppliance(r.params.id, r.body.on),
    "appliances.mode": (r) => D().setApplianceMode(r.params.id, r.body.mode),
    "appliances.config": (r) => D().saveApplianceConfig(r.params.id, r.body.rated_watts),
    "devices.list": () => D().getDevices(),
    "sockets.map": (r) => D().mapSocket(r.params.id, r.body.appliance_id),
    "energy.get": () => ({ available: false, message: "Not used by the mock adapter." }),
    "analytics.get": (r) => D().getAnalytics(rangeOf(r.query)),
    "sensors.status": () => D().getSensors(),
    "sensors.readings": () => D().getSensorReadings(),
    "sensors.history": (r) => D().getSensorHistory(r.query.room, Number(r.query.hours) || 24),
    "occupancy.latest": () => ({}),
    "occupancy.overview": () => D().getOccupancy(),
    "analysis.context": () => D().getContext(),
    "ai.forecastLegacy": () => ({ available: false }),
    "ai.overview": () => D().getAiOverview(),
    "ai.forecast": () => D().getAiForecast(),
    "ai.history": (r) => D().getAiHistory(Number(r.query.limit) || 24),
    "waste.get": (r) => D().getWaste(rangeOf(r.query)),
    "automation.list": () => D().getAutomation(),
    "automation.create": (r) => D().saveRule({ name: r.body.name, description: r.body.description, type: r.body.rule_type, enabled: r.body.enabled, params: r.body.params }),
    "automation.update": (r) => D().saveRule({ id: r.params.id, ...r.body }),
    "automation.toggle": (r) => D().toggleRule(r.params.id),
    "automation.remove": (r) => D().deleteRule(r.params.id),
    "automation.log": () => D().getAutomationLog(),
    "automation.suggestions": () => D().getSuggestions(),
    "automation.suggestionApply": (r) => D().applySuggestion(r.params.id),
    "automation.suggestionDismiss": (r) => D().dismissSuggestion(r.params.id),
    "weather.get": () => D().getWeather(),
    "analytics.cost": (r) => D().getCostAnalytics(rangeOf(r.query)),
    "savings.get": () => D().getSavings(),
    "savings.tagDay": (r) => D().tagDay(r.body.day, r.body.mode),
    "whatif.baseline": () => D().getWhatIfBaseline(),
    "whatif.simulate": (r) => D().simulateWhatIf(r.body),
    "sustainability.get": () => D().getSustainability(),
    "alerts.list": () => D().getAlerts(),
    "alerts.readAll": () => D().markAllRead(),
    "alerts.read": (r) => D().markRead(r.params.id),
    "alerts.clear": () => D().clearAlerts(),
    "reports.get": (r) => D().getReport(r.params.kind, rangeOf(r.query)),
    "settings.general": async () => (await D().getSettings()).general,
    "settings.saveGeneral": (r) => D().saveGeneral(r.body),
    "settings.tariff": async () => (await D().getSettings()).tariff,
    "settings.saveTariff": (r) => D().saveTariff(r.body),
    "settings.estimate": (r) => D().estimate(r.body.units),
  };

  api.mock = {
    scenarios: SCENARIOS,
    isEnabled: () => !!C.MOCK.enabled,
    scenario: () => C.MOCK.scenario,
    /* api.mock.set({ enabled: true, scenario: "empty" }) — persists for this browser session */
    set({ enabled, scenario } = {}) {
      if (enabled !== undefined) { C.MOCK.enabled = !!enabled; try { sessionStorage.setItem("ww_mock", enabled ? "1" : "0"); } catch (e) {} }
      if (scenario && SCENARIOS.includes(scenario)) { C.MOCK.scenario = scenario; try { sessionStorage.setItem("ww_mock_scenario", scenario); } catch (e) {} }
    },
    async handle(key, req) {
      const e = api.endpoints[key], sc = C.MOCK.scenario;
      await sleep(sc === "slow" ? 3000 : C.MOCK.latencyMs);
      if (sc === "offline") throw new E(`Cannot reach the backend at ${C.API_BASE_URL || location.origin} (mock scenario “offline”).`, { code: "network", endpoint: key });
      if (sc === "error") throw new E("Internal server error (mock scenario “error”).", { code: "server", status: 500, endpoint: key });
      if (sc === "unauthorized" && key !== "auth.login") { document.dispatchEvent(new CustomEvent("ww:unauthorized")); throw new E("Not signed in (mock scenario “unauthorized”).", { code: "unauthorized", status: 401, endpoint: key }); }
      if (sc === "notready" && e.status === "required") throw new E(`The backend has no ${e.method} ${e.path} endpoint yet (HTTP 404, mock scenario “notready”).`, { code: "not_implemented", status: 404, endpoint: key });
      if (sc === "empty" && e.method === "GET" && !["system.health", "system.mode"].includes(key)) return tag({ available: false, message: "No readings have been received yet (mock scenario “empty”)." });
      const fn = H[key]; if (!fn) throw new E(`The mock adapter has no handler for ${key}.`, { code: "client", endpoint: key });
      const out = await fn({ params: req.params || {}, query: req.query || {}, body: req.body || {} });
      return tag(out);
    },
    handlers: H,
  };
})(WW.api);
