#!/usr/bin/env python3
"""Fetch World Bank WDI PPP/FX indicators → data/countries.json for PPP Calculator.

Simplified from KingIndex fetch_data.py: no PIP median join, no Gini/mean fields.
Indicators: PA.NUS.PRVT.PP (consumption PPP), PA.NUS.FCRF (official FX).
"""

from __future__ import annotations

import json
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "countries.json"

EXCLUSIONS = [
    {"iso3": "TKM", "reason": "Collapsed official FX (junk PLI)"},
    {"iso3": "ZWE", "reason": "Collapsed official FX (junk PLI)"},
    {"iso3": "LBR", "reason": "Collapsed official FX (junk PLI)"},
    {"iso3": "ARG", "reason": "Hyperinflation / FX collapse (PLI far below floor)"},
    {"iso3": "VEN", "reason": "Missing or broken FX"},
    {"iso3": "AFG", "reason": "Conflict / survey reliability"},
    {"iso3": "SYR", "reason": "Conflict"},
    {"iso3": "YEM", "reason": "Conflict"},
    {"iso3": "SSD", "reason": "Conflict"},
    {"iso3": "SOM", "reason": "Conflict / missing reliable series"},
    {"iso3": "ERI", "reason": "Very old / unreliable survey series"},
    {"iso3": "PRK", "reason": "No usable series"},
]

INDICATORS = {
    "ppp_cons": "PA.NUS.PRVT.PP",
    "ppp_gdp": "PA.NUS.PPP",
    "fx": "PA.NUS.FCRF",
}

AGGREGATES = {
    "AFE", "AFW", "ARB", "CEB", "CSS", "EAP", "EAR", "EAS", "ECA", "ECS",
    "EMU", "EUU", "FCS", "HIC", "HPC", "IBD", "IBT", "IDA", "IDB", "IDX",
    "LAC", "LCN", "LDC", "LIC", "LMC", "LMY", "LTE", "MEA", "MIC", "MNA",
    "OED", "OSS", "PRE", "PSS", "PST", "SAS", "SSA", "SSF", "SST", "TEA",
    "TEC", "TLA", "TMN", "TSA", "TSS", "UMC", "WLD",
}

REGION_NAME_BLOCKLIST = {
    "Aggregates", "Euro area", "World", "OECD members", "European Union",
    "North America", "South Asia", "East Asia & Pacific", "Sub-Saharan Africa",
    "Latin America & Caribbean", "Middle East & North Africa",
    "Europe & Central Asia", "Arab World", "High income", "Low income",
    "Lower middle income", "Upper middle income", "Middle income",
    "Least developed countries: UN classification", "Fragile and conflict affected situations",
    "Heavily indebted poor countries (HIPC)", "IDA & IBRD total", "IDA total",
    "IBRD only", "IDA blend", "IDA only", "Early-demographic dividend",
    "Late-demographic dividend", "Pre-demographic dividend", "Post-demographic dividend",
    "Central Europe and the Baltics", "Caribbean small states",
    "Pacific island small states", "Other small states", "Small states",
    "Low & middle income", "Not classified",
}

