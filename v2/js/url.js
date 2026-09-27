(function (global) {
  "use strict";

  function readParams(byIso, setters) {
    const q = new URLSearchParams(location.search);
    const incomeRaw = q.get("income");
    const type = q.get("type");
    const home = q.get("home");
    const dest = q.get("dest");

    if (type === "gross" || type === "net") setters.setType(type);
    if (home && byIso[home]) setters.setHome(home, true);
    if (dest && byIso[dest]) setters.setDest(dest, true);

    if (incomeRaw) {
      const n = global.PPP.parseIncome(incomeRaw);
      if (n > 0) {
        const homeIso = (home && byIso[home]) ? home : setters.getHome();
        const c = byIso[homeIso];
        setters.setIncome(
          global.PPP.formatIncomeInput(n, c && c.currency, homeIso)
        );
      }
    }
  }

  function buildQuery(state) {
    const q = new URLSearchParams();
    const incomeLocal = global.PPP.parseIncome(state.income);
    q.set("income", String(incomeLocal > 0 ? Math.round(incomeLocal) : ""));
    q.set("home", state.home || "IND");
    q.set("type", state.type || "net");
    q.set("dest", state.dest || "USA");
    return q;
  }

  function writeParams(state) {
    const q = buildQuery(state);
    history.replaceState(null, "", location.pathname + "?" + q.toString());
  }

  function kingIndexHref(state) {
    const q = new URLSearchParams();
    const incomeLocal = global.PPP.parseIncome(state.income);
    if (incomeLocal > 0) q.set("income", String(Math.round(incomeLocal)));
    if (state.home) q.set("home", state.home);
    if (state.type) q.set("type", state.type);
    if (state.dest) q.set("dest", state.dest);
    const qs = q.toString();
    return "https://kingindex.tanishqnalloju.com/" + (qs ? "?" + qs : "");
  }

  function shareUrl(state) {
    const q = buildQuery(state);
    return location.origin + location.pathname + "?" + q.toString();
  }

  global.PPP = Object.assign(global.PPP || {}, {
    url: { readParams, writeParams, buildQuery, kingIndexHref, shareUrl },
  });
})(typeof window !== "undefined" ? window : globalThis);
