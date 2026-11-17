/* DEMO data service — simulated, deterministic data so WattWise can be presented before hardware is connected.
   Everything returned here has source:"demo". It NEVER talks to the backend or to hardware, and it never sends relay commands. */
window.WW = window.WW || {};
WW.demo = (function () {
  const KEY = "ww_demo_v2";
  const ROOMS = [
    { id: "lounge", name: "Lounge", image: "assets/rooms/lounge.jpg", node: "ESP32-S3 N16R8 (main gateway)" },
    { id: "bedroom", name: "Bedroom", image: "assets/rooms/bedroom.jpg", node: "ESP32-C3 Super Mini" },
    { id: "bathroom", name: "Bathroom", image: "assets/rooms/bathroom.jpg", node: "ESP32-C3 Super Mini" },
  ];
  const win = (a, b, v = 1) => (h) => (h >= a && h <= b ? v : 0);
  const sum = (...f) => (h) => Math.min(1, f.reduce((s, x) => s + x(h), 0));
  // id, room, name, kind, sub, rated W, control, metered, profile(hour -> fraction of the hour it is on)
  const APPS = [
    ["lounge-lights", "lounge", "Lights", "light", "LED (18 W)", 18, "relay", true, sum(win(18, 23), win(6, 7, .5))],
    ["lounge-fan", "lounge", "Fan", "fan", "Ceiling fan (75 W)", 75, "relay", true, win(10, 23, .9)],
    ["lounge-tv", "lounge", "TV", "tv", "Television (120 W)", 120, "relay", true, win(19, 23, .75)],
    ["lounge-laptop", "lounge", "Laptop", "laptop", "Laptop (65 W)", 65, "socket", true, win(10, 22, .6)],
    ["lounge-ac", "lounge", "Air Conditioner", "ac", "Split AC · infrared control", 1200, "ir", true, sum(win(13, 16, .35), win(19, 23, .65))],
    ["bedroom-lights", "bedroom", "Lights", "light", "LED (12 W)", 12, "relay", true, sum(win(20, 23, .8), win(6, 7, .4))],
    ["bedroom-fan", "bedroom", "Fan", "fan", "Ceiling fan (75 W)", 75, "relay", true, sum(win(21, 23, .95), win(0, 7, .9), win(14, 16, .6))],
    ["bedroom-laptop", "bedroom", "Laptop Charger", "laptop", "Charger (45 W)", 45, "socket", false, sum(win(9, 17, .55), win(22, 23, .5))],
    ["bathroom-lights", "bathroom", "Lights", "light", "LED (9 W)", 9, "relay", true, sum(win(6, 7, .3), win(20, 21, .35))],
    ["bathroom-pump", "bathroom", "Water Pump", "pump", "Tank-level control (750 W)", 750, "contactor", true, sum(win(6, 6, .45), win(12, 12, .3), win(19, 19, .5))],
  ].map((a) => ({ id: a[0], room: a[1], name: a[2], kind: a[3], sub: a[4], rated: a[5], control: a[6], metered: a[7], prof: a[8] }));
  const SOCKETS = [{ id: "S1", name: "Smart Switch (S1)", location: "Lounge Wall Socket", room: "lounge", meter: true },
                   { id: "S2", name: "Smart Switch (S2)", location: "Bedroom Wall Socket", room: "bedroom", meter: false }];
  const DUTY = { ac: 0.65 };
  const appById = (id) => APPS.find((a) => a.id === id);

  /* ---------- deterministic randomness ---------- */
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rnd = (seed) => { let a = hash(String(seed)); return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const ds = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const day0 = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const hourLabel = (h) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
  const r2 = (v) => Math.round(v * 100) / 100;

  /* ---------- persisted demo state ---------- */
  function freshState() {
    const t = WW.tariff.clone(WW.tariff.DEFAULT);
    t.billing.period_start_day = Math.min(28, addDays(new Date(), -24).getDate());
    return {
      rated: {}, ovr: {}, mode: {}, readAlerts: [], clearedAlerts: [], extraAlerts: [], log: [], autoDone: {}, tariff: t,
      sockets: { S1: "lounge-laptop", S2: "bedroom-laptop" }, schedules: [
        { id: 1, name: "Water pump – before peak", load: "bathroom-pump", time: "16:30", days: "Daily", enabled: true }],
      general: { home_name: "My Home", temp_unit: "C", currency: "PKR", time_format: "12h", timezone: "Asia/Karachi", default_room: "lounge", update_interval: "1m", theme: "light",
                 notifications: { dashboard: true, email: false, buzzer: true } },
      rules: [
        { id: 1, name: "Auto Lights (Occupancy)", type: "occupancy_lights", description: "Turn ON lights when presence is detected, and OFF after the configured minutes with no presence.", enabled: true, params: { vacant_minutes: 10 } },
        { id: 2, name: "Daylight Control", type: "daylight_control", description: "Keep lights OFF when natural light is sufficient.", enabled: true, params: { lux_threshold: 300 } },
        { id: 3, name: "Temperature Comfort (Smart Fan)", type: "temperature_fan", description: "Turn ON the fan when the room is occupied and above the limit; OFF when it falls below.", enabled: true, params: { on_above_c: 28, off_below_c: 26 } },
        { id: 4, name: "Energy-Saving Mode", type: "energy_saving", description: "Switch off TV, laptop socket and AC left running in vacant rooms after a longer delay.", enabled: false, params: { vacant_minutes: 20 } },
        { id: 5, name: "Peak-Hour Planning (Water Pump)", type: "peak_shift", description: "Run the pump outside the evening peak window when tank level allows.", enabled: false, params: { avoid_peak: true, min_tank_percent: 30 } },
        { id: 6, name: "Weather Safety", type: "weather_safety", description: "Precaution only: disconnect non-essential loads during a storm advisory (occupancy-aware). Does not replace breakers or lightning protection.", enabled: false, params: { policy: "occupancy_aware" } },
      ], nextRule: 7,
    };
  }
  let S;
  const load = () => { try { S = JSON.parse(localStorage.getItem(KEY)) || freshState(); } catch (e) { S = freshState(); } if (!S.tariff) S = freshState(); };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  load();
  const cfg = () => S.tariff;
  const now = () => new Date();

  /* ---------- appliance helpers (socket mapping aware) ---------- */
  const socketOf = (a) => Object.keys(S.sockets).find((sid) => S.sockets[sid] === a.id) || null;
  const isMetered = (a) => { const sid = socketOf(a); return sid ? SOCKETS.find((s) => s.id === sid).meter : a.metered; };
  const controllable = (a) => (socketOf(a) ? true : !["none", "socket"].includes(a.control));
  const onKwhPerHour = (a) => (a.rated * (DUTY[a.kind] || 1)) / 1000;
  const dayFactor = (d) => { const r = rnd("df" + ds(d))(); const wk = [0, 6].includes(d.getDay()) ? 1.1 : 1; return (0.88 + r * 0.26) * wk; };
  const baseHour = (a, d, h) => { const r = rnd(`${a.id}${ds(d)}${h}`)(); return onKwhPerHour(a) * a.prof(h) * dayFactor(d) * (0.88 + r * 0.24); };
  const isOnHour = (a, d, h) => rnd(`on${a.id}${ds(d)}${h}`)() < a.prof(h);

  // Scale so an average prior day is ~7.0 kWh, giving a believable month (~176 units in the evening).
  const K = (() => { let t = 0; for (let i = 1; i <= 24; i++) { const d = addDays(day0(now()), -i); APPS.forEach((a) => { for (let h = 0; h < 24; h++) t += baseHour(a, d, h); }); } return (7.0 * 24) / t; })();

  S.rated = S.rated || {}; APPS.forEach((a) => { if (S.rated[a.id] != null) a.rated = S.rated[a.id]; });   // user-configured rated watts (after K so edits change consumption)
  function appHourly(a, d) { // 24 values (kWh) for a full past day
    return Array.from({ length: 24 }, (_, h) => baseHour(a, d, h) * K);
  }
  function appHourlyToday(a) { // today up to "now", honouring manual overrides
    const n = now(), d0 = day0(n), H = n.getHours(), out = Array(24).fill(0), o = S.ovr[a.id] && S.ovr[a.id].d === ds(n) ? S.ovr[a.id] : null;
    for (let h = 0; h <= H; h++) {
      const hs = d0.getTime() + h * 36e5, he = hs + 36e5, cut = Math.min(n.getTime(), he), frac = (cut - hs) / 36e5, base = baseHour(a, d0, h) * K;
      if (o && o.at < cut) {
        if (o.at <= hs) out[h] = o.on ? onKwhPerHour(a) * frac : 0;
        else { const af = (o.at - hs) / 36e5; out[h] = base * af + (o.on ? onKwhPerHour(a) * (frac - af) : 0); }
      } else out[h] = base * frac;
    }
    return out;
  }
  function applianceNow(a) {
    const n = now(), o = S.ovr[a.id] && S.ovr[a.id].d === ds(n) ? S.ovr[a.id] : null;
    const on = o ? o.on : isOnHour(a, day0(n), n.getHours());
    const jit = 0.97 + rnd(`p${a.id}${Math.floor(n.getTime() / 15000)}`)() * 0.06;
    return { on, power: on ? Math.round(a.rated * (DUTY[a.kind] || 1) * jit) : 0 };
  }

  /* ---------- occupancy (simulated) ---------- */
  function occHour(room, d, h) {
    const r = rnd(`occ${room}${ds(d)}${h}`)();
    if (room === "lounge") return h >= 10 && h <= 23 ? (r < 0.88 ? 1 : 0) : 0;
    if (room === "bedroom") return h >= 22 || h <= 7 ? 1 : (h >= 13 && h <= 15 && r < 0.4 ? 1 : 0);
    return [6, 7, 13, 20, 21].includes(h) && r < 0.8 ? 1 : 0;
  }
  function occupancyNow(room) {
    const n = now(), d = day0(n); let H = n.getHours(); const st = occHour(room, d, H); let mins = n.getMinutes();
    for (let h = H - 1; h >= 0 && occHour(room, d, h) === st; h--) mins += 60;
    return { state: st ? "occupied" : "vacant", sinceMin: mins, sensors: { ld2410: !!st, pir: !!st, door: "closed" } };
  }
  const envNow = (room) => { const n = now(), r = rnd(`env${room}${Math.floor(n.getTime() / 60000)}`)(); const h = n.getHours() + n.getMinutes() / 60;
    return { temperature: +(23 + 6 * Math.sin(((h - 9) / 24) * 2 * Math.PI) + r * 1.2 + (room === "bathroom" ? -1 : 0)).toFixed(1), humidity: Math.round(45 + r * 15), lux: Math.round(h > 6 && h < 18 ? 150 + Math.sin(((h - 6) / 12) * Math.PI) * 600 : 20 + r * 30) }; };

  /* ---------- aggregations ---------- */
  function rangeInfo(range) {
    const n = now(), t0 = day0(n);
    if (range.key === "yesterday") return { start: addDays(t0, -1), end: t0, bucket: "hour", days: 1 };
    if (range.key === "7d") return { start: addDays(t0, -6), end: n, bucket: "day", days: 7 };
    if (range.key === "30d") return { start: addDays(t0, -29), end: n, bucket: "day", days: 30 };
    if (range.key === "custom" && range.start && range.end) {
      const s = day0(new Date(range.start + "T00:00:00")), e = addDays(day0(new Date(range.end + "T00:00:00")), 1), days = Math.max(1, Math.round((e - s) / 864e5));
      return { start: s, end: e > n ? n : e, bucket: days <= 1 ? "hour" : "day", days };
    }
    return { start: t0, end: n, bucket: "hour", days: 1 };
  }
  // hourly kWh per appliance for one calendar day (today is partial)
  const dayApp = (a, d) => (ds(d) === ds(now()) ? appHourlyToday(a) : appHourly(a, d));
  function aggregate(range, roomFilter, appFilter) {
    const info = rangeInfo(range), apps = APPS.filter((a) => (!roomFilter || a.room === roomFilter) && (!appFilter || a.id === appFilter));
    const labels = [], values = [], byApp = {}, byRoom = {}; let peak = 0, off = 0, hourlyAll = [];
    const t = cfg().tou, ps = parseInt(t.peak_start), pe = parseInt(t.peak_end);
    const nDays = Math.max(1, Math.round((day0(info.end) - day0(info.start)) / 864e5) + (info.end > day0(info.end) ? 1 : 0));
    for (let i = 0; i < nDays; i++) {
      const d = addDays(day0(info.start), i); if (d > now()) break;
      const hrs = Array(24).fill(0);
      APPS.forEach((a) => { const hv = dayApp(a, d); const inF = apps.includes(a);
        hv.forEach((v, h) => { if (inF) { hrs[h] += v; } });
        if (inF) { const tot = hv.reduce((s, x) => s + x, 0); byApp[a.id] = (byApp[a.id] || 0) + tot; byRoom[a.room] = (byRoom[a.room] || 0) + tot; }
        hv.forEach((v, h) => { if (inF) { if (h >= ps && h < pe) peak += v; else off += v; } }); });
      if (info.bucket === "hour") { const last = ds(d) === ds(now()) ? now().getHours() : 23; for (let h = 0; h <= last; h++) { labels.push(hourLabel(h)); values.push(r2(hrs[h])); } hourlyAll = hrs.slice(0, last + 1); }
      else { labels.push(d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })); values.push(r2(hrs.reduce((s, x) => s + x, 0))); }
    }
    return { info, labels, values, byApp, byRoom, total: Object.values(byApp).reduce((s, x) => s + x, 0), peak, off, hourlyAll };
  }
  function monthToDate() {
    const n = now(), c = cfg(), pd = Math.max(1, Math.min(28, c.billing.period_start_day || 1));
    let start = new Date(n.getFullYear(), n.getMonth(), pd); if (start > n) start = new Date(n.getFullYear(), n.getMonth() - 1, pd);
    let units = 0; const t0 = day0(n);
    for (let d = day0(start); d < t0; d = addDays(d, 1)) APPS.forEach((a) => (units += appHourly(a, d).reduce((s, x) => s + x, 0)));
    APPS.forEach((a) => (units += appHourlyToday(a).reduce((s, x) => s + x, 0)));
    const elapsed = Math.max(0.05, (n - start) / 864e5);
    units += (c.billing.unmetered_kwh_per_day || 0) * elapsed;
    const dim = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
    return { units: r2(units), start, elapsed, dim };
  }
  const costOf = (kwh, units) => Math.round(kwh * WW.tariff.marginal(units, cfg()));
  function wasteToday() { // energy of appliances that ran while their room was vacant (estimate)
    let w = 0; const n = now(), d = day0(n);
    APPS.forEach((a) => { if (["pump"].includes(a.kind)) return; const hv = appHourlyToday(a); hv.forEach((v, h) => { if (v && !occHour(a.room, d, h)) w += v; }); });
    return w;
  }

  /* ---------- alerts (built from the simulated state) ---------- */
  function buildAlerts() {
    const c = cfg(), m = monthToDate(), n = now(), list = [], at = (min) => new Date(n.getTime() - min * 60000).toISOString();
    const lim = c.monthly_limit, proj = WW.tariff.project(m.units, m.elapsed, m.dim), t = aggregate({ key: "today" });
    (c.alerts.thresholds || []).filter((x) => m.units >= x).forEach((x, i) => list.push({ id: `d-thr-${x}`, severity: x >= lim ? "critical" : x >= 0.9 * lim ? "warning" : "info", category: "threshold", title: x >= lim ? `${x}-unit limit reached` : `${x}-unit threshold reached`, message: `You have used ${Math.round(m.units)} of ${lim} units (${Math.round(m.units / lim * 100)}%) this billing period. Estimate.`, time: at(300 + i * 90) }));
    if (m.units >= 0.85 * lim && m.units < lim) list.push({ id: "d-approach", severity: "warning", category: "threshold", title: `Approaching ${lim}-unit limit`, message: `You've used ${Math.round(m.units)} of ${lim} units (${Math.round(m.units / lim * 100)}%) this month.`, time: at(310) });
    let usual = 0; for (let i = 1; i <= 7; i++) { const d = addDays(day0(n), -i); let s = 0; APPS.forEach((a) => appHourly(a, d).forEach((v, h) => { if (h < n.getHours()) s += v; })); usual += s; } usual /= 7;
    if (usual > 0 && t.total > usual * (1 + c.alerts.increase_percent / 100)) list.push({ id: "d-usage", severity: "warning", category: "usage", title: "Higher usage detected", message: `Today's usage is ${Math.round((t.total / usual - 1) * 100)}% higher than your usual ${usual.toFixed(1)} kWh.`, time: at(35) });
    if (proj.projected > lim) { const pb = WW.tariff.bill(proj.projected, c).total, lb = WW.tariff.bill(c.billing.last_month_units || 0, c).total;
      list.push({ id: "d-proj", severity: "warning", category: "bill", title: "Month-end projection above limit", message: `At this pace you'll reach ≈${Math.round(proj.projected)} units (limit ${lim}). Estimated bill ≈ ${WW.fmt.pkr(pb)}${lb ? ` vs ${WW.fmt.pkr(lb)} last month` : ""}.`, time: at(75) }); }
    const bo = occupancyNow("bedroom"), cb = appById("bedroom-laptop");
    if (bo.state === "vacant" && applianceNow(cb).on) list.push({ id: "d-waste", room: "bedroom", appliance: "Laptop Charger", severity: "warning", category: "waste", title: "Laptop charger is ON in an empty Bedroom", message: `No one detected for ${bo.sinceMin} min · charger ≈ 45 W (estimated — socket S2 has no meter).`, time: at(Math.max(5, bo.sinceMin % 120)) });
    list.push({ id: "d-sensor", room: "bathroom", severity: "info", category: "sensor", title: "Bathroom BH1750 light sensor offline (simulated)", message: "No data for 5 min. Demo example of a sensor-offline alert.", time: at(190) });
    list.push({ id: "d-device", room: "bedroom", severity: "info", category: "device", title: "Bedroom node reconnected (simulated)", message: "ESP32-C3 lost Wi-Fi for 40 s and reconnected. No readings were double counted.", time: at(420) });
    list.push({ id: "d-weather", severity: "info", category: "weather", title: "Weather advisory: rain expected (simulated)", message: "Light rain expected in Abbottabad this evening. Weather Safety rule is OFF — no action will be taken.", time: at(240) });
    list.push({ id: "d-auto", room: "lounge", appliance: "Lights", severity: "info", category: "automation", title: "Automation executed", message: "Lounge lights turned OFF — no presence for 10 min (simulated).", time: at(160) });
    S.extraAlerts.forEach((a) => list.push(a));
    return list.filter((a) => !S.clearedAlerts.includes(a.id)).map((a) => ({ ...a, read: S.readAlerts.includes(a.id), demo: true })).sort((a, b) => new Date(b.time) - new Date(a.time));
  }

  /* ---------- tiny automation simulation (runs while the demo is open) ---------- */
  function runAutomation() {
    const n = now(), key = ds(n) + ":" + n.getHours();
    const rule = (t) => S.rules.find((r) => r.type === t && r.enabled);
    let changed = false;
    const off = (a, why, rid) => { S.ovr[a.id] = { on: false, at: n.getTime(), d: ds(n) }; S.log.unshift({ time: n.toISOString(), room: a.room, appliance: a.name, applianceId: a.id, action: "OFF", reason: why, by: "automation (simulated)", result: "applied in demo" });
      S.extraAlerts.push({ id: `d-auto-${a.id}-${key}`, room: a.room, appliance: a.name, severity: "info", category: "automation", title: "Automation executed", message: `${a.name} turned OFF in ${a.room[0].toUpperCase() + a.room.slice(1)} — ${why} (simulated).`, time: n.toISOString() }); changed = true; };
    const r1 = rule("occupancy_lights");
    if (r1) ROOMS.forEach((rm) => { const a = APPS.find((x) => x.room === rm.id && x.kind === "light"), o = occupancyNow(rm.id), k = `ol-${a.id}-${key}`;
      if (!S.autoDone[k] && o.state === "vacant" && o.sinceMin >= r1.params.vacant_minutes && applianceNow(a).on && (S.mode[a.id] || "auto") === "auto" && !S.ovr[a.id]) { S.autoDone[k] = 1; off(a, `no presence for ${o.sinceMin} min (limit ${r1.params.vacant_minutes})`); } });
    const r4 = rule("energy_saving");
    if (r4) APPS.filter((a) => ["tv", "laptop", "ac"].includes(a.kind)).forEach((a) => { const o = occupancyNow(a.room), k = `es-${a.id}-${key}`;
      if (!S.autoDone[k] && o.state === "vacant" && o.sinceMin >= r4.params.vacant_minutes && applianceNow(a).on && (S.mode[a.id] || "auto") === "auto" && !S.ovr[a.id]) { S.autoDone[k] = 1; off(a, `room vacant for ${o.sinceMin} min (energy-saving mode)`); } });
    if (changed) { S.log = S.log.slice(0, 40); save(); }
  }


  /* ---------- Savings (simulated, but DERIVED, not random) ----------
     Days alternate baseline / optimized. A baseline day is the normal simulated day. An optimized day removes the energy that the
     occupancy model says was used in VACANT room-hours (automation switches off ~10 min after vacancy, so ~85 % of it is avoided; the pump is never cut).
     WattWise's own consumption is subtracted (net savings). */
  const OWN_KWH_DAY = 3.6 * 24 / 1000, AVOIDED = 0.85;
  const demoTag = (i) => (i % 2 === 0 ? "optimized" : "baseline");
  const dayAppKwh = (a, d, opt) => appHourly(a, d).reduce((s, v, h) => s + (opt && a.kind !== "pump" && !occHour(a.room, d, h) ? v * (1 - AVOIDED) : v), 0);
  function wasteByApp(days) { const out = {}; APPS.forEach((a) => { if (a.kind === "pump") return; let w = 0; for (let i = 1; i <= days; i++) { const d = addDays(day0(now()), -i); appHourly(a, d).forEach((v, h) => { if (!occHour(a.room, d, h)) w += v; }); } out[a.id] = w; }); return out; }
  function occCmp(base, opt) {   // average occupied room-hours per day in each group (same occupancy model for both)
    const hrs = (x) => { let c = 0; ROOMS.forEach((r) => { for (let h = 0; h < 24; h++) c += occHour(r.id, x.d, h); }); return c; };
    const mean = (l) => l.reduce((s, x) => s + hrs(x), 0) / Math.max(1, l.length), b = mean(base), o = mean(opt);
    return { baselineRoomHours: +b.toFixed(1), optimizedRoomHours: +o.toFixed(1), comparable: b > 0 ? Math.abs(o - b) / b <= 0.25 : null };
  }
  function demoSavings() {
    const n = now(), t0 = day0(n), m = monthToDate(), rate = WW.tariff.marginal(m.units, cfg()), mean = (v) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);
    const days = []; for (let i = 28; i >= 1; i--) { const d = addDays(t0, -i), tag = demoTag(i), opt = tag === "optimized"; const perApp = {}; APPS.forEach((a) => (perApp[a.id] = dayAppKwh(a, d, opt))); days.push({ d, key: ds(d), tag, perApp, total: Object.values(perApp).reduce((s, x) => s + x, 0) }); }
    const base = days.filter((x) => x.tag === "baseline"), opt = days.filter((x) => x.tag === "optimized");
    const bAvg = mean(base.map((x) => x.total)), oAvg = mean(opt.map((x) => x.total)), net = opt.map((x) => ({ ...x, net: bAvg - x.total - OWN_KWH_DAY }));
    const saved = net.reduce((s, x) => s + x.net, 0), pct = bAvg * opt.length > 0 ? (saved / (bAvg * opt.length)) * 100 : null, mk = ds(n).slice(0, 7);
    const thisMonth = net.filter((x) => x.key.startsWith(mk)).reduce((s, x) => s + x.net, 0);
    const group = (list, kf) => { const g = {}; list.forEach((x) => (g[kf(x)] = g[kf(x)] || []).push(x.total)); return g; };
    const mlabel = (k) => new Date(k + "-15").toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const mg = {}; net.forEach((x) => (mg[x.key.slice(0, 7)] = mg[x.key.slice(0, 7)] || []).push(x.net));
    const monthly = Object.keys(mg).sort().map((k) => ({ label: mlabel(k), kwh: r2(mg[k].reduce((s, x) => s + x, 0)), pkr: Math.round(mg[k].reduce((s, x) => s + x, 0) * rate), days: mg[k].length })).slice(-6);
    const comp = (kf, lf, last) => { const gb = group(base, kf), go = group(opt, kf), keys = [...new Set([...Object.keys(gb), ...Object.keys(go)])].sort().slice(-last); return { labels: keys.map(lf), baseline: keys.map((k) => (gb[k] ? r2(mean(gb[k])) : null)), optimized: keys.map((k) => (go[k] ? r2(mean(go[k])) : null)) }; };
    const wk = (x) => { const d = new Date(x.d); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ds(d); };
    const appliances = APPS.map((a) => { const b = mean(base.map((x) => x.perApp[a.id])), o = mean(opt.map((x) => x.perApp[a.id])), sv = (b - o) * opt.length; return { name: `${a.name} (${ROOMS.find((r) => r.id === a.room).name})`, baseline: r2(b), optimized: r2(o), savedKwh: r2(sv), savedPkr: Math.round(sv * rate), pct: b > 0 ? Math.round((b - o) / b * 100) : null }; }).sort((x, y) => y.savedKwh - x.savedKwh);
    const acts = S.log.filter((x) => x.by && x.by.startsWith("automation") && x.action === "OFF" && x.applianceId), estKwh = acts.reduce((s, x) => s + (appById(x.applianceId)?.rated || 0) / 1000, 0);
    const w = wasteByApp(7), potKwh = Object.values(w).reduce((s, x) => s + x, 0) / 7 * 30;
    return { evaluation: { baseline: base.length, optimized: opt.length, usableBaseline: base.length, usableOptimized: opt.length, minEach: 2, minHours: 18, todayTag: demoTag(0) },
      verified: { status: "ok", baselineDays: base.length, optimizedDays: opt.length, baselineAvgDaily: r2(bAvg), optimizedAvgDaily: r2(oAvg), savedKwh: r2(saved), savedPkr: Math.round(saved * rate), pct: pct == null ? null : +pct.toFixed(1), thisMonthPkr: Math.round(thisMonth * rate), thisMonthKwh: r2(thisMonth), negative: saved < 0, netOfOwnConsumption: true, occupancy: occCmp(base, opt) },
      compare: { daily: comp((x) => x.key, (k) => new Date(k + "T12:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), 14), weekly: comp(wk, (k) => "Wk of " + new Date(k + "T12:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), 4), monthly: comp((x) => x.key.slice(0, 7), mlabel, 6) },
      monthly, appliances, efficiency: { baselineAvg: r2(bAvg), optimizedAvg: r2(oAvg), pct: pct == null ? null : +pct.toFixed(1), history: Object.keys(mg).sort().map((k) => ({ label: mlabel(k), pct: +(mg[k].reduce((s, x) => s + x, 0) / (bAvg * mg[k].length) * 100).toFixed(1) })).slice(-6) },
      estimated: { actions: acts.length, kwh: r2(estKwh), pkr: Math.round(estKwh * rate), assumption: "Each automatic switch-off is assumed to avoid 1 h of that appliance's rated power. This is a model, not a measurement." },
      potential: { kwhMonth: r2(potKwh), pkrMonth: Math.round(potKwh * rate), basis: "Simulated energy used while rooms were vacant (7-day sample scaled to 30 days) before automation. Not yet saved." },
      recommendations: demoRecs(w, rate), rate, ownConsumptionKwhPerDay: +OWN_KWH_DAY.toFixed(3) };
  }
  const potentialMonthKwh = () => Object.values(wasteByApp(7)).reduce((a, x) => a + x, 0) / 7 * 30;
  function demoRecs(w, rate) {
    const recs = [], ruleFor = { light: "occupancy_lights", fan: "temperature_fan", tv: "energy_saving", laptop: "energy_saving", ac: "energy_saving" };
    Object.entries(w).sort((a, b) => b[1] - a[1]).forEach(([id, kwh]) => { const a = appById(id); if (kwh < 0.4 || !ruleFor[a.kind]) return; const rule = S.rules.find((r) => r.type === ruleFor[a.kind]), month = kwh / 7 * 30;
      recs.push({ title: `${a.name} runs in an empty ${a.room}`, what: `${r2(kwh)} kWh in 7 days was used (simulated) while the ${a.room} was vacant.`, why: "The appliance stayed on after the occupancy model reported the room vacant.",
        action: rule && !rule.enabled ? `Turn on the “${rule.name}” rule.` : rule ? `“${rule.name}” is already on — check its delay setting.` : "Switch it off when leaving the room.", potentialKwh: r2(month), potentialPkr: Math.round(month * rate), kind: "potential", basis: "Simulated waste scaled to 30 days — an upper bound, not yet saved." }); });
    const ps = parseInt(cfg().tou.peak_start), pe = parseInt(cfg().tou.peak_end); let pump = 0;
    for (let i = 1; i <= 7; i++) appHourly(appById("bathroom-pump"), addDays(day0(now()), -i)).forEach((v, h) => { if (h >= ps && h < pe) pump += v; });
    if (pump >= 0.1) recs.push({ title: "Water pump runs in the evening peak window", what: `${r2(pump)} kWh of pump energy fell inside ${cfg().tou.peak_start}–${cfg().tou.peak_end} in 7 days (simulated).`, why: "The pump is a flexible load but ran during the evening peak.", action: "Enable “Peak-Hour Planning (Water Pump)” or schedule the pump earlier.", potentialKwh: null, potentialPkr: null, kind: "potential", basis: "Cost saving needs time-of-use rates in Settings; the energy is moved, not reduced." });
    return recs.slice(0, 6);
  }

  /* =================== public API (same shapes as the backend) =================== */
  const wrap = (d) => Promise.resolve({ available: true, source: "demo", ...d });
  const A = {
    async getDashboard() {
      runAutomation();
      const n = now(), t = aggregate({ key: "today" }), y = aggregate({ key: "yesterday" }), c = cfg(), m = monthToDate(), lim = c.monthly_limit;
      const proj = WW.tariff.project(m.units, m.elapsed, m.dim), pb = WW.tariff.bill(proj.projected, c).total, bill = WW.tariff.bill(m.units, c), info = WW.tariff.slab(m.units, c);
      const rooms = ROOMS.map((r) => ({ id: r.id, name: r.name, kwh: r2(t.byRoom[r.id] || 0), cost: costOf(t.byRoom[r.id] || 0, m.units), pct: t.total ? Math.round((t.byRoom[r.id] || 0) / t.total * 100) : 0 }));
      const al = buildAlerts().filter((a) => !a.read && a.severity !== "info").slice(0, 2);
      const top = Object.entries(t.byApp).sort((a, b) => b[1] - a[1])[0];
      let usual = 0; for (let i = 1; i <= 7; i++) { const d = addDays(day0(n), -i); let s = 0; APPS.forEach((a) => appHourly(a, d).forEach((v, h) => { if (h < n.getHours()) s += v; })); usual += s; } usual /= 7;
      const waste = wasteToday();
      return wrap({
        totals: { kwh: r2(t.total), cost: costOf(t.total, m.units), vsYesterdayPct: y.total ? Math.round(((t.total - sameTime(y)) / sameTime(y)) * 100) : null },
        month: { units: m.units, limit: lim, pct: Math.round(m.units / lim * 100), remaining: Math.max(0, r2(lim - m.units)), estBill: bill.total, projectedUnits: proj.projected, projectedLow: proj.low, projectedHigh: proj.high, projectedBill: pb, daysElapsed: +m.elapsed.toFixed(1), daysInMonth: m.dim },
        trend: { labels: t.labels, values: t.values },
        status: al.some((a) => a.severity === "critical") ? { level: "critical", title: "Critical", message: "Immediate attention needed." } : al.length ? { level: "warning", title: "Attention", message: `${al.length} alert(s) need your attention.` } : { level: "normal", title: "Normal", message: "System is running efficiently." },
        rooms, tariff: { category: info.category[0].toUpperCase() + info.category.slice(1), slabLabel: info.label, rateText: info.rateText, remaining: Math.max(0, r2(lim - m.units)), projectedBill: pb, example: c.example,
          assumptions: [...(proj.projected > lim && c.category === "protected" ? [`Projected ≈${Math.round(proj.projected)} units exceeds ${lim}: billed on unprotected slabs (assumption).`] : []), "Estimate only — not an official bill.", "Rates are configurable in Settings → Tariff & Billing.", "Demo billing cycle with simulated readings."] },
        alerts: al,
        insights: { top: top ? { name: `${appById(top[0]).name} (${ROOMS.find((r) => r.id === appById(top[0]).room).name})`, kwh: r2(top[1]), pct: Math.round(top[1] / t.total * 100) } : null,
          vsUsualPct: usual ? Math.round((t.total / usual - 1) * 100) : null, usual: r2(usual), savings: Math.round(potentialMonthKwh() * WW.tariff.marginal(m.units, c)) || null,
          savingsNote: "Potential, not achieved: simulated energy used while rooms were vacant (7-day average scaled to 30 days). Same basis as the Savings page." },
      });
    },
    async getRooms(range) {
      runAutomation();
      const t = aggregate(range), m = monthToDate(), info = t.info;
      const rooms = ROOMS.map((r) => { const a = aggregate(range, r.id), occ = occupancyNow(r.id), nowOn = APPS.filter((x) => x.room === r.id).some((x) => applianceNow(x).on), e = envNow(r.id);
        const hrs = info.bucket === "hour" ? Array.from({ length: a.labels.length }, (_, h) => (h > now().getHours() && ds(info.start) === ds(now()) ? null : occHour(r.id, info.start, h))) : [];
        return { id: r.id, name: r.name, image: r.image, nodeType: r.node, kwh: r2(a.total), cost: costOf(a.total, m.units), pct: t.total ? Math.round(a.total / t.total * 100) : 0, occupancy: occ, active: nowOn,
          durationMin: info.bucket === "hour" ? a.values.filter((v) => v > 0.005).length * 60 - (a.values[a.values.length - 1] > 0.005 && ds(info.start) === ds(now()) ? 60 - now().getMinutes() : 0) : null,
          trend: { labels: a.labels, values: a.values }, timeline: { hours: hrs, labels: a.labels }, env: e,
          appliances: APPS.filter((x) => x.room === r.id).map((x) => ({ name: x.name, kind: x.kind, on: applianceNow(x).on, mode: S.mode[x.id] || "auto" })), connectivity: { online: 8, total: 8, node: "simulated" } }; });
      const top = [...rooms].sort((a, b) => b.kwh - a.kwh)[0];
      const y = aggregate({ key: "yesterday" });
      return wrap({ rooms, totals: { kwh: r2(t.total), cost: costOf(t.total, m.units), activeRooms: rooms.filter((r) => r.active).length, rooms: rooms.length, topRoom: { name: top.name, kwh: top.kwh }, vsYesterdayPct: info.days === 1 && range.key === "today" && sameTime(y) ? Math.round((t.total / sameTime(y) - 1) * 100) : null } });
    },
    async getAppliances(roomId, range) {
      runAutomation();
      const room = ROOMS.find((r) => r.id === roomId) || ROOMS[0], m = monthToDate(), t = aggregate(range, room.id), c = cfg();
      const apps = APPS.filter((a) => a.room === room.id).map((a) => { const ag = aggregate(range, room.id, a.id), cur = applianceNow(a), met = isMetered(a), sid = socketOf(a);
        return { id: a.id, name: a.name, sub: a.sub, kind: a.kind, rated: a.rated, on: cur.on, powerW: cur.power, kwh: r2(ag.total), cost: costOf(ag.total, m.units), mode: S.mode[a.id] || "auto",
          metered: met, measurement: "estimated", simulated: true, controllable: controllable(a), controlType: sid ? "socket" : a.control, socketId: sid, demo: true }; });
      const sockets = SOCKETS.filter((s) => s.room === room.id).map((s) => { const ap = apps.find((x) => x.id === S.sockets[s.id]);
        return { id: s.id, name: s.name, location: s.location, on: ap ? ap.on : false, applianceId: ap?.id || null, applianceName: ap?.name || null, loadW: ap ? ap.powerW : 0, kwh: ap?.kwh ?? null, cost: ap?.cost ?? null, measurement: "estimated", simulated: true, hasMeter: s.meter }; });
      const by = apps.map((a) => ({ name: a.name, kwh: a.kwh, pct: t.total ? Math.round(a.kwh / t.total * 100) : 0 })).sort((a, b) => b.kwh - a.kwh);
      return wrap({ room: { id: room.id, name: room.name }, appliances: apps, sockets, trend: { labels: t.labels, values: t.values }, byAppliance: by,
        mappable: APPS.filter((a) => a.room === room.id && !["pump", "ac"].includes(a.kind)).map((a) => ({ id: a.id, name: a.name })),
        insight: by[0] && by[0].kwh ? `${by[0].name} is the highest consuming appliance in ${room.name}, using ${by[0].pct}% (${by[0].kwh.toFixed(1)} kWh) of room energy in this period.` : "No consumption in this period." });
    },
    async controlAppliance(id, on) {
      const a = appById(id); if (!a) return { ok: false, message: "Unknown appliance" };
      if (!controllable(a)) return { ok: false, code: "not_controllable", message: `${a.name} is monitor-only (no relay/socket).` };
      const n = now(); S.ovr[id] = { on, at: n.getTime(), d: ds(n) }; S.mode[id] = "manual";
      S.log.unshift({ time: n.toISOString(), room: a.room, appliance: a.name, action: on ? "ON" : "OFF", reason: "Manual command (demo — no hardware involved)", by: "manual", result: "applied in demo" }); S.log = S.log.slice(0, 40); save();
      return { ok: true, demo: true, message: `${a.name} turned ${on ? "ON" : "OFF"} (demo only — no real device was switched).` };
    },
    async setApplianceMode(id, mode) { S.mode[id] = mode; if (mode === "auto") delete S.ovr[id]; save(); return { ok: true }; },
    async mapSocket(sid, appId) { Object.keys(S.sockets).forEach((k) => { if (S.sockets[k] === appId) delete S.sockets[k]; }); if (appId) S.sockets[sid] = appId; else delete S.sockets[sid]; save(); return { ok: true }; },
    async getAnalytics(range) {
      const t = aggregate(range), m = monthToDate(), c = cfg(), info = t.info, days = Math.max(1, info.days), n = now();
      const prevEnd = info.start, prevStart = addDays(info.start, -days);
      let prev = 0; for (let i = 0; i < days; i++) { const d = addDays(prevStart, i); APPS.forEach((a) => (prev += appHourly(a, d).reduce((s, x) => s + x, 0))); }
      const proj = WW.tariff.project(m.units, m.elapsed, m.dim), pb = WW.tariff.bill(proj.projected, c).total, bill = WW.tariff.bill(m.units, c);
      const rooms = ROOMS.map((r) => ({ name: r.name, kwh: r2(t.byRoom[r.id] || 0), pct: t.total ? Math.round((t.byRoom[r.id] || 0) / t.total * 100) : 0 })).sort((a, b) => b.kwh - a.kwh);
      const tA = Object.values(t.byApp).reduce((s, x) => s + x, 0);
      const apps = Object.entries(t.byApp).map(([id, k]) => ({ name: `${appById(id).name} (${ROOMS.find((r) => r.id === appById(id).room).name})`, kwh: r2(k), pct: tA ? Math.round(k / tA * 100) : 0 })).sort((a, b) => b.kwh - a.kwh);
      const hourBuckets = Array(24).fill(0); aggregateHours(range).forEach((v, h) => (hourBuckets[h] = v));
      const topHours = hourBuckets.map((v, h) => [v, h]).sort((a, b) => b[0] - a[0]).slice(0, 3).filter((x) => x[0] > 0).map((x) => hourLabel(x[1]));
      // simulated forecast: demo only, clearly labelled
      const today = aggregate({ key: "today" }), H = n.getHours(), act = today.values.slice(), fc = [];
      for (let i = 1; i <= 3; i++) { const h = H + i; if (h > 23) break; let b = 0; APPS.forEach((a) => (b += baseHour(a, day0(n), h) * K)); fc.push(r2(b * (0.95 + rnd("fc" + ds(n) + h)() * 0.12))); }
      const waste = wasteToday();
      return wrap({
        kpis: { kwh: r2(t.total), cost: costOf(t.total, m.units), avgDaily: r2(t.total / days), changePct: (range.key === "today" ? sameTime() : prev) ? Math.round((t.total / (range.key === "today" ? sameTime() : prev) - 1) * 100) : null, monthUnits: m.units, limit: c.monthly_limit, monthPct: Math.round(m.units / c.monthly_limit * 100), estBill: bill.total, projectedBill: pb, projectedUnits: proj.projected, savings: Math.round(potentialMonthKwh() * WW.tariff.marginal(m.units, c)) || null, category: WW.tariff.slab(m.units, c).category.replace(/^./, (x) => x.toUpperCase()) },
        trend: { labels: t.labels, values: t.values }, byRoom: rooms, byAppliance: apps,
        peak: { peakKwh: r2(t.peak), offKwh: r2(t.off), peakPct: t.total ? Math.round(t.peak / t.total * 100) : 0, window: `${c.tou.peak_start}–${c.tou.peak_end}`, touEnabled: c.tou.enabled, hourly: { labels: Array.from({ length: 24 }, (_, h) => hourLabel(h)), values: hourBuckets.map(r2) }, topHours },
        forecast: { trained: false, simulated: true, info: { model: "RandomForestRegressor", reason: "Demo: simulated prediction. No model has been trained." }, label: "Simulated forecast (demo only)", actual: act, next: fc.map((k, i) => ({ hour: hourLabel(H + i + 1), kwh: k })) },
        history: { labels: t.labels, values: t.values },
      });
    },
    async getSavings() { return wrap(demoSavings()); },
    async tagDay() { return { ok: false, message: "Demo days are assigned automatically." }; },
    async getDevices() { return wrap({ rooms: ROOMS.map((r) => ({ id: r.id, name: r.name, node: r.node, appliances: APPS.filter((a) => a.room === r.id).map((a) => ({ id: a.id, name: a.name, kind: a.kind, rated: a.rated, controlType: socketOf(a) ? "socket" : a.control, metered: isMetered(a), socketId: socketOf(a), mode: S.mode[a.id] || "auto" })) })) }); },
    async saveApplianceConfig(id, rated) { const a = appById(id); if (!a || !(rated >= 0 && rated <= 25000)) return { ok: false, message: "Enter 0–25000 W" }; a.rated = rated; S.rated[id] = rated; save(); return { ok: true }; },
    async getAutomation() { runAutomation(); return wrap({ rules: S.rules.map((r) => ({ ...r, status: r.enabled ? "Active" : "Disabled", lastRun: S.log.length && r.enabled ? S.log[0].time : null })), schedules: S.schedules, executionNote: "Demo: automation is simulated. No relay, IR or contactor command is ever sent from Demo Mode." }); },
    async saveRule(rule) { if (rule.id) S.rules = S.rules.map((r) => (r.id === rule.id ? { ...r, ...rule } : r)); else S.rules.push({ type: "custom", enabled: false, params: {}, ...rule, id: S.nextRule++ }); save(); return { ok: true }; },
    async toggleRule(id) { const r = S.rules.find((x) => x.id === id); if (r) r.enabled = !r.enabled; save(); return { ok: true, enabled: r?.enabled }; },
    async deleteRule(id) { S.rules = S.rules.filter((r) => r.id !== id); save(); return { ok: true }; },
    async saveSchedule(s) { S.schedules.push({ id: Date.now(), enabled: true, ...s }); save(); return { ok: true }; },
    async deleteSchedule(id) { S.schedules = S.schedules.filter((s) => s.id !== id); save(); return { ok: true }; },
    async toggleSchedule(id) { const s = S.schedules.find((x) => x.id === id); if (s) s.enabled = !s.enabled; save(); return { ok: true }; },
    async getAutomationLog() { return wrap({ log: S.log }); },
    async getWeather() { return wrap({ state: "normal", note: "Simulated weather state (Demo). Live mode uses WeatherAPI.com when configured." }); },
    async getAlerts() { return wrap({ alerts: buildAlerts() }); },
    async markRead(id) { if (!S.readAlerts.includes(id)) S.readAlerts.push(id); save(); return { ok: true }; },
    async markAllRead() { buildAlerts().forEach((a) => !S.readAlerts.includes(a.id) && S.readAlerts.push(a.id)); save(); return { ok: true }; },
    async clearAlerts() { buildAlerts().forEach((a) => S.clearedAlerts.push(a.id)); save(); return { ok: true }; },
    async getReport(kind, range) {
      const kr = kind === "daily" ? { key: range.key === "yesterday" ? "yesterday" : "today" } : kind === "weekly" ? { key: "7d" } : kind === "monthly" ? (["today", "yesterday"].includes(range.key) ? { key: "30d" } : range) : range;
      const t = aggregate(kr), m = monthToDate(), c = cfg(), rate = WW.tariff.marginal(m.units, c), cost = (k) => r2(k * rate), days = Math.max(1, t.info.days);
      let table, chart; const rn = (id) => ROOMS.find((r) => r.id === id).name;
      if (["daily", "weekly", "monthly"].includes(kind)) { table = { columns: ["Period", "Energy (kWh)", "Est. cost (PKR)"], rows: t.labels.map((l, i) => [l, t.values[i], cost(t.values[i])]) }; chart = { type: "bar", labels: t.labels, values: t.values, label: "kWh" }; }
      else if (kind === "room") { const rows = Object.entries(t.byRoom).sort((a, b) => b[1] - a[1]).map(([id, k]) => [rn(id), r2(k), `${Math.round(k / t.total * 100)}%`, cost(k)]); table = { columns: ["Room", "Energy (kWh)", "Share", "Est. cost (PKR)"], rows }; chart = { type: "doughnut", labels: rows.map((r) => r[0]), values: rows.map((r) => r[1]), label: "kWh" }; }
      else if (kind === "appliance") { const rows = Object.entries(t.byApp).sort((a, b) => b[1] - a[1]).map(([id, k]) => [`${appById(id).name} (${rn(appById(id).room)})`, r2(k), `${Math.round(k / t.total * 100)}%`, cost(k)]); table = { columns: ["Appliance", "Energy (kWh)", "Share", "Est. cost (PKR)"], rows }; chart = { type: "hbar", labels: rows.map((r) => r[0]), values: rows.map((r) => r[1]), label: "kWh" }; }
      else if (kind === "cost") { const b = WW.tariff.bill(m.units, c); const rows = b.breakdown.map((x) => [x.slab, x.units, x.rate, x.cost]); rows.push(["Fixed charge", "", "", b.fixed], ["Adjustment", "", "", b.adjustment], ["Tax", "", "", b.tax], ["ESTIMATED TOTAL", m.units, "", b.total]); table = { columns: ["Slab / item", "Units", "Rate (PKR)", "Cost (PKR)"], rows }; chart = { type: "bar", labels: t.labels, values: t.values.map(cost), label: "PKR" }; }
      else { const sv = demoSavings(), v = sv.verified, rows = sv.appliances.map((x) => [x.name, x.baseline, x.optimized, x.savedKwh, x.savedPkr]); rows.push(["VERIFIED TOTAL (net of WattWise's own use)", v.baselineAvgDaily, v.optimizedAvgDaily, v.savedKwh, v.savedPkr], ["ESTIMATED (automation log, assumption)", "", "", sv.estimated.kwh, sv.estimated.pkr], ["POTENTIAL (not yet saved)", "", "", sv.potential.kwhMonth, sv.potential.pkrMonth]);
        table = { columns: ["Item", "Baseline kWh/day", "Optimized kWh/day", "Energy saved (kWh)", "Money saved (PKR)"], rows }; const nr = rows.filter((r) => typeof r[3] === "number"); chart = { type: "bar", labels: nr.map((r) => r[0].slice(0, 28)), values: nr.map((r) => r[3]), label: "kWh saved" }; }
      return wrap({ kind, period: { start: t.info.start.toISOString(), end: t.info.end.toISOString() }, summary: { kwh: r2(t.total), cost: cost(t.total), avgDaily: r2(t.total / days) }, chart, table, estimate: true });
    },
    async getSensors() {
      const comps = [["ESP32 node", "Room controller"], ["PZEM-004T", "Energy meter"], ["LD2410", "mmWave presence"], ["PIR", "Motion sensor"], ["BME280", "Temperature / humidity"], ["BH1750", "Ambient light"], ["Reed switch", "Door state"], ["Relay module", "Appliance switching"]];
      return wrap({ simulated: true, rooms: ROOMS.map((r) => ({ id: r.id, name: r.name, node: r.node, components: comps.map(([component, role], i) => ({ id: `${r.id}:${i}`, component: i === 0 ? (r.id === "lounge" ? "ESP32-S3 N16R8" : "ESP32-C3") : component, role, online: false, state: "simulated" })) })) });
    },
    async getSettings() { return { general: { ...S.general, theme: WW.prefs.theme }, tariff: WW.tariff.clone(S.tariff) }; },
    async saveGeneral(g) { S.general = { ...S.general, ...g }; save(); return { ok: true }; },
    async saveTariff(t) { S.tariff = { ...t, example: false }; save(); return { ok: true }; },
    async estimate(units) { return { units, bill: WW.tariff.bill(units, cfg()), slab: WW.tariff.slab(units, cfg()) }; },
    async reset() { S = freshState(); save(); return { ok: true }; },
    unreadCount() { return buildAlerts().filter((a) => !a.read && a.severity !== "info").length; },
  };
  const sameTime = (yAgg) => { const H = now().getHours() + now().getMinutes() / 60; let s = 0; const d = addDays(day0(now()), -1); APPS.forEach((a) => appHourly(a, d).forEach((v, h) => { if (h < Math.floor(H)) s += v; else if (h === Math.floor(H)) s += v * (H - Math.floor(H)); })); return s; };
  function aggregateHours(range) { const info = rangeInfo(range), out = Array(24).fill(0); const nDays = Math.max(1, Math.round((day0(info.end) - day0(info.start)) / 864e5) + 1);
    for (let i = 0; i < nDays; i++) { const d = addDays(day0(info.start), i); if (d > now()) break; APPS.forEach((a) => dayApp(a, d).forEach((v, h) => (out[h] += v / (info.bucket === "day" ? nDays : 1)))); } return out; }
  /* Read-only view of the simulation model for js/demo/demo-modules.js (keeps new modules consistent with the same simulated home). */
  A.__model = { ROOMS, APPS, SOCKETS, occHour, occupancyNow, envNow, aggregate, appHourly, appHourlyToday, applianceNow, monthToDate, cfg, day0, addDays, ds, hourLabel, r2, costOf,
    wasteByApp, potentialMonthKwh, buildAlerts, state: () => S, K: () => K, rnd, wrap, appById, isMetered, now, baseHour, sameTime, onKwhPerHour };
  return A;
})();
