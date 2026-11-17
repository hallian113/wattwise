/* Rooms: only Lounge, Bedroom, Bathroom. Click a room to update details, graph, occupancy and cost. */
(function () {
  let D = null, sel = sessionStorage.getItem("ww_room") || "lounge";
  const occ = (o) => (o.state === "occupied" ? `<span class="pill"><span class="dot"></span>Occupied</span>` : o.state === "vacant" ? `<span class="pill grey">Vacant${o.sinceMin != null ? ` · ${WW.fmt.dur(o.sinceMin)}` : ""}</span>` : `<span class="pill grey">No occupancy data</span>`);
  const conn = (c) => !c ? "—" : c.node === "simulated" ? `<span class="pill warn">simulated</span>` : c.node === "online" ? `<span class="pill"><span class="dot"></span>${c.online}/${c.total} online</span>` : `<span class="pill grey">${c.node}</span>`;
  function detail() {
    const r = D.rooms.find((x) => x.id === sel) || D.rooms[0]; sel = r.id;
    const tl = r.timeline.hours || [];
    return `<div class="card-h"><span class="hicon">${WW.icon(WW.roomIcon(r.id), 20)}</span><h3>${r.name} – Details</h3><span class="grow"></span><span class="pill ${r.active ? "" : "grey"}"><span class="dot"></span>${r.active ? "Active" : "Inactive"}</span></div>
      <div class="detail-row"><span class="hicon sm">${WW.icon("zap", 16)}</span><span class="k">Energy Consumption</span><span class="v">${WW.fmt.kwh(r.kwh)}</span></div>
      <div class="detail-row"><span class="hicon sm">${WW.icon("coins", 16)}</span><span class="k">Estimated Cost</span><span class="v">${WW.fmt.pkr(r.cost)}</span></div>
      <div class="detail-row"><span class="hicon sm">${WW.icon("percent", 16)}</span><span class="k">Share of Total Usage</span><span class="v">${r.pct}%</span></div>
      <div class="detail-row"><span class="hicon sm">${WW.icon("clock", 16)}</span><span class="k">Usage Duration</span><span class="v">${WW.fmt.dur(r.durationMin)}</span></div>
      <div class="detail-row"><span class="hicon sm">${WW.icon("person-standing", 16)}</span><span class="k">Occupancy</span><span class="v">${occ(r.occupancy)}</span></div>
      <div class="detail-row"><span class="hicon sm">${WW.icon("cpu", 16)}</span><span class="k">Device connectivity</span><span class="v">${conn(r.connectivity)}</span></div>
      ${(r.appliances || []).length ? `<div class="muted small mt">Connected appliances</div><div class="room-apps" style="margin-top:8px">${r.appliances.map((a) => `<span class="pill ${a.on ? "" : "grey"}" title="${a.mode === "manual" ? "Manual override" : "Automatic"}">${WW.icon(WW.kindIcon(a.kind), 13)} ${WW.esc(a.name)} · ${a.on ? "on" : "off"}</span>`).join("")}</div>` : ""}
      ${r.env ? `<div class="detail-row"><span class="hicon sm">${WW.icon("thermometer", 16)}</span><span class="k">Climate <span class="small muted">(simulated)</span></span><span class="v">${WW.fmt.temp(r.env.temperature)} · ${r.env.humidity}% · ${r.env.lux} lux</span></div>` : ""}
      ${tl.length ? `<div class="muted small mt">Occupancy timeline (today)</div><div class="tl" style="grid-template-columns:repeat(${tl.length},1fr)" role="img" aria-label="Occupancy timeline">${tl.map((v, i) => `<i class="${v === 1 ? "o" : v === 0 ? "v" : ""}" title="${r.timeline.labels[i]}: ${v === 1 ? "occupied" : v === 0 ? "vacant" : "no data"}"></i>`).join("")}</div><div class="small muted" style="display:flex;gap:14px;margin-top:6px"><span>■ <span style="color:var(--forest)">occupied</span></span><span>■ <span style="color:var(--sage-300)">vacant</span></span><span>■ no data</span></div>` : ""}`;
  }
  function paintDetail() {
    WW.$("#detail").innerHTML = detail(); const r = D.rooms.find((x) => x.id === sel);
    WW.$("#trendTitle").textContent = `${r.name} Consumption Trend`;
    WW.charts.destroyAll(); WW.charts.line("rtrend", r.trend.labels, r.trend.values);
    WW.$$(".room-card").forEach((c) => c.classList.toggle("sel", c.dataset.id === sel));
  }
  WW.page = {
    title: "Rooms", subtitle: "Monitor and manage energy usage in each room.",
    async render({ range }) {
      D = await WW.data.getRooms(range);
      if (!D.available) return WW.waiting(D.message);
      const t = D.totals;
      return `${WW.isSim(D) ? `<div class="banner demo">${WW.icon("info", 18)} <b>DEMO DATA</b> — simulated readings.</div>` : ""}
      <div class="grid g4">
        <div class="card statcard"><span class="hicon">${WW.icon("zap", 20)}</span><div><div class="lbl">Total Room Consumption</div><div class="val">${WW.fmt.kwh(t.kwh)}</div>${t.vsYesterdayPct != null ? `<div class="small ${t.vsYesterdayPct >= 0 ? "down" : "up"}"><b>${t.vsYesterdayPct >= 0 ? "↑" : "↓"} ${Math.abs(t.vsYesterdayPct)}% vs. yesterday</b></div>` : ""}</div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("coins", 20)}</span><div><div class="lbl">Total Room Cost</div><div class="val">${WW.fmt.pkr(t.cost)}</div><div class="small muted">estimate</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("house", 20)}</span><div><div class="lbl">Active Rooms</div><div class="val">${t.activeRooms} / ${t.rooms}</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("leaf", 20)}</span><div><div class="lbl">Highest Consuming Room</div><div class="val" style="font-size:18px">${t.topRoom ? `${t.topRoom.name} (${WW.fmt.kwh(t.topRoom.kwh)})` : "—"}</div></div></div>
      </div>
      <div class="grid g3 mt">${D.rooms.map((r) => `<button class="room-card ${r.id === sel ? "sel" : ""}" data-id="${r.id}" aria-label="Show ${r.name} details"><img src="${r.image}" alt="${r.name}" loading="lazy">
        <div class="meta"><span class="nm">${WW.icon(WW.roomIcon(r.id), 20)}${r.name}</span><span class="pill ${r.active ? "" : "grey"}"><span class="dot"></span>${r.active ? "Active" : "Inactive"}</span><span class="ring" style="--p:${r.pct}"><b>${r.pct}%</b></span></div>
        <div style="display:flex;gap:18px;margin-top:6px;padding-left:2px;flex-wrap:wrap"><b style="font-size:19px">${WW.fmt.kwh(r.kwh)}</b><span style="border-left:1px solid var(--line);padding-left:18px;font-size:17px;font-weight:600">${WW.fmt.pkr(r.cost)}</span></div></button>`).join("")}</div>
      <div class="grid g-rooms mt"><section class="card" id="detail"></section>
        <section class="card"><div class="card-h"><span class="hicon">${WW.icon("chart-column", 20)}</span><h3 id="trendTitle">Room Consumption Trend</h3></div><div class="chart-box"><canvas id="rtrend" role="img" aria-label="Room consumption trend"></canvas></div></section></div>`;
    },
    after() {
      WW.$$(".room-card").forEach((c) => (c.onclick = () => { sel = c.dataset.id; sessionStorage.setItem("ww_room", sel); paintDetail(); }));
      if (D && D.available) paintDetail();
    },
  };
})();
