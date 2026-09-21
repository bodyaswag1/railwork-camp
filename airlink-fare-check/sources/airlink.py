"""flyairlink.com - the airline's own site, across several points of sale.

This is the source that matters most: Airlink sells Lite / Classic / Flex
fares, and only the airline states the cabin-bag allowance and the change and
refund rules authoritatively.

It is also the most defended. www.flyairlink.com sits behind Imperva
(Incapsula) and serves an hCaptcha challenge to automated browsers, and the
booking engine on book.flyairlink.com is behind Imperva Advanced Bot
Protection ("Pardon Our Interruption"). When that happens this module reports
`blocked` and stops - it never attempts to solve or evade a captcha.

Whether you get blocked depends on where you run from. From a datacentre or
cloud IP it is near-certain; from a normal home connection it often works.
Run this module locally with HEADLESS=0 if it reports blocked here.
"""

from __future__ import annotations

import re

import browser
import config
import reference
from model import Offer, Segment, SourceResult, matches_target

SOURCE = "airlink"

# Airlink's published fare families, cheapest first. Airlink does not use
# Lite / Classic / Flex - see reference.SUNBIRD_FAMILIES.
FARE_TIERS = [f["name"] for f in reference.SUNBIRD_FAMILIES]
# Also match the bare adjective, which is how the booking engine labels them.
FARE_TIER_ALIASES = [f["name"].split()[0] for f in reference.SUNBIRD_FAMILIES]


def _search_url(pos_url: str, target: dict) -> str:
    """Airlink's booking deep link for a one-way search."""
    return (f"{pos_url.rstrip('/')}/book/select-flight"
            f"?tripType=oneway"
            f"&origin={target['origin']}&destination={target['destination']}"
            f"&departureDate={target['date']}"
            f"&adults={config.PASSENGERS['adults']}"
            f"&cabinClass={config.CABIN_CLASS}")


PRICE_RE = re.compile(r"\b([A-Z]{3})\s?([\d][\d,\s]*(?:\.\d{2})?)\b")
FLIGHT_RE = re.compile(r"\b(4Z)\s?(\d{2,4})\b")


def _parse_results(pg, target: dict, pos: str, url: str) -> list[Offer]:
    """Read fare-tier cards off the availability page.

    Kept deliberately tolerant: Airlink has changed booking engines before, so
    this reads text rather than betting on one set of CSS class names.
    """
    offers: list[Offer] = []
    text = pg.inner_text("body")
    if not FLIGHT_RE.search(text):
        return offers

    rows = pg.query_selector_all(
        "[class*='flight-card'], [class*='FlightCard'], [class*='journey'], "
        "[data-testid*='flight'], [class*='fare-card']")
    for row in rows:
        try:
            rtext = row.inner_text()
        except Exception:
            continue
        fl = FLIGHT_RE.search(rtext)
        if not fl:
            continue
        times = re.findall(r"\b(\d{1,2}:\d{2})\b", rtext)
        if len(times) < 2:
            continue
        segs = [Segment(carrier="4Z", number=fl.group(2),
                        origin=target["origin"], destination=target["destination"],
                        dep_local=f"{target['date']}T{times[0]}:00",
                        arr_local=f"{target['date']}T{times[-1]}:00")]
        for tier, alias in zip(FARE_TIERS, FARE_TIER_ALIASES):
            m = (re.search(rf"{tier}\b[^\n]*?" + PRICE_RE.pattern, rtext, re.I)
                 or re.search(rf"{alias}\s+Sunbird\b[^\n]*?" + PRICE_RE.pattern, rtext, re.I))
            if not m:
                continue
            offers.append(Offer(
                source=SOURCE, point_of_sale=pos, target_id=target["id"],
                fare_tier=tier,
                price=float(m.group(2).replace(",", "").replace(" ", "")),
                currency=m.group(1),
                segments=segs,
                cabin_bag_included=True,
                cabin_bag_allowance="1 piece, " + reference.cabin_bag_text(),
                single_ticket=True,          # booked on the airline, one PNR
                pnr_count=1,
                self_transfer=False,
                booking_url=url,
                raw={"row_text": re.sub(r'\s+', ' ', rtext)[:500]},
            ))
    return offers


def fetch(br, target: dict, pos: dict) -> SourceResult:
    url = _search_url(pos["url"], target)
    res = SourceResult(source=SOURCE, point_of_sale=pos["pos"],
                       target_id=target["id"], status="error", url=url)
    try:
        with browser.page(br) as pg:
            browser.polite_goto(pg, pos["url"], wait_ms=5000, host_key="flyairlink.com")
            browser.accept_cookies(pg)
            browser.polite_goto(pg, url, wait_ms=12000, host_key="flyairlink.com")
            offers = _parse_results(pg, target, pos["pos"], url)
    except browser.Blocked as e:
        res.status = "blocked"
        res.detail = (f"blocked: {e}. Airlink fronts its site with Imperva and serves a "
                      "captcha to automated browsers; not bypassed by design. "
                      "Re-run from a normal home connection, or price this leg by hand.")
        return res
    except Exception as e:
        res.status = "error"
        res.detail = f"{type(e).__name__}: {e}"
        return res

    matched = []
    for o in offers:
        ok, _ = matches_target(o.segments, target)
        if ok:
            matched.append(o)
    res.offers = matched
    if matched:
        res.status = "ok"
        res.detail = f"{len(matched)} fare tier(s) matched"
    elif offers:
        res.status = "no_match"
        res.detail = f"{len(offers)} fare(s) parsed but none matched the required flight/time"
    else:
        res.status = "no_match"
        res.detail = "availability page reached but no fares could be parsed"
    return res
