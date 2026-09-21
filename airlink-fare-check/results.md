# Airlink fare check

Generated 2026-09-21T13:11:47+00:00 · 1 adult · economy · cabin bag only, no checked baggage

No purchase was made and no personal or payment details were entered; every source was read at its results page and no further.

## Exchange rate used

Live ECB reference rates via **frankfurter.dev**, rates as of **2026-09-18**, fetched 2026-09-21T13:02:28+00:00.

| Pair | Rate |
|---|---|
| 1 EUR | 24.3390 CZK |
| 1 ZAR | 1.3052 CZK |
| 1 NAD | 1.3052 CZK |
| 1 USD | 21.2382 CZK |
| 1 GBP | 28.3407 CZK |

NAD is not published by the ECB; the Namibian dollar is pegged 1:1 to ZAR, so the ZAR rate stands in for it.

**Card cost** assumes a **1.5%** FX margin on any non-CZK payment - the midpoint of the 1-2% a card typically loads. A CZK quote carries no margin, so it is shown at face value. Set `FX_MARGIN_ASSUMED` in `config.py` to your card's real rate; a 0% FX card changes which row wins.

## Comparison, sorted by what the card is actually debited (CZK)

### Leg 1 - 4Z341 CPT->WVB

| # | Source / point of sale | Fare tier | Quoted | In CZK | Card cost CZK | Cabin bag | Checked | Single ticket (PNR) |
|---|---|---|---|---|---|---|---|---|
| 1 | kiwi / kiwi.com (CZK) | Kiwi.com / KIWI-BASIC | 5,388 CZK | 5,388 | **5,388** | yes | 1 | yes (1) |
| 2 | kiwi / kiwi.com (EUR) | Kiwi.com / KIWI-BASIC | 221 EUR | 5,379 | **5,460** | yes | 1 | yes (1) |

### Leg 2 - 4Z129 + 4Z494 WDH->JNB->VFA

| # | Source / point of sale | Fare tier | Quoted | In CZK | Card cost CZK | Cabin bag | Checked | Single ticket (PNR) |
|---|---|---|---|---|---|---|---|---|
| 1 | kiwi / kiwi.com (CZK) | Kiwi.com / KIWI-BASIC | 8,571 CZK | 8,571 | **8,571** | yes | 1 | yes (1) |
| 2 | kiwi / kiwi.com (EUR) | Kiwi.com / KIWI-BASIC | 351 EUR | 8,543 | **8,671** | yes | 1 | yes (1) |

## Alternative - needs tour operator approval

Recorded only, never recommended: it does not keep the tour schedule.

_No priced alternative was returned._

Airlink is listed by third-party schedule sites as operating a nonstop WDH-VFA service (4Z8133 / 4Z8135, about 1h25). No reachable source could price it: Kiwi returns no nonstop WDH-VFA itinerary on any date tried, so it is not in Kiwi's inventory, and the airline's own site was blocked. Treat both the price and whether it flies on 2027-01-06 as unknown until checked on flyairlink.com.

## Recommendation

**Leg 1 - 4Z341 CPT->WVB**

- Cheapest qualifying: **kiwi / kiwi.com (CZK)**, Kiwi.com / KIWI-BASIC, 5,388 CZK - **5,388 CZK** on the card
- Pay in **CZK** - quoted in CZK, so no card FX margin applies.
- Same itinerary, other quotes: kiwi.com (EUR) 221 EUR = 5,460 CZK

**Leg 2 - 4Z129 + 4Z494 WDH->JNB->VFA**

- Cheapest qualifying: **kiwi / kiwi.com (CZK)**, Kiwi.com / KIWI-BASIC, 8,571 CZK - **8,571 CZK** on the card
- Pay in **CZK** - quoted in CZK, so no card FX margin applies.
- Single ticket / one PNR: **yes** (pnrCount=1) - required for this leg, and confirmed.
- Same itinerary, other quotes: kiwi.com (EUR) 351 EUR = 8,671 CZK

