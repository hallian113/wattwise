/* Runtime environment for the static frontend (no build step, so a browser cannot read a .env file directly).
   Edit this file, or generate it from .env with:  node scripts/generate-env.js
   No secrets belong here: everything in this file is public to anyone who opens the site. */
window.WW_ENV = {
  API_BASE_URL: "",            // "" = same origin (backend serves this folder). Example: "http://localhost:8000"
  API_PREFIX: "/api",
  REQUEST_TIMEOUT_MS: 10000,
  DEFAULT_MODE: "demo",        // "demo" | "live"
  USE_MOCK_API: false,         // true = serve backend-shaped mock responses in Live mode (frontend testing only)
  MOCK_LATENCY_MS: 250,
  WEATHER_LOCATION_LABEL: "Abbottabad",
  DEBUG: false
};
