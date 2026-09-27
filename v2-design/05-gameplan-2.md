# Gameplan 2 — PPP Calculator v2 (approve to implement)

**Status:** Design complete · **checkpoint — do not implement until you approve**  
**Hostname (locked):** `v2.ppp.tanishqnalloju.com`  
**Stack (locked):** vanilla HTML/CSS/JS + CSS design tokens  
**Repo:** `tanishqnalloju/ppp-calculator` (design artifacts in `v2-design/` only so far)

---

## What we will build

A **visual + UX/IA polish** of the existing World Bank PPP + FX calculator. Same product story: PPP equivalent, FX wire, cost vs home, PLI vs US = 100, illustrative commodity strip. **Not** Enhanced PPP Index / KingIndex features.

### Chosen design (synthesis)

**Answer stage (Candidate A) as base**, with grafts from the Comparison workbench (Candidate B):

- Dominant **PPP equivalent** display; FX as secondary comparison + optional Δ annotation (not a fifth headline metric)
- Compact query bar with **swap home⇄dest** and **Copy link**
- Soft **two-pane layout ≥960px** (query rail | answer canvas); single column on small screens
- Commodities: horizontal strip on small / compact table on wide
- “About the numbers” folds methodology + FAQ
- Tokens: Instrument Sans + Newsreader continuity; named space/type/radii; light + dark
- A11y fixes: proper combobox pattern, loading state, contrast pass, tabular nums on money

Full rationale: `v2-design/03-synthesis.md`. Tokens draft: `v2-design/04-tokens.css`.

### What stays identical to v1

| Contract | Detail |
|----------|--------|
| Math | `equiv = income/home.ppp * dest.ppp`; `fxLocal = income * dest.fx/home.fx`; costPct & PLI display unchanged |
| Params | `income`, `home`, `type` (`net`\|`gross`), `dest` |
| Type | Label only — tax not modeled |
| Data | Shared `data/countries.json` + `data/commodities.json` — no invented prices |
| Boundary | No medians, scatter, crowns, household size |

---

## File / Worker layout (when approved)

```
ppp-calculator/
  # v1 SHIPPING — do not modify for v2 work
  index.html, app.js, styles.css, public/*, wrangler.jsonc, src/worker.js
  package.json scripts sync-assets / deploy   ← remain v1

  v2/                        # NEW implementation root
    index.html
    tokens.css               # from v2-design/04-tokens.css
    styles.css
    app.js
    js/{compute,url,pickers,render,theme}.js
  wrangler.v2.jsonc          # Worker name: ppp-calculator-v2
  scripts/sync-assets-v2.sh  # copies v2/* + data/* → public-v2/
  public-v2/                 # deploy artifact dir (gitignored or generated)

  v2-design/                 # this design pack (keep as record)
```

Suggested `wrangler.v2.jsonc` shape (create only after approve):

- `name`: `ppp-calculator-v2`
- `assets.directory`: `./public-v2`
- `routes`: `{ pattern: "v2.ppp.tanishqnalloju.com", custom_domain: true }`
- Same ASSETS pass-through worker entry (can share `src/worker.js` or `v2/worker.js` copy)

`package.json` gains **additive** scripts only, e.g. `sync-assets-v2`, `deploy:v2`, `dev:v2` — do not change existing `deploy` / `sync-assets` behavior.

---

## Deploy plan (after implement + verify)

1. Implement under `v2/` only; local preview via `python3 -m http.server` from `public-v2` or `wrangler dev -c wrangler.v2.jsonc`.
2. `npm run sync-assets-v2` then `npm run deploy:v2` → creates/updates Worker **`ppp-calculator-v2`**.
3. Attach custom domain **`v2.ppp.tanishqnalloju.com`** in Cloudflare (Workers → triggers / custom domains). DNS for the zone must already allow Workers routes — do not guess zone IDs here.
4. Confirm v1 still serves https://ppp.tanishqnalloju.com unchanged (Worker `ppp-calculator`).
5. Smoke both hosts; leave v1 as default product until you choose to cut over or cross-link.

**Explicitly out of scope until approved:** creating the Worker, attaching the domain, deploying, editing v1 files.

---

## Verification predicates

### v1 untouched

- `git diff` on `index.html`, `app.js`, `styles.css`, `public/**`, `wrangler.jsonc`, `src/worker.js`, and v1 `package.json` scripts shows **no** v2-driven edits (additive scripts only if package.json must change).
- https://ppp.tanishqnalloju.com still resolves to Worker `ppp-calculator`.

### Sample parity (math / params — not pixel)

For the same query string, v2 numeric outputs must match v1 (formatting locale may improve but rounded money / % / PLI integers agree):

| Sample URL | Checks |
|------------|--------|
| `?income=800000&home=IND&type=net&dest=USA` | **Primary / default pair** — PPP equiv, FX wire, cost vs home %, PLI vs US |
| `?income=120000&home=USA&type=gross&dest=IND` | Swap direction; type label preserved in lead |
| `?income=800000&home=IND&type=net&dest=BGD` | Secondary parity only (not a default); commodities may be partial |
| Unreliable / excluded pair (if any in data) | Warn + hide Infinity/NaN |

Also: URL `replaceState` keeps four params; KingIndex link forwards them; theme toggle works light/dark; keyboard combobox usable; loading state appears before data resolves.

### Design predicates

- PPP display visually dominant over FX
- No KingIndex product features introduced
- Tokens used for color/type/space (no stray one-off palette drift)

---

## Open risks

| Risk | Mitigation |
|------|------------|
| Soft split feels “too app-like” | Fall back to single-column + wider measure only (synthesis Q1) |
| Δ PPP vs FX misread as new index | Wording: “Compared with a cash wire…” under FX; omit if you dislike |
| Shared theme key fights v1 preference | Prefer `ppp-calc-v2-theme` unless you want sync |
| Dual public dirs confuse deploy | Strict script names `*:v2`; README note after ship |
| Commodity table a11y on mobile | Use strip below breakpoint; table only when width allows |
| Domain / DNS lag | Serve only custom domain `v2.ppp.tanishqnalloju.com` (`workers_dev` / `preview_urls` false); wait for DNS rather than advertising workers.dev |
| Accidental v1 file edit | Pre-commit check / review diff against allowlist |

---

## Decisions still needing your review

1. Soft two-pane ≥960px — **yes / single-column only**?  
2. Show PLI (and cost vs home) **before** income is entered?  
3. Keep **Newsreader** on PPP value — or all-sans numbers?  
4. Include **Δ PPP vs FX** annotation?  
5. Theme storage: **shared** with v1 vs **v2-specific** key?  
6. Commodities: strip→table breakpoint — **yes / strip everywhere**?

---

## Approve to implement

Reply with **approve** (and any overrides on the six questions above).  
On approval we will: scaffold `v2/`, port compute verbatim, build UI to this gameplan, verify sample parity, and **stop before** Worker create / domain attach / deploy unless you explicitly order those next.

Until then: design pack only under `v2-design/`; v1 continues to ship as today.
