/* Data service router: pages call WW.data.* and never care where the data comes from.
   Demo mode -> WW.demo (simulated, in-browser).  Live mode -> WW.live (FastAPI backend).  The two are never mixed. */
window.WW = window.WW || {};
WW.data = new Proxy({}, {
  get(_, name) {
    const svc = WW.mode.isDemo() ? WW.demo : WW.live;
    if (name === "source") return WW.mode.get();
    const f = svc[name];
    if (typeof f !== "function") return undefined;
    return (...a) => f.apply(svc, a);
  },
});
