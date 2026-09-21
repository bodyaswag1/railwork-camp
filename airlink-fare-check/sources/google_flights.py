"""Google Flights.

Results are driven by a deep link whose `tfs` parameter is a base64url
protobuf describing the search, so we never have to drive the search form.
The page is then read from the DOM: each result card is expanded to reveal
the operating carrier and flight number, which is what we match on.

Google Flights is a display surface, not a seller: the price shown is the
cheapest partner offer, and fare-tier / baggage / change rules come from
whoever it hands you off to. Those fields are therefore usually empty here.
"""

from __future__ import annotations

import base64
import re

import browser
import config
from model import Offer, Segment, SourceResult, matches_target

SOURCE = "google_flights"


# ---- tfs protobuf ---------------------------------------------------------

def _varint(n: int) -> bytes:
    out = b""
    while True:
        b7 = n & 0x7F
        n >>= 7
        out += bytes([b7 | (0x80 if n else 0)])
        if not n:
            return out


def _tag(field: int, wire: int) -> bytes:
    return _varint((field << 3) | wire)


def _str_field(field: int, val: str) -> bytes:
    bb = val.encode()
    return _tag(field, 2) + _varint(len(bb)) + bb


def _int_field(field: int, val: int) -> bytes:
    return _tag(field, 0) + _varint(val)


def _sub(field: int, body: bytes) -> bytes:
    return _tag(field, 2) + _varint(len(body)) + body


def build_tfs(date: str, origin: str, destination: str, adults: int = 1) -> str:
    leg = _str_field(2, date) + _sub(13, _str_field(2, origin)) + _sub(14, _str_field(2, destination))
    body = _sub(3, leg)
    body += _tag(8, 2) + _varint(adults) + bytes([1] * adults)   # passengers: adults
    body += _int_field(9, 1)     # economy
    body += _int_field(19, 2)    # one way
    return base64.urlsafe_b64encode(body).decode().rstrip("=")


def build_url(target: dict, currency: str) -> str:
    tfs = build_tfs(target["date"], target["origin"], target["destination"],
                    config.PASSENGERS["adults"])
    return (f"https://www.google.com/travel/flights?tfs={tfs}"
            f"&curr={currency}&hl=en&gl=us&tfu=EgQIABABIgA")


# ---- DOM extraction -------------------------------------------------------

CARD_SEL = "li.pIav2d"
PRICE_RE = re.compile(r"(?:([€$£])\s?|\b([A-Z]{3})\s?)([\d][\d,.\s]*)")
FLIGHT_RE = re.compile(r"\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})\b")
TIME_RE = re.compile(r"\b(\d{1,2}):(\d{2})\s?(AM|PM)?\b", re.I)


def _parse_price(text: str, currency: str) -> float | None:
    for m in PRICE_RE.finditer(text):
        raw = m.group(3).replace(",", "").replace(" ", "").rstrip(".")
        try:
            val = float(raw)
        except ValueError:
            continue
        if val >= 10:            # skip stray small numbers (stops, durations)
            return val
    return None


def _to_24h(h: int, mi: int, ampm: str | None) -> str:
    if ampm:
        ampm = ampm.upper()
        if ampm == "PM" and h != 12:
            h += 12
        if ampm == "AM" and h == 12:
            h = 0
    return f"{h:02d}:{mi:02d}"


