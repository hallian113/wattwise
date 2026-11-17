/* M13 — Sustainability & net-zero readiness. Efficiency indicators, CO2e ESTIMATES, readiness checklist, solar/storage future-readiness.
   Nothing here claims carbon reductions, sustainability achievements or solar generation: solar & storage are outside the current project scope. */
(function () {
  let D = null;
  const ST = { met: ["✓", "Met"], partial: ["~", "Partly"], not_met: ["–", "Not yet"], unknown: ["?", "Unknown"] };
  const getF = () => { const v = parseFloat(sessionStorage.getItem("ww_co2_factor")); return Number.isFinite(v) ? v : D.impact.emissionFactorKgPerKwh; };
  function impact() {
    const i = D.impact, f = getF(), base = i.emissionFactorKgPerKwh || 1;
    return `<div class="grid g3"><div class="reading"><div class="lbl">CO₂e of this month’s projected use</div><div class="val">${WW.fmt.num(i.monthKwh * f, 1)}<small> kg</small></div><div class="small">${WW.fmt.kwh(i.monthKwh, 0)} × ${f} kg/kWh · estimate</div></div>
      <div class="reading"><div class="lbl">Avoidable CO₂e ${WW.pill("potential", "info")}</div><div class="val">${WW.fmt.num(i.avoidablePotentialCo2eKgMonth * f / base, 1)}<small> kg / month</small></div><div class="small">if vacant-room waste were removed</div></div>
      <div class="reading"><div class="lbl">Measured reduction</div><div class="val">${i.measuredReductionCo2eKg == null ? "Not claimed" : WW.fmt.num(i.measuredReductionCo2eKg, 1) + " kg"}</div><div class="small">${i.measuredReductionCo2eKg == null ? "needs verified (measured) savings" : "from verified savings"}</div></div></div>`;
  }
  function sizing() {
    const s = D.solarStorage.sizing, psh = parseFloat(sessionStorage.getItem("ww_psh")) || 5, pr = parseFloat(sessionStorage.getItem("ww_pr")) || 0.75, kw = s.dailyKwh / (psh * pr);
    return `<div class="grid g3"><div class="field"><label for="psh">Peak sun hours / day (assumption)</label><input class="input" id="psh" type="number" step="0.1" min="1" max="9" value="${psh}"></div>
      <div class="field"><label for="pr">System performance ratio (assumption)</label><input class="input" id="pr" type="number" step="0.01" min="0.5" max="0.95" value="${pr}"></div>
      <div class="reading"><div class="lbl">Indicative array size</div><div class="val" id="kw">${kw.toFixed(1)}<small> kWp</small></div><div class="small">for ${WW.fmt.kwh(s.dailyKwh, 1)} / day</div></div></div>`;
  }
  WW.page = {
    title: "Sustainability", subtitle: "Efficiency indicators and net-zero readiness — estimates, not achievements.", showRange: false,
    async render() {
      D = await WW.data.getSustainability(); if (!D.available) return WW.waiting(D.message || "Waiting for sustainability data");
      const e = D.efficiency, r = D.readiness, ss = D.solarStorage;
      return `${WW.sourceBanner(D, "simulated consumption. Indicators are calculated from it.")}
      <div class="grid g4">
        <div class="card statcard"><span class="hicon">${WW.icon("gauge", 20)}</span><div><div class="lbl">Daily average</div><div class="val">${WW.fmt.kwh(e.dailyAvgKwh)}</div><div class="small muted">${WW.esc(D.period)}</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon(e.trendPct != null && e.trendPct <= 0 ? "trending-down" : "trending-up", 20)}</span><div><div class="lbl">Last 7 days vs previous 7</div><div class="val">${e.trendPct == null ? "—" : WW.fmt.pct(e.trendPct)}</div><div class="small muted">${WW.fmt.kwh(e.last7Kwh, 0)} vs ${WW.fmt.kwh(e.prev7Kwh, 0)}</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("flame", 20)}</span><div><div class="lbl">Avoidable share</div><div class="val">${WW.fmt.num(e.avoidablePct, 1)}%</div><div class="small muted">${WW.fmt.kwh(e.avoidableKwh30d, 0)} used while rooms vacant</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("clock", 20)}</span><div><div class="lbl">Evening-peak share</div><div class="val">${WW.fmt.num(e.peakSharePct, 1)}%</div></div></div>
      </div>
      <div class="grid g3 mt">
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon("person-standing", 20)}</span><h3>Energy per occupied room-hour</h3></div><div class="val" style="font-size:26px;font-weight:800">${e.kwhPerOccupiedRoomHour == null ? "—" : e.kwhPerOccupiedRoomHour + " kWh"}</div><div class="small">All energy used ÷ hours a room was occupied (last 7 days). Lower is better.</div></div>
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon("plug", 20)}</span><h3>Metering coverage</h3></div><div class="val" style="font-size:26px;font-weight:800">${e.meteredCoveragePct}%</div><div class="meter mt-s"><i style="width:${e.meteredCoveragePct}%"></i></div><div class="small mt-s">Appliances measured rather than estimated.</div></div>
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon("target", 20)}</span><h3>Units vs monthly limit</h3></div><div class="val" style="font-size:26px;font-weight:800">${e.unitsVsLimitPct}%</div><div class="meter mt-s"><i style="width:${Math.min(100, e.unitsVsLimitPct)}%"></i></div><div class="small mt-s">Billing-period units used against the configured limit.</div></div>
      </div>
      <div class="card mt"><div class="card-h"><span class="hicon">${WW.icon("factory", 20)}</span><h3>Environmental impact (estimate)</h3></div><div id="imp">${impact()}</div>
        <div class="grid g2 mt"><div class="field"><label for="ef">Emission factor (kg CO₂e per kWh)</label><input class="input" id="ef" type="number" step="0.01" min="0" max="2" value="${getF()}"></div><div class="note warn" style="align-self:end">${WW.icon("info", 16)}<span>${WW.esc(D.impact.factorSource)}</span></div></div>
        ${WW.estimateNote(D.impact.note)}</div>
      <div class="grid g-wide mt">
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon("list-checks", 20)}</span><h3>Net-zero readiness</h3><span class="grow"></span>${WW.pill(`${r.met} of ${r.total} criteria met`, r.met >= r.total * 0.6 ? "ok" : "warn")}</div>
          <div class="ready">${r.criteria.map((c) => `<div class="ready-row"><span class="ic ${c.status}" aria-label="${ST[c.status][1]}">${ST[c.status][0]}</span><div><b>${WW.esc(c.label)}</b> <span class="small">· ${ST[c.status][1]}</span><div class="small">${WW.esc(c.evidence)}</div></div></div>`).join("")}</div>
          ${WW.estimateNote("This checklist counts what is in place today; it is not a certification and not a score of environmental performance.")}</div>
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon("sprout", 20)}</span><h3>Solar & storage readiness</h3><span class="grow"></span>${WW.pill("outside current scope", "grey")}</div>
          <div class="grid g2"><div class="reading"><div class="lbl">${WW.icon("sun", 14)} Solar generation</div><div class="val">Not connected</div></div><div class="reading"><div class="lbl">${WW.icon("battery-charging", 14)} Battery storage</div><div class="val">Not connected</div></div></div>
          <div class="small mt-s"><b>Prepared for later:</b></div><ul class="small stack" style="margin:6px 0 0;padding-left:18px">${ss.hooks.map((h) => `<li>${WW.esc(h)}</li>`).join("")}</ul></div>
      </div>
      <div class="card mt"><div class="card-h"><span class="hicon">${WW.icon("sun", 20)}</span><h3>Indicative solar sizing</h3>${WW.pill("illustrative", "warn")}</div><div id="sz">${sizing()}</div>${WW.estimateNote("Array size = daily consumption ÷ (peak sun hours × performance ratio). This is a rough planning figure, not a design, a quotation or a prediction of generation.")}</div>`;
    },
    after(root) {
      if (!D || !D.available) return;
      const ef = WW.$("#ef", root); ef.oninput = () => { const v = WW.validate.number(ef.value, { min: 0, max: 2, label: "Emission factor" }); if (!v.ok) return; sessionStorage.setItem("ww_co2_factor", v.value); WW.$("#imp", root).innerHTML = impact(); };
      const calc = () => { const a = WW.validate.number(WW.$("#psh", root).value, { min: 1, max: 9, label: "Peak sun hours" }), b = WW.validate.number(WW.$("#pr", root).value, { min: 0.5, max: 0.95, label: "Performance ratio" }); if (!a.ok || !b.ok) return; sessionStorage.setItem("ww_psh", a.value); sessionStorage.setItem("ww_pr", b.value); WW.$("#kw", root).innerHTML = `${(D.solarStorage.sizing.dailyKwh / (a.value * b.value)).toFixed(1)}<small> kWp</small>`; };
      WW.$("#psh", root).oninput = calc; WW.$("#pr", root).oninput = calc;
    },
  };
})();
