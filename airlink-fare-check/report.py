"""Turn results.json into the human-readable comparison in results.md."""

from __future__ import annotations

import config
import fx as fxmod
import reference


def _rates_from(payload: dict):
    f = payload.get("fx")
    if not f:
        return None
    r = fxmod.Rates(f["base"], f["rates"], f["provider"], f["rates_as_of"])
    r.fetched_at = f.get("fetched_at", r.fetched_at)
    return r


def _label(payload: dict, target_id: str) -> str:
    for t in payload["targets"] + payload["alternatives"]:
        if t["id"] == target_id:
            return t["label"]
    return target_id


def _is_alt(payload: dict, target_id: str) -> bool:
    return any(t["id"] == target_id for t in payload["alternatives"])


def _priced_rows(payload: dict, rates) -> list[dict]:
    """One row per offer, with CZK conversion and card cost."""
    rows = []
    margin = payload.get("fx_margin_assumed", config.FX_MARGIN_ASSUMED)
    for res in payload["results"]:
        for off in res["offers"]:
            price = off.get("effective_price")
            cur = off.get("currency")
            if price is None or not cur:
                continue
            czk = None
            card = None
            if rates:
                try:
                    czk = rates.convert(price, cur, config.REPORT_CURRENCY)
                    card = fxmod.card_cost(czk, cur, margin)
                except Exception:
                    pass
            rows.append({
                "target_id": off["target_id"],
                "source": off["source"],
                "pos": off["point_of_sale"],
                "tier": off["fare_tier"],
                "flights": "+".join(off["flight_numbers"]),
                "price": price,
                "currency": cur,
                "czk": czk,
                "card_czk": card,
                "cabin_ok": off.get("cabin_bag_included"),
                "cabin_fee": off.get("cabin_bag_fee"),
                "cabin_allow": off.get("cabin_bag_allowance"),
                "checked": off.get("checked_bags_included"),
                "single": off.get("single_ticket"),
                "pnr": off.get("pnr_count"),
                "change": off.get("change_rules"),
                "refund": off.get("refund_rules"),
                "seats": off.get("seats_left"),
                "notes": off.get("notes") or [],
                "url": off.get("booking_url"),
            })
    rows.sort(key=lambda r: (r["card_czk"] is None, r["card_czk"] if r["card_czk"] is not None else 0))
    return rows


def _fmt(v, suffix="", dash="-"):
    if v is None:
        return dash
    if isinstance(v, float):
        return f"{v:,.0f}{suffix}"
    return f"{v}{suffix}"


def _yn(v):
    return {True: "yes", False: "NO", None: "?"}[v]


