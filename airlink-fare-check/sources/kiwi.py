"""Kiwi.com.

Kiwi's results page is a React app fed by a GraphQL call
(SearchOneWayItinerariesQuery). We load the page in a real browser and read
that response instead of scraping the DOM: it carries the operating carrier
and flight number per segment, the baggage counts, and - crucially for leg 2 -
`pnrCount` and `travelHack.isVirtualInterlining`, which is how we tell a real
single-ticket connection from a Kiwi self-transfer.

Kiwi's public Tequila API is not used: it was closed to new self-service
sign-ups, so there is no free key to give you. If you do have a Tequila key,
set KIWI_TEQUILA_API_KEY and this module will say so in its notes.
"""

from __future__ import annotations

import os
import urllib.parse

import browser
import config
import reference
from model import Offer, Segment, SourceResult, matches_target

GQL_MARKER = "SearchOneWayItinerariesQuery"
SOURCE = "kiwi"


def _url(target: dict, currency: str) -> str:
    base = "https://www.kiwi.com/en/search/results"
    path = f"{base}/{target['kiwi_from']}/{target['kiwi_to']}/{target['date']}/no-return"
    q = {
        "sortBy": "price",
        "currency": currency.lower(),
        "adults": config.PASSENGERS["adults"],
        "cabinClass": config.CABIN_CLASS.upper(),
        # cabin bag only, no hold bag
        "cabinBaggage": config.CABIN_BAGS,
        "checkedBaggage": config.CHECKED_BAGS,
    }
    if target.get("nonstop_only"):
        q["stopNumber"] = 0
    return path + "?" + urllib.parse.urlencode(q)


def _segments(itin: dict) -> list[Segment]:
    out: list[Segment] = []
    for ss in (itin.get("sector") or {}).get("sectorSegments") or []:
        seg = ss.get("segment") or {}
        if seg.get("type") and seg["type"] != "FLIGHT":
            continue
        carrier = (seg.get("operatingCarrier") or seg.get("carrier") or {}).get("code") or ""
        out.append(Segment(
            carrier=carrier,
            number=str(seg.get("code") or ""),
            origin=((seg.get("source") or {}).get("station") or {}).get("code") or "",
            destination=((seg.get("destination") or {}).get("station") or {}).get("code") or "",
            dep_local=((seg.get("source") or {}).get("localTime")) or "",
            arr_local=((seg.get("destination") or {}).get("localTime")) or "",
        ))
    return out


def _offer(itin: dict, target: dict, currency: str, url: str) -> Offer:
    bags = itin.get("bagsInfo") or {}
    hack = itin.get("travelHack") or {}
    price = (itin.get("price") or {}).get("amount")
    pnr = itin.get("pnrCount")
    vi = bool(hack.get("isVirtualInterlining"))
    hand = bags.get("includedHandBags")
    provider = (itin.get("provider") or {}).get("name") or "Kiwi.com"
    segs_ = _segments(itin)
    all_airlink = bool(segs_) and all(s.carrier.upper() == "4Z" for s in segs_)
    code = (itin.get("provider") or {}).get("code") or ""

    notes = []
    fee = (itin.get("benefitsData") or {}).get("guaranteeFee") or {}
    if fee.get("roundedAmount"):
        notes.append(
            f"Optional Kiwi.com Guarantee +{fee['roundedAmount']} {currency} "
            "(Kiwi's own disruption cover, not an airline fare rule)."
        )
    if vi:
        notes.append("Virtual interlining: Kiwi combines separate tickets; the connection "
                     "is covered by Kiwi's Guarantee, not by the airline.")

    return Offer(
        source=SOURCE,
        point_of_sale=f"kiwi.com ({currency})",
        target_id=target["id"],
        fare_tier=f"{provider}{' / ' + code if code else ''}",
        price=float(price) if price is not None else None,
        currency=currency,
        segments=segs_,
        cabin_bag_included=(hand or 0) >= 1 if hand is not None else None,
        # Kiwi states the count, never the kg/cm. The allowance itself is the
        # airline's, so it is filled in from Airlink's published policy when
        # every segment is on 4Z.
        cabin_bag_allowance=(
            (f"{hand} piece, " + reference.cabin_bag_text())
            if hand and all_airlink else
            (f"{hand} cabin bag included (allowance set by the operating carrier)"
             if hand else None)),
        cabin_bag_fee=None,
        checked_bags_included=bags.get("includedCheckedBags"),
        # Kiwi only reveals these inside the booking funnel, which we do not
        # enter. On a 4Z-only itinerary the airline's fare rules are what apply.
        change_rules=(reference.CHANGE_REFUND_NOTE if all_airlink else None),
        refund_rules=(reference.CHANGE_REFUND_NOTE if all_airlink else None),
        single_ticket=(pnr == 1 and not vi) if pnr is not None else (not vi),
        pnr_count=pnr,
        self_transfer=vi,
        booking_url=url,
        seats_left=(itin.get("lastAvailable") or {}).get("seatsLeft"),
        notes=notes,
        raw={
            "id": itin.get("id"),
            "shareId": itin.get("shareId"),
            "priceEur": (itin.get("priceEur") or {}).get("amount"),
            "bagsInfo": bags,
            "travelHack": hack,
            "pnrCount": pnr,
            "provider": itin.get("provider"),
        },
    )


def fetch(br, target: dict, currency: str = "CZK") -> SourceResult:
    url = _url(target, currency)
    res = SourceResult(source=SOURCE, point_of_sale=f"kiwi.com ({currency})",
                       target_id=target["id"], status="error", url=url)
    if os.environ.get("KIWI_TEQUILA_API_KEY"):
        res.detail = "KIWI_TEQUILA_API_KEY is set but Tequila is not used; scraping the site instead. "

    captured: dict = {}

    def on_response(r):
        if GQL_MARKER in r.url:
            try:
                captured["payload"] = r.json()
            except Exception:
                pass

    try:
        with browser.page(br) as pg:
            pg.on("response", on_response)
            browser.polite_goto(pg, url, wait_ms=4000)
            browser.accept_cookies(pg)
            # Results stream in; wait for the GraphQL payload to land.
            for _ in range(24):
                if captured.get("payload"):
                    break
                pg.wait_for_timeout(2500)
            browser.check_blocked(pg)
    except browser.Blocked as e:
        res.status = "blocked"
        res.detail += f"blocked: {e}"
        return res
    except Exception as e:
        res.status = "error"
        res.detail += f"{type(e).__name__}: {e}"
        return res

    payload = captured.get("payload")
    if not payload:
        res.status = "error"
        res.detail += "no SearchOneWayItinerariesQuery response captured"
        return res

    itins = (((payload.get("data") or {}).get("onewayItineraries") or {}).get("itineraries")) or []
    if not itins:
        res.status = "no_match"
        res.detail += "Kiwi returned no itineraries for this date"
        return res

    misses = []
    for it in itins:
        off = _offer(it, target, currency, url)
        ok, why = matches_target(off.segments, target)
        if ok:
            res.offers.append(off)
        else:
            misses.append(f"{'+'.join(off.flight_numbers) or '?'} ({why})")

    if res.offers:
        res.status = "ok"
        res.detail += f"{len(res.offers)} matching offer(s) of {len(itins)} returned"
    else:
        res.status = "no_match"
        res.detail += ("none of the returned itineraries match the required flights; "
                       f"saw: {', '.join(misses[:8])}")
    return res
