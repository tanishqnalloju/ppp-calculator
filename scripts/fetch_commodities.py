#!/usr/bin/env python3
"""Fetch illustrative local commodity prices → data/commodities.json.

Sources (in order of reliability for automation):
  1. The Economist Big Mac Index (GitHub CSV)
  2. GlobalPetrolPrices.com gasoline pages (local currency / liter)
  3. Numbeo country pages (optional; often rate-limited) — rice, bread,
     milk, eggs, cappuccino, broadband

Never invents prices. Missing items stay absent. Prefer honest partial coverage.
"""

from __future__ import annotations

import csv
import html as html_lib
import io
import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "commodities.json"
COUNTRIES_PATH = ROOT / "data" / "countries.json"

BIG_MAC_URL = (
    "https://raw.githubusercontent.com/TheEconomist/big-mac-data/"
    "master/output-data/big-mac-full-index.csv"
)

EURO_BM_ISOS = ["DEU", "FRA", "ITA", "ESP", "NLD", "AUT", "BEL", "IRL", "FIN", "PRT"]

GPP_SLUGS = {
    "IND": "India", "USA": "USA", "BGD": "Bangladesh", "GBR": "United-Kingdom",
    "DEU": "Germany", "JPN": "Japan", "BRA": "Brazil", "MEX": "Mexico",
    "NGA": "Nigeria", "PHL": "Philippines", "CHN": "China", "IDN": "Indonesia",
    "PAK": "Pakistan", "VNM": "Vietnam", "THA": "Thailand", "KOR": "South-Korea",
    "AUS": "Australia", "CAN": "Canada", "FRA": "France", "ITA": "Italy",
    "ESP": "Spain", "NLD": "Netherlands", "ZAF": "South-Africa", "EGY": "Egypt",
    "TUR": "Turkey", "ARG": "Argentina", "COL": "Colombia", "PER": "Peru",
    "CHL": "Chile", "POL": "Poland", "SWE": "Sweden", "CHE": "Switzerland",
    "SGP": "Singapore", "MYS": "Malaysia", "SAU": "Saudi-Arabia",
    "KEN": "Kenya", "GHA": "Ghana",
}

NUMBEO_TARGETS = [
    ("IND", "India"), ("USA", "United States"), ("BGD", "Bangladesh"),
    ("GBR", "United Kingdom"), ("DEU", "Germany"), ("JPN", "Japan"),
    ("BRA", "Brazil"), ("MEX", "Mexico"), ("NGA", "Nigeria"),
    ("PHL", "Philippines"), ("CHN", "China"), ("IDN", "Indonesia"),
    ("PAK", "Pakistan"), ("VNM", "Vietnam"), ("THA", "Thailand"),
    ("KOR", "South Korea"), ("AUS", "Australia"), ("CAN", "Canada"),
    ("FRA", "France"), ("ITA", "Italy"), ("ESP", "Spain"),
    ("NLD", "Netherlands"), ("ZAF", "South Africa"), ("EGY", "Egypt"),
    ("TUR", "Turkey"), ("ARG", "Argentina"), ("COL", "Colombia"),
    ("PER", "Peru"), ("CHL", "Chile"), ("POL", "Poland"),
    ("SWE", "Sweden"), ("CHE", "Switzerland"), ("SGP", "Singapore"),
    ("MYS", "Malaysia"), ("ARE", "United Arab Emirates"),
    ("SAU", "Saudi Arabia"), ("KEN", "Kenya"), ("GHA", "Ghana"),
]

LB_TO_KG = 2.2046226218
ITEM_MAP = [
    ("milk", "Milk (Regular, 1 Liter)", False),
    ("bread", "Fresh White Bread", False),
    ("rice", "White Rice", True),
    ("eggs", "Eggs (12, Large Size)", False),
    ("cappuccino", "Cappuccino (Regular Size)", False),
    ("broadband", "Broadband Internet (Unlimited Data", False),
]

ITEMS = [
    {"id": "big_mac", "name": "Big Mac", "unit": "1 sandwich", "category": "food"},
    {"id": "rice", "name": "White rice", "unit": "1 kg", "category": "food"},
    {"id": "bread", "name": "White bread", "unit": "1 loaf", "category": "food"},
    {"id": "milk", "name": "Milk", "unit": "1 L", "category": "food"},
    {"id": "eggs", "name": "Eggs", "unit": "1 dozen", "category": "food"},
    {"id": "petrol", "name": "Gasoline", "unit": "1 L", "category": "transport"},
    {"id": "cappuccino", "name": "Cappuccino", "unit": "1 cup", "category": "food"},
    {"id": "broadband", "name": "Broadband internet", "unit": "1 month (60 Mbps+)", "category": "comms"},
]


