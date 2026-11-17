/* JS port of backend/services/tariff.py — used by the DEMO data service only.
   Live mode always uses the backend's own calculation. All values are ESTIMATES. */
window.WW = window.WW || {};
WW.tariff = (function () {
  const DEFAULT = {
    example: true, category: "protected", monthly_limit: 200, method: "telescopic",
    protected_slabs: [{ from: 1, to: 100, rate: 10.54 }, { from: 101, to: 200, rate: 13.01 }],
    unprotected_slabs: [
      { from: 1, to: 100, rate: 22.44 }, { from: 101, to: 200, rate: 28.91 }, { from: 201, to: 300, rate: 33.10 }, { from: 301, to: 400, rate: 36.46 },
      { from: 401, to: 500, rate: 38.95 }, { from: 501, to: 600, rate: 40.22 }, { from: 601, to: 700, rate: 41.62 }, { from: 701, to: null, rate: 47.69 }],
    fixed_charge: 0, tax_percent: 0, adjustment_per_unit: 0,
    tou: { enabled: false, peak_start: "18:00", peak_end: "22:00", peak_rate: 0, offpeak_rate: 0 },
    alerts: { enabled: true, thresholds: [150, 180, 190, 200], increase_percent: 30 },
    billing: { period_start_day: 1, last_month_units: 190, start_reading_kwh: null, unmetered_kwh_per_day: 0 },
  };
  const inf = (v) => (v == null ? Infinity : v);
  const effCat = (u, c) => (c.category === "protected" && u > c.monthly_limit ? "unprotected" : c.category);
  function bill(units, c) {
    const cat = effCat(units, c), slabs = c[cat + "_slabs"] || [];
    let energy = 0; const breakdown = [];
    if (c.method === "flat_slab") {
      for (const s of slabs) if (units <= inf(s.to)) { energy = units * s.rate; breakdown.push({ slab: `${s.from}–${s.to ?? "+"}`, units, rate: s.rate, cost: energy }); break; }
    } else {
      let prev = 0;
      for (const s of slabs) {
        const take = Math.max(0, Math.min(units, inf(s.to)) - prev);
        if (take > 0) { const cst = take * s.rate; energy += cst; breakdown.push({ slab: `${s.from}–${s.to ?? "+"}`, units: +take.toFixed(2), rate: s.rate, cost: +cst.toFixed(2) }); }
        prev = inf(s.to); if (units <= prev) break;
      }
    }
    const adj = units * (c.adjustment_per_unit || 0), fixed = c.fixed_charge || 0, tax = (energy + adj + fixed) * (c.tax_percent || 0) / 100;
    return { category: cat, energy, adjustment: adj, fixed, tax, total: +(energy + adj + fixed + tax).toFixed(2), breakdown, estimate: true };
  }
  function marginal(units, c) {
    const slabs = c[effCat(units, c) + "_slabs"] || [];
    for (const s of slabs) if (units <= inf(s.to)) return s.rate;
    return slabs.length ? slabs[slabs.length - 1].rate : 0;
  }
  function slab(units, c) {
    const cat = effCat(units, c), slabs = c[cat + "_slabs"] || []; let cur = slabs[slabs.length - 1];
    for (const s of slabs) if (units <= inf(s.to)) { cur = s; break; }
    const r = slabs.map((s) => s.rate);
    return { category: cat, label: cur ? `${cur.from} – ${cur.to ?? "+"} units` : "—", rate: cur?.rate || 0, rateText: r.length ? `Rs. ${Math.min(...r).toFixed(2)} – ${Math.max(...r).toFixed(2)} / unit` : "" };
  }
  const project = (u, elapsed, dim) => { const p = elapsed > 0 ? (u / elapsed) * dim : u; return { projected: +p.toFixed(1), low: +(p * 0.92).toFixed(1), high: +(p * 1.08).toFixed(1) }; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  return { DEFAULT, bill, marginal, slab, project, effCat, clone };
})();
