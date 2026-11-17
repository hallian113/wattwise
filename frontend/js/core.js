/* WattWise core helpers: icons, formatting, mode (Demo/Live), toasts, modal. Plain JavaScript, no framework. */
window.WW = window.WW || {};
(function (WW) {
  WW.icon = (name, size = 20, cls = "") =>
    `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${(window.WW_ICONS || {})[name] || ""}</svg>`;
  WW.$ = (s, r = document) => r.querySelector(s);
  WW.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  WW.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ----- persistent preferences (display only; real settings live in demo storage or backend) ----- */
  WW.prefs = { timeFormat: "12h", tempUnit: "C", theme: "light" };
  WW.loadPrefs = () => {
    try { Object.assign(WW.prefs, JSON.parse(localStorage.getItem("ww_prefs") || "{}")); } catch (e) {}
    document.documentElement.dataset.theme = WW.prefs.theme === "dark" ? "dark" : "light";
  };
  WW.savePrefs = (p) => {
    Object.assign(WW.prefs, p);
    try { localStorage.setItem("ww_prefs", JSON.stringify(WW.prefs)); } catch (e) {}
    document.documentElement.dataset.theme = WW.prefs.theme === "dark" ? "dark" : "light";
  };
  WW.loadPrefs();

  /* ----- formatting ----- */
  const nf = (v, d) => Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  WW.fmt = {
    kwh: (v, d = 1) => (v == null ? "—" : `${nf(v, d === 1 && Math.abs(v) < 1 ? 2 : d)} kWh`),
    num: (v, d = 1) => (v == null ? "—" : nf(v, d)),
    pkr: (v) => (v == null ? "—" : `Rs. ${nf(Math.round(v), 0)}`),
    w: (v) => (v == null ? "—" : `${nf(Math.round(v), 0)} W`),
    pct: (v) => (v == null ? "—" : `${v > 0 ? "+" : ""}${Math.round(v)}%`),
    time: (d) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: WW.prefs.timeFormat !== "24h" }),
    when(d) {
      const t = new Date(d), n = new Date();
      const same = t.toDateString() === n.toDateString();
      const y = new Date(n - 864e5).toDateString() === t.toDateString();
      return `${same ? "Today" : y ? "Yesterday" : t.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${this.time(t)}`;
    },
    dur(min) { if (min == null) return "—"; const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h} h ${m} min` : `${m} min`; },
    temp: (c) => (c == null ? "—" : WW.prefs.tempUnit === "F" ? `${Math.round(c * 9 / 5 + 32)} °F` : `${Math.round(c)} °C`),
  };
  WW.greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening"; };

  /* ----- Demo / Live mode (kept for the current browser session) ----- */
  WW.mode = {
    get: () => sessionStorage.getItem("ww_mode") || (WW.config ? WW.config.DEFAULT_MODE : "demo"),
    set(m) { sessionStorage.setItem("ww_mode", m); document.dispatchEvent(new CustomEvent("ww:mode", { detail: m })); },
    isDemo: () => WW.mode.get() === "demo",
  };
  WW.range = {
    get() { try { return JSON.parse(sessionStorage.getItem("ww_range")) || { key: "today" }; } catch (e) { return { key: "today" }; } },
    set(r) { sessionStorage.setItem("ww_range", JSON.stringify(r)); document.dispatchEvent(new CustomEvent("ww:range", { detail: r })); },
  };

  /* ----- toast + modal ----- */
  WW.toast = (msg, type = "") => {
    let box = WW.$(".toasts"); if (!box) { box = document.createElement("div"); box.className = "toasts"; document.body.appendChild(box); }
    const t = document.createElement("div"); t.className = `toast ${type}`; t.textContent = msg; box.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  };
  WW.modal = ({ title, body, actions = [] }) => new Promise((resolve) => {
    const bg = document.createElement("div"); bg.className = "modal-bg";
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h3>${WW.esc(title)}</h3><div class="mbody"></div><div class="actions"></div></div>`;
    const mb = WW.$(".mbody", bg); typeof body === "string" ? (mb.innerHTML = body) : mb.appendChild(body);
    const close = (v) => { bg.remove(); resolve(v); };
    actions.forEach((a) => {
      const b = document.createElement("button"); b.className = `btn ${a.primary ? "" : "ghost"} ${a.danger ? "danger" : ""}`; b.textContent = a.label;
      b.onclick = () => { if (a.onClick) { const r = a.onClick(bg); if (r === false) return; close(r ?? a.value); } else close(a.value); };
      WW.$(".actions", bg).appendChild(b);
    });
    bg.addEventListener("mousedown", (e) => { if (e.target === bg) close(null); });
    document.body.appendChild(bg);
    const f = WW.$("input,select,textarea", bg); if (f) f.focus();
  });
  WW.confirm = (title, text, label = "Confirm", danger = false) =>
    WW.modal({ title, body: `<p>${WW.esc(text)}</p>`, actions: [{ label: "Cancel", value: false }, { label, primary: true, danger, value: true }] });

  WW.debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  WW.download = (filename, text, type = "text/csv") => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  };
  WW.toCSV = (cols, rows, meta = []) => [...meta, cols, ...rows].map((r) => (Array.isArray(r) ? r : [r]).map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");

  /* Reusable UI fragments */
  WW.waiting = (msg = "Waiting for sensor data", sub = "Connect the ESP32 nodes and PZEM meters (see README → “Connect real hardware”), or switch to Demo Mode to preview the interface.") =>
    `<div class="card waiting"><div class="hicon">${WW.icon("radio-tower", 30)}</div><h3>${WW.esc(msg)}</h3><p style="max-width:460px;margin:0">${WW.esc(sub)}</p></div>`;
  /* Error panel. ApiError codes get a plain-language explanation, a Retry button and a way back to Demo mode. */
  WW.errorBox = (e) => {
    const code = e && e.code, msg = (e && e.message) || String(e);
    const hint = { network: "Check that the FastAPI backend is running and that CORS allows this page’s origin. You can still preview the interface in Demo mode.",
      timeout: "The backend did not answer in time. Check the server and the network, then retry.",
      unauthorized: "Your session is not signed in or has expired.",
      forbidden: "Your account is not allowed to do this.",
      not_implemented: "This endpoint is listed in docs/API_INTEGRATION.md and is waiting to be implemented in the backend. Nothing is simulated in Live mode.",
      bad_response: "The backend answered, but the JSON does not match the documented response format.",
      validation: "The backend rejected the request.", server: "The backend reported an internal error." }[code] || "Is the backend running?";
    const title = code === "not_implemented" ? "Backend endpoint not available yet" : code === "unauthorized" ? "Sign-in required" : code === "network" || code === "timeout" ? "Cannot reach the backend" : "Could not load data";
    return `<div class="errorbox" role="alert"><b>${WW.esc(title)}.</b> ${WW.esc(msg)}<br><span class="small">${WW.esc(hint)}</span>
      <div class="err-actions"><button class="btn ghost sm" data-retry>${WW.icon("refresh-cw", 14)} Retry</button>${WW.mode.isDemo() ? "" : `<button class="btn ghost sm" data-demo>Switch to Demo mode</button>`}${code === "unauthorized" ? `<a class="btn sm" href="login.html">Sign in</a>` : ""}</div></div>`;
  };
  /* True for any payload that is not a real backend measurement (Demo simulation or the Mock API adapter). */
  WW.isSim = (d) => !!d && (d.source === "demo" || d.source === "mock" || d.simulated === true);
  /* Standard banner for the data source of a payload. `what` describes what is simulated on that page. */
  WW.sourceBanner = (d, what = "simulated readings.") =>
    d && d.source === "mock" ? ""   /* the shell shows one persistent MOCK API bar instead */
    : d && (d.source === "demo" || d.simulated === true) ? `<div class="banner demo">${WW.icon("info", 18)} <b>DEMO DATA</b> — ${what}</div>` : "";
  /* Small helpers shared by the module pages. */
  WW.pill = (label, cls = "grey", title = "") => `<span class="pill ${cls}"${title ? ` title="${WW.esc(title)}"` : ""}>${WW.esc(label)}</span>`;
  WW.sourcePill = (d) => (d && d.source === "mock" ? WW.pill("mock", "info") : WW.isSim(d) ? WW.pill("simulated", "warn") : WW.pill("measured", ""));
  WW.emptyState = (title, sub, icon = "inbox") => `<div class="waiting compact-empty" role="status"><div class="hicon">${WW.icon(icon, 26)}</div><h3>${WW.esc(title)}</h3>${sub ? `<p style="max-width:460px;margin:0">${WW.esc(sub)}</p>` : ""}</div>`;
  /* "Estimate" disclaimer used wherever a figure is modelled rather than measured. */
  WW.estimateNote = (text) => `<div class="note">${WW.icon("info", 16)}<span>${WW.esc(text)}</span></div>`;
  WW.skeleton = () => `<div class="grid g2"><div class="skel" style="height:190px"></div><div class="skel" style="height:190px"></div></div><div class="grid g2 mt"><div class="skel" style="height:260px"></div><div class="skel" style="height:260px"></div></div>`;
  WW.roomIcon = (id) => ({ lounge: "sofa", bedroom: "bed-double", bathroom: "bath" }[id] || "house");
  WW.kindIcon = (k) => ({ light: "lightbulb", fan: "fan", tv: "tv", laptop: "laptop", ac: "snowflake", pump: "droplets" }[k] || "plug");
  WW.measureLabel = (m) => m === "measured" ? `<span class="pill">measured</span>` : m === "estimated" ? `<span class="pill warn">estimated</span>` : `<span class="pill grey">not tracked</span>`;
})(window.WW);
