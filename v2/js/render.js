(function (global) {
  "use strict";

  const el = (id) => document.getElementById(id);

  function fmtPrice(entry) {
    if (!entry || entry.local == null || !Number.isFinite(entry.local)) return "—";
    return global.PPP.fmtMoney(entry.local, entry.currency, null);
  }

  function renderCommodities(home, dest, COMM) {
    const strip = el("commStrip");
    const tableWrap = el("commTableWrap");
    const intro = el("commIntro");
    if (!strip || !intro) return;

    if (!COMM || !COMM.items) {
      strip.innerHTML = "";
      if (tableWrap) tableWrap.innerHTML = "";
      intro.textContent = "Commodity sample not loaded.";
      return;
    }

    const escapeHtml = global.PPP.escapeHtml;
    const asOf = (COMM.meta && COMM.meta.as_of) || "n/a";
    const homeP = (COMM.prices && home && COMM.prices[home.iso3]) || {};
    const destP = (COMM.prices && dest && COMM.prices[dest.iso3]) || {};
    const rows = [];

    for (const item of COMM.items) {
      const h = homeP[item.id];
      const d = destP[item.id];
      if ((!h || h.local == null) && (!d || d.local == null)) continue;
      rows.push({ item, h, d });
    }

    if (!rows.length) {
      strip.innerHTML = `<p class="gap-note">No overlapping commodity sample for this pair (as of ${escapeHtml(asOf)}).</p>`;
      if (tableWrap) tableWrap.innerHTML = "";
    } else {
      strip.innerHTML = rows.map(({ item, h, d }) =>
        `<article class="card">` +
        `<p class="name">${escapeHtml(item.name)}</p>` +
        `<p class="unit">${escapeHtml(item.unit)}</p>` +
        `<div class="row"><span>${escapeHtml(home ? home.iso3 : "Home")}</span><b>${escapeHtml(fmtPrice(h))}</b></div>` +
        `<div class="row"><span>${escapeHtml(dest ? dest.iso3 : "Dest")}</span><b>${escapeHtml(fmtPrice(d))}</b></div>` +
        `</article>`
      ).join("");

      if (tableWrap) {
        const homeLabel = home ? home.iso3 : "Home";
        const destLabel = dest ? dest.iso3 : "Dest";
        tableWrap.innerHTML =
          `<table class="comm-table">` +
          `<caption class="sr-only">Illustrative commodity prices: ${escapeHtml(homeLabel)} vs ${escapeHtml(destLabel)}</caption>` +
          `<thead><tr><th scope="col">Item</th><th scope="col">Unit</th>` +
          `<th scope="col">${escapeHtml(homeLabel)}</th><th scope="col">${escapeHtml(destLabel)}</th></tr></thead>` +
          `<tbody>` +
          rows.map(({ item, h, d }) =>
            `<tr><th scope="row">${escapeHtml(item.name)}</th>` +
            `<td class="muted">${escapeHtml(item.unit)}</td>` +
            `<td class="num">${escapeHtml(fmtPrice(h))}</td>` +
            `<td class="num">${escapeHtml(fmtPrice(d))}</td></tr>`
          ).join("") +
          `</tbody></table>`;
      }
    }

    intro.textContent = `Illustrative local prices (as of ${asOf}). Not a full CPI basket. Sources: Economist Big Mac Index + Numbeo.`;
  }

  function deltaNote(equiv, fxLocal) {
    if (!(equiv > 0) || !(fxLocal > 0) || !Number.isFinite(equiv) || !Number.isFinite(fxLocal)) {
      return null;
    }
    const pct = ((equiv / fxLocal) - 1) * 100;
    if (!Number.isFinite(pct)) return null;
    if (Math.abs(pct) < 0.5) {
      return "Compared with a cash wire, PPP is about the same as market FX for this pair.";
    }
    if (pct > 0) {
      return `Compared with a cash wire, you need about ${Math.round(pct)}% more local currency at PPP prices.`;
    }
    return `Compared with a cash wire, you need about ${Math.round(-pct)}% less local currency at PPP prices.`;
  }

  function setEvidence(ev) {
    const costText = el("costText");
    const costSub = el("costSub");
    const pliText = el("pliText");
    if (!costText || !pliText) return;

    if (ev && ev.reliable && ev.cost && ev.cost.primary) {
      costText.textContent = ev.cost.primary;
      if (costSub) {
        costSub.textContent = ev.costPct != null && Number.isFinite(ev.costPct)
          ? `(${ev.costPct > 0 ? "+" : ""}${Math.round(ev.costPct)}% price level)`
          : "";
      }
    } else {
      costText.textContent = "Cost vs home: —";
      if (costSub) costSub.textContent = "";
    }

    if (ev && ev.reliable && ev.pliDisplay != null) {
      pliText.textContent = `Price level vs US: ${ev.pliDisplay}`;
    } else {
      pliText.textContent = "Price level vs US: —";
    }
  }

  function showStatus(msg, kind) {
    const s = el("status");
    if (!s) return;
    if (!msg) {
      s.classList.add("hidden");
      s.textContent = "";
      s.removeAttribute("data-kind");
      return;
    }
    s.textContent = msg;
    s.classList.remove("hidden");
    s.setAttribute("data-kind", kind || "warn");
  }

  function taxOptsFor(state, side) {
    const mode = (side === "dest" ? state.deduction_dest : state.deduction_home) || "standard";
    const unit = (side === "dest" ? state.custom_dest_unit : state.custom_home_unit) || "pct";
    const raw = side === "dest" ? state.custom_dest : state.custom_home;
    return {
      deductionMode: mode,
      customUnit: unit === "amount" ? "amount" : "pct",
      customPct: raw,
      customAmount: raw,
    };
  }

  function renderDeductionControls(side, state, country, currency, iso3, baseGross) {
    const escapeHtml = global.PPP.escapeHtml;
    const mode = (side === "dest" ? state.deduction_dest : state.deduction_home) || "standard";
    const unit = (side === "dest" ? state.custom_dest_unit : state.custom_home_unit) || "pct";
    const raw = side === "dest" ? state.custom_dest : state.custom_home;
    const label = side === "dest" ? "Destination" : "Home";
    const name = country && country.name ? country.name : label;
    const hasTypical = global.PPP.tax && global.PPP.tax.hasTypicalExtra(iso3);

    const opts = [
      ("none", "None"),
      ("standard", "Standard"),
      ("typical", "Typical extra"),
      ("custom", "Custom"),
    ].filter(([v]) => v !== "typical" || hasTypical || mode === "typical")
     .map(([v, lab]) =>
       `<option value="${v}"${mode === v ? " selected" : ""}${v === "typical" && !hasTypical ? " disabled" : ""}>${lab}</option>`
     ).join("");

    const isPct = unit !== "amount";
    const unitLabel = isPct ? "%" : escapeHtml(currency || "");
    const customHidden = mode === "custom" ? "" : " hidden";
    const step = isPct ? "0.1" : "1";
    const min = "0";
    const max = isPct ? "100" : "";

    return (
      `<div class="tax-ded-side" data-ded-side="${side}">` +
      `<div class="tax-ded-side-label">${escapeHtml(label)} · ${escapeHtml(name)}</div>` +
      `<label class="tax-ded-field">` +
      `<span class="tax-ded-field-label">Deduction</span>` +
      `<select data-ded="mode" data-side="${side}" aria-label="${escapeHtml(label)} deduction mode">${opts}</select>` +
      `</label>` +
      `<div class="tax-ded-custom${customHidden}" data-ded-custom="${side}">` +
      `<span class="tax-ded-field-label">Custom</span>` +
      `<div class="tax-ded-custom-row">` +
      `<input type="number" data-ded="value" data-side="${side}" value="${escapeHtml(String(raw ?? ""))}" min="${min}"${max ? ` max="${max}"` : ""} step="${step}" inputmode="decimal" aria-label="${escapeHtml(label)} custom deduction" />` +
      `<div class="seg-toggle tax-ded-unit" role="group" aria-label="Custom unit">` +
      `<button type="button" class="seg-btn${isPct ? " is-active" : ""}" data-ded-unit="pct" data-side="${side}" aria-pressed="${isPct ? "true" : "false"}">%</button>` +
      `<button type="button" class="seg-btn${!isPct ? " is-active" : ""}" data-ded-unit="amount" data-side="${side}" aria-pressed="${!isPct ? "true" : "false"}">${unitLabel === "%" ? "Amt" : unitLabel}</button>` +
      `</div></div>` +
      `<span class="hint">${isPct ? "Percent of gross (0–100)." : "Fixed amount in " + escapeHtml(currency || "local currency") + "."}</span>` +
      `</div></div>`
    );
  }

  function fmtPct(rate) {
    if (rate == null || !Number.isFinite(rate)) return "—";
    return `${(rate * 100).toFixed(1)}%`;
  }

  function fmtBand(slice, currency, iso3) {
    const from = global.PPP.fmtMoney(slice.from, currency, iso3);
    const to = slice.to == null ? "∞" : global.PPP.fmtMoney(slice.to, currency, iso3);
    const rate = `${(slice.rate * 100).toFixed(slice.rate && slice.rate < 0.1 ? 2 : 0)}%`;
    return `${from}–${to} @ ${rate}`;
  }

  function moneyOrDash(amount, currency, iso3) {
    if (amount == null || !Number.isFinite(Number(amount))) return "—";
    return global.PPP.fmtMoney(amount, currency, iso3);
  }

  /** Inner country block (no <details>) used inside the single tax collapsible. */
  function renderTaxSimBlock(result, country, currency, iso3, title, metrics) {
    const escapeHtml = global.PPP.escapeHtml;
    const year = result && result.taxYear ? ` · ${escapeHtml(result.taxYear)}` : "";
    const taxStr = metrics && metrics.tax != null
      ? escapeHtml(moneyOrDash(metrics.tax, currency, iso3))
      : (result && result.supported ? escapeHtml(moneyOrDash(result.totalTax, currency, iso3)) : "—");
    const netStr = metrics && metrics.net != null
      ? escapeHtml(moneyOrDash(metrics.net, currency, iso3))
      : (result && result.supported ? escapeHtml(moneyOrDash(result.net, currency, iso3)) : "—");

    const head =
      `<div class="tax-block">` +
      `<div class="tax-block-head">` +
      `<span class="tax-col-title">${escapeHtml(title)}${year}</span>` +
      `<div class="tax-summary-metrics">` +
      `<div class="tax-row"><span>Est. tax</span><b>${taxStr}</b></div>` +
      `<div class="tax-row"><span>Est. net</span><b>${netStr}</b></div>` +
      `</div></div>`;

    if (!result || !result.supported) {
      return (
        head +
        `<div class="tax-block-body">` +
        `<p class="tax-unavailable">${escapeHtml((metrics && metrics.unavailable) || "Model unavailable")}</p>` +
        (result && result.notes ? `<p class="tax-note">${escapeHtml(result.notes)}</p>` : "") +
        ((metrics && metrics.note) ? `<p class="tax-note">${escapeHtml(metrics.note)}</p>` : "") +
        `</div></div>`
      );
    }

    const ded = result.deduction || {};
    const model = result.model ? escapeHtml(result.model) : "PIT";
    // When a rebate fully zeros PIT (e.g. India §87A ≤ ₹12L), skip the
    // tax-then-rebate theater — effective liability is simply nil.
    const rebateZeros = !!(result.rebate > 0 && Number(result.pit) <= 0.5);
    const rebateCfg = country && country.rebate;
    const nilCap = rebateCfg && rebateCfg.max_total_income != null
      ? Number(rebateCfg.max_total_income)
      : null;

    let slicesHtml = "";
    if (rebateZeros) {
      const capStr = nilCap != null
        ? escapeHtml(global.PPP.fmtMoney(nilCap, currency, iso3))
        : "the rebate threshold";
      const label = escapeHtml(result.rebateLabel || "Rebate");
      slicesHtml =
        `<p class="tax-note tax-nil">Nil PIT — ${label} zeros tax when total income is ≤ ${capStr}. No bracket tax is due in this range.</p>`;
    } else if (result.slices && result.slices.length) {
      slicesHtml =
        `<div class="tax-sim">` +
        `<p class="tax-sim-label">Bracket simulation</p>` +
        `<ul class="tax-slices">` +
        result.slices.map((s) =>
          `<li><span>${escapeHtml(fmtBand(s, currency, iso3))}</span>` +
          `<b>${escapeHtml(global.PPP.fmtMoney(s.tax, currency, iso3))}</b></li>`
        ).join("") +
        `</ul></div>`;
    } else if (result.model === "none") {
      slicesHtml = `<p class="tax-note">No personal income tax in this model.</p>`;
    }

    const rebateRow = (!rebateZeros && result.rebate > 0)
      ? `<div class="tax-row"><span>${escapeHtml(result.rebateLabel || "Rebate")}</span>` +
        `<b>−${escapeHtml(global.PPP.fmtMoney(result.rebate, currency, iso3))}</b></div>`
      : "";
    const cessRow = result.cess > 0
      ? `<div class="tax-row"><span>${escapeHtml(result.cessLabel || "Cess")}</span>` +
        `<b>${escapeHtml(global.PPP.fmtMoney(result.cess, currency, iso3))}</b></div>`
      : "";
    const pitBefore = (!rebateZeros && result.pitBeforeRebate != null && result.rebate > 0)
      ? `<div class="tax-row"><span>PIT before rebate</span>` +
        `<b>${escapeHtml(global.PPP.fmtMoney(result.pitBeforeRebate, currency, iso3))}</b></div>`
      : "";
    const sdBasis = (result.standardDeductionBasis != null && Number(result.standardDeductionBasis) > 0)
      ? `<p class="tax-note">Standard deduction basis: ${escapeHtml(global.PPP.fmtMoney(result.standardDeductionBasis, currency, iso3))} (salaried assumption in this model).</p>`
      : "";

    return (
      head +
      `<div class="tax-block-body">` +
      `<p class="tax-model-tag">${model}</p>` +
      `<div class="tax-row"><span>Gross</span><b>${escapeHtml(global.PPP.fmtMoney(result.gross, currency, iso3))}</b></div>` +
      `<div class="tax-row"><span>Deduction</span><b>${escapeHtml(global.PPP.fmtMoney(ded.amount || 0, currency, iso3))}</b></div>` +
      (ded.label ? `<p class="tax-note">${escapeHtml(ded.label)}</p>` : "") +
      sdBasis +
      `<div class="tax-row"><span>Taxable</span><b>${escapeHtml(global.PPP.fmtMoney(result.taxable, currency, iso3))}</b></div>` +
      pitBefore +
      rebateRow +
      cessRow +
      `<div class="tax-row"><span>Est. PIT</span><b>${escapeHtml(global.PPP.fmtMoney(result.pit, currency, iso3))}</b></div>` +
      (result.ss > 0
        ? `<div class="tax-row"><span>Est. employee SS</span><b>${escapeHtml(global.PPP.fmtMoney(result.ss, currency, iso3))}</b></div>`
        : "") +
      `<div class="tax-row"><span>Effective rate</span><b>${escapeHtml(fmtPct(result.effectiveRate))}</b></div>` +
      slicesHtml +
      (result.notes ? `<p class="tax-note" title="${escapeHtml(result.notes)}">${escapeHtml(result.notes)}</p>` : "") +
      `</div></div>`
    );
  }

  function bindTaxCollapse(panel) {
    if (!panel || panel.dataset.taxBound === "1") return;
    panel.dataset.taxBound = "1";
    global.PPP._taxOpen = global.PPP._taxOpen || Object.create(null);
    panel.addEventListener("toggle", (ev) => {
      const d = ev.target;
      if (!(d instanceof HTMLDetailsElement)) return;
      const key = d.getAttribute("data-tax-key");
      if (!key) return;
      global.PPP._taxOpen[key] = d.open;
    }, true);
  }


  function ensureTaxPanelShell(panel) {
    if (panel.querySelector("[data-tax-shell]")) return;
    panel.innerHTML =
      `<div data-tax-shell="1">` +
      `<h2 class="tax-heading">Illustrative tax estimates</h2>` +
      `<p class="tax-disclaimer" id="taxDedNote"></p>` +
      `<div id="taxDeductionMount"></div>` +
      `<div id="taxResultsMount"></div>` +
      `<div id="taxWarnMount"></div>` +
      `<p class="tax-disclaimer" id="taxFootNote">Illustrative national/federal PIT model only. Local/state taxes and many social contributions are often excluded. <strong>Not tax advice</strong> — not personalized. Sources: PwC Worldwide Tax Summaries (see About / <code>data/taxes.json</code>).</p>` +
      `</div>`;
    panel.dataset.dedBound = "";
    panel.dataset.taxBound = "";
  }

  function renderTaxPanel(ctx) {
    const panel = el("taxPanel");
    if (!panel) return;

    const {
      home, dest, itype, incomeLocal, netForPpp, homeTax, destGross,
      homeSupported, destSupported, homeTaxCountry, destTaxCountry, taxUnavailable,
      state: stateIn,
    } = ctx;
    const escapeHtml = global.PPP.escapeHtml;
    const state = stateIn || {
      deduction_home: "standard",
      deduction_dest: "standard",
      custom_home: "10",
      custom_dest: "10",
      custom_home_unit: "pct",
      custom_dest_unit: "pct",
    };

    if (!(incomeLocal > 0)) {
      panel.classList.add("hidden");
      panel.innerHTML = "";
      panel.dataset.dedBound = "";
      panel.dataset.taxBound = "";
      return;
    }

    panel.classList.remove("hidden");
    ensureTaxPanelShell(panel);
    const warnings = [];
    if (itype === "gross" && !homeSupported) {
      warnings.push(
        `Home (${escapeHtml(home.iso3)}): tax estimate unavailable — PPP uses the entered figure as take-home for comparison.`
      );
    } else if (!homeSupported && homeTaxCountry && (homeTaxCountry.reason || homeTaxCountry.notes)) {
      warnings.push(`Home (${escapeHtml(home.iso3)}): ${escapeHtml(homeTaxCountry.reason || homeTaxCountry.notes)}`);
    }
    if (!destSupported && destTaxCountry) {
      const reason = destTaxCountry.reason || destTaxCountry.notes || "No illustrative PIT model.";
      warnings.push(`Destination (${escapeHtml(dest.iso3)}): gross-up unavailable — ${escapeHtml(reason)}`);
    }

    let homeBlock = "";
    let homeSumTax = "—";
    let homeSumNet = "—";
    if (itype === "gross" && homeSupported && homeTax && homeTax.supported) {
      homeBlock = renderTaxSimBlock(homeTax, homeTaxCountry, home.currency, home.iso3, `Home · ${home.name}`);
      homeSumTax = escapeHtml(moneyOrDash(homeTax.totalTax, home.currency, home.iso3));
      homeSumNet = escapeHtml(moneyOrDash(homeTax.net, home.currency, home.iso3));
    } else if (itype === "gross" && !homeSupported) {
      homeBlock = renderTaxSimBlock(
        { supported: false, notes: null },
        homeTaxCountry,
        home.currency,
        home.iso3,
        `Home · ${home.name}`,
        {
          tax: null,
          net: netForPpp,
          unavailable: "Tax estimate unavailable",
          note: "Entered gross treated as take-home for PPP only (no brackets applied).",
        }
      );
      homeSumNet = escapeHtml(moneyOrDash(netForPpp, home.currency, home.iso3));
    } else {
      // Net mode: entered figure is take-home — no home tax estimate (show 0).
      homeBlock = renderTaxSimBlock(
        { supported: false, notes: null },
        homeTaxCountry,
        home.currency,
        home.iso3,
        `Home · ${home.name}`,
        {
          tax: 0,
          net: netForPpp,
          unavailable: "No home tax in Net mode",
          note: "Net mode uses take-home as-is for PPP (est. tax 0). Switch to Gross for a home tax estimate.",
        }
      );
      homeSumTax = escapeHtml(moneyOrDash(0, home.currency, home.iso3));
      homeSumNet = escapeHtml(moneyOrDash(netForPpp, home.currency, home.iso3));
    }

    let destBlock = "";
    let destSumTax = "—";
    let destSumNet = "—";
    if (destSupported && destGross && destGross.supported && destGross.gross != null) {
      destBlock = renderTaxSimBlock(
        destGross,
        destTaxCountry,
        dest.currency,
        dest.iso3,
        `Destination · ${dest.name} (gross-up)`
      );
      destSumTax = escapeHtml(moneyOrDash(destGross.totalTax, dest.currency, dest.iso3));
      destSumNet = escapeHtml(moneyOrDash(destGross.net, dest.currency, dest.iso3));
    } else {
      destBlock = renderTaxSimBlock(
        { supported: false, notes: null },
        destTaxCountry,
        dest.currency,
        dest.iso3,
        `Destination · ${dest.name}`,
        {
          unavailable: "Gross-up unavailable",
          note: "No illustrative PIT model for this destination (or tax data not loaded).",
        }
      );
    }

    const warnHtml = warnings.length
      ? `<ul class="tax-warnings">${warnings.map((w) => `<li>${w}</li>`).join("")}</ul>`
      : "";

    const noteEl = el("taxDedNote");
    const dedMount = el("taxDeductionMount");
    const results = el("taxResultsMount");
    const warnMount = el("taxWarnMount");
    const footEl = el("taxFootNote");

    // Net: keep the section title + Tax ≈ 0 only; hide copy, deductions, and full block.
    if (itype === "net") {
      global.PPP._taxOpen = global.PPP._taxOpen || Object.create(null);
      global.PPP._taxOpen.both = false;
      if (noteEl) {
        noteEl.textContent = "";
        noteEl.classList.add("hidden");
      }
      if (dedMount) {
        dedMount.innerHTML = "";
        dedMount.dataset.fp = "";
        dedMount.classList.add("hidden");
      }
      if (results) {
        const zeroTax = escapeHtml(moneyOrDash(0, home.currency, home.iso3));
        results.innerHTML =
          `<div class="tax-net-zero">` +
          `<div class="tax-row"><span>Tax</span><b>≈ ${zeroTax}</b></div>` +
          `</div>`;
        results.classList.remove("hidden");
      }
      if (warnMount) warnMount.innerHTML = "";
      if (footEl) footEl.classList.add("hidden");
      panel.classList.add("tax-panel-net");
      return;
    }

    panel.classList.remove("tax-panel-net");
    if (noteEl) noteEl.classList.remove("hidden");
    if (dedMount) dedMount.classList.remove("hidden");
    if (footEl) footEl.classList.remove("hidden");

    const dedNote =
      "Set a deduction per country below. Home applies to gross→net; destination applies to the PPP gross-up. Expand for the full calculation.";

    const open = !!(global.PPP._taxOpen && global.PPP._taxOpen.both);

    const homeBase = incomeLocal || 0;
    const destBase = (destGross && destGross.gross) || 0;
    panel.setAttribute("data-ded-base-home", String(homeBase || 0));
    panel.setAttribute("data-ded-base-dest", String(destBase || 0));

    if (noteEl) noteEl.textContent = dedNote;

    const active = panel.querySelector("input[data-ded=\"value\"]:focus, select[data-ded=\"mode\"]:focus");
    const focusSide = active && active.getAttribute("data-side");
    const focusKind = active && active.getAttribute("data-ded");
    const focusPos = (active && active.selectionStart != null) ? active.selectionStart : null;

    if (dedMount) {
      // Remount only when structure changes — not on every typed digit
      const fp = [
        home.iso3, dest.iso3, itype,
        state.deduction_home, state.deduction_dest,
        state.custom_home_unit, state.custom_dest_unit,
      ].join("|");
      if (dedMount.dataset.fp !== fp) {
        dedMount.dataset.fp = fp;
        dedMount.innerHTML =
          `<div class="tax-ded-panel">` +
          `<p class="tax-ded-heading">Deduction assumption</p>` +
          `<div class="tax-ded-grid">` +
          renderDeductionControls("home", state, home, home.currency, home.iso3, homeBase) +
          renderDeductionControls("dest", state, dest, dest.currency, dest.iso3, destBase) +
          `</div></div>`;
      } else {
        // Keep live values in sync without remounting (focus-safe)
        for (const side of ["home", "dest"]) {
          const mode = side === "dest" ? state.deduction_dest : state.deduction_home;
          const wrap = dedMount.querySelector(`[data-ded-custom="${side}"]`);
          if (wrap) wrap.classList.toggle("hidden", mode !== "custom");
        }
      }
    }

    if (results) {
      results.classList.remove("hidden");
      results.innerHTML =
        `<details class="tax-col" data-tax-key="both"${open ? " open" : ""}>` +
        `<summary class="tax-summary">` +
        `<span class="tax-col-title">Home &amp; destination</span>` +
        `<div class="tax-summary-metrics tax-summary-both">` +
        `<div class="tax-sum-pair"><span class="tax-sum-label">Home</span>` +
        `<div class="tax-row"><span>Est. tax</span><b>${homeSumTax}</b></div>` +
        `<div class="tax-row"><span>Est. net</span><b>${homeSumNet}</b></div></div>` +
        `<div class="tax-sum-pair"><span class="tax-sum-label">Dest</span>` +
        `<div class="tax-row"><span>Est. tax</span><b>${destSumTax}</b></div>` +
        `<div class="tax-row"><span>Est. net</span><b>${destSumNet}</b></div></div>` +
        `</div>` +
        `<span class="tax-chevron" aria-hidden="true"></span>` +
        `</summary>` +
        `<div class="tax-details tax-details-both">` +
        `<div class="tax-grid">${homeBlock}${destBlock}</div>` +
        `</div></details>`;
    }

    if (warnMount) warnMount.innerHTML = warnHtml;

    if (focusSide && focusKind && dedMount) {
      const sel = dedMount.querySelector(`[data-ded="${focusKind}"][data-side="${focusSide}"]`);
      if (sel) {
        sel.focus();
        if (focusPos != null && sel.setSelectionRange) {
          try { sel.setSelectionRange(focusPos, focusPos); } catch (_) {}
        }
      }
    }

    bindTaxCollapse(panel);
    bindTaxDeduction(panel);
  }

  function syncDeductionUi() {
    // Deduction UI now lives inside the tax panel (see renderDeductionControls).
  }

  function setHiddenDed(side, key, value) {
    const map = {
      mode: side === "dest" ? "dedDest" : "dedHome",
      value: side === "dest" ? "customDest" : "customHome",
      unit: side === "dest" ? "customDestUnit" : "customHomeUnit",
    };
    const id = map[key];
    const node = id && el(id);
    if (node) node.value = String(value);
  }

  function bindTaxDeduction(panel) {
    if (!panel || panel.dataset.dedBound === "1") return;
    panel.dataset.dedBound = "1";

    const rerender = () => {
      if (typeof global.PPP._rerender === "function") global.PPP._rerender();
    };

    panel.addEventListener("change", (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.matches("select[data-ded=\"mode\"]")) {
        const side = t.getAttribute("data-side");
        setHiddenDed(side, "mode", t.value);
        rerender();
      }
    });

    let inputTimer = null;
    panel.addEventListener("input", (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.matches("input[data-ded=\"value\"]")) {
        const side = t.getAttribute("data-side");
        setHiddenDed(side, "value", t.value);
        clearTimeout(inputTimer);
        inputTimer = setTimeout(rerender, 180);
      }
    });

    panel.addEventListener("click", (ev) => {
      const btn = ev.target && ev.target.closest && ev.target.closest("button[data-ded-unit]");
      if (!btn || !panel.contains(btn)) return;
      ev.preventDefault();
      const side = btn.getAttribute("data-side");
      const nextUnit = btn.getAttribute("data-ded-unit");
      if (!side || (nextUnit !== "pct" && nextUnit !== "amount")) return;

      const unitEl = el(side === "dest" ? "customDestUnit" : "customHomeUnit");
      const valEl = el(side === "dest" ? "customDest" : "customHome");
      const prevUnit = unitEl ? unitEl.value : "pct";
      if (prevUnit === nextUnit) return;

      const base = Number(panel.getAttribute(side === "dest" ? "data-ded-base-dest" : "data-ded-base-home")) || 0;
      let val = Number(valEl && valEl.value);
      if (!Number.isFinite(val)) val = 0;

      if (nextUnit === "amount" && prevUnit === "pct" && base > 0) {
        const pct = global.PPP.tax ? global.PPP.tax.clampCustomPct(val) : Math.max(0, Math.min(100, val));
        val = Math.round(base * (pct / 100));
      } else if (nextUnit === "pct" && prevUnit === "amount" && base > 0) {
        val = global.PPP.tax
          ? global.PPP.tax.clampCustomPct((val / base) * 100)
          : Math.max(0, Math.min(100, (val / base) * 100));
        val = Math.round(val * 10) / 10;
      }

      setHiddenDed(side, "unit", nextUnit);
      setHiddenDed(side, "value", val);
      rerender();
    });
  }

  function render(ctx) {
    const { byIso, COMM, getState, writeUrlDebounced } = ctx;
    const state = getState();
    const home = byIso[state.home];
    const dest = byIso[state.dest];
    const hint = el("currencyHint");
    if (hint) {
      hint.textContent = home
        ? `Annual, in ${home.name}'s currency (${home.currency}).`
        : "Home-currency annual figure.";
    }

    const king = el("kingLink");
    if (king) king.href = global.PPP.url.kingIndexHref(state);

    syncDeductionUi(state, state.home, state.dest);

    if (!home || !dest) {
      showStatus("Pick a home and destination country.", "warn");
      const panel = el("taxPanel");
      if (panel) { panel.classList.add("hidden"); panel.innerHTML = ""; }
      return;
    }

    // Evidence chips always when pair is reliable (even without income)
    const ev = global.PPP.evidence(home, dest);
    setEvidence(ev);

    let incomeLocal = global.PPP.parseIncome(state.income);
    renderCommodities(home, dest, COMM);

    if (!(incomeLocal > 0)) {
      showStatus(null);
      el("leadText").textContent = "Enter an annual income to compare purchasing power.";
      el("pppValue").textContent = "—";
      el("fxValue").textContent = "—";
      const delta = el("deltaNote");
      if (delta) { delta.textContent = ""; delta.classList.add("hidden"); }
      if (!ev.reliable) showStatus(ev.reason || "Data unreliable for this pair.", "warn");
      renderTaxPanel({ home, dest, itype: state.type || "net", incomeLocal: 0, state });
      writeUrlDebounced();
      return;
    }

    if (incomeLocal < global.PPP.INCOME_MIN) incomeLocal = global.PPP.INCOME_MIN;
    if (incomeLocal > global.PPP.INCOME_MAX) incomeLocal = global.PPP.INCOME_MAX;

    const itype = state.type || "net";
    const homeOpts = taxOptsFor(state, "home");
    const destOpts = taxOptsFor(state, "dest");
    const taxApi = global.PPP.tax;
    const homeTaxCountry = taxApi ? taxApi.getTax(home.iso3) : null;
    const destTaxCountry = taxApi ? taxApi.getTax(dest.iso3) : null;
    const homeSupported = taxApi ? taxApi.isSupported(home.iso3) : false;
    const destSupported = taxApi ? taxApi.isSupported(dest.iso3) : false;

    let netForPpp = incomeLocal;
    let homeTax = null;
    let taxUnavailable = false;

    if (itype === "gross") {
      if (homeSupported && taxApi) {
        homeTax = taxApi.grossToNet(incomeLocal, homeTaxCountry, homeOpts);
        netForPpp = homeTax.net;
      } else {
        taxUnavailable = true;
        netForPpp = incomeLocal; // treat entered as net for PPP; warn in panel
      }
    }

    const r = global.PPP.compute(home, dest, netForPpp);

    let destGross = null;
    if (r.reliable && r.equiv != null && destSupported && taxApi) {
      destGross = taxApi.netToGross(r.equiv, destTaxCountry, destOpts);
    }

    if (!r.reliable) {
      showStatus(r.reason || "Data unreliable for this pair — results hidden.", "warn");
      el("pppValue").textContent = "—";
      el("fxValue").textContent = "—";
      el("leadText").textContent =
        `${global.PPP.fmtIncomeLead(incomeLocal, home.currency, home.iso3)} ${itype} · ${home.name} → ${dest.name}`;
      const delta = el("deltaNote");
      if (delta) { delta.textContent = ""; delta.classList.add("hidden"); }
      renderTaxPanel({
        home, dest, itype, incomeLocal, netForPpp, homeTax, destGross: null,
        homeSupported, destSupported, homeTaxCountry, destTaxCountry, taxUnavailable,
        pppEquiv: null, state,
      });
      writeUrlDebounced();
      return;
    }

    showStatus(null);

    let leadExtra = "";
    if (itype === "gross" && homeSupported && homeTax) {
      leadExtra = ` (est. net ${global.PPP.fmtIncomeLead(homeTax.net, home.currency, home.iso3)})`;
    } else if (itype === "gross" && !homeSupported) {
      leadExtra = " (tax estimate unavailable)";
    }

    el("leadText").textContent =
      `${global.PPP.fmtIncomeLead(incomeLocal, home.currency, home.iso3)} ${itype}${leadExtra} in ${home.name} → ${dest.name}`;

    el("pppValue").textContent = global.PPP.fmtMoney(r.equiv, dest.currency, dest.iso3);
    el("pppSub").textContent = `To buy a similar basket in ${dest.name}` +
      (itype === "gross" && homeSupported ? " (from estimated home net)" : "");
    el("fxValue").textContent = global.PPP.fmtMoney(r.fxLocal, dest.currency, dest.iso3);
    el("fxSub").textContent = `If you convert at market FX (${home.currency}→${dest.currency})`;

    setEvidence({
      reliable: true,
      pliDisplay: r.pliDisplay,
      cost: r.cost,
      costPct: r.costPct,
    });

    const delta = el("deltaNote");
    if (delta) {
      const note = deltaNote(r.equiv, r.fxLocal);
      if (note) {
        delta.textContent = note;
        delta.classList.remove("hidden");
      } else {
        delta.textContent = "";
        delta.classList.add("hidden");
      }
    }

    renderTaxPanel({
      home, dest, itype, incomeLocal, netForPpp, homeTax, destGross,
      homeSupported, destSupported, homeTaxCountry, destTaxCountry, taxUnavailable,
      pppEquiv: r.equiv, state,
    });

    writeUrlDebounced();
  }

  global.PPP = Object.assign(global.PPP || {}, {
    render: { render, showStatus, renderCommodities, deltaNote },
  });
})(typeof window !== "undefined" ? window : globalThis);
