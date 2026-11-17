/* Dashboard: HOME-LEVEL overview only (no individual appliance controls here).
   Spacious layout: Energy Overview (3 equal columns) / Status + Tariff / Trend + Alerts / Key Insights. */
(function () {
  let D = null, trend = null;
  const arrow = (p) => (p == null ? "" : `<div class="sub ${p >= 0 ? "down" : "up"}">${p >= 0 ? "↑" : "↓"} ${Math.abs(p)}% vs. yesterday</div>`);
  const rangeName = { today: "Today", yesterday: "Yesterday", "7d": "Last 7 days", "30d": "Last 30 days", custom: "Custom" };

  function overview(m) {
    const cls = m.pct >= 100 ? "crit" : m.pct >= 90 ? "warn" : "";
    return `<section class="card"><div class="card-h"><span class="hicon">${WW.icon("layers", 20)}</span><h3>Energy Overview</h3></div>
      <div class="kpis">
        <div class="kpi"><div class="top"><span class="hicon">${WW.icon("zap", 20)}</span><span class="lbl">Total Consumption</span></div><div class="val">${WW.fmt.kwh(D.totals.kwh)}</div>${arrow(D.totals.vsYesterdayPct) || '<div class="sub muted">today so far</div>'}</div>
        <div class="kpi"><div class="top"><span class="hicon">${WW.icon("coins", 20)}</span><span class="lbl">Estimated Cost</span></div><div class="val">${WW.fmt.pkr(D.totals.cost)}</div><div class="sub muted">estimate</div></div>
        <div class="kpi"><div class="top"><span class="hicon">${WW.icon("calendar", 20)}</span><span class="lbl">Monthly Consumption</span></div>
          <div class="val">${Math.round(m.units)} <span class="of">/ ${m.limit} units</span></div>
          <div class="bar ${cls}" role="progressbar" aria-valuenow="${Math.min(100, m.pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Monthly units used"><i style="width:${Math.min(100, m.pct)}%"></i></div>
          <div class="meta"><span>${m.pct}% used</span><span>${m.remaining} units remaining</span></div></div>
      </div>
      <div class="highlight mt"><span class="hicon" style="background:var(--card)">${WW.icon("wallet", 20)}</span><span>Estimated Bill (This Month) <span class="muted small">— estimate, not an official bill</span></span><span class="big">${WW.fmt.pkr(m.estBill)}</span></div></section>`;
  }
  function status() {
    const lv = { normal: "check", warning: "triangle-alert", critical: "circle-x" }[D.status.level];
    const bg = D.status.level === "normal" ? "var(--forest)" : D.status.level === "warning" ? "var(--warn)" : "var(--crit)";
    return `<section class="card"><div class="card-h"><span class="hicon">${WW.icon("house", 20)}</span><h3>Home Status &amp; Room Consumption</h3></div>
      <div style="display:flex;gap:16px;align-items:center;padding-bottom:18px;border-bottom:1px solid var(--line);margin-bottom:18px;flex-wrap:wrap">
        <span class="hicon" style="width:52px;height:52px;border-radius:50%;background:${bg};color:#fff">${WW.icon(lv, 26)}</span>
        <div><div class="muted small">Home Status</div><div style="font-size:22px;font-weight:800">${D.status.title}</div></div><div class="muted" style="margin-left:auto;text-align:right;min-width:150px">${WW.esc(D.status.message)}</div></div>
      <div class="muted small" style="margin-bottom:12px">Room Consumption (Today)</div>
      <div class="grid g3" style="gap:16px">${D.rooms.map((r) => `<div style="display:flex;gap:10px;align-items:center;min-width:0"><span class="hicon">${WW.icon(WW.roomIcon(r.id), 20)}</span><div style="min-width:0"><div class="muted small">${r.name}</div><div style="font-weight:800;font-size:17px;white-space:nowrap">${WW.fmt.kwh(r.kwh)}</div></div></div>`).join("")}</div></section>`;
  }
  function tariff(m) {
    return `<section class="card"><div class="card-h"><span class="hicon">${WW.icon("file-text", 20)}</span><h3>Tariff &amp; Bill Summary</h3></div>
      <div class="grid g2" style="gap:24px">
        <div style="min-width:0"><div class="muted small">Current Category</div><div style="font-size:20px;font-weight:800">${D.tariff.category}</div>
          <div class="muted small mt">Tariff Slab (Residential)</div><div style="font-weight:800;font-size:17px">${WW.esc(D.tariff.slabLabel)}</div><div class="muted small">(${WW.esc(D.tariff.rateText)})</div></div>
        <div style="border-left:1px solid var(--line);padding-left:24px;min-width:0"><div class="muted small">Units remaining to ${m.limit}</div><div style="font-size:22px;font-weight:800">${D.tariff.remaining} units</div>
          <div class="muted small mt">Projected Bill (Month End)</div><div style="font-size:22px;font-weight:800">≈ ${WW.fmt.pkr(D.tariff.projectedBill)}</div><div class="muted small">≈ ${Math.round(m.projectedUnits)} units (${Math.round(m.projectedLow)}–${Math.round(m.projectedHigh)})</div></div></div>
      <div class="note mt">${WW.icon("info", 16)}<span>${D.tariff.assumptions.map(WW.esc).join(" ")}${D.tariff.example ? " <b>Example tariff rates — edit them from your bill in Settings.</b>" : ""}</span></div></section>`;
  }
  function trendCard(range) {
    return `<section class="card"><div class="card-h"><span class="hicon">${WW.icon("chart-column", 20)}</span><h3>Energy Consumption Trend</h3><span class="grow"></span><span class="pill grey">${rangeName[range.key] || "Today"}</span></div>
      <div class="chart-box"><canvas id="trend" role="img" aria-label="Energy consumption trend"></canvas></div></section>`;
  }
  /* compact M8 + M3 summary cards; each fails soft so a missing backend endpoint never breaks the dashboard */
  function safetyCard(W) {
    const body = !W || !W.available ? `<p class="small" style="margin:0">${WW.esc(W && W.message ? W.message : "Weather & safety data is not available yet.")}</p>`
      : `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="pill ${W.state === "storm" ? "crit" : W.state === "advisory" ? "warn" : "ok"}">${W.state === "storm" ? "Storm-safety mode" : W.state === "advisory" ? "Advisory watch" : W.state === "normal" ? "Normal monitoring" : "Unknown"}</span>${WW.isSim(W) ? WW.pill("simulated", "warn") : ""}</div>
        ${W.current ? `<div style="margin-top:10px"><b style="font-size:20px">${WW.fmt.temp(W.current.temperatureC)}</b> <span class="muted">${WW.esc(W.current.condition)} · ${WW.esc(W.location || "")}</span></div>` : ""}
        ${W.voltage && W.voltage.value != null ? `<div class="small mt-s">Voltage ${W.voltage.value} V · ${WW.esc(W.voltage.status)}${WW.isSim(W) ? " (simulated)" : ""}</div>` : ""}`;
    return `<section class="card"><div class="card-h"><span class="hicon">${WW.icon("cloud-lightning", 20)}</span><h3>Weather & Safety</h3><span class="grow"></span><a class="link" href="weather.html">Details ${WW.icon("arrow-right", 14)}</a></div>${body}</section>`;
  }
  function occCard(O) {
    const body = !O || !O.available ? `<p class="small" style="margin:0">Occupancy data is not available yet.</p>` : `<div class="chips">${O.rooms.map((r) => `<span class="pill state-${r.state}"><span class="dot"></span>${WW.esc(r.name)}: ${r.state}</span>`).join("")}</div>${WW.isSim(O) ? `<div class="small mt-s">Simulated presence.</div>` : ""}`;
    return `<section class="card"><div class="card-h"><span class="hicon">${WW.icon("eye", 20)}</span><h3>Room Occupancy</h3><span class="grow"></span><a class="link" href="occupancy.html">Details ${WW.icon("arrow-right", 14)}</a></div>${body}</section>`;
  }
  function alerts() {
    return `<section class="card"><div class="card-h"><span class="hicon">${WW.icon("bell", 20)}</span><h3>Alerts</h3><span class="grow"></span><a class="link" href="alerts.html">View All ${WW.icon("arrow-right", 16)}</a></div>
      ${D.alerts.length ? D.alerts.map((a) => `<a href="alerts.html" class="row-item ${a.severity === "critical" ? "crit" : "warn"}" style="text-decoration:none;color:inherit"><span style="color:var(--warn)">${WW.icon(a.category === "usage" ? "trending-up" : "triangle-alert", 26)}</span><div class="grow"><div class="t">${WW.esc(a.title)}</div><div class="d">${WW.esc(a.message)}</div></div>${WW.icon("chevron-right", 18)}</a>`).join("") : `<p class="muted">No active alerts. Everything looks normal.</p>`}</section>`;
  }
  function insights() {
    const i = D.insights;
    return `<section class="card"><div class="card-h"><span class="hicon">${WW.icon("chart-column", 20)}</span><h3>Key Insights</h3></div>
      <div class="grid g3" style="gap:0">
        <div style="padding-right:24px;min-width:0"><span class="hicon sm">${WW.icon("leaf", 16)}</span><div class="muted small mt">Top Consuming Appliance</div>${i.top ? `<div style="font-weight:800;font-size:17px">${WW.esc(i.top.name)}</div><div class="small">${WW.fmt.kwh(i.top.kwh)} (${i.top.pct}% of total)</div>` : `<div class="muted">No appliance data yet</div>`}</div>
        <div style="padding:0 24px;border-left:1px solid var(--line);min-width:0"><span class="hicon sm">${WW.icon("percent", 16)}</span><div class="muted small mt">Usage vs. Usual</div>${i.vsUsualPct != null ? `<div style="font-weight:800;font-size:24px;color:${i.vsUsualPct > 0 ? "var(--warn)" : "var(--forest)"}">${WW.fmt.pct(i.vsUsualPct)}</div><div class="small">${i.vsUsualPct > 0 ? "higher" : "lower"} than usual (${i.usual} kWh)</div>` : `<div class="muted">Needs a few days of history</div>`}</div>
        <div style="padding-left:24px;border-left:1px solid var(--line);min-width:0"><span class="hicon sm">${WW.icon("leaf", 16)}</span><div class="muted small mt">Potential Savings <span class="tag potential">potential</span></div>${i.savings ? `<div style="font-weight:800;font-size:22px">≈ ${WW.fmt.pkr(i.savings)}</div><div class="small">per month by cutting waste</div>` : `<div class="muted">Not enough data</div>`}<a class="link small" href="savings.html" style="margin-top:6px">See Savings ${WW.icon("arrow-right", 14)}</a></div>
      </div><div class="small muted mt">${WW.esc(i.savingsNote || "")}</div></section>`;
  }

  WW.page = {
    title: () => `${WW.greeting()}!`, subtitle: "Here's your home's energy overview.",
    async render({ range }) {
      D = await WW.data.getDashboard();
      if (!D.available) return WW.waiting(D.message);
      trend = D.trend;
      if (range.key !== "today") { const a = await WW.data.getAnalytics(range); if (a.available) trend = a.trend; }
      const m = D.month;
      const [W, O] = await Promise.all([WW.data.getWeather().catch(() => null), WW.data.getOccupancy().catch(() => null)]);
      const stale = D.freshness && D.freshness.stale ? `<div class="banner warn">${WW.icon("triangle-alert", 18)} Last sensor reading was ${WW.fmt.when(D.freshness.lastReadingAt)} — sensors may be offline.</div>` : "";
      const banner = WW.isSim(D) ? `<div class="banner demo">${WW.icon("info", 18)} <b>DEMO DATA</b> — simulated readings for presentation. Not real measurements.</div>` : "";
      return `${banner}${stale}${overview(m)}
        <div class="grid g2 mt">${status()}${tariff(m)}</div>
        <div class="grid g-wide mt">${trendCard(range)}${alerts()}</div>
        <div class="grid g2 mt">${safetyCard(W)}${occCard(O)}</div>
        <div class="mt">${insights()}</div>`;
    },
    after() { if (trend && WW.$("#trend")) WW.charts.line("trend", trend.labels, trend.values); },
  };
})();
