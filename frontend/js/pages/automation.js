/* Automation: rule management (enable/disable, edit, delete, add), schedules, action log and weather-safety state.
   Demo mode simulates; Live mode only acts through the backend, and only when hardware is connected. Manual override always wins. */
(function () {
  let SUG = null, D = null, tab = "rules", LOG = null, W = null, CTRL = [];
  const TYPES = { occupancy_lights: ["Occupancy lighting", "person-standing", [["vacant_minutes", "Turn lights OFF after (minutes vacant)", 10]]],
    daylight_control: ["Daylight control", "sun", [["lux_threshold", "Daylight threshold (lux)", 300]]],
    temperature_fan: ["Smart fan control", "thermometer", [["on_above_c", "Fan ON above (°C)", 28], ["off_below_c", "Fan OFF below (°C)", 26]]],
    energy_saving: ["Energy-saving mode", "leaf", [["vacant_minutes", "Switch off idle loads after (minutes vacant)", 20]]],
    peak_shift: ["Peak-hour planning (pump)", "droplets", [["min_tank_percent", "Minimum tank level (%)", 30]]],
    weather_safety: ["Weather safety", "cloud-lightning", []], custom: ["Custom rule", "sliders-horizontal", []] };
  const ic = (t) => (TYPES[t] || TYPES.custom)[1];
  async function edit(rule) {
    const r = rule || { name: "", description: "", type: "occupancy_lights", enabled: true, params: {} };
    const body = document.createElement("div");
    const draw = (type) => `<div class="field"><label>Rule name</label><input class="input" id="rn" value="${WW.esc(r.name)}" maxlength="80"></div>
      <div class="field"><label>Description</label><textarea class="input" id="rd" rows="2">${WW.esc(r.description || "")}</textarea></div>
      ${rule ? "" : `<div class="field"><label>Rule type</label><select class="select" id="rt">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${k === type ? "selected" : ""}>${v[0]}</option>`).join("")}</select></div>`}
      ${(TYPES[type] || TYPES.custom)[2].map(([k, l, d]) => `<div class="field"><label>${l}</label><input class="input" type="number" data-p="${k}" value="${r.params[k] ?? d}" min="0"></div>`).join("")}
      <label class="check"><span class="switch"><input type="checkbox" id="re" ${r.enabled ? "checked" : ""}><span></span></span> Enabled</label>
      <div class="note mt">${WW.icon("shield-check", 16)}<span>Manual override always takes priority over automatic control.</span></div>`;
    body.innerHTML = draw(r.type); let type = r.type;
    body.addEventListener("change", (e) => { if (e.target.id === "rt") { r.name = WW.$("#rn", body).value; r.description = WW.$("#rd", body).value; type = e.target.value; r.params = {}; body.innerHTML = draw(type); } });
    const v = await WW.modal({ title: rule ? "Edit automation" : "New automation", body, actions: [{ label: "Cancel", value: null }, { label: "Save", primary: true, onClick: (bg) => {
      const name = WW.$("#rn", bg).value.trim(); if (!name) { WW.toast("Give the rule a name.", "err"); return false; }
      const params = {}; WW.$$("[data-p]", bg).forEach((i) => (params[i.dataset.p] = Number(i.value)));
      return { ...(rule || {}), name, description: WW.$("#rd", bg).value.trim(), type, enabled: WW.$("#re", bg).checked, params }; } }] });
    if (!v) return;
    try { const res = await WW.data.saveRule(v); if (res && res.ok === false) WW.toast(res.message || "Not saved", "err"); else WW.toast("Automation saved"); WW.reload(true); } catch (e) { WW.toast(e.message, "err"); }
  }
  async function schedDlg() {
    const body = document.createElement("div");
    body.innerHTML = `<div class="field"><label>Name</label><input class="input" id="sn" value="Pump run"></div><div class="field"><label>Time</label><input type="time" class="input" id="st" value="15:00"></div><div class="field"><label>Days</label><select class="select" id="sd"><option>Daily</option><option>Weekdays</option><option>Weekends</option></select></div>
    <div class="note">${WW.icon("info", 16)}<span>Schedules plan flexible loads (e.g. run the water pump before the evening peak). The tank-level safety rule always applies.</span></div>`;
    const v = await WW.modal({ title: "New schedule", body, actions: [{ label: "Cancel", value: null }, { label: "Add", primary: true, onClick: (bg) => ({ name: WW.$("#sn", bg).value || "Schedule", time: WW.$("#st", bg).value, days: WW.$("#sd", bg).value, load: "bathroom-pump" }) }] });
    if (!v) return; const r = await WW.data.saveSchedule(v); if (r.ok === false) WW.toast(r.message, "err"); else WW.toast("Schedule added"); WW.reload(true);
  }
  function rules() {
    return D.rules.map((r) => `<div class="rule" data-id="${r.id}"><span class="ri">${WW.icon(ic(r.type), 22)}</span><div class="grow"><div class="t">${WW.esc(r.name)} <span class="pill ${r.enabled ? "" : "grey"}">${r.status}</span></div><div class="d">${WW.esc(r.description)}</div>${r.lastRun ? `<div class="small muted">Last run: ${WW.fmt.when(r.lastRun)}</div>` : ""}</div>
      <label class="switch"><input type="checkbox" data-tg="${r.id}" ${r.enabled ? "checked" : ""} aria-label="Enable ${WW.esc(r.name)}"><span></span></label>
      <button class="iconbtn" data-ed="${r.id}" aria-label="Edit ${WW.esc(r.name)}">${WW.icon("pencil", 18)}</button><button class="iconbtn" data-del="${r.id}" style="color:var(--crit)" aria-label="Delete ${WW.esc(r.name)}">${WW.icon("trash-2", 18)}</button></div>`).join("") || `<p class="muted" style="padding:18px">No automation rules yet.</p>`;
  }
  function scheds() {
    return (D.schedules || []).map((s) => `<div class="rule"><span class="ri">${WW.icon("clock", 22)}</span><div class="grow"><div class="t">${WW.esc(s.name)}</div><div class="d">${s.days} at ${s.time} · load: ${WW.esc(s.load)}</div></div><label class="switch"><input type="checkbox" data-stg="${s.id}" ${s.enabled ? "checked" : ""}><span></span></label><button class="iconbtn" data-sdel="${s.id}" style="color:var(--crit)" aria-label="Delete schedule">${WW.icon("trash-2", 18)}</button></div>`).join("") || `<p class="muted" style="padding:18px">${WW.esc(D.schedulesNote || "No schedules yet.")}</p>`;
  }
  function log() {
    const l = LOG.log; return l.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Time</th><th>Room</th><th>Appliance</th><th>Action</th><th>Reason</th><th>By</th><th>Result</th></tr></thead><tbody>${l.map((x) => `<tr><td>${WW.fmt.when(x.time)}</td><td>${WW.esc(x.room || "")}</td><td>${WW.esc(x.appliance || "")}</td><td>${x.action}</td><td>${WW.esc(x.reason)}</td><td>${WW.esc(x.by)}</td><td><span class="pill ${x.result === "blocked" ? "warn" : ""}">${WW.esc(x.result)}</span></td></tr>`).join("")}</tbody></table></div>` : `<p class="muted" style="padding:18px">No automation actions recorded yet. Every action is logged with its reason.</p>`;
  }
  function suggestions() {
    if (!SUG || !SUG.available) return `<div style="padding:18px">${SUG && SUG.error ? WW.errorBox(SUG.error) : WW.emptyState("No suggestions available", (SUG && SUG.message) || "", "sparkles")}</div>`;
    if (!SUG.suggestions.length) return `<div style="padding:18px">${WW.emptyState("Nothing to suggest right now", "No avoidable consumption was found. Suggestions appear when appliances run in empty rooms or against a rule.", "circle-check")}</div>`;
    return `<div class="stack" style="padding:0 24px 24px">${WW.isSim(SUG) ? `<div class="note warn">${WW.icon("info", 16)}<span>Simulated suggestions. Applying one changes demo state only — no hardware is switched.</span></div>` : ""}${SUG.suggestions.map((g) => `<div class="suggest"><div class="row-between"><b>${WW.esc(g.title)}</b>${WW.pill("potential", "info")}</div>
      <div class="small">${WW.esc(g.reason)}</div><div class="chips-in">${g.impact.kwhMonth != null ? `<span>≈ ${WW.fmt.kwh(g.impact.kwhMonth)} / month</span>` : ""}${g.impact.pkrMonth != null ? `<span>≈ ${WW.fmt.pkr(g.impact.pkrMonth)} / month</span>` : ""}${g.impact.pkrPerHour != null ? `<span>≈ ${WW.fmt.pkr(g.impact.pkrPerHour)} / hour</span>` : ""}</div>
      <div class="acts"><button class="btn sm" data-sga="${WW.esc(g.id)}">${WW.icon("check", 14)} ${g.action === "turn_off" ? "Turn off" : "Enable rule"}</button><button class="btn ghost sm" data-sgd="${WW.esc(g.id)}">Keep as is</button></div></div>`).join("")}</div>`;
  }
  WW.page = {
    title: "Automation", subtitle: "Create smart rules to automatically control your home appliances.", showRange: false,
    async render() {
      const rooms = ["lounge", "bedroom", "bathroom"];
      const got = await Promise.all([WW.data.getAutomation(), WW.data.getAutomationLog(),
        WW.data.getWeather().catch(() => ({ state: "unknown", note: "Weather & safety status is not available yet." })),
        WW.data.getSuggestions().catch((e) => ({ available: false, error: e })),
        ...rooms.map((r) => WW.data.getAppliances(r, { key: "today" }).catch(() => null))]);
      [D, LOG, W, SUG] = got; CTRL = [];
      got.slice(4).forEach((a) => { if (a && a.available) a.appliances.forEach((x) => CTRL.push({ ...x, room: a.room.name })); });
      const st = W.state || "normal";
      return `<div class="banner ${WW.isSim(D) ? "demo" : "live"}">${WW.icon(WW.isSim(D) ? "info" : "shield-check", 18)} ${WW.isSim(D) ? "<b>DEMO</b> — automation is simulated. No relay, IR or contactor command is ever sent." : "<b>LIVE</b> — commands go through the backend and only when hardware is connected."} Manual override always wins.</div>
      <div class="grid g-side">
        <section class="card" style="padding:0"><div style="display:flex;gap:12px;padding:22px 24px;align-items:center;flex-wrap:wrap"><div class="chips" role="tablist">${[["rules", "Automation Rules", "layers"], ["schedules", "Schedules", "clock"], ["suggestions", "Suggested Actions", "sparkles"], ["log", "Action Log", "file-text"]].map(([k, l, i]) => `<button class="chip ${tab === k ? "on" : ""}" data-tab="${k}" role="tab">${WW.icon(i, 16)}${l}</button>`).join("")}</div><span style="flex:1"></span>
          <button class="btn" id="addBtn">${WW.icon("plus", 16)} ${tab === "schedules" ? "New Schedule" : "New Rule"}</button></div>
          <div>${tab === "rules" ? rules() : tab === "schedules" ? scheds() : tab === "suggestions" ? suggestions() : log()}</div></section>
        <div class="grid" style="align-content:start"><section class="card"><div class="card-h"><span class="hicon">${WW.icon("hand", 20)}</span><h3>Control status</h3></div>
          ${CTRL.length ? `<p class="small muted" style="margin-top:0"><b>${CTRL.filter((c) => c.mode === "manual").length}</b> of ${CTRL.length} appliances are under manual override. Manual always beats automation.</p>${CTRL.map((c) => `<div class="detail-row" style="padding:9px 0"><span class="k" style="min-width:0;overflow-wrap:anywhere">${WW.esc(c.room)} · ${WW.esc(c.name)}</span><span class="pill ${c.mode === "manual" ? "info" : ""}">${c.mode === "manual" ? "Manual" : "Auto"}</span>${c.mode === "manual" ? `<button class="btn ghost sm" data-auto="${c.id}">Return to Auto</button>` : ""}</div>`).join("")}` : `<p class="muted">Appliance control status is not available yet.</p>`}</section>
          <section class="card"><div class="card-h"><span class="hicon">${WW.icon("cloud-lightning", 20)}</span><h3>Weather &amp; Safety</h3><span class="grow"></span><a class="link" href="weather.html">Details ${WW.icon("arrow-right", 14)}</a></div>
          <div class="state-steps">${[["normal", "Normal monitoring"], ["advisory", "Advisory"], ["storm", "Storm-safety mode"]].map(([k, l]) => `<span class="pill ${st === k ? (k === "normal" ? "" : "warn") : "grey"}">${l}</span>`).join("")}</div>
          <p class="small muted mt">${WW.esc(W.note || "")}</p><div class="note">${WW.icon("shield-check", 16)}<span>An extra precaution only: it supplements, and does not replace, breakers, fuses or lightning protection. When occupancy is uncertain the system stays conservative.</span></div></section>
          <section class="card"><div class="card-h"><span class="hicon">${WW.icon("info", 20)}</span><h3>How it decides</h3></div><p class="small muted" style="margin:0">Rules are explainable: each action is logged with the reason (e.g. “no presence for 10 min”). Random Forest forecasts, when trained, only supply predictions; the rules decide and safety rules have the final say. ${WW.esc(D.executionNote || "")}</p></section></div></div>`;
    },
    after() {
      WW.$$("[data-sga]").forEach((x) => (x.onclick = async () => { x.disabled = true; try { const r = await WW.data.applySuggestion(x.dataset.sga); WW.toast(r.message || "Done", r.ok === false ? "err" : ""); } catch (e) { WW.toast(e.message, "err"); } WW.reload(true); }));
      WW.$$("[data-sgd]").forEach((x) => (x.onclick = async () => { try { const r = await WW.data.dismissSuggestion(x.dataset.sgd); WW.toast(r.message || "Kept as is"); } catch (e) { WW.toast(e.message, "err"); } WW.reload(true); }));
      WW.$$("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; WW.reload(true); }));
      WW.$("#addBtn").onclick = () => (tab === "schedules" ? schedDlg() : edit(null));
      WW.$$("[data-tg]").forEach((c) => (c.onchange = async () => { try { await WW.data.toggleRule(+c.dataset.tg); WW.toast(c.checked ? "Rule enabled" : "Rule disabled"); } catch (e) { WW.toast(e.message, "err"); } WW.reload(true); }));
      WW.$$("[data-ed]").forEach((b) => (b.onclick = () => edit(D.rules.find((r) => r.id === +b.dataset.ed))));
      WW.$$("[data-del]").forEach((b) => (b.onclick = async () => { const r = D.rules.find((x) => x.id === +b.dataset.del); if (await WW.confirm("Delete automation?", `“${r.name}” will be removed.`, "Delete", true)) { await WW.data.deleteRule(r.id); WW.toast("Rule deleted"); WW.reload(true); } }));
      WW.$$("[data-auto]").forEach((b) => (b.onclick = async () => { await WW.data.setApplianceMode(b.dataset.auto, "auto"); WW.toast("Returned to automatic control"); WW.reload(true); }));
      WW.$$("[data-stg]").forEach((c) => (c.onchange = async () => { await WW.data.toggleSchedule(+c.dataset.stg); WW.reload(true); }));
      WW.$$("[data-sdel]").forEach((b) => (b.onclick = async () => { await WW.data.deleteSchedule(+b.dataset.sdel); WW.reload(true); }));
    },
  };
})();
