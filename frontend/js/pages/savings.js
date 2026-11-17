/* Savings: how much energy and money WattWise has actually saved.
   Three kinds of numbers are kept strictly apart:  VERIFIED (baseline vs optimized days)  /  ESTIMATED (automation log model)  /  POTENTIAL (waste not yet saved). */
(function () {
  let D = null, gran = sessionStorage.getItem("ww_sv_gran") || "daily";
  const tag = (k) => (k === "verified" && D && WW.isSim(D) ? `<span class="tag estimated" title="Demo / mock data: nothing here is a measured saving">simulated</span>` : `<span class="tag ${k}">${k}</span>`);
  const signed = (v, f) => (v == null ? "—" : `${v < 0 ? "−" : ""}${f(Math.abs(v))}`);
  const kpi = (icon, label, big, sub, t) => `<div class="card kpi-card"><div style="display:flex;align-items:center;gap:8px 12px;flex-wrap:wrap"><span class="hicon">${WW.icon(icon, 20)}</span><span class="muted" style="flex:1;min-width:110px">${label}</span>${t ? tag(t) : ""}</div><div class="big">${big}</div><div class="sub">${sub}</div></div>`;
  function evalCard(e, demo) {
    return `<section class="card mt"><div class="card-h"><span class="hicon">${WW.icon("calendar-check", 20)}</span><h3>Evaluation days (how the baseline is built)</h3></div>
      <p class="muted" style="margin-top:0">Verified savings compare days with automation <b>OFF</b> (baseline) against days with automation <b>ON</b> (optimized), using metered energy. At least ${e.minEach} usable days of each are needed, each with ≥ ${e.minHours} hours of data.</p>
      <div class="grid g3" style="gap:16px"><div><div class="muted small">Baseline days (usable / tagged)</div><b style="font-size:20px">${e.usableBaseline} / ${e.baseline}</b></div><div><div class="muted small">Optimized days (usable / tagged)</div><b style="font-size:20px">${e.usableOptimized} / ${e.optimized}</b></div>
        <div><div class="muted small">Today</div><b style="font-size:20px">${e.todayTag ? e.todayTag : "untagged"}</b></div></div>
      ${demo ? `<div class="note mt">${WW.icon("info", 16)}<span>Demo: the last 28 days are simulated as alternating baseline / optimized days. In Live mode you tag days yourself.</span></div>` : `
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:16px"><input type="date" class="input" id="tagDay" max="${new Date().toISOString().slice(0, 10)}" value="${new Date().toISOString().slice(0, 10)}" aria-label="Day to tag">
        <select class="select" id="tagMode" aria-label="Day type"><option value="baseline">Baseline (automation OFF)</option><option value="optimized">Optimized (automation ON)</option><option value="">Clear tag</option></select><button class="btn" id="tagBtn">Save tag</button></div>`}</section>`;
  }
  WW.page = {
    title: "Savings", subtitle: "How much energy and money WattWise has saved — verified, estimated and potential.", showRange: false,
    async render() {
      D = await WW.data.getSavings();
      if (!D.available) return WW.waiting(D.message);
      const v = D.verified, demo = WW.isSim(D), ok = v.status === "ok", f = WW.fmt;
      const banner = demo ? `<div class="banner demo">${WW.icon("info", 18)} <b>DEMO DATA</b> — simulated baseline and optimized days. These are not real savings.</div>` : "";
      const head = ok ? `
        <div class="grid g4">${kpi("zap", "Total Energy Saved", signed(v.savedKwh, (x) => f.kwh(x, 1)), `vs baseline ${f.kwh(v.baselineAvgDaily, 1)}/day · over ${v.optimizedDays} optimized days`, "verified")}
          ${kpi("coins", "Total Money Saved", signed(v.savedPkr, f.pkr), `at Rs. ${D.rate.toFixed(2)}/unit (estimate rate)`, "verified")}
          ${kpi("trending-up", "Energy Efficiency Improvement", v.pct == null ? "—" : `${v.pct < 0 ? "−" : ""}${Math.abs(v.pct)}%`, "saved ÷ baseline consumption", "verified")}
          ${kpi("calendar", "Savings This Month", signed(v.thisMonthPkr, f.pkr), `${signed(v.thisMonthKwh, (x) => f.kwh(x, 1))} this calendar month`, "verified")}</div>
        ${v.negative ? `<div class="banner warn mt">${WW.icon("triangle-alert", 18)} Net savings are <b>negative</b>: optimized days used more energy than baseline days. Shown honestly — check whether the days are comparable.</div>` : ""}
        <div class="note mt">${WW.icon("info", 16)}<span>Verified savings are <b>net of WattWise's own consumption</b> (≈ ${D.ownConsumptionKwhPerDay} kWh/day). ${v.occupancy && v.occupancy.comparable === false ? `<b>Occupancy differed by more than 25% between the two groups</b> (${v.occupancy.baselineRoomHours} vs ${v.occupancy.optimizedRoomHours} occupied room-hours/day), so treat this comparison with care.` : v.occupancy && v.occupancy.comparable ? `Occupancy was comparable (${v.occupancy.baselineRoomHours} vs ${v.occupancy.optimizedRoomHours} occupied room-hours/day).` : ""} Weather is not normalised.</span></div>`
        : `<section class="card"><div class="waiting" style="padding:30px 10px"><div class="hicon">${WW.icon("scale", 30)}</div><h3>${WW.esc(v.message)}</h3><ul class="checklist" style="text-align:left;max-width:560px">${v.requirements.map((r) => `<li>${WW.esc(r)}</li>`).join("")}</ul></div></section>`;
      const three = `<div class="grid g3 mt">
        <div class="card kpi-card">${tag("verified")}<div class="sub"><b style="color:var(--text)">${demo ? "Simulated" : "Verified"}</b> — baseline vs optimized days ${demo ? "from simulated days (nothing measured)." : "from real metered data."} ${ok ? `<b style="color:var(--text)">${signed(v.savedKwh, (x) => f.kwh(x, 1))}</b> saved.` : "Not available yet."}</div></div>
        <div class="card kpi-card">${tag("estimated")}<div class="big">${f.kwh(D.estimated.kwh, 2)}</div><div class="sub"><b style="color:var(--text)">${D.estimated.actions}</b> automatic switch-offs in 30 days ≈ ${f.pkr(D.estimated.pkr)}. ${WW.esc(D.estimated.assumption)}</div></div>
        <div class="card kpi-card">${tag("potential")}<div class="big">${f.kwh(D.potential.kwhMonth, 1)}<span class="muted" style="font-size:.5em"> / month</span></div><div class="sub">≈ ${f.pkr(D.potential.pkrMonth)} / month. ${WW.esc(D.potential.basis)}</div></div></div>`;
      const body = ok ? `
      <div class="grid g-wide mt">
        <section class="card"><div class="card-h"><span class="hicon">${WW.icon("scale", 20)}</span><h3>Baseline vs Optimized Consumption</h3><span class="grow"></span><div class="seg-tabs" role="tablist">${["daily", "weekly", "monthly"].map((g) => `<button class="${gran === g ? "on" : ""}" data-g="${g}" role="tab">${g[0].toUpperCase() + g.slice(1)}</button>`).join("")}</div></div>
          <div class="chart-box"><canvas id="cmp" role="img" aria-label="Baseline versus optimized consumption"></canvas></div><div class="small muted mt">Average kWh per day in each period. Gaps mean no day of that type fell in the period.</div></section>
        <section class="card"><div class="card-h"><span class="hicon">${WW.icon("coins", 20)}</span><h3>Financial Savings Trend</h3></div><div class="chart-box"><canvas id="fin" role="img" aria-label="Monthly savings in PKR"></canvas></div><div class="small muted mt">Verified savings per month in PKR (negative months are shown in red).</div></section></div>
      <div class="grid g-wide mt">
        <section class="card"><div class="card-h"><span class="hicon">${WW.icon("plug", 20)}</span><h3>Appliance-wise Savings</h3></div>
          <div class="scroll-x"><table class="tbl"><thead><tr><th>Appliance</th><th>Baseline (kWh/day)</th><th>Optimized (kWh/day)</th><th>Energy saved (kWh)</th><th>Money saved</th></tr></thead><tbody>
          ${D.appliances.map((a) => `<tr><td>${WW.esc(a.name)}</td><td>${a.baseline.toFixed(2)}</td><td>${a.optimized.toFixed(2)}</td><td style="color:${a.savedKwh < 0 ? "var(--crit)" : "var(--forest)"};font-weight:700">${signed(a.savedKwh, (x) => x.toFixed(2))}${a.pct != null ? ` <span class="muted small">(${a.pct}%)</span>` : ""}</td><td>${signed(a.savedPkr, f.pkr)}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">No appliance-level meter data.</td></tr>`}</tbody></table></div></section>
        <section class="card"><div class="card-h"><span class="hicon">${WW.icon("trending-up", 20)}</span><h3>Energy Efficiency Improvement</h3></div>
          <div class="grid g2" style="gap:12px"><div><div class="muted small">Baseline</div><b style="font-size:20px">${f.kwh(D.efficiency.baselineAvg, 1)}/day</b></div><div><div class="muted small">Optimized</div><b style="font-size:20px">${f.kwh(D.efficiency.optimizedAvg, 1)}/day</b></div></div>
          <div style="font-size:34px;font-weight:800;color:${(D.efficiency.pct || 0) < 0 ? "var(--crit)" : "var(--forest-d)"};margin:10px 0">${D.efficiency.pct == null ? "—" : `${D.efficiency.pct < 0 ? "−" : ""}${Math.abs(D.efficiency.pct)}%`} <span class="muted" style="font-size:14px;font-weight:500">improvement</span></div>
          ${D.efficiency.history.length > 1 ? `<div class="chart-box sm"><canvas id="eff" role="img" aria-label="Efficiency by month"></canvas></div>` : `<p class="small muted">Historical performance appears once two months have data.</p>`}</section></div>` : "";
      const recs = `<section class="card mt"><div class="card-h"><span class="hicon">${WW.icon("sparkles", 20)}</span><h3>AI Recommendations</h3><span class="grow"></span>${tag("potential")}</div>
        ${D.recommendations.length ? D.recommendations.map((r) => `<div class="rec"><h4>${WW.esc(r.title)}</h4><dl><dt>What</dt><dd>${WW.esc(r.what)}</dd><dt>Why</dt><dd>${WW.esc(r.why)}</dd><dt>Action</dt><dd>${WW.esc(r.action)}</dd>
          <dt>Potential</dt><dd><b>${r.potentialKwh != null ? `up to ${f.kwh(r.potentialKwh, 1)}/month` : "energy is moved, not reduced"}${r.potentialPkr != null ? ` · ≈ ${f.pkr(r.potentialPkr)}/month` : ""}</b> <span class="muted small">— ${WW.esc(r.basis)}</span></dd></dl></div>`).join("") : `<p class="muted" style="margin:0">No wasteful patterns found in the data so far. Recommendations appear only when the data supports them.</p>`}</section>`;
      const method = `<div class="note mt">${WW.icon("info", 16)}<span><b>Method.</b> Energy Saved = Baseline − Optimized · Savings % = Saved ÷ Baseline × 100 · Money = Saved × tariff rate. Estimated and potential figures are never added to verified savings.</span></div>`;
      return `${banner}${head}${three}${evalCard(D.evaluation, demo)}${body}${recs}${method}`;
    },
    after() {
      if (!D || !D.available) return;
      WW.$$("[data-g]").forEach((b) => (b.onclick = () => { gran = b.dataset.g; sessionStorage.setItem("ww_sv_gran", gran); WW.reload(true); }));
      const tb = WW.$("#tagBtn"); if (tb) tb.onclick = async () => { try { await WW.data.tagDay(WW.$("#tagDay").value, WW.$("#tagMode").value || null); WW.toast("Day tag saved"); WW.reload(true); } catch (e) { WW.toast(e.message, "err"); } };
      if (D.verified.status !== "ok") return;
      const c = D.compare[gran]; WW.charts.grouped("cmp", c.labels, [{ label: "Baseline (automation OFF)", data: c.baseline, color: "#B8CCB0" }, { label: "Optimized (automation ON)", data: c.optimized, color: "#315D3A" }]);
      WW.charts.bar("fin", D.monthly.map((m) => m.label), D.monthly.map((m) => m.pkr), { unit: "PKR", yTitle: "Saved (PKR)" });
      if (WW.$("#eff")) WW.charts.line("eff", D.efficiency.history.map((h) => h.label), D.efficiency.history.map((h) => h.pct), { unit: "%", yTitle: "Improvement (%)" });
    },
  };
})();
