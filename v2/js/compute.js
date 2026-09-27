/**
 * PPP Calculator v2 — compute + format (ported verbatim from v1 math).
 * Pure functions only; no DOM.
 */
(function (global) {
  "use strict";

  function isReliablePli(c) {
    return !!c
      && Number.isFinite(c.pli_us) && c.pli_us >= 0.05
      && Number.isFinite(c.ppp) && c.ppp > 0
      && Number.isFinite(c.fx) && c.fx > 0;
  }

  function localeForCurrency(currency, iso3) {
    if (currency === "INR" || iso3 === "IND") return "en-IN";
    if (currency === "USD") return "en-US";
    if (currency === "GBP") return "en-GB";
    if (currency === "EUR") return "de-DE";
    if (currency === "JPY") return "ja-JP";
    if (currency === "CNY") return "zh-CN";
    if (currency === "BDT" || iso3 === "BGD") return "en-BD";
    return "en-US";
  }

  function parseIncome(raw) {
    const digits = String(raw || "").replace(/[^\d.]/g, "");
    if (!digits) return NaN;
    return parseFloat(digits);
  }

  function formatIncomeInput(n, currency, iso3) {
    if (!(n > 0) || !isFinite(n)) return "";
    return Math.round(n).toLocaleString(localeForCurrency(currency, iso3));
  }

  function fmtMoney(n, currency, iso3) {
    if (n == null || !isFinite(n)) return "—";
    const loc = localeForCurrency(currency, iso3);
    const abs = Math.abs(n);
    const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
    const s = n.toLocaleString(loc, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
    return currency && currency !== "LCU" ? `${s} ${currency}` : s;
  }

  function fmtIncomeLead(n, currency, iso3) {
    if (n == null || !isFinite(n)) return "—";
    const loc = localeForCurrency(currency, iso3);
    const s = Math.round(n).toLocaleString(loc);
    if (currency === "USD") return `$${s}`;
    if (currency === "INR") return `₹${s}`;
    if (currency === "GBP") return `£${s}`;
    if (currency === "EUR") return `€${s}`;
    if (currency === "BDT") return `৳${s}`;
    if (currency && currency !== "LCU") return `${s} ${currency}`;
    return s;
  }

  function costVsHome(homePli, destPli) {
    if (!(homePli > 0) || !(destPli > 0) || !Number.isFinite(homePli) || !Number.isFinite(destPli)) {
      return { pct: null, primary: null };
    }
    const pct = (destPli / homePli - 1) * 100;
    let primary;
    if (Math.abs(pct) < 0.5) primary = "Same lifestyle costs about the same as at home.";
    else if (pct > 0) primary = `Same lifestyle costs ${Math.round(pct)}% more than at home.`;
    else primary = `Same lifestyle costs ${Math.round(-pct)}% less than at home.`;
    return { pct, primary };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function compute(home, dest, incomeLocal) {
    const reliable = isReliablePli(home) && isReliablePli(dest);
    const excluded = !!(dest.excluded || home.excluded);
    let equiv = null, fxLocal = null, costPct = null, yourPpp = null;
    if (reliable && incomeLocal > 0) {
      yourPpp = incomeLocal / home.ppp;
      equiv = yourPpp * dest.ppp;
      fxLocal = incomeLocal * (dest.fx / home.fx);
      costPct = (dest.pli_us / home.pli_us - 1) * 100;
      if (!Number.isFinite(equiv)) equiv = null;
      if (!Number.isFinite(fxLocal)) fxLocal = null;
      if (!Number.isFinite(costPct)) costPct = null;
      if (!Number.isFinite(yourPpp)) yourPpp = null;
    }
    const pliDisplay = reliable ? Math.round(dest.pli_us * 100) : null;
    let reason = null;
    if (dest.exclude_reason) reason = dest.exclude_reason;
    else if (home.exclude_reason) reason = home.exclude_reason;
    else if (!isReliablePli(dest) || !isReliablePli(home)) reason = "Unreliable PLI / PPP / FX";
    return {
      reliable: reliable && !excluded,
      excluded,
      reason,
      equiv,
      fxLocal,
      costPct,
      yourPpp,
      pliDisplay,
      cost: costVsHome(home && home.pli_us, dest && dest.pli_us),
    };
  }

  /** Evidence-only path: PLI + cost vs home even when income is empty. */
  function evidence(home, dest) {
    const reliable = isReliablePli(home) && isReliablePli(dest);
    const excluded = !!(dest && dest.excluded) || !!(home && home.excluded);
    if (!home || !dest || !reliable || excluded) {
      return {
        reliable: false,
        reason: (dest && dest.exclude_reason) || (home && home.exclude_reason) || "Unreliable PLI / PPP / FX",
        pliDisplay: null,
        cost: { pct: null, primary: null },
        costPct: null,
      };
    }
    const costPct = (dest.pli_us / home.pli_us - 1) * 100;
    return {
      reliable: true,
      reason: null,
      pliDisplay: Math.round(dest.pli_us * 100),
      cost: costVsHome(home.pli_us, dest.pli_us),
      costPct: Number.isFinite(costPct) ? costPct : null,
    };
  }

  global.PPP = Object.assign(global.PPP || {}, {
    isReliablePli,
    localeForCurrency,
    parseIncome,
    formatIncomeInput,
    fmtMoney,
    fmtIncomeLead,
    costVsHome,
    escapeHtml,
    compute,
    evidence,
    INCOME_MIN: 1000,
    INCOME_MAX: 50000000,
  });
})(typeof window !== "undefined" ? window : globalThis);