### What this comparison is missing

Read the source log before acting on the table: if the airline's own site is listed as `blocked`, then no airline-direct price is in the table at all, and the cheapest row is only the cheapest *among the sources that answered*. Airlink direct is routinely cheaper than an agency, so price it by hand, or re-run this tool from a normal home connection, before you book.

## Airlink fare families and cabin baggage

Airlink does not sell Lite / Classic / Flex. Its economy fare families are:

| Fare family | Cabin | Booking classes | Checked baggage |
|---|---|---|---|
| Plain Sunbird | Economy | Q V L G W | 20 kg |
| Variable Sunbird | Economy | B P M T S O E | 20 kg |
| Elegant Sunbird | Economy | K H A | 20 kg |
| Magnificent Sunbird | Full Economy | Y | 30 kg |
| Superb Sunbird | Business | C J Z D | 30 kg |

Source: Airlink Reservations Policy, Version 6, August 2025, s29.1 - https://www.flyairlink.com/sites/default/files/images/Airlink%20Reservations%20Policy_V6_AUG_2025compressed2.pdf

**Cabin bag:** 1 piece, max **8 kg**, max **56 x 36 x 23 (H x W x L) cm**, included in every economy fare family - so on this route no tier charges extra for a cabin bag, and nothing needed a bag fee added to it.

_Taken from Airlink's published baggage policy. It could not be re-read directly on this run because flyairlink.com answers automated requests with an Imperva challenge - confirm on the airline's site before paying._

**Change / refund:** Per-family change and cancellation rules live at flyairlink.com/en/za/fares/domestic_sunbird, which is behind the same bot wall and could not be read on this run. What is confirmed from the Reservations Policy: cheaper economy families are the restricted ones, and a no-show forfeits the fare. Treat change/refund as UNCONFIRMED and check at the airline's payment page, where the fare rules are shown before you pay.

## Fare detail

**kiwi / kiwi.com (CZK) - Kiwi.com / KIWI-BASIC** (Leg 1 - 4Z341 CPT->WVB)

