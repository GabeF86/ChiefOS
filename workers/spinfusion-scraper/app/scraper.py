"""Spinfusion scraper — Playwright skeleton.

WHY SO SKELETAL: the real Spinfusion DOM is not in this repo. The selectors
and login flow below are *placeholders* — record a session against the real
UI (Playwright codegen) and fill them in.

Public surface:
    async scrape(days_ahead: int) -> list[AssignmentRow]

Both login and parse raise ScraperError on failure so the entrypoint can
classify the run and decide whether to alert.
"""

from __future__ import annotations

import asyncio
import os
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import List, Optional

from playwright.async_api import (
    Browser,
    Page,
    TimeoutError as PWTimeout,
    async_playwright,
)

from .supabase_client import AssignmentRow


class ScraperError(RuntimeError):
    """Raised for any unrecoverable scrape failure."""


@dataclass
class ScrapeConfig:
    username: str
    password: str
    login_url: str
    schedule_url: str
    site: str
    user_id: str
    days_ahead: int
    # Where to dump the last successfully-loaded HTML on parse failure.
    debug_html_path: str = "/tmp/spinfusion-last.html"


def config_from_env() -> ScrapeConfig:
    def req(name: str) -> str:
        v = os.environ.get(name)
        if not v:
            raise ScraperError(f"missing env var {name}")
        return v

    return ScrapeConfig(
        username=req("SPINFUSION_USERNAME"),
        password=req("SPINFUSION_PASSWORD"),
        login_url=req("SPINFUSION_LOGIN_URL"),
        schedule_url=req("SPINFUSION_SCHEDULE_URL"),
        site=os.environ.get("SITE_NAME", "Paoli"),
        user_id=req("CHIEFOS_VAULT_USER_ID"),
        days_ahead=int(os.environ.get("DAYS_AHEAD", "7")),
    )


async def scrape(cfg: ScrapeConfig) -> List[AssignmentRow]:
    async with async_playwright() as pw:
        browser: Browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        try:
            await _login(page, cfg)
            html = await _load_schedule(page, cfg)
            try:
                rows = _parse_schedule(html, cfg)
            except Exception as e:
                _dump_html(html, cfg.debug_html_path)
                raise ScraperError(f"parse failed: {e}") from e
            return rows
        finally:
            await context.close()
            await browser.close()


async def _login(page: Page, cfg: ScrapeConfig, attempts: int = 3) -> None:
    last_err: Optional[Exception] = None
    for i in range(attempts):
        try:
            await page.goto(cfg.login_url, wait_until="networkidle")
            # TODO: replace these selectors with the real form fields.
            await page.fill('input[name="username"]', cfg.username)
            await page.fill('input[name="password"]', cfg.password)
            await page.click('button[type="submit"]')
            # TODO: replace with a real post-login indicator.
            await page.wait_for_url(
                lambda url: cfg.login_url not in url,
                timeout=15_000,
            )
            return
        except PWTimeout as e:
            last_err = e
            await asyncio.sleep(2 ** i)
    raise ScraperError(f"login failed after {attempts} attempts: {last_err}")


async def _load_schedule(page: Page, cfg: ScrapeConfig) -> str:
    await page.goto(cfg.schedule_url, wait_until="networkidle")
    # TODO: if the schedule view requires interactions (date range, site filter,
    # etc.), do them here before extracting HTML.
    return await page.content()


def _parse_schedule(html: str, cfg: ScrapeConfig) -> List[AssignmentRow]:
    """Parse the schedule HTML into AssignmentRow objects.

    This is a stub — the real parser depends on the Spinfusion table structure.
    Two suggested approaches:

    1. BeautifulSoup over the rendered HTML — easiest if rows are static.
    2. Re-query Playwright for structured selectors (page.locator) before
       handing HTML to this function.

    For now we return [] so the dashboard's empty state surfaces honestly.
    A non-empty stub helps integration tests; toggle DEBUG_STUB_ROWS=1 to get
    fake data shaped like real output.
    """
    if os.environ.get("DEBUG_STUB_ROWS") == "1":
        today = date.today()
        return [
            AssignmentRow(
                user_id=cfg.user_id,
                date=(today + timedelta(days=d)).isoformat(),
                provider_name=name,
                role=role,
                site=cfg.site,
                assignment_text=slot,
            )
            for d in range(min(cfg.days_ahead, 2))
            for (name, role, slot) in [
                ("Farkas, G.", "MD", "OR 1 *"),
                ("Smith, A.", "MD", "OR 3"),
                ("Jones, B.", "CRNA", "OR 1"),
                ("Lee, C.", "CRNA", "OR 5 (call)"),
            ]
        ]

    # Real implementation goes here. Leaving structure visible:
    rows: List[AssignmentRow] = []
    # Example pattern: lines like "Farkas, G. OR 1 *"
    _line_re = re.compile(
        r"^(?P<name>[^\t]+?)\s+(?P<slot>(OR \d+|Call|Off|Late|Early)[^\n]*)$"
    )
    _ = _line_re, html, datetime  # silence unused-import warnings until wired
    return rows


def _dump_html(html: str, path: str) -> None:
    try:
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(html)
    except OSError:
        pass
