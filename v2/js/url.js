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
    const deduction = q.get("deduction"); // legacy shared
    const deductionPct = q.get("deduction_pct"); // legacy
    const dedHome = q.get("ded_home") || deduction;
    const dedDest = q.get("ded_dest") || deduction;
    const customHome = q.get("custom_home") != null ? q.get("custom_home") : deductionPct;
    const customDest = q.get("custom_dest") != null ? q.get("custom_dest") : deductionPct;
    const customHomeUnit = q.get("custom_home_unit") || "pct";
    const customDestUnit = q.get("custom_dest_unit") || "pct";

    if (type === "gross" || type === "net") setters.setType(type);
    if (homeIso) setters.setHome(homeIso, true);
    if (destIso) setters.setDest(destIso, true);
    if (dedHome && DEDUCTION_MODES.includes(dedHome) && setters.setDedHome) {
      setters.setDedHome(dedHome);
    }
    if (dedDest && DEDUCTION_MODES.includes(dedDest) && setters.setDedDest) {
      setters.setDedDest(dedDest);
    }
    if (customHome != null && customHome !== "" && setters.setCustomHome) {
      setters.setCustomHome(String(customHome));
    }
    if (customDest != null && customDest !== "" && setters.setCustomDest) {
      setters.setCustomDest(String(customDest));
    }
    if (setters.setCustomHomeUnit && (customHomeUnit === "pct" || customHomeUnit === "amount")) {
      setters.setCustomHomeUnit(customHomeUnit);
    }
    if (setters.setCustomDestUnit && (customDestUnit === "pct" || customDestUnit === "amount")) {
      setters.setCustomDestUnit(customDestUnit);
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
    function writeSide(side, modeKey, valKey, unitKey, qMode, qVal, qUnit) {
      const mode = state[modeKey] || "standard";
      if (mode !== "standard") q.set(qMode, mode);
      if (mode === "custom") {
        const unit = state[unitKey] === "amount" ? "amount" : "pct";
        const raw = Number(state[valKey]);
        let v = raw;
        if (unit === "pct") {
          v = global.PPP.tax
            ? global.PPP.tax.clampCustomPct(raw)
            : Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 0));
        } else {
          v = Math.max(0, Number.isFinite(raw) ? raw : 0);
        }
        q.set(qVal, String(v));
        if (unit !== "pct") q.set(qUnit, unit);
      }
    }
    writeSide("home", "deduction_home", "custom_home", "custom_home_unit", "ded_home", "custom_home", "custom_home_unit");
    writeSide("dest", "deduction_dest", "custom_dest", "custom_dest_unit", "ded_dest", "custom_dest", "custom_dest_unit");
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
