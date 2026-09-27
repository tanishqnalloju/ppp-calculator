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

    if (!home || !dest) {
      showStatus("Pick a home and destination country.", "warn");
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
      writeUrlDebounced();
      return;
    }

    if (incomeLocal < global.PPP.INCOME_MIN) incomeLocal = global.PPP.INCOME_MIN;
    if (incomeLocal > global.PPP.INCOME_MAX) incomeLocal = global.PPP.INCOME_MAX;

    const r = global.PPP.compute(home, dest, incomeLocal);
    const itype = state.type || "net";

    if (!r.reliable) {
      showStatus(r.reason || "Data unreliable for this pair — results hidden.", "warn");
      el("pppValue").textContent = "—";
      el("fxValue").textContent = "—";
      el("leadText").textContent =
        `${global.PPP.fmtIncomeLead(incomeLocal, home.currency, home.iso3)} ${itype} · ${home.name} → ${dest.name}`;
      const delta = el("deltaNote");
      if (delta) { delta.textContent = ""; delta.classList.add("hidden"); }
      writeUrlDebounced();
      return;
    }

    showStatus(null);
    el("leadText").textContent =
      `${global.PPP.fmtIncomeLead(incomeLocal, home.currency, home.iso3)} ${itype} in ${home.name} → ${dest.name}`;

    el("pppValue").textContent = global.PPP.fmtMoney(r.equiv, dest.currency, dest.iso3);
    el("pppSub").textContent = `To buy a similar basket in ${dest.name}`;
    el("fxValue").textContent = global.PPP.fmtMoney(r.fxLocal, dest.currency, dest.iso3);
    el("fxSub").textContent = `If you convert at market FX (${home.currency}→${dest.currency})`;

    // Evidence from full compute (same as evidence()) for consistency when income present
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

    writeUrlDebounced();
  }

  global.PPP = Object.assign(global.PPP || {}, {
    render: { render, showStatus, renderCommodities, deltaNote },
  });
})(typeof window !== "undefined" ? window : globalThis);
