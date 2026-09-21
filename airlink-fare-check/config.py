"""Itineraries we are pricing, and the knobs you may want to change."""

from __future__ import annotations

# ---------------------------------------------------------------------------
# The two itineraries the tour schedule depends on. Flight numbers and local
# times are the match criteria: an offer only counts as a match if the flight
# numbers and the departure/arrival local times line up exactly.
# ---------------------------------------------------------------------------

TARGETS = [
    {
        "id": "leg1_cpt_wvb",
        "label": "Leg 1 - 4Z341 CPT->WVB",
        "date": "2027-01-02",
        "origin": "CPT",
        "destination": "WVB",
        "segments": [
            {"carrier": "4Z", "number": "341", "from": "CPT", "to": "WVB"},
        ],
        # Whole-itinerary local times, as given by the traveller.
        "dep": "11:10",
        "arr": "13:25",
        "single_ticket_required": False,
        # Kiwi city slugs (its URLs are slug-based)
        "kiwi_from": "cape-town-south-africa",
        "kiwi_to": "walvis-bay-namibia",
    },
    {
        "id": "leg2_wdh_vfa",
        "label": "Leg 2 - 4Z129 + 4Z494 WDH->JNB->VFA",
        "date": "2027-01-06",
        "origin": "WDH",
        "destination": "VFA",
        "segments": [
            {"carrier": "4Z", "number": "129", "from": "WDH", "to": "JNB"},
            {"carrier": "4Z", "number": "494", "from": "JNB", "to": "VFA"},
        ],
        # Only the overall times were specified, so only these are matched on.
        # The JNB connection times are whatever the airline schedules.
        "dep": "07:10",
        "arr": "13:20",
        # Must be one itinerary / single PNR with a protected connection.
        "single_ticket_required": True,
        "kiwi_from": "windhoek-namibia",
        "kiwi_to": "victoria-falls-zimbabwe",
    },
]

# Recorded separately, never recommended on its own: the direct WDH->VFA
# service. Cheaper/shorter but it breaks the tour schedule, so it is reported
# as "alternative, needs tour operator approval".
ALTERNATIVES = [
    {
        "id": "alt_wdh_vfa_direct",
        "label": "ALTERNATIVE (needs tour operator approval) - direct WDH->VFA",
        "date": "2027-01-06",
        "origin": "WDH",
        "destination": "VFA",
        "segments": [],          # empty => accept any nonstop WDH->VFA
        "nonstop_only": True,
        "single_ticket_required": False,
        "kiwi_from": "windhoek-namibia",
        "kiwi_to": "victoria-falls-zimbabwe",
    },
]

PASSENGERS = {"adults": 1, "children": 0, "infants": 0}
CABIN_CLASS = "economy"

# Checked baggage: none. We only need a cabin bag, so the cheapest tier that
# includes one wins. Tiers where the cabin bag is an extra get the fee added.
CHECKED_BAGS = 0
CABIN_BAGS = 1

REPORT_CURRENCY = "CZK"

# Points of sale to try on the airline's own site. Point of sale can change
# both the price and the currency quoted.
AIRLINK_POINTS_OF_SALE = [
    {"pos": "en-za", "url": "https://www.flyairlink.com/en-za", "currency_hint": "ZAR"},
    {"pos": "en-na", "url": "https://www.flyairlink.com/en-na", "currency_hint": "NAD"},
    {"pos": "en-gb", "url": "https://www.flyairlink.com/en-gb", "currency_hint": "GBP"},
    {"pos": "en-us", "url": "https://www.flyairlink.com/en-us", "currency_hint": "USD"},
]

# Currencies worth pulling from the metasearch sources. Paying in a foreign
# currency costs an FX margin on the card, so a native-CZK quote can beat a
# nominally cheaper foreign-currency one.
QUOTE_CURRENCIES = ["CZK", "EUR", "ZAR", "USD"]

# Card FX margin applied when the quote is not already in CZK. The task says
# assume ~1-2%; we report the midpoint and show the range in the report.
FX_MARGIN_LOW = 0.01
FX_MARGIN_HIGH = 0.02
FX_MARGIN_ASSUMED = 0.015

# Be polite: seconds to wait between page loads against the same host.
REQUEST_DELAY_SECONDS = 6.0
PAGE_TIMEOUT_MS = 90_000

CHROMIUM_EXECUTABLE = "/opt/pw-browsers/chromium"   # None => Playwright default
