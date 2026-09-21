"""Live FX rates, and the card-payment cost of paying in a foreign currency."""

from __future__ import annotations

import json
import urllib.request
import datetime as _dt

import config

# 1:1 currency pegs used when the rate provider has no quote of its own.
PEGGED = {"NAD": "ZAR", "LSL": "ZAR", "SZL": "ZAR"}

# Free, no key, ECB reference rates. Mirrors are tried in order.
PROVIDERS = [
    ("frankfurter.dev", "https://api.frankfurter.dev/v1/latest?base={base}"),
    ("frankfurter.app", "https://api.frankfurter.app/latest?from={base}"),
    ("open.er-api.com", "https://open.er-api.com/v6/latest/{base}"),
]


class Rates:
    def __init__(self, base: str, rates: dict[str, float], provider: str, as_of: str):
        self.base = base
        self.rates = rates
        self.provider = provider
        self.as_of = as_of
        self.fetched_at = _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds")

    def rate(self, frm: str, to: str) -> float:
        frm, to = frm.upper(), to.upper()
        if frm == to:
            return 1.0
        table = dict(self.rates)
        table[self.base] = 1.0
        # ECB does not publish NAD. The Namibian dollar is pegged 1:1 to the
        # South African rand, so ZAR stands in for it. Recorded in the report.
        for pegged, peg_to in PEGGED.items():
            if pegged not in table and peg_to in table:
                table[pegged] = table[peg_to]
        if frm not in table or to not in table:
            raise KeyError(f"no rate for {frm}->{to} (have {sorted(table)[:12]}...)")
        # table[x] = units of x per 1 base
        return table[to] / table[frm]

    def convert(self, amount: float, frm: str, to: str) -> float:
        return amount * self.rate(frm, to)

    def to_dict(self) -> dict:
        return {
            "base": self.base,
            "provider": self.provider,
            "rates_as_of": self.as_of,
            "fetched_at": self.fetched_at,
            "rates": self.rates,
        }


def fetch_rates(base: str = "EUR", timeout: int = 30) -> Rates:
    last = None
    for name, tmpl in PROVIDERS:
        url = tmpl.format(base=base)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "airlink-fare-check/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = json.load(r)
            rates = data.get("rates") or {}
            as_of = data.get("date") or data.get("time_last_update_utc") or "unknown"
            if rates:
                return Rates(base, rates, name, str(as_of))
        except Exception as e:  # try the next mirror
            last = f"{name}: {e}"
    raise RuntimeError(f"could not fetch FX rates ({last})")


def card_cost(amount_czk: float, quoted_currency: str,
              margin: float = config.FX_MARGIN_ASSUMED) -> float:
    """What the card is actually debited, in CZK.

    Paying in CZK costs nothing extra; any other currency is assumed to carry
    an FX margin on top of the interbank rate.
    """
    if quoted_currency.upper() == config.REPORT_CURRENCY:
        return amount_czk
    return amount_czk * (1.0 + margin)
