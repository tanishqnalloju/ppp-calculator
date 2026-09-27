# 03 — Synthesis (chosen shape for v2)

Checkpoint artifact for human review. No implementation yet.

## Problem

v1 is a correct, restrained World Bank PPP+FX calculator with weak answer hierarchy on small screens, underused desktop width, incomplete combobox a11y, no loading/share affordances, and ad hoc spacing tokens. Redesign must polish visual + UX/IA **without** changing math, query params, or product story — and without becoming KingIndex or an “Enhanced PPP Index.”

Constraints from grounding: vanilla HTML/CSS/JS; same repo; future Worker `ppp-calculator-v2` at `v2.ppp.tanishqnalloju.com`; leave shipping v1 files untouched; Instrument Sans + Newsreader preferred.

## Usage (caller’s view)

A visitor opens `https://v2.ppp.tanishqnalloju.com/?income=800000&home=IND&type=net&dest=USA`, sees a compact query bar, a dominant **PPP equivalent**, a quieter FX comparison, cost/PLI evidence, and an illustrative price strip. Changing any control updates numbers and the URL. Copy link shares the same four params. KingIndex link still forwards them. Power users read About for formulas; nobody is asked for tax details that aren’t modeled.

Developer adding a country field later still touches `data/countries.json` + pure `compute` — not the layout shell.

## Shape (synthesized pick)

**Base: Candidate A (Answer stage).**  
**Graft from B:** desktop soft two-pane at ≥960px (query rail | answer canvas), swap control, copy-link, PPP↔FX delta as *annotation under the two answers* (not a fifth headline), commodities as a responsive pattern (strip on small / compact table on wide).

### Why A as base

- Matches brand voice (“Same money. Different prices.”) and v1 editorial craft.
- Puts the product contract’s primary answer in the visual center of gravity.
- Smaller public surface: one narrative flow, CSS grid enhancement for wide screens — not a permanent app shell.

### What we take from B

| Graft | Why |
|-------|-----|
| Soft split ≥960px | Fixes desktop underuse without dashboard chrome |
| Swap home⇄dest | High-value IA missing in v1 |
| Copy link + optional params hint | Makes shareability discoverable |
| Δ PPP vs FX annotation | Clarifies relationship of the two existing answers |
| Table commodities on wide | Better pair scan than equal cards |

### What we reject

- Full sticky workbench chrome / params debug console (B-heavy) — leaks tool aesthetics into the product story.  
- Removing Newsreader or going all-sans KPI dashboard — breaks continuity unless human overrides.  
- Separate worked-example block — redundant; fold into lead subline.  
- Merging FAQ away entirely — keep crawlable FAQ content inside “About the numbers” (one disclosure cluster, multiple subsections).  
- Any median / class / crown features.

### Layout wire (chosen)

```
Mobile                          Desktop ≥960px
┌─────────────────────┐        ┌──────────┬───────────────────────┐
│ Header + theme      │        │ Header spanning both             │
│ Tagline             │        ├──────────┼───────────────────────┤
│ Query bar           │        │ Query    │ Lead                  │
│ Lead                │        │ rail     │ PPP display (XL)      │
│ PPP (XL)            │        │ income   │ FX secondary + Δ note │
│ FX secondary + Δ    │        │ type     │ Evidence chips        │
│ Evidence chips      │        │ home⇄dest│ Commodities table     │
│ Commodities strip   │        │ copy link│                       │
│ About (details)     │        │ status   │                       │
│ Footer              │        ├──────────┴───────────────────────┤
└─────────────────────┘        │ About + Footer                   │
                               └──────────────────────────────────┘
```

### Interface depth

Public surface stays small: HTML landmarks + a few JS modules. Complexity hidden inside `compute` (reliability, formatting locales) and `pickers` (a11y). Callers (init/render) do not orchestrate multi-step pipelines.

## Red-flags screened

| Flag | Status |
|------|--------|
| Shallow module | Pass — keep deep `compute(home,dest,income)`; one `render(state)` |
| Information leakage | Pass — URL only `income/home/type/dest`; WB field names stay in data/About |
| Temporal decomposition | Pass — live recalculation, no wizard |
| Pass-through methods | Pass — Worker remains ASSETS proxy; no fake service layer |

## Typography decision

**Keep Instrument Sans + Newsreader** unless human review prefers all-sans for the workbench graft. Serif reserved for: title, tagline, lead, PPP display value. Sans for controls, chips, table, FX secondary. Call-out for review if the soft split makes serif PPP feel mismatched.

## What stays identical to v1 (math / product / params)

- Formulas for PPP equiv, FX wire, costPct, PLI display  
- Reliability / exclusion rules  
- Params: `income`, `home`, `type` (`net`|`gross`), `dest`  
- Type is label only (tax not modeled)  
- Commodity honesty (null gaps, dated meta, not CPI)  
- KingIndex is a separate product link, not merged  
- Data files remain World Bank / Big Mac / Numbeo pipeline outputs — **no invented numbers**

## Public surface (future `v2/` — do not create shipping code yet)

Proposed tree when implementation is approved:

```
v2/
  index.html
  styles.css          # imports or includes tokens
  tokens.css          # from 04-tokens.css
  app.js              # thin init
  js/
    compute.js
    format.js         # or fold into compute
    url.js
    pickers.js
    render.js
    theme.js
  # data: reuse ../data via sync step (do not fork numbers)
wrangler.v2.jsonc     # name: ppp-calculator-v2, route v2.ppp…
scripts/sync-assets-v2.sh
```

v1 root `index.html` / `app.js` / `styles.css` / `public/*` / `wrangler.jsonc` **untouched**.

## Tradeoffs accepted

- We accept a CSS breakpoint split (two layout modes) in exchange for desktop usefulness without a JS layout framework.  
- We accept demoting/folding the worked example in exchange for less redundancy.  
- We accept a Copy-link control (extra chrome) in exchange for discoverable sharing.  
- We accept Δ annotation copy carefully worded so it is not mistaken for a new index.  
- We accept slightly wider max measure on desktop in exchange for display typography room.

## Alternatives considered

1. **Pure A (no split)** — simpler CSS; loses desktop comparison stage → rejected as primary for leaving the #1 layout pain unaddressed.  
2. **Pure B workbench** — strong operator UX; risks dashboard feel and brand drift → rejected as base.  
3. **React/Vite app** — locked out by stack decision.  
4. **Path routes / multi-page** — unnecessary; params already share state.

## Open questions for human review

1. Soft split at 960px — keep, or stay single-column with only wider measure?  
2. Show PLI (and cost vs home) before income is entered?  
3. Keep Newsreader for PPP value, or all-sans numbers?  
4. Commodities: strip-only everywhere vs strip→table breakpoint?  
5. Theme storage key: reuse `ppp-calc-theme` (share with v1) or `ppp-calc-v2-theme`?  
6. Should Δ PPP vs FX appear at all, or stay implied by the two numbers?

## Next implementation step (after approve)

Scaffold `v2/` with `tokens.css` + static HTML shell matching this wire (no Worker/domain yet), port pure `compute`/`format` from v1 verbatim, then layer pickers/render — verify sample URL parity against v1 before any deploy.
