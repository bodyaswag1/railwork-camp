"""Airline-published facts that the price sources do not carry themselves.

Metasearch and OTA results say "1 cabin bag included" without ever giving the
kg and cm. Those come from the airline. Everything here is Airlink's own
published policy, with the document it came from, so the report can state an
allowance without inventing one.

Re-check these when you re-run: policies change, and the pages they come from
are the same ones the scraper cannot always reach.
"""

from __future__ import annotations

# Airlink's economy fare families. These are the real names - Airlink does not
# use Lite / Classic / Flex. Source: Airlink Reservations Policy V6, Aug 2025,
# section 29.1 "BOOKING CLASSES".
SUNBIRD_FAMILIES = [
    {"name": "Plain Sunbird",       "cabin": "Economy",      "rbd": "Q V L G W",
     "checked_kg": 20, "note": "cheapest economy family"},
    {"name": "Variable Sunbird",    "cabin": "Economy",      "rbd": "B P M T S O E",
     "checked_kg": 20, "note": ""},
    {"name": "Elegant Sunbird",     "cabin": "Economy",      "rbd": "K H A",
     "checked_kg": 20, "note": ""},
    {"name": "Magnificent Sunbird", "cabin": "Full Economy", "rbd": "Y",
     "checked_kg": 30, "note": "fully flexible economy"},
    {"name": "Superb Sunbird",      "cabin": "Business",     "rbd": "C J Z D",
     "checked_kg": 30, "note": "Z keeps the economy ticket's free allowance"},
]

FARE_FAMILY_SOURCE = (
    "Airlink Reservations Policy, Version 6, August 2025, s29.1 - "
    "https://www.flyairlink.com/sites/default/files/images/"
    "Airlink%20Reservations%20Policy_V6_AUG_2025compressed2.pdf"
)

# Hand baggage. Airlink's published allowance, identical across economy fare
# families: one piece in the overhead locker or under the seat.
CABIN_BAG = {
    "pieces": 1,
    "max_kg": 8,
    "max_cm": "56 x 36 x 23 (H x W x L)",
    "included_in_all_economy_families": True,
    "source": "flyairlink.com baggage pages (Baggage / Conditions of Carriage)",
    "caveat": (
        "Taken from Airlink's published baggage policy. It could not be re-read "
        "directly on this run because flyairlink.com answers automated requests "
        "with an Imperva challenge - confirm on the airline's site before paying."
    ),
}

# Every Airlink economy fare family includes checked baggage, so no fare on
# this route charges separately for the cabin bag. Recorded because the task
# asks for any tier where the cabin bag is an extra.
CABIN_BAG_EVER_EXTRA = False

# The nonstop WDH-VFA service. Third-party schedule listings (FlightsFrom,
# Trip.com) show Airlink operating it as 4Z8133/4Z8135, roughly 1h25. It could
# not be priced on this run: Kiwi returns no nonstop WDH-VFA itinerary on any
# date tried, so the service is not in its inventory, and every other source
# that might have carried it was blocked. Whether it actually operates on
# 2027-01-06 has to be confirmed on flyairlink.com.
NONSTOP_WDH_VFA_NOTE = (
    "Airlink is listed by third-party schedule sites as operating a nonstop "
    "WDH-VFA service (4Z8133 / 4Z8135, about 1h25). No reachable source could "
    "price it: Kiwi returns no nonstop WDH-VFA itinerary on any date tried, so "
    "it is not in Kiwi's inventory, and the airline's own site was blocked. "
    "Treat both the price and whether it flies on 2027-01-06 as unknown until "
    "checked on flyairlink.com."
)

CHANGE_REFUND_NOTE = (
    "Per-family change and cancellation rules live at "
    "flyairlink.com/en/za/fares/domestic_sunbird, which is behind the same bot "
    "wall and could not be read on this run. What is confirmed from the "
    "Reservations Policy: cheaper economy families are the restricted ones, and "
    "a no-show forfeits the fare. Treat change/refund as UNCONFIRMED and check "
    "at the airline's payment page, where the fare rules are shown before you pay."
)


def cabin_bag_text() -> str:
    """The allowance itself, without a piece count - callers prepend that."""
    return (f"max {CABIN_BAG['max_kg']} kg, {CABIN_BAG['max_cm']} cm "
            "(Airlink published allowance)")
