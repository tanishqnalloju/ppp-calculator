# PPP Calculator

**Same money. Different prices.**

A simple, curated purchasing-power parity (PPP) salary calculator.
Convert annual income between countries using World Bank consumption PPP and official FX.

- **Live:** https://ppp.tanishqnalloju.com  
- **Repo:** https://github.com/tanishqnalloju/ppp-calculator  
- **Related (local class / × median):** [KingIndex](https://kingindex.tanishqnalloju.com) — separate product.

This is **not** KingIndex. No × median, scatter, bands, crowns, or household size in v1.

## What it shows

One screen, four answers plus a quiet commodity strip:

1. **PPP equivalent** in destination currency (“to live the same”)
2. **FX / wire amount** (“if you just convert cash”)
3. **Cost vs home** — same lifestyle costs N% more/less
4. **Price level vs US** (US = 100)
5. **Commodity strip** — 8 illustrative goods (home vs dest), dated

URL params (KingIndex-compatible): `income`, `home`, `type` (`net`|`gross`), `dest`.  
Defaults: `home=IND`, `dest=USA`. No path routes.

Example: `/?income=800000&home=IND&type=net&dest=BGD`

## Math

From World Bank WDI fields in `data/countries.json`:

| Field | Source |
|-------|--------|
| `ppp` | `PA.NUS.PRVT.PP` (private consumption PPP) |
| `fx` | `PA.NUS.FCRF` (official exchange rate) |
| `pli_us` | `ppp / fx` relative to USA |

```
your_ppp_income = incomeLocal / home.ppp
equiv (PPP)     = your_ppp_income * dest.ppp
fxLocal         = incomeLocal * (dest.fx / home.fx)
costPct         = (dest.pli_us / home.pli_us - 1) * 100
PLI display     = round(dest.pli_us * 100)   # US = 100
```

Unreliable rows (`!finite(pli_us)` / `pli_us < 0.05` / missing ppp|fx) are skipped or warned. Never Infinity/NaN.

`type` is a **label only** — taxes are not modeled.

## Data refresh

```bash
# Country PPP / FX (World Bank WDI) — no PIP medians
python3 scripts/fetch_wdi.py

# Commodity sample (Big Mac + Global Petrol Prices + optional Numbeo)
python3 scripts/fetch_commodities.py
```

Commodities are **illustrative**, not a CPI basket. Prefer honest partial coverage; never invent prices. Gaps stay `null` and are listed in `meta.gaps`.

## Local preview

```bash
# Simple static server (required — fetch() needs HTTP)
python3 -m http.server 8765
# open http://127.0.0.1:8765/?income=800000&home=IND&type=net&dest=BGD
```

Or with Wrangler:

```bash
npm install
npm run dev
```

## Deploy (Cloudflare Workers + assets)

```bash
npm install
npm run deploy   # sync-assets + wrangler deploy
```

Worker name: `ppp-calculator`. Assets from `./public`.

### Custom domain

Attach `ppp.tanishqnalloju.com` in the Cloudflare dashboard (Workers → ppp-calculator → Triggers / Custom Domains). DNS should point the hostname at the Workers route for this account. Do not guess zone IDs from this README.

```bash
npx wrangler whoami   # confirm auth
npm run deploy
```

## Stack

Tiny static HTML / CSS / JS. No React, no bundler app framework. Wrangler is deploy-only.

Typography: [Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans) + [Newsreader](https://fonts.google.com/specimen/Newsreader).

## License

MIT
