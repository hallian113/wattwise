/* M4 — Context-aware energy analysis: is each running appliance justified or avoidable, and why? (verdicts come from the rules engine, not from this page) */
(function () {
  let CUR = null;
  const V = { justified: "Justified", avoidable: "Avoidable", uncertain: "Uncertain", off: "Off" };
  const row = (i) => `<div class="xrow"><div><div class="who">${WW.icon(WW.kindIcon(i.kind), 16)} ${WW.esc(i.appliance)} <span class="muted" style="font-weight:500">· ${WW.esc(i.roomName)}</span></div>
      <div class="chips-in"><span>${i.on ? WW.fmt.w(i.powerW) : "off"}</span>${i.inputs ? `<span>room ${WW.esc(i.inputs.occupancy)}</span>${i.inputs.lux != null ? `<span>${Math.round(i.inputs.lux)} lx</span>` : ""}${i.inputs.temperatureC != null ? `<span>${i.inputs.temperatureC} °C</span>` : ""}` : ""}</div></div>
      <div class="why">${WW.esc(i.reason)}${i.rule ? `<div class="small" style="margin-top:4px"><b>Rule:</b> ${WW.esc(i.rule)}</div>` : ""}</div>
      <div style="text-align:right"><span class="pill v-${i.verdict}">${V[i.verdict] || i.verdict}</span>${i.on && i.verdict === "avoidable" ? `<div class="small" style="margin-top:4px">≈ ${WW.fmt.pkr(i.pkrPerHour)}/h</div>` : ""}</div></div>`;
  WW.page = {
    title: "Context Analysis", subtitle: "Is the energy in use justified by occupancy, daylight and temperature? Every verdict shows its reason.", showRange: false,
    async render() {
      const D = (CUR = await WW.data.getContext());
      if (!D.available) return WW.waiting(D.message || "Waiting for context data");
      const s = D.summary, run = D.items.filter((i) => i.on), off = D.items.filter((i) => !i.on), sp = D.split || {}, tot = (sp.occupiedKwh || 0) + (sp.vacantKwh || 0);
      return `${WW.sourceBanner(D, "simulated occupancy, light and temperature. In Live mode the verdicts are produced by the backend rules.")}
      <div class="grid g4">
        <div class="card statcard"><span class="hicon">${WW.icon("power", 20)}</span><div><div class="lbl">Running now</div><div class="val">${s.running}</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("circle-check", 20)}</span><div><div class="lbl">Justified</div><div class="val">${s.justified}</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("triangle-alert", 20)}</span><div><div class="lbl">Avoidable</div><div class="val">${s.avoidable}</div><div class="small muted">${s.avoidable ? `${WW.fmt.w(s.avoidableWattsNow)} · ≈ ${WW.fmt.pkr(s.avoidablePkrPerHour)}/h` : "nothing to act on"}</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("circle-help", 20)}</span><div><div class="lbl">Uncertain</div><div class="val">${s.uncertain}</div><div class="small muted">no action taken</div></div></div>
      </div>
      <div class="card mt"><div class="card-h"><span class="hicon">${WW.icon("list-checks", 20)}</span><h3>Appliances running now</h3><span class="grow"></span><span class="pill info">estimate</span></div>
        ${run.length ? run.map(row).join("") : WW.emptyState("Nothing is running", "No appliance is on right now, so there is nothing to evaluate.", "power")}
        ${off.length ? `<details class="mt"><summary class="small" style="cursor:pointer">Appliances that are off (${off.length})</summary>${off.map(row).join("")}</details>` : ""}</div>
      <div class="grid g-wide mt">
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon("chart-column", 20)}</span><h3>Energy vs occupancy — ${WW.esc(D.correlation.period)}</h3></div><div class="chart-box lg"><canvas id="cc"></canvas></div></div>
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon("thermometer", 20)}</span><h3>Temperature & light</h3></div><div class="chart-box sm"><canvas id="ct"></canvas></div><div class="chart-box sm mt-s"><canvas id="cl"></canvas></div></div>
      </div>
      <div class="grid g3 mt">
        <div class="card statcard"><span class="hicon">${WW.icon("person-standing", 20)}</span><div><div class="lbl">Used while rooms occupied</div><div class="val">${WW.fmt.kwh(sp.occupiedKwh)}</div><div class="small muted">${tot ? Math.round((sp.occupiedKwh / tot) * 100) : 0}% · ${WW.esc(sp.period || "")}</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("house", 20)}</span><div><div class="lbl">Used while rooms vacant</div><div class="val">${WW.fmt.kwh(sp.vacantKwh)}</div><div class="small muted">${tot ? Math.round((sp.vacantKwh / tot) * 100) : 0}% — candidate waste</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("sun", 20)}</span><div><div class="lbl">Lights on in daylight</div><div class="val">${WW.fmt.kwh(sp.daylightLightingKwh)}</div><div class="small muted">≥ ${D.thresholds ? D.thresholds.luxDaylight : 300} lx</div></div></div>
      </div>
      <div class="mt">${(D.notes || []).map((n) => WW.estimateNote(n)).join("")}</div>`;
    },
    async after() {
      const D = CUR; if (!D || !D.available) return; const c = D.correlation;
      WW.charts.combo("cc", c.labels, c.energyKwh, c.occupiedRooms, { lineMax: Math.max(3, ...c.occupiedRooms) });
      WW.charts.line("ct", c.labels, c.temperatureC, { unit: "°C", yTitle: "Temperature (°C)", color: "#C27A2C" }); WW.charts.line("cl", c.labels, c.lux, { unit: "lx", yTitle: "Light (lx)", color: "#D9A23A" });
    },
  };
})();