- Flights matched: `4Z341`
- Price: 5,388 CZK = 5,388 CZK interbank, 5,388 CZK on the card
- Cabin bag: 1 piece, max 8 kg, 56 x 36 x 23 (H x W x L) cm (Airlink published allowance)
- Checked bags included: 1
- Single ticket / one PNR: yes (pnrCount=1)
- Change rules: Per-family change and cancellation rules live at flyairlink.com/en/za/fares/domestic_sunbird, which is behind the same bot wall and could not be read on this run. What is confirmed from the Reservations Policy: cheaper economy families are the restricted ones, and a no-show forfeits the fare. Treat change/refund as UNCONFIRMED and check at the airline's payment page, where the fare rules are shown before you pay.
- Refund rules: Per-family change and cancellation rules live at flyairlink.com/en/za/fares/domestic_sunbird, which is behind the same bot wall and could not be read on this run. What is confirmed from the Reservations Policy: cheaper economy families are the restricted ones, and a no-show forfeits the fare. Treat change/refund as UNCONFIRMED and check at the airline's payment page, where the fare rules are shown before you pay.
- Seats left at this price: 2
- Note: Optional Kiwi.com Guarantee +684 CZK (Kiwi's own disruption cover, not an airline fare rule).
- Results page: https://www.kiwi.com/en/search/results/cape-town-south-africa/walvis-bay-namibia/2027-01-02/no-return?sortBy=price&currency=czk&adults=1&cabinClass=ECONOMY&cabinBaggage=1&checkedBaggage=0

**kiwi / kiwi.com (EUR) - Kiwi.com / KIWI-BASIC** (Leg 1 - 4Z341 CPT->WVB)

- Flights matched: `4Z341`
- Price: 221 EUR = 5,379 CZK interbank, 5,460 CZK on the card
- Cabin bag: 1 piece, max 8 kg, 56 x 36 x 23 (H x W x L) cm (Airlink published allowance)
- Checked bags included: 1
- Single ticket / one PNR: yes (pnrCount=1)
- Change rules: Per-family change and cancellation rules live at flyairlink.com/en/za/fares/domestic_sunbird, which is behind the same bot wall and could not be read on this run. What is confirmed from the Reservations Policy: cheaper economy families are the restricted ones, and a no-show forfeits the fare. Treat change/refund as UNCONFIRMED and check at the airline's payment page, where the fare rules are shown before you pay.
- Refund rules: Per-family change and cancellation rules live at flyairlink.com/en/za/fares/domestic_sunbird, which is behind the same bot wall and could not be read on this run. What is confirmed from the Reservations Policy: cheaper economy families are the restricted ones, and a no-show forfeits the fare. Treat change/refund as UNCONFIRMED and check at the airline's payment page, where the fare rules are shown before you pay.
- Seats left at this price: 2
- Note: Optional Kiwi.com Guarantee +28 EUR (Kiwi's own disruption cover, not an airline fare rule).
- Results page: https://www.kiwi.com/en/search/results/cape-town-south-africa/walvis-bay-namibia/2027-01-02/no-return?sortBy=price&currency=eur&adults=1&cabinClass=ECONOMY&cabinBaggage=1&checkedBaggage=0

**kiwi / kiwi.com (CZK) - Kiwi.com / KIWI-BASIC** (Leg 2 - 4Z129 + 4Z494 WDH->JNB->VFA)

- Flights matched: `4Z129+4Z494`
- Price: 8,571 CZK = 8,571 CZK interbank, 8,571 CZK on the card
- Cabin bag: 1 piece, max 8 kg, 56 x 36 x 23 (H x W x L) cm (Airlink published allowance)
- Checked bags included: 1
- Single ticket / one PNR: yes (pnrCount=1)
- Change rules: Per-family change and cancellation rules live at flyairlink.com/en/za/fares/domestic_sunbird, which is behind the same bot wall and could not be read on this run. What is confirmed from the Reservations Policy: cheaper economy families are the restricted ones, and a no-show forfeits the fare. Treat change/refund as UNCONFIRMED and check at the airline's payment page, where the fare rules are shown before you pay.
- Refund rules: Per-family change and cancellation rules live at flyairlink.com/en/za/fares/domestic_sunbird, which is behind the same bot wall and could not be read on this run. What is confirmed from the Reservations Policy: cheaper economy families are the restricted ones, and a no-show forfeits the fare. Treat change/refund as UNCONFIRMED and check at the airline's payment page, where the fare rules are shown before you pay.
- Seats left at this price: 4
- Note: Optional Kiwi.com Guarantee +1045 CZK (Kiwi's own disruption cover, not an airline fare rule).
- Results page: https://www.kiwi.com/en/search/results/windhoek-namibia/victoria-falls-zimbabwe/2027-01-06/no-return?sortBy=price&currency=czk&adults=1&cabinClass=ECONOMY&cabinBaggage=1&checkedBaggage=0

**kiwi / kiwi.com (EUR) - Kiwi.com / KIWI-BASIC** (Leg 2 - 4Z129 + 4Z494 WDH->JNB->VFA)

- Flights matched: `4Z129+4Z494`
- Price: 351 EUR = 8,543 CZK interbank, 8,671 CZK on the card
- Cabin bag: 1 piece, max 8 kg, 56 x 36 x 23 (H x W x L) cm (Airlink published allowance)
- Checked bags included: 1
- Single ticket / one PNR: yes (pnrCount=1)
- Change rules: Per-family change and cancellation rules live at flyairlink.com/en/za/fares/domestic_sunbird, which is behind the same bot wall and could not be read on this run. What is confirmed from the Reservations Policy: cheaper economy families are the restricted ones, and a no-show forfeits the fare. Treat change/refund as UNCONFIRMED and check at the airline's payment page, where the fare rules are shown before you pay.
- Refund rules: Per-family change and cancellation rules live at flyairlink.com/en/za/fares/domestic_sunbird, which is behind the same bot wall and could not be read on this run. What is confirmed from the Reservations Policy: cheaper economy families are the restricted ones, and a no-show forfeits the fare. Treat change/refund as UNCONFIRMED and check at the airline's payment page, where the fare rules are shown before you pay.
- Seats left at this price: 4
- Note: Optional Kiwi.com Guarantee +43 EUR (Kiwi's own disruption cover, not an airline fare rule).
- Results page: https://www.kiwi.com/en/search/results/windhoek-namibia/victoria-falls-zimbabwe/2027-01-06/no-return?sortBy=price&currency=eur&adults=1&cabinClass=ECONOMY&cabinBaggage=1&checkedBaggage=0

## Source log

Every source attempted, including the ones that refused. Sites that showed a captcha or bot wall were logged and skipped, never worked around.

| Source | Point of sale | Itinerary | Status | Detail |
|---|---|---|---|---|
| amadeus | amadeus (CZK) | leg1_cpt_wvb | **skipped** | no key set - export AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET (free at developers.amadeus.com) to enable this source |
| amadeus | amadeus (CZK) | leg2_wdh_vfa | **skipped** | no key set - export AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET (free at developers.amadeus.com) to enable this source |
| amadeus | amadeus (CZK) | alt_wdh_vfa_direct | **skipped** | no key set - export AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET (free at developers.amadeus.com) to enable this source |
| kiwi | kiwi.com (CZK) | leg1_cpt_wvb | **ok** | 1 matching offer(s) of 10 returned |
| kiwi | kiwi.com (EUR) | leg1_cpt_wvb | **ok** | 1 matching offer(s) of 10 returned |
| google_flights | google.com (CZK) | leg1_cpt_wvb | **error** | result cards never rendered; Chromium blocked 18 of Google's own script bundles (ERR_BLOCKED_BY_ORB) - the JS app could not start |
| google_flights | google.com (EUR) | leg1_cpt_wvb | **error** | result cards never rendered; Chromium blocked 18 of Google's own script bundles (ERR_BLOCKED_BY_ORB) - the JS app could not start |
| skyscanner | skyscanner.net (CZK) | leg1_cpt_wvb | **blocked** | blocked: Skyscanner bot check at https://www.skyscanner.cz/sttc/px/captcha-v2/index.html. Skyscanner's bot check fired; not bypassed by design. No free API exists as a fallback. |
| airlink | en-za | leg1_cpt_wvb | **blocked** | blocked: Imperva/Incapsula interstitial at https://www.flyairlink.com/en-za. Airlink fronts its site with Imperva and serves a captcha to automated browsers; not bypassed by design. Re-run from a normal home connection, or price this leg by |
| airlink | en-na | leg1_cpt_wvb | **blocked** | blocked: Imperva/Incapsula interstitial at https://www.flyairlink.com/en-na. Airlink fronts its site with Imperva and serves a captcha to automated browsers; not bypassed by design. Re-run from a normal home connection, or price this leg by |
| airlink | en-gb | leg1_cpt_wvb | **blocked** | blocked: Imperva/Incapsula interstitial at https://www.flyairlink.com/en-gb. Airlink fronts its site with Imperva and serves a captcha to automated browsers; not bypassed by design. Re-run from a normal home connection, or price this leg by |
| airlink | en-us | leg1_cpt_wvb | **blocked** | blocked: Imperva/Incapsula interstitial at https://www.flyairlink.com/en-us. Airlink fronts its site with Imperva and serves a captcha to automated browsers; not bypassed by design. Re-run from a normal home connection, or price this leg by |
| kiwi | kiwi.com (CZK) | leg2_wdh_vfa | **ok** | 1 matching offer(s) of 10 returned |
| kiwi | kiwi.com (EUR) | leg2_wdh_vfa | **ok** | 1 matching offer(s) of 10 returned |
| google_flights | google.com (CZK) | leg2_wdh_vfa | **blocked** | blocked: reCAPTCHA challenge at https://www.google.com/sorry/index |
| google_flights | google.com (EUR) | leg2_wdh_vfa | **error** | result cards never rendered; Chromium blocked 18 of Google's own script bundles (ERR_BLOCKED_BY_ORB) - the JS app could not start |
| skyscanner | skyscanner.net (CZK) | leg2_wdh_vfa | **blocked** | blocked: Skyscanner bot check at https://www.skyscanner.cz/sttc/px/captcha-v2/index.html. Skyscanner's bot check fired; not bypassed by design. No free API exists as a fallback. |
| airlink | en-za | leg2_wdh_vfa | **blocked** | blocked: Imperva/Incapsula interstitial at https://www.flyairlink.com/en-za. Airlink fronts its site with Imperva and serves a captcha to automated browsers; not bypassed by design. Re-run from a normal home connection, or price this leg by |
| airlink | en-na | leg2_wdh_vfa | **blocked** | blocked: Imperva/Incapsula interstitial at https://www.flyairlink.com/en-na. Airlink fronts its site with Imperva and serves a captcha to automated browsers; not bypassed by design. Re-run from a normal home connection, or price this leg by |
| airlink | en-gb | leg2_wdh_vfa | **blocked** | blocked: Imperva/Incapsula interstitial at https://www.flyairlink.com/en-gb. Airlink fronts its site with Imperva and serves a captcha to automated browsers; not bypassed by design. Re-run from a normal home connection, or price this leg by |
| airlink | en-us | leg2_wdh_vfa | **blocked** | blocked: Imperva/Incapsula interstitial at https://www.flyairlink.com/en-us. Airlink fronts its site with Imperva and serves a captcha to automated browsers; not bypassed by design. Re-run from a normal home connection, or price this leg by |
| kiwi | kiwi.com (CZK) | alt_wdh_vfa_direct | **no_match** | Kiwi returned no itineraries for this date |
| kiwi | kiwi.com (EUR) | alt_wdh_vfa_direct | **no_match** | Kiwi returned no itineraries for this date |
| google_flights | google.com (CZK) | alt_wdh_vfa_direct | **blocked** | blocked: reCAPTCHA challenge at https://www.google.com/sorry/index |
| google_flights | google.com (EUR) | alt_wdh_vfa_direct | **blocked** | blocked: reCAPTCHA challenge at https://www.google.com/sorry/index |
| skyscanner | skyscanner.net (CZK) | alt_wdh_vfa_direct | **blocked** | blocked: Skyscanner bot check at https://www.skyscanner.cz/sttc/px/captcha-v2/index.html. Skyscanner's bot check fired; not bypassed by design. No free API exists as a fallback. |
| airlink | en-za | alt_wdh_vfa_direct | **blocked** | blocked: Imperva/Incapsula interstitial at https://www.flyairlink.com/en-za. Airlink fronts its site with Imperva and serves a captcha to automated browsers; not bypassed by design. Re-run from a normal home connection, or price this leg by |
| airlink | en-na | alt_wdh_vfa_direct | **blocked** | blocked: Imperva/Incapsula interstitial at https://www.flyairlink.com/en-na. Airlink fronts its site with Imperva and serves a captcha to automated browsers; not bypassed by design. Re-run from a normal home connection, or price this leg by |
| airlink | en-gb | alt_wdh_vfa_direct | **blocked** | blocked: Imperva/Incapsula interstitial at https://www.flyairlink.com/en-gb. Airlink fronts its site with Imperva and serves a captcha to automated browsers; not bypassed by design. Re-run from a normal home connection, or price this leg by |
| airlink | en-us | alt_wdh_vfa_direct | **blocked** | blocked: Imperva/Incapsula interstitial at https://www.flyairlink.com/en-us. Airlink fronts its site with Imperva and serves a captcha to automated browsers; not bypassed by design. Re-run from a normal home connection, or price this leg by |

