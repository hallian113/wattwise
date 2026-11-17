/* M8 — Electrical safety & weather-aware response (interface only).
   Shows weather advisories, derived lightning / rainfall risk, voltage deviation, room occupancy context, the safety-mode state machine,
   load-disconnection STATUS and event history. It never switches anything: WattWise is a monitoring aid and does NOT replace breakers, fuses,
   surge/lightning protection or earthing. Demo values are labelled simulated; Live shows only what the backend reports. */
(function () {
  let W = null, OCC = null, sc = { weather: "storm", occ: "vacant" };
  const STEPS = [["Normal monitoring", "Weather and voltage within limits"], ["Advisory watch", "Advisory or risk raised — occupants notified"], ["Storm-safety mode", "Advisory + voltage deviation — precautions"], ["Recovery", "Conditions clear — user confirms before loads return"]];
  const wxIcon = (c = "") => (/thunder/i.test(c) ? "cloud-lightning" : /rain|drizzle|shower/i.test(c) ? "cloud-rain" : /sun|clear/i.test(c) ? "sun" : "wind");
  const sev = (s) => (["critical", "Severe", "Extreme"].includes(s) ? "crit" : ["warning", "Moderate", "Minor"].includes(s) ? "warn" : "info");
  function assess(w) {
    if (!w.forecast && !w.current) return { light: "Unknown", rain: "Unknown", volt: "Unknown" };
    const fc = w.forecast || [], alerts = w.providerAlerts || [], cur = (w.current && w.current.condition) || "";
    const thunder = /thunder/i.test(cur) ? 2 : fc.some((f) => /thunder/i.test(f.condition)) || alerts.some((a) => /thunder|lightning/i.test(a.event)) ? 1 : 0;
    const mm = Math.max(w.current ? w.current.precipMm || 0 : 0, ...fc.map((f) => f.precipMm || 0)), ch = Math.max(0, ...fc.map((f) => f.rainChance || 0));
    const v = w.voltage;
    return { light: ["Low", "Elevated", "High"][thunder], rain: mm >= 10 ? "High" : mm >= 2.5 || ch >= 70 ? "Moderate" : "Low", mm, ch,
      volt: !v || v.value == null ? "Unknown" : v.status === "normal" ? "Normal" : "Deviation" };
  }
  function stepIndex(w, a) {
    const m = w.response && w.response.safetyMode;
    if (m === "active" || w.state === "storm") return 2;
    if (m === "recovery") return 3;
    if (w.state === "advisory" || a.light !== "Low" && a.light !== "Unknown" || a.rain === "Moderate" || a.rain === "High") return 1;
    return w.state === "normal" ? 0 : -1;
  }
  const riskCard = (icon, label, level, note) => `<div class="risk ${level}"><div class="small">${WW.icon(icon, 16)} ${label}</div><div class="lvl">${level}</div><div class="small">${note}</div></div>`;
  const POLICY = {
    normal: { occupied: "Normal monitoring. No safety action.", vacant: "Normal monitoring. No safety action.", uncertain: "Normal monitoring. No safety action." },
    advisory: { occupied: "Advisory watch: notify occupants (dashboard / email). All loads stay available.", vacant: "Advisory watch: notify the owner. No disconnection yet.", uncertain: "Advisory watch: notify. Conservative — no automatic action while occupancy is uncertain." },
    storm: { occupied: "Storm-safety mode: alert occupants (buzzer + email) and recommend switching non-essential loads off. Essential loads stay available.", vacant: "Storm-safety mode: non-essential loads would be disconnected as a precaution; owner is emailed. No automatic reactivation.", uncertain: "Storm-safety mode: conservative default — alert, keep essential loads, ask for confirmation before disconnecting anything." } };
  const WX_NAMES = { normal: "Normal weather", advisory: "Rain / lightning advisory", storm: "Storm advisory + voltage deviation" };
  function preview() {
    const txt = POLICY[sc.weather][sc.occ], loads = W.loads || [];
    const disc = (l) => (sc.weather === "storm" && sc.occ === "vacant" && l.category === "non_essential" ? "Would be disconnected" : sc.weather === "storm" && sc.occ === "occupied" && l.category === "non_essential" ? "Recommend switching off" : sc.weather === "storm" && sc.occ === "uncertain" && l.category === "non_essential" ? "Ask for confirmation" : "Stays as is");
    return `<div class="note warn" style="margin-bottom:10px">${WW.icon("info", 16)}<span><b>Illustrative policy preview.</b> The final policy is confirmed with the supervisor and implemented in the backend; nothing is switched from this screen.</span></div>
      <div class="stack"><div class="detail-row"><span class="k">Outcome</span><span class="v" style="text-align:right;max-width:70%">${WW.esc(txt)}</span></div>
      <div class="scroll-x"><table class="tbl"><thead><tr><th>Appliance</th><th>Category</th><th>Now</th><th>Preview outcome</th></tr></thead><tbody>${loads.map((l) => `<tr><td>${WW.esc(l.appliance)} <span class="small">· ${WW.esc(l.room)}</span></td><td>${l.category === "essential" ? "Essential" : "Non-essential"}</td><td>${l.on ? "On" : "Off"}</td><td>${l.on ? disc(l) : "—"}</td></tr>`).join("")}</tbody></table></div></div>`;
  }
  function matrix() {
    const occs = ["occupied", "vacant", "uncertain"];
    return `<table class="matrix"><thead><tr><th>Weather scenario</th>${occs.map((o) => `<th>${o[0].toUpperCase() + o.slice(1)}</th>`).join("")}</tr></thead><tbody>${Object.keys(POLICY).map((w) => `<tr><th>${WX_NAMES[w]}</th>${occs.map((o) => `<td data-w="${w}" data-o="${o}" class="${sc.weather === w && sc.occ === o ? "sel" : ""}" style="cursor:pointer" tabindex="0" role="button" aria-label="Preview ${WX_NAMES[w]}, ${o}">${WW.esc(POLICY[w][o])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  WW.page = {
    title: "Weather & Safety", subtitle: "Weather-aware electrical safety status — monitoring and alerts only.", showRange: false,
    async render() {
      W = await WW.data.getWeather();
      try { OCC = await WW.data.getOccupancy(); } catch (e) { OCC = null; }
      if (!W.available) return WW.waiting(W.message || "Weather & safety data is not available", W.note || "The backend has no weather provider configured yet (API key is a backend setting).");
      const a = assess(W), idx = stepIndex(W, a), sim = WW.isSim(W), v = W.voltage, r = W.response || {}, cur = W.current;
      const sel = WW.mode.isDemo() ? `<label class="small" style="display:flex;gap:8px;align-items:center">Demo scenario <select class="select" id="wxsc">${["normal", "advisory", "storm"].map((k) => `<option value="${k}" ${W.scenario === k ? "selected" : ""}>${k}</option>`).join("")}</select></label>` : "";
      return `${sim ? `<div class="banner sim">${WW.icon("flask-conical", 18)} <b>SIMULATED</b> — ${WW.esc(W.note || "Weather and voltage are simulated for interface testing.")}<span class="grow" style="flex:1"></span>${sel}</div>` : `<div class="banner live">${WW.icon("radio-tower", 18)} <b>LIVE</b> — ${WW.esc(W.location || "")}. Weather from the backend’s provider${W.updatedAt ? ", updated " + WW.fmt.when(W.updatedAt) : ""}.</div>`}
      <div class="card"><div class="card-h"><span class="hicon">${WW.icon("shield-check", 20)}</span><h3>Safety state</h3><span class="grow"></span>${WW.pill(W.state === "unknown" ? "unknown" : W.state, sev(W.state === "storm" ? "critical" : W.state === "advisory" ? "warning" : "x"))}</div>
        <div class="stepper">${STEPS.map(([t, s], i) => `<div class="step ${i === idx ? "on " + (i === 2 ? "crit" : i === 1 ? "warn" : "") : ""}"><b>${t}</b><span>${s}</span></div>`).join("")}</div>
        ${idx < 0 ? WW.estimateNote("State is unknown because the backend has not reported weather or safety data.") : ""}</div>
      <div class="grid g3 mt">
        ${riskCard("cloud-lightning", "Lightning risk", a.light, "From advisories & forecast — an indicator, not a measurement")}
        ${riskCard("cloud-rain", "Severe rainfall risk", a.rain, a.mm != null ? `Up to ${a.mm} mm · chance ${a.ch}%` : "No forecast")}
        ${riskCard("zap", "Voltage deviation", a.volt, v && v.value != null ? `${v.value} V (limits ${v.minimum}–${v.maximum} V)${sim ? " · simulated" : ""}` : "No voltage reading")}
      </div>
      <div class="grid g-wide mt">
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon(wxIcon(cur && cur.condition), 20)}</span><h3>Weather — ${WW.esc(W.location || WW.config.LOCATION_LABEL)}</h3></div>
          ${cur ? `<div class="grid g4"><div class="reading"><div class="lbl">Condition</div><div class="val" style="font-size:16px">${WW.esc(cur.condition)}</div></div><div class="reading"><div class="lbl">Temperature</div><div class="val">${WW.fmt.temp(cur.temperatureC)}</div></div><div class="reading"><div class="lbl">Humidity</div><div class="val">${cur.humidity}<small>%</small></div></div><div class="reading"><div class="lbl">Wind</div><div class="val">${cur.windKph}<small> km/h</small></div></div></div>` : WW.emptyState("No current weather", "")}
          ${(W.forecast || []).length ? `<div class="chart-box mt"><canvas id="wxf"></canvas></div>` : ""}
          ${(W.providerAlerts || []).map((p) => `<div class="note warn mt-s">${WW.icon("triangle-alert", 16)}<span><b>${WW.esc(p.event)}</b> (${WW.esc(p.severity)}) — ${WW.esc(p.headline || "")}</span></div>`).join("")}</div>
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon("zap", 20)}</span><h3>Voltage monitoring</h3><span class="grow"></span>${v ? WW.pill(v.status, v.status === "normal" ? "ok" : "crit") : ""}</div>
          ${(W.voltageHistory || []).length ? `<div class="chart-box sm"><canvas id="wxv"></canvas></div>` : WW.emptyState("No voltage history", "Real voltage comes from the PZEM-004T meters. Nothing is simulated in Live mode.", "zap")}
          <div class="small mt-s">${sim ? "Simulated voltage." : "Measured by the PZEM-004T."} Nominal ${v ? v.nominal || 220 : 220} V; deviation limits ${v ? v.minimum + "–" + v.maximum : "—"} V.</div></div>
      </div>
      <div class="card mt"><div class="card-h"><span class="hicon">${WW.icon("eye", 20)}</span><h3>Room occupancy context</h3></div>
        ${OCC && OCC.available ? `<div class="chips">${OCC.rooms.map((x) => `<span class="pill state-${x.state}"><span class="dot"></span>${WW.esc(x.name)}: ${x.state}</span>`).join("")}</div><div class="small mt-s">The safety policy depends on whether rooms are occupied, vacant or uncertain.</div>` : WW.emptyState("Occupancy not available", "The occupancy endpoint has not returned data yet.", "eye")}</div>
      <div class="card mt"><div class="card-h"><span class="hicon">${WW.icon("list-checks", 20)}</span><h3>Weather-aware safety scenarios</h3></div>${matrix()}<div class="mt" id="pv">${preview()}</div></div>
      <div class="card mt"><div class="card-h"><span class="hicon">${WW.icon("power", 20)}</span><h3>Non-essential load disconnection — status</h3></div>
        <div class="grid g3"><div class="reading"><div class="lbl">Safety mode</div><div class="val" style="font-size:16px">${WW.esc(r.safetyMode || "unknown")}</div></div><div class="reading"><div class="lbl">Buzzer / email alerts</div><div class="val" style="font-size:16px">${WW.esc(r.buzzer || "unknown")} / ${WW.esc(r.email || "unknown")}</div></div><div class="reading"><div class="lbl">Automatic disconnection</div><div class="val" style="font-size:16px">${r.automaticDisconnect === "active" ? "Active" : r.automaticDisconnect === "preview_only" ? "Preview only" : "Not connected"}</div></div></div>
        ${(W.loads || []).length ? `<div class="scroll-x mt"><table class="tbl"><thead><tr><th>Appliance</th><th>Category</th><th>State</th><th>Disconnect status</th></tr></thead><tbody>${W.loads.map((l) => `<tr><td>${WW.esc(l.appliance)} <span class="small">· ${WW.esc(l.room)}</span></td><td>${l.category === "essential" ? "Essential" : "Non-essential"}</td><td>${l.on ? "On" : "Off"}</td><td>${WW.pill(l.disconnectStatus === "disconnected" ? "disconnected" : "not connected", l.disconnectStatus === "disconnected" ? "crit" : "grey")}</td></tr>`).join("")}</tbody></table></div>` : ""}
        ${WW.estimateNote("Automatic disconnection is an interface only: no hardware is switched here. Essential / non-essential classes are configured in the backend.")}</div>
      <div class="card mt"><div class="card-h"><span class="hicon">${WW.icon("history", 20)}</span><h3>Alert & event history</h3><span class="grow"></span><a class="btn ghost sm" href="alerts.html">${WW.icon("bell", 14)} All alerts</a></div>
        ${(W.eventHistory || []).length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Time</th><th>Type</th><th>Event</th><th>Severity</th></tr></thead><tbody>${W.eventHistory.map((e) => `<tr><td>${WW.fmt.when(e.time)}</td><td>${WW.esc(e.type)}</td><td>${WW.esc(e.message)}</td><td>${WW.pill(e.severity, sev(e.severity))}</td></tr>`).join("")}</tbody></table></div>` : WW.emptyState("No safety events", "No advisories or voltage deviations have been recorded.", "circle-check")}</div>
      <div class="note warn mt">${WW.icon("shield", 16)}<span><b>Important:</b> WattWise is a monitoring and alerting aid. It does not provide physical lightning protection and does not replace circuit breakers, fuses, surge protection or earthing, which must be installed and checked by a qualified electrician.</span></div>`;
    },
    after(root) {
      if (!W || !W.available) return;
      if (W.forecast && W.forecast.length) WW.charts.combo("wxf", W.forecast.map((f) => new Date(f.time).toLocaleTimeString("en-US", { hour: "numeric" })), W.forecast.map((f) => f.precipMm), W.forecast.map((f) => f.rainChance), { barLabel: "Rain (mm)", lineLabel: "Chance of rain (%)", lineMax: 100, lineStep: 25, stepped: false });
      if (W.voltageHistory && W.voltageHistory.length) { const h = W.voltageHistory, v = W.voltage || {};
        WW.charts.make("wxv", { type: "line", data: { labels: h.map((x) => new Date(x.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })), datasets: [
          { label: "Voltage (V)", data: h.map((x) => x.value), borderColor: "#315D3A", borderWidth: 3, pointRadius: 0, tension: .3 },
          { label: "Upper limit", data: h.map(() => v.maximum), borderColor: "#B8433A", borderDash: [5, 5], pointRadius: 0, borderWidth: 1.5 }, { label: "Lower limit", data: h.map(() => v.minimum), borderColor: "#B8433A", borderDash: [5, 5], pointRadius: 0, borderWidth: 1.5 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, labels: { usePointStyle: true, boxWidth: 8 } } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0 } }, y: { title: { display: true, text: "Volts" } } } } }); }
      const s = WW.$("#wxsc", root); if (s) s.onchange = async () => { await WW.demo.setWeatherScenario(s.value); WW.reload(); };
      const pick = (el) => { sc = { weather: el.dataset.w, occ: el.dataset.o }; WW.$$(".matrix td", root).forEach((c) => c.classList.toggle("sel", c === el)); WW.$("#pv", root).innerHTML = preview(); };
      WW.$$(".matrix td", root).forEach((td) => { td.onclick = () => pick(td); td.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(td); } }; });
    },
  };
})();
