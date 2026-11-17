/* Reports: daily/weekly/monthly/room/appliance/cost/savings with chart + table, CSV export and downloadable report. */
(function () {
  let D = null, kind = sessionStorage.getItem("ww_rep") || "monthly";
  const KINDS = [["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"], ["room", "Room-wise"], ["appliance", "Appliance-wise"], ["cost", "Cost"], ["savings", "Savings"]];
  const tag = () => (WW.isSim(D) ? "DEMO DATA (simulated)" : "LIVE DATA");
  function csv() { return WW.toCSV(D.table.columns, D.table.rows, [["WattWise report", kind, tag(), "ESTIMATES - not an official electricity bill"], ["Period", D.period.start, D.period.end]]); }
  function html() {
    return `<!doctype html><meta charset="utf-8"><title>WattWise ${kind} report</title><style>body{font-family:Segoe UI,Arial;margin:32px;color:#263329}h1{color:#23452C}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#E5EBDD}.tag{display:inline-block;background:#FFF3D6;padding:4px 10px;border-radius:99px;font-weight:700}</style>
    <h1>WattWise — ${KINDS.find((k) => k[0] === kind)[1]} Report</h1><p><span class="tag">${tag()}</span> &nbsp; ${new Date(D.period.start).toLocaleDateString()} – ${new Date(D.period.end).toLocaleDateString()}</p>
    <p><b>Total:</b> ${D.summary.kwh} kWh &nbsp; <b>Estimated cost:</b> Rs. ${Math.round(D.summary.cost)} &nbsp; <b>Average:</b> ${D.summary.avgDaily} kWh/day</p>
    <table><tr>${D.table.columns.map((c) => `<th>${WW.esc(c)}</th>`).join("")}</tr>${D.table.rows.map((r) => `<tr>${r.map((c) => `<td>${WW.esc(c)}</td>`).join("")}</tr>`).join("")}</table>
    <p><i>All costs are estimates from the configured tariff and are not an official electricity bill.${WW.isSim(D) ? " Values are simulated demo data, not measurements." : ""}</i></p>`;
  }
  WW.page = {
    title: "Reports", subtitle: "View and download detailed energy and cost reports.",
    async render({ range }) {
      D = await WW.data.getReport(kind, range);
      const tabs = `<div class="chips" style="margin-bottom:16px">${KINDS.map(([k, l]) => `<button class="chip ${kind === k ? "on" : ""}" data-k="${k}">${l}</button>`).join("")}</div>`;
      if (!D.available) return tabs + WW.waiting(D.message);
      const s = D.summary;
      return `${WW.isSim(D) ? `<div class="banner demo">${WW.icon("info", 18)} <b>DEMO REPORT</b> — generated from simulated data.</div>` : ""}${tabs}
      <div class="grid g4"><div class="card statcard"><span class="hicon">${WW.icon("zap", 20)}</span><div><div class="lbl">Total Consumption</div><div class="val">${WW.fmt.kwh(s.kwh)}</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("coins", 20)}</span><div><div class="lbl">Estimated Cost</div><div class="val">${WW.fmt.pkr(s.cost)}</div></div></div>
        <div class="card statcard"><span class="hicon">${WW.icon("chart-line", 20)}</span><div><div class="lbl">Average / day</div><div class="val">${WW.fmt.kwh(s.avgDaily)}</div></div></div>
        <div class="card statcard no-print" style="flex-wrap:wrap;gap:8px"><button class="btn sm" id="csv">${WW.icon("download", 14)} Export CSV</button><button class="btn ghost sm" id="dl">${WW.icon("file-text", 14)} Download report</button><button class="btn ghost sm" id="prt">Print / PDF</button></div></div>
      <div class="grid g2 mt"><section class="card"><div class="card-h"><span class="hicon">${WW.icon("chart-column", 20)}</span><h3>${KINDS.find((k) => k[0] === kind)[1]} ${D.chart.type === "doughnut" ? "Share" : "Chart"}</h3></div><div class="chart-box"><canvas id="rc" role="img" aria-label="Report chart"></canvas></div></section>
        <section class="card"><div class="card-h"><span class="hicon">${WW.icon("file-text", 20)}</span><h3>Details</h3></div><div class="scroll-x" style="max-height:330px;overflow-y:auto"><table class="tbl"><thead><tr>${D.table.columns.map((c) => `<th>${WW.esc(c)}</th>`).join("")}</tr></thead><tbody>${D.table.rows.map((r) => `<tr>${r.map((c) => `<td>${WW.esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section></div>
      <div class="note mt">${WW.icon("info", 16)}<span>All costs are <b>estimates</b> using the configured tariff — not an official electricity bill. Date range follows the selector at the top.</span></div>`;
    },
    after() {
      WW.$$("[data-k]").forEach((b) => (b.onclick = () => { kind = b.dataset.k; sessionStorage.setItem("ww_rep", kind); WW.reload(); }));
      if (!D || !D.available) return;
      const c = D.chart; if (c.type === "doughnut") WW.charts.doughnut("rc", c.labels, c.values, [c.values.reduce((a, b) => a + b, 0).toFixed(1), "kWh"]); else if (c.type === "hbar") WW.charts.hbar("rc", c.labels, c.values); else WW.charts.bar("rc", c.labels, c.values, { unit: c.label, yTitle: c.label, shades: true });
      WW.$("#csv").onclick = () => WW.download(`wattwise-${kind}-${D.source}.csv`, csv());
      WW.$("#dl").onclick = () => WW.download(`wattwise-${kind}-report.html`, html(), "text/html");
      WW.$("#prt").onclick = () => window.print();
    },
  };
})();