def _segments_from_detail(detail_text: str, date: str) -> list[Segment]:
    """Read expanded card text into segments.

    Google renders each leg as a block containing the times, the airports and
    a 'Carrier · Economy · Aircraft · XX 123' line.
    """
    segs: list[Segment] = []
    blocks = re.split(r"\n(?=\d{1,2}:\d{2})", detail_text)
    for blk in blocks:
        codes = re.findall(r"\b([A-Z]{3})\b", blk)
        times = TIME_RE.findall(blk)
        fl = None
        for m in FLIGHT_RE.finditer(blk):
            cand = f"{m.group(1)}{m.group(2)}"
            if cand not in ("AM", "PM") and not re.match(r"^\d", m.group(1) or ""):
                fl = (m.group(1), m.group(2))
        if len(times) >= 2 and len(codes) >= 2 and fl:
            dep = _to_24h(int(times[0][0]), int(times[0][1]), times[0][2] or None)
            arr = _to_24h(int(times[1][0]), int(times[1][1]), times[1][2] or None)
            segs.append(Segment(carrier=fl[0], number=fl[1], origin=codes[0],
                                destination=codes[1],
                                dep_local=f"{date}T{dep}:00",
                                arr_local=f"{date}T{arr}:00"))
    return segs


def fetch(br, target: dict, currency: str = "EUR", attempts: int = 2) -> SourceResult:
    url = build_url(target, currency)
    res = SourceResult(source=SOURCE, point_of_sale=f"google.com ({currency})",
                       target_id=target["id"], status="error", url=url)

    last_err = ""
    for attempt in range(1, attempts + 1):
        try:
            with browser.page(br) as pg:
                orb: list[str] = []
                pg.on("requestfailed",
                      lambda r: orb.append(r.url) if r.failure and "ORB" in str(r.failure) else None)
                browser.polite_goto(pg, url, wait_ms=6000)
                try:
                    pg.wait_for_selector(CARD_SEL, timeout=45_000)
                except Exception:
                    body = pg.inner_text("body")
                    if orb:
                        last_err = (f"result cards never rendered; Chromium blocked "
                                    f"{len(orb)} of Google's own script bundles "
                                    f"(ERR_BLOCKED_BY_ORB) - the JS app could not start")
                    elif "Loading results" in body:
                        last_err = "page stuck on 'Loading results' - no results returned to this client"
                    else:
                        last_err = "no result cards found on the page"
                    continue

                pg.wait_for_timeout(4000)
                cards = pg.query_selector_all(CARD_SEL)
                misses = []
                for card in cards[:12]:
                    summary = card.inner_text()
                    price = _parse_price(summary, currency)
                    # expand for flight numbers
                    detail = summary
                    try:
                        btn = card.query_selector("button[aria-label*='light details'], button[jsname]")
                        if btn:
                            btn.click(timeout=4000)
                            pg.wait_for_timeout(1500)
                            detail = card.inner_text()
                            btn.click(timeout=4000)
                            pg.wait_for_timeout(400)
                    except Exception:
                        pass

                    segs = _segments_from_detail(detail, target["date"])
                    off = Offer(
                        source=SOURCE,
                        point_of_sale=f"google.com ({currency})",
                        target_id=target["id"],
                        fare_tier="cheapest partner offer shown (tier not stated by Google)",
                        price=price,
                        currency=currency,
                        segments=segs,
                        booking_url=url,
                        notes=["Google Flights does not sell tickets; it quotes the cheapest "
                               "partner offer. Baggage, change and refund rules come from that "
                               "partner at hand-off."],
                        raw={"card_text": re.sub(r"\s+", " ", detail)[:600]},
                    )
                    ok, why = matches_target(off.segments, target)
                    if ok:
                        res.offers.append(off)
                    else:
                        misses.append(f"{'+'.join(off.flight_numbers) or '?'} ({why})")

                if res.offers:
                    res.status = "ok"
                    res.detail = f"{len(res.offers)} matching offer(s) of {len(cards)} cards"
                else:
                    res.status = "no_match"
                    res.detail = ("no card matched the required flights; saw: "
                                  + ", ".join(misses[:8]))
                return res

        except browser.Blocked as e:
            res.status = "blocked"
            res.detail = f"blocked: {e}"
            return res
        except Exception as e:
            last_err = f"{type(e).__name__}: {e}"

    res.status = "error"
    res.detail = last_err or "unknown failure"
    return res
