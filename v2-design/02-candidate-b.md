# 02 — Candidate B: “Comparison workbench” (split stage)

Structurally distinct from Candidate A. Whole-shape alternative: the page is a **two-pane calculator workbench** on desktop — controls owned on the left, live results canvas on the right — collapsing to a stacked tool on mobile.

## Concept

Treat PPP vs FX as a **scorecard** you operate, not an essay you read. Left rail always shows inputs + share/URL + reliability status. Right canvas shows a large comparative layout: PPP hero, FX with explicit delta annotation (“PPP is N% above/below wire”), cost/PLI as KPI chips, commodities as a **comparison table** (good × home × dest), not a card grid. Methodology stays a bottom drawer full-width.

Typography can stay Instrument Sans + Newsreader, but hierarchy leans UI (sans numbers optional for KPIs — flag for review).

## ASCII wire (desktop ≥900px)

```
┌──────────────────┬──────────────────────────────────────┐
│ PPP Calculator   │  RESULTS CANVAS                      │
│ [Theme]          │  ₹800,000 net · India → United States│
│                  │                                      │
│ Annual income    │  ┌─────────────┐  ┌────────────────┐ │
│ [ 800,000     ]  │  │ PPP equiv   │  │ FX / wire      │ │
│ INR · Net ▾      │  │ 12,345 USD  │  │ 9,600 USD      │ │
│                  │  │ live same   │  │ market convert │ │
│ Home             │  └─────────────┘  └────────────────┘ │
│ [India (IND)  ]  │         Δ PPP vs FX: +28%            │
│                  │                                      │
│ Destination      │  [ Cost +28% vs home ] [ PLI 108 ]   │
│ [United States]  │                                      │
│ [⇄ Swap]         │  Local prices                        │
│                  │  Good        Home        Dest        │
│ [Copy link]      │  Big Mac     …           …           │
│ params preview   │  Rice        …           …           │
│ ?income=…        │  …                                   │
│                  │                                      │
│ status / warn    │                                      │
├──────────────────┴──────────────────────────────────────┤
│ ▸ Methodology & sources     ▸ FAQ                       │
│ Footer · KingIndex · Source                             │
└─────────────────────────────────────────────────────────┘
```

Mobile (<900px): left rail becomes **top sticky query sheet**; canvas scrolls below; table becomes stacked rows or horizontal cards (fallback).

## Token direction

- Slightly cooler elevated surfaces for the canvas (`--surface-canvas`) vs rail (`--surface-rail`) to mark tool regions.
- Stronger border-strong and shadow on desktop to separate panes.
- KPI chips use flat fills; table uses hairline rows + tabular nums.
- Type: sans for rail controls; serif reserved for page title and maybe PPP value only (or all-sans workbench — **open review**).

## Interaction notes

- Sticky left rail on desktop (self-contained scroll if needed).
- **PPP vs FX delta** callout: `(equiv / fxLocal - 1) * 100` when both finite — *derived display only*, not a new product metric in the story; still the same two answers. (Call out in synthesis: keep wording as comparison of the two existing answers, not a fifth headline number.)
- Commodities as `<table>` with sticky first column — better scan for pair comparison; empty cells show “—” with `gap-note` footer.
- Explicit params preview (read-only) teaches shareability.
- Keyboard: focus moves rail → canvas landmarks (`aria-label` on regions).
- Loading skeleton mirrors both panes.

## Module sketch

Same deep `compute` / `url` / `pickers` split as A, plus:

- `layout.js` or pure CSS grid areas (`rail` | `canvas` | `footer`) — prefer CSS-only breakpoints over JS layout mode.
- `table-commodities.js` render path distinct from A’s strip.

## Red-flag self-screen

- **Shallow module risk:** “RailController” + “CanvasController” coordinating each other → prefer one `render(state)` owning both regions.  
- **Information leakage:** don’t put `ppp`/`fx`/`pli_us` raw into the URL or visible debug unless behind About. Params stay four keys.  
- **Temporal decomposition:** avoid wizard steps (enter → confirm → results). Always live.  
- **Pass-through:** don’t add a React/ViewModel layer that only forwards DOM events.

## What this candidate optimizes

Desktop density, continuous operation, scanable commodity comparison. Accepts: more “app chrome”; risk of looking like a dashboard / drifting toward Enhanced PPP Index aesthetics if over-decorated; editorial tagline sits awkwardly beside a rail.
