"""Shared data shapes plus the flight-matching rules."""

from __future__ import annotations

import dataclasses
import datetime as _dt
from typing import Any


@dataclasses.dataclass
class Segment:
    carrier: str            # "4Z"
    number: str             # "341"
    origin: str
    destination: str
    dep_local: str          # ISO "2027-01-02T11:10:00"
    arr_local: str

    @property
    def flight_no(self) -> str:
        return f"{self.carrier}{int(self.number)}"


@dataclasses.dataclass
class Offer:
    """One bookable fare for one itinerary from one source."""

    source: str                       # "kiwi", "google_flights", "airlink", ...
    point_of_sale: str                # "en-za", "global", ...
    target_id: str
    fare_tier: str                    # "Lite" / "Classic" / "Kiwi Basic" / ...
    price: float | None
    currency: str | None
    segments: list[Segment] = dataclasses.field(default_factory=list)

    # Baggage. cabin_bag_included=False means the cabin bag costs extra and
    # cabin_bag_fee must be added to the headline price.
    cabin_bag_included: bool | None = None
    cabin_bag_allowance: str | None = None      # "1 x 7 kg, 56x36x23 cm"
    cabin_bag_fee: float | None = None
    checked_bags_included: int | None = None

    change_rules: str | None = None
    refund_rules: str | None = None

    # True  = one ticket / one PNR (protected connection)
    # False = separate tickets / self-transfer
    single_ticket: bool | None = None
    pnr_count: int | None = None
    self_transfer: bool | None = None

    booking_url: str | None = None
    seats_left: int | None = None
    notes: list[str] = dataclasses.field(default_factory=list)
    captured_at: str = dataclasses.field(
        default_factory=lambda: _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds")
    )
    raw: dict[str, Any] | None = None

    # ---- derived ---------------------------------------------------------
    @property
    def flight_numbers(self) -> list[str]:
        return [s.flight_no for s in self.segments]

    def effective_price(self) -> float | None:
        """Headline price plus any mandatory cabin-bag fee."""
        if self.price is None:
            return None
        extra = self.cabin_bag_fee if (self.cabin_bag_included is False and self.cabin_bag_fee) else 0.0
        return self.price + (extra or 0.0)

    def to_dict(self) -> dict[str, Any]:
        d = dataclasses.asdict(self)
        d["flight_numbers"] = self.flight_numbers
        d["effective_price"] = self.effective_price()
        return d


@dataclasses.dataclass
class SourceResult:
    """What one source produced for one target - including failure detail."""

    source: str
    point_of_sale: str
    target_id: str
    status: str               # ok | no_match | blocked | error | skipped
    offers: list[Offer] = dataclasses.field(default_factory=list)
    detail: str = ""
    url: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "point_of_sale": self.point_of_sale,
            "target_id": self.target_id,
            "status": self.status,
            "detail": self.detail,
            "url": self.url,
            "offers": [o.to_dict() for o in self.offers],
        }


# ---------------------------------------------------------------------------
# Matching
# ---------------------------------------------------------------------------

def _hhmm(iso: str) -> str:
    """'2027-01-02T11:10:00' -> '11:10'."""
    if not iso:
        return ""
    t = iso.split("T")[-1]
    return t[:5]


def _date(iso: str) -> str:
    return iso.split("T")[0] if iso else ""


def matches_target(segments: list[Segment], target: dict) -> tuple[bool, str]:
    """Does this itinerary's segment list match the target exactly?

    Returns (matched, reason_if_not).
    """
    if not segments:
        return False, "no segments"

    if target.get("nonstop_only"):
        if len(segments) != 1:
            return False, f"{len(segments)} segments, wanted nonstop"
        if segments[0].origin != target["origin"] or segments[0].destination != target["destination"]:
            return False, "route mismatch"
        if _date(segments[0].dep_local) != target["date"]:
            return False, f"departs {_date(segments[0].dep_local)}, wanted {target['date']}"
        return True, ""

    want = target["segments"]
    if len(segments) != len(want):
        return False, f"{len(segments)} segments, wanted {len(want)}"

    for got, exp in zip(segments, want):
        if got.carrier.upper() != exp["carrier"].upper():
            return False, f"carrier {got.carrier} != {exp['carrier']}"
        if str(int(got.number)) != str(int(exp["number"])):
            return False, f"flight {got.flight_no} != {exp['carrier']}{exp['number']}"
        if got.origin != exp["from"] or got.destination != exp["to"]:
            return False, f"{got.flight_no} routes {got.origin}-{got.destination}, wanted {exp['from']}-{exp['to']}"

    if _date(segments[0].dep_local) != target["date"]:
        return False, f"departs {_date(segments[0].dep_local)}, wanted {target['date']}"

    dep = _hhmm(segments[0].dep_local)
    arr = _hhmm(segments[-1].arr_local)
    if target.get("dep") and dep != target["dep"]:
        return False, f"departs {dep}, wanted {target['dep']}"
    if target.get("arr") and arr != target["arr"]:
        return False, f"arrives {arr}, wanted {target['arr']}"

    return True, ""
