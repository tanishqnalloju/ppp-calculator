(function (global) {
  "use strict";

  const KEY = "ppp-calc-v2-theme";

  function current() {
    const t = document.documentElement.getAttribute("data-theme");
    return t === "dark" ? "dark" : "light";
  }

  function apply(theme) {
    const next = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(KEY, next); } catch (_) {}
    const label = document.getElementById("themeLabel");
    if (label) label.textContent = next === "dark" ? "Light" : "Dark";
  }

  function setup() {
    const btn = document.getElementById("themeToggle");
    apply(current());
    if (!btn) return;
    btn.addEventListener("click", () => {
      apply(current() === "dark" ? "light" : "dark");
    });
  }

  /** Boot theme before paint — call from inline head script with KEY. */
  function bootFromStorage() {
    try {
      var t = localStorage.getItem(KEY);
      if (t !== "light" && t !== "dark") {
        t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      document.documentElement.setAttribute("data-theme", t);
    } catch (e) {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }

  global.PPP = Object.assign(global.PPP || {}, {
    theme: { KEY, setup, apply, current, bootFromStorage },
  });
})(typeof window !== "undefined" ? window : globalThis);
