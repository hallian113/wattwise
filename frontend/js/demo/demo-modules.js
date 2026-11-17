/* DEMO data for the module pages (M1, M3–M6, M8–M10, M13).
   Everything here is derived from the SAME simulated home as js/demo-service.js (same rooms, appliances, occupancy and energy model),
   so totals, costs and waste figures agree across pages. Every payload is marked source:"demo" / simulated:true.
   Nothing here is a real measurement, a real forecast, real weather or a trained model — the pages label it that way. */
(function () {
  const M = WW.demo.__model, { ROOMS, APPS, occHour, occupancyNow, appHourly, appHourlyToday, applianceNow, monthToDate, cfg, day0, addDays, ds, hourLabel, r2, rnd, wrap } = M;
  const now = M.now, T = WW.tariff;
  const iso = (d) => d.toISOString();
  const rate = () => T.marginal(monthToDate().units, cfg());
  const roomName = (id) => (ROOMS.find((r) => r.id === id) || {}).name || id;
  const peakHours = () => { const t = cfg().tou; return [parseInt(t.peak_start), parseInt(t.peak_end)]; };

  /* deterministic environment for any hour (same formula family as the live-looking envNow) */
  function envAt(room, d, h) {
    const r = rnd(`envh${room}${ds(d)}${h}`)();
    return { temperature: +(23 + 6 * Math.sin(((h - 9) / 24) * 2 * Math.PI) + r * 1.2 + (room === "bathroom" ? -1 : 0)).toFixed(1), humidity: Math.round(45 + r * 15), lux: Math.round(h > 6 && h < 18 ? 150 + Math.sin(((h - 6) / 12) * Math.PI) * 600 : 20 + r * 30) };
  }
  /* occupied | vacant | uncertain — "uncertain" during the first 5 minutes after a change (grace period) */
  function occState(room) { const o = occupancyNow(room); return { ...o, state: o.sinceMin < 5 ? "uncertain" : o.state }; }
  const LUX_DAYLIGHT = 300, FAN_COMFORT = 26, AC_COMFORT = 24, GRACE_MIN = 5;
  const dayList = (range) => {
    const n = now(), t0 = day0(n), k = range && range.key;
    if (k === "yesterday") return [addDays(t0, -1)];
    if (k === "7d") return Array.from({ length: 7 }, (_, i) => addDays(t0, i - 6));
    if (k === "30d") return Array.from({ length: 30 }, (_, i) => addDays(t0, i - 29));
    if (k === "custom" && range.start && range.end) { const out = []; for (let d = day0(new Date(range.start + "T00:00:00")); d <= day0(new Date(range.end + "T00:00:00")) && d <= t0; d = addDays(d, 1)) out.push(d); return out.length ? out : [t0]; }
    return [t0];
  };
  const hoursOf = (a, d) => (ds(d) === ds(now()) ? appHourlyToday(a) : appHourly(a, d));

  /* ============ M1 sensors ============ */
  function getSensorReadings() {
    const t = iso(now());
    return wrap({ simulated: true, generatedAt: t, note: "Simulated readings. In Live mode these come from the ESP32 nodes via MQTT → backend; no value is ever invented there.",
      thresholds: { luxDaylight: LUX_DAYLIGHT, staleAfterSec: 120, tempRangeC: [-10, 60], humidityRange: [0, 100] },
      rooms: ROOMS.map((r) => { const e = M.envNow(r.id), o = occState(r.id);
        const v = (value, unit) => ({ value, unit, status: "ok", ts: t, measurement: "simulated" });
        return { id: r.id, name: r.name, node: r.node, nodeOnline: true, lastSeen: t,
          readings: { temperatureC: v(e.temperature, "°C"), humidity: v(e.humidity, "%"), lux: v(e.lux, "lx"),
            presence: { value: o.state === "occupied", state: o.state, ld2410: o.sensors.ld2410, pir: o.sensors.pir, status: "ok", ts: t, measurement: "simulated" },
            door: { value: "closed", status: "ok", ts: t, measurement: "simulated" } }, quality: [] }; }) });
  }
  function getSensorHistory(room, hours = 24) {
    const labels = [], temperatureC = [], humidity = [], lux = [], n = now();
    for (let i = hours - 1; i >= 0; i--) { const t = new Date(n.getTime() - i * 36e5), e = envAt(room, day0(t), t.getHours()); labels.push(hourLabel(t.getHours())); temperatureC.push(e.temperature); humidity.push(e.humidity); lux.push(e.lux); }
    return wrap({ simulated: true, room, hours, labels, temperatureC, humidity, lux });
  }

  /* ============ M3 occupancy ============ */
  function getOccupancy() {
    const n = now(), d = day0(n), H = n.getHours();
    return wrap({ simulated: true, generatedAt: iso(n),
      detection: { gracePeriodMin: GRACE_MIN, sources: ["LD2410 mmWave radar", "PIR motion sensor", "Reed switch (door)"], policy: "Conservative when uncertain: no automatic switch-off while a room is uncertain.", note: "Simulated presence; the real classification is made by the backend from the three sensors, time and appliance history." },
      rooms: ROOMS.map((r) => { const o = occState(r.id), e = M.envNow(r.id);
        const timeline = Array.from({ length: 24 }, (_, h) => ({ hour: h, state: h > H ? "future" : h === H && o.state === "uncertain" ? "uncertain" : occHour(r.id, d, h) ? "occupied" : "vacant" }));
        const occupiedHoursToday = r2(timeline.filter((x) => x.state === "occupied").length - (H < 23 ? 1 - n.getMinutes() / 60 : 0) * (timeline[H].state === "occupied" ? 1 : 0));
        return { id: r.id, name: r.name, state: o.state, sinceMin: o.sinceMin, sensors: o.sensors,
          context: { temperatureC: e.temperature, humidity: e.humidity, lux: e.lux, daylightSufficient: e.lux >= LUX_DAYLIGHT, comfort: e.temperature > FAN_COMFORT + 2 ? "above" : e.temperature < FAN_COMFORT - 2 ? "below" : "within" },
          today: { occupiedHours: Math.max(0, occupiedHoursToday), transitions: timeline.filter((x, i, a) => i && x.state !== "future" && a[i - 1].state !== x.state).length }, timeline,
          history7d: Array.from({ length: 7 }, (_, i) => { const dd = addDays(d, i - 7); let c = 0; for (let h = 0; h < 24; h++) c += occHour(r.id, dd, h); return { date: ds(dd), label: dd.toLocaleDateString("en-GB", { weekday: "short" }), occupiedHours: c }; }) }; }) });
  }

  /* ============ M4 context-aware analysis ============ */
  function verdictFor(a, occ, env) {
    const on = applianceNow(a), r = rate();
    const pkr = r2((on.power / 1000) * r);
    const base = { id: a.id, room: a.room, roomName: roomName(a.room), appliance: a.name, kind: a.kind, on: on.on, powerW: on.power, pkrPerHour: pkr,
      inputs: { occupancy: occ.state, sinceMin: occ.sinceMin, lux: env.lux, daylightSufficient: env.lux >= LUX_DAYLIGHT, temperatureC: env.temperature } };
    if (!on.on) return { ...base, verdict: "off", reason: "Appliance is off — nothing to evaluate.", rule: null };
    const vac = occ.state === "vacant", unc = occ.state === "uncertain";
    const out = (verdict, reason, rule) => ({ ...base, verdict, reason, rule });
    if (unc) return out("uncertain", `Occupancy of the ${roomName(a.room).toLowerCase()} is uncertain (sensors changed less than ${GRACE_MIN} min ago). The conservative policy takes no action.`, "Conservative default when occupancy is uncertain");
    if (a.kind === "pump") return out("justified", "Pump follows its tank-level cycle; it is not tied to room occupancy.", "Pump runs on tank level");
    if (vac) return out("avoidable", `The ${roomName(a.room).toLowerCase()} has been vacant for about ${Math.round(occ.sinceMin)} min while the ${a.name.toLowerCase()} is on.`, "Appliance on while room vacant");
    if (a.kind === "light" && env.lux >= LUX_DAYLIGHT) return out("avoidable", `Room is occupied but daylight is sufficient (${env.lux} lx ≥ ${LUX_DAYLIGHT} lx).`, `Lights on while daylight ≥ ${LUX_DAYLIGHT} lx`);
    if (a.kind === "fan" && env.temperature < FAN_COMFORT) return out("avoidable", `Temperature ${env.temperature} °C is below the ${FAN_COMFORT} °C comfort limit.`, `Fan on while temperature < ${FAN_COMFORT} °C`);
    if (a.kind === "ac" && env.temperature < AC_COMFORT) return out("avoidable", `Temperature ${env.temperature} °C is already below ${AC_COMFORT} °C — the AC is over-cooling.`, `AC on while temperature < ${AC_COMFORT} °C`);
    return out("justified", `Room is occupied${a.kind === "light" ? " and daylight is low" : a.kind === "fan" || a.kind === "ac" ? ` and ${env.temperature} °C is above the comfort limit` : ""}.`, "Room occupied");
  }
  function getContext() {
    const n = now(), items = APPS.map((a) => verdictFor(a, occState(a.room), M.envNow(a.room)));
    const running = items.filter((i) => i.on), cnt = (v) => running.filter((i) => i.verdict === v).length;
    const y = addDays(day0(n), -1), labels = [], energyKwh = [], occupiedRooms = [], temperatureC = [], lux = [];
    let occKwh = 0, vacKwh = 0, dayLight = 0;
    for (let h = 0; h < 24; h++) { let e = 0, oc = 0, t = 0, lx = 0;
      ROOMS.forEach((r) => { oc += occHour(r.id, y, h); const en = envAt(r.id, y, h); t += en.temperature; lx += en.lux; });
      APPS.forEach((a) => { const v = appHourly(a, y)[h]; e += v; if (occHour(a.room, y, h)) occKwh += v; else vacKwh += v; if (a.kind === "light" && envAt(a.room, y, h).lux >= LUX_DAYLIGHT) dayLight += v; });
      labels.push(hourLabel(h)); energyKwh.push(r2(e)); occupiedRooms.push(oc); temperatureC.push(+(t / ROOMS.length).toFixed(1)); lux.push(Math.round(lx / ROOMS.length)); }
    return wrap({ simulated: true, generatedAt: iso(n), thresholds: { luxDaylight: LUX_DAYLIGHT, fanComfortC: FAN_COMFORT, acComfortC: AC_COMFORT, graceMin: GRACE_MIN },
      summary: { running: running.length, justified: cnt("justified"), avoidable: cnt("avoidable"), uncertain: cnt("uncertain"), avoidableWattsNow: running.filter((i) => i.verdict === "avoidable").reduce((s, i) => s + i.powerW, 0), avoidablePkrPerHour: r2(running.filter((i) => i.verdict === "avoidable").reduce((s, i) => s + i.pkrPerHour, 0)) },
      items, correlation: { period: "Yesterday (full day)", labels, energyKwh, occupiedRooms, temperatureC, lux },
      split: { period: "Yesterday (full day)", occupiedKwh: r2(occKwh), vacantKwh: r2(vacKwh), daylightLightingKwh: r2(dayLight) },
      notes: ["Verdicts follow the explainable rules shown with each row; thresholds are example defaults.", "Loads below ~0.4 W (true standby) cannot be measured by the PZEM-004T meter, so they are not tracked."] });
  }

  /* ============ M6 waste detection ============ */
  function getWaste(range) {
    const days = dayList(range), r = rate(), events = [], byApp = {};
    APPS.forEach((a) => { byApp[a.id] = { id: a.id, name: a.name, room: roomName(a.room), kind: a.kind, idleKwh: 0, contextKwh: 0, events: 0, minutes: 0 }; });
    days.forEach((d) => APPS.forEach((a) => { if (a.kind === "pump") return; const hv = hoursOf(a, d); let cur = null;
      const flush = () => { if (!cur) return; const dur = cur.end - cur.start + 1;
        const exp = { vacant: `${a.name} used energy while the ${roomName(a.room).toLowerCase()} was vacant.`, daylight: `Lights were on in an occupied room while daylight was sufficient (≥ ${LUX_DAYLIGHT} lx).`, comfort: `${a.name} ran while the temperature was already below the comfort limit.` }[cur.cause];
        events.push({ id: `${a.id}-${ds(d)}-${cur.start}`, date: ds(d), start: new Date(d.getTime() + cur.start * 36e5).toISOString(), end: new Date(d.getTime() + (cur.end + 1) * 36e5).toISOString(), durationMin: dur * 60, room: roomName(a.room), appliance: a.name, applianceId: a.id,
          kwh: r2(cur.kwh), pkr: r2(cur.kwh * r), cause: cur.cause, explanation: exp, status: ds(d) === ds(now()) && cur.end === now().getHours() && applianceNow(a).on ? "ongoing" : "detected", measurement: "estimated" });
        const b = byApp[a.id]; if (cur.cause === "vacant") b.idleKwh += cur.kwh; else b.contextKwh += cur.kwh; b.events++; b.minutes += dur * 60; cur = null; };
      hv.forEach((v, h) => { let cause = null;
        if (v > 0) { const occ = occHour(a.room, d, h), e = envAt(a.room, d, h);
          if (!occ) cause = "vacant"; else if (a.kind === "light" && e.lux >= LUX_DAYLIGHT) cause = "daylight"; else if (a.kind === "fan" && e.temperature < FAN_COMFORT) cause = "comfort"; else if (a.kind === "ac" && e.temperature < AC_COMFORT) cause = "comfort"; }
        if (cause && cur && cur.cause === cause && cur.end === h - 1) { cur.end = h; cur.kwh += v; } else { flush(); if (cause) cur = { cause, start: h, end: h, kwh: v }; } });
      flush(); }));
    events.sort((x, y) => (y.start > x.start ? 1 : -1));
    const rows = Object.values(byApp).filter((b) => b.events).map((b) => ({ ...b, idleKwh: r2(b.idleKwh), contextKwh: r2(b.contextKwh), kwh: r2(b.idleKwh + b.contextKwh), pkr: r2((b.idleKwh + b.contextKwh) * r) })).sort((x, y) => y.kwh - x.kwh);
    const tot = r2(rows.reduce((s, b) => s + b.kwh, 0)), idle = r2(rows.reduce((s, b) => s + b.idleKwh, 0)), n = now();
    const idleNow = APPS.filter((a) => a.kind !== "pump").map((a) => ({ a, p: applianceNow(a), o: occState(a.room) })).filter((x) => x.p.on && x.o.state === "vacant")
      .map((x) => ({ id: x.a.id, room: roomName(x.a.room), appliance: x.a.name, powerW: x.p.power, sinceMin: Math.round(x.o.sinceMin), pkrPerHour: r2((x.p.power / 1000) * r), explanation: `On while the ${roomName(x.a.room).toLowerCase()} has been vacant for about ${Math.round(x.o.sinceMin)} min.` }));
    return wrap({ simulated: true, generatedAt: iso(n), range: range && range.key || "today", days: days.length, rate: r,
      summary: { events: events.length, kwh: tot, pkr: r2(tot * r), idleKwh: idle, contextKwh: r2(tot - idle), monthlyPotentialKwh: r2(M.potentialMonthKwh()), monthlyPotentialPkr: Math.round(M.potentialMonthKwh() * r), topAppliance: rows[0] ? `${rows[0].name} (${rows[0].room})` : null, idleNowCount: idleNow.length },
      byAppliance: rows, events, idle: idleNow,
      notTracked: ["Water-pump overflow needs a tank-level sensor, which is not part of the demo home.", "Standby draw below ≈0.4 W cannot be measured by the PZEM-004T.", "Occupancy is simulated here; Live mode uses the mmWave + PIR + door sensors."] });
  }

  /* ============ M7 suggested actions ============ */
  const DKEY = "ww_demo_dismissed";
  const dismissed = () => { try { return JSON.parse(localStorage.getItem(DKEY) || "[]"); } catch (e) { return []; } };
  function getSuggestions() {
    const r = rate(), list = [], dis = dismissed(), w = M.wasteByApp(7);
    APPS.forEach((a) => { const o = occState(a.room), p = applianceNow(a);
      if (a.kind !== "pump" && p.on && o.state === "vacant") list.push({ id: `now-${a.id}`, title: `Turn off ${a.name} in the ${roomName(a.room)}`, room: roomName(a.room), appliance: a.name, applianceId: a.id, action: "turn_off", reason: `The ${roomName(a.room).toLowerCase()} has been vacant for about ${Math.round(o.sinceMin)} min and the ${a.name.toLowerCase()} is still on (${p.power} W).`, impact: { kind: "potential", kwhMonth: null, pkrPerHour: r2((p.power / 1000) * r) }, status: "pending" }); });
    APPS.forEach((a) => { const k = w[a.id] / 7 * 30; if (a.kind !== "pump" && k >= 2) list.push({ id: `rule-${a.id}`, title: `Switch ${a.name} off automatically when the ${roomName(a.room)} is vacant`, room: roomName(a.room), appliance: a.name, applianceId: a.id, action: "enable_rule", reason: `${r2(w[a.id])} kWh in 7 days was used while the room was vacant (simulated).`, impact: { kind: "potential", kwhMonth: r2(k), pkrMonth: Math.round(k * r) }, status: "pending" }); });
    list.sort((x, y) => ((y.impact.pkrMonth || 0) + (y.impact.pkrPerHour || 0) * 100) - ((x.impact.pkrMonth || 0) + (x.impact.pkrPerHour || 0) * 100));
    return wrap({ simulated: true, suggestions: list.filter((s) => !dis.includes(s.id)), dismissedCount: dis.length });
  }
  async function applySuggestion(id) {
    const a = APPS.find((x) => id.endsWith(x.id));
    if (id.startsWith("now-") && a) { await WW.demo.controlAppliance(a.id, false); return { ok: true, executed: true, demo: true, message: `${a.name} switched off (demo only — no real device was switched).` }; }
    const A = await WW.demo.getAutomation(), rule = A.rules.find((x) => /energy.?saving/i.test(x.name));
    if (rule && !rule.enabled) await WW.demo.toggleRule(rule.id);
    return { ok: true, executed: false, demo: true, message: rule ? `Rule “${rule.name}” is enabled (demo only).` : "Open Automation to enable the matching rule." };
  }
  async function dismissSuggestion(id) { const d = dismissed(); if (!d.includes(id)) d.push(id); localStorage.setItem(DKEY, JSON.stringify(d)); return { ok: true, message: "Kept as is (manual override)." }; }

  /* ============ M5 AI / ML interfaces (simulated, never claims a trained model) ============ */
  const DATASETS = [
    { name: "PRECON", role: "Pakistani household load profiles — used to develop and validate the load forecaster.", reference: "A. Nadeem and N. Arshad, e-Energy ’19 [11]", url: "https://web.lums.edu.pk/~eig/precon.html" },
    { name: "REWDP", role: "Residential energy and weather data (LUMS) — used with PRECON for forecasting and tariff checks.", reference: "LUMS LEI [12]", url: "https://lei.lums.edu.pk/datasets/residential-energy-and-weather-data-pakistan.html" },
    { name: "WattWise own data", role: "Collected by the prototype (presence sensors + meters). Needed for the occupancy model, testing and final evaluation — the open datasets contain no presence data.", reference: "Proposal §6", url: null }];
  function getAiOverview() {
    const reason = "No model has been trained or evaluated. Training and execution are backend work (Talha); this screen only shows what the backend reports.";
    return wrap({ simulated: true,
      loadModel: { name: "Random Forest regressor — hourly load", status: "not_trained", trained: false, trainedAt: null, samples: null, features: ["hour of day", "day of week", "recent lags", "temperature", "occupancy"], split: "Time-based split (train on earlier data, test on later data)", baseline: "Same hour yesterday", metrics: null, reason },
      occupancyModel: { name: "Random Forest classifier — room occupancy", status: "not_trained", trained: false, trainedAt: null, samples: null, features: ["hour of day", "day of week", "recent presence", "door events"], split: "Time-based split on our own presence data", baseline: "Occupied if occupied at this hour last week", metrics: null, reason },
      datasets: DATASETS, rulesFirst: "Explainable rules decide; the models only supply predictions. Safety rules always have the final say, and if a model is unavailable the rules run on defaults.",
      extended: [{ name: "Anomaly detection", status: "not_implemented", note: "Extended goal in the proposal (§7.1) — not part of the core scope." }, { name: "Fault classification", status: "not_implemented", note: "Extended goal — not part of the core scope." }] });
  }
  function getAiForecast() {
    const n = now(), H = n.getHours(), d = day0(n), y = addDays(d, -1), labels = [], actual = [], predicted = [], low = [], high = [], baseline = [];
    const kwhAt = (dd, h) => APPS.reduce((s, a) => s + (ds(dd) === ds(d) ? appHourlyToday(a)[h] : appHourly(a, dd)[h]), 0);
    for (let h = 0; h < 24; h++) { labels.push(hourLabel(h)); const base = APPS.reduce((s, a) => s + appHourly(a, y)[h], 0);
      baseline.push(r2(base)); actual.push(h < H ? r2(kwhAt(d, h)) : null);
      const e = 1 + (rnd(`sim-fc${ds(d)}${h}`)() - 0.5) * 0.3; const p = r2(h < H ? kwhAt(d, h) * e : base * e);
      predicted.push(p); low.push(r2(p * 0.8)); high.push(r2(p * 1.2)); }
    const occ = ROOMS.map((r) => ({ id: r.id, name: r.name, current: occState(r.id).state,
      probabilities: Array.from({ length: 6 }, (_, i) => { const h = (H + i + 1) % 24; let c = 0; for (let k = 1; k <= 7; k++) c += occHour(r.id, addDays(d, -k), h); return +(c / 7).toFixed(2); }) }));
    return wrap({ simulated: true, label: "SIMULATED — illustrates the interface only. This is not the output of a trained model.", generatedAt: iso(n),
      load: { unit: "kWh", labels, actual, predicted, low, high, baseline, bandNote: "Band is a fixed ±20% illustration, not a statistical interval." },
      occupancy: { hours: Array.from({ length: 6 }, (_, i) => hourLabel((H + i + 1) % 24)), rooms: occ, note: "Probabilities are the share of the last 7 days that this room was occupied at that hour — a simple frequency table, not an ML prediction." } });
  }
  function getAiHistory(limit = 24) {
    const n = now(), d = day0(n), rows = [];
    for (let i = 1; i <= limit; i++) { const t = new Date(n.getTime() - i * 36e5), dd = day0(t), h = t.getHours();
      const actual = r2(APPS.reduce((s, a) => s + (ds(dd) === ds(d) ? appHourlyToday(a)[h] : appHourly(a, dd)[h]), 0));
      const pred = r2(actual * (1 + (rnd(`sim-h${ds(dd)}${h}`)() - 0.5) * 0.3));
      rows.push({ time: iso(new Date(dd.getTime() + h * 36e5)), kind: "load", target: "Whole home", predicted: pred, actual, errorAbs: r2(Math.abs(pred - actual)) }); }
    return wrap({ simulated: true, label: "Simulated prediction history (demo only).", rows, summary: { n: rows.length, maeKwh: null, note: "No accuracy is reported because no model has been trained." } });
  }

  /* ============ M8 weather & electrical safety (simulated scenarios) ============ */
  const WX_KEY = "ww_demo_wx";
  const wxScenario = () => localStorage.getItem(WX_KEY) || "normal";
  function getWeather() {
    const sc = wxScenario(), n = now(), t = (min) => new Date(n.getTime() + min * 60000).toISOString();
    const P = { normal: { cond: "Partly cloudy", temp: 24, hum: 52, wind: 9, mm: 0, chance: [5, 5, 10, 10, 10, 5, 5, 5], f: ["Partly cloudy", "Sunny", "Sunny", "Partly cloudy", "Cloudy", "Cloudy", "Clear", "Clear"], v: 225, state: "normal" },
      advisory: { cond: "Light rain", temp: 19, hum: 78, wind: 14, mm: 0.8, chance: [55, 70, 75, 60, 40, 30, 20, 15], f: ["Light rain", "Moderate rain", "Moderate rain", "Light rain", "Cloudy", "Cloudy", "Cloudy", "Clear"], v: 229, state: "advisory" },
      storm: { cond: "Thunderstorm", temp: 17, hum: 91, wind: 46, mm: 12.4, chance: [90, 95, 90, 80, 60, 40, 30, 20], f: ["Thunderstorm", "Heavy rain", "Heavy rain", "Moderate rain", "Light rain", "Cloudy", "Cloudy", "Clear"], v: 252, state: "storm" } }[sc] || null;
    const forecast = P.f.map((c, i) => ({ time: t(i * 180 + 60), condition: c, rainChance: P.chance[i], precipMm: /Heavy|Thunder/.test(c) ? 9 - i : /Moderate/.test(c) ? 3 : /Light/.test(c) ? 0.8 : 0, windKph: Math.max(6, P.wind - i * 2) }));
    const providerAlerts = sc === "normal" ? [] : [{ event: sc === "storm" ? "Thunderstorm warning (simulated)" : "Rain advisory (simulated)", severity: sc === "storm" ? "Severe" : "Minor", headline: sc === "storm" ? "Simulated warning for scenario testing." : "Simulated advisory for scenario testing.", effective: t(-30) }];
    const bad = sc === "storm";
    const voltageHistory = Array.from({ length: 24 }, (_, i) => { const r = rnd(`wxv${sc}${i}`)(); return { time: t(-(23 - i) * 10), value: +(P.v + (r - 0.5) * 4 + (bad && i > 18 ? 20 : 0)).toFixed(1) }; });
    const lastV = voltageHistory[23].value;
    return wrap({ simulated: true, scenario: sc, state: P.state, location: WW.config.LOCATION_LABEL, note: "SIMULATED weather scenario for interface testing — not live weather and not a real electrical measurement.",
      current: { temperatureC: P.temp, humidity: P.hum, condition: P.cond, windKph: P.wind, precipMm: P.mm, feelsLikeC: P.temp - 1, isDay: n.getHours() >= 6 && n.getHours() < 18 }, forecast, providerAlerts,
      voltage: { value: lastV, time: t(0), status: lastV > 242 ? "high" : lastV < 198 ? "low" : "normal", minimum: 198, maximum: 242, nominal: 220, measurement: "simulated" }, voltageHistory,
      eventHistory: sc === "normal" ? [] : [{ time: t(-30), type: "advisory", severity: sc === "storm" ? "critical" : "warning", message: `Simulated ${sc === "storm" ? "thunderstorm warning" : "rain advisory"} received.` }].concat(bad ? [{ time: t(-8), type: "voltage", severity: "critical", message: `Simulated voltage deviation: ${lastV} V (limit 242 V).` }, { time: t(-7), type: "safety", severity: "warning", message: "Simulated: storm-safety mode would start (nothing was switched)." }] : []),
      response: { occupancyAware: true, safetyMode: bad ? "active" : "inactive", buzzer: "simulated", email: "simulated", automaticDisconnect: "preview_only" },
      loads: APPS.filter((a) => a.kind !== "pump").map((a) => ({ id: a.id, room: roomName(a.room), appliance: a.name, category: ["tv", "laptop", "ac"].includes(a.kind) ? "non_essential" : "essential", on: applianceNow(a).on, disconnectStatus: "not_connected" })), updatedAt: iso(n) });
  }
  const setWeatherScenario = (s) => { if (["normal", "advisory", "storm"].includes(s)) localStorage.setItem(WX_KEY, s); return { ok: true, scenario: wxScenario() }; };

  /* ============ M9 cost analytics ============ */
  function getCostAnalytics(range) {
    const c = cfg(), m = monthToDate(), r = rate(), agg = M.aggregate(range || { key: "today" }), proj = T.project(m.units, m.elapsed, m.dim), sl = T.slab(m.units, c), cat = T.effCat(m.units, c), slabs = c[cat + "_slabs"];
    const tou = c.tou, touOn = !!(tou.enabled && tou.peak_rate > 0 && tou.offpeak_rate > 0), [ps, pe] = peakHours();
    const peakCost = touOn ? agg.peak * tou.peak_rate : agg.peak * r, offCost = touOn ? agg.off * tou.offpeak_rate : agg.off * r;
    const roomRows = ROOMS.map((x) => ({ id: x.id, name: x.name, kwh: r2(agg.byRoom[x.id] || 0), cost: r2((agg.byRoom[x.id] || 0) * r) })), appRows = APPS.map((a) => ({ id: a.id, name: a.name, room: roomName(a.room), kwh: r2(agg.byApp[a.id] || 0), cost: r2((agg.byApp[a.id] || 0) * r), measurement: M.isMetered(a) ? "measured" : "estimated" })).sort((x, y) => y.kwh - x.kwh);
    const tot = agg.total || 1; roomRows.forEach((x) => (x.pct = Math.round((x.kwh / tot) * 100))); appRows.forEach((x) => (x.pct = Math.round((x.kwh / tot) * 100)));
    const h30 = M.aggregate({ key: "30d" });
    return wrap({ simulated: true, range: (range && range.key) || "today", method: "Room and appliance cost = energy × your current marginal slab rate. The monthly bill is calculated progressively over all units, so the sums differ slightly.", totalKwh: r2(agg.total),
      rate: { marginal: r, category: sl.category, slabLabel: sl.label }, byRoom: roomRows, byAppliance: appRows,
      peak: { window: `${c.tou.peak_start}–${c.tou.peak_end}`, touEnabled: touOn, peakKwh: r2(agg.peak), offKwh: r2(agg.off), peakCost: r2(peakCost), offCost: r2(offCost), peakPct: agg.total ? Math.round((agg.peak / agg.total) * 100) : 0, note: touOn ? "Time-of-use rates are configured, so peak and off-peak energy are priced separately." : "Time-of-use pricing is off in this (example) tariff, so peak and off-peak energy cost the same per unit." },
      slabs: { category: cat, limit: c.monthly_limit, monthUnits: m.units, unitsLeft: Math.max(0, r2(c.monthly_limit - m.units)), current: sl.label, table: slabs.map((s) => ({ from: s.from, to: s.to, rate: s.rate, state: m.units > (s.to ?? Infinity) ? "used" : m.units >= s.from ? "current" : "ahead" })), example: !!c.example },
      projection: { projectedUnits: proj.projected, low: proj.low, high: proj.high, projectedBill: Math.round(T.bill(proj.projected, c).total), billSoFar: Math.round(T.bill(m.units, c).total), limit: c.monthly_limit, aboveLimit: proj.projected > c.monthly_limit, category: T.effCat(proj.projected, c) },
      history: { labels: h30.labels, kwh: h30.values, cost: h30.values.map((v) => r2(v * r)) } });
  }

  /* ============ M10 what-if ============ */
  const BASE_DAYS = 14;
  function profile() {
    const t0 = day0(now()), [ps, pe] = peakHours(), c = cfg(), out = [];
    APPS.forEach((a) => { let kwh = 0, peak = 0, vac = 0;
      for (let i = 1; i <= BASE_DAYS; i++) { const d = addDays(t0, -i); appHourly(a, d).forEach((v, h) => { kwh += v; if (h >= ps && h < pe) peak += v; if (!occHour(a.room, d, h) && a.kind !== "pump") vac += v; }); }
      out.push({ id: a.id, name: a.name, room: roomName(a.room), kind: a.kind, monthKwh: r2((kwh / BASE_DAYS) * 30), peakKwh: r2((peak / BASE_DAYS) * 30), vacantKwh: r2((vac / BASE_DAYS) * 30), flexible: ["pump", "laptop", "ac"].includes(a.kind) }); });
    return out;
  }
  function getWhatIfBaseline() {
    const c = cfg(), p = profile(), un = (c.billing.unmetered_kwh_per_day || 0) * 30;
    return wrap({ simulated: true, estimate: true, basis: `Average of the last ${BASE_DAYS} full simulated days × 30`, appliances: p, unmeteredKwhMonth: r2(un), peakWindow: `${c.tou.peak_start}–${c.tou.peak_end}`,
      tariff: { category: c.category, example: !!c.example, touEnabled: !!(c.tou.enabled && c.tou.peak_rate > 0 && c.tou.offpeak_rate > 0), monthlyLimit: c.monthly_limit } });
  }
  function priceMonth(kwhMeter, peakKwh, offKwh, unmetered) {
    const c = cfg(), units = kwhMeter + unmetered, tou = c.tou;
    if (tou.enabled && tou.peak_rate > 0 && tou.offpeak_rate > 0) { const en = peakKwh * tou.peak_rate + (offKwh + unmetered) * tou.offpeak_rate, adj = units * (c.adjustment_per_unit || 0), fixed = c.fixed_charge || 0; return { total: (en + adj + fixed) * (1 + (c.tax_percent || 0) / 100), units, category: "time-of-use", rate: units ? en / units : 0, label: "Time-of-use" }; }
    const b = T.bill(units, c), s = T.slab(units, c); return { total: b.total, units, category: b.category, rate: T.marginal(units, c), label: s.label };
  }
  function simulateWhatIf(sc) {
    const p = profile(), un = (cfg().billing.unmetered_kwh_per_day || 0) * 30, adj = {};
    ((sc && sc.adjustments) || []).forEach((a) => (adj[a.applianceId] = a));
    const vacCut = !!(sc && sc.switchOffWhenVacant);
    const base = { kwh: 0, peak: 0 }, scn = { kwh: 0, peak: 0 }, rows = [];
    p.forEach((a) => { const j = adj[a.id] || { reducePct: 0, shiftPeakPct: 0 };
      let k = a.monthKwh, pk = a.peakKwh;
      if (vacCut && a.vacantKwh) { const f = a.vacantKwh / (a.monthKwh || 1); k -= a.vacantKwh; pk -= pk * f; }
      const keep = 1 - j.reducePct / 100; k *= keep; pk *= keep;
      const moved = a.flexible ? pk * (j.shiftPeakPct / 100) : 0; pk -= moved;
      base.kwh += a.monthKwh; base.peak += a.peakKwh; scn.kwh += k; scn.peak += pk; rows.push({ id: a.id, name: a.name, room: a.room, baselineKwh: a.monthKwh, scenarioKwh: r2(k), scenarioPeakKwh: r2(pk), shiftedKwh: r2(moved) }); });
    const B = priceMonth(base.kwh, base.peak, base.kwh - base.peak, un), S = priceMonth(scn.kwh, scn.peak, scn.kwh - scn.peak, un);
    rows.forEach((x) => { x.baselineCost = r2(x.baselineKwh * B.rate); x.scenarioCost = r2(x.scenarioKwh * S.rate); });
    const touOn = cfg().tou.enabled && cfg().tou.peak_rate > 0;
    const notes = []; if (!touOn) notes.push("Time-of-use pricing is off in this tariff, so shifting load out of the peak window changes timing only, not cost.");
    if (B.category !== S.category) notes.push(`The scenario moves the bill from the “${B.category}” to the “${S.category}” category — slab thresholds make the saving larger than the energy change alone.`);
    return wrap({ simulated: true, estimate: true, name: (sc && sc.name) || "Scenario", basis: `Last ${BASE_DAYS} simulated days × 30 · estimate, not a measured result`,
      baseline: { monthKwh: r2(base.kwh + un), monthCost: Math.round(B.total), peakKwh: r2(base.peak), offKwh: r2(base.kwh - base.peak), slabLabel: B.label, category: B.category },
      scenario: { monthKwh: r2(scn.kwh + un), monthCost: Math.round(S.total), peakKwh: r2(scn.peak), offKwh: r2(scn.kwh - scn.peak), slabLabel: S.label, category: S.category },
      delta: { kwh: r2(scn.kwh - base.kwh), cost: Math.round(S.total) - Math.round(B.total), pct: base.kwh ? r2(((scn.kwh - base.kwh) / (base.kwh + un)) * 100) : 0, peakKwh: r2(scn.peak - base.peak) },
      byAppliance: rows, notes, assumptions: ["Reductions are applied evenly across the month.", "Peak shifting applies to flexible loads only (pump, laptop charging, AC).", "Unmetered consumption is unchanged."] });
  }

  /* ============ M13 sustainability ============ */
  function getSustainability() {
    const c = cfg(), m = monthToDate(), t0 = day0(now()), days = (a, b) => { let s = 0; for (let i = a; i <= b; i++) APPS.forEach((x) => (s += appHourly(x, addDays(t0, -i)).reduce((q, v) => q + v, 0))); return s; };
    const l7 = days(1, 7), p7 = days(8, 14), d30 = days(1, 30), avoid30 = Object.values(M.wasteByApp(30)).reduce((a, b) => a + b, 0);
    let occH = 0; ROOMS.forEach((r) => { for (let i = 1; i <= 7; i++) for (let h = 0; h < 24; h++) occH += occHour(r.id, addDays(t0, -i), h); });
    const [ps, pe] = peakHours(); let pk = 0; for (let i = 1; i <= 30; i++) APPS.forEach((a) => appHourly(a, addDays(t0, -i)).forEach((v, h) => { if (h >= ps && h < pe) pk += v; }));
    const proj = T.project(m.units, m.elapsed, m.dim), factor = 0.4, potential = M.potentialMonthKwh(), metered = APPS.filter(M.isMetered).length;
    const st = (ok, partial) => (ok ? "met" : partial ? "partial" : "not_met");
    const criteria = [
      { id: "metering", label: "Appliance-level energy metering", status: st(metered === APPS.length, metered > 0), evidence: `${metered} of ${APPS.length} appliances are metered (rest estimated from rated power).` },
      { id: "occupancy", label: "Occupancy sensing in every room", status: "met", evidence: `${ROOMS.length} of ${ROOMS.length} rooms report occupancy (simulated in Demo).` },
      { id: "waste", label: "Waste detection running", status: "met", evidence: "Waste detection is running on simulated data." },
      { id: "tariff", label: "Tariff configured from your own bill", status: c.example ? "not_met" : "met", evidence: c.example ? "The example tariff is still in use (Settings → Tariff & Billing)." : "Custom tariff configured." },
      { id: "peak", label: "Peak-hour pricing configured (time-of-use)", status: c.tou.enabled && c.tou.peak_rate > 0 ? "met" : "not_met", evidence: c.tou.enabled ? "Time-of-use enabled." : "Time-of-use is off." },
      { id: "forecast", label: "Trained load-forecast model available", status: "not_met", evidence: "No model has been trained yet (backend work)." },
      { id: "verified", label: "Measured (verified) savings logged", status: "not_met", evidence: "Only simulated days exist in Demo mode — nothing is verified." },
      { id: "solar", label: "Solar generation metering", status: "not_met", evidence: "Out of the current project scope (Proposal §7.2)." },
      { id: "storage", label: "Battery storage monitoring", status: "not_met", evidence: "Out of the current project scope (Proposal §7.2)." }];
    return wrap({ simulated: true, period: "Last 30 simulated days",
      efficiency: { dailyAvgKwh: r2(d30 / 30), last7Kwh: r2(l7), prev7Kwh: r2(p7), trendPct: p7 ? r2(((l7 - p7) / p7) * 100) : null, avoidableKwh30d: r2(avoid30), avoidablePct: d30 ? r2((avoid30 / d30) * 100) : 0, peakSharePct: d30 ? r2((pk / d30) * 100) : 0, kwhPerOccupiedRoomHour: occH ? +(l7 / occH).toFixed(3) : null, meteredCoveragePct: Math.round((metered / APPS.length) * 100), unitsVsLimitPct: Math.round((m.units / c.monthly_limit) * 100) },
      impact: { emissionFactorKgPerKwh: factor, factorSource: "Illustrative default — not an official figure. Replace with a cited value in the backend configuration.", monthKwh: proj.projected, monthCo2eKg: r2(proj.projected * factor), avoidablePotentialCo2eKgMonth: r2(potential * factor), measuredReductionCo2eKg: null, note: "Emissions of consumption are an estimate. No reduction is claimed because there are no verified (measured) savings." },
      readiness: { criteria, met: criteria.filter((x) => x.status === "met").length, total: criteria.length },
      solarStorage: { inScope: false, solar: { connected: false, generationKwh: null }, storage: { connected: false, socPct: null }, hooks: ["Dedicated MQTT topics for generation and battery state (reserved)", "Bidirectional meter support (not installed)", "Backend schema can add generation/battery series without changing the dashboard"], sizing: { dailyKwh: r2(d30 / 30) } } });
  }

  Object.assign(WW.demo, { getSensorReadings, getSensorHistory, getOccupancy, getContext, getWaste, getSuggestions, applySuggestion, dismissSuggestion, getAiOverview, getAiForecast, getAiHistory,
    getWeather, setWeatherScenario, getCostAnalytics, getWhatIfBaseline, simulateWhatIf, getSustainability });
  WW.demo.__model.wxScenario = wxScenario;
})();
