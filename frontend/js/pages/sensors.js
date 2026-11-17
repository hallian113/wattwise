/* M1 — IoT sensing & data acquisition: latest readings per room, connectivity of every component, short history, data-quality flags.
   Live = values reported by the backend (ESP32 → MQTT). Demo = simulated. The two are always labelled differently. */
(function () {
  let R = null, C = null, room = sessionStorage.getItem("ww_sensor_room") || "lounge";
  const statusPill = (s) => (s === "ok" ? "" : `<span class="pill ${s === "stale" ? "warn" : s === "out_of_range" ? "crit" : "grey"}">${s === "out_of_range" ? "out of range" : s || "unknown"}</span>`);
  const src = (m) => (m === "measured" ? WW.pill("measured", "ok") : m === "simulated" ? WW.pill("simulated", "warn") : WW.pill("not tracked", "grey"));
  const reading = (icon, label, rd, fmt, extra = "") => `<div class="reading"><div class="lbl">${WW.icon(icon, 14)}${label}</div>
    <div class="val">${rd && rd.value != null ? fmt(rd) : "—"}</div><div class="chips-in" style="margin-top:4px">${rd ? src(rd.measurement) + statusPill(rd.status) : WW.pill("not tracked", "grey")}${extra}</div></div>`;
  const compPill = (c) => `<span class="pill ${c.state === "online" ? "ok" : c.state === "simulated" ? "warn" : "grey"}" title="${WW.esc(c.role)}${c.lastSeen ? " · last seen " + WW.fmt.when(c.lastSeen) : ""}"><span class="dot"></span>${WW.esc(c.component)}</span>`;
  function roomCard(r) {
    const d = r.readings || {}, lux = d.lux && d.lux.value, th = (R.thresholds || {}).luxDaylight;
    const p = d.presence;
    return `<div class="card rcard"><h4><span style="display:flex;gap:10px;align-items:center"><span class="hicon sm">${WW.icon(WW.roomIcon(r.id), 16)}</span>${WW.esc(r.name)}</span>
      <span class="pill ${r.nodeOnline ? "ok" : "grey"}"><span class="dot"></span>${r.nodeOnline ? "Node online" : "Node offline"}</span></h4>
      <div class="small">${WW.esc(r.node || "")}${r.lastSeen ? ` · last reading ${WW.fmt.when(r.lastSeen)}` : ""}</div>
      <div class="readings">
        ${reading("thermometer", "Temperature", d.temperatureC, (x) => `${WW.fmt.temp(x.value)}`)}
        ${reading("droplets", "Humidity", d.humidity, (x) => `${Math.round(x.value)}<small>%</small>`)}
        ${reading("sun", "Ambient light", d.lux, (x) => `${Math.round(x.value)}<small> lx</small>`, lux != null && th ? WW.pill(lux >= th ? "daylight sufficient" : "low light", lux >= th ? "info" : "grey") : "")}
        ${reading("person-standing", "Presence", p, (x) => (x.value ? "Detected" : "None"), p ? `<span class="pill grey" title="mmWave / PIR">${p.ld2410 != null ? `mmWave ${p.ld2410 ? "✓" : "–"}` : ""} ${p.pir != null ? `PIR ${p.pir ? "✓" : "–"}` : ""}</span>` : "")}
        ${reading(d.door && d.door.value === "open" ? "door-open" : "door-closed", "Door", d.door, (x) => (x.value === "open" ? "Open" : "Closed"))}
      </div>
      ${(r.quality || []).length ? `<div class="note warn">${WW.icon("triangle-alert", 16)}<span>${r.quality.map(WW.esc).join(" · ")}</span></div>` : ""}</div>`;
  }
  async function drawHistory() {
    const box = WW.$("#hist"); box.innerHTML = `<div class="skel" style="height:220px"></div>`;
    try {
      const h = await WW.data.getSensorHistory(room, 24);
      if (!h.available || !h.labels.length) { box.innerHTML = WW.emptyState("No history yet", h.message || "The backend has not stored readings for this room yet."); return; }
      box.innerHTML = `<div class="grid g3"><div><div class="small">Temperature (°C)</div><div class="chart-box sm"><canvas id="h1"></canvas></div></div><div><div class="small">Humidity (%)</div><div class="chart-box sm"><canvas id="h2"></canvas></div></div><div><div class="small">Ambient light (lx)</div><div class="chart-box sm"><canvas id="h3"></canvas></div></div></div>
        <div class="small mt-s">${WW.isSim(h) ? "Simulated history." : "Measured history from the backend."} Gaps are shown as gaps, never filled in.</div>`;
      WW.charts.line("h1", h.labels, h.temperatureC, { unit: "°C", yTitle: "", color: "#C27A2C" }); WW.charts.line("h2", h.labels, h.humidity, { unit: "%", yTitle: "", color: "#3B6C8E" }); WW.charts.line("h3", h.labels, h.lux, { unit: "lx", yTitle: "", color: "#D9A23A" });
    } catch (e) { box.innerHTML = WW.errorBox(e); }
  }
  WW.page = {
    title: "Sensors", subtitle: "Latest readings and connectivity of every sensor node.", showRange: false,
    async render() {
      [R, C] = await Promise.all([WW.data.getSensorReadings(), WW.data.getSensors()]);
      if (!R.available) return WW.waiting(R.message || "Waiting for sensor data");
      const comps = C.rooms.flatMap((r) => r.components), online = comps.filter((c) => c.online).length, last = R.rooms.map((r) => r.lastSeen).filter(Boolean).sort().pop();
      if (!R.rooms.find((r) => r.id === room)) room = R.rooms[0].id;
      return `${WW.sourceBanner(R, "simulated sensor values. Live mode shows only what the ESP32 nodes actually report.")}
      <div class="grid g4">
        <div class="card statcard"><span class="hicon">${WW.icon("radio-tower", 20)}</span><div><div class="lbl">Nodes online</div><div class="val">${R.rooms.filter((r) => r.nodeOnline).length} / ${R.rooms.length}</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("cpu", 20)}</span><div><div class="lbl">Components online</div><div class="val">${WW.isSim(R) ? "simulated" : `${online} / ${comps.length}`}</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("clock", 20)}</span><div><div class="lbl">Last reading</div><div class="val" style="font-size:17px">${last ? WW.fmt.when(last) : "—"}</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("database", 20)}</span><div><div class="lbl">Data source</div><div class="val" style="font-size:17px">${WW.isSim(R) ? "Simulated" : "Live sensors"}</div></div></div>
      </div>
      <div class="grid g3 mt">${R.rooms.map(roomCard).join("")}</div>
      <div class="card mt"><div class="card-h"><span class="hicon">${WW.icon("chart-line", 20)}</span><h3>Last 24 hours</h3><span class="grow"></span>
        <div class="chips">${R.rooms.map((r) => `<button class="chip ${r.id === room ? "on" : ""}" data-room="${r.id}">${WW.esc(r.name)}</button>`).join("")}</div></div><div id="hist"></div></div>
      <div class="card mt"><div class="card-h"><span class="hicon">${WW.icon("wifi", 20)}</span><h3>Connectivity & components</h3></div>
        <div class="scroll-x"><table class="tbl"><thead><tr><th>Room</th><th>Node</th><th>Components</th></tr></thead><tbody>${C.rooms.map((r) => `<tr><td><b>${WW.esc(r.name)}</b></td><td class="small">${WW.esc(r.node || "")}</td><td><div class="comp-list">${r.components.map(compPill).join("")}</div></td></tr>`).join("")}</tbody></table></div>
        ${WW.estimateNote("A PZEM-004T starts measuring at about 0.4 W, so very small standby loads can read as zero. Values older than " + ((R.thresholds || {}).staleAfterSec || 120) + " s are flagged as stale instead of being shown as current.")}</div>`;
    },
    async after(root) {
      if (!R || !R.available) return;
      WW.$$("[data-room]", root).forEach((b) => (b.onclick = () => { room = b.dataset.room; sessionStorage.setItem("ww_sensor_room", room); WW.$$("[data-room]", root).forEach((x) => x.classList.toggle("on", x === b)); drawHistory(); }));
      await drawHistory();
    },
  };
})();
