#!/usr/bin/env python3
"""Check fares for the two required Airlink itineraries across several sources.

    python3 check_fares.py                 # everything
    python3 check_fares.py --only kiwi     # one source
    python3 check_fares.py --headful       # watch the browser

Writes results.json (raw) and results.md (comparison table). Never buys
anything and never enters personal or payment details: it stops at the
results page.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import sys
import traceback

import browser
import config
import fx
import report
from sources import airlink, amadeus, google_flights, kiwi, skyscanner

ALL_SOURCES = ["kiwi", "google_flights", "airlink", "skyscanner", "amadeus"]


def run(only: list[str] | None, headless: bool, currencies: list[str]) -> dict:
    wanted = [s for s in ALL_SOURCES if not only or s in only]
    targets = config.TARGETS + config.ALTERNATIVES
    results = []

    print("Fetching live FX rates...", flush=True)
    try:
        rates = fx.fetch_rates("EUR")
        print(f"  {rates.provider}, ECB reference rates as of {rates.as_of}", flush=True)
    except Exception as e:
        print(f"  FX fetch failed: {e}", file=sys.stderr)
        rates = None

    # --- API sources (no browser needed) ---------------------------------
    if "amadeus" in wanted:
        for t in targets:
            for cur in currencies:
                r = amadeus.fetch(t, cur)
                print(f"[amadeus/{cur}] {t['id']}: {r.status} - {r.detail[:110]}", flush=True)
                results.append(r)
                if r.status == "skipped":
                    break        # no key: one line is enough

    # --- browser sources --------------------------------------------------
    browser_sources = [s for s in wanted if s in ("kiwi", "google_flights", "airlink", "skyscanner")]
    if browser_sources:
        with browser.browser(headless=headless) as br:
            for t in targets:
                if "kiwi" in browser_sources:
                    for cur in currencies:
                        results.append(_guard(kiwi.fetch, br, t, cur, src="kiwi", tid=t["id"]))
                if "google_flights" in browser_sources:
                    for cur in currencies:
                        results.append(_guard(google_flights.fetch, br, t, cur,
                                              src="google_flights", tid=t["id"]))
                if "skyscanner" in browser_sources:
                    results.append(_guard(skyscanner.fetch, br, t, "CZK",
                                          src="skyscanner", tid=t["id"]))
                if "airlink" in browser_sources:
                    for pos in config.AIRLINK_POINTS_OF_SALE:
                        results.append(_guard(airlink.fetch, br, t, pos,
                                              src="airlink", tid=t["id"], pos=pos["pos"]))

    payload = {
        "generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
        "passengers": config.PASSENGERS,
        "cabin_class": config.CABIN_CLASS,
        "checked_bags_wanted": config.CHECKED_BAGS,
        "cabin_bags_wanted": config.CABIN_BAGS,
        "report_currency": config.REPORT_CURRENCY,
        "fx_margin_assumed": config.FX_MARGIN_ASSUMED,
        "fx_margin_range": [config.FX_MARGIN_LOW, config.FX_MARGIN_HIGH],
        "fx": rates.to_dict() if rates else None,
        "targets": config.TARGETS,
        "alternatives": config.ALTERNATIVES,
        "results": [r.to_dict() for r in results],
    }
    return payload


def _guard(fn, *args, src: str, tid: str, pos: str = "", **kw):
    from model import SourceResult
    label = f"[{src}{'/' + pos if pos else ''}]"
    try:
        r = fn(*args, **kw)
    except Exception as e:
        traceback.print_exc()
        r = SourceResult(source=src, point_of_sale=pos or "-", target_id=tid,
                         status="error", detail=f"{type(e).__name__}: {e}")
    print(f"{label} {tid}: {r.status} - {r.detail[:130]}", flush=True)
    return r


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", nargs="*", choices=ALL_SOURCES,
                    help="restrict to these sources")
    ap.add_argument("--headful", action="store_true",
                    help="show the browser (useful when a site is blocking headless)")
    ap.add_argument("--currencies", nargs="*", default=["CZK", "EUR"],
                    help="quote currencies to request (default: CZK EUR)")
    ap.add_argument("--json", default="results.json")
    ap.add_argument("--md", default="results.md")
    args = ap.parse_args()

    payload = run(args.only, headless=not args.headful, currencies=args.currencies)

    with open(args.json, "w") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f"\nwrote {args.json}")

    md = report.build(payload)
    with open(args.md, "w") as f:
        f.write(md)
    print(f"wrote {args.md}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
