(function (global) {
  "use strict";

  /** Default demo: India (INR) → United States (USD). Always write iso3 in the URL. */
  const DEFAULT_HOME = "IND";
  const DEFAULT_DEST = "USA";
  /** Currency codes accepted in ?home= / ?dest= (still written as iso3). */
  const CURRENCY_ALIASES = { INR: "IND", USD: "USA" };

  /** Resolve URL home/dest: prefer iso3, then currency alias, then c.currency scan. */
  function resolveCountryCode(raw, byIso) {
    if (!raw) return null;
    const code = String(raw).trim().toUpperCase();
    if (!code) return null;
    if (byIso[code]) return code;
    const aliased = CURRENCY_ALIASES[code];
    if (aliased && byIso[aliased]) return aliased;
    const matches = [];
    for (const c of Object.values(byIso)) {
      if (c && c.currency === code) matches.push(c.iso3);
    }
    if (!matches.length) return null;
    if (aliased && matches.includes(aliased)) return aliased;
    return matches[0];
  }

  const DEDUCTION_MODES = ["none", "standard", "typical", "custom"];

  function readParams(byIso, setters) {
    const q = new URLSearchParams(location.search);
    const incomeRaw = q.get("income");
    const type = q.get("type");
    const homeIso = resolveCountryCode(q.get("home"), byIso);
    const destIso = resolveCountryCode(q.get("dest"), byIso);
    const deduction = q.get("deduction");
    const deductionPct = q.get("deduction_pct");

    if (type === "gross" || type === "net") setters.setType(type);
    if (homeIso) setters.setHome(homeIso, true);
    if (destIso) setters.setDest(destIso, true);
    if (deduction && DEDUCTION_MODES.includes(deduction) && setters.setDeduction) {
      setters.setDeduction(deduction);
    }
    if (deductionPct != null && deductionPct !== "" && setters.setDeductionPct) {
      const pct = global.PPP.tax
        ? global.PPP.tax.clampCustomPct(deductionPct)
        : Math.max(0, Math.min(50, Number(deductionPct) || 0));
      setters.setDeductionPct(String(pct));
    }

    if (incomeRaw) {
      const n = global.PPP.parseIncome(incomeRaw);
      if (n > 0) {
        const iso = homeIso || setters.getHome();
        const c = byIso[iso];
        setters.setIncome(
          global.PPP.formatIncomeInput(n, c && c.currency, iso)
        );
      }
    }
  }

  function buildQuery(state) {
    const q = new URLSearchParams();
    const incomeLocal = global.PPP.parseIncome(state.income);
    q.set("income", String(incomeLocal > 0 ? Math.round(incomeLocal) : ""));
    q.set("home", state.home || DEFAULT_HOME);
    q.set("type", state.type || "net");
    q.set("dest", state.dest || DEFAULT_DEST);
    const ded = state.deduction || "standard";
    if (ded !== "standard") q.set("deduction", ded);
    if (ded === "custom") {
      const pct = global.PPP.tax
        ? global.PPP.tax.clampCustomPct(state.deduction_pct)
        : Math.max(0, Math.min(50, Number(state.deduction_pct) || 0));
      q.set("deduction_pct", String(pct));
    }
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
    DEFAULT_HOME,
    DEFAULT_DEST,
    resolveCountryCode,
    url: { readParams, writeParams, buildQuery, kingIndexHref, shareUrl, resolveCountryCode },
  });
})(typeof window !== "undefined" ? window : globalThis);