CURRENCY = {
    "USA": "USD", "CAN": "CAD", "MEX": "MXN", "GTM": "GTQ", "HND": "HNL",
    "SLV": "USD", "NIC": "NIO", "CRI": "CRC", "PAN": "PAB", "CUB": "CUP",
    "DOM": "DOP", "HTI": "HTG", "JAM": "JMD", "TTO": "TTD", "BHS": "BSD",
    "BRB": "BBD", "BLZ": "BZD", "GUY": "GYD", "SUR": "SRD",
    "ARG": "ARS", "BRA": "BRL", "CHL": "CLP", "COL": "COP", "PER": "PEN",
    "URY": "UYU", "PRY": "PYG", "BOL": "BOB", "ECU": "USD", "VEN": "VES",
    "GBR": "GBP", "IRL": "EUR", "FRA": "EUR", "DEU": "EUR", "ITA": "EUR",
    "ESP": "EUR", "PRT": "EUR", "NLD": "EUR", "BEL": "EUR", "LUX": "EUR",
    "AUT": "EUR", "FIN": "EUR", "GRC": "EUR", "CYP": "EUR", "MLT": "EUR",
    "SVN": "EUR", "SVK": "EUR", "EST": "EUR", "LVA": "EUR", "LTU": "EUR",
    "HRV": "EUR", "AND": "EUR", "MCO": "EUR", "SMR": "EUR", "VAT": "EUR",
    "CHE": "CHF", "LIE": "CHF", "NOR": "NOK", "SWE": "SEK", "DNK": "DKK",
    "ISL": "ISK", "POL": "PLN", "CZE": "CZK", "HUN": "HUF", "ROU": "RON",
    "BGR": "BGN", "SRB": "RSD", "BIH": "BAM", "MKD": "MKD", "ALB": "ALL",
    "MNE": "EUR", "XKX": "EUR", "UKR": "UAH", "MDA": "MDL", "BLR": "BYN",
    "RUS": "RUB", "GEO": "GEL", "ARM": "AMD", "AZE": "AZN", "TUR": "TRY",
    "IND": "INR", "PAK": "PKR", "BGD": "BDT", "LKA": "LKR", "NPL": "NPR",
    "BTN": "BTN", "MDV": "MVR", "AFG": "AFN",
    "CHN": "CNY", "HKG": "HKD", "MAC": "MOP", "TWN": "TWD", "MNG": "MNT",
    "JPN": "JPY", "KOR": "KRW", "PRK": "KPW",
    "IDN": "IDR", "MYS": "MYR", "SGP": "SGD", "THA": "THB", "VNM": "VND",
    "PHL": "PHP", "KHM": "KHR", "LAO": "LAK", "MMR": "MMK", "BRN": "BND",
    "TLS": "USD",
    "AUS": "AUD", "NZL": "NZD", "FJI": "FJD", "PNG": "PGK", "WSM": "WST",
    "TON": "TOP", "VUT": "VUV", "SLB": "SBD",
    "SAU": "SAR", "ARE": "AED", "QAT": "QAR", "KWT": "KWD", "BHR": "BHD",
    "OMN": "OMR", "YEM": "YER", "IRQ": "IQD", "IRN": "IRR", "ISR": "ILS",
    "JOR": "JOD", "LBN": "LBP", "SYR": "SYP", "PSE": "ILS",
    "EGY": "EGP", "LBY": "LYD", "TUN": "TND", "DZA": "DZD", "MAR": "MAD",
    "SDN": "SDG", "SSD": "SSP",
    "ZAF": "ZAR", "NGA": "NGN", "GHA": "GHS", "KEN": "KES", "ETH": "ETB",
    "TZA": "TZS", "UGA": "UGX", "RWA": "RWF", "BDI": "BIF", "COD": "CDF",
    "COG": "XAF", "CMR": "XAF", "GAB": "XAF", "GNQ": "XAF", "TCD": "XAF",
    "CAF": "XAF", "AGO": "AOA", "MOZ": "MZN", "ZMB": "ZMW", "ZWE": "ZWL",
    "BWA": "BWP", "NAM": "NAD", "LSO": "LSL", "SWZ": "SZL", "MWI": "MWK",
    "MDG": "MGA", "MUS": "MUR", "SYC": "SCR", "COM": "KMF",
    "SEN": "XOF", "MLI": "XOF", "BFA": "XOF", "NER": "XOF", "TGO": "XOF",
    "BEN": "XOF", "CIV": "XOF", "GIN": "GNF", "GNB": "XOF", "SLE": "SLE",
    "LBR": "LRD", "GMB": "GMD", "CPV": "CVE", "MRT": "MRU", "DJI": "DJF",
    "SOM": "SOS", "ERI": "ERN", "STP": "STN",
    "KAZ": "KZT", "UZB": "UZS", "TKM": "TMT", "TJK": "TJS", "KGZ": "KGS",
}


def fetch_json(url: str, retries: int = 2) -> object:
    ctx = ssl.create_default_context()
    last_err: Exception | None = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "PPP-Calculator/1.0 (data refresh; +https://ppp.tanishqnalloju.com)"},
            )
            with urllib.request.urlopen(req, timeout=90, context=ctx) as resp:
                raw = resp.read().decode("utf-8")
            return json.loads(raw)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as e:
            last_err = e
            if attempt < retries:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Failed after retries: {url}\n{last_err}")


def fetch_indicator(code: str) -> dict[str, dict]:
    url = (
        f"https://api.worldbank.org/v2/country/all/indicator/{code}"
        f"?format=json&per_page=400&mrnev=1"
    )
    data = fetch_json(url)
    if not isinstance(data, list) or len(data) < 2:
        raise RuntimeError(f"Unexpected response for {code}")
    out: dict[str, dict] = {}
    for row in data[1] or []:
        iso3 = (row.get("countryiso3code") or "").strip()
        if not iso3:
            continue
        val = row.get("value")
        if val is None:
            continue
        country = row.get("country") or {}
        out[iso3] = {
            "value": float(val),
            "year": int(row["date"]) if row.get("date") else None,
            "iso2": country.get("id"),
            "name": country.get("value"),
        }
    return out


def fetch_countries_meta() -> dict[str, dict]:
    url = "https://api.worldbank.org/v2/country?format=json&per_page=400"
    data = fetch_json(url)
    if not isinstance(data, list) or len(data) < 2:
        raise RuntimeError("Unexpected country metadata response")
    out: dict[str, dict] = {}
    for row in data[1] or []:
        iso3 = (row.get("id") or "").strip()
        if not iso3 or len(iso3) != 3:
            continue
        region = (row.get("region") or {}).get("value") or ""
        if region == "Aggregates":
            continue
        out[iso3] = {
            "name": row.get("name") or "",
            "iso2": row.get("iso2Code") or "",
            "region": region,
        }
    return out


