/* LIVE data service — a thin facade over the API service layer (js/api/*). It talks ONLY to the FastAPI REST API
   (never to PostgreSQL, MQTT or an ESP32) and NEVER falls back to demo data: if the backend has no real readings the pages show
   "Waiting for sensor data"; if an endpoint is not implemented yet they show a "backend endpoint not available" panel.
   Method names match WW.demo so data-service.js can route either way without the pages caring. */
window.WW = window.WW || {};
WW.live = (function () {
  const S = WW.api.services;
  let unread = 0;
  return {
    /* M12 */
    health: S.system.health, mode: S.system.mode, login: S.auth.login, register: S.auth.register, logout: S.auth.logout,
    get BASE() { return WW.config.API_BASE_URL + WW.config.API_PREFIX; },
    /* M11 / M2 */
    getDashboard: S.dashboard.get,
    getRooms: S.rooms.list,
    getAppliances: S.appliances.list,
    controlAppliance: S.appliances.control, setApplianceMode: S.appliances.setMode, mapSocket: S.appliances.mapSocket,
    saveApplianceConfig: S.appliances.saveConfig, getDevices: S.appliances.devices,
    /* M9 */
    getAnalytics: S.analytics.get, getCostAnalytics: S.analytics.cost,
    getSavings: S.savings.get, tagDay: S.savings.tagDay,
    getReport: S.reports.get,
    /* M1 sensing */
    getSensors: S.sensors.status, getSensorReadings: S.sensors.readings, getSensorHistory: S.sensors.history,
    /* M3 / M4 / M5 / M6 */
    getOccupancy: S.occupancy.overview, getContext: S.context.get,
    getAiOverview: S.ai.overview, getAiForecast: S.ai.forecast, getAiHistory: S.ai.history,
    getWaste: S.waste.get,
    /* M7 automation */
    async getAutomation() { const d = await S.automation.list(); if (!d.schedules) { d.schedules = []; d.schedulesNote = "Schedules are not available in Live mode yet."; } return d; },
    saveRule: S.automation.save, toggleRule: S.automation.toggle, deleteRule: S.automation.remove,
    saveSchedule: async () => ({ ok: false, message: "Schedules are not supported in Live mode yet." }),
    deleteSchedule: async () => ({ ok: false }), toggleSchedule: async () => ({ ok: false }),
    getAutomationLog: S.automation.log,
    getSuggestions: S.automation.suggestions, applySuggestion: S.automation.applySuggestion, dismissSuggestion: S.automation.dismissSuggestion,
    /* M8 weather & safety — real endpoint only; a missing endpoint is reported, never replaced by a made-up "normal" state */
    getWeather: S.weather.get,
    /* M10 / M13 */
    getWhatIfBaseline: S.whatif.baseline, simulateWhatIf: S.whatif.simulate,
    getSustainability: S.sustainability.get,
    /* alerts */
    async getAlerts() { const d = await S.alerts.list(); unread = d.alerts.filter((a) => !a.read && a.severity !== "info").length; return d; },
    markRead: S.alerts.read, markAllRead: S.alerts.readAll, clearAlerts: S.alerts.clear,
    /* settings */
    getSettings: S.settings.get, saveGeneral: S.settings.saveGeneral, saveTariff: S.settings.saveTariff, estimate: S.settings.estimate,
    unreadCount: () => unread,
  };
})();
