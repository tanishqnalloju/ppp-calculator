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
    return Math.max(0, Math.min(100, n));
  }

  function clampCustomAmount(amount, gross) {
    const g = Math.max(0, Number(gross) || 0);
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(g, n);
  }

  function resolveCustomDeduction(gross, opts) {
    opts = opts || {};
    const g = Math.max(0, Number(gross) || 0);
    const unit = opts.customUnit === "amount" ? "amount" : "pct";
    if (unit === "amount") {
      return {
        amount: clampCustomAmount(opts.customAmount, g),
        unit,
        pct: null,
        label: null,
      };
    }
    const pct = clampCustomPct(opts.customPct);
    return {
      amount: g * (pct / 100),
      unit,
      pct,
      label: null,
    };
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
  function taxableIncome(gross, country, deductionMode, customOpts) {
    const g = Math.max(0, Number(gross) || 0);
    if (!country) return g;
    const mode = deductionMode || "standard";
    let ded = 0;

    if (mode === "none") {
      ded = 0;
    } else if (mode === "custom") {
      // customOpts may be a bare pct number (legacy) or { customPct, customAmount, customUnit }
      const opts = (customOpts && typeof customOpts === "object")
        ? customOpts
        : { customPct: customOpts, customUnit: "pct" };
      ded = resolveCustomDeduction(g, opts).amount;
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

  function pitBreakdown(taxable, brackets) {
    const t = Math.max(0, Number(taxable) || 0);
    const slices = [];
    if (!Array.isArray(brackets) || !brackets.length) {
      return { pit: 0, slices };
    }
    let remaining = t;
    let prev = 0;
    let tax = 0;
    for (const b of brackets) {
      const rate = Number(b.rate) || 0;
      const up = b.up_to;
      if (up == null || !Number.isFinite(up)) {
        if (remaining > 0) {
          const sliceTax = remaining * rate;
          slices.push({ from: prev, to: null, rate, amount: remaining, tax: sliceTax });
          tax += sliceTax;
          remaining = 0;
        }
        break;
      }
      const width = Math.max(0, up - prev);
      const slice = Math.min(remaining, width);
      if (slice > 0) {
        const sliceTax = slice * rate;
        slices.push({ from: prev, to: up, rate, amount: slice, tax: sliceTax });
        tax += sliceTax;
        remaining -= slice;
      }
      prev = up;
      if (remaining <= 0) break;
    }
    if (remaining > 0) {
      const last = brackets[brackets.length - 1];
      const rate = Number(last && last.rate) || 0;
      const sliceTax = remaining * rate;
      slices.push({ from: prev, to: null, rate, amount: remaining, tax: sliceTax });
      tax += sliceTax;
    }
    return { pit: tax, slices };
  }

  function pitOnTaxable(taxable, brackets) {
    return pitBreakdown(taxable, brackets).pit;
  }

  function deductionDetail(gross, country, deductionMode, customOpts) {
    const g = Math.max(0, Number(gross) || 0);
    if (!country) return { amount: 0, label: "None", mode: deductionMode || "standard" };
    const mode = deductionMode || "standard";
    if (mode === "none") return { amount: 0, label: "None", mode };
    if (mode === "custom") {
      const opts = (customOpts && typeof customOpts === "object")
        ? customOpts
        : { customPct: customOpts, customUnit: "pct" };
      const resolved = resolveCustomDeduction(g, opts);
      if (resolved.unit === "amount") {
        return {
          amount: resolved.amount,
          label: "Custom amount",
          mode,
          unit: "amount",
        };
      }
      return {
        amount: resolved.amount,
        label: `Custom ${resolved.pct}% of gross`,
        mode,
        pct: resolved.pct,
        unit: "pct",
      };
    }
    if (mode === "typical") {
      const typical = resolveTypicalDeduction(g, country);
      if (typical != null) {
        const te = country.typical_extra_deduction;
        return { amount: typical, label: (te && te.label) || "Typical extra", mode };
      }
      if (country.allowance_in_brackets) {
        return { amount: 0, label: "Typical → allowance already in brackets", mode };
      }
      const std = Math.max(0, Number(country.standard_deduction) || 0);
      return { amount: std, label: "Typical → standard allowance", mode };
    }
    if (country.allowance_in_brackets) {
      return { amount: 0, label: "Standard (0% band in brackets)", mode };
    }
    const std = Math.max(0, Number(country.standard_deduction) || 0);
    return { amount: std, label: "Standard allowance", mode };
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
      rebate: 0,
      cess: 0,
      pitBeforeRebate: 0,
    }, extras || {});
  }


  function applyRebate(pit, totalIncome, rebate) {
    if (!rebate || rebate.max_amount == null) {
      return { pit, rebate: 0, label: null };
    }
    const income = Math.max(0, Number(totalIncome) || 0);
    const cap = Number(rebate.max_total_income);
    if (Number.isFinite(cap) && income > cap) {
      return { pit, rebate: 0, label: rebate.label || "Rebate" };
    }
    const maxAmt = Math.max(0, Number(rebate.max_amount) || 0);
    const reb = Math.min(Math.max(0, pit), maxAmt);
    return { pit: Math.max(0, pit - reb), rebate: reb, label: rebate.label || "Rebate" };
  }

  function applyCess(taxBeforeCess, cess) {
    if (!cess || cess.rate == null) return { cess: 0, total: taxBeforeCess, label: null };
    const c = Math.max(0, taxBeforeCess) * (Number(cess.rate) || 0);
    return { cess: c, total: taxBeforeCess + c, label: cess.label || "Cess" };
  }

  function grossToNet(gross, country, opts) {
    opts = opts || {};
    const g = Math.max(0, Number(gross) || 0);
    if (!country || !country.supported) {
      return emptyResult(g, {
        supported: false,
        notes: (country && (country.notes || country.reason)) || "Tax model unavailable",
        deduction: { amount: 0, label: "—", mode: opts.deductionMode || "standard" },
        slices: [],
        taxYear: country && country.tax_year || null,
        model: country && country.model || null,
      });
    }

    if (country.system === "none" || country.model === "none") {
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
        deduction: { amount: 0, label: "No PIT", mode: opts.deductionMode || "standard" },
        slices: [],
        taxYear: country.tax_year || null,
        model: country.model || "none",
      };
    }

    const mode = opts.deductionMode || "standard";
    const customOpts = {
      customPct: opts.customPct,
      customAmount: opts.customAmount,
      customUnit: opts.customUnit || "pct",
    };
    const deduction = deductionDetail(g, country, mode, customOpts);
    const taxable = taxableIncome(g, country, mode, customOpts);
    const br = pitBreakdown(taxable, country.brackets);
    let pit = br.pit;
    // Rebate uses total income after deductions (taxable + any zero-rated allowance already in brackets ≈ gross - explicit deduction)
    const totalIncomeForRebate = taxable;
    const reb = applyRebate(pit, totalIncomeForRebate, country.rebate);
    pit = reb.pit;
    const cessPart = applyCess(pit, country.cess);
    const pitWithCess = cessPart.total;
    const ss = applyEmployeeSs(g, country.employee_ss);
    const totalTax = pitWithCess + ss;
    const net = g - totalTax;
    const effectiveRate = g > 0 ? totalTax / g : 0;

    return {
      gross: g,
      taxable,
      pit: pitWithCess,
      pitBeforeRebate: br.pit,
      rebate: reb.rebate,
      rebateLabel: reb.label,
      cess: cessPart.cess,
      cessLabel: cessPart.label,
      ss,
      totalTax,
      net,
      effectiveRate,
      supported: true,
      notes: country.notes || null,
      deduction,
      slices: br.slices,
      taxYear: country.tax_year || null,
      model: country.model || null,
      sourceName: country.source_name || null,
      standardDeductionBasis: country.standard_deduction,
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
      pitBreakdown,
      deductionDetail,
      applyRebate,
      applyCess,
      applyEmployeeSs,
      grossToNet,
      netToGross,
      hasTypicalExtra,
      clampCustomPct,
      clampCustomAmount,
      resolveCustomDeduction,
      get meta() { return TAX_META; },
      get loaded() { return TAX_LOADED; },
    },
  });
})(typeof window !== "undefined" ? window : globalThis);
