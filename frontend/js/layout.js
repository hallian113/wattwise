/* App shell shared by every dashboard page: sidebar, header, Demo/Live toggle, date filter, auto-refresh. */
(function () {
  /* Grouped navigation. Each entry: [page id, label, icon]. Every id has a matching <id>.html page. */
  const NAV = [
    [null, [["dashboard", "Dashboard", "layout-dashboard"]]],
    ["Monitor", [["rooms", "Rooms", "layout-grid"], ["sensors", "Sensors", "radio"], ["occupancy", "Occupancy", "eye"], ["appliances", "Appliances", "plug"]]],
    ["Intelligence", [["context", "Context Analysis", "list-checks"], ["waste", "Waste Detection", "flame"], ["ai-insights", "AI Insights", "brain"]]],
    ["Control & Safety", [["automation", "Automation", "layers"], ["weather", "Weather & Safety", "cloud-lightning"], ["alerts", "Alerts", "bell"]]],
    ["Energy & Cost", [["analytics", "Energy Analytics", "chart-column"], ["savings", "Savings", "piggy-bank"], ["whatif", "What-If", "git-compare"], ["sustainability", "Sustainability", "sprout"], ["reports", "Reports", "file-text"]]],
    ["System", [["settings", "Settings", "settings"]]],
  ];
  const RANGES = [["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["custom", "Custom range…"]];
  let timer = null, busy = false;

  function shell(page) {
    const cur = document.body.dataset.page;
    const mode = WW.mode.get(), r = WW.range.get();
    const rangeSel = page.showRange === false ? "" : `<select class="select" id="rangeSel" aria-label="Date range">${RANGES.map(([k, l]) => `<option value="${k}" ${r.key === k ? "selected" : ""}>${k === "custom" && r.key === "custom" ? `${r.start} → ${r.end}` : l}</option>`).join("")}</select>`;
    document.getElementById("root").innerHTML = `
    <div class="app">
      <aside class="sidebar" id="sidebar">
        <a class="brand" href="index.html" title="WattWise home"><span class="logo">${WW.icon("zap", 26)}</span><b>WattWise</b></a>
        <nav class="nav" aria-label="Main">${NAV.map(([g, items]) => (g ? `<div class="nav-group">${g}</div>` : "") + items.map(([id, label, ic]) => `<a href="${id}.html" title="${label}" class="${id === cur ? "active" : ""}" ${id === cur ? 'aria-current="page"' : ""}>${WW.icon(ic, 20)}<span>${label}</span></a>`).join("")).join("")}</nav>
      </aside>
      <div class="scrim" id="scrim"></div>
      <main class="main">
        <header class="topbar">
          <div style="display:flex;gap:12px;align-items:flex-start"><button class="menu-btn" id="menuBtn" aria-label="Open menu">${WW.icon("menu", 20)}</button>
            <div><h1 id="pgTitle">${typeof page.title === "function" ? page.title() : page.title}</h1><p id="pgSub">${typeof page.subtitle === "function" ? page.subtitle() : page.subtitle || ""}</p></div></div>
          <div class="tools">
            <div class="seg" role="group" aria-label="Data mode"><button data-m="demo" class="${mode === "demo" ? "on" : ""}">Demo</button><button data-m="live" class="${mode === "live" ? "on" : ""}">Live</button></div>
            <span class="badge ${mode}" id="modeBadge" title="${mode === "demo" ? "Simulated data — not real measurements" : "Real data from the backend / sensors"}"><span class="dot"></span>${mode === "demo" ? "Demo Data" : "Live Data"}</span>
            ${rangeSel}
            <a class="iconbtn" href="alerts.html" aria-label="Alerts" title="Alerts">${WW.icon("bell", 20)}<span class="dot" id="bellDot" style="display:none"></span></a>
            <a class="iconbtn avatar" href="settings.html" aria-label="Settings" title="Settings">${WW.icon("user", 20)}</a>
          </div>
        </header>
        ${WW.mode.get() === "live" && WW.api.isMock() ? `<div class="banner mock" id="mockBar">${WW.icon("flask-conical", 18)} <b>MOCK API</b> — Live mode is reading backend-shaped test data from the in-browser mock adapter (scenario: ${WW.api.mock.scenario()}). Not real measurements. Change it in Settings → System.</div>` : ""}
        <div id="content"></div>
      </main>
    </div>`;
    WW.$("#menuBtn").onclick = () => document.body.classList.toggle("nav-open");
    WW.$("#scrim").onclick = () => document.body.classList.remove("nav-open");
    WW.$$(".seg button").forEach((b) => (b.onclick = () => { if (b.dataset.m === WW.mode.get()) return; WW.mode.set(b.dataset.m); }));
    const rs = WW.$("#rangeSel");
    if (rs) rs.onchange = async () => {
      if (rs.value !== "custom") return WW.range.set({ key: rs.value });
      const today = new Date().toISOString().slice(0, 10), cur = WW.range.get();
      const body = document.createElement("div");
      body.innerHTML = `<div class="field"><label>From</label><input type="date" class="input" id="d1" max="${today}" value="${cur.start || today}"></div><div class="field"><label>To</label><input type="date" class="input" id="d2" max="${today}" value="${cur.end || today}"></div>`;
      const ok = await WW.modal({ title: "Custom date range", body, actions: [{ label: "Cancel", value: false }, { label: "Apply", primary: true, onClick: (bg) => { const a = WW.$("#d1", bg).value, b = WW.$("#d2", bg).value; if (!a || !b || a > b) { WW.toast("Choose a valid range (From ≤ To).", "err"); return false; } return [a, b]; } }] });
      if (ok) WW.range.set({ key: "custom", start: ok[0], end: ok[1] }); else rs.value = WW.range.get().key;
    };
  }

  async function bell() {
    try { await WW.data.getAlerts(); } catch (e) {}
    const n = WW.data.unreadCount(), d = WW.$("#bellDot"); if (d) d.style.display = n > 0 ? "block" : "none";
  }

  async function load(silent) {
    if (busy) return; busy = true;
    const root = WW.$("#content"), page = WW.page, y = window.scrollY;
    WW.charts.animate = !silent;
    if (!silent) root.innerHTML = WW.skeleton();
    try {
      const html = await page.render({ mode: WW.mode.get(), range: WW.range.get(), silent });
      WW.charts.destroyAll();
      if (typeof html === "string") root.innerHTML = html;
      if (page.after) await page.after(root);
      if (silent) window.scrollTo(0, y);
    } catch (e) { console.error(e); if (!silent) root.innerHTML = WW.errorBox(e); }
    busy = false; bell();
  }
  WW.reload = load;

  function schedule() {
    clearInterval(timer);
    timer = setInterval(() => {
      if (document.hidden || WW.$(".modal-bg") || WW.$(".menu") || ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      if (WW.page.autoRefresh !== false) load(true);
    }, WW.mode.isDemo() ? WW.config.REFRESH_MS.demo : WW.config.REFRESH_MS.live);
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-retry]")) { e.preventDefault(); load(); }
    else if (e.target.closest("[data-demo]")) { e.preventDefault(); WW.mode.set("demo"); }
  });
  document.addEventListener("ww:unauthorized", () => {
    if (/login\.html$/.test(location.pathname) || WW.mode.isDemo()) return;
    WW.toast("Please sign in to continue.", "warn"); setTimeout(() => { location.href = "login.html?next=" + encodeURIComponent(location.pathname.split("/").pop()); }, 1200);
  });
  document.addEventListener("DOMContentLoaded", () => {
    if (!WW.page) return;
    shell(WW.page); load(); schedule();
    document.addEventListener("ww:mode", (e) => { shell(WW.page); WW.toast(e.detail === "live" ? "Live mode: only real sensor data is shown. Missing data appears as “Waiting for sensor data”." : "Demo mode: simulated data. No hardware is controlled.", e.detail === "live" ? "" : "warn"); load(); schedule(); });
    document.addEventListener("ww:range", () => { shell(WW.page); load(); });
  });
})();
