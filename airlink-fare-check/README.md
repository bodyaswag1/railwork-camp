# Airlink fare check

Prices two specific Airlink itineraries across several booking sources, matches
them by **exact flight number and time**, converts everything to CZK at a live
rate, and writes a comparison you can re-run week after week.

It never buys anything. It stops at the results page and enters no personal or
payment details. Sites that answer with a captcha or a bot wall are logged and
skipped — never worked around.

## The two itineraries

| | Flights | Date | Times | Constraint |
|---|---|---|---|---|
| Leg 1 | `4Z341` CPT → WVB | 2027-01-02 | 11:10 → 13:25 | — |
| Leg 2 | `4Z129` + `4Z494` WDH → JNB → VFA | 2027-01-06 | 07:10 → 13:20 | **one ticket / single PNR** |

1 adult, economy, cabin bag only, no checked baggage.

Anything else is ignored. The nonstop WDH→VFA service is priced separately and
labelled *alternative, needs tour operator approval* — never recommended,
because it does not keep the tour schedule.

## Install

```bash
pip install -r requirements.txt
python -m playwright install chromium      # skip if you already have a build
```

If Playwright's bundled Chromium does not match your install, point `config.py`
at the browser you do have:

```python
CHROMIUM_EXECUTABLE = "/path/to/chrome"    # or None for Playwright's own
```

## Run

```bash
python3 check_fares.py                        # everything
python3 check_fares.py --only kiwi            # one source
python3 check_fares.py --currencies CZK EUR ZAR
python3 check_fares.py --headful              # watch it; helps when a site blocks headless
```

Outputs, both overwritten each run:

* `results.json` — every offer, every source, every failure, with the raw payloads
* `results.md` — the comparison table, the recommendation, and the source log

Re-running is the point. Fares move; keep the old `results.json` if you want a
price history.

## Sources

| Source | How | Notes |
|---|---|---|
| **Kiwi.com** | Playwright, reads the site's own GraphQL response | The most useful source: gives flight numbers per segment, baggage counts, and `pnrCount`, which is how leg 2's single-ticket requirement is actually verified |
| **flyairlink.com** | Playwright, four points of sale (`en-za`, `en-na`, `en-gb`, `en-us`) | The airline's own price. Behind Imperva + hCaptcha — see below |
| **Google Flights** | Playwright, `tfs` protobuf deep link | Display surface only; quotes the cheapest partner offer, no fare tiers |
| **Skyscanner** | Playwright | PerimeterX bot check fires on the first request from an automated browser |
| **Amadeus** | REST API, optional key | The one source with a free key you can get yourself |

### Getting blocked is expected, and is reported honestly

Airline and metasearch sites fingerprint automated browsers. **Whether you get
through depends mostly on where you run from**: a datacentre or cloud IP is
near-certain to be challenged, a normal home connection often is not. So:

* run this on your own laptop, on your home connection, not on a VPS;
* try `--headful`, which passes more bot checks than headless;
* if a source still says `blocked`, price that one by hand in a normal browser.

A `blocked` row in `results.md` means the tool stopped at a captcha on purpose.
It is not a bug and it is not a missing price — it means *no price was obtained
from that source*, and the table says so rather than quietly leaving it out.

### Optional API keys

Set these before running and the matching source switches from scraping to the API:

```bash
export AMADEUS_CLIENT_ID=...        # free: https://developers.amadeus.com
export AMADEUS_CLIENT_SECRET=...
export AMADEUS_ENV=production       # default is "test"
```

**Amadeus Self-Service** is the only one of the three worth setting up. The free
*test* environment serves a cached partial dataset and usually returns nothing
for African regional routes like CPT–WVB; the same key moved to `production`
(free tier, card on file, no charge under the monthly quota) returns live fares.

The other two are dead ends, for the record:

* **Kiwi Tequila** — closed to new self-service sign-ups. If you already hold a
  key, set `KIWI_TEQUILA_API_KEY` and the Kiwi module will note it, but it still
  scrapes; there is no free key to hand a new user.
* **Duffel** — live mode needs an approved account, and test mode returns
  invented fares, which is worse than no number at all.
* **Skyscanner** — its Travel API is a commercial partner product. No free tier.

## Currency and the card cost

Rates are live ECB reference rates from `frankfurter.dev` (no key), with
`frankfurter.app` and `open.er-api.com` as fallbacks. The provider, the rate
date, and every rate used are recorded in both output files.

ECB does not publish NAD; the Namibian dollar is pegged 1:1 to ZAR, so the ZAR
rate stands in for it. The report says so where it happens.

Because you can pay in any currency, the table sorts on **what the card is
actually debited**, not the headline number: a non-CZK quote gets an FX margin
added, a CZK quote does not. The margin is assumed to be 1.5% (the midpoint of
the 1–2% range typical of a card's FX loading). Change it in `config.py`:

```python
FX_MARGIN_ASSUMED = 0.015
```

Set it to your card's real margin — a 0% FX card changes which row wins.

## Changing what gets checked

Everything about the search lives in `config.py`: `TARGETS` (the flights, dates
and times that must match), `ALTERNATIVES`, passengers, cabin class, baggage,
the Airlink points of sale, the quote currencies, and the politeness delay.

Matching is strict by design (`model.matches_target`): same flight numbers in
the same order, same routing, same date, and the whole-itinerary departure and
arrival times must agree to the minute. A near-miss is reported as `no_match`
with the reason, never silently accepted — which is what stops you from booking
the 09:20 departure because it was cheaper.

## Tests

```bash
python3 test_matching.py
```

Checks that the matcher accepts only the exact flights asked for — right number,
right order, right date, right times — and rejects the near-misses, including a
cheaper departure five minutes off. Run it whenever you edit `config.TARGETS`.

## Layout

```
config.py       the itineraries and the knobs
model.py        Offer / SourceResult, and the matching rules
browser.py      Chromium, rate limiting, bot-wall detection
fx.py           live rates, currency pegs, card cost
reference.py    Airlink's published fare families and baggage allowance
sources/        one module per source
check_fares.py  CLI entry point
report.py       builds results.md
test_matching.py  matcher tests
```
