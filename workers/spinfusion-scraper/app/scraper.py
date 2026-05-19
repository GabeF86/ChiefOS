"""Spinfusion (symplr Physician Scheduling) scraper.

Logs into Spinfusion, runs a saved report, captures the CSV download, and
parses it into AssignmentRow records. The CSV has columns:

    Name, Date, Schedule, Assignment, Hours

Schedule maps to role ("Physician - …" → MD, "CRNA - …" → CRNA). Hours is
ignored. Date is MM/DD/YYYY.

Public surface:
    async scrape(cfg: ScrapeConfig) -> list[AssignmentRow]
    parse_report_csv(path, cfg) -> list[AssignmentRow]   # pure, testable

Both login and parse raise ScraperError on failure so the entrypoint can
classify the run and decide whether to alert.
"""

from __future__ import annotations

import asyncio
import csv
import os
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
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
    org: str
    username: str
    password: str
    login_url: str
    report_name: str
    site: str
    user_id: str
    days_ahead: int
    # If set, skip Playwright entirely and parse this local CSV file.
    # Useful for development while the download flow isn't automated yet.
    local_csv_path: Optional[str] = None
    # When True, run Chromium with a visible window (debugging only).
    headed: bool = False


def config_from_env() -> ScrapeConfig:
    def req(name: str) -> str:
        v = os.environ.get(name)
        if not v:
            raise ScraperError(f"missing env var {name}")
        return v

    return ScrapeConfig(
        org=req("SPINFUSION_ORG"),
        username=req("SPINFUSION_USERNAME"),
        password=req("SPINFUSION_PASSWORD"),
        login_url=req("SPINFUSION_LOGIN_URL"),
        report_name=os.environ.get(
            "SPINFUSION_REPORT_NAME", "Paoli — MDs + CRNAs (rolling 4 weeks)"
        ),
        site=os.environ.get("SITE_NAME", "Paoli"),
        user_id=req("CHIEFOS_VAULT_USER_ID"),
        days_ahead=int(os.environ.get("DAYS_AHEAD", "28")),
        local_csv_path=os.environ.get("SPINFUSION_LOCAL_CSV") or None,
        headed=os.environ.get("SPINFUSION_HEADED") == "1",
    )


async def scrape(cfg: ScrapeConfig) -> List[AssignmentRow]:
    """Run one scrape: download report (or read local CSV) → parse → return."""
    if cfg.local_csv_path:
        return parse_report_csv(cfg.local_csv_path, cfg)

    async with async_playwright() as pw:
        browser: Browser = await pw.chromium.launch(
            headless=not cfg.headed,
            slow_mo=150 if cfg.headed else 0,
        )
        context = await browser.new_context(accept_downloads=True)
        page = await context.new_page()
        try:
            await _login(page, cfg)
            csv_path = await _download_report(page, cfg)
            return parse_report_csv(csv_path, cfg)
        finally:
            await context.close()
            await browser.close()


async def _login(page: Page, cfg: ScrapeConfig, attempts: int = 3) -> None:
    """Spinfusion login: Organization → Username → Password → Login.

    The org field has no accessible label that Playwright can match by role,
    so we target the first Angular Material input by id (mat-input-0). The
    other two fields are addressable by their visible label.
    """
    last_err: Optional[Exception] = None
    for i in range(attempts):
        try:
            await page.goto(cfg.login_url, wait_until="networkidle")
            await page.locator("#mat-input-0").fill(cfg.org)
            await page.get_by_role("textbox", name="Username").fill(cfg.username)
            await page.get_by_role("textbox", name="Password").fill(cfg.password)
            await page.get_by_role("button", name="Login", exact=True).click()
            await page.get_by_role("link", name="Schedules").wait_for(
                state="visible", timeout=15_000
            )
            return
        except PWTimeout as e:
            last_err = e
            await asyncio.sleep(2 ** i)
    raise ScraperError(f"login failed after {attempts} attempts: {last_err}")


