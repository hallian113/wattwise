/* M3 — Occupancy & context detection: occupied / vacant / uncertain per room, sensor agreement, context, presence history. */
(function () {
  let CUR = null;
  const LABEL = { occupied: "Occupied", vacant: "Vacant", uncertain: "Uncertain" };
  const COLORS = ["#315D3A", "#8FB59A", "#D9A23A"];
  const agree = (s) => [["mmWave", s.ld2410], ["PIR", s.pir], ["Door", s.door === "open" ? true : s.door === "closed" ? false : null]].filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `<span class="pill ${v ? "" : "grey"}" title="${k}">${k} ${k === "Door" ? (v ? "open" : "closed") : v ? "✓" : "–"}</span>`).join(" ");
  function card(r) {
    const c = r.context || {};
    return `<div class="card rcard"><h4><span style="display:flex;gap:10px;align-items:center"><span class="hicon sm">${WW.icon(WW.roomIcon(r.id), 16)}</span>${WW.esc(r.name)}</span><span class="pill state-${r.state}"><span class="dot"></span>${LABEL[r.state] || r.state}</span></h4>
      <div class="small">${r.state === "uncertain" ? "Sensors changed very recently — waiting out the grace period." : `${LABEL[r.state] || "State"} for ${WW.fmt.dur(r.sinceMin)}`}</div>
      <div class="chips-in" style="margin:0">${agree(r.sensors || {})}</div>
      <div class="readings">
        <div class="reading"><div class="lbl">${WW.icon("thermometer", 14)}Temperature</div><div class="val">${c.temperatureC != null ? WW.fmt.temp(c.temperatureC) : "—"}</div><div class="small">${c.comfort ? `${c.comfort} comfort range` : ""}</div></div>
        <div class="reading"><div class="lbl">${WW.icon("sun", 14)}Light</div><div class="val">${c.lux != null ? Math.round(c.lux) : "—"}<small> lx</small></div><div class="small">${c.daylightSufficient == null ? "" : c.daylightSufficient ? "daylight sufficient" : "low light"}</div></div>
        <div class="reading"><div class="lbl">${WW.icon("clock", 14)}Occupied today</div><div class="val">${r.today ? WW.fmt.num(r.today.occupiedHours, 1) : "—"}<small> h</small></div></div>
        <div class="reading"><div class="lbl">${WW.icon("history", 14)}Changes today</div><div class="val">${r.today ? r.today.transitions : "—"}</div></div>
      </div>
      <div><div class="small" style="margin-bottom:6px">Presence today</div><div class="timeline" role="img" aria-label="Presence timeline for ${WW.esc(r.name)}">${(r.timeline || []).map((t) => `<i class="${t.state}" title="${t.hour}:00 — ${t.state}"></i>`).join("")}</div>
        <div class="tl-axis"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span></div></div></div>`;
  }
  WW.page = {
    title: "Occupancy", subtitle: "Who is where: occupied, vacant or uncertain — per room.", showRange: false,
    async render() {
      const D = (CUR = await WW.data.getOccupancy());
      if (!D.available) return WW.waiting(D.message || "Waiting for presence data");
      const n = (s) => D.rooms.filter((r) => r.state === s).length, det = D.detection || {};
      return `${WW.sourceBanner(D, "simulated presence. Live mode classifies rooms from the mmWave radar, PIR and door sensors.")}
      <div class="grid g4">
        <div class="card statcard"><span class="hicon">${WW.icon("person-standing", 20)}</span><div><div class="lbl">Occupied rooms</div><div class="val">${n("occupied")} / ${D.rooms.length}</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("house", 20)}</span><div><div class="lbl">Vacant rooms</div><div class="val">${n("vacant")}</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("circle-help", 20)}</span><div><div class="lbl">Uncertain</div><div class="val">${n("uncertain")}</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("clock", 20)}</span><div><div class="lbl">Grace period</div><div class="val">${det.gracePeriodMin != null ? det.gracePeriodMin + " min" : "—"}</div></div></div>
      </div>
      <div class="grid g3 mt">${D.rooms.map(card).join("")}</div>
      <div class="legend mt"><span><i style="background:var(--forest)"></i>Occupied</span><span><i style="background:var(--line)"></i>Vacant</span><span><i style="background:#6AA0C4"></i>Uncertain</span><span><i style="border:1px dashed var(--line)"></i>Not yet</span></div>
      <div class="grid g-wide mt">
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon("calendar-days", 20)}</span><h3>Presence history — last 7 days</h3></div><div class="chart-box"><canvas id="p7"></canvas></div><div class="small mt-s">Occupied hours per day, per room.</div></div>
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon("shield-check", 20)}</span><h3>How detection works</h3></div>
          <div class="stack small"><div><b>Sensors:</b> ${(det.sources || []).map(WW.esc).join(" · ") || "—"}</div><div><b>Policy:</b> ${WW.esc(det.policy || "—")}</div><div>${WW.esc(det.note || "")}</div>
          ${WW.estimateNote("“Uncertain” means the sensors disagree or changed moments ago. In that state WattWise takes no automatic action (conservative default).")}</div></div>
      </div>`;
    },
    after() {
      [CUR].forEach((D) => {
        if (!D || !D.available || !D.rooms.length) return;
        WW.charts.make("p7", { type: "bar", data: { labels: D.rooms[0].history7d.map((x) => x.label), datasets: D.rooms.map((r, i) => ({ label: r.name, data: r.history7d.map((x) => x.occupiedHours), backgroundColor: COLORS[i % 3], borderRadius: 5, maxBarThickness: 22 })) },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, labels: { usePointStyle: true, boxWidth: 8 } } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, max: 24, title: { display: true, text: "Occupied hours" } } } } });
      });
    },
  };
})();
