(function () {
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

  let DATA = null, COMM = null, byIso = {}, countriesSorted = [];
  let urlTimer = null;
  const INCOME_MIN = 1000, INCOME_MAX = 50000000;
  const el = (id) => document.getElementById(id);

  function showError(msg) {
    el("status").textContent = msg;
    el("status").classList.remove("hidden");
  }
  function clearError() { el("status").classList.add("hidden"); }

  function setupPicker(inputId, hiddenId, listId) {
    const input = el(inputId), hidden = el(hiddenId), list = el(listId);
    function options(filter) {
      const q = (filter || "").trim().toLowerCase();
      const out = [];
      for (const c of countriesSorted) {
        const label = `${c.name} (${c.iso3})`;
        if (!q || label.toLowerCase().includes(q) || c.iso3.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) {
          out.push({ iso3: c.iso3, name: label });
        }
      }
      return out.slice(0, 40);
    }
    function renderList(filter) {
      const opts = options(filter);
      list.innerHTML = opts.map((o, i) =>
        `<button type="button" role="option" data-iso="${o.iso3}" class="${i === 0 ? "active" : ""}">${escapeHtml(o.name)}</button>`
      ).join("");
      list.classList.add("open");
      input.setAttribute("aria-expanded", "true");
    }
    function setValue(iso3, silent) {
      hidden.value = iso3 || "";
      if (iso3 && byIso[iso3]) input.value = `${byIso[iso3].name} (${iso3})`;
      if (!silent) hidden.dispatchEvent(new Event("change", { bubbles: true }));
    }
    input.addEventListener("focus", () => renderList(input.value.includes("(") ? "" : input.value));
    input.addEventListener("input", () => renderList(input.value));
    input.addEventListener("keydown", (e) => {
      const btns = [...list.querySelectorAll("button")];
      const idx = btns.findIndex(b => b.classList.contains("active"));
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const n = Math.min(btns.length - 1, idx + 1);
        btns.forEach(b => b.classList.remove("active"));
        if (btns[n]) btns[n].classList.add("active");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const n = Math.max(0, idx - 1);
        btns.forEach(b => b.classList.remove("active"));
        if (btns[n]) btns[n].classList.add("active");
      } else if (e.key === "Enter") {
        e.preventDefault();
        const a = list.querySelector("button.active") || btns[0];
        if (a) { setValue(a.dataset.iso); list.classList.remove("open"); input.setAttribute("aria-expanded", "false"); }
      } else if (e.key === "Escape") {
        list.classList.remove("open");
        input.setAttribute("aria-expanded", "false");
      }
    });
    list.addEventListener("mousedown", (e) => {
      const btn = e.target.closest("button[data-iso]");
      if (!btn) return;
      e.preventDefault();
      setValue(btn.dataset.iso);
      list.classList.remove("open");
      input.setAttribute("aria-expanded", "false");
    });
    document.addEventListener("click", (e) => {
      if (!input.contains(e.target) && !list.contains(e.target)) {
        list.classList.remove("open");
        input.setAttribute("aria-expanded", "false");
      }
    });
    return { setValue, getValue: () => hidden.value };
  }

  let homePicker, destPicker;

  function updateCurrencyHint() {
    const home = byIso[el("home").value];
    el("currencyHint").textContent = home
      ? `Annual, in ${home.name}'s currency (${home.currency}).`
      : "Home-currency annual figure.";
  }

  function readParams() {
    const q = new URLSearchParams(location.search);
    if (q.get("income")) {
      const n = parseIncome(q.get("income"));
      if (n > 0) {
        const homeIso = (q.get("home") && byIso[q.get("home")]) ? q.get("home") : el("home").value;
        const home = byIso[homeIso];
        el("income").value = formatIncomeInput(n, home && home.currency, homeIso);
      }
    }
    if (q.get("type") === "gross" || q.get("type") === "net") el("itype").value = q.get("type");
    if (q.get("home") && byIso[q.get("home")]) homePicker.setValue(q.get("home"), true);
    if (q.get("dest") && byIso[q.get("dest")]) destPicker.setValue(q.get("dest"), true);
  }

  function writeParamsDebounced() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(writeParams, 350);
  }

  function writeParams() {
    const q = new URLSearchParams();
    const incomeLocal = parseIncome(el("income").value);
    q.set("income", String(incomeLocal > 0 ? Math.round(incomeLocal) : ""));
    q.set("home", el("home").value || "IND");
    q.set("type", el("itype").value || "net");
    q.set("dest", el("dest").value || "USA");
    history.replaceState(null, "", location.pathname + "?" + q.toString());
    updateKingLink();
  }

  function updateKingLink() {
    const a = el("kingLink");
    if (!a) return;
    const q = new URLSearchParams();
    const incomeLocal = parseIncome(el("income").value);
    if (incomeLocal > 0) q.set("income", String(Math.round(incomeLocal)));
    if (el("home").value) q.set("home", el("home").value);
    if (el("itype").value) q.set("type", el("itype").value);
    if (el("dest").value) q.set("dest", el("dest").value);
    const qs = q.toString();
    a.href = "https://kingindex.tanishqnalloju.com/" + (qs ? "?" + qs : "");
  }

  function fmtPrice(entry) {
    if (!entry || entry.local == null || !Number.isFinite(entry.local)) return "—";
    return fmtMoney(entry.local, entry.currency, null);
  }

  function renderCommodities(home, dest) {
    const strip = el("commStrip");
    const intro = el("commIntro");
    if (!COMM || !COMM.items) {
      strip.innerHTML = "";
      intro.textContent = "Commodity sample not loaded.";
      return;
    }
    const asOf = (COMM.meta && COMM.meta.as_of) || "n/a";
    const homeP = (COMM.prices && home && COMM.prices[home.iso3]) || {};
    const destP = (COMM.prices && dest && COMM.prices[dest.iso3]) || {};
    const cards = [];
    for (const item of COMM.items) {
      const h = homeP[item.id];
      const d = destP[item.id];
      if ((!h || h.local == null) && (!d || d.local == null)) continue;
      cards.push(
        `<article class="card">` +
        `<p class="name">${escapeHtml(item.name)}</p>` +
        `<p class="unit">${escapeHtml(item.unit)}</p>` +
        `<div class="row"><span>${escapeHtml(home ? home.iso3 : "Home")}</span><b>${escapeHtml(fmtPrice(h))}</b></div>` +
        `<div class="row"><span>${escapeHtml(dest ? dest.iso3 : "Dest")}</span><b>${escapeHtml(fmtPrice(d))}</b></div>` +
        `</article>`
      );
    }
    if (!cards.length) {
      strip.innerHTML = `<p class="gap-note">No overlapping commodity sample for this pair (as of ${escapeHtml(asOf)}).</p>`;
    } else {
      strip.innerHTML = cards.join("");
    }
    intro.textContent = `Illustrative local prices (as of ${asOf}). Not a full CPI basket. Sources: Economist Big Mac Index + Numbeo.`;
  }

  function render() {
    const home = byIso[el("home").value];
    const dest = byIso[el("dest").value];
    updateCurrencyHint();
    if (!home || !dest) {
      showError("Pick a home and destination country.");
      return;
    }
    let incomeLocal = parseIncome(el("income").value);
    if (!(incomeLocal > 0)) {
      clearError();
      el("leadText").textContent = "Enter an annual income to compare purchasing power.";
      el("pppValue").textContent = "—";
      el("fxValue").textContent = "—";
      el("costText").textContent = "Cost vs home: —";
      el("pliText").textContent = "Price level vs US: —";
      renderCommodities(home, dest);
      writeParamsDebounced();
      return;
    }
    if (incomeLocal < INCOME_MIN) incomeLocal = INCOME_MIN;
    if (incomeLocal > INCOME_MAX) incomeLocal = INCOME_MAX;

    const r = compute(home, dest, incomeLocal);
    if (!r.reliable) {
      showError(r.reason || "Data unreliable for this pair — results hidden.");
      el("pppValue").textContent = "—";
      el("fxValue").textContent = "—";
      el("leadText").textContent = `${fmtIncomeLead(incomeLocal, home.currency, home.iso3)} ${el("itype").value} · ${home.name} → ${dest.name}`;
      renderCommodities(home, dest);
      writeParamsDebounced();
      return;
    }
    clearError();

    const itype = el("itype").value;
    el("leadText").textContent =
      `${fmtIncomeLead(incomeLocal, home.currency, home.iso3)} ${itype} in ${home.name} → ${dest.name}`;

    el("pppValue").textContent = fmtMoney(r.equiv, dest.currency, dest.iso3);
    el("pppSub").textContent = `To buy a similar basket in ${dest.name}`;
    el("fxValue").textContent = fmtMoney(r.fxLocal, dest.currency, dest.iso3);
    el("fxSub").textContent = `If you convert at market FX (${home.currency}→${dest.currency})`;

    el("costText").textContent = r.cost.primary || "Cost vs home: —";
    el("costSub").textContent = r.costPct != null && Number.isFinite(r.costPct)
      ? `(${r.costPct > 0 ? "+" : ""}${Math.round(r.costPct)}% price level)`
      : "";

    el("pliText").textContent = r.pliDisplay != null
      ? `Price level vs US: ${r.pliDisplay}`
      : "Price level vs US: —";

    // Worked example detail
    const ex = el("exampleDetail");
    if (ex) {
      ex.textContent =
        `${fmtIncomeLead(incomeLocal, home.currency, home.iso3)} ${itype} → ` +
        `PPP ${fmtMoney(r.equiv, dest.currency, dest.iso3)}; ` +
        `FX ${fmtMoney(r.fxLocal, dest.currency, dest.iso3)}. ` +
        (r.cost.primary || "");
    }

    renderCommodities(home, dest);
    writeParamsDebounced();
  }

  function setupTheme() {
    const btn = el("themeToggle");
    const label = el("themeLabel");
    function sync() {
      const t = document.documentElement.getAttribute("data-theme") || "light";
      label.textContent = t === "dark" ? "Light" : "Dark";
    }
    sync();
    btn.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("ppp-calc-theme", next); } catch (_) {}
      sync();
    });
  }

  async function init() {
    setupTheme();
    try {
      const [cRes, mRes] = await Promise.all([
        fetch("data/countries.json"),
        fetch("data/commodities.json"),
      ]);
      if (!cRes.ok) throw new Error("Could not load countries.json");
      DATA = await cRes.json();
      COMM = mRes.ok ? await mRes.json() : null;
    } catch (e) {
      showError("Failed to load data. Serve this folder over HTTP (not file://).");
      console.error(e);
      return;
    }
    byIso = {};
    for (const c of DATA.countries) byIso[c.iso3] = c;
    countriesSorted = DATA.countries.slice().sort((a, b) => a.name.localeCompare(b.name));
    homePicker = setupPicker("homeInput", "home", "homeList");
    destPicker = setupPicker("destInput", "dest", "destList");
    if (byIso.IND) homePicker.setValue("IND", true);
    else if (countriesSorted[0]) homePicker.setValue(countriesSorted[0].iso3, true);
    if (byIso.USA) destPicker.setValue("USA", true);
    else if (countriesSorted[1]) destPicker.setValue(countriesSorted[1].iso3, true);

    readParams();
    updateCurrencyHint();

    el("income").addEventListener("input", render);
    el("income").addEventListener("change", () => {
      const home = byIso[el("home").value];
      const n = parseIncome(el("income").value);
      if (n > 0 && home) el("income").value = formatIncomeInput(n, home.currency, home.iso3);
      render();
    });
    el("itype").addEventListener("change", render);
    el("home").addEventListener("change", () => {
      const home = byIso[el("home").value];
      const n = parseIncome(el("income").value);
      if (n > 0 && home) el("income").value = formatIncomeInput(n, home.currency, home.iso3);
      render();
    });
    el("dest").addEventListener("change", render);

    if (!el("income").value) {
      const home = byIso[el("home").value];
      el("income").value = formatIncomeInput(800000, home && home.currency, home && home.iso3);
    }
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