async def _download_report(page: Page, cfg: ScrapeConfig) -> str:
    """Drive the Tools → Assignment Data Dump form: pick `This Week` from the
    date-range shortcuts, set Export Type = CSV, select both schedules
    (Physician + CRNA Paoli Work), submit, and capture the download.

    Returns the absolute path to the saved CSV.
    """
    _ = cfg  # site-specific schedule names are currently hardcoded; revisit.

    # 1. Navigate into the form via the left sidenav.
    await page.get_by_role("link", name="Assignment Data Dump").click()
    await page.wait_for_selector("spin-daterange", timeout=15_000)

    # 2. Open the date picker, pick "This Week" from the Shortcuts list.
    await page.locator("spin-daterange .date-display").first.click()
    await page.get_by_text("Shortcuts", exact=True).click()
    await page.get_by_text("This Week", exact=True).click()
    # If the picker doesn't auto-close on a shortcut, dismiss it.
    await page.keyboard.press("Escape")

    # 3. Export Type → CSV (ng-select single).
    await page.locator('ng-select[name="exportType"]').click()
    await page.locator(".ng-option").get_by_text("CSV", exact=True).click()

    # 4. Schedules → Physician + CRNA (ng-select multi).
    await page.locator('ng-select[name="selectedScheds"]').click()
    await page.locator(".ng-option").get_by_text(
        "Physician - Paoli Work", exact=True
    ).click()
    await page.locator(".ng-option").get_by_text(
        "CRNA - Paoli Work", exact=True
    ).click()
    await page.keyboard.press("Escape")

    # 5. Submit and capture the resulting CSV download.
    async with page.expect_download(timeout=60_000) as dl_info:
        await page.get_by_role("button", name="Submit").click()
    download = await dl_info.value

    out = Path("/tmp") / f"spinfusion-{datetime.now():%Y%m%d-%H%M%S}.csv"
    await download.save_as(out)
    return str(out)


def parse_report_csv(path: str | Path, cfg: ScrapeConfig) -> List[AssignmentRow]:
    """Parse a Spinfusion report CSV (Name,Date,Schedule,Assignment,Hours)
    into AssignmentRow records, filtered to [today, today + days_ahead].
    """
    today = date.today()
    cutoff = today + timedelta(days=cfg.days_ahead)
    rows: List[AssignmentRow] = []

    try:
        fh = open(path, newline="", encoding="utf-8-sig")
    except FileNotFoundError as e:
        raise ScraperError(f"report CSV not found: {path}") from e

    with fh:
        reader = csv.DictReader(fh)
        required = {"Name", "Date", "Schedule", "Assignment"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ScraperError(
                f"report CSV missing columns: {sorted(missing)} (got {reader.fieldnames})"
            )

        for r in reader:
            d = _parse_csv_date(r.get("Date"))
            if d is None or d < today or d > cutoff:
                continue
            role = _role_from_schedule(r.get("Schedule", ""))
            if role is None:
                continue
            name = (r.get("Name") or "").strip()
            slot = (r.get("Assignment") or "").strip()
            if not name or not slot:
                continue
            rows.append(
                AssignmentRow(
                    user_id=cfg.user_id,
                    date=d.isoformat(),
                    provider_name=name,
                    role=role,
                    site=cfg.site,
                    assignment_text=slot,
                )
            )

    return rows


def _parse_csv_date(text: Optional[str]) -> Optional[date]:
    if not text:
        return None
    try:
        return datetime.strptime(text.strip(), "%m/%d/%Y").date()
    except ValueError:
        return None


def _role_from_schedule(schedule: str) -> Optional[str]:
    """Map the Schedule column to a role.

    Examples:
      'Physician - Paoli Work' -> 'MD'
      'CRNA - Paoli Work'      -> 'CRNA'
    """
    s = (schedule or "").strip().lower()
    if s.startswith("physician"):
        return "MD"
    if s.startswith("crna"):
        return "CRNA"
    return None
