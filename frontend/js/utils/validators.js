/* Input validators shared by forms (what-if, login, API settings, tariff helpers). Every validator returns
   { ok:boolean, value?:any, message?:string } so callers can show the message next to the field without throwing. */
window.WW = window.WW || {};
WW.validate = (function () {
  const ok = (value) => ({ ok: true, value });
  const bad = (message) => ({ ok: false, message });
  return {
    number(v, { min = -Infinity, max = Infinity, label = "Value", integer = false } = {}) {
      if (v === "" || v === null || v === undefined) return bad(`${label} is required.`);
      const n = Number(v); if (!Number.isFinite(n)) return bad(`${label} must be a number.`);
      if (integer && !Number.isInteger(n)) return bad(`${label} must be a whole number.`);
      if (n < min || n > max) return bad(`${label} must be between ${min} and ${max}.`);
      return ok(n);
    },
    percent: (v, label = "Percentage") => WW.validate.number(v, { min: 0, max: 100, label }),
    email(v) { const s = String(v || "").trim(); return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? ok(s) : bad("Enter a valid email address."); },
    password(v) { const s = String(v || ""); return s.length >= 6 ? ok(s) : bad("Password must be at least 6 characters."); },
    url(v) {
      const s = String(v || "").trim(); if (!s) return ok("");           // empty = same origin
      try { const u = new URL(s); return ["http:", "https:"].includes(u.protocol) ? ok(s.replace(/\/+$/, "")) : bad("Use an http:// or https:// URL."); } catch (e) { return bad("Enter a full URL such as http://localhost:8000."); }
    },
    dateRange(a, b) { if (!a || !b) return bad("Choose both dates."); return a <= b ? ok([a, b]) : bad("The start date must not be after the end date."); },
    time(v) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || "")) ? ok(v) : bad("Use 24-hour time such as 18:30."); },
    /* what-if scenario adjustments: [{applianceId, reducePct, shiftPeakPct}] */
    scenario(s) {
      if (!s || !Array.isArray(s.adjustments)) return bad("Scenario has no adjustments.");
      for (const a of s.adjustments) {
        if (!a.applianceId) return bad("Every adjustment needs an appliance.");
        const r = WW.validate.percent(a.reducePct, "Usage reduction"), p = WW.validate.percent(a.shiftPeakPct, "Peak shift");
        if (!r.ok) return r; if (!p.ok) return p;
        if (a.reducePct + 0 > 100) return bad("Reduction cannot exceed 100%.");
      }
      return ok(s);
    },
    /* Tariff slab continuity: slabs must start at 1, be contiguous, increasing and have positive rates. */
    slabs(list) {
      if (!Array.isArray(list) || !list.length) return bad("Add at least one slab.");
      let prev = 0;
      for (const [i, s] of list.entries()) {
        if (!(s.rate > 0)) return bad(`Slab ${i + 1}: rate must be above zero.`);
        if (s.from !== prev + 1) return bad(`Slab ${i + 1} must start at ${prev + 1}.`);
        if (s.to !== null && s.to !== undefined) { if (s.to < s.from) return bad(`Slab ${i + 1}: "to" is below "from".`); prev = s.to; } else if (i !== list.length - 1) return bad("Only the last slab can be open-ended.");
      }
      return ok(list);
    },
  };
})();
