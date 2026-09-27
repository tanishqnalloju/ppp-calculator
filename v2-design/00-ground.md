# 00 — Ground: PPP Calculator v1 today

Scope: how the shipping calculator works, what redesign may change, and what must stay fixed. Sourced from `index.html`, `app.js`, `styles.css`, `README.md`, `wrangler.jsonc`, and `data/*`. **No invented PPP/FX numbers.**

## Product identity

- **Live:** https://ppp.tanishqnalloju.com  
- **Worker:** `ppp-calculator` (assets from `./public`, synced from root HTML/CSS/JS + `data/`)  
- **Story:** “Same money. Different prices.” — World Bank consumption PPP + official FX. Not KingIndex (no × median, scatter, bands, crowns, household size).  
- **Stack:** vanilla HTML/CSS/JS; Wrangler deploy-only.

## Information architecture (top → bottom)

1. Skip link → `#main`
2. **Header** — title “PPP Calculator” + theme toggle (light/dark)
3. **Tagline** — italic Newsreader: “Same money. Different prices.”
4. **Inputs panel** — annual income, type (net|gross label only), home country picker, destination picker
5. **Status** — warn banner when data unreliable / load failure
6. **Answer block**
   - Lead sentence (`₹800,000 net in India → United States`)
   - Dual metrics: **PPP equivalent** (primary) | **FX / wire**
   - Facts: **Cost vs home** | **Price level vs US (US = 100)**
7. **Worked example** aside (static prose + live detail line)
8. **Commodity strip** — up to 8 illustrative goods (home vs dest)
9. **Methodology & sources** (`<details>`)
10. **FAQ** (visible for crawl; mirrors JSON-LD FAQPage)
11. **Footer** — credit, KingIndex deep-link (forwards same query params), Source

## Inputs

| Control | Element | Notes |
|---------|---------|--------|
| Annual income | `#income` text + `inputmode=decimal` | Parsed stripping non-digits; formatted with locale on change; clamped 1 000–50 000 000 for compute |
| Type | `#itype` select | `net` \| `gross` — **label only**, tax not modeled |
| Home | `#homeInput` + hidden `#home` | Combobox-ish picker; default `IND` |
| Destination | `#destInput` + hidden `#dest` | Same pattern; default `USA` |

Country list: ~208 rows from `data/countries.json` (iso3, name, currency, ppp, fx, pli_us, excluded flags). Commodities: `data/commodities.json` items `big_mac, rice, bread, milk, eggs, petrol, cappuccino, broadband` with honest null gaps.

## Four answers + strip (product contract)

1. **PPP equivalent** — destination currency to live the same  
2. **FX / wire** — official-rate convert  
3. **Cost vs home** — lifestyle N% more/less (+ optional % price-level sub)  
4. **Price level vs US** — `round(dest.pli_us * 100)`, US = 100  
5. **Commodity strip** — illustrative local prices, dated in meta (`as_of`), not CPI

## Query params (must keep in v2)

`income`, `home`, `type` (`net`|`gross`), `dest`  
Written via `history.replaceState` (debounced 350 ms). KingIndex link receives the same params. Defaults: India (INR) → United States (USD) — `home=IND`, `dest=USA`. Example: `/?income=800000&home=IND&type=net&dest=USA`. No path routes.

## Math (unchanged for v2)

```
your_ppp_income = incomeLocal / home.ppp
equiv (PPP)     = your_ppp_income × dest.ppp
fxLocal         = incomeLocal × (dest.fx / home.fx)
costPct         = (dest.pli_us / home.pli_us − 1) × 100
PLI display     = round(dest.pli_us × 100)   # US = 100
```

Reliability gate: finite `pli_us ≥ 0.05`, finite positive `ppp`/`fx`; excluded countries warned; never Infinity/NaN in UI.

## Typography & theme notes

- Fonts: **Instrument Sans** (UI) + **Newsreader** (H1, tagline, lead, metric values, section titles) via Google Fonts import.  
- Light warm paper (`#f7f5f0`) + forest accent (`#1a5c45`). v2 dark is **Moon paper**: ink desk (`#161410` / canvas `#1a1814`) with parchment answer cards (`#e8e0d0`, dark card text `#1c1915`, forest accent `#1a5c45` on parchment). Header/rail/footer stay ink — not full-page parchment.  
- Theme: `data-theme` on `<html>`, FOUC-preventing inline script, `localStorage` key `ppp-calc-theme`, respects `prefers-color-scheme`.  
- Content width: `--content: 42rem` single column.  
- Reduced motion respected globally. Focus: `:focus { outline: none }` + `:focus-visible` accent ring.

## Runtime / deploy shape

- Root sources → `npm run sync-assets` copies into `public/` → Worker `ppp-calculator` serves ASSETS.  
- `src/worker.js` is a pass-through `env.ASSETS.fetch`.  
- Scripts: `scripts/fetch_wdi.py`, `scripts/fetch_commodities.py` refresh JSON only.

## Pain points for redesign (observed, not invented features)

1. **Single narrow column on wide screens** — comparison story underuses desktop; everything scrolls past equally.  
2. **Hierarchy soft between PPP and FX** — primary uses border/soft fill, but type sizes are close; on mobile they stack as twins.  
3. **Worked example overlaps lead + metrics** — third retelling of the same numbers.  
4. **Type (net/gross) eats panel space** for a non-functional label; “Tax not modeled” is easy to miss or looks like a broken control.  
5. **No swap home ↔ dest**; no explicit share/copy URL (params update silently).  
6. **Country pickers** — custom listbox with `role=listbox` / button options but no `aria-activedescendant` / option ids; focus management is partial.  
7. **Loading gap** — until `countries.json` resolves, UI is empty of values with no skeleton.  
8. **Inline style** on type hint in HTML; spacing tokens are ad hoc rem values rather than a named scale.  
9. **FAQ ⇄ methodology duplication** — crawl-friendly but verbose for humans.  
10. **Commodity cards** — dense ISO3 rows; weak “this is illustrative” visual separation from the four answers.  
11. **Uppercase micro-labels** (0.72–0.78rem) — hierarchy cue for sighted users, harder for low-vision / dyslexia; contrast of muted-on-soft needs checking in dark.  
12. **Product boundary risk** — any redesign that adds medians/class would blur into KingIndex; must stay a simple PPP+FX calculator.

## Locked for v2 (from parent / user)

- Hostname: `v2.ppp.tanishqnalloju.com`  
- Same repo; new folder only for design now; later Worker `ppp-calculator-v2`  
- Vanilla + CSS tokens; no React/bundler app  
- Visual + UX/IA polish OK; math and product story unchanged  
- Do **not** touch v1 shipping files or deploy yet