def fetch_bytes(url: str, retries: int = 1, timeout: int = 60) -> bytes:
    ctx = ssl.create_default_context()
    last_err: Exception | None = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": (
                        "PPP-Calculator/1.0 (illustrative commodity refresh; "
                        "+https://ppp.tanishqnalloju.com)"
                    ),
                    "Accept": "text/html,application/xhtml+xml,text/csv,*/*",
                },
            )
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
                return resp.read()
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
            last_err = e
            if isinstance(e, urllib.error.HTTPError) and e.code == 429:
                raise  # don't retry rate limits
            if attempt < retries:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Failed: {url}\n{last_err}")


def load_currency_map() -> dict[str, str]:
    if not COUNTRIES_PATH.exists():
        return {}
    data = json.loads(COUNTRIES_PATH.read_text(encoding="utf-8"))
    return {c["iso3"]: c.get("currency") or "LCU" for c in data.get("countries", [])}


def fetch_big_mac() -> tuple[dict[str, dict], str]:
    raw = fetch_bytes(BIG_MAC_URL).decode("utf-8", errors="replace")
    rows = list(csv.DictReader(io.StringIO(raw)))
    dates = sorted({r["date"] for r in rows if r.get("date")})
    latest = dates[-1]
    out: dict[str, dict] = {}
    euz = None
    for r in rows:
        if r["date"] != latest:
            continue
        iso = r["iso_a3"]
        try:
            local = float(r["local_price"])
            usd = float(r["dollar_price"]) if r.get("dollar_price") else None
        except (TypeError, ValueError):
            continue
        cur = r.get("currency_code") or "LCU"
        entry = {
            "local": round(local, 4) if local < 100 else round(local, 2),
            "currency": cur,
            "usd": round(usd, 4) if usd is not None else None,
        }
        if iso == "EUZ":
            euz = {**entry, "note": "Euro-area average"}
            continue
        out[iso] = entry
    if euz:
        for iso in EURO_BM_ISOS:
            out.setdefault(iso, dict(euz))
    return out, latest[:7]


def fetch_petrol(currency: dict[str, str]) -> tuple[dict[str, dict], str | None]:
    out: dict[str, dict] = {}
    as_of = None
    for iso, slug in GPP_SLUGS.items():
        url = f"https://www.globalpetrolprices.com/{slug}/gasoline_prices/"
        try:
            html = fetch_bytes(url, retries=1, timeout=40).decode("utf-8", errors="replace")
        except Exception as e:
            print(f"  petrol FAIL {iso}: {e}")
            time.sleep(0.5)
            continue
        tm = re.search(r"gasoline prices,\s*([0-9]{1,2}-[A-Za-z]{3}-[0-9]{4})", html, re.I)
        if tm and not as_of:
            # normalize e.g. 21-Sep-2026 → 2026-09
            try:
                as_of = datetime.strptime(tm.group(1), "%d-%b-%Y").strftime("%Y-%m")
            except ValueError:
                as_of = tm.group(1)
        m_usd = re.search(r"USD\s*([0-9]+(?:\.[0-9]+)?)\s*per liter", html, re.I)
        usd = float(m_usd.group(1)) if m_usd else None
        prices = re.findall(r"([0-9]+(?:\.[0-9]+)?)\s*per liter", html, re.I)
        if not prices:
            print(f"  petrol no price {iso}")
            time.sleep(0.5)
            continue
        local = float(prices[0])
        out[iso] = {
            "local": local,
            "currency": currency.get(iso, "LCU"),
            "usd": usd,
        }
        print(f"  petrol {iso}: {local}")
        time.sleep(0.65)
    return out, as_of


def parse_numbeo_price(raw: str) -> float | None:
    text = html_lib.unescape(raw)
    text = re.sub(r"<[^>]+>", "", text).replace("\xa0", " ").replace(",", "").strip()
    m = re.search(r"([\d]+(?:\.\d+)?)", text)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def fetch_numbeo_country(country_name: str) -> dict[str, float]:
    url = (
        "https://www.numbeo.com/cost-of-living/country_result.jsp?country="
        + urllib.parse.quote(country_name)
    )
    html = fetch_bytes(url, retries=0, timeout=45).decode("utf-8", errors="replace")
    rows = re.findall(
        r'<tr[^>]*>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*class="priceValue[^"]*"[^>]*>(.*?)</td>',
        html,
        re.S | re.I,
    )
    by_label: dict[str, float] = {}
    for name_html, price_html in rows:
        name = re.sub(r"<[^>]+>", "", name_html)
        name = html_lib.unescape(name).strip()
        name = re.sub(r"\s+Edit\s*$", "", name).strip()
        val = parse_numbeo_price(price_html)
        if val is not None and name:
            by_label[name] = val
    found: dict[str, float] = {}
    for our_id, substr, lb_to_kg in ITEM_MAP:
        for label, val in by_label.items():
            if substr.lower() in label.lower():
                if lb_to_kg:
                    val = val * LB_TO_KG
                found[our_id] = round(val, 4) if val < 100 else round(val, 2)
                break
    return found


