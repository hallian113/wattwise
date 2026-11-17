/* M6 — Energy-waste detection: appliance-wise waste, idle loads right now, detection history with plain-language explanations.
   All figures are ESTIMATES of energy used while it was not needed — never "money saved". */
(function () {
  let D = null, shown = 12;
  const CAUSE = { vacant: ["Room vacant", "warn"], daylight: ["Daylight sufficient", "info"], comfort: ["Comfort limit", "info"], peak_flexible: ["Peak-hour load", "grey"], standby: ["Standby", "grey"] };
  const STATUS = { detected: "Detected", ongoing: "Ongoing", auto_actioned: "Switched off by rule", manual_override: "Kept on (manual override)" };
  const ev = (e) => `<tr><td>${WW.fmt.when(e.start)}<div class="small">${WW.fmt.dur(e.durationMin)}</div></td><td><b>${WW.esc(e.appliance)}</b><div class="small">${WW.esc(e.room)}</div></td>
    <td class="small" style="max-width:340px">${WW.esc(e.explanation)}</td><td><span class="pill ${(CAUSE[e.cause] || ["", "grey"])[1]}">${(CAUSE[e.cause] || [e.cause])[0]}</span></td>
    <td><b>${e.kwh > 0 && e.kwh < 0.01 ? "<0.01 kWh" : WW.fmt.kwh(e.kwh, 2)}</b><div class="small">${e.pkr > 0 && e.pkr < 0.5 ? "<Rs. 1" : WW.fmt.pkr(e.pkr)}</div></td><td>${e.status === "ongoing" ? WW.pill("Ongoing", "crit") : WW.pill(STATUS[e.status] || e.status, "grey")}</td></tr>`;
  function eventsHtml() {
    const list = D.events.slice(0, shown);
    return list.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>When</th><th>Appliance</th><th>Why it was flagged</th><th>Cause</th><th>Energy · cost</th><th>Status</th></tr></thead><tbody>${list.map(ev).join("")}</tbody></table></div>
      ${D.events.length > shown ? `<div class="mt" style="text-align:center"><button class="btn ghost sm" id="more">Show more (${D.events.length - shown} older)</button></div>` : ""}`
      : WW.emptyState("No waste detected in this period", "Nothing ran while it was not needed. That is a good result — or there is not enough data yet.", "circle-check");
  }
  WW.page = {
    title: "Waste Detection", subtitle: "Energy used while it was not needed — with the reason for every detection.",
    async render({ range }) {
      D = await WW.data.getWaste(range); shown = 12;
      if (!D.available) return WW.waiting(D.message || "Waiting for waste-detection data");
      const s = D.summary;
      return `${WW.sourceBanner(D, "simulated usage and occupancy. All waste figures are estimates.")}
      <div class="grid g4">
        <div class="card statcard"><span class="hicon">${WW.icon("flame", 20)}</span><div><div class="lbl">Waste events</div><div class="val">${s.events}</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("zap", 20)}</span><div><div class="lbl">Energy wasted</div><div class="val">${WW.fmt.kwh(s.kwh)}</div><div class="small muted">${WW.fmt.pkr(s.pkr)} · estimate</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("power", 20)}</span><div><div class="lbl">Idle right now</div><div class="val">${D.idle.length}</div><div class="small muted">appliance(s) on in an empty room</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("leaf", 20)}</span><div><div class="lbl">Top source</div><div class="val" style="font-size:16px">${WW.esc(s.topAppliance || "—")}</div></div></div>
      </div>
      <div class="card mt"><div class="card-h"><span class="hicon">${WW.icon("power", 20)}</span><h3>Idle consumption right now</h3><span class="grow"></span><a class="btn ghost sm" href="automation.html">${WW.icon("layers", 14)} Automation</a></div>
        ${D.idle.length ? D.idle.map((i) => `<div class="xrow"><div class="who">${WW.esc(i.appliance)} <span class="muted" style="font-weight:500">· ${WW.esc(i.room)}</span></div><div class="why">${WW.esc(i.explanation)}</div><div style="text-align:right"><b>${WW.fmt.w(i.powerW)}</b><div class="small">≈ ${WW.fmt.pkr(i.pkrPerHour)}/h</div></div></div>`).join("") : WW.emptyState("No idle loads right now", "No appliance is running in an empty room.", "circle-check")}</div>
      <div class="grid g-wide mt">
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon("plug", 20)}</span><h3>Appliance-wise waste</h3></div>${D.byAppliance.length ? `<div class="chart-box lg"><canvas id="wb"></canvas></div>` : WW.emptyState("Nothing to chart", "No waste in this period.")}</div>
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon("coins", 20)}</span><h3>Impact</h3></div>
          <div class="stack"><div class="detail-row"><span class="k">Used while room vacant</span><span class="v">${WW.fmt.kwh(s.idleKwh)}</span></div>
          <div class="detail-row"><span class="k">Daylight / comfort-limit usage</span><span class="v">${WW.fmt.kwh(s.contextKwh)}</span></div>
          <div class="detail-row"><span class="k">Potential per month ${WW.pill("potential", "info")}</span><span class="v">${WW.fmt.kwh(s.monthlyPotentialKwh)} · ${WW.fmt.pkr(s.monthlyPotentialPkr)}</span></div>
          ${WW.estimateNote("Monthly potential = vacant-room energy of the last 7 days scaled to 30 days (same basis as the Savings page). It is an upper bound, not money saved.")}</div></div>
      </div>
      <div class="card mt"><div class="card-h"><span class="hicon">${WW.icon("history", 20)}</span><h3>Detection history</h3><span class="grow"></span><span class="small">${D.events.length} event(s)</span></div><div id="evs">${eventsHtml()}</div></div>
      <div class="card mt"><div class="card-h"><span class="hicon">${WW.icon("circle-help", 20)}</span><h3>Not tracked</h3></div><ul class="small stack" style="margin:0;padding-left:18px">${(D.notTracked || []).map((n) => `<li>${WW.esc(n)}</li>`).join("")}</ul></div>`;
    },
    after(root) {
      if (!D || !D.available) return;
      if (D.byAppliance.length) WW.charts.stacked("wb", D.byAppliance.map((b) => `${b.name} (${b.room})`), [{ label: "Room vacant", data: D.byAppliance.map((b) => b.idleKwh), color: "#C27A2C" }, { label: "Daylight / comfort", data: D.byAppliance.map((b) => b.contextKwh), color: "#6AA0C4" }]);
      const more = () => { const b = WW.$("#more", root); if (b) b.onclick = () => { shown += 15; WW.$("#evs", root).innerHTML = eventsHtml(); more(); }; }; more();
    },
  };
})();