def is_aggregate(iso3: str, name: str | None, region: str | None) -> bool:
    if iso3 in AGGREGATES:
        return True
    if not iso3 or len(iso3) != 3:
        return True
    if region == "Aggregates":
        return True
    if name and name in REGION_NAME_BLOCKLIST:
        return True
    return False


def build() -> dict:
    print("Fetching country metadata…")
    meta = fetch_countries_meta()
    print(f"  metadata countries: {len(meta)}")

    ind_data: dict[str, dict[str, dict]] = {}
    for key, code in INDICATORS.items():
        print(f"Fetching {key} ({code})…")
        ind_data[key] = fetch_indicator(code)
        print(f"  rows: {len(ind_data[key])}")

    candidates = set(meta.keys())
    for d in ind_data.values():
        candidates |= set(d.keys())

    # Normalize PLI to US = 1.0
    us_ppp = (ind_data["ppp_cons"].get("USA") or ind_data["ppp_gdp"].get("USA") or {}).get("value")
    us_fx = (ind_data["fx"].get("USA") or {}).get("value")
    if not us_ppp or not us_fx or us_fx <= 0:
        raise RuntimeError("USA PPP/FX missing — cannot normalize PLI")
    us_ratio = us_ppp / us_fx

    excl_map = {e["iso3"]: e["reason"] for e in EXCLUSIONS}
    countries = []
    for iso3 in sorted(candidates):
        m = meta.get(iso3, {})
        name = m.get("name") or (ind_data["fx"].get(iso3) or {}).get("name") or iso3
        region = m.get("region") or ""
        if is_aggregate(iso3, name, region):
            continue

        ppp_cons = ind_data["ppp_cons"].get(iso3)
        ppp_gdp = ind_data["ppp_gdp"].get(iso3)
        fx_row = ind_data["fx"].get(iso3)

        if ppp_cons and ppp_cons["value"] > 0:
            ppp = ppp_cons["value"]
            ppp_year = ppp_cons["year"]
            ppp_source = "cons"
        elif ppp_gdp and ppp_gdp["value"] > 0:
            ppp = ppp_gdp["value"]
            ppp_year = ppp_gdp["year"]
            ppp_source = "gdp"
        else:
            continue

        if not fx_row or not fx_row["value"] or fx_row["value"] <= 0:
            continue
        fx = fx_row["value"]

        raw_ratio = ppp / fx
        pli_us = raw_ratio / us_ratio  # relative to USA = 1.0
        iso2 = m.get("iso2") or (fx_row.get("iso2") if fx_row else None) or ""

        reasons = []
        if iso3 in excl_map:
            reasons.append(excl_map[iso3])
        if not (pli_us >= 0.05 and ppp > 0 and fx > 0):
            reasons.append("Unreliable PLI / PPP / FX")

        countries.append({
            "iso3": iso3,
            "iso2": iso2,
            "name": name,
            "region": region or "Unknown",
            "currency": CURRENCY.get(iso3, "LCU"),
            "ppp": round(ppp, 6) if ppp < 100 else round(ppp, 4),
            "ppp_year": ppp_year,
            "ppp_source": ppp_source,
            "fx": round(fx, 6) if fx < 100 else round(fx, 4),
            "fx_year": fx_row["year"],
            "pli_us": round(pli_us, 6),
            "years": {"ppp": ppp_year, "fx": fx_row["year"]},
            "excluded": bool(reasons),
            "exclude_reason": "; ".join(reasons) if reasons else None,
        })

    if len(countries) < 50:
        raise RuntimeError(f"Too few countries ({len(countries)}); refusing to write")

    return {
        "meta": {
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": "World Bank WDI",
            "notes": (
                "Price levels use private-consumption PPP (PA.NUS.PRVT.PP) / official FX "
                "(PA.NUS.FCRF), normalized so USA pli_us = 1. No PIP medians."
            ),
            "ppp_base_year": 2021,
            "exclusions": EXCLUSIONS,
            "indicators": {
                "ppp": "PA.NUS.PRVT.PP",
                "fx": "PA.NUS.FCRF",
                "pli_us": "ppp/fx relative to USA",
            },
        },
        "countries": countries,
    }


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = build()
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    by = {c["iso3"]: c for c in payload["countries"]}
    print(f"\nWrote {OUT} ({len(payload['countries'])} countries)")
    for code in ("USA", "IND", "BGD", "GBR", "DEU", "JPN"):
        c = by.get(code)
        if c:
            print(f"  {code}: pli_us={c['pli_us']:.4f}  ppp={c['ppp']}  fx={c['fx']}  excl={c['excluded']}")
        else:
            print(f"  {code}: MISSING")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        raise SystemExit(1)
