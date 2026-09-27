/**
 * PPP Calculator v2 — illustrative national/federal PIT helpers.
 * Pure functions; no DOM. Rates come from data/taxes.json only.
 */
(function (global) {
  "use strict";

  let TAX_BY_ISO = Object.create(null);
  let TAX_META = null;
  let TAX_LOADED = false;

  function loadTaxData(payload) {
    TAX_BY_ISO = Object.create(null);
    TAX_META = (payload && payload.meta) || null;
    TAX_LOADED = !!(payload && Array.isArray(payload.countries));
    if (!TAX_LOADED) return false;
    for (const c of payload.countries) {
      if (c && c.iso3) TAX_BY_ISO[c.iso3] = c;
    }
    return true;
  }

  function getTax(iso3) {
    if (!iso3) return null;
    return TAX_BY_ISO[String(iso3).toUpperCase()] || null;
  }

  function isSupported(iso3) {
    const c = getTax(iso3);
    return !!(c && c.supported);
  }

  function clampCustomPct(pct) {
    const n = Number(pct);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(50, n));
  }

  function resolveTypicalDeduction(gross, country) {
    const te = country && country.typical_extra_deduction;
    if (!te) return null;
    if (te.kind === "pct_gross" || (te.pct != null && te.amount == null)) {
      let d = Math.max(0, gross) * Number(te.pct || 0);
      if (te.cap != null && Number.isFinite(te.cap)) d = Math.min(d, te.cap);
      return d;
    }
    if (te.kind === "fixed" || te.amount != null) {
      return Math.max(0, Number(te.amount) || 0);
    }
    return null;
  }

  /**
   * Deduction modes: none | standard | typical | custom
   * typical → typical_extra_deduction if present, else same as standard.
   * When allowance_in_brackets and mode is standard (or typical falling back),
   * do not subtract standard_deduction again.
   */
  function taxableIncome(gross, country, deductionMode, customPct) {
    const g = Math.max(0, Number(gross) || 0);
    if (!country) return g;
    const mode = deductionMode || "standard";
    let ded = 0;

    if (mode === "none") {
      ded = 0;
    } else if (mode === "custom") {
      ded = g * (clampCustomPct(customPct) / 100);
    } else if (mode === "typical") {
      const typical = resolveTypicalDeduction(g, country);
      if (typical != null) {
        ded = typical;
      } else if (country.allowance_in_brackets) {
        ded = 0;
      } else {
        ded = Math.max(0, Number(country.standard_deduction) || 0);
      }
    } else {
      // standard (default)
      if (country.allowance_in_brackets) ded = 0;
      else ded = Math.max(0, Number(country.standard_deduction) || 0);
    }

    return Math.max(0, g - ded);
  }

  function pitOnTaxable(taxable, brackets) {
    const t = Math.max(0, Number(taxable) || 0);
    if (!Array.isArray(brackets) || !brackets.length) return 0;
    let remaining = t;
    let prev = 0;
    let tax = 0;
    for (const b of brackets) {
      const rate = Number(b.rate) || 0;
      const up = b.up_to;
      if (up == null || !Number.isFinite(up)) {
        tax += remaining * rate;
        remaining = 0;
        break;
      }
      const width = Math.max(0, up - prev);
      const slice = Math.min(remaining, width);
      tax += slice * rate;
      remaining -= slice;
      prev = up;
      if (remaining <= 0) break;
    }
    if (remaining > 0) {
      const last = brackets[brackets.length - 1];
      tax += remaining * (Number(last && last.rate) || 0);
    }
    return tax;
  }

  function applyEmployeeSs(gross, employeeSs) {
    if (!employeeSs || employeeSs.rate == null) return 0;
    const g = Math.max(0, Number(gross) || 0);
    const rate = Number(employeeSs.rate) || 0;
    let base = g;
    if (employeeSs.cap != null && Number.isFinite(employeeSs.cap)) {
      base = Math.min(base, employeeSs.cap);
    }
    return Math.max(0, base * rate);
  }

  function emptyResult(gross, extras) {
    const g = Math.max(0, Number(gross) || 0);
    return Object.assign({
      gross: g,
      taxable: g,
      pit: 0,
      ss: 0,
      totalTax: 0,
      net: g,
      effectiveRate: 0,
      supported: false,
      notes: null,
    }, extras || {});
  }

  function grossToNet(gross, country, opts) {
    opts = opts || {};
    const g = Math.max(0, Number(gross) || 0);
    if (!country || !country.supported) {
      return emptyResult(g, {
        supported: false,
        notes: (country && (country.notes || country.reason)) || "Tax model unavailable",
      });
    }

    if (country.system === "none") {
      return {
        gross: g,
        taxable: 0,
        pit: 0,
        ss: 0,
        totalTax: 0,
        net: g,
        effectiveRate: 0,
        supported: true,
        notes: country.notes || null,
      };
    }

    const mode = opts.deductionMode || "standard";
    const customPct = opts.customPct;
    const taxable = taxableIncome(g, country, mode, customPct);
    const pit = pitOnTaxable(taxable, country.brackets);
    const ss = applyEmployeeSs(g, country.employee_ss);
    const totalTax = pit + ss;
    const net = g - totalTax;
    const effectiveRate = g > 0 ? totalTax / g : 0;

    return {
      gross: g,
      taxable,
      pit,
      ss,
      totalTax,
      net,
      effectiveRate,
      supported: true,
      notes: country.notes || null,
    };
  }

  /**
   * Invert grossToNet so estimated net ≈ targetNet (tolerance 1 currency unit).
   */
  function netToGross(targetNet, country, opts) {
    opts = opts || {};
    const target = Math.max(0, Number(targetNet) || 0);
    if (!country || !country.supported) {
      const r = emptyResult(target, {
        supported: false,
        notes: (country && (country.notes || country.reason)) || "Tax model unavailable",
        iterations: 0,
      });
      return r;
    }

    if (country.system === "none") {
      const r = grossToNet(target, country, opts);
      r.iterations = 0;
      return r;
    }

    const lo0 = 0;
    const hi0 = Math.max(target * 3, 1e7);
    let lo = lo0;
    let hi = hi0;
    let best = grossToNet(hi, country, opts);
    let iterations = 0;
    const maxIter = 64;
    const tol = 1;

    // Expand upper bound if still short of target net
    while (best.net < target - tol && hi < 1e12 && iterations < 16) {
      hi *= 2;
      best = grossToNet(hi, country, opts);
      iterations++;
    }

    let mid = hi;
    for (let i = 0; i < maxIter; i++) {
      iterations++;
      mid = (lo + hi) / 2;
      const r = grossToNet(mid, country, opts);
      best = r;
      if (Math.abs(r.net - target) <= tol) break;
      if (r.net > target) hi = mid;
      else lo = mid;
    }

    best.iterations = iterations;
    return best;
  }

  function hasTypicalExtra(iso3) {
    const c = getTax(iso3);
    return !!(c && c.typical_extra_deduction);
  }

  global.PPP = Object.assign(global.PPP || {}, {
    tax: {
      loadTaxData,
      getTax,
      isSupported,
      taxableIncome,
      pitOnTaxable,
      applyEmployeeSs,
      grossToNet,
      netToGross,
      hasTypicalExtra,
      clampCustomPct,
      get meta() { return TAX_META; },
      get loaded() { return TAX_LOADED; },
    },
  });
})(typeof window !== "undefined" ? window : globalThis);
