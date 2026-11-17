/* Central frontend configuration. Reads window.WW_ENV (env.js) and keeps the older window.WW_API_BASE override working.
   Nothing here is secret: it is all visible in the browser. */
window.WW = window.WW || {};
WW.config = (function () {
  const env = window.WW_ENV || {};
  const pick = (...v) => v.find((x) => x !== undefined && x !== null && x !== "");
  const num = (v, d) => (Number.isFinite(Number(v)) && v !== "" && v != null ? Number(v) : d);
  const ss = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const base = pick(ss("ww_api_base"), env.API_BASE_URL, window.WW_API_BASE, location.protocol === "file:" ? "http://localhost:8000" : "");
  const mockFlag = pick(ss("ww_mock"), env.USE_MOCK_API ? "1" : "0") === "1" || /[?&]mock=/.test(location.search);
  return {
    APP_NAME: "WattWise",
    VERSION: "3.0.0",
    API_BASE_URL: String(base).replace(/\/+$/, ""),
    API_PREFIX: pick(env.API_PREFIX, "/api"),
    REQUEST_TIMEOUT_MS: num(env.REQUEST_TIMEOUT_MS, 10000),
    RETRY_GET: 1,
    DEFAULT_MODE: ["demo", "live"].includes(env.DEFAULT_MODE) ? env.DEFAULT_MODE : "demo",
    REFRESH_MS: { demo: 20000, live: 15000 },
    MOCK: { enabled: mockFlag, latencyMs: num(env.MOCK_LATENCY_MS, 250), scenario: ss("ww_mock_scenario") || (location.search.match(/[?&]mock=(\w+)/) || [])[1] || "ok" },
    LOCATION_LABEL: pick(env.WEATHER_LOCATION_LABEL, "Abbottabad"),
    DEBUG: !!env.DEBUG,
    /* Persist a runtime override for this browser session (used by Settings → System → API connection). */
    setApiBase(url) { try { if (url) sessionStorage.setItem("ww_api_base", url); else sessionStorage.removeItem("ww_api_base"); } catch (e) {} this.API_BASE_URL = String(url || pick(env.API_BASE_URL, window.WW_API_BASE, "")).replace(/\/+$/, ""); },
  };
})();
