(function () {
  "use strict";

  const DEFAULT_HOME = "IND";
  const DEFAULT_DEST = "USA";
  const DEFAULT_INCOME = 800000;

  const el = (id) => document.getElementById(id);
  let byIso = {};
  let countriesSorted = [];
  let COMM = null;
  let homePicker, destPicker;
  let urlTimer = null;

  function getState() {
    return {
      income: el("income").value,
      home: el("home").value,
      type: el("itype").value,
      dest: el("dest").value,
      deduction_home: el("dedHome") ? el("dedHome").value : "standard",
      deduction_dest: el("dedDest") ? el("dedDest").value : "standard",
      custom_home: el("customHome") ? el("customHome").value : "10",
      custom_dest: el("customDest") ? el("customDest").value : "10",
      custom_home_unit: el("customHomeUnit") ? el("customHomeUnit").value : "pct",
      custom_dest_unit: el("customDestUnit") ? el("customDestUnit").value : "pct",
    };
  }

  function syncTypeToggle(type) {
    const t = type === "gross" ? "gross" : "net";
    const hidden = el("itype");
    if (hidden) hidden.value = t;
    const grossBtn = el("typeGross");
    const netBtn = el("typeNet");
    if (grossBtn) {
      const on = t === "gross";
      grossBtn.classList.toggle("is-active", on);
      grossBtn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    if (netBtn) {
      const on = t === "net";
      netBtn.classList.toggle("is-active", on);
      netBtn.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  function writeUrlDebounced() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => PPP.url.writeParams(getState()), 350);
  }

  function doRender() {
    PPP.render.render({
      byIso,
      COMM,
      getState,
      writeUrlDebounced,
    });
  }

  function reformatIncome() {
    const home = byIso[el("home").value];
    const n = PPP.parseIncome(el("income").value);
    if (n > 0 && home) {
      el("income").value = PPP.formatIncomeInput(n, home.currency, home.iso3);
    }
  }

  function swapCountries() {
    const h = el("home").value;
    const d = el("dest").value;
    if (!h || !d) return;
    homePicker.setValue(d, true);
    destPicker.setValue(h, true);
    // Swap per-country deduction assumptions with the countries
    const swapPair = (a, b) => {
      if (!el(a) || !el(b)) return;
      const t = el(a).value;
      el(a).value = el(b).value;
      el(b).value = t;
    };
    swapPair("dedHome", "dedDest");
    swapPair("customHome", "customDest");
    swapPair("customHomeUnit", "customDestUnit");
    reformatIncome();
    doRender();
  }

  async function copyLink() {
    const url = PPP.url.shareUrl(getState());
    const btn = el("copyLink");
    try {
      await navigator.clipboard.writeText(url);
      if (btn) {
        const prev = btn.textContent;
        btn.textContent = "Copied";
        btn.setAttribute("aria-live", "polite");
        setTimeout(() => { btn.textContent = prev; }, 1600);
      }
    } catch (_) {
      try {
        window.prompt("Copy this link:", url);
      } catch (e2) {
        PPP.render.showStatus("Could not copy link.", "warn");
      }
    }
  }

  async function init() {
    PPP.theme.setup();
    PPP.render.showStatus("Loading country data…", "loading");

    try {
      const [cRes, mRes, tRes] = await Promise.all([
        fetch("data/countries.json"),
        fetch("data/commodities.json"),
        fetch("data/taxes.json").catch(() => null),
      ]);
      if (!cRes.ok) throw new Error("Could not load countries.json");
      const DATA = await cRes.json();
      COMM = mRes.ok ? await mRes.json() : null;

      if (tRes && tRes.ok && PPP.tax) {
        try {
          const TAX = await tRes.json();
          PPP.tax.loadTaxData(TAX);
        } catch (te) {
          console.warn("taxes.json parse failed; tax estimates disabled", te);
        }
      } else if (PPP.tax) {
        console.warn("taxes.json missing; tax estimates disabled");
      }

      byIso = {};
      for (const c of DATA.countries) byIso[c.iso3] = c;
      countriesSorted = DATA.countries.slice().sort((a, b) => a.name.localeCompare(b.name));

      homePicker = PPP.setupPicker({
        inputId: "homeInput",
        hiddenId: "home",
        listId: "homeList",
        getCountries: () => countriesSorted,
      });
      destPicker = PPP.setupPicker({
        inputId: "destInput",
        hiddenId: "dest",
        listId: "destList",
        getCountries: () => countriesSorted,
      });

      if (byIso[DEFAULT_HOME]) homePicker.setValue(DEFAULT_HOME, true);
      else if (countriesSorted[0]) homePicker.setValue(countriesSorted[0].iso3, true);
      if (byIso[DEFAULT_DEST]) destPicker.setValue(DEFAULT_DEST, true);
      else if (countriesSorted[1]) destPicker.setValue(countriesSorted[1].iso3, true);

      PPP.url.readParams(byIso, {
        setType: (t) => { syncTypeToggle(t); },
        setHome: (iso, silent) => homePicker.setValue(iso, silent),
        setDest: (iso, silent) => destPicker.setValue(iso, silent),
        setIncome: (v) => { el("income").value = v; },
        getHome: () => el("home").value,
        setDedHome: (d) => { if (el("dedHome")) el("dedHome").value = d; },
        setDedDest: (d) => { if (el("dedDest")) el("dedDest").value = d; },
        setCustomHome: (v) => { if (el("customHome")) el("customHome").value = v; },
        setCustomDest: (v) => { if (el("customDest")) el("customDest").value = v; },
        setCustomHomeUnit: (u) => { if (el("customHomeUnit")) el("customHomeUnit").value = u; },
        setCustomDestUnit: (u) => { if (el("customDestUnit")) el("customDestUnit").value = u; },
      });

      el("income").addEventListener("input", doRender);
      el("income").addEventListener("change", () => { reformatIncome(); doRender(); });
      syncTypeToggle(el("itype").value || "net");
      const onTypeClick = (ev) => {
        const btn = ev.currentTarget;
        const t = btn.getAttribute("data-type");
        if (!t) return;
        syncTypeToggle(t);
        doRender();
      };
      if (el("typeGross")) el("typeGross").addEventListener("click", onTypeClick);
      if (el("typeNet")) el("typeNet").addEventListener("click", onTypeClick);

      el("home").addEventListener("change", () => { reformatIncome(); doRender(); });
      el("dest").addEventListener("change", doRender);

      PPP._rerender = doRender;

      const swapBtn = el("swapBtn");
      if (swapBtn) swapBtn.addEventListener("click", swapCountries);
      const copyBtn = el("copyLink");
      if (copyBtn) copyBtn.addEventListener("click", copyLink);

      if (!el("income").value) {
        const home = byIso[el("home").value];
        el("income").value = PPP.formatIncomeInput(DEFAULT_INCOME, home && home.currency, home && home.iso3);
      }

      PPP.render.showStatus(null);
      doRender();
    } catch (e) {
      PPP.render.showStatus("Failed to load data. Serve this folder over HTTP (not file://).", "warn");
      console.error(e);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
