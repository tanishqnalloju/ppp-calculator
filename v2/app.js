(function () {
  "use strict";

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
    };
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
      // Fallback: select-friendly prompt
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
      const [cRes, mRes] = await Promise.all([
        fetch("data/countries.json"),
        fetch("data/commodities.json"),
      ]);
      if (!cRes.ok) throw new Error("Could not load countries.json");
      const DATA = await cRes.json();
      COMM = mRes.ok ? await mRes.json() : null;

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

      if (byIso.IND) homePicker.setValue("IND", true);
      else if (countriesSorted[0]) homePicker.setValue(countriesSorted[0].iso3, true);
      if (byIso.USA) destPicker.setValue("USA", true);
      else if (countriesSorted[1]) destPicker.setValue(countriesSorted[1].iso3, true);

      PPP.url.readParams(byIso, {
        setType: (t) => { el("itype").value = t; },
        setHome: (iso, silent) => homePicker.setValue(iso, silent),
        setDest: (iso, silent) => destPicker.setValue(iso, silent),
        setIncome: (v) => { el("income").value = v; },
        getHome: () => el("home").value,
      });

      el("income").addEventListener("input", doRender);
      el("income").addEventListener("change", () => { reformatIncome(); doRender(); });
      el("itype").addEventListener("change", doRender);
      el("home").addEventListener("change", () => { reformatIncome(); doRender(); });
      el("dest").addEventListener("change", doRender);

      const swapBtn = el("swapBtn");
      if (swapBtn) swapBtn.addEventListener("click", swapCountries);
      const copyBtn = el("copyLink");
      if (copyBtn) copyBtn.addEventListener("click", copyLink);

      if (!el("income").value) {
        const home = byIso[el("home").value];
        el("income").value = PPP.formatIncomeInput(800000, home && home.currency, home && home.iso3);
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
