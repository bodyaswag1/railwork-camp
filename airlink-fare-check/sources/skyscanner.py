"""Skyscanner.

Skyscanner runs a PerimeterX bot check that fires on the first request from
an automated browser ("Are you a person or a robot?"). This module detects
that, reports `blocked`, and stops. It does not attempt the captcha.

Skyscanner has no free self-service API - its Travel API is a commercial
partner product - so there is no key to fall back to.
"""

from __future__ import annotations

import re

import browser
import config
from model import Offer, Segment, SourceResult, matches_target

SOURCE = "skyscanner"


def _url(target: dict, currency: str, market: str = "cz", locale: str = "en-GB") -> str:
    d = target["date"].replace("-", "")[2:]      # 2027-01-02 -> 270102
    return (f"https://www.skyscanner.net/transport/flights/"
            f"{target['origin'].lower()}/{target['destination'].lower()}/{d}/"
            f"?adultsv2={config.PASSENGERS['adults']}"
            f"&cabinclass={config.CABIN_CLASS}"
            f"&currency={currency}&market={market}&locale={locale}"
            f"&ref=home&rtn=0")


FLIGHT_RE = re.compile(r"\b(4Z)\s?(\d{2,4})\b")


def fetch(br, target: dict, currency: str = "CZK") -> SourceResult:
    url = _url(target, currency)
    res = SourceResult(source=SOURCE, point_of_sale=f"skyscanner.net ({currency})",
                       target_id=target["id"], status="error", url=url)
    try:
        with browser.page(br) as pg:
            browser.polite_goto(pg, url, wait_ms=8000)
            browser.accept_cookies(pg)
            try:
                pg.wait_for_selector("[class*='FlightsTicket'], [data-testid*='itinerary']",
                                     timeout=40_000)
            except Exception:
                browser.check_blocked(pg)
                res.status = "no_match"
                res.detail = "no itinerary tiles rendered"
                return res
            pg.wait_for_timeout(3000)
            tiles = pg.query_selector_all("[class*='FlightsTicket'], [data-testid*='itinerary']")
            for t in tiles[:15]:
                text = t.inner_text()
                fl = FLIGHT_RE.findall(text)
                times = re.findall(r"\b(\d{1,2}:\d{2})\b", text)
                price = re.search(r"([\d][\d\s,]*)\s?(?:Kč|CZK|€|\$)", text)
                if not fl or len(times) < 2:
                    continue
                segs = [Segment(carrier=c, number=n,
                                origin=target["origin"], destination=target["destination"],
                                dep_local=f"{target['date']}T{times[0]}:00",
                                arr_local=f"{target['date']}T{times[-1]}:00")
                        for c, n in fl]
                off = Offer(source=SOURCE, point_of_sale=f"skyscanner.net ({currency})",
                            target_id=target["id"], fare_tier="cheapest agent shown",
                            price=float(price.group(1).replace(" ", "").replace(",", "")) if price else None,
                            currency=currency, segments=segs, booking_url=url,
                            raw={"tile": re.sub(r"\s+", " ", text)[:400]})
                ok, _ = matches_target(off.segments, target)
                if ok:
                    res.offers.append(off)
            res.status = "ok" if res.offers else "no_match"
            res.detail = f"{len(res.offers)} matching tile(s) of {len(tiles)}"
            return res
    except browser.Blocked as e:
        res.status = "blocked"
        res.detail = (f"blocked: {e}. Skyscanner's bot check fired; not bypassed by design. "
                      "No free API exists as a fallback.")
        return res
    except Exception as e:
        res.status = "error"
        res.detail = f"{type(e).__name__}: {e}"
        return res
