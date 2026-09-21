"""Amadeus Self-Service Flight Offers Search (optional, API key).

This is the one source here with a free key you can actually get yourself:

  1. Register at https://developers.amadeus.com  (free, no card for test)
  2. Create an app -> you get an API Key and API Secret
  3. export AMADEUS_CLIENT_ID=...    AMADEUS_CLIENT_SECRET=...

Point of sale matters, so the currency is passed explicitly and the same
search is repeated per currency.

Caveat worth knowing before you trust a number from here: the free *test*
environment serves a cached, partial subset of the GDS and frequently has no
data at all for African regional routes like CPT-WVB or WDH-VFA. Moving the
same key to the production endpoint (free tier, card on file, no charge under
the monthly quota) is what gives live fares. Set AMADEUS_ENV=production once
you have done that.
"""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request

import config
from model import Offer, Segment, SourceResult, matches_target

SOURCE = "amadeus"

HOSTS = {
    "test": "https://test.api.amadeus.com",
    "production": "https://api.amadeus.com",
}

CABIN_BAG_HINT = ("Amadeus returns checked-bag allowance reliably; cabin-bag "
                  "dimensions are carrier data and often absent. Confirm against "
                  "Airlink's own allowance.")


def configured() -> bool:
    return bool(os.environ.get("AMADEUS_CLIENT_ID") and os.environ.get("AMADEUS_CLIENT_SECRET"))


def _host() -> str:
    return HOSTS.get(os.environ.get("AMADEUS_ENV", "test"), HOSTS["test"])


def _token() -> str:
    data = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": os.environ["AMADEUS_CLIENT_ID"],
        "client_secret": os.environ["AMADEUS_CLIENT_SECRET"],
    }).encode()
    req = urllib.request.Request(_host() + "/v1/security/oauth2/token", data=data,
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["access_token"]


def _search(token: str, target: dict, currency: str) -> dict:
    q = urllib.parse.urlencode({
        "originLocationCode": target["origin"],
        "destinationLocationCode": target["destination"],
        "departureDate": target["date"],
        "adults": config.PASSENGERS["adults"],
        "travelClass": config.CABIN_CLASS.upper(),
        "currencyCode": currency,
        "max": 50,
        **({"nonStop": "true"} if target.get("nonstop_only") else {}),
    })
    req = urllib.request.Request(_host() + "/v2/shopping/flight-offers?" + q,
                                 headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def _offer_from(raw: dict, target: dict, currency: str) -> Offer:
    itin = (raw.get("itineraries") or [{}])[0]
    segs = []
    for s in itin.get("segments") or []:
        segs.append(Segment(
            carrier=(s.get("operating") or {}).get("carrierCode") or s.get("carrierCode") or "",
            number=str(s.get("number") or ""),
            origin=(s.get("departure") or {}).get("iataCode") or "",
            destination=(s.get("arrival") or {}).get("iataCode") or "",
            dep_local=(s.get("departure") or {}).get("at") or "",
            arr_local=(s.get("arrival") or {}).get("at") or "",
        ))

    tp = (raw.get("travelerPricings") or [{}])[0]
    fds = tp.get("fareDetailsBySegment") or [{}]
    first = fds[0]
    brand = first.get("brandedFare") or first.get("brandedFareLabel") or first.get("fareBasis") or "?"
    checked = (first.get("includedCheckedBags") or {})
    cabin = (first.get("includedCabinBags") or {})
    cabin_qty = cabin.get("quantity")

    return Offer(
        source=SOURCE,
        point_of_sale=f"amadeus/{os.environ.get('AMADEUS_ENV','test')} ({currency})",
        target_id=target["id"],
        fare_tier=str(brand),
        price=float((raw.get("price") or {}).get("grandTotal") or (raw.get("price") or {}).get("total")),
        currency=(raw.get("price") or {}).get("currency") or currency,
        segments=segs,
        cabin_bag_included=(cabin_qty or 0) >= 1 if cabin_qty is not None else None,
        cabin_bag_allowance=(f"{cabin_qty} cabin bag" if cabin_qty else None),
        checked_bags_included=checked.get("quantity"),
        # One offer = one ticket; a multi-segment offer is a single PNR.
        single_ticket=True,
        pnr_count=1,
        self_transfer=False,
        notes=[CABIN_BAG_HINT,
               f"validating carrier: {', '.join(raw.get('validatingAirlineCodes') or []) or 'n/a'}"],
        raw={"id": raw.get("id"), "price": raw.get("price"),
             "fareDetailsBySegment": fds,
             "lastTicketingDate": raw.get("lastTicketingDate")},
    )


def fetch(target: dict, currency: str = "EUR") -> SourceResult:
    res = SourceResult(source=SOURCE, point_of_sale=f"amadeus ({currency})",
                       target_id=target["id"], status="skipped",
                       url=_host() + "/v2/shopping/flight-offers")
    if not configured():
        res.detail = ("no key set - export AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET "
                      "(free at developers.amadeus.com) to enable this source")
        return res
    try:
        token = _token()
        data = _search(token, target, currency)
    except urllib.error.HTTPError as e:
        res.status = "error"
        body = ""
        try:
            body = e.read().decode()[:300]
        except Exception:
            pass
        res.detail = f"HTTP {e.code}: {body}"
        return res
    except Exception as e:
        res.status = "error"
        res.detail = f"{type(e).__name__}: {e}"
        return res

    raws = data.get("data") or []
    if not raws:
        res.status = "no_match"
        res.detail = ("Amadeus returned no offers. On the test endpoint this usually means "
                      "the route is not in the cached test dataset rather than that the "
                      "flight is sold out - try AMADEUS_ENV=production.")
        return res

    misses = []
    for raw in raws:
        try:
            off = _offer_from(raw, target, currency)
        except Exception:
            continue
        ok, why = matches_target(off.segments, target)
        if ok:
            res.offers.append(off)
        else:
            misses.append(f"{'+'.join(off.flight_numbers) or '?'} ({why})")

    if res.offers:
        res.status = "ok"
        res.detail = f"{len(res.offers)} matching offer(s) of {len(raws)}"
    else:
        res.status = "no_match"
        res.detail = f"no offer matched; saw: {', '.join(misses[:8])}"
    return res
