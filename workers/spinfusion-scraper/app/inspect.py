"""Headed-login helper for recording the report-download flow.

Run:
    python -m app.inspect

Loads SPINFUSION_* env vars from .env, logs into Spinfusion in a visible
browser, then hands control to you. Drive the browser to Reports, run the
saved MD+CRNA report, and click the CSV download — the script watches for
downloads and saves them to /tmp/spinfusion-report-*.csv so we can inspect
the actual filename and headers that production will see.

Press Enter in the terminal to close the browser.
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from playwright.async_api import async_playwright

from .scraper import _login, ScrapeConfig, ScraperError


DOWNLOAD_DIR = Path("/tmp")


def _cfg() -> ScrapeConfig:
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
        report_name=os.environ.get("SPINFUSION_REPORT_NAME", ""),
        site=os.environ.get("SITE_NAME", "Paoli"),
        user_id="inspect",
        days_ahead=28,
    )


async def main() -> None:
    load_dotenv()
    cfg = _cfg()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False, slow_mo=150)
        context = await browser.new_context(accept_downloads=True)
        page = await context.new_page()

        async def on_download(download):
            ts = datetime.now().strftime("%H%M%S")
            suggested = download.suggested_filename or "spinfusion-report.csv"
            dest = DOWNLOAD_DIR / f"spinfusion-{ts}-{suggested}"
            await download.save_as(dest)
            print(f"[inspect] download captured -> {dest}")

        page.on("download", lambda d: asyncio.create_task(on_download(d)))

        # On every navigation, snapshot HTML + screenshot for selector authoring.
        seen_paths: set[str] = set()

        async def snapshot():
            try:
                url = page.url
                path = url.split("/")[-1].split("?")[0] or "root"
                # Allow re-snapshot of the same path (state may change without nav).
                key = f"{path}-{datetime.now().strftime('%H%M%S')}"
                if key in seen_paths:
                    return
                seen_paths.add(key)
                await page.wait_for_load_state("domcontentloaded")
                html = await page.content()
                html_path = DOWNLOAD_DIR / f"spinfusion-page-{key}.html"
                png_path = DOWNLOAD_DIR / f"spinfusion-page-{key}.png"
                html_path.write_text(html, encoding="utf-8")
                await page.screenshot(path=str(png_path), full_page=True)
                print(f"[inspect] snapshot {key} -> {html_path.name}, {png_path.name}")
            except Exception as e:  # noqa: BLE001
                print(f"[inspect] snapshot skipped: {e}")

        page.on("framenavigated", lambda _: asyncio.create_task(snapshot()))

        print("[inspect] logging in…")
        await _login(page, cfg)
        print("[inspect] logged in. Browser is yours — drive to Reports → run "
              "the MD+CRNA report → click Export/Download.")
        print("[inspect] downloads are auto-saved to /tmp/spinfusion-*.csv.")
        print("[inspect] Press Enter here to close the browser.")

        await asyncio.get_event_loop().run_in_executor(None, input)
        await context.close()
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