def build() -> dict:
    currency = load_currency_map()
    gaps: list[str] = []
    prices: dict[str, dict] = {}

    print("Fetching Big Mac Index…")
    bm, bm_as_of = fetch_big_mac()
    print(f"  Big Mac countries: {len(bm)}  as_of={bm_as_of}")
    for iso, row in bm.items():
        prices.setdefault(iso, {})["big_mac"] = {
            "local": row["local"],
            "currency": row.get("currency") or currency.get(iso, "LCU"),
            "usd": row.get("usd"),
            **({"note": row["note"]} if row.get("note") else {}),
        }

    print("Fetching GlobalPetrolPrices…")
    petrol, petrol_as_of = fetch_petrol(currency)
    print(f"  Petrol countries: {len(petrol)}  as_of={petrol_as_of}")
    for iso, row in petrol.items():
        prices.setdefault(iso, {})["petrol"] = row

    print(f"Fetching Numbeo (optional, {len(NUMBEO_TARGETS)} targets)…")
    numbeo_ok = 0
    rate_limited = False
    for iso, name in NUMBEO_TARGETS:
        if rate_limited:
            gaps.append(f"Numbeo skipped {iso} after rate limit")
            continue
        try:
            found = fetch_numbeo_country(name)
            time.sleep(1.0)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                rate_limited = True
                gaps.append(
                    f"Numbeo HTTP 429 rate limit starting at {iso}; remaining countries skipped."
                )
                print(f"  RATE LIMITED at {iso}")
                continue
            gaps.append(f"Numbeo fail {iso}: HTTP {e.code}")
            print(f"  FAIL {iso}: HTTP {e.code}")
            continue
        except Exception as e:
            gaps.append(f"Numbeo fail {iso}: {e}")
            print(f"  FAIL {iso}: {e}")
            continue
        if not found:
            gaps.append(f"Numbeo empty {iso}")
            continue
        bucket = prices.setdefault(iso, {})
        cur = currency.get(iso, "LCU")
        for item_id, val in found.items():
            bucket[item_id] = {"local": val, "currency": cur, "usd": None}
        numbeo_ok += 1
        print(f"  numbeo {iso}: {sorted(found.keys())}")

    gaps.append(
        "Mobile prepaid 1GB not consistently published on Numbeo country pages — omitted."
    )

    as_of = bm_as_of or petrol_as_of or datetime.now(timezone.utc).strftime("%Y-%m")
    return {
        "meta": {
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "as_of": as_of,
            "as_of_detail": {
                "big_mac": bm_as_of,
                "petrol": petrol_as_of,
                "numbeo_countries": numbeo_ok,
            },
            "sources": [
                {
                    "name": "The Economist Big Mac Index",
                    "url": "https://github.com/TheEconomist/big-mac-data",
                    "csv": BIG_MAC_URL,
                },
                {
                    "name": "GlobalPetrolPrices.com",
                    "url": "https://www.globalpetrolprices.com/",
                    "notes": "Gasoline local price per liter.",
                },
                {
                    "name": "Numbeo Cost of Living (country averages)",
                    "url": "https://www.numbeo.com/cost-of-living/",
                    "notes": "Crowdsourced; rice converted lb→kg. Often rate-limited.",
                },
            ],
            "notes": (
                "Illustrative local prices; not a full CPI basket. "
                "Prefer honest partial coverage over invented numbers. "
                f"Big Mac {len(bm)} countries; petrol {len(petrol)}; "
                f"Numbeo groceries {numbeo_ok}."
            ),
            "gaps": gaps,
            "coverage": {
                "countries_with_any_price": len(prices),
                "big_mac_countries": sum(1 for v in prices.values() if "big_mac" in v),
                "petrol_countries": sum(1 for v in prices.values() if "petrol" in v),
                "grocery_countries": sum(
                    1 for v in prices.values() if "milk" in v or "rice" in v
                ),
            },
        },
        "items": ITEMS,
        "prices": {k: prices[k] for k in sorted(prices.keys())},
    }


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    # Preserve IND groceries from existing file if Numbeo is rate-limited this run
    prior_ind = None
    if OUT.exists():
        try:
            prior = json.loads(OUT.read_text(encoding="utf-8"))
            prior_ind = (prior.get("prices") or {}).get("IND")
        except Exception:
            prior_ind = None

    payload = build()

    # If this run got no Numbeo groceries but we have prior IND grocery keys, merge them
    ind = payload["prices"].setdefault("IND", {})
    grocery_keys = {"milk", "bread", "rice", "eggs", "cappuccino", "broadband"}
    if prior_ind and not grocery_keys.intersection(ind.keys()):
        for k in grocery_keys:
            if k in prior_ind:
                ind[k] = prior_ind[k]
        payload["meta"]["gaps"].append(
            "Merged prior IND grocery prices from previous successful Numbeo fetch "
            "(live Numbeo unavailable this run)."
        )
        payload["meta"]["coverage"]["grocery_countries"] = sum(
            1 for v in payload["prices"].values() if "milk" in v or "rice" in v
        )

    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nWrote {OUT}")
    print(json.dumps(payload["meta"]["coverage"], indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        raise SystemExit(1)
