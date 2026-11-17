/* API service functions — one small function per backend operation, grouped by proposal module.
   Pages never call fetch(); they call WW.data.* (see data-service.js), which in Live mode lands here via live-service.js.
   Every function returns the backend JSON with { available, source:"live" } defaults filled in, or throws WW.api.ApiError. */
window.WW = window.WW || {};
WW.api = WW.api || {};
(function (api) {
  const R = (key, opt) => api.request(key, opt).then((d) => api.normalize(d, "live"));
  const raw = (key, opt) => api.request(key, opt);
  const rq = (r) => api.rangeQuery(r);

  api.services = {
    /* M12 — system, authentication */
    system: { health: () => raw("system.health", { timeout: 5000 }), mode: () => raw("system.mode") },
    auth: {
      async login(email, password) { const d = await raw("auth.login", { body: { email, password } }); api.token.set(d.token); return d; },
      register: (email, password) => raw("auth.register", { body: { email, password } }),
      logout() { api.token.set(null); },
      isLoggedIn: () => !!api.token.get(),
    },
    /* M11 — dashboard */
    dashboard: { get: () => R("dashboard.get") },
    /* M2 — energy monitoring (rooms, appliances) */
    rooms: { list: (range) => R("rooms.list", { query: rq(range) }), get: (id) => R("rooms.get", { params: { id } }) },
    appliances: {
      list: (room, range) => R("appliances.list", { query: { room_id: room, ...rq(range) } }),
      control: (id, on) => raw("appliances.control", { params: { id }, body: { on } }),
      setMode: (id, mode) => raw("appliances.mode", { params: { id }, body: { mode } }),
      saveConfig: async (id, rated) => { await raw("appliances.config", { params: { id }, body: { rated_watts: rated } }); return { ok: true }; },
      devices: () => R("devices.list"),
      mapSocket: (sid, appId) => raw("sockets.map", { params: { id: sid }, body: { appliance_id: appId } }),
    },
    /* M9 — cost & energy analytics */
    analytics: { get: (range) => R("analytics.get", { query: rq(range) }), cost: (range) => R("analytics.cost", { query: rq(range) }) },
    savings: { get: () => R("savings.get"), tagDay: (day, mode) => raw("savings.tagDay", { body: { day, mode } }) },
    /* M1 — sensing */
    sensors: { status: () => R("sensors.status"), readings: () => R("sensors.readings"), history: (room, hours = 24) => R("sensors.history", { query: { room, hours } }) },
    /* M3 / M4 — occupancy and context-aware analysis */
    occupancy: { overview: () => R("occupancy.overview") },
    context: { get: () => R("analysis.context") },
    /* M5 — AI / ML interfaces (models themselves are Talha's work) */
    ai: { overview: () => R("ai.overview"), forecast: () => R("ai.forecast"), history: (limit = 24) => R("ai.history", { query: { limit } }) },
    /* M6 — waste detection */
    waste: { get: (range) => R("waste.get", { query: rq(range) }) },
    /* M7 — automation */
    automation: {
      list: () => R("automation.list"),
      save: (rule) => (rule.id ? raw("automation.update", { params: { id: rule.id }, body: { name: rule.name, description: rule.description || "", enabled: !!rule.enabled, params: rule.params || {} } })
        : raw("automation.create", { body: { name: rule.name, description: rule.description || "", rule_type: rule.type || "custom", enabled: !!rule.enabled, params: rule.params || {} } })),
      toggle: (id) => raw("automation.toggle", { params: { id } }),
      remove: (id) => raw("automation.remove", { params: { id } }),
      log: () => R("automation.log"),
      suggestions: () => R("automation.suggestions"),
      applySuggestion: (id) => raw("automation.suggestionApply", { params: { id } }),
      dismissSuggestion: (id) => raw("automation.suggestionDismiss", { params: { id } }),
    },
    /* M8 — weather-aware electrical safety */
    weather: { get: () => R("weather.get") },
    /* M10 — what-if */
    whatif: { baseline: () => R("whatif.baseline"), simulate: (scenario) => R("whatif.simulate", { body: scenario }) },
    /* M13 — sustainability */
    sustainability: { get: () => R("sustainability.get") },
    /* alerts, reports, settings */
    alerts: { list: () => R("alerts.list"), read: (id) => raw("alerts.read", { params: { id } }), readAll: () => raw("alerts.readAll"), clear: () => raw("alerts.clear") },
    reports: { get: (kind, range) => R("reports.get", { params: { kind }, query: rq(range) }) },
    settings: {
      async get() { const [general, tariff] = await Promise.all([raw("settings.general"), raw("settings.tariff")]); return { general, tariff }; },
      saveGeneral: (g) => raw("settings.saveGeneral", { body: g }),
      saveTariff: (t) => raw("settings.saveTariff", { body: t }),
      estimate: (units) => raw("settings.estimate", { body: { units } }),
    },
  };
})(WW.api);
