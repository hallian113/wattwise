/* Alerts: severity (critical/warning/info), category filters, mark as read, clear. */
(function () {
  let D = null, cat = "all", sev = "all";
  const CATS = [["all", "All"], ["threshold", "Threshold"], ["usage", "Usage"], ["bill", "Bill"], ["waste", "Waste"], ["sensor", "Sensor"], ["device", "Device"], ["weather", "Weather"], ["automation", "Automation"]];
  const ico = { threshold: "gauge", usage: "trending-up", bill: "receipt", waste: "zap", sensor: "radio-tower", device: "cpu", weather: "cloud-lightning", automation: "circle-check" };
  function list() {
    const items = D.alerts.filter((a) => (cat === "all" || a.category === cat) && (sev === "all" || a.severity === sev));
    if (!items.length) return `<div class="waiting"><div class="hicon">${WW.icon("bell", 28)}</div><h3>No alerts</h3><p style="margin:0">${D.alerts.length ? "Nothing matches these filters." : D.source === "live" ? "No alerts yet. They appear when real readings cross your thresholds." : "All cleared."}</p></div>`;
    return items.map((a) => `<div class="alert-item sev-${a.severity} ${a.read ? "" : "unread"}"><span class="ai ${a.severity}">${WW.icon(a.severity === "critical" ? "circle-x" : ico[a.category] || "triangle-alert", 20)}</span>
      <div style="flex:1;min-width:220px"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>${WW.esc(a.title)}</b><span class="pill ${a.severity === "critical" ? "crit" : a.severity === "warning" ? "warn" : "info"}">${a.severity}</span><span class="pill grey">${a.category}</span>${a.room ? `<span class="pill grey">${WW.icon(WW.roomIcon(a.room), 12)} ${WW.esc(a.room)}${a.appliance ? " · " + WW.esc(a.appliance) : ""}</span>` : ""}${a.read ? "" : `<span class="pill" title="Unread"><span class="dot"></span>unread</span>`}${a.demo ? '<span class="pill grey">demo</span>' : ""}</div><div class="muted" style="margin-top:3px">${WW.esc(a.message)}</div></div>
      <div style="text-align:right;white-space:nowrap"><div class="small muted">${WW.fmt.when(a.time)}</div>${a.read ? '<span class="small muted">read</span>' : `<button class="btn ghost sm" data-read="${a.id}" style="margin-top:6px">Mark as read</button>`}</div></div>`).join("");
  }
  WW.page = {
    title: "Alerts", subtitle: "Stay informed about energy usage, safety and system events.", showRange: false,
    async render() {
      D = await WW.data.getAlerts();
      const unread = D.alerts.filter((a) => !a.read).length;
      return `${WW.isSim(D) ? `<div class="banner demo">${WW.icon("info", 18)} <b>DEMO DATA</b> — simulated alerts.</div>` : ""}
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:14px"><div class="chips">${CATS.map(([k, l]) => `<button class="chip ${cat === k ? "on" : ""}" data-cat="${k}">${l}</button>`).join("")}</div><span style="flex:1"></span>
        <select class="select" id="sevSel" aria-label="Severity"><option value="all">All severities</option><option value="critical" ${sev === "critical" ? "selected" : ""}>Critical</option><option value="warning" ${sev === "warning" ? "selected" : ""}>Warning</option><option value="info" ${sev === "info" ? "selected" : ""}>Info</option></select>
        <button class="btn ghost" id="readAll" ${unread ? "" : "disabled"}>${WW.icon("check", 16)} Mark all read (${unread})</button><button class="btn ghost" id="clearAll" ${D.alerts.length ? "" : "disabled"}>${WW.icon("trash-2", 16)} Clear alerts</button></div>
      <section class="card" style="padding:0" id="alist">${list()}</section>`;
    },
    after() {
      WW.$$("[data-cat]").forEach((b) => (b.onclick = () => { cat = b.dataset.cat; WW.reload(true); }));
      WW.$("#sevSel").onchange = (e) => { sev = e.target.value; WW.reload(true); };
      WW.$$("[data-read]").forEach((b) => (b.onclick = async () => { await WW.data.markRead(isNaN(b.dataset.read) ? b.dataset.read : +b.dataset.read); WW.reload(true); }));
      WW.$("#readAll").onclick = async () => { await WW.data.markAllRead(); WW.toast("All alerts marked as read"); WW.reload(true); };
      WW.$("#clearAll").onclick = async () => { if (await WW.confirm("Clear all alerts?", "This removes every alert from the list.", "Clear", true)) { await WW.data.clearAlerts(); WW.reload(true); } };
    },
  };
})();
