/* M10 — What-if & optimisation analysis. The page collects a scenario, sends it to the backend (/whatif/simulate) and shows the ESTIMATE it returns.
   No saving is ever presented as achieved. Up to three scenarios can be kept for side-by-side comparison. */
(function () {
  let B = null, adj = {}, vac = false, last = null, timer = null, saved = [];
  try { saved = JSON.parse(sessionStorage.getItem("ww_whatif_saved") || "[]"); } catch (e) { saved = []; }
  const persist = () => { try { sessionStorage.setItem("ww_whatif_saved", JSON.stringify(saved)); } catch (e) {} };
  const payload = (name) => ({ name: name || "Scenario", switchOffWhenVacant: vac, adjustments: B.appliances.map((a) => ({ applianceId: a.id, reducePct: (adj[a.id] || {}).reduce || 0, shiftPeakPct: (adj[a.id] || {}).shift || 0 })) });
  const signed = (v, f) => `<span class="${v < 0 ? "delta-good" : v > 0 ? "delta-bad" : ""}">${v > 0 ? "+" : ""}${f(v)}</span>`;
  const sliders = () => B.appliances.map((a) => { const j = adj[a.id] || (adj[a.id] = { reduce: 0, shift: 0 });
    return `<div class="slider-row"><div><b>${WW.esc(a.name)}</b> <span class="small">· ${WW.esc(a.room)}</span><div class="small">${WW.fmt.kwh(a.monthKwh)} / month · ${WW.fmt.kwh(a.peakKwh)} in peak</div></div>
      <input type="range" min="0" max="100" step="5" value="${j.reduce}" data-a="${a.id}" data-k="reduce" aria-label="Reduce ${WW.esc(a.name)} usage in ${WW.esc(a.room)}"><b id="r-${a.id}">${j.reduce}%</b></div>
      ${a.flexible ? `<div class="slider-row"><div class="small" style="padding-left:14px">↳ shift peak use to off-peak</div><input type="range" min="0" max="100" step="10" value="${j.shift}" data-a="${a.id}" data-k="shift" aria-label="Shift ${WW.esc(a.name)} out of peak"><b id="s-${a.id}">${j.shift}%</b></div>` : ""}`; }).join("");
  function resultHtml(R) {
    if (!R) return WW.emptyState("Adjust a slider", "Your estimate appears here.", "sliders-horizontal");
    const b = R.baseline, s = R.scenario, d = R.delta;
    return `<div class="grid g2"><div class="reading"><div class="lbl">Baseline / month</div><div class="val">${WW.fmt.kwh(b.monthKwh, 0)}</div><div class="small">${WW.fmt.pkr(b.monthCost)} · ${WW.esc(b.slabLabel)}</div></div>
      <div class="reading"><div class="lbl">Scenario / month</div><div class="val">${WW.fmt.kwh(s.monthKwh, 0)}</div><div class="small">${WW.fmt.pkr(s.monthCost)} · ${WW.esc(s.slabLabel)}</div></div></div>
      <div class="grid g3 mt"><div class="statcard"><div><div class="lbl">Energy difference</div><div class="val">${signed(d.kwh, (v) => WW.fmt.kwh(v, 1))}</div></div></div>
      <div class="statcard"><div><div class="lbl">Cost difference</div><div class="val">${signed(d.cost, (v) => (v < 0 ? "−" : "") + WW.fmt.pkr(Math.abs(v)))}</div></div></div>
      <div class="statcard"><div><div class="lbl">Change</div><div class="val">${signed(d.pct, (v) => v.toFixed(1) + "%")}</div></div></div></div>
      ${(R.notes || []).map((n) => `<div class="note warn mt-s">${WW.icon("info", 16)}<span>${WW.esc(n)}</span></div>`).join("")}
      <div class="chart-box mt"><canvas id="wfc"></canvas></div>
      <div class="small mt-s"><b>ESTIMATE.</b> ${WW.esc(R.basis || "")}. ${(R.assumptions || []).map(WW.esc).join(" ")}</div>`;
  }
  function drawChart(R) {
    if (!R || !WW.$("#wfc")) return; const rows = R.byAppliance.filter((x) => x.baselineKwh > 0).slice(0, 10);
    WW.charts.make("wfc", { type: "bar", data: { labels: rows.map((x) => `${x.name} (${x.room})`), datasets: [{ label: "Baseline (kWh/month)", data: rows.map((x) => x.baselineKwh), backgroundColor: "#B8CCB0", borderRadius: 4 }, { label: "Scenario (kWh/month)", data: rows.map((x) => x.scenarioKwh), backgroundColor: "#315D3A", borderRadius: 4 }] },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, labels: { usePointStyle: true, boxWidth: 8 } } }, scales: { x: { beginAtZero: true, title: { display: true, text: "kWh per month (estimate)" } } } } });
  }
  async function run() {
    const box = WW.$("#wfres"); if (!box) return;
    const v = WW.validate.scenario({ adjustments: payload().adjustments.map((a) => ({ ...a })) });
    if (!v.ok) { box.innerHTML = `<div class="errorbox">${WW.esc(v.message)}</div>`; return; }
    box.style.opacity = ".55";
    try { last = await WW.data.simulateWhatIf(payload()); if (!last.available) { box.innerHTML = WW.emptyState("No estimate available", last.message || ""); last = null; } else { box.innerHTML = resultHtml(last); drawChart(last); } }
    catch (e) { last = null; box.innerHTML = WW.errorBox(e); }
    box.style.opacity = "1"; renderTou();
  }
  function renderTou() {
    const el = WW.$("#tou"); if (!el) return; const t = B.tariff;
    el.innerHTML = last ? `<div class="grid g3"><div class="reading"><div class="lbl">Peak window</div><div class="val" style="font-size:17px">${WW.esc(B.peakWindow)}</div></div><div class="reading"><div class="lbl">Peak energy (baseline → scenario)</div><div class="val" style="font-size:17px">${WW.fmt.kwh(last.baseline.peakKwh, 0)} → ${WW.fmt.kwh(last.scenario.peakKwh, 0)}</div></div><div class="reading"><div class="lbl">Time-of-use pricing</div><div class="val" style="font-size:17px">${t.touEnabled ? "On" : "Off"}</div></div></div>
      ${WW.estimateNote(t.touEnabled ? "Shifting load out of the peak window lowers the estimated bill because peak and off-peak units are priced differently." : "Time-of-use pricing is off in this tariff, so moving load out of the peak window does not change the estimated cost. Enable it in Settings → Tariff & Billing to see the effect.")}` : WW.emptyState("No estimate yet", "");
  }
  function savedHtml() {
    if (!saved.length) return WW.emptyState("No saved scenarios", "Build a scenario, give it a name and press “Save for comparison”.", "git-compare");
    const best = Math.min(...saved.map((s) => s.delta.cost));
    return `<div class="scroll-x"><table class="tbl compare-tbl"><thead><tr><th>Scenario</th><th>kWh / month</th><th>Cost / month</th><th>Δ energy</th><th>Δ cost</th><th>Δ %</th><th></th></tr></thead><tbody>${saved.map((s, i) => `<tr><td><b>${WW.esc(s.name)}</b>${WW.isSim(s) ? " " + WW.pill("simulated", "warn") : ""}</td><td>${WW.fmt.kwh(s.scenario.monthKwh, 0)}</td><td>${WW.fmt.pkr(s.scenario.monthCost)}</td><td>${signed(s.delta.kwh, (v) => WW.fmt.kwh(v, 1))}</td><td class="${s.delta.cost === best && saved.length > 1 ? "best" : ""}">${signed(s.delta.cost, (v) => (v < 0 ? "−" : "") + WW.fmt.pkr(Math.abs(v)))}</td><td>${signed(s.delta.pct, (v) => v.toFixed(1) + "%")}</td><td><button class="btn ghost sm" data-del="${i}" aria-label="Remove ${WW.esc(s.name)}">${WW.icon("trash-2", 14)}</button></td></tr>`).join("")}</tbody></table></div>
      <div class="small mt-s">All values are estimates from the same baseline. Green = largest estimated cost reduction.</div>`;
  }
  WW.page = {
    title: "What-If", subtitle: "Try changes to your usage and see the estimated effect on energy and cost.", showRange: false, autoRefresh: false,
    async render() {
      B = await WW.data.getWhatIfBaseline(); if (!B.available) return WW.waiting(B.message || "Waiting for baseline data");
      adj = {}; last = null;
      return `${WW.sourceBanner(B, "simulated baseline.")}<div class="note warn" style="margin-bottom:14px">${WW.icon("info", 16)}<span><b>Estimates only.</b> What-if results are modelled from your baseline (${WW.esc(B.basis)}). They are not measurements and are never shown as savings already achieved.</span></div>
      <div class="grid g2"><div class="card"><div class="card-h"><span class="hicon">${WW.icon("sliders-horizontal", 20)}</span><h3>Scenario builder</h3></div>
        <div class="field"><label for="wfname">Scenario name</label><input class="input" id="wfname" maxlength="40" placeholder="e.g. Trim lights and fans"></div>
        <label class="small" style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="wfvac"> Switch appliances off when their room is vacant</label>
        <div id="wfsl">${sliders()}</div>
        <div class="row-between mt"><div class="chips"><button class="chip" id="p10">Trim all 10%</button><button class="chip" id="pshift">Shift flexible loads 50%</button><button class="chip" id="preset">Reset</button></div><button class="btn" id="wfsave">${WW.icon("plus", 16)} Save for comparison</button></div></div>
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon("calculator", 20)}</span><h3>Estimated result</h3>${WW.pill("estimate", "warn")}</div><div id="wfres"></div></div></div>
      <div class="card mt"><div class="card-h"><span class="hicon">${WW.icon("clock", 20)}</span><h3>Time-of-use optimisation</h3></div><div id="tou"></div></div>
      <div class="card mt"><div class="card-h"><span class="hicon">${WW.icon("git-compare", 20)}</span><h3>Scenario comparison</h3></div><div id="wfcmp">${savedHtml()}</div></div>`;
    },
    async after(root) {
      if (!B || !B.available) return;
      const again = () => { clearTimeout(timer); timer = setTimeout(run, 250); };
      const sync = () => B.appliances.forEach((a) => { const j = adj[a.id] || { reduce: 0, shift: 0 }; WW.$$(`[data-a="${a.id}"]`, root).forEach((i) => (i.value = j[i.dataset.k])); const r = WW.$("#r-" + a.id, root), s = WW.$("#s-" + a.id, root); if (r) r.textContent = j.reduce + "%"; if (s) s.textContent = j.shift + "%"; });
      WW.$("#wfsl", root).addEventListener("input", (e) => { const i = e.target; if (!i.dataset.a) return; const v = WW.validate.percent(i.value); if (!v.ok) return; (adj[i.dataset.a] = adj[i.dataset.a] || { reduce: 0, shift: 0 })[i.dataset.k] = v.value; sync(); again(); });
      WW.$("#wfvac", root).onchange = (e) => { vac = e.target.checked; again(); };
      WW.$("#p10", root).onclick = () => { B.appliances.forEach((a) => ((adj[a.id] = adj[a.id] || { reduce: 0, shift: 0 }).reduce = 10)); sync(); again(); };
      WW.$("#pshift", root).onclick = () => { B.appliances.forEach((a) => { if (a.flexible) (adj[a.id] = adj[a.id] || { reduce: 0, shift: 0 }).shift = 50; }); sync(); again(); };
      WW.$("#preset", root).onclick = () => { adj = {}; vac = false; WW.$("#wfvac", root).checked = false; sync(); again(); };
      WW.$("#wfsave", root).onclick = () => { if (!last) return WW.toast("Run an estimate first.", "warn"); if (saved.length >= 3) return WW.toast("You can compare up to 3 scenarios — remove one first.", "warn");
        const name = (WW.$("#wfname", root).value || "").trim() || `Scenario ${saved.length + 1}`; saved.push({ ...last, name }); persist(); WW.$("#wfcmp", root).innerHTML = savedHtml(); bindDel(); WW.toast("Scenario saved for comparison.", ""); };
      const bindDel = () => WW.$$("[data-del]", root).forEach((b) => (b.onclick = () => { saved.splice(Number(b.dataset.del), 1); persist(); WW.$("#wfcmp", root).innerHTML = savedHtml(); bindDel(); }));
      bindDel(); run();
    },
  };
})();
