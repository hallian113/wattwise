/* Settings: General, Tariff & Billing (fully configurable — nothing hard-coded), Notifications, Automation, System. */
(function () {
  let DEV = null, S = null, tab = sessionStorage.getItem("ww_set") || "general", M = null, SEN = null;
  const TABS = [["general", "General", "settings"], ["tariff", "Tariff & Billing", "receipt"], ["notifications", "Notifications", "bell"], ["devices", "Rooms & Devices", "house"], ["automation", "Automation", "layers"], ["system", "System", "cpu"]];
  const field = (l, inner, hint) => `<div class="form-row"><label>${l}</label><div>${inner}${hint ? `<div class="small muted" style="margin-top:4px">${hint}</div>` : ""}</div></div>`;
  const sw = (id, on) => `<label class="switch"><input type="checkbox" id="${id}" ${on ? "checked" : ""}><span></span></label>`;
  const val = (id) => WW.$("#" + id).value;
  function general() {
    const g = S.general;
    return `<h3 style="margin-bottom:6px">General Settings</h3>
    ${field("Home Name", `<input class="input" id="g_name" value="${WW.esc(g.home_name)}" maxlength="60">`)}
    ${field("Time Zone", `<select class="select" id="g_tz"><option value="Asia/Karachi">(GMT+05:00) Pakistan Standard Time</option></select>`)}
    ${field("Currency", `<input class="input" value="PKR (Pakistani Rupee)" disabled>`)}
    ${field("Temperature Unit", `<select class="select" id="g_tu"><option value="C" ${g.temp_unit === "C" ? "selected" : ""}>Celsius (°C)</option><option value="F" ${g.temp_unit === "F" ? "selected" : ""}>Fahrenheit (°F)</option></select>`)}
    ${field("Time Format", `<select class="select" id="g_tf"><option value="12h" ${g.time_format === "12h" ? "selected" : ""}>12-hour</option><option value="24h" ${g.time_format === "24h" ? "selected" : ""}>24-hour</option></select>`)}
    ${field("Default Room View", `<select class="select" id="g_room">${["lounge", "bedroom", "bathroom"].map((r) => `<option value="${r}" ${g.default_room === r ? "selected" : ""}>${r[0].toUpperCase() + r.slice(1)}</option>`).join("")}</select>`)}
    ${field("Data Update Interval", `<select class="select" id="g_int">${[["15s", "15 seconds"], ["1m", "1 minute"], ["5m", "5 minutes"]].map(([v, l]) => `<option value="${v}" ${g.update_interval === v ? "selected" : ""}>${l}</option>`).join("")}</select>`)}
    ${field("Theme", `<div class="chips"><button class="chip ${g.theme !== "dark" ? "on" : ""}" data-theme="light">${WW.icon("sun", 16)} Light</button><button class="chip ${g.theme === "dark" ? "on" : ""}" data-theme="dark">${WW.icon("moon", 16)} Dark</button></div>`)}
    ${field("Data mode", `<span class="badge ${WW.mode.get()}">${WW.mode.isDemo() ? "Demo Data" : "Live Data"}</span>`, "Switch with the Demo / Live toggle in the header. Demo data is simulated and never mixed with live readings.")}
    <div style="text-align:right"><button class="btn" id="saveGen">Save changes</button></div>`;
  }
  const slabRows = (key) => S.tariff[key + "_slabs"].map((s, i) => `<tr><td><input class="input" type="number" min="1" data-s="${key}" data-i="${i}" data-f="from" value="${s.from}"></td><td><input class="input" type="number" data-s="${key}" data-i="${i}" data-f="to" value="${s.to ?? ""}" placeholder="and above"></td><td><input class="input" type="number" step="0.01" min="0" data-s="${key}" data-i="${i}" data-f="rate" value="${s.rate}"></td><td><button class="iconbtn" data-rm="${key}:${i}" aria-label="Remove slab">${WW.icon("trash-2", 16)}</button></td></tr>`).join("");
  function tariff() {
    const t = S.tariff, th = t.alerts.thresholds, lim = t.monthly_limit;
    const std = [150, 180, 190, 200], all = [...new Set([...std, ...th])].sort((a, b) => a - b);
    return `<h3 style="margin-bottom:4px">Tariff &amp; Billing</h3><p class="muted" style="margin-top:0">Configure electricity tariff and billing preferences (Pakistan – Residential). Bills are <b>estimates</b>.</p>
    ${t.example ? `<div class="note warn" style="margin-bottom:14px">${WW.icon("triangle-alert", 16)}<span><b>Example rates.</b> Replace these with the rates on your latest bill / NEPRA notification. Nothing is hard-coded — edit and save.</span></div>` : ""}
    <div class="grid g2" style="gap:22px"><div>
      <h4 style="margin-bottom:8px">Consumer Category</h4><div class="chips" id="catChips"><button class="chip ${t.category === "protected" ? "on" : ""}" data-cat="protected">Protected (≤ ${lim} units)</button><button class="chip ${t.category === "unprotected" ? "on" : ""}" data-cat="unprotected">Unprotected (&gt; ${lim} units)</button></div>
      <p class="small muted">Assumption: protected status can depend on your recent consumption history. WattWise bills a protected home on unprotected slabs once it exceeds the limit — change the category manually if your bill says otherwise.</p>
      <h4 style="margin:14px 0 8px">Billing method</h4><select class="select" id="t_method"><option value="telescopic" ${t.method === "telescopic" ? "selected" : ""}>Telescopic — each slab billed at its own rate</option><option value="flat_slab" ${t.method === "flat_slab" ? "selected" : ""}>Flat — all units at the slab rate reached</option></select>
      <h4 style="margin:14px 0 8px">Protected slabs (Rs. / unit)</h4><table class="tbl"><thead><tr><th>From</th><th>To</th><th>Rate</th><th></th></tr></thead><tbody>${slabRows("protected")}</tbody></table><button class="btn ghost sm mt" data-add="protected">${WW.icon("plus", 14)} Add slab</button>
      <h4 style="margin:14px 0 8px">Unprotected slabs (Rs. / unit)</h4><div class="scroll-x"><table class="tbl"><thead><tr><th>From</th><th>To</th><th>Rate</th><th></th></tr></thead><tbody>${slabRows("unprotected")}</tbody></table></div><button class="btn ghost sm mt" data-add="unprotected">${WW.icon("plus", 14)} Add slab</button>
      <h4 style="margin:18px 0 6px">Charges &amp; adjustments</h4>
      ${field("Fixed charge (Rs./month)", `<input class="input" type="number" step="0.01" min="0" id="t_fixed" value="${t.fixed_charge}">`)}${field("Adjustment (Rs./unit)", `<input class="input" type="number" step="0.01" id="t_adj" value="${t.adjustment_per_unit}">`, "e.g. fuel price adjustment, if on your bill")}${field("Tax / GST (%)", `<input class="input" type="number" step="0.1" min="0" id="t_tax" value="${t.tax_percent}">`)}
    </div><div>
      <h4 style="margin-bottom:8px">Monthly Limit &amp; Alerts</h4>
      ${field("Protected limit (units)", `<input class="input" type="number" min="1" id="t_lim" value="${lim}">`)}
      <div class="small muted" style="margin-bottom:4px">Alert thresholds (units)</div>${all.map((x) => `<label class="check"><input type="checkbox" data-th="${x}" ${th.includes(x) ? "checked" : ""}> ${x} units (${Math.round(x / lim * 100)}%)</label>`).join("")}
      <div style="display:flex;gap:8px;margin:6px 0"><input class="input" type="number" id="t_newth" placeholder="Custom units" style="width:130px"><button class="btn ghost sm" id="addTh">Add</button></div>
      ${field("Alert if usage exceeds usual by (%)", `<input class="input" type="number" min="1" id="t_inc" value="${t.alerts.increase_percent}">`)}
      <label class="check">${sw("t_alerts", t.alerts.enabled)} Enable threshold alerts</label>
      <h4 style="margin:18px 0 6px">Peak / off-peak (time-of-use)</h4>
      <label class="check">${sw("t_tou", t.tou.enabled)} Use time-of-use rates</label>
      ${field("Peak window", `<div style="display:flex;gap:8px"><input type="time" class="input" id="t_ps" value="${t.tou.peak_start}"><input type="time" class="input" id="t_pe" value="${t.tou.peak_end}"></div>`, "Taken from your bill (e.g. 18:00–22:00).")}
      ${field("Peak rate (Rs./unit)", `<input class="input" type="number" step="0.01" min="0" id="t_pr" value="${t.tou.peak_rate}">`)}${field("Off-peak rate (Rs./unit)", `<input class="input" type="number" step="0.01" min="0" id="t_or" value="${t.tou.offpeak_rate}">`)}
      <h4 style="margin:18px 0 6px">Billing period &amp; bill numbers</h4>
      ${field("Billing period starts on day", `<input class="input" type="number" min="1" max="28" id="t_day" value="${t.billing.period_start_day}">`)}
      ${field("Last month's units", `<input class="input" type="number" min="0" id="t_last" value="${t.billing.last_month_units ?? ""}">`)}
      ${field("Meter start reading (kWh)", `<input class="input" type="number" min="0" id="t_start" value="${t.billing.start_reading_kwh ?? ""}">`)}
      ${field("Unmetered load (kWh/day)", `<input class="input" type="number" step="0.1" min="0" id="t_unm" value="${t.billing.unmetered_kwh_per_day || 0}">`, "Rest of the house not on a meter — estimated, not measured.")}
      <h4 style="margin:18px 0 6px">Bill estimator</h4><div style="display:flex;gap:8px;align-items:center"><input class="input" type="number" id="t_eu" value="176" style="width:110px"><button class="btn ghost sm" id="estBtn">Estimate</button></div><div id="estOut" class="small" style="margin-top:8px"></div>
    </div></div><div style="text-align:right;margin-top:16px"><button class="btn ghost" id="resetT">Restore example rates</button> <button class="btn" id="saveT">Save tariff</button></div>`;
  }
  function notifications() {
    const n = S.general.notifications || {};
    return `<h3>Notifications</h3>${field("Dashboard alerts", sw("n_dash", n.dashboard !== false))}${field("Email alerts", sw("n_mail", n.email), "Needs SMTP settings in the backend .env")}${field("Local buzzer", sw("n_buz", n.buzzer !== false), "Used for safety alerts by the ESP32 node")}<div style="text-align:right"><button class="btn" id="saveN">Save</button></div>`;
  }
  function devices() {
    if (!DEV) return `<h3>Rooms &amp; Devices</h3><p class="muted">Device list is not available.</p>`;
    return `<h3>Rooms &amp; Devices</h3><p class="muted" style="margin-top:4px">Rated power is used for estimates when an appliance has no meter, and as the label on each appliance card. Metering shows whether a real energy meter is attached.</p>
    ${DEV.rooms.map((r) => `<h4 style="margin:18px 0 8px">${WW.icon(WW.roomIcon(r.id), 16)} ${WW.esc(r.name)} <span class="small muted" style="font-weight:500">· ${WW.esc(r.node)}</span></h4><div class="scroll-x"><table class="tbl"><thead><tr><th>Appliance</th><th>Rated (W)</th><th>Control</th><th>Metering</th><th>Socket</th><th></th></tr></thead><tbody>
      ${r.appliances.map((a) => `<tr><td>${WW.icon(WW.kindIcon(a.kind), 16)} ${WW.esc(a.name)}</td><td><input class="input" type="number" min="0" max="25000" style="width:96px" data-rated="${a.id}" value="${a.rated}" aria-label="Rated watts for ${WW.esc(a.name)}"></td><td>${WW.esc(a.controlType)}</td><td>${a.metered ? '<span class="pill">meter</span>' : '<span class="pill grey">no meter</span>'}</td><td>${a.socketId || "—"}</td><td><button class="btn ghost sm" data-saverated="${a.id}">Save</button></td></tr>`).join("")}</tbody></table></div>`).join("")}
    <div class="note mt">${WW.icon("info", 16)}<span>Room names, the three-room layout and hardware wiring are fixed for this prototype. Socket-to-device mapping is edited on the Appliances page.</span></div>`;
  }
  const automationTab = () => `<h3>Automation preferences</h3><div class="note" style="margin:12px 0">${WW.icon("shield-check", 16)}<span><b>Manual override always has priority</b> over automatic control. When occupancy is uncertain the system takes the conservative option.</span></div>
    <div class="note">${WW.icon("info", 16)}<span>Hardware commands are sent only when: Live mode is on, the backend has <code>ALLOW_HARDWARE_CONTROL=true</code>, the MQTT broker is connected and the room node is online. Demo mode never controls hardware. Manage rules on the <a class="link" href="automation.html">Automation</a> page.</span></div>`;
  function system() {
    const online = SEN ? SEN.rooms : [];
    return `<h3>System</h3>${field("Data mode", `<span class="badge ${WW.mode.get()}">${WW.mode.isDemo() ? "Demo Data" : "Live Data"}</span>`)}
    ${M ? `${field("Database", `<b>${WW.esc(M.database)}</b>`)}${field("MQTT", `<b>${M.mqttEnabled ? (M.mqttConnected ? "Connected" : "Enabled, not connected") : "Disabled"}</b>`)}${field("Hardware control", `<b>${M.hardwareControlAllowed ? "Allowed" : "Disabled (safe default)"}</b>`)}${field("Last real reading", `<b>${M.lastReadingAt ? WW.fmt.when(M.lastReadingAt) : "None yet — waiting for sensor data"}</b>`)}` : ""}
    <h4 style="margin:16px 0 8px">Sensor &amp; node connection status ${SEN && SEN.simulated ? '<span class="pill warn">simulated</span>' : ""}</h4>
    <div class="grid g3">${online.map((r) => `<div class="card" style="box-shadow:none;border:1px solid var(--line);padding:14px"><b>${WW.icon(WW.roomIcon(r.id), 16)} ${r.name}</b><div class="small muted">${WW.esc(r.node)}</div>${r.components.map((c) => `<div style="display:flex;justify-content:space-between;gap:8px;margin-top:6px"><span class="small">${WW.esc(c.component)}</span><span class="pill ${c.state === "online" ? "" : c.state === "simulated" ? "warn" : "grey"}">${c.state}</span></div>`).join("")}</div>`).join("")}</div>
    <p class="small muted">“not connected” = this hardware has never reported. Nothing here is faked in Live mode.</p>
    <h4 style="margin:18px 0 8px">API connection</h4>
    <div class="grid g2"><div class="field"><label for="api_base">Backend base URL <span class="small muted">(empty = same origin)</span></label><input class="input" id="api_base" value="${WW.esc(WW.config.API_BASE_URL)}" placeholder="http://localhost:8000" autocomplete="off"></div>
      <div class="field" style="align-self:end"><div class="chips"><button class="btn ghost sm" id="apiSave">Apply</button><button class="btn ghost sm" id="apiTest">${WW.icon("activity", 14)} Test connection</button></div></div></div>
    <div id="apiStatus" class="small" role="status" style="margin:6px 0">Requests go to <b>${WW.esc(WW.config.API_BASE_URL || location.origin)}${WW.esc(WW.config.API_PREFIX)}</b>. ${WW.api.status.lastOkAt ? "Last successful call " + WW.fmt.when(WW.api.status.lastOkAt) + "." : ""}</div>
    <div class="grid g2"><label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="mockOn" ${WW.api.isMock() ? "checked" : ""}> Use the Mock API adapter in Live mode (frontend testing only)</label>
      <label class="small" style="display:flex;gap:8px;align-items:center">Mock scenario <select class="select" id="mockSc">${WW.api.mock.scenarios.map((k) => `<option ${k === WW.api.mock.scenario() ? "selected" : ""}>${k}</option>`).join("")}</select></label></div>
    <details class="mt"><summary class="small" style="cursor:pointer">Endpoint readiness (${WW.api.endpointList().filter((e) => e.status === "required").length} still to be implemented by the backend)</summary>
      <div class="scroll-x mt-s"><table class="tbl"><thead><tr><th>Module</th><th>Method</th><th>Path</th><th>Backend</th></tr></thead><tbody>${WW.api.endpointList().map((e) => `<tr><td>${e.module}</td><td>${e.method}</td><td class="small"><code>${WW.esc(e.path)}</code></td><td>${e.status === "prototype" ? WW.pill("in prototype", "ok") : WW.pill("to implement", "warn")}</td></tr>`).join("")}</tbody></table></div></details>
    ${WW.mode.isDemo() ? `<div style="margin-top:14px"><button class="btn ghost" id="resetDemo">Reset demo data</button></div>` : ""}`;
  }
  function readTariff() {
    const t = S.tariff, n = (id) => Number(val(id)), opt = (id) => (val(id) === "" ? null : Number(val(id)));
    t.method = val("t_method"); t.fixed_charge = n("t_fixed"); t.adjustment_per_unit = n("t_adj"); t.tax_percent = n("t_tax"); t.monthly_limit = n("t_lim");
    t.alerts.increase_percent = n("t_inc"); t.alerts.enabled = WW.$("#t_alerts").checked;
    t.alerts.thresholds = WW.$$("[data-th]").filter((c) => c.checked).map((c) => +c.dataset.th).sort((a, b) => a - b);
    t.tou = { enabled: WW.$("#t_tou").checked, peak_start: val("t_ps"), peak_end: val("t_pe"), peak_rate: n("t_pr"), offpeak_rate: n("t_or") };
    t.billing = { ...t.billing, period_start_day: Math.max(1, Math.min(28, n("t_day") || 1)), last_month_units: opt("t_last"), start_reading_kwh: opt("t_start"), unmetered_kwh_per_day: n("t_unm") || 0 };
    WW.$$("[data-s]").forEach((i) => { const s = t[i.dataset.s + "_slabs"][+i.dataset.i]; s[i.dataset.f] = i.value === "" ? null : Number(i.value); });
  }
  function validate() {
    for (const k of ["protected", "unprotected"]) { let prev = 0; for (const s of S.tariff[k + "_slabs"]) { if (s.rate == null || s.rate < 0 || s.from == null || s.from < 1) return "Slab rates must be ≥ 0 and slabs must start at 1."; if (s.from <= prev) return `${k} slabs must be in ascending order.`; prev = s.to == null ? 1e9 : s.to; } }
    return null;
  }
  WW.page = {
    title: "Settings", subtitle: "Manage your home configuration and system preferences.", showRange: false, autoRefresh: false,
    async render() {
      S = await WW.data.getSettings(); try { M = WW.mode.isDemo() ? null : await WW.live.mode(); } catch (e) { M = null; }
      try { SEN = await WW.data.getSensors(); } catch (e) { SEN = null; }
      try { DEV = await WW.data.getDevices(); } catch (e) { DEV = null; }
      return `<div class="set-grid"><nav class="card side-tabs scroll-x" style="align-self:start;padding:12px" aria-label="Settings sections">${TABS.map(([k, l, i]) => `<button class="${tab === k ? "on" : ""}" data-tab="${k}">${WW.icon(i, 18)}${l}</button>`).join("")}</nav>
        <section class="card" id="panel">${{ general, tariff, notifications, devices, automation: automationTab, system }[tab]()}</section></div>`;
    },
    after() {
      WW.$$("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; sessionStorage.setItem("ww_set", tab); WW.reload(); }));
      const rerender = () => { WW.$("#panel").innerHTML = tariff(); this_after(); };
      const this_after = () => WW.page.afterPanel();
      WW.page.afterPanel = () => {
        const ab = WW.$("#apiSave");
        if (ab) {
          ab.onclick = () => { const v = WW.validate.url(WW.$("#api_base").value); if (!v.ok) return WW.toast(v.message, "err"); WW.config.setApiBase(v.value); WW.toast("Backend URL applied for this browser session."); };
          WW.$("#apiTest").onclick = async () => { const el = WW.$("#apiStatus"); el.textContent = "Testing…"; const t0 = performance.now(); try { const r = await WW.api.services.system.health(); el.innerHTML = `<span class="pill ok">Connected</span> ${WW.esc(r.status || "ok")} · ${Math.round(performance.now() - t0)} ms${WW.api.isMock() ? " (mock adapter — no real backend contacted)" : ""}`; } catch (e) { el.innerHTML = `<span class="pill crit">Failed</span> ${WW.esc(e.message)}`; } };
          WW.$("#mockOn").onchange = (e) => { WW.api.mock.set({ enabled: e.target.checked }); location.reload(); };
          WW.$("#mockSc").onchange = (e) => { WW.api.mock.set({ scenario: e.target.value }); WW.toast("Mock scenario: " + e.target.value); };
        }
        WW.$$("[data-theme]").forEach((b) => (b.onclick = () => { S.general.theme = b.dataset.theme; WW.savePrefs({ theme: S.general.theme }); WW.$$("[data-theme]").forEach((x) => x.classList.toggle("on", x === b)); }));
        const sg = WW.$("#saveGen"); if (sg) sg.onclick = async () => { Object.assign(S.general, { home_name: val("g_name"), timezone: val("g_tz"), temp_unit: val("g_tu"), time_format: val("g_tf"), default_room: val("g_room"), update_interval: val("g_int") });
          WW.savePrefs({ tempUnit: S.general.temp_unit, timeFormat: S.general.time_format, theme: S.general.theme }); try { await WW.data.saveGeneral({ ...S.general }); WW.toast("Settings saved"); } catch (e) { WW.toast(e.message, "err"); } };
        const sn = WW.$("#saveN"); if (sn) sn.onclick = async () => { S.general.notifications = { dashboard: WW.$("#n_dash").checked, email: WW.$("#n_mail").checked, buzzer: WW.$("#n_buz").checked }; try { await WW.data.saveGeneral({ ...S.general }); WW.toast("Notification preferences saved"); } catch (e) { WW.toast(e.message, "err"); } };
        WW.$$("[data-cat]").forEach((b) => (b.onclick = () => { readTariff(); S.tariff.category = b.dataset.cat; rerender(); }));
        WW.$$("[data-add]").forEach((b) => (b.onclick = () => { readTariff(); const a = S.tariff[b.dataset.add + "_slabs"], last = a[a.length - 1]; if (last) { if (last.to == null) last.to = last.from + 99; a.push({ from: last.to + 1, to: null, rate: last.rate }); } else a.push({ from: 1, to: null, rate: 0 }); rerender(); }));
        WW.$$("[data-rm]").forEach((b) => (b.onclick = () => { readTariff(); const [k, i] = b.dataset.rm.split(":"); S.tariff[k + "_slabs"].splice(+i, 1); rerender(); }));
        const at = WW.$("#addTh"); if (at) at.onclick = () => { readTariff(); const v = Number(val("t_newth")); if (v > 0 && !S.tariff.alerts.thresholds.includes(v)) S.tariff.alerts.thresholds.push(v); rerender(); };
        const eb = WW.$("#estBtn"); if (eb) eb.onclick = async () => { readTariff(); const e = validate(); if (e) return WW.toast(e, "err"); const u = Number(val("t_eu")); const r = { bill: WW.tariff.bill(u, S.tariff), slab: WW.tariff.slab(u, S.tariff) };
          WW.$("#estOut").innerHTML = `<b>≈ Rs. ${Math.round(r.bill.total)}</b> for ${u} units (${r.bill.category} slabs) — <i>estimate, not an official bill.</i>`; };
        const st = WW.$("#saveT"); if (st) st.onclick = async () => { readTariff(); const e = validate(); if (e) return WW.toast(e, "err"); try { await WW.data.saveTariff(S.tariff); S.tariff.example = false; WW.toast("Tariff saved — all estimates now use these rates"); WW.reload(); } catch (x) { WW.toast(x.message, "err"); } };
        const rt = WW.$("#resetT"); if (rt) rt.onclick = async () => { S.tariff = WW.tariff.clone(WW.tariff.DEFAULT); S.tariff.billing.period_start_day = WW.mode.isDemo() ? S.tariff.billing.period_start_day : 1; rerender(); WW.toast("Example rates restored — click Save to apply"); };
        WW.$$("[data-saverated]").forEach((b) => (b.onclick = async () => { const id = b.dataset.saverated, v = Number(WW.$(`[data-rated="${id}"]`).value); try { const r = await WW.data.saveApplianceConfig(id, v); if (r.ok === false) WW.toast(r.message, "err"); else WW.toast("Rated power saved"); } catch (e) { WW.toast(e.message, "err"); } }));
        const rd = WW.$("#resetDemo"); if (rd) rd.onclick = async () => { if (await WW.confirm("Reset demo data?", "Resets simulated toggles, rules, alerts and tariff to the defaults.", "Reset")) { await WW.demo.reset(); WW.toast("Demo data reset"); WW.reload(); } };
      };
      WW.page.afterPanel();
    },
  };
})();
