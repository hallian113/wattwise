/* Appliances: ROOM-SPECIFIC. Individual responsive cards (one per appliance) + separate analytics panels + smart sockets.
   No whole-home totals here. Measured/Estimated labels come from the data service: "measured" only for real meter readings. */
(function () {
  let D = null, room = sessionStorage.getItem("ww_app_room") || "lounge";
  const ROOMS = [["lounge", "Lounge"], ["bedroom", "Bedroom"], ["bathroom", "Bathroom"]];
  function card(a) {
    const mlabel = a.measurement === "measured" ? "measured" : a.measurement === "estimated" ? (a.simulated ? "estimated · demo" : "estimated") : "not tracked";
    return `<article class="app-card ${a.on ? "on" : "off"}" data-id="${a.id}" aria-label="${WW.esc(a.name)}">
      <div class="head"><div class="ico">${WW.icon(WW.kindIcon(a.kind), 26)}</div><div style="min-width:0;flex:1"><div class="nm">${WW.esc(a.name)}</div><div class="sb">${WW.esc(a.sub)}</div></div>
        <button class="kebab" data-menu="${a.id}" aria-label="More options for ${WW.esc(a.name)}">${WW.icon("ellipsis-vertical", 18)}</button></div>
      <div class="ctrl"><div><b>${a.on ? "ON" : "OFF"}</b> ${a.mode === "manual" ? `<span class="pill info" title="Manual override has priority over automation">Manual</span>` : `<span class="pill grey">Auto</span>`}</div>
        <label class="switch lg"><input type="checkbox" data-toggle="${a.id}" ${a.on ? "checked" : ""} ${a.controllable ? "" : "disabled"} aria-label="Turn ${WW.esc(a.name)} ${a.on ? "off" : "on"}"><span></span></label></div>
      <dl><div><dt>Rated power</dt><dd>${WW.fmt.w(a.rated)}</dd></div><div><dt>Current power</dt><dd>${WW.fmt.w(a.powerW)}</dd></div>
        <div><dt>Today's usage</dt><dd>${a.kwh == null ? "—" : WW.fmt.kwh(a.kwh)}</dd></div><div><dt>Estimated cost</dt><dd>${a.cost == null ? "—" : WW.fmt.pkr(a.cost)}</dd></div></dl>
      <div class="foot">${WW.measureLabel(a.measurement).replace(/>(measured|estimated|not tracked)</, `>${mlabel}<`)}${a.controllable ? "" : `<span class="small muted">monitor only</span>`}</div></article>`;
  }
  function socket(s) {
    return `<div class="socket" data-sock="${s.id}"><span class="hicon" style="width:46px;height:46px;border:2px solid var(--forest);background:var(--card)">${WW.icon("plug", 22)}</span>
      <div style="min-width:150px;flex:1"><div style="font-weight:800">${WW.esc(s.name)}</div><div class="small muted">${WW.esc(s.location)}</div></div>
      <span class="pill ${s.on ? "" : "grey"}">${s.on ? "On" : "Off"}</span>
      <span class="chip" style="box-shadow:none;padding:6px 12px">${WW.icon("laptop", 16)} ${s.applianceName ? `Connected: ${WW.esc(s.applianceName)}` : "No device mapped"}</span>
      <div><div class="small muted">Connected load</div><b>${WW.fmt.w(s.loadW)}</b> ${WW.measureLabel(s.measurement)}</div>
      <div><div class="small muted">Usage / Cost</div><b>${s.kwh == null ? "—" : WW.fmt.kwh(s.kwh)}</b> · <b>${s.cost == null ? "—" : WW.fmt.pkr(s.cost)}</b></div>
      <button class="btn ghost sm" data-map="${s.id}">${WW.icon("refresh-cw", 14)} Change device</button></div>`;
  }
  async function control(id, on, box) {
    box.disabled = true;
    try {
      const r = await WW.data.controlAppliance(id, on);
      if (r.ok) { WW.toast(r.message || "Command sent", r.demo ? "warn" : ""); if (!r.pending) await WW.reload(true); else setTimeout(() => WW.reload(true), 1500); }
      else { box.checked = !on; WW.toast(r.message || "Command not sent.", "err"); }
    } catch (e) { box.checked = !on; WW.toast(e.message, "err"); }
    box.disabled = false;
  }
  WW.page = {
    title: "Appliances", subtitle: "Monitor, control and analyze energy usage of your home appliances.",
    async render({ range }) {
      D = await WW.data.getAppliances(room, range);
      const tabs = `<div style="display:flex;gap:16px;align-items:center;margin-bottom:24px;flex-wrap:wrap"><b>Select Room:</b><div class="chips" role="tablist">${ROOMS.map(([id, n]) => `<button class="chip ${id === room ? "on" : ""}" role="tab" aria-selected="${id === room}" data-room="${id}">${WW.icon(WW.roomIcon(id), 18)}${n}</button>`).join("")}</div></div>`;
      if (!D.available) return tabs + WW.waiting(D.message);
      const name = D.room.name, banner = WW.isSim(D) ? `<div class="banner demo">${WW.icon("info", 18)} <b>DEMO DATA</b> — toggles change simulated state only; power values are simulated estimates. No real device is switched in Demo Mode.</div>` : "";
      return `${banner}${tabs}
      <div class="card-h"><span class="hicon">${WW.icon(WW.roomIcon(room), 20)}</span><h3>${name} – Appliances (${D.appliances.length})</h3></div>
      <div class="app-grid">${D.appliances.map(card).join("")}</div>
      <div class="grid g2 mt">
        <section class="card"><div class="card-h"><span class="hicon">${WW.icon("chart-column", 20)}</span><h3>${name} Consumption Trend</h3></div><div class="chart-box sm"><canvas id="atrend" role="img" aria-label="${name} consumption trend"></canvas></div></section>
        <section class="card"><div class="card-h"><span class="hicon">${WW.icon(WW.roomIcon(room), 20)}</span><h3>${name} – Energy by Appliance</h3></div><div class="chart-box sm"><canvas id="abar" role="img" aria-label="Energy by appliance"></canvas></div></section></div>
      ${D.sockets.length ? `<section class="card mt"><div class="card-h"><span class="hicon">${WW.icon("plug", 20)}</span><h3>Smart Switch / Smart Socket</h3></div>${D.sockets.map(socket).join("")}
        <div class="note mt">${WW.icon("info", 16)}<span>A smart socket measures only what is plugged into it. A normal wall socket cannot report a laptop's exact power, so values from an un-metered socket are <b>estimates</b> from rated watts and are labelled so.</span></div></section>` : ""}
      <section class="card mt" style="background:var(--sage-100)"><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><span class="hicon">${WW.icon("leaf", 22)}</span><b>Insights</b><span style="flex:1;min-width:220px">${WW.esc(D.insight)}</span></div></section>`;
    },
    after() {
      WW.$$("[data-room]").forEach((b) => (b.onclick = () => { room = b.dataset.room; sessionStorage.setItem("ww_app_room", room); WW.reload(); }));
      if (!D || !D.available) return;
      WW.charts.line("atrend", D.trend.labels, D.trend.values);
      const by = D.byAppliance; WW.charts.hbar("abar", by.map((x) => x.name), by.map((x) => x.kwh));
      WW.$$("[data-toggle]").forEach((c) => (c.onchange = () => control(c.dataset.toggle, c.checked, c)));
      WW.$$("[data-menu]").forEach((b) => (b.onclick = (e) => {
        e.stopPropagation(); WW.$$(".menu").forEach((m) => m.remove()); const a = D.appliances.find((x) => x.id === b.dataset.menu);
        const m = document.createElement("div"); m.className = "menu"; const r = b.getBoundingClientRect(); m.style.top = r.bottom + window.scrollY + 4 + "px"; m.style.left = Math.max(8, Math.min(r.right - 200, window.innerWidth - 210)) + "px";
        m.innerHTML = `<button data-a="mode">${a.mode === "manual" ? "Return to Automatic control" : "Set Manual override"}</button>${a.socketId ? `<button data-a="map">Change smart-socket device</button>` : ""}<button data-a="info">${a.measurement === "measured" ? "Measured by PZEM / smart socket" : "Power is estimated"}</button>`;
        document.body.appendChild(m);
        m.onclick = async (ev) => { const act = ev.target.dataset.a; m.remove(); if (act === "mode") { await WW.data.setApplianceMode(a.id, a.mode === "manual" ? "auto" : "manual"); WW.reload(true); } if (act === "map") mapDialog(a.socketId); };
      }));
      WW.$$("[data-map]").forEach((b) => (b.onclick = () => mapDialog(b.dataset.map)));
    },
  };
  document.addEventListener("click", () => WW.$$(".menu").forEach((m) => m.remove()));
  async function mapDialog(sid) {
    const opts = D.appliances.filter((a) => !["pump", "ac"].includes(a.kind)), s = D.sockets.find((x) => x.id === sid);
    const body = document.createElement("div");
    body.innerHTML = `<p class="muted">Choose which appliance is plugged into <b>${WW.esc(s.name)}</b> (${WW.esc(s.location)}).</p><div class="field"><label>Connected device</label><select class="select" id="mapSel"><option value="">— None —</option>${opts.map((o) => `<option value="${o.id}" ${s.applianceId === o.id ? "selected" : ""}>${WW.esc(o.name)}</option>`).join("")}</select></div>`;
    const v = await WW.modal({ title: "Smart socket mapping", body, actions: [{ label: "Cancel", value: null }, { label: "Save", primary: true, onClick: (bg) => WW.$("#mapSel", bg).value || "" }] });
    if (v === null) return;
    try { await WW.data.mapSocket(sid, v || null); WW.toast("Socket mapping saved"); WW.reload(true); } catch (e) { WW.toast(e.message, "err"); }
  }
})();
