/* Centralized API client. EVERY backend call in the frontend goes through WW.api.request().
   Responsibilities: URL building from the endpoint registry · JSON headers · bearer token · timeout · one retry for GET ·
   normalised errors (ApiError) · response-shape (contract) check · connection status · optional mock adapter hook.
   It never talks to PostgreSQL, MQTT or the ESP32 — only to the FastAPI REST API. */
window.WW = window.WW || {};
WW.api = WW.api || {};
(function (api) {
  const C = WW.config;

  /* codes: network | timeout | unauthorized | forbidden | not_implemented | validation | server | bad_response | client */
  class ApiError extends Error {
    constructor(message, { code = "server", status = 0, endpoint = null, detail = null } = {}) {
      super(message); this.name = "ApiError"; this.code = code; this.status = status; this.endpoint = endpoint; this.detail = detail;
    }
  }
  api.ApiError = ApiError;

  /* Connection status (read by Settings → System and the notReady/error UI). */
  api.status = { online: null, lastOkAt: null, lastErrorAt: null, lastError: null, calls: 0 };
  const note = (ok, err) => {
    api.status.calls++;
    if (ok) { api.status.online = true; api.status.lastOkAt = new Date().toISOString(); }
    else if (err && ["network", "timeout"].includes(err.code)) { api.status.online = false; api.status.lastErrorAt = new Date().toISOString(); api.status.lastError = err.message; }
    document.dispatchEvent(new CustomEvent("ww:api", { detail: { ok, code: err && err.code } }));
  };

  api.token = {
    get: () => { try { return sessionStorage.getItem("ww_token"); } catch (e) { return null; } },
    set: (t) => { try { t ? sessionStorage.setItem("ww_token", t) : sessionStorage.removeItem("ww_token"); } catch (e) {} },
  };

  const qs = (q) => {
    const p = Object.entries(q || {}).filter(([, v]) => v !== undefined && v !== null && v !== "");
    return p.length ? "?" + p.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&") : "";
  };
  api.url = (key, { params, query } = {}) => `${C.API_BASE_URL}${C.API_PREFIX}${api.path(key, params)}${qs(query)}`;
  /* Convert a WW.range object to query parameters. */
  api.rangeQuery = (r) => (r && r.key ? (r.key === "custom" ? { range: "custom", start: r.start, end: r.end } : { range: r.key }) : {});

  /* Contract check: a successful payload must contain the endpoint's required keys (unless the backend says available:false). */
  api.checkShape = (key, data) => {
    const e = api.endpoints[key]; if (!e || !e.required.length) return;
    if (data === null || typeof data !== "object" || Array.isArray(data)) throw new ApiError(`${e.method} ${e.path} returned ${Array.isArray(data) ? "an array" : typeof data}, expected an object.`, { code: "bad_response", endpoint: key });
    if (data.available === false) return;
    const missing = e.required.filter((k) => !(k in data));
    if (missing.length) throw new ApiError(`${e.method} ${e.path} response is missing: ${missing.join(", ")}. See docs/API_INTEGRATION.md.`, { code: "bad_response", endpoint: key, detail: { missing } });
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const classify = (status) => (status === 401 ? "unauthorized" : status === 403 ? "forbidden" : [404, 405, 501].includes(status) ? "not_implemented" : status === 422 || status === 400 ? "validation" : "server");
  const detailText = (j) => (!j ? "" : typeof j.detail === "string" ? j.detail : Array.isArray(j.detail) ? j.detail.map((d) => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`).join("; ") : j.message || "");

  /* api.request("rooms.get", { params: {id}, query: {range:"today"}, body: {...}, timeout: 8000 }) -> parsed JSON */
  api.request = async function (key, { params, query, body, timeout, signal } = {}) {
    const e = api.endpoints[key]; if (!e) throw new ApiError(`Unknown endpoint key: ${key}`, { code: "client", endpoint: key });
    if (api.mock && api.mock.isEnabled()) {
      try { const d = await api.mock.handle(key, { params, query, body }); api.checkShape(key, d); note(true); return d; } catch (err) { note(false, err); throw err; }
    }
    const url = api.url(key, { params, query });
    const attempts = e.method === "GET" ? 1 + (C.RETRY_GET || 0) : 1;
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      const ctl = new AbortController(), ms = timeout || C.REQUEST_TIMEOUT_MS;
      const timer = setTimeout(() => ctl.abort("timeout"), ms);
      if (signal) signal.addEventListener("abort", () => ctl.abort("aborted"), { once: true });
      try {
        const headers = { Accept: "application/json" };
        if (body !== undefined) headers["Content-Type"] = "application/json";
        const t = api.token.get(); if (t) headers.Authorization = "Bearer " + t;
        const res = await fetch(url, { method: e.method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal: ctl.signal });
        clearTimeout(timer);
        if (!res.ok) {
          let j = null; try { j = await res.json(); } catch (x) {}
          const code = classify(res.status);
          if (code === "unauthorized") { api.token.set(null); document.dispatchEvent(new CustomEvent("ww:unauthorized")); }
          const msg = code === "not_implemented" ? `The backend has no ${e.method} ${e.path} endpoint yet (HTTP ${res.status}).` : detailText(j) || res.statusText || `HTTP ${res.status}`;
          throw new ApiError(msg, { code, status: res.status, endpoint: key, detail: j });
        }
        if (res.status === 204) { note(true); return { ok: true }; }
        let data; try { data = await res.json(); } catch (x) { throw new ApiError(`${e.method} ${e.path} did not return valid JSON.`, { code: "bad_response", status: res.status, endpoint: key }); }
        api.checkShape(key, data); note(true); return data;
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof ApiError) lastErr = err;
        else if (err && (err.name === "AbortError" || err === "timeout")) lastErr = new ApiError(`No response from the backend within ${Math.round((timeout || C.REQUEST_TIMEOUT_MS) / 1000)} s.`, { code: "timeout", endpoint: key });
        else lastErr = new ApiError(`Cannot reach the backend at ${C.API_BASE_URL || location.origin}. Check that the FastAPI server is running and that CORS allows this origin.`, { code: "network", endpoint: key, detail: String(err && err.message || err) });
        const retryable = ["network", "timeout"].includes(lastErr.code) || (lastErr.code === "server" && lastErr.status >= 500);
        if (i < attempts - 1 && retryable) { await sleep(400); continue; }
        note(false, lastErr); throw lastErr;
      }
    }
    note(false, lastErr); throw lastErr;
  };

  /* Wrap a successful payload with the fields every page expects (does not overwrite what the backend sends). */
  api.normalize = (d, source) => (d && typeof d === "object" && !Array.isArray(d) ? { available: true, source: source || "live", ...d } : d);
  api.isMock = () => !!(api.mock && api.mock.isEnabled());
})(WW.api);
