/* M5 — AI / ML interfaces: model status & performance, hourly load forecast with confidence band, occupancy prediction, prediction history, datasets.
   FRONTEND ONLY. The models are trained and run by the backend (Talha). If no model is trained, this page says so and shows no accuracy. */
(function () {
  let O = null, F = null, Hh = null;
  const stat = (m) => (m.trained ? WW.pill("trained", "ok") : WW.pill("not trained", "grey"));
  const met = (label, v, unit = "") => `<div class="detail-row"><span class="k">${label}</span><span class="v">${v == null ? "—" : v + unit}</span></div>`;
  function model(m, kind) {
    const x = m.metrics;
    return `<div class="card"><div class="card-h"><span class="hicon">${WW.icon(kind === "load" ? "trending-up" : "person-standing", 20)}</span><h3>${WW.esc(m.name)}</h3><span class="grow"></span>${stat(m)}</div>
      <div class="stack">${met("Data split", WW.esc(m.split))}${met("Baseline for comparison", WW.esc(m.baseline))}${met("Trained at", m.trainedAt ? WW.fmt.when(m.trainedAt) : null)}${met("Training samples", m.samples)}
      ${x ? (kind === "load" ? met("MAE", WW.fmt.num(x.maeKwh, 3), " kWh") + met("RMSE", WW.fmt.num(x.rmseKwh, 3), " kWh") + met("MAPE", WW.fmt.num(x.mapePct, 1), " %") + met("Baseline MAE", WW.fmt.num(x.baselineMaeKwh, 3), " kWh") + met("Improvement vs baseline", WW.fmt.num(x.improvementPct, 1), " %")
        : met("Accuracy", WW.fmt.num(x.accuracy * 100, 1), " %") + met("Precision", WW.fmt.num(x.precision * 100, 1), " %") + met("Recall", WW.fmt.num(x.recall * 100, 1), " %") + met("F1", WW.fmt.num(x.f1, 2)) + met("Baseline accuracy", WW.fmt.num(x.baselineAccuracy * 100, 1), " %"))
        : `<div class="note warn">${WW.icon("info", 16)}<span>${WW.esc(m.reason || "No performance metrics are available.")}</span></div>`}</div>
      <div class="chips-in mt-s">${(m.features || []).map((f) => `<span>${WW.esc(f)}</span>`).join("")}</div></div>`;
  }
  const heatColor = (p) => `rgba(49,93,58,${(0.1 + p * 0.75).toFixed(2)})`;
  const heat = (o) => `<div class="heat"><span></span>${o.hours.map((h) => `<span class="hd">${h}</span>`).join("")}</div>` + o.rooms.map((r) => `<div class="heat" style="margin-top:4px"><span><b>${WW.esc(r.name)}</b></span>${r.probabilities.map((p) => `<span class="cell" style="background:${heatColor(p)};color:${p > 0.5 ? "#fff" : "var(--forest-d)"}">${Math.round(p * 100)}%</span>`).join("")}</div>`).join("");
  WW.page = {
    title: "AI Insights", subtitle: "Load forecast and occupancy prediction — interfaces for the backend models.", showRange: false,
    async render() {
      [O, F, Hh] = await Promise.all([WW.data.getAiOverview(), WW.data.getAiForecast(), WW.data.getAiHistory(24)]);
      if (!O.available) return WW.waiting(O.message || "Waiting for AI status");
      const sim = WW.isSim(F);
      return `${sim ? `<div class="banner sim">${WW.icon("flask-conical", 18)} <b>SIMULATED</b> — ${WW.esc(F.label || "These curves illustrate the interface only. No model has been trained.")}</div>` : ""}
      <div class="grid g2">${model(O.loadModel, "load")}${model(O.occupancyModel, "occ")}</div>
      <div class="card mt"><div class="card-h"><span class="hicon">${WW.icon("chart-line", 20)}</span><h3>Hourly load forecast — today</h3><span class="grow"></span>${sim ? WW.pill("simulated", "warn") : WW.pill("model output", "ok")}</div>
        ${F.available ? `<div class="chart-box lg"><canvas id="fc"></canvas></div><div class="small mt-s">${WW.esc((F.load || {}).bandNote || "Shaded area is the model’s confidence band.")} Gaps mean “no actual reading yet”.</div>` : WW.emptyState("No forecast available", F.message || "The backend has not produced a forecast.")}</div>
      <div class="grid g-wide mt">
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon("person-standing", 20)}</span><h3>Occupancy prediction — next 6 hours</h3></div>${F.available ? heat(F.occupancy) + `<div class="small mt">${WW.esc(F.occupancy.note || "Probability that each room is occupied.")}</div>` : WW.emptyState("No prediction available", "")}</div>
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon("database", 20)}</span><h3>Datasets</h3></div><div class="stack">${(O.datasets || []).map((d) => `<div><b>${WW.esc(d.name)}</b><div class="small">${WW.esc(d.role)}</div><div class="small">${d.url ? `<a href="${WW.esc(d.url)}" target="_blank" rel="noopener">${WW.esc(d.reference)} ↗</a>` : WW.esc(d.reference)}</div></div>`).join("")}</div></div>
      </div>
      <div class="card mt"><div class="card-h"><span class="hicon">${WW.icon("history", 20)}</span><h3>Prediction history</h3><span class="grow"></span>${WW.isSim(Hh) ? WW.pill("simulated", "warn") : ""}</div>
        ${Hh.available && Hh.rows.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Hour</th><th>Target</th><th>Predicted</th><th>Actual</th><th>Abs. error</th></tr></thead><tbody>${Hh.rows.slice(0, 12).map((r) => `<tr><td>${WW.fmt.when(r.time)}</td><td>${WW.esc(r.target)}</td><td>${WW.fmt.kwh(r.predicted, 2)}</td><td>${r.actual == null ? "—" : WW.fmt.kwh(r.actual, 2)}</td><td>${r.errorAbs == null ? "—" : WW.fmt.kwh(r.errorAbs, 2)}</td></tr>`).join("")}</tbody></table></div>
          <div class="small mt-s">${WW.esc((Hh.summary && Hh.summary.note) || "")}${Hh.summary && Hh.summary.maeKwh != null ? ` Mean absolute error: ${WW.fmt.kwh(Hh.summary.maeKwh, 3)}.` : ""}</div>` : WW.emptyState("No prediction history yet", Hh.message || "History appears after the backend has made predictions and the real values have arrived.")}</div>
      <div class="grid g2 mt">
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon("shield-check", 20)}</span><h3>Rules first, ML on top</h3></div><p class="small" style="margin:0">${WW.esc(O.rulesFirst || "")}</p></div>
        <div class="card"><div class="card-h"><span class="hicon">${WW.icon("wrench", 20)}</span><h3>Extended goals</h3></div><div class="stack">${(O.extended || []).map((e) => `<div class="detail-row"><span class="k">${WW.esc(e.name)}<div class="small">${WW.esc(e.note)}</div></span><span class="v">${WW.pill(e.status === "not_implemented" ? "not implemented" : e.status, "grey")}</span></div>`).join("")}</div></div>
      </div>`;
    },
    after() {
      if (!O || !O.available) return;
      if (!F || !F.available) return; const l = F.load;
      WW.charts.band("fc", l.labels, { actual: l.actual, predicted: l.predicted, low: l.low, high: l.high, baseline: l.baseline }, { unit: l.unit || "kWh" });
    },
  };
})();
