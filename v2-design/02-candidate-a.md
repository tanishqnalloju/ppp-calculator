# 02 — Candidate A: “Answer stage” (editorial, answer-first)

Structurally distinct from a tool/dashboard split. Whole-shape alternative: the page is a **short editorial calculation**, not a control panel with results bolted on.

## Concept

Lead with the destination lifestyle number. Inputs become a **compact query bar** above a dominant PPP figure. FX is a deliberate secondary comparison (“if you only wired cash”). Cost vs home + PLI sit as a slim evidence row. Commodities become a quiet horizontal “receipt.” Methodology/FAQ merge into one collapsible “About the numbers.”

Voice continuity: Instrument Sans + Newsreader, warm paper / olive dark, green accent — refined, not replaced.

## ASCII wire (mobile → desktop same column, wider stage)

```
┌─────────────────────────────────────────────┐
│ PPP Calculator                    [Theme]   │
│ Same money. Different prices.               │
├─────────────────────────────────────────────┤
│ ┌ QUERY BAR (single frosted panel) ───────┐ │
│ │ Income [ 800,000 INR ▾]  Type [Net ▾]   │ │
│ │ Home [India (IND) ▾]  ⇄  Dest [USA ▾]   │ │
│ │ hint: Annual, in India’s currency (INR) │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│  ₹800,000 net in India → United States      │  ← lead (serif)
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  TO LIVE THE SAME                     │  │
│  │  12,345 USD                           │  │  ← display XL
│  │  Destination currency at local prices │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  If you just convert cash · 9,600 USD       │  ← secondary line
│  (official FX)                              │     not a twin card
│                                             │
│  ┌ evidence ┬─────────────────────────────┐ │
│  │ Cost vs  │ Same lifestyle costs 28%    │ │
│  │ home     │ more (+28% price level)     │ │
│  ├──────────┼─────────────────────────────┤ │
│  │ PLI vs US│ 108  (US = 100)             │ │
│  └──────────┴─────────────────────────────┘ │
│                                             │
│  Local prices — a few basics          →→→   │  ← horizontal scroll
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐               │
│  │Big │ │Rice│ │…   │ │…   │               │
│  └────┘ └────┘ └────┘ └────┘               │
│                                             │
│  ▸ About the numbers (method + FAQ)         │
│  [Copy link]  ·  KingIndex  ·  Source       │
└─────────────────────────────────────────────┘
```

Desktop (≥900px): same single narrative column, but **content width expands to ~56–60rem**; PPP display grows; query bar becomes one horizontal row (income | type | home ⇄ dest). No second app column — still editorial.

## Token direction

- Keep warm neutrals + forest accent; slightly **increase display contrast** (PPP value uses `--text` or deeper accent, not low-contrast green-on-green).
- Introduce spacing scale (`--space-1…16`) and type steps (`--text-xs` … `--text-display`).
- Radii: `--radius-sm` (inputs) / `--radius-md` (panels) / `--radius-pill` (swap chip).
- Motion: 150–250ms ease-out on value crossfade; honor `prefers-reduced-motion`.

## Interaction notes

- **Swap control** between home and dest (preserves income number; reformats currency hint).
- **Copy link** button writes current query string to clipboard + brief “Copied” status (also updates `history.replaceState` as today).
- Income-independent facts: optionally show **PLI vs US** (and cost vs home) even before income — reinforces “prices differ” before salary math. PPP/FX still require income.
- Loading: query bar skeleton + “Loading World Bank data…” in status.
- Combobox: full listbox pattern (`aria-activedescendant`, option ids).
- Type (net/gross): compact segmented control or select with helper text under income, not a full-width twin field.
- Worked example: **removed as separate block**; one sentence under lead when useful, or absorbed into About.

## Module sketch (future public surface — not implementing now)

Conceptual ownership (deep modules, few callers):

- `compute.js` — pure `compute(home, dest, income)`, formatters, reliability  
- `url.js` — read/write params + KingIndex href  
- `pickers.js` — accessible combobox  
- `render.js` — DOM bindings / commodities strip  
- `theme.js` — theme toggle  
- `index.html` + `styles.css` (tokens inlined or `tokens.css`)

## Red-flag self-screen (architect)

- **Shallow module?** Avoid splitting “load / validate / transform / save” into separate UI stages — keep `compute` as one deep pure function (as v1).  
- **Information leakage?** Don’t re-export World Bank field names into URL; keep `income/home/type/dest` only.  
- **Temporal decomposition?** Don’t create LoadView → ValidateView → ResultView; one live render.  
- **Pass-through?** No wrapper Worker beyond ASSETS (same as v1).

## What this candidate optimizes

Clarity of the **one number that matters** (PPP equivalent) and brand continuity. Accepts: less dense “pro tool” chrome; desktop doesn’t get a true two-pane workbench.