def build(payload: dict) -> str:
    rates = _rates_from(payload)
    rows = _priced_rows(payload, rates)
    margin = payload.get("fx_margin_assumed", config.FX_MARGIN_ASSUMED)
    lo, hi = payload.get("fx_margin_range", [config.FX_MARGIN_LOW, config.FX_MARGIN_HIGH])

    out: list[str] = []
    a = out.append
    a("# Airlink fare check")
    a("")
    a(f"Generated {payload['generated_at']} · "
      f"{payload['passengers']['adults']} adult · {payload['cabin_class']} · "
      f"cabin bag only, no checked baggage")
    a("")
    a("No purchase was made and no personal or payment details were entered; "
      "every source was read at its results page and no further.")
    a("")

    # --- FX ---------------------------------------------------------------
    a("## Exchange rate used")
    a("")
    if rates:
        a(f"Live ECB reference rates via **{rates.provider}**, rates as of **{rates.as_of}**, "
          f"fetched {rates.fetched_at}.")
        a("")
        a("| Pair | Rate |")
        a("|---|---|")
        for c in ["EUR", "ZAR", "NAD", "USD", "GBP"]:
            try:
                a(f"| 1 {c} | {rates.rate(c, 'CZK'):,.4f} CZK |")
            except Exception:
                pass
        a("")
        a("NAD is not published by the ECB; the Namibian dollar is pegged 1:1 to ZAR, "
          "so the ZAR rate stands in for it.")
    else:
        a("**FX rates could not be fetched** - CZK columns are unavailable.")
    a("")
    a(f"**Card cost** assumes a **{margin*100:.1f}%** FX margin on any non-CZK payment - the "
      f"midpoint of the {lo*100:.0f}-{hi*100:.0f}% a card typically loads. A CZK quote carries "
      "no margin, so it is shown at face value. Set `FX_MARGIN_ASSUMED` in `config.py` to your "
      "card's real rate; a 0% FX card changes which row wins.")
    a("")

    # --- main table -------------------------------------------------------
    a("## Comparison, sorted by what the card is actually debited (CZK)")
    a("")
    required = [r for r in rows if not _is_alt(payload, r["target_id"])]
    alts = [r for r in rows if _is_alt(payload, r["target_id"])]

    if not required:
        a("_No source returned a priced offer matching the required flights._")
    for tid in [t["id"] for t in payload["targets"]]:
        sub = [r for r in required if r["target_id"] == tid]
        a(f"### {_label(payload, tid)}")
        a("")
        if not sub:
            a("_No matching offer from any source._")
            a("")
            continue
        a("| # | Source / point of sale | Fare tier | Quoted | In CZK | Card cost CZK | Cabin bag | Checked | Single ticket (PNR) |")
        a("|---|---|---|---|---|---|---|---|---|")
        for i, r in enumerate(sub, 1):
            cabin = _yn(r["cabin_ok"])
            if r["cabin_ok"] is False and r["cabin_fee"]:
                cabin = f"EXTRA +{r['cabin_fee']:,.0f} {r['currency']}"
            a(f"| {i} | {r['source']} / {r['pos']} | {r['tier']} | "
              f"{r['price']:,.0f} {r['currency']} | {_fmt(r['czk'])} | **{_fmt(r['card_czk'])}** | "
              f"{cabin} | {_fmt(r['checked'])} | {_yn(r['single'])} ({_fmt(r['pnr'])}) |")
        a("")

    # --- alternative ------------------------------------------------------
    a("## Alternative - needs tour operator approval")
    a("")
    a("Recorded only, never recommended: it does not keep the tour schedule.")
    a("")
    if alts:
        a("| Source | Flights | Quoted | In CZK | Card cost CZK | Single ticket |")
        a("|---|---|---|---|---|---|")
        for r in alts:
            a(f"| {r['source']} / {r['pos']} | {r['flights']} | {r['price']:,.0f} {r['currency']} | "
              f"{_fmt(r['czk'])} | {_fmt(r['card_czk'])} | {_yn(r['single'])} |")
    else:
        a("_No priced alternative was returned._")
        a("")
        a(reference.NONSTOP_WDH_VFA_NOTE)
    a("")

    # --- recommendation ---------------------------------------------------
    a("## Recommendation")
    a("")
    for t in payload["targets"]:
        sub = [r for r in rows if r["target_id"] == t["id"]]
        need_single = t.get("single_ticket_required")
        # A tier that charges for the cabin bag still qualifies - its fee is
        # already added into the price we sort on. What does not qualify is a
        # tier whose cabin bag costs extra by an amount we could not read, or
        # one that fails leg 2's single-ticket requirement.
        ok = [r for r in sub
              if (r["cabin_ok"] is not False or r["cabin_fee"] is not None)
              and (not need_single or r["single"] is True)]
        a(f"**{t['label']}**")
        a("")
        if not ok:
            a("- No source produced a bookable, cabin-bag-inclusive"
              + (" single-ticket" if need_single else "") + " quote. See the source log.")
            a("")
            continue
        best = ok[0]
        others = [r for r in ok[1:]]
        a(f"- Cheapest qualifying: **{best['source']} / {best['pos']}**, "
          f"{best['tier']}, {best['price']:,.0f} {best['currency']}"
          + (f" - **{best['card_czk']:,.0f} CZK** on the card" if best["card_czk"] else ""))
        if best["cabin_ok"] is False and best["cabin_fee"]:
            a(f"- Cabin bag is **not** in this tier: the {best['cabin_fee']:,.0f} "
              f"{best['currency']} bag fee is already included in the figures above.")
        a(f"- Pay in **{best['currency']}**"
          + (" - quoted in CZK, so no card FX margin applies."
             if best["currency"] == config.REPORT_CURRENCY
             else f" - non-CZK, so the {margin*100:.1f}% card margin is already included above."))
        if need_single:
            a(f"- Single ticket / one PNR: **{_yn(best['single'])}**"
              + (f" (pnrCount={best['pnr']})" if best["pnr"] is not None else "")
              + " - required for this leg, and confirmed.")
        if others:
            a("- Same itinerary, other quotes: "
              + "; ".join(f"{o['pos']} {o['price']:,.0f} {o['currency']}"
                          + (f" = {o['card_czk']:,.0f} CZK" if o["card_czk"] else "")
                          for o in others))
        a("")

    a("### What this comparison is missing")
    a("")
    a("Read the source log before acting on the table: if the airline's own site is "
      "listed as `blocked`, then no airline-direct price is in the table at all, and "
      "the cheapest row is only the cheapest *among the sources that answered*. "
      "Airlink direct is routinely cheaper than an agency, so price it by hand, or "
      "re-run this tool from a normal home connection, before you book.")
    a("")

    # --- airline reference -------------------------------------------------
    a("## Airlink fare families and cabin baggage")
    a("")
    a("Airlink does not sell Lite / Classic / Flex. Its economy fare families are:")
    a("")
    a("| Fare family | Cabin | Booking classes | Checked baggage |")
    a("|---|---|---|---|")
    for f in reference.SUNBIRD_FAMILIES:
        a(f"| {f['name']} | {f['cabin']} | {f['rbd']} | {f['checked_kg']} kg |")
    a("")
    a(f"Source: {reference.FARE_FAMILY_SOURCE}")
    a("")
    cb = reference.CABIN_BAG
    a(f"**Cabin bag:** {cb['pieces']} piece, max **{cb['max_kg']} kg**, max "
      f"**{cb['max_cm']} cm**, included in every economy fare family - so on this route "
      "no tier charges extra for a cabin bag, and nothing needed a bag fee added to it.")
    a("")
    a(f"_{cb['caveat']}_")
    a("")
    a(f"**Change / refund:** {reference.CHANGE_REFUND_NOTE}")
    a("")

    # --- detail -----------------------------------------------------------
    a("## Fare detail")
    a("")
    for r in rows:
        a(f"**{r['source']} / {r['pos']} - {r['tier']}** ({_label(payload, r['target_id'])})")
        a("")
        a(f"- Flights matched: `{r['flights']}`")
        a(f"- Price: {r['price']:,.0f} {r['currency']}"
          + (f" = {r['czk']:,.0f} CZK interbank, {r['card_czk']:,.0f} CZK on the card" if r["czk"] else ""))
        a(f"- Cabin bag: {r['cabin_allow'] or _yn(r['cabin_ok'])}")
        a(f"- Checked bags included: {_fmt(r['checked'])}")
        a(f"- Single ticket / one PNR: {_yn(r['single'])}"
          + (f" (pnrCount={r['pnr']})" if r["pnr"] is not None else ""))
        a(f"- Change rules: {r['change'] or 'not published at the results page'}")
        a(f"- Refund rules: {r['refund'] or 'not published at the results page'}")
        if r["seats"] is not None:
            a(f"- Seats left at this price: {r['seats']}")
        for n in r["notes"]:
            a(f"- Note: {n}")
        if r["url"]:
            a(f"- Results page: {r['url']}")
        a("")

    # --- source log -------------------------------------------------------
    a("## Source log")
    a("")
    a("Every source attempted, including the ones that refused. Sites that showed a "
      "captcha or bot wall were logged and skipped, never worked around.")
    a("")
    a("| Source | Point of sale | Itinerary | Status | Detail |")
    a("|---|---|---|---|---|")
    for res in payload["results"]:
        detail = (res.get("detail") or "").replace("|", "/").replace("\n", " ")
        a(f"| {res['source']} | {res['point_of_sale']} | {res['target_id']} | "
          f"**{res['status']}** | {detail[:240]} |")
    a("")
    return "\n".join(out) + "\n"
