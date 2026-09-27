(function (global) {
  "use strict";

  /**
   * Accessible combobox: input + listbox + hidden value.
   * Improves on v1 with aria-activedescendant and option ids.
   */
  function setupPicker({ inputId, hiddenId, listId, getCountries, onChange }) {
    const input = document.getElementById(inputId);
    const hidden = document.getElementById(hiddenId);
    const list = document.getElementById(listId);
    if (!input || !hidden || !list) return null;

    let activeIndex = -1;
    let openOpts = [];

    function options(filter) {
      const q = (filter || "").trim().toLowerCase();
      const countries = getCountries() || [];
      const out = [];
      for (const c of countries) {
        const label = `${c.name} (${c.iso3})`;
        if (!q || label.toLowerCase().includes(q) || c.iso3.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) {
          out.push({ iso3: c.iso3, name: label });
        }
      }
      return out.slice(0, 40);
    }

    function close() {
      list.classList.remove("open");
      list.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      activeIndex = -1;
      openOpts = [];
    }

    function setActive(i) {
      const btns = [...list.querySelectorAll('[role="option"]')];
      btns.forEach((b, idx) => {
        const on = idx === i;
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      activeIndex = i;
      if (btns[i]) {
        input.setAttribute("aria-activedescendant", btns[i].id);
        btns[i].scrollIntoView({ block: "nearest" });
      }
    }

    function renderList(filter) {
      openOpts = options(filter);
      const escapeHtml = global.PPP.escapeHtml;
      list.innerHTML = openOpts.map((o, i) =>
        `<div role="option" id="${listId}-opt-${i}" data-iso="${o.iso3}" class="${i === 0 ? "active" : ""}" aria-selected="${i === 0 ? "true" : "false"}">${escapeHtml(o.name)}</div>`
      ).join("");
      list.classList.add("open");
      input.setAttribute("aria-expanded", "true");
      activeIndex = openOpts.length ? 0 : -1;
      if (activeIndex >= 0) {
        input.setAttribute("aria-activedescendant", `${listId}-opt-${activeIndex}`);
      } else {
        input.removeAttribute("aria-activedescendant");
      }
    }

    function setValue(iso3, silent) {
      hidden.value = iso3 || "";
      const countries = getCountries() || [];
      const c = countries.find(x => x.iso3 === iso3);
      if (c) input.value = `${c.name} (${iso3})`;
      else if (!iso3) input.value = "";
      if (!silent) {
        hidden.dispatchEvent(new Event("change", { bubbles: true }));
        if (typeof onChange === "function") onChange(iso3);
      }
    }

    function pickIndex(i) {
      if (i < 0 || i >= openOpts.length) return;
      setValue(openOpts[i].iso3);
      close();
    }

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", listId);
    input.setAttribute("aria-expanded", "false");
    list.setAttribute("role", "listbox");

    input.addEventListener("focus", () => {
      renderList(input.value.includes("(") ? "" : input.value);
    });
    input.addEventListener("input", () => renderList(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!list.classList.contains("open")) renderList(input.value.includes("(") ? "" : input.value);
        else if (openOpts.length) setActive(Math.min(openOpts.length - 1, activeIndex + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (list.classList.contains("open") && openOpts.length) setActive(Math.max(0, activeIndex - 1));
      } else if (e.key === "Enter") {
        if (list.classList.contains("open") && activeIndex >= 0) {
          e.preventDefault();
          pickIndex(activeIndex);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Tab") {
        close();
      } else if (e.key === "Home" && list.classList.contains("open") && openOpts.length) {
        e.preventDefault();
        setActive(0);
      } else if (e.key === "End" && list.classList.contains("open") && openOpts.length) {
        e.preventDefault();
        setActive(openOpts.length - 1);
      }
    });

    list.addEventListener("mousedown", (e) => {
      const opt = e.target.closest('[role="option"][data-iso]');
      if (!opt) return;
      e.preventDefault();
      setValue(opt.dataset.iso);
      close();
    });

    document.addEventListener("click", (e) => {
      if (!input.contains(e.target) && !list.contains(e.target)) close();
    });

    return { setValue, getValue: () => hidden.value, close };
  }

  global.PPP = Object.assign(global.PPP || {}, { setupPicker });
})(typeof window !== "undefined" ? window : globalThis);
