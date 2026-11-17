/* Energy Analytics: trends, room/appliance comparison, peak usage, forecast, history. Respects range + Demo/Live mode. */
(function () {
  let COST = null, D = null, H = null;

  /* ---- M9: cost & tariff analytics in PKR ---- */
  function costSection() {
    const C = COST;
    if (!C || !C.available) return `<section class="card mt"><div class="card-h"><span class="hicon">${WW.icon("coins", 20)}</span><h3>Cost & Tariff (PKR)</h3></div>${C && C.error ? WW.errorBox(C.error) : WW.emptyState("Cost analytics not available", (C && C.message) || "The backend has no cost data yet.", "coins")}</section>`;
    const pk = C.peak, sl = C.slabs, pr = C.projection, cm = (a) => a.map((x) => `<tr><td>${WW.esc(x.name)}${x.room ? ` <span class="small">· ${WW.esc(x.room)}</span>` : ""}</td><td>${WW.fmt.kwh(x.kwh, 2)}</td><td><b>${WW.fmt.pkr(x.cost)}</b></td><td>${x.pct}%</td></tr>`).join("");
    return `<div class="mt" id="costsec"><h2 style="font-size:20px;margin:6px 0 12px">Cost & Tariff (PKR) ${WW.pill("estimate", "warn")}</h2>
      <div class="grid g4">
        <div class="card statcard"><span class="hicon">${WW.icon("coins", 20)}</span><div><div class="lbl">Marginal rate now</div><div class="val">Rs. ${C.rate.marginal.toFixed(2)}</div><div class="small muted">per unit · ${WW.esc(C.rate.slabLabel)}</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("wallet", 20)}</span><div><div class="lbl">Bill so far</div><div class="val">${WW.fmt.pkr(pr.billSoFar)}</div><div class="small muted">estimate, not an official bill</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("calendar", 20)}</span><div><div class="lbl">Projected month-end</div><div class="val">${WW.fmt.pkr(pr.projectedBill)}</div><div class="small muted">≈ ${WW.fmt.num(pr.projectedUnits, 0)} units (${WW.fmt.num(pr.low, 0)}–${WW.fmt.num(pr.high, 0)})</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("target", 20)}</span><div><div class="lbl">Units left to ${sl.limit}</div><div class="val">${WW.fmt.num(sl.unitsLeft, 1)}</div><div class="small muted">${pr.aboveLimit ? "projection exceeds the limit" : "within the limit"}</div></div></div>
      </div>
      <div class="grid g2 mt">
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon("plug", 20)}</span><h3>Appliance-wise cost</h3></div><div class="scroll-x"><table class="tbl"><thead><tr><th>Appliance</th><th>Energy</th><th>Cost</th><th>Share</th></tr></thead><tbody>${cm(C.byAppliance.filter((x) => x.kwh > 0).slice(0, 8)) || `<tr><td colspan="4" class="small">No consumption in this period.</td></tr>`}</tbody></table></div></div>
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon("layout-grid", 20)}</span><h3>Room-wise cost</h3></div><div class="scroll-x"><table class="tbl"><thead><tr><th>Room</th><th>Energy</th><th>Cost</th><th>Share</th></tr></thead><tbody>${cm(C.byRoom)}</tbody></table></div><div class="small mt-s">${WW.esc(C.method)}</div></div>
      </div>
      <div class="grid g2 mt">
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon("receipt", 20)}</span><h3>Tariff & slabs — ${WW.esc(sl.category)}${sl.example ? " (example rates)" : ""}</h3></div>
          <div class="scroll-x"><table class="tbl"><thead><tr><th>Slab (units)</th><th>Rate / unit</th><th>Status</th></tr></thead><tbody>${sl.table.map((t) => `<tr><td>${t.from} – ${t.to == null ? "+" : t.to}</td><td>Rs. ${t.rate.toFixed(2)}</td><td>${t.state === "current" ? WW.pill("you are here", "warn") : t.state === "used" ? WW.pill("passed", "grey") : WW.pill("ahead", "grey")}</td></tr>`).join("")}</tbody></table></div>
          <div class="small mt-s">${WW.fmt.num(sl.monthUnits, 1)} units used this billing period. ${sl.example ? "These are example rates — enter the rates from your own bill in Settings → Tariff & Billing." : ""}</div></div>
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon("clock", 20)}</span><h3>Peak vs off-peak cost <span class="small">(${WW.esc(pk.window)})</span></h3></div>
          <div class="grid g2"><div class="reading"><div class="lbl">Peak</div><div class="val">${WW.fmt.pkr(pk.peakCost)}</div><div class="small">${WW.fmt.kwh(pk.peakKwh, 2)} · ${pk.peakPct}% of energy</div></div><div class="reading"><div class="lbl">Off-peak</div><div class="val">${WW.fmt.pkr(pk.offCost)}</div><div class="small">${WW.fmt.kwh(pk.offKwh, 2)}</div></div></div>
          ${WW.estimateNote(pk.note)}</div>
      </div>
      <div class="card mt"><div class="card-h"><span class="hicon">${WW.icon("chart-line", 20)}</span><h3>Historical cost trend — last 30 days</h3></div><div class="chart-box sm"><canvas id="costh" role="img" aria-label="Daily cost, last 30 days"></canvas></div><div class="small mt-s">Daily cost = daily energy × the current marginal rate (estimate).</div></div></div>`;
  }
  WW.page = {
    title: "Energy Analytics", subtitle: "Analyze energy usage, cost and trends to identify savings opportunities.",
    async render({ range }) {
      D = await WW.data.getAnalytics(range);
      if (!D.available) return WW.waiting(D.message);
      H = await WW.data.getAnalytics({ key: "30d" });
      COST = null; try { COST = await WW.data.getCostAnalytics(range); } catch (e) { COST = { available: false, error: e }; }
      const k = D.kpis, p = D.peak, f = D.forecast, h = H.available ? H.trend.values : [];
      const wk = h.slice(-7).reduce((s, x) => s + x, 0), mo = h.reduce((s, x) => s + x, 0), cls = k.monthPct >= 100 ? "crit" : k.monthPct >= 90 ? "warn" : "";
      const ch = k.changePct;
      return `${WW.isSim(D) ? `<div class="banner demo">${WW.icon("info", 18)} <b>DEMO DATA</b> — simulated. Forecast below is a demo illustration, not a trained model.</div>` : ""}
      <div class="grid g4">
        <div class="card statcard"><span class="hicon">${WW.icon("zap", 20)}</span><div><div class="lbl">Total Consumption</div><div class="val">${WW.fmt.kwh(k.kwh)}</div>${ch != null ? `<div class="small ${ch >= 0 ? "down" : "up"}"><b>${ch >= 0 ? "↑" : "↓"} ${Math.abs(ch)}% vs. previous period</b></div>` : `<div class="small muted">avg ${WW.fmt.kwh(k.avgDaily)}/day</div>`}</div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("coins", 20)}</span><div><div class="lbl">Estimated Cost</div><div class="val">${WW.fmt.pkr(k.cost)}</div><div class="small muted">avg ${WW.fmt.kwh(k.avgDaily)} / day</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("calendar", 20)}</span><div style="flex:1"><div class="lbl">Monthly Units</div><div class="val">${Math.round(k.monthUnits)} / ${k.limit}</div><div class="bar ${cls}" style="margin-top:4px"><i style="width:${Math.min(100, k.monthPct)}%"></i></div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("shield-check", 20)}</span><div><div class="lbl">Tariff Category</div><div class="val">${k.category}</div></div></div>
      </div>
      <div class="grid g-wide mt">
        <section class="card"><div class="card-h"><span class="hicon">${WW.icon("chart-line", 20)}</span><h3>Energy Usage Trend</h3></div><div class="chart-box"><canvas id="trend" role="img" aria-label="Energy usage trend"></canvas></div></section>
        <section class="card"><div class="card-h"><span class="hicon">${WW.icon("layout-grid", 20)}</span><h3>Room-wise Comparison</h3></div>
          <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap"><div style="height:160px;width:160px;position:relative;flex:none"><canvas id="rdonut" role="img" aria-label="Energy by room"></canvas></div>
          <div style="flex:1;min-width:190px">${D.byRoom.map((r, i) => `<div style="display:flex;gap:8px;align-items:center;margin:8px 0;flex-wrap:wrap"><i style="width:11px;height:11px;border-radius:50%;background:${["#315D3A", "#7FA886", "#B8CCB0"][i % 3]}"></i><span style="flex:1">${r.name}</span><b>${WW.fmt.kwh(r.kwh)}</b><span class="muted small">(${r.pct}%)</span></div>`).join("")}</div></div></section>
      </div>
      <div class="grid g2 mt">
        <section class="card"><div class="card-h"><span class="hicon">${WW.icon("clock", 20)}</span><h3>Peak Usage Periods</h3><span class="grow"></span><span class="pill warn">Peak window ${p.window}</span></div>
          ${p.hourly.values.length ? `<div class="chart-box sm"><canvas id="peak" role="img" aria-label="Usage by hour of day"></canvas></div>` : `<p class="muted">Hourly view is available for Today / Yesterday / single-day ranges.</p>`}
          <div class="grid g3 mt" style="gap:10px"><div><div class="muted small">Peak share</div><b>${p.peakPct}%</b> <span class="small muted">(${WW.fmt.kwh(p.peakKwh)})</span></div><div><div class="muted small">Off-peak</div><b>${WW.fmt.kwh(p.offKwh)}</b></div><div><div class="muted small">Busiest hours</div><b>${p.topHours.length ? p.topHours.join(", ") : "—"}</b></div></div>
          <div class="small muted mt">${p.touEnabled ? "Time-of-use tariff enabled in Settings." : "Time-of-use pricing is off; peak share is shown for planning (enable it in Settings → Tariff)."}</div></section>
        <section class="card"><div class="card-h"><span class="hicon">${WW.icon("plug", 20)}</span><h3>Appliance-wise Comparison</h3></div>
          ${D.byAppliance.length ? `<div class="chart-box"><canvas id="abar" role="img" aria-label="Energy by appliance"></canvas></div>` : `<p class="muted">No appliance-level readings in this range.</p>`}</section>
      </div>
      <div class="grid g2 mt">
        <section class="card"><div class="card-h"><span class="hicon">${WW.icon("brain", 20)}</span><h3>Load Forecast (Random Forest)</h3><span class="grow"></span><span class="pill ${f.trained ? "info" : "warn"}">${f.simulated ? "Simulated — demo only" : f.trained ? "Trained model" : "Not trained yet"}</span></div>
          ${f.actual ? `<div class="chart-box sm"><canvas id="fc" role="img" aria-label="Forecast vs actual"></canvas></div>` : f.trained ? `<div>${f.next.map((n) => `<div class="detail-row"><span class="k">${n.hour}</span><span class="v">${n.kwh} kWh</span></div>`).join("")}</div>` : `<p class="muted" style="margin:0">${WW.esc(f.info.reason || "No model trained yet.")}</p>`}
          <div class="small muted mt">${f.trained ? `Mean error ${f.info.mae_kwh ?? "—"} kWh vs baseline ${f.info.baseline_mae_kwh ?? "—"} kWh (later-in-time test).` : "No accuracy is claimed until a model is trained on real readings."}</div></section>
        <section class="card"><div class="card-h"><span class="hicon">${WW.icon("receipt", 20)}</span><h3>Bill &amp; Savings Outlook</h3></div>
          <div class="detail-row"><span class="k">Estimated bill so far</span><span class="v">${WW.fmt.pkr(k.estBill)}</span></div>
          <div class="detail-row"><span class="k">Projected month-end (${Math.round(k.projectedUnits)} units)</span><span class="v">≈ ${WW.fmt.pkr(k.projectedBill)}</span></div>
          <div class="detail-row"><span class="k">Savings potential</span><span class="v">${k.savings ? "≈ " + WW.fmt.pkr(k.savings) + " / month" : "Not enough data"}</span></div>
          <div class="note mt">${WW.icon("info", 16)}<span>Estimates use your configured tariff. Savings are an estimate from energy used while rooms were vacant — not a measured result.</span></div></section>
      </div>
      <section class="card mt"><div class="card-h"><span class="hicon">${WW.icon("calendar-days", 20)}</span><h3>Historical Trend — last 30 days</h3></div>
        ${h.length ? `<div class="grid g3" style="margin-bottom:12px"><div><div class="muted small">Daily average</div><b style="font-size:20px">${WW.fmt.kwh(mo / Math.max(1, h.length), 2)}</b></div><div><div class="muted small">Last 7 days</div><b style="font-size:20px">${WW.fmt.kwh(wk)}</b></div><div><div class="muted small">Last 30 days</div><b style="font-size:20px">${WW.fmt.kwh(mo)}</b></div></div><div class="chart-box sm"><canvas id="hist" role="img" aria-label="Last 30 days"></canvas></div>` : `<p class="muted">Needs at least a day of readings.</p>`}</section>${costSection()}`;
    },
    after() {
      if (!D || !D.available) return;
      WW.charts.line("trend", D.trend.labels, D.trend.values);
      const tot = D.byRoom.reduce((s, r) => s + r.kwh, 0); WW.charts.doughnut("rdonut", D.byRoom.map((r) => r.name), D.byRoom.map((r) => r.kwh), [tot.toFixed(1), "kWh"]);
      if (WW.$("#peak")) { const ps = parseInt(D.peak.window), pe = parseInt(D.peak.window.split("–")[1]); WW.charts.bar("peak", D.peak.hourly.labels, D.peak.hourly.values, { highlight: D.peak.hourly.labels.map((_, i) => i).filter((i) => i >= ps && i < pe), yTitle: "kWh" }); }
      if (WW.$("#abar")) WW.charts.hbar("abar", D.byAppliance.map((a) => a.name), D.byAppliance.map((a) => a.kwh));
      if (WW.$("#fc") && D.forecast.actual) { const a = D.forecast.actual, n = a.length, labels = [...a.map((_, i) => `${i % 12 || 12} ${i < 12 ? "AM" : "PM"}`), ...D.forecast.next.map((x) => x.hour)]; WW.charts.forecast("fc", labels, [...a, ...D.forecast.next.map(() => null)], [...a.map((_, i) => (i === n - 1 ? a[i] : null)), ...D.forecast.next.map((x) => x.kwh)]); }
      if (COST && COST.available && WW.$("#costh")) WW.charts.bar("costh", COST.history.labels, COST.history.cost, { unit: "Rs.", yTitle: "PKR", shades: true });
      if (WW.$("#hist")) WW.charts.bar("hist", H.trend.labels, H.trend.values, { shades: true });
    },
  };
})();
