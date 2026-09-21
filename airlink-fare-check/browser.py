"""Headless Chromium helper.

Politeness and honesty rules live here:
  * one browser for the whole run, a fresh context per site
  * a delay between page loads
  * bot walls and captchas are detected and reported, never worked around
"""

from __future__ import annotations

import contextlib
import re
import time

import config

UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/141.0.0.0 Safari/537.36")

# Signatures of "you are a bot" interstitials. If one of these is showing we
# stop and report the source as blocked.
BLOCK_PATTERNS = [
    (r"_Incapsula_Resource|Incapsula incident", "Imperva/Incapsula interstitial"),
    (r"Pardon Our Interruption", "Imperva Advanced Bot Protection"),
    (r"hcaptcha\.com/captcha|h-captcha-response", "hCaptcha challenge"),
    (r"recaptcha/api2|g-recaptcha-response", "reCAPTCHA challenge"),
    (r"Are you a person or a robot", "Skyscanner bot check"),
    (r"px-captcha|/sttc/px/captcha", "PerimeterX captcha"),
    (r"Our systems have detected unusual traffic", "Google unusual-traffic block"),
    (r"Access Denied|You have been blocked", "generic WAF block"),
    (r"Press & Hold|Press and Hold", "hold-to-confirm bot check"),
]

_last_load: dict[str, float] = {}


class Blocked(Exception):
    """A bot wall or captcha is in the way. We stop here by design."""


@contextlib.contextmanager
def browser(headless: bool = True):
    from playwright.sync_api import sync_playwright

    args = [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
    ]
    with sync_playwright() as p:
        kw = {"headless": headless, "args": args}
        if config.CHROMIUM_EXECUTABLE:
            import os
            if os.path.exists(config.CHROMIUM_EXECUTABLE):
                kw["executable_path"] = config.CHROMIUM_EXECUTABLE
        b = p.chromium.launch(**kw)
        try:
            yield b
        finally:
            b.close()


@contextlib.contextmanager
def page(br, locale: str = "en-GB", timezone: str = "Europe/Prague"):
    ctx = br.new_context(
        user_agent=UA,
        locale=locale,
        timezone_id=timezone,
        viewport={"width": 1500, "height": 1300},
    )
    ctx.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")
    pg = ctx.new_page()
    try:
        yield pg
    finally:
        with contextlib.suppress(Exception):
            ctx.close()


def polite_goto(pg, url: str, wait_ms: int = 0, host_key: str | None = None):
    """Load a URL, rate-limited per host, then check for a bot wall."""
    key = host_key or re.sub(r"^https?://([^/]+).*", r"\1", url)
    gap = time.time() - _last_load.get(key, 0.0)
    if gap < config.REQUEST_DELAY_SECONDS:
        time.sleep(config.REQUEST_DELAY_SECONDS - gap)
    _last_load[key] = time.time()

    pg.goto(url, timeout=config.PAGE_TIMEOUT_MS, wait_until="domcontentloaded")
    if wait_ms:
        pg.wait_for_timeout(wait_ms)
    check_blocked(pg)
    return pg


def check_blocked(pg) -> None:
    """Raise Blocked if the page is a bot wall. Never try to solve one."""
    try:
        html = pg.content()
    except Exception:
        return
    # Frame URLs catch captchas rendered in an iframe.
    haystack = html + " " + " ".join(f.url for f in pg.frames)
    for pattern, label in BLOCK_PATTERNS:
        if re.search(pattern, haystack, re.I):
            raise Blocked(f"{label} at {pg.url.split('?')[0]}")


def accept_cookies(pg, names=("Accept all", "Accept", "I agree", "Agree", "Got it")):
    import re as _re
    for n in names:
        try:
            btn = pg.get_by_role("button", name=_re.compile(_re.escape(n), _re.I)).first
            if btn.is_visible(timeout=2500):
                btn.click(timeout=4000)
                pg.wait_for_timeout(1200)
                return True
        except Exception:
            continue
    return False
