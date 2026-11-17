/* Chart.js helpers with the WattWise look. Pie charts are deliberately not offered for the Appliances page. */
window.WW = window.WW || {};
WW.charts = (function () {
  const reg = [];
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const green = () => css("--forest") || "#315D3A";
  function base(unit) {
    return { responsive: true, maintainAspectRatio: false, animation: { duration: WW.charts.animate ? 500 : 0 },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: "#23452C", padding: 10, cornerRadius: 10, callbacks: { label: (c) => ` ${Number(c.parsed.y ?? c.parsed.x ?? c.parsed).toFixed(2)} ${unit || ""}` } } } };
  }
  const grid = () => ({ color: css("--line"), drawBorder: false });
  function mk(id, cfg) { const el = typeof id === "string" ? document.getElementById(id) : id; if (!el) return null; const c = new Chart(el, cfg); reg.push(c); return c; }
  function area(ctx, color) { const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height || 260); g.addColorStop(0, color + "55"); g.addColorStop(1, color + "05"); return g; }
  return {
    animate: true,
    destroyAll() { while (reg.length) { try { reg.pop().destroy(); } catch (e) {} } },
    line(id, labels, values, { unit = "kWh", yTitle = "Energy (kWh)", color } = {}) {
      color = color || green();
      return mk(id, { type: "line", data: { labels, datasets: [{ data: values, borderColor: color, borderWidth: 3, tension: .35, fill: true, backgroundColor: (c) => area(c, color), pointBackgroundColor: "#fff", pointBorderColor: color, pointBorderWidth: 2.5, pointRadius: labels.length > 20 ? 0 : 4, pointHoverRadius: 6 }] },
        options: { ...base(unit), scales: { x: { grid: { display: false }, ticks: { color: css("--muted"), maxRotation: 0, autoSkip: true, maxTicksLimit: 9 } }, y: { beginAtZero: true, grid: grid(), title: { display: !!yTitle, text: yTitle, color: css("--muted") }, ticks: { color: css("--muted") } } } } });
    },
    bar(id, labels, values, { unit = "kWh", yTitle = "Energy (kWh)", highlight = [], shades = false } = {}) {
      const g = green(), n = values.length;
      const cols = values.map((v, i) => (v < 0 ? "#B8433A" : highlight.includes(i) ? "#D9A23A" : shades ? g + Math.round(70 + 185 * (i / Math.max(1, n - 1))).toString(16).padStart(2, "0") : g));
      return mk(id, { type: "bar", data: { labels, datasets: [{ data: values, backgroundColor: cols, borderRadius: 8, maxBarThickness: 36 }] },
        options: { ...base(unit), scales: { x: { grid: { display: false }, ticks: { color: css("--muted"), maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } }, y: { beginAtZero: true, grid: grid(), title: { display: !!yTitle, text: yTitle, color: css("--muted") }, ticks: { color: css("--muted") } } } } });
    },
    grouped(id, labels, datasets, { unit = "kWh", yTitle = "Energy (kWh)" } = {}) {   // e.g. baseline vs optimized; null = no data for that period
      return mk(id, { type: "bar", data: { labels, datasets: datasets.map((d) => ({ label: d.label, data: d.data, backgroundColor: d.color, borderRadius: 7, maxBarThickness: 28 })) },
        options: { ...base(unit), plugins: { ...base(unit).plugins, legend: { display: true, labels: { color: css("--muted"), usePointStyle: true, boxWidth: 8 } } },
          scales: { x: { grid: { display: false }, ticks: { color: css("--muted"), maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } }, y: { beginAtZero: true, grid: grid(), title: { display: true, text: yTitle, color: css("--muted") }, ticks: { color: css("--muted") } } } } });
    },
    hbar(id, labels, values, { unit = "kWh" } = {}) {
      return mk(id, { type: "bar", data: { labels, datasets: [{ data: values, backgroundColor: labels.map((_, i) => green() + Math.max(80, 255 - i * 35).toString(16).padStart(2, "0")), borderRadius: 8, barThickness: 18 }] },
        options: { ...base(unit), indexAxis: "y", scales: { x: { beginAtZero: true, grid: grid(), title: { display: true, text: "Energy (kWh)", color: css("--muted") }, ticks: { color: css("--muted") } }, y: { grid: { display: false }, ticks: { color: css("--text") } } } } });
    },
    doughnut(id, labels, values, centerText) { // used on Analytics/Reports only (never on Appliances)
      const shades = ["#315D3A", "#7FA886", "#B8CCB0", "#D5E2CF", "#94B58C"];
      return mk(id, { type: "doughnut", data: { labels, datasets: [{ data: values, backgroundColor: labels.map((_, i) => shades[i % shades.length]), borderWidth: 3, borderColor: css("--card") }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: "66%", animation: { duration: WW.charts.animate ? 500 : 0 }, plugins: { legend: { display: false }, tooltip: { backgroundColor: "#23452C", callbacks: { label: (c) => ` ${c.label}: ${c.parsed.toFixed(2)} kWh` } } } },
        plugins: [{ id: "center", afterDraw(ch) { if (!centerText) return; const { ctx, chartArea: a } = ch; ctx.save(); ctx.textAlign = "center"; ctx.fillStyle = css("--text"); ctx.font = "800 22px Inter,system-ui"; ctx.fillText(centerText[0], (a.left + a.right) / 2, (a.top + a.bottom) / 2 + 2); ctx.font = "13px Inter,system-ui"; ctx.fillStyle = css("--muted"); ctx.fillText(centerText[1], (a.left + a.right) / 2, (a.top + a.bottom) / 2 + 22); ctx.restore(); } }] });
    },
    /* ---- v3 helpers used by the module pages ---- */
    make: (id, cfg) => mk(id, cfg),   // register any Chart.js config so destroyAll() cleans it up on refresh
    /* bars (left axis) + stepped line (right axis), e.g. hourly energy vs number of occupied rooms */
    combo(id, labels, bars, line, { barLabel = "Energy (kWh)", lineLabel = "Occupied rooms", barUnit = "kWh", lineMax = 3, lineStep = 1, stepped = true } = {}) {
      return mk(id, { data: { labels, datasets: [
        { type: "bar", label: barLabel, data: bars, backgroundColor: green() + "AA", borderRadius: 6, maxBarThickness: 26, yAxisID: "y", order: 2 },
        { type: "line", label: lineLabel, data: line, borderColor: "#D9A23A", borderWidth: 3, stepped, pointRadius: 0, yAxisID: "y1", order: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, animation: { duration: WW.charts.animate ? 500 : 0 }, interaction: { mode: "index", intersect: false },
          plugins: { legend: { display: true, labels: { color: css("--muted"), usePointStyle: true, boxWidth: 8 } }, tooltip: { backgroundColor: "#23452C" } },
          scales: { x: { grid: { display: false }, ticks: { color: css("--muted"), maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
            y: { beginAtZero: true, grid: grid(), title: { display: true, text: barLabel, color: css("--muted") }, ticks: { color: css("--muted") } },
            y1: { position: "right", beginAtZero: true, max: lineMax, ticks: { stepSize: lineStep, color: css("--muted") }, grid: { display: false }, title: { display: true, text: lineLabel, color: css("--muted") } } } } });
    },
    /* actual vs predicted with a shaded confidence band and an optional baseline. Missing values stay null (gaps, never invented). */
    band(id, labels, { actual, predicted, low, high, baseline }, { unit = "kWh", yTitle = "Energy (kWh)" } = {}) {
      const ds = [];
      if (low && high) { ds.push({ label: "Lower bound", data: low, borderColor: "transparent", pointRadius: 0, fill: false, order: 5 });
        ds.push({ label: "Confidence band", data: high, borderColor: "transparent", backgroundColor: "#3B6C8E22", pointRadius: 0, fill: "-1", order: 5 }); }
      if (baseline) ds.push({ label: "Baseline (same hour yesterday)", data: baseline, borderColor: "#9BA39A", borderDash: [2, 4], borderWidth: 2, pointRadius: 0, tension: .25, order: 3 });
      if (predicted) ds.push({ label: "Predicted", data: predicted, borderColor: "#3B6C8E", borderDash: [6, 5], borderWidth: 3, pointRadius: 2, tension: .3, order: 2 });
      if (actual) ds.push({ label: "Actual", data: actual, borderColor: green(), borderWidth: 3, pointRadius: 0, tension: .3, spanGaps: false, order: 1 });
      return mk(id, { type: "line", data: { labels, datasets: ds }, options: { responsive: true, maintainAspectRatio: false, animation: { duration: WW.charts.animate ? 500 : 0 }, interaction: { mode: "index", intersect: false },
        plugins: { legend: { display: true, labels: { color: css("--muted"), usePointStyle: true, boxWidth: 8, filter: (i) => i.text !== "Lower bound" } }, tooltip: { backgroundColor: "#23452C", callbacks: { label: (c) => c.parsed.y == null ? ` ${c.dataset.label}: —` : ` ${c.dataset.label}: ${Number(c.parsed.y).toFixed(2)} ${unit}` } } },
        scales: { x: { grid: { display: false }, ticks: { color: css("--muted"), maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } }, y: { beginAtZero: true, grid: grid(), title: { display: true, text: yTitle, color: css("--muted") }, ticks: { color: css("--muted") } } } } });
    },
    stacked(id, labels, datasets, { unit = "kWh", yTitle = "Energy (kWh)" } = {}) {
      return mk(id, { type: "bar", data: { labels, datasets: datasets.map((d) => ({ label: d.label, data: d.data, backgroundColor: d.color, borderRadius: 4, maxBarThickness: 34 })) },
        options: { responsive: true, maintainAspectRatio: false, animation: { duration: WW.charts.animate ? 500 : 0 }, plugins: { legend: { display: true, labels: { color: css("--muted"), usePointStyle: true, boxWidth: 8 } }, tooltip: { backgroundColor: "#23452C" } },
          scales: { x: { stacked: true, grid: { display: false }, ticks: { color: css("--muted"), maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } }, y: { stacked: true, beginAtZero: true, grid: grid(), title: { display: true, text: yTitle, color: css("--muted") }, ticks: { color: css("--muted") } } } } });
    },
    forecast(id, labels, actual, forecast) {
      return mk(id, { type: "line", data: { labels, datasets: [
        { label: "Actual", data: actual, borderColor: green(), borderWidth: 3, tension: .3, pointRadius: 0 },
        { label: "Forecast", data: forecast, borderColor: "#3B6C8E", borderDash: [6, 5], borderWidth: 3, tension: .3, pointRadius: 3 }] },
        options: { responsive: true, maintainAspectRatio: false, animation: { duration: 0 }, plugins: { legend: { display: true, labels: { color: css("--muted"), usePointStyle: true } } }, scales: { x: { grid: { display: false }, ticks: { color: css("--muted"), maxTicksLimit: 8 } }, y: { beginAtZero: true, grid: grid(), title: { display: true, text: "kWh / hour", color: css("--muted") }, ticks: { color: css("--muted") } } } } });
    },
  };
})();
