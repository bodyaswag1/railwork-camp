#!/usr/bin/env python3
"""Checks that the matcher accepts only the exact flights asked for.

    python3 test_matching.py

This is the safety net that stops a cheaper-but-wrong departure being reported
as a match. Run it after editing config.TARGETS or model.matches_target.
"""

import sys

import config
from model import Segment, matches_target


def seg(carrier, number, origin, dest, dep, arr, date):
    return Segment(carrier, number, origin, dest, f"{date}T{dep}:00", f"{date}T{arr}:00")


def main() -> int:
    leg1, leg2 = config.TARGETS
    alt = config.ALTERNATIVES[0]

    L1 = [seg("4Z", "341", "CPT", "WVB", "11:10", "13:25", "2027-01-02")]
    L2 = [seg("4Z", "129", "WDH", "JNB", "07:10", "09:00", "2027-01-06"),
          seg("4Z", "494", "JNB", "VFA", "11:35", "13:20", "2027-01-06")]

    cases = [
        ("leg1 exact",                      L1, leg1, True),
        ("leg1 five minutes later",         [seg("4Z", "341", "CPT", "WVB", "11:15", "13:25", "2027-01-02")], leg1, False),
        ("leg1 next day",                   [seg("4Z", "341", "CPT", "WVB", "11:10", "13:25", "2027-01-03")], leg1, False),
        ("leg1 different flight number",    [seg("4Z", "343", "CPT", "WVB", "11:10", "13:25", "2027-01-02")], leg1, False),
        ("leg1 other carrier same time",    [seg("SA", "341", "CPT", "WVB", "11:10", "13:25", "2027-01-02")], leg1, False),
        ("leg2 exact",                      L2, leg2, True),
        # The JNB connection time was never specified, so any is acceptable as
        # long as the flight numbers and the overall times hold.
        ("leg2 different connection time",  [seg("4Z", "129", "WDH", "JNB", "07:10", "09:20", "2027-01-06"),
                                             seg("4Z", "494", "JNB", "VFA", "12:00", "13:20", "2027-01-06")], leg2, True),
        ("leg2 wrong second flight",        [seg("4Z", "129", "WDH", "JNB", "07:10", "09:00", "2027-01-06"),
                                             seg("4Z", "492", "JNB", "VFA", "11:35", "13:20", "2027-01-06")], leg2, False),
        ("leg2 missing second flight",      L2[:1], leg2, False),
        ("leg2 segments out of order",      list(reversed(L2)), leg2, False),
        ("leg2 late arrival",               [seg("4Z", "129", "WDH", "JNB", "07:10", "09:00", "2027-01-06"),
                                             seg("4Z", "494", "JNB", "VFA", "11:35", "14:20", "2027-01-06")], leg2, False),
        ("alt accepts a nonstop",           [seg("4Z", "8135", "WDH", "VFA", "08:56", "10:21", "2027-01-06")], alt, True),
        ("alt rejects a connection",        L2, alt, False),
        ("alt rejects the wrong date",      [seg("4Z", "8135", "WDH", "VFA", "08:56", "10:21", "2027-01-07")], alt, False),
    ]

    failures = 0
    for name, segments, target, expected in cases:
        got, why = matches_target(segments, target)
        if got == expected:
            print(f"  ok    {name}" + (f"  ({why})" if why else ""))
        else:
            failures += 1
            print(f"  FAIL  {name}: got {got}, expected {expected} ({why})")

    print(f"\n{len(cases) - failures}/{len(cases)} passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
